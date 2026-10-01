/**
 * 共享语义：优先级、严重度、状态、排序与安全序列化。
 *
 * 两个刻意分开的概念：
 *   优先级（priority）—— 修复紧迫度，决定修复波次与交付门禁。
 *   严重度（severity）—— 问题本身的破坏力，决定评审关注度。
 * 二者默认一一对应（P0↔critical），但允许 Agent 对个别条目单独下调/上调：
 * 一个低破坏力的阻塞项（例如缺失 LICENSE 导致无法发布）依然是 P0。
 */

export const PRIORITIES = ['P0', 'P1', 'P2', 'P3']

export const PRIORITY_META = {
  P0: {
    rank: 0,
    severity: 'critical',
    label: '阻断级 Blocker',
    meaning: '不修复则不可交付：数据损坏、安全漏洞、核心流程不可用、构建或测试失败。',
    sla: '立即修复（进入交付前必须清零）',
  },
  P1: {
    rank: 1,
    severity: 'high',
    label: '严重级 Critical',
    meaning: '影响正确性或稳定性，短期必须修复：错误处理缺失、边界未覆盖、鉴权不严、兼容性破坏。',
    sla: '本迭代内修复',
  },
  P2: {
    rank: 2,
    severity: 'medium',
    label: '一般级 Major',
    meaning: '不影响主流程但降低质量与可维护性：覆盖不足、可观测性欠缺、文档缺口。',
    sla: '排期修复',
  },
  P3: {
    rank: 3,
    severity: 'low',
    label: '改进级 Minor',
    meaning: '优化项与体验项，可延后处理，可作为技术债跟踪。',
    sla: '择机改进',
  },
}

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']

export const SEVERITY_META = {
  critical: { label: '致命', rank: 0, badge: 'CRIT' },
  high: { label: '高', rank: 1, badge: 'HIGH' },
  medium: { label: '中', rank: 2, badge: 'MED' },
  low: { label: '低', rank: 3, badge: 'LOW' },
  info: { label: '提示', rank: 4, badge: 'INFO' },
}

/**
 * 状态语义与勾选框的关系：
 *   checked=true 表示"这一条已经有结论"，开发者在报告里勾选即表达此意。
 *   open=true 表示"仍未关闭"，会继续出现在待办与修复波次里。
 */
export const STATUSES = ['pending', 'pass', 'fail', 'blocked', 'na', 'fixed', 'verified', 'wontfix', 'deferred']

export const STATUS_META = {
  pending: { label: '待测试', checked: false, open: true, group: 'todo' },
  fail: { label: '未通过', checked: false, open: true, group: 'defect' },
  blocked: { label: '阻塞', checked: false, open: true, group: 'defect' },
  fixed: { label: '已修复待复测', checked: true, open: true, group: 'fix' },
  verified: { label: '复测通过', checked: true, open: false, group: 'done' },
  pass: { label: '通过', checked: true, open: false, group: 'done' },
  na: { label: '不适用', checked: true, open: false, group: 'done' },
  wontfix: { label: '接受风险', checked: true, open: false, group: 'done' },
  deferred: { label: '延后处理', checked: true, open: false, group: 'done' },
}

export const AUTOMATIONS = ['auto', 'assisted', 'manual']

export const AUTOMATION_META = {
  auto: { label: '自动执行', hint: 'qf_exec / qf_probe 可直接判定' },
  assisted: { label: 'Agent 分析', hint: '需要读代码、比对配置或分析日志后判定' },
  manual: { label: '人工确认', hint: '需要人工、业务方或真实用户确认' },
}

/** 缺陷严重度优先的问题状态排序：fail → blocked → fixed → pending → 其余。 */
const STATE_RANK = { fail: 0, blocked: 1, fixed: 2, pending: 3 }

export function priorityRank(priority) {
  return PRIORITY_META[priority]?.rank ?? 9
}

export function severityOf(priority) {
  return PRIORITY_META[priority]?.severity ?? 'medium'
}

