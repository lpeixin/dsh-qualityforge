/**
 * 测试域 09：性能与容量（性能基准 · 容量与压力 · 资源效率与前端性能）。
 *
 * 字段约定与分层定义见 `lib/catalog/01-build.js` 与 `docs/CATALOG-AUTHORING.md`：
 * category → method → case 三层，本文件是纯数据模块，只导出 `categories`。
 *
 * 本域判据必须带数字：延迟用 P50/P95/P99 毫秒或倍率，吞吐用 QPS 与错误率，
 * 压力用阶梯并发与拐点，稳定性用时长与内存增幅，前端用 Web Vitals 官方阈值与包体积预算。
 * 凡"更快""更省"之类无法打勾的表述都不允许出现。
 */

export const categories = [
  {
    id: 'performance',
    name: '性能基准',
    intro: '关键路径的延迟、吞吐、启动与外部依赖成本是否有基线、有分解、有门禁，回归时能在合并前被拦住。',
    methods: [
      {
        id: 'PERF-BASELINE',
        name: '关键路径延迟基线',
        automation: 'auto',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '核心接口在目标负载下的延迟满足已声明目标',
            expect: '在声明并发（如 100 并发）与生产量级数据下实测，核心接口 P95 不超过目标值（如 300 毫秒）',
            tier: 'blocker',
            tags: ['slo'],
          },
          {
            title: '关键路径记录 P50/P95/P99 三档基线',
            expect: '每个核心接口有 P50/P95/P99 实测值、测量日期与环境说明，缺任一档视为无基线',
            tier: 'core',
            tags: ['baseline'],
          },
          {
            title: '延迟统计口径一致且他人可复现',
            expect: '统计窗口、并发度、数据量、预热时长记录在案；同版本两次独立测量的 P95 偏差不超过 10%',
            tier: 'core',
          },
          {
            title: '尾延迟不因个别慢请求失控',
            expect: 'P99 与 P50 的比值不超过约定倍数（如 5 倍），超出时能定位到具体下游调用或慢查询',
            tier: 'core',
            tags: ['tail-latency'],
          },
          {
            title: '基线随版本更新并保留历史曲线',
            expect: '每次发布后基线数据归档，可按版本查看趋势，异常版本被标注原因而非覆盖删除',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'PERF-THROUGHPUT',
        name: '吞吐与并发上限',
        automation: 'auto',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '系统在目标峰值流量下吞吐达标且错误率可控',
            expect: '按预估峰值（如 1000 QPS）加压时实测吞吐达到目标值，错误率低于 0.5%，无请求超时堆积',
            tier: 'blocker',
            tags: ['peak'],
          },
          {
            title: '单实例吞吐上限有实测值',
            expect: '在错误率低于 1% 的前提下测得单实例 QPS/TPS 上限，并同时记录 CPU、内存与连接数占用',
            tier: 'core',
          },
          {
            title: '吞吐随并发上升至饱和点后不再明显回落',
            expect: '并发从 1 提升到饱和点期间吞吐单调上升，饱和后回落幅度不超过 10%',
            tier: 'core',
          },
          {
            title: '批处理与后台任务不挤占在线流量',
            expect: '批任务满速运行时在线接口 P95 增幅不超过 20%，或已通过限流、错峰、独立资源池隔离',
            tier: 'core',
          },
          {
            title: '吞吐数据被容量评审引用',
            expect: '容量评审给出余量百分比与扩容触发阈值，数值与实测吞吐一致，非估算值',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'PERF-STARTUP',
        name: '冷启动与启动时延',
        automation: 'auto',
        priority: 'P1',
        when: ['service', 'cli', 'desktop', 'mobile', 'plugin'],
        cases: [
          {
            title: '冷启动耗时在约定阈值内',
            expect: '清空缓存并重启进程后测量，服务就绪时间或 CLI 首条输出时间不超过 2 秒或项目声明阈值',
            tier: 'blocker',
          },
          {
            title: '启动路径不执行非必要的重活',
            expect: '启动阶段无全量数据加载或同步网络阻塞，日志给出启动各阶段耗时分解且合计与总耗时偏差不超过 10%',
            tier: 'core',
          },
          {
            title: '就绪探针不早于真实可用状态',
            expect: '依赖未就绪时就绪探针返回失败而非通过，启动超时有明确退出码与失败原因日志',
            tier: 'core',
          },
          {
            title: '热启动与冷启动差异被量化',
            expect: '记录热启动耗时并与冷启动对比，差异倍数有解释（如缓存预热、类加载）',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'PERF-WEBVITAL',
        name: '首屏与核心网页指标',
        automation: 'auto',
        priority: 'P0',
        when: ['web'],
        standard: ['web-vitals'],
        cases: [
          {
            title: '核心网页指标在移动端第 75 百分位达标',
            expect: '真实用户数据第 75 百分位满足 LCP 不超过 2.5 秒、CLS 不超过 0.1、INP 不超过 200 毫秒',
            tier: 'blocker',
            tags: ['lcp', 'cls', 'inp'],
          },
          {
            title: '首屏渲染不等待非关键资源',
            expect: '首屏内容不依赖非关键 JS/CSS/字体，阻塞渲染的资源数量有清单且不超过约定上限',
            tier: 'core',
          },
          {
            title: '首屏无失败请求与阻塞性错误',
            expect: '首屏网络面板中 4xx/5xx 请求与关键资源超时数为 0，控制台无未捕获异常',
            tier: 'core',
          },
          {
            title: '指标在真实用户监控中持续采集',
            expect: 'RUM 覆盖核心页面且采样率明确，可按页面、设备、地区查看第 75 百分位趋势',
            tier: 'core',
            tags: ['rum'],
          },
          {
            title: '交互响应不受长任务阻塞',
            expect: '关键交互路径上主线程长任务（超过 50 毫秒）出现次数为 0，或已有拆分计划与排期',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'PERF-QUERY',
        name: '数据库慢查询与 N+1',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '列表与聚合接口的 SQL 数量不随返回行数线性增长',
            expect: '返回 100 行的列表请求产生的 SQL 条数不超过 5 条，分页放大到 500 行时 SQL 条数保持不变',
            tier: 'blocker',
            tags: ['n-plus-one'],
          },
          {
            title: '慢查询阈值已配置且有治理清单',
            expect: '慢查询阈值（如 200 毫秒）生效，统计周期内的慢查询有归因与处置状态，未处置项不超过清单 20%',
            tier: 'core',
          },
          {
            title: '查询返回数据量受控',
            expect: '列表接口单页条数有上限，所有查询带 LIMIT，无全表扫描或百万行级结果集加载到内存',
            tier: 'core',
          },
          {
            title: '批量写入替代逐条往返',
            expect: '批量写入使用批量语句或事务合并，1 万条写入的数据库往返次数不超过 100 次',
            tier: 'core',
          },
          {
            title: '连接池配置与并发规模匹配',
            expect: '连接池上下限、超时与数据库最大连接数一致，压测中连接等待超时次数为 0',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'PERF-EXTERNAL',
        name: '外部调用耗时占比',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '外部依赖耗时占比可量化',
            expect: '关键链路中第三方调用耗时占总耗时比例有统计，占比超过 50% 时附缓存、异步或降级方案',
            tier: 'core',
          },
          {
            title: '外部调用均设置超时与有限重试',
            expect: '每个外部依赖配置连接与读取超时（如 1 秒与 3 秒）及最大重试次数，不存在无限等待的调用',
            tier: 'blocker',
            tags: ['timeout'],
          },
          {
            title: '下游变慢时不拖垮自身',
            expect: '下游延迟放大 3 倍时自身错误率上升不超过 5%，熔断或降级在 10 秒内生效',
            tier: 'core',
            tags: ['circuit-breaker'],
          },
          {
            title: '串行外部调用可合并或并行化',
            expect: '存在串行调用清单与优化结论，无依赖关系的调用已并行，串行深度有基线且不再增加',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'PERF-BUDGET',
        name: '性能预算与 CI 门禁',
        automation: 'auto',
        priority: 'P0',
        cases: [
          {
            title: '性能预算以数字形式定义并纳入流水线',
            expect: '延迟、吞吐、包体积等预算有具体阈值，CI 中超出预算即失败并输出与基线的差值',
            tier: 'blocker',
            tags: ['budget'],
          },
          {
            title: '回归判定基于可比环境与基线版本',
            expect: '同一机器规格、相同数据量与预热条件下比较，超出噪声区间（如 5%）才判定为退化',
            tier: 'core',
          },
          {
            title: '门禁失败有明确处理路径与责任人',
            expect: '失败通知到提交者，处理方式（优化或申请豁免）有记录，豁免需带期限与批准人',
            tier: 'core',
          },
          {
            title: '预算项随业务增长定期复核',
            expect: '每季度至少复核一次预算阈值，阈值调整有数据依据记录，不出现静默放宽',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'scalability',
    name: '容量与压力',
    intro: '系统在阶梯加压、长时间运行、资源受限、水平扩展与数据增长下是否可预测，并知道余量与成本边界。',
    methods: [
      {
        id: 'SCALE-LOAD',
        name: '阶梯加压与拐点识别',
        automation: 'auto',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '阶梯加压识别出吞吐拐点与首次出错点',
            expect: '并发按 10/50/100/200 阶梯上升，报告给出吞吐拐点并发数、首次错误出现点与对应资源占用',
            tier: 'blocker',
            tags: ['knee-point'],
          },
          {
            title: '超过容量后表现为快速拒绝而非崩溃',
            expect: '超载时错误在 1 秒内返回（如 429/503），进程不崩溃、不 OOM，压力撤销后 2 分钟内恢复',
            tier: 'blocker',
          },
          {
            title: '压测场景与生产流量模型贴近',
            expect: '读写比例、参数分布与思考时间与生产画像一致，存在的差异项有书面说明',
            tier: 'core',
          },
          {
            title: '压测数据量与环境规模匹配生产',
            expect: '压测库数据量不低于生产的 30%（或说明差异影响），避免小数据量造成的假性通过',
            tier: 'core',
          },
          {
            title: '压测可复现且记录完整',
            expect: '脚本、参数、机器规格与原始结果一并归档，他人按记录可复现同一拐点结论',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SCALE-SOAK',
        name: '长时间稳定性',
        automation: 'auto',
        priority: 'P0',
        cases: [
          {
            title: '长时间运行内存不持续增长',
            expect: '连续运行 8 小时以上，常驻内存增长不超过初始值的 20%，趋势线斜率不持续为正',
            tier: 'blocker',
            tags: ['memory-leak'],
          },
          {
            title: '句柄、连接与线程数保持稳定',
            expect: '长稳结束后打开文件句柄、数据库连接与线程数回到基线 ±10% 以内，无单调增长',
            tier: 'core',
            tags: ['handle-leak'],
          },
          {
            title: '周期任务反复执行不产生累积副作用',
            expect: '定时任务与缓存清理反复执行 100 次后无残留临时文件、未释放锁或日志暴涨',
            tier: 'core',
          },
          {
            title: '长稳结论由自动判定给出',
            expect: '报告包含趋势线与斜率阈值判定结果，保留原始监控数据可供复核，不依赖人工观感',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SCALE-LIMIT',
        name: '资源上限与背压',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '内存、CPU、磁盘与连接数上限已声明',
            expect: '各项上限以配置或容器限额形式存在，达到上限时的行为（排队、拒绝或降级）有明确定义',
            tier: 'blocker',
          },
          {
            title: '队列与缓冲有界并实施背压',
            expect: '所有内部队列长度有上限，满载时对上游施加背压或拒绝，堆积消息数不超过队列容量且无 OOM',
            tier: 'blocker',
            tags: ['backpressure'],
          },
          {
            title: '限流阈值与业务优先级匹配',
            expect: '限流按接口或租户维度配置，超限返回明确错误码与重试建议，核心接口优先级高于旁路接口',
            tier: 'core',
            tags: ['rate-limit'],
          },
          {
            title: '磁盘写满与大体积写入有保护',
            expect: '磁盘使用率超过阈值（如 85%）触发告警并停止非关键写入，已有数据不被破坏且可继续读取',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SCALE-HORIZONTAL',
        name: '水平扩展行为',
        automation: 'assisted',
        priority: 'P0',
        when: ['service', 'data', 'ml', 'monorepo'],
        cases: [
          {
            title: '实例增减不影响会话与关键状态',
            expect: '实例从 1 扩到 3 再缩回 1，业务错误率为 0，无状态丢失或重复处理',
            tier: 'blocker',
            tags: ['stateless'],
          },
          {
            title: '扩容后吞吐接近线性',
            expect: '实例数翻倍后吞吐提升不低于 1.6 倍；未达线性时给出瓶颈点（数据库、锁、带宽）的定位结论',
            tier: 'core',
          },
          {
            title: '定时任务与后台作业不重复执行',
            expect: '多实例部署下分布式锁或选主生效，同一任务在一个调度周期内只执行一次并可查执行实例',
            tier: 'core',
            tags: ['singleton-job'],
          },
          {
            title: '缩容与实例终止不中断在途请求',
            expect: '优雅停机排水期不少于 30 秒，缩容过程中客户端错误率为 0 或由重试自动消解',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SCALE-GROWTH',
        name: '数据量增长下的劣化',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '数据量放大 10 倍后核心查询仍满足延迟目标',
            expect: '将核心表数据放大 10 倍后实测 P95 增幅不超过 2 倍，或已给出分页、归档、分区的改进结论',
            tier: 'blocker',
          },
          {
            title: '表与索引体积增长有容量预测',
            expect: '按月增长速率估算未来 6 个月存储需求，预测值与容量规划文档中的数字一致',
            tier: 'core',
          },
          {
            title: '归档与冷热分离策略已生效',
            expect: '历史数据归档任务按计划运行，热表行数保持在约定阈值内，归档数据仍可按需查询',
            tier: 'core',
          },
          {
            title: '增长到阈值前有明确的扩容触发条件',
            expect: '给出行数或体积阈值与对应动作（分区、分表、扩容）及责任人，阈值在当前容量内可达',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SCALE-COST',
        name: '成本与容量规划',
        automation: 'assisted',
        priority: 'P2',
        when: ['service', 'data', 'ml', 'monorepo'],
        cases: [
          {
            title: '单位业务量的资源成本可计算',
            expect: '每千次请求或每万条处理的 CPU、内存、存储与流量成本可算出，并与预算给出差额',
            tier: 'core',
          },
          {
            title: '容量余量与扩容触发线清晰',
            expect: '当前使用率与扩容触发线（如 CPU 70%）逐项对照，给出可支撑时长估算与依据',
            tier: 'core',
          },
          {
            title: '无长期闲置或明显超配的资源',
            expect: '闲置实例与超配资源有清单、月度成本与处置结论，成本异常波动有原因说明',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'efficiency',
    name: '资源效率与前端性能',
    intro: '同样的功能是否用更少的 CPU、内存、IO、网络与电量完成，前端资源与打包产物体积是否守在预算内。',
    methods: [
      {
        id: 'EFF-PROFILE',
        name: 'CPU、内存与 IO 画像',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '关键路径的 CPU 热点有画像与占比数据',
            expect: '火焰图或 profile 覆盖核心路径，单函数 CPU 占比超过 30% 时有优化结论或保留理由',
            tier: 'core',
            tags: ['profiling'],
          },
          {
            title: '内存分配与 GC 行为处于可接受区间',
            expect: '稳态下 GC 时间占比不超过 10%，无频繁 Full GC，无反复创建的大对象未复用',
            tier: 'core',
          },
          {
            title: 'IO 以批量方式执行且次数有基线',
            expect: '文件与网络 IO 尽量批量，单请求 IO 次数有基线，数据量翻倍时 IO 次数增幅不超过 2 倍',
            tier: 'core',
          },
          {
            title: '性能优化有前后对比数据',
            expect: '每次优化记录改动前后指标（如 P95 从 400 毫秒降至 250 毫秒）与回归风险说明',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'EFF-CACHE',
        name: '缓存命中率与失效策略',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '缓存失效策略不产生脏读',
            expect: '写后失效或更新策略一致，修改数据后读取到新值的延迟不超过约定秒数，抽样 50 次无旧值',
            tier: 'blocker',
            tags: ['invalidation'],
          },
          {
            title: '缓存命中率有目标并被观测',
            expect: '关键缓存命中率有目标值（如不低于 80%）与监控曲线，低于目标持续 10 分钟触发告警',
            tier: 'core',
            tags: ['hit-ratio'],
          },
          {
            title: '缓存穿透、击穿与雪崩有防护',
            expect: '空值缓存、互斥重建或过期时间打散已实现，热点失效时数据库 QPS 增幅不超过基线 2 倍',
            tier: 'core',
          },
          {
            title: '缓存容量与淘汰策略与数据特征匹配',
            expect: '最大内存与淘汰策略已显式配置，内存占用与淘汰率在预期区间，无因淘汰导致的命中率骤降',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'EFF-NETWORK',
        name: '网络请求数量与体积',
        automation: 'auto',
        priority: 'P1',
        when: ['web', 'mobile', 'desktop'],
        cases: [
          {
            title: '首屏请求数量与传输体积在预算内',
            expect: '首屏请求数不超过约定上限（如 50 个），压缩后传输体积不超过预算值，超出即列为回归项',
            tier: 'core',
            tags: ['payload'],
          },
          {
            title: '同一资源在页面生命周期内只请求一次',
            expect: '网络面板中重复请求数为 0，无并发重复调用与已废弃但仍执行的请求',
            tier: 'core',
          },
          {
            title: '静态资源缓存头生效且二次访问命中缓存',
            expect: '静态资源带 Cache-Control/ETag，二次访问命中本地缓存，HTTP 304 或缓存命中率可观测',
            tier: 'core',
          },
          {
            title: '弱网与高延迟下体验可接受',
            expect: '在 3G 或 400 毫秒往返延迟模拟下首屏可用时间不超过约定阈值，且有加载态或骨架屏',
            tier: 'extended',
            tags: ['slow-network'],
          },
        ],
      },
      {
        id: 'EFF-ASSET',
        name: '资源压缩与懒加载',
        automation: 'auto',
        priority: 'P1',
        when: ['web', 'mobile', 'desktop'],
        cases: [
          {
            title: '文本资源启用压缩且图片按需优化',
            expect: 'JS/CSS/HTML 响应含 gzip 或 brotli 压缩，图片使用现代格式或按展示尺寸裁剪，单图不超过预算值',
            tier: 'core',
          },
          {
            title: '非首屏资源按需懒加载',
            expect: '路由级与图片懒加载生效，首屏不加载非当前路由代码块，网络瀑布图中无多余前置资源',
            tier: 'core',
          },
          {
            title: '资源指纹与长缓存策略生效',
            expect: '产物文件名含内容指纹，静态资源缓存时长不低于 30 天，发布后不出现新旧版本资源串用',
            tier: 'core',
          },
          {
            title: '预加载与预取使用克制且命中',
            expect: 'preload/prefetch 仅用于确实需要的关键资源，未使用资源数为 0，并给出预加载收益数据',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'EFF-BATTERY',
        name: '移动端电量与流量',
        automation: 'manual',
        priority: 'P1',
        when: ['mobile'],
        cases: [
          {
            title: '典型使用场景的耗电与流量有实测基线',
            expect: '前台连续使用与后台驻留的单位时间耗电百分比、流量兆字节数有实测值，并与上一版本比较',
            tier: 'core',
            tags: ['battery'],
          },
          {
            title: '埋点与同步请求批量上报',
            expect: '上报有合并窗口（如 30 秒）与批量条数上限，无高频短连接轮询，后台请求频率符合平台限制',
            tier: 'core',
          },
          {
            title: '高耗电权限使用克制且可释放',
            expect: '定位、传感器与唤醒锁仅在使用场景开启，退出后释放，权限用途有说明且用户可见',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'EFF-BUNDLE',
        name: '打包体积预算',
        automation: 'auto',
        priority: 'P0',
        when: ['web', 'mobile', 'desktop', 'plugin', 'library'],
        cases: [
          {
            title: '打包体积有预算并在 CI 中校验',
            expect: '主包或安装包体积有数值预算，超预算或单次增长超过 5% 时 CI 失败并输出构成对比',
            tier: 'blocker',
            tags: ['bundle-size'],
          },
          {
            title: '新增依赖前评估体积影响',
            expect: '依赖引入有体积影响记录，无整库引入（如全量工具库、完整日期库）导致的明显膨胀',
            tier: 'core',
          },
          {
            title: 'Tree-shaking 与代码分割有效',
            expect: '未使用的导出不进入产物，产物可分析（可视化报告或 source map），重复模块被合并为单份',
            tier: 'core',
          },
          {
            title: '产物体积构成可解释',
            expect: '体积报告列出各模块占比，前三大模块合计占比低于 70%，超标项有优化结论或保留理由',
            tier: 'extended',
          },
        ],
      },
    ],
  },
]
