import "dotenv/config";
import Parser from "rss-parser";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import DOMPurify from "isomorphic-dompurify";
import { getRssUrl, loadSiteConfig } from "./site-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RSS_URL = getRssUrl();
const DATA_PATH = path.join(__dirname, "../src/data/episodes.json");
const TRANSCRIPTS_DIR = path.join(__dirname, "../src/content/transcripts");
const THEMES_PATH = path.join(__dirname, "../src/data/themes.json");
const TAG_TAXONOMY_PATH = path.join(__dirname, "../src/data/tag-taxonomy.json");
const RSS_CACHE_PATH = path.join(__dirname, "../.last-rss-url");
const ENV_PATH = path.join(__dirname, "../.env");
const SITE_CONFIG = loadSiteConfig();
const TRANSCRIPT_PLACEHOLDER = SITE_CONFIG?.transcripts?.placeholderNotice;

if (!TRANSCRIPT_PLACEHOLDER) {
  throw new Error("Missing transcripts.placeholderNotice in site config.");
}

// ============ 环境变量检测 ============
function checkEnvStatus() {
  const envExists = fs.existsSync(ENV_PATH);
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!envExists) {
    console.log("ℹ️  未检测到 .env 文件，跳过 AI 打标功能");
    console.log("   如需启用 AI 功能，请创建 .env 文件并配置 DEEPSEEK_API_KEY\n");
    return { hasEnv: false, hasApiKey: false };
  }

  if (!apiKey) {
    console.log("⚠️  .env 文件中未配置 DEEPSEEK_API_KEY，跳过 AI 打标功能");
    console.log("   请在 .env 文件中添加：DEEPSEEK_API_KEY=你的密钥\n");
    return { hasEnv: true, hasApiKey: false };
  }

  return { hasEnv: true, hasApiKey: true };
}

// ============ RSS 变更检测 ============
function getLastRssUrl() {
  if (!fs.existsSync(RSS_CACHE_PATH)) {
    return null;
  }
  return fs.readFileSync(RSS_CACHE_PATH, "utf-8").trim();
}

function saveLastRssUrl(url) {
  fs.writeFileSync(RSS_CACHE_PATH, url);
}

function clearAllData() {
  // 清空 episodes.json
  if (fs.existsSync(DATA_PATH)) {
    fs.unlinkSync(DATA_PATH);
    console.log("   ✓ 已清空 episodes.json");
  }

  // 清空 themes.json
  if (fs.existsSync(THEMES_PATH)) {
    fs.unlinkSync(THEMES_PATH);
    console.log("   ✓ 已清空 themes.json");
  }

  // 清空 transcripts 目录
  if (fs.existsSync(TRANSCRIPTS_DIR)) {
    const files = fs.readdirSync(TRANSCRIPTS_DIR);
    const mdFiles = files.filter((file) => file.endsWith(".md"));
    mdFiles.forEach((file) => {
      fs.unlinkSync(path.join(TRANSCRIPTS_DIR, file));
    });
    if (mdFiles.length > 0) {
      console.log(`   ✓ 已清空 ${mdFiles.length} 个文字稿文件`);
    }
  }
}

async function askUserConfirm(question) {
  // CI 环境或非交互式终端，默认返回 true（自动确认）
  if (!process.stdin.isTTY) {
    console.log(`${question} [自动确认：Y]`);
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "" || normalized === "y" || normalized === "yes");
    });
  });
}