export function severityRank(severity) {
  return SEVERITY_META[severity]?.rank ?? 9
}

export function stateRank(status) {
  return STATE_RANK[status] ?? 4
}

export function isChecked(status) {
  return STATUS_META[status]?.checked === true
}

export function isOpen(status) {
  return STATUS_META[status]?.open === true
}

/** 是否为"需要修复"的结论（报告的问题清单口径）。 */
export function isDefect(status) {
  return status === 'fail' || status === 'blocked'
}

/** 报告与列表的稳定排序：优先级 → 状态紧急度 → 域 → 方法 → 编号。 */
export function sortItems(items) {
  return [...items].sort((a, b) => {
    const byPriority = priorityRank(a.priority) - priorityRank(b.priority)
    if (byPriority !== 0) return byPriority
    const byState = stateRank(a.status) - stateRank(b.status)
    if (byState !== 0) return byState
    const byCategory = String(a.category).localeCompare(String(b.category))
    if (byCategory !== 0) return byCategory
    const byMethod = String(a.method).localeCompare(String(b.method))
    if (byMethod !== 0) return byMethod
    return String(a.id).localeCompare(String(b.id))
  })
}

export function groupByPriority(items) {
  const groups = new Map(PRIORITIES.map((priority) => [priority, []]))
  for (const item of sortItems(items)) {
    const bucket = groups.get(item.priority) ?? groups.get('P2')
    bucket.push(item)
  }
  return [...groups.entries()].filter(([, list]) => list.length > 0)
}

export function countBy(items, key) {
  const out = {}
  for (const item of items ?? []) {
    const value = typeof key === 'function' ? key(item) : item?.[key]
    const name = value === undefined || value === null || value === '' ? 'unknown' : String(value)
    out[name] = (out[name] ?? 0) + 1
  }
  return out
}

export function nowIso() {
  return new Date().toISOString()
}

/** 截断长文本，避免把整份文件内容塞进模型上下文。 */
export function clip(text, max = 2000) {
  const value = String(text ?? '')
  if (value.length <= max) return value
  return `${value.slice(0, max)}\n…（已截断，原始长度 ${value.length} 字符，完整内容见文件）`
}

/** 只保留尾部若干字符（日志场景更有用）。 */
export function tail(text, max = 2000) {
  const value = String(text ?? '')
  if (value.length <= max) return value
  return `…（省略前 ${value.length - max} 字符）\n${value.slice(value.length - max)}`
}

/**
 * 递归转换为无损 JSON。
 *
 * 宿主在 createSuccessResult 阶段会先 snapshotJsonValue 再按 output.schema 校验，
 * 只要返回值含 undefined / NaN / 函数 / 循环引用，就会直接判为 INVALID_TOOL_OUTPUT。
 * 工具内部难免产生可选字段，因此统一在出口清洗，而不是要求每个数据源手工拼装。
 */
export function jsonSafe(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return null
  const type = typeof value
  if (type === 'number') return Number.isFinite(value) ? value : null
  if (type === 'string' || type === 'boolean') return value
  if (type === 'bigint') return Number(value)
  if (type !== 'object') return null
  if (seen.has(value)) return null
  seen.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => jsonSafe(item, seen))
    if (value instanceof Date) return value.toISOString()
    const out = {}
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue
      out[key] = jsonSafe(entry, seen)
    }
    return out
  } finally {
    seen.delete(value)
  }
}

/** 统一为 POSIX 风格相对路径，报告在任何平台上都可读。 */
export function toPosix(value) {
  return String(value ?? '').split('\\').join('/')
}

export function relativePath(from, to) {
  return toPosix(to).startsWith(`${toPosix(from)}/`) ? toPosix(to).slice(toPosix(from).length + 1) : toPosix(to)
}

/** 人类可读的耗时。 */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'n/a'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m${String(seconds).padStart(2, '0')}s`
}

/** 报告中的严重度标记，例如 `P0/critical`。 */
export function priorityBadge(item) {
  return `${item.priority}/${item.severity ?? severityOf(item.priority)}`
}
