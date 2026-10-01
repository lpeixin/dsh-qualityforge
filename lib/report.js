/**
 * 报告渲染与勾选回读。
 *
 * 报告是插件的**最终交付物**，设计目标有三个：
 *   1. 逐条勾选：每个测试项一行复选框，编号稳定（QF-001），开发者直接在文件里勾；
 *   2. 优先级可读：问题清单按 P0→P3 分组，每条标注严重度、证据、复现、建议；
 *   3. 可作为与 Harness 的沟通依据：勾选状态能被 qf_update sync=true 读回，
 *      未勾选项就是"待修复范围"的默认集合。
 *
 * 因此渲染是确定性的（同一份 audit.json 永远渲染出同一份报告，便于 diff 与评审），
 * 且不写入任何时间以外的随机内容。
 */

import {
  AUTOMATION_META, PRIORITIES, PRIORITY_META, SEVERITIES, SEVERITY_META, STATUS_META,
  countBy, formatDuration, groupByPriority, isDefect, isOpen, priorityBadge, severityOf, sortItems,
} from './util.js'

export const VERDICT_META = {
  blocked: { label: '不可交付（存在阻断级问题）', emoji: '⛔', order: 0 },
  incomplete: { label: '审计未完成（仍有大量待测项）', emoji: '⏳', order: 1 },
  conditional: { label: '有条件交付（严重级问题待修复）', emoji: '⚠️', order: 2 },
  ready: { label: '可交付（无未关闭缺陷）', emoji: '✅', order: 3 },
}

/** 汇总统计与交付闸门判定。 */
export function computeSummary(audit) {
  const items = audit.items ?? []
  const byStatus = {}
  for (const status of Object.keys(STATUS_META)) byStatus[status] = 0
  const byPriority = {}
  for (const priority of PRIORITIES) byPriority[priority] = { total: 0, open: 0, pending: 0, pass: 0, na: 0, accepted: 0 }
  let openDefects = 0
  let p0Open = 0
  let p1Open = 0
  let pending = 0
  let accepted = 0
  let closed = 0
  let failedRuns = 0

  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1
    const bucket = byPriority[item.priority] ?? byPriority.P2
    bucket.total += 1
    if (isDefect(item.status)) {
      openDefects += 1
      bucket.open += 1
      if (item.priority === 'P0') p0Open += 1
      if (item.priority === 'P1') p1Open += 1
    }
    if (item.status === 'pending') {
      pending += 1
      bucket.pending += 1
    }
    if (item.status === 'pass' || item.status === 'verified') bucket.pass += 1
    if (item.status === 'na') bucket.na += 1
    if (item.status === 'wontfix' || item.status === 'deferred') {
      accepted += 1
      bucket.accepted += 1
    }
    if (!isOpen(item.status)) closed += 1
  }

  for (const run of audit.runs ?? []) if (run.status === 'fail') failedRuns += 1

  const total = items.length
  const evaluated = total - (byStatus.na ?? 0)
  const passRate = evaluated === 0 ? 0 : Number((((byStatus.pass ?? 0) + (byStatus.verified ?? 0)) / evaluated).toFixed(4))
  const progress = total === 0 ? 0 : Number(((closed - (byStatus.na ?? 0) - (byStatus.wontfix ?? 0) - (byStatus.deferred ?? 0)) / Math.max(1, evaluated)).toFixed(4))

  let verdict = 'ready'
  if (p0Open > 0) verdict = 'blocked'
  else if (total > 0 && pending / Math.max(1, total) > 0.25) verdict = 'incomplete'
  else if (p1Open > 0) verdict = 'conditional'

  return {
    total,
    evaluated,
    verdict,
    verdictLabel: VERDICT_META[verdict]?.label ?? verdict,
    byStatus,
    byPriority,
    openDefects,
    p0Open,
    p1Open,
    pending,
    accepted,
    closed,
    failedRuns,
    passRate,
    progress,
    runCount: (audit.runs ?? []).length,
    probeCount: (audit.probes ?? []).length,
    skippedCount: (audit.skipped ?? []).length,
    gapCount: (audit.profile?.gaps ?? []).length,
  }
}

