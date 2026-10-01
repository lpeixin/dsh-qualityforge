/**
 * 测试域 07：端到端与验收（关键用户旅程 · 需求符合性 · 回归与发布验证）。
 *
 * 本域回答的问题：从真实用户与业务方视角看，系统是否把该做的事做完、做对，
 * 并且这次变更没有把原本可用的能力弄坏。
 *
 * 判据来源：ISTQB（验收测试、回归测试、基于风险的测试）、ISO/IEC 25010（功能适合性）。
 * 字段约定与注释风格见 01-build.js。
 *
 * 自动化程度说明：可脚本化并在近生产环境运行的旅程标为 auto；需求追溯、
 * 用例集完备性与检查单需要读材料判定，标为 assisted；业务规则确认与签收
 * 必须由业务方完成，标为 manual。支付类方法仅在具备该业务的项目类型展开。
 */

export const categories = [
  {
    id: 'e2e-journey',
    name: '关键用户旅程',
    intro: '真实用户从进入到达成目标的关键路径，能否在接近生产的环境中走通并可验证结果。',
    methods: [
      {
        id: 'E2E-JOURNEY',
        name: '核心业务闭环',
        automation: 'auto',
        priority: 'P0',
        standard: ['istqb', 'iso-25010'],
        cases: [
          {
            title: '核心闭环从入口到结果可完整走通',
            expect: '在预发或验收环境完成一次完整业务闭环，最终业务数据与状态在库中可查且取值正确',
            tier: 'blocker',
          },
          {
            title: '旅程各步骤的用户可见结果与定义一致',
            expect: '每一步之后界面状态、单据状态与通知符合该步骤定义，流程不停留在中间态',
            tier: 'core',
          },
          {
            title: '旅程产生的下游数据同步正确',
            expect: '闭环完成后通知、报表、审计日志与对账数据同步生成，数量与内容与主流程一致',
            tier: 'core',
          },
          {
            title: '旅程中的异常分支可被发现并可恢复',
            expect: '在关键步骤制造失败（接口报错、余额不足、超时）后用户看到可理解提示，可重试或退出且不产生脏数据',
            tier: 'core',
          },
        ],
      },
      {
        id: 'E2E-ONBOARD',
        name: '首次使用与新手引导',
        automation: 'manual',
        priority: 'P1',
        standard: ['istqb'],
        cases: [
          {
            title: '全新账号首次进入展示引导且可跳过',
            expect: '新注册账号首次进入核心页面出现引导或空态说明，存在跳过入口，跳过后不再强制弹出',
            tier: 'core',
          },
          {
            title: '引导步骤与实际界面和权限保持一致',
            expect: '按引导逐步操作可完成，指向的入口在当前版本存在且对当前角色可见',
            tier: 'core',
          },
          {
            title: '引导完成状态被记录且可重置',
            expect: '完成引导后刷新页面与更换设备登录不再弹出，且存在重置入口可重新查看',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'E2E-AUTH',
        name: '注册登录与找回',
        automation: 'auto',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '注册到可用的完整链路可走通',
            expect: '新用户完成注册（含邮箱或短信验证与必填资料）后可登录并进入首屏，验证码有有效期与错误提示',
            tier: 'blocker',
          },
          {
            title: '登录登出与会话行为符合产品定义',
            expect: '登录后可访问受保护页面，登出后回退无法进入，多端登录策略与产品定义一致',
            tier: 'blocker',
          },
          {
            title: '找回密码链路安全可用',
            expect: '通过邮箱或短信重置密码成功，重置链接一次性且过期后失效，旧密码不再可登录',
            tier: 'core',
          },
          {
            title: '异常登录与账号锁定有明确反馈',
            expect: '连续输错密码达到阈值后提示锁定或要求额外验证，解锁路径可自助完成',
            tier: 'core',
          },
          {
            title: '第三方登录与二次验证的绑定解绑可用',
            expect: '第三方账号登录后可绑定与解绑，解绑前要求保留其他登录方式，解绑后账号仍可正常访问',
            tier: 'extended',
            when: ['web', 'mobile', 'desktop'],
          },
        ],
      },
      {
        id: 'E2E-RESUME',
        name: '中断恢复',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '刷新或重进页面后未完成流程可继续',
            expect: '在多步流程中刷新浏览器后回到可继续的步骤，已填内容按约定保留或可从草稿恢复',
            tier: 'core',
          },
          {
            title: '网络掉线重连后不重复提交且不丢数据',
            expect: '弱网或断网恢复后操作最终成功且服务端仅存在一条记录，界面提示同步结果',
            tier: 'blocker',
          },
          {
            title: '会话过期后重新登录可回到原上下文',
            expect: '登录态失效时跳转登录并在成功后返回原页面或继续原操作，进行中的输入不丢失',
            tier: 'core',
          },
          {
            title: '客户端异常退出后数据与服务端一致',
            expect: '强制关闭应用后重新打开，本地与服务端数据一致，无半完成状态或孤立草稿残留',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'E2E-PAY',
        name: '支付与结算敏感流程',
        automation: 'assisted',
        priority: 'P0',
        when: ['web', 'mobile', 'desktop'],
        standard: ['istqb'],
        cases: [
          {
            title: '支付成功失败与取消三种结果状态一致',
            expect: '三种结果下订单状态、支付单状态、界面提示与通知一致，失败与取消不产生已支付记录',
            tier: 'blocker',
            tags: ['payment'],
          },
          {
            title: '重复支付被幂等拦截且账目无重复扣减',
            expect: '同一订单重复发起或回调重复到达时只产生一笔成功支付，对账金额与订单一致',
            tier: 'blocker',
            tags: ['payment', 'idempotent'],
          },
          {
            title: '退款与撤销闭环可用且金额可追溯',
            expect: '全额与部分退款后金额与状态与原支付单对应，退款流水与财务对账结果一致',
            tier: 'core',
            tags: ['payment'],
          },
          {
            title: '优惠与税费计算与实收金额一致',
            expect: '含折扣、优惠券、税费的订单按业务规则计算，与支付网关实收金额精确到分一致',
            tier: 'core',
            tags: ['payment'],
          },
          {
            title: '支付回调延迟时订单可最终一致',
            expect: '回调延迟或丢失时由轮询或补偿任务在约定时间内把订单推进到正确状态，不长期停留待支付',
            tier: 'core',
            tags: ['payment'],
          },
        ],
      },
      {
        id: 'E2E-COLLAB',
        name: '多角色协作流程',
        automation: 'manual',
        priority: 'P1',
        standard: ['istqb'],
        cases: [
          {
            title: '多角色流转的状态与权限正确',
            expect: '提交、审批、执行链路中每个角色只看到并只能操作其权限内的动作，状态按流程推进',
            tier: 'blocker',
          },
          {
            title: '角色切换后不可见也不可操作越权数据',
            expect: '以低权限角色登录后无法看到或操作高权限数据，直接访问 URL 或接口同样被拒绝',
            tier: 'core',
          },
          {
            title: '同一单据的并发处理有抢占与提示',
            expect: '两人同时处理同一待办时后操作者收到已被处理提示，不产生重复审批或重复执行',
            tier: 'core',
          },
          {
            title: '通知与待办与流程状态保持同步',
            expect: '每次流转后相关角色收到通知且待办数量与状态同步，处理后待办消失',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'acceptance',
    name: '验收与需求符合性',
    intro: '交付物是否逐条满足需求与验收标准，并取得业务方对范围与遗留问题的正式确认。',
    methods: [
      {
        id: 'ACC-REQ',
        name: '需求与用户故事逐条验收',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb', 'iso-25010'],
        cases: [
          {
            title: '需求条目与测试项双向可追溯',
            expect: '存在需求与测试项追溯矩阵，每条 P0 与 P1 需求至少对应一个已执行测试项，无孤立需求',
            tier: 'blocker',
          },
          {
            title: '每条验收标准都有对应的验证证据',
            expect: '逐条核对验收标准，每条都能指向执行记录、截图或自动化报告作为证据',
            tier: 'core',
          },
          {
            title: '需求变更与未实现项有结论与批准',
            expect: '偏离原始需求的功能有变更记录与批准人，未实现项被明确标记而未被默认视为通过',
            tier: 'core',
          },
          {
            title: '需求之外新增的功能已被确认范围',
            expect: '实现范围与需求清单的差异逐项列出并经业务方确认，无未申报的隐性功能',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'ACC-TESTABLE',
        name: '验收标准可测性',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '验收标准包含量化阈值与判定条件',
            expect: '每条标准含可测的数值、时间或状态条件（如 3 秒内返回、金额误差不超过 0.01）',
            tier: 'core',
          },
          {
            title: '模糊表述在使用前被澄清为可测条件',
            expect: '快速、友好、尽量、合理等词已替换为具体指标，或记录澄清结论与确认人',
            tier: 'blocker',
          },
          {
            title: '验收标准具备前置条件操作与预期三要素',
            expect: '抽查若干标准均含前置条件、操作步骤与预期结果，可直接据此设计并执行用例',
            tier: 'core',
          },
        ],
      },
      {
        id: 'ACC-BOUNDARY',
        name: '边界业务规则',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '业务数值边界在上下限与越界值各验证一次',
            expect: '额度、数量、期限在最小值、最大值及越界值上的行为符合规则并给出明确提示',
            tier: 'blocker',
          },
          {
            title: '状态机的非法流转被明确拒绝',
            expect: '跳过必经状态或回退到不允许状态时操作被拒绝，数据保持原状态且给出原因',
            tier: 'core',
          },
          {
            title: '组合业务规则冲突有确定且可复现的结论',
            expect: '折扣叠加、权限交叉、优惠互斥等组合场景按业务优先级定义输出结果，重复执行结果一致',
            tier: 'core',
          },
          {
            title: '时间与周期边界下业务结果正确',
            expect: '跨天、跨月、跨年、闰年与夏令时切换时周期计算、账单与提醒结果符合业务约定',
            tier: 'extended',
          },
          {
            title: '金额与数量取整规则符合业务与财务口径',
            expect: '按约定的舍入方式与精度处理（分位、四舍五入或银行家舍入），与财务统计结果一致',
            tier: 'core',
          },
        ],
      },
      {
        id: 'ACC-SIGNOFF',
        name: '业务方签收',
        automation: 'manual',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '业务方在验收环境亲自实操关键场景',
            expect: '业务方按验收用例在验收环境操作核心场景并留下记录，而非仅观看演示或口头确认',
            tier: 'blocker',
          },
          {
            title: '签收结论与遗留问题清单一致',
            expect: '签收单列出遗留问题、影响范围与处理时限，签收范围与实际问题状态一致',
            tier: 'core',
          },
          {
            title: '准入标准满足后才允许签收',
            expect: '存在明确准入条件（无未关闭阻断缺陷、核心用例全部通过）且实际状态满足条件',
            tier: 'core',
          },
        ],
      },
      {
        id: 'ACC-DESIGN',
        name: '与原型和设计稿一致性',
        automation: 'manual',
        priority: 'P1',
        standard: ['iso-9241'],
        cases: [
          {
            title: '关键页面与设计稿逐项比对一致',
            expect: '布局、间距、字体、颜色与文案和设计稿一致，偏差项有记录与豁免结论',
            tier: 'core',
          },
          {
            title: '设计变更已同步到已实现页面',
            expect: '版本内的设计变更在设计稿与实现中同时体现，不存在实现早于或长期滞后于设计的情况',
            tier: 'core',
          },
          {
            title: '组件各交互状态与设计规范一致',
            expect: '默认、悬停、聚焦、禁用、加载、错误状态与设计规范一致，未出现自造样式',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'ACC-METRICS',
        name: '埋点与业务指标',
        automation: 'assisted',
        priority: 'P1',
        standard: ['istqb'],
        cases: [
          {
            title: '埋点事件与属性符合埋点文档',
            expect: '核对事件名、属性名与取值类型与文档一致，无自造字段与缺失必填属性',
            tier: 'core',
          },
          {
            title: '关键旅程的埋点触发次数与顺序正确',
            expect: '完成一次核心旅程后上报的事件顺序与次数与设计一致，无重复上报与丢失',
            tier: 'blocker',
          },
          {
            title: '埋点取值正确且单位统一',
            expect: '金额单位、时间戳时区与枚举取值符合约定，上报值与界面实际状态一致',
            tier: 'core',
          },
          {
            title: '看板口径可与业务数据对账',
            expect: '漏斗与指标口径与业务定义一致，抽样日数据可与后端统计对齐且偏差在约定范围内',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'regression',
    name: '回归与发布验证',
    intro: '这次变更是否被有依据地验证过影响面，并且具备可控的放量与回退能力。',
    methods: [
      {
        id: 'REG-SET',
        name: '回归用例集与影响面分析',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '回归集按模块与风险分层维护',
            expect: '回归用例按模块、优先级与关联需求组织，可依据变更范围快速选取应执行的子集',
            tier: 'blocker',
          },
          {
            title: '每次变更输出受影响用例清单',
            expect: '变更单或合并请求中记录受影响模块与需回归的用例清单，覆盖直接与间接依赖',
            tier: 'blocker',
          },
          {
            title: '回归执行结果可追溯到版本与环境',
            expect: '每次回归记录版本、环境、执行人、通过率与失败明细，可回溯到具体构建',
            tier: 'core',
          },
          {
            title: '回归集定期评审并清理失效用例',
            expect: '有评审记录，因需求下线而失效的用例被删除或更新，集合规模无持续膨胀',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REG-SMOKE',
        name: '冒烟集构建',
        automation: 'auto',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '冒烟集覆盖核心闭环并在约定时长内跑完',
            expect: '冒烟集覆盖各核心模块主流程，全量执行时长不超过发布节奏允许的阈值且该阈值已记录',
            tier: 'blocker',
          },
          {
            title: '冒烟失败即阻断后续发布动作',
            expect: '冒烟未通过时流水线阻断构建晋级或发布，继续需要显式豁免并留痕',
            tier: 'blocker',
          },
          {
            title: '冒烟集在每次候选构建上自动执行',
            expect: '每次构建自动触发冒烟并留存报告与日志，无需人工发起',
            tier: 'core',
          },
          {
            title: '冒烟集可对任意候选版本独立执行',
            expect: '冒烟不依赖固定环境或人工预置数据，可在任意候选版本与干净环境上重复运行',
            tier: 'core',
          },
        ],
      },
      {
        id: 'REG-DEFECT',
        name: '缺陷回归闭环',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '每个已修复缺陷都有对应的回归验证记录',
            expect: '缺陷单关联修复提交与验证结果，验证人、验证版本与结论齐全',
            tier: 'blocker',
          },
          {
            title: '缺陷复现步骤被固化为可重复执行的用例',
            expect: '高价值缺陷转为回归用例并纳入集合，后续版本可自动或手工复跑',
            tier: 'core',
          },
          {
            title: '修复引入的连带问题被同批次回归发现',
            expect: '修复涉及模块的相邻功能在本轮回归中被覆盖，连带缺陷被记录并评估影响',
            tier: 'extended',
          },
          {
            title: '未修复缺陷有明确处置与批准',
            expect: '延期、降级或豁免的缺陷记录了理由、影响评估与批准人，未被静默关闭',
            tier: 'core',
          },
        ],
      },
      {
        id: 'REG-DATA',
        name: '数据兼容回归',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '旧版本数据在新版本可读且语义不变',
            expect: '使用上一版本生产数据样本升级后，关键记录可读且字段含义与统计口径保持不变',
            tier: 'blocker',
          },
          {
            title: '回滚到旧版本后系统仍可运行',
            expect: '升级并写入新数据后回滚旧版本，旧版本可正常启动且不损坏新增字段数据',
            tier: 'core',
          },
          {
            title: '导入导出格式与字符编码保持兼容',
            expect: 'CSV、Excel、JSON 在版本间可互相识别，中文与 emoji 无乱码，引号与换行处理正确',
            tier: 'core',
          },
          {
            title: '本地缓存与本地存储的旧结构被兼容或安全失效',
            expect: '升级后旧缓存被迁移或忽略，不出现解析错误、脏数据或界面异常',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'REG-ROLLOUT',
        name: '灰度与回滚验证',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '灰度分批与流量比例符合发布方案',
            expect: '灰度实际覆盖的用户或流量比例与方案一致，可按用户、地域或租户维度定向放量',
            tier: 'core',
          },
          {
            title: '灰度期间核心指标与错误率无恶化',
            expect: '灰度组与对照组对比，错误率、成功率与关键业务指标差异不超过预案阈值',
            tier: 'blocker',
          },
          {
            title: '回滚在约定时限内完成且数据不损坏',
            expect: '演练或实际回滚在方案规定时限内恢复服务，回滚后数据可读且无重复写入',
            tier: 'blocker',
          },
          {
            title: '特性开关关闭后行为退回旧逻辑',
            expect: '关闭开关后功能与界面回到旧行为，无残留入口，后台任务不再执行新逻辑',
            tier: 'core',
          },
        ],
      },
      {
        id: 'REG-CHECKLIST',
        name: '发布检查单',
        automation: 'assisted',
        priority: 'P0',
        standard: ['istqb'],
        cases: [
          {
            title: '发布检查单覆盖配置与依赖差异',
            expect: '检查项包含环境变量、配置项、数据库脚本、依赖版本与密钥，逐项可勾选可核对',
            tier: 'core',
          },
          {
            title: '检查单逐项有执行人与结论',
            expect: '发布记录中每项标注执行人、执行时间与结果，未执行项有说明与补偿安排',
            tier: 'core',
          },
          {
            title: '发布前后关键指标与日志基线已确认',
            expect: '发布前后各采集一次核心指标与错误日志基线，异常处有比对结论',
            tier: 'extended',
          },
          {
            title: '发布说明与实际变更及已知问题一致',
            expect: '发布说明列出的用户可见变更与代码差异一致，已知问题与规避方式同步告知相关方',
            tier: 'core',
          },
        ],
      },
    ],
  },
]
