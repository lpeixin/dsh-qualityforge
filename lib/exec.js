/**
 * 确定性检查执行器。
 *
 * 只运行 qf_scan 识别出来的"预设命令"（preset），不接受任意 shell 字符串：
 *   1. 结果可复现——命令本身就是证据的一部分，报告里能原样引用；
 *   2. 插件运行在宿主进程内、不受工作区沙箱约束，收窄输入面是必要的自我约束；
 *   3. Agent 需要跑任意命令时本来就有 bash 工具，插件不必重复这个能力。
 *
 * 所有运行都会限制超时、截断输出、保留退出码与耗时，并把"工具没装"与
 * "检查失败"区分开：前者是 skipped，后者才是 fail。用"环境缺工具"污染缺陷
 * 清单会直接损害报告的可信度。
 */

import { spawn } from 'node:child_process'

export const RUN_STATUS = {
  pass: 'pass',
  fail: 'fail',
  skipped: 'skipped',
  timeout: 'timeout',
  aborted: 'aborted',
  error: 'error',
}

/** qf_exec 的默认预设集合；install 默认不跑，因为它会改动工程目录。 */
export const DEFAULT_PRESETS = ['build', 'typecheck', 'lint', 'format-check', 'test', 'coverage', 'e2e', 'audit', 'secrets']

export const PRESET_DESCRIPTION = {
  install: '安装依赖（会改动工程目录，默认不执行）',
  build: '构建',
  typecheck: '类型检查',
  lint: '规范检查',
  'format-check': '格式检查',
  test: '测试执行',
  coverage: '覆盖率统计',
  e2e: '端到端测试',
  audit: '依赖漏洞审计',
  secrets: '密钥扫描',
  outdated: '过期依赖检查',
}

export const PRESETS = Object.keys(PRESET_DESCRIPTION)

const DEFAULT_TIMEOUT_MS = 600_000
const MAX_TIMEOUT_MS = 1_800_000
const DEFAULT_MAX_OUTPUT_BYTES = 8_000

function tail(text, maxChars) {
  const value = typeof text === 'string' ? text : String(text ?? '')
  if (value.length <= maxChars) return { text: value, truncated: false, totalLength: value.length }
  return { text: value.slice(value.length - maxChars), truncated: true, totalLength: value.length }
}

/**
 * 启动一条命令并等待结果。
 * @param {{argv: string[], cwd: string, timeoutMs?: number, signal?: AbortSignal, env?: Record<string,string>}} options
 * @returns {Promise<object>} 结构化运行记录。
 */
export function runCommand({ argv, cwd, timeoutMs = DEFAULT_TIMEOUT_MS, signal, env }) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const [command, ...args] = argv
    let child
    try {
      child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...(env ?? {}), CI: process.env.CI ?? '1', NO_COLOR: '1', FORCE_COLOR: '0' },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
      })
    } catch (error) {
      resolve({
        status: RUN_STATUS.error,
        exitCode: null,
        durationMs: 0,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        reason: 'spawn 失败',
      })
      return
    }

    let stdout = ''
    let stderr = ''
    let settled = false
    let aborted = false
    const limit = 4_000_000

    const onAbort = () => {
      aborted = true
      try { child.kill('SIGKILL') } catch { /* 已退出 */ }
    }
    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }

    child.stdout?.on('data', (chunk) => { if (stdout.length < limit) stdout += chunk })
    child.stderr?.on('data', (chunk) => { if (stderr.length < limit) stderr += chunk })

    child.on('error', (error) => {
      if (settled) return
      settled = true
      signal?.removeEventListener?.('abort', onAbort)
      const code = error && typeof error === 'object' ? error.code : undefined
      resolve({
        status: code === 'ENOENT' ? RUN_STATUS.skipped : RUN_STATUS.error,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: stderr || (error instanceof Error ? error.message : String(error)),
        reason: code === 'ENOENT' ? `未安装可执行文件 ${command}` : (error instanceof Error ? error.message : String(error)),
      })
    })

    child.on('close', (code, closeSignal) => {
      if (settled) return
      settled = true
      signal?.removeEventListener?.('abort', onAbort)
      const durationMs = Date.now() - startedAt
      if (aborted) {
        resolve({ status: RUN_STATUS.aborted, exitCode: code, durationMs, stdout, stderr, reason: '调用方取消了执行' })
        return
      }
      const timedOut = durationMs >= timeoutMs - 50 || closeSignal === 'SIGKILL'
      const looksMissing = code === 127 || /command not found|不是内部或外部命令|No such file or directory/i.test(stderr)
      let status
      if (timedOut) status = RUN_STATUS.timeout
      else if (code === 0) status = RUN_STATUS.pass
      else if (looksMissing && stdout.trim().length === 0) status = RUN_STATUS.skipped
      else status = RUN_STATUS.fail
      resolve({
        status,
        exitCode: code,
        durationMs,
        stdout,
        stderr,
        reason: status === RUN_STATUS.timeout ? `超过超时上限 ${timeoutMs}ms 被终止`
          : status === RUN_STATUS.skipped ? '命令或工具不可用（不等于检查失败）'
            : undefined,
      })
    })
  })
}

