/**
 * 工具注册（模型可见面）。
 *
 * 这里刻意不使用 @deepseek-ai/dsh-tools 的 defineTool，而是直接构造宿主
 * ToolDefinition：插件因此**不 import 任何外部包**，安装时不引入依赖解析风险，
 * 也不会因为宿主包版本或软链方式变化而加载失败。参数校验由本文件自行完成。
 *
 * 三条必须遵守的宿主约束：
 *   1. output.schema 会被宿主用于校验工具返回值，校验失败即 INVALID_TOOL_OUTPUT，
 *      因此自由形态对象一律不写 additionalProperties:false；
 *   2. parameters 是传给模型的原始 JSON Schema，不做强制校验，所以每个 execute
 *      内部都必须自行校验入参；
 *   3. 返回值在离开 execute 前必须是无损 JSON（无 undefined / NaN / 函数 / 循环引用），
 *      统一由 define() 在出口清洗。
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { CATEGORIES, DEPTHS, KINDS, catalogStats, expandCases, findCategory } from './catalog/index.js'
import { DEFAULT_PRESETS, PRESETS, PRESET_DESCRIPTION, RUN_STATUS, matchPresetTargets, probeUrl, runPresets } from './exec.js'
import { SCOPE_DESCRIPTION, SCOPES, buildHandoff, buildWaves, nextAction, progressBar, resolveScope } from './fixplan.js'
import { computeSummary, parseCheckboxSync, renderJsonReport, renderReport } from './report.js'
import { scanProject } from './scan.js'
import {
  auditFile, findItem, loadOrInitAudit, nextItemId, pathExists, pushHistory, removeAudit,
  reportFile, reportJsonFile, saveAudit, writeTextAtomic,
} from './store.js'
import {
  AUTOMATIONS, PRIORITIES, PRIORITY_META, SEVERITIES, STATUSES, STATUS_META,
  clip, countBy, isDefect, isOpen, jsonSafe, nowIso, severityOf, sortItems,
} from './util.js'

/* ------------------------------------------------------------------ *
 * JSON Schema 构造器（宿主支持的子集）
 * ------------------------------------------------------------------ */

const str = (description) => ({ type: 'string', description })
const bool = (description) => ({ type: 'boolean', description })
const int = (description) => ({ type: 'integer', description })
const strArray = (description) => ({ type: 'array', description, items: { type: 'string' } })
/** 自由形态对象：不声明 properties，也不关闭 additionalProperties。 */
const loose = (description) => ({ type: 'object', description })
const objectRoot = (properties, required = []) => ({
  type: 'object',
  properties,
  ...(required.length > 0 ? { required } : {}),
  additionalProperties: false,
})

function textRender(_args, value) {
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
}

/** 包装工具：所有返回值在离开 execute 前清洗为无损 JSON。 */
function define(definition) {
  const inner = definition.execute
  return {
    ...definition,
    async execute(args, exec) {
      return jsonSafe(await inner(args, exec))
    },
  }
}

/* ------------------------------------------------------------------ *
 * 入参校验
 * ------------------------------------------------------------------ */

function fail(message) {
  throw new Error(message)
}

function asString(value, name, { required = false, fallback } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail(`参数 ${name} 必填`)
    return fallback
  }
  if (typeof value !== 'string') fail(`参数 ${name} 必须是字符串`)
  return value
}

function asStringArray(value, name, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) fail(`参数 ${name} 必填`)
    return []
  }
  if (!Array.isArray(value)) fail(`参数 ${name} 必须是字符串数组`)
  for (const entry of value) if (typeof entry !== 'string') fail(`参数 ${name} 的每一项必须是字符串`)
  return value
}

function asBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

function asInt(value, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`参数 ${name} 必须是数字`)
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

function asEnum(value, name, allowed, fallback) {
  if (value === undefined || value === null || value === '') {
    if (fallback === undefined) fail(`参数 ${name} 必填，可选值：${allowed.join(', ')}`)
    return fallback
  }
  if (!allowed.includes(value)) fail(`参数 ${name} 取值非法（${value}），可选值：${allowed.join(', ')}`)
  return value
}

function asEnumArray(value, name, allowed) {
  const list = asStringArray(value, name)
  for (const entry of list) if (!allowed.includes(entry)) fail(`参数 ${name} 含非法取值 ${entry}，可选值：${allowed.join(', ')}`)
  return list
}

/** 解析项目路径：显式参数优先，其次会话工作目录，最后进程工作目录。 */
function resolveProject(args, exec) {
  const raw = asString(args?.projectPath, 'projectPath', { fallback: undefined })
  const sessionCwd = exec?.agent?.session?.header?.cwd
  const fallbackCwd = typeof sessionCwd === 'string' && sessionCwd.length > 0 ? sessionCwd : process.cwd()
  const resolved = raw === undefined ? fallbackCwd : path.isAbsolute(raw) ? raw : path.resolve(fallbackCwd, raw)
  return path.resolve(resolved)
}

/* ------------------------------------------------------------------ *
 * 数据装配
 * ------------------------------------------------------------------ */

function itemKey(item) {
  return `${item.category}::${item.method}::${item.title}`
}

function compactItem(item, detail = 'compact') {
  const out = {
    id: item.id,
    priority: item.priority,
    severity: item.severity,
    status: item.status,
    category: item.category,
    method: item.method,
    title: item.title,
  }
  if (detail === 'compact') return out
  out.categoryName = item.categoryName
  out.methodName = item.methodName
  out.automation = item.automation
  out.expect = clip(item.expect, 300)
  if (item.actual) out.actual = clip(item.actual, 400)
  if (item.recommendation) out.recommendation = clip(item.recommendation, 300)
  if (item.effort) out.effort = item.effort
  if ((item.files ?? []).length > 0) out.files = item.files
  if (detail === 'full') {
    out.repro = item.repro
    out.evidence = (item.evidence ?? []).slice(0, 20)
    out.tags = item.tags
    out.standards = item.standards
    out.history = (item.history ?? []).slice(-10)
  }
  return out
}

async function ensureProfile(projectPath, audit, force = false) {
  if (!force && audit.profile) return audit.profile
  audit.profile = await scanProject(projectPath)
  return audit.profile
}

/** 把侦察缺口转成测试项，让"已经确定的问题"直接进入报告，而不是只躺在画像里。 */
function gapDefinitions(profile) {
  return (profile?.gaps ?? []).map((gap) => ({
    category: 'recon',
    categoryName: '侦察发现（工程缺口）',
    method: gap.id,
    methodName: '静态侦察可确定的问题',
    automation: 'assisted',
    priority: gap.priority,
    tier: 'core',
    title: gap.title,
    expect: gap.detail,
    when: [],
    tags: ['recon'],
    standards: [],
    refs: gap.evidence ? [gap.evidence] : [],
    evidence: gap.evidence,
  }))
}

