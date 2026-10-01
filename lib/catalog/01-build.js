/**
 * 测试域 01：工程基座（构建 · 依赖 · 发布）。
 *
 * 本文件是测试方法目录的**格式范例**：其余域文件必须保持完全一致的字段约定。
 *
 * 层级结构：category（测试域）→ method（测试方法）→ case（可独立判定的测试项）。
 *
 * 字段约定
 * --------
 * category
 *   id       kebab-case，全局唯一
 *   name     中文域名称
 *   intro    一句话说明该域回答什么问题
 *   when     适用项目类型（省略 = 全部）；取值见 catalog/index.js 的 KINDS
 *   methods  该域下的测试方法
 *
 * method
 *   id         大写下划线风格，全局唯一
 *   name       方法名（企业研发流程中的通用叫法）
 *   automation auto 可由 qf_exec/qf_probe 自动判定；assisted 需 Agent 读码/分析判定；manual 需人工或业务方确认
 *   priority   方法默认优先级，可被 case 覆盖
 *   standard   方法对应的外部标准/框架（可选，用于报告中的合规映射）
 *   cases      测试项
 *
 * case
 *   title      可独立判定的测试项标题：唯一、具体、不含编号（编号由程序生成）
 *   expect     通过判据：必须是可观测、可复现的事实描述，不能是"符合预期"这类空话
 *   tier       blocker  不通过则不可交付（smoke 深度只跑这一层）
 *              core     常规交付必查（standard 深度）
 *              extended 深度审计补充（deep 深度）
 *              exhaustive 极限穷尽（exhaustive 深度）
 *   priority   省略则继承 method.priority
 *   automation 省略则继承 method.automation
 *   when       省略则继承 category.when
 *   tags       便于检索的短标签（可选）
 */