function cell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function evidenceLines(item) {
  const lines = []
  for (const entry of item.evidence ?? []) {
    if (typeof entry === 'string') {
      lines.push(`  - ${entry}`)
      continue
    }
    const kind = entry.kind ?? 'note'
    const ref = entry.ref ?? ''
    const detail = entry.detail ?? ''
    lines.push(`  - \`${kind}\` ${ref}${detail === '' ? '' : ` — ${detail}`}`)
  }
  return lines
}

function itemBlock(item) {
  const lines = []
  const box = STATUS_META[item.status]?.checked === true ? 'x' : ' '
  const marker = item.status === 'wontfix' ? ' `WONTFIX`' : item.status === 'deferred' ? ' `DEFER`' : item.status === 'na' ? ' `NA`' : ''
  lines.push(`- [${box}] **${item.id}** · \`${item.method}\` ${item.title}${marker}`)
  lines.push(`  - 优先级：**${priorityBadge(item)}**（${PRIORITY_META[item.priority]?.label ?? item.priority}）｜状态：${STATUS_META[item.status]?.label ?? item.status}｜判定方式：${AUTOMATION_META[item.automation]?.label ?? item.automation}${item.effort ? `｜工作量：${item.effort}` : ''}`)
  if (item.expect) lines.push(`  - 期望：${item.expect}`)
  if (item.actual) lines.push(`  - 实测：${item.actual}`)
  if ((item.repro ?? []).length > 0) lines.push(`  - 复现：${item.repro.map((step, index) => `${index + 1}) ${step}`).join(' ')}`)
  if ((item.recommendation ?? '').length > 0) lines.push(`  - 建议：${item.recommendation}`)
  if ((item.files ?? []).length > 0) lines.push(`  - 位置：${item.files.map((file) => `\`${file}\``).join('、')}`)
  const evidence = evidenceLines(item)
  if (evidence.length > 0) {
    lines.push('  - 证据：')
    lines.push(...evidence)
  }
  const tags = [...(item.tags ?? []), ...(item.standards ?? []), ...(item.cwe ?? []), ...(item.owasp ?? [])]
  if (tags.length > 0) lines.push(`  - 标签：${tags.join('、')}`)
  return lines
}

/**
 * 渲染 Markdown 报告。
 * @param {object} audit 审计数据。
 * @param {object} [options]
 * @param {boolean} [options.includePassedDetail] 是否在核对表中展开通过项（默认只列一行）。
 * @param {object[]} [options.waves] 修复波次（由 fixplan 生成）。
 * @returns {string} Markdown 文本。
 */
export function renderReport(audit, options = {}) {
  const summary = computeSummary(audit)
  const items = sortItems(audit.items ?? [])
  const defects = items.filter((item) => isDefect(item.status))
  const openItems = items.filter((item) => isOpen(item.status))
  const project = audit.project ?? {}
  const profile = audit.profile ?? {}
  const lines = []

  lines.push(`# QualityForge 测试报告 · ${project.name ?? 'project'}`)
  lines.push('')
  lines.push(`> 项目路径：\`${project.path ?? '-'}\`  `)
  lines.push(`> 提交：\`${profile.git?.shortCommit ?? (profile.git?.commit ? String(profile.git.commit).slice(0, 8) : 'n/a')}\`${profile.git?.branch ? `（${profile.git.branch}${profile.git.dirty ? '，工作区有未提交改动' : ''}）` : ''}  `)
  lines.push(`> 审计深度：\`${audit.plan?.depth ?? 'standard'}\`｜测试项：${summary.total} 条｜生成时间：${audit.updatedAt ?? '-'}  `)
  lines.push(`> 结构化数据：\`.qualityforge/audit.json\`（唯一真相来源，报告可随时重新渲染）`)
  lines.push('')

  /* --- 使用说明 --- */
  lines.push('## 0. 怎么用这份报告（勾选 → 交给 Harness）')
  lines.push('')
  lines.push('1. 读第 4 节「问题清单」，每条缺陷一行复选框；第 5 节是全部测试项的核对表（含通过项）。')
  lines.push('2. 修完一条就把 `- [ ]` 改成 `- [x]`。决定接受风险时写 `- [x] `WONTFIX``，延后写 `- [x] `DEFER``，不适用写 `- [x] `NA``。')
  lines.push('3. 把报告发回 Harness，按范围沟通修复，例如：')
  lines.push('   - 「修复全部未勾选项」')
  lines.push('   - 「只修 P0 和 P1」')
  lines.push('   - 「先修 Wave 1，然后复测」')
  lines.push('   - 「除了 QF-003、QF-017 之外全部修复」')
  lines.push('4. Harness 用 `qf_update sync=true` 读回勾选状态，再用 `qf_fixplan` 生成修复波次与复测清单。')
  lines.push('')
  lines.push('> 勾选只表达"处理完成"，修复本身仍需复测：`- [x]` 会把缺陷置为**已修复待复测**，复测通过后由 Harness 置为**复测通过**。')
  lines.push('')

  /* --- 结论摘要 --- */
  lines.push('## 1. 结论摘要')
  lines.push('')
  lines.push(`**判定：${VERDICT_META[summary.verdict]?.emoji ?? ''} ${summary.verdictLabel}**`)
  lines.push('')
  lines.push('| 指标 | 值 |')
  lines.push('| --- | --- |')
  lines.push(`| 测试项总数 | ${summary.total} |`)
  lines.push(`| 未通过（缺陷） | ${summary.openDefects} |`)
  lines.push(`| 其中 P0 阻断 / P1 严重 | ${summary.p0Open} / ${summary.p1Open} |`)
  lines.push(`| 待测试 | ${summary.pending} |`)
  lines.push(`| 通过 / 复测通过 | ${(summary.byStatus.pass ?? 0)} / ${(summary.byStatus.verified ?? 0)} |`)
  lines.push(`| 已修复待复测 | ${summary.byStatus.fixed ?? 0} |`)
  lines.push(`| 接受风险 / 延后 / 不适用 | ${summary.byStatus.wontfix ?? 0} / ${summary.byStatus.deferred ?? 0} / ${summary.byStatus.na ?? 0} |`)
  lines.push(`| 一句话通过率 | ${(summary.passRate * 100).toFixed(1)}%（分母为适用项 ${summary.evaluated}） |`)
  lines.push(`| 自动检查执行 | ${summary.runCount} 条命令，其中失败 ${summary.failedRuns} 条 |`)
  lines.push(`| 本地探针 | ${summary.probeCount} 次 |`)
  lines.push(`| 侦察发现缺口 | ${summary.gapCount} 项 |`)
  lines.push('')
  if (summary.verdict === 'blocked') {
    lines.push(`> ⛔ 存在 ${summary.p0Open} 条阻断级问题：在清零之前不建议发布或交付。`)
  } else if (summary.verdict === 'incomplete') {
    lines.push(`> ⏳ 仍有 ${summary.pending} 条未判定（占 ${((summary.pending / Math.max(1, summary.total)) * 100).toFixed(0)}%），当前结论不足以支撑发布决策。`)
  } else if (summary.verdict === 'conditional') {
    lines.push(`> ⚠️ 无阻断级问题，但有 ${summary.p1Open} 条严重级问题待修复，建议本迭代内处理后再发布。`)
  } else {
    lines.push('> ✅ 未发现未关闭缺陷。发布前请确认待测项已清空、以及接受风险项已被显式确认。')
  }
  lines.push('')

  /* --- 分布 --- */
  lines.push('## 2. 优先级与严重度分布')
  lines.push('')
  lines.push('| 优先级 | 严重度 | 总数 | 未通过 | 待测 | 通过 | 接受风险 | 未关闭合计 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const priority of PRIORITIES) {
    const bucket = summary.byPriority[priority]
    if (bucket.total === 0) continue
    const meta = PRIORITY_META[priority]
    lines.push(`| ${priority} · ${meta.label} | ${SEVERITY_META[meta.severity].label} | ${bucket.total} | ${bucket.open} | ${bucket.pending} | ${bucket.pass} | ${bucket.accepted} | ${bucket.open + bucket.pending} |`)
  }
  lines.push('')
  lines.push('严重度含义：' + SEVERITIES.map((severity) => `${SEVERITY_META[severity].label}=${severity}`).join('、'))
  lines.push('')
  const byCategory = countBy(items, 'categoryName')
  lines.push('<details><summary>按测试域分布</summary>')
  lines.push('')
  lines.push('| 测试域 | 测试项 |')
  lines.push('| --- | --- |')
  for (const [name, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) lines.push(`| ${cell(name)} | ${count} |`)
  lines.push('')
  lines.push('</details>')
  lines.push('')

  /* --- 修复波次 --- */
  if (Array.isArray(options.waves) && options.waves.length > 0) {
    lines.push('## 3. 修复波次（建议顺序）')
    lines.push('')
    lines.push('| 波次 | 范围 | 条目数 | 目标 |')
    lines.push('| --- | --- | --- | --- |')
    for (const wave of options.waves) {
      lines.push(`| ${wave.title} | ${cell(wave.scope)} | ${wave.items.length} | ${cell(wave.goal)} |`)
    }
    lines.push('')
    for (const wave of options.waves) {
      lines.push(`### ${wave.title} — ${wave.scope}`)
      lines.push('')
      lines.push(`- 目标：${wave.goal}`)
      lines.push(`- 进入条件：${wave.entry}`)
      lines.push(`- 完成判据：${wave.exit}`)
      lines.push(`- 条目：${wave.items.map((item) => `${item.id}(${item.priority})`).join('、')}`)
      lines.push('')
    }
  }

  /* --- 问题清单 --- */
  lines.push('## 4. 问题清单（逐条勾选 = 修复范围）')
  lines.push('')
  if (defects.length === 0) {
    lines.push(openItems.length === 0 ? '当前没有未关闭的缺陷。' : `当前没有未通过项；仍有 ${openItems.length} 条待测项（见第 5 节）。`)
    lines.push('')
  } else {
    for (const [priority, group] of groupByPriority(defects)) {
      lines.push(`### ${priority} · ${PRIORITY_META[priority].label}（${group.length} 项）`)
      lines.push('')
      lines.push(`> 处置要求：${PRIORITY_META[priority].sla}`)
      lines.push('')
      for (const item of group) lines.push(...itemBlock(item), '')
    }
  }

  /* --- 全量核对表 --- */
  lines.push('## 5. 全部测试项核对表')
  lines.push('')
  lines.push('> 与第 4 节共用同一批编号；勾选任意一处都会被 `qf_update sync=true` 读回。')
  lines.push('')
  const byCategoryGroups = new Map()
  for (const item of items) {
    if (!byCategoryGroups.has(item.category)) byCategoryGroups.set(item.category, { name: item.categoryName, items: [] })
    byCategoryGroups.get(item.category).items.push(item)
  }
  for (const [categoryId, group] of byCategoryGroups) {
    lines.push(`### 5.${[...byCategoryGroups.keys()].indexOf(categoryId) + 1} ${group.name}（\`${categoryId}\`）`)
    lines.push('')
    const byMethod = new Map()
    for (const item of group.items) {
      if (!byMethod.has(item.method)) byMethod.set(item.method, { name: item.methodName, items: [] })
      byMethod.get(item.method).items.push(item)
    }
    for (const [methodId, methodGroup] of byMethod) {
      lines.push(`**${methodId} · ${methodGroup.name}**`)
      lines.push('')
      for (const item of methodGroup.items) {
        const box = STATUS_META[item.status]?.checked === true ? 'x' : ' '
        const marker = item.status === 'wontfix' ? ' `WONTFIX`' : item.status === 'deferred' ? ' `DEFER`' : item.status === 'na' ? ' `NA`' : ''
        const statusLabel = STATUS_META[item.status]?.label ?? item.status
        const suffix = item.status === 'fail' || item.status === 'blocked'
          ? ` — **${statusLabel}**${item.actual ? `：${cell(item.actual).slice(0, 160)}` : ''}`
          : ` — ${statusLabel}`
        lines.push(`- [${box}] **${item.id}** [${priorityBadge(item)}] ${item.title}${marker}${suffix}`)
        if (options.includePassedDetail === true && item.status === 'pass' && item.actual) lines.push(`  - 实测：${item.actual}`)
      }
      lines.push('')
    }
  }

  /* --- 未展开项 --- */
  lines.push('## 6. 未展开 / 不适用的测试项')
  lines.push('')
  const skipped = audit.skipped ?? []
  if (skipped.length === 0) {
    lines.push('无（本次审计未裁剪任何测试项）。')
  } else {
    lines.push(`本次按项目类型裁剪了 ${skipped.length} 项（不是"通过"，而是"不适用于当前项目"）。如需强制展开，可用 \`qf_plan includeAll=true\`。`)
    lines.push('')
    lines.push('| 测试域 | 方法 | 测试项 | 裁剪原因 |')
    lines.push('| --- | --- | --- | --- |')
    for (const entry of skipped.slice(0, 200)) lines.push(`| ${cell(entry.category)} | ${cell(entry.method)} | ${cell(entry.title)} | ${cell(entry.reason)} |`)
    if (skipped.length > 200) lines.push(`| … | … | 其余 ${skipped.length - 200} 项 | 见 audit.json |`)
  }
  lines.push('')

  /* --- 证据 --- */
  lines.push('## 7. 自动检查执行记录')
  lines.push('')
  const runs = audit.runs ?? []
  if (runs.length === 0) {
    lines.push('本次审计尚未执行自动检查命令（可调用 `qf_exec` 执行构建、测试、Lint、依赖审计等）。')
  } else {
    lines.push('| 预设 | 命令 | 结果 | 退出码 | 耗时 | 来源 |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    for (const run of runs) {
      const mark = run.status === 'pass' ? '✅ pass' : run.status === 'fail' ? '❌ fail' : run.status === 'skipped' ? '⏭ skipped' : `⚠️ ${run.status}`
      lines.push(`| ${cell(run.preset)} | \`${cell(run.commandLine)}\` | ${mark} | ${run.exitCode ?? '-'} | ${formatDuration(run.durationMs)} | ${cell(run.source)} |`)
    }
    lines.push('')
    const failed = runs.filter((run) => run.status === 'fail')
    if (failed.length > 0) {
      lines.push('### 7.1 失败命令输出（尾部）')
      lines.push('')
      for (const run of failed) {
        lines.push(`#### \`${run.commandLine}\`（exit ${run.exitCode}，${formatDuration(run.durationMs)}）`)
        lines.push('')
        lines.push('```text')
        lines.push((run.stderrTail || run.stdoutTail || '(无输出)').trim())
        lines.push('```')
        lines.push('')
      }
    }
  }
  lines.push('')

  const probes = audit.probes ?? []
  if (probes.length > 0) {
    lines.push('### 7.2 本地探针结果')
    lines.push('')
    lines.push('| 方法 | URL | 状态 | 结果 | 耗时 |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const probe of probes) {
      lines.push(`| ${probe.method} | \`${cell(probe.url)}\` | ${probe.status ?? '-'} | ${probe.ok ? '✅' : '❌'} ${cell(probe.error ?? '')} | ${formatDuration(probe.latencyMs)} |`)
    }
    lines.push('')
  }

  /* --- 画像 --- */
  lines.push('## 8. 项目画像（侦察结论）')
  lines.push('')
  if (profile.ecosystems === undefined) {
    lines.push('尚未执行侦察（可调用 `qf_scan`）。')
  } else {
    lines.push(`- 技术栈：${(profile.ecosystems ?? []).map((entry) => `${entry.kind}${entry.manifest ? `(${entry.manifest})` : ''}`).join('、') || '未识别'}`)
    lines.push(`- 项目类型：${(profile.kinds ?? []).join('、') || '未识别'}｜包管理器：${profile.packageManager ?? '未识别'}`)
    lines.push(`- 语言分布：${(profile.languages ?? []).slice(0, 5).map((entry) => `${entry.name} ${entry.files} 文件`).join('、') || '未识别'}`)
    lines.push(`- 测试框架：${(profile.tests?.frameworks ?? []).map((entry) => entry.label).join('、') || '未识别'}${(profile.tests?.e2eFrameworks ?? []).length > 0 ? `｜E2E：${profile.tests.e2eFrameworks.map((entry) => entry.label).join('、')}` : ''}`)
    lines.push(`- CI：${(profile.ci ?? []).map((entry) => entry.id).join('、') || '无'}｜容器：${(profile.containers ?? []).join('、') || '无'}｜IaC：${(profile.iac ?? []).join('、') || '无'}`)
    lines.push(`- 文档：${(profile.docs ?? []).join('、') || '无'}`)
    lines.push(`- 规模：${profile.size?.files ?? 0} 个文件${profile.size?.truncated ? '（已达扫描上限，统计为下界）' : ''}`)
    lines.push('')
    const gaps = profile.gaps ?? []
    if (gaps.length > 0) {
      lines.push('### 8.1 侦察阶段已确认的工程缺口')
      lines.push('')
      lines.push('| 编号 | 优先级 | 缺口 | 证据 |')
      lines.push('| --- | --- | --- | --- |')
      for (const gap of gaps) lines.push(`| ${gap.id} | ${gap.priority} | ${cell(gap.title)} | ${cell(gap.evidence)} |`)
      lines.push('')
    }
  }
  lines.push('')

  /* --- 签署 --- */
  lines.push('## 9. 复测与签署')
  lines.push('')
  lines.push('| 角色 | 姓名 | 日期 | 备注 |')
  lines.push('| --- | --- | --- | --- |')
  lines.push('| 测试执行（Harness） | QualityForge | ' + String(audit.updatedAt ?? '').slice(0, 10) + ' | 自动生成 |')
  lines.push('| 修复确认（开发者） |  |  |  |')
  lines.push('| 复测确认 |  |  |  |')
  lines.push('| 发布批准 |  |  |  |')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(`> 本报告由 dsh-qualityforge 生成，数据来源 \`.qualityforge/audit.json\`（revision ${audit.revision ?? 0}）。`)
  lines.push('> 修改报告后可用 `qf_update sync=true` 将勾选状态回写到结构化数据；用 `qf_report` 可重新渲染。')
  lines.push('')

  return lines.join('\n')
}