function mergeDefinitions(audit, definitions, { reset = false } = {}) {
  if (reset) audit.items = []
  const existing = new Map(audit.items.map((item) => [itemKey(item), item]))
  let created = 0
  for (const definition of definitions) {
    const key = itemKey(definition)
    if (existing.has(key)) continue
    const item = {
      id: nextItemId(audit),
      category: definition.category,
      categoryName: definition.categoryName,
      method: definition.method,
      methodName: definition.methodName,
      priority: definition.priority,
      severity: severityOf(definition.priority),
      tier: definition.tier ?? 'core',
      automation: definition.automation ?? 'assisted',
      title: definition.title,
      expect: definition.expect ?? '',
      status: 'pending',
      actual: '',
      recommendation: '',
      effort: '',
      owner: '',
      evidence: definition.evidence ? [{ kind: 'recon', ref: definition.refs?.[0] ?? '', detail: definition.evidence }] : [],
      repro: [],
      files: [],
      tags: definition.tags ?? [],
      standards: definition.standards ?? [],
      cwe: [],
      owasp: [],
      refs: definition.refs ?? [],
      history: [{ at: nowIso(), from: null, to: 'pending', note: '由 qf_plan 生成' }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    audit.items.push(item)
    existing.set(key, item)
    created += 1
  }
  return created
}

async function persistReport(projectPath, audit, options = {}) {
  const { waves } = buildWaves(audit.items ?? [], { scope: options.scope ?? 'defects' })
  const markdown = renderReport(audit, { waves, includePassedDetail: options.includePassedDetail === true })
  const target = options.reportPath ?? reportFile(projectPath)
  await writeTextAtomic(target, markdown)
  const jsonTarget = options.jsonPath ?? reportJsonFile(projectPath)
  if (options.writeJson !== false) {
    await writeTextAtomic(jsonTarget, `${JSON.stringify(renderJsonReport(audit, waves), null, 2)}\n`)
  }
  return { markdown, waves, reportPath: target, jsonPath: options.writeJson === false ? undefined : jsonTarget }
}

/* ------------------------------------------------------------------ *
 * 工具 1：qf_scan —— 项目侦察
 * ------------------------------------------------------------------ */

const qfScan = define({
  name: 'qf_scan',
  description: [
    '侦察目标项目并生成结构化"项目画像"：技术栈、包管理器、语言分布、项目类型、可执行的检查命令、测试框架、CI/容器/IaC/安全工具配置，以及**已经能确定的工程缺口**。',
    '这是全面测试的第一步：结论全部来自磁盘证据（配置、脚本、文件统计与只读 git 查询），不含猜测。',
    '画像会写入 <项目>/.qualityforge/audit.json，后续 qf_plan 用它裁剪不适用的测试项、qf_exec 用它选择要执行的命令。',
    '当用户说"对某个项目做一次全面测试 / 质量审计 / 上线前检查"时，先调用本工具。',
  ].join(' '),
  parameters: objectRoot({
    projectPath: str('目标项目根目录绝对路径；省略时使用当前会话工作目录。'),
    force: bool('为 true 时忽略既有画像重新扫描，默认 true。'),
  }),
  output: {
    schema: objectRoot({
      projectPath: str('解析后的项目绝对路径。'),
      projectName: str('项目名。'),
      auditFile: str('结构化审计数据文件路径。'),
      reportFile: str('报告文件路径。'),
      kinds: strArray('识别到的项目类型。'),
      ecosystems: strArray('识别到的技术栈。'),
      commands: strArray('识别到的可执行检查命令（preset: 命令行）。'),
      testFrameworks: strArray('识别到的测试框架。'),
      gaps: strArray('已确认的工程缺口（优先级 + 标题）。'),
      stats: loose('规模统计（文件数、测试文件数、TODO 计数等）。'),
      summary: str('一句话结论与建议的下一步。'),
    }, ['projectPath', 'auditFile', 'reportFile', 'summary']),
    render: textRender,
  },
  async execute(args, exec) {
    const projectPath = resolveProject(args, exec)
    if (!(await pathExists(projectPath))) fail(`项目路径不存在：${projectPath}`)
    const audit = await loadOrInitAudit(projectPath)
    const profile = await ensureProfile(projectPath, audit, asBool(args?.force, true))
    audit.project = { ...audit.project, path: projectPath, name: path.basename(projectPath), scannedAt: profile.scannedAt }
    await saveAudit(projectPath, audit)

    const stack = (profile.ecosystems ?? []).map((entry) => `${entry.kind}(${entry.manifest})`).join('、') || '未识别'
    const commandLines = (profile.commands ?? []).map((entry) => `${entry.preset}: ${entry.argv.join(' ')}`)
    const gaps = (profile.gaps ?? []).map((gap) => `${gap.priority} ${gap.id} ${gap.title}`)
    const criticalGaps = (profile.gaps ?? []).filter((gap) => gap.priority === 'P0' || gap.priority === 'P1').length

    return {
      projectPath,
      projectName: profile.name,
      auditFile: auditFile(projectPath),
      reportFile: reportFile(projectPath),
      kinds: profile.kinds ?? [],
      ecosystems: stack === '未识别' ? [] : (profile.ecosystems ?? []).map((entry) => `${entry.kind}(${entry.manifest})`),
      commands: commandLines,
      testFrameworks: (profile.tests?.frameworks ?? []).map((entry) => entry.label),
      gaps,
      stats: {
        files: profile.size?.files ?? 0,
        sourceFiles: profile.size?.sourceFiles ?? 0,
        testFiles: profile.tests?.testFileCount ?? 0,
        languages: (profile.languages ?? []).slice(0, 5).map((entry) => `${entry.name}:${entry.files}`),
        ci: (profile.ci ?? []).map((entry) => entry.id),
        containers: profile.containers ?? [],
        docs: profile.docs ?? [],
        todoCount: profile.signals?.todoCount ?? 0,
        debugStatements: profile.signals?.debugStatementCount ?? 0,
        secretSuspects: (profile.signals?.secretSuspects ?? []).length,
        truncated: profile.size?.truncated === true,
      },
      summary: [
        `技术栈：${stack}`,
        `项目类型：${(profile.kinds ?? []).join('、') || '未识别'}`,
        `识别命令 ${commandLines.length} 条`,
        `测试框架：${(profile.tests?.frameworks ?? []).map((entry) => entry.label).join('、') || '未识别'}`,
        `工程缺口 ${gaps.length} 项（其中 P0/P1 ${criticalGaps} 项）`,
        `下一步：调用 qf_plan 生成测试项全集（depth=standard 起，穷尽审计用 depth=exhaustive）。`,
      ].join('；'),
    }
  },
})

/* ------------------------------------------------------------------ *
 * 工具 2：qf_plan —— 生成测试项全集
 * ------------------------------------------------------------------ */

const qfPlan = define({
  name: 'qf_plan',
  description: [
    '按企业级测试方法目录生成测试项全集：每个测试项都有稳定编号（QF-001）、优先级（P0–P3）、严重度、判定方式与通过判据。',
    `目录规模：${catalogStats().categories} 个测试域、${catalogStats().methods} 种方法、${catalogStats().cases} 条用例。`,
    'depth 决定展开深度：smoke 只含阻断项；standard 含常规交付必查项（默认）；deep 追加深度项；exhaustive 展开全部（尽可能穷尽，适合首次全面审计或合规取证）。',
    '生成时会用项目画像裁剪明显不适用项（例如 CLI 项目不需要"多区域容灾"），被裁剪项会如实记录在报告的"未展开项"一节，而不是当作通过。',
    '重复调用是安全的：既有测试项保留状态与历史，只补充新项；只有 reset=true 才清空重建。',
  ].join(' '),
  parameters: objectRoot({
    projectPath: str('目标项目根目录绝对路径；省略时使用当前会话工作目录。'),
    depth: { type: 'string', enum: DEPTHS, description: '审计深度，默认 standard。' },
    categories: strArray(`限定测试域 id（例如 ["security","unit"]）；省略表示全部。可用值：${CATEGORIES.map((category) => category.id).join(', ')}。`),
    includeAll: bool('为 true 时忽略项目类型裁剪，展开全部测试项（会引入不适用项），默认 false。'),
    withRecon: bool('是否把侦察发现的工程缺口也生成为测试项，默认 true。'),
    reset: bool('为 true 时清空既有测试项并重建（会丢失已记录状态），默认 false。'),
  }),
  output: {
    schema: objectRoot({
      projectPath: str('项目路径。'),
      auditFile: str('结构化数据文件。'),
      reportFile: str('报告文件。'),
      depth: str('本次深度。'),
      created: int('本次新增的测试项数量。'),
      retained: int('保留的既有测试项数量。'),
      total: int('当前测试项总数。'),
      byPriority: loose('按优先级统计。'),
      byCategory: loose('按测试域统计。'),
      skipped: int('因项目类型被裁剪的项数。'),
      catalog: loose('目录规模。'),
      nextStep: str('建议的下一步。'),
    }, ['projectPath', 'auditFile', 'reportFile', 'depth', 'created', 'total']),
    render: textRender,
  },
  async execute(args, exec) {
    const projectPath = resolveProject(args, exec)
    const depth = asEnum(args?.depth, 'depth', DEPTHS, 'standard')
    const categories = asStringArray(args?.categories, 'categories')
    const reset = asBool(args?.reset, false)
    const includeAll = asBool(args?.includeAll, false)
    const withRecon = asBool(args?.withRecon, true)

    if (categories.length > 0) {
      const known = new Set(CATEGORIES.map((category) => category.id))
      const unknown = categories.filter((category) => !known.has(category))
      if (unknown.length > 0) fail(`未知测试域：${unknown.join(', ')}；可用值：${[...known].join(', ')}`)
    }

    const audit = await loadOrInitAudit(projectPath)
    const profile = await ensureProfile(projectPath, audit, false)
    const kinds = includeAll ? [] : (profile.kinds ?? [])

    const expanded = expandCases({ depth, categories, kinds, includeAll })
    const definitions = [...expanded.items]
    if (withRecon) definitions.push(...gapDefinitions(profile))

    const before = audit.items.length
    const created = mergeDefinitions(audit, definitions, { reset })

    audit.project = { ...audit.project, path: projectPath, name: path.basename(projectPath) }
    audit.plan = {
      depth,
      categories,
      kinds: profile.kinds ?? [],
      includeAll,
      withRecon,
      plannedAt: nowIso(),
      planned: definitions.length,
      itemCount: audit.items.length,
    }
    audit.skipped = expanded.skipped

    const persisted = await persistReport(projectPath, audit)
    await saveAudit(projectPath, audit)

    const stats = catalogStats()
    return {
      projectPath,
      auditFile: auditFile(projectPath),
      reportFile: persisted.reportPath,
      depth,
      created,
      retained: reset ? 0 : before,
      total: audit.items.length,
      byPriority: countBy(audit.items, 'priority'),
      byCategory: countBy(audit.items, 'category'),
      skipped: expanded.skipped.length,
      catalog: { categories: stats.categories, methods: stats.methods, cases: stats.cases, expanded: expanded.items.length },
      nextStep: '先用 qf_exec 跑自动检查（构建/类型检查/Lint/测试/覆盖率/依赖审计/密钥扫描），再用 qf_record 记录 Agent 的深度分析结论；全部判定后 qf_report 出最终报告。',
      reportStats: computeSummary(audit),
    }
  },
})

/* ------------------------------------------------------------------ *
 * 工具 3：qf_exec —— 执行确定性检查
 * ------------------------------------------------------------------ */

function matchPresetItems(items, preset, outcome) {
  return matchPresetTargets(items, preset, outcome)
}

const qfExec = define({
  name: 'qf_exec',
  description: [
    '执行项目里已识别的标准检查命令（构建、类型检查、Lint、格式检查、单元测试、覆盖率、端到端测试、依赖漏洞审计、密钥扫描），捕获退出码、耗时与输出尾部，并把结果自动回填到对应测试项。',
    '只运行 qf_scan 识别出的预设命令，不接受任意 shell 字符串——需要跑自定义命令时请用 bash 工具，再用 qf_record 记录结论。',
    'install 预设默认不执行（会改动工程目录）；需要时显式传入 presets。',
    '工具缺失或命令不存在会记为 skipped 并保持测试项为待测，不会被误判成"检查失败"。',
  ].join(' '),
  parameters: objectRoot({
    projectPath: str('目标项目根目录绝对路径；省略时使用当前会话工作目录。'),
    presets: strArray(`要执行的预设；省略时执行默认集合（${DEFAULT_PRESETS.join(', ')}）。可用值：${PRESETS.join(', ')}。`),
    timeoutMs: int('单条命令超时毫秒数，默认 600000（10 分钟），上限 1800000。'),
    maxOutputBytes: int('每条命令保留的输出字符数，默认 8000。'),
    autoRecord: bool('是否把结果自动回填到测试项，默认 true。'),
    recordPass: bool('通过的检查是否也写入测试项（用于回归基线），默认 true。'),
  }),
  output: {
    schema: objectRoot({
      projectPath: str('项目路径。'),
      executed: int('实际执行的命令数。'),
      passed: int('通过数。'),
      failed: int('失败数。'),
      skipped: int('因工具缺失而跳过数。'),
      runs: loose('每条命令的执行摘要。'),
      autoRecorded: loose('自动回填到测试项的明细。'),
      summary: str('一句话结论。'),
      nextStep: str('建议的下一步。'),
    }, ['projectPath', 'executed', 'passed', 'failed', 'summary']),
    render: textRender,
  },
  async execute(args, exec) {
    const projectPath = resolveProject(args, exec)
    const presets = asEnumArray(args?.presets, 'presets', PRESETS)
    const timeoutMs = asInt(args?.timeoutMs, 'timeoutMs', 600_000, { min: 1_000, max: 1_800_000 })
    const maxOutputBytes = asInt(args?.maxOutputBytes, 'maxOutputBytes', 8_000, { min: 500, max: 500_000 })
    const autoRecord = asBool(args?.autoRecord, true)
    const recordPass = asBool(args?.recordPass, true)

    const audit = await loadOrInitAudit(projectPath)
    const profile = await ensureProfile(projectPath, audit, false)
    const commands = profile.commands ?? []
    if (commands.length === 0) {
      return {
        projectPath,
        executed: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        runs: [],
        autoRecorded: [],
        summary: '项目中没有识别到任何可执行的检查命令：可能是未被识别的技术栈，或缺少构建/测试脚本。',
        nextStep: '请确认项目根目录正确；如需执行自定义命令，用 bash 工具运行后通过 qf_record 记录结论。',
      }
    }

    const { runs, skipped } = await runPresets({
      projectPath,
      commands,
      presets,
      timeoutMs,
      maxOutputBytes,
      signal: exec?.signal,
    })

    // 同一命令的旧记录被最新一次覆盖，报告只呈现"当前状态"，避免反复执行后报告膨胀。
    const key = (run) => `${run.preset}|${run.commandLine}`
    const latest = new Map(runs.map((run) => [key(run), run]))
    audit.runs = [...(audit.runs ?? []).filter((run) => !latest.has(key(run))), ...runs]

    const autoRecorded = []
    if (autoRecord) {
      for (const run of runs) {
        const outcome = run.status === RUN_STATUS.pass ? 'pass' : 'fail'
        const targets = matchPresetItems(audit.items, run.preset, outcome)
        for (const item of targets) {
          if (run.status === RUN_STATUS.pass) {
            if (!recordPass) continue
            const from = item.status
            item.status = 'pass'
            item.actual = `命令通过：\`${run.commandLine}\`（exit 0，${Math.round(run.durationMs / 1000)}s）`
            item.evidence = [...(item.evidence ?? []), { kind: 'command', ref: run.commandLine, detail: `exit=${run.exitCode} duration=${run.durationMs}ms`, at: run.at }]
            pushHistory(item, 'pass', `qf_exec：${run.preset} 通过`, from)
            autoRecorded.push({ id: item.id, preset: run.preset, status: 'pass' })
          } else if (run.status === RUN_STATUS.fail) {
            const from = item.status
            item.status = 'fail'
            item.actual = clip(`命令失败：\`${run.commandLine}\`（exit ${run.exitCode}）\n${(run.stderrTail || run.stdoutTail || '').trim()}`.trim(), 1200)
            item.recommendation = item.recommendation || '修复失败原因后重新执行该命令，并在报告中勾选本条目。'
            item.evidence = [...(item.evidence ?? []), { kind: 'command', ref: run.commandLine, detail: `exit=${run.exitCode} duration=${run.durationMs}ms`, at: run.at }]
            pushHistory(item, 'fail', `qf_exec：${run.preset} 失败（exit ${run.exitCode}）`, from)
            autoRecorded.push({ id: item.id, preset: run.preset, status: 'fail' })
          } else {
            autoRecorded.push({ id: item.id, preset: run.preset, status: 'unchanged', reason: run.reason ?? run.status })
          }
        }
      }
    }

    const persisted = await persistReport(projectPath, audit)
    await saveAudit(projectPath, audit)

    const passed = runs.filter((run) => run.status === RUN_STATUS.pass).length
    const failed = runs.filter((run) => run.status === RUN_STATUS.fail).length
    const skippedCount = runs.filter((run) => run.status === RUN_STATUS.skipped).length + skipped.length

    return {
      projectPath,
      executed: runs.length,
      passed,
      failed,
      skipped: skippedCount,
      runs: runs.map((run) => ({
        preset: run.preset,
        commandLine: run.commandLine,
        status: run.status,
        exitCode: run.exitCode,
        durationMs: run.durationMs,
        source: run.source,
        reason: run.reason,
        outputTail: clip(run.stderrTail || run.stdoutTail, 600),
      })),
      skippedPresets: skipped,
      autoRecorded,
      summary: `执行 ${runs.length} 条命令：通过 ${passed}、失败 ${failed}、跳过 ${skippedCount}；自动回填 ${autoRecorded.filter((entry) => entry.status !== 'unchanged').length} 条测试项。`,
      nextStep: failed > 0
        ? '失败命令已生成缺陷项；建议先用 qf_list 查看 fail 项，修复后重跑 qf_exec 复测。'
        : '继续用 qf_record 记录需要 Agent 分析的测试项，然后 qf_report 生成报告。',
      reportFile: persisted.reportPath,
    }
  },
})

/* ------------------------------------------------------------------ *
 * 工具 4：qf_probe —— 本地服务探针
 * ------------------------------------------------------------------ */

const qfProbe = define({
  name: 'qf_probe',
  description: [
    '对**本机已启动**的服务做只读 HTTP 探针，验证服务真的能起来、路由可访问、返回码与响应内容符合预期。',
    '出于安全考虑，只允许回环地址（localhost / 127.0.0.1 / ::1）的 http(s)，方法限定 GET/HEAD，响应体截断；这避免插件被诱导成请求发起器。',
    '典型用法：先用 bash 在后台启动服务，再用 qf_probe 验证健康检查端点与关键路由，最后把结论写入测试项。',
  ].join(' '),
  parameters: objectRoot({
    projectPath: str('目标项目根目录绝对路径；省略时使用当前会话工作目录。'),
    urls: strArray('要探测的 URL 列表（最多 10 个，且必须是回环地址）。'),
    method: { type: 'string', enum: ['GET', 'HEAD'], description: '请求方法，默认 GET。' },
    timeoutMs: int('单次探针超时毫秒数，默认 10000，上限 30000。'),
    expectStatus: int('期望的 HTTP 状态码；省略时以 <400 视为通过。'),
    expectBodyContains: str('期望响应体包含的字符串（仅 GET 生效）。'),
    itemId: str('可选的测试项编号（QF-xxx）：把探针结论写入该条目。'),
    record: bool('是否把探针结果写入审计数据的探针记录，默认 true。'),
  }),
  output: {
    schema: objectRoot({
      projectPath: str('项目路径。'),
      probes: loose('每次探针的结果。'),
      ok: int('通过次数。'),
      failed: int('失败次数。'),
      recorded: loose('写入测试项的明细。'),
      summary: str('一句话结论。'),
    }, ['projectPath', 'probes', 'ok', 'failed', 'summary']),
    render: textRender,
  },
  async execute(args, exec) {
    const projectPath = resolveProject(args, exec)
    const urls = asStringArray(args?.urls, 'urls', { required: true })
    if (urls.length === 0) fail('参数 urls 至少需要一个地址')
    if (urls.length > 10) fail('urls 最多 10 个（避免把探针当成爬虫）')
    const method = asEnum(args?.method, 'method', ['GET', 'HEAD'], 'GET')
    const timeoutMs = asInt(args?.timeoutMs, 'timeoutMs', 10_000, { min: 500, max: 30_000 })
    const expectStatus = args?.expectStatus === undefined ? undefined : asInt(args.expectStatus, 'expectStatus', undefined, { min: 100, max: 599 })
    const expectBodyContains = asString(args?.expectBodyContains, 'expectBodyContains', { fallback: undefined })
    const itemId = asString(args?.itemId, 'itemId', { fallback: undefined })
    const record = asBool(args?.record, true)

    const audit = await loadOrInitAudit(projectPath)
    const probes = []
    for (const url of urls) {
      const result = await probeUrl({ url, method, timeoutMs, expectStatus, expectBodyContains, signal: exec?.signal })
      probes.push(result)
    }
    if (record) audit.probes = [...(audit.probes ?? []), ...probes].slice(-40)

    const recorded = []
    if (itemId !== undefined) {
      const item = findItem(audit, itemId)
      if (item === undefined) {
        recorded.push({ id: itemId, status: 'not-found' })
      } else {
        const first = probes[0]
        const from = item.status
        item.status = first.ok ? 'pass' : 'fail'
        item.actual = clip(`${first.method} ${first.url} → ${first.status ?? 'no-response'}${first.error ? `（${first.error}）` : ''}`, 600)
        item.evidence = [...(item.evidence ?? []), { kind: 'probe', ref: first.url, detail: `status=${first.status ?? '-'} latency=${first.latencyMs}ms`, at: first.at ?? nowIso() }]
        pushHistory(item, item.status, 'qf_probe 探针结论', from)
        recorded.push({ id: item.id, status: item.status })
      }
    }

    const passed = probes.filter((probe) => probe.ok).length
    const persisted = await persistReport(projectPath, audit)
    await saveAudit(projectPath, audit)

    return {
      projectPath,
      reportFile: persisted.reportPath,
      probes: probes.map((probe) => ({
        url: probe.url,
        method: probe.method,
        ok: probe.ok,
        status: probe.status,
        latencyMs: probe.latencyMs,
        contentType: probe.contentType,
        error: probe.error,
        bodySnippet: clip(probe.bodySnippet, 400),
      })),
      ok: passed,
      failed: probes.length - passed,
      recorded,
      summary: `探针 ${probes.length} 次：通过 ${passed}、失败 ${probes.length - passed}。`,
    }
  },
})

/* ------------------------------------------------------------------ *
 * 工具 5：qf_record —— 记录结论
 * ------------------------------------------------------------------ */

const qfRecord = define({
  name: 'qf_record',
  description: [
    '记录或更新测试项结论：状态、实测结果、证据、复现步骤、修复建议、工作量与涉及文件。',
    '支持两种用法：(1) 传 id 更新既有测试项；(2) 传 method + title 追加 Agent 发现的目录外问题（createMissing=true 时）。',
    '每条结论都应能回答"凭什么这么判定"：evidence/repro 至少给一个，否则报告会失去说服力。',
    '这是把 Agent 的深度分析（读代码、比对配置、分析日志得到的结论）沉淀进报告的唯一入口。',
  ].join(' '),
  parameters: objectRoot({
    projectPath: str('目标项目根目录绝对路径；省略时使用当前会话工作目录。'),
    items: {
      type: 'array',
      description: '要记录/更新的测试项列表。',
      items: {
        type: 'object',
        properties: {
          id: str('既有测试项编号（QF-xxx）；省略时用 method + title 新建或匹配。'),
          method: str('方法 id（目录中的方法号，或自定义如 AGENT-A11Y）。'),
          title: str('测试项标题（新建时必填）。'),
          category: str('测试域 id（新建时可选，默认 agent）。'),
          priority: { type: 'string', enum: PRIORITIES, description: '优先级，默认 P2。' },
          severity: { type: 'string', enum: SEVERITIES, description: '严重度；省略时按优先级推断。' },
          status: { type: 'string', enum: STATUSES, description: '状态；新建时默认 fail，更新时省略表示不变。' },
          actual: str('实测结果：看到了什么、与期望差在哪里。'),
          expect: str('期望结果（覆盖默认判据时填写）。'),
          recommendation: str('修复建议：改哪里、怎么改、注意什么。'),
          effort: str('预估工作量：S / M / L 或人日。'),
          files: strArray('涉及的文件（可带行号，如 src/auth.ts:42）。'),
          repro: strArray('复现步骤。'),
          evidence: strArray('证据：命令输出、日志片段、截图说明、请求响应等。'),
          tags: strArray('标签。'),
          cwe: strArray('CWE 编号，如 CWE-89。'),
          owasp: strArray('OWASP 分类，如 A03:2021-Injection。'),
        },
        additionalProperties: false,
      },
    },
    createMissing: bool('id 不存在时是否按 method+title 新建，默认 true。'),
  }),
  output: {
    schema: objectRoot({
      projectPath: str('项目路径。'),
      updated: loose('已更新的条目。'),
      created: loose('新建的条目。'),
      notFound: strArray('未找到的编号。'),
      errors: strArray('校验失败明细。'),
      counters: loose('当前状态分布。'),
      summary: str('一句话结论。'),
      nextStep: str('建议的下一步。'),
    }, ['projectPath', 'summary']),
    render: textRender,
  },
  async execute(args, exec) {
    const projectPath = resolveProject(args, exec)
    const entries = Array.isArray(args?.items) ? args.items : []
    if (entries.length === 0) fail('参数 items 至少需要一条记录')
    const createMissing = asBool(args?.createMissing, true)

    const audit = await loadOrInitAudit(projectPath)
    const updated = []
    const created = []
    const notFound = []
    const errors = []

    for (const entry of entries) {
      const id = asString(entry?.id, 'items[].id', { fallback: undefined })
      const method = asString(entry?.method, 'items[].method', { fallback: undefined })
      const title = asString(entry?.title, 'items[].title', { fallback: undefined })
      let item = id === undefined ? undefined : findItem(audit, id)
      let createdNow = false

      // 未给 id（或 id 未命中）时，用 method + title 再匹配一次，避免重复登记同一问题。
      if (item === undefined && method !== undefined && title !== undefined) {
        item = audit.items.find((candidate) => candidate.method === method && candidate.title === title)
      }

      if (item === undefined && createMissing) {
        if (method === undefined || title === undefined) {
          if (id !== undefined) notFound.push(id)
          errors.push(`${id ?? '(未提供 id)'}：条目不存在，且缺少 method/title 无法新建`)
          continue
        }
        const categoryId = asString(entry?.category, 'items[].category', { fallback: 'agent' })
        const category = findCategory(categoryId)
        const priority = asEnum(entry?.priority, 'items[].priority', PRIORITIES, 'P2')
        item = {
          id: nextItemId(audit),
          category: categoryId,
          categoryName: category?.name ?? (categoryId === 'agent' ? 'Agent 追加发现' : categoryId),
          method,
          methodName: category?.methods.find((candidate) => candidate.id === method)?.name ?? `${method}（自定义检查）`,
          priority,
          severity: severityOf(priority),
          tier: 'core',
          automation: 'assisted',
          title,
          expect: asString(entry?.expect, 'items[].expect', { fallback: '' }),
          status: 'pending',
          actual: '',
          recommendation: '',
          effort: '',
          owner: '',
          evidence: [],
          repro: [],
          files: [],
          tags: [],
          standards: [],
          cwe: [],
          owasp: [],
          refs: [],
          history: [{ at: nowIso(), from: null, to: 'pending', note: '由 qf_record 追加' }],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        audit.items.push(item)
        createdNow = true
        created.push({ id: item.id, title: item.title, method: item.method })
      }

      if (item === undefined) {
        if (id !== undefined) notFound.push(id)
        else errors.push('缺少 id，且缺少 method/title 无法新建')
        continue
      }

      const from = item.status
      try {
        if (entry.priority !== undefined) {
          const priority = asEnum(entry.priority, 'items[].priority', PRIORITIES)
          item.priority = priority
          if (entry.severity === undefined) item.severity = severityOf(priority)
        }
        if (entry.severity !== undefined) item.severity = asEnum(entry.severity, 'items[].severity', SEVERITIES)
        if (entry.status !== undefined) item.status = asEnum(entry.status, 'items[].status', STATUSES)
        else if (createdNow) item.status = 'fail'
        if (entry.actual !== undefined) item.actual = clip(asString(entry.actual, 'items[].actual'), 4000)
        if (entry.expect !== undefined) item.expect = clip(asString(entry.expect, 'items[].expect'), 2000)
        if (entry.recommendation !== undefined) item.recommendation = clip(asString(entry.recommendation, 'items[].recommendation'), 2000)
        if (entry.effort !== undefined) item.effort = asString(entry.effort, 'items[].effort')
        if (entry.files !== undefined) item.files = asStringArray(entry.files, 'items[].files')
        if (entry.repro !== undefined) item.repro = asStringArray(entry.repro, 'items[].repro')
        if (entry.tags !== undefined) item.tags = asStringArray(entry.tags, 'items[].tags')
        if (entry.cwe !== undefined) item.cwe = asStringArray(entry.cwe, 'items[].cwe')
        if (entry.owasp !== undefined) item.owasp = asStringArray(entry.owasp, 'items[].owasp')
        if (entry.evidence !== undefined) {
          const evidence = asStringArray(entry.evidence, 'items[].evidence')
          item.evidence = [...(item.evidence ?? []), ...evidence.map((text) => ({ kind: 'note', ref: '', detail: clip(text, 800), at: nowIso() }))]
        }
        if (entry.method !== undefined && id !== undefined) item.methodName = item.methodName || asString(entry.method, 'items[].method')
      } catch (error) {
        errors.push(`${item.id}：${error instanceof Error ? error.message : String(error)}`)
        continue
      }

      pushHistory(item, item.status, from === item.status ? 'qf_record 更新详情' : 'qf_record 状态变更', from)
      if (createdNow) continue // 新建条目只在 created 中出现，避免与 updated 重复计数
      updated.push({
        id: item.id,
        status: item.status,
        priority: item.priority,
        severity: item.severity,
        title: item.title,
        changed: from !== item.status,
      })
    }

    const persisted = await persistReport(projectPath, audit)
    await saveAudit(projectPath, audit)
    const summary = computeSummary(audit)

    return {
      projectPath,
      reportFile: persisted.reportPath,
      updated,
      created,
      notFound,
      errors,
      counters: countBy(audit.items, 'status'),
      summary: `更新 ${updated.length} 条、新建 ${created.length} 条${notFound.length > 0 ? `、未找到 ${notFound.length} 条` : ''}；当前未通过 ${summary.openDefects} 条、待测 ${summary.pending} 条。`,
      nextStep: nextAction(audit.items),
      verdict: summary.verdict,
    }
  },
})

/* ------------------------------------------------------------------ *
 * 工具 6：qf_list —— 查询测试项
 * ------------------------------------------------------------------ */

const qfList = define({
  name: 'qf_list',
  description: [
    '查询测试项：按优先级、状态、测试域、方法或关键字过滤，支持分页与明细级别。',
    '用途：决定"下一批修什么"、核对某个测试域是否已判定完、把未关闭项交给子代理并行修复。',
    '默认按 优先级 → 状态紧急度 排序，因此 limit=10 拿到的就是最该处理的 10 条。',
  ].join(' '),
  parameters: objectRoot({
    projectPath: str('目标项目根目录绝对路径；省略时使用当前会话工作目录。'),
    priorities: strArray('过滤优先级，例如 ["P0","P1"]。'),
    statuses: strArray(`过滤状态，可选值：${STATUSES.join(', ')}。`),
    category: str('过滤测试域 id。'),
    method: str('过滤方法 id。'),
    search: str('标题/实测/建议中的关键字。'),
    onlyOpen: bool('只看未关闭项（缺陷 + 待测），默认 false。'),
    detail: { type: 'string', enum: ['compact', 'detail', 'full'], description: '返回明细级别，默认 compact。' },
    limit: int('返回条数上限，默认 30，上限 200。'),
    offset: int('偏移量，默认 0。'),
  }),
  output: {
    schema: objectRoot({
      projectPath: str('项目路径。'),
      total: int('过滤后的总条数。'),
      returned: int('本次返回条数。'),
      offset: int('本次偏移。'),
      counters: loose('过滤结果的优先级/状态分布。'),
      items: loose('测试项列表。'),
      summary: loose('整体汇总（不受过滤影响）。'),
    }, ['projectPath', 'total', 'returned', 'items']),
    render: textRender,
  },
  async execute(args, exec) {
    const projectPath = resolveProject(args, exec)
    const priorities = asEnumArray(args?.priorities, 'priorities', PRIORITIES)
    const statuses = asEnumArray(args?.statuses, 'statuses', STATUSES)
    const category = asString(args?.category, 'category', { fallback: undefined })
    const method = asString(args?.method, 'method', { fallback: undefined })
    const search = asString(args?.search, 'search', { fallback: undefined })
    const onlyOpen = asBool(args?.onlyOpen, false)
    const detail = asEnum(args?.detail, 'detail', ['compact', 'detail', 'full'], 'compact')
    const limit = asInt(args?.limit, 'limit', 30, { min: 1, max: 200 })
    const offset = asInt(args?.offset, 'offset', 0, { min: 0 })

    const audit = await loadOrInitAudit(projectPath)
    const needle = search?.toLowerCase()

    const filtered = sortItems(audit.items ?? []).filter((item) => {
      if (priorities.length > 0 && !priorities.includes(item.priority)) return false
      if (statuses.length > 0 && !statuses.includes(item.status)) return false
      if (onlyOpen && !isOpen(item.status)) return false
      if (category !== undefined && item.category !== category) return false
      if (method !== undefined && item.method !== method) return false
      if (needle !== undefined) {
        const haystack = `${item.id} ${item.title} ${item.actual} ${item.recommendation} ${item.method} ${item.categoryName}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })

    const page = filtered.slice(offset, offset + limit)
    const summary = computeSummary(audit)

    return {
      projectPath,
      reportFile: reportFile(projectPath),
      total: filtered.length,
      returned: page.length,
      offset,
      counters: {
        priority: countBy(filtered, 'priority'),
        status: countBy(filtered, 'status'),
      },
      items: page.map((item) => compactItem(item, detail)),
      summary: {
        verdict: summary.verdict,
        verdictLabel: summary.verdictLabel,
        total: summary.total,
        openDefects: summary.openDefects,
        pending: summary.pending,
        passRate: summary.passRate,
        progress: progressBar(summary),
      },
      nextStep: nextAction(audit.items),
    }
  },
})

/* ------------------------------------------------------------------ *
 * 工具 7：qf_update —— 状态更新与勾选同步
 * ------------------------------------------------------------------ */

const qfUpdate = define({
  name: 'qf_update',
  description: [
    '更新测试项状态，或把开发者报告里的勾选状态**同步回**结构化数据。',
    'sync=true 时读取报告 Markdown，识别 `- [x] **QF-001**` 形式的勾选：勾选把缺陷置为"已修复待复测"（可被复测覆盖为"复测通过"），取消勾选则把已关闭项重新打开。',
    '支持在勾选行后写标记：WONTFIX（接受风险）、DEFER（延后）、NA（不适用）。',
    '这是"开发者与 Harness 就修复范围沟通"的落地环节：同步后未勾选项即为剩余修复范围。',
  ].join(' '),
  parameters: objectRoot({
    projectPath: str('目标项目根目录绝对路径；省略时使用当前会话工作目录。'),
    ids: strArray('要更新状态的测试项编号（QF-xxx）。'),
    status: { type: 'string', enum: STATUSES, description: '目标状态；sync=true 时可省略。' },
    note: str('变更说明，会写入该条目的历史。'),
    sync: bool('为 true 时从报告文件读回勾选状态，默认 false。'),
    syncPath: str('报告文件路径；省略时使用 .qualityforge/QUALITYFORGE-REPORT.md。'),
    checkedStatus: { type: 'string', enum: STATUSES, description: 'sync 时"已勾选的缺陷"对应的状态，默认 fixed。' },
    reopenStatus: { type: 'string', enum: STATUSES, description: 'sync 时"取消勾选的已关闭项"回到的状态，默认 pending。' },
  }),
  output: {
    schema: objectRoot({
      projectPath: str('项目路径。'),
      mode: str('本次模式：status 或 sync。'),
      changed: loose('状态发生变化的条目。'),
      unchanged: int('状态未变化的条目数。'),
      notFound: strArray('未找到的编号。'),
      conflicts: loose('勾选冲突（同一编号在不同位置勾选状态不一致）。'),
      counters: loose('当前状态分布。'),
      summary: str('一句话结论。'),
      nextStep: str('建议的下一步。'),
    }, ['projectPath', 'mode', 'summary']),
    render: textRender,
  },
  async execute(args, exec) {
    const projectPath = resolveProject(args, exec)
    const sync = asBool(args?.sync, false)
    const audit = await loadOrInitAudit(projectPath)
    const note = asString(args?.note, 'note', { fallback: '' })
    const changed = []
    const notFound = []
    const conflicts = []
    let unchanged = 0

    if (sync) {
      const target = asString(args?.syncPath, 'syncPath', { fallback: reportFile(projectPath) })
      const absolute = path.isAbsolute(target) ? target : path.resolve(projectPath, target)
      if (!(await pathExists(absolute))) fail(`报告文件不存在：${absolute}。请先用 qf_report 生成报告。`)
      const markdown = await readFile(absolute, 'utf8')
      const parsed = parseCheckboxSync(markdown)
      const checkedStatus = asEnum(args?.checkedStatus, 'checkedStatus', STATUSES, 'fixed')
      const reopenStatus = asEnum(args?.reopenStatus, 'reopenStatus', STATUSES, 'pending')
      conflicts.push(...parsed.conflicts)

      for (const entry of parsed.entries) {
        const item = findItem(audit, entry.id)
        if (item === undefined) {
          notFound.push(entry.id)
          continue
        }
        const from = item.status
        let next = from
        if (entry.checked) {
          if (entry.marker === 'wontfix') next = 'wontfix'
          else if (entry.marker === 'deferred') next = 'deferred'
          else if (entry.marker === 'na') next = 'na'
          else if (isDefect(from) || from === 'pending') next = checkedStatus
          // 已经关闭的条目保持原状（勾选不覆盖"复测通过""接受风险"等结论）
        } else if (!isDefect(from) && from !== 'pending') {
          next = reopenStatus
        }
        if (next === from) {
          unchanged += 1
          continue
        }
        item.status = next
        pushHistory(item, next, note || `qf_update sync：报告勾选${entry.checked ? '已勾选' : '已取消'}${entry.marker ? `（${entry.marker}）` : ''}`, from)
        changed.push({ id: item.id, from, to: next, title: item.title })
      }
    } else {
      const ids = asStringArray(args?.ids, 'ids', { required: true })
      const status = asEnum(args?.status, 'status', STATUSES)
      for (const id of ids) {
        const item = findItem(audit, id)
        if (item === undefined) {
          notFound.push(id)
          continue
        }
        if (item.status === status) {
          unchanged += 1
          continue
        }
        const from = item.status
        item.status = status
        pushHistory(item, status, note || 'qf_update 手动更新状态', from)
        changed.push({ id: item.id, from, to: status, title: item.title })
      }
    }

    const persisted = await persistReport(projectPath, audit)
    await saveAudit(projectPath, audit)
    const summary = computeSummary(audit)

    return {
      projectPath,
      reportFile: persisted.reportPath,
      mode: sync ? 'sync' : 'status',
      changed,
      unchanged,
      notFound,
      conflicts,
      counters: countBy(audit.items, 'status'),
      summary: sync
        ? `同步 ${changed.length} 条状态（未变化 ${unchanged} 条）${conflicts.length > 0 ? `，存在 ${conflicts.length} 处勾选冲突需人工确认` : ''}；当前判定：${summary.verdictLabel}。`
        : `更新 ${changed.length} 条状态（未变化 ${unchanged} 条）；当前判定：${summary.verdictLabel}。`,
      nextStep: summary.verdict === 'ready'
        ? '无未关闭缺陷：可执行 qf_report 出最终报告并进入发布评审。'
        : nextAction(audit.items),
      verdict: summary.verdict,
      reportStats: summary,
    }
  },
})

/* ------------------------------------------------------------------ *
 * 工具 8：qf_report —— 生成报告
 * ------------------------------------------------------------------ */

const qfReport = define({
  name: 'qf_report',
  description: [
    '渲染最终报告：Markdown（可逐条勾选，供开发者评审与勾选）+ JSON（供 CI 消费），并给出交付判定与修复波次。',
    '报告结构：结论摘要、优先级与严重度分布、修复波次、问题清单（逐条勾选）、全部测试项核对表、未展开项、执行证据、项目画像、签署栏。',
    '默认写入 <项目>/.qualityforge/QUALITYFORGE-REPORT.md；需要把报告放进仓库根目录时用 reportPath 指定。',
  ].join(' '),
  parameters: objectRoot({
    projectPath: str('目标项目根目录绝对路径；省略时使用当前会话工作目录。'),
    reportPath: str('报告输出路径（绝对路径或相对项目根目录）；省略时使用 .qualityforge/QUALITYFORGE-REPORT.md。'),
    waveScope: { type: 'string', enum: SCOPES, description: `修复波次的筛选范围，默认 defects。可选值：${SCOPES.join(', ')}。` },
    includePassedDetail: bool('是否在核对表中展开通过项的实测（报告会更长），默认 false。'),
    writeJson: bool('是否同时写出 .qualityforge/report.json，默认 true。'),
  }),
  output: {
    schema: objectRoot({
      projectPath: str('项目路径。'),
      reportFile: str('Markdown 报告路径。'),
      jsonFile: str('JSON 报告路径（未写出时为空）。'),
      verdict: str('交付判定：blocked / incomplete / conditional / ready。'),
      verdictLabel: str('判定的人类可读描述。'),
      stats: loose('汇总统计。'),
      waves: strArray('修复波次摘要。'),
      nextStep: str('建议的下一步。'),
    }, ['projectPath', 'reportFile', 'verdict', 'stats']),
    render: textRender,
  },
  async execute(args, exec) {
    const projectPath = resolveProject(args, exec)
    const rawPath = asString(args?.reportPath, 'reportPath', { fallback: undefined })
    const reportPath = rawPath === undefined ? undefined : path.isAbsolute(rawPath) ? rawPath : path.resolve(projectPath, rawPath)
    const waveScope = asEnum(args?.waveScope, 'waveScope', SCOPES, 'defects')
    const includePassedDetail = asBool(args?.includePassedDetail, false)
    const writeJson = asBool(args?.writeJson, true)

    const audit = await loadOrInitAudit(projectPath)
    if ((audit.items ?? []).length === 0) {
      fail('当前没有任何测试项：请先调用 qf_plan 生成测试计划（qf_scan → qf_plan → qf_exec/qf_record → qf_report）。')
    }

    const persisted = await persistReport(projectPath, audit, { reportPath, includePassedDetail, writeJson, scope: waveScope })
    await saveAudit(projectPath, audit)
    const summary = computeSummary(audit)

    return {
      projectPath,
      reportFile: persisted.reportPath,
      jsonFile: persisted.jsonPath ?? '',
      verdict: summary.verdict,
      verdictLabel: summary.verdictLabel,
      stats: summary,
      waves: persisted.waves.map((wave) => `${wave.title}：${wave.items.length} 条（${wave.items.slice(0, 4).map((item) => item.id).join('、')}${wave.items.length > 4 ? '…' : ''}）`),
      nextStep: '把报告交给开发者逐条勾选；修完后用 qf_update sync=true 回读勾选状态，再用 qf_fixplan 生成修复交接单。',
    }
  },
})

/* ------------------------------------------------------------------ *
 * 工具 9：qf_fixplan —— 修复波次与交接单
 * ------------------------------------------------------------------ */

const qfFixplan = define({
  name: 'qf_fixplan',
  description: [
    '生成修复计划：按优先级把未关闭项编排成修复波次（Wave 1 阻断级清零 → Wave 2 严重级收敛 → …），并给出可直接粘贴给 Harness 的修复交接单。',
    'scope 决定修复范围，正是"全部修复 / 部分修复"沟通的落点：all（全部未关闭）、p0、p0-p1（推荐最小可交付范围）、defects、pending、ids（指定编号）。',
    '交接单包含每条问题的期望、实测、位置与建议，以及修复约束（不改范围外代码、必须可验证、完成后回写勾选状态）。',
  ].join(' '),
  parameters: objectRoot({
    projectPath: str('目标项目根目录绝对路径；省略时使用当前工作目录。'),
    scope: { type: 'string', enum: SCOPES, description: `修复范围，默认 defects。可选值：${SCOPES.join(', ')}。` },
    ids: strArray('scope=ids 时指定的测试项编号。'),
    excludeIds: strArray('要从范围中排除的编号（例如「除了 QF-003 之外全部修」）。'),
    maxPerWave: int('单个波次最多包含的条目数（超出会按测试域拆批），默认 20。'),
    notes: str('给修复方的补充说明，会写进交接单。'),
    format: { type: 'string', enum: ['waves', 'handoff', 'both'], description: '输出内容，默认 both。' },
    writeFile: bool('是否把交接单写入 .qualityforge/FIX-HANDOFF.md，默认 false。'),
  }),
  output: {
    schema: objectRoot({
      projectPath: str('项目路径。'),
      scope: str('修复范围。'),
      selected: int('范围内的条目数。'),
      waves: loose('波次明细（含条目编号）。'),
      waveSummary: strArray('波次摘要行。'),
      handoff: str('修复交接单（Markdown，可截断）。'),
      handoffFile: str('交接单文件路径（未写出时为空）。'),
      nextStep: str('建议的下一步。'),
    }, ['projectPath', 'scope', 'selected', 'waves']),
    render: textRender,
  },
  async execute(args, exec) {
    const projectPath = resolveProject(args, exec)
    const scope = asEnum(args?.scope, 'scope', SCOPES, 'defects')
    const ids = asStringArray(args?.ids, 'ids')
    const excludeIds = asStringArray(args?.excludeIds, 'excludeIds')
    const maxPerWave = asInt(args?.maxPerWave, 'maxPerWave', 20, { min: 1, max: 100 })
    const notes = asString(args?.notes, 'notes', { fallback: '' })
    const format = asEnum(args?.format, 'format', ['waves', 'handoff', 'both'], 'both')
    const writeFile = asBool(args?.writeFile, false)

    if (scope === 'ids' && ids.length === 0) fail('scope=ids 时必须提供 ids 参数')

    const audit = await loadOrInitAudit(projectPath)
    const items = audit.items ?? []
    if (items.length === 0) fail('当前没有任何测试项：请先调用 qf_plan。')

    const selected = resolveScope(items, { scope, ids, excludeIds })
    const { waves } = buildWaves(items, { scope, ids, excludeIds, maxPerWave })
    const handoffResult = buildHandoff(items, {
      scope,
      ids,
      excludeIds,
      maxPerWave,
      notes,
      projectName: audit.project?.name ?? path.basename(projectPath),
      reportPath: reportFile(projectPath),
    })

    let handoffFile = ''
    if (writeFile) {
      handoffFile = path.join(path.dirname(reportFile(projectPath)), 'FIX-HANDOFF.md')
      await writeTextAtomic(handoffFile, handoffResult.handoff)
    }

    return {
      projectPath,
      scope,
      scopeDescription: SCOPE_DESCRIPTION[scope],
      selected: selected.length,
      waves: waves.map((wave) => ({
        id: wave.id,
        title: wave.title,
        scope: wave.scope,
        goal: wave.goal,
        entry: wave.entry,
        exit: wave.exit,
        count: wave.items.length,
        ids: wave.items.map((item) => item.id),
      })),
      waveSummary: waves.map((wave) => `${wave.title}：${wave.items.length} 条（${wave.items.slice(0, 6).map((item) => item.id).join('、')}${wave.items.length > 6 ? '…' : ''}）`),
      handoff: format === 'waves' ? '' : clip(handoffResult.handoff, 12_000),
      handoffFile,
      coverage: {
        openDefects: items.filter((item) => isDefect(item.status)).length,
        pending: items.filter((item) => item.status === 'pending').length,
      },
      nextStep: selected.length === 0
        ? '范围内没有待修复项：可直接进入发布评审，或用 qf_report 出最终报告。'
        : '按交接单执行修复；完成后把报告中对应行勾选，再用 qf_update sync=true 回写并 qf_exec 复测。',
    }
  },
})

/* ------------------------------------------------------------------ *
 * 工具 10：qf_reset —— 清除审计数据
 * ------------------------------------------------------------------ */

const qfReset = define({
  name: 'qf_reset',
  description: [
    '删除目标项目下的 .qualityforge 目录（结构化数据、报告与 JSON 快照一并清除）。',
    '仅在用户明确要求"重新开始一次审计"时使用；常规重跑请用 qf_plan 的 reset=true 或 qf_plan 增量补充。',
  ].join(' '),
  parameters: objectRoot({
    projectPath: str('目标项目根目录绝对路径；省略时使用当前工作目录。'),
    confirm: bool('必须显式传 true，避免误删审计证据。'),
  }),
  output: {
    schema: objectRoot({
      projectPath: str('项目路径。'),
      removed: str('被删除的目录。'),
      existed: bool('删除前是否存在。'),
      summary: str('一句话结论。'),
    }, ['projectPath', 'removed', 'summary']),
    render: textRender,
  },
  async execute(args, exec) {
    const projectPath = resolveProject(args, exec)
    if (asBool(args?.confirm, false) !== true) fail('qf_reset 需要 confirm=true 才会执行删除')
    const existed = await pathExists(auditFile(projectPath))
    await removeAudit(projectPath)
    return {
      projectPath,
      removed: path.join(projectPath, '.qualityforge'),
      existed,
      summary: existed ? '已删除 .qualityforge 审计目录（数据与报告均已清除）。' : '目标项目下本来就没有 .qualityforge 目录，未做任何改动。',
    }
  },
})

/** 注册顺序即模型看到的顺序，与工作流一致：侦察 → 计划 → 执行 → 记录 → 报告 → 修复。 */
export const TOOL_DEFINITIONS = [qfScan, qfPlan, qfExec, qfProbe, qfRecord, qfList, qfUpdate, qfReport, qfFixplan, qfReset]

export const TOOL_NAMES = TOOL_DEFINITIONS.map((tool) => tool.name)

export const CATALOG_SUMMARY = catalogStats()

export { KINDS, PRIORITY_META, STATUS_META, AUTOMATIONS }
