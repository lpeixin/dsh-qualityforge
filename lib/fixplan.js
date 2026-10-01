/**
 * 修复波次与交接稿生成。
 *
 * 报告回答"有什么问题"，本模块回答"先修什么、怎么交给 Harness 修"。
 * 两者共同支撑报告最重要的用途：让开发者与 Harness 就**修复范围**达成一致
 * （全部修复 / 只修 P0-P1 / 指定编号 / 分批修复）。
 *
 * 波次是建议而非命令：分批的依据是"优先级 + 是否阻断交付"，而不是文件或模块，
 * 因为修复顺序首先由交付风险决定。
 */

import { PRIORITY_META, STATUS_META, isDefect, isOpen, priorityRank, sortItems } from './util.js'

export const SCOPES = ['all', 'p0', 'p0-p1', 'p1-p2', 'defects', 'pending', 'ids']

export const SCOPE_DESCRIPTION = {
  all: '全部未关闭项（缺陷 + 待测）',
  p0: '仅 P0 阻断级缺陷',
  'p0-p1': 'P0 与 P1 缺陷（推荐的最小可交付修复范围）',
  'p1-p2': 'P1 与 P2 缺陷',
  defects: '全部未通过/阻塞的缺陷',
  pending: '仅待测项（补测范围）',
  ids: '仅指定编号（配合 ids 参数）',
}

/** 按范围筛选修复对象。 */
export function resolveScope(items, { scope = 'defects', ids = [], excludeIds = [] } = {}) {
  const wanted = new Set((ids ?? []).map((id) => String(id).toUpperCase()))
  const excluded = new Set((excludeIds ?? []).map((id) => String(id).toUpperCase()))
  return sortItems(items).filter((item) => {
    if (excluded.has(item.id.toUpperCase())) return false
    switch (scope) {
      case 'all': return isOpen(item.status)
      case 'p0': return isDefect(item.status) && item.priority === 'P0'
      case 'p0-p1': return isDefect(item.status) && (item.priority === 'P0' || item.priority === 'P1')
      case 'p1-p2': return isDefect(item.status) && (item.priority === 'P1' || item.priority === 'P2')
      case 'pending': return item.status === 'pending'
      case 'ids': return wanted.has(item.id.toUpperCase())
      case 'defects':
      default: return isDefect(item.status)
    }
  })
}

function compact(item) {
  return {
    id: item.id,
    priority: item.priority,
    severity: item.severity,
    status: item.status,
    category: item.category,
    categoryName: item.categoryName,
    method: item.method,
    title: item.title,
    expect: item.expect,
    actual: item.actual,
    recommendation: item.recommendation,
    files: item.files ?? [],
    effort: item.effort ?? '',
    automation: item.automation,
  }
}

