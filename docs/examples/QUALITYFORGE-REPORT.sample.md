<!--
  这是 QualityForge 对**本仓库自身**执行 self-audit 的真实报告节选。
  完整报告由 `qf_report` 生成，位于 <项目>/.qualityforge/QUALITYFORGE-REPORT.md。
  本次自审参数：depth=standard（702 条测试项），完整文件 1608 行。
  为便于阅读，这里省略了第 5 节的大部分测试域与第 6 节的大部分裁剪项，
  省略处用 "…（已省略）" 标注；报告中的编号（QF-xxx）与状态均为该次审计的真实数据。
  注意：为不泄露审计者的本机目录结构，报告头部的项目绝对路径已替换为占位路径；
  提交号同样替换为占位符（每次提交后真实提交号都会变化，写死会立刻过期）。
-->

# QualityForge 测试报告 · dsh-qualityforge

> 项目路径：`/path/to/dsh-qualityforge`  
> 提交：`<commit-sha>`（main，工作区有未提交改动）  
> 审计深度：`standard`｜测试项：702 条｜生成时间：2026-10-01T02:37:36.416Z  
> 结构化数据：`.qualityforge/audit.json`（唯一真相来源，报告可随时重新渲染）

## 0. 怎么用这份报告（勾选 → 交给 Harness）

1. 读第 4 节「问题清单」，每条缺陷一行复选框；第 5 节是全部测试项的核对表（含通过项）。
2. 修完一条就把 `- [ ]` 改成 `- [x]`。决定接受风险时写 `- [x] `WONTFIX``，延后写 `- [x] `DEFER``，不适用写 `- [x] `NA``。
3. 把报告发回 Harness，按范围沟通修复，例如：
   - 「修复全部未勾选项」
   - 「只修 P0 和 P1」
   - 「先修 Wave 1，然后复测」
   - 「除了 QF-003、QF-017 之外全部修复」
4. Harness 用 `qf_update sync=true` 读回勾选状态，再用 `qf_fixplan` 生成修复波次与复测清单。

> 勾选只表达"处理完成"，修复本身仍需复测：`- [x]` 会把缺陷置为**已修复待复测**，复测通过后由 Harness 置为**复测通过**。

## 1. 结论摘要

**判定：⏳ 审计未完成（仍有大量待测项）**

| 指标 | 值 |
| --- | --- |
| 测试项总数 | 702 |
| 未通过（缺陷） | 0 |
| 其中 P0 阻断 / P1 严重 | 0 / 0 |
| 待测试 | 698 |
| 通过 / 复测通过 | 2 / 0 |
| 已修复待复测 | 0 |
| 接受风险 / 延后 / 不适用 | 2 / 0 / 0 |
| 一句话通过率 | 0.3%（分母为适用项 702） |
| 自动检查执行 | 2 条命令，其中失败 0 条 |
| 本地探针 | 0 次 |
| 侦察发现缺口 | 3 项 |

> ⏳ 仍有 698 条未判定（占 99%），当前结论不足以支撑发布决策。

## 2. 优先级与严重度分布

| 优先级 | 严重度 | 总数 | 未通过 | 待测 | 通过 | 接受风险 | 未关闭合计 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0 · 阻断级 Blocker | 致命 | 441 | 0 | 440 | 1 | 0 | 440 |
| P1 · 严重级 Critical | 高 | 208 | 0 | 207 | 1 | 0 | 207 |
| P2 · 一般级 Major | 中 | 53 | 0 | 51 | 0 | 2 | 51 |

严重度含义：致命=critical、高=high、中=medium、低=low、提示=info

<details><summary>按测试域分布</summary>