async function checkRssChange() {
  const lastRssUrl = getLastRssUrl();
  const existingEpisodes = readEpisodes();
  const hasExistingData = existingEpisodes.length > 0;

  // 首次运行且没有旧数据，直接保存 RSS 地址
  if (!lastRssUrl && !hasExistingData) {
    saveLastRssUrl(RSS_URL);
    return;
  }

  // 首次运行但有旧数据（用户下载模板后的场景）
  if (!lastRssUrl && hasExistingData) {
    // 如果有旧数据，提示用户是否清空
    console.log("\n⚠️  检测到已有播客数据（可能来自模板示例）");
    console.log(`   当前数据：${existingEpisodes.length} 集节目`);
    console.log(`   新 RSS 地址：${RSS_URL}\n`);

    const confirm = await askUserConfirm("是否清空旧数据并重新同步？[Y/n] ");

    if (confirm) {
      console.log("\n正在清空旧数据...");
      clearAllData();
      console.log("");
    } else {
      console.log("\n保留旧数据，继续同步...\n");
    }

    saveLastRssUrl(RSS_URL);
    return;
  }

  // RSS 地址未变化
  if (lastRssUrl === RSS_URL) {
    return;
  }

  // RSS 地址变化，提示用户
  console.log("\n⚠️  检测到 RSS 地址已变更");
  console.log(`   旧地址：${lastRssUrl}`);
  console.log(`   新地址：${RSS_URL}\n`);

  const confirm = await askUserConfirm("是否清空旧数据并重新同步？[Y/n] ");

  if (confirm) {
    console.log("\n正在清空旧数据...");
    clearAllData();
    console.log("");
  } else {
    console.log("\n保留旧数据，继续同步...\n");
  }

  saveLastRssUrl(RSS_URL);
}

const options = parseArgs(process.argv.slice(2));

function parseArgs(args) {
  const parsed = {
    skipTag: false,
    skipTranscripts: false,
  };

  args.forEach((arg) => {
    if (arg === "--skip-tag") parsed.skipTag = true;
    if (arg === "--skip-transcripts") parsed.skipTranscripts = true;
  });

  return parsed;
}

function readEpisodes() {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  } catch (e) {
    console.warn("⚠️  episodes.json 解析失败，将视为空数据：", e.message);
    return [];
  }
}

function writeEpisodes(episodes) {
  const tempPath = DATA_PATH + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(episodes, null, 2));
  fs.renameSync(tempPath, DATA_PATH);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function extractEpisodeId(item, index) {
  const linkMatch = item.link?.match(/\/episode\/([a-z0-9]+)/i);
  if (linkMatch) return linkMatch[1];
  const guidMatch = item.guid?.match(/\/([a-f0-9]+)$/i);
  if (guidMatch) return guidMatch[1];
  return `ep-${index}`;
}

function normalizeEpisode(item, index) {
  // 使用 DOMPurify 清理 RSS content，防止 XSS 攻击
  const sanitizedContent = item.content
    ? DOMPurify.sanitize(item.content, {
        ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      })
    : "";

  return {
    id: extractEpisodeId(item, index),
    title: item.title || "",
    link: item.link || "",
    pubDate: item.pubDate || "",
    content: sanitizedContent,
    contentSnippet: item.contentSnippet || "",
    enclosure: item.enclosure,
    itunes: item.itunes || {},
  };
}

function mergeEpisode(incoming, existing) {
  return {
    id: incoming.id,
    title: incoming.title || existing?.title || "",
    link: incoming.link || existing?.link || "",
    pubDate: incoming.pubDate || existing?.pubDate || "",
    content: incoming.content || existing?.content || "",
    contentSnippet: incoming.contentSnippet || existing?.contentSnippet || "",
    enclosure: incoming.enclosure || existing?.enclosure,
    itunes: { ...(existing?.itunes || {}), ...(incoming.itunes || {}) },
    themeId: existing?.themeId,
    tags: Array.isArray(existing?.tags) ? existing.tags : [],
  };
}

function buildCompareFields(episode) {
  return {
    title: episode.title || "",
    link: episode.link || "",
    pubDate: episode.pubDate || "",
    content: episode.content || "",
    contentSnippet: episode.contentSnippet || "",
    enclosureUrl: episode.enclosure?.url || "",
    enclosureType: episode.enclosure?.type || "",
    itunesEpisode: episode.itunes?.episode || "",
    itunesDuration: episode.itunes?.duration || "",
    itunesImage: episode.itunes?.image || "",
  };
}

function isEpisodeChanged(existing, merged) {
  return (
    JSON.stringify(buildCompareFields(existing)) !==
    JSON.stringify(buildCompareFields(merged))
  );
}

function escapeYaml(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
}

function buildTranscriptTemplate(episode) {
  return `---\ntitle: "${escapeYaml(episode.title)}"\ncontributors: []\n---\n\n> ${TRANSCRIPT_PLACEHOLDER}\n`;
}

