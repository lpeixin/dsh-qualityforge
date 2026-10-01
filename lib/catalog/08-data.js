/**
 * 测试域 08：数据层（模式与迁移 · 一致性与恢复 · 数据质量与合规）。
 *
 * 字段约定与分层定义见 `lib/catalog/01-build.js` 与 `docs/CATALOG-AUTHORING.md`：
 * category → method → case 三层，本文件是纯数据模块，只导出 `categories`。
 *
 * 本域判据尽量落在"可查询的事实"上：约束是否出现在 DDL、执行计划是否命中索引、
 * 重复提交后的行数是否仍为 1、恢复耗时是否小于 RTO、删除请求后的残留条数是否为 0。
 * 凡涉及阈值处给出具体数量级，避免"数据干净""性能良好"这类无法打勾的表述。
 */

export const categories = [
  {
    id: 'data-schema',
    name: '模式与迁移',
    intro: '结构定义是否真实约束数据、变更能否前滚可回滚、在线变更加不加锁阻塞业务、查询是否走对索引。',
    methods: [
      {
        id: 'DATA-SCHEMA',
        name: '模式定义与约束',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '关键业务字段的非空与唯一约束已落到数据库层',
            expect: 'DDL 中存在 NOT NULL/UNIQUE 约束；并发插入重复业务键时数据库返回唯一冲突而非写入重复行',
            tier: 'blocker',
            tags: ['constraint'],
          },
          {
            title: '数据库结构与应用侧模型定义不存在漂移',
            expect: '逐一比对 ORM/schema 声明与实际表结构，字段名、类型、可空性差异为 0，或差异已登记为待执行迁移',
            tier: 'blocker',
            tags: ['drift'],
          },
          {
            title: '外键与删除级联策略与业务预期一致',
            expect: '按声明的 ON DELETE 策略删除父记录，级联或拒绝行为与设计一致，全库扫描出的孤儿行数为 0',
            tier: 'core',
          },
          {
            title: '状态与取值范围由检查约束或枚举类型兜底',
            expect: '写入非法状态值时数据库拒绝并指明约束名；新增枚举值通过迁移变更而非直接写入',
            tier: 'core',
            tags: ['check'],
          },
          {
            title: '默认值与可空语义在文档与实现中一致',
            expect: '可空字段均标注业务含义与空值处理方式，依赖默认值的插入无需应用层补齐，抽查 10 个字段无缺项',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-MIGRATION',
        name: '迁移脚本与版本管理',
        automation: 'auto',
        priority: 'P0',
        standard: ['twelve-factor'],
        cases: [
          {
            title: '迁移可在空库一次执行到目标版本',
            expect: '空库顺序执行全部迁移退出码为 0，结束后 schema 与目标版本一致，过程中无手工补步骤或跳版',
            tier: 'blocker',
          },
          {
            title: '每个迁移都具备可验证的回滚路径',
            expect: '回滚脚本执行后与迁移前结构快照差异为 0，且回滚后应用仍可正常读写核心表',
            tier: 'blocker',
          },
          {
            title: '已发布的迁移文件不可变更且应用记录可追溯',
            expect: '历史迁移文件校验和与首次提交一致；迁移记录表含版本号、执行人、开始与结束时间',
            tier: 'core',
            tags: ['immutable'],
          },
          {
            title: '迁移失败后不留下半完成的结构状态',
            expect: '中途注入失败后重跑可从断点继续，库中不存在只建了一半的表或列，重复执行结果幂等',
            tier: 'core',
          },
          {
            title: '迁移在 CI 中用脱敏数据快照验证',
            expect: '流水线对最近一次脱敏快照执行迁移并断言耗时与关键表行数，超出阈值即阻断合并',
            tier: 'extended',
            tags: ['ci'],
          },
        ],
      },
      {
        id: 'DATA-COMPAT',
        name: '迁移与发布兼容顺序',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '破坏性结构变更按 expand/contract 分阶段发布',
            expect: '变更拆为新增结构、双写回填、切换读取、删除旧结构至少三次发布，任一阶段可独立回滚',
            tier: 'blocker',
            tags: ['expand-contract'],
          },
          {
            title: '新旧应用版本可同时读写同一份模式',
            expect: '灰度期间 vN 与 vN+1 实例并行运行，错误率与单版本基线偏差不超过 1%，无字段不存在类报错',
            tier: 'blocker',
            tags: ['rolling-upgrade'],
          },
          {
            title: '删除列或表前确认无残留引用与数据依赖',
            expect: '全仓检索旧字段引用数为 0，旧结构停写观察满一个发布周期后才执行删除',
            tier: 'core',
          },
          {
            title: '双写回填结果与在线写入结果一致',
            expect: '回填完成后新旧字段比对差异行数为 0，比对 SQL 与执行结果随迁移一并归档',
            tier: 'core',
          },
          {
            title: '兼容窗口与最晚回滚时间点已写入发布说明',
            expect: '发布说明标明本次变更兼容的版本范围与必须完成回滚的时间点，值班人员可据此决策',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-DDL',
        name: '大表变更与在线 DDL',
        automation: 'assisted',
        priority: 'P0',
        when: ['service', 'data', 'ml', 'monorepo'],
        cases: [
          {
            title: '大表结构变更使用在线 DDL 或明确的低峰窗口',
            expect: '变更方案给出预计锁表时长与执行窗口；行数超过 100 万的表不使用阻塞式 ALTER 或整表重建',
            tier: 'blocker',
            tags: ['online-ddl'],
          },
          {
            title: '变更期间写请求不被长时间阻塞',
            expect: 'DDL 执行期间写请求 P99 延迟增幅不超过基线的 50%，锁等待超时错误数为 0',
            tier: 'core',
          },
          {
            title: '大批量回填分批执行且可重入',
            expect: '回填按主键区间分批且每批不超过 1000 行，中断后重跑不产生重复写入或遗漏区间',
            tier: 'core',
          },
          {
            title: 'DDL 与回填可限速并观测进度',
            expect: '任务支持暂停与限速，日志或指标给出已完成行数占总量的百分比，可据此估算剩余时间',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-INDEX',
        name: '索引与查询计划',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '核心查询的执行计划命中预期索引',
            expect: '对列表与详情类核心查询执行 EXPLAIN，未出现全表扫描，扫描行数与返回行数处于同一数量级',
            tier: 'blocker',
            tags: ['explain'],
          },
          {
            title: '复合索引列顺序与高频查询条件匹配',
            expect: '高频查询命中索引最左前缀，无因列顺序或函数包裹导致的索引失效，EXPLAIN 中 key 字段非空',
            tier: 'core',
          },
          {
            title: '统计信息新鲜且执行计划不抖动',
            expect: '关键表统计信息更新时间在 7 天内，同一查询连续执行 10 次的计划与耗时偏差不超过 20%',
            tier: 'core',
          },
          {
            title: '冗余索引与从未使用的索引已清理',
            expect: '统计周期内使用次数为 0 的索引有处置结论，前缀重复的索引已合并，清单可复查',
            tier: 'extended',
          },
          {
            title: '索引数量与写入放大的权衡被记录',
            expect: '高写入表的索引数量有上限约定（如不超过 5 个），新增索引附带写入性能评估结论',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-DICTIONARY',
        name: '数据字典与血缘',
        automation: 'assisted',
        priority: 'P2',
        cases: [
          {
            title: '核心表与字段具备中文口径说明与责任人',
            expect: '数据字典覆盖全部核心表，字段含义、取值范围、负责人齐全，抽查 10 个字段无空缺',
            tier: 'core',
          },
          {
            title: '敏感字段在字典中标注分级与处理方式',
            expect: 'PII、资金、凭证类字段标注分级、是否加密与可访问角色，并与代码中的实际处理一致',
            tier: 'core',
            tags: ['classification'],
          },
          {
            title: '指标口径唯一且可回溯到具体字段',
            expect: '同一指标在报表与接口中的定义一致，可沿字段血缘回到源表，不存在两处互相矛盾的口径',
            tier: 'extended',
          },
          {
            title: '数据血缘覆盖跨系统上下游',
            expect: '同步任务、外部接口与下游订阅有依赖清单或图示，变更前可据此列出受影响消费者',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'data-integrity',
    name: '一致性与恢复',
    intro: '并发、重复投递与故障场景下数据是否始终一致，删除语义是否清晰，备份是否真能恢复，账是否对得上。',
    methods: [
      {
        id: 'DATA-TX',
        name: '事务边界与原子性',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '多步写操作在同一事务内原子提交',
            expect: '在中间步骤注入异常后整体回滚，涉及各表的检查行数要么全为 0 要么全为预期值，无部分写入',
            tier: 'blocker',
            tags: ['atomicity'],
          },
          {
            title: '提交失败返回可见错误且不静默成功',
            expect: '提交阶段失败时接口返回非 2xx 与明确错误码，日志中不存在"已成功"的矛盾记录',
            tier: 'blocker',
          },
          {
            title: '事务不跨越远程调用与用户交互',
            expect: '事务块内不存在 HTTP/RPC/消息等待，外部依赖变慢时事务持有时长不超过 1 秒',
            tier: 'core',
          },
          {
            title: '事务边界与业务不变式一一对应',
            expect: '每个写入用例注明其不变式（如余额等于流水累加），事务提交前后各校验一次均成立',
            tier: 'core',
          },
          {
            title: '只读路径不开启写事务',
            expect: '读接口不产生 BEGIN/COMMIT 形式的写事务，或显式使用只读事务，压测时连接池占用无异常上升',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-CONCURRENCY',
        name: '并发写入与隔离级别',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '隔离级别被显式声明且与一致性需求匹配',
            expect: '连接或事务级别显式设置隔离级别，并与幻读、丢失更新风险的书面说明一致，非依赖数据库默认值',
            tier: 'blocker',
            tags: ['isolation'],
          },
          {
            title: '并发更新不产生丢失更新',
            expect: '对同一计数器发起 100 次并发扣减后最终值与期望一致，无负值、无丢计数',
            tier: 'blocker',
          },
          {
            title: '热点行冲突有重试或排队机制',
            expect: '并发写同一行时事务冲突错误率低于 1%，失败请求经有限次重试后最终成功且重试次数可观测',
            tier: 'core',
          },
          {
            title: '锁等待有超时且不连锁阻塞',
            expect: '锁等待超时设置为明确秒数（如 5 秒），超时后释放资源并返回可重试错误，无长事务堆积',
            tier: 'core',
          },
          {
            title: '读写并发下不返回中间态数据',
            expect: '并发写入期间读取方不出现半更新记录（如金额已扣但订单未生成），抽样 200 次校验无中间态',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-IDEMPOTENT',
        name: '幂等写入与去重',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '重复提交同一幂等键只产生一条业务记录',
            expect: '同一幂等键连续提交 10 次，库中相关表行数为 1，且每次返回的响应体一致',
            tier: 'blocker',
            tags: ['idempotency'],
          },
          {
            title: '幂等键有数据库唯一约束兜底',
            expect: '幂等键或业务键上存在唯一索引，绕过应用层直接重复写入时被数据库拒绝',
            tier: 'blocker',
          },
          {
            title: '事件或消息重复投递不产生重复副作用',
            expect: '同一消息重复投递 5 次后最终状态与投递 1 次一致，下游计数与余额未重复累加',
            tier: 'core',
            tags: ['at-least-once'],
          },
          {
            title: '并发重复请求有防重入保护',
            expect: '同一键的 10 个并发请求中只有一个进入执行态，其余返回进行中或相同结果，无重复副作用',
            tier: 'core',
          },
          {
            title: '幂等键有效期与清理机制明确',
            expect: '幂等键保留时长有配置值（如 24 小时）与定期清理任务，过期后的重复提交行为可预测并已文档化',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-DELETE',
        name: '软删除与级联语义',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '软删除记录在全部读取路径被过滤',
            expect: '列表、详情、统计、导出路径默认排除已删除记录，逐路径抽查后泄漏条数为 0',
            tier: 'blocker',
          },
          {
            title: '级联删除的范围与顺序明确且可审计',
            expect: '删除父实体时子记录处理方式（级联/置空/保留）有定义，操作产生可回溯的审计记录',
            tier: 'core',
          },
          {
            title: '误删数据可在约定窗口内恢复',
            expect: '删除后 30 天内可通过接口或脚本恢复，恢复后关联关系与唯一约束均完整',
            tier: 'core',
          },
          {
            title: '唯一约束与软删除组合不产生误冲突',
            expect: '删除后重建同名或同键记录成功，无需手工清理墓碑行；所需的复合唯一键或部分索引已实现',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-BACKUP',
        name: '备份策略与恢复演练',
        automation: 'assisted',
        priority: 'P0',
        when: ['service', 'data', 'ml', 'monorepo'],
        cases: [
          {
            title: '备份按 RPO 目标自动执行且有成功监控',
            expect: '备份按计划（如每日全量加每小时增量）执行，最近一次成功时间不超过 RPO 值，失败触发告警',
            tier: 'blocker',
            tags: ['rpo'],
          },
          {
            title: '恢复演练在 RTO 内完成并校验数据可用',
            expect: '最近一次演练从备份恢复到可用实例的耗时不超过 RTO，恢复后关键表行数与备份点差异为 0',
            tier: 'blocker',
            tags: ['rto'],
          },
          {
            title: '备份包含恢复所需的全部对象与配置',
            expect: '恢复清单覆盖库表、索引、序列、账号权限与密钥引用，演练过程中无需人工补齐任何对象',
            tier: 'core',
          },
          {
            title: '备份跨故障域存放且加密并审计访问',
            expect: '备份存储与主库不在同一故障域，静态加密开启，读取备份需要授权且留下访问日志',
            tier: 'core',
          },
          {
            title: '时间点恢复能力有演练记录',
            expect: '可恢复到指定时间点且与目标时间差异不超过 1 分钟，记录含目标时间、恢复点与实际耗时',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-RECONCILE',
        name: '数据校验与对账',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '关键业务量存在定期自动对账并设差异阈值',
            expect: '对账任务按日运行并输出差异清单，差异率超过阈值（如 0.1%）时告警并附差异样例',
            tier: 'blocker',
          },
          {
            title: '对账逻辑独立于被校验的业务实现',
            expect: '对账不复用业务查询路径，使用独立数据源或独立实现，能发现业务代码自身的统计错误',
            tier: 'core',
          },
          {
            title: '差异处理有闭环留痕',
            expect: '每笔差异有处理状态（修复/核销/挂账）、处理人与时间，期末未处理差异数为 0 或已逐条说明',
            tier: 'core',
          },
          {
            title: '跨系统同步可幂等重放',
            expect: '同步失败后重放不产生重复记账，重放完成后双方数据比对差异行数为 0',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'data-quality',
    name: '数据质量与合规',
    intro: '数据进入系统时是否被校验与规范化，编码时区精度是否可靠，脏数据如何治理，PII 如何分级留存与脱敏。',
    methods: [
      {
        id: 'DATA-VALIDATE',
        name: '输入校验与规范化',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '服务端对所有外部输入执行白名单校验',
            expect: '缺失、超长、类型错误、越界取值均返回 4xx 且给出字段级错误，库中不产生对应脏数据行',
            tier: 'blocker',
            tags: ['validation'],
          },
          {
            title: '校验规则单一来源且入口与领域层复用',
            expect: 'schema（JSON Schema/Zod/DTO）为唯一定义处，外部接口与内部调用校验结果一致，重复定义数为 0',
            tier: 'core',
          },
          {
            title: '输入入库前完成规范化',
            expect: '大小写、全半角、首尾空格差异的同一语义输入在库中只有一种存储形态，抽样 20 条无重复形态',
            tier: 'core',
          },
          {
            title: '批量导入与文件上传同样受限并可控失败',
            expect: '超过行数或大小上限的导入被拒绝；非法行给出定位，回滚或部分成功策略与文档一致',
            tier: 'core',
          },
          {
            title: '校验错误可定位且不泄漏内部结构',
            expect: '错误信息含字段名与原因，不含堆栈、SQL 语句或内部文件路径',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-ENCODING',
        name: '编码、时区与精度',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '时间统一以带时区的形式存储与传输',
            expect: '时间列为 timestamptz 或以 UTC 存储，接口使用 ISO 8601 带偏移量，两个时区下抽样显示同一时刻',
            tier: 'blocker',
            tags: ['timezone'],
          },
          {
            title: '金额使用定点数或最小货币单位存储',
            expect: '金额字段为 DECIMAL 或整数分，不存在 float/double；0.1 加 0.2 类抽样计算结果精确到分',
            tier: 'blocker',
            tags: ['money'],
          },
          {
            title: '字符集与排序规则支持多语言且全程一致',
            expect: '库、连接、导出统一 UTF-8（utf8mb4），emoji 与中文往返无乱码、无截断、排序结果稳定',
            tier: 'core',
          },
          {
            title: '舍入规则与精度位数在业务侧统一',
            expect: '同一笔金额在计算、存储、展示三处的舍入方式与位数一致，抽样 20 笔无 1 分差异',
            tier: 'core',
          },
          {
            title: '夏令时与跨日边界场景有测试覆盖',
            expect: '处于夏令时切换时区的日期归属与日报统计正确，边界用例（切换当日 0 点与 23 点）有记录',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-DIRTY',
        name: '脏数据与重复数据治理',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '脏数据不进入下游且不拖垮主流程',
            expect: '异常记录被隔离到死信或待修队列，主流程任务成功率维持在 99% 以上，隔离队列有消费进度',
            tier: 'blocker',
            tags: ['dlq'],
          },
          {
            title: '存在脏数据检测规则并定期扫描',
            expect: '扫描覆盖空值、越界、格式异常与孤儿行，输出清单含问题数量、样例与影响范围',
            tier: 'core',
          },
          {
            title: '重复数据有判定键与合并策略',
            expect: '重复判定键与相似度阈值明确，合并后保留主记录且关联数据不丢失，处理结果可回溯',
            tier: 'core',
          },
          {
            title: '数据质量指标被持续观测并设告警阈值',
            expect: '关键表完整性、唯一性、及时性指标在看板可查，劣化到阈值时告警，历史趋势保留 30 天以上',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-PII',
        name: 'PII 分类与最小化',
        automation: 'assisted',
        priority: 'P0',
        standard: ['gdpr', 'pci-dss'],
        cases: [
          {
            title: 'PII 字段分类分级清单与实现一致',
            expect: '清单列出字段、类别（身份/联系方式/生物特征等）、敏感级别与存储位置，抽查 10 个字段与代码一致',
            tier: 'blocker',
            tags: ['pii'],
          },
          {
            title: '日志与监控中的 PII 已脱敏',
            expect: '日志、错误上报与指标标签中无明文手机号、证件号、卡号；手机号按 3-4-4 掩码形式展示',
            tier: 'blocker',
            tags: ['masking'],
          },
          {
            title: '仅收集业务必需字段且用途可说明',
            expect: '每个 PII 字段有用途与法律依据说明，无用途字段已下线或标记待删并附时间点',
            tier: 'core',
          },
          {
            title: 'PII 传输与静态存储加密',
            expect: '外部传输使用 TLS，敏感列加密或令牌化，密钥不与密文同库存放且支持轮换',
            tier: 'core',
            tags: ['encryption'],
          },
          {
            title: '对外共享 PII 有字段清单与依据',
            expect: '每个接收方有共享字段清单、用途与协议依据，共享渠道与频率明确，可随请求停止共享',
            tier: 'extended',
          },
          {
            title: '不存在明文卡号与校验码的存储',
            expect: '全库检索无明文 PAN 与 CVV 字段；确需保留卡号时已截断或令牌化（展示不超过前 6 后 4）',
            tier: 'exhaustive',
            tags: ['pci'],
          },
        ],
      },
      {
        id: 'DATA-RETENTION',
        name: '留存与删除',
        automation: 'assisted',
        priority: 'P0',
        standard: ['gdpr'],
        cases: [
          {
            title: '数据留存期限明确且到期自动清理',
            expect: '留存策略表覆盖全部核心数据集，到期清理任务按计划执行，抽查过期数据残留行数为 0',
            tier: 'blocker',
            tags: ['retention'],
          },
          {
            title: '删除请求端到端覆盖主库备份索引与缓存',
            expect: '提交删除请求后，在承诺时限内（如 30 天）各存储中均无法检索到该主体数据，验证记录留存',
            tier: 'blocker',
            tags: ['right-to-erasure'],
          },
          {
            title: '法定保留例外有书面依据并说明范围',
            expect: '财务或审计类数据的保留例外有条款依据，删除请求被部分拒绝时向请求方说明保留范围与期限',
            tier: 'core',
          },
          {
            title: '删除操作留痕但不保留被删内容',
            expect: '审计日志记录删除时间、请求号与执行结果，不保存被删除内容的明文或可还原副本',
            tier: 'core',
          },
          {
            title: '账号注销后的数据处理策略可验证',
            expect: '注销流程列出保留、匿名化、删除三类数据及依据，执行后逐类抽查结果与策略一致',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DATA-TESTDATA',
        name: '测试数据脱敏',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '测试与预发环境不使用未脱敏生产数据',
            expect: '抽样检查测试库无真实手机号、证件号、卡号与邮箱，格式校验与校验位复核均不通过',
            tier: 'blocker',
            tags: ['masking'],
          },
          {
            title: '脱敏不可逆且保持引用完整性',
            expect: '同一用户在多表中的脱敏标识一致、外键仍可关联，且无法从脱敏结果反推原值',
            tier: 'core',
          },
          {
            title: '脱敏在数据同步链路中自动执行',
            expect: '生产到测试的数据流转自动完成脱敏，人工导出通道关闭或有审批与留痕',
            tier: 'core',
          },
          {
            title: '脱敏后仍保留测试所需的分布特征',
            expect: '脱敏数据的长度、格式与边界值分布与原数据同类，可直接用于等价类与前缀检索类测试',
            tier: 'extended',
          },
        ],
      },
    ],
  },
]
