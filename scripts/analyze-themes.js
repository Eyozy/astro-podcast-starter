import { askAI, getActiveAiInfo } from "./ai-client.js";
import { isAiEnabled } from "./site-config.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EPISODES_FILE = path.join(__dirname, "../src/data/episodes.json");
const THEMES_FILE = path.join(__dirname, "../src/data/themes.json");

const SAMPLE_EPISODE_COUNT = 20;
const SAMPLE_SNIPPET_LENGTH = 500;

async function readEpisodes() {
  const episodesData = await fs.readFile(EPISODES_FILE, "utf-8");
  return JSON.parse(episodesData);
}

async function analyzeThemes() {
  // 检查 AI 功能是否启用
  if (!isAiEnabled()) {
    console.log("❌ AI 标签/主题功能未启用（features.aiTagging = false）");
    console.log("   如需使用此功能，请在 site.json 中设置 features.aiTagging: true");
    process.exit(1);
  }

  console.log("Reading episodes...");
  try {
    const episodes = await readEpisodes();

    const recentEpisodes = episodes.slice(0, SAMPLE_EPISODE_COUNT).map((ep) => ({
      title: ep.title,
      contentSnippet: ep.contentSnippet
        ? ep.contentSnippet.substring(0, SAMPLE_SNIPPET_LENGTH)
        : "",
    }));

    console.log(`Analyzing ${recentEpisodes.length} episodes...`);

    const step1Prompt = `分析以下播客内容的标题和摘要，生成 10-15 个核心标签。

      播客数据：
      ${JSON.stringify(recentEpisodes)}
      
      要求：
      1. 分析每期节目的主题、关键词、情感倾向
      2. 生成涵盖生活、职场、情感、自我成长、社会观察等维度的标签
      3. 标签应该是具体的、有代表性的中文词汇
      
      返回 JSON 格式：
      {
        "tags": ["标签 1", "标签 2", ...]
      }`;

    console.log("Step 1: Generating tags from episode content...");
    const aiInfo = getActiveAiInfo();
    console.log(`Provider: ${aiInfo.provider}`);
    console.log(`API URL: ${aiInfo.apiUrl}`);
    console.log(`Model: ${aiInfo.model}`);

    const tagsResult = await askAI(
      step1Prompt,
      "You are a content analyst for a Chinese podcast. Output valid JSON only.",
    );

    if (!tagsResult.tags || !Array.isArray(tagsResult.tags)) {
      throw new Error("Failed to generate tags from AI response");
    }

    console.log("Generated tags:", tagsResult.tags.join(", "));

    const step2Prompt = `基于以下标签，为播客生成 3-5 个主题分类：

      核心标签：
      ${JSON.stringify(tagsResult.tags)}
      
      播客内容示例：
      ${JSON.stringify(recentEpisodes.slice(0, 5))}
      
      要求：
      1. 每个主题需要有诗意的 2-4 字中文标题
      2. 一句话描述主题的核心内容
      3. 每个主题分配 3-5 个代表性标签
      4. 主题之间应该有明显的区分度
      
      返回 JSON 数组格式：
      [
        {
          "id": "themeId",
          "title": "中文标题",
          "description": "一句话描述",
          "representativeTags": ["标签 1", "标签 2"]
        }
      ]`;

    console.log("Step 2: Generating themes based on tags...");

    const themesResult = await askAI(
      step2Prompt,
      "You are a creative content strategist for a Chinese podcast. Output valid JSON only.",
    );

    let themes;
    if (Array.isArray(themesResult)) {
      themes = themesResult;
    } else if (themesResult.themes && Array.isArray(themesResult.themes)) {
      themes = themesResult.themes;
    } else {
      const values = Object.values(themesResult);
      const arrayValue = values.find((v) => Array.isArray(v));
      if (arrayValue) {
        themes = arrayValue;
      } else {
        throw new Error("AI did not return an array of themes");
      }
    }

    if (!Array.isArray(themes)) {
      throw new Error("Failed to extract themes array from AI response");
    }

    themes.forEach((theme) => {
      if (
        !theme.id ||
        !theme.title ||
        !theme.description ||
        !theme.representativeTags
      ) {
        throw new Error(`Invalid theme object: ${JSON.stringify(theme)}`);
      }
    });

    console.log("Themes generated:", themes.map((t) => t.title).join(", "));

    await fs.writeFile(THEMES_FILE, JSON.stringify(themes, null, 2));
    console.log(`Themes saved to ${THEMES_FILE}`);
  } catch (error) {
    console.error("Error analyzing themes:", error);
    process.exit(1);
  }
}

analyzeThemes();
