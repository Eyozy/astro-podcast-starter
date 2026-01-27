# 播客网站模板（示例：贤者时间）

一个可复用的播客静态网站模板，默认示例为《贤者时间》。支持从小宇宙 RSS 自动同步节目、AI 智能内容管理，以及全文搜索。

## 在线访问

- **网站地址**: https://xzsj.netlify.app/
- **RSS 订阅**: 见 `src/data/site.json` → `podcast.rssUrl`

## 功能亮点

- **自动同步** - 一键从小宇宙 RSS 获取最新节目
- **AI 智能管理**（可选） - 自动为节目生成主题分类和标签，通过配置开关控制
- **全文搜索** - 基于 Pagefind 的快速站内搜索
- **全局播放器** - 吸底播放器，支持后台播放
- **复古温馨风格** - 精心设计的视觉体验
- **模板化配置** - 所有文案与链接集中在 `src/data/site.json`

## 模板配置入口

站点内容统一配置在 `src/data/site.json`，包括：

- **功能开关** - `features.aiTagging`：是否启用 AI 标签/主题功能（默认关闭）
- 品牌名/描述/OG 图
- RSS 与平台订阅链接
- 首页文案与按钮
- 页面通用 UI 文案（播放/暂停/空状态）
- 关于页成员/联系方式/反馈方式
- 播放器/分享卡片文案（含文件名前缀）
- 文字稿模板占位文案

详细说明见 `docs/template-config.md`。

> 目前仅支持小宇宙 RSS 链接。

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18.x 或更高版本
- npm（随 Node.js 一起安装）

### 第一步：克隆项目

```bash
git clone https://github.com/Eyozy/astro-podcast-starter.git
cd astro-podcast-starter
```

### 第二步：安装依赖

```bash
npm install
```

### 第三步：修改站点配置（必需）

打开 `src/data/site.json`，替换为你的播客信息（RSS、品牌名、文案、成员等）。

### 第四步：配置环境变量（可选）

如果你需要使用 AI 智能打标功能：

1. 首先在 `src/data/site.json` 中启用 AI 功能：
   ```json
   {
     "features": {
       "aiTagging": true
     }
   }
   ```

2. 在项目根目录创建 `.env` 文件，添加以下内容：

```bash
# 选择提供商：deepseek | openrouter | xai | zhipu（必填）
AI_PROVIDER=deepseek

# DeepSeek（示例）
DEEPSEEK_API_KEY=sk-你的密钥
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```

> **不需要 AI 功能？** 保持 `features.aiTagging: false`（默认值）即可，无需配置任何环境变量。网站的基础功能（同步、构建、预览）都能正常使用。
>
> 其他提供商（OpenRouter / xAI / 智谱）的环境变量示例请参考 `.env.example`。

### 第五步：获取节目数据

```bash
npm run sync
```

这会从小宇宙 RSS 源拉取节目信息，保存到 `src/data/episodes.json`，并生成文字稿模板。

### 第六步：启动开发服务器

```bash
npm run dev
```

打开浏览器访问 http://localhost:4321，就能看到网站了。

## 常用命令

| 命令                  | 说明                                           |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | 启动本地开发服务器                             |
| `npm run build`       | 构建生产版本（包含搜索索引）                   |
| `npm run preview`     | 预览构建后的网站                               |
| `npm run fetch`       | 从 RSS 拉取最新节目数据                        |
| `npm run sync`        | 完整同步：拉取数据 + 生成文字稿模板 + 自动打标 |
| `npm run reset`       | 重置所有播客数据（切换播客时使用）             |
| `npm run tag`         | 为未分类的节目添加主题和标签（需要 API 密钥）  |
| `npm run analyze`     | 重新分析所有节目，生成主题分类（慎用）         |
| `npm run smart-build` | 一键完成：同步数据 + 构建网站                  |

## AI 内容管理

本项目集成了基于 AI 的内容管理系统，让节目的分类和标签管理变得轻松自动。

### 工作原理

```
小宇宙 RSS
    ↓ npm run sync
episodes.json（原始数据）
    ↓ npm run analyze
themes.json（5 个主题分类）
    ↓ npm run tag
episodes.json（添加主题和标签）
    ↓ npm run build
静态网站 + 搜索索引
```

### 日常更新流程

