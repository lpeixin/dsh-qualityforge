/**
 * 项目侦察（reconnaissance）。
 *
 * 结论全部来自磁盘证据：读到的清单、配置、脚本与文件统计。这里不做任何猜测，
 * 凡是没有证据的判断一律不写进画像——画像会被 Agent 引用为测试依据，猜错比不写更糟。
 *
 * 输出三类信息：
 *   1. 事实（ecosystems / scripts / tools / ci / containers / api / tests）
 *   2. 可执行命令（commands）：每条都带 preset、来源与人类可读说明，供 qf_exec 执行
 *   3. 工程实践缺口（gaps）：已经可以确定的、优先级明确的问题，qf_plan 会把它变成测试项
 *
 * 本模块只读：不写文件、不改配置，唯一的外部进程调用是只读的 git 查询。
 */

import { spawn } from 'node:child_process'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { nowIso, toPosix } from './util.js'

/** 扫描时跳过的目录：依赖、产物、缓存与工具内部目录。 */
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', 'output', 'coverage',
  '.next', '.nuxt', '.output', '.svelte-kit', '.turbo', '.parcel-cache', '.cache',
  'target', 'vendor', '__pycache__', '.venv', 'venv', 'env', '.tox', '.mypy_cache',
  '.pytest_cache', '.ruff_cache', '.idea', '.vscode', '.qualityforge', '.dsh',
  'tmp', 'temp', 'logs', '.pnpm-store', '.yarn', 'Pods', 'DerivedData', '.gradle',
  '.terraform', '.serverless', 'bower_components', 'site-packages', '.angular',
])

const IGNORED_FILE_SUFFIXES = ['.lock', '.log', '.map', '.min.js', '.min.css', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf', '.zip', '.gz', '.tgz', '.tar', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.wasm', '.so', '.dylib', '.dll', '.exe', '.bin', '.pyc', '.class', '.jar']

/**
 * 值得读取的点目录：CI、提交钩子、发布、容器与基础设施配置的常见落点。
 *
 * 其余点目录一律跳过。它们通常是工具缓存、本地脚手架或临时产物（`.tmp-*`、`.history`、
 * `.cache`…）。把它们当成产品代码，会让规模统计、语言分布与"调试语句"信号同时失真，
 * 而这三者都会直接进入项目画像与工程缺口结论。
 */
const HIDDEN_DIRS_TO_SCAN = new Set([
  '.github', '.husky', '.changeset', '.devcontainer', '.circleci', '.buildkite',
  '.woodpecker', '.gitlab', '.azure', '.dvc', '.storybook',
])

const SOURCE_EXTENSIONS = new Map([
  ['.js', 'JavaScript'], ['.jsx', 'JavaScript'], ['.mjs', 'JavaScript'], ['.cjs', 'JavaScript'],
  ['.ts', 'TypeScript'], ['.tsx', 'TypeScript'], ['.mts', 'TypeScript'], ['.cts', 'TypeScript'],
  ['.py', 'Python'], ['.go', 'Go'], ['.rs', 'Rust'], ['.java', 'Java'], ['.kt', 'Kotlin'],
  ['.rb', 'Ruby'], ['.php', 'PHP'], ['.cs', 'C#'], ['.c', 'C'], ['.h', 'C'], ['.cc', 'C++'],
  ['.cpp', 'C++'], ['.hpp', 'C++'], ['.swift', 'Swift'], ['.m', 'Objective-C'], ['.scala', 'Scala'],
  ['.sh', 'Shell'], ['.bash', 'Shell'], ['.ps1', 'PowerShell'], ['.sql', 'SQL'], ['.vue', 'Vue'],
  ['.svelte', 'Svelte'], ['.dart', 'Dart'], ['.ex', 'Elixir'], ['.exs', 'Elixir'], ['.lua', 'Lua'],
])

/** 有内容分析价值、值得读取正文的文件（做信号扫描）。 */
const TEXTY_EXTENSIONS = new Set([...SOURCE_EXTENSIONS.keys(), '.json', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.md', '.txt', '.env', '.example'])

const MAX_FILES = 25_000
const MAX_DEPTH = 14
const MAX_TEXT_FILE_BYTES = 400_000
const MAX_TEXT_FILES_READ = 900

const SECRET_PATTERNS = [
  { id: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key ID' },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, label: '私钥文件内容' },
  { id: 'github-token', re: /gh[pousr]_[A-Za-z0-9]{30,}/, label: 'GitHub Token' },
  { id: 'slack-token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/, label: 'Slack Token' },
  { id: 'openai-key', re: /sk-[A-Za-z0-9]{32,}/, label: 'OpenAI 风格 API Key' },
  { id: 'google-api-key', re: /AIza[0-9A-Za-z_-]{35}/, label: 'Google API Key' },
  { id: 'jwt', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, label: '疑似长期 JWT' },
  { id: 'hardcoded-password', re: /(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, label: '硬编码口令/密钥赋值' },
]

const TODO_RE = /\b(TODO|FIXME|HACK|XXX|BUG)\b/
const DEBUG_RE = /\b(console\.(log|debug)|debugger|print\(|System\.out\.println|fmt\.Println|dbg!)\b/

function runGit(projectPath, args, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn('git', args, { cwd: projectPath, stdio: ['ignore', 'pipe', 'ignore'], timeout: timeoutMs })
    } catch {
      resolve(undefined)
      return
    }
    let out = ''
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    child.stdout?.on('data', (chunk) => { out += chunk })
    child.on('error', () => finish(undefined))
    child.on('close', (code) => finish(code === 0 ? out.trim() : undefined))
  })
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return undefined
  }
}

async function readText(file, maxBytes = MAX_TEXT_FILE_BYTES) {
  try {
    const info = await stat(file)
    if (!info.isFile() || info.size > maxBytes) return undefined
    return await readFile(file, 'utf8')
  } catch {
    return undefined
  }
}

async function exists(target) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

async function listDir(target) {
  try {
    return await readdir(target, { withFileTypes: true })
  } catch {
    return []
  }
}

/** 深度受限的全目录遍历，收集文件清单与语言分布。 */
async function walk(root) {
  const files = []
  const languages = new Map()
  let bytes = 0
  let truncated = false
  const queue = [{ dir: root, depth: 0 }]

  while (queue.length > 0) {
    const { dir, depth } = queue.shift()
    const entries = await listDir(dir)
    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true
        break
      }
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // 注意：这里必须精确比较 '.git'，不能用 startsWith——'.github' 也以 '.git' 开头，
        // 误伤它会让 CI 工作流、dependabot、ISSUE 模板全部看不见。
        if (IGNORED_DIRS.has(entry.name) || entry.name === '.git') continue
        // 未知点目录视为工具缓存/本地脚手架，不进统计（见 HIDDEN_DIRS_TO_SCAN 的说明）。
        if (entry.name.startsWith('.') && !HIDDEN_DIRS_TO_SCAN.has(entry.name)) continue
        if (depth >= MAX_DEPTH) continue
        queue.push({ dir: full, depth: depth + 1 })
        continue
      }
      if (!entry.isFile()) continue
      if (IGNORED_FILE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) continue
      let info
      try {
        info = await stat(full)
      } catch {
        continue
      }
      const rel = toPosix(path.relative(root, full))
      const ext = path.extname(entry.name).toLowerCase()
      const language = SOURCE_EXTENSIONS.get(ext)
      if (language !== undefined) {
        const entryStats = languages.get(language) ?? { files: 0, bytes: 0 }
        entryStats.files += 1
        entryStats.bytes += info.size
        languages.set(language, entryStats)
      }
      bytes += info.size
      files.push({ rel, ext, size: info.size })
    }
    if (files.length >= MAX_FILES) break
  }

  return { files, languages, bytes, truncated }
}

