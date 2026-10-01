/**
 * 测试方法目录的完整性测试。
 *
 * 目录是纯数据，错误不会在 import 时报出来，所以这里把"数据契约"固定成断言：
 * id 唯一、取值合法、分层分布合理、深度展开单调、项目类型裁剪有效。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AUTOMATIONS, CATEGORIES, DEPTHS, DEPTH_TIERS, KINDS, TIERS,
  catalogStats, caseKey, expandCases, findCategory, methodIndex,
} from '../lib/catalog/index.js'
import { PRIORITIES } from '../lib/util.js'

test('目录规模达到企业级审计的下限', () => {
  const stats = catalogStats()
  assert.ok(stats.categories >= 30, `测试域应不少于 30 个，实际 ${stats.categories}`)
  assert.ok(stats.methods >= 150, `测试方法应不少于 150 个，实际 ${stats.methods}`)
  assert.ok(stats.cases >= 700, `测试用例应不少于 700 条，实际 ${stats.cases}`)
})

test('测试域与方法 id 全局唯一且格式合法', () => {
  const categoryIds = new Set()
  const methodIds = new Set()
  for (const category of CATEGORIES) {
    assert.match(category.id, /^[a-z][a-z0-9-]*$/, `测试域 id 非法：${category.id}`)
    assert.ok(!categoryIds.has(category.id), `重复测试域 id：${category.id}`)
    categoryIds.add(category.id)
    for (const method of category.methods) {
      assert.match(method.id, /^[A-Z][A-Z0-9-]*$/, `方法 id 非法：${method.id}`)
      assert.ok(!methodIds.has(method.id), `重复方法 id：${method.id}`)
      methodIds.add(method.id)
      assert.ok(AUTOMATIONS.includes(method.automation), `${method.id} automation 非法`)
      assert.ok(PRIORITIES.includes(method.priority), `${method.id} priority 非法`)
    }
  }
})

test('每个方法都有可独立判定的用例，且分层与优先级合法', () => {
  for (const category of CATEGORIES) {
    for (const method of category.methods) {
      assert.ok(method.cases.length >= 3, `${method.id} 用例过少：${method.cases.length}`)
      const shallow = method.cases.filter((entry) => entry.tier === 'blocker' || entry.tier === 'core')
      assert.ok(shallow.length >= 1, `${method.id} 缺少 blocker/core 用例（smoke 深度会整域落空）`)
      const titles = new Set()
      for (const entry of method.cases) {
        assert.ok(TIERS.includes(entry.tier), `${method.id} tier 非法：${entry.tier}`)
        assert.ok(entry.title.length >= 8, `${method.id} 标题过短：${entry.title}`)
        assert.ok(entry.expect.length >= 6, `${method.id} 缺少通过判据：${entry.title}`)
        assert.ok(!titles.has(entry.title), `${method.id} 标题重复：${entry.title}`)
        titles.add(entry.title)
        if (entry.priority !== undefined) assert.ok(PRIORITIES.includes(entry.priority), `${method.id} case priority 非法`)
        if (entry.automation !== undefined) assert.ok(AUTOMATIONS.includes(entry.automation), `${method.id} case automation 非法`)
        for (const kind of entry.when ?? []) assert.ok(KINDS.includes(kind), `${method.id} 未知项目类型：${kind}`)
      }
    }
  }
})

test('when 只能使用已声明的项目类型', () => {
  for (const category of CATEGORIES) {
    for (const kind of category.when ?? []) assert.ok(KINDS.includes(kind), `${category.id} 未知项目类型：${kind}`)
    for (const method of category.methods) {
      for (const kind of method.when ?? []) assert.ok(KINDS.includes(kind), `${method.id} 未知项目类型：${kind}`)
    }
  }
})

test('深度展开单调递增，smoke 只含阻断项', () => {
  const counts = DEPTHS.map((depth) => expandCases({ depth }).items.length)
  for (let index = 1; index < counts.length; index += 1) {
    assert.ok(counts[index] >= counts[index - 1], `深度 ${DEPTHS[index]} 展开数少于上一层：${counts.join(' / ')}`)
  }
  const smoke = expandCases({ depth: 'smoke' }).items
  assert.ok(smoke.length > 0)
  assert.ok(smoke.every((item) => item.tier === 'blocker'), 'smoke 深度只能包含 blocker 层用例')
  const exhaustive = expandCases({ depth: 'exhaustive' }).items
  assert.ok(exhaustive.length >= 700, `exhaustive 深度应展开全部用例，实际 ${exhaustive.length}`)
  const tiers = new Set(exhaustive.map((item) => item.tier))
  assert.deepEqual([...tiers].sort(), [...TIERS].sort())
})

test('项目类型裁剪生效但不静默丢弃', () => {
  const all = expandCases({ depth: 'exhaustive' }).items.length
  const pluginOnly = expandCases({ depth: 'exhaustive', kinds: ['plugin'] })
  assert.ok(pluginOnly.items.length < all, 'plugin 类型应裁掉部分不适用项')
  assert.ok(pluginOnly.skipped.length > 0, '被裁掉的项必须记录原因')
  for (const entry of pluginOnly.skipped) assert.ok(typeof entry.reason === 'string' && entry.reason.length > 0)
  const includeAll = expandCases({ depth: 'exhaustive', kinds: ['plugin'], includeAll: true })
  assert.equal(includeAll.items.length, all, 'includeAll 应忽略裁剪')
  assert.equal(includeAll.skipped.length, 0)
})

test('测试域筛选与未知深度处理', () => {
  const only = expandCases({ depth: 'deep', categories: ['build'] })
  assert.ok(only.items.length > 0)
  assert.ok(only.items.every((item) => item.category === 'build'))
  assert.throws(() => expandCases({ depth: 'nonsense' }), /未知深度/)
})

test('测试项键稳定（同一用例跨多次展开得到同一个键）', () => {
  const first = expandCases({ depth: 'standard' }).items
  const second = expandCases({ depth: 'deep' }).items
  const keys = new Set(first.map(caseKey))
  const overlap = second.filter((item) => keys.has(caseKey(item)))
  assert.ok(overlap.length > 0, '深度提升应保留原有测试项键，避免重建时丢状态')
})

test('目录辅助查询可用', () => {
  const category = findCategory('build')
  assert.equal(category?.id, 'build')
  assert.equal(findCategory('not-a-category'), undefined)
  const index = methodIndex()
  assert.ok(index.size >= 150)
  const stats = catalogStats()
  const tierSum = Object.values(stats.byTier).reduce((sum, value) => sum + value, 0)
  assert.equal(tierSum, stats.cases, '分层统计之和应等于用例总数')
  assert.deepEqual([...Object.keys(DEPTH_TIERS)].sort(), [...DEPTHS].sort())
})