/**
 * 按预设执行命令。同一预设可能有多个候选命令（例如 Maven 与 Gradle、npm 与 pnpm），
 * 依次尝试直到某个命令真正启动为止。
 */
export async function runPresets({
  projectPath,
  commands,
  presets,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
}) {
  const wanted = Array.isArray(presets) && presets.length > 0 ? presets : DEFAULT_PRESETS
  const boundedTimeout = Math.min(MAX_TIMEOUT_MS, Math.max(1_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS))
  const byPreset = new Map()
  for (const candidate of commands ?? []) {
    if (!byPreset.has(candidate.preset)) byPreset.set(candidate.preset, [])
    byPreset.get(candidate.preset).push(candidate)
  }

  const runs = []
  const skipped = []

  for (const preset of wanted) {
    if (signal?.aborted) break
    const candidates = byPreset.get(preset)
    if (!candidates || candidates.length === 0) {
      skipped.push({ preset, reason: '项目中没有识别到该预设对应的命令' })
      continue
    }
    let recorded = false
    for (const candidate of candidates) {
      const result = await runCommand({ argv: candidate.argv, cwd: projectPath, timeoutMs: boundedTimeout, signal })
      if (result.status === RUN_STATUS.skipped) continue
      const out = tail(result.stdout, maxOutputBytes)
      const err = tail(result.stderr, maxOutputBytes)
      runs.push({
        preset,
        description: candidate.description ?? PRESET_DESCRIPTION[preset] ?? preset,
        argv: candidate.argv,
        commandLine: candidate.argv.join(' '),
        source: candidate.source,
        status: result.status,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        stdoutTail: out.text,
        stdoutTruncated: out.truncated,
        stdoutLength: out.totalLength,
        stderrTail: err.text,
        stderrTruncated: err.truncated,
        stderrLength: err.totalLength,
        reason: result.reason,
        at: new Date().toISOString(),
      })
      recorded = true
      break
    }
    if (!recorded) {
      skipped.push({ preset, reason: `候选命令均不可用：${candidates.map((candidate) => candidate.argv.join(' ')).join(' / ')}` })
    }
  }

  return { runs, skipped }
}

/**
 * 预设 → 测试项的自动判定映射。
 *
 * 每条映射用「方法 id + 标题关键字」定位测试项，而不是模糊匹配标题：
 * 自动回填必须精确，否则会出现"跑了构建却把打包项标成通过"这类假结论。
 *
 * 判定纪律：
 *   - 只有"跑失败就说明项目本身有问题"的项才映射（工具缺失是 skipped，不在此列）；
 *   - 一个预设可以映射多项（例如依赖审计失败同时意味着"扫描未阻断"与"存在高危依赖"）；
 *   - 匹配不到时如实返回空，交由 Agent 用 qf_record 手工判定，绝不猜。
 */
export const PRESET_TO_ITEMS = {
  install: {
    description: '干净环境依赖安装',
    targets: [{ method: 'BUILD-CLEAN', titleIncludes: '空缓存空目录下按文档步骤安装依赖成功' }],
  },
  build: {
    description: '构建',
    targets: [{ method: 'BUILD-TOOLCHAIN', titleIncludes: '构建脚本在文档中声明的入口可一条命令跑通' }],
  },
  typecheck: {
    description: '类型检查',
    targets: [{ method: 'STATIC-TYPES', titleIncludes: '全量类型检查' }],
  },
  lint: {
    description: '规范检查',
    targets: [{ method: 'LINT-CONFIG', titleIncludes: 'Lint 在 CI 上' }],
  },
  'format-check': {
    description: '格式检查',
    targets: [{ method: 'FMT-CONSIST', titleIncludes: '格式检查' }],
  },
  test: {
    description: '测试执行',
    targets: [{ method: 'UNIT-RUN', titleIncludes: '全部单元测试' }],
  },
  coverage: {
    description: '覆盖率统计',
    targets: [
      { method: 'UNIT-COV', titleIncludes: '覆盖率命令可一键运行' },
      { method: 'UNIT-COV', titleIncludes: '行与分支覆盖率阈值', onFailOnly: true },
    ],
  },
  audit: {
    description: '依赖漏洞审计',
    targets: [
      { method: 'SEC-SUPPLY-VULN', titleIncludes: '流水线对依赖做漏洞扫描' },
      { method: 'DEPS-HEALTH', titleIncludes: '无已知高危及以上漏洞的依赖' },
    ],
  },
  secrets: {
    description: '密钥扫描',
    targets: [{ method: 'SEC-SUPPLY-SECRETS', titleIncludes: '当前提交中不存在凭据与私钥' }],
  },
  e2e: {
    description: '端到端测试',
    targets: [{ method: 'E2E-JOURNEY', titleIncludes: '核心闭环从入口到结果可完整走通' }],
  },
  outdated: {
    description: '过期依赖检查',
    targets: [{ method: 'DEPS-HEALTH', titleIncludes: '无已停止维护的关键依赖' }],
  },
}