export const categories = [
  {
    id: 'build',
    name: '构建与编译',
    intro: '项目能否在干净环境被稳定还原、编译，并产出可运行、可校验的制品。',
    methods: [
      {
        id: 'BUILD-TOOLCHAIN',
        name: '工具链与版本约束',
        automation: 'assisted',
        priority: 'P0',
        standard: ['twelve-factor', 'iso-25010'],
        cases: [
          {
            title: '工具链版本要求已声明且被自动化约束',
            expect: 'engines / .nvmrc / rust-toolchain / go.mod 等显式声明版本范围，CI 与本地一致',
            tier: 'blocker',
          },
          {
            title: '构建脚本在文档中声明的入口可一条命令跑通',
            expect: 'README 或 CONTRIBUTING 中记载的构建命令，在干净机器上原样执行成功',
            tier: 'core',
          },
          {
            title: '构建过程不依赖开发者机器上的隐式全局工具',
            expect: '关键步骤全部来自项目依赖或脚本，而非未声明的全局安装',
            tier: 'core',
          },
          {
            title: '构建耗时与资源占用在可接受范围内并有基线',
            expect: '全量构建耗时与内存峰值已记录，未出现数量级退化',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'BUILD-CLEAN',
        name: '干净环境还原',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '空缓存空目录下按文档步骤安装依赖成功',
            expect: '在全新克隆目录执行安装命令退出码为 0，无人工干预或手工补包',
            tier: 'blocker',
          },
          {
            title: '再次安装不改变依赖树与锁文件',
            expect: '重复安装后 lockfile 无 diff，依赖树哈希保持不变',
            tier: 'core',
          },
          {
            title: '安装与构建可离线或经私有镜像完成',
            expect: '镜像/代理配置已文档化，受限网络环境下仍可完成安装',
            tier: 'extended',
          },
          {
            title: '构建不写入源码目录之外的非预期位置',
            expect: '产物集中于约定目录，未污染用户 HOME 或系统目录',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'BUILD-DETERMINISM',
        name: '可复现构建',
        automation: 'assisted',
        priority: 'P1',
        standard: ['slsa'],
        cases: [
          {
            title: '同一提交两次构建产物二进制一致',
            expect: '两次构建的制品校验和相同，或差异已被明确记录并解释',
            tier: 'core',
          },
          {
            title: '构建过程不嵌入时间戳、机器名与本地路径',
            expect: '产物中不出现可变元数据，或在构建时被规范化',
            tier: 'extended',
          },
          {
            title: '构建输出与构建日志被归档以便追溯',
            expect: 'CI 保留制品与日志，可按版本号回溯到具体提交',
            tier: 'core',
          },
        ],
      },
      {
        id: 'BUILD-ARTIFACT',
        name: '制品与打包',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '制品包含运行所需全部文件与资源',
            expect: '按制品清单核对无缺失，解包后可直接启动或引用',
            tier: 'blocker',
          },
          {
            title: '制品不包含测试代码、调试开关与源码映射泄漏',
            expect: '生产制品无测试桩、dev-only 分支默认关闭、sourcemap 策略明确',
            tier: 'core',
          },
          {
            title: '制品内部的入口、导出与包元数据正确',
            expect: 'main/exports/bin 指向存在的文件，包名版本与实际一致',
            tier: 'blocker',
          },
          {
            title: '制品体积有预算且未异常膨胀',
            expect: '关键产物大小与上一版本对比无未解释的增长',
            tier: 'extended',
          },
          {
            title: '制品带有可校验的完整性与签名信息',
            expect: '发布物提供校验和或签名，消费方可验证来源',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'BUILD-FAILFAST',
        name: '失败快速暴露',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '缺失关键配置时构建立即失败并指出缺失项',
            expect: '报错信息包含缺失的键名，不静默降级继续构建',
            tier: 'core',
          },
          {
            title: '编译错误信息可定位到文件与行号',
            expect: '错误输出包含路径与位置，无需二次排查',
            tier: 'extended',
          },
          {
            title: '构建警告被治理而非长期忽略',
            expect: 'deprecation 与告警有评估记录或收敛计划，未持续堆积',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'deps',
    name: '依赖治理',
    intro: '第三方依赖是否被锁定、收敛、授权清晰，并且可持续升级。',
    methods: [
      {
        id: 'DEPS-LOCK',
        name: '锁定与一致性',
        automation: 'auto',
        priority: 'P0',
        cases: [
          {
            title: '锁文件存在且与清单文件一致',
            expect: 'lockfile 与 manifest 同步提交，安装后无未提交变更',
            tier: 'blocker',
          },
          {
            title: '生产依赖与开发依赖边界清晰',
            expect: '运行时不需要的包未进入生产依赖集合',
            tier: 'core',
          },
          {
            title: '私有源、scope 与认证方式已文档化',
            expect: '仓库配置与凭证获取方式有说明，且未提交真实凭证',
            tier: 'core',
          },
        ],
      },
      {
        id: 'DEPS-RANGE',
        name: '版本范围收敛',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '无 `*` / `latest` 等不可控版本声明',
            expect: '所有依赖使用确定版本或受控范围',
            tier: 'core',
          },
          {
            title: '同一依赖不存在无意的多版本共存',
            expect: '依赖树中重复版本已收敛或有明确原因',
            tier: 'extended',
          },
          {
            title: '传递依赖的关键安全修复可被强制覆盖',
            expect: '存在 overrides/resolutions 等机制并有使用记录',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DEPS-HEALTH',
        name: '依赖健康度',
        automation: 'auto',
        priority: 'P1',
        standard: ['owasp-top10'],
        cases: [
          {
            title: '无已知高危及以上漏洞的依赖',
            expect: '依赖审计命令退出码为 0，或残余风险有书面豁免',
            tier: 'blocker',
          },
          {
            title: '无已停止维护的关键依赖',
            expect: '核心依赖仍活跃，弃用项有替换计划与排期',
            tier: 'core',
          },
          {
            title: '依赖数量与体积在合理范围',
            expect: '直接依赖数量与总体积有基线，无重复造轮子式引入',
            tier: 'extended',
          },
          {
            title: '依赖升级有回归路径',
            expect: '存在依赖升级 PR 机制或定期升级记录，测试可覆盖升级风险',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DEPS-LICENSE',
        name: '许可证与合规',
        automation: 'auto',
        priority: 'P1',
        standard: ['nist-ssdf'],
        cases: [
          {
            title: '全部依赖许可证可枚举且与项目许可兼容',
            expect: '生成许可证清单，无 GPL/AGPL 等与分发方式冲突的许可证',
            tier: 'core',
          },
          {
            title: '项目根目录存在 LICENSE 且与包元数据一致',
            expect: 'LICENSE 文件存在，package.json 等元数据中的 license 字段一致',
            tier: 'blocker',
          },
          {
            title: '第三方代码与资源的来源与许可已标注',
            expect: '内联/拷贝的第三方代码有出处与许可说明',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'release',
    name: '版本与发布',
    intro: '版本号、变更记录与发布动作是否可预测、可回退、可被消费方正确安装。',
    methods: [
      {
        id: 'REL-VERSION',
        name: '版本策略',
        automation: 'assisted',
        priority: 'P1',
        standard: ['semver'],
        cases: [
          {
            title: '版本号遵循语义化规则且变更幅度与改动匹配',
            expect: '破坏性变更对应主版本，功能新增对应次版本，修复对应补丁版本',
            tier: 'core',
          },
          {
            title: '破坏性变更已提供迁移说明',
            expect: '存在升级指引或迁移脚本，覆盖受影响的公开接口',
            tier: 'core',
          },
          {
            title: '版本号在代码、清单与文档中一致',
            expect: '无多处版本声明互相矛盾的情况',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-CHANGELOG',
        name: '变更记录',
        automation: 'assisted',
        priority: 'P2',
        cases: [
          {
            title: 'CHANGELOG 覆盖最近若干版本且分类清晰',
            expect: '按新增/修复/破坏性变更分类，条目可对应到提交或 PR',
            tier: 'core',
          },
          {
            title: '变更记录与实际代码差异一致',
            expect: '抽查版本对应的提交范围，无未记录的用户可见变更',
            tier: 'extended',
          },
          {
            title: '未发布变更的维护方式明确',
            expect: '存在 unreleased 段或有自动化生成机制',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'REL-PUBLISH',
        name: '发布流程',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '发布由自动化流程完成且需要显式触发',
            expect: '存在发布工作流与权限控制，非本地手工推包',
            tier: 'core',
          },
          {
            title: '发布制品可从发布说明一键安装验证',
            expect: '按发布说明安装指定版本成功，且与源码行为一致',
            tier: 'blocker',
          },
          {
            title: '预发布版本与正式版本通道分离',
            expect: 'beta/rc 等标签使用正确，不被默认安装',
            tier: 'extended',
          },
          {
            title: '发布失败或误发时可撤回或标注',
            expect: '存在 yank/deprecate 或撤回流程说明',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REL-CONSUMER',
        name: '消费方视角验证',
        automation: 'assisted',
        priority: 'P0',
        when: ['library', 'plugin', 'cli', 'service'],
        cases: [
          {
            title: '按官方文档安装并跑通最小可用示例',
            expect: '文档中的第一条示例可复制粘贴执行成功',
            tier: 'blocker',
          },
          {
            title: '公开接口的类型声明或 schema 与实现一致',
            expect: '类型/接口/OpenAPI 与实际行为一致，无未声明字段',
            tier: 'core',
          },
          {
            title: '卸载或移除后不残留全局副作用',
            expect: '卸载流程干净，无遗留文件、进程或环境变量依赖',
            tier: 'extended',
          },
        ],
      },
    ],
  },
]