| 测试域 | 测试项 |
| --- | --- |
| 输入与注入 | 36 |
| 认证与会话 | 33 |
| 数据与隐私 | 31 |
| 单元测试设计与覆盖 | 28 |
| DSH 插件专项 | 27 |
| 供应链与漏洞响应 | 25 |
| 可观测性 | 24 |
| 状态恢复与数据安全 | 24 |
| 数据质量与合规 | 22 |
| 测试隔离与稳定性 | 22 |
| 跨平台分发与安装 | 21 |
| 容错与降级 | 21 |
| 性能基准 | 21 |
| 授权与越权 | 21 |
| 契约与兼容 | 20 |
| 回归与发布验证 | 20 |
| 开源就绪度 | 19 |
| 协作与研发流程 | 19 |
| 验收与需求符合性 | 18 |
| 一致性与恢复 | 18 |
| 模式与迁移 | 17 |
| 文档与知识传递 | 17 |
| 类型系统与静态检查 | 17 |
| 进阶测试技术 | 17 |
| 关键用户旅程 | 16 |
| 测试替身与环境 | 16 |
| 部署与发布 | 15 |
| 复杂度与可维护性静态面 | 15 |
| 可维护性与技术债 | 15 |
| 组件集成 | 13 |
| 容量与压力 | 13 |
| 代码规范与格式 | 12 |
| 构建与编译 | 11 |
| 故障注入与演练 | 11 |
| 资源效率与前端性能 | 9 |
| 依赖治理 | 8 |
| 版本与发布 | 7 |
| 侦察发现（工程缺口） | 3 |

</details>


…（第 4 节「问题清单」此处为空：该次自审未发现未关闭缺陷。缺陷条目格式见 README 的格式示意）

## 5. 全部测试项核对表

> 与第 4 节共用同一批编号；勾选任意一处都会被 `qf_update sync=true` 读回。

### 5.1 验收与需求符合性（`acceptance`）

**ACC-BOUNDARY · 边界业务规则**

- [ ] **QF-209** [P0/critical] 业务数值边界在上下限与越界值各验证一次 — 待测试
- [ ] **QF-210** [P0/critical] 状态机的非法流转被明确拒绝 — 待测试
- [ ] **QF-211** [P0/critical] 组合业务规则冲突有确定且可复现的结论 — 待测试
- [ ] **QF-212** [P0/critical] 金额与数量取整规则符合业务与财务口径 — 待测试

**ACC-REQ · 需求与用户故事逐条验收**

- [ ] **QF-203** [P0/critical] 需求条目与测试项双向可追溯 — 待测试
- [ ] **QF-204** [P0/critical] 每条验收标准都有对应的验证证据 — 待测试
- [ ] **QF-205** [P0/critical] 需求变更与未实现项有结论与批准 — 待测试

**ACC-SIGNOFF · 业务方签收**

- [ ] **QF-213** [P0/critical] 业务方在验收环境亲自实操关键场景 — 待测试
- [ ] **QF-214** [P0/critical] 签收结论与遗留问题清单一致 — 待测试
- [ ] **QF-215** [P0/critical] 准入标准满足后才允许签收 — 待测试

**ACC-TESTABLE · 验收标准可测性**

- [ ] **QF-206** [P0/critical] 验收标准包含量化阈值与判定条件 — 待测试
- [ ] **QF-207** [P0/critical] 模糊表述在使用前被澄清为可测条件 — 待测试
- [ ] **QF-208** [P0/critical] 验收标准具备前置条件操作与预期三要素 — 待测试

**ACC-DESIGN · 与原型和设计稿一致性**

- [ ] **QF-216** [P1/high] 关键页面与设计稿逐项比对一致 — 待测试
- [ ] **QF-217** [P1/high] 设计变更已同步到已实现页面 — 待测试

**ACC-METRICS · 埋点与业务指标**

- [ ] **QF-218** [P1/high] 埋点事件与属性符合埋点文档 — 待测试
- [ ] **QF-219** [P1/high] 关键旅程的埋点触发次数与顺序正确 — 待测试
- [ ] **QF-220** [P1/high] 埋点取值正确且单位统一 — 待测试

…（第 5 节其余测试域、约 1300 行核对表已省略）

### 5.11 DSH 插件专项（`dsh-plugin`）

**DSH-EXPORTS · 导出形态与加载纯净性**

- [ ] **QF-640** [P0/critical] 以命名导出提供插件契约且没有默认导出 — 待测试
- [ ] **QF-641** [P0/critical] 重复加载不会产生重复注册 — 待测试
- [ ] **QF-642** [P0/critical] 模块导入阶段不产生副作用 — 待测试

**DSH-LIFECYCLE · 生命周期与卸载清理**

- [ ] **QF-647** [P0/critical] 应用函数返回清理函数并释放全部注册 — 待测试
- [ ] **QF-648** [P0/critical] 注册类接口的返回值均被收集为清理函数 — 待测试
- [ ] **QF-649** [P0/critical] 卸载释放非注册类资源 — 待测试

**DSH-MANIFEST · 包元数据与 bundle 声明**

