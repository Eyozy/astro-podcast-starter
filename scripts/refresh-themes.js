import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { askAI } from "./ai-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../src/data");
const EPISODES_PATH = path.join(DATA_DIR, "episodes.json");
const THEMES_PATH = path.join(DATA_DIR, "themes.json");
const TAG_TAXONOMY_PATH = path.join(DATA_DIR, "tag-taxonomy.json");

const MAX_EPISODES_PER_THEME = 5;
const MAX_SNIPPET_LENGTH = 200;
const PROMPT_TIMEOUT_MS = 60000;

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`${label} file not found.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function normalizeTags(rawTags, aliases, allowedTags) {
  if (!Array.isArray(rawTags)) {
    return [];
  }

  const normalized = [];
  for (const rawTag of rawTags) {
    if (rawTag === null || rawTag === undefined) {
      continue;
    }
    const trimmed = String(rawTag).trim().replace(/^#/, "");
    if (!trimmed) {
      continue;
    }
    const mapped = aliases[trimmed] || trimmed;
    if (!allowedTags.has(mapped)) {
      continue;
    }
    if (!normalized.includes(mapped)) {
      normalized.push(mapped);
    }
  }
  return normalized;
}

function getThemeEpisodes(episodes, themeId) {
  const matched = episodes.filter((ep) => ep.themeId === themeId);
  return matched.slice(0, MAX_EPISODES_PER_THEME).map((ep) => ({
    title: ep.title,
    contentSnippet: (ep.contentSnippet || ep.content || "").slice(
      0,
      MAX_SNIPPET_LENGTH,
    ),
  }));
}

function buildTagFrequency(episodes, aliases, allowedTags) {
  const counts = new Map();
  for (const ep of episodes) {
    const normalized = normalizeTags(ep.tags || [], aliases, allowedTags);
    for (const tag of normalized) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return counts;
}

function pickTopTags(freqMap, limit) {
  return Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans"))
    .slice(0, limit)
    .map(([tag]) => tag);
}

async function refreshThemes() {
  const episodes = readJson(EPISODES_PATH, "Episodes");
  const themes = readJson(THEMES_PATH, "Themes");
  const taxonomy = readJson(TAG_TAXONOMY_PATH, "Tag taxonomy");

  const allowedTags = new Set(Array.isArray(taxonomy.tags) ? taxonomy.tags : []);
  const tagAliases =
    taxonomy.aliases && typeof taxonomy.aliases === "object"
      ? taxonomy.aliases
      : {};
  if (allowedTags.size === 0) {
    console.error("Tag taxonomy is empty.");
    process.exit(1);
  }

  const updatedThemes = [];

  for (const theme of themes) {
    console.log(`Refreshing theme ${theme.id}...`);
    const themeEpisodes = episodes.filter((ep) => ep.themeId === theme.id);
    if (themeEpisodes.length === 0) {
      updatedThemes.push(theme);
      continue;
    }

    const sampleEpisodes = getThemeEpisodes(episodes, theme.id);
    const frequency = buildTagFrequency(themeEpisodes, tagAliases, allowedTags);
    const fallbackTags = pickTopTags(frequency, 5);

    const prompt = `你是播客内容策划，请基于以下主题与节目样本，更新主题标题与描述，并给出代表性标签。

现有主题：
ID: ${theme.id}
Title: ${theme.title}
Description: ${theme.description}

节目样本（标题 + 摘要）：
${JSON.stringify(sampleEpisodes)}

要求：
1. 主题标题保持 2-4 个汉字，简洁、诗意。
2. 描述为一句话，聚焦该主题的核心内容。
3. representativeTags 选择 3-5 个中文标签，只能从“允许标签”中挑选，不要发明新词。

允许标签：
${Array.from(allowedTags)
  .map((tag) => `- ${tag}`)
  .join("\n")}

返回 JSON：
{
  "title": "新标题",
  "description": "一句话描述",
  "representativeTags": ["标签 1", "标签 2", "标签 3"]
}`;

    try {
      const result = await askAI(
        prompt,
        "You are a content strategist for a Chinese podcast. Output valid JSON only.",
        { temperature: 0.4, timeoutMs: PROMPT_TIMEOUT_MS },
      );

      const normalizedTags = normalizeTags(
        result?.representativeTags || [],
        tagAliases,
        allowedTags,
      );
      const finalTags =
        normalizedTags.length >= 3
          ? normalizedTags.slice(0, 5)
          : fallbackTags.slice(0, 5);

      updatedThemes.push({
        ...theme,
        title: result?.title || theme.title,
        description: result?.description || theme.description,
        representativeTags: finalTags,
      });
    } catch (error) {
      console.error(`Failed to refresh theme ${theme.id}:`, error.message);
      updatedThemes.push(theme);
    }
  }

  fs.writeFileSync(THEMES_PATH, JSON.stringify(updatedThemes, null, 2));
  console.log("Theme refresh complete.");
}

refreshThemes().catch((error) => {
  console.error(error);
  process.exit(1);
});
