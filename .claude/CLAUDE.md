# CLAUDE.md - 播客网站模板（示例：贤者时间）

## 项目概述

可复用的播客静态网站模板，具备 AI 智能内容管理功能。

- **技术栈**: Astro 5.x + Tailwind CSS 4.x + Pagefind + OpenRouter API
- **数据源**: 小宇宙 RSS（在 `src/data/site.json` 中配置）
- **设计风格**: 复古温馨 (背景 `#f5f2ed`, 文字 `#2d2a26`, 强调 `orange-700`)

## 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 构建 (含 Pagefind 搜索索引)
npm run sync         # 同步 RSS + 生成文字稿模板
npm run fetch        # 仅抓取 RSS
npm run analyze      # AI 主题分析 (生成 themes.json)
npm run tag          # AI 打标 (需 .env)
npm run smart-build  # sync + build
```

## 核心文件

- `src/data/site.json` - 站点配置入口（模板定制从这里开始）
- `src/data/episodes.json` - 节目元数据（自动生成）
- `src/data/themes.json` - 主题分类（AI 生成）
- `src/constants.ts` - 颜色等常量配置

## 代码规范

- 界面文本使用中文
- 优先使用 Tailwind CSS 类名
- 使用 Astro 组件进行 UI 拆解
- 遵循 TDD 和 YAGNI 原则

## 详细文档

- [项目上下文](../docs/CONTEXT.md) - 目录结构、关键文件、数据流、环境变量
- [模板配置说明](../docs/template-config.md) - 如何定制站点
