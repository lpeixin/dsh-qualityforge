/**
 * 共享语义（util）与执行器（exec）的单元测试。
 *
 * 这里覆盖的都是"错了会让工具返回值被宿主拒绝或让报告失真"的地方：
 * 无损 JSON 清洗、排序稳定性、预设匹配、回环地址限制。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { RUN_STATUS, isLoopbackUrl, runCommand, runPresets } from '../lib/exec.js'
import {
  PRIORITIES, clip, countBy, formatDuration, isChecked, isDefect, isOpen, jsonSafe,
  priorityRank, severityOf, sortItems, tail, toPosix,
} from '../lib/util.js'

test('jsonSafe 清洗出无损 JSON', () => {
  const value = {
    ok: true,
    missing: undefined,
    nan: Number.NaN,
    infinite: Number.POSITIVE_INFINITY,
    big: 10n,
    fn: () => 1,
    nested: { list: [1, undefined, Number.NaN, 'x'], when: new Date('2026-01-02T03:04:05.000Z') },
  }
  const clean = jsonSafe(value)
  assert.deepEqual(clean, {
    ok: true,
    nan: null,
    infinite: null,
    big: 10,
    fn: null,
    nested: { list: [1, null, null, 'x'], when: '2026-01-02T03:04:05.000Z' },
  })
  assert.ok(!('missing' in clean), 'undefined 字段应被丢弃（JSON 中不存在 undefined）')
  // 必须能被 JSON 往返，宿主 snapshotJsonValue 才会接受
  assert.deepEqual(JSON.parse(JSON.stringify(clean)), clean)
})

test('jsonSafe 处理循环引用而不抛错', () => {
  const node = { name: 'root' }
  node.self = node
  const clean = jsonSafe(node)
  assert.equal(clean.name, 'root')
  assert.equal(clean.self, null)
})

test('排序：优先级 → 状态紧急度 → 域 → 方法 → 编号', () => {
  const items = [
    { id: 'QF-003', priority: 'P2', status: 'fail', category: 'b', method: 'B', title: 't' },
    { id: 'QF-001', priority: 'P0', status: 'pending', category: 'a', method: 'A', title: 't' },
    { id: 'QF-002', priority: 'P0', status: 'fail', category: 'a', method: 'A', title: 't' },
    { id: 'QF-004', priority: 'P0', status: 'fail', category: 'a', method: 'A', title: 'u' },
  ]
  assert.deepEqual(sortItems(items).map((item) => item.id), ['QF-002', 'QF-004', 'QF-001', 'QF-003'])
})

test('优先级与状态语义', () => {
  assert.equal(PRIORITIES.length, 4)
  assert.equal(severityOf('P0'), 'critical')
  assert.equal(severityOf('P3'), 'low')
  assert.equal(severityOf('unknown'), 'medium')
  assert.ok(priorityRank('P0') < priorityRank('P1'))
  assert.equal(isDefect('fail'), true)
  assert.equal(isDefect('pass'), false)
  assert.equal(isOpen('fixed'), true, 'fixed 表示"已修复待复测"，仍属未关闭')
  assert.equal(isChecked('fixed'), true)
  assert.equal(isOpen('verified'), false)
  assert.equal(isChecked('pending'), false)
})

test('统计与文本工具', () => {
  const counts = countBy([{ a: 'x' }, { a: 'x' }, { a: 'y' }], 'a')
  assert.deepEqual(counts, { x: 2, y: 1 })
  assert.equal(clip('abcdef', 3).startsWith('abc'), true)
  assert.match(clip('abcdef', 3), /已截断/)
  assert.match(tail('abcdefghij', 3), /hij$/)
  assert.equal(formatDuration(1500), '1.5s')
  assert.equal(formatDuration(90_000), '1m30s')
  assert.equal(toPosix('a\\b\\c'), 'a/b/c')
})

test('回环地址限制：只允许本机 http(s)', () => {
  assert.equal(isLoopbackUrl('http://localhost:3000/health'), true)
  assert.equal(isLoopbackUrl('http://127.0.0.1:8080'), true)
  assert.equal(isLoopbackUrl('http://[::1]:8080/x'), true)
  assert.equal(isLoopbackUrl('https://127.0.0.1/api'), true)
  assert.equal(isLoopbackUrl('http://example.com/'), false, '外部地址必须被拒绝')
  assert.equal(isLoopbackUrl('http://10.0.0.5/'), false)
  assert.equal(isLoopbackUrl('file:///etc/passwd'), false)
  assert.equal(isLoopbackUrl('ftp://127.0.0.1/'), false)
  assert.equal(isLoopbackUrl('not a url'), false)
})

test('runCommand 捕获退出码与输出，且区分"工具缺失"', async () => {
  const pass = await runCommand({ argv: [process.execPath, '-e', 'console.log("hello")'], cwd: process.cwd(), timeoutMs: 20_000 })
  assert.equal(pass.status, RUN_STATUS.pass)
  assert.equal(pass.exitCode, 0)
  assert.match(pass.stdout, /hello/)

  const failResult = await runCommand({ argv: [process.execPath, '-e', 'console.error("boom"); process.exit(3)'], cwd: process.cwd(), timeoutMs: 20_000 })
  assert.equal(failResult.status, RUN_STATUS.fail)
  assert.equal(failResult.exitCode, 3)
  assert.match(failResult.stderr, /boom/)

  const missing = await runCommand({ argv: ['definitely-not-a-real-binary-xyz', '--version'], cwd: process.cwd(), timeoutMs: 5_000 })
  assert.equal(missing.status, RUN_STATUS.skipped, '可执行文件不存在应记为 skipped，而不是 fail')
})

test('runPresets 逐候选尝试，并在缺失时记为 skipped', async () => {
  const commands = [
    { preset: 'test', argv: ['definitely-not-a-real-binary-xyz'], source: 'fixture', description: '缺失命令' },
    { preset: 'test', argv: [process.execPath, '-e', 'console.log("second candidate")'], source: 'fixture', description: '可用命令' },
    { preset: 'lint', argv: ['definitely-not-a-real-binary-xyz'], source: 'fixture', description: '全部缺失' },
  ]
  const { runs, skipped } = await runPresets({ projectPath: process.cwd(), commands, presets: ['test', 'lint', 'e2e'], timeoutMs: 20_000 })
  assert.equal(runs.length, 1, '应记录第一个真正启动成功的候选命令')
  assert.equal(runs[0].status, RUN_STATUS.pass)
  assert.match(runs[0].stdoutTail, /second candidate/)
  const reasons = skipped.map((entry) => entry.preset)
  assert.ok(reasons.includes('lint'), '候选命令全部不可用时应记录 skipped')
  assert.ok(reasons.includes('e2e'), '没有候选命令的预设也要记录 skipped')
})
