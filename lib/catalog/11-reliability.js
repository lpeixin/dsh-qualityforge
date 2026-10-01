/**
 * 测试域 11：可靠性与韧性（容错降级 · 故障注入 · 状态恢复）。
 *
 * 字段约定与写作要求见 docs/CATALOG-AUTHORING.md，格式范例见 lib/catalog/01-build.js。
 * 本文件是纯数据模块：只导出 categories，不含 import、函数或副作用。
 *
 * 覆盖的三个测试域
 * ----------------
 * fault-tolerance     依赖失效、过载与局部故障时的降级路径、熔断隔离、超时预算、
 *                     重试退避、幂等补偿、队列背压与单点识别
 * resilience-testing  用主动注入故障（延时/错误/杀进程/分区/磁盘/时钟）验证容错假设
 * recovery            崩溃与重启后的状态一致性、幂等重放、断点续传、并发冲突、
 *                     版本升级后的状态迁移与恢复对账
 *
 * 判据写法：本域的通过判据以"注入故障 → 观测 → 恢复"三段式实验为主，一律写成
 * 可复现的观测事实（指标名、日志行、命令输出、演练记录），便于逐条打勾。
 */

export const categories = [
  {
    id: 'fault-tolerance',
    name: '容错与降级',
    intro: '依赖失败、过载与局部故障发生时，系统是否按设计降级、隔离并保住核心链路。',
    methods: [
      {
        id: 'REL-DEGRADE',
        name: '降级与兜底路径',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '核心链路每个外部依赖都有明确降级分支',
            expect: '逐个依赖检查调用点，失败分支返回兜底值、缓存数据或显式错误码，不存在未捕获异常直穿主流程的路径',
            tier: 'blocker',
            tags: ['degradation'],
          },
          {
            title: '降级分支不写入不完整数据',
            expect: '依赖失败时写操作被拒绝或整体回滚，事后对账中无缺字段记录、无半写入行',
            tier: 'blocker',
          },
          {
            title: '降级触发时返回可识别的降级标记',
            expect: '响应携带 degraded/fallback 标识或专用错误码，日志出现降级事件行且被指标按次数统计',
            tier: 'core',
          },
          {
            title: '非关键功能失败不阻断核心流程',
            expect: '注入推荐、统计、通知等附属依赖故障，主流程仍返回成功，附属失败在日志中单独记录',
            tier: 'core',
          },
          {
            title: '降级开关可在线启停且下一次请求即生效',
            expect: '切换开关无需重启，配置变更记录的时间戳与日志中首个降级请求的时间戳可对照',
            tier: 'extended',
            tags: ['kill-switch'],
          },
          {
            title: '依赖恢复后自动退出降级且流量平滑回升',
            expect: '依赖恢复后一个探测周期内停止降级，无需人工重启，恢复瞬间无请求堆积或延迟尖峰',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-CIRCUIT',
        name: '熔断、隔离与过载保护',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '连续失败达到阈值后熔断并快速失败',
            expect: '注入依赖持续失败，达到阈值后请求在毫秒级返回失败，依赖侧观测到的请求量降为 0',
            tier: 'blocker',
            tags: ['circuit-breaker'],
          },
          {
            title: '熔断阈值、统计窗口与半开策略可枚举',
            expect: '失败率或慢调用比例、统计窗口、最小请求数、半开探测数均有显式取值，非直接沿用未评估的默认值',
            tier: 'core',
          },
          {
            title: '半开状态只放行少量探测流量',
            expect: '半开期探测请求数受限（如 1 到 5 个），依赖仍不可用时立即回到 open，未出现重试风暴',
            tier: 'core',
          },
          {
            title: '关键依赖使用独立资源池隔离',
            expect: '注入该依赖慢响应时，其它接口 P95 与成功率无显著变化，线程与连接池指标显示隔离生效',
            tier: 'core',
            tags: ['bulkhead'],
          },
          {
            title: '熔断状态变化可观测并触发告警',
            expect: 'circuit_state 指标与状态迁移日志可查，持续 open 超过阈值时间产生告警通知',
            tier: 'core',
          },
          {
            title: '熔断与重试组合不放大下游流量',
            expect: '熔断打开期间依赖侧请求量下降而非倍增，retry 指标显示未发生倍数放大',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-TIMEOUT',
        name: '超时层级与时间预算',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010', 'sre-golden-signals'],
        cases: [
          {
            title: '外部调用均设置了显式超时',
            expect: 'HTTP、RPC、数据库、缓存与消息客户端均配置连接与读取超时，代码中不存在依赖默认值无限等待的调用点',
            tier: 'blocker',
          },
          {
            title: '超时后返回明确错误且资源被释放',
            expect: '超时请求返回 504 或 DEADLINE_EXCEEDED 类错误码，连接数与线程数回落至基线，长跑无持续增长',
            tier: 'blocker',
          },
          {
            title: '各级超时呈层级递减并留有余量',
            expect: '下游超时之和小于上游超时，端到端预算与各层配置可对照成表，剩余余量为正且有明确取值',
            tier: 'core',
          },
          {
            title: '慢调用被记录且可定位到具体依赖',
            expect: '超过阈值（如 500ms）的调用在日志或追踪中带依赖名、耗时与请求 id，无需复现即可定位慢点',
            tier: 'core',
          },
          {
            title: '端到端预算支持取消传播',
            expect: '上游取消或预算耗尽时下游调用被主动取消，追踪中可见 cancel 或 deadline 原因与取消层级',
            tier: 'extended',
          },
          {
            title: '批量与后台任务有独立执行上限',
            expect: '单次运行时长或分片数有上限，超限时安全中断并可从断点续跑，未阻塞后续调度',
            tier: 'extended',
            when: ['service', 'data', 'ml', 'cli'],
          },
        ],
      },
      {
        id: 'REL-RETRY',
        name: '重试策略与退避',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '仅对可重试错误发起重试',
            expect: '参数错误与鉴权失败等 4xx 不重试，连接失败、超时、5xx 与限流按策略重试，日志能区分两类结果',
            tier: 'blocker',
          },
          {
            title: '重试次数与总时长有上限且不超上游预算',
            expect: '最大尝试次数（如 3 到 5 次）与最长总时长已配置，超限即返回失败且总耗时不超过上游超时',
            tier: 'blocker',
          },
          {
            title: '重试间隔为指数退避并带随机抖动',
            expect: '日志或抓包中的重试间隔递增且含随机抖动，多个并发请求的间隔序列互不重合',
            tier: 'core',
            tags: ['backoff', 'jitter'],
          },
          {
            title: '收到限流响应时按 Retry-After 退避',
            expect: '429 或 Retry-After 场景下按提示时长等待，等待窗口内对端无新增拒绝日志',
            tier: 'core',
          },
          {
            title: '重试放大受预算或令牌桶限制',
            expect: '重试请求占总请求比例有上限，依赖整体故障时下游请求量增幅不超过设定阈值',
            tier: 'extended',
            tags: ['retry-budget'],
          },
          {
            title: '重试行为在指标中可与首次请求区分',
            expect: '存在 retry_total 与 attempt 维度指标，可算出重试放大倍数与重试成功率',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-IDEMPOTENT',
        name: '幂等与补偿事务',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '写接口以幂等键保证重复提交结果一致',
            expect: '同一幂等键并发重复提交，数据库中仅一条业务记录，响应与首次一致或明确返回重复标记',
            tier: 'blocker',
            tags: ['idempotency-key'],
          },
          {
            title: '幂等记录持久化且有唯一约束与过期策略',
            expect: '幂等键存于持久存储并有唯一索引与 TTL 配置，进程重启后重复提交仍被识别',
            tier: 'core',
          },
          {
            title: '消息重复投递不产生重复副作用',
            expect: '同一消息重复投递两次（at-least-once 语义），业务表与外部副作用只发生一次，可用对账记录验证',
            tier: 'blocker',
            when: ['service', 'data', 'web', 'ml'],
          },
          {
            title: '跨服务写操作有补偿或冲正路径',
            expect: '构造第二步失败时第一步写入被补偿，补偿记录可查询且可重放，重放不产生二次副作用',
            tier: 'core',
            tags: ['saga'],
          },
          {
            title: '补偿超过上限进入死信并支持人工重放',
            expect: '超过补偿上限的记录进入死信表或队列并触发告警，导出重放后状态收敛且操作有审计记录',
            tier: 'extended',
          },
          {
            title: '批量与分片操作返回逐项结果',
            expect: '响应包含成功、失败与未执行三类清单，调用方无需反查数据库推断结果',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-BACKPRESSURE',
        name: '队列积压与背压',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'web', 'data', 'ml', 'cli'],
        cases: [
          {
            title: '队列深度与最老消息年龄有监控与告警',
            expect: '两项指标可在仪表盘查询，压测造成积压时告警在 1 分钟内触发',
            tier: 'blocker',
          },
          {
            title: '生产端在过载时被限速或拒绝',
            expect: '压测超过消费能力时生产端出现 429 或 503，队列长度收敛而非无限增长',
            tier: 'core',
          },
          {
            title: '队列容量上限有保护',
            expect: '达到上限时按策略阻塞或丢弃并告警，进程内存无无限增长且未发生 OOM 重启',
            tier: 'core',
          },
          {
            title: '任务积压不拖垮交互式请求',
            expect: '批量任务打满时同步接口 P95 与成功率仍在 SLO 内，资源池或队列隔离生效',
            tier: 'core',
          },
          {
            title: '积压清空速度有量化基线',
            expect: '记录到积压峰值与清空耗时（如 10 万条在 10 分钟内清空），扩容后消费速率提升可验证',
            tier: 'extended',
          },
          {
            title: '消息有 TTL 与死信策略避免永久积压',
            expect: '超期消息按策略丢弃或转入死信并保留可查记录，扫描无超过保留期的滞留消息',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-SPOF',
        name: '单点故障识别',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010', 'itil'],
        cases: [
          {
            title: '无状态服务可多副本运行且状态外置',
            expect: '扩到 2 个以上副本功能正常，重启任一实例不丢会话与任务，实例本地磁盘无必需状态',
            tier: 'blocker',
            when: ['service', 'web'],
          },
          {
            title: '产出组件冗余级别清单与故障影响面',
            expect: '清单标注每个组件的实例数、跨可用区情况、故障影响与恢复方式，并有评审记录',
            tier: 'core',
            tags: ['spof'],
          },
          {
            title: '有状态组件具备故障转移能力',
            expect: '主节点宕机后自动或按手册在目标时间内完成切换，客户端自动重连且无已确认数据丢失',
            tier: 'core',
            when: ['service', 'web', 'data'],
          },
          {
            title: '定时任务在多副本下不重复执行',
            expect: '分布式锁或选主生效，同一调度周期内任务日志仅出现一个执行实例',
            tier: 'core',
            when: ['service', 'web', 'data'],
          },
          {
            title: '单点故障演练结果与清单一致',
            expect: '按清单逐个停止组件，实测影响与恢复方式记入演练报告，未发现清单之外的隐式单点',
            tier: 'extended',
          },
          {
            title: '外部依赖单点有替代路径或风险记录',
            expect: 'DNS、证书、对象存储与第三方 API 的备用方案或经批准的风险接受记录可查',
            tier: 'exhaustive',
          },
        ],
      },
    ],
  },
  {
    id: 'resilience-testing',
    name: '故障注入与演练',
    intro: '是否用主动注入故障的方式验证容错假设，而不是停留在"应该没问题"的推断。',
    methods: [
      {
        id: 'REL-CHAOS',
        name: '混沌演练计划与记录',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010', 'itil'],
        cases: [
          {
            title: '存在故障注入清单与稳态假设',
            expect: '文档列出注入项（依赖故障、实例被杀、网络分区、磁盘满等）、稳态指标（成功率、P99、错误预算）与中止条件',
            tier: 'core',
            tags: ['chaos'],
          },
          {
            title: '演练有中止条件且可在注入过程中立即停止',
            expect: '错误预算耗尽或核心指标越界时终止注入，演练记录包含停止动作的时间戳与触发原因',
            tier: 'blocker',
          },
          {
            title: '演练报告包含假设、注入、观测与结论',
            expect: '报告含注入参数、观测指标数据或截图、假设是否被证伪、后续修复项与负责人',
            tier: 'core',
          },
          {
            title: '演练按固定节奏重复执行',
            expect: '存在季度或版本级演练排期与历次记录，历次修复项有闭环状态与完成时间',
            tier: 'extended',
          },
          {
            title: '演练发现的问题转化为回归测试或监控规则',
            expect: '每个演练缺陷对应新增的自动化用例、告警规则或运行手册条目，可在提交历史中追溯关联',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'REL-INJECT-DEP',
        name: '依赖延时与错误注入',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '注入下游延时后接口在超时预算内返回',
            expect: '注入 3 倍正常延时，接口 P99 不超过上游超时值，返回降级结果或明确错误而非无限挂起',
            tier: 'blocker',
          },
          {
            title: '注入 5xx 与连接拒绝后触发重试和熔断',
            expect: '日志显示重试序列与熔断状态迁移，依赖恢复后自动恢复，期间无请求堆积',
            tier: 'core',
          },
          {
            title: '按比例注入错误可验证降级分支被走到',
            expect: '注入 50% 错误率时降级分支在日志与指标中可证被触发，核心功能成功率仍达 SLO',
            tier: 'core',
          },
          {
            title: '注入 DNS 解析失败与连接超时可预期失败',
            expect: '客户端在配置超时内失败，未无限重连，错误日志含具体依赖名与错误类型',
            tier: 'core',
          },
          {
            title: '注入畸形响应验证解析健壮性',
            expect: '空字段、超长字段与错误类型数据不导致崩溃或未捕获异常，返回可判定的错误码',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-KILL',
        name: '进程与实例被杀',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'web', 'cli', 'desktop', 'data', 'ml'],
        cases: [
          {
            title: '强杀实例后服务自动拉起并恢复健康',
            expect: 'kill -9 后编排或守护进程在目标时间内重启实例，健康检查转绿，全程无人工介入',
            tier: 'blocker',
          },
          {
            title: '被杀实例不丢已确认写入',
            expect: '强杀前返回成功的写入在重启后可查询，无半写入记录，数据库一致性检查无错误',
            tier: 'core',
          },
          {
            title: '进程收到终止信号时优雅关闭',
            expect: 'SIGTERM 后停止接收新请求、等待在途请求（带超时）再退出，日志有优雅关闭完成记录',
            tier: 'core',
          },
          {
            title: '滚动重启全部实例期间服务保持可用',
            expect: '按最大不可用预算滚动重启，外部成功率仍在 SLO 内，无请求被硬中断',
            tier: 'extended',
          },
          {
            title: '节点级宕机后工作负载可在别处重建',
            expect: '节点不可用后工作负载在其它节点重建，数据副本校验一致，恢复耗时记录在案',
            tier: 'exhaustive',
            when: ['service', 'web', 'data'],
          },
        ],
      },
      {
        id: 'REL-NETPART',
        name: '网络分区与断连恢复',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'web', 'mobile', 'desktop', 'data', 'cli'],
        cases: [
          {
            title: '分区期间不返回与服务端不一致的成功',
            expect: '断网时写请求返回失败或进入待同步队列，恢复后无本地已成功但服务端无记录的数据丢失',
            tier: 'blocker',
            tags: ['partition'],
          },
          {
            title: '分区恢复后自动重连并补齐数据',
            expect: '恢复网络后目标时间内自动重连，待同步队列清空且与服务端对账一致，无需手工重启',
            tier: 'core',
          },
          {
            title: '分区期间避免双写脑裂',
            expect: '存在法定人数、租约或冲突解决策略，分区两侧不会同时对同一资源接受写入',
            tier: 'core',
          },
          {
            title: '客户端重连采用退避且连接数平稳',
            expect: '断连重试间隔递增，恢复时连接数平缓上升，服务端未出现重连风暴或连接数打满',
            tier: 'core',
          },
          {
            title: '跨可用区网络抖动不影响可用性',
            expect: '注入 5% 丢包与 100ms 抖动后成功率与延迟仍满足 SLO，未触发误切换',
            tier: 'extended',
            when: ['service', 'web', 'data'],
          },
        ],
      },
      {
        id: 'REL-DISK',
        name: '磁盘满与只读异常',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'web', 'cli', 'desktop', 'data', 'ml'],
        cases: [
          {
            title: '磁盘写满时服务不崩溃且报错可读',
            expect: '填满数据盘后写请求返回磁盘空间不足类错误，进程存活，清理空间后自动恢复写入',
            tier: 'blocker',
          },
          {
            title: '写满或断电不导致数据文件损坏',
            expect: '恢复空间后数据文件可正常打开，数据库一致性检查工具输出无错误',
            tier: 'core',
          },
          {
            title: '日志写满不拖垮业务进程',
            expect: '日志轮转与清理策略生效，日志盘写失败不影响主流程，磁盘水位告警在阈值时触发',
            tier: 'core',
          },
          {
            title: '只读文件系统下给出明确诊断',
            expect: '只读挂载启动时日志指出不可写路径并以非零码退出，运行中遇到只读时拒绝写入而不崩溃',
            tier: 'core',
          },
          {
            title: '磁盘水位有监控与清理预案',
            expect: '使用率阈值告警存在，运行手册给出清理步骤与责任人，演练中按手册恢复成功',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-CLOCK',
        name: '时钟漂移与时区异常',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '超时与过期判断不依赖本地时钟的绝对正确',
            expect: '人为前后调整本地时钟 ±5 分钟，会话有效期与超时判定行为可解释，未出现提前失效或永不过期',
            tier: 'blocker',
          },
          {
            title: '时间戳统一以 UTC 存储并带时区信息',
            expect: '数据库与日志时间可追溯到 UTC，接口返回 ISO 8601 带偏移量，跨时区节点结果一致',
            tier: 'core',
          },
          {
            title: '时钟漂移下不产生重复或丢失写入',
            expect: '注入 ±5 分钟偏移后，锁租约与幂等窗口未导致重复执行，对账结果与基线一致',
            tier: 'core',
          },
          {
            title: '夏令时切换日的调度行为正确',
            expect: 'DST 切换日定时任务不重复执行也不跳过，测试记录含切换前后各一次执行时间',
            tier: 'core',
          },
          {
            title: '跨时区部署使用统一调度基准',
            expect: '调度基准时区在配置中显式声明，部署在两个时区的实例不会重复触发同一任务',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'recovery',
    name: '状态恢复与数据安全',
    intro: '崩溃、重启、重放与升级之后，状态能否被正确恢复、续跑并核对一致。',
    methods: [
      {
        id: 'REL-CRASH',
        name: '崩溃后的状态一致性',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '崩溃时未提交写入不留下半成品状态',
            expect: '在事务或写入中途强杀进程，重启后数据满足约束（无孤立外键、无部分写入行），恢复日志无错误行',
            tier: 'blocker',
            tags: ['crash-consistency'],
          },
          {
            title: '崩溃恢复后对外行为与崩溃前一致',
            expect: '重启后重复同一请求的结果与崩溃前一致，缓存与索引被重建或正确失效',
            tier: 'core',
          },
          {
            title: '启动时执行崩溃恢复自检',
            expect: '启动日志列出完整性检查项（数据库恢复、索引重建、临时文件清理）与耗时，检查失败时拒绝提供服务',
            tier: 'core',
          },
          {
            title: '崩溃不导致外部副作用被重复执行',
            expect: '崩溃前已发出的支付或通知类调用在恢复后不重复触发，可通过对账或幂等记录验证',
            tier: 'core',
          },
          {
            title: '关键崩溃点被逐一覆盖测试',
            expect: '在写入前、写入中、提交后等关键点分别崩溃并记录结果，测试报告含崩溃点与观测结论',
            tier: 'extended',
          },
          {
            title: '文件型状态使用原子写且强杀后可用',
            expect: '采用临时文件加 rename 或 WAL 方式写入，强杀后原文件可读、无内容截断，校验和与预期一致',
            tier: 'extended',
            when: ['desktop', 'cli', 'mobile', 'data'],
          },
        ],
      },
      {
        id: 'REL-REPLAY',
        name: '幂等重放与断点续传',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '任务中断后从检查点继续而非从头重跑',
            expect: '中断恢复后已完成分片不重复处理，checkpoint 或 offset 单调递增且日志可核对',
            tier: 'blocker',
            tags: ['checkpoint'],
          },
          {
            title: '重放历史数据不产生重复结果',
            expect: '同一批数据重放两次，最终业务状态与统计指标一致，去重或幂等机制生效',
            tier: 'core',
          },
          {
            title: '消费位点在处理成功后提交',
            expect: '处理失败时位点不前进，重启后该消息被重新消费，日志可验证 at-least-once 语义',
            tier: 'core',
          },
          {
            title: '长任务可取消并可安全重跑',
            expect: '取消后资源被释放且进度落盘，重跑从断点继续，结果与一次跑完一致',
            tier: 'core',
          },
          {
            title: '断点续传正确处理重复与乱序分片',
            expect: '注入重复与乱序分片后最终结果与顺序执行一致，冲突分片有处理日志',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'REL-SESSION',
        name: '会话与长任务恢复',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'web', 'cli', 'desktop', 'mobile', 'plugin'],
        cases: [
          {
            title: '实例重启后用户会话不丢失',
            expect: '滚动重启或强杀后已登录用户无需重新登录，会话数据在外置存储中可查询',
            tier: 'blocker',
          },
          {
            title: '长任务进度在客户端断开后保留',
            expect: '断开连接后任务继续执行并记录进度，重连后可查询或订阅到当前进度',
            tier: 'core',
          },
          {
            title: '长任务状态可判定且无永久进行中',
            expect: '任务状态为进行中、成功、失败或已取消之一，扫描无超过超时阈值的进行中记录',
            tier: 'core',
          },
          {
            title: '过期会话与僵尸任务被自动清理',
            expect: '按 TTL 或心跳超时清理，扫描无超过保留期的残留会话与孤儿任务',
            tier: 'core',
          },
          {
            title: '跨设备恢复后状态一致',
            expect: '在另一设备登录后看到一致的服务端状态，未依赖本地缓存或本地文件',
            tier: 'extended',
            when: ['web', 'mobile', 'desktop'],
          },
        ],
      },
      {
        id: 'REL-CONFLICT',
        name: '并发冲突处理',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '并发更新使用乐观锁或版本号防止丢失更新',
            expect: '两个客户端基于同一版本更新，后提交者收到 409 或版本不匹配错误，数据保留先提交者的修改',
            tier: 'blocker',
            tags: ['lost-update'],
          },
          {
            title: '冲突解决策略明确且对外可见',
            expect: '存在 last-write-wins、合并或人工裁决策略说明，接口返回冲突详情供调用方处理',
            tier: 'core',
          },
          {
            title: '高并发下计数与库存不超卖',
            expect: '并发压测后最终数量等于初始值减去成功请求数，无负数与超卖，日志可逐笔核对',
            tier: 'core',
          },
          {
            title: '分布式锁有租约与超时不会永久死锁',
            expect: '持锁进程被杀后锁在租约到期后自动释放，后续请求可继续，无需人工删锁',
            tier: 'core',
          },
          {
            title: '冲突率与重试结果可观测',
            expect: '冲突次数与重试成功率指标可查询，冲突高发时产生告警或有优化项记录',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-MIGSTATE',
        name: '版本升级后的状态迁移',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '升级前有状态快照或可回滚方案',
            expect: '迁移前自动备份或快照，备份位置与校验值可查，回滚步骤经演练验证成功',
            tier: 'blocker',
          },
          {
            title: '滚动升级期间新旧版本可共存读写',
            expect: '迁移采用先扩展后收缩策略，滚动期间新旧实例均可正常读写，无字段缺失错误',
            tier: 'core',
          },
          {
            title: '迁移失败可重入且不留半迁移状态',
            expect: '迁移中断后重跑成功，无部分应用的结构变更，迁移版本表记录与实际结构一致',
            tier: 'core',
          },
          {
            title: '升级后数据校验通过',
            expect: '升级后行数与关键字段校验和或抽样对账与升级前一致，差异有书面解释',
            tier: 'core',
          },
          {
            title: '大表迁移的锁与性能影响有评估',
            expect: '迁移对线上延迟与锁等待的影响有实测数据（如 P99 增量在阈值内），并有分批或限速策略',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-RECON',
        name: '恢复验证与对账',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '关键数据有定期自动对账',
            expect: '对账任务按周期自动运行并产出差异报告，差异条目可定位到具体记录与原因',
            tier: 'blocker',
            tags: ['reconciliation'],
          },
          {
            title: '备份或恢复后的数据经过可读性验证',
            expect: '恢复演练中执行抽样查询与业务校验且结果与生产一致，而非只验证备份文件存在',
            tier: 'core',
          },
          {
            title: '对账差异有处理闭环',
            expect: '每条差异有状态（待处理、已修复、已豁免）与负责人，未处理差异不被静默忽略',
            tier: 'core',
          },
          {
            title: '恢复演练记录包含 RTO 与 RPO 实测值',
            expect: '演练报告给出实际恢复耗时与数据丢失窗口，并与目标值对比、对偏差给出说明',
            tier: 'core',
          },
          {
            title: '跨系统数据在约定窗口内最终一致',
            expect: '账务、库存、搜索索引等在设定时间窗（如 5 分钟）内收敛一致，超窗触发告警与修复脚本',
            tier: 'extended',
          },
        ],
      },
    ],
  },
]
