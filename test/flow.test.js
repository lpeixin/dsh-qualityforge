/**
 * 端到端流程测试：把插件当成宿主来用。
 *
 * 覆盖真实使用路径：注册 → 侦察 → 生成计划 → 记录结论 → 出报告 → 开发者勾选 →
 * 回读勾选 → 生成修复波次 → 复测关闭 → 清理。
 *
 * 同时校验宿主会强制的两条硬约束：
 *   1. 每个工具的返回值必须是**无损 JSON**（否则 INVALID_TOOL_OUTPUT）；
 *   2. 每个工具必须声明 output.schema 与 render（否则注册即失败）。
 */

import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { apply, inject, name as pluginName } from '../lib/index.js'

/** 构造一个最小的"被审计项目"。 */
async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qualityforge-fixture-'))
  await mkdir(path.join(root, 'src'), { recursive: true })
  await mkdir(path.join(root, 'test'), { recursive: true })
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture-app',
      version: '1.2.3',
      type: 'module',
      main: 'src/index.js',
      exports: { '.': './src/index.js' },
      scripts: { build: 'node -e "0"', test: 'node --test test/', lint: 'node -e "0"' },
      devDependencies: { vitest: '^2.0.0' },
      license: 'MIT',
    }, null, 2),
  )
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }, null, 2))
  await writeFile(path.join(root, 'src', 'index.js'), 'export function add(a, b) {\n  return a + b\n}\n')
  await writeFile(path.join(root, 'test', 'index.test.js'), "import test from 'node:test'\ntest('adds', () => {})\n")
  await writeFile(path.join(root, 'README.md'), '# fixture-app\n\nA fixture project used by dsh-qualityforge tests.\n')
  await writeFile(path.join(root, 'LICENSE'), 'MIT\n')
  await writeFile(path.join(root, '.gitignore'), 'node_modules/\n')
  await writeFile(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## 1.2.3\n- init\n')
  return root
}

/** 模拟宿主工具注册表。 */
function makeHost() {
  const tools = new Map()
  const warnings = []
  const ctx = {
    tools: {
      register(definition) {
        tools.set(definition.name, definition)
        return () => tools.delete(definition.name)
      },
    },
    logger: { info() {}, warn(message) { warnings.push(message) } },
    get() { return undefined },
  }
  return { ctx, tools, warnings }
}

function execFor(projectPath) {
  return { agent: { session: { header: { cwd: projectPath } } }, signal: undefined }
}

test('插件注册：命名导出契约与工具面完整', () => {
  assert.equal(pluginName, 'qualityforge')
  assert.deepEqual(inject, ['tools'])

  const { ctx, tools, warnings } = makeHost()
  const dispose = apply(ctx)
  assert.equal(typeof dispose, 'function')
  assert.deepEqual(warnings, [], '注册过程不应产生告警')
  assert.deepEqual([...tools.keys()], [
    'qf_scan', 'qf_plan', 'qf_exec', 'qf_probe', 'qf_record',
    'qf_list', 'qf_update', 'qf_report', 'qf_fixplan', 'qf_reset',
  ])

  for (const [toolName, definition] of tools) {
    assert.equal(definition.name, toolName)
    assert.ok(definition.description.length > 30, `${toolName} 缺少面向模型的说明`)
    assert.equal(definition.parameters.type, 'object', `${toolName} 的 parameters 必须是对象根`)
    assert.ok(definition.parameters.properties !== undefined, `${toolName} 的 parameters 必须有 properties`)
    assert.equal(typeof definition.execute, 'function')
    assert.ok(definition.output?.schema !== undefined, `${toolName} 缺少 output.schema`)
    assert.equal(typeof definition.output.render, 'function', `${toolName} 缺少 output.render`)
    // 自由形态对象不得关闭 additionalProperties，否则宿主校验会拒绝合法返回值
    for (const [key, node] of Object.entries(definition.output.schema.properties ?? {})) {
      if (node.type === 'object' && node.properties === undefined) {
        assert.notEqual(node.additionalProperties, false, `${toolName}.${key} 是自由对象，不能写 additionalProperties:false`)
      }
    }
  }

  dispose()
  assert.equal(tools.size, 0, '卸载后工具应全部注销')
})