- [ ] **QF-633** [P0/critical] 清单声明 dsh.bundle.patch 且指向存在的补丁文件 — 待测试
- [ ] **QF-634** [P0/critical] 补丁文件与入口目录被包含在发布清单中 — 待测试
- [ ] **QF-635** [P0/critical] 入口与导出指向实际存在的文件 — 待测试
- [ ] **QF-636** [P0/critical] 宿主侧依赖声明为同伴依赖而非直接依赖 — 待测试

**DSH-PATCHROW · 补丁插入行与可覆盖性**

- [ ] **QF-637** [P0/critical] 补丁文件为顶层数组且插入行同时给出 id 与包名 — 待测试
- [ ] **QF-638** [P0/critical] 插入行可被用户层按 id 覆盖或禁用 — 待测试
- [ ] **QF-639** [P0/critical] 行 id 与插件诊断名一致且不与他人冲突 — 待测试

**DSH-SIDEEFFECT · 权限与副作用边界**

- [ ] **QF-656** [P0/critical] 插件不写入宿主未开放的自定义会话事件 — 待测试
- [ ] **QF-657** [P0/critical] 文件写入限制在允许范围内 — 待测试
- [ ] **QF-658** [P0/critical] 不篡改宿主与其它插件的全局状态 — 待测试
- [ ] **QF-659** [P0/critical] 敏感信息不进入日志与磁盘 — 待测试

**DSH-TOOLSCHEMA · 工具 schema 与宿主校验契约**

- [ ] **QF-643** [P0/critical] 每个工具声明名称、用途、参数与输出 schema — 待测试
- [ ] **QF-644** [P0/critical] 返回值满足输出 schema 且为无损 JSON — 待测试
- [ ] **QF-645** [P0/critical] 自由形态对象不关闭额外字段 — 待测试
- [ ] **QF-646** [P0/critical] 参数 schema 未强制的约束在工具内部自校验 — 待测试

**DSH-COMPAT · 宿主服务兼容与降级**

- [ ] **QF-650** [P1/high] 硬依赖服务写入依赖声明且不越权访问 — 待测试
- [ ] **QF-651** [P1/high] 可选服务缺失时优雅降级 — 待测试
- [ ] **QF-652** [P1/high] 宿主版本范围逐条列出已验证的主机线 — 待测试

**DSH-INSTALL · 安装升级卸载流程**

- [ ] **QF-653** [P1/high] 文档给出可复制的安装与卸载命令 — 待测试
- [ ] **QF-654** [P1/high] 不同安装来源的差异被说明 — 待测试

### 5.18 开源就绪度（`oss-ready`）

**OSS-LICENSE · 许可证与版权归属**

- [ ] **QF-660** [P0/critical] 许可证正文为标准文本且被仓库与包元数据引用 — 待测试
- [ ] **QF-661** [P0/critical] 版权行与权利人信息真实完整 — 待测试
- [ ] **QF-662** [P0/critical] 依赖许可证与本项目许可证兼容 — 待测试

**OSS-POLICY · 协作与安全政策**

- [ ] **QF-665** [P0/critical] 贡献指南覆盖环境搭建、测试与提交流程 — 待测试
- [ ] **QF-666** [P0/critical] 存在行为准则与可用举报渠道 — 待测试
- [ ] **QF-667** [P0/critical] 安全政策给出私密报告渠道与响应时限 — 待测试

**OSS-CHANGELOG · 变更记录与发布说明**

- [ ] **QF-670** [P1/high] 变更记录采用通行结构并保留未发布段 — 待测试
- [ ] **QF-671** [P1/high] 每个发布版本都有对应说明 — 待测试

**OSS-README · 门面与展示素材**

- [ ] **QF-663** [P1/high] 首屏给出定位、安装命令与状态徽章 — 待测试
- [ ] **QF-664** [P1/high] 展示素材反映当前版本的真实形态 — 待测试

**OSS-VERSION-MATRIX · 支持范围与兼容矩阵**

- [ ] **QF-672** [P1/high] 声明支持的运行时与平台最低版本 — 待测试
- [ ] **QF-673** [P1/high] 存在支持周期与停止支持策略 — 待测试

**OSS-COMMUNITY · 社区响应与维护承诺**

- [ ] **QF-677** [P2/medium] 公开承诺响应时限并被历史数据支持 — 待测试
- [ ] **QF-678** [P2/medium] 近期问题都有结论 — 待测试

