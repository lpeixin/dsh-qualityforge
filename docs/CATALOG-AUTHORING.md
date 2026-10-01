# 测试方法目录编写规范

> 面向贡献者：本文件是 `lib/catalog/*.js` 的数据契约。目录是 QualityForge 的核心资产——
> 它决定一次审计能问出多少问题，因此**内容质量优先于数量**。

## 1. 目录在系统中的位置

```
lib/catalog/01-build.js ─┐
lib/catalog/02-static.js ├─→ lib/catalog/index.js ─→ expandCases() ─→ qf_plan ─→ 审计项全集
        …                │        （聚合 + 深度裁剪 + 类型裁剪）
lib/catalog/14-ecosystem.js ─┘
```

- 每个域文件是**纯数据模块**：只导出 `categories` 数组，不含 import、函数或副作用。
- 编号前缀只决定报告中的呈现顺序，不参与逻辑。
- 新增测试方法 = 编辑数据；审查覆盖度 = 读文件。两者都不需要理解执行路径。

## 2. 三层结构

| 层级 | 含义 | 判据 |
| --- | --- | --- |
| **category** | 一个测试域，对应企业研发流程中的一块质量责任 | 能回答一个独立的质量问题 |
| **method** | 一种测试方法/检查手段 | 有通用叫法，可跨项目复用 |
| **case** | 一条可独立判定、可独立勾选的测试项 | 有明确的通过/不通过判据 |

```js
export const categories = [
  {
    id: 'security',                  // kebab-case，全目录唯一
    name: '安全与合规',
    intro: '一句话说明该域回答什么质量问题',
    when: ['service', 'web'],        // 可选：仅在这些项目类型展开（省略 = 全部）
    methods: [
      {
        id: 'SEC-AUTHN',             // 大写 + 短横线，全目录唯一，用域名做前缀
        name: '认证与会话',
        automation: 'assisted',      // auto | assisted | manual
        priority: 'P0',              // 方法默认优先级，可被 case 覆盖
        standard: ['owasp-asvs'],    // 可选：外部标准/框架映射
        cases: [
          {
            title: '会话在登出后立即失效且不可重放',   // 8–120 字，具体、无编号、无句号
            expect: '登出后旧 Cookie/Token 再访问受保护接口返回 401，服务端会话记录被删除', // 可观测的通过判据
            tier: 'blocker',                        // blocker | core | extended | exhaustive
            // priority / automation / when / tags 可省略，省略则继承
          },
        ],
      },
    ],
  },
]
```

## 3. 字段取值

**depth → tier 映射**（由 `qf_plan` 的 depth 参数决定展开到哪一层）：

| depth | 包含分层 | 使用场景 |
| --- | --- | --- |
| `smoke` | `blocker` | 上线前的阻断级快速过关 |
| `standard` | `blocker` + `core` | 常规交付审计（默认） |
| `deep` | `+ extended` | 重要版本的深度审计 |
| `exhaustive` | `+ exhaustive` | 首次全面审计、合规取证（尽可能穷尽） |

**tier 判定标准**

- `blocker`：不通过则**不可交付**（数据损坏、安全漏洞、核心流程不可用、构建/测试失败）。
- `core`：影响正确性或稳定性，常规交付必须查。
- `extended`：深度审计补充（边界、可观测性、成本、可维护性）。
- `exhaustive`：极限穷尽与合规取证（形式化方法、取证留存、极端场景）。

**automation 判定标准**

- `auto`：`qf_exec` / `qf_probe` 能直接跑出结论（构建、Lint、测试、依赖审计、HTTP 探针）。
- `assisted`：需要 Agent 读代码、比对配置、分析日志后判定（绝大多数代码/设计类检查）。
- `manual`：需要人工、业务方或真实用户确认（可用性、业务规则、合规签署）。

**when 取值**（`lib/catalog/index.js` 的 `KINDS`）：
`library` `cli` `service` `web` `desktop` `mobile` `plugin` `data` `ml` `monorepo`

## 4. 校验

```bash
node scripts/validate-catalog.mjs                        # 校验聚合目录 + 统计
node scripts/validate-catalog.mjs lib/catalog/10-security.js   # 只校验一个文件
node scripts/validate-catalog.mjs --stats                # 只看规模统计
```

校验器会拒绝：

- id 重复、字段缺失、枚举取值非法、`when` 用了未知项目类型；
- 方法少于 3 条用例、测试域少于 3 个方法或少于 10 条用例；
- 方法内没有 `blocker`/`core` 用例（会导致 smoke 深度整域落空）；
- 占位式填充：`待补充`、`TODO`、`符合预期`、`正常工作` 等无法判定的表述；
- 标题重复（同一方法内直接失败，跨方法给出提示）。

## 5. 写作要求

1. **可判定**：`expect` 必须描述"看到什么就能打勾"，不接受"符合预期""表现正常"。
2. **可执行**：标题以动词开头，说明被测对象与动作（"登出后旧令牌不可重放"优于"会话安全"）。
3. **去重**：标题在全目录内应可检索唯一，避免与其它域撞名（撞名会让报告难以引用）。
4. **覆盖方法学**：一个域应覆盖该领域公认的方法，而不是随机罗列检查点。评审时问一句：
   "这一域的资深 QA 会不会指出某个通用方法缺失？"
5. **标准映射要真实**：`standard` 只在确实适用时填写，不要为了好看而堆砌。
6. **语言**：中文描述，专有名词可保留英文（OAuth、SSRF、WCAG 等）。

## 6. 领域清单

| 文件 | 主题 |
| --- | --- |
| `01-build.js` | 工程基座：构建、编译、依赖治理、版本与发布 |
| `02-static.js` | 静态质量：类型、Lint/格式、复杂度与坏味道、代码评审 |
| `03-unit.js` | 单元测试：设计、隔离、覆盖、测试自身质量、变异/属性/模糊测试 |
| `04-integration.js` | 集成与契约：组件集成、外部依赖、契约测试、测试替身 |
| `05-api.js` | 接口层：协议语义、错误模型、分页与幂等、并发与限流 |
| `06-ui.js` | 界面层：交互与状态、可访问性、兼容性、国际化 |
| `07-e2e.js` | 端到端与验收：用户旅程、验收标准、回归、环境与数据 |
| `08-data.js` | 数据层：模式与迁移、一致性、备份恢复、数据质量与隐私 |
| `09-perf.js` | 性能与容量：基准、负载与压力、资源与内存、前端性能预算 |
| `10-security.js` | 安全与合规：认证、授权、注入面、密钥与隐私、供应链 |
| `11-reliability.js` | 可靠性与韧性：容错降级、超时重试、故障注入、状态恢复 |
| `12-ops.js` | 可观测与运维：日志指标追踪、部署发布回滚、容灾演练 |
| `13-process.js` | 工程流程：文档、协作与 CI 门禁、可维护性与技术债 |
| `14-ecosystem.js` | 生态与分发：DSH/Cordis 插件专项、开源就绪度、跨平台分发 |
