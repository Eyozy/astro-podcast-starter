# CLAUDE.md - 播客网站模板（示例：贤者时间）

## 项目概述

可复用的播客静态网站模板，具备可选的 AI 智能内容管理功能。

- **技术栈**: Astro 5.x + Tailwind CSS 4.x + Pagefind + AI API（可选）
- **数据源**: 小宇宙 RSS（在 `src/data/site.json` 中配置）
- **设计风格**: 复古温馨 (背景 `#f5f2ed`, 文字 `#2d2a26`, 强调 `orange-700`)
- **AI 功能**: 通过 `features.aiTagging` 开关控制（默认关闭）

## 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 构建 (含 Pagefind 搜索索引)
npm run sync         # 同步 RSS + 生成文字稿模板 + AI 打标（如已启用）
npm run reset        # 重置所有播客数据（切换播客时使用）
npm run fetch        # 仅抓取 RSS
npm run analyze      # AI 主题分析（需启用 AI 功能 + .env）
npm run tag          # AI 打标（需启用 AI 功能 + .env）
npm run smart-build  # sync + build
```

## 核心文件

- `src/data/site.json` - 站点配置入口（含 `features.aiTagging` 开关）
- `src/data/episodes.json` - 节目元数据（自动生成）
- `src/data/themes.json` - 主题分类（默认空数组，启用 AI 后自动填充）
- `src/constants.ts` - 颜色等常量配置

## AI 功能开关

| 配置值 | 效果 |
|--------|------|
| `features.aiTagging: false`（默认） | 关闭 AI 功能，隐藏主题页面和标签筛选，无需配置环境变量 |
| `features.aiTagging: true` | 启用 AI 功能，需在 `.env` 中配置 AI 提供商 |

## 代码规范

- 界面文本使用中文
- 优先使用 Tailwind CSS 类名
- 使用 Astro 组件进行 UI 拆解
- 遵循 TDD 和 YAGNI 原则

## 详细文档

- [项目上下文](../docs/CONTEXT.md) - 目录结构、关键文件、数据流、环境变量
- [模板配置说明](../docs/template-config.md) - 如何定制站点