test('端到端：侦察 → 计划 → 记录 → 报告 → 勾选回写 → 修复波次 → 复测 → 清理', async (t) => {
  const projectPath = await makeFixture()
  const { ctx, tools } = makeHost()
  apply(ctx)
  const call = (toolName, args) => tools.get(toolName).execute(args, execFor(projectPath))
  t.after(async () => { await rm(projectPath, { recursive: true, force: true }) })

  /* 1. 侦察 */
  const scan = await call('qf_scan', { force: true })
  assert.equal(scan.projectPath, projectPath)
  assert.ok(scan.kinds.length > 0, '应识别出项目类型')
  assert.ok(scan.commands.some((line) => line.startsWith('test:')), `应识别到测试命令：${scan.commands.join(' | ')}`)
  assert.ok(scan.gaps.some((gap) => gap.includes('lock') || gap.includes('LICENSE') || gap.includes('README') || gap.includes('CHANGELOG') || gap.includes('SECURITY')) || scan.gaps.length === 0)
  assert.deepEqual(JSON.parse(JSON.stringify(scan)), scan, '返回值必须是无损 JSON')

  /* 2. 生成测试计划（standard 后追加 exhaustive） */
  const plan = await call('qf_plan', { depth: 'standard' })
  assert.ok(plan.created > 50, `standard 深度应生成足量测试项，实际 ${plan.created}`)
  assert.ok(plan.total >= plan.created)
  const exhaustivePlan = await call('qf_plan', { depth: 'exhaustive' })
  assert.ok(exhaustivePlan.created > 0, 'exhaustive 应补充更深的测试项')
  assert.equal(exhaustivePlan.retained, plan.total, '重复调用必须保留既有测试项（不丢状态）')

  const reportPath = path.join(projectPath, '.qualityforge', 'QUALITYFORGE-REPORT.md')
  const firstReport = await readFile(reportPath, 'utf8')
  assert.match(firstReport, /# QualityForge 测试报告/)
  assert.match(firstReport, /- \[ \] \*\*QF-\d+\*\*/)
  assert.match(firstReport, /## 4\. 问题清单/)
  assert.match(firstReport, /## 5\. 全部测试项核对表/)
  assert.match(firstReport, /## 6\. 未展开/)
  await stat(path.join(projectPath, '.qualityforge', 'audit.json'))
  await stat(path.join(projectPath, '.qualityforge', 'report.json'))

  /* 3. 记录结论：一条 P0 缺陷 + 一条目录外新发现 */
  const list = await call('qf_list', { limit: 5, detail: 'detail' })
  assert.equal(list.returned, 5)
  assert.equal(typeof list.summary.progress, 'string')

  const target = await call('qf_list', { priorities: ['P0'], limit: 1 })
  const targetId = target.items[0].id
  const recorded = await call('qf_record', {
    items: [
      {
        id: targetId,
        status: 'fail',
        actual: '构建产物缺少 src/index.js，启动即报错',
        recommendation: '在打包配置中显式声明入口文件',
        files: ['src/index.js:1'],
        repro: ['npm run build', 'node dist/index.js'],
        evidence: ['exit=1: Cannot find module ./src/index.js'],
        effort: 'S',
      },
      {
        method: 'AGENT-API',
        category: 'agent',
        title: '自定义检查：导出函数未做入参类型校验',
        priority: 'P2',
        severity: 'medium',
        status: 'fail',
        actual: 'add("1", 2) 返回 "12" 而不是 3',
        evidence: ['node -e "console.log(add(\'1\',2))" → 12'],
      },
    ],
  })
  assert.equal(recorded.updated.length, 1)
  assert.equal(recorded.created.length, 1)
  assert.ok(recorded.created[0].id.startsWith('QF-'))

  /* 4. 出报告：存在 P0 缺陷 → 判定不可交付 */
  const report = await call('qf_report', {})
  assert.equal(report.verdict, 'blocked')
  assert.ok(report.waves.length > 0, '应给出修复波次')
  const reportText = await readFile(report.reportFile, 'utf8')
  assert.ok(reportText.includes(targetId), '问题清单必须包含该缺陷编号')
  assert.match(reportText, new RegExp(`- \\[ \\] \\*\\*${targetId}\\*\\*`))

  /* 5. 开发者在报告里勾选（真实使用方式：直接编辑 Markdown） */
  const ticked = reportText
    .split('\n')
    .map((line) => (line.includes(`**${targetId}**`) ? line.replace('- [ ]', '- [x]') : line))
    .join('\n')
  await writeFile(report.reportFile, ticked)

  const sync = await call('qf_update', { sync: true })
  assert.equal(sync.mode, 'sync')
  assert.equal(sync.changed.length, 1, `勾选应同步为状态变更：${JSON.stringify(sync.changed)}`)
  assert.equal(sync.changed[0].to, 'fixed')
  assert.deepEqual(sync.conflicts, [])

  const afterSync = await call('qf_list', { statuses: ['fixed'] })
  assert.equal(afterSync.total, 1)

  /* 6. 修复波次与交接单 */
  const planFix = await call('qf_fixplan', { scope: 'defects', format: 'both' })
  assert.ok(planFix.waves.length > 0)
  assert.ok(planFix.selected >= 1)
  assert.match(planFix.handoff, /修复交接单/)
  assert.match(planFix.handoff, /修复约束/)

  const allOpen = await call('qf_fixplan', { scope: 'all', format: 'waves' })
  const excluded = await call('qf_fixplan', { scope: 'all', excludeIds: [targetId], format: 'waves' })
  assert.ok(allOpen.selected >= 2, `scope=all 应包含全部未关闭项，实际 ${allOpen.selected}`)
  assert.equal(excluded.selected, allOpen.selected - 1, 'excludeIds 应精确缩小修复范围')
  assert.ok(!excluded.handoff.includes(`**${targetId}**`))

  const byIds = await call('qf_fixplan', { scope: 'ids', ids: [targetId], format: 'waves' })
  assert.equal(byIds.selected, 1)

  /* 7. 复测关闭：只有复测通过才算关闭 */
  const verified = await call('qf_update', { ids: [targetId], status: 'verified', note: '复测通过' })
  assert.equal(verified.changed[0].to, 'verified')
  const closedReport = await call('qf_report', {})
  assert.ok(['conditional', 'incomplete', 'ready'].includes(closedReport.verdict), `复测后判定应前进，实际 ${closedReport.verdict}`)

  const finalReport = await readFile(closedReport.reportFile, 'utf8')
  assert.ok(finalReport.includes('复测通过'), '报告应体现复测结论')

  /* 8. 清理 */
  const reset = await call('qf_reset', { confirm: true })
  assert.equal(reset.existed, true)
  await assert.rejects(stat(path.join(projectPath, '.qualityforge')))
  await assert.rejects(call('qf_reset', {}), /confirm=true/)
})

test('参数校验：非法入参必须报错而不是静默降级', async (t) => {
  const projectPath = await makeFixture()
  const { ctx, tools } = makeHost()
  apply(ctx)
  const call = (toolName, args) => tools.get(toolName).execute(args, execFor(projectPath))
  t.after(async () => { await rm(projectPath, { recursive: true, force: true }) })

  await assert.rejects(call('qf_plan', { depth: 'nonsense' }), /未知深度|取值非法/)
  await assert.rejects(call('qf_plan', { categories: ['nope'] }), /未知测试域/)
  // 探针不抛错而是逐条返回失败原因，便于一次探测多个地址后统一判断
  const rejected = await call('qf_probe', { urls: ['http://example.com'] })
  assert.equal(rejected.ok, 0)
  assert.match(rejected.probes[0].error, /回环/)
  await assert.rejects(call('qf_probe', { urls: 'http://127.0.0.1:1' }), /必须是字符串数组/)
  await assert.rejects(call('qf_probe', {}), /必填/)
  await assert.rejects(call('qf_list', { limit: 'many' }), /必须是数字/)
  await assert.rejects(call('qf_record', { items: [] }), /至少需要一条/)
  await assert.rejects(call('qf_update', {}), /必填/)
})

test('探针只允许回环地址且拒绝外部目标', async (t) => {
  const projectPath = await makeFixture()
  const { ctx, tools } = makeHost()
  apply(ctx)
  const call = (toolName, args) => tools.get(toolName).execute(args, execFor(projectPath))
  t.after(async () => { await rm(projectPath, { recursive: true, force: true }) })

  // 先有测试项，才能验证 itemId 回写
  await call('qf_plan', { depth: 'smoke' })
  const openItem = (await call('qf_list', { limit: 1 })).items[0].id

  const probes = await call('qf_probe', {
    urls: ['http://127.0.0.1:1/health', 'http://example.com/health'],
    timeoutMs: 800,
    itemId: openItem,
  })
  assert.equal(probes.probes.length, 2)
  const external = probes.probes.find((probe) => probe.url.includes('example.com'))
  assert.equal(external.ok, false)
  assert.match(external.error, /回环/)
  assert.equal(probes.failed >= 1, true)
  assert.equal(probes.recorded[0].id, openItem, '探针结论应能写入指定测试项')
  assert.equal((await call('qf_list', { search: openItem })).total, 1)
})
