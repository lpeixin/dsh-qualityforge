/**
 * 测试域 06：界面与体验（交互与状态 · 可访问性 · 兼容性 · 国际化）。
 *
 * 本域回答的问题：在真实的网络、设备、语言与辅助技术条件下，界面是否仍然
 * 给出可理解、可恢复的反馈，并让所有用户都能完成核心任务。
 *
 * 判据来源：WCAG 2.2 AA、WAI-ARIA Authoring Practices、ISO 9241（人机交互工效学）、
 * ISO/IEC 25010（可用性与兼容性）。字段约定与注释风格见 01-build.js。
 *
 * 自动化程度说明：界面判据大多依赖真实渲染与人的感知（读屏播报、焦点流、
 * 交互时序、翻译质量），因此以 assisted / manual 为主；只有能稳定复现的检查
 * （axe 扫描对比度、视觉快照、视口矩阵、资源键比对）才标为 auto。
 */

export const categories = [
  {
    id: 'ui-interaction',
    name: '交互与状态',
    intro: '界面在加载、失败、并发与破坏性操作等真实条件下，是否给出可理解、可恢复的反馈。',
    when: ['web', 'desktop', 'mobile'],
    methods: [
      {
        id: 'UI-STATE',
        name: '加载与状态呈现',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-9241', 'iso-25010'],
        cases: [
          {
            title: '异步请求进行中界面有可见的加载反馈',
            expect: '从请求发出到返回期间出现骨架屏、进度条或 spinner，无超过 1 秒的无反馈空白区域',
            tier: 'blocker',
          },
          {
            title: '空数据状态给出原因说明与下一步入口',
            expect: '无数据时展示空态文案与至少一个可执行入口（新建、导入、清除筛选），而非空白区域或永久骨架屏',
            tier: 'core',
          },
          {
            title: '请求失败展示可理解的错误说明与重试入口',
            expect: '错误态包含失败原因或错误码与重试按钮，点击重试重新发起同一请求且原输入不丢失',
            tier: 'blocker',
          },
          {
            title: '批量操作部分成功时逐条标注成败明细',
            expect: '返回部分失败时界面分别列出成功项与失败项及各自原因，不整体提示成功或整体提示失败',
            tier: 'core',
          },
          {
            title: '骨架屏与最终内容尺寸一致且切换不跳动',
            expect: '占位块尺寸与真实内容一致，加载完成后主要区块无明显位移，滚动位置不突变',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'UI-FORM',
        name: '表单校验与提交反馈',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-9241'],
        cases: [
          {
            title: '字段校验错误在对应控件旁就地展示',
            expect: '每个校验失败字段旁出现说明如何修正的具体文案，而非仅顶部一句概括或仅红色边框',
            tier: 'blocker',
          },
          {
            title: '提交按钮在提交中禁用并阻止重复提交',
            expect: '点击提交后按钮进入禁用或加载态，连点与回车重复触发只产生一次请求',
            tier: 'blocker',
          },
          {
            title: '服务端校验失败映射回字段且保留已填内容',
            expect: '接口返回的字段级错误定位到对应控件，其余已填字段值不被清空',
            tier: 'core',
          },
          {
            title: '校验提示时机一致且不打断正常输入',
            expect: '失焦与提交时提示错误，输入过程中不弹出报错；修正后错误提示即时消失',
            tier: 'core',
          },
          {
            title: '长表单校验失败自动定位到首个错误字段',
            expect: '提交校验失败后视口滚动到第一个错误字段并使其获得焦点，无需人工查找',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'UI-OPTIMISTIC',
        name: '乐观更新与回滚',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '乐观更新在请求失败后回滚到操作前状态',
            expect: '先本地生效的操作在失败后恢复原状（含计数、排序、列表项），并出现失败提示',
            tier: 'core',
          },
          {
            title: '乐观更新期间展示可区分的处理中标记',
            expect: '临时生效的条目带 pending 样式（半透明、转圈或占位），与已确认数据可区分',
            tier: 'core',
          },
          {
            title: '连续乐观更新按提交顺序收敛到服务端状态',
            expect: '快速连续操作后界面与重新拉取的服务端数据一致，无错序、无丢失',
            tier: 'extended',
          },
          {
            title: '回滚后不残留临时标识与本地脏数据',
            expect: '失败回滚后无临时 id、占位条目与本地缓存残留，重新进入页面结果一致',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'UI-FOCUS',
        name: '键盘与焦点流',
        automation: 'assisted',
        priority: 'P0',
        standard: ['wcag-22-aa', 'iso-9241'],
        cases: [
          {
            title: '模态打开后焦点进入并在关闭后归还触发元素',
            expect: '打开模态后焦点落在模态内首个可交互元素，关闭（含 Esc）后焦点回到原触发按钮',
            tier: 'core',
          },
          {
            title: 'Esc 关闭当前浮层且不触发背景提交',
            expect: '按 Esc 仅关闭最上层浮层，背景表单内容与提交状态不变',
            tier: 'core',
          },
          {
            title: 'Tab 顺序与视觉阅读顺序保持一致',
            expect: '按 Tab 遍历页面时焦点顺序与视觉从上到下、从左到右一致，无跳序或遗漏可见控件',
            tier: 'core',
          },
          {
            title: '焦点不因异步内容刷新而丢失或跳到页首',
            expect: '列表刷新与局部重渲染后焦点仍停留在原元素或语义等价元素上，不回到文档开头',
            tier: 'extended',
          },
          {
            title: '自定义快捷键不与浏览器和输入法冲突',
            expect: '快捷键组合不与系统、浏览器、输入法默认键冲突，且界面内可查看快捷键说明',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'UI-LIST',
        name: '长列表与虚拟滚动',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '虚拟列表滚动后可见项与滚动位置对应',
            expect: '快速滚动到任意位置后可见行数据与滚动位置一致，无空白占位、无错位行',
            tier: 'core',
          },
          {
            title: '触底自动加载下一页且不出现重复项',
            expect: '分页追加后列表无重复 id、无位置跳变，加载中显示底部加载指示',
            tier: 'core',
          },
          {
            title: '列表项使用稳定 key 且重排后状态不错乱',
            expect: '排序或过滤后行内选中态、展开态跟随原数据项移动，不串到相邻行',
            tier: 'extended',
          },
          {
            title: '大数据量列表首屏渲染不阻塞交互',
            expect: '万级数据首次渲染期间滚动与点击仍可响应，无超过 1 秒的界面冻结',
            tier: 'extended',
          },
          {
            title: '返回列表时滚动位置与筛选条件被恢复',
            expect: '从详情返回后列表停留在原滚动位置，并保持原筛选与排序条件',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'UI-CONCURRENCY',
        name: '并发操作与双击防护',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '双击提交按钮只产生一次服务端副作用',
            expect: '双击或连点提交后服务端仅存在一条对应记录，无重复单据与重复扣减',
            tier: 'blocker',
          },
          {
            title: '重复触发同一操作按幂等处理不产生重复结果',
            expect: '网络重试或用户重复点击后结果与单次操作一致，界面不出现重复条目',
            tier: 'core',
          },
          {
            title: '并发修改冲突时提示而非静默覆盖',
            expect: '版本过期或冲突返回时提示数据已被他人修改，并给出重载或合并选择',
            tier: 'core',
          },
          {
            title: '多标签页操作同一资源时状态能收敛',
            expect: '一个标签页的修改在另一标签页刷新或操作后不会造成丢失或双写',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'UI-DESTRUCTIVE',
        name: '破坏性操作二次确认',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-9241'],
        cases: [
          {
            title: '破坏性操作经二次确认后才真正执行',
            expect: '删除、清空、撤销发布在确认前不产生任何服务端变更，取消后原数据完好',
            tier: 'blocker',
          },
          {
            title: '确认对话框写明影响对象与不可逆后果',
            expect: '对话框包含具体对象名称或数量以及是否可恢复的说明，而非通用的一句是否确认',
            tier: 'core',
          },
          {
            title: '批量破坏性操作展示受影响数量与范围',
            expect: '执行前显示选中条数及是否包含关联数据，执行后结果与提示数量一致',
            tier: 'core',
          },
          {
            title: '危险操作对话框的默认焦点落在取消项',
            expect: '对话框打开时焦点位于取消按钮，直接回车不会执行破坏性动作',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'ui-a11y',
    name: '可访问性',
    intro: '残障用户借助键盘与辅助技术能否完整完成核心任务，判据以 WCAG 2.2 AA 为准。',
    when: ['web', 'desktop', 'mobile'],
    methods: [
      {
        id: 'A11Y-SEMANTIC',
        name: '语义化标签与地标',
        automation: 'assisted',
        priority: 'P0',
        standard: ['wcag-22-aa', 'wai-aria'],
        cases: [
          {
            title: '页面提供唯一主地标与可跳转的导航地标',
            expect: '每页存在且仅存在一个 main 地标，导航区使用 nav 标注，地标列表可定位到主要内容',
            tier: 'core',
          },
          {
            title: '标题层级连续且与内容结构对应',
            expect: 'h1 至 h6 按层级递进不跳级，视觉字号调整不改变语义层级',
            tier: 'core',
          },
          {
            title: '按钮与链接按行为语义选择元素',
            expect: '触发动作使用 button、跳转使用带 href 的 a，Enter 与 Space 的行为符合元素原生语义',
            tier: 'blocker',
          },
          {
            title: '表单控件与标签通过 for/id 或包裹方式关联',
            expect: '每个输入控件都有可编程关联的 label，点击标签能把焦点移到对应控件',
            tier: 'blocker',
          },
          {
            title: '列表与表格使用语义化结构标记',
            expect: '数据表格使用 table/thead/th 并声明 scope，列表使用 ul/ol，层级结构对辅助技术可读',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'A11Y-KB',
        name: '键盘可达与焦点可见',
        automation: 'assisted',
        priority: 'P0',
        standard: ['wcag-22-aa'],
        cases: [
          {
            title: '全部可交互元素可仅用键盘到达并操作',
            expect: 'Tab 与 Shift+Tab 能到达所有操作入口，Enter 或 Space 能触发，无必须鼠标才能完成的操作',
            tier: 'blocker',
          },
          {
            title: '焦点指示器清晰可见且未被样式移除',
            expect: '每个可获得焦点的元素都有可见焦点环，与相邻背景对比明显，移除 outline 处均有替代样式',
            tier: 'blocker',
          },
          {
            title: '模态内焦点受限且不逃逸到背景内容',
            expect: '模态打开时 Tab 循环停留在模态内，背景内容不可聚焦，关闭后焦点约束解除',
            tier: 'core',
          },
          {
            title: '提供跳转到主内容的跳过导航链接',
            expect: '首个 Tab 停靠点为跳到主内容的链接，激活后焦点落在主内容区而非回到页首',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'A11Y-SR',
        name: '屏幕阅读器标签与实时区',
        automation: 'assisted',
        priority: 'P0',
        standard: ['wcag-22-aa', 'wai-aria'],
        cases: [
          {
            title: '纯图标按钮具备可朗读的无障碍名称',
            expect: '读屏聚焦时能念出按钮用途（aria-label 或视觉隐藏文本），不出现无名称的按钮',
            tier: 'blocker',
          },
          {
            title: '动态状态变化通过实时区播报',
            expect: '保存成功、校验失败、加载完成等通过 aria-live 或 role=status 播报，且不重复朗读整页内容',
            tier: 'core',
          },
          {
            title: 'ARIA 角色与状态取值合法且不滥用',
            expect: 'role 与 aria-* 取值合法、状态随交互同步更新；原生语义已足够时不叠加多余 role',
            tier: 'core',
          },
          {
            title: '自定义组件遵循 APG 的键盘与角色约定',
            expect: '下拉、标签页、树、日期选择等组件的 role 与方向键行为与 WAI-ARIA APG 对应模式一致',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'A11Y-CONTRAST',
        name: '对比度与色彩独立性',
        automation: 'auto',
        priority: 'P0',
        standard: ['wcag-22-aa'],
        cases: [
          {
            title: '正文与背景对比度不低于 4.5 比 1',
            expect: 'axe 或对比度工具扫描正文文本对比度不小于 4.5:1、大字与图形元素不小于 3:1，无未处理告警',
            tier: 'blocker',
          },
          {
            title: '状态与信息不依赖颜色单一传达',
            expect: '错误、成功、必填、选中除颜色外还有图标、文本或形状差异，灰度截图下仍可区分',
            tier: 'core',
          },
          {
            title: '深浅色两套主题下均满足对比度要求',
            expect: '两套主题分别扫描均达标，无某主题下文字融入背景或图标不可见',
            tier: 'core',
          },
          {
            title: '禁用态与占位文本仍可辨识',
            expect: '禁用控件、placeholder 与辅助说明文本对比度不小于 3:1，且与可编辑态可区分',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'A11Y-ZOOM',
        name: '缩放与文本放大',
        automation: 'assisted',
        priority: 'P1',
        standard: ['wcag-22-aa'],
        cases: [
          {
            title: '页面放大 200% 不丢失内容与功能',
            expect: '浏览器缩放 200% 后无内容被裁切、无控件重叠，所有功能仍可操作',
            tier: 'core',
          },
          {
            title: '窄视口下内容重排为单列且无横向滚动',
            expect: '等效 320 CSS px 宽度下正文单列重排，除数据表格等允许场景外不出现横向滚动条',
            tier: 'core',
          },
          {
            title: '仅放大文本不破坏既有布局',
            expect: '仅将字号增至 200% 时容器随内容增高，无文字溢出裁切或被相邻元素遮挡',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'A11Y-MOTION',
        name: '动效减弱与闪烁控制',
        automation: 'assisted',
        priority: 'P2',
        standard: ['wcag-22-aa'],
        cases: [
          {
            title: '尊重系统减弱动效偏好设置',
            expect: '开启 reduce motion 后关闭位移、缩放、视差等大幅动画，仅保留必要的状态切换',
            tier: 'core',
          },
          {
            title: '自动播放动效超过 5 秒可暂停',
            expect: '轮播与背景动画提供暂停或停止控件，或在 5 秒内自动结束',
            tier: 'extended',
          },
          {
            title: '页面无每秒 3 次以上的闪烁内容',
            expect: '任意区域无超过 3 Hz 的闪烁，无大面积高对比跳变',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'A11Y-FORMERR',
        name: '表单错误关联与提示',
        automation: 'assisted',
        priority: 'P0',
        standard: ['wcag-22-aa'],
        cases: [
          {
            title: '错误文本在代码层与对应字段关联',
            expect: '错误字段带 aria-invalid 且 aria-describedby 指向错误文本，读屏聚焦字段时朗读出该错误',
            tier: 'blocker',
          },
          {
            title: '错误汇总可聚焦且可跳转到对应字段',
            expect: '提交失败后错误汇总获得焦点或被读屏播报，汇总条目可激活并定位到对应字段',
            tier: 'core',
          },
          {
            title: '必填与格式要求在输入前已说明',
            expect: '必填标记与格式要求（日期、密码规则）在输入前可见且对读屏可读，不只在出错后才提示',
            tier: 'core',
          },
          {
            title: '输入目的可被自动填充正确识别',
            expect: '姓名、邮箱、电话、验证码等字段设置了正确的 autocomplete 值，浏览器与密码管理器可填充',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'ui-compat',
    name: '兼容性与响应式',
    intro: '在目标浏览器、设备、输入方式、主题与网络条件下，界面是否保持可用与可读。',
    when: ['web', 'desktop', 'mobile'],
    methods: [
      {
        id: 'COMPAT-MATRIX',
        name: '目标浏览器与设备矩阵',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '受支持的浏览器与系统矩阵已声明',
            expect: '文档列出支持的浏览器、系统与版本区间，覆盖线上用户占比不低于 95% 的流量',
            tier: 'core',
          },
          {
            title: '矩阵边界版本完成核心用例并留存结果',
            expect: '在矩阵中最高与最低版本各执行一轮核心用例，关键路径可完成且结果已记录',
            tier: 'blocker',
          },
          {
            title: '非基线 API 使用前有特性检测与降级',
            expect: '新 API 通过特性检测或 @supports 保护，缺失时走降级分支而非白屏或抛错',
            tier: 'core',
          },
          {
            title: '不受支持的环境有明确提示或阻断',
            expect: '在不支持的环境显示可读的升级提示或降级页面，不出现静默的功能失效',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'COMPAT-RESPONSIVE',
        name: '响应式断点与极端视口',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '断点行为与设计规范保持一致',
            expect: '在设计约定的每个断点宽度上布局切换正确，断点附近无抖动或中间态错乱',
            tier: 'core',
          },
          {
            title: '320px 至 4K 视口下无溢出与遮挡',
            expect: '极端宽度下关键内容不被裁切、按钮不被遮挡，文本保持可读',
            tier: 'blocker',
          },
          {
            title: '横竖屏切换保持状态与布局正确',
            expect: '旋转设备后表单内容与滚动位置保留，布局重排无错位与闪烁',
            tier: 'core',
          },
          {
            title: '超宽屏下正文行宽受约束',
            expect: '大屏下正文行宽有最大宽度限制（如不超过约 80 字符或 1200px），不整行拉伸',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'COMPAT-INPUT',
        name: '触摸与指针差异',
        automation: 'assisted',
        priority: 'P1',
        standard: ['wcag-22-aa'],
        cases: [
          {
            title: '触摸目标尺寸满足最小可达要求',
            expect: '主要操作目标不小于 44×44 CSS px，密集列表内至少 24×24 且间距足够，无相邻误触',
            tier: 'core',
          },
          {
            title: '仅悬停可见的信息在触摸端仍可获取',
            expect: 'tooltip 与悬浮操作在触摸设备上可点按或长按显示，功能不依赖 hover',
            tier: 'blocker',
          },
          {
            title: '指针手势提供单点等价操作',
            expect: '多指或路径手势（滑动、捏合、拖拽）均有按钮或菜单形式的等价操作',
            tier: 'extended',
          },
          {
            title: '右键与长按菜单有可见替代入口',
            expect: '仅通过右键或长按触发的功能在界面中有可见按钮入口，触屏用户可发现',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'COMPAT-THEME',
        name: '深浅色主题',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-9241'],
        cases: [
          {
            title: '主题跟随系统且手动选择可持久化',
            expect: '首次进入跟随系统设置，手动切换后刷新页面与重新登录仍保持该选择',
            tier: 'core',
          },
          {
            title: '主题切换无错误闪烁与不可读内容',
            expect: '首帧不出现反色闪烁，切换后文本、图标、图表与边框均清晰可辨',
            tier: 'core',
          },
          {
            title: '两套主题下图片与图表内容均可读',
            expect: '深色主题下无刺眼白底图片，图表网格线与数据系列对比可辨',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'COMPAT-NETWORK',
        name: '离线与弱网表现',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '断网时给出离线提示而非空白页',
            expect: '离线访问显示离线状态与恢复指引，已缓存内容仍可查看',
            tier: 'core',
          },
          {
            title: '弱网下请求超时可控且可取消',
            expect: '慢速网络下界面在约定时间内显示超时或加载提示，并允许取消与重试，不无限转圈',
            tier: 'core',
          },
          {
            title: '网络恢复后自动重试并提示同步结果',
            expect: '恢复联网后待提交数据自动重试或明确提示用户操作，且不产生重复提交',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'COMPAT-DPI',
        name: '缩放与高 DPI 显示',
        automation: 'assisted',
        priority: 'P2',
        standard: ['iso-9241'],
        cases: [
          {
            title: '系统 125% 与 150% 缩放下布局无裁切重叠',
            expect: '常见系统缩放比例下界面元素完整可见，无错位、裁切或半像素模糊',
            tier: 'core',
          },
          {
            title: '高 DPI 屏幕上图片与图标清晰',
            expect: '2 倍及以上像素密度的屏幕上位图资源提供高分倍率版本，无明显模糊或锯齿',
            tier: 'extended',
          },
          {
            title: 'Canvas 与图表按设备像素比渲染',
            expect: '画布按 devicePixelRatio 缩放，线条与文字在高分屏不模糊、不出现半像素描边',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'ui-i18n',
    name: '国际化与本地化',
    intro: '多语言、多地区、多书写方向下，文案、格式与资源是否正确且完整地呈现。',
    when: ['web', 'desktop', 'mobile'],
    methods: [
      {
        id: 'I18N-TEXT',
        name: '文案外置与无硬编码',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-9241'],
        cases: [
          {
            title: '界面可见文案全部来自资源文件',
            expect: '源码中不存在面向用户的硬编码字符串，切换语言后界面全部文案随之变化',
            tier: 'blocker',
          },
          {
            title: '非正文文案同样被抽取管理',
            expect: '错误提示、空态、toast、aria-label、alt、placeholder、title 均能在资源文件中找到',
            tier: 'core',
          },
          {
            title: '文案键按模块命名空间组织且语义清晰',
            expect: '键形如 order.detail.submit，不以完整英文句子或流水编号作为键名',
            tier: 'extended',
          },
          {
            title: '句子通过占位符整体成串而非拼接构造',
            expect: '含变量的句子在资源文件中整体定义，代码中无 a 加名词加 b 的字符串拼接',
            tier: 'core',
          },
        ],
      },
      {
        id: 'I18N-PLURAL',
        name: '复数性别与语序',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-9241'],
        cases: [
          {
            title: '复数形式按目标语言的规则处理',
            expect: '使用 ICU 复数类别或等价机制，俄语、阿拉伯语等语言的 few/many/other 形式输出正确',
            tier: 'core',
          },
          {
            title: '数量为 0 与 1 的表达符合语言习惯',
            expect: '0 条、1 条、2 条分别输出目标语言的正确形式，不出现 1 items 这类错误组合',
            tier: 'core',
          },
          {
            title: '需要性别的语言提供对应表达形式',
            expect: '法语、西班牙语等语言的称谓与形容词提供性别或敬语变体，不固定使用单一形式',
            tier: 'extended',
          },
          {
            title: '译文可整体调整语序而不迁就源语言',
            expect: '日期、地址、姓名等组合的语序由译文决定，改动译文无需改动代码结构',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'I18N-FORMAT',
        name: '日期时间数字与时区',
        automation: 'assisted',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '日期与时间按当前语言与地区格式化',
            expect: 'en-US 显示 M/D/YYYY、de-DE 显示 D.M.YYYY，切换语言后格式同步变化',
            tier: 'core',
          },
          {
            title: '时区标注明确且跨时区不串日',
            expect: '界面标注时区或按用户时区换算，不同时区用户看到同一时刻，跨日边界不错一天',
            tier: 'blocker',
          },
          {
            title: '数字、货币与百分比按地区习惯格式化',
            expect: '千分位、小数点、货币符号与位置符合地区习惯（如 1.234,56 € 与 $1,234.56）',
            tier: 'core',
          },
          {
            title: '排序与检索遵循语言排序规则',
            expect: '列表按 locale 规则排序（如瑞典语 å ä ö 的顺序），搜索可忽略语言特有变音差异',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'I18N-RTL',
        name: 'RTL 与长文案溢出',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-9241'],
        cases: [
          {
            title: 'RTL 语言下布局整体镜像正确',
            expect: 'dir=rtl 时导航、对齐、进度与间距方向镜像，使用逻辑属性而非固定左右定位',
            tier: 'core',
          },
          {
            title: '方向性图标按语义决定是否翻转',
            expect: '返回、前进等方向图标在 RTL 下翻转，播放、时钟、品牌标识等保持原方向',
            tier: 'extended',
          },
          {
            title: '长文案不截断关键操作与信息',
            expect: '德语、俄语等长文案下按钮与表头不溢出容器，关键信息不被省略号吞掉',
            tier: 'core',
          },
          {
            title: '双向混排的数字与链接显示正确',
            expect: 'RTL 文本中嵌入的英文、URL 与手机号按 bidi 规则显示，相邻标点位置正确',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'I18N-COVERAGE',
        name: '翻译完整性与回退',
        automation: 'auto',
        priority: 'P0',
        standard: ['iso-25010'],
        cases: [
          {
            title: '各发布语言的资源键完整无缺失',
            expect: '资源键比对脚本对每种发布语言输出缺失键数量为 0，或缺失项已登记并有处理计划',
            tier: 'blocker',
          },
          {
            title: '缺失翻译回退到默认语言而非显示键名',
            expect: '人为删除某个键后界面显示默认语言文案，不出现键名、空白或报错',
            tier: 'core',
          },
          {
            title: '非默认语言界面无残留未翻译源文案',
            expect: '逐页走查目标语言界面，除专有名词外无成段源语言残留',
            tier: 'core',
          },
          {
            title: '伪本地化测试不暴露截断与硬编码',
            expect: '使用加长伪语言后无布局溢出、无文本被裁切，且无未包裹而显示为原文的文案',
            tier: 'extended',
          },
          {
            title: '术语与语气经母语者评审且全文一致',
            expect: '关键流程存在术语表并经母语者确认，同一概念在各页面译法一致',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'I18N-RESOURCE',
        name: '本地化资源加载',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-25010'],
        cases: [
          {
            title: '语言切换后界面文案即时生效',
            expect: '切换语言后当前页面文案立即更新，无需手工刷新，不出现两种语言混排',
            tier: 'core',
          },
          {
            title: '语言选择优先级明确且可被用户覆盖',
            expect: '用户在设置中的显式选择优先于浏览器 Accept-Language，且下次访问仍生效',
            tier: 'core',
          },
          {
            title: '本地化字体与图片资源正确加载',
            expect: '中日韩与阿拉伯文使用可用字体且无豆腐块，本地化图片与样式资源请求无 404',
            tier: 'extended',
          },
          {
            title: '语言切换保持当前页面上下文',
            expect: '在表单或列表页切换语言后已填内容、筛选条件与滚动位置不丢失',
            tier: 'extended',
          },
        ],
      },
    ],
  },
]