/**
 * 解析报告中的复选框，得到"开发者勾了哪些条目"。
 *
 * 识别形如 `- [x] **QF-001** …` 的行，并支持尾部标记：
 *   `WONTFIX` / `不修复` → 接受风险      `DEFER` / `延后` → 延后
 *   `NA` / `不适用` → 不适用
 *
 * 同一编号出现多次（问题清单 + 核对表）时以**文档中首次出现**为准，
 * 不一致的情况作为 conflict 返回，避免静默选一个。
 *
 * @param {string} markdown 报告文本。
 * @returns {{entries: object[], conflicts: object[], unknown: string[], total: number}}
 */
export function parseCheckboxSync(markdown) {
  const entries = new Map()
  const conflicts = []
  const unknown = []
  const lines = String(markdown ?? '').split('\n')

  for (const line of lines) {
    const match = /^\s*[-*]\s*\[([ xX])\]\s*\*\*(QF-\d+)\*\*/.exec(line)
    if (!match) continue
    const checked = match[1].toLowerCase() === 'x'
    const id = match[2].toUpperCase()
    const upper = line.toUpperCase()
    let marker = ''
    if (/\bWONTFIX\b|不修复|接受风险/.test(line) || /WONTFIX/.test(upper)) marker = 'wontfix'
    else if (/\bDEFER\b|延后/.test(line)) marker = 'deferred'
    else if (/\bNA\b|不适用/.test(line)) marker = 'na'
    if (entries.has(id)) {
      const previous = entries.get(id)
      if (previous.checked !== checked) conflicts.push({ id, first: previous.checked, later: checked })
      if (marker !== '' && previous.marker === '') previous.marker = marker
      continue
    }
    entries.set(id, { id, checked, marker, line: line.trim() })
  }

  return {
    entries: [...entries.values()],
    conflicts,
    unknown,
    total: entries.size,
  }
}

