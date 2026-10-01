/**
 * 测试域 04：集成与契约（组件集成 · 契约与兼容 · 测试替身与环境）。
 *
 * 本域回答的问题是：当被测系统必须与"别的东西"相连时——其它模块、数据库、
 * 外部服务、消息中间件、缓存、另一支团队的接口——连接点上的失败语义与兼容
 * 承诺，是否被真实地验证过，而不是靠"我这边没问题"推断出来。
 *
 * 字段约定与 01-build.js 完全一致（category → method → case 三层，取值含义见
 * 该文件头部注释）；本文件是纯数据模块，不含 import、函数或副作用。
 *
 * 方法一览
 * --------
 * integration  组件集成      INT-MODULE / INT-DB / INT-EXTERNAL / INT-MQ / INT-CACHE / INT-CONFIG
 * contract     契约与兼容    CONTRACT-CDC / CONTRACT-VERSION / CONTRACT-SCHEMA / CONTRACT-SERIAL / CONTRACT-CI
 * test-double  测试替身与环境 DOUBLE-FIDELITY / DOUBLE-PARITY / DOUBLE-OFFLINE / DOUBLE-SANDBOX / DOUBLE-SEED
 */

export const categories = [
  {
    id: 'integration',
    name: '组件集成',
    intro: '模块之间以及与数据库、外部服务、消息队列、缓存之间的连接点，是否在真实失败语义下被验证。',
    methods: [
      {
        id: 'INT-MODULE',
        name: '模块间集成',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '跨模块调用只走对方公开接口',
            expect: '检索集成代码，模块间仅依赖对方导出的公开面，未直接读写其内部文件、私有字段或对方独占的存储',
            tier: 'blocker',
          },
          {
            title: '集成测试使用真实装配而非全量替身',
            expect: '存在以真实依赖装配运行的集成测试，启动成功并断言跨模块的返回值与副作用',
            tier: 'core',
          },
          {
            title: '共享状态的读写顺序被显式约束',
            expect: '涉及单例、全局状态或共享内存时，初始化顺序与并发访问规则在代码或测试中有明确约束',
            tier: 'core',
          },
          {
            title: '模块边界的数据映射有断言',
            expect: 'DTO、实体与枚举在跨模块传递时的字段映射有测试断言，字段缺失或类型不符会被测试捕获',
            tier: 'extended',
          },
          {
            title: '被依赖模块失败时上游可观测地失败',
            expect: '依赖模块不可用导致调用失败时，返回值与日志明确体现失败，且不留下半初始化状态',
            tier: 'extended',
          },
          {
            title: '跨模块依赖无循环且方向与架构约定一致',
            expect: '依赖分析工具或静态检索显示模块间无循环依赖，调用方向与分层约定一致，越层调用可被列出',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'INT-DB',
        name: '数据库集成',
        automation: 'assisted',
        priority: 'P0',
        when: ['service', 'web', 'desktop', 'mobile', 'data', 'ml', 'monorepo'],
        standard: ['iso-25010'],
        cases: [
          {
            title: '事务边界与业务操作范围一致',
            expect: '一个业务操作涉及的多表写入处于同一事务，中途抛错后数据库无可观测的部分写入（由回滚测试验证）',
            tier: 'blocker',
          },
          {
            title: '连接池上限耗尽时行为可预期',
            expect: '连接池最大连接数与等待超时已显式配置，池耗尽时请求以明确错误或排队超时结束，不无限挂起',
            tier: 'core',
          },
          {
            title: '隔离级别与并发读写行为一致',
            expect: '声明的隔离级别被并发测试验证：两个连接同时更新同一行时，不出现丢失更新或脏读',
            tier: 'core',
          },
          {
            title: '数据库错误被映射为可判定的领域错误',
            expect: '唯一键冲突、外键约束、死锁等被翻译为明确的业务错误类型，未把驱动原始异常直接透传给调用方',
            tier: 'core',
          },
          {
            title: 'schema 变更采用先扩后收的两阶段发布',
            expect: '新增字段先以可空/带默认值引入，删除字段延后到无代码引用之后，发布期间新旧版本代码可同时运行',
            tier: 'extended',
          },
          {
            title: '连接泄漏可被检测且不随时间累积',
            expect: '反复调用后活跃连接数回到基线，长稳或压测期间连接数不呈现单调上升趋势',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'INT-EXTERNAL',
        name: '外部服务与第三方 SDK',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '全部外部调用都设置了超时',
            expect: '逐一核对 HTTP、RPC 与 SDK 客户端配置，连接超时与读取超时均有显式取值，未使用无限等待的默认值',
            tier: 'blocker',
          },
          {
            title: '外部依赖失败不会拖垮主流程',
            expect: '依赖不可达时主流程以受控方式结束（明确错误或降级结果），进程不挂起、不崩溃、不产生线程堆积',
            tier: 'blocker',
          },
          {
            title: '重试次数有上限且带退避抖动',
            expect: '重试配置包含最大次数、指数退避与抖动，且仅对幂等或明确可重试的错误生效',
            tier: 'core',
          },
          {
            title: '客户端错误与服务端错误被区别处理',
            expect: '4xx 不重试、5xx 与网络错误可重试的分支在代码中存在，并有对应测试覆盖两条路径',
            tier: 'core',
          },
          {
            title: '第三方 SDK 版本锁定且升级有回归',
            expect: 'SDK 版本为确定版本，升级时对默认参数、错误码与超时行为的变更点有测试或核对记录',
            tier: 'core',
          },
          {
            title: '熔断与半开恢复状态可观测',
            expect: '连续失败达到阈值后熔断打开，指标与日志可见，冷却期后自动半开探测，恢复过程有记录',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'INT-MQ',
        name: '消息队列与事件',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'data', 'monorepo'],
        standard: ['iso-25010'],
        cases: [
          {
            title: '消费者对重复投递保持幂等',
            expect: '同一消息被投递两次时，业务结果与投递一次相同，存储与下游事件中无重复记录',
            tier: 'blocker',
          },
          {
            title: '消费失败进入重试与死信而非丢失',
            expect: '处理抛异常的消息按策略重试，超过阈值后进入死信队列，且可由日志定位原始消息内容',
            tier: 'blocker',
          },
          {
            title: '确认发生在业务提交之后',
            expect: '消息确认或位点提交位于业务事务成功之后，消费者在提交前崩溃不会造成消息已确认但业务未落库',
            tier: 'core',
          },
          {
            title: '顺序语义与分区键有明确约定',
            expect: '需要顺序的场景使用同一分区键，乱序容忍范围在代码或文档中说明并有测试覆盖',
            tier: 'core',
          },
          {
            title: '消费者对新版本事件保持向前兼容',
            expect: '新增字段与未知事件类型不会导致消费者崩溃或丢弃，未识别消息按约定进入保留或告警路径',
            tier: 'core',
          },
          {
            title: '积压与消费延迟可观测并告警',
            expect: '队列深度与消费延迟有指标采集，阈值告警已配置，可复现一次积压被观测到的记录',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'INT-CACHE',
        name: '缓存集成',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'web', 'desktop', 'mobile', 'data', 'monorepo'],
        cases: [
          {
            title: '缓存与数据源的一致性策略明确',
            expect: '写路径的失效或更新顺序（如先写库再删缓存）在全部写入口保持一致，并有测试验证不会长期返回旧值',
            tier: 'blocker',
          },
          {
            title: '缓存穿透有防护措施',
            expect: '查询不存在的键时使用空值缓存或布隆过滤器等防护，重复请求不会全部落到数据源（可由计数验证）',
            tier: 'core',
          },
          {
            title: '过期时间带抖动以避免同时失效',
            expect: '批量写入的缓存键过期时间包含随机抖动，热点键重建有互斥或逻辑过期保护，并有并发重建测试',
            tier: 'core',
          },
          {
            title: '缓存不可用时降级到数据源',
            expect: '缓存服务中断后请求仍返回正确数据（性能下降但功能可用），有故障注入或人工演练证据',
            tier: 'core',
          },
          {
            title: '键命名与值格式可版本化演进',
            expect: '缓存键包含命名空间或版本前缀，值格式变更可通过版本号平滑过渡，旧格式数据可被识别并重建',
            tier: 'extended',
          },
          {
            title: '缓存容量上限与淘汰策略已配置',
            expect: '内存上限、淘汰策略与命中率指标均已配置，压测后缓存占用不出现无界增长',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'INT-CONFIG',
        name: '配置与环境切换',
        automation: 'assisted',
        priority: 'P0',
        standard: ['twelve-factor'],
        cases: [
          {
            title: '缺少必填配置时启动失败并指出键名',
            expect: '移除一个必填配置后进程以非零码退出，错误信息包含该配置键名，不进入带默认值的静默运行',
            tier: 'blocker',
          },
          {
            title: '环境相关取值不硬编码在源码中',
            expect: '检索代码无硬编码的地址、端口、凭证或环境判断分支，相关取值全部来自配置或环境变量',
            tier: 'blocker',
          },
          {
            title: '配置在启动阶段完成类型与范围校验',
            expect: '非法取值（负超时、未知模式、越界并发数）在启动时被拒绝并给出键名与合法范围，而非运行期才失败',
            tier: 'core',
          },
          {
            title: '各环境配置键集合保持一致',
            expect: '开发、预发与生产的配置键清单可对比，不存在仅在某一个环境存在的隐式键',
            tier: 'core',
          },
          {
            title: '敏感配置不进入仓库与日志',
            expect: '仓库中无真实密钥与口令，日志与错误输出对敏感值做脱敏，凭证由密钥管理或环境注入',
            tier: 'core',
          },
          {
            title: '配置变更的生效方式已定义',
            expect: '每类配置的生效方式（热加载或重启）被文档化，且不存在修改后既不生效也无提示的静默行为',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'contract',
    name: '契约与兼容',
    intro: '接口两侧对"什么算合法"的理解是否被机器化固化，并在接口演进中保持向后兼容。',
    methods: [
      {
        id: 'CONTRACT-CDC',
        name: '消费者驱动契约',
        automation: 'auto',
        priority: 'P1',
        when: ['service', 'web', 'desktop', 'mobile', 'library', 'plugin', 'monorepo'],
        standard: ['pact'],
        cases: [
          {
            title: '契约由消费方定义并在两侧验证',
            expect: '契约文件来自消费方的期望，提供方与消费方流水线都能执行验证且结果一致',
            tier: 'blocker',
          },
          {
            title: '契约覆盖代码实际依赖的字段与状态码',
            expect: '比对真实请求响应与契约定义，不存在代码已依赖但契约未声明的字段、状态码或错误结构',
            tier: 'core',
          },
          {
            title: '不兼容的提供方改动会被契约测试阻断',
            expect: '删除字段或修改字段类型后契约验证失败并使流水线变红，可复现一次被拦截的记录',
            tier: 'core',
          },
          {
            title: '契约中的前置状态可重复准备',
            expect: '每个 provider state 的准备工作可独立重跑，用例之间无执行顺序依赖，随机顺序下同样通过',
            tier: 'core',
          },
          {
            title: '契约版本与发布版本可互相追溯',
            expect: '由契约文件或验证报告可定位到提供方版本，能回答"哪次发布破坏了哪条契约"',
            tier: 'extended',
          },
          {
            title: '消费方清单完整且新增需登记',
            expect: '已知消费方全部登记在契约仓库中，新增消费方未登记时发布流程会提示或阻断',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'CONTRACT-VERSION',
        name: '接口版本演进与向后兼容',
        automation: 'auto',
        priority: 'P0',
        standard: ['semver', 'openapi'],
        cases: [
          {
            title: '破坏性变更伴随新版本或并行提供',
            expect: '删除字段、改变语义等破坏性改动伴随新版本路径或特性开关，旧版本在承诺窗口内仍可用',
            tier: 'blocker',
          },
          {
            title: '兼容性由自动化 diff 在 CI 中检查',
            expect: '存在新旧接口定义的比对步骤（如 OpenAPI diff、ABI diff），破坏性变更使流水线失败',
            tier: 'core',
          },
          {
            title: '新增可选字段不破坏旧消费方',
            expect: '旧客户端收到含新增字段的响应仍能正确解析与处理，严格模式客户端的兼容性有测试说明',
            tier: 'core',
          },
          {
            title: '弃用字段在移除前有观察期与依据',
            expect: '字段标记弃用后先统计调用方使用量，使用量归零或迁移完成后才按计划移除，过程有记录',
            tier: 'core',
          },
          {
            title: '兼容性承诺已文档化',
            expect: '文档明确列出被视为破坏性的变更类型、支持的版本窗口与通知方式，与实际做法一致',
            tier: 'extended',
          },
          {
            title: '灰度期新旧版本共存被验证',
            expect: '新旧版本同时提供服务时数据读写互相兼容（双写双读或字段可缺省），有共存期测试或演练记录',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'CONTRACT-SCHEMA',
        name: 'schema 演进',
        automation: 'auto',
        priority: 'P0',
        standard: ['openapi'],
        cases: [
          {
            title: '新增必填字段不直接发布',
            expect: '新增字段先以可选加默认值的方式引入，旧数据与旧客户端在过渡期不受影响，有过渡期测试',
            tier: 'blocker',
          },
          {
            title: '类型变更遵循放宽而非收紧',
            expect: '枚举新增取值、数值范围扩大等放宽型变更被允许且消费方能兼容；收紧型变更通过新字段或新版本提供',
            tier: 'core',
          },
          {
            title: 'schema 兼容性规则被机器校验',
            expect: '存在兼容性检查（向后、向前或全兼容）在 CI 中执行，所选规则与消费方实际情况相符并有说明',
            tier: 'core',
          },
          {
            title: '删除字段前确认无消费方读取',
            expect: '删除前有访问统计或消费方确认记录，删除后历史数据仍可被解析（未知字段按约定处理）',
            tier: 'core',
          },
          {
            title: '未知字段的处理策略一致',
            expect: '解析器对未知字段忽略或保留的策略在全项目一致，严格校验模式的适用范围有说明',
            tier: 'extended',
          },
          {
            title: 'schema 历史与数据版本可追溯',
            expect: 'schema 变更历史可回溯到版本，抽样历史数据在最新 schema 下仍能被正确读取',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'CONTRACT-SERIAL',
        name: '序列化格式兼容',
        automation: 'assisted',
        priority: 'P1',
        standard: ['json-api', 'rfc9110'],
        cases: [
          {
            title: '序列化格式与字段命名在两侧一致',
            expect: '媒体类型、字符集与字段命名风格（camelCase 或 snake_case）在收发两侧一致，无二次转换或双重解析',
            tier: 'blocker',
          },
          {
            title: '时间、数字与空值的表示有明确约定',
            expect: '时间带时区偏移、超长整数不被精度截断、null 与字段缺省语义可区分，三类均有往返测试断言',
            tier: 'core',
          },
          {
            title: '可选字段与默认值在版本间保持稳定',
            expect: '旧版本写入的数据在新版本读取时字段默认值不产生语义漂移，有跨版本回归测试',
            tier: 'core',
          },
          {
            title: '跨语言序列化差异已被覆盖',
            expect: '枚举、布尔、空数组、NaN 与 Infinity 等在各语言实现下的差异点有测试，行为一致或有明确约定',
            tier: 'core',
          },
          {
            title: '二进制或紧凑格式的兼容性有交叉读写测试',
            expect: 'protobuf、Avro、MessagePack 等格式的新旧 schema 交叉读写成功，字段编号未被复用或改动',
            tier: 'extended',
          },
          {
            title: '非 UTF-8 与异常字节序列被显式处理',
            expect: '非法编码输入返回明确错误而非产生乱码落库，处理路径有测试用例',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'CONTRACT-CI',
        name: '契约测试的 CI 门禁',
        automation: 'auto',
        priority: 'P1',
        standard: ['pact'],
        cases: [
          {
            title: '契约验证在合并前必须通过',
            expect: '提供方与消费方流水线均执行契约验证，失败时阻断合并，可复现一次被阻断的流水线记录',
            tier: 'blocker',
          },
          {
            title: '契约文件变更走代码评审',
            expect: '契约文件在版本控制中受评审约束，契约变更与对应代码变更出现在同一变更请求中',
            tier: 'core',
          },
          {
            title: '契约验证不依赖共享可变环境',
            expect: '验证在临时启动或容器化的提供方实例上运行，结果不受共享环境可用性与残留数据影响',
            tier: 'core',
          },
          {
            title: '契约验证结果可作为审计证据引用',
            expect: '流水线保留契约验证报告或日志，可按提交或版本检索到具体断言与失败原因',
            tier: 'core',
          },
          {
            title: '契约覆盖失败路径而不只覆盖成功路径',
            expect: '契约断言包含 4xx 与 5xx 响应的结构，错误体字段被消费方依赖时同样受契约保护',
            tier: 'extended',
          },
          {
            title: '契约漂移有定期检测与告警',
            expect: '存在按计划对预发或生产实例执行契约验证的任务，漂移发生时产生可追溯的告警记录',
            tier: 'exhaustive',
          },
        ],
      },
    ],
  },
  {
    id: 'test-double',
    name: '测试替身与环境',
    intro: '测试用的替身、环境与数据是否忠实于生产，避免把"替身通过"误当成"真实通过"。',
    methods: [
      {
        id: 'DOUBLE-FIDELITY',
        name: '替身保真度',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '替身返回的数据结构与真实实现同源',
            expect: 'mock 数据由真实响应样例或契约生成，字段名与嵌套结构与真实实现一致，差异可由比对发现',
            tier: 'blocker',
          },
          {
            title: '替身与真实实现受同一接口约束',
            expect: '替身实现与生产实现共享同一接口或类型定义，签名漂移会导致编译或测试失败',
            tier: 'core',
          },
          {
            title: '替身能模拟失败与超时而非只返回成功',
            expect: 'mock 可被配置返回错误码、超时与慢响应，测试覆盖这些分支并断言调用方的处理结果',
            tier: 'core',
          },
          {
            title: '被替换的边界范围经过评审且有记录',
            expect: '每个被 mock 的依赖在测试或评审记录中说明理由，核心业务判定逻辑未被替身绕过',
            tier: 'core',
          },
          {
            title: '假实现的保真度有验证机制',
            expect: '内存数据库、假队列等 fake 与真实实现共用同一套测试，或存在对拍测试验证行为一致',
            tier: 'extended',
          },
          {
            title: '替身与真实实现的已知差异被记录',
            expect: '文档列出替身不支持的特性与不同错误码，读者可判断哪些结论不能由替身测试得出',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DOUBLE-PARITY',
        name: '测试环境与生产差异',
        automation: 'assisted',
        priority: 'P1',
        standard: ['twelve-factor'],
        cases: [
          {
            title: '关键运行时与中间件版本与生产同主版本',
            expect: '语言运行时、数据库与中间件的主版本与生产一致，存在差异时有书面记录与影响评估',
            tier: 'blocker',
          },
          {
            title: '环境差异清单被维护并逐项评估影响',
            expect: '存在测试环境与生产的差异清单（规模、副本数、超时、外部依赖），每项给出是否影响结论的判断',
            tier: 'core',
          },
          {
            title: '测试环境不直连生产数据与凭证',
            expect: '测试环境使用独立账号与脱敏数据，配置中不存在生产数据库地址或生产第三方凭证',
            tier: 'core',
          },
          {
            title: '环境特有分支可枚举且有理由',
            expect: '源码中的环境判断分支数量可列出，每处说明存在原因，且生产分支同样被测试覆盖',
            tier: 'core',
          },
          {
            title: '环境可从脚本或容器重复搭建',
            expect: '按文档执行脚本或容器编排可重建环境，手工步骤被记录且不成为通过的唯一路径',
            tier: 'extended',
          },
          {
            title: '仅在生产生效的配置在准生产验证过',
            expect: 'TLS、反向代理、限流、鉴权与域名跳转等生产专属配置在预发或准生产环境至少验证一次并有记录',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DOUBLE-OFFLINE',
        name: '外部依赖不可用时的测试策略',
        automation: 'assisted',
        priority: 'P2',
        standard: ['iso-25010'],
        cases: [
          {
            title: '关键外部依赖存在可离线运行的替代路径',
            expect: '断开外网或外部服务下线时，核心测试套件仍可运行并给出可信结论，不因网络不可达整体失败',
            tier: 'blocker',
          },
          {
            title: '依赖不可用时区分跳过与通过',
            expect: '无法执行时用例标记为跳过并计数，报告明确区分跳过与通过，不出现静默通过的用例',
            tier: 'core',
          },
          {
            title: '故障注入覆盖超时、错误与连接拒绝',
            expect: '存在可复现的注入手段（延迟、错误率、连接拒绝），并断言被测系统的降级与重试行为',
            tier: 'core',
          },
          {
            title: '存在录制回放或沙箱账号替代真实计费调用',
            expect: '测试通过录制回放或沙箱完成，不触发真实扣费、真实短信或真实邮件发送',
            tier: 'core',
          },
          {
            title: '离线数据的新鲜度与来源可追溯',
            expect: '录制或快照数据记录采集时间与对应接口版本，过期数据能被识别而不是无声沿用',
            tier: 'extended',
          },
          {
            title: '依赖恢复后的补偿路径被测试',
            expect: '外部依赖恢复后积压的重试、补单或同步任务能正确执行，存在覆盖该场景的测试或演练记录',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DOUBLE-SANDBOX',
        name: '沙箱与仿真服务',
        automation: 'assisted',
        priority: 'P2',
        standard: ['iso-25010'],
        cases: [
          {
            title: '沙箱凭证与生产凭证严格隔离',
            expect: '沙箱密钥无法访问生产，凭证存放位置分离，代码与配置中不存在用于测试的生产凭证',
            tier: 'blocker',
          },
          {
            title: '仿真服务的关键行为与真实服务对齐',
            expect: '沙箱的成功、失败与异步回调路径与真实服务一致，已识别的差异记录在对接文档中',
            tier: 'core',
          },
          {
            title: '沙箱调用不产生真实副作用',
            expect: '支付、短信、推送等操作在沙箱中不触达真实用户或真实资金，可由沙箱账单或回执验证',
            tier: 'core',
          },
          {
            title: '沙箱自身限流被识别并正确应对',
            expect: '测试对沙箱的限流与配额有退避与串行策略，不把被限流误判为被测功能缺陷',
            tier: 'core',
          },
          {
            title: '沙箱故障不会被计为测试通过',
            expect: '沙箱不可用导致的不确定结果被标记为环境问题并单独统计，不混入通过率',
            tier: 'extended',
          },
          {
            title: '沙箱与生产的接口差异有回归清单',
            expect: '每次对接或升级时核对差异清单（字段、状态机、错误码、异步通知时序）并留存核对记录',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DOUBLE-SEED',
        name: '数据种子与清理',
        automation: 'assisted',
        priority: 'P1',
        when: ['service', 'web', 'desktop', 'mobile', 'data', 'monorepo'],
        standard: ['iso-25010'],
        cases: [
          {
            title: '种子数据可重复生成且结果确定',
            expect: '种子由脚本生成并使用固定随机种子，连续两次生成的关键字段与数量完全一致',
            tier: 'blocker',
          },
          {
            title: '用例结束后数据被清理',
            expect: '每个用例清理其创建的数据，重复运行同一套件不因残留数据而失败，清理结果可由查询核验',
            tier: 'blocker',
          },
          {
            title: '用例之间无数据顺序依赖',
            expect: '任意顺序执行或单独执行任一用例都能通过，不存在依赖先前用例写入数据的隐式前提',
            tier: 'core',
          },
          {
            title: '种子数据不含真实个人信息',
            expect: '种子使用合成或脱敏数据，检索种子文件与夹具无来自生产库的真实身份、联系方式或支付信息',
            tier: 'core',
          },
          {
            title: '并行执行时的数据隔离方式明确',
            expect: '存在命名空间、独立 schema 或每用例事务等隔离手段，并行运行时用例之间数据不互相干扰',
            tier: 'extended',
          },
          {
            title: '大数据量种子有体积与耗时预算',
            expect: '种子规模有上限或按需加载，测试启动耗时不因种子膨胀显著增长，超出预算时有告警',
            tier: 'exhaustive',
          },
        ],
      },
    ],
  },
]
