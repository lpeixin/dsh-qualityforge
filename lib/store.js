/**
 * 审计数据持久化。
 *
 * 约定：一个被审计项目对应一个 `.qualityforge/` 目录，全部证据都留在被审计
 * 项目内部（而不是插件目录），原因有三：
 *   1. 报告与原始数据要能被开发者随代码一起审阅、评审、进 CI 归档；
 *   2. 多个项目并行审计时互不干扰；
 *   3. 卸载插件不带走任何审计结论。
 *
 * 文件布局：
 *   <project>/.qualityforge/audit.json               结构化数据（唯一真相来源）
 *   <project>/.qualityforge/QUALITYFORGE-REPORT.md   人类可读、可逐条勾选的报告
 *   <project>/.qualityforge/report.json              机器可读报告快照（供 CI 消费）
 *
 * 写入一律"先写临时文件再 rename"，避免中途失败留下半个 JSON 导致审计数据不可读。
 */

import { constants as fsConstants } from 'node:fs'
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { nowIso } from './util.js'

export const AUDIT_DIR_NAME = '.qualityforge'
export const AUDIT_FILE_NAME = 'audit.json'
export const REPORT_FILE_NAME = 'QUALITYFORGE-REPORT.md'
export const REPORT_JSON_NAME = 'report.json'
export const AUDIT_SCHEMA = 'qualityforge/audit@1'

export function auditDir(projectPath) {
  return path.join(projectPath, AUDIT_DIR_NAME)
}

export function auditFile(projectPath) {
  return path.join(auditDir(projectPath), AUDIT_FILE_NAME)
}

export function reportFile(projectPath) {
  return path.join(auditDir(projectPath), REPORT_FILE_NAME)
}

export function reportJsonFile(projectPath) {
  return path.join(auditDir(projectPath), REPORT_JSON_NAME)
}

async function exists(target) {
  try {
    await access(target, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function pathExists(target) {
  return exists(target)
}

/** 原子写入文本：同目录临时文件 → rename。 */
export async function writeTextAtomic(target, content) {
  await mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, content, 'utf8')
  await rename(temporary, target)
  return target
}

export function emptyAudit(projectPath) {
  const at = nowIso()
  return {
    schema: AUDIT_SCHEMA,
    revision: 0,
    project: { path: projectPath, name: path.basename(projectPath), createdAt: at },
    plan: null,
    profile: null,
    items: [],
    runs: [],
    probes: [],
    skipped: [],
    notes: [],
    createdAt: at,
    updatedAt: at,
  }
}

function normalizeItem(raw, index) {
  const item = raw && typeof raw === 'object' ? raw : {}
  return {
    id: typeof item.id === 'string' && item.id.length > 0 ? item.id : `QF-${String(index + 1).padStart(3, '0')}`,
    category: item.category ?? 'agent',
    categoryName: item.categoryName ?? item.category ?? 'Agent 追加发现',
    method: item.method ?? 'AGENT',
    methodName: item.methodName ?? 'Agent 追加发现',
    priority: item.priority ?? 'P2',
    severity: item.severity ?? 'medium',
    tier: item.tier ?? 'core',
    automation: item.automation ?? 'assisted',
    title: item.title ?? '(未命名测试项)',
    expect: item.expect ?? '',
    status: item.status ?? 'pending',
    actual: item.actual ?? '',
    recommendation: item.recommendation ?? '',
    effort: item.effort ?? '',
    owner: item.owner ?? '',
    evidence: Array.isArray(item.evidence) ? item.evidence : [],
    repro: Array.isArray(item.repro) ? item.repro : [],
    files: Array.isArray(item.files) ? item.files : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    standards: Array.isArray(item.standards) ? item.standards : [],
    cwe: Array.isArray(item.cwe) ? item.cwe : [],
    owasp: Array.isArray(item.owasp) ? item.owasp : [],
    refs: Array.isArray(item.refs) ? item.refs : [],
    history: Array.isArray(item.history) ? item.history : [],
    createdAt: item.createdAt ?? nowIso(),
    updatedAt: item.updatedAt ?? nowIso(),
  }
}

/** 读取审计数据；不存在则初始化一份空审计。损坏时抛错而不是静默重建（避免丢证据）。 */
export async function loadOrInitAudit(projectPath) {
  const file = auditFile(projectPath)
  if (!(await exists(file))) return emptyAudit(projectPath)
  const raw = await readFile(file, 'utf8')
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`审计数据损坏，无法解析 ${file}：${error instanceof Error ? error.message : String(error)}。请备份该文件后删除，或使用 qf_reset 重建。`)
  }
  if (!parsed || typeof parsed !== 'object') throw new Error(`审计数据格式非法：${file}`)
  const audit = {
    ...emptyAudit(projectPath),
    ...parsed,
    project: { ...emptyAudit(projectPath).project, ...(parsed.project ?? {}), path: projectPath },
    items: Array.isArray(parsed.items) ? parsed.items.map(normalizeItem) : [],
    runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    probes: Array.isArray(parsed.probes) ? parsed.probes : [],
    skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
  }
  return audit
}

export async function saveAudit(projectPath, audit) {
  audit.schema = AUDIT_SCHEMA
  audit.revision = (Number.isFinite(audit.revision) ? audit.revision : 0) + 1
  audit.updatedAt = nowIso()
  await writeTextAtomic(auditFile(projectPath), `${JSON.stringify(audit, null, 2)}\n`)
  return auditFile(projectPath)
}

/** 分配下一个稳定的测试项编号（QF-001 起，删除后不复用）。 */
export function nextItemId(audit) {
  let max = 0
  for (const item of audit.items ?? []) {
    const match = /^QF-(\d+)$/.exec(String(item.id ?? ''))
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `QF-${String(max + 1).padStart(3, '0')}`
}

export function findItem(audit, id) {
  const wanted = String(id ?? '').trim().toUpperCase()
  return (audit.items ?? []).find((item) => String(item.id).toUpperCase() === wanted)
}

/** 记录状态流转，报告与复盘都靠它回答"这条什么时候、为什么变成现在这样"。 */
export function pushHistory(item, to, note, from) {
  const at = nowIso()
  item.history = Array.isArray(item.history) ? item.history : []
  item.history.push({ at, from: from ?? item.status ?? null, to, note: note ?? '' })
  item.updatedAt = at
  return item
}

export async function removeAudit(projectPath) {
  const { rm } = await import('node:fs/promises')
  await rm(auditDir(projectPath), { recursive: true, force: true })
  return auditDir(projectPath)
}
