/**
 * 项目侦察（scan）的行为测试。
 *
 * 侦察结论会直接变成报告里的"工程缺口"与画像数字，所以这里把几条容易出错的规则钉死：
 *   1. `.github` 必须被读取（否则 CI 会被误判为缺失）；未知点目录必须被跳过（否则本地
 *      脚手架/缓存目录会污染规模统计与"调试语句"信号）；
 *   2. 零依赖项目不应被报"缺少锁文件"；
 *   3. 密钥扫描必须只记录位置与类型，绝不能把密钥取值写进画像；
 *   4. 语言、项目类型与预设命令的推断要基于真实清单。
 */

import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { scanProject } from '../lib/scan.js'

async function fixture(structure) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qualityforge-scan-'))
  for (const [rel, content] of Object.entries(structure)) {
    const target = path.join(root, rel)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  return root
}

test('侦察：读取 .github，跳过未知点目录与依赖目录', async (t) => {
  const root = await fixture({
    'package.json': JSON.stringify({ name: 'demo', version: '1.0.0', scripts: { test: 'node --test' } }),
    'src/app.js': 'export const run = () => 1\n',
    '.github/workflows/ci.yml': 'name: CI\non: [push]\n',
    '.tmp-scratch/generated.js': 'console.log("scratch noise")\n',
    '.history/old.js': 'console.log("history noise")\n',
    '.hidden-cache/blob.js': 'console.log("cache noise")\n',
    'node_modules/dep/index.js': 'console.log("dependency noise")\n',
    '.git/HEAD': 'ref: refs/heads/main\n',
  })
  t.after(async () => { await rm(root, { recursive: true, force: true }) })

  const profile = await scanProject(root)
  assert.deepEqual(profile.ci.map((entry) => entry.id), ['github-actions'], '.github/workflows 必须被识别为 CI')
  assert.equal(profile.size.files, 3, `只应统计 package.json + src/app.js + ci.yml，实际 ${profile.size.files}`)
  assert.deepEqual(profile.languages.map((entry) => entry.name), ['JavaScript'])
  assert.equal(profile.languages[0].files, 1, '未知点目录与 node_modules 里的 js 不应计入语言分布')
  assert.equal(profile.signals.debugStatementCount, 0, '脚手架/依赖目录里的 console.log 不应计入调试语句')
  assert.deepEqual(profile.kinds, ['library'])
})

test('侦察：零依赖包不被报"缺少锁文件"', async (t) => {
  const root = await fixture({
    'package.json': JSON.stringify({ name: 'zero-dep', version: '1.0.0' }),
    'index.js': 'export const x = 1\n',
  })
  t.after(async () => { await rm(root, { recursive: true, force: true }) })
  const profile = await scanProject(root)
  assert.ok(!profile.gaps.some((gap) => gap.id === 'RE-CON-LOCK'), '零依赖项目不应被报缺少锁文件')
})

test('侦察：有依赖但无锁文件时给出 P0 缺口', async (t) => {
  const root = await fixture({
    'package.json': JSON.stringify({ name: 'deps-app', version: '1.0.0', dependencies: { express: '^4.18.2' } }),
    'src/app.js': 'export const x = 1\n',
  })
  t.after(async () => { await rm(root, { recursive: true, force: true }) })
  const profile = await scanProject(root)
  const gap = profile.gaps.find((entry) => entry.id === 'RE-CON-LOCK')
  assert.ok(gap, '声明了依赖却没有锁文件应成为缺口')
  assert.equal(gap.priority, 'P0')
})