/* ------------------------------------------------------------------ *
 * 命令识别
 * ------------------------------------------------------------------ */

function command(preset, argv, source, description) {
  return { preset, argv, source, description }
}

function nodeCommands(projectPath, pkg, manager, probes) {
  const commands = []
  const scripts = pkg?.scripts ?? {}
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const run = (name) => (manager === 'yarn' ? ['yarn', name] : manager === 'pnpm' ? ['pnpm', 'run', name] : ['npm', 'run', name])
  const has = (name) => typeof scripts[name] === 'string' && scripts[name].length > 0
  const pick = (names) => names.find((name) => has(name))

  if (manager === 'pnpm') commands.push(command('install', ['pnpm', 'install', '--frozen-lockfile'], 'pnpm-lock.yaml', '安装依赖（锁定模式）'))
  else if (manager === 'yarn') commands.push(command('install', ['yarn', 'install', '--frozen-lockfile'], 'yarn.lock', '安装依赖（锁定模式）'))
  else if (manager === 'bun') commands.push(command('install', ['bun', 'install', '--frozen-lockfile'], 'bun.lockb', '安装依赖（锁定模式）'))
  else if (manager === 'npm') commands.push(command('install', ['npm', 'ci'], 'package-lock.json', '安装依赖（npm ci）'))

  const buildScript = pick(['build', 'compile', 'bundle'])
  if (buildScript) commands.push(command('build', run(buildScript), `package.json#scripts.${buildScript}`, '项目构建'))

  const typecheckScript = pick(['typecheck', 'type-check', 'types', 'check-types'])
  if (typecheckScript) commands.push(command('typecheck', run(typecheckScript), `package.json#scripts.${typecheckScript}`, '类型检查'))
  else if (deps.typescript !== undefined && probes.has('bin:tsc')) commands.push(command('typecheck', ['node_modules/.bin/tsc', '--noEmit'], 'devDependencies.typescript', '类型检查（tsc --noEmit）'))

  const lintScript = pick(['lint', 'eslint', 'lint:js'])
  if (lintScript) commands.push(command('lint', run(lintScript), `package.json#scripts.${lintScript}`, '代码规范检查'))
  else if (probes.has('bin:eslint')) commands.push(command('lint', ['node_modules/.bin/eslint', '.'], 'node_modules/.bin/eslint', '代码规范检查'))
  else if (probes.has('bin:biome')) commands.push(command('lint', ['node_modules/.bin/biome', 'check', '.'], 'node_modules/.bin/biome', '代码规范与格式检查'))

  const formatScript = pick(['format:check', 'fmt:check', 'format-check', 'prettier:check'])
  if (formatScript) commands.push(command('format-check', run(formatScript), `package.json#scripts.${formatScript}`, '格式检查'))
  else if (probes.has('bin:prettier')) commands.push(command('format-check', ['node_modules/.bin/prettier', '--check', '.'], 'node_modules/.bin/prettier', '格式检查'))

  const testScript = pick(['test', 'test:unit', 'unit', 'jest', 'vitest'])
  if (testScript) commands.push(command('test', run(testScript), `package.json#scripts.${testScript}`, '单元测试'))
  else if (probes.has('bin:vitest')) commands.push(command('test', ['node_modules/.bin/vitest', 'run'], 'devDependencies.vitest', '单元测试（vitest run）'))
  else if (probes.has('bin:jest')) commands.push(command('test', ['node_modules/.bin/jest', '--ci'], 'devDependencies.jest', '单元测试（jest --ci）'))

  const coverageScript = pick(['coverage', 'test:coverage', 'test:cov'])
  if (coverageScript) commands.push(command('coverage', run(coverageScript), `package.json#scripts.${coverageScript}`, '覆盖率统计'))
  else if (testScript && probes.has('bin:vitest')) commands.push(command('coverage', ['node_modules/.bin/vitest', 'run', '--coverage'], 'devDependencies.vitest', '覆盖率统计（vitest --coverage）'))
  else if (testScript && probes.has('bin:jest')) commands.push(command('coverage', ['node_modules/.bin/jest', '--ci', '--coverage'], 'devDependencies.jest', '覆盖率统计（jest --coverage）'))

  const e2eScript = pick(['e2e', 'test:e2e', 'test:integration'])
  if (e2eScript) commands.push(command('e2e', run(e2eScript), `package.json#scripts.${e2eScript}`, '端到端测试'))

  const auditScript = pick(['audit', 'security:audit', 'deps:audit'])
  if (auditScript) commands.push(command('audit', run(auditScript), `package.json#scripts.${auditScript}`, '依赖漏洞审计'))
  else if (manager === 'pnpm') commands.push(command('audit', ['pnpm', 'audit', '--audit-level', 'high'], 'pnpm', '依赖漏洞审计'))
  else if (manager === 'yarn') commands.push(command('audit', ['yarn', 'npm', 'audit', '--groups', 'dependencies'], 'yarn', '依赖漏洞审计'))
  else commands.push(command('audit', ['npm', 'audit', '--audit-level=high'], 'npm', '依赖漏洞审计'))

  const outdatedScript = pick(['outdated', 'deps:outdated'])
  if (outdatedScript) commands.push(command('outdated', run(outdatedScript), `package.json#scripts.${outdatedScript}`, '过期依赖检查'))

  return commands
}