/** 把过大的波次按测试域切成可执行的小批。 */
function splitWave(items, maxPerWave) {
  if (!Number.isFinite(maxPerWave) || maxPerWave <= 0 || items.length <= maxPerWave) return [items]
  const buckets = new Map()
  for (const item of items) {
    if (!buckets.has(item.category)) buckets.set(item.category, [])
    buckets.get(item.category).push(item)
  }
  const chunks = []
  let current = []
  for (const bucket of buckets.values()) {
    if (current.length > 0 && current.length + bucket.length > maxPerWave) {
      chunks.push(current)
      current = []
    }
    current.push(...bucket)
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

/**
 * 生成修复波次。
 * @param {object[]} items 全部测试项。
 * @param {{scope?: string, ids?: string[], excludeIds?: string[], maxPerWave?: number, verifyCommands?: string[]}} [options]
 * @returns {{waves: object[], scope: string, selected: number}}
 */
export function buildWaves(items, options = {}) {
  const { scope = 'defects', maxPerWave = 20, verifyCommands = [] } = options
  const selected = resolveScope(items, options)

  const groups = new Map([
    ['P0', []],
    ['P1', []],
    ['P2', []],
    ['P3', []],
  ])
  const pendingItems = []
  for (const item of selected) {
    if (item.status === 'pending') {
      pendingItems.push(item)
      continue
    }
    const bucket = groups.get(item.priority) ?? groups.get('P2')
    bucket.push(item)
  }

  const waves = []
  let index = 0
  const waveSpecs = [
    {
      priority: 'P0',
      title: 'Wave 1 · 阻断级清零',
      scope: 'P0 阻断级缺陷',
      goal: '恢复"可交付"状态：消除数据损坏、安全漏洞、核心流程不可用与构建/测试失败。',
      entry: '当前报告已确认存在 P0 缺陷；相关自动检查命令的输出已存档。',
      exit: '全部 P0 条目置为已修复，且构建、类型检查、测试、依赖审计命令全部通过。',
    },
    {
      priority: 'P1',
      title: 'Wave 2 · 严重级收敛',
      scope: 'P1 严重级缺陷',
      goal: '消除影响正确性与稳定性的问题，使系统可以进入灰度或小范围发布。',
      entry: 'Wave 1 已清零并复测通过。',
      exit: '全部 P1 条目复测通过，回归用例集无新增失败。',
    },
    {
      priority: 'P2',
      title: 'Wave 3 · 一般级治理',
      scope: 'P2 一般级缺陷',
      goal: '补齐覆盖、可观测性与文档缺口，降低后续维护成本。',
      entry: 'Wave 1、Wave 2 已完成。',
      exit: 'P2 条目关闭或明确排期（DEFER 并注明批次）。',
    },
    {
      priority: 'P3',
      title: 'Wave 4 · 改进项与技术债',
      scope: 'P3 改进级缺陷',
      goal: '处理体验与优化项，登记技术债。',
      entry: '前三个波次已完成。',
      exit: 'P3 条目关闭、接受风险或转入技术债清单。',
    },
  ]

  for (const spec of waveSpecs) {
    const bucket = groups.get(spec.priority) ?? []
    if (bucket.length === 0) continue
    const chunks = splitWave(bucket, maxPerWave)
    chunks.forEach((chunk, chunkIndex) => {
      index += 1
      waves.push({
        id: `wave-${index}`,
        title: chunks.length > 1 ? `${spec.title}（${chunkIndex + 1}/${chunks.length}）` : spec.title,
        scope: spec.scope,
        goal: spec.goal,
        entry: spec.entry,
        exit: spec.exit,
        items: chunk.map(compact),
      })
    })
  }

  if (pendingItems.length > 0) {
    index += 1
    waves.push({
      id: `wave-${index}`,
      title: `Wave ${index} · 补测与判定`,
      scope: '尚未判定的测试项',
      goal: '把"待测"变成结论：能自动跑的用 qf_exec，需分析的由 Agent 判定，需人确认的标注负责人。',
      entry: '缺陷修复不阻塞这些条目的判定，可与 Wave 1 并行。',
      exit: '每条都有明确状态（通过 / 未通过 / 不适用 / 接受风险），不留 pending。',
      items: pendingItems.slice(0, 200).map(compact),
    })
  }

  const fixed = sortItems(items).filter((item) => item.status === 'fixed')
  if (fixed.length > 0) {
    index += 1
    waves.push({
      id: `wave-${index}`,
      title: `Wave ${index} · 复测验证`,
      scope: '已修复待复测条目',
      goal: '验证修复真实生效且未引入回归；只有复测通过才算关闭。',
      entry: '开发者已在报告中勾选对应条目。',
      exit: `复测通过（置为 verified）${verifyCommands.length > 0 ? `，复测命令：${verifyCommands.map((command) => `\`${command}\``).join('、')}` : ''}。`,
      items: fixed.map(compact),
    })
  }

  return { waves, scope, selected: selected.length }
}

/**
 * 生成"交接稿"：一段可以直接粘贴回 Harness 的修复指令。
 *
 * 它把报告里的结论压缩成 Agent 可执行的上下文，同时明确约束（范围、验证、回写），
 * 这样开发者不需要手打一遍问题清单，Harness 也不需要重新侦察。
 */
export function buildHandoff(items, options = {}) {
  const { scope = 'defects', notes = '', projectName = 'project', reportPath = '.qualityforge/QUALITYFORGE-REPORT.md' } = options
  const { waves, selected } = buildWaves(items, options)
  const allItems = waves.flatMap((wave) => wave.items)
  const lines = []

  lines.push(`# QualityForge 修复交接单 · ${projectName}`)
  lines.push('')
  lines.push(`- 修复范围：${SCOPE_DESCRIPTION[scope] ?? scope}，共 **${selected}** 条`)
  lines.push(`- 报告位置：\`${reportPath}\``)
  lines.push('- 回写方式：完成后把报告中对应行的 `- [ ]` 改为 `- [x]`，然后用 `qf_update sync=true` 回写状态')
  lines.push('')
  if (notes) {
    lines.push(`> 补充说明：${notes}`)
    lines.push('')
  }

  for (const wave of waves) {
    lines.push(`## ${wave.title} — ${wave.scope}（${wave.items.length} 条）`)
    lines.push('')
    lines.push(`- 目标：${wave.goal}`)
    lines.push(`- 完成判据：${wave.exit}`)
    lines.push('')
    for (const item of wave.items) {
      lines.push(`${wave.items.indexOf(item) + 1}. **${item.id}** [${item.priority}/${item.severity}] \`${item.method}\` ${item.title}`)
      if (item.expect) lines.push(`   - 期望：${item.expect}`)
      if (item.actual) lines.push(`   - 实测：${item.actual}`)
      if (item.files?.length > 0) lines.push(`   - 位置：${item.files.join('、')}`)
      if (item.recommendation) lines.push(`   - 建议：${item.recommendation}`)
      if (item.effort) lines.push(`   - 预估工作量：${item.effort}`)
    }
    lines.push('')
  }

  lines.push('## 修复约束（请 Harness 遵守）')
  lines.push('')
  lines.push('1. 只改动范围内条目所需的代码；发现新问题时**新增**条目（`qf_record`）而不是顺手扩大改动。')
  lines.push('2. 每条修复都要能回答"怎么验证"：给出复现命令或测试用例，不接受"应该没问题了"。')
  lines.push('3. 修复后必须重跑受影响的自动检查（`qf_exec`），失败输出会进入报告的复测记录。')
  lines.push('4. 涉及安全与数据迁移的修复，需在报告中补充风险与回滚说明。')
  lines.push('5. 全部完成后调用 `qf_update sync=true` 回写勾选状态，并调用 `qf_report` 重新生成报告。')
  lines.push('')
  lines.push('## 我（开发者）希望的修复方式')
  lines.push('')
  lines.push('- [ ] 全部修复')
  lines.push('- [ ] 只修 P0 / P1（最小可交付）')
  lines.push('- [ ] 只修本交接单中的指定编号：______')
  lines.push('- [ ] 先修一批，我复测后再继续')
  lines.push('')

  return {
    handoff: lines.join('\n'),
    waves,
    selected,
    itemIds: allItems.map((item) => item.id),
  }
}

/** 修复范围的一句人类可读描述，用于工具返回值与报告。 */
export function describeScope(scope, count) {
  return `${SCOPE_DESCRIPTION[scope] ?? scope}：${count} 条`
}

/** 未关闭项按优先级的分布，用于"接下来修什么"的一句话结论。 */
export function nextAction(items) {
  const open = sortItems(items).filter((item) => isOpen(item.status))
  if (open.length === 0) return '没有未关闭项：可进入发布评审。'
  const defects = open.filter((item) => isDefect(item.status))
  if (defects.length === 0) return `仍有 ${open.length} 条待测项：先补测再决定是否发布。`
  const worst = defects[0]
  const p0 = defects.filter((item) => item.priority === 'P0').length
  const meta = PRIORITY_META[worst.priority]
  return p0 > 0
    ? `存在 ${p0} 条 P0 阻断级缺陷：建议先执行 Wave 1（最高优先级示例：${worst.id} ${worst.title}）。`
    : `无 P0 阻断项；${defects.length} 条缺陷中最高为 ${worst.priority}（${meta.label}），建议按波次推进修复。`
}

/** 进度条（纯文本），用于工具返回值的可读摘要。 */
export function progressBar(summary, width = 20) {
  const total = Math.max(1, summary.total)
  const done = Math.round(((summary.total - summary.pending - summary.openDefects) / total) * width)
  const failed = Math.round((summary.openDefects / total) * width)
  return `${'█'.repeat(Math.max(0, done))}${'▓'.repeat(Math.max(0, failed))}${'░'.repeat(Math.max(0, width - done - failed))}`
}

/** 状态标签（避免各处重复判断）。 */
export function statusLabel(status) {
  return STATUS_META[status]?.label ?? status
}

/** 波次摘要行，用于工具返回值。 */
export function waveSummary(waves) {
  return waves.map((wave) => `${wave.title}：${wave.items.length} 条（${wave.items.slice(0, 5).map((item) => item.id).join('、')}${wave.items.length > 5 ? '…' : ''}）`)
}

export { priorityRank }
