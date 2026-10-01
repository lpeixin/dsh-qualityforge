# 贡献指南

感谢你愿意改进 QualityForge。这个项目的核心资产是**测试方法目录**与**报告的可信度**，
所以下面的规则大多围绕这两点。

## 开发环境

- Node.js ≥ 20.11（开发使用 22.x 验证）
- 无需安装任何依赖：插件只使用 Node 内置模块，没有构建步骤

```bash
git clone https://github.com/lpeixin/dsh-qualityforge.git
cd dsh-qualityforge

npm test         # 单元 + 端到端测试（node:test）
npm run validate # 校验测试方法目录 + 预设自动回填映射
npm run catalog:stats
```

## 目录结构

```
lib/
  index.js            插件入口（name / inject / apply，命名导出，无 default）
  tools.js            10 个工具的 ToolDefinition（原始 JSON Schema，不依赖 defineTool）
  catalog/            测试方法目录（纯数据，45 个测试域）
  scan.js             项目侦察（只读）
  exec.js             预设命令执行 + 回环探针
  store.js            .qualityforge/ 持久化
  report.js           报告渲染 + 勾选回读
  fixplan.js          修复波次与交接单
  skill.js + SKILL.md 方法论技能
scripts/              目录校验与映射校验
test/                 node:test 测试
docs/                 编写规范与报告格式说明
```

## 三条硬约束（改动前请先读）

1. **零外部 import**。插件不得 import `@deepseek-ai/*` 或任何第三方包——安装时不需要解析
   依赖，也就不会因为宿主包版本或软链方式变化而加载失败。代价是自行实现入参校验与
   JSON Schema 构造，这部分集中在 `lib/tools.js`。
2. **命名导出，禁止 default export**。Loader 的 `unwrapExports` 会做
   `exports = exports.default ?? exports`，一旦有 default 导出，`inject` 就会丢失。
3. **不写自定义会话事件，不改被审计项目**。插件运行在宿主进程内、不受工作区沙箱约束：
   侦察只读，`qf_exec` 只跑预设白名单命令，`qf_probe` 只允许回环地址。

## 新增或修改测试项（最常见的贡献）

1. 编辑 `lib/catalog/<域文件>.js`（纯数据模块，只导出 `categories`）。
2. 字段与写作要求见 [`docs/CATALOG-AUTHORING.md`](docs/CATALOG-AUTHORING.md)：
   - `title` 必须能独立判定、8–120 字、无编号；
   - `expect` 必须可观测、可复现，禁止"符合预期""正常工作"；
   - `tier` 选 `blocker` / `core` / `extended` / `exhaustive`，决定它在哪个深度被展开；
   - 一个方法至少一条 `blocker`/`core`，否则 smoke 深度会整域落空。
3. 运行 `npm run validate`：校验器会拒绝重复 id、非法枚举、占位式填充与分布失衡。

## 新增工具

1. 在 `lib/tools.js` 中新增 `define({ name, description, parameters, output, execute })`；
2. `parameters` 是**原始 JSON Schema**（宿主直接投影给模型），必须在 `execute` 内自行校验入参；
3. `output.schema` 会被宿主用于校验返回值：自由形态对象**不要**写 `additionalProperties: false`；
4. 返回值会被 `define()` 清洗为无损 JSON——不要返回函数、`NaN`、循环引用；
5. 加入 `TOOL_DEFINITIONS` 数组（顺序即模型看到的顺序），并在 `test/flow.test.js` 的
   注册断言中登记。

## 提交前检查

```bash
node --test          # 必须全绿
npm run validate     # 目录与映射必须通过
```

- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)（`feat:` / `fix:` / `docs:` …）；
- 变更记录写进 `CHANGELOG.md` 的 `Unreleased` 段；
- 涉及安全问题的改动，请阅读 [`SECURITY.md`](SECURITY.md) 后按私下渠道报告。

## 行为准则

参与本项目即表示同意遵守 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)。
