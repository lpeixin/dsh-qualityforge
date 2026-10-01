#!/usr/bin/env node
/**
 * 校验"预设命令 → 测试项"的自动回填映射。
 *
 * 自动回填是插件最容易产生**假结论**的地方：如果映射指向的测试项不存在（目录被改写、
 * 标题调整），qf_exec 会静默地什么都不回填，读者却以为检查过了。因此把映射本身
 * 当成可校验的数据：每个预设都必须能在目录里找到它声称的锚点。
 *
 * 用法：node scripts/check-mapping.mjs   （任何未命中的锚点都会以退出码 1 结束）
 */

import { expandCases } from '../lib/catalog/index.js'
import { DEFAULT_PRESETS, PRESET_TO_ITEMS } from '../lib/exec.js'
import { matchPresetTargets } from '../lib/exec.js'

const { items } = expandCases({ depth: 'exhaustive', includeAll: true })
const presets = Object.keys(PRESET_TO_ITEMS)
const problems = []
const lines = []

lines.push('预设 → 测试项 自动回填映射')
lines.push('='.repeat(72))

for (const preset of presets) {
  const mapping = PRESET_TO_ITEMS[preset]
  const pass = matchPresetTargets(items, preset, 'pass')
  const fail = matchPresetTargets(items, preset, 'fail')
  const marks = []
  for (const target of mapping.targets ?? []) {
    const hit = items.find((item) => item.method === target.method && String(item.title).includes(target.titleIncludes ?? ''))
    if (hit === undefined) {
      problems.push(`${preset} → ${target.method}「${target.titleIncludes}」在目录中不存在`)
      marks.push(`✗ ${target.method}`)
    } else {
      marks.push(`✓ ${hit.id ?? ''}${target.method}`)
    }
  }
  const defaultMark = DEFAULT_PRESETS.includes(preset) ? '默认执行' : '按需执行'
  lines.push(`${preset.padEnd(13)} ${defaultMark}  命中 pass=${pass.length} fail=${fail.length}  ${marks.join('  ')}`)
}

const covered = new Set(presets.flatMap((preset) => (PRESET_TO_ITEMS[preset].targets ?? []).map((target) => target.method)))
const unmapped = DEFAULT_PRESETS.filter((preset) => (PRESET_TO_ITEMS[preset]?.targets ?? []).length === 0)

lines.push('-'.repeat(72))
lines.push(`预设 ${presets.length} 个，锚定方法 ${covered.size} 个：${[...covered].sort().join(', ')}`)
if (unmapped.length > 0) problems.push(`默认预设缺少映射：${unmapped.join(', ')}（执行结果不会自动回填）`)

if (problems.length > 0) {
  lines.push('')
  lines.push(`✗ 映射校验失败：${problems.length} 个问题`)
  for (const problem of problems) lines.push(`  · ${problem}`)
}

process.stdout.write(`${lines.join('\n')}\n`)
process.exit(problems.length === 0 ? 0 : 1)
