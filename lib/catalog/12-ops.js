/**
 * 测试域 12：可观测与运维（日志指标追踪 · 部署发布 · 容灾容量）。
 *
 * 字段约定与写作要求见 docs/CATALOG-AUTHORING.md，格式范例见 lib/catalog/01-build.js。
 * 本文件是纯数据模块：只导出 categories，不含 import、函数或副作用。
 *
 * 覆盖的三个测试域
 * ----------------
 * observability  结构化日志与级别、关联 id 与链路追踪、黄金信号与业务指标、
 *                告警与误报治理、看板与排障手册、日志敏感信息控制、采样与成本
 * deployment     制品与运行时一致性、配置与密钥管理、容器镜像、IaC 与漂移、
 *                灰度与特性开关、回滚验证、数据库与发布顺序协调
 * continuity     备份可恢复性、多可用区与多区域切换、灾难恢复演练与 RTO/RPO、
 *                证书与域名到期、配额与限流运维、容量水位与扩容、值班与升级路径
 *
 * 判据写法：本域判据以"运行时可观测的事实"为准——指标名、日志行、看板数值、
 * 命令输出或演练记录；凡"演练过""验证过"的表述都在 expect 中写明记录载体。
 */

export const categories = [
  {
    id: 'observability',
    name: '可观测性',
    intro: '系统运行时能否被看清：日志、指标与追踪是否足以定位故障并验证业务健康。',
    when: ['cli', 'service', 'web', 'desktop', 'mobile', 'plugin', 'data', 'ml', 'monorepo'],
    methods: [
      {
        id: 'OBS-LOG',
        name: '结构化日志与级别',
        automation: 'assisted',
        priority: 'P1',
        standard: ['twelve-factor', 'sre-golden-signals'],
        cases: [
          {
            title: '日志为结构化格式且字段稳定',
            expect: '日志为 JSON 或固定 key=value 字段，timestamp、level、message、service 等字段在所有日志行中可解析且命名一致',
            tier: 'core',
            tags: ['structured-log'],
          },
          {
            title: '日志级别正确且可运行时调整',
            expect: '生产默认 info 及以上，错误路径输出 error 且含异常堆栈；调整级别无需重启即生效并留下变更记录',
            tier: 'blocker',
          },
          {
            title: '错误日志包含定位问题所需上下文',
            expect: '错误日志含请求 id、用户或租户标识、关键业务参数与错误码，无需二次加日志即可复现定位',
            tier: 'core',
          },
          {
            title: '日志输出到标准输出或统一采集通道',
            expect: '应用不自行轮转日志文件，输出可被采集器统一收集，并能按服务名与时间范围检索',
            tier: 'core',
          },
          {
            title: '日志量有基线且突增可被察觉',
            expect: '单位时间日志条数与体积有基线，出现数量级突增时可通过监控或日志平台告警发现',
            tier: 'extended',
            tags: ['cost'],
          },
        ],
      },
      {
        id: 'OBS-TRACE',
        name: '请求关联与链路追踪',
        automation: 'assisted',
        priority: 'P0',
        standard: ['opentelemetry', 'sre-golden-signals'],
        cases: [
          {
            title: '入口请求生成并透传关联 id',
            expect: '客户端未带 id 时服务端生成、带 id 时沿用，该 id 出现在全部下游调用日志与响应头中',
            tier: 'blocker',
            tags: ['correlation-id'],
          },
          {
            title: '跨服务调用链可被完整还原',
            expect: '一次请求的 trace 含全部涉及服务与关键依赖 span，父子关系与时序正确，可在追踪界面展开',
            tier: 'core',
          },
          {
            title: '日志与追踪可互相跳转',
            expect: '日志行含 trace_id 与 span_id，可由日志定位到 trace，也可由 trace 找到对应日志行',
            tier: 'core',
          },
          {
            title: '异步与后台任务保留追踪上下文',
            expect: '经队列或定时任务触发的处理仍归属原 trace 或具有可追溯的新 trace，链路无断点',
            tier: 'core',
          },
          {
            title: '采样策略在保真与成本间有明确取舍',
            expect: '采样率与策略（头部或尾部、错误全采）有文档说明，故障期间的 trace 未被采样丢弃',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'OBS-METRIC',
        name: '关键指标与黄金信号',
        automation: 'assisted',
        priority: 'P0',
        standard: ['sre-golden-signals'],
        cases: [
          {
            title: '四个黄金信号均有指标且可查询',
            expect: '延迟、流量、错误、饱和度四类指标存在并可在看板查询，指标名与采集方式有文档',
            tier: 'blocker',
            tags: ['golden-signals'],
          },
          {
            title: '关键业务指标与技术指标并存',
            expect: '除 CPU 与内存外，存在下单量、支付成功率、任务完成数等业务指标，且可按维度下钻',
            tier: 'core',
          },
          {
            title: '指标维度基数受控',
            expect: '标签取值有限且可枚举，无用户 id 或原始 URL 等高基数标签导致存储与查询失控',
            tier: 'core',
          },
          {
            title: 'SLO 与错误预算被定义并可计算',
            expect: 'SLI 定义、目标值与统计窗口在文档中可查，错误预算消耗可由现有指标算出并展示',
            tier: 'core',
            tags: ['slo'],
          },
          {
            title: '指标口径与业务口径经过抽样校验',
            expect: '指标数值与数据库或对账系统抽样核对一致，口径差异有说明与修订记录',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'OBS-ALERT',
        name: '告警规则与误报治理',
        automation: 'assisted',
        priority: 'P0',
        standard: ['sre-golden-signals', 'itil'],
        cases: [
          {
            title: '核心 SLO 违约有告警且能触达责任人',
            expect: '成功率或延迟越界触发告警并按值班表通知到人，记录含触发时间、规则名与接收人',
            tier: 'blocker',
          },
          {
            title: '告警基于用户可见症状而非仅资源阈值',
            expect: '存在错误率与可用性类告警，仅靠 CPU、磁盘等资源阈值不足以覆盖的用户影响场景',
            tier: 'blocker',
          },
          {
            title: '告警有分级、静默与抑制策略',
            expect: '告警分级（如 P0 到 P3）与路由不同，维护窗口静默与依赖故障抑制生效，未重复轰炸同一接收人',
            tier: 'core',
          },
          {
            title: '误报率被统计并持续治理',
            expect: '统计告警总数与无效告警数，无效告警有理化记录（阈值调整或规则下线）并在周期内下降',
            tier: 'core',
            tags: ['alert-fatigue'],
          },
          {
            title: '告警通知包含排障入口',
            expect: '通知内含看板链接、排障手册链接与最近变更信息，值班人无需手工检索即可开始定位',
            tier: 'core',
          },
          {
            title: '告警规则纳入版本管理并有触发验证',
            expect: '规则文件在仓库中评审合入，关键规则以合成数据或测试告警验证过可被触发',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'OBS-DASHBOARD',
        name: '看板与排障手册',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'web', 'data', 'ml', 'mobile', 'desktop'],
        cases: [
          {
            title: '排障手册覆盖高频故障与恢复步骤',
            expect: '手册按告警列出检查步骤、判定依据与恢复操作，值班人可据此在目标时间内完成处置',
            tier: 'blocker',
            tags: ['runbook'],
          },
          {
            title: '存在可逐层下钻的排障看板',
            expect: '从全局健康到服务、依赖、实例可逐层下钻，看板链接在手册中可直接找到',
            tier: 'core',
          },
          {
            title: '看板与告警规则使用同一数据源',
            expect: '告警阈值与看板曲线口径一致，不出现告警已触发而看板显示正常的分歧',
            tier: 'core',
          },
          {
            title: '发布后验证有专用视图',
            expect: '存在按版本对比成功率、延迟与错误码的视图，发布后短时间内即可完成一次回滚判定',
            tier: 'core',
          },
          {
            title: '看板与手册有责任人和最近复核时间',
            expect: '每份看板与手册标注负责人与最近复核日期，超过约定周期未复核会被提示',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'OBS-REDACT',
        name: '日志中的敏感信息控制',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10'],
        cases: [
          {
            title: '日志与追踪不记录凭证与完整敏感号',
            expect: '检索日志与 span 属性无明文口令、令牌、Cookie、Authorization 头与完整卡号，敏感字段被掩码',
            tier: 'blocker',
            tags: ['pii'],
          },
          {
            title: '个人敏感信息按最小必要原则记录',
            expect: '手机号、身份证与邮箱等在日志中脱敏或哈希，采集侧配置了字段白名单',
            tier: 'core',
          },
          {
            title: '错误堆栈与响应回显不泄漏密钥',
            expect: '异常堆栈与 4xx 响应不含环境变量、连接串与密钥，内部实现细节不外泄',
            tier: 'core',
          },
          {
            title: '脱敏规则覆盖嵌套与常见载体',
            expect: '脱敏对嵌套 JSON、数组、URL 查询参数与表单均生效，测试用例覆盖这些形态',
            tier: 'core',
          },
          {
            title: '日志访问受权限控制并留审计',
            expect: '日志平台按角色授权，敏感数据查询留有审计记录，保留期符合合规要求',
            tier: 'extended',
          },
          {
            title: '脱敏规则失效有检出机制',
            expect: '存在定期或提交时的敏感信息扫描（正则或密钥扫描），命中即告警并阻断合入',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'OBS-SAMPLING',
        name: '采样策略与可观测性成本',
        automation: 'assisted',
        priority: 'P2',
        cases: [
          {
            title: '日志与追踪采样策略有明确配置',
            expect: '采样率与策略在配置中可查（如错误全采、正常流量按比例），各环境取值不同且经过评审',
            tier: 'core',
          },
          {
            title: '可观测性成本有量化与预算',
            expect: '日志、指标与追踪的月度存储和流量成本可查，接近或超过预算时有告警或治理记录',
            tier: 'core',
          },
          {
            title: '降采样不丢失故障证据',
            expect: '错误与慢请求在采样中被优先保留，故障复盘时可取到完整 trace 与对应日志',
            tier: 'core',
          },
          {
            title: '高基数指标与调试日志有回收机制',
            expect: '临时调试日志与高基数指标有明确下线时间，扫描无超过约定期的残留',
            tier: 'extended',
          },
          {
            title: '采集端故障不影响业务进程',
            expect: '采集代理不可用时业务请求正常返回，本地缓冲有上限且不会占满磁盘',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'deployment',
    name: '部署与发布',
    intro: '制品、配置、基础设施与发布顺序是否可预测、可灰度、可回滚，而不是靠手工操作。',
    methods: [
      {
        id: 'DEP-ARTIFACT',
        name: '制品与运行时一致性',
        automation: 'auto',
        priority: 'P0',
        standard: ['slsa', 'twelve-factor'],
        cases: [
          {
            title: '线上运行的制品与流水线产物一致',
            expect: '线上实例的镜像 digest 或包校验和与流水线发布记录一致，不存在本地构建或手工替换的制品',
            tier: 'blocker',
            tags: ['immutable-artifact'],
          },
          {
            title: '制品带有可追溯的版本与提交标识',
            expect: '镜像或包携带版本号与 commit sha 标签，可由运行实例反查到源码提交',
            tier: 'core',
          },
          {
            title: '各环境部署同一制品只替换配置',
            expect: '测试、预发与生产使用同一制品 digest，差异仅在配置与密钥，构建与运行分离',
            tier: 'core',
          },
          {
            title: '发布标签不可被覆盖',
            expect: '版本标签重复推送被拒绝或产生新的 digest 并有记录，历史制品未被原地替换',
            tier: 'extended',
          },
          {
            title: '制品来源可出具构建证明或签名',
            expect: '存在构建来源证明或签名，可验证制品由指定流水线与提交生成，校验命令与结果可查',
            tier: 'exhaustive',
            tags: ['provenance'],
          },
        ],
      },
      {
        id: 'DEP-CONFIG',
        name: '配置与环境变量管理',
        automation: 'assisted',
        priority: 'P0',
        standard: ['twelve-factor'],
        cases: [
          {
            title: '配置与代码分离且无密钥入库',
            expect: '仓库中无真实密钥或口令，配置来自环境变量或配置中心，密钥扫描退出码为 0',
            tier: 'blocker',
            tags: ['no-secrets-in-repo'],
          },
          {
            title: '缺失或非法配置时启动失败并指出键名',
            expect: '缺少必需配置时进程以非零码退出，日志包含缺失键名，不静默使用默认值继续运行',
            tier: 'blocker',
          },
          {
            title: '各环境配置清单与差异可枚举',
            expect: '存在配置项清单（键名、用途、是否必填、取值来源），与代码中的读取点一一对应',
            tier: 'core',
          },
          {
            title: '配置变更可审计并可回滚',
            expect: '配置中心保留变更人、时间与前后值，可回滚到上一版本，回滚生效有日志可对照',
            tier: 'core',
          },
          {
            title: '配置热更新行为明确且安全',
            expect: '文档标注哪些配置热生效、哪些需重启；热更新失败时保留旧值并产生告警',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DEP-IMAGE',
        name: '容器与镜像最佳实践',
        automation: 'auto',
        priority: 'P1',
        when: ['service', 'web', 'cli', 'data', 'ml'],
        cases: [
          {
            title: '镜像以非 root 运行且基础镜像最小化',
            expect: '镜像 USER 字段非 root，基础镜像为 slim 或 distroless 类，漏洞扫描无高危或已记录豁免',
            tier: 'blocker',
          },
          {
            title: '镜像分层与体积有基线',
            expect: '依赖安装与源码拷贝分层以复用缓存，镜像体积与上一版本对比无未解释增长',
            tier: 'core',
          },
          {
            title: '运行镜像不含构建工具与测试文件',
            expect: '多阶段构建生效，运行镜像内无编译器、包管理器缓存与测试用例，仅含运行所需内容',
            tier: 'core',
          },
          {
            title: '镜像带健康检查与正确启动命令',
            expect: 'HEALTHCHECK 或编排探针指向真实健康端点，ENTRYPOINT 与 CMD 的参数覆盖方式有说明',
            tier: 'core',
          },
          {
            title: '部署清单不引用浮动标签',
            expect: '编排与部署文件使用确定版本标签或 digest，latest 不被任何生产工作负载引用',
            tier: 'extended',
          },
          {
            title: '镜像构建可复现且基础镜像受控',
            expect: '基础镜像按 digest 固定，重建同一提交得到相同层摘要，差异有解释说明',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DEP-IAC',
        name: '基础设施即代码与漂移',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'web', 'data', 'ml'],
        cases: [
          {
            title: '基础设施由代码定义且变更经评审',
            expect: '网络、数据库、缓存与队列等资源在 IaC 仓库中可查，变更通过合入评审并附计划输出',
            tier: 'blocker',
            tags: ['iac'],
          },
          {
            title: '计划输出与实际变更一致且可预审',
            expect: '发布前执行的计划附在变更单中，实际资源增删与计划一致，差异有解释',
            tier: 'core',
          },
          {
            title: '未纳管的手工变更可被检出',
            expect: '定期漂移检测有结果记录：无差异，或差异清单附带回填或整改状态',
            tier: 'core',
            tags: ['drift'],
          },
          {
            title: '状态文件远端存储并启用加锁',
            expect: 'state 存于远端且有锁机制，并发操作时后到者被拒绝或排队，未发生互相覆盖',
            tier: 'extended',
          },
          {
            title: '关键资源有删除防护与审计',
            expect: '生产资源开启删除保护或审批，误执行销毁时被拦截并留下审计记录',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DEP-CANARY',
        name: '灰度与特性开关',
        automation: 'assisted',
        priority: 'P0',
        standard: ['itil'],
        cases: [
          {
            title: '新版本先小流量灰度并设观察窗口',
            expect: '发布按比例（如 1%、10%、50%）推进，每步有观察窗口与校验点，发布记录可查',
            tier: 'blocker',
            tags: ['canary'],
          },
          {
            title: '灰度期间新旧版本指标可对比',
            expect: '存在按版本切分的成功率、延迟与错误码看板，两版本差异可被直接识别',
            tier: 'core',
          },
          {
            title: '自动回滚条件被定义并验证过',
            expect: '错误率或延迟越界时自动停止推进并回滚，演练或历史记录含触发一次自动回滚的过程',
            tier: 'core',
          },
          {
            title: '特性开关有属主、默认值与清理计划',
            expect: '每个开关记录负责人、默认状态、创建时间与下线条件，长期开启的开关有清理记录',
            tier: 'core',
            tags: ['feature-flag'],
          },
          {
            title: '灰度流量分配对同一用户保持粘性',
            expect: '同一用户在灰度期内恒定落在同一版本，跨端行为一致，未出现版本来回跳变',
            tier: 'extended',
          },
          {
            title: '开关服务不可用时有明确降级行为',
            expect: '开关服务不可用时返回默认值且不阻断主流程，日志记录取默认值事件',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DEP-ROLLBACK',
        name: '回滚验证与耗时',
        automation: 'assisted',
        priority: 'P0',
        standard: ['itil'],
        cases: [
          {
            title: '回滚流程存在并经实际演练验证',
            expect: '回滚步骤文档化并在预发或生产演练过，演练记录含开始与结束时间及最终结果',
            tier: 'blocker',
            tags: ['rollback'],
          },
          {
            title: '数据变更与代码回滚的兼容性有结论',
            expect: '存在前向兼容窗口说明：回滚到上一版本后结构仍被支持，实测旧版本可启动并读写',
            tier: 'blocker',
          },
          {
            title: '回滚耗时满足约定目标',
            expect: '实测回滚耗时（如 5 分钟内完成）记录在案并与目标值对比，超差有改进项',
            tier: 'core',
          },
          {
            title: '回滚后关键指标恢复基线',
            expect: '回滚完成后成功率与延迟在约定时间内回到发布前水平，看板与日志可验证',
            tier: 'core',
          },
          {
            title: '回滚触发条件与决策人明确',
            expect: '文档写明判定阈值（如错误率持续高于 1%）与有权触发回滚的角色，值班记录可查',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DEP-DBORDER',
        name: '数据库与发布顺序协调',
        automation: 'assisted',
        priority: 'P0',
        when: ['service', 'web', 'data', 'ml'],
        cases: [
          {
            title: '数据库变更先于依赖它的代码发布',
            expect: '发布清单标注每步顺序（先加结构后用、先停用后删）与验证点，顺序经演练或历史发布验证',
            tier: 'blocker',
          },
          {
            title: '破坏性变更使用扩展与收缩多版本流程',
            expect: '删列或改类型经过至少一个中间版本，期间新旧代码均可运行，版本记录可查',
            tier: 'core',
            tags: ['expand-contract'],
          },
          {
            title: '迁移执行不阻塞线上服务',
            expect: '迁移在低峰执行且有超时与限速，发布期间连接池占用与锁等待未越界',
            tier: 'core',
          },
          {
            title: '回填与数据修复任务可重入',
            expect: '回填脚本可重复执行且幂等，中断后续跑不产生重复数据，进度与结果可查询',
            tier: 'extended',
          },
          {
            title: '破坏性变更备有反向修复脚本',
            expect: '每类破坏性变更配有反向脚本并演练过，脚本位置在发布清单中可直接找到',
            tier: 'exhaustive',
          },
        ],
      },
    ],
  },
  {
    id: 'continuity',
    name: '容灾与容量运维',
    intro: '备份、切换、演练、证书、配额、容量与值班是否被持续验证，而不是停留在纸面预案。',
    when: ['service', 'web', 'data', 'ml', 'mobile', 'desktop'],
    methods: [
      {
        id: 'DR-BACKUP',
        name: '备份可恢复性验证',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010', 'itil'],
        cases: [
          {
            title: '备份按策略自动执行且有成功记录',
            expect: '备份任务按周期运行，最近一次成功时间在约定窗口内，失败触发告警，记录可在平台查询',
            tier: 'blocker',
          },
          {
            title: '备份可被实际恢复并通过业务校验',
            expect: '在隔离环境完成一次恢复并执行抽样查询与业务校验，结果与生产一致，而非只确认备份文件存在',
            tier: 'blocker',
            tags: ['restore-test'],
          },
          {
            title: '备份加密且访问受控',
            expect: '备份文件静态加密，读取或下载需授权并留下审计记录，密钥与备份分开存放',
            tier: 'core',
          },
          {
            title: '保留策略满足恢复与合规需求',
            expect: '保留周期、异地副本与删除规则有文档且与配置一致，可按指定日期取到历史版本',
            tier: 'core',
          },
          {
            title: '备份与恢复耗时均有实测基线',
            expect: '记录全量与增量备份耗时及恢复耗时，数据量增长后恢复仍在目标窗口内',
            tier: 'extended',
          },
          {
            title: '异地或冷存储副本经过实际读取校验',
            expect: '异地副本在约定周期内被实际读取并校验成功，记录含校验时间与结果',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DR-FAILOVER',
        name: '多可用区与多区域切换',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '服务跨可用区部署且单区故障可存活',
            expect: '实例分布于 2 个以上可用区，停掉一个可用区后服务仍可用，容量评估与实测记录可查',
            tier: 'blocker',
            tags: ['multi-az'],
          },
          {
            title: '数据库与缓存具备跨区切换能力',
            expect: '主节点故障后在目标时间内完成切换或提升，客户端自动重连，无已确认数据丢失',
            tier: 'core',
          },
          {
            title: '流量切换手段与权限明确',
            expect: '存在负载均衡或 DNS 层的切换流程与操作权限说明，切换后流量分布与健康状态可在看板验证',
            tier: 'core',
          },
          {
            title: '切换后数据一致性经过校验',
            expect: '切换后抽样对账与切换前一致，复制延迟在约定时间内归零',
            tier: 'core',
          },
          {
            title: '区域级故障切换有实测数据',
            expect: '演练记录含区域不可用到服务恢复的实测耗时、影响范围与遗留问题清单',
            tier: 'extended',
            tags: ['multi-region'],
          },
          {
            title: '切换过程中无重复扣款或双写',
            expect: '切换期间幂等与去重生效，切换后账务对账无重复条目与缺失条目',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DR-DRILL',
        name: '灾难恢复演练与 RTO 达成',
        automation: 'assisted',
        priority: 'P0',
        standard: ['itil', 'iso-25010'],
        cases: [
          {
            title: '存在书面灾难恢复预案与责任人',
            expect: '预案含场景、决策人、切换与恢复步骤、通信方式与外部联系人，版本号与更新日期可查',
            tier: 'blocker',
          },
          {
            title: '演练记录含 RTO 与 RPO 实测值',
            expect: '演练报告给出实际恢复时间与数据丢失窗口数值，与目标值对比并对偏差给出原因分析',
            tier: 'blocker',
            tags: ['rto', 'rpo'],
          },
          {
            title: '演练覆盖数据丢失与区域不可用场景',
            expect: '至少覆盖数据误删与区域不可用两类场景，每次演练有参与者与观察记录',
            tier: 'core',
          },
          {
            title: '演练发现的问题有整改闭环',
            expect: '每项问题有负责人、期限与状态，逾期项在下次演练前升级处理并留有记录',
            tier: 'core',
          },
          {
            title: '演练按约定周期重复执行且轮换场景',
            expect: '演练周期（如半年一次）与场景轮换表可查，最近一次在约定周期内完成',
            tier: 'extended',
          },
          {
            title: '恢复过程可在无原作者支持下完成',
            expect: '由非原作者按预案独立完成恢复，或预案细节足以支撑执行而无需口头传递',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DR-CERT',
        name: '证书与域名到期管理',
        automation: 'auto',
        priority: 'P1',
        when: ['service', 'web', 'mobile', 'desktop'],
        cases: [
          {
            title: '对外证书到期前自动续期或有阈值告警',
            expect: '证书剩余有效期有监控与告警（如剩余 30 天触发），或自动续期且续期记录可查',
            tier: 'blocker',
            tags: ['tls-expiry'],
          },
          {
            title: '域名与证书清单含责任人与到期时间',
            expect: '清单可枚举全部域名、证书、用途、到期时间与续费责任人，无遗漏的自建域名',
            tier: 'core',
          },
          {
            title: '证书链与协议配置被外部拨测校验',
            expect: '存在外部拨测校验证书链、协议版本与主机名匹配，异常时告警并附具体错误',
            tier: 'core',
          },
          {
            title: '内部服务证书同样纳入管理',
            expect: '内部证书或 mTLS 的签发、轮换与吊销流程有文档，轮换后服务间调用正常',
            tier: 'extended',
          },
          {
            title: '证书轮换过程无需停机',
            expect: '演练或历史记录显示轮换期间调用成功率不变，旧证书吊销时间记录在案',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DR-QUOTA',
        name: '配额与限流运维',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'web', 'data', 'ml'],
        cases: [
          {
            title: '入口与出站调用均有限流与配额',
            expect: '入口限流与出站配额在配置中可查，超限返回 429 并记录日志，未出现对端封禁',
            tier: 'blocker',
          },
          {
            title: '租户配额可调整且有审批记录',
            expect: '配额变更记录含申请人、审批人、生效时间与新额度，可按租户查询当前配额',
            tier: 'core',
          },
          {
            title: '配额耗尽前有预警',
            expect: '使用率达到阈值（如 80%）时通知责任人，未出现静默用尽影响业务的情况',
            tier: 'core',
          },
          {
            title: '限流触发时核心链路仍满足 SLO',
            expect: '限流期间核心接口成功率与延迟仍在 SLO 内，重试与降级按策略生效',
            tier: 'extended',
          },
          {
            title: '第三方配额与合同条款一致',
            expect: '配额上限与合同或服务条款一致，接近上限前的扩容或商务动作有排期记录',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DR-CAPACITY',
        name: '容量水位与扩容流程',
        automation: 'assisted',
        priority: 'P0',
        standard: ['sre-golden-signals'],
        cases: [
          {
            title: '关键资源水位有监控与分级告警',
            expect: 'CPU、内存、磁盘与连接数水位在看板可查，超过阈值（如 70% 与 85%）分级告警',
            tier: 'blocker',
            tags: ['capacity'],
          },
          {
            title: '容量模型与业务量的换算关系可查',
            expect: '存在换算说明（如每千 QPS 需 N 个实例与 M 个连接），扩容决策可据此推导',
            tier: 'core',
          },
          {
            title: '扩容流程可在目标时间内完成并有实测',
            expect: '手动与自动扩容步骤可执行，实测从触发到生效的耗时记录在案并满足业务峰值要求',
            tier: 'core',
          },
          {
            title: '压测容量结论与线上水位可对照',
            expect: '容量测试给出单实例上限与性能拐点，线上水位未超过安全比例，超出时有扩容记录',
            tier: 'core',
          },
          {
            title: '缩容与成本优化有安全边界',
            expect: '缩容前校验最低副本数与关键指标，缩容后无延迟或错误率恶化记录',
            tier: 'extended',
          },
          {
            title: '容量规划有前瞻排期与预算对应',
            expect: '按业务增长给出未来一到两个季度的资源与成本计划，可与预算表逐项对照',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DR-ONCALL',
        name: '值班与升级路径',
        automation: 'manual',
        priority: 'P1',
        when: ['service', 'web', 'data', 'ml', 'mobile', 'desktop'],
        cases: [
          {
            title: '值班表覆盖全部时段且联系人可达',
            expect: '值班表按周排班无空档，联系方式经演练验证可在目标时间内联系到具体人员',
            tier: 'blocker',
          },
          {
            title: '告警升级路径与响应时限明确',
            expect: '未在规定时间确认的告警自动升级到上级，升级链路与时限有文档并按次记录',
            tier: 'core',
          },
          {
            title: '值班交接与在办事项有记录',
            expect: '交接记录含未关闭事件、临时操作与风险提示，接班人员可据此继续处置',
            tier: 'core',
          },
          {
            title: '重大事件有复盘与改进项闭环',
            expect: '事件复盘产出时间线、根因与改进项，每项有负责人与完成状态，逾期项被跟踪',
            tier: 'extended',
            tags: ['postmortem'],
          },
          {
            title: '值班角色具备处置权限与工具',
            expect: '值班角色拥有回滚、限流与扩容所需权限，权限清单与操作演练结果可查',
            tier: 'extended',
          },
        ],
      },
    ],
  },
]
