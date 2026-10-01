#!/usr/bin/env node
/**
 * 测试方法目录校验器。
 *
 * 目录是纯数据，错误不会在 import 时暴露，所以用这个脚本把"数据契约"变成
 * 可执行的检查：域/方法/用例 id 唯一、字段取值合法、分层与优先级分布合理，
 * 并且拒绝占位式填充（"待补充"、"符合预期"这类无法判定的用例）。
 *
 * 用法：
 *   node scripts/validate-catalog.mjs                 # 校验聚合目录并输出统计
 *   node scripts/validate-catalog.mjs --stats         # 只输出统计
 *   node scripts/validate-catalog.mjs lib/catalog/10-security.js   # 只校验指定文件
 */

import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const statsOnly = args.includes('--stats')
const files = args.filter((arg) => !arg.startsWith('--'))

const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
const TIERS = ['blocker', 'core', 'extended', 'exhaustive']
const AUTOMATIONS = ['auto', 'assisted', 'manual']

const catalog = await import(pathToFileURL(path.join(ROOT, 'lib/catalog/index.js')).href)
const { KINDS } = catalog

/** 明显无法判定的填充词。 */
const FILLER = /待补充|待定|TODO|TBD|xxx|XXX|示例用例|符合预期|正常工作$|测试一下/

const problems = []
const warnings = []

function fail(where, message) {
  problems.push(`${where}: ${message}`)
}

function warn(where, message) {
  warnings.push(`${where}: ${message}`)
}

function checkEnum(where, field, value, allowed, { required = false } = {}) {
  if (value === undefined) {
    if (required) fail(where, `缺少必填字段 ${field}`)
    return
  }
  if (!allowed.includes(value)) fail(where, `${field} 取值非法（${value}），可选：${allowed.join(', ')}`)
}

function checkString(where, field, value, { min = 1, max = 400, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail(where, `缺少必填字段 ${field}`)
    return
  }
  if (typeof value !== 'string') {
    fail(where, `${field} 必须是字符串`)
    return
  }
  if (value.length < min) fail(where, `${field} 过短（${value.length} < ${min}）：${value}`)
  if (value.length > max) fail(where, `${field} 过长（${value.length} > ${max}）`)
  if (FILLER.test(value)) fail(where, `${field} 含占位/不可判定表述：${value}`)
}

function checkWhen(where, value) {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    fail(where, 'when 必须是数组')
    return
  }
  for (const kind of value) {
    if (!KINDS.includes(kind)) fail(where, `when 含未知项目类型 ${kind}，可选：${KINDS.join(', ')}`)
  }
}

/** 校验一个域文件导出的 categories（也用于校验聚合目录）。 */
function validateCategories(categories, sourceLabel) {
  const categoryIds = new Set()
  const methodIds = new Set()
  const titles = new Map()

  for (const category of categories) {
    const label = `${sourceLabel}#${category?.id ?? '?'}`
    checkString(label, 'id', category?.id, { min: 2, max: 40 })
    if (category?.id !== undefined && !/^[a-z][a-z0-9-]*$/.test(category.id)) {
      fail(label, `id 必须是 kebab-case：${category.id}`)
    }
    if (categoryIds.has(category?.id)) fail(label, `重复的测试域 id：${category.id}`)
    categoryIds.add(category?.id)
    checkString(label, 'name', category?.name, { min: 2, max: 40 })
    checkString(label, 'intro', category?.intro, { min: 10, max: 200 })
    checkWhen(label, category?.when)

    if (!Array.isArray(category?.methods)) {
      fail(label, 'methods 必须是数组')
      continue
    }
    if (category.methods.length < 3) fail(label, `测试域至少需要 3 个方法，当前 ${category.methods.length}`)

    let categoryCases = 0
    let categoryBlocking = 0

    for (const method of category.methods) {
      const mLabel = `${label}/${method?.id ?? '?'}`
      checkString(mLabel, 'id', method?.id, { min: 3, max: 40 })
      if (method?.id !== undefined && !/^[A-Z][A-Z0-9-]*$/.test(method.id)) {
        fail(mLabel, `方法 id 必须是大写字母/数字/短横线：${method.id}`)
      }
      if (methodIds.has(method?.id)) fail(mLabel, `重复的方法 id：${method.id}`)
      methodIds.add(method?.id)
      checkString(mLabel, 'name', method?.name, { min: 2, max: 40 })
      checkEnum(mLabel, 'automation', method?.automation, AUTOMATIONS, { required: true })
      checkEnum(mLabel, 'priority', method?.priority, PRIORITIES, { required: true })

      if (!Array.isArray(method?.cases)) {
        fail(mLabel, 'cases 必须是数组')
        continue
      }
      if (method.cases.length < 3) fail(mLabel, `方法至少需要 3 条用例，当前 ${method.cases.length}`)
      if (method.cases.length > 14) warn(mLabel, `方法用例数偏多（${method.cases.length}），考虑拆分方法`)

      let methodHasShallow = false
      const methodTitles = new Set()

      for (const entry of method.cases) {
        const cLabel = `${mLabel}「${entry?.title ?? '?'}」`
        checkString(cLabel, 'title', entry?.title, { min: 8, max: 120 })
        checkString(cLabel, 'expect', entry?.expect, { min: 6, max: 240 })
        checkEnum(cLabel, 'tier', entry?.tier, TIERS, { required: true })
        checkEnum(cLabel, 'priority', entry?.priority, PRIORITIES)
        checkEnum(cLabel, 'automation', entry?.automation, AUTOMATIONS)
        checkWhen(cLabel, entry?.when)
        if (entry?.tags !== undefined) {
          if (!Array.isArray(entry.tags) || entry.tags.some((tag) => typeof tag !== 'string')) fail(cLabel, 'tags 必须是字符串数组')
          else if (entry.tags.length > 6) warn(cLabel, `tags 过多（${entry.tags.length}）`)
        }
        if (typeof entry?.title === 'string') {
          if (/[。.]$/.test(entry.title)) fail(cLabel, 'title 结尾不要加句号')
          if (methodTitles.has(entry.title)) fail(cLabel, '同一方法内用例标题重复')
          methodTitles.add(entry.title)
          const previous = titles.get(entry.title)
          if (previous !== undefined && previous !== method.id) {
            warn(cLabel, `用例标题与 ${previous} 重复，建议改写以保持可检索性`)
          } else {
            titles.set(entry.title, method.id)
          }
        }
        const tier = entry?.tier ?? 'core'
        if (tier === 'blocker' || tier === 'core') {
          methodHasShallow = true
          categoryBlocking += 1
        }
        categoryCases += 1
      }

      if (!methodHasShallow) fail(mLabel, '方法内至少需要一条 blocker 或 core 用例')
    }

    if (categoryCases < 10) fail(label, `测试域用例过少（${categoryCases} < 10）`)
    if (categoryBlocking < 2) fail(label, `测试域至少需要 2 条 blocker/core 用例，当前 ${categoryBlocking}`)
  }

  return { categoryIds, methodIds, categories: categories.length }
}