/**
 * 找出某个预设结果应当回填的测试项。
 * @param {object[]} items 测试项集合。
 * @param {string} preset 预设名。
 * @param {'pass'|'fail'} outcome 结果方向（用于 onFailOnly 目标）。
 * @returns {object[]} 命中的测试项（可能为空）。
 */
export function matchPresetTargets(items, preset, outcome = 'fail') {
  const mapping = PRESET_TO_ITEMS[preset]
  if (mapping === undefined) return []
  const matched = []
  for (const target of mapping.targets ?? []) {
    if (target.onFailOnly === true && outcome !== 'fail') continue
    for (const item of items ?? []) {
      if (item.method !== target.method) continue
      if (typeof target.titleIncludes === 'string' && !String(item.title).includes(target.titleIncludes)) continue
      matched.push(item)
      break
    }
  }
  return matched
}

/* ------------------------------------------------------------------ *
 * 环形回环 HTTP 探针
 * ------------------------------------------------------------------ */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

export function isLoopbackUrl(raw) {
  try {
    const url = new URL(String(raw))
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return LOOPBACK_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

/**
 * 对本地已启动的服务做一次只读探针。
 *
 * 为什么只允许回环地址：探针会被 Agent 用来验证"服务是否真的起来了"。允许任意外部
 * 地址会把插件变成可被诱导的请求发起器（SSRF 的现成跳板），因此协议限定 http(s)、
 * 主机限定回环、方法限定 GET/HEAD、响应体截断。
 */
export async function probeUrl({ url, method = 'GET', timeoutMs = 10_000, maxBytes = 64_000, expectStatus, expectBodyContains, signal }) {
  if (!isLoopbackUrl(url)) {
    return { url: String(url), method, ok: false, status: null, latencyMs: 0, error: '只允许探测回环地址（localhost / 127.0.0.1 / ::1）的 http(s) 服务' }
  }
  const verb = String(method).toUpperCase() === 'HEAD' ? 'HEAD' : 'GET'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.min(30_000, Math.max(500, Number(timeoutMs) || 10_000)))
  const onAbort = () => controller.abort()
  signal?.addEventListener?.('abort', onAbort, { once: true })
  const startedAt = Date.now()
  try {
    const response = await fetch(url, { method: verb, signal: controller.signal, redirect: 'manual' })
    const latencyMs = Date.now() - startedAt
    let bodySnippet = ''
    let truncated = false
    if (verb === 'GET') {
      const text = await response.text()
      truncated = text.length > maxBytes
      bodySnippet = truncated ? text.slice(0, maxBytes) : text
    }
    const headers = {}
    for (const key of ['content-type', 'content-length', 'cache-control', 'server', 'location']) {
      const value = response.headers.get(key)
      if (value !== null) headers[key] = value
    }
    const expectations = []
    let ok = response.status < 400
    if (expectStatus !== undefined) {
      const wanted = Array.isArray(expectStatus) ? expectStatus.map(Number) : [Number(expectStatus)]
      const matched = wanted.includes(response.status)
      expectations.push({ kind: 'status', wanted, actual: response.status, ok: matched })
      ok = matched
    }
    if (typeof expectBodyContains === 'string' && expectBodyContains.length > 0) {
      const matched = bodySnippet.includes(expectBodyContains)
      expectations.push({ kind: 'body-contains', wanted: expectBodyContains, ok: matched })
      ok = ok && matched
    }
    return {
      url: String(url),
      method: verb,
      ok,
      status: response.status,
      statusText: response.statusText,
      latencyMs,
      contentType: response.headers.get('content-type') ?? undefined,
      headers,
      bodySnippet: verb === 'GET' ? bodySnippet : '',
      bodyTruncated: truncated,
      expectations,
      at: new Date().toISOString(),
    }
  } catch (error) {
    return {
      url: String(url),
      method: verb,
      ok: false,
      status: null,
      latencyMs: Date.now() - startedAt,
      error: controller.signal.aborted ? `探针超时（>${timeoutMs}ms）` : (error instanceof Error ? error.message : String(error)),
      at: new Date().toISOString(),
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener?.('abort', onAbort)
  }
}