function ensureTranscriptFiles(episodesById, ids) {
  if (ids.length === 0) return 0;
  ensureDir(TRANSCRIPTS_DIR);
  let createdCount = 0;

  ids.forEach((id) => {
    const episode = episodesById.get(id);
    if (!episode) return;
    const transcriptPath = path.join(TRANSCRIPTS_DIR, `${id}.md`);
    if (fs.existsSync(transcriptPath)) return;
    fs.writeFileSync(transcriptPath, buildTranscriptTemplate(episode));
    createdCount += 1;
  });

  return createdCount;
}

function runAnalyzeThemes() {
  console.log("正在分析主题并生成 themes.json...");
  const analyzeScript = path.join(__dirname, "analyze-themes.js");
  const result = spawnSync(process.execPath, [analyzeScript], { stdio: "inherit" });
  return result.status === 0;
}

function runTagging(ids, envStatus) {
  if (options.skipTag) {
    console.log("跳过 AI 打标：--skip-tag 已启用");
    return;
  }
  if (!envStatus.hasApiKey) {
    // 环境变量检测已在前面输出过提示，这里静默跳过
    return;
  }
  if (ids.length === 0) {
    console.log("跳过 AI 打标：没有需要更新的节目");
    return;
  }

  // 检查 themes.json 是否存在，不存在则先生成
  if (!fs.existsSync(THEMES_PATH)) {
    console.log("未检测到 themes.json，需要先分析主题...\n");
    const success = runAnalyzeThemes();
    if (!success) {
      console.log("⚠️  主题分析失败，跳过 AI 打标");
      return;
    }
    console.log("");
  }

  // 检查 tag-taxonomy.json 是否存在
  if (!fs.existsSync(TAG_TAXONOMY_PATH)) {
    console.log("⚠️  未检测到 tag-taxonomy.json，跳过 AI 打标");
    console.log("   请确保 src/data/tag-taxonomy.json 文件存在\n");
    return;
  }

  console.log("正在执行 AI 打标...");
  const tagScript = path.join(__dirname, "tag-episodes.js");
  const args = [tagScript, "--ids", ids.join(",")];
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function syncContent() {
  // 检测环境变量状态
  const envStatus = checkEnvStatus();

  // 检测 RSS 地址是否变更
  await checkRssChange();

  const parser = new Parser();
  const existingEpisodes = readEpisodes();
  const existingById = new Map(existingEpisodes.map((ep) => [ep.id, ep]));

  console.log("Fetching RSS feed...");
  const feed = await parser.parseURL(RSS_URL);

  const incomingEpisodes = feed.items.map((item, index) =>
    normalizeEpisode(item, index),
  );

  const mergedEpisodes = [];
  const updatedIds = [];
  const newIds = [];
  const incomingIds = new Set();

  incomingEpisodes.forEach((incoming) => {
    incomingIds.add(incoming.id);
    const existing = existingById.get(incoming.id);
    const merged = mergeEpisode(incoming, existing);
    mergedEpisodes.push(merged);

    if (!existing) {
      newIds.push(incoming.id);
      updatedIds.push(incoming.id);
    } else if (isEpisodeChanged(existing, merged)) {
      updatedIds.push(incoming.id);
    }
  });

  // Preserve episodes that may no longer appear in feed to avoid data loss
  const orphaned = existingEpisodes.filter((ep) => !incomingIds.has(ep.id));
  if (orphaned.length) {
    mergedEpisodes.push(...orphaned);
  }

  writeEpisodes(mergedEpisodes);

  const episodesById = new Map(mergedEpisodes.map((ep) => [ep.id, ep]));
  let transcriptCount = 0;
  if (!options.skipTranscripts) {
    transcriptCount = ensureTranscriptFiles(episodesById, updatedIds);
  } else {
    console.log("Skip transcripts: --skip-transcripts enabled.");
  }

  console.log(`Episodes fetched: ${incomingEpisodes.length}`);
  console.log(`New episodes: ${newIds.length}`);
  console.log(`Updated episodes: ${updatedIds.length - newIds.length}`);
  console.log(`Transcript templates created: ${transcriptCount}`);

  runTagging(updatedIds, envStatus);
}

syncContent().catch((error) => {
  console.error("Failed to sync content:", error);
  process.exit(1);
});
