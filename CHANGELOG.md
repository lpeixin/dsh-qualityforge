# 变更记录

本文件记录 QualityForge 的所有重要变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- `assets/social-preview.svg` 与 `assets/social-preview.png`（1280×640、405 KB）：
  GitHub **Social preview** 源文件。topic 列表卡片（如 <https://github.com/topics/dsh-plugin>）
  顶部的横幅图用的是社交预览图，而不是 README 里的 banner；需在
  Settings → General → Social preview 上传，GitHub 没有提供公开 API。
- `docs/RELEASE-CHECKLIST.md`：发布检查单——仓库设置（About/topics、社交预览图、分支保护）、
  打 tag 与 Release、npm 发布，以及"README banner ≠ topic 卡片横幅"等常见误解。

### 修复

- `package.json` 的 `files` 白名单改为显式列出 `assets/icon.svg` 与 `assets/banner.svg`：
  图标是 DSH 插件管理器要读取的资源，banner 是 npm 页面渲染 README 所需；
  405 KB 的社交预览图不进 npm 包（包体积从 615 KB 回到 215 KB）。
- 文档中的测试数量（21 → 27）与安装体积数字更新为与实际一致。

### 计划中

- `qf_diff`：对比两次审计结果，输出"新引入 / 已修复 / 仍存在"三类差异，用于发布前回归。
- 覆盖率报告解析：从 lcov / coverage.py 输出中读取真实覆盖率数字，写入对应测试项。
- 报告国际化：`qf_report lang=en` 输出英文报告。

## [0.1.0] - 2026-09-30

首个公开版本。

### 新增

- **测试方法目录**：45 个测试域、290 种测试方法、1363 条可独立判定的测试用例，
  覆盖构建与依赖、静态质量、单元与进阶测试、集成与契约、接口层、界面与可访问性、
  端到端与验收、数据、性能与容量、安全与合规、可靠性与韧性、可观测与运维、
  工程流程，以及 DSH/Cordis 插件专项与开源就绪度。
- **四档审计深度**：`smoke`（331 条）/ `standard`（984 条）/ `deep`（1295 条）/
  `exhaustive`（1363 条），按 `tier` 分层展开，并按项目类型裁剪不适用项（裁剪原因如实记录）。
- **10 个工具**：`qf_scan`、`qf_plan`、`qf_exec`、`qf_probe`、`qf_record`、`qf_list`、
  `qf_update`、`qf_report`、`qf_fixplan`、`qf_reset`。
- **证据驱动的自动执行**：识别 11 种预设命令（构建/类型检查/Lint/格式/测试/覆盖率/E2E/
  依赖审计/密钥扫描/安装/过期依赖），执行结果按"方法 + 标题"精确回填到测试项；
  工具缺失记为跳过而不是失败。
- **可勾选报告**：Markdown 报告含结论摘要、优先级与严重度分布、修复波次、逐条勾选的问题清单、
  全部测试项核对表、未展开项、执行证据、项目画像与签署栏；`qf_update sync=true` 可将
  开发者的勾选状态回写到结构化数据（支持 `WONTFIX` / `DEFER` / `NA` 标记）。
- **修复范围协商**：`qf_fixplan` 按优先级生成修复波次与可直接粘贴给 Harness 的交接单，
  支持全部修复、仅 P0/P1、指定编号、排除编号等范围表达。
- **方法论技能**：内嵌 `qualityforge-audit` 技能，说明工作流、判定纪律与反模式。
- **零运行时依赖**：只使用 Node 内置模块，无构建步骤，不 import 任何外部包。
- **开源工程化**：CI（Node 20/22 + 目录与映射校验）、测试套件（27 项，含侦察行为测试）、
  目录编写规范、报告格式说明、贡献指南、安全政策与行为准则。
