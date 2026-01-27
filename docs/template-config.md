# 模板配置与扩展指南

这份文档用于帮助主播或 AI 快速理解项目结构与可配置项，并在不修改核心逻辑的情况下完成个性化定制。

## 设计前提

- 仅支持小宇宙 RSS 链接。
- 站点是静态构建，内容通过定时同步更新（默认每天一次）。
- 不做运行时实时拉取，避免频繁请求 RSS 源（但提供 API 端点用于特殊场景）。
- 配置文件带 JSON Schema 校验，编辑器可提供自动补全和错误提示。

## 快速改成你的播客

1. 修改 `src/data/site.json` 中的品牌、文案、成员和订阅链接。
2. 执行 `npm run sync` 拉取最新 RSS 数据。
3. 执行 `npm run dev` 预览或 `npm run build` 部署。

## 新手/AI 快速修改清单

- **只改一个文件**：`src/data/site.json`（带 JSON Schema 校验：`site.schema.json`）
- **品牌与链接**：`brand`、`podcast`、`navigation`、`assets`
- **页面文案**：`hero`、`sections`、`pages`、`ui`
- **关于我们**：`about`、`footer`
- **播放器/分享卡片**：`player`、`shareCard`（含 `filenamePrefix`）
- **文字稿占位**：`transcripts.placeholderNotice`（只影响新生成模板）

## 配置入口（site.json）

所有站点内容集中在 `src/data/site.json`，你只需改这个文件即可完成大部分定制。

- `features`：功能开关配置
  - `aiTagging`：是否启用 AI 标签/主题功能（默认 `false`）
- `brand`：品牌名、站点元信息（SEO、作者、Twitter 等）
- `assets`：默认封面、OG 图、favicon
- `podcast`：RSS 与平台链接、二维码
- `navigation`：导航菜单标签与链接
- `hero`：首页主标题与按钮文案
- `sections`：首页/订阅区标题与说明
- `ui`：通用按钮/状态文案（播放、暂停、未知时长、期号前缀等）
- `pages`：页面级文案（列表页、详情页、空状态等）
- `about`：关于页完整文案、成员、联系方式、反馈渠道
- `footer`：页脚描述文案
- `player` / `shareCard`：播放器与分享卡片文案
- `transcripts`：文字稿模板占位文案

## 数据流（内容同步）

```
小宇宙 RSS
  ↓ scripts/sync-content.js
src/data/episodes.json + src/content/transcripts
  ↓ astro build
dist (静态站点)
```

注意：`src/data/episodes.json` 和 `src/content/transcripts` 是自动生成内容，不建议手改。

### AI 标签/主题功能

项目支持 AI 智能打标和主题分类功能，通过 `site.json` 中的 `features.aiTagging` 开关控制：

| 配置值 | 效果 |
|--------|------|
| `false`（默认） | 关闭 AI 功能，隐藏主题页面和标签筛选，无需配置环境变量 |
| `true` | 启用 AI 功能，需在 `.env` 中配置 AI 提供商 |

**关闭时的行为：**
- 导航栏不显示"探索主题"
- 首页不显示主题导航区块
- `/themes` 页面返回 404
- 节目列表页隐藏标签筛选
- `npm run sync` 跳过 AI 打标

**启用步骤：**
1. 将 `site.json` 中 `features.aiTagging` 设为 `true`
2. 在 `.env` 中配置 AI 提供商（参考 `.env.example`）
3. 运行 `npm run sync`（会自动生成 `themes.json` 并打标）

> 注意：`src/data/themes.json` 默认是空数组 `[]`，启用 AI 功能后会被自动填充。

### 标签规范化

项目使用 `tag-taxonomy.json` 管理允许的标签和别名映射：

```json
{
  "tags": ["职场", "情感", "成长", ...],
  "aliases": {
    "工作": "职场",
    "恋爱": "情感"
  }
}
```

运行 `node scripts/normalize-tags.js` 可将节目标签规范化。

### API 端点

除了静态构建，项目还提供两个 API 端点用于动态获取数据：

| 端点 | 用途 |
|------|------|
| `/api/episodes.json` | 实时解析 RSS 返回 JSON 格式节目数据（缓存 5 分钟） |
| `/api/rss` | 代理原始 RSS XML |

## 自动同步（定时更新）

GitHub Actions 每天运行一次同步任务：

- 配置文件：`.github/workflows/rss-sync.yml`
- 默认时间：北京时间 00:00（UTC 16:00）
- 如需调整频率，修改 `cron` 表达式即可

## 常见修改范式

- **启用 AI 标签/主题功能**：将 `site.json` 中 `features.aiTagging` 设为 `true`，并配置 `.env` 中的 AI 提供商
- **更换播客**：修改 `site.json` 中 `podcast.rssUrl` 与各平台链接
- **改品牌/文案**：修改 `site.json` 的 `brand`、`hero`、`about`、`footer`
- **改成员信息**：修改 `site.json` 的 `about.members`
- **改 OG/封面**：修改 `site.json` 的 `assets`
- **改导航**：修改 `site.json` 的 `navigation`
- **管理标签**：编辑 `tag-taxonomy.json` 添加/删除允许的标签或设置别名

## 给 AI 的工作提示

1. 先读取 `src/data/site.json`，这是唯一的"内容入口"（有 `site.schema.json` 提供结构校验）。
2. 不要直接编辑 `src/data/episodes.json`（它是同步脚本生成的）。
3. 需要新增页面时，优先在 `src/pages` 创建，并在 `site.json` 的 `navigation` 中增加入口。
4. 保持"静态构建 + 定时同步"的模式，除非用户明确要求实时更新。
5. 标签相关修改应编辑 `tag-taxonomy.json`，然后运行 `node scripts/normalize-tags.js`。
