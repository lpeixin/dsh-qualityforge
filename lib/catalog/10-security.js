/**
 * 测试域 10：安全与合规（认证 · 授权 · 注入面 · 数据隐私 · 供应链）。
 *
 * 字段约定与 01-build.js 完全一致（category → method → case），此处只补充本域的写作要求：
 *
 *   - 用例以**攻击者视角**书写：先说明持有什么凭据、构造什么输入、请求哪个入口，
 *     再说明"看到什么才算通过"。越权类必须写明返回码以及是否泄漏资源存在性；
 *     注入类必须写明 payload 与可观测差异（回显、时间差、报错、副作用）。
 *   - blocker 只给能直接导致数据泄漏、越权、凭据失窃或生产被攻陷的判据；
 *     需要基础设施、法务或业务方确认的合规项放 extended / exhaustive。
 *   - 未修复的已知风险必须落成书面豁免（理由 + 补偿措施 + 到期日），
 *     静默通过等同于不通过。
 *   - 安全用例天然是负向用例：只覆盖正常路径的检查视为未覆盖。
 *   - 攻击载荷一律使用无害探针（回显随机数、延时、外带 DNS 记录），
 *     禁止在生产环境执行破坏性利用。
 */

export const categories = [
  {
    id: 'sec-authn',
    name: '认证与会话',
    intro: '身份证明是否可信：口令、多因子、会话令牌、账号恢复与第三方登录都不能被绕过或重放。',
    methods: [
      {
        id: 'SEC-AUTHN-PASSWORD',
        name: '密码策略与哈希存储',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-asvs', 'cwe-top25'],
        cases: [
          {
            title: '弱口令与不合规口令在服务端被拒绝',
            expect: '绕过前端直接提交长度不足、纯数字与常见弱口令，接口返回 4xx 并给出策略原因，账号未被创建',
            tier: 'blocker',
          },
          {
            title: '口令以带盐慢哈希存储且不可逆',
            expect: '读取用户表，口令字段为 bcrypt/argon2/scrypt/PBKDF2 等带盐哈希，非明文或 MD5/SHA1，相同口令两次存储结果不同',
            tier: 'blocker',
          },
          {
            title: '口令校验使用恒定时间比较',
            expect: '哈希比较走 timing-safe 实现且无按字符提前返回，逐字节猜测口令的耗时差异在测量噪声内',
            tier: 'exhaustive',
          },
          {
            title: '口令与验证码不落入日志、埋点与错误上报',
            expect: '检索登录、注册、改密链路日志与 APM 原始 payload，无明文口令、验证码或可逆编码形式',
            tier: 'core',
          },
          {
            title: '历史口令与已泄露口令被拒绝复用',
            expect: '改密时提交近期用过的口令或被泄露口令库命中的口令，返回拒绝并提示原因',
            tier: 'extended',
          },
          {
            title: '口令重置与管理端改密不产生明文旁路',
            expect: '后台重置口令后系统生成一次性临时凭据并要求首登修改，任何界面不回显原口令',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-AUTHN-MFA',
        name: '多因素认证',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-asvs', 'owasp-top10'],
        cases: [
          {
            title: '高权限账号未绑定 MFA 时无法进入业务',
            expect: '管理员或资金操作账号登录后被强制进入绑定流程，未完成绑定前所有业务接口返回 403',
            tier: 'blocker',
          },
          {
            title: '第二因子校验失败次数受限并触发冷却',
            expect: '连续错误验证码达到阈值后即使提交正确验证码也要求重新输入口令，并产生锁定或冷却记录',
            tier: 'blocker',
          },
          {
            title: 'TOTP 验证码在同一时间窗内不可重放',
            expect: '同一验证码二次提交返回失败，服务端记录已用时间步或计数器',
            tier: 'core',
          },
          {
            title: '短信与邮箱验证码具备有效期、次数与速率限制',
            expect: '验证码在既定有效期外失效，重复发送有冷却与每日上限，穷举提交被限流',
            tier: 'core',
          },
          {
            title: '第二因子不存在可跳过的降级路径',
            expect: '构造跳过 MFA 的参数、直接请求登录完成接口、替换认证流程标识均返回 401，无免登录后门链接',
            tier: 'blocker',
          },
          {
            title: 'MFA 解绑与重置需要强校验并通知持有人',
            expect: '解绑第二因子必须通过现有因子校验，成功后向绑定邮箱或手机发送变更通知',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-AUTHN-SESSION',
        name: '会话与令牌生命周期',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-asvs', 'owasp-top10'],
        cases: [
          {
            title: '登出后旧会话与令牌立即不可用',
            expect: '登出后使用原 Cookie 或 Token 访问受保护接口返回 401，服务端会话记录被删除或进入吊销表',
            tier: 'blocker',
          },
          {
            title: '访问令牌短时效且过期后不被接受',
            expect: '使用过期令牌请求返回 401，服务端按 exp 校验而非仅信任客户端声明',
            tier: 'blocker',
          },
          {
            title: '刷新令牌一次性轮换且检测重放',
            expect: '换取新令牌后旧刷新令牌再次使用返回 401，并触发该会话族的全量吊销',
            tier: 'blocker',
          },
          {
            title: '登录成功后重建会话标识以抵御会话固定',
            expect: '登录前后会话标识不同，攻击者预先植入的标识在登录后不再有效',
            tier: 'core',
          },
          {
            title: '空闲超时与绝对超时同时生效',
            expect: '超过空闲阈值后请求要求重新认证，绝对超时到点后即使持续活跃会话也失效',
            tier: 'core',
          },
          {
            title: 'JWT 签名算法与密钥校验不可绕过',
            expect: '构造 alg=none、以公钥充当 HMAC 密钥、kid 路径穿越等令牌，均被拒绝并返回 401',
            tier: 'blocker',
          },
          {
            title: '活跃会话可枚举并支持远程吊销',
            expect: '用户可查看设备与登录时间列表并吊销指定会话，吊销后该会话下一个请求即失败',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-AUTHN-COOKIE',
        name: 'Cookie 与会话存储属性',
        automation: 'auto',
        priority: 'P0',
        standard: ['owasp-asvs', 'owasp-top10'],
        when: ['web', 'service'],
        cases: [
          {
            title: '会话 Cookie 带 HttpOnly 且脚本不可读',
            expect: '响应 Set-Cookie 含 HttpOnly，浏览器控制台读取 document.cookie 取不到会话标识',
            tier: 'blocker',
          },
          {
            title: '会话 Cookie 带 Secure 且不在明文信道传输',
            expect: 'HTTPS 响应中的会话 Cookie 含 Secure，通过 http 发起请求时不携带该 Cookie',
            tier: 'blocker',
          },
          {
            title: 'SameSite 取值与跨站使用场景一致',
            expect: '会话 Cookie 默认为 Lax 或 Strict；确需跨站携带时显式声明 None 且同时具备 Secure',
            tier: 'core',
          },
          {
            title: 'Cookie 作用域收敛到最小 Domain 与 Path',
            expect: '未设置宽泛 Domain（如 .example.com）与 Path=/，子域及无关路径请求不携带会话 Cookie',
            tier: 'core',
          },
          {
            title: '会话 Cookie 使用 __Host- 或 __Secure- 前缀约束',
            expect: '带前缀的 Cookie 满足 Secure、Path=/ 且无 Domain 的要求，不满足时浏览器拒收可被验证',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-AUTHN-BRUTEFORCE',
        name: '账号枚举与暴力破解防护',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-asvs', 'cwe-top25'],
        cases: [
          {
            title: '登录失败响应不区分账号是否存在',
            expect: '不存在账号与错误口令返回相同的状态码、提示文案与量级耗时，无"用户不存在"类差异',
            tier: 'blocker',
          },
          {
            title: '登录按账号与来源双重限流',
            expect: '同一账号或同一来源高频失败后触发指数退避、验证码或锁定，返回 429 或等效阻断',
            tier: 'blocker',
          },
          {
            title: '注册与找回入口不泄漏账号存在性',
            expect: '注册重名与找回未注册账号的响应不可与成功路径区分，统一返回"若存在将发送通知"',
            tier: 'core',
          },
          {
            title: '限流计数不可通过伪造头部绕过',
            expect: '篡改 X-Forwarded-For、User-Agent 或更换路径大小写不重置计数，代理链仅信任已知跳数',
            tier: 'core',
          },
          {
            title: '口令喷洒与撞库分布可被识别阻断',
            expect: '大量账号各尝试少量口令的分布触发风控与告警，而非仅按单账号计数',
            tier: 'extended',
          },
          {
            title: '账号锁定机制不被用于拒绝服务',
            expect: '锁定按来源与账号组合生效或支持自助解锁，攻击者无法用错误口令永久锁死他人账号',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-AUTHN-RECOVERY',
        name: '账号找回与凭据改绑',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-asvs'],
        cases: [
          {
            title: '找回令牌高熵、一次性且绑定账号与用途',
            expect: '令牌具备足够随机性、仅可使用一次、与账号和用途绑定，跨账号或跨用途使用返回失败',
            tier: 'blocker',
          },
          {
            title: '找回令牌短时效且用后立即作废',
            expect: '超出有效期后使用返回失败，改密成功后同一令牌与链接不可再次使用',
            tier: 'blocker',
          },
          {
            title: '改密与换绑成功后既有会话被全量吊销',
            expect: '改密完成后其他设备会话与刷新令牌全部失效，仅发起操作的会话可继续使用',
            tier: 'blocker',
          },
          {
            title: '找回流程逐步不泄漏账号敏感信息',
            expect: '中间步骤不回显完整邮箱、手机号、密保答案或历史口令线索，仅显示掩码',
            tier: 'core',
          },
          {
            title: '换绑邮箱或手机号需双向确认',
            expect: '新旧联系方式均产生通知或确认动作，未完成确认前登录凭据不被替换',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-AUTHN-FEDERATED',
        name: '第三方登录与 OAuth/OIDC 流程',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-asvs', 'owasp-top10'],
        cases: [
          {
            title: 'OIDC 回调强制校验 state 且一次有效',
            expect: '省略或篡改 state 的回调返回 4xx 且不建立会话，重复使用同一 state 失败',
            tier: 'blocker',
          },
          {
            title: 'ID Token 的签名、iss、aud 与 nonce 被完整校验',
            expect: '伪造签名、错误签发方、错误受众或 nonce 不匹配的令牌均被拒绝，不信任客户端提交的 payload',
            tier: 'blocker',
          },
          {
            title: '重定向地址仅允许预注册白名单精确匹配',
            expect: '构造外部域、子域名、路径穿越或附加参数的 redirect_uri 均被拒绝，判定不做前缀或子串匹配',
            tier: 'blocker',
          },
          {
            title: '第三方身份不静默接管既有本地账号',
            expect: '同邮箱但未经验证的第三方登录不会自动绑定到已有账号，需显式验证后绑定',
            tier: 'blocker',
          },
          {
            title: '授权码一次性使用且与客户端绑定',
            expect: '同一授权码二次兑换失败，且不能用于其他 client_id 或 redirect_uri',
            tier: 'core',
          },
          {
            title: '第三方返回的声明按不可信输入处理',
            expect: '邮箱、昵称、角色等声明在使用或持久化前经过校验与映射，未直接用于授权判定',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-AUTHN-M2M',
        name: '服务间认证与凭证轮换',
        automation: 'assisted',
        priority: 'P1',
        standard: ['owasp-asvs', 'nist-ssdf'],
        when: ['service', 'monorepo'],
        cases: [
          {
            title: '服务间调用使用独立凭证而非共享超级密钥',
            expect: '每个调用方持有独立客户端或证书身份，密钥未在多个服务间复制传播',
            tier: 'core',
          },
          {
            title: '内部接口拒绝无凭证与公网来源调用',
            expect: '未携带服务凭证的请求返回 401/403，网关或 mTLS 层阻断公网直连内部端点',
            tier: 'blocker',
          },
          {
            title: '服务凭证支持轮换且轮换期双活',
            expect: '新旧凭证并存窗口内均可验签，窗口结束后旧凭证失效且调用方无中断',
            tier: 'core',
          },
          {
            title: '服务身份进入审计链且权限最小化',
            expect: '调用方身份写入审计日志，权限按接口需要授予，不存在"内部即可全量放行"的规则',
            tier: 'core',
          },
          {
            title: '仓库与镜像中不存在长期静态服务密钥',
            expect: '检索代码、配置与镜像层，服务间静态密钥已替换为工作负载身份或短期令牌',
            tier: 'blocker',
          },
        ],
      },
    ],
  },
  {
    id: 'sec-authz',
    name: '授权与越权',
    intro: '已登录用户能否只做被允许的事：对象级、角色级与租户级边界必须由服务端强制。',
    methods: [
      {
        id: 'SEC-AUTHZ-IDOR',
        name: '水平越权与对象级授权（IDOR）',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10', 'owasp-asvs', 'cwe-top25'],
        cases: [
          {
            title: '以他人资源标识访问详情返回 404',
            expect: 'A 用户令牌请求 B 用户的订单、文件或资料标识，返回 404 且响应体不含该对象任何字段',
            tier: 'blocker',
          },
          {
            title: '越权响应不泄漏资源是否存在',
            expect: '不存在的标识与无权限的标识返回一致的状态码与文案，无法据此枚举系统内真实标识',
            tier: 'core',
          },
          {
            title: '列表与批量接口按调用者过滤',
            expect: '列表接口仅返回调用者有权对象，篡改分页、排序与过滤参数不额外返回他人数据',
            tier: 'blocker',
          },
          {
            title: '写操作同样校验对象归属',
            expect: '对他人资源发起更新、删除或转移返回 403/404，且目标数据保持原值未被修改',
            tier: 'blocker',
          },
          {
            title: '嵌套资源的父子归属逐级校验',
            expect: '子资源不属于路径中的父资源时请求失败，不因父级校验通过而放行',
            tier: 'core',
          },
          {
            title: '不可预测标识不替代授权校验',
            expect: '将顺序标识换成 UUID 后，构造归属错误的请求依然被拒绝，说明授权独立于标识形态',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-AUTHZ-ROLE',
        name: '垂直越权与角色边界',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10', 'owasp-asvs'],
        cases: [
          {
            title: '低权限角色调用管理接口被拒绝',
            expect: '普通用户令牌请求管理员端点返回 403，前端隐藏入口不构成防护',
            tier: 'blocker',
          },
          {
            title: '角色判定基于服务端会话而非请求字段',
            expect: '篡改 role、isAdmin、scope 等参数或令牌载荷后权限不提升，越权请求被拒绝',
            tier: 'blocker',
          },
          {
            title: '角色与权限矩阵完整且无越级继承',
            expect: '存在可核对的角色权限矩阵，代码判定与矩阵一致，无"高角色默认全通过"的隐式放行',
            tier: 'core',
          },
          {
            title: '隐藏与未文档化端点同样受鉴权保护',
            expect: '路由清单中每个受保护端点都挂载鉴权逻辑，抽查灰度端点与内部工具端无遗漏',
            tier: 'blocker',
          },
          {
            title: '功能开关与灰度分支不回退鉴权',
            expect: '开关关闭、灰度未命中等分支执行同一鉴权逻辑，新代码路径不存在缺失校验的情况',
            tier: 'core',
          },
          {
            title: '越权尝试被记录并可聚合告警',
            expect: '403 响应进入安全日志，可按用户与来源聚合，异常频次触发告警',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-AUTHZ-DENY',
        name: '默认拒绝与最小权限',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-asvs', 'iso-27001'],
        cases: [
          {
            title: '未显式授权的路径默认拒绝',
            expect: '新增路由未声明策略时请求被拒绝，鉴权以 fail-closed 方式生效而非默认放行',
            tier: 'blocker',
          },
          {
            title: '鉴权依赖异常时不降级为匿名放行',
            expect: '策略解析失败或权限服务超时返回 5xx/403，不退回游客身份也不跳过校验',
            tier: 'blocker',
          },
          {
            title: '应用运行账号权限最小化',
            expect: '运行时账号不具备建表、超级用户或全库读写权限，仅持有业务必需权限',
            tier: 'core',
          },
          {
            title: '临时提权有审批、期限与自动回收',
            expect: '提权申请有记录与到期时间，到期后权限自动回收并可查验证',
            tier: 'extended',
          },
          {
            title: '存在周期性权限复核记录',
            expect: '按既定周期产出账号与权限清单复核结果，回收项有执行痕迹',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'SEC-AUTHZ-TENANT',
        name: '多租户数据隔离',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-asvs', 'iso-27001'],
        when: ['service', 'web'],
        cases: [
          {
            title: '跨租户读取返回 404 且不泄漏存在性',
            expect: '以 A 租户令牌访问 B 租户资源返回 404，响应中不含 B 租户标识、名称或统计值',
            tier: 'blocker',
          },
          {
            title: '数据访问层强制附加租户过滤条件',
            expect: '查询由框架或仓储层自动注入租户条件，业务代码遗漏条件时也不会返回跨租户数据',
            tier: 'blocker',
          },
          {
            title: '租户标识取自会话而非客户端可改字段',
            expect: '篡改请求头或请求体中的租户标识不改变数据归属，服务端以令牌绑定租户为准',
            tier: 'blocker',
          },
          {
            title: '缓存与消息键包含租户维度',
            expect: '缓存键与队列主题带租户前缀，A 租户请求无法命中 B 租户的缓存或消费其消息',
            tier: 'core',
          },
          {
            title: '异步任务与定时作业保留租户上下文',
            expect: '后台任务携带正确的租户上下文，不被上一次执行或全局变量污染',
            tier: 'core',
          },
          {
            title: '跨租户共享的聚合与报表不泄漏明细',
            expect: '共享字典与统计接口按租户聚合，无法通过小样本聚合反推他人明细',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-AUTHZ-REVOKE',
        name: '权限变更即时生效',
        automation: 'assisted',
        priority: 'P1',
        standard: ['owasp-asvs'],
        cases: [
          {
            title: '移除授权后既有会话立即失去权限',
            expect: '后台撤销角色后该用户下一个请求即返回 403，无需等待重新登录',
            tier: 'core',
          },
          {
            title: '权限缓存有上限且变更时主动失效',
            expect: '权限缓存存在最大有效期并在变更时失效，不存在长时间才生效的窗口',
            tier: 'core',
          },
          {
            title: '停用账号的令牌在约定窗口内失效',
            expect: '账号被禁用后所有活跃令牌在约定时限内不可用，未出现可继续调用的窗口',
            tier: 'blocker',
          },
          {
            title: '授权判定不使用客户端缓存的角色快照',
            expect: '篡改本地存储或前端缓存中的角色不改变服务端判定结果',
            tier: 'core',
          },
          {
            title: '吊销动作可观测且可按主体追溯',
            expect: '吊销产生审计记录与指标，可按用户查询生效时间与操作来源',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-AUTHZ-ADMIN',
        name: '管理后台与内部接口暴露面',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10', 'owasp-asvs'],
        when: ['service', 'web'],
        cases: [
          {
            title: '管理后台不对公网匿名开放',
            expect: '未认证访问管理入口返回 401/403 或不可达，不返回后台页面、菜单与接口清单',
            tier: 'blocker',
          },
          {
            title: '内部与调试端口不对外监听',
            expect: '健康明细、指标、调试端点在公网返回 404/403，仅内网或运维通道可达',
            tier: 'blocker',
          },
          {
            title: '默认账号与默认口令已移除',
            expect: '系统不存在出厂凭据，首次部署强制设置或由平台注入，扫描默认口令无法登录',
            tier: 'blocker',
          },
          {
            title: '后台登录要求独立强认证',
            expect: '后台要求多因子或来源白名单，普通用户凭据无法进入管理入口',
            tier: 'core',
          },
          {
            title: '敏感后台操作留痕并需二次确认',
            expect: '删除、导出、改权限等操作有审计记录，并需要二次确认或审批动作',
            tier: 'core',
          },
          {
            title: '错误页与目录列表不暴露内部结构',
            expect: '目录浏览被禁用，异常页不返回框架版本、堆栈、内网主机名与文件路径',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-AUTHZ-POLICY',
        name: '授权模型与服务端校验一致性',
        automation: 'assisted',
        priority: 'P1',
        standard: ['owasp-asvs', 'nist-ssdf'],
        cases: [
          {
            title: '授权策略集中声明并被所有端点复用',
            expect: '策略以集中方式维护，抽查端点与其声明一致，无散落的重复手写判定',
            tier: 'core',
          },
          {
            title: '前端隐藏仅是体验优化，判定在服务端',
            expect: '直接调用被前端隐藏的接口仍返回 403，服务端不因缺少界面入口而放行',
            tier: 'blocker',
          },
          {
            title: '资源级读写审批权限各自独立',
            expect: '同一资源的读取、修改与审批有独立判定，读取权限不隐含写入或审批权限',
            tier: 'core',
          },
          {
            title: '授权逻辑有矩阵化的自动化测试覆盖',
            expect: '存在角色与资源组合的授权测试，越权用例失败时 CI 阻断合并',
            tier: 'core',
          },
          {
            title: '权限模型变更经过评审并可追溯',
            expect: '授权变更可对应到具体变更单与评审人，无绕过评审的放行改动',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'sec-input',
    name: '输入与注入',
    intro: '外部输入能否突破解析边界：注入、脚本执行、服务端请求伪造、文件与反序列化入口都要在服务端收敛。',
    methods: [
      {
        id: 'SEC-INPUT-INJECTION',
        name: 'SQL 与命令注入',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10', 'cwe-top25', 'owasp-asvs'],
        cases: [
          {
            title: 'SQL 查询全部使用参数化绑定',
            expect: '检索数据访问代码，用户输入拼进 SQL 字符串的位置为 0 处，均走占位符或 ORM 绑定',
            tier: 'blocker',
          },
          {
            title: '注入载荷不改变查询语义与响应时间',
            expect: '对查询参数注入引号闭合、恒真条件与延时函数，响应内容与耗时与基准一致且无数据库报错',
            tier: 'blocker',
          },
          {
            title: '排序与分组等无法绑定的位置使用白名单',
            expect: 'ORDER BY、GROUP BY、表名与列名仅接受枚举值，非法值被拒绝而非拼接进语句',
            tier: 'core',
          },
          {
            title: 'NoSQL 查询拒绝对象型注入操作符',
            expect: '传递 $ne、$gt、$where 等结构被类型校验拒绝，查询不回退为恒真条件',
            tier: 'blocker',
          },
          {
            title: 'LDAP 与目录查询对过滤器特殊字符转义',
            expect: '注入通配符与过滤器片段不改变检索范围，空口令与恒真过滤器均无法绕过认证',
            tier: 'core',
            when: ['service', 'web'],
          },
          {
            title: '命令与 Shell 调用不拼接外部输入',
            expect: '进程调用使用参数数组形式，注入分号、管道与反引号后无回显且无额外进程启动',
            tier: 'blocker',
          },
          {
            title: '原生查询与动态片段有清单并收敛',
            expect: '原生 SQL 与动态拼接调用点有登记与理由，剩余动态片段全部走参数或白名单',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-INPUT-XSS',
        name: 'XSS 与输出编码',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10', 'cwe-top25'],
        cases: [
          {
            title: '存储型脚本载荷被转义后原样显示',
            expect: '向可持久化字段提交脚本标签与事件属性，回显页面以文本呈现，浏览器不执行且无弹窗',
            tier: 'blocker',
          },
          {
            title: '反射型参数在响应中被正确编码',
            expect: '在查询参数注入脚本载荷，响应体中出现转义实体且未落入可执行上下文',
            tier: 'blocker',
          },
          {
            title: 'DOM 操作不使用危险 sink 处理外部数据',
            expect: '检索前端代码，外部数据进入 innerHTML、outerHTML、document.write 与 eval 的路径均已改为安全 API 或净化',
            tier: 'core',
          },
          {
            title: '富文本与 Markdown 渲染经过白名单净化',
            expect: '仅允许白名单标签与属性，脚本标签、事件属性与脚本协议被剥离后入库或渲染',
            tier: 'blocker',
          },
          {
            title: '输出编码与所处上下文匹配',
            expect: '同一数据写入 HTML 文本、属性、URL 与脚本上下文时使用对应编码方式，无通用转义造成的绕过',
            tier: 'core',
          },
          {
            title: 'CSP 作为纵深防御且无内联放行兜底',
            expect: '响应含 CSP 头，script-src 不含 unsafe-inline 与 unsafe-eval，并配置了违规上报地址',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-INPUT-SSRF',
        name: 'SSRF 与出网限制',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10', 'cwe-top25'],
        cases: [
          {
            title: '指向内网与云元数据地址的请求被拒绝',
            expect: '提交回环地址、内网网段与云元数据地址，接口返回错误且未返回任何内部响应内容',
            tier: 'blocker',
          },
          {
            title: '重定向链路逐跳校验而非只看首跳',
            expect: '可信外部地址跳转到内网时最终请求被阻断，不返回内网页面或探测结果',
            tier: 'blocker',
          },
          {
            title: '解析后的实际连接地址落在禁用网段时拒绝',
            expect: '域名解析结果属于禁止网段时连接被拒绝，校验发生在其实际建连的地址上',
            tier: 'core',
          },
          {
            title: '协议与端口受白名单限制',
            expect: '仅允许 HTTP 与 HTTPS 及必要端口，文件、Gopher 等协议与高位端口被拒绝',
            tier: 'core',
          },
          {
            title: '出网能力受网络策略约束',
            expect: '运行环境存在出网白名单或强制代理，未授权目标不可达并可验证',
            tier: 'core',
          },
          {
            title: '失败响应不回显内部服务细节',
            expect: '请求失败时返回统一错误，不返回内网服务标识、原始响应片段或堆栈信息',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-INPUT-SSTI',
        name: '模板注入与表达式注入',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10', 'cwe-top25'],
        cases: [
          {
            title: '用户输入不参与模板字符串的编译',
            expect: '提交算术与对象访问类模板载荷，页面、邮件与日志中均不出现求值结果',
            tier: 'blocker',
          },
          {
            title: '模板引擎启用自动转义与受限内置',
            expect: '引擎配置为自动转义并禁用危险内置与反射调用，构造载荷无法读取文件或执行命令',
            tier: 'core',
          },
          {
            title: '表达式求值不接受外部输入',
            expect: '检索表达式与脚本引擎调用点，外部数据不进入解析；构造载荷不触发命令执行或文件读取',
            tier: 'blocker',
          },
          {
            title: '自定义公式与规则由可信角色维护并校验',
            expect: '公式仅管理员可写，保存前做语法与危险 API 校验，运行在受限沙箱中',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-INPUT-DESERIAL',
        name: '反序列化安全',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10', 'cwe-top25'],
        cases: [
          {
            title: '不可信来源的数据不做多态反序列化',
            expect: '请求体、Cookie 与消息中的序列化数据仅按显式结构解析，不按类型信息还原任意对象',
            tier: 'blocker',
          },
          {
            title: '危险反序列化接口已收敛或加类型白名单',
            expect: '语言级原生反序列化调用点有清单，剩余调用仅允许白名单类型或已替换为安全格式',
            tier: 'blocker',
          },
          {
            title: '序列化载荷的完整性与来源被校验',
            expect: '篡改或伪造的序列化数据因签名或校验失败被拒绝，不进入反序列化流程',
            tier: 'core',
          },
          {
            title: '存在反序列化利用链的组件已升级',
            expect: '常见利用链依赖版本高于已知受影响范围，扫描结果中无对应高危告警',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-INPUT-FILE',
        name: '路径穿越与文件上传',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10', 'cwe-top25'],
        cases: [
          {
            title: '文件名与路径参数拒绝穿越与绝对路径',
            expect: '提交上级目录、编码变体与绝对路径，返回 4xx 且未读取到目标文件内容',
            tier: 'blocker',
          },
          {
            title: '上传类型按内容与扩展名双重校验',
            expect: '改名脚本文件、双扩展名与伪造内容类型均被拒绝，判定不依赖客户端声明',
            tier: 'blocker',
          },
          {
            title: '上传文件落在不可执行目录且默认不可执行',
            expect: '存储目录不在静态资源或应用执行路径，上传可执行脚本后直接访问返回 403 或被下载',
            tier: 'blocker',
          },
          {
            title: '文件访问经过鉴权且路径不可枚举',
            expect: '下载接口校验文件归属，直接拼接存储路径或遍历文件名无法获取他人文件',
            tier: 'blocker',
          },
          {
            title: '上传体积、数量与频率受限',
            expect: '超过上限的文件被拒绝，批量与高频上传被限流，服务不因大文件写入而不可用',
            tier: 'core',
          },
          {
            title: '归档解压防范穿越条目与解压炸弹',
            expect: '含上级目录条目的压缩包被拒绝，异常压缩比触发限制而非耗尽磁盘',
            tier: 'core',
          },
          {
            title: '失败上传的临时文件被清理',
            expect: '中断或校验失败的上传不遗留可访问文件，清理任务有执行记录',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-INPUT-XXE',
        name: 'XXE 与 XML 解析',
        automation: 'assisted',
        priority: 'P1',
        standard: ['owasp-top10', 'cwe-top25'],
        cases: [
          {
            title: 'XML 解析禁用外部实体与 DTD',
            expect: '提交带外部实体的 XML，解析失败或忽略实体，响应中不出现本地文件内容',
            tier: 'blocker',
          },
          {
            title: '外部 DTD 与网络实体解析被禁用',
            expect: 'DTD 指向外部地址时不发起出网请求，无可观测的解析延迟与外带记录',
            tier: 'core',
          },
          {
            title: '解析器显式设置安全选项',
            expect: '解析配置显式关闭 DTD 与外部实体，或使用默认安全的解析库与版本',
            tier: 'core',
          },
          {
            title: '间接 XML 入口同等防护',
            expect: '文档、图片与消息格式的 XML 解析路径同样禁用外部实体，构造样本无文件泄露',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-INPUT-REDIRECT',
        name: '开放重定向与跳转校验',
        automation: 'auto',
        priority: 'P1',
        standard: ['owasp-top10', 'cwe-top25'],
        cases: [
          {
            title: '跳转目标仅允许白名单内地址',
            expect: '构造指向外部域的跳转参数，响应不返回外域 Location 而是拒绝或回到站内',
            tier: 'blocker',
          },
          {
            title: '协议相对与畸形变体同样被拒绝',
            expect: '双斜杠、反斜杠、用户信息符与编码变体均不产生外域跳转',
            tier: 'core',
          },
          {
            title: '跳转判定不做前缀或子串匹配',
            expect: '与可信域前缀相似的域名不被判定为可信，构造请求后不产生外域跳转',
            tier: 'blocker',
          },
          {
            title: '回调与返回地址使用预注册配置值',
            expect: '登录、支付等回调地址来自配置而非请求参数，运行时不可被覆盖',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-INPUT-CSRF',
        name: 'CSRF 与跨站请求伪造防护',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-top10', 'owasp-asvs'],
        when: ['web', 'service'],
        cases: [
          {
            title: '状态变更请求需要令牌或等效防护',
            expect: '缺少或伪造令牌的跨站构造请求被拒绝，返回 403 且服务端无任何副作用',
            tier: 'blocker',
          },
          {
            title: '令牌与用户会话绑定且可轮换',
            expect: '他人令牌与登录前的旧令牌均不可复用，令牌不在 URL 查询串中传递',
            tier: 'core',
          },
          {
            title: '跨站携带场景不依赖 Cookie 属性单一防线',
            expect: '需要跨站携带会话时仍校验令牌或来源，单独依赖 Cookie 属性不构成防护',
            tier: 'core',
          },
          {
            title: '关键操作校验来源且缺失时拒绝',
            expect: '来源不在允许列表时请求被拒绝，未携带来源头的跨站请求不被默认放行',
            tier: 'core',
          },
          {
            title: '安全方法与预检请求不产生副作用',
            expect: 'GET、HEAD、OPTIONS 不修改任何状态，重放这些请求不产生数据变更',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-INPUT-CORS',
        name: '跨域资源共享配置',
        automation: 'assisted',
        priority: 'P1',
        standard: ['owasp-asvs', 'owasp-top10'],
        when: ['web', 'service'],
        cases: [
          {
            title: '带凭证的跨域请求不接受任意来源',
            expect: '以任意外部来源发起带凭证的跨域请求，响应不反射该来源，也不出现通配来源与允许凭证并存的组合',
            tier: 'blocker',
          },
          {
            title: '来源允许列表精确匹配协议主机与端口',
            expect: '子域与后缀相似的域名不被放行，匹配基于完整来源而非包含关系或前缀',
            tier: 'blocker',
          },
          {
            title: '预检响应的允许方法与头部收敛',
            expect: '预检仅返回实际需要的方法与头部，未把任意方法与任意头部整体放行',
            tier: 'core',
          },
          {
            title: '跨域配置不替代服务端鉴权',
            expect: '来源被允许时未授权调用仍返回 401/403，跨域配置不被当作访问控制使用',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-INPUT-BROWSER',
        name: '浏览器安全响应头',
        automation: 'auto',
        priority: 'P1',
        standard: ['owasp-asvs', 'owasp-top10'],
        when: ['web', 'service'],
        cases: [
          {
            title: '页面具备点击劫持防护',
            expect: '响应含限制框架嵌入的策略，构造 iframe 嵌套页面时业务内容不被渲染',
            tier: 'blocker',
          },
          {
            title: '响应禁止内容类型嗅探',
            expect: '响应含禁止嗅探的头，上传或回显的非脚本内容不被浏览器当作脚本执行',
            tier: 'core',
          },
          {
            title: '来源头策略避免地址与敏感参数外泄',
            expect: '跨站跳转时来源头不携带完整地址与查询串中的令牌，策略在各类页面保持一致',
            tier: 'core',
          },
          {
            title: '安全响应头全站一致无遗漏路径',
            expect: '抽查页面、接口与错误响应，安全头策略一致，未被局部路由或网关规则覆盖丢失',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'sec-data',
    name: '数据与隐私',
    intro: '数据在传输、存储、展示与出境各环节是否受控：加密、脱敏、最小化、审计与合规证据。',
    methods: [
      {
        id: 'SEC-DATA-TRANSPORT',
        name: '传输加密与 TLS 配置',
        automation: 'auto',
        priority: 'P0',
        standard: ['owasp-asvs', 'pci-dss', 'iso-27001'],
        cases: [
          {
            title: '全站强制 HTTPS 且明文请求不返回业务内容',
            expect: '以 http 访问任意业务地址返回重定向到 https 或 4xx，响应体不含业务数据',
            tier: 'blocker',
          },
          {
            title: 'TLS 版本与套件满足基线',
            expect: '扫描显示仅启用 TLS 1.2 及以上，SSLv3、TLS 1.0/1.1 与弱套件全部关闭',
            tier: 'blocker',
          },
          {
            title: '证书链完整、未过期且主机名匹配',
            expect: '证书由受信机构签发、链完整、在有效期内且覆盖实际访问域名，无被忽略的校验错误',
            tier: 'core',
          },
          {
            title: '启用 HSTS 且有效期足够',
            expect: '响应含 HSTS 头且有效期达到基线要求，按部署范围正确设置子域与预加载指令',
            tier: 'core',
          },
          {
            title: '内部链路同样加密或处于受控网络',
            expect: '数据库、缓存与消息连接启用 TLS，或处于受控网络并有书面依据与访问控制',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-DATA-ATREST',
        name: '静态加密与密钥管理',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-asvs', 'pci-dss', 'iso-27001'],
        cases: [
          {
            title: '高敏感字段以密文或不可逆形式存储',
            expect: '直接读取数据库，证件号、银行卡与健康类字段为密文或哈希，无法还原明文',
            tier: 'blocker',
          },
          {
            title: '密钥由 KMS 托管且不入库不入码',
            expect: '密钥材料不在数据库、配置文件与镜像中，运行时经 KMS 或密钥注入获取',
            tier: 'blocker',
          },
          {
            title: '数据密钥与主密钥分离并支持轮换',
            expect: '采用信封加密或版本化密钥，可完成轮换且历史数据仍可解密',
            tier: 'core',
          },
          {
            title: '备份、快照与归档同等加密',
            expect: '备份文件与对象存储启用加密，导出数据不以明文落地',
            tier: 'core',
          },
          {
            title: '密钥使用有权限控制与审计',
            expect: '仅必要角色可解密，密钥调用产生审计记录并可按主体追溯',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-CRYPTO-BASELINE',
        name: '密码学实现基线',
        automation: 'assisted',
        priority: 'P0',
        standard: ['owasp-asvs', 'cwe-top25'],
        cases: [
          {
            title: '安全敏感随机值来自密码学安全随机源',
            expect: '令牌、验证码、盐与会话标识的生成使用密码学安全随机源，非时间戳或普通伪随机函数',
            tier: 'blocker',
          },
          {
            title: '加密算法与模式满足基线',
            expect: '对称加密使用带认证的模式，未出现 ECB、DES、RC4，也未用 MD5 与 SHA1 承担安全用途',
            tier: 'blocker',
          },
          {
            title: '初始向量与随机数唯一且不硬编码',
            expect: '每次加密使用新的随机初始向量或随机数，代码与配置中不存在固定初始向量',
            tier: 'core',
          },
          {
            title: '消息认证码与签名校验使用恒定时间比较',
            expect: '校验采用恒定时间比较实现，校验失败即返回且不进入解密或业务分支',
            tier: 'core',
          },
          {
            title: '不存在自研算法与无盐固定密钥派生',
            expect: '检索代码无自实现加密逻辑，密钥派生使用标准算法并按当前推荐参数配置',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-DATA-MASKING',
        name: '敏感数据脱敏与日志泄漏',
        automation: 'assisted',
        priority: 'P0',
        standard: ['gdpr', 'iso-27001', 'owasp-asvs'],
        cases: [
          {
            title: '日志与错误上报中无明文敏感字段',
            expect: '检索应用日志、埋点与错误上报配置，手机号、证件号、银行卡、口令与令牌均以掩码或哈希出现',
            tier: 'blocker',
          },
          {
            title: '接口响应按调用者权限裁剪敏感字段',
            expect: '低权限或越权调用者拿不到完整敏感字段，序列化层存在字段级过滤',
            tier: 'blocker',
          },
          {
            title: '页面展示与导出文件遵循同一脱敏规则',
            expect: '界面与导出的表格、文档对同一字段采用一致的脱敏，导出不成为明文旁路',
            tier: 'core',
          },
          {
            title: '非生产环境使用脱敏或合成数据',
            expect: '测试与预发环境不含真实个人信息，取数流程有脱敏步骤与执行记录',
            tier: 'blocker',
          },
          {
            title: '第三方上报内容经过字段级审查',
            expect: '埋点、崩溃上报与客服系统的字段清单已确认，未外发未授权的个人信息',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-DATA-LEAK',
        name: '错误信息与调试接口泄漏',
        automation: 'auto',
        priority: 'P0',
        standard: ['owasp-top10', 'cwe-top25'],
        cases: [
          {
            title: '生产环境关闭调试模式与详细堆栈',
            expect: '构造异常请求后响应为标准错误结构，不含堆栈、SQL 语句、文件路径与框架版本',
            tier: 'blocker',
          },
          {
            title: '调试与配置端点在公网不可达或需鉴权',
            expect: '常见调试与配置路径返回 404/401，不返回环境变量、配置项或源码信息',
            tier: 'blocker',
          },
          {
            title: '错误提示不泄漏账号与内部标识',
            expect: '认证与资源错误不区分"账号不存在"与"口令错误"，不返回内部主键与内网主机名',
            tier: 'core',
          },
          {
            title: '响应头与静态资源不暴露技术栈细节',
            expect: '服务标识与框架版本头被移除或泛化，映射文件不对公网公开',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-DATA-PII',
        name: 'PII 分类与最小化',
        automation: 'manual',
        priority: 'P0',
        standard: ['gdpr', 'iso-27001'],
        cases: [
          {
            title: '数据地图标注了个人信息字段与处理依据',
            expect: '存在字段级数据地图，标明个人信息类别、用途与合法性依据，抽查与实际结构一致',
            tier: 'core',
          },
          {
            title: '采集遵循最小必要且非必需项可跳过',
            expect: '每个采集项有用途说明，与功能无关的字段不被强制收集，跳过不影响核心流程',
            tier: 'core',
          },
          {
            title: '提供访问、更正、导出与删除能力',
            expect: '数据主体请求有可执行流程与时限，删除覆盖主库、下游与按策略处理的备份',
            tier: 'blocker',
          },
          {
            title: '同意记录可举证且支持撤回',
            expect: '同意的时间、版本与范围可查询，撤回后停止相应处理并留存记录',
            tier: 'core',
          },
          {
            title: '留存期限明确且到期删除或匿名化',
            expect: '每类数据有留存期配置与到期清理任务，执行结果可查询',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-DATA-RESIDENCY',
        name: '数据出境与合规',
        automation: 'manual',
        priority: 'P1',
        standard: ['gdpr', 'iso-27001'],
        when: ['service', 'data'],
        cases: [
          {
            title: '存储与处理地域与合规声明一致',
            expect: '生产数据的落地区域与对外声明一致，跨境传输有清单与法律依据',
            tier: 'core',
          },
          {
            title: '跨境传输采用合法机制并留存协议',
            expect: '存在标准合同条款或等效机制文档，第三方处理者清单与数据处理协议齐备',
            tier: 'core',
          },
          {
            title: '个人信息出境履行安全评估或标准合同义务',
            expect: '按 GDPR 或个人信息保护法要求，出境场景具备安全评估结论或标准合同备案，覆盖实际出境字段与接收方',
            tier: 'core',
          },
          {
            title: '子处理者变更触发通知与评估',
            expect: '新增子处理者有评审记录，并按约定履行通知义务',
            tier: 'extended',
          },
          {
            title: '可产出合规审计所需的证据材料',
            expect: '按需导出处理记录、访问日志与加密证明，字段完整且可交付外部审计',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-DATA-AUDIT',
        name: '审计日志与不可否认性',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-27001', 'pci-dss', 'nist-ssdf'],
        cases: [
          {
            title: '关键操作全部留痕且字段完整',
            expect: '登录、授权变更、数据导出与资金操作均有日志，记录含主体、时间、对象、结果与来源',
            tier: 'blocker',
          },
          {
            title: '审计日志防篡改且与业务库分离',
            expect: '日志存储仅允许追加，应用账号无删除权限，且不与业务数据同库同权限',
            tier: 'core',
          },
          {
            title: '日志时间同步且可还原操作时序',
            expect: '服务间时间偏差在秒级内，日志含统一时区，可按序还原跨服务操作链',
            tier: 'core',
          },
          {
            title: '日志保留期满足要求且可检索',
            expect: '保留期满足适用监管要求，支持按用户与对象检索并能在时限内导出',
            tier: 'core',
          },
          {
            title: '高敏感操作具备不可否认性',
            expect: '关键审批与签署绑定强身份与时间戳，可证明由该主体发起且事后不可抵赖',
            tier: 'extended',
          },
        ],
      },
    ],
  },
  {
    id: 'sec-supply',
    name: '供应链与漏洞响应',
    intro: '从依赖、构建、密钥到发布与响应：软件供应链每一环都要可验证、可追溯、可止损。',
    methods: [
      {
        id: 'SEC-SUPPLY-VULN',
        name: '依赖漏洞扫描与修复 SLA',
        automation: 'auto',
        priority: 'P0',
        standard: ['owasp-top10', 'nist-ssdf', 'iso-27001'],
        cases: [
          {
            title: '流水线对依赖做漏洞扫描且高危阻断',
            expect: 'CI 含依赖扫描步骤，出现高危或严重漏洞时构建失败并给出组件、版本与修复建议',
            tier: 'blocker',
          },
          {
            title: '生产制品中无已遭利用的高危组件',
            expect: '扫描生产依赖树与镜像，未出现已知被利用漏洞清单中的组件版本',
            tier: 'blocker',
          },
          {
            title: '修复时限按严重级别定义并被度量',
            expect: '各严重级别有明确修复时限，存在超期项清单与按期修复率记录',
            tier: 'core',
          },
          {
            title: '残余风险有书面豁免与到期日',
            expect: '无法升级的漏洞有豁免记录（理由、补偿措施、到期时间），未静默忽略',
            tier: 'core',
          },
          {
            title: '基础镜像与运行时组件纳入扫描范围',
            expect: '容器镜像、系统包与语言运行时漏洞在扫描覆盖内，非仅扫描应用依赖',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-SUPPLY-INTEGRITY',
        name: '锁文件与制品完整性',
        automation: 'auto',
        priority: 'P0',
        standard: ['slsa', 'nist-ssdf'],
        cases: [
          {
            title: 'CI 以锁定模式安装且清单不一致即失败',
            expect: '流水线使用冻结或 CI 安装模式，清单与锁文件不同步时构建失败而非自动改写',
            tier: 'blocker',
          },
          {
            title: '依赖安装校验完整性哈希',
            expect: '锁文件包含完整性校验值，校验失败的包无法安装，且未使用跳过校验的开关',
            tier: 'core',
          },
          {
            title: '发布制品附带可验证的校验和或签名',
            expect: '发布物提供摘要与签名，下载后可独立验证来源与完整性',
            tier: 'core',
          },
          {
            title: '制品带可校验的 SLSA 出处证明',
            expect: '制品带 SLSA provenance 或等效出处证明，可追溯到具体提交与构建任务且证明可被独立校验',
            tier: 'extended',
          },
          {
            title: '依赖源与安装配置不绕过凭证校验',
            expect: '未出现明文源、忽略证书校验或可信主机绕过的安装配置',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-SUPPLY-CICD',
        name: 'CI/CD 凭证与权限最小化',
        automation: 'assisted',
        priority: 'P0',
        standard: ['nist-ssdf', 'slsa', 'iso-27001'],
        cases: [
          {
            title: '流水线令牌与云凭证按最小权限授予',
            expect: '工作流权限显式声明为只读或按需，未默认使用全权限长期密钥',
            tier: 'blocker',
          },
          {
            title: '外部贡献触发的流水线不接触生产密钥',
            expect: '来自外部仓库的变更在无密钥环境运行，生产密钥不注入不可信上下文',
            tier: 'blocker',
          },
          {
            title: '密钥以密文存储且读取范围受限',
            expect: 'CI 密钥仅对必要工作流可见，执行日志中不打印明文密钥',
            tier: 'blocker',
          },
          {
            title: '优先采用免长期密钥的联邦身份',
            expect: '云访问使用短期联邦凭证，长期访问密钥有清单与收敛计划',
            tier: 'core',
          },
          {
            title: '构建与生产部署权限分离并需审批',
            expect: '生产部署要求受保护环境或人工审批，普通提交者不能直接发布',
            tier: 'core',
          },
        ],
      },
      {
        id: 'SEC-SUPPLY-BUILDENV',
        name: '构建环境隔离与不可信 PR 处理',
        automation: 'assisted',
        priority: 'P0',
        standard: ['slsa', 'nist-ssdf'],
        cases: [
          {
            title: '发布制品由受控环境构建而非开发者机器',
            expect: '制品由流水线构建，构建环境无持久化共享状态与交互式登录入口',
            tier: 'core',
          },
          {
            title: '不可信变更的代码不以特权方式执行',
            expect: '外部贡献无法读取密钥或篡改发布产物，工作流事件选择不会让外部代码拿到写权限',
            tier: 'blocker',
          },
          {
            title: '第三方构建步骤固定到不可变版本',
            expect: '复用的构建组件按提交摘要或版本摘要固定，运行期下载脚本的做法被替换或加校验',
            tier: 'core',
          },
          {
            title: '产物发布前经过评审与来源校验',
            expect: '发布需受保护分支规则或第二名维护者确认，产物与提交可一一对应',
            tier: 'core',
          },
          {
            title: '构建缓存与出网受控以防投毒',
            expect: '构建阶段出网限制在依赖源，缓存不可被外部变更写入后影响主干构建',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-SUPPLY-SECRETS',
        name: '密钥扫描与历史泄漏清理',
        automation: 'auto',
        priority: 'P0',
        standard: ['owasp-top10', 'cwe-top25', 'nist-ssdf'],
        cases: [
          {
            title: '当前提交中不存在凭据与私钥',
            expect: '密钥扫描工具在当前版本上报 0 条高危命中，无被注释掉的临时代码里的真实密钥',
            tier: 'blocker',
          },
          {
            title: '提交钩子或流水线阻止新增密钥',
            expect: '推送包含密钥的变更被本地钩子或 CI 拦截，并有受控的例外流程',
            tier: 'core',
          },
          {
            title: '历史泄漏的密钥已轮换而非仅删提交',
            expect: '历史命中项逐一处置：密钥已吊销或轮换，且记录处置时间与执行人',
            tier: 'blocker',
          },
          {
            title: '示例配置与文档中不出现真实密钥',
            expect: '示例文件、文档与测试夹具使用占位值，真实密钥仅经环境注入',
            tier: 'core',
          },
          {
            title: '密钥有归属、用途与轮换责任人',
            expect: '存在密钥清单（用途、归属、上次轮换时间与责任人），无来源不明的长期密钥',
            tier: 'extended',
          },
        ],
      },
      {
        id: 'SEC-SUPPLY-DISCLOSURE',
        name: '漏洞披露与安全响应',
        automation: 'manual',
        priority: 'P1',
        standard: ['iso-27001', 'nist-ssdf'],
        cases: [
          {
            title: '仓库包含 SECURITY.md 与私密上报渠道',
            expect: '仓库根目录存在 SECURITY.md，指明私密上报入口、支持版本范围与预期响应时限',
            tier: 'core',
          },
          {
            title: '漏洞工单有分级与修复披露时限',
            expect: '按严重级别定义响应、修复与协调披露时限，历史工单可核对是否达标',
            tier: 'core',
          },
          {
            title: '安全公告标明受影响与修复版本',
            expect: '公告说明受影响版本范围、修复版本与缓解措施，消费方可据此判断自身风险',
            tier: 'core',
          },
          {
            title: '存在应急演练或事件复盘记录',
            expect: '至少有一次演练或真实事件复盘，含时间线、根因与已闭环的改进项',
            tier: 'exhaustive',
          },
        ],
      },
      {
        id: 'SEC-SUPPLY-BASELINE',
        name: '容器与基础设施基线',
        automation: 'assisted',
        priority: 'P1',
        standard: ['iso-27001', 'slsa'],
        when: ['service', 'web', 'monorepo'],
        cases: [
          {
            title: '容器以非 root 运行且镜像最小化',
            expect: '镜像声明非 root 用户与最小基础镜像，不含多余编译工具链与包管理器',
            tier: 'blocker',
          },
          {
            title: '容器文件系统与内核能力最小化',
            expect: '根文件系统只读或等效受限，默认丢弃全部内核能力，禁用特权模式与宿主目录挂载',
            tier: 'core',
          },
          {
            title: '基础设施默认开启安全配置',
            expect: '存储非公开、数据库不暴露公网、日志与备份默认开启，默认值由基础设施代码固化',
            tier: 'blocker',
          },
          {
            title: '镜像与基础设施代码经过基线扫描',
            expect: 'CI 对容器定义与基础设施代码做基线检查，高危配置阻断或有豁免记录',
            tier: 'core',
          },
          {
            title: '镜像来源可信且扫描后入库',
            expect: '仅使用受信仓库镜像，推送前完成漏洞扫描，生产引用不使用浮动标签',
            tier: 'extended',
          },
        ],
      },
    ],
  },
]
