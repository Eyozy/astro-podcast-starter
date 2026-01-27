# 项目上下文 - 播客网站模板（默认示例：贤者时间）

## 当前状态

项目已完成模板化改造，核心能力稳定：
- RSS 同步、全局播放器、全文搜索（Pagefind）
- AI 智能内容管理（可选，通过 `features.aiTagging` 开关控制）
- 站点文案与链接集中配置（`src/data/site.json`，带 JSON Schema 校验）
- API 端点支持动态 RSS 获取
- RSS 变更自动检测，切换播客时自动清理旧数据
- 自定义 404 页面

---

## 目录结构

```
astro-podcast-starter/
├── scripts/                   # 数据处理脚本
│   ├── ai-client.js           # DeepSeek API 封装
│   ├── analyze-themes.js      # AI 主题分析
│   ├── fetch-rss.js           # RSS 数据抓取
│   ├── normalize-tags.js      # 标签规范化（基于 taxonomy）
│   ├── refresh-themes.js      # AI 主题刷新（更新标题/描述/代表标签）
│   ├── reset-data.js          # 数据重置脚本
│   ├── site-config.js         # 读取站点配置（RSS 等）
│   ├── sync-content.js        # 内容同步
│   └── tag-episodes.js        # AI 智能打标
├── src/
│   ├── components/            # Astro 组件
│   │   ├── EpisodeCard.astro  # 节目卡片
│   │   ├── GuideSection.astro # 主题导航
│   │   ├── Hero.astro         # 首页英雄区
│   │   ├── Player.astro       # 全局播放器
│   │   ├── RSSSection.astro   # RSS 订阅区
│   │   └── ShareModal.astro   # 分享弹窗
│   ├── constants.ts           # 颜色等常量配置
│   ├── content/
│   │   └── config.ts          # Astro 内容集合配置
│   ├── data/                  # 数据文件
│   │   ├── site.json          # 站点配置入口（模板修改这里）
│   │   ├── site.schema.json   # site.json 的 JSON Schema
│   │   ├── episodes.json      # 节目元数据
│   │   ├── themes.json        # 主题分类
│   │   └── tag-taxonomy.json  # 标签分类法
│   ├── layouts/
│   │   └── MainLayout.astro   # 主布局
│   ├── pages/                 # 页面路由
│   │   ├── index.astro        # 首页
│   │   ├── episodes.astro     # 节目列表
│   │   ├── episodes/[id].astro # 节目详情
│   │   ├── themes.astro       # 主题探索（需启用 AI 功能）
│   │   ├── about.astro        # 关于页面
│   │   ├── 404.astro          # 404 页面
│   │   └── api/               # API 端点
│   │       ├── episodes.json.ts # 动态获取节目数据
│   │       └── rss.ts         # RSS 代理端点
│   └── styles/global.css      # 全局样式
└── docs/
    ├── template-config.md     # 模板配置说明
    └── CONTEXT.md             # 本文档
```

---

## 关键文件

### 核心组件
| 文件 | 职责 |
|------|------|
| `src/components/Player.astro` | 全局吸底播放器，支持最小化/展开、进度拖拽 |
| `src/components/EpisodeCard.astro` | 节目卡片展示 |
| `src/components/GuideSection.astro` | 首页主题导航入口 |
| `src/layouts/MainLayout.astro` | 主布局，含导航、页脚、View Transitions |

### 数据脚本
| 文件 | 用途 |
|------|------|
| `scripts/fetch-rss.js` | 从小宇宙 RSS 抓取节目数据 |
| `scripts/site-config.js` | 读取站点配置（含 RSS） |
| `scripts/ai-client.js` | DeepSeek API 封装，提供 `askAI()` |
| `scripts/analyze-themes.js` | AI 主题分析 (生成 themes.json) |
| `scripts/tag-episodes.js` | AI 智能打标 (更新 episodes.json) |
| `scripts/sync-content.js` | 同步 RSS + 生成文字稿模板 + 自动打标 |
| `scripts/reset-data.js` | 重置所有播客数据（切换播客时使用） |
| `scripts/normalize-tags.js` | 标签规范化，基于 tag-taxonomy.json 清理标签 |
| `scripts/refresh-themes.js` | AI 刷新主题标题、描述和代表标签 |

### API 端点
| 文件 | 用途 |
|------|------|
| `src/pages/api/episodes.json.ts` | 动态获取并解析 RSS 返回 JSON 格式节目数据 |
| `src/pages/api/rss.ts` | RSS 代理端点，返回原始 XML |

### 数据文件
| 文件 | 内容 | 更新方式 |
|------|------|----------|
| `src/data/site.json` | 站点配置入口（含 `features.aiTagging` 开关） | 手动维护 |
| `src/data/site.schema.json` | site.json 的 JSON Schema | 手动维护 |
| `src/data/episodes.json` | 所有节目元数据 | `npm run sync` |
| `src/data/themes.json` | 主题分类（默认空数组，启用 AI 后自动填充） | `npm run analyze` |
| `src/data/tag-taxonomy.json` | 标签分类法（含别名映射） | 手动维护 |

---

## 数据流

```
RSS Feed (小宇宙)
    │
    ▼ npm run sync
episodes.json (原始数据)
    │
    ├─▶ npm run analyze ─▶ themes.json (主题分类)
    │
    ├─▶ npm run tag ─▶ episodes.json (添加 themeId + tags)
    │
    └─▶ node scripts/normalize-tags.js ─▶ episodes.json (标签规范化)
    │
    ▼ npm run build
Astro 静态页面 + Pagefind 搜索索引
```

> `npm run sync` 会为新增/更新的节目在 `src/content/transcripts` 下生成文字稿模板。

### API 数据流（运行时）

```
客户端请求
    │
    ├─▶ /api/episodes.json ─▶ 实时解析 RSS 返回 JSON（缓存 5 分钟）
    │
    └─▶ /api/rss ─▶ 代理原始 RSS XML
```

---

## 环境变量

环境变量仅在启用 AI 功能时需要配置（`features.aiTagging: true`）。

在 `.env` 文件中配置：

```bash
# 选择使用哪个 AI 提供商（启用 AI 功能时必填）
AI_PROVIDER=deepseek  # deepseek | openrouter | xai | zhipu

# DeepSeek
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat

# 其他提供商（OpenRouter / xAI / 智谱）请参考 `.env.example`
```

> 如果 `features.aiTagging: false`（默认），则无需配置任何环境变量。

如果使用 GitHub Actions 定时同步，请将这些变量配置在 GitHub Secrets。

## 模板使用提示

- 仅需修改 `src/data/site.json` 即可替换品牌与文案（带 JSON Schema 校验）。
- `episodes.json` 与 `transcripts` 为自动生成内容，不建议手动改。
- 详细配置说明见 `docs/template-config.md`。
- 文字稿占位与分享卡片文件名前缀也在 `site.json` 中配置。
- `tag-taxonomy.json` 支持标签别名映射，可将不同写法归一化。

---

## 可选优化

- 图片优化：构建时下载图片并经由 Astro Image 处理
- PWA 支持：添加 manifest 和 service worker
- 标签页：增加 `/tags` 页面或按 Tag 筛选
