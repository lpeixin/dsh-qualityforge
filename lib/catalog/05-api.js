/**
 * 测试域 05：接口层（协议与语义 · 错误模型与韧性 · 接口演进与文档）。
 *
 * 本域把接口当作一份对外承诺来审：请求与响应是否符合 HTTP/RPC 的通用语义，
 * 失败时是否给出可被程序化处理的错误，演进时是否不静默打断既有消费方。
 *
 * 适用项目类型：service / web / mobile / desktop —— 即"跨进程或对外暴露接口"的
 * 系统。纯库的公开 API 兼容性由 04-integration 的契约域覆盖，本域不重复。
 *
 * 字段约定与 01-build.js 完全一致（category → method → case 三层，取值含义见
 * 该文件头部注释）；本文件是纯数据模块，不含 import、函数或副作用。
 *
 * 方法一览
 * --------
 * api-semantics  协议与语义     API-RESOURCE / API-STATUS / API-VALIDATION / API-PAGINATION / API-IDEMPOTENCY / API-CONCURRENCY / API-CONTENT
 * api-errors     错误模型与韧性 API-ERR / API-ERR-LEAK / API-RATELIMIT / API-TIMEOUT / API-PARTIAL / API-DEGRADE
 * api-evolution  接口演进与文档 API-SPEC / API-DEPRECATE / API-EXAMPLES / API-VERSIONING / API-ERRCODE
 */

