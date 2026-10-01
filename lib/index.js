/**
 * dsh-qualityforge —— DeepSeek Harness 全面测试编排插件。
 *
 * 插件形态：命名导出（name / inject / apply），**没有 default export**
 * ——导出一个 default 会让 Loader 的 unwrapExports 折叠模块并丢掉 inject
 * （见 cordis-plugin-loader `unwrapExports`：`exports = exports.default ?? exports`）。
 *
 * 依赖策略：零外部 import，只用 Node 内置模块（fs / path / child_process / fetch）。
 * 因此不需要 dependencies、不需要构建步骤，也不会因为宿主内 @deepseek-ai/* 包的
 * 解析方式或版本变化而加载失败。代价是需要自己实现入参校验与 JSON Schema 构造，
 * 这部分集中在 lib/tools.js，并已在契约上对齐宿主 ToolDefinition。
 *
 * @module dsh-qualityforge
 */

import { registerSkill } from './skill.js'
import { TOOL_DEFINITIONS } from './tools.js'

/** Loader 行标识（与 cordis.patch.yml 中的 id 对应）。 */
export const name = 'qualityforge'

/**
 * 需要的服务：tools 是硬依赖（插件主体就是注册工具）。
 * skills 只是加分项——缺失时插件仍应完全可用，因此不写进 inject，
 * 而是在 apply 里做存在性判断。
 */
export const inject = ['tools']

/**
 * 注册工具与方法论技能。
 * @param ctx 插件上下文。
 * @returns 卸载函数：按注册逆序释放全部 disposer。
 */
export function apply(ctx) {
  const disposers = []
  const failures = []

  for (const definition of TOOL_DEFINITIONS) {
    try {
      const dispose = ctx.tools.register(definition)
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (error) {
      failures.push(`注册工具 ${definition.name} 失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  try {
    const dispose = registerSkill(ctx)
    if (typeof dispose === 'function') disposers.push(dispose)
  } catch (error) {
    failures.push(`注册技能 qualityforge-audit 失败：${error instanceof Error ? error.message : String(error)}`)
  }

  if (failures.length > 0) {
    ctx.logger?.warn?.(`[qualityforge] ${failures.join('；')}`)
  }
  ctx.logger?.info?.(`[qualityforge] 已注册工具 ${TOOL_DEFINITIONS.length - failures.length}/${TOOL_DEFINITIONS.length} 个`)

  return () => {
    for (const dispose of disposers.reverse()) {
      try {
        dispose()
      } catch (error) {
        ctx.logger?.warn?.(`[qualityforge] 卸载失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
}
