/**
 * 测试域 02：静态质量（类型系统 · 代码规范 · 可维护性静态面）。
 *
 * 纯数据模块：只导出 categories，不含 import、函数与副作用；
 * 字段约定与写作范例见 01-build.js 与 docs/CATALOG-AUTHORING.md。
 *
 * 层级结构：category（测试域）→ method（测试方法）→ case（可独立判定的测试项）。
 *
 * automation 约定：只有当"一条命令的退出码或机器可读输出"即可判定结论时才标 auto
 * （类型检查、lint、格式检查、死代码扫描、重复率、依赖图、包元数据校验），
 * 其余为 assisted；需要人工或业务方确认的标为 manual。
 */

export const categories = [
  {
    id: 'static-analysis',
    name: '类型系统与静态检查',
    intro: '不运行代码就能拦下的缺陷：类型检查是否生效、严格度是否足够、类型与实际运行结果是否一致。',
    methods: [
      {
        id: 'STATIC-TYPES',
        name: '类型检查与门禁',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010', 'istqb'],
        cases: [
          {
            title: '全量类型检查在当前提交上零错误通过',
            expect: 'tsc --noEmit / mypy / cargo check 等命令退出码为 0，输出中无任何类型错误条目',
            tier: 'blocker',
            automation: 'auto',
          },
          {
            title: '类型检查已纳入 CI 必过关卡',
            expect: 'PR 流水线包含类型检查步骤，该步骤失败时合并被阻断，分支保护规则中列为必需检查',
            tier: 'core',
            tags: ['ci'],
          },
          {
            title: '类型检查覆盖全部生产源码路径',
            expect: '检查范围包含所有生产代码目录，排除项仅限生成代码、构建产物与第三方 vendor 目录',
            tier: 'core',
          },
          {
            title: '本地可在分钟级完成一次类型检查',
            expect: '存在文档化的本地检查命令，改动若干文件后执行可在分钟级返回结果而非全量重建',
            tier: 'extended',
          },
          {
            title: '缺少类型声明的依赖有统一处理策略',
            expect: '无类型声明的第三方库要么被本地声明文件覆盖，要么集中在统一 shim 中并注明来源与版本',
            tier: 'extended',
          },
          {
            title: '类型错误总量有基线与收敛趋势',
            expect: '新增类型错误被禁止；历史遗留错误以显式清单登记，条目数逐版本下降或有豁免说明',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'STATIC-NULL',
        name: '可空性与严格模式',
        automation: 'assisted',
        priority: 'P0',
        standard: ['cwe', 'iso-25010'],
        cases: [
          {
            title: '严格检查开关全量开启且未被逐文件关闭',
            expect: 'strict / strictNullChecks / noImplicitAny（或语言等价开关）在配置中为真，源码内无逐文件关闭注释',
            tier: 'blocker',
          },
          {
            title: '可空返回值在使用前被显式判空',
            expect: '可能为 null/undefined 的返回值、可选字段与查询结果在解引用前均有判空或抛错分支',
            tier: 'core',
          },
          {
            title: '非空断言与强制类型转换有使用上限',
            expect: '非空断言与强制转换的出现次数有统计，且集中在带注释说明的位置，无静默压制类型错误',
            tier: 'core',
          },
          {
            title: '外部输入在边界处先完成类型收窄',
            expect: '请求体、环境变量与配置文件读取后先经 schema 校验或类型守卫，再进入类型化代码路径',
            tier: 'core',
            tags: ['input-validation'],
          },
          {
            title: '错误路径不产生隐式空值传播',
            expect: '空值沿调用链向上传递前被拦截，运行日志中不出现 undefined is not a function、NoneType 类崩溃',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'STATIC-GENERICS',
        name: '泛型与接口契约',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '公开泛型参数带约束且不滥用宽松类型',
            expect: '公共接口的泛型参数有 extends 或等价约束声明，any/unknown 仅出现在确需逃逸的边界并有注释',
            tier: 'core',
          },
          {
            title: '接口变更后全部实现保持同步',
            expect: '接口或抽象类新增成员后，所有实现类同步实现，类型检查无缺失成员或签名不匹配',
            tier: 'blocker',
            automation: 'auto',
          },
          {
            title: '联合类型分支被穷尽处理',
            expect: '针对联合类型的条件链有兜底分支（default 或 never 断言），新增成员时编译器能报出未处理分支',
            tier: 'core',
          },
          {
            title: '关键领域概念使用独立类型而非裸基础类型',
            expect: '订单号、金额、状态等概念有独立类型或品牌类型，不出现同签名下多个字符串参数互相错传',
            tier: 'extended',
          },
          {
            title: '对外契约以接口或协议暴露而非具体实现',
            expect: '模块公开签名的参数与返回值使用接口、协议或抽象类型，调用方无需 import 具体实现类',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'STATIC-RUNTIME',
        name: '类型与运行时一致性',
        automation: 'assisted',
        priority: 'P0',
        standard: ['cwe', 'iso-25010'],
        cases: [
          {
            title: '编译期类型与运行时实际结构逐字段一致',
            expect: '对外返回的 JSON 或序列化结构抽样核对，无「类型中声明存在、运行时缺失」的字段',
            tier: 'blocker',
          },
          {
            title: '序列化与反序列化往返不丢失必填字段',
            expect: '同一对象序列化再反序列化后，类型定义中的必填字段全部存在且值等价',
            tier: 'core',
          },
          {
            title: '类型声明与运行时校验共用同一来源',
            expect: 'schema（Zod、JSON Schema、protobuf IDL）为唯一事实来源，类型由其推导而非手工重复声明',
            tier: 'core',
          },
          {
            title: '动态属性与类型逃逸处集中登记',
            expect: '存在逃逸清单，记录位置、原因与替代计划，清单外的代码不出现绕过类型系统的访问',
            tier: 'extended',
          },
          {
            title: '跨进程或跨语言边界的类型映射已核对',
            expect: 'IDL 与两端生成代码一致，字段编号、可空性与默认值语义在两端相同',
            tier: 'extended',
            tags: ['contract'],
          },
        ],
      },
      {
        id: 'STATIC-PUBLISH',
        name: '类型声明对外发布',
        automation: 'assisted',
        priority: 'P1',
        standard: ['semver'],
        when: ['library', 'plugin'],
        cases: [
          {
            title: '发布包声明了可解析的类型入口',
            expect: '包元数据的 types 与 exports 指向实际存在的声明文件，安装后编辑器能解析到公开类型',
            tier: 'blocker',
            automation: 'auto',
          },
          {
            title: '声明文件不引用未发布的内部路径',
            expect: '生成的声明中不出现源码相对路径、src 内部模块或未导出的私有类型引用',
            tier: 'core',
          },
          {
            title: '类型层面的破坏性变更走主版本',
            expect: '公开类型签名的删改被变更检测记录（api-extractor、cargo public-api 等），并按语义化版本发布',
            tier: 'core',
          },
          {
            title: '类型导出与运行时导出一一对应',
            expect: '声明中导出的符号与运行时实际导出一致，不存在类型存在而运行时为 undefined 的成员',
            tier: 'core',
          },
          {
            title: '公开类型兼容性在流水线中被回归比对',
            expect: '存在公开 API 快照或兼容性检查步骤，不兼容变更会导致构建失败而非静默发布',
            tier: 'extended',
            tags: ['ci'],
          },
        ],
      },
    ],
  },
  {
    id: 'lint-format',
    name: '代码规范与格式',
    intro: '规范是否被机器强制：lint 与格式化在本地、编辑器与 CI 上给出同一结论，豁免可被审计。',
    methods: [
      {
        id: 'LINT-CONFIG',
        name: '规则配置与门禁',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '仓库内只有一份实际生效的 lint 配置',
            expect: '根配置与子包配置的继承关系明确，可用 --print-config 类命令导出实际规则集且无相互覆盖',
            tier: 'core',
          },
          {
            title: 'Lint 在 CI 上覆盖全仓库且无错误',
            expect: 'lint 命令退出码为 0，输出中 error 计数为 0（warning 另行登记而非静默忽略）',
            tier: 'blocker',
            automation: 'auto',
            tags: ['ci'],
          },
          {
            title: '规则集启用了隐患与安全相关类别',
            expect: '配置继承了公认规则集或显式开启错误隐患、安全、可访问性类别，而非停留在空规则的最小配置',
            tier: 'core',
          },
          {
            title: '新增代码不得引入新的 lint 错误',
            expect: '存在增量门禁（只检查改动范围或对比基线），历史错误数量随提交不增长',
            tier: 'core',
          },
          {
            title: '规则变更经评审且可追溯',
            expect: '关闭或降级规则需附原因与替代控制，配置改动可定位到具体 PR 与评审记录',
            tier: 'extended',
          },
          {
            title: '警告总量有基线并逐版本收敛',
            expect: 'warning 总数被记录在案，最近若干版本未出现只增不减的趋势',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'LINT-IGNORE',
        name: '忽略与豁免治理',
        automation: 'assisted',
        priority: 'P1',
        standard: ['cwe'],
        cases: [
          {
            title: '行内禁用指令指定具体规则并附原因',
            expect: 'eslint-disable / nolint / noqa 均写明规则名与理由，不出现整文件级别的裸禁用',
            tier: 'core',
          },
          {
            title: '忽略列表范围最小且逐条可解释',
            expect: 'ignore 配置仅覆盖生成代码、构建产物与第三方目录，无业务源码目录被整体屏蔽',
            tier: 'core',
          },
          {
            title: '禁用指令总量有基线并被审查',
            expect: '禁用指令计数纳入统计，新增禁用必须在代码评审中获得说明',
            tier: 'extended',
          },
          {
            title: '安全类规则不可被静默关闭',
            expect: '注入、密钥硬编码、危险函数等安全规则的关闭需安全责任人确认并留存记录',
            tier: 'blocker',
          },
          {
            title: '豁免条目有到期与复核机制',
            expect: '豁免登记了有效期或复核责任人，过期条目在流水线中产生告警而非继续生效',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'FMT-CONSIST',
        name: '格式化一致性',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '格式化工具与配置在仓库内唯一',
            expect: 'Prettier、gofmt、rustfmt、black 等只有一份配置，不存在多份风格文件互相冲突',
            tier: 'core',
          },
          {
            title: '全仓库格式检查在 CI 中通过',
            expect: '格式检查命令以 --check 模式运行且退出码为 0，报告中没有未格式化的文件',
            tier: 'blocker',
            automation: 'auto',
          },
          {
            title: '格式与 lint 的职责不重叠冲突',
            expect: '缩进、引号、分号等纯风格项交由 formatter，lint 不再重复报告同类问题',
            tier: 'extended',
          },
          {
            title: '生成文件与第三方文件被排除而非手工改写',
            expect: '生成代码在格式化忽略清单中，重新生成后内容不变',
            tier: 'extended',
          },
          {
            title: '换行符与编码在跨平台检出后统一',
            expect: '.editorconfig 或等价配置固定 LF 与 UTF-8，Windows 与 macOS 检出后格式检查结论一致',
            tier: 'core',
            tags: ['cross-platform'],
          },
        ],
      },
      {
        id: 'LINT-UNUSED',
        name: '未使用代码与导入',
        automation: 'assisted',
        priority: 'P1',
        standard: ['cwe'],
        cases: [
          {
            title: '无未使用的导入与变量',
            expect: '未使用符号检查（no-unused-vars、unused 等）已启用且命中数为 0',
            tier: 'core',
            automation: 'auto',
          },
          {
            title: '无未使用的私有函数与本地定义',
            expect: '检查覆盖私有函数、局部常量与仅内部使用的类型，命中数为 0 或已登记保留原因',
            tier: 'core',
          },
          {
            title: '无多余或未使用的依赖声明',
            expect: '依赖使用分析（depcheck、cargo-udeps 等）结果为空，或差异项均有书面解释',
            tier: 'extended',
            automation: 'auto',
          },
          {
            title: '注释掉的代码块已被清理',
            expect: '源码中不残留大段被注释的实现代码，历史版本交由版本控制保留',
            tier: 'extended',
          },
          {
            title: '生成代码不参与未使用检查',
            expect: '检查范围排除生成文件与构建产物，报告中不出现此类噪声命中',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'code-quality',
    name: '复杂度与可维护性静态面',
    intro: '代码结构与依赖关系是否可持续演进：复杂度、体量、重复、死代码、命名与分层方向。',
    methods: [
      {
        id: 'QUAL-COMPLEX',
        name: '复杂度控制',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010', 'istqb'],
        cases: [
          {
            title: '函数圈复杂度未超过约定阈值',
            expect: '复杂度扫描（lizard、radon、eslint complexity）无函数超过阈值，超限项已登记并说明',
            tier: 'core',
            automation: 'auto',
          },
          {
            title: '嵌套层级受控且深层嵌套已消解',
            expect: '函数内嵌套不超过约定层数（如 4 层），超出者已用早返回或提取函数处理',
            tier: 'extended',
          },
          {
            title: '复合布尔条件可读且被具名化',
            expect: '不存在超过约定项数的复合条件表达式，多条件判定被提取为具名谓词或函数',
            tier: 'core',
          },
          {
            title: '复杂度阈值在流水线中作为门禁',
            expect: '新增或修改的函数复杂度超限会导致构建失败，或必须走显式豁免流程',
            tier: 'core',
            tags: ['ci'],
          },
          {
            title: '超阈值函数处于测试覆盖之下并有整改排期',
            expect: '所有超限函数均被测试覆盖，且在技术债清单中登记了责任人与计划版本',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'QUAL-SIZE',
        name: '函数与文件体量',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '函数长度未超过约定阈值',
            expect: '长度统计中无函数超过约定行数，超限项有拆分说明或豁免记录',
            tier: 'core',
          },
          {
            title: '文件与模块体量处于可控范围',
            expect: '单文件行数未超过约定上限，超大文件已按职责拆分而非继续追加',
            tier: 'core',
          },
          {
            title: '参数个数与数据结构深度受约束',
            expect: '无超过约定个数的参数列表，多参数场景改用配置对象或结构体传递',
            tier: 'extended',
          },
          {
            title: '模块职责可用一句话概括',
            expect: '主要模块的职责能被单句描述，不存在同时承担数据访问、业务规则与展示的模块',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'QUAL-DUP',
        name: '重复代码治理',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '重复代码比例低于约定阈值',
            expect: '重复检测（jscpd、sonar、cpd）报告的重复率低于阈值，超限代码块已登记',
            tier: 'core',
            automation: 'auto',
          },
          {
            title: '同一逻辑多处出现时被抽取共享实现',
            expect: '同一业务规则在 3 处以上重复出现的场景已收敛为公共函数或模块',
            tier: 'core',
          },
          {
            title: '不因消除重复而引入过度抽象',
            expect: '共享抽象至少有 2 个真实调用方，不存在仅转发一层且只被调用一次的包装函数',
            tier: 'extended',
          },
          {
            title: '新增代码的复制粘贴会被发现',
            expect: '重复检测对增量改动生效，或评审清单中明确包含跨文件复制检查项',
            tier: 'extended',
          },
          {
            title: '测试代码重复有明确取舍策略',
            expect: '测试中的重复通过 fixture 或工厂收敛，或有意识地保留直白写法并注明理由',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'QUAL-DEAD',
        name: '死代码与不可达分支',
        automation: 'assisted',
        priority: 'P1',
        standard: ['cwe', 'iso-25010'],
        cases: [
          {
            title: '无长期未被调用的导出与私有函数',
            expect: '死代码扫描结果为空，或全部登记为兼容保留并注明保留期限',
            tier: 'core',
            automation: 'auto',
          },
          {
            title: '无被开关永久关闭的代码分支',
            expect: '已全量发布的特性开关分支被清理，开关清单中不存在长期停留在关闭状态的条目',
            tier: 'core',
            tags: ['feature-flag'],
          },
          {
            title: '不可达语句与恒不成立的条件被移除',
            expect: '静态分析未报告 unreachable 语句，或报告项已修复而非通过规则豁免掩盖',
            tier: 'core',
          },
          {
            title: '废弃接口的删除有下线流程',
            expect: '标记为弃用的接口有替代方案与下线时间点，不出现无限期保留的 deprecated 代码',
            tier: 'extended',
          },
          {
            title: '死代码检测纳入常规流水线',
            expect: '存在定期执行的死代码扫描任务，结果有明确负责人跟进处理',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'QUAL-NAMING',
        name: '命名与分层依赖方向',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '同一概念在全仓库使用统一术语',
            expect: '不存在多个别名指向同一实体（如 user、member、account 混用），术语表与代码一致',
            tier: 'core',
          },
          {
            title: '命名风格在语言与项目内统一',
            expect: '文件、类型、函数、常量的命名风格符合项目约定，并由 lint 规则或评审清单约束',
            tier: 'extended',
          },
          {
            title: '分层依赖方向单向且依赖图无环',
            expect: '依赖检查工具（dep-cruiser、ArchUnit、import-linter 等）退出码为 0，报告中无循环依赖',
            tier: 'blocker',
            automation: 'auto',
            tags: ['architecture'],
          },
          {
            title: '跨层直接访问被禁止或显式豁免',
            expect: '不存在绕过业务层直接读写数据层的调用，例外位置有注释与豁免记录',
            tier: 'core',
            tags: ['architecture'],
          },
          {
            title: '模块边界由工具强制而非口头约定',
            expect: '存在导入边界规则并在 CI 生效，违规导入会导致构建失败而不是仅在文档中约束',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'QUAL-SMELL',
        name: '坏味道密度与技术债指标',
        automation: 'assisted',
        priority: 'P2',
        standard: ['iso-25010', 'istqb'],
        cases: [
          {
            title: '静态扫描的技术债指标有基线',
            expect: '技术债规模、坏味道计数等指标已被记录，最近版本未出现未解释的增长',
            tier: 'core',
            automation: 'auto',
          },
          {
            title: '阻断级与严重级坏味道清零或有排期',
            expect: '扫描结果中 blocker 与 critical 级问题为 0，或每条都有责任人与整改版本',
            tier: 'core',
            automation: 'auto',
          },
          {
            title: '技术债偿还与新功能开发同节奏',
            expect: '迭代中有固定的技术债容量分配，历史条目数量呈下降或持平而非只增不减',
            tier: 'extended',
          },
          {
            title: '同类坏味道按模式统一整改',
            expect: '同一类坏味道在多处出现时以一次重构统一处理，而非逐点打补丁式修复',
            tier: 'exhaustive',
          },
        ],
      },
    ],
  },
]