export const categories = [
  {
    id: 'api-semantics',
    name: '协议与语义',
    intro: '接口是否符合 HTTP/RPC 的通用语义：资源、状态码、校验、分页、幂等与并发控制。',
    when: ['service', 'web', 'mobile', 'desktop'],
    methods: [
      {
        id: 'API-RESOURCE',
        name: '资源与动词语义',
        automation: 'assisted',
        priority: 'P0',
        standard: ['rfc9110', 'json-api'],
        cases: [
          {
            title: '读请求不产生副作用',
            expect: '重复执行 GET/HEAD 后资源状态、计数与外部调用均无变化，缓存与预取不会触发写入',
            tier: 'blocker',
          },
          {
            title: '同一资源的动词语义保持一致',
            expect: 'PUT 与 DELETE 重复执行结果与执行一次相同，POST 用于创建且非幂等，PATCH 仅做部分更新',
            tier: 'blocker',
          },
          {
            title: '路径表达资源而非动作',
            expect: '路由中不出现 get、doUpdate、query 这类动词式路径，资源层级与实际归属关系一致',
            tier: 'core',
          },
          {
            title: '声明的媒体类型与实际载荷一致',
            expect: 'Content-Type 与响应体格式匹配（JSON 接口不返回 text/html），Accept 不支持时返回 406',
            tier: 'core',
          },
          {
            title: '集合与单资源的表示差异有约定',
            expect: '列表返回摘要字段、详情返回完整字段的规则被文档化，且由测试断言字段集合符合约定',
            tier: 'extended',
          },
          {
            title: '安全与幂等方法属性与实现相符',
            expect: 'OPTIONS 或 Allow 返回真实可用方法集合，GET/HEAD/PUT/DELETE/OPTIONS 的安全性与幂等性标注与实际行为一致',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-STATUS',
        name: '状态码正确性',
        automation: 'auto',
        priority: 'P0',
        standard: ['rfc9110'],
        cases: [
          {
            title: '成功路径返回语义正确的状态码',
            expect: '创建返回 201 并带 Location，删除成功返回 200 或 204，异步受理返回 202，断言逐项覆盖',
            tier: 'blocker',
          },
          {
            title: '未找到与依赖不可用被区分',
            expect: '资源不存在返回 404 而非 200 空体或 500，依赖不可用返回 503 而非 500，两条路径均有测试',
            tier: 'blocker',
          },
          {
            title: '客户端错误不使用 5xx 表达',
            expect: '参数错误与校验失败返回 4xx，检索服务端异常日志确认无因入参导致的 5xx 记录',
            tier: 'core',
          },
          {
            title: '重定向与缓存状态码使用正确',
            expect: '301/302 与 307/308 的选择与方法保持语义匹配，条件请求命中时返回 304 且响应体为空',
            tier: 'core',
          },
          {
            title: '状态码集合在文档与实现中一致',
            expect: '接口定义中声明的响应码与实际返回集合无缺漏，未声明的状态码不会出现在响应中',
            tier: 'extended',
          },
          {
            title: '边界输入下的状态码保持确定',
            expect: '超长、空值、非法编码与超大载荷等边界输入返回确定的状态码，不出现 500 或连接被重置',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-VALIDATION',
        name: '请求校验与拒绝',
        automation: 'auto',
        priority: 'P0',
        standard: ['rfc9110', 'rfc9457'],
        cases: [
          {
            title: '必填字段缺失时指出具体字段路径',
            expect: '响应返回 400 或 422，错误体包含缺失字段的完整路径与原因，而非泛化的参数错误或 500',
            tier: 'blocker',
          },
          {
            title: '类型与格式非法被拒绝而非静默转换',
            expect: '数字传字符串、枚举越界、日期格式错误等返回字段级校验错误，不进入业务逻辑也不被隐式强转',
            tier: 'blocker',
          },
          {
            title: '未知字段的处理策略全局一致',
            expect: '严格模式拒绝、宽松模式忽略的策略在全部接口一致，且有一组用例验证两种模式的行为',
            tier: 'core',
          },
          {
            title: '载荷大小、深度与数组长度有上限',
            expect: '超出限制的请求返回 413 或 400，超大嵌套与超长数组不会引起内存或 CPU 异常',
            tier: 'core',
          },
          {
            title: '校验发生在任何副作用之前',
            expect: '校验失败请求不产生数据库写入、消息投递或外部调用，可由审计日志或计数核验',
            tier: 'core',
          },
          {
            title: '多字段同时非法时一次性返回全部错误',
            expect: '同一请求存在多个非法字段时，错误体包含全部错误项并可按字段定位，而非只返回第一条',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'API-PAGINATION',
        name: '分页、过滤与排序',
        automation: 'auto',
        priority: 'P1',
        standard: ['json-api'],
        cases: [
          {
            title: '翻页期间数据变动不产生重复或漏项',
            expect: '使用游标或稳定排序键分页时，翻页过程中新增或删除数据不会导致同一记录重复出现或被跳过',
            tier: 'blocker',
          },
          {
            title: '分页参数有确定默认值与上限',
            expect: '未传分页参数时返回确定的默认页大小，超过上限的请求被截断或拒绝，行为与文档一致',
            tier: 'core',
          },
          {
            title: '过滤与排序字段受白名单约束',
            expect: '未登记字段或注入式表达式被拒绝并返回 4xx，不产生数据库错误、全表扫描或字段泄漏',
            tier: 'core',
          },
          {
            title: '分页元信息可被程序化消费',
            expect: '响应包含总量、下一页游标或 Link 头等元信息，字段名与语义在文档中声明并有断言',
            tier: 'core',
          },
          {
            title: '深分页与非法游标有确定行为',
            expect: '超大偏移量或伪造游标返回确定错误或空集，不出现请求超时、5xx 或全量扫描',
            tier: 'extended',
          },
          {
            title: '排序在等值键上保持稳定',
            expect: '排序键存在重复值时返回顺序稳定（存在次级排序键），多次相同请求结果顺序一致',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-IDEMPOTENCY',
        name: '幂等性与重复提交',
        automation: 'auto',
        priority: 'P0',
        standard: ['rfc9110'],
        cases: [
          {
            title: '同一幂等键的重复请求只产生一次副作用',
            expect: '携带相同幂等键的两次请求只写入一条记录、只触发一次外部调用，第二次返回首次结果',
            tier: 'blocker',
          },
          {
            title: '重复的 PUT 与 DELETE 不改变最终状态',
            expect: '连续两次相同 PUT 或 DELETE 后资源状态与执行一次相同，返回状态码符合规范约定',
            tier: 'blocker',
          },
          {
            title: '幂等键的作用域、有效期与冲突语义明确',
            expect: '键与用户及接口绑定，过期后的行为有定义，同键不同载荷时返回冲突错误并有测试覆盖',
            tier: 'core',
          },
          {
            title: '超时重试路径不会重复扣减',
            expect: '响应超时后客户端自动重试的情况下，余额、库存或账目只变化一次，有对账或断言作为证据',
            tier: 'core',
          },
          {
            title: '幂等记录的存储有上限与清理策略',
            expect: '幂等键存储配置了有效期与容量指标，失败请求的结果不会被永久缓存并当作成功返回',
            tier: 'extended',
          },
          {
            title: '限流与重试叠加时幂等保证仍成立',
            expect: '在触发限流并重试的并发场景下，幂等语义不被绕过，存在并发测试或压测证据',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-CONCURRENCY',
        name: '并发与竞态',
        automation: 'assisted',
        priority: 'P0',
        standard: ['rfc9110'],
        cases: [
          {
            title: '并发更新不静默丢失数据',
            expect: '两个并发写同一资源时，未带版本条件的后写请求失败或结果可解释，最终值不出现无提示覆盖',
            tier: 'blocker',
          },
          {
            title: '条件请求与版本标识被正确实现',
            expect: '使用过期 ETag 或版本号更新返回 412 或 409，未带条件头的写请求策略已被定义并有测试',
            tier: 'blocker',
          },
          {
            title: '读改写场景具备原子性',
            expect: '库存、余额、配额等场景在并发下不出现超卖、负值或超额，存在并发测试断言最终值',
            tier: 'core',
          },
          {
            title: '竞态窗口在代码中可识别且被保护',
            expect: 'check-then-act、双重初始化、缓存回填等模式均列出并说明其同步或幂等保护措施',
            tier: 'core',
          },
          {
            title: '冲突响应包含恢复所需信息',
            expect: '409 或 412 响应返回当前版本标识或差异内容，客户端可据此重取并重试',
            tier: 'extended',
          },
          {
            title: '跨节点并发的一致性策略有说明',
            expect: '分布式场景下的最终一致性方案与冲突解决规则被记录，且有对应测试或演练验证',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-CONTENT',
        name: '内容协商',
        automation: 'auto',
        priority: 'P1',
        standard: ['rfc9110', 'json-api'],
        cases: [
          {
            title: '不支持的 Accept 被明确拒绝',
            expect: '请求不可用的媒体类型时返回 406 或按声明降级，不会无视 Accept 直接返回默认格式',
            tier: 'blocker',
          },
          {
            title: '字符集声明正确且往返无乱码',
            expect: '响应声明 UTF-8 且中文、emoji 与特殊符号经写入读出后与原始值一致',
            tier: 'core',
          },
          {
            title: '压缩协商按声明生效',
            expect: 'Accept-Encoding 为 gzip 或 br 时响应被压缩且 Vary 头正确，不压缩时客户端仍可正确解析',
            tier: 'core',
          },
          {
            title: '错误响应遵循同一协商规则',
            expect: '错误响应返回可解析的结构化格式（如 problem+json），不返回 HTML 错误页或纯文本堆栈',
            tier: 'core',
          },
          {
            title: '自定义媒体类型的版本化有解析约定',
            expect: 'vendor 媒体类型（如 application/vnd.api.v2+json）的路由与解析规则有测试覆盖',
            tier: 'extended',
          },
          {
            title: '语言协商与内容语言头一致',
            expect: 'Accept-Language 影响返回文案时 Content-Language 正确，不支持的语言回退到默认并有测试',
            tier: 'exhaustive',
          },
        ],
      },
    ],
  },
  {
    id: 'api-errors',
    name: '错误模型与韧性',
    intro: '失败时接口给出什么：错误结构是否统一、是否泄漏内部细节，以及限流、超时、部分失败与降级的表现。',
    when: ['service', 'web', 'mobile', 'desktop'],
    methods: [
      {
        id: 'API-ERR',
        name: '错误结构统一',
        automation: 'auto',
        priority: 'P0',
        standard: ['rfc9457'],
        cases: [
          {
            title: '全部错误响应使用同一结构与字段语义',
            expect: '抽样各接口的 4xx 与 5xx 响应，错误体字段名与含义一致，不存在接口各自定义错误格式',
            tier: 'blocker',
          },
          {
            title: '错误体包含可编程处理的稳定错误码',
            expect: '错误响应含机器可读的错误码与人类可读说明，客户端可按错误码分支而不依赖文案匹配',
            tier: 'core',
          },
          {
            title: '错误响应附带定位信息',
            expect: '错误体包含请求标识或追踪号，可据此在日志中检索到同一次请求的完整记录',
            tier: 'core',
          },
          {
            title: '错误结构与文档化定义一致',
            expect: '接口定义中声明的错误 schema 与实际返回逐字段一致，未出现额外或缺失字段',
            tier: 'core',
          },
          {
            title: '同一错误在不同接口下编码一致',
            expect: '语义相同的错误（如资源不存在、版本冲突）在全部接口返回相同错误码与状态码',
            tier: 'extended',
          },
          {
            title: '错误响应本身不会被缓存或被当作成功',
            expect: '错误响应带有正确的缓存控制头，网关与客户端不会缓存错误结果，可复现重试后恢复正常',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-ERR-LEAK',
        name: '错误信息不泄漏内部细节',
        automation: 'auto',
        priority: 'P0',
        standard: ['owasp-top10', 'rfc9457'],
        cases: [
          {
            title: '错误响应不包含堆栈、SQL 或文件路径',
            expect: '触发内部异常后响应体无堆栈、SQL 语句、表名与本地路径，仅返回受控的错误码与说明',
            tier: 'blocker',
          },
          {
            title: '错误信息不暴露内部组件与版本',
            expect: '响应头与错误体不含框架、中间件与依赖的版本号或内部主机名，可由抽样响应核对',
            tier: 'core',
          },
          {
            title: '认证与授权失败不泄漏资源存在性',
            expect: '无权限访问与资源不存在返回一致的外部表现（同为 404 或同为 403），不通过差异暴露对象是否存在',
            tier: 'core',
          },
          {
            title: '调试模式在非开发环境强制关闭',
            expect: '生产与预发的调试开关为关闭状态，异常时返回通用错误而非详细诊断信息',
            tier: 'core',
          },
          {
            title: '输入回显经过转义与截断',
            expect: '错误响应中回显的用户输入被转义且长度受限，不构成反射型注入或响应体膨胀',
            tier: 'extended',
          },
          {
            title: '错误细节仅写入服务端日志并做脱敏',
            expect: '完整异常记录在服务端日志中且对敏感字段脱敏，响应与日志的详细程度差异明确',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-RATELIMIT',
        name: '限流与退避',
        automation: 'auto',
        priority: 'P1',
        standard: ['rfc9110', 'rfc9457'],
        cases: [
          {
            title: '超出配额的请求返回 429 而非 5xx',
            expect: '持续超过限额的请求返回 429，服务本身保持可用，日志中无因限流产生的异常堆栈',
            tier: 'blocker',
          },
          {
            title: '限流响应带可解析的重试提示',
            expect: '429 响应包含 Retry-After 或等价的重置时间字段，取值与实际恢复窗口相符',
            tier: 'core',
          },
          {
            title: '限流响应说明配额维度与余额',
            expect: '响应头或错误体暴露配额上限、剩余量与重置时机，客户端可据此自适应而不盲目重试',
            tier: 'core',
          },
          {
            title: '限流维度与阈值有文档且与实现一致',
            expect: '文档说明限流按用户、IP 或接口维度及阈值，实测行为与文档描述一致',
            tier: 'core',
          },
          {
            title: '客户端具备退避与抖动策略',
            expect: '客户端 SDK 或调用代码在收到 429 后按退避与抖动重试，不出现紧密循环重试',
            tier: 'extended',
          },
          {
            title: '限流不影响健康检查与关键路径',
            expect: '健康检查、鉴权刷新等关键接口在限流生效时仍可用，或拥有独立配额并有验证记录',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-TIMEOUT',
        name: '超时与取消传播',
        automation: 'assisted',
        priority: 'P0',
        standard: ['grpc', 'rfc9110'],
        cases: [
          {
            title: '请求处理有明确的服务端超时',
            expect: '存在请求级超时配置，超时后返回确定的错误响应（如 504 或约定的错误码），不无限占用连接',
            tier: 'blocker',
          },
          {
            title: '调用方取消会传播到下游',
            expect: '客户端断开或取消后，下游查询与外部调用被中止，可由日志或资源计数验证未继续执行',
            tier: 'blocker',
          },
          {
            title: '超时预算在调用链上逐级递减',
            expect: '各层超时之和不超过上游预算，链路配置可核对，不出现下游超时长于上游的配置',
            tier: 'core',
          },
          {
            title: '超时与业务失败在错误码上可区分',
            expect: '超时、取消与业务校验失败返回不同的错误码或标识，客户端可据此决定是否重试',
            tier: 'core',
          },
          {
            title: '长任务通过异步与轮询规避超时',
            expect: '耗时超预算的操作返回受理标识与查询入口，不阻塞请求直至网关超时',
            tier: 'extended',
          },
          {
            title: '取消后不留下半成品数据',
            expect: '请求被取消时已执行的部分写入被回滚或以明确的状态标记，不产生孤儿记录',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-PARTIAL',
        name: '部分失败与批量接口',
        automation: 'assisted',
        priority: 'P1',
        standard: ['rfc9457', 'rfc9110'],
        cases: [
          {
            title: '批量接口逐项返回处理结果',
            expect: '批量请求部分失败时，响应逐项给出成功或失败状态，成功项确实生效且失败项不影响其它项',
            tier: 'blocker',
          },
          {
            title: '批量结果与请求项可一一对应',
            expect: '响应项携带请求中的索引或标识，顺序不确定时调用方仍能准确对应，有乱序场景测试',
            tier: 'core',
          },
          {
            title: '批量大小有上限且超限被拒绝',
            expect: '超过单次批量上限的请求返回 400 或 413，不会因超大请求导致超时或部分静默丢弃',
            tier: 'core',
          },
          {
            title: '批量整体状态码语义与局部失败匹配',
            expect: '全部成功返回 200，部分成功使用 207 或 200 加明细，语义在文档中说明并被测试固定',
            tier: 'core',
          },
          {
            title: '批量操作的整体原子性有明确承诺',
            expect: '文档说明批量是全成功或全失败还是允许部分成功，实测行为与该承诺一致',
            tier: 'extended',
          },
          {
            title: '并发批量请求不放大副作用',
            expect: '并发提交同一批数据时，幂等键或去重逻辑避免重复处理，可由数据计数核验',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-DEGRADE',
        name: '降级响应',
        automation: 'auto',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '非核心依赖故障时核心接口仍可用',
            expect: '关闭推荐、统计等非核心依赖后核心接口返回 2xx 且业务字段完整，有故障注入证据',
            tier: 'blocker',
          },
          {
            title: '降级结果对调用方可见',
            expect: '降级响应通过状态码、响应头或字段标记降级状态，调用方不会把降级数据误认为完整数据',
            tier: 'core',
          },
          {
            title: '降级有明确触发条件与恢复条件',
            expect: '触发阈值与恢复方式在配置或代码中明确，压测或演练可复现进入与退出降级的完整过程',
            tier: 'core',
          },
          {
            title: '降级不返回错误的空值语义',
            expect: '降级时返回空集、默认值与错误码之间有明确区分，不把失败伪装成"无数据"',
            tier: 'core',
          },
          {
            title: '降级期间的日志与指标可观测',
            expect: '降级状态有指标与日志记录，可按时间窗统计降级持续时长与影响请求量',
            tier: 'extended',
          },
          {
            title: '降级开关可人工干预且操作有记录',
            expect: '存在可审计的人工开关或配置，操作记录包含操作者、时间与影响范围',
            tier: 'exhaustive',
          },
        ],
      },
    ],
  },
  {
    id: 'api-evolution',
    name: '接口演进与文档',
    intro: '接口定义、文档与实现是否一致，以及弃用、版本化与错误码字典能否支撑长期演进。',
    when: ['service', 'web', 'mobile', 'desktop'],
    methods: [
      {
        id: 'API-SPEC',
        name: '接口定义与实现一致',
        automation: 'auto',
        priority: 'P1',
        standard: ['openapi', 'grpc'],
        cases: [
          {
            title: '接口定义可从源码或注解自动生成',
            expect: 'schema 由代码或注解生成并纳入版本控制，不存在与实现分别手工维护的两份定义',
            tier: 'blocker',
          },
          {
            title: '定义中的路径、参数与响应与实测一致',
            expect: '将实测请求响应与定义比对，路径、必填参数与响应字段无缺漏或多余',
            tier: 'core',
          },
          {
            title: '定义校验在 CI 中执行且失败阻断',
            expect: 'schema 语法与规范校验作为流水线步骤，存在一次因定义非法而失败的记录',
            tier: 'core',
          },
          {
            title: '定义覆盖鉴权、错误与限流等横切语义',
            expect: '安全方案、错误响应、限流响应头等横切约定在定义中声明，而非仅描述成功路径',
            tier: 'extended',
          },
          {
            title: 'gRPC 场景下 proto 与实现行为一致',
            expect: 'proto 的字段编号、服务方法与实际实现一致，反射或描述符可导出并与仓库版本匹配',
            tier: 'extended',
          },
          {
            title: '未文档化的内部接口被明确隔离',
            expect: '内部或实验性接口在路由与定义中显式标记，不暴露在公开文档与网关路由中',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-DEPRECATE',
        name: '弃用与迁移策略',
        automation: 'assisted',
        priority: 'P1',
        standard: ['openapi', 'rfc9110'],
        cases: [
          {
            title: '弃用接口返回显式信号而非静默维持',
            expect: '被弃用接口返回 Deprecation 或 Sunset 等标准头并给出替代路径，实测响应可验证',
            tier: 'blocker',
          },
          {
            title: '弃用有下线时间表与通知记录',
            expect: '存在弃用公告、下线日期与通知对象记录，时间表与实际下线动作一致',
            tier: 'core',
          },
          {
            title: '迁移指南覆盖调用方需要的全部改动',
            expect: '指南列出新旧字段或路径的映射、行为差异与示例，按指南迁移可跑通',
            tier: 'core',
          },
          {
            title: '弃用接口的使用量可统计',
            expect: '存在按调用方统计弃用接口用量的手段，可判断是否仍有消费方在依赖',
            tier: 'core',
          },
          {
            title: '下线前完成消费方确认或强制拦截',
            expect: '零调用后下线，或对残余调用方有明确的沟通与拦截策略并留有记录',
            tier: 'extended',
          },
          {
            title: '弃用状态在文档与定义中同步标记',
            expect: '接口定义、文档与代码注解三处的弃用标记一致，无一处遗漏',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-EXAMPLES',
        name: '文档示例可执行',
        automation: 'assisted',
        priority: 'P2',
        standard: ['openapi'],
        cases: [
          {
            title: '文档中的首个示例可直接复制执行',
            expect: '按文档示例原样执行（补充占位凭证后）返回与示例一致的响应结构与状态码',
            tier: 'blocker',
          },
          {
            title: '示例请求与响应字段由定义生成或校验',
            expect: '示例字段与 schema 一致，存在校验步骤可发现示例与定义漂移',
            tier: 'core',
          },
          {
            title: '示例覆盖鉴权、分页与错误处理',
            expect: '文档包含获取凭证、翻页与处理错误的完整示例，而非只有成功路径',
            tier: 'core',
          },
          {
            title: '示例中的地址与凭证为占位符',
            expect: '示例使用可替换的占位符或公开沙箱地址，不包含内部域名、真实令牌或内部账号',
            tier: 'core',
          },
          {
            title: '接口调试入口与文档保持同步',
            expect: '在线调试台或集合文件与最新定义同步，可按文档步骤成功发起一次真实请求',
            tier: 'extended',
          },
          {
            title: '示例随版本发布一并更新',
            expect: '接口变更的同一变更请求中更新了对应示例，抽查最近若干次变更无遗漏',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-VERSIONING',
        name: '版本化策略',
        automation: 'assisted',
        priority: 'P0',
        standard: ['openapi', 'semver'],
        cases: [
          {
            title: '版本方案在全局一致且有文档',
            expect: '路径版本、媒体类型版本或请求头版本的选择在全项目统一，文档说明其规则与示例',
            tier: 'blocker',
          },
          {
            title: '多版本并行时互不干扰',
            expect: '旧版本请求仍返回旧结构且行为不变，新版本变更不影响旧版本调用，有并行版本测试',
            tier: 'core',
          },
          {
            title: '未指定版本的请求有确定行为',
            expect: '不传版本信息时按默认版本处理或返回明确错误，行为被文档化并有测试固定',
            tier: 'core',
          },
          {
            title: '版本升级幅度与变更性质匹配',
            expect: '破坏性变更提升主版本并在变更记录中标注，兼容性变更不滥用新版本号',
            tier: 'core',
          },
          {
            title: '同时支持的版本数量有上限与退出机制',
            expect: '明确同时维护的版本数量与各版本支持窗口，超出窗口的版本有下线流程记录',
            tier: 'extended',
          },
          {
            title: '版本路由与网关配置可核对',
            expect: '网关或路由配置中的版本映射与代码中的实现一致，无已下线版本仍被路由的情况',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'API-ERRCODE',
        name: '错误码字典',
        automation: 'assisted',
        priority: 'P1',
        standard: ['rfc9457', 'grpc'],
        cases: [
          {
            title: '错误码集中定义且全局唯一',
            expect: '错误码在单一位置或枚举中定义，检索无重复编号或同一编号对应多种语义',
            tier: 'blocker',
          },
          {
            title: '字典包含触发条件与处理建议',
            expect: '每个错误码说明触发条件、可重试性与调用方建议动作，而非仅有一句描述',
            tier: 'core',
          },
          {
            title: '错误码与 HTTP 状态码的映射稳定',
            expect: '映射关系集中维护且不随实现漂移，抽查若干错误码的实际响应状态码与映射一致',
            tier: 'core',
          },
          {
            title: '代码中不存在字典之外的野生错误码',
            expect: '检索代码与响应构造点，未登记的字面量错误码不存在，或已由校验步骤拦截',
            tier: 'core',
          },
          {
            title: '错误码只增不删且有弃用标记',
            expect: '历史错误码未被复用或删除，失效项标记为弃用并说明替代码',
            tier: 'extended',
          },
          {
            title: 'gRPC 状态码与业务错误码正确对应',
            expect: '业务错误码到 gRPC 状态码的映射有测试，细节字段承载业务错误码而非全部映射为 Unknown',
            tier: 'exhaustive',
          },
        ],
      },
    ],
  },
]