function pythonCommands(projectPath, probes) {
  const commands = []
  if (probes.has('file:uv.lock')) commands.push(command('install', ['uv', 'sync', '--frozen'], 'uv.lock', '安装依赖（uv sync）'))
  else if (probes.has('file:poetry.lock')) commands.push(command('install', ['poetry', 'install', '--no-interaction'], 'poetry.lock', '安装依赖（poetry）'))
  else if (probes.has('file:requirements.txt')) commands.push(command('install', ['python', '-m', 'pip', 'install', '-r', 'requirements.txt'], 'requirements.txt', '安装依赖（pip）'))

  if (probes.has('file:pyproject.toml')) commands.push(command('build', ['python', '-m', 'build'], 'pyproject.toml', '构建发行包'))
  if (probes.has('file:mypy.ini') || probes.has('file:.mypy.ini') || probes.has('pyproject:mypy')) commands.push(command('typecheck', ['mypy', '.'], 'mypy 配置', '类型检查'))
  if (probes.has('file:ruff.toml') || probes.has('pyproject:ruff')) {
    commands.push(command('lint', ['ruff', 'check', '.'], 'ruff 配置', 'Lint 检查'))
    commands.push(command('format-check', ['ruff', 'format', '--check', '.'], 'ruff 配置', '格式检查'))
  } else if (probes.has('file:.flake8') || probes.has('file:setup.cfg')) {
    commands.push(command('lint', ['flake8', '.'], 'flake8 配置', 'Lint 检查'))
  }
  if (probes.has('dir:tests') || probes.has('file:pytest.ini') || probes.has('pyproject:pytest')) {
    commands.push(command('test', ['python', '-m', 'pytest', '-q'], 'pytest 配置/测试目录', '单元测试'))
    commands.push(command('coverage', ['python', '-m', 'pytest', '-q', '--cov', '--cov-report=term-missing'], 'pytest-cov', '覆盖率统计'))
  }
  commands.push(command('audit', ['python', '-m', 'pip_audit'], 'pip-audit', '依赖漏洞审计'))
  return commands
}

function goCommands(probes) {
  const commands = [
    command('build', ['go', 'build', './...'], 'go.mod', '构建'),
    command('test', ['go', 'test', './...'], 'go.mod', '单元测试'),
    command('coverage', ['go', 'test', '-cover', '-coverprofile=coverage.out', './...'], 'go.mod', '覆盖率统计'),
    command('audit', ['govulncheck', './...'], 'go.mod', '依赖漏洞审计'),
  ]
  if (probes.has('file:.golangci.yml') || probes.has('file:.golangci.yaml')) commands.push(command('lint', ['golangci-lint', 'run'], '.golangci.yml', 'Lint 检查'))
  commands.push(command('format-check', ['gofmt', '-l', '.'], 'go', '格式检查'))
  return commands
}

function rustCommands() {
  return [
    command('build', ['cargo', 'build', '--all-targets'], 'Cargo.toml', '构建'),
    command('test', ['cargo', 'test', '--all'], 'Cargo.toml', '单元测试'),
    command('lint', ['cargo', 'clippy', '--all-targets', '--', '-D', 'warnings'], 'Cargo.toml', 'Clippy 检查'),
    command('format-check', ['cargo', 'fmt', '--check'], 'Cargo.toml', '格式检查'),
    command('audit', ['cargo', 'audit'], 'Cargo.toml', '依赖漏洞审计'),
  ]
}

function javaCommands(probes) {
  const commands = []
  if (probes.has('file:mvnw')) {
    commands.push(command('build', ['./mvnw', '-B', '-DskipTests', 'package'], 'mvnw', '构建（Maven Wrapper）'))
    commands.push(command('test', ['./mvnw', '-B', 'test'], 'mvnw', '单元测试'))
    commands.push(command('coverage', ['./mvnw', '-B', 'verify'], 'mvnw', '覆盖率（jacoco verify）'))
    commands.push(command('audit', ['./mvnw', '-B', 'org.owasp:dependency-check-maven:check'], 'mvnw', '依赖漏洞审计'))
  } else if (probes.has('file:pom.xml')) {
    commands.push(command('build', ['mvn', '-B', '-DskipTests', 'package'], 'pom.xml', '构建（Maven）'))
    commands.push(command('test', ['mvn', '-B', 'test'], 'pom.xml', '单元测试'))
  }
  if (probes.has('file:gradlew')) {
    commands.push(command('build', ['./gradlew', 'build', '-x', 'test'], 'gradlew', '构建（Gradle Wrapper）'))
    commands.push(command('test', ['./gradlew', 'test'], 'gradlew', '单元测试'))
    commands.push(command('coverage', ['./gradlew', 'jacocoTestReport'], 'gradlew', '覆盖率（jacoco）'))
  }
  return commands
}

