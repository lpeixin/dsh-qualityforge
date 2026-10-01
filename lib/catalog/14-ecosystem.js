/**
 * 测试域 14：生态与分发（DSH/Cordis 插件专项 · 开源就绪度 · 跨平台安装）。
 *
 * 字段约定与 `01-build.js` 完全一致：category → method → case 三层结构，
 * case 的 tier 决定它在哪个 depth 被展开，省略的 priority/automation/when 逐级继承。
 *
 * 本域是**生态相关**的域：`dsh-plugin` 只在插件类型项目上展开（when: plugin），
 * 其判据取自 DeepSeek Harness / Cordis 的真实加载契约——补丁层、导出形态、
 * 工具 schema 校验、依赖注入与卸载——因此必须精确到"看哪个文件、不满足会报什么错"。
 * `oss-ready` 与 `distribution` 保持通用：前者面向任何准备对外开源的仓库，
 * 后者面向需要交付到别人机器上的库、命令行、桌面端与插件。
 */

export const categories = [
  {
    id: 'dsh-plugin',
    name: 'DSH 插件专项',
    intro: '插件能否被正确装载、被用户覆盖或禁用、被干净卸载，并诚实遵守宿主的能力与权限契约。',
    when: ['plugin'],
    methods: [
      {
        id: 'DSH-MANIFEST',
        name: '包元数据与 bundle 声明',
        automation: 'auto',
        priority: 'P0',
        cases: [
          {
            title: '清单声明 dsh.bundle.patch 且指向存在的补丁文件',
            expect: 'package.json 的 dsh.bundle.patch 指向仓库中真实存在的补丁文件；缺失该声明时只能作为普通依赖安装并打印警告、不激活任何层',
            tier: 'blocker',
          },
          {
            title: '补丁文件与入口目录被包含在发布清单中',
            expect: 'files 字段覆盖入口目录与 cordis.patch.yml，打包解包后两者均存在，安装方无需额外获取即可装载',
            tier: 'blocker',
          },
          {
            title: '入口与导出指向实际存在的文件',
            expect: 'main 与 exports（含 ./package.json，带客户端时含 ./client）指向的文件在包内存在，类型声明与实现可解析',
            tier: 'core',
          },
          {
            title: '宿主侧依赖声明为同伴依赖而非直接依赖',
            expect: '宿主包写在 peerDependencies 并逐条列出已验证的主机版本线，不放进 dependencies 以免同一运行时出现多份实例',
            tier: 'core',
          },
          {
            title: '版本与支持的主机线可被机器判定',
            expect: 'version 符合语义化版本，同伴依赖范围或引擎字段能明确表达支持与不支持的主机版本',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DSH-PATCHROW',
        name: '补丁插入行与可覆盖性',
        automation: 'auto',
        priority: 'P0',
        cases: [
          {
            title: '补丁文件为顶层数组且插入行同时给出 id 与包名',
            expect: 'cordis.patch.yml 解析为顶层数组，插入行含 id 与 name，name 为可在 profile 依赖目录中解析到的裸包名',
            tier: 'blocker',
          },
          {
            title: '插入行可被用户层按 id 覆盖或禁用',
            expect: '在用户自己的补丁文件中写同一 id 加 disabled: true 后插件不再激活，其余层不受影响，且无需改动插件包',
            tier: 'blocker',
          },
          {
            title: '行 id 与插件诊断名一致且不与他人冲突',
            expect: '插入行 id 与插件导出的 name 可对应，profile 中不存在两个相同 id 的行，加载日志能唯一定位该插件',
            tier: 'core',
          },
          {
            title: '行内配置的替换语义与示例被说明',
            expect: '文档注明后写层会整块替换该行的 config 而非按键深合并，并给出可直接使用的完整配置示例',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DSH-EXPORTS',
        name: '导出形态与加载纯净性',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '以命名导出提供插件契约且没有默认导出',
            expect: '入口导出 name、inject、apply（带配置的插件另导出配置 schema），模块中不存在默认导出以免装载器折叠模块并丢掉依赖声明',
            tier: 'blocker',
          },
          {
            title: '重复加载不会产生重复注册',
            expect: '同一插件被加载两次时工具与命令不出现重复条目，或第二次注册被显式拒绝并留下日志',
            tier: 'core',
          },
          {
            title: '模块导入阶段不产生副作用',
            expect: '仅导入入口不会注册能力、读写磁盘或发起网络请求，全部副作用发生在应用函数内部',
            tier: 'core',
          },
          {
            title: '导出名与补丁行、日志可互相印证',
            expect: '导出的 name 与补丁行的 id 或 name 对应，出现装载问题时能据日志定位到具体包与行',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DSH-TOOLSCHEMA',
        name: '工具 schema 与宿主校验契约',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '每个工具声明名称、用途、参数与输出 schema',
            expect: '注册定义中四者齐备，用途说明写明何时该用与何时不该用，参数字段带类型与说明',
            tier: 'blocker',
          },
          {
            title: '返回值满足输出 schema 且为无损 JSON',
            expect: '返回值中不含未定义值、非有限数值、函数或循环引用；出现这些内容时宿主会以输出非法拒绝该次调用',
            tier: 'blocker',
          },
          {
            title: '自由形态对象不关闭额外字段',
            expect: '输出 schema 中的开放对象保留额外字段未禁止，避免合法字段被宿主校验判为非法',
            tier: 'core',
          },
          {
            title: '参数 schema 未强制的约束在工具内部自校验',
            expect: '非空字符串、正数范围、跨字段关系等在实现中校验并抛出可读错误，而不是依赖宿主拦截',
            tier: 'core',
          },
          {
            title: '失败以抛错或结构化错误表达',
            expect: '失败路径抛出异常或返回被标记为错误的结果，不返回需要调用方解析散文才能判断成败的内容',
            tier: 'extended',
          },
          {
            title: '长耗时操作响应取消信号',
            expect: '取消信号触发后子进程与网络请求被终止，工具及时返回而不是继续占用资源',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DSH-LIFECYCLE',
        name: '生命周期与卸载清理',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '应用函数返回清理函数并释放全部注册',
            expect: '应用函数返回函数；调用后工具与命令从注册表消失，注册表内容回到加载前的状态',
            tier: 'blocker',
          },
          {
            title: '注册类接口的返回值均被收集为清理函数',
            expect: '工具、命令、技能、事件监听与副作用注册返回的清理函数都被保存，卸载时按注册逆序调用',
            tier: 'core',
          },
          {
            title: '卸载释放非注册类资源',
            expect: '定时器、子进程、文件句柄与网络连接在卸载时关闭，进程不再因插件残留而无法退出',
            tier: 'core',
          },
          {
            title: '热重载不残留旧实例',
            expect: '重载后只存在一份注册，旧闭包不再响应事件，连续多次重载不出现监听器或缓存累积',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DSH-COMPAT',
        name: '宿主服务兼容与降级',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '硬依赖服务写入依赖声明且不越权访问',
            expect: '实现未读取未在依赖声明中列出的宿主服务；越权访问会以缺少注入的错误让整棵插件树装载失败',
            tier: 'blocker',
          },
          {
            title: '可选服务缺失时优雅降级',
            expect: '通过按名获取并判空的方式读取可选服务，缺失时插件仍完成装载、功能降级并输出一条说明性日志',
            tier: 'blocker',
          },
          {
            title: '宿主版本范围逐条列出已验证的主机线',
            expect: '同伴依赖不使用放宽下界来覆盖预发布版本，而是逐条列出已验证的主机版本范围并可被安装器求值',
            tier: 'core',
          },
          {
            title: '依赖服务消失与恢复时状态正确',
            expect: '依赖服务被卸载后插件随之卸载，服务恢复后自动重新激活并重新注册能力，不留下半装载状态',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DSH-INSTALL',
        name: '安装升级卸载流程',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '文档给出可复制的安装与卸载命令',
            expect: 'README 含按 profile 添加与移除该插件的完整命令，照抄执行后插件分别生效与失效',
            tier: 'blocker',
          },
          {
            title: '不同安装来源的差异被说明',
            expect: '文档区分包管理器、压缩包与源码仓库安装，并说明源码安装只取源码、不执行构建，需要预备步骤或预构建产物',
            tier: 'core',
          },
          {
            title: '升级路径与其对状态的影响被说明',
            expect: '文档给出升级命令并说明升级是否保留已有状态；仅存于内存的状态被注明重启后重置',
            tier: 'core',
          },
          {
            title: '平台前提与构建许可提示到位',
            expect: '文档提示包管理器新版本的构建脚本白名单等前提，缺失时用户可依文档自助解决',
            tier: 'extended',
          },
          {
            title: '卸载后不残留依赖与层配置',
            expect: '卸载后 profile 依赖与对应层行被移除，无遗留文件、配置或后台进程',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DSH-SIDEEFFECT',
        name: '权限与副作用边界',
        automation: 'assisted',
        priority: 'P0',
        standard: ['nist-ssdf'],
        cases: [
          {
            title: '插件不写入宿主未开放的自定义会话事件',
            expect: '插件不向会话追加已知事件之外的私有事件，避免写入后会话在重启时无法加载',
            tier: 'blocker',
          },
          {
            title: '文件写入限制在允许范围内',
            expect: '写入路径限于当前工作区或插件自有目录，越界写入被沙箱拒绝且插件按拒绝结果处理而非忽略错误',
            tier: 'blocker',
          },
          {
            title: '不篡改宿主与其它插件的全局状态',
            expect: '代码未改写全局对象、宿主服务原型或他人注册表，卸载后宿主行为与加载前一致',
            tier: 'core',
          },
          {
            title: '敏感信息不进入日志与磁盘',
            expect: '凭证、令牌与用户数据在输出中被遮蔽或不记录，示例配置中不含真实密钥',
            tier: 'core',
          },
          {
            title: '外部访问与命令执行遵循最小必要',
            expect: '网络请求有明确用途与超时，命令执行不拼接未校验的外部输入',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'oss-ready',
    name: '开源就绪度',
    intro: '陌生贡献者与下游用户能否判断许可、找到规则、提出缺陷，并获得可预期的回应。',
    methods: [
      {
        id: 'OSS-LICENSE',
        name: '许可证与版权归属',
        automation: 'auto',
        priority: 'P0',
        cases: [
          {
            title: '许可证正文为标准文本且被仓库与包元数据引用',
            expect: '许可证文件为所选协议的完整标准文本而非摘要或占位，包元数据中的许可标识与之一致',
            tier: 'blocker',
          },
          {
            title: '版权行与权利人信息真实完整',
            expect: '许可证或声明文件中的权利人名称与年份与现实主体一致，不含占位字符串或缺失年份',
            tier: 'core',
          },
          {
            title: '依赖许可证与本项目许可证兼容',
            expect: '存在依赖许可证清单，无与分发方式冲突的许可证，例外项有书面豁免说明',
            tier: 'core',
          },
          {
            title: '贡献的许可条款明确',
            expect: '贡献指南或仓库说明指出贡献采用的许可安排（来源声明或贡献者协议），或明示入站即同许可',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'OSS-README',
        name: '门面与展示素材',
        automation: 'assisted',
        priority: 'P1',
        cases: [
          {
            title: '首屏给出定位、安装命令与状态徽章',
            expect: 'README 顶部可见一句话定位、安装命令与版本、构建、许可徽章，徽章链接指向真实页面',
            tier: 'core',
          },
          {
            title: '展示素材反映当前版本的真实形态',
            expect: '截图、动图或演示链接与当前版本界面或输出一致，不是空占位或已过期的旧版素材',
            tier: 'core',
          },
          {
            title: '多语言入口互相可达',
            expect: '主文档与翻译文档顶部互相链接，链接目标存在且不需要在目录中自行寻找',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'OSS-POLICY',
        name: '协作与安全政策',
        automation: 'assisted',
        priority: 'P0',
        standard: ['contributor-covenant'],
        cases: [
          {
            title: '贡献指南覆盖环境搭建、测试与提交流程',
            expect: '文档给出可执行的开发命令与提交、评审要求，新人据此可独立完成一次贡献',
            tier: 'core',
          },
          {
            title: '存在行为准则与可用举报渠道',
            expect: '行为准则采用通行范本或等价条款，并给出可实际联系的举报方式而非空链接',
            tier: 'blocker',
          },
          {
            title: '安全政策给出私密报告渠道与响应时限',
            expect: '安全政策指明非公开的漏洞报告方式与预期响应时间，并明确不鼓励公开披露未修复问题',
            tier: 'blocker',
          },
          {
            title: '政策文件可从仓库入口被发现',
            expect: 'README 或仓库首页链接到行为准则、贡献指南与安全政策，无需逐层翻找目录',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'OSS-TEMPLATES',
        name: '模板与标签体系',
        automation: 'assisted',
        priority: 'P2',
        cases: [
          {
            title: '缺陷模板要求可复现所需的全部字段',
            expect: '缺陷模板要求填写版本、运行环境、复现步骤、期望与实际结果，字段缺失时提交被引导补充',
            tier: 'core',
          },
          {
            title: '合并请求模板要求变更说明与验证证据',
            expect: '模板含变更内容、验证方式、关联问题与自查清单，提交者需逐项填写而非删除模板',
            tier: 'core',
          },
          {
            title: '标签体系覆盖类型、优先级与状态',
            expect: '仓库标签包含类型、优先级与状态三类，并有分诊使用约定，抽查近期条目标注符合该约定',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'OSS-CHANGELOG',
        name: '变更记录与发布说明',
        automation: 'assisted',
        priority: 'P1',
        standard: ['keep-a-changelog', 'semver'],
        cases: [
          {
            title: '变更记录采用通行结构并保留未发布段',
            expect: '存在未发布段，条目按新增、变更、修复、移除分类并悬挂在版本标题之下',
            tier: 'core',
          },
          {
            title: '每个发布版本都有对应说明',
            expect: '仓库的每个发布标签都有说明内容，且与变更记录中同版本条目一致，不存在只有标签没有说明的发布',
            tier: 'core',
          },
          {
            title: '版本号的变更幅度与改动性质匹配',
            expect: '破坏性变更对应主版本、新增能力对应次版本、修复对应补丁版本，抽查若干版本均成立',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'OSS-VERSION-MATRIX',
        name: '支持范围与兼容矩阵',
        automation: 'assisted',
        priority: 'P1',
        standard: ['semver'],
        cases: [
          {
            title: '声明支持的运行时与平台最低版本',
            expect: '文档列出支持的运行时与平台及其最低版本，且与包元数据声明和流水线矩阵一致',
            tier: 'core',
          },
          {
            title: '存在支持周期与停止支持策略',
            expect: '文档说明各版本线的支持时长与停止支持判定，已停止支持的版本在文档中被标注',
            tier: 'core',
          },
          {
            title: '兼容承诺与例外被写明',
            expect: '文档写明主版本内的兼容承诺范围，并对实验性接口等例外明确标注不保证兼容',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'OSS-I18N',
        name: '多语言文档同步',
        automation: 'assisted',
        priority: 'P2',
        cases: [
          {
            title: '翻译文档与主文档内容同步',
            expect: '翻译版本的安装命令、配置键与版本号与主文档一致，未遗漏安装与快速上手等关键章节',
            tier: 'core',
          },
          {
            title: '翻译文档标注对应版本或同步时间',
            expect: '翻译文件注明对应版本或最后同步时间，读者可据此判断是否已过期',
            tier: 'extended',
          },
          {
            title: '语言切换链接双向可达',
            expect: '各语言文档顶部均提供切换入口，两两互通且无死链',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'OSS-HEALTH',
        name: '开源健康度自评',
        automation: 'auto',
        priority: 'P2',
        standard: ['openssf-scorecard'],
        cases: [
          {
            title: '分支保护与必需评审处于启用状态',
            expect: '主分支保护要求评审与状态检查，与供应链健康度检查中的分支保护结论一致',
            tier: 'core',
          },
          {
            title: '发布物来源可验证',
            expect: '发布制品提供校验和、签名或构建来源证明，与供应链健康度检查中的签名发布结论一致',
            tier: 'core',
          },
          {
            title: '依赖更新与漏洞告警已启用',
            expect: '仓库启用了依赖更新机器人与漏洞告警，近期有对应的合并或评估记录',
            tier: 'extended',
          },
          {
            title: '存在健康度自评结果与改进清单',
            expect: '仓库可提供一次供应链健康度自评结果，低分项在改进清单中有对应条目与负责人',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'OSS-COMMUNITY',
        name: '社区响应与维护承诺',
        automation: 'manual',
        priority: 'P2',
        cases: [
          {
            title: '公开承诺响应时限并被历史数据支持',
            expect: '文档给出问题与合并请求的预期响应时间，近九十天首次响应的中位数符合该承诺',
            tier: 'core',
          },
          {
            title: '近期问题都有结论',
            expect: '抽查近九十天的问题条目，均有维护者回复或明确的关闭理由标签，无长期无人应答的悬置项',
            tier: 'core',
          },
          {
            title: '维护者名单与治理方式公开',
            expect: '存在维护者名单或治理文档，说明决策方式、职责分工与继任安排',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'distribution',
    name: '跨平台分发与安装',
    intro: '别人能否在自己的系统上一路装成功、跑起来、升得动、卸得干净，而不必阅读源码。',
    when: ['library', 'cli', 'desktop', 'plugin'],
    methods: [
      {
        id: 'DIST-PLATFORM',
        name: '平台矩阵与最低版本',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '支持的系统、架构与最低版本已文档化',
            expect: '文档列出支持的平台、处理器架构与最低系统或运行时版本，未列出的组合被明确标注为不支持',
            tier: 'blocker',
          },
          {
            title: '制品命名体现平台与架构并可被自动选择',
            expect: '分发文件名包含平台与架构标识，安装脚本或包管理器可据此选取正确制品而不靠人工猜测',
            tier: 'core',
          },
          {
            title: '支持矩阵在流水线中被实际验证',
            expect: '流水线在声明的各平台上执行构建或冒烟测试，未纳入验证的平台在文档中标注为未验证',
            tier: 'core',
          },
          {
            title: '平台能力差异有降级或明确报错',
            expect: '缺少某项平台能力时功能降级并给出提示，或启动时报出可读错误，而不是中途静默失效',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DIST-INSTALL',
        name: '安装通道完备性',
        automation: 'assisted',
        priority: 'P0',
        cases: [
          {
            title: '每条安装通道都给出可复制的确切命令',
            expect: '包管理器、二进制下载、容器与插件市场等通道各给出带版本占位符的命令，照抄即可完成安装',
            tier: 'blocker',
          },
          {
            title: '安装后有一条自证成功的命令',
            expect: '安装说明包含版本查询或自检命令，执行输出与所安装的版本一致',
            tier: 'core',
          },
          {
            title: '安装物提供完整性校验方式',
            expect: '发布页给出校验和或签名及对应验证命令，校验失败时的处置方式也被说明',
            tier: 'core',
          },
          {
            title: '容器镜像的标签策略明确',
            expect: '镜像标签区分固定版本与滚动标签，文档建议生产环境使用固定版本标签而非滚动标签',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DIST-DEPS',
        name: '运行依赖可获得性',
        automation: 'auto',
        priority: 'P1',
        cases: [
          {
            title: '运行时版本要求在安装或首次启动时被检查',
            expect: '版本不满足时给出包含当前版本与所需范围的明确报错，而不是运行到中途才崩溃',
            tier: 'blocker',
          },
          {
            title: '原生依赖与编译工具链要求被文档化',
            expect: '需要编译或系统库的场景列出依赖包与安装命令，或直接提供预编译产物免除编译',
            tier: 'core',
          },
          {
            title: '核心安装不依赖外网访问',
            expect: '除文档标注的可选步骤外，安装过程无需访问外网；受限网络下可改用镜像或离线包并已给出步骤',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DIST-FIRSTRUN',
        name: '首次运行与配置引导',
        automation: 'assisted',
        priority: 'P1',
        standard: ['twelve-factor'],
        cases: [
          {
            title: '首次运行输出下一步指引',
            expect: '首次执行输出配置文件位置、示例命令或文档入口，使用者知道接下来该做什么',
            tier: 'core',
          },
          {
            title: '缺少必需配置时报错指出缺失项与获取方式',
            expect: '未配置必需项时启动失败并打印键名、示例值与获取途径，不静默使用危险默认值继续运行',
            tier: 'blocker',
          },
          {
            title: '提供最小配置模板或初始化命令',
            expect: '存在示例配置或初始化命令，生成的文件可直接通过校验并被程序加载',
            tier: 'core',
          },
          {
            title: '配置来源与优先级顺序被说明',
            expect: '配置通过环境变量与配置文件注入，文档写明两者优先级与覆盖规则',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DIST-UPGRADE',
        name: '升级与数据兼容',
        automation: 'assisted',
        priority: 'P1',
        standard: ['semver'],
        cases: [
          {
            title: '升级命令文档化且重复执行安全',
            expect: '按文档执行升级两次，第二次不产生额外变更且程序仍可用，两次退出码均为 0',
            tier: 'blocker',
          },
          {
            title: '升级前有备份或回退路径',
            expect: '文档给出版本回退步骤或数据备份要求，按步骤回退后旧版本可正常启动并读到原数据',
            tier: 'core',
          },
          {
            title: '跨主版本升级有明确路径',
            expect: '文档说明能否跨主版本直接升级，不允许时给出必须依次经过的中间版本',
            tier: 'core',
          },
          {
            title: '需要人工处理的迁移项被逐条列出',
            expect: '文档列出需要手工迁移的配置键与数据格式，并给出对应迁移命令或脚本',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DIST-UNINSTALL',
        name: '卸载与残留处理',
        automation: 'assisted',
        priority: 'P2',
        cases: [
          {
            title: '卸载方式文档化且执行后不可用',
            expect: '按文档卸载后命令或插件不再存在，安装目录与残留位置被明确列出',
            tier: 'core',
          },
          {
            title: '用户数据与配置的处置有说明',
            expect: '文档说明卸载是否保留配置与数据、分别位于何处、如何彻底清除',
            tier: 'core',
          },
          {
            title: '卸载不影响同机其它版本与共享依赖',
            expect: '多版本共存场景下卸载其中一个，其余版本仍可正常运行，共享依赖未被破坏',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DIST-SIGNING',
        name: '签名公证与安全软件兼容',
        automation: 'auto',
        priority: 'P1',
        standard: ['slsa'],
        cases: [
          {
            title: '桌面产物完成签名与公证',
            expect: '下载的安装包通过系统签名与来源校验命令，首次打开不出现未验证开发者的阻断提示',
            tier: 'blocker',
          },
          {
            title: '系统安装包带有效代码签名与时间戳',
            expect: '安装包属性中显示有效的签名主体与时间戳，系统安全提示不拦截正常安装',
            tier: 'core',
          },
          {
            title: '发布页提供校验和与签名验证步骤',
            expect: '发布说明给出摘要值或签名文件及验证命令，公钥指纹可被独立核对',
            tier: 'core',
          },
          {
            title: '安全软件误报有跟踪与处置记录',
            expect: '误报有上报或申诉记录，文档说明用户遇到拦截时的验证与处理路径',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'DIST-OFFLINE',
        name: '离线与内网分发',
        automation: 'assisted',
        priority: 'P2',
        cases: [
          {
            title: '提供离线介质制作与安装步骤',
            expect: '文档给出离线包或镜像导出方法，在无外网机器上可完成安装并跑通最小示例',
            tier: 'core',
          },
          {
            title: '代理与私有源配置被文档化',
            expect: '说明代理、私有镜像与证书导入的配置位置及验证方法，配置后能完成一次真实拉取',
            tier: 'core',
          },
          {
            title: '离线环境可独立完成完整性校验',
            expect: '校验和清单随介质一同分发，离线机器不依赖外部服务即可核对文件完整性',
            tier: 'extended',
          },
        ],
      },
    ],
  },
]
