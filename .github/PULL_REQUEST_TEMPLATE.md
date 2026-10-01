<!-- 感谢提交 PR。请先确认下面的检查项，它们对应仓库的三条硬约束。 -->

## 这个 PR 做了什么

<!-- 一句话说明改动与动机；关联 issue 请写 "Closes #123" -->

## 改动类型

- [ ] 新增/修改测试项（`lib/catalog/*.js`）
- [ ] 工具行为或新增工具（`lib/tools.js`）
- [ ] 报告渲染或勾选回读（`lib/report.js`）
- [ ] 侦察、执行、持久化（`lib/scan.js` / `lib/exec.js` / `lib/store.js`）
- [ ] 文档、示例、工程配置
- [ ] 其它：

## 自检清单

- [ ] `node --test` 全绿
- [ ] `npm run validate` 通过（目录契约 + 预设映射）
- [ ] 没有引入任何外部 `import`（插件保持零依赖、无构建步骤）
- [ ] 没有添加 `export default`（会导致 Loader 丢弃 `inject`）
- [ ] 新增工具的 `parameters` 是原始 JSON Schema，且 `execute` 内自行校验入参
- [ ] 自由形态的 `output.schema` 没有写 `additionalProperties: false`
- [ ] 工具返回值是无损 JSON（无 `undefined` / `NaN` / 循环引用）
- [ ] 改动测试项时，同步更新了 `scripts/check-mapping.mjs` 能命中的锚点（如涉及预设回填）
- [ ] 涉及用户可见改动时更新了 `CHANGELOG.md`
- [ ] 涉及安全边界的改动已在描述中说明影响

## 验证方式

<!-- 说明你如何验证：跑了哪些命令、在什么项目上审计、观察到的结果 -->