function otherCommands(probes) {
  const commands = []
  if (probes.has('file:Gemfile')) {
    commands.push(command('install', ['bundle', 'install'], 'Gemfile', '安装依赖'))
    commands.push(command('test', ['bundle', 'exec', 'rspec'], 'Gemfile', '单元测试'))
    commands.push(command('lint', ['bundle', 'exec', 'rubocop'], 'Gemfile', 'Lint 检查'))
    commands.push(command('audit', ['bundle', 'exec', 'bundle-audit', 'check', '--update'], 'Gemfile', '依赖漏洞审计'))
  }
  if (probes.has('file:composer.json')) {
    commands.push(command('install', ['composer', 'install', '--no-interaction'], 'composer.json', '安装依赖'))
    commands.push(command('test', ['composer', 'test'], 'composer.json', '单元测试'))
    commands.push(command('lint', ['vendor/bin/phpstan', 'analyse'], 'composer.json', '静态分析'))
  }
  if (probes.has('file:Makefile')) {
    commands.push(command('build', ['make', 'build'], 'Makefile', '构建（make build）'))
    commands.push(command('test', ['make', 'test'], 'Makefile', '测试（make test）'))
    commands.push(command('lint', ['make', 'lint'], 'Makefile', 'Lint（make lint）'))
  }
  if (probes.has('secrets:gitleaks')) commands.push(command('secrets', ['gitleaks', 'detect', '--no-banner', '--redact'], 'gitleaks 配置', '密钥扫描'))
  else if (probes.has('secrets:trufflehog')) commands.push(command('secrets', ['trufflehog', 'filesystem', '.', '--fail'], 'trufflehog 配置', '密钥扫描'))
  return commands
}

