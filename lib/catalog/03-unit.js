/**
 * 测试域 03：单元测试（测试设计 · 隔离与稳定 · 进阶技术）。
 *
 * 纯数据模块：只导出 categories，不含 import、函数与副作用；
 * 字段约定与写作范例见 01-build.js 与 docs/CATALOG-AUTHORING.md。
 *
 * 层级结构：category（测试域）→ method（测试方法）→ case（可独立判定的测试项）。
 *
 * automation 约定：只有当"一条命令的退出码或机器可读输出"即可判定结论时才标 auto
 * （覆盖率阈值、乱序与重复执行、并行执行、变异运行、fuzz 运行、测试发现列表），
 * 其余为 assisted；需要人工或业务方确认的标为 manual。
 */

export const categories = [
  {
    id: 'unit-test',
    name: '单元测试设计与覆盖',
    intro: '单元测试本身是否是有效的测试：组织清晰、断言有力、边界与异常路径真正被验证。',
    methods: [
      {
        id: 'UNIT-RUN',
        name: '测试执行与结果',
        automation: 'auto',
        priority: 'P0',
        standard: ['istqb', 'iso-25010'],
        cases: [
          {
            title: '全部单元测试在主干上通过且退出码为 0',
            expect: '测试命令退出码 0，报告中没有失败与错误用例；存在失败用例时不得进入发布流程',
            tier: 'blocker',
          },
          {
            title: '测试失败会阻断合并而不只是告警',
            expect: 'CI 把测试作为必过关卡，失败提交无法合并到主干',
            tier: 'core',
          },
          {
            title: '测试输出足以直接定位失败用例与原因',
            expect: '失败输出包含用例名、断言差异与文件行号，无需本地复现即可定位',
            tier: 'core',
          },
          {
            title: '同一提交连续两次执行结果一致',
            expect: '重复运行同一提交，通过/失败集合完全一致，不出现随机失败',
            tier: 'core',
          },
          {
            title: '被跳过的测试有明确原因且被跟踪',
            expect: 'skip/only 标记要么已修复要么附有原因与跟踪项，长期 skipped 用例数为 0 或存在清单',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'UNIT-ORG',
        name: '测试组织与命名',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '测试与被测代码的位置关系一致',
            expect: '测试文件按约定与生产代码同目录或镜像目录组织，不存在同类测试散落在多个随意位置',
            tier: 'core',
          },
          {
            title: '测试命名表达场景与期望行为',
            expect: '测试名包含被测行为与前置条件（如 should_reject_expired_token），不出现 test1、case2 类无信息命名',
            tier: 'blocker',
          },
          {
            title: '单个测试只验证一个行为',
            expect: '每个用例只包含一组同源断言，失败时无需排查多个无关行为',
            tier: 'core',
          },
          {
            title: '测试文件命名与运行器发现规则匹配',
            expect: '测试发现配置与命名约定一致，列举测试命令列出的文件数与实际测试文件数相同，无漏收集',
            tier: 'core',
            automation: 'auto',
          },
        ],
      },
      {
        id: 'UNIT-ASSERT',
        name: '断言有效性',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb', 'iso-29119'],
        cases: [
          {
            title: '每个用例至少包含一条断言',
            expect: '不存在无断言却计入通过率的用例，覆盖率统计不把「只执行未校验」的调用算作业务覆盖',
            tier: 'blocker',
          },
          {
            title: '断言校验结果而非仅校验不抛异常',
            expect: '断言针对返回值、对象状态或副作用，而非仅断言结果为真或某方法被调用过',
            tier: 'core',
          },
          {
            title: '不存在恒真断言与自证式断言',
            expect: '无断言恒为真、同一变量自比较、或断言被注释与永久跳过的用例',
            tier: 'blocker',
          },
          {
            title: '浮点、时间与集合的比较方式正确',
            expect: '浮点使用容差比较，时间使用可控时钟或范围断言，集合比较不依赖元素顺序',
            tier: 'core',
          },
          {
            title: '异步用例的断言被正确等待',
            expect: '异步用例返回 Promise 或被 await，不存在未等待断言导致的假通过',
            tier: 'blocker',
            tags: ['async'],
          },
          {
            title: '断言失败信息足以定位问题',
            expect: '失败输出包含期望值、实际值与关键入参，无需临时加日志即可复现',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'UNIT-BOUNDARY',
        name: '边界与等价类',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb', 'iso-29119'],
        cases: [
          {
            title: '边界值三态均有用例覆盖',
            expect: '每个判定的上界、下界与越界值各有用例，边界符号（大于等于与大于）的差异被明确验证',
            tier: 'blocker',
          },
          {
            title: '等价类划分覆盖有效与无效输入',
            expect: '每个等价类至少一个用例，无效类有明确的拒绝或报错断言',
            tier: 'core',
          },
          {
            title: '空值与默认值场景被显式测试',
            expect: '空字符串、空数组、null 或 undefined、0 与省略默认参数均有独立用例',
            tier: 'core',
          },
          {
            title: '极值与特殊字符被覆盖',
            expect: '最大值、最小值、超长输入、负数与 Unicode 字符有对应用例',
            tier: 'extended',
          },
          {
            title: '多条件组合的覆盖可核对',
            expect: '多条件逻辑有决策表或组合清单，用例与组合条目一一对应且无遗漏项',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'UNIT-EXCEPTION',
        name: '异常与错误路径',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '异常用例断言具体异常类型与关键信息',
            expect: '抛错用例断言异常类型与关键字段，而非仅断言「发生了异常」',
            tier: 'blocker',
          },
          {
            title: '错误分支与成功分支同等被覆盖',
            expect: '校验失败、依赖返回错误与降级路径均有用例，不只覆盖成功路径',
            tier: 'core',
          },
          {
            title: '失败时资源释放与事务回滚仍然发生',
            expect: '异常场景断言连接、句柄或事务被释放或回滚，无资源泄漏',
            tier: 'core',
          },
          {
            title: '对外错误信息不泄漏内部实现细节',
            expect: '对外错误消息不含堆栈、SQL 语句或内部路径，内部日志保留足够排查上下文',
            tier: 'extended',
          },
          {
            title: '超时与取消路径被测试',
            expect: '存在超时、取消与部分失败场景的用例，并断言清理动作与状态一致性',
            tier: 'extended',
            tags: ['timeout'],
          },
        ],
      },
      {
        id: 'UNIT-COV',
        name: '覆盖率指标',
        automation: 'assisted',
        priority: 'P1',
        standard: ['istqb', 'iso-29119'],
        cases: [
          {
            title: '覆盖率命令可一键运行并产出机器可读报告',
            expect: '覆盖率命令退出码为 0，并生成 lcov、cobertura 或等价报告文件',
            tier: 'core',
            automation: 'auto',
            tags: ['coverage'],
          },
          {
            title: '行与分支覆盖率阈值在 CI 中强制',
            expect: '低于阈值时流水线失败；当前行覆盖率与分支覆盖率均不低于配置值',
            tier: 'blocker',
            automation: 'auto',
            tags: ['coverage'],
          },
          {
            title: '覆盖率不得较基线下降',
            expect: '增量门禁生效，改动的覆盖率低于主干基线时被阻断或需显式豁免',
            tier: 'core',
            automation: 'auto',
          },
          {
            title: '覆盖率统计排除生成代码与测试自身',
            expect: '配置排除 vendor、生成代码与测试目录，指标只反映生产代码',
            tier: 'core',
          },
          {
            title: '未覆盖清单逐条有处置结论',
            expect: '未覆盖行与分支有清单，标注为待补测试或合理的不可达代码',
            tier: 'extended',
          },
          {
            title: '覆盖率不被当作唯一质量结论',
            expect: '报告同时给出断言强度或变异分数等补充指标，评审结论不出现「覆盖率达标即质量达标」',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'UNIT-PARAM',
        name: '参数化与数据驱动',
        automation: 'assisted',
        priority: 'P1',
        standard: ['istqb'],
        cases: [
          {
            title: '同类场景使用参数化而非复制用例',
            expect: '多组输入共享同一测试逻辑，用例表驱动且失败输出能定位到具体数据组',
            tier: 'core',
          },
          {
            title: '参数化数据同时包含正例与反例',
            expect: '数据表包含有效与无效输入，并对每组给出期望结果而非只执行不校验',
            tier: 'core',
          },
          {
            title: '测试数据构造不引入不确定性',
            expect: '数据生成使用静态表或固定种子，同一用例重复运行产生完全相同的输入',
            tier: 'core',
          },
          {
            title: '测试数据集中管理且可维护',
            expect: 'fixture 与工厂函数集中定义，测试体内不出现散落的魔法值',
            tier: 'extended',
          },
          {
            title: '外部数据文件与用例的对应关系可校验',
            expect: '从文件加载的数据有 schema 校验或字段断言，缺字段时测试明确失败而非静默跳过',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'UNIT-SPEED',
        name: '测试执行速度',
        automation: 'assisted',
        priority: 'P2',
        standard: ['iso-25010'],
        cases: [
          {
            title: '单元测试套件在约定预算内跑完',
            expect: '全量单元测试在 CI 上的耗时低于约定预算，超出预算时产生告警',
            tier: 'core',
            automation: 'auto',
          },
          {
            title: '单元测试不进行真实网络与磁盘等待',
            expect: '单元测试期间无真实 HTTP、数据库或文件系统往返，单条用例耗时以毫秒计',
            tier: 'blocker',
          },
          {
            title: '慢用例可被识别并优化',
            expect: '存在慢用例报告（耗时排行类输出），超过阈值的用例已优化或标注保留原因',
            tier: 'extended',
          },
          {
            title: '测试可分片并行以缩短反馈时间',
            expect: '测试支持分片或并行执行，整体耗时随并发度下降而非线性堆积',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'test-isolation',
    name: '测试隔离与稳定性',
    intro: '测试结果是否只取决于被测代码：不依赖执行顺序、不共享可变状态、外部因素可控且可复现。',
    methods: [
      {
        id: 'ISO-ORDER',
        name: '无顺序依赖',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '随机顺序执行整套测试结果一致',
            expect: '以随机种子乱序运行全部用例，通过结果与顺序执行完全一致',
            tier: 'blocker',
            automation: 'auto',
          },
          {
            title: '任意单条用例可独立运行通过',
            expect: '随机挑选单条用例单独执行可稳定通过，不依赖前序用例的副作用',
            tier: 'core',
            automation: 'auto',
          },
          {
            title: '用例之间不通过外部介质传递状态',
            expect: '测试代码中不存在跨用例读写同一临时文件、全局变量或环境变量的顺序依赖',
            tier: 'core',
          },
          {
            title: '同一用例重复执行结果稳定',
            expect: '同一用例连续执行 20 次结果完全一致，无间歇性失败',
            tier: 'core',
          },
        ],
      },
      {
        id: 'ISO-STATE',
        name: '共享可变状态治理',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '每个用例在已知初始状态下启动',
            expect: 'setup 与 teardown 成对存在，用例开始前被测对象处于明确且可复述的初始状态',
            tier: 'blocker',
          },
          {
            title: '用例结束后不残留状态',
            expect: 'teardown 清理数据库记录、临时文件、环境变量与注册表项，后续用例不受影响',
            tier: 'core',
          },
          {
            title: '单例与静态状态可被重置',
            expect: '存在显式重置接口或每个用例重建容器与上下文，不依赖语言级缓存状态',
            tier: 'core',
          },
          {
            title: '共享 fixture 以只读方式使用',
            expect: '需要修改的用例使用独立副本，共享 fixture 在用例之间不被就地修改',
            tier: 'core',
          },
          {
            title: '测试数据使用可回收的独立命名空间',
            expect: '临时数据库、schema 或键前缀按用例或工作进程命名，运行结束后自动回收',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'ISO-CONTROL',
        name: '时间随机与外部依赖可控',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb', 'iso-25010'],
        cases: [
          {
            title: '当前时间来自可注入时钟而非系统时钟',
            expect: '业务代码的时间来源可替换，测试中固定为确定时刻，无 sleep 等待真实时间流逝',
            tier: 'blocker',
            tags: ['clock'],
          },
          {
            title: '随机数与唯一标识在测试中可预测',
            expect: '随机源被替换为固定序列或注入种子，断言不依赖随机结果',
            tier: 'core',
          },
          {
            title: '单元测试不访问真实网络',
            expect: '测试执行期间无外部 HTTP 与 DNS 请求，网络客户端被替换或指向本地桩',
            tier: 'blocker',
          },
          {
            title: '时区与语言环境被显式固定',
            expect: '测试在固定的 TZ 与 LANG 下运行，跨时区与跨区域执行结果一致',
            tier: 'core',
            tags: ['timezone'],
          },
        ],
      },
      {
        id: 'ISO-FLAKY',
        name: 'flaky 测试治理',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb', 'iso-29119'],
        cases: [
          {
            title: 'flaky 用例可被识别并统计',
            expect: '存在失败重跑记录或历史通过率统计，不稳定用例被显式标记并计数',
            tier: 'blocker',
            tags: ['flaky'],
          },
          {
            title: '反复不稳定的用例进入修复流程',
            expect: '重试有次数上限且被记录，同一用例反复不稳定时进入修复清单并指派责任人',
            tier: 'core',
            tags: ['flaky'],
          },
          {
            title: '跳过与屏蔽的用例有登记与期限',
            expect: '被跳过或屏蔽的用例均登记原因、责任人与恢复计划，不出现无说明的长期跳过',
            tier: 'core',
          },
          {
            title: '主干测试通过率保持稳定',
            expect: '连续 20 次主干构建的测试通过率为 100%，无未解释的间歇失败',
            tier: 'core',
            automation: 'auto',
            tags: ['ci'],
          },
          {
            title: '每例不稳定测试的根因可复现',
            expect: '不稳定用例附有复现步骤或失败日志片段，修复后连续运行不再复现',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'ISO-PARALLEL',
        name: '并行安全',
        automation: 'assisted',
        priority: 'P1',
        standard: ['istqb'],
        cases: [
          {
            title: '并行执行结果与串行一致',
            expect: '以最大并发度运行与串行运行结果一致，无并发引起的失败或数据错乱',
            tier: 'blocker',
            automation: 'auto',
          },
          {
            title: '端口与临时资源在并行下不冲突',
            expect: '并行用例使用动态端口与唯一临时目录，不出现固定端口占用导致的失败',
            tier: 'core',
          },
          {
            title: '共享数据库在并行下由隔离机制保护',
            expect: '每个工作进程使用独立 schema 或事务回滚，测试之间看不到对方写入的中间状态',
            tier: 'core',
          },
          {
            title: '并发度变化不影响结论',
            expect: '在 1、2、N 个并发进程下运行结果一致，用例未假设固定的执行顺序',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'ISO-DOUBLE',
        name: '测试替身边界',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb', 'iso-29119'],
        cases: [
          {
            title: '测试替身只替换被依赖的外部边界',
            expect: '替身用于数据库、网络、时间等边界，被测业务逻辑本身不被替换',
            tier: 'blocker',
          },
          {
            title: '交互断言不过度绑定实现细节',
            expect: '断言聚焦结果与关键协作，不逐次校验内部调用顺序等实现细节',
            tier: 'core',
          },
          {
            title: '桩数据与真实契约保持同步',
            expect: '桩与 fixture 依据契约或真实响应生成，接口变更时能检测出不同步',
            tier: 'core',
          },
          {
            title: '大量使用替身的路径有替代验证',
            expect: '被重度替换的协作路径另有集成或契约验证，避免测试自我印证',
            tier: 'extended',
            tags: ['mock'],
          },
          {
            title: '宽松模式替身未被滥用',
            expect: '不存在自动为全部方法返回默认值的宽松替身，导致断言失去判定意义',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'advanced-testing',
    name: '进阶测试技术',
    intro: '在常规用例之外提高缺陷发现率：变异、属性与模型、模糊测试、快照治理与覆盖率盲区分析。',
    methods: [
      {
        id: 'ADV-MUTATION',
        name: '变异测试',
        automation: 'assisted',
        priority: 'P1',
        standard: ['istqb'],
        cases: [
          {
            title: '变异测试可在流水线中对指定模块运行',
            expect: '变异运行命令退出码为 0，并产出变异分数与存活变异清单',
            tier: 'core',
            automation: 'auto',
          },
          {
            title: '核心模块变异分数达到约定阈值',
            expect: '关键业务模块的变异分数不低于阈值（如 70%），未达标模块有整改计划',
            tier: 'blocker',
            automation: 'auto',
          },
          {
            title: '每个存活变异被逐一分析',
            expect: '存活变异被判定为等价变异或断言缺口，缺口补测后变异分数上升',
            tier: 'core',
          },
          {
            title: '变异范围聚焦高风险代码',
            expect: '变异运行限定在核心模块与本次改动文件，单次运行时长在约定预算内',
            tier: 'extended',
          },
          {
            title: '变异分数与覆盖率共同作为门禁参考',
            expect: '覆盖率达标但变异分数偏低的模块被单独标记并安排补测',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'ADV-PROPERTY',
        name: '属性与基于模型的测试',
        automation: 'assisted',
        priority: 'P1',
        standard: ['istqb', 'iso-29119'],
        cases: [
          {
            title: '存在以不变量表述的属性测试',
            expect: '属性测试断言对任意输入成立的不变量（如编解码往返一致、排序幂等）',
            tier: 'core',
          },
          {
            title: '属性测试失败的最小反例被固化为回归用例',
            expect: '失败时输出最小反例并加入固定用例集，修复后同一输入不再失败',
            tier: 'blocker',
          },
          {
            title: '生成器覆盖有效与非法输入域',
            expect: '生成器显式包含边界与非法组合，而非仅靠纯随机采样',
            tier: 'core',
          },
          {
            title: '属性测试记录随机种子并可重现',
            expect: '随机种子被记录在测试输出中，使用相同种子可复现失败',
            tier: 'core',
          },
          {
            title: '状态模型与实现的转换保持一致',
            expect: '模型中的状态、转换与守卫均有对应用例或反例，模型与代码的偏差可被发现',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'ADV-FUZZ',
        name: '模糊测试',
        automation: 'assisted',
        priority: 'P1',
        standard: ['istqb', 'cwe', 'owasp-top10'],
        cases: [
          {
            title: '解析与反序列化入口注册了模糊测试目标',
            expect: '对解析器、反序列化与协议处理入口存在 fuzz 目标，并有持续运行记录',
            tier: 'core',
            tags: ['fuzz'],
          },
          {
            title: '限定预算内模糊运行无崩溃与挂起',
            expect: '固定时长或迭代数的 fuzz 运行无 crash、无内存溢出、无超时挂起',
            tier: 'blocker',
            automation: 'auto',
            tags: ['fuzz'],
          },
          {
            title: '每个崩溃有最小复现输入与回归用例',
            expect: 'fuzz 发现的崩溃均对应最小复现输入并纳入回归集，修复后不再复现',
            tier: 'core',
          },
          {
            title: '模糊运行启用内存与未定义行为检查',
            expect: '运行启用了 ASan、UBSan 或语言等价检查，可捕获越界与未定义行为',
            tier: 'extended',
            tags: ['sanitizer'],
          },
          {
            title: '种子语料与字典被持续维护',
            expect: '存在种子语料与字典，覆盖率随运行时长提升而非长期停滞',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'ADV-SNAPSHOT',
        name: '快照与黄金文件治理',
        automation: 'assisted',
        priority: 'P2',
        standard: ['istqb'],
        cases: [
          {
            title: '快照更新有显式流程与评审',
            expect: '快照更新需专用命令且在 PR 中可见差异，不允许无评审批量覆盖',
            tier: 'core',
          },
          {
            title: '快照内容不含易变字段',
            expect: '快照中不含时间戳、随机值与机器相关信息，重复生成内容一致',
            tier: 'blocker',
          },
          {
            title: '快照体量与断言目标匹配',
            expect: '快照不包含与断言目标无关的大段字段，避免噪声淹没真实变更',
            tier: 'extended',
          },
          {
            title: '黄金文件记录了来源与生成方式',
            expect: '每个黄金文件注明生成脚本或来源，可重新生成而非手工编辑',
            tier: 'extended',
          },
          {
            title: '孤儿快照被删除且目录与测试文件对应',
            expect: '无对应被测代码的快照已删除，快照目录与测试文件一一对应，无残留的历史快照',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'ADV-COVGAP',
        name: '覆盖率盲区分析',
        automation: 'assisted',
        priority: 'P1',
        standard: ['istqb', 'iso-29119'],
        cases: [
          {
            title: '未覆盖分支与条件被逐条列出',
            expect: '报告给出未覆盖分支清单，每条标注补测计划或不可达理由',
            tier: 'core',
          },
          {
            title: '高覆盖但断言薄弱的模块被识别',
            expect: '对覆盖率达标而断言数量或强度不足的模块有清单与补测计划',
            tier: 'core',
          },
          {
            title: '异常与错误分支的覆盖被单独度量',
            expect: 'catch、错误返回与超时分支的覆盖数被单独统计，未覆盖项有说明',
            tier: 'core',
          },
          {
            title: '覆盖率盲区与历史缺陷交叉分析',
            expect: '历史缺陷所在代码位置与覆盖报告比对，高频缺陷区域优先补测',
            tier: 'extended',
          },
          {
            title: '不覆盖的部分有书面决策',
            expect: '不可达代码、平台相关分支与生成代码的不覆盖决定被记录并经评审',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'ADV-PYRAMID',
        name: '测试金字塔比例',
        automation: 'assisted',
        priority: 'P1',
        standard: ['istqb', 'iso-29119'],
        cases: [
          {
            title: '单元测试数量与占比符合金字塔结构',
            expect: '单元测试数量显著多于集成与端到端测试，比例有统计与基线记录',
            tier: 'core',
          },
          {
            title: '各层反馈耗时符合层级预期',
            expect: '单元层在分钟级完成、端到端层在约定时间内完成，各层耗时有记录',
            tier: 'core',
          },
          {
            title: '场景被放在合适层级验证',
            expect: '纯逻辑在单元层验证、跨组件协作在集成层、用户旅程在端到端层，无错位堆叠',
            tier: 'extended',
          },
          {
            title: '端到端用例数量受控且可解释',
            expect: '端到端用例总数有上限，每条能对应具体业务风险而非覆盖实现细节',
            tier: 'extended',
          },
          {
            title: '层级之间职责边界清晰且无重复维护',
            expect: '同一断言不在多个层级重复维护，重复场景已合并到最合适的层级',
            tier: 'exhaustive',
          },
        ],
      },
    ],
  },
]