test('侦察：密钥只记位置与类型，不落取值', async (t) => {
  // 下面两个字符串是**故意构造的假凭据**，用于验证扫描器能命中而不泄漏取值：
  // AKIA...EXAMPLE 是 AWS 官方文档中的示例 Access Key ID（无配套 Secret，不是有效凭据），
  // hunter2secret 是明显的占位口令。它们不代表任何真实密钥。
  const secret = 'AKIAIOSFODNN7EXAMPLE'
  const root = await fixture({
    'package.json': JSON.stringify({ name: 'leaky', version: '1.0.0' }),
    'src/config.js': `export const awsKey = '${secret}'\nexport const password = "hunter2secret"\n`,
    '.env': 'API_TOKEN=abcd1234efgh5678\n',
  })
  t.after(async () => { await rm(root, { recursive: true, force: true }) })

  const profile = await scanProject(root)
  assert.ok(profile.signals.secretSuspects.length > 0, '应识别出疑似密钥')
  const serialized = JSON.stringify(profile)
  assert.ok(!serialized.includes(secret), '画像中绝不能出现密钥取值')
  assert.ok(!serialized.includes('hunter2secret'), '画像中绝不能出现硬编码口令取值')
  assert.ok(profile.signals.secretSuspects.every((entry) => typeof entry.kind === 'string' && entry.line > 0))
  assert.ok(profile.gaps.some((gap) => gap.id === 'RE-SEC-SECRETS' && gap.priority === 'P0'))
})

test('侦察：缺口判定以"是否具备能力"为准，而不是以工具品牌为准', async (t) => {
  const root = await fixture({
    'package.json': JSON.stringify({
      name: 'script-only',
      version: '1.0.0',
      scripts: {
        test: 'node --test',
        coverage: 'node --test --experimental-test-coverage',
        lint: 'node --check src/app.js',
        typecheck: 'tsc --noEmit',
      },
    }),
    'src/app.js': 'export const x = 1\n',
    'test/app.test.js': "import test from 'node:test'\ntest('x', () => {})\n",
    'LICENSE': 'MIT\n',
    'README.md': '# script-only\n',
  })
  t.after(async () => { await rm(root, { recursive: true, force: true }) })

  const profile = await scanProject(root)
  const ids = profile.gaps.map((gap) => gap.id)
  assert.ok(!ids.includes('RE-QUALITY-COVERAGE'), `声明了 coverage 脚本就不该报覆盖率缺口：${ids.join(',')}`)
  assert.ok(!ids.includes('RE-QUALITY-LINT'), `声明了 lint 脚本就不该报 Lint 缺口：${ids.join(',')}`)
  assert.ok(!ids.includes('RE-QUALITY-TYPES'), `声明了 typecheck 脚本就不该报类型检查缺口：${ids.join(',')}`)
})

test('侦察：识别项目类型、测试框架与预设命令', async (t) => {
  const root = await fixture({
    'package.json': JSON.stringify({
      name: 'svc',
      version: '2.0.0',
      scripts: { build: 'tsc', test: 'vitest run', lint: 'eslint .', start: 'node dist/index.js' },
      dependencies: { fastify: '^4.0.0', react: '^18.0.0' },
      devDependencies: { vitest: '^2.0.0', typescript: '^5.0.0' },
      engines: { node: '>=20' },
    }),
    'package-lock.json': '{"lockfileVersion":3}',
    'tsconfig.json': '{}',
    'src/server.ts': 'export const server = 1\n',
    '.github/workflows/ci.yml': 'name: CI\n',
  })
  t.after(async () => { await rm(root, { recursive: true, force: true }) })

  const profile = await scanProject(root)
  assert.ok(profile.kinds.includes('service'), `应识别为 service：${profile.kinds.join(',')}`)
  assert.ok(profile.kinds.includes('web'), `应识别为 web：${profile.kinds.join(',')}`)
  assert.equal(profile.packageManager, 'npm')
  assert.ok(profile.tests.frameworks.some((entry) => entry.id === 'vitest'))
  const presets = new Set(profile.commands.map((entry) => entry.preset))
  assert.ok(presets.has('build') && presets.has('test') && presets.has('lint') && presets.has('install'))
  const build = profile.commands.find((entry) => entry.preset === 'build')
  assert.equal(build.source, 'package.json#scripts.build', '每条命令都要带来源，便于报告引用')
  assert.equal(profile.git.isRepo, false, '非 git 目录不应伪造 git 信息')
})
