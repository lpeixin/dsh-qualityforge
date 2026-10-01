<div align="center">
  <img src="assets/banner.svg" alt="QualityForge — 对已完成开发的项目执行系统性全面测试" width="100%">
</div>

<div align="center">

**简体中文** ｜ [English](README.en.md)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DSH Plugin](https://img.shields.io/badge/DSH-plugin-4d6bfe.svg)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%E2%89%A520.11-5FA04E.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-27%20passed-2DD4BF.svg)](test/)
[![Catalog](https://img.shields.io/badge/catalog-45%20domains%20%C2%B7%201363%20cases-22D3EE.svg)](docs/CATALOG-AUTHORING.md)

</div>

---

**QualityForge 是一个 DeepSeek Harness 插件：对已经开发完成的项目自动执行系统性全面测试，
产出一份「按 P0–P3 标注严重程度、可逐条勾选」的测试报告**——它既是质量结论，也是开发者
与 Harness 协商"修哪些、先修什么"的依据。

它回答四个问题：

| 问题 | QualityForge 的回答 |
| --- | --- |
| 这个项目现在能交付吗？ | 结论摘要给出明确判定：⛔ 不可交付 / ⏳ 审计未完成 / ⚠️ 有条件交付 / ✅ 可交付 |
| 到底还有哪些问题？ | 45 个测试域、290 种测试方法、1363 条可独立判定的测试项，逐条给结论、证据与修复建议 |
| 先修什么？ | 修复波次（Wave 1 阻断级清零 → Wave 2 严重级收敛 → …）+ 可直接交给 Harness 的修复交接单 |
| 修完之后呢？ | 在报告里勾选 → `qf_update sync=true` 回读 → `qf_exec` 复测 → 置为"复测通过"才算关闭 |

---

## 目录

- [它解决什么问题](#它解决什么问题)
- [功能特性](#功能特性)
- [安装](#安装)
- [快速开始](#快速开始)
- [使用说明](#使用说明)
  - [工作流](#工作流)
  - [1. 侦察项目](#1-侦察项目qf_scan)
  - [2. 生成测试项全集](#2-生成测试项全集qf_plan)
  - [3. 执行自动检查](#3-执行自动检查qf_exec--qf_probe)
  - [4. 记录深度分析结论](#4-记录深度分析结论qf_record)
  - [5. 生成报告](#5-生成报告qf_report)
  - [6. 勾选与修复范围协商](#6-勾选与修复范围协商qf_update--qf_fixplan)
- [工具参考](#工具参考)
- [测试覆盖范围](#测试覆盖范围)
- [产物与数据格式](#产物与数据格式)
- [安全边界](#安全边界)
- [常见问题](#常见问题)
- [开发与贡献](#开发与贡献)
- [兼容性](#兼容性)
- [路线图](#路线图)
- [许可证](#许可证)

---

## 它解决什么问题

代码写完了，但"能交付"是个需要证据的结论。现实中的障碍是：

- **不知道测什么**：企业测试方法散落在规范、清单和各人经验里，靠临时拍脑袋必然有盲区；
- **测了没留痕**：跑完一堆命令，结论没有沉淀，过两周没人说得清当时到底验过什么；
- **结论不可协商**：报告写得像判决书，"哪些必修、哪些可以接受风险"没有结构化的表达方式；
- **修复范围说不清**：几十个问题，谁先谁后、这一轮修哪些、怎么确认修好了，全靠开会。

QualityForge 把这件事变成一条可重复的流水线：**侦察 → 生成穷尽测试项 → 自动执行可自动化的 →
Agent 深度分析其余 → 出可勾选报告 → 协商修复范围 → 复测关闭**。
所有中间数据留在被审计项目的 `.qualityforge/` 目录里，报告可随时重新渲染、可进代码评审、可做 diff。

---

## 功能特性

| 特性 | 说明 |
| --- | --- |
| **企业级测试方法目录** | 45 个测试域 / 290 种方法 / 1363 条用例，覆盖构建依赖、静态质量、单元与进阶测试、集成契约、接口层、界面与可访问性、端到端验收、数据、性能容量、安全合规、可靠性韧性、可观测运维、工程流程，以及 DSH 插件专项与开源就绪度 |
| **四档深度** | `smoke` 331 条 / `standard` 984 条 / `deep` 1295 条 / `exhaustive` 1363 条，按 `tier` 分层展开，可按测试域筛选 |
| **项目类型自适应** | 自动识别 library / cli / service / web / desktop / mobile / plugin / data / ml / monorepo，裁掉明显不适用的项（如 CLI 项目的多区域容灾），**裁剪原因如实写进报告**而不是当作通过 |
| **证据驱动** | 侦察结论全部来自磁盘证据；每条缺陷要求证据、复现、影响文件与修复建议 |
| **自动执行与精确回填** | 识别 11 种预设命令（构建/类型检查/Lint/格式/测试/覆盖率/E2E/依赖审计/密钥扫描/安装/过期依赖），结果按「方法 + 标题」精确回填到测试项；工具缺失记为**跳过**而不是失败 |
| **可勾选报告 + 勾选回读** | Markdown 报告每条一行复选框；`qf_update sync=true` 把勾选状态回写为结构化数据（支持 `WONTFIX` / `DEFER` / `NA`） |
| **修复范围协商** | `qf_fixplan` 生成修复波次与交接单，支持全部修复 / 仅 P0-P1 / 指定编号 / 排除编号 |
| **零运行时依赖** | 只用 Node 内置模块，无构建步骤，安装时不执行任何脚本；不会因为宿主包版本或软链方式变化而加载失败 |
| **只读侦察 + 收窄执行面** | 侦察只读；`qf_exec` 只跑预设白名单命令；`qf_probe` 只允许回环地址 |
| **开源工程化** | CI（Node 20/22）、27 项测试、目录契约校验、预设映射校验、编写规范、报告格式说明 |

---

## 安装

### 方式一：会话内安装（推荐）

在 DSH 会话里让 Agent 调用插件管理工具（需要 `danger-full-access` 权限）：

```text
plugin_manager install_bundle target=dsh-qualityforge
plugin_manager install_bundle target=github:lpeixin/dsh-qualityforge
plugin_manager install_bundle target=/绝对路径/dsh-qualityforge
```

### 方式二：命令行

```bash
dsh plugin --profile <profile> add dsh-qualityforge                  # 来自 npm
dsh plugin --profile <profile> add github:lpeixin/dsh-qualityforge   # 来自 GitHub（仓库已提交 lib/，无需构建）
dsh plugin --profile <profile> add /绝对路径/dsh-qualityforge        # 本地开发
```

安装后**重启 DSH**（或新开会话）才会加载插件模块；确认 bundle 层已挂载：

```bash
dsh --profile <profile> --dump-config | grep -A3 qualityforge
```

### 方式三：本地开发（改完即用）

```bash
git clone https://github.com/lpeixin/dsh-qualityforge.git
cd dsh-qualityforge
node --test          # 27 项测试
npm run validate     # 目录契约 + 预设映射校验
```

插件目录本身就是一个可安装的 bundle（`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`），
用方式二指向该目录即可。

### 卸载 / 禁用

```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml —— 保留安装但禁用
- id: qualityforge
  disabled: true
```

```text
plugin_manager remove_bundle target=dsh-qualityforge
```

---

## 快速开始

安装后，直接对当前项目说：

> 对这个项目做一次全面测试审计，用 standard 深度，最后给我一份可以逐条勾选的报告。

Harness 会按下面的顺序工作（你也可以逐步指定深度与范围）：

```text
1. qf_scan      侦察项目：技术栈、类型、可执行命令、已确认的工程缺口
2. qf_plan      生成测试项全集（depth=standard，默认按项目类型裁剪）
3. qf_exec      执行构建 / 类型检查 / Lint / 测试 / 覆盖率 / 依赖审计 / 密钥扫描
   qf_probe     需要时对本地已启动的服务做回环探针
4. qf_record    记录 Agent 的深度分析结论（批量、带证据与复现）
5. qf_report    渲染报告（Markdown + JSON），给出交付判定与修复波次
6. 开发者勾选 → qf_update sync=true → qf_fixplan → 修复 → qf_exec 复测
```

产物（都在被审计项目里，不进插件目录）：

```text
<项目>/.qualityforge/
├── audit.json                 结构化数据（唯一真相来源）
├── QUALITYFORGE-REPORT.md     可逐条勾选的报告
└── report.json                机器可读快照（供 CI 消费）
```

想先看报告长什么样：[报告节选示例](docs/examples/QUALITYFORGE-REPORT.sample.md)
（这是 QualityForge 对**本仓库自身**做 self-audit 的真实报告节选）。

---

## 使用说明

### 工作流

```text
        ┌────────────┐   ┌──────────┐   ┌───────────────┐   ┌────────────┐
项目 ──▶ │  qf_scan   │──▶│ qf_plan  │──▶│ qf_exec/probe │──▶│ qf_record  │
        │  只读侦察  │   │ 测试项全集│   │  自动检查+探针 │   │ 深度分析记录│
        └────────────┘   └──────────┘   └───────────────┘   └─────┬──────┘
                                                                  ▼
   修复 ◀── qf_fixplan ◀── qf_update sync ◀── 开发者勾选 ◀── qf_report（可勾选报告）
```

### 1. 侦察项目（`qf_scan`）

```json
{ "projectPath": "/path/to/project", "force": true }
```

产出**项目画像**：技术栈与包管理器、项目类型、语言分布、可执行的检查命令（每条都带来源，
如 `package.json#scripts.test`）、测试框架、CI/容器/IaC/安全工具配置、文档完备度，
以及**已经能确定的工程缺口**（如"存在依赖清单但没有锁文件""仓库中疑似存在硬编码密钥"）。

> 侦察只读：不写文件、不改配置，唯一的外部进程调用是只读的 `git` 查询。
> 缺口里发现的密钥只记录**位置与类型**，绝不记录密钥取值。

### 2. 生成测试项全集（`qf_plan`）

```json
{ "depth": "standard", "categories": ["sec-input", "api-semantics"], "includeAll": false }
```

| depth | 展开条数 | 适用场景 |
| --- | ---: | --- |
| `smoke` | 331 | 上线前的阻断级清单（只看"不通过就不可交付"的项） |
| `standard` | 984 | 常规交付审计（**默认**） |
| `deep` | 1295 | 重要版本的深度审计 |
| `exhaustive` | 1363 | 首次全面审计、合规取证——尽可能穷尽 |

- 每条测试项有稳定编号（`QF-001`）、优先级（P0–P3）、严重度、判定方式（自动/Agent 分析/人工确认）与**通过判据**。
- 重复调用是安全的：既有测试项保留状态与历史，只补新项；只有 `reset=true` 才清空重建。
- 被项目类型裁掉的项会写进报告第 6 节，并注明原因。

### 3. 执行自动检查（`qf_exec` / `qf_probe`）

```json
{ "presets": ["build", "typecheck", "lint", "test", "coverage", "audit", "secrets"], "timeoutMs": 600000 }
```

```json
{ "urls": ["http://127.0.0.1:3000/health"], "expectStatus": 200, "itemId": "QF-512" }
```

- `qf_exec` 只运行侦察识别出的**预设命令**（spawn，不经 shell），不接受任意命令字符串；
  `install` 默认不执行，因为它会改动工程目录。需要自定义命令请用 `bash` 工具，再用 `qf_record` 记结论。
- 结果自动回填到对应测试项；工具没装 → `skipped` 且测试项保持"待测"（不会被误判成缺陷）。
- `qf_probe` 只允许回环地址（localhost / 127.0.0.1 / ::1）的 http(s)、GET/HEAD、响应体截断。

### 4. 记录深度分析结论（`qf_record`）

审计的主体工作量在这里：读代码、比对配置、分析日志、构造用例，然后**批量**记录。

```json
{
  "items": [
    {
      "id": "QF-142",
      "status": "fail",
      "actual": "ORDER BY 参数直接拼接进 SQL：src/api/orders.ts:88 使用 `ORDER BY ${sort}`",
      "recommendation": "改为字段白名单映射，非法字段返回 400",
      "files": ["src/api/orders.ts:88"],
      "repro": ["GET /api/orders?sort=id;DROP TABLE users--", "观察 SQL 日志中的拼接结果"],
      "evidence": ["SQL 日志：SELECT * FROM orders ORDER BY id;DROP TABLE users--"],
      "cwe": ["CWE-89"],
      "owasp": ["A03:2021-Injection"],
      "effort": "S"
    },
    {
      "method": "AGENT-CACHE",
      "title": "自定义检查：缓存键未包含租户维度",
      "priority": "P1",
      "status": "fail",
      "actual": "cache key = `user:${id}`，跨租户同 id 用户会命中他人数据",
      "evidence": ["src/cache/keys.ts:21"]
    }
  ]
}
```

判定纪律（写进报告就会成为别人的工作依据）：

| 情况 | 应该记的状态 |
| --- | --- |
| 确认有问题 | `fail`（并给复现） |
| 确认没问题 | `pass`（并给证据） |
| 环境/依赖缺失、无法判定 | `blocked`（写明缺什么）——**不要记成 fail** |
| 该项目不存在这一面 | `na`（写明理由） |
| 已确认接受风险 | `wontfix` |

### 5. 生成报告（`qf_report`）

```json
{ "reportPath": ".qualityforge/QUALITYFORGE-REPORT.md", "waveScope": "defects", "writeJson": true }
```

报告结构（详见 [报告格式说明](docs/REPORT-FORMAT.md)）：

| 章节 | 内容 |
| --- | --- |
| 0 使用说明 | 怎么勾选、怎么把报告发回 Harness |
| 1 结论摘要 | 交付判定 + 关键计数 + 通过率 |
| 2 优先级与严重度分布 | P0–P3 分布、按测试域分布 |
| 3 修复波次 | Wave 1 阻断级清零 → Wave 2 严重级收敛 → … |
| 4 问题清单 | **每条缺陷一行复选框**：期望 / 实测 / 证据 / 复现 / 建议 / 位置 / 工作量 |
| 5 全部测试项核对表 | 按测试域 → 方法分组的全量清单（含通过项），证明覆盖度 |
| 6 未展开 / 不适用项 | 被裁剪的项与原因 |
| 7 自动检查执行记录 | 命令、退出码、耗时、失败输出尾部、探针结果 |
| 8 项目画像 | 侦察结论与已确认的工程缺口 |
| 9 复测与签署 | 修复确认 / 复测确认 / 发布批准 |

问题清单里的一条长这样（格式示意）：

```markdown
- [ ] **QF-142** · `SEC-INPUT-INJECTION` 排序参数只接受白名单字段
  - 优先级：**P0/critical**（阻断级 Blocker）｜状态：未通过｜判定方式：Agent 分析｜工作量：S
  - 期望：传入非白名单排序字段时返回 400，且数据库未执行任何拼接后的语句
  - 实测：`ORDER BY ${sort}` 直接拼接，注入 `id;DROP TABLE users--` 后 SQL 日志出现完整语句
  - 复现：1) GET /api/orders?sort=id;DROP TABLE users-- 2) 查看 SQL 日志中的拼接结果
  - 建议：改为字段白名单映射，非法字段返回 400 并记录安全日志
  - 位置：`src/api/orders.ts:88`
  - 证据：
    - `note` — SQL 日志：SELECT * FROM orders ORDER BY id;DROP TABLE users--
  - 标签：CWE-89、A03:2021-Injection
```

### 6. 勾选与修复范围协商（`qf_update` / `qf_fixplan`）

**开发者侧**：打开 `QUALITYFORGE-REPORT.md`，把已处理的行改成 `- [x]`；
接受风险写 `` - [x] `WONTFIX` ``，延后写 `` `DEFER` ``，不适用写 `` `NA` ``。

**Harness 侧**：

```json
{ "sync": true }
```

| 报告中的写法 | 回写后的状态 | 含义 |
| --- | --- | --- |
| `- [x]`（原为未通过/阻塞） | 已修复待复测 `fixed` | 声明修好了，等待复测 |
| `- [x]`（原为待测） | 通过 `pass` | 人工确认通过 |
| `- [x] WONTFIX` / `DEFER` / `NA` | 接受风险 / 延后 / 不适用 | 明确取舍 |
| 取消勾选已关闭项 | 重新打开 `pending` | 复测发现问题 |

**范围协商**（这就是"全部修复 / 部分修复"的落地方式）：

```json
{ "scope": "p0-p1", "format": "both", "writeFile": true }
```

| scope | 范围 | 典型说法 |
| --- | --- | --- |
| `all` | 全部未关闭项 | "全部修复" |
| `p0` | 仅 P0 阻断级 | "先让项目能发布" |
| `p0-p1` | P0 + P1 | "修最小可交付范围" |
| `defects` | 全部未通过/阻塞（默认） | "把缺陷都修了" |
| `pending` | 仅待测项 | "先把没测的测完" |
| `ids` + `excludeIds` | 指定 / 排除编号 | "除了 QF-003 之外全修" |

输出是一份可直接交给 Harness 执行的**修复交接单**（含每条问题的期望、实测、位置、建议，
以及修复约束：不改范围外代码、必须可验证、完成后回写勾选状态）。

---

## 工具参考

| 工具 | 作用 | 主要参数 |
| --- | --- | --- |
| `qf_scan` | 侦察项目，生成画像与已确认缺口 | `projectPath`、`force` |
| `qf_plan` | 生成测试项全集（可筛选测试域与深度） | `depth`、`categories`、`includeAll`、`withRecon`、`reset` |
| `qf_exec` | 执行预设检查命令并回填结论 | `presets`、`timeoutMs`、`maxOutputBytes`、`autoRecord`、`recordPass` |
| `qf_probe` | 回环 HTTP 探针（健康检查/关键路由） | `urls`、`method`、`expectStatus`、`expectBodyContains`、`itemId` |
| `qf_record` | 记录/更新测试项结论（批量） | `items[]`（状态、实测、证据、复现、建议、工作量…）、`createMissing` |
| `qf_list` | 查询与筛选测试项 | `priorities`、`statuses`、`category`、`method`、`search`、`onlyOpen`、`detail`、`limit`、`offset` |
| `qf_update` | 更新状态 / 回读报告勾选 | `ids`+`status`，或 `sync=true`（`syncPath`、`checkedStatus`、`reopenStatus`） |
| `qf_report` | 渲染 Markdown + JSON 报告 | `reportPath`、`waveScope`、`includePassedDetail`、`writeJson` |
| `qf_fixplan` | 修复波次与交接单 | `scope`、`ids`、`excludeIds`、`maxPerWave`、`notes`、`format`、`writeFile` |
| `qf_reset` | 清除审计数据（慎用） | `projectPath`、`confirm=true` |

此外，插件会注册一个名为 **`qualityforge-audit`** 的方法论技能：说明工作流、判定纪律与反模式，
可由模型或用户直接调用。技能正文位于 `lib/SKILL.md`，安装后可直接编辑而无需改代码。

---

## 测试覆盖范围

45 个测试域 / 290 种测试方法 / 1363 条用例（条数由 `npm run catalog:stats` 实时校验）：

| 测试域 | 名称 | 方法 | 用例 | 适用项目类型 |
| --- | --- | ---: | ---: | --- |
| `build` | 构建与编译 | 5 | 19 | 全部 |
| `deps` | 依赖治理 | 4 | 13 | 全部 |
| `release` | 版本与发布 | 4 | 13 | 全部 |
| `static-analysis` | 类型系统与静态检查 | 5 | 26 | 全部 |
| `lint-format` | 代码规范与格式 | 4 | 21 | 全部 |
| `code-quality` | 复杂度与可维护性静态面 | 6 | 28 | 全部 |
| `unit-test` | 单元测试设计与覆盖 | 8 | 40 | 全部 |
| `test-isolation` | 测试隔离与稳定性 | 6 | 27 | 全部 |
| `advanced-testing` | 进阶测试技术（变异/属性/模糊） | 6 | 30 | 全部 |
| `integration` | 组件集成 | 6 | 36 | 全部 |
| `contract` | 契约与兼容 | 5 | 30 | 全部 |
| `test-double` | 测试替身与环境 | 5 | 30 | 全部 |
| `api-semantics` | 协议与语义 | 7 | 42 | service, web, mobile, desktop |
| `api-errors` | 错误模型与韧性 | 6 | 36 | service, web, mobile, desktop |
| `api-evolution` | 接口演进与文档 | 5 | 30 | service, web, mobile, desktop |
| `ui-interaction` | 交互与状态 | 7 | 32 | web, desktop, mobile |
| `ui-a11y` | 可访问性（WCAG 2.2 AA） | 7 | 27 | web, desktop, mobile |
| `ui-compat` | 兼容性与响应式 | 6 | 21 | web, desktop, mobile |
| `ui-i18n` | 国际化与本地化 | 6 | 25 | web, desktop, mobile |
| `e2e-journey` | 关键用户旅程 | 6 | 25 | 全部 |
| `acceptance` | 验收与需求符合性 | 6 | 22 | 全部 |
| `regression` | 回归与发布验证 | 6 | 24 | 全部 |
| `data-schema` | 模式与迁移 | 6 | 28 | 全部 |
| `data-integrity` | 一致性与恢复 | 6 | 28 | 全部 |
| `data-quality` | 数据质量与合规 | 6 | 29 | 全部 |
| `performance` | 性能基准 | 7 | 32 | 全部 |
| `scalability` | 容量与压力 | 6 | 24 | 全部 |
| `efficiency` | 资源效率与前端性能 | 6 | 23 | 全部 |
| `sec-authn` | 认证与会话 | 8 | 46 | 全部 |
| `sec-authz` | 授权与越权 | 7 | 39 | 全部 |
| `sec-input` | 输入与注入（SQL/XSS/SSRF/上传…） | 11 | 55 | 全部 |
| `sec-data` | 数据与隐私 | 8 | 39 | 全部 |
| `sec-supply` | 供应链与漏洞响应 | 7 | 34 | 全部 |
| `fault-tolerance` | 容错与降级 | 7 | 42 | 全部 |
| `resilience-testing` | 故障注入与演练 | 6 | 30 | 全部 |
| `recovery` | 状态恢复与数据安全 | 6 | 31 | 全部 |
| `observability` | 可观测性 | 7 | 37 | 除 library 外 |
| `deployment` | 部署与发布 | 7 | 37 | 全部 |
| `continuity` | 容灾与容量运维 | 7 | 39 | service, web, data, ml 等 |
| `docs` | 文档与知识传递 | 7 | 26 | 全部 |
| `workflow` | 协作与研发流程 | 7 | 27 | 全部 |
| `maintainability` | 可维护性与技术债 | 7 | 24 | 全部 |
| `dsh-plugin` | **DSH / Cordis 插件专项** | 8 | 37 | plugin |
| `oss-ready` | 开源就绪度 | 9 | 30 | 全部 |
| `distribution` | 跨平台分发与安装 | 8 | 29 | library, cli, desktop, plugin |
| **合计** | **45 个测试域** | **290** | **1363** | |

覆盖的方法学映射到真实标准：ISO/IEC 25010、ISTQB、ISO/IEC/IEEE 29119、OWASP ASVS / Top 10、
CWE Top 25、WCAG 2.2 AA、NIST SSDF、SLSA、Twelve-Factor、SRE Golden Signals、ITIL、SemVer、
Keep a Changelog、OpenSSF Scorecard、GDPR / PCI-DSS 等（只在确实适用处标注）。

---

## 产物与数据格式

| 文件 | 用途 |
| --- | --- |
| `.qualityforge/audit.json` | 唯一真相来源：项目画像、测试项、执行记录、探针结果、裁剪项与全部历史 |
| `.qualityforge/QUALITYFORGE-REPORT.md` | 人类可读、可逐条勾选的报告（由 `audit.json` 确定性渲染，可安全 diff） |
| `.qualityforge/report.json` | 机器可读快照（判定、缺陷清单、波次、计数），供 CI 门禁与看板消费 |

在 CI 里做发布门禁的最小示例：

```bash
# 失败条件：存在 P0 阻断级缺陷，或审计未完成
node -e "
const r = require('./.qualityforge/report.json');
if (r.summary.p0Open > 0) { console.error('存在 P0 阻断级缺陷', r.summary.p0Open); process.exit(1); }
if (r.summary.verdict === 'incomplete') { console.error('审计未完成，待测', r.summary.pending); process.exit(1); }
console.log('质量门禁通过：', r.summary.verdictLabel);
"
```

默认 `.qualityforge/` 已被 `.gitignore` 忽略（审计是逐机证据，不建议入库）；
若团队把"已签署的 QA 报告"当发布物，可只放开报告文件。

---

## 安全边界

插件运行在 DSH 宿主进程内、不受工作区沙箱约束，因此这些边界是刻意收窄的（详见 [SECURITY.md](SECURITY.md)）：

| 能力 | 边界 |
| --- | --- |
| 文件系统 | 只读侦察被审计项目；写入仅限该项目的 `.qualityforge/` 目录 |
| 命令执行 | 只运行侦察识别出的预设命令，`spawn` 不经 shell，不接受任意命令字符串；`install` 默认不执行 |
| 网络 | 仅回环地址（localhost / 127.0.0.1 / ::1）的 http(s)，GET/HEAD，响应体截断 |
| 凭据 | 不读取、不存储凭据；密钥扫描只记录位置与类型，**不记录密钥取值** |
| 会话 | 不写入自定义会话事件（避免污染会话日志） |
| 依赖 | 不 import 任何外部包，安装时不执行构建脚本 |

报告里给出的复现步骤只包含**无害探针**（回显随机数、延时、报错），不包含破坏性利用；
`qf_reset` 需要显式 `confirm=true` 才会删除审计数据。

---

## 常见问题

<details>
<summary><b>和「直接让 Agent 读代码做个 code review」有什么区别？</b></summary>

Code review 依赖模型的临场发挥，覆盖度不可复现、不可比较。QualityForge 的测试项来自显式目录：
同一项目、同一深度，两次审计得到同一批编号，因此可以回答"上次通过的那 300 条这次还是不是通过"。
报告也可 diff，适合作为发布门禁。
</details>

<details>
<summary><b>1363 条会不会太多，跑不完？</b></summary>

按需选深度：`smoke` 331 条（阻断级清单）、`standard` 984 条（默认）、`exhaustive` 1363 条。
也可以用 `categories` 只跑关心的域；默认会按项目类型裁剪；很多项由 `qf_exec` 批量判定，
不需要逐条人工分析。
</details>

<details>
<summary><b>它会不会改我的项目、装依赖、跑危险命令？</b></summary>

不会。侦察只读；`qf_exec` 只跑识别出的预设命令且 `install` 默认不执行；
`qf_probe` 只允许本机回环地址；所有写入都在 `.qualityforge/` 目录内。
需要自定义命令时，是你（或 Agent）显式用 `bash` 工具执行。
</details>

<details>
<summary><b>「工具没装」会不会被算成项目的问题？</b></summary>

不会。命令不存在或工具缺失记为 `skipped`，对应测试项保持"待测"并写明原因；
只有"跑失败说明项目本身有问题"的情况才会判为 `fail`。
</details>

<details>
<summary><b>为什么有的测试项被裁掉了？会不会掩盖问题？</b></summary>

裁剪只发生在"该项目类型不存在这一面"时（例如 CLI 项目没有多区域容灾），
被裁项会连同原因列在报告第 6 节。想强行展开用 `qf_plan includeAll=true`。
</details>

<details>
<summary><b>勾选之后状态怎么变？会不会把「修了」当成「验证过」？</b></summary>

勾选只把缺陷置为**已修复待复测**；只有复测通过才会置为**复测通过**。
"修复"与"验证"在数据模型里是两个状态，报告里也分开统计。
</details>

<details>
<summary><b>能只修一部分问题吗？</b></summary>

可以，这正是 `scope` 的用途：`p0` / `p0-p1` / `defects` / `pending` / `ids` + `excludeIds`。
例如「除了 QF-003、QF-017 之外全部修复」= `scope=defects` + `excludeIds=["QF-003","QF-017"]`。
剩余范围用 `qf_list onlyOpen=true` 随时可查。
</details>

<details>
<summary><b>报告是中文的，能出英文吗？</b></summary>

当前版本的报告与目录均为中文；英文报告在路线图中（`qf_report lang=en`）。
工具描述与技能正文是中文，但编号与字段名是语言中立的，便于脚本消费。
</details>

<details>
<summary><b>支持哪些语言 / 技术栈的项目？</b></summary>

侦察识别 Node、Python、Go、Rust、Java(Maven/Gradle)、Ruby、PHP、.NET、CMake 等清单与命令，
并据此推断项目类型与预设命令。目录本身与语言无关，其他技术栈仍可用（只是需要更多 `qf_record` 人工判定）。
</details>

<details>
<summary><b>怎么参与贡献，或者补充我所在行业的测试项？</b></summary>

见 [CONTRIBUTING.md](CONTRIBUTING.md) 与[目录编写规范](docs/CATALOG-AUTHORING.md)。
补充一个真实、可独立判定的测试项，比新增一个工具更有价值。
</details>

---

## 开发与贡献

```bash
git clone https://github.com/lpeixin/dsh-qualityforge.git
cd dsh-qualityforge

node --test                              # 27 项测试（目录 + 侦察 + 端到端）
node --test --experimental-test-coverage
npm run validate                         # 目录契约 + 预设映射校验
npm run catalog:stats                    # 目录规模与各深度展开条数
```

**零依赖、无构建步骤**：插件只使用 Node 内置模块，clone 下来即可运行与测试。

```text
lib/
├── index.js            插件入口：name / inject / apply（命名导出，无 default）
├── tools.js            10 个工具的 ToolDefinition（原始 JSON Schema）
├── catalog/            测试方法目录：45 个测试域（纯数据）
├── scan.js             只读项目侦察
├── exec.js             预设命令执行 + 回环探针 + 预设→测试项映射
├── store.js            .qualityforge/ 持久化（原子写入）
├── report.js           报告渲染 + 勾选回读
├── fixplan.js          修复波次与交接单
└── skill.js + SKILL.md 方法论技能
scripts/                目录校验、预设映射校验
test/                   node:test 测试
docs/                   目录编写规范、报告格式说明、报告示例
```

三条硬约束（改动前请先读 [CONTRIBUTING.md](CONTRIBUTING.md)）：

1. **没有外部 import** —— 安装时无需解析依赖，也不会因宿主包版本/软链方式变化而加载失败；
2. **命名导出、禁止 `export default`** —— 否则 Loader 的 `unwrapExports` 会丢掉 `inject`；
3. **不改被审计项目、不写自定义会话事件** —— 侦察只读，执行面收窄，避免污染宿主会话。

---

## 兼容性

| 项目 | 要求 |
| --- | --- |
| DSH | 支持 Cordis 插件与 bundle patch 的版本（`dsh.bundle.patch` 契约） |
| Node.js | ≥ 20.11（开发与 CI 验证 20.x / 22.x） |
| 平台 | macOS / Linux / Windows（仅使用 Node 内置能力与 `spawn`，无原生依赖） |
| 安装体积 | npm 包约 215 KB（压缩）／约 726 KB（解包），不含被审计项目的审计产物 |

插件**不 import** `@deepseek-ai/*` 或任何第三方包，因此对宿主包版本不敏感；
如果某个组合缺少 `skills` 服务，插件会自动跳过技能注册而工具仍然可用。

---

## 路线图

- `qf_diff`：对比两次审计，输出"新引入 / 已修复 / 仍存在"三类差异，用于发布前回归；
- 覆盖率数字解析：从 lcov / coverage.py 输出读取真实覆盖率并写入对应测试项；
- 英文报告与英文目录（`lang=en`）；
- 行业专项目录扩展：金融对账、医疗数据合规、IoT 固件升级等；
- 报告导出 SARIF / JUnit XML，便于接入既有质量平台。

---

## 许可证

[MIT](LICENSE) © 2026 Peixin

<div align="center">
  <sub>QualityForge 是 <a href="https://github.com/topics/dsh-plugin">DSH 插件生态</a>的一部分 · 用它验证别人，也用它验证自己</sub>
</div>
