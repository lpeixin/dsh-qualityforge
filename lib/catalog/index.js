/**
 * 测试方法目录（Test Method Catalog）聚合入口。
 *
 * 目录是 qf_plan 生成测试项的唯一来源，采用"数据即文档"的组织方式：
 * 每个域文件是一个纯数据模块，只导出 `categories` 数组，不含任何逻辑。
 * 这样做的目的：新增测试方法 = 编辑数据，而不是改代码；审查覆盖度 =
 * 读文件，而不是逆向执行路径。
 *
 * 深度（depth）与分层（tier）的映射：
 *   smoke       只跑 blocker —— 上线前的阻断级快速过关
 *   standard    blocker + core —— 常规交付审计（默认）
 *   deep        + extended —— 重要版本的深度审计
 *   exhaustive  + exhaustive —— 首次全面审计 / 合规取证（尽可能穷尽）
 */

import { categories as foundation } from './01-build.js'
import { categories as staticAnalysis } from './02-static.js'
import { categories as unit } from './03-unit.js'
import { categories as integration } from './04-integration.js'
import { categories as api } from './05-api.js'
import { categories as ui } from './06-ui.js'
import { categories as e2e } from './07-e2e.js'
import { categories as data } from './08-data.js'
import { categories as performance } from './09-perf.js'
import { categories as security } from './10-security.js'
import { categories as reliability } from './11-reliability.js'
import { categories as operations } from './12-ops.js'
import { categories as process } from './13-process.js'
import { categories as ecosystem } from './14-ecosystem.js'

/** 全部测试域，顺序即报告中的呈现顺序。 */
export const CATEGORIES = [
  ...foundation,
  ...staticAnalysis,
  ...unit,
  ...integration,
  ...api,
  ...ui,
  ...e2e,
  ...data,
  ...performance,
  ...security,
  ...reliability,
  ...operations,
  ...process,
  ...ecosystem,
]

/**
 * 项目类型标签（case/method/category 的 `when` 取值）。
 * 由 qf_scan 的画像推断，用于裁掉明显不适用的测试项。
 */
export const KINDS = [
  'library',
  'cli',
  'service',
  'web',
  'desktop',
  'mobile',
  'plugin',
  'data',
  'ml',
  'monorepo',
]

/** 分层：决定测试项在哪个深度被展开。 */
export const TIERS = ['blocker', 'core', 'extended', 'exhaustive']

/** 深度 → 包含的分层。 */
export const DEPTH_TIERS = {
  smoke: ['blocker'],
  standard: ['blocker', 'core'],
  deep: ['blocker', 'core', 'extended'],
  exhaustive: ['blocker', 'core', 'extended', 'exhaustive'],
}

export const DEPTHS = Object.keys(DEPTH_TIERS)

/** 自动化程度。 */
export const AUTOMATIONS = ['auto', 'assisted', 'manual']

/** 测试项的稳定键：跨多次计划保留状态与历史。 */
export function caseKey(definition) {
  return `${definition.category}::${definition.method}::${definition.title}`
}

function matchesKinds(when, kinds) {
  if (!Array.isArray(when) || when.length === 0) return true
  if (!Array.isArray(kinds) || kinds.length === 0) return true
  return when.some((kind) => kinds.includes(kind))
}

/**
 * 按深度、测试域与项目类型展开测试项定义。
 *
 * 被裁掉的项不会静默消失：以 `skipped` 形式返回原因，报告里如实列出，
 * 避免把"没测"伪装成"通过"。
 *
 * @param {object} [options]
 * @param {keyof DEPTH_TIERS} [options.depth] 审计深度，默认 standard。
 * @param {string[]} [options.categories] 限定测试域 id，空表示全部。
 * @param {string[]} [options.kinds] 项目类型，空表示不裁剪。
 * @param {boolean} [options.includeAll] 忽略 when 裁剪，展开全部适用项。
 * @returns {{ items: object[], skipped: object[], stats: object }}
 */
export function expandCases({ depth = 'standard', categories, kinds, includeAll = false } = {}) {
  const tiers = DEPTH_TIERS[depth]
  if (tiers === undefined) throw new Error(`未知深度：${depth}；可选值：${DEPTHS.join(', ')}`)
  const wantedCategories = Array.isArray(categories) && categories.length > 0 ? new Set(categories) : undefined
  const items = []
  const skipped = []

  for (const category of CATEGORIES) {
    if (wantedCategories !== undefined && !wantedCategories.has(category.id)) continue
    if (!includeAll && !matchesKinds(category.when, kinds)) {
      skipped.push({ category: category.id, method: '-', title: `${category.name}（整域不适用）`, reason: `项目类型不含 ${category.when.join('/')}` })
      continue
    }
    for (const method of category.methods) {
      if (!includeAll && !matchesKinds(method.when, kinds)) {
        skipped.push({ category: category.id, method: method.id, title: `${method.name}（方法不适用）`, reason: `项目类型不含 ${method.when.join('/')}` })
        continue
      }
      for (const entry of method.cases) {
        const tier = entry.tier ?? 'core'
        if (!tiers.includes(tier)) continue
        const priority = entry.priority ?? method.priority ?? category.priority ?? 'P2'
        const automation = entry.automation ?? method.automation ?? 'assisted'
        const when = entry.when ?? method.when ?? category.when
        if (!includeAll && !matchesKinds(when, kinds)) {
          skipped.push({ category: category.id, method: method.id, title: entry.title, reason: `项目类型不含 ${when.join('/')}` })
          continue
        }
        items.push({
          category: category.id,
          categoryName: category.name,
          method: method.id,
          methodName: method.name,
          methodPriority: method.priority ?? 'P2',
          automation,
          priority,
          tier,
          title: entry.title,
          expect: entry.expect ?? '',
          when: when ?? [],
          tags: entry.tags ?? [],
          standards: method.standard ?? [],
          refs: entry.refs ?? [],
        })
      }
    }
  }

  return {
    items,
    skipped,
    stats: {
      depth,
      categories: wantedCategories === undefined ? CATEGORIES.length : wantedCategories.size,
      expanded: items.length,
      skipped: skipped.length,
    },
  }
}

/** 目录规模统计：域 / 方法 / 用例总数，以及各分层用例数。 */
export function catalogStats() {
  const byTier = Object.fromEntries(TIERS.map((tier) => [tier, 0]))
  let methods = 0
  let cases = 0
  const categories = []

  for (const category of CATEGORIES) {
    let categoryCases = 0
    let categoryMethods = 0
    for (const method of category.methods) {
      methods += 1
      categoryMethods += 1
      for (const entry of method.cases) {
        cases += 1
        categoryCases += 1
        const tier = entry.tier ?? 'core'
        byTier[tier] = (byTier[tier] ?? 0) + 1
      }
    }
    categories.push({
      id: category.id,
      name: category.name,
      methods: categoryMethods,
      cases: categoryCases,
      when: category.when ?? [],
    })
  }

  return { categories: CATEGORIES.length, methods, cases, byTier, detail: categories }
}

/** 按 id 取测试域定义。 */
export function findCategory(id) {
  return CATEGORIES.find((category) => category.id === id)
}

/** 全部方法 id（用于校验 Agent 自建测试项是否冒用了目录中的方法号）。 */
export function methodIndex() {
  const index = new Map()
  for (const category of CATEGORIES) {
    for (const method of category.methods) {
      index.set(method.id, { category: category.id, name: method.name, automation: method.automation, priority: method.priority })
    }
  }
  return index
}