const targets = []
if (files.length === 0) {
  targets.push({ label: '<catalog>', categories: catalog.CATEGORIES })
} else {
  for (const file of files) {
    const absolute = path.resolve(ROOT, file)
    const mod = await import(pathToFileURL(absolute).href)
    if (!Array.isArray(mod.categories)) {
      fail(file, '模块必须导出 categories 数组')
      continue
    }
    targets.push({ label: path.relative(ROOT, absolute), categories: mod.categories })
  }
}

const emptyFiles = []
if (files.length === 0) {
  const stat = catalog.catalogStats()
  for (const entry of stat.detail) {
    if (entry.cases === 0) emptyFiles.push(entry.id)
  }
}

for (const target of targets) validateCategories(target.categories, target.label)

const stats = catalog.catalogStats()
const perFile = new Map()
if (files.length > 0) {
  for (const target of targets) {
    let methods = 0
    let cases = 0
    const tiers = Object.fromEntries(TIERS.map((tier) => [tier, 0]))
    for (const category of target.categories) {
      for (const method of category.methods ?? []) {
        methods += 1
        for (const entry of method.cases ?? []) {
          cases += 1
          tiers[entry.tier ?? 'core'] += 1
        }
      }
    }
    perFile.set(target.label, { categories: target.categories.length, methods, cases, tiers })
  }
}

const lines = []
lines.push('QualityForge 测试方法目录')
lines.push('='.repeat(60))
if (perFile.size > 0) {
  for (const [label, entry] of perFile) {
    lines.push(
      `${label.padEnd(34)} 域 ${String(entry.categories).padStart(2)} · 方法 ${String(entry.methods).padStart(3)} · 用例 ${String(entry.cases).padStart(4)}` +
        `  [blocker ${entry.tiers.blocker} / core ${entry.tiers.core} / extended ${entry.tiers.extended} / exhaustive ${entry.tiers.exhaustive}]`,
    )
  }
  lines.push('-'.repeat(60))
}
lines.push(
  `合计：测试域 ${stats.categories} · 方法 ${stats.methods} · 用例 ${stats.cases}` +
    `  [blocker ${stats.byTier.blocker} / core ${stats.byTier.core} / extended ${stats.byTier.extended} / exhaustive ${stats.byTier.exhaustive}]`,
)
for (const depth of catalog.DEPTHS) {
  const { items } = catalog.expandCases({ depth })
  lines.push(`  深度 ${depth.padEnd(11)} 展开 ${items.length} 条`)
}

if (emptyFiles.length > 0) {
  lines.push('')
  lines.push(`⚠ 空域（尚未填充）：${emptyFiles.join(', ')}`)
}

if (!statsOnly) {
  if (warnings.length > 0) {
    lines.push('')
    lines.push(`提示 ${warnings.length} 条：`)
    for (const message of warnings.slice(0, 40)) lines.push(`  · ${message}`)
    if (warnings.length > 40) lines.push(`  … 其余 ${warnings.length - 40} 条省略`)
  }
  if (problems.length > 0) {
    lines.push('')
    lines.push(`✗ 校验失败：${problems.length} 个问题`)
    for (const message of problems.slice(0, 60)) lines.push(`  · ${message}`)
    if (problems.length > 60) lines.push(`  … 其余 ${problems.length - 60} 个问题省略`)
  }
}

process.stdout.write(`${lines.join('\n')}\n`)
process.exit(problems.length === 0 ? 0 : 1)