function dedupeCommands(commands) {
  const seen = new Set()
  const out = []
  for (const entry of commands) {
    const key = `${entry.preset}:${entry.argv.join(' ')}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out
}

/* ------------------------------------------------------------------ *
 * 画像主体
 * ------------------------------------------------------------------ */

/**
 * 侦察一个项目。
 * @param {string} projectPath 项目根目录绝对路径。
 * @param {{maxFiles?: number}} [options]
 * @returns {Promise<object>} 结构化项目画像。
 */
export async function scanProject(projectPath, options = {}) {
  const scannedAt = nowIso()
  const { files, languages, bytes, truncated } = await walk(projectPath)
  const fileSet = new Set(files.map((file) => file.rel))
  const has = (rel) => fileSet.has(rel)
  const hasPrefix = (prefix) => files.some((file) => file.rel === prefix || file.rel.startsWith(`${prefix}/`))
  const hasSuffix = (suffix) => files.some((file) => file.rel.endsWith(suffix))
  const hasAny = (names) => names.some((name) => has(name))
  const hasAnySuffix = (suffixes) => suffixes.some((suffix) => hasSuffix(suffix))

  const packageJson = await readJson(path.join(projectPath, 'package.json'))
  const pyprojectText = await readText(path.join(projectPath, 'pyproject.toml'), 200_000)

  const probes = new Set()
  const markProbe = (key) => probes.add(key)
  if (has('uv.lock')) markProbe('file:uv.lock')
  if (pyprojectText !== undefined) {
    markProbe('file:pyproject.toml')
    if (/\[tool\.mypy\]/.test(pyprojectText)) markProbe('pyproject:mypy')
    if (/\[tool\.ruff\]/.test(pyprojectText)) markProbe('pyproject:ruff')
    if (/\[tool\.pytest|pytest/.test(pyprojectText)) markProbe('pyproject:pytest')
  }
  for (const name of ['poetry.lock', 'requirements.txt', 'mypy.ini', '.mypy.ini', 'ruff.toml', '.flake8', 'setup.cfg', 'pytest.ini', 'mvnw', 'pom.xml', 'gradlew', 'Gemfile', 'composer.json', 'Makefile', '.golangci.yml', '.golangci.yaml']) {
    if (has(name)) markProbe(`file:${name}`)
  }
  for (const dir of ['tests', 'test', '__tests__', 'spec']) if (hasPrefix(dir)) markProbe(`dir:${dir}`)
  for (const bin of ['tsc', 'eslint', 'biome', 'prettier', 'vitest', 'jest', 'playwright', 'cypress', 'next']) {
    if (await exists(path.join(projectPath, 'node_modules', '.bin', bin))) markProbe(`bin:${bin}`)
  }
  if (hasAny(['.gitleaks.toml', '.gitleaks.yaml', 'gitleaks.toml'])) markProbe('secrets:gitleaks')
  if (hasAny(['.trufflehog.yaml', 'trufflehog.yaml'])) markProbe('secrets:trufflehog')

  /* --- 生态系统与包管理器 --- */
  const ecosystems = []
  let manager = 'unknown'
  if (packageJson !== undefined) {
    if (has('pnpm-lock.yaml') || has('pnpm-workspace.yaml')) manager = 'pnpm'
    else if (has('yarn.lock')) manager = 'yarn'
    else if (has('bun.lockb') || has('bun.lock')) manager = 'bun'
    else if (has('package-lock.json')) manager = 'npm'
    ecosystems.push({
      kind: 'node',
      manifest: has('package.json') ? 'package.json' : 'package.json',
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private === true,
      packageManager: packageJson.packageManager ?? manager,
      engines: packageJson.engines ?? undefined,
      scripts: Object.keys(packageJson.scripts ?? {}),
      workspace: Array.isArray(packageJson.workspaces) ? packageJson.workspaces : undefined,
    })
  }
  if (pyprojectText !== undefined || hasAny(['setup.py', 'requirements.txt', 'Pipfile'])) {
    ecosystems.push({ kind: 'python', manifest: pyprojectText !== undefined ? 'pyproject.toml' : has('setup.py') ? 'setup.py' : 'requirements.txt' })
  }
  if (has('go.mod')) ecosystems.push({ kind: 'go', manifest: 'go.mod' })
  if (has('Cargo.toml')) ecosystems.push({ kind: 'rust', manifest: 'Cargo.toml' })
  if (has('pom.xml')) ecosystems.push({ kind: 'java-maven', manifest: 'pom.xml' })
  if (hasAny(['build.gradle', 'build.gradle.kts'])) ecosystems.push({ kind: 'java-gradle', manifest: has('build.gradle') ? 'build.gradle' : 'build.gradle.kts' })
  if (has('Gemfile')) ecosystems.push({ kind: 'ruby', manifest: 'Gemfile' })
  if (has('composer.json')) ecosystems.push({ kind: 'php', manifest: 'composer.json' })
  if (hasAnySuffix(['.csproj', '.sln'])) ecosystems.push({ kind: 'dotnet', manifest: '*.csproj' })
  if (has('CMakeLists.txt')) ecosystems.push({ kind: 'cmake', manifest: 'CMakeLists.txt' })

  /* --- 项目类型 --- */
  const kinds = new Set()
  const deps = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}), ...(packageJson?.peerDependencies ?? {}) }
  const hasDep = (name) => deps[name] !== undefined
  const isMonorepo = has('pnpm-workspace.yaml') || has('lerna.json') || has('nx.json') || has('turbo.json') || Array.isArray(packageJson?.workspaces)
  if (isMonorepo) kinds.add('monorepo')
  if (packageJson !== undefined && (packageJson.dsh?.bundle !== undefined || has('cordis.patch.yml') || hasPrefix('lib/catalog'))) kinds.add('plugin')
  if (packageJson !== undefined && (packageJson.bin !== undefined || hasDep('commander') || hasDep('yargs') || hasDep('cac') || hasDep('oclif'))) kinds.add('cli')
  if (hasDep('express') || hasDep('fastify') || hasDep('koa') || hasDep('@nestjs/core') || hasDep('hono') || hasDep('next') || has('manage.py') || hasAnySuffix(['application.yml', 'application.properties']) || has('go.mod') && hasPrefix('cmd')) kinds.add('service')
  if (hasDep('react') || hasDep('vue') || hasDep('svelte') || hasDep('@angular/core') || hasDep('solid-js') || has('index.html')) kinds.add('web')
  if (hasDep('electron') || hasDep('@tauri-apps/api') || hasPrefix('src-tauri')) kinds.add('desktop')
  if (hasDep('react-native') || hasDep('expo') || hasPrefix('android') || hasPrefix('ios') || has('pubspec.yaml')) kinds.add('mobile')
  if (hasPrefix('dbt_project.yml') || hasDep('@google-cloud/bigquery') || hasAnySuffix(['.sql']) || hasDep('prisma') || hasDep('typeorm') || hasDep('sequelize')) kinds.add('data')
  if (hasDep('torch') || hasDep('tensorflow') || hasDep('scikit-learn') || hasDep('transformers') || hasAnySuffix(['.ipynb'])) kinds.add('ml')
  if (packageJson !== undefined && packageJson.private !== true && (packageJson.main !== undefined || packageJson.exports !== undefined) && !kinds.has('cli')) kinds.add('library')
  if (kinds.size === 0) kinds.add('library')

  /* --- 测试与质量工具 --- */
  const testFrameworks = []
  const testFrameworkProbes = [
    ['vitest', 'Vitest', () => hasDep('vitest') || probes.has('bin:vitest')],
    ['jest', 'Jest', () => hasDep('jest') || probes.has('bin:jest')],
    ['mocha', 'Mocha', () => hasDep('mocha')],
    ['ava', 'AVA', () => hasDep('ava')],
    ['node-test', 'node:test', () => /node --test|node:test/.test(JSON.stringify(packageJson?.scripts ?? {}))],
    ['pytest', 'pytest', () => probes.has('file:pytest.ini') || probes.has('pyproject:pytest') || probes.has('dir:tests')],
    ['go-test', 'go test', () => has('go.mod')],
    ['cargo-test', 'cargo test', () => has('Cargo.toml')],
    ['junit', 'JUnit', () => has('pom.xml') || hasPrefix('src/test')],
    ['rspec', 'RSpec', () => hasPrefix('spec') || has('Gemfile')],
    ['phpunit', 'PHPUnit', () => has('phpunit.xml') || has('phpunit.xml.dist')],
  ]
  for (const [id, label, detect] of testFrameworkProbes) {
    try {
      if (detect()) testFrameworks.push({ id, label })
    } catch { /* 探测失败视为未使用 */ }
  }
  const e2eFrameworks = []
  if (hasDep('@playwright/test') || hasPrefix('playwright.config')) e2eFrameworks.push({ id: 'playwright', label: 'Playwright' })
  if (hasDep('cypress') || hasPrefix('cypress')) e2eFrameworks.push({ id: 'cypress', label: 'Cypress' })
  if (hasDep('puppeteer')) e2eFrameworks.push({ id: 'puppeteer', label: 'Puppeteer' })
  if (hasDep('selenium-webdriver')) e2eFrameworks.push({ id: 'selenium', label: 'Selenium' })

  const qualityTools = {
    lint: [],
    format: [],
    typecheck: [],
    coverage: [],
    security: [],
    hooks: [],
    release: [],
  }
  const qualityProbes = [
    ['eslint', 'lint', () => hasDep('eslint') || hasAnySuffix(['.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs'])],
    ['biome', 'lint', () => hasDep('@biomejs/biome') || has('biome.json')],
    ['ruff', 'lint', () => probes.has('file:ruff.toml') || probes.has('pyproject:ruff')],
    ['flake8', 'lint', () => probes.has('file:.flake8')],
    ['golangci-lint', 'lint', () => probes.has('file:.golangci.yml')],
    ['rubocop', 'lint', () => has('.rubocop.yml')],
    ['prettier', 'format', () => hasDep('prettier') || hasAnySuffix(['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js'])],
    ['black', 'format', () => hasAny(['pyproject.toml']) && /black/.test(pyprojectText ?? '')],
    ['editorconfig', 'format', () => has('.editorconfig')],
    ['typescript', 'typecheck', () => hasDep('typescript') || has('tsconfig.json')],
    ['mypy', 'typecheck', () => probes.has('file:mypy.ini') || probes.has('pyproject:mypy')],
    ['pyright', 'typecheck', () => has('pyrightconfig.json') || /pyright/.test(pyprojectText ?? '')],
    ['nyc', 'coverage', () => hasDep('nyc')],
    ['c8', 'coverage', () => hasDep('c8')],
    ['coverage-config', 'coverage', () => hasAny(['.coveragerc', 'codecov.yml', '.codecov.yml']) || /pytest-cov|coverage/.test(pyprojectText ?? '')],
    ['dependabot', 'security', () => has('.github/dependabot.yml') || has('.github/dependabot.yaml')],
    ['renovate', 'security', () => hasAny(['renovate.json', '.renovaterc', '.renovaterc.json'])],
    ['codeql', 'security', () => hasPrefix('.github/workflows') && fileSet.has('.github/workflows/codeql.yml')],
    ['semgrep', 'security', () => hasAny(['.semgrep.yml', '.semgrep.yaml'])],
    ['snyk', 'security', () => has('.snyk')],
    ['trivy', 'security', () => hasAny(['trivy.yaml', 'trivy.yml'])],
    ['gitleaks', 'security', () => probes.has('secrets:gitleaks')],
    ['husky', 'hooks', () => hasDep('husky') || hasPrefix('.husky')],
    ['lint-staged', 'hooks', () => hasDep('lint-staged')],
    ['commitlint', 'hooks', () => has('.commitlintrc.json') || has('commitlint.config.js') || hasDep('@commitlint/cli')],
    ['changesets', 'release', () => hasPrefix('.changeset')],
    ['semantic-release', 'release', () => hasDep('semantic-release') || has('.releaserc') || has('.releaserc.json')],
    ['goreleaser', 'release', () => hasAny(['.goreleaser.yml', '.goreleaser.yaml'])],
  ]
  for (const [id, group, detect] of qualityProbes) {
    try {
      if (detect()) qualityTools[group].push(id)
    } catch { /* 忽略 */ }
  }

  const ci = []
  if (hasPrefix('.github/workflows')) ci.push({ id: 'github-actions', path: '.github/workflows' })
  if (has('.gitlab-ci.yml')) ci.push({ id: 'gitlab-ci', path: '.gitlab-ci.yml' })
  if (has('Jenkinsfile')) ci.push({ id: 'jenkins', path: 'Jenkinsfile' })
  if (hasPrefix('.circleci')) ci.push({ id: 'circleci', path: '.circleci/config.yml' })
  if (has('azure-pipelines.yml')) ci.push({ id: 'azure-pipelines', path: 'azure-pipelines.yml' })
  if (hasPrefix('.buildkite')) ci.push({ id: 'buildkite', path: '.buildkite' })
  if (hasPrefix('.woodpecker')) ci.push({ id: 'woodpecker', path: '.woodpecker' })
  if (hasPrefix('.drone.yml') || has('.drone.yml')) ci.push({ id: 'drone', path: '.drone.yml' })

  const containers = []
  if (has('Dockerfile') || hasAnySuffix(['Dockerfile'])) containers.push('Dockerfile')
  if (has('docker-compose.yml') || has('docker-compose.yaml') || has('compose.yaml') || has('compose.yml')) containers.push('compose')
  if (hasPrefix('.devcontainer')) containers.push('devcontainer')
  if (hasPrefix('k8s') || hasPrefix('kubernetes') || hasPrefix('manifests')) containers.push('kubernetes')
  if (hasPrefix('helm') || hasPrefix('charts')) containers.push('helm')
  if (hasPrefix('.github/workflows') && !containers.includes('Dockerfile')) containers.push('ci-only')

  const iac = []
  if (hasAnySuffix(['.tf']) || hasPrefix('terraform')) iac.push('terraform')
  if (hasPrefix('pulumi')) iac.push('pulumi')
  if (hasPrefix('cdk')) iac.push('aws-cdk')
  if (hasPrefix('ansible') || has('ansible.cfg')) iac.push('ansible')
  if (hasPrefix('serverless.yml') || has('serverless.yml')) iac.push('serverless')

  const api = []
  if (hasAnySuffix(['openapi.yaml', 'openapi.yml', 'openapi.json', 'swagger.yaml', 'swagger.yml', 'swagger.json'])) api.push('openapi')
  if (hasAnySuffix(['.graphql', '.gql'])) api.push('graphql')
  if (hasAnySuffix(['.proto'])) api.push('protobuf')
  if (hasPrefix('routes') || hasPrefix('src/routes') || hasPrefix('src/api') || hasPrefix('api')) api.push('routes-dir')

  const docs = []
  for (const [name, file] of [['README', 'README.md'], ['CONTRIBUTING', 'CONTRIBUTING.md'], ['CHANGELOG', 'CHANGELOG.md'], ['SECURITY', 'SECURITY.md'], ['CODE_OF_CONDUCT', 'CODE_OF_CONDUCT.md'], ['LICENSE', 'LICENSE']]) {
    if (has(file) || has(file.toLowerCase()) || hasAnySuffix([file])) docs.push(name)
  }
  if (hasPrefix('docs')) docs.push('docs-dir')
  if (hasPrefix('adr') || hasPrefix('docs/adr')) docs.push('adr')

  /* --- 命令集合 --- */
  const commands = []
  if (packageJson !== undefined) commands.push(...nodeCommands(projectPath, packageJson, manager, probes))
  if (ecosystems.some((entry) => entry.kind === 'python')) commands.push(...pythonCommands(projectPath, probes))
  if (has('go.mod')) commands.push(...goCommands(probes))
  if (has('Cargo.toml')) commands.push(...rustCommands())
  if (has('pom.xml') || has('gradlew') || has('mvnw')) commands.push(...javaCommands(probes))
  commands.push(...otherCommands(probes))
  const finalCommands = dedupeCommands(commands)

  /* --- 内容信号（限量采样） --- */
  const signals = {
    todoCount: 0,
    debugStatementCount: 0,
    secretSuspects: [],
    largestFiles: [],
    testFileCount: 0,
    textFilesScanned: 0,
  }
  const testFilePattern = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$|_test\.go$/
  for (const file of files) if (testFilePattern.test(file.rel)) signals.testFileCount += 1

  const sortedBySize = [...files].sort((a, b) => b.size - a.size).slice(0, 10)
  signals.largestFiles = sortedBySize.map((file) => ({ path: file.rel, bytes: file.size }))

  const candidates = files
    .filter((file) => TEXTY_EXTENSIONS.has(file.ext) && file.size <= MAX_TEXT_FILE_BYTES)
    .filter((file) => !file.rel.startsWith('.qualityforge'))
    .slice(0, MAX_TEXT_FILES_READ)
    .map((file) => file.rel)

  // 调试语句只在"产品代码"里才是问题：CLI 脚本、测试、示例与压测代码里的 console.log
  // 是它们的正常输出通道，计入会让这个信号变成噪声（进而变成假缺口）。
  const isProductCode = (rel) => !/^(scripts|test|tests|spec|e2e|bench|benchmark|examples?|fixtures|tools|bin)\//.test(rel)

  const pendingEnvFiles = []
  for (const rel of candidates) {
    const text = await readText(path.join(projectPath, rel))
    if (text === undefined) continue
    signals.textFilesScanned += 1
    const productCode = isProductCode(rel)
    const lines = text.split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (TODO_RE.test(line)) signals.todoCount += 1
      if (productCode && DEBUG_RE.test(line)) signals.debugStatementCount += 1
      for (const pattern of SECRET_PATTERNS) {
        if (!pattern.re.test(line)) continue
        const isExample = /example|sample|placeholder|your[_-]?key|xxx|<[^>]+>|\$\{|\bprocess\.env\b|os\.environ/i.test(line)
        if (isExample) continue
        if (signals.secretSuspects.length >= 20) break
        signals.secretSuspects.push({ file: rel, line: index + 1, kind: pattern.id, label: pattern.label })
      }
    }
    if (/^\.env(\..+)?$/.test(path.basename(rel))) pendingEnvFiles.push(rel)
  }

  /* --- Git --- */
  const git = { isRepo: await exists(path.join(projectPath, '.git')) }
  if (git.isRepo) {
    git.branch = await runGit(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    git.commit = await runGit(projectPath, ['rev-parse', 'HEAD'])
    git.shortCommit = git.commit === undefined ? undefined : git.commit.slice(0, 8)
    git.lastCommitAt = await runGit(projectPath, ['log', '-1', '--format=%cI'])
    git.commitCount = Number(await runGit(projectPath, ['rev-list', '--count', 'HEAD'])) || undefined
    git.dirty = (await runGit(projectPath, ['status', '--porcelain'])) !== ''
    git.remote = await runGit(projectPath, ['config', '--get', 'remote.origin.url'])
    git.tags = (await runGit(projectPath, ['tag', '--sort=-creatordate']))
      ?.split('\n')
      .filter((line) => line.length > 0)
      .slice(0, 5)
  }

  const languageStats = [...languages.entries()]
    .map(([name, stats]) => ({ name, files: stats.files, bytes: stats.bytes }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10)

  const profile = {
    path: toPosix(projectPath),
    name: path.basename(projectPath),
    scannedAt,
    git,
    ecosystems,
    packageManager: manager,
    kinds: [...kinds],
    languages: languageStats,
    size: { files: files.length, bytes, truncated, sourceFiles: files.filter((file) => SOURCE_EXTENSIONS.has(file.ext)).length },
    tests: {
      frameworks: testFrameworks,
      e2eFrameworks,
      testFileCount: signals.testFileCount,
      testDirs: ['tests', 'test', '__tests__', 'spec', 'e2e'].filter((dir) => hasPrefix(dir)),
      hasTestScript: typeof packageJson?.scripts?.test === 'string',
    },
    qualityTools,
    ci,
    containers,
    iac,
    api,
    docs,
    envFiles: pendingEnvFiles,
    commands: finalCommands,
    signals: {
      todoCount: signals.todoCount,
      debugStatementCount: signals.debugStatementCount,
      secretSuspects: signals.secretSuspects,
      largestFiles: signals.largestFiles,
      textFilesScanned: signals.textFilesScanned,
    },
    truncated,
  }

  profile.gaps = detectGaps(profile, { has, hasPrefix, packageJson })
  return profile
}

/* ------------------------------------------------------------------ *
 * 工程实践缺口
 * ------------------------------------------------------------------ */

/**
 * 由画像推导"已确定的问题"。
 *
 * 只有磁盘证据能直接证伪的条目才会成为 gap——例如"没有锁文件"。凡是需要人
 * 判断的（"架构是否合理"）都留给测试项，不在这里下结论。
 */
function detectGaps(profile, context) {
  const gaps = []
  const add = (id, priority, title, detail, evidence) => gaps.push({ id, priority, title, detail, evidence: evidence ?? '' })
  const { has, hasPrefix, packageJson } = context
  const isNode = profile.ecosystems.some((entry) => entry.kind === 'node')
  const isService = profile.kinds.includes('service') || profile.kinds.includes('web')

  if (isNode && !has('package-lock.json') && !has('pnpm-lock.yaml') && !has('yarn.lock') && !has('bun.lockb') && !has('bun.lock')) {
    // 零依赖包不需要锁文件：没有第三方依赖时，"锁文件缺失"不是缺口而是设计选择。
    const declared = Object.keys({
      ...(packageJson?.dependencies ?? {}),
      ...(packageJson?.devDependencies ?? {}),
      ...(packageJson?.optionalDependencies ?? {}),
    })
    if (declared.length > 0) {
      add('RE-CON-LOCK', 'P0', '存在依赖清单但没有锁文件', `没有锁文件的 Node 项目无法保证安装结果可复现（当前声明了 ${declared.length} 个依赖），也无法保证依赖漏洞审计的结论稳定。`, 'package.json 存在，未见 lockfile')
    }
  }
  if (profile.signals.secretSuspects.length > 0) {
    const sample = profile.signals.secretSuspects.slice(0, 5).map((entry) => `${entry.file}:${entry.line}(${entry.label})`).join('、')
    add('RE-SEC-SECRETS', 'P0', '代码中疑似存在硬编码密钥', `扫描到 ${profile.signals.secretSuspects.length} 处疑似硬编码凭证。报告只记录位置，不记录取值。`, sample)
  }
  for (const envFile of profile.envFiles) {
    if (envFile === '.env.example' || envFile === '.env.sample' || envFile === '.env.template') continue
    add('RE-SEC-ENVFILE', 'P1', `仓库中存在环境文件 ${envFile}`, '环境文件常含真实凭证；如已被提交历史收录，需要轮换密钥而不只是删除文件。', envFile)
  }
  if (profile.ci.length === 0) {
    add('RE-CI-MISSING', 'P1', '没有任何 CI 配置', '缺少自动化门禁意味着构建、测试、静态检查、依赖审计全靠人工执行，回归风险随提交量线性上升。', '未发现 .github/workflows、.gitlab-ci.yml 等')
  }
  if (profile.tests.testFileCount === 0) {
    add('RE-TEST-MISSING', 'P1', '未发现任何测试文件', '测试文件数为 0；无法回答"改动是否破坏既有行为"这一最基本问题。', `扫描 ${profile.size.files} 个文件，未匹配测试文件命名`)
  } else if (profile.ci.length > 0) {
    const ciText = profile.ci.map((entry) => entry.path).join('、')
    add('RE-TEST-CI-VERIFY', 'P2', '需要确认 CI 真正执行了测试', `CI 配置存在（${ciText}），但测试是否被门禁执行需要人工核对工作流内容。`, ciText)
  }
  if (!has('LICENSE') && !has('LICENSE.md') && !has('LICENSE.txt') && !hasPrefix('LICENSE')) {
    add('RE-OSS-LICENSE', 'P1', '缺少 LICENSE 文件', '没有许可证的项目在法律上属于"保留所有权利"，他人无法合法使用或贡献。', '根目录未见 LICENSE')
  }
  if (!has('README.md') && !has('README.rst') && !has('README') && !hasPrefix('README')) {
    add('RE-DOC-README', 'P1', '缺少 README', '使用者无法知道项目是什么、如何安装、如何使用。', '根目录未见 README')
  }
  if (!has('CHANGELOG.md') && !hasPrefix('CHANGELOG') && !hasPrefix('.changeset')) {
    add('RE-DOC-CHANGELOG', 'P2', '缺少变更记录', '没有 CHANGELOG 或 changeset，升级方无法判断版本间差异与破坏性变更。', '未见 CHANGELOG / .changeset')
  }
  if (!has('SECURITY.md') && !hasPrefix('.github/SECURITY.md')) {
    add('RE-OSS-SECURITY', 'P2', '缺少安全政策（SECURITY.md）', '外部研究者没有披露渠道，漏洞可能以公开 issue 形式暴露。', '未见 SECURITY.md')
  }
  if (!has('CONTRIBUTING.md') && !hasPrefix('.github/CONTRIBUTING.md')) {
    add('RE-OSS-CONTRIBUTING', 'P3', '缺少贡献指南', '贡献者需要自行猜测开发流程、分支约定与本地验证方式。', '未见 CONTRIBUTING.md')
  }
  if (!has('.gitignore')) {
    add('RE-CI-GITIGNORE', 'P2', '缺少 .gitignore', '依赖目录、构建产物与本地凭证容易误提交。', '未见 .gitignore')
  }
  // 脚本本身也是证据：一个 `npm run coverage` 能一键跑出覆盖率，就已经具备该能力，
  // 不能因为"没装 nyc/c8"就报缺口——否则报告会拿工具品牌当质量判据。
  const scripts = Object.keys(packageJson?.scripts ?? {})
  const hasScript = (name) => scripts.includes(name)

  if (profile.qualityTools.lint.length === 0 && !hasScript('lint')) {
    add('RE-QUALITY-LINT', 'P2', '未配置任何 Lint 工具', '代码风格与常见缺陷只能靠人工审查。', '未发现 eslint/biome/ruff/flake8 等配置，也没有 lint 脚本')
  }
  if (profile.qualityTools.typecheck.length === 0 && !hasScript('typecheck') && !hasScript('type-check') && (isNode || profile.ecosystems.some((entry) => entry.kind === 'python'))) {
    add('RE-QUALITY-TYPES', 'P2', '未配置类型检查', '缺少类型检查意味着大量接口误用在运行期才会暴露。', '未发现 tsconfig/mypy/pyright')
  }
  if (profile.qualityTools.coverage.length === 0 && !hasScript('coverage') && !hasScript('test:coverage') && profile.tests.testFileCount > 0) {
    add('RE-QUALITY-COVERAGE', 'P2', '未配置覆盖率统计', '没有覆盖率门槛时，测试充分性无法量化，也无法阻止覆盖率倒退。', '未发现 nyc/c8/coverage 配置，也没有 coverage 脚本')
  }
  if (profile.qualityTools.security.length === 0) {
    add('RE-SEC-DEPSCAN', 'P1', '未配置依赖漏洞或供应链扫描', '依赖漏洞只能在事后由使用者发现。', '未发现 dependabot/renovate/codeql/snyk/trivy 等配置')
  }
  if (isNode && packageJson?.engines === undefined && !has('.nvmrc') && !has('.node-version')) {
    add('RE-CON-ENGINES', 'P2', '未声明运行时版本要求', 'Node 版本差异会导致构建或运行结果不一致（engines / .nvmrc 均缺失）。', 'package.json 无 engines 字段')
  }
  if (profile.signals.debugStatementCount > 20) {
    add('RE-QUALITY-DEBUG', 'P2', '存在大量调试语句', `采样到 ${profile.signals.debugStatementCount} 处 console.log/debugger/print 类输出，可能污染生产日志。`, '内容采样统计')
  }
  if (profile.signals.todoCount > 30) {
    add('RE-QUALITY-TODO', 'P3', '未处理的 TODO/FIXME 较多', `采样到 ${profile.signals.todoCount} 处标记，建议转入缺陷或技术债清单跟踪。`, '内容采样统计')
  }
  if (isService && profile.containers.length === 0) {
    add('RE-OPS-CONTAINER', 'P2', '服务型项目没有任何容器化或部署描述', '没有 Dockerfile/compose/k8s，环境一致性只能靠文档口头约定。', '未发现容器相关文件')
  }
  if (isService && profile.docs.includes('docs-dir') === false && profile.qualityTools.lint.length === 0 && profile.ci.length === 0) {
    add('RE-OPS-RUNBOOK', 'P3', '缺少运维与排障文档', '缺少 docs 目录，部署、排障、回滚知识只存在于个人经验中。', '未见 docs 目录')
  }
  for (const file of profile.signals.largestFiles) {
    if (file.bytes > 5_000_000) {
      add('RE-QUALITY-BIGFILE', 'P2', `存在超大文件（${(file.bytes / 1_048_576).toFixed(1)}MB）`, '大文件会显著拖慢克隆、构建与代码审查，通常也不应进入版本库。', file.path)
      break
    }
  }
  return gaps
}