/** 机器可读报告（供 CI 消费）。 */
export function renderJsonReport(audit, waves) {
  const summary = computeSummary(audit)
  return {
    schema: 'qualityforge/report@1',
    project: audit.project ?? {},
    plan: audit.plan ?? null,
    generatedAt: audit.updatedAt ?? null,
    revision: audit.revision ?? 0,
    summary,
    waves: (waves ?? []).map((wave) => ({ id: wave.id, title: wave.title, scope: wave.scope, goal: wave.goal, items: wave.items.map((item) => item.id) })),
    defects: (audit.items ?? []).filter((item) => isDefect(item.status)).map((item) => ({
      id: item.id,
      priority: item.priority,
      severity: item.severity ?? severityOf(item.priority),
      status: item.status,
      category: item.category,
      method: item.method,
      title: item.title,
      expect: item.expect,
      actual: item.actual,
      recommendation: item.recommendation,
      files: item.files,
      effort: item.effort,
      evidence: item.evidence,
    })),
    counters: countBy(audit.items ?? [], 'status'),
    runs: (audit.runs ?? []).map((run) => ({ preset: run.preset, commandLine: run.commandLine, status: run.status, exitCode: run.exitCode, durationMs: run.durationMs })),
    gaps: audit.profile?.gaps ?? [],
  }
}