有新节目发布时，只需运行：

```bash
npm run smart-build
```

这一条命令会自动完成数据同步和网站构建。

### 脚本详解

**`npm run sync`**

同步 RSS 数据，为新节目生成文字稿模板。如果配置了 API 密钥，还会自动为新节目打标。

**`npm run tag`**

检查所有未分类的节目，根据现有主题进行归类，并生成相关标签。建议在每次拉取新数据后运行。

**`npm run analyze`**

分析所有节目内容，重新生成主题分类体系。这会覆盖现有的 `themes.json`，建议仅在初始化或需要重构分类体系时使用。

## 项目结构

```
xzsj/
├── scripts/                   # 数据处理脚本
│   ├── ai-client.js           # DeepSeek API 封装
│   ├── analyze-themes.js      # AI 主题分析
│   ├── fetch-rss.js           # RSS 数据抓取
│   ├── reset-data.js          # 数据重置脚本
│   ├── sync-content.js        # 内容同步
│   └── tag-episodes.js        # AI 智能打标
├── src/
│   ├── components/            # UI 组件
│   │   ├── EpisodeCard.astro  # 节目卡片
│   │   ├── Player.astro       # 全局播放器
│   │   └── ...
│   ├── data/                  # 数据文件
│   │   ├── site.json          # 站点配置入口（模板修改这里）
│   │   ├── episodes.json      # 节目元数据
│   │   └── themes.json        # 主题分类
│   ├── layouts/               # 页面布局
│   ├── pages/                 # 路由页面
│   └── styles/                # 样式文件
├── public/                    # 静态资源
├── astro.config.mjs           # Astro 配置
└── package.json
```

## 技术栈

- **[Astro](https://astro.build/)** - 静态网站生成框架
- **[Tailwind CSS](https://tailwindcss.com/)** - 原子化 CSS 框架
- **[Pagefind](https://pagefind.app/)** - 静态网站搜索引擎
- **AI（可选）** - 支持多提供商：DeepSeek / OpenRouter / xAI / 智谱

## 部署

本项目默认配置为部署到 Netlify，你也可以部署到任何支持静态网站的平台。

### Netlify 部署

1. 将代码推送到 GitHub
2. 在 Netlify 中导入项目
3. 设置构建命令为 `npm run build`（推荐，RSS 同步交给 GitHub Actions）
4. 设置发布目录为 `dist`
5. 如需 AI 功能，在 GitHub Secrets 中添加 `AI_PROVIDER` + 对应提供商的 `*_API_KEY/_API_URL/_MODEL`（例如 DeepSeek 或 OpenRouter）：
   - 打开 GitHub 仓库页面，点击顶部的 **Settings** ⚙️
   - 在左侧导航栏找到 **Security** 区域，点击 **Secrets and variables**，展开后选择 **Actions**
   - 点击右侧绿色的 **New repository secret** 按钮
   - **Name** 输入变量名（例如 `AI_PROVIDER` / `DEEPSEEK_API_KEY` / `DEEPSEEK_API_URL` / `DEEPSEEK_MODEL`），**Secret** 输入对应值
   - 点击 **Add secret** 保存

> 如果你不使用 GitHub Actions，同步和构建可以改用 `npm run smart-build`。

### 其他平台

构建完成后，`dist` 目录包含所有静态文件，可以部署到任何静态托管服务。

## 常见问题

**Q: 没有 AI API 密钥可以使用吗？**

可以。网站的核心功能都能正常使用，只是节目不会自动获得主题分类和标签。你可以手动编辑 `episodes.json` 来添加这些信息。

**Q: 如何获取 AI API 密钥？**

根据你选择的提供商去对应控制台创建 API Key（DeepSeek / OpenRouter / xAI / 智谱），并把 `AI_PROVIDER` 与对应的 `*_API_KEY/_API_URL/_MODEL` 配好即可。

**Q: 切换到新播客后，旧数据还在怎么办？**

运行 `npm run reset` 可以一键清空所有播客数据。或者在运行 `npm run sync` 时，脚本会自动检测到已有数据并询问是否清空。

**Q: 构建时搜索功能报错怎么办？**

确保已正确安装依赖。如果问题持续，尝试删除 `node_modules` 后重新安装：

```bash
rm -rf node_modules
npm install
```

## 许可证

MIT
