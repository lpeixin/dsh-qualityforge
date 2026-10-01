# 发布检查单

面向维护者：把 QualityForge 发布到 GitHub / npm 时需要做的每一步，以及容易踩的坑。

## 0. 一句话背景

GitHub 上"插件列表里的横幅图"（例如 <https://github.com/topics/dsh-plugin> 每个仓库卡片顶部那张图）
**不是 README 里的 banner**，而是仓库的 **Social preview（社交预览图）**——也就是 `og:image`。
README 里的 `assets/banner.svg` 只影响仓库主页，不会出现在 topic 列表卡片里。

判断当前用的是哪一张：

```bash
curl -sS -A "Mozilla/5.0" https://github.com/<owner>/<repo> \
  | grep -oE 'property="og:image" content="[^"]*"'
```

| `og:image` 域名 | 含义 |
| --- | --- |
| `opengraph.githubassets.com/...` | GitHub 自动生成的渐变卡片（**没有自定义预览图**） |
| `repository-images.githubusercontent.com/...` | 已上传的自定义 Social preview ✅ |

## 1. 发布前检查（本地）

```bash
node --test                  # 全部测试必须通过
npm run validate             # 测试方法目录契约 + 预设自动回填映射
npm run catalog:stats        # 目录规模与各深度展开条数（README 中的数字要与之一致）
npm pack --dry-run           # 检查将发布到 npm 的文件清单，确认没有杂物
```

再扫一遍敏感信息（本机路径、邮箱、凭据）：

```bash
git grep --cached -nIE "/Users/|/home/[a-z]|C:\\\\Users|peixinliu|@gmail\.|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{32,}|-----BEGIN [A-Z ]*PRIVATE KEY" || echo "clean"
```

## 2. 仓库设置（GitHub 网页端，只能用网页端）

打开 `https://github.com/<owner>/<repo>/settings`：

| 位置 | 要做的事 |
| --- | --- |
| **About**（仓库首页右上齿轮） | 填写 Description；添加 topics：`dsh-plugin`、`dsh-plugins`、`deepseek-harness`、`plugin`、`qa`、`testing`、`audit`、`report` |
| **General → Social preview** | **上传 `assets/social-preview.png`** ← 这一步决定 topic 列表卡片里的横幅图 |
| General → Features | 确认 Issues / Discussions 已开启（与 `.github/ISSUE_TEMPLATE/config.yml` 中的讨论链接一致） |
| Security → Advisories | 保持开启（`SECURITY.md` 指向私有披露渠道） |
| Branches | 为 `main` 加保护规则：要求 CI 通过（`.github/workflows/ci.yml`） |

> Social preview 没有公开 API，必须在网页端上传。上传后 GitHub 会缓存一段时间，
> 卡片图可能需要几分钟（偶尔更久）才刷新。

### 修改社交预览图

```bash
# 1) 改 assets/social-preview.svg（1280×640，2:1）
# 2) 重新导出 PNG（约束：1280×640、PNG/JPG/GIF、< 1 MB）
rsvg-convert -w 1280 -h 640 assets/social-preview.svg -o assets/social-preview.png   # librsvg
# 或：inkscape --export-type=png --export-width=1280 assets/social-preview.svg
# 或：magick -density 96 -background none assets/social-preview.svg -resize 1280x640 assets/social-preview.png
# 3) 到 Settings → Social preview 重新上传
```

## 3. 打 tag 与发布 Release

```bash
# package.json 的 version 与 CHANGELOG 必须先行更新
git add -A && git commit -m "chore(release): 0.1.0"
git tag -a v0.1.0 -m "dsh-qualityforge 0.1.0"
git push origin main --follow-tags
```

然后在 GitHub 的 Releases 页面基于该 tag 撰写发布说明（可直接引用 `CHANGELOG.md` 对应段落）。

## 4. 发布到 npm（可选）

```bash
npm pack --dry-run     # 先确认清单与体积
npm publish --access public
```

安装方通过 `dsh plugin --profile <profile> add dsh-qualityforge` 使用。
插件保持**零运行时依赖**，因此 `dependencies` 必须始终为空——CI 里有一条断言在守这一点。

## 5. 常见误解

| 现象 | 原因 |
| --- | --- |
| README 顶部图正常，但 topic 列表卡片没有横幅 | Social preview 未上传（见第 2 节） |
| 改了 `assets/banner.svg` 但卡片图没变 | 卡片图用的是 `social-preview.png`，与 README banner 无关 |
| 卡片图更新后仍是旧的 | GitHub 端缓存，等待数分钟后强制刷新页面 |
| npm 包里缺文件 | `package.json` 的 `files` 字段是白名单，新目录要显式加入 |
