/**
 * 测试域 13：工程流程与可维护性（文档 · 协作 · 技术债）。
 *
 * 字段约定与 `01-build.js` 完全一致：category → method → case 三层结构，
 * case 的 tier 决定它在哪个 depth 被展开（blocker=smoke、core=standard、
 * extended=deep、exhaustive=exhaustive），此处不再重复字段说明。
 *
 * 本域回答的不是"这次能不能跑通"，而是"这个团队能不能持续把它跑通"：
 * 文档能否让陌生人自助成功、流程是否有真实门禁、技术债是否被看见并偿还。
 * 因此本域的判定大量依赖读仓库、读历史与访谈（assisted / manual），
 * 只有少数条目可以由命令直接跑出结论。
 */

export const categories = [
  {
    id: 'docs',
    name: '文档与知识传递',
    intro: '陌生人能否只靠仓库文档完成理解、安装、使用、排障与升级，而不必追问作者。',
    methods: [
      {
        id: 'DOC-README',
        name: 'README 入口完备性',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: 'README 覆盖是什么、怎么装、怎么用、怎么贡献四类信息',
            expect: 'README 中可依次定位到项目定位、安装命令、最小使用示例、贡献入口四个独立小节',
            tier: 'blocker',
          },
          {
            title: 'README 首屏说明用途与适用边界',
            expect: '开头 10 行内给出项目定位、典型场景与明确的不适用场景，读者无需跳转即可判断是否相关',
            tier: 'core',
          },
          {
            title: '仓库存在可导航的文档索引',
            expect: 'README 或 docs/ 提供目录式入口，每条指向一个具体文档文件而非泛泛的官网链接',
            tier: 'core',
          },
          {
            title: 'README 与文档中的相对链接均可达',
            expect: '逐一点击文档内相对链接与图片路径，全部解析到仓库中存在的文件，无 404 或指向已删除文件',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DOC-QUICKSTART',
        name: '快速上手可执行性',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '快速上手步骤可原样复制执行并成功',
            expect: '按文档顺序粘贴安装与首个示例命令，在干净环境执行退出码为 0 且出现文档描述的可见输出',
            tier: 'blocker',
          },
          {
            title: '快速上手指南给出从零到首个结果的最短路径',
            expect: '所需步骤集中在同一节内，不需要读者先阅读其它文档或先完成额外的账号、服务准备',
            tier: 'core',
          },
          {
            title: '快速上手示例与当前版本接口一致',
            expect: '示例中出现的命令、参数与配置键在实现中仍然存在，且默认值与文档描述相同',
            tier: 'core',
          },
          {
            title: '示例标注前置条件与预期输出',
            expect: '每段示例注明所需环境、大致耗时与应看到的结果，读者可据此自检是否走对',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DOC-CONTRACT',
        name: '接口与配置文档一致性',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '公开接口与配置项在文档中可完整枚举',
            expect: '导出符号、命令行子命令与配置键均能在文档中找到条目，文档条目也都能在实现中找到对应物',
            tier: 'blocker',
          },
          {
            title: '文档记录的签名与默认值与实现一致',
            expect: '逐项比对参数名、类型、默认值、必填性与枚举取值，抽查不到文档与代码不符的条目',
            tier: 'core',
          },
          {
            title: '文档中的配置示例可直接通过加载校验',
            expect: '把文档示例原样写入配置文件后启动成功，不出现未知键、类型错误或缺省必填项',
            tier: 'core',
          },
          {
            title: '错误码与异常语义有文档说明',
            expect: '对外可见的错误码或异常类型在文档中给出触发条件与建议处置，而不是只列编号',
            tier: 'extended',
          },
          {
            title: '文档与实现之间存在自动化一致性校验',
            expect: '存在类型生成、schema 导出或文档用例测试等机制，实现变更会让文档检查失败',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'DOC-ADR',
        name: '架构与决策记录',
        automation: 'assisted',
        priority: 'P2',
        standard: ['iso-25010'],
        cases: [
          {
            title: '架构总览说明模块划分与主数据流',
            expect: '文档给出模块清单、各自职责与主要调用或数据流，读者可据此定位一次改动的落点',
            tier: 'core',
          },
          {
            title: '关键技术与设计决策留有决策记录',
            expect: '每篇记录包含背景、候选方案、最终结论与后果四要素，并可追溯到对应代码位置',
            tier: 'core',
          },
          {
            title: '决策记录与当前实现一致且失效项有标注',
            expect: '被推翻或过期的决策标注了状态与替代方案，未标注的记录与现有代码行为一致',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DOC-TROUBLESHOOT',
        name: '故障排查与问答沉淀',
        automation: 'assisted',
        priority: 'P2',
        cases: [
          {
            title: '常见故障可按症状检索到处置步骤',
            expect: '排障文档按错误信息或症状列出成因与处置动作，用报错原文即可在其中检索到条目',
            tier: 'core',
          },
          {
            title: '排障步骤在当前版本仍可执行',
            expect: '文档中的命令、路径与配置键在当前仓库中仍然存在，执行不会因文件缺失或参数改名而失败',
            tier: 'extended',
          },
          {
            title: '高频问题沉淀为 FAQ 或讨论区结论',
            expect: 'FAQ 或讨论区覆盖最近一批重复提问，给出结论与链接，而不是仅有关闭动作',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DOC-EVOLVE',
        name: '变更与升级指南',
        automation: 'assisted',
        priority: 'P1',
        standard: ['keep-a-changelog', 'semver'],
        cases: [
          {
            title: '变更记录按类型分类并悬挂在版本号下',
            expect: '变更记录按新增、变更、修复、移除分类，每条归属于一个具体版本号而非笼统的近期更新',
            tier: 'core',
          },
          {
            title: '破坏性变更提供可执行的升级步骤',
            expect: '每个破坏性变更列出受影响接口、替换写法与验证方法，读者按步骤可完成迁移',
            tier: 'blocker',
          },
          {
            title: '升级指南说明可跨越的版本范围',
            expect: '文档指明能否跨主版本直接升级，不允许时给必须经过的中间版本与顺序',
            tier: 'core',
          },
          {
            title: '功能说明标注适用版本范围',
            expect: '文档中的功能与示例注明自哪个版本起可用或被移除，旧版本读者不会照抄失败',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DOC-COMMENT',
        name: '注释与代码自解释',
        automation: 'assisted',
        priority: 'P2',
        standard: ['iso-25010'],
        cases: [
          {
            title: '公共接口注释说明契约而非实现细节',
            expect: '导出的函数、类型与模块带有用途、参数、返回值与异常说明，读者不必读实现即可正确调用',
            tier: 'core',
          },
          {
            title: '注释解释原因且与代码同步',
            expect: '抽查到的注释均在说明意图、约束或权衡取舍，不存在与代码漂移的逐行复述式注释',
            tier: 'core',
          },
          {
            title: '复杂分支与特殊常量有解释或已具名',
            expect: '非显然的判断、边界值与魔数被命名或注释说明来源与依据，读者可理解其存在理由',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'workflow',
    name: '协作与研发流程',
    intro: '变更从提交到合并是否受一致规则约束、有真实门禁，并且过程证据可回溯。',
    methods: [
      {
        id: 'WF-BRANCH',
        name: '分支与提交规范',
        automation: 'assisted',
        priority: 'P2',
        standard: ['iso-12207'],
        cases: [
          {
            title: '分支模型与命名约定已文档化并被实际遵循',
            expect: '贡献指南给出分支类型、命名前缀与生命周期，仓库中现有分支名与该约定一致',
            tier: 'core',
          },
          {
            title: '提交信息格式统一且可机器解析',
            expect: '提交历史符合约定的结构（如类型前缀加摘要），可用脚本按类型统计而不需人工归类',
            tier: 'core',
          },
          {
            title: '单个提交保持单一主题',
            expect: '抽查提交记录，每个提交对应一个可一句话描述的主题，未把无关重构与功能混在同一次提交',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'WF-REVIEW',
        name: '评审与合并门禁',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-12207'],
        cases: [
          {
            title: '主分支禁止直接推送且必须经过评审',
            expect: '分支保护规则要求至少一名他人评审通过才能合并，向主分支的直接推送被服务端拒绝',
            tier: 'blocker',
          },
          {
            title: '未通过必需检查的变更无法合并',
            expect: '必需状态检查失败时合并按钮不可用，绕过保护的操作有权限限制与审计记录',
            tier: 'core',
          },
          {
            title: '评审意见逐条闭环',
            expect: '每条评审意见要么对应一次修改，要么有作者或评审者的书面结论，不存在悬空讨论即合并的变更',
            tier: 'core',
          },
          {
            title: '高风险变更指定对应领域评审人',
            expect: '涉及安全、数据模式、依赖与发布配置的变更，均要求并实际获得了相应领域评审',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'WF-CI',
        name: '持续集成覆盖度',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-12207'],
        cases: [
          {
            title: '每次推送与合并请求都触发构建与测试',
            expect: '流水线对 push 与 PR 事件触发，最近若干次提交均有对应运行记录，缺失运行会被察觉',
            tier: 'blocker',
          },
          {
            title: '流水线包含静态检查且失败即失败',
            expect: '存在格式、类型或静态分析步骤，其失败会让任务整体失败，而不是记为警告后继续',
            tier: 'blocker',
          },
          {
            title: '流水线包含依赖与安全扫描',
            expect: '存在依赖审计、密钥扫描或漏洞扫描步骤，且阻断或仅告警的策略被明确记录',
            tier: 'core',
          },
          {
            title: '测试在声明的支持矩阵上运行',
            expect: '流水线在项目声明支持的主要运行时或平台上执行测试，矩阵与文档和引擎声明一致',
            tier: 'core',
          },
          {
            title: '流水线与本地命令共用同一入口',
            expect: '流水线调用的命令与开发者本地脚本一致，不存在只在 CI 中生效的另一套检查逻辑',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'WF-CI-HEALTH',
        name: '流水线时长与稳定性',
        automation: 'auto',
        priority: 'P1',
        cases: [
          {
            title: '关键流水线时长有基线且未显著劣化',
            expect: '主流程耗时与历史基线相比无数量级增长，任务设有显式超时阈值且未被频繁触发',
            tier: 'core',
          },
          {
            title: '不稳定测试可被识别并隔离',
            expect: '存在不稳定用例的标记或隔离机制，近一个月的重跑成功率与失败原因有归集记录',
            tier: 'core',
          },
          {
            title: '缓存与并行策略确实生效',
            expect: '依赖与构建缓存有命中记录，可并行的任务被拆分，冷启动与热启动耗时均有可对比数据',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'WF-DEFECT',
        name: '缺陷跟踪与优先级',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-12207'],
        cases: [
          {
            title: '缺陷有统一入口与必填信息',
            expect: '缺陷模板要求填写版本环境、复现步骤、期望与实际结果，缺失时无法提交或会被打回补充',
            tier: 'blocker',
          },
          {
            title: '优先级与严重级判定标准书面化并被一致使用',
            expect: '文档给出各级的判定依据（影响面、是否有绕过方式、数据风险），抽查缺陷的定级与依据相符',
            tier: 'core',
          },
          {
            title: '缺陷状态流转可追踪且关闭有结论',
            expect: '缺陷从新建到关闭经过明确状态，关闭时给出修复版本或不予修复的理由与决定人',
            tier: 'core',
          },
          {
            title: '缺陷与代码变更双向关联',
            expect: '修复提交引用缺陷编号，缺陷记录反向引用对应提交或合并请求，两侧可互相跳转',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'WF-TRACE',
        name: '需求到测试的可追溯性',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-12207'],
        cases: [
          {
            title: '每条验收标准都有对应的验证项',
            expect: '需求条目与测试或检查项之间存在双向引用，抽查不到未被任何验证项覆盖的验收标准',
            tier: 'blocker',
          },
          {
            title: '存在需求到实现到验证的追溯表',
            expect: '追溯表可按需求编号查到实现位置与验证方式，并随版本更新而非一次性产物',
            tier: 'core',
          },
          {
            title: '需求变更时同步更新追溯与测试',
            expect: '最近一次需求变更的提交同时更新了追溯条目与对应测试，提交记录中可查证',
            tier: 'extended',
          },
          {
            title: '覆盖缺口被显式登记而非默认通过',
            expect: '未被验证覆盖的需求以显式条目列出并标注风险与豁免理由，报告中不呈现为已通过',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'WF-ENV-PIN',
        name: '环境与版本管理',
        automation: 'assisted',
        priority: 'P1',
        standard: ['twelve-factor'],
        cases: [
          {
            title: '运行环境变化通过配置注入而非改代码',
            expect: '环境相关的地址、凭证与开关来自环境变量或配置文件，仓库中出现硬编码环境地址即不通过',
            tier: 'blocker',
          },
          {
            title: '开发、流水线与生产使用同一版本来源',
            expect: '运行时与工具版本在仓库中单点声明，流水线与文档引用同一来源，不存在手工维护的多份副本',
            tier: 'core',
          },
          {
            title: '环境变量与配置项有清单与示例',
            expect: '存在示例配置或说明文档，逐项列出键名、必填性、默认值与是否敏感',
            tier: 'core',
          },
          {
            title: '本地环境可由一条命令复现',
            expect: '提供容器定义或引导脚本，新机器执行一条命令即可得到可运行环境并通过冒烟检查',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'maintainability',
    name: '可维护性与技术债',
    intro: '结构是否允许低成本改动、债务是否被计量与偿还、新人能否独立接手而不依赖口传。',
    methods: [
      {
        id: 'MAINT-BOUNDARY',
        name: '模块边界与依赖方向',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '模块依赖图无环且方向单一',
            expect: '依赖关系呈现单向分层，不存在互相引用的模块对或跨层反向调用',
            tier: 'blocker',
          },
          {
            title: '模块对外暴露面小于内部实现',
            expect: '每个模块仅通过显式入口导出，其它模块不直接引用其内部文件或未导出符号',
            tier: 'core',
          },
          {
            title: '核心逻辑不依赖具体基础设施实现',
            expect: '领域逻辑通过接口或端口访问外部资源，替换存储、网络或界面实现无需改动核心代码',
            tier: 'core',
          },
          {
            title: '边界规则有自动化检查',
            expect: '存在依赖方向检查（静态分析规则或架构测试），新增违规依赖会让检查失败',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'MAINT-DEBT',
        name: '技术债清单与偿还计划',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '技术债集中登记并标注影响与成本',
            expect: '清单条目包含位置、成因、风险、估算工作量与优先级，而不是散落在代码标记或聊天记录中',
            tier: 'core',
          },
          {
            title: '债务条目有责任人与目标时间',
            expect: '每条债务指定负责人与目标版本或时间窗，逾期条目被重新评估而非无限顺延',
            tier: 'core',
          },
          {
            title: '债务关闭有可核对的判据',
            expect: '条目关闭时附上可验证的证据（测试、指标或已删除的代码），不是仅凭口头确认',
            tier: 'extended',
          },
          {
            title: '评审时新增债务被显式登记',
            expect: '抽查近期合并请求，含妥协实现的变更要么当场解决，要么在清单中留有对应条目',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'MAINT-DEPRECATE',
        name: '弃用与清理策略',
        automation: 'assisted',
        priority: 'P2',
        standard: ['semver'],
        cases: [
          {
            title: '弃用项有标记与替代写法',
            expect: '被弃用的接口在实现与文档中均标注弃用及替代方式，调用方在运行或编译时收到可见提示',
            tier: 'core',
          },
          {
            title: '弃用项有移除时间表',
            expect: '每个弃用项注明计划移除的版本，并按语义化版本规则与主版本变更对齐',
            tier: 'core',
          },
          {
            title: '死代码与过期兼容分支被定期清理',
            expect: '存在未使用导出、长期特性开关或兼容分支的检测记录，超期开关有收敛计划',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'MAINT-OWNERSHIP',
        name: '所有权与评审覆盖',
        automation: 'assisted',
        priority: 'P2',
        standard: ['iso-12207'],
        cases: [
          {
            title: '关键模块有明确且在职的所有者',
            expect: '所有权配置或文档覆盖核心模块，所有者与当前活跃维护者一致，没有已离开成员占位',
            tier: 'core',
          },
          {
            title: '变更默认由他人评审',
            expect: '统计近期合并记录，绝大多数变更经非作者评审，自行合并仅出现在书面列明的例外场景',
            tier: 'core',
          },
          {
            title: '无主区域被显式标出并给出处置',
            expect: '缺少所有者的模块在文档或清单中标注，并写明后续动作（认领、归档或冻结）',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'MAINT-ONBOARD',
        name: '新人上手成本',
        automation: 'manual',
        priority: 'P2',
        cases: [
          {
            title: '新人仅凭文档可在半天内完成首次变更',
            expect: '以陌生人身份只按仓库文档操作，能在记录的时间内搭好环境、跑通测试并提交一处小改动',
            tier: 'core',
          },
          {
            title: '上手卡点回流到文档',
            expect: '新人遇到的障碍已补充进贡献指南、README 或问答文档，而不是只在即时通讯中口头解答',
            tier: 'core',
          },
          {
            title: '存在面向新人的入门任务',
            expect: '仓库保留标注为入门难度的任务，并说明所需背景、涉及模块与预期产出',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'MAINT-PACE',
        name: '冻结与升级节奏',
        automation: 'assisted',
        priority: 'P2',
        cases: [
          {
            title: '依赖与工具升级有固定节奏与冻结期',
            expect: '文档说明升级周期、发布前冻结时长与例外审批方式，历史记录与节奏相符',
            tier: 'core',
          },
          {
            title: '升级提案由自动化驱动并被处置',
            expect: '存在依赖更新机器人或定期升级分支，近期提案要么被合并，要么有明确的拒绝理由',
            tier: 'core',
          },
          {
            title: '被钉住或降级的版本可解释',
            expect: '锁定或降级的依赖注明原因（兼容缺陷、供应链风险）与解除条件，不是无说明的长期钉死',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'MAINT-EXTEND',
        name: '扩展点与插件化程度',
        automation: 'assisted',
        priority: 'P2',
        cases: [
          {
            title: '存在稳定的扩展点与注册机制',
            expect: '第三方可在不修改核心代码的前提下注册扩展，扩展点有命名、契约与生命周期说明',
            tier: 'core',
          },
          {
            title: '扩展契约有版本与兼容策略',
            expect: '扩展接口的变更遵循兼容规则，破坏性变更提供迁移说明与过渡期',
            tier: 'core',
          },
          {
            title: '提供可运行的扩展示例',
            expect: '仓库含最小扩展示例或模板，按文档操作可成功加载并在运行中观察到效果',
            tier: 'extended',
          },
          {
            title: '扩展失败与核心流程相互隔离',
            expect: '扩展加载失败或运行抛错时核心功能仍可用，错误被捕获并定位到具体扩展',
            tier: 'exhaustive',
          },
        ],
      },
    ],
  },
]