**OSS-HEALTH · 开源健康度自评**

- [ ] **QF-675** [P2/medium] 分支保护与必需评审处于启用状态 — 待测试
- [ ] **QF-676** [P2/medium] 发布物来源可验证 — 待测试

**OSS-I18N · 多语言文档同步**

- [ ] **QF-674** [P2/medium] 翻译文档与主文档内容同步 — 待测试

**OSS-TEMPLATES · 模板与标签体系**

- [ ] **QF-668** [P2/medium] 缺陷模板要求可复现所需的全部字段 — 待测试
- [ ] **QF-669** [P2/medium] 合并请求模板要求变更说明与验证证据 — 待测试


## 6. 未展开 / 不适用的测试项

本次按项目类型裁剪了 43 项（不是"通过"，而是"不适用于当前项目"）。如需强制展开，可用 `qf_plan includeAll=true`。

| 测试域 | 方法 | 测试项 | 裁剪原因 |
| --- | --- | --- | --- |
| integration | INT-DB | 数据库集成（方法不适用） | 项目类型不含 service/web/desktop/mobile/data/ml/monorepo |
| integration | INT-MQ | 消息队列与事件（方法不适用） | 项目类型不含 service/data/monorepo |
| integration | INT-CACHE | 缓存集成（方法不适用） | 项目类型不含 service/web/desktop/mobile/data/monorepo |
| test-double | DOUBLE-SEED | 数据种子与清理（方法不适用） | 项目类型不含 service/web/desktop/mobile/data/monorepo |
| api-semantics | - | 协议与语义（整域不适用） | 项目类型不含 service/web/mobile/desktop |
| api-errors | - | 错误模型与韧性（整域不适用） | 项目类型不含 service/web/mobile/desktop |
| api-evolution | - | 接口演进与文档（整域不适用） | 项目类型不含 service/web/mobile/desktop |
| ui-interaction | - | 交互与状态（整域不适用） | 项目类型不含 web/desktop/mobile |
| ui-a11y | - | 可访问性（整域不适用） | 项目类型不含 web/desktop/mobile |
| ui-compat | - | 兼容性与响应式（整域不适用） | 项目类型不含 web/desktop/mobile |
| ui-i18n | - | 国际化与本地化（整域不适用） | 项目类型不含 web/desktop/mobile |
| e2e-journey | E2E-PAY | 支付与结算敏感流程（方法不适用） | 项目类型不含 web/mobile/desktop |
| data-schema | DATA-DDL | 大表变更与在线 DDL（方法不适用） | 项目类型不含 service/data/ml/monorepo |
| data-integrity | DATA-BACKUP | 备份策略与恢复演练（方法不适用） | 项目类型不含 service/data/ml/monorepo |
| performance | PERF-WEBVITAL | 首屏与核心网页指标（方法不适用） | 项目类型不含 web |
| scalability | SCALE-HORIZONTAL | 水平扩展行为（方法不适用） | 项目类型不含 service/data/ml/monorepo |
| scalability | SCALE-COST | 成本与容量规划（方法不适用） | 项目类型不含 service/data/ml/monorepo |
| efficiency | EFF-NETWORK | 网络请求数量与体积（方法不适用） | 项目类型不含 web/mobile/desktop |
| efficiency | EFF-ASSET | 资源压缩与懒加载（方法不适用） | 项目类型不含 web/mobile/desktop |
| efficiency | EFF-BATTERY | 移动端电量与流量（方法不适用） | 项目类型不含 mobile |
| sec-authn | SEC-AUTHN-COOKIE | Cookie 与会话存储属性（方法不适用） | 项目类型不含 web/service |
| sec-authn | SEC-AUTHN-M2M | 服务间认证与凭证轮换（方法不适用） | 项目类型不含 service/monorepo |
| sec-authz | SEC-AUTHZ-TENANT | 多租户数据隔离（方法不适用） | 项目类型不含 service/web |
| sec-authz | SEC-AUTHZ-ADMIN | 管理后台与内部接口暴露面（方法不适用） | 项目类型不含 service/web |
| sec-input | SEC-INPUT-INJECTION | LDAP 与目录查询对过滤器特殊字符转义 | 项目类型不含 service/web |
| sec-input | SEC-INPUT-CSRF | CSRF 与跨站请求伪造防护（方法不适用） | 项目类型不含 web/service |
| sec-input | SEC-INPUT-CORS | 跨域资源共享配置（方法不适用） | 项目类型不含 web/service |
| sec-input | SEC-INPUT-BROWSER | 浏览器安全响应头（方法不适用） | 项目类型不含 web/service |
| sec-data | SEC-DATA-RESIDENCY | 数据出境与合规（方法不适用） | 项目类型不含 service/data |
| sec-supply | SEC-SUPPLY-BASELINE | 容器与基础设施基线（方法不适用） | 项目类型不含 service/web/monorepo |
| fault-tolerance | REL-IDEMPOTENT | 消息重复投递不产生重复副作用 | 项目类型不含 service/data/web/ml |
| fault-tolerance | REL-BACKPRESSURE | 队列积压与背压（方法不适用） | 项目类型不含 service/web/data/ml/cli |
| fault-tolerance | REL-SPOF | 无状态服务可多副本运行且状态外置 | 项目类型不含 service/web |
| fault-tolerance | REL-SPOF | 有状态组件具备故障转移能力 | 项目类型不含 service/web/data |
| fault-tolerance | REL-SPOF | 定时任务在多副本下不重复执行 | 项目类型不含 service/web/data |
| resilience-testing | REL-KILL | 进程与实例被杀（方法不适用） | 项目类型不含 service/web/cli/desktop/data/ml |
| resilience-testing | REL-NETPART | 网络分区与断连恢复（方法不适用） | 项目类型不含 service/web/mobile/desktop/data/cli |
| resilience-testing | REL-DISK | 磁盘满与只读异常（方法不适用） | 项目类型不含 service/web/cli/desktop/data/ml |
| observability | OBS-DASHBOARD | 看板与排障手册（方法不适用） | 项目类型不含 service/web/data/ml/mobile/desktop |
| deployment | DEP-IMAGE | 容器与镜像最佳实践（方法不适用） | 项目类型不含 service/web/cli/data/ml |
| deployment | DEP-IAC | 基础设施即代码与漂移（方法不适用） | 项目类型不含 service/web/data/ml |
| deployment | DEP-DBORDER | 数据库与发布顺序协调（方法不适用） | 项目类型不含 service/web/data/ml |
| continuity | - | 容灾与容量运维（整域不适用） | 项目类型不含 service/web/data/ml/mobile/desktop |

