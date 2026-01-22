/**
 * ⚠️ 警告：此脚本已废弃，请使用 sync-content.js 替代
 *
 * 直接运行此脚本会覆盖 episodes.json 中的 AI 打标数据（themeId, tags）。
 * 推荐使用：npm run smart-build 或 node scripts/sync-content.js
 *
 * 如果确实需要仅更新 RSS 数据而保留标签，请使用：
 *   node scripts/sync-content.js --skip-tag --skip-transcripts
 */

import Parser from "rss-parser";
import fs from "fs";
import path from "path";
import { getRssUrl } from "./site-config.js";

const parser = new Parser();
const RSS_URL = getRssUrl();
const DATA_PATH = path.join(process.cwd(), "src/data/episodes.json");

function extractEpisodeId(link) {
  const match = link?.match(/\/episode\/([a-z0-9]+)/);
  return match ? match[1] : Math.random().toString(36).substring(7);
}

async function fetchRSS() {
  console.warn("⚠️  警告：此脚本会覆盖 AI 打标数据，推荐使用 sync-content.js");
  console.log("正在获取 RSS 数据...");

  // 读取现有数据以保留 AI 打标字段
  let existingEpisodes = [];
  try {
    const existingData = fs.readFileSync(DATA_PATH, "utf-8");
    existingEpisodes = JSON.parse(existingData);
  } catch {
    console.log("未找到现有数据，将创建新文件");
  }

  // 构建 ID 到现有数据的映射
  const existingMap = new Map(existingEpisodes.map((ep) => [ep.id, ep]));

  try {
    const feed = await parser.parseURL(RSS_URL);
    console.log(`成功获取播客：${feed.title}`);

    const episodes = feed.items.map((item) => {
      const id = extractEpisodeId(item.link);
      const existing = existingMap.get(id);

      return {
        id,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item.content,
        contentSnippet: item.contentSnippet,
        enclosure: item.enclosure,
        itunes: item.itunes,
        // 保留已有的 AI 打标数据
        ...(existing?.themeId && { themeId: existing.themeId }),
        ...(existing?.tags && { tags: existing.tags }),
      };
    });

    fs.writeFileSync(DATA_PATH, JSON.stringify(episodes, null, 2));
    console.log(`已成功保存 ${episodes.length} 集节目到 ${DATA_PATH}`);
  } catch (error) {
    console.error("获取 RSS 失败：", error);
    process.exit(1);
  }
}

fetchRSS();
