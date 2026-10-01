/**
 * 内嵌技能（runtime skill）注册。
 *
 * 技能正文放在同目录的 SKILL.md：安装后可以直接编辑该文件调整方法论，
 * 不需要改代码（每次插件加载时读取）。技能是"怎么测"的说明书，
 * 工具是"能测什么"的能力面——两者分开，方法论就能独立演进。
 */

import { readFileSync } from 'node:fs'

export const SKILL_NAME = 'qualityforge-audit'

const SKILL_DESCRIPTION = [
  '对已完成开发的项目执行系统性全面测试的方法论：侦察 → 生成穷尽测试项 → 自动执行 → 深度分析 → 逐条勾选报告 → 修复波次与范围协商。',
  '覆盖 30+ 企业级测试域、上千条可独立判定的测试用例，产出带 P0–P3 优先级与严重度的可勾选报告。',
].join('')

const SKILL_WHEN_TO_USE = [
  '当用户要求对某个项目做全面测试、质量审计、上线前检查、验收检查、回归评估，',
  '或希望把质量要求变成"可逐条勾选、可与 Harness 协商修复范围"的清单时使用。',
].join('')

let cachedBody

function skillBody() {
  if (cachedBody === undefined) {
    cachedBody = readFileSync(new URL('./SKILL.md', import.meta.url), 'utf8')
  }
  return cachedBody
}

/**
 * 把方法论技能注册到 ctx.skills（该组合未挂载技能注册表时静默跳过）。
 * @param ctx 插件上下文。
 * @returns 取消注册的函数，或 undefined（未注册时）。
 */
export function registerSkill(ctx) {
  const skills = typeof ctx.get === 'function' ? ctx.get('skills') : ctx.skills
  if (skills === undefined || skills === null || typeof skills.register !== 'function') return undefined
  const dispose = skills.register({
    name: SKILL_NAME,
    description: SKILL_DESCRIPTION,
    whenToUse: SKILL_WHEN_TO_USE,
    content: skillBody(),
    source: 'runtime',
    invocation: { modelInvocable: true, userInvocable: true },
    metadata: { plugin: 'dsh-qualityforge', kind: 'methodology', version: '0.1.0' },
  })
  return typeof dispose === 'function' ? dispose : undefined
}