## 7. 自动检查执行记录

| 预设 | 命令 | 结果 | 退出码 | 耗时 | 来源 |
| --- | --- | --- | --- | --- | --- |
| test | `npm run test` | ✅ pass | 0 | 20.2s | package.json#scripts.test |
| coverage | `npm run coverage` | ✅ pass | 0 | 20.3s | package.json#scripts.coverage |


## 8. 项目画像（侦察结论）

- 技术栈：node(package.json)
- 项目类型：plugin、library｜包管理器：unknown
- 语言分布：JavaScript 30 文件
- 测试框架：node:test
- CI：github-actions｜容器：ci-only｜IaC：无
- 文档：README、CONTRIBUTING、CHANGELOG、SECURITY、CODE_OF_CONDUCT、LICENSE、docs-dir
- 规模：52 个文件

### 8.1 侦察阶段已确认的工程缺口

| 编号 | 优先级 | 缺口 | 证据 |
| --- | --- | --- | --- |
| RE-TEST-CI-VERIFY | P2 | 需要确认 CI 真正执行了测试 | .github/workflows |
| RE-QUALITY-LINT | P2 | 未配置任何 Lint 工具 | 未发现 eslint/biome/ruff/flake8 等配置，也没有 lint 脚本 |
| RE-QUALITY-TYPES | P2 | 未配置类型检查 | 未发现 tsconfig/mypy/pyright |


## 9. 复测与签署

| 角色 | 姓名 | 日期 | 备注 |
| --- | --- | --- | --- |
| 测试执行（Harness） | QualityForge | 2026-10-01 | 自动生成 |
| 修复确认（开发者） |  |  |  |
| 复测确认 |  |  |  |
| 发布批准 |  |  |  |

---

> 本报告由 dsh-qualityforge 生成，数据来源 `.qualityforge/audit.json`（revision 4）。
> 修改报告后可用 `qf_update sync=true` 将勾选状态回写到结构化数据；用 `qf_report` 可重新渲染。

