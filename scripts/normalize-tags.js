import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../src/data");
const EPISODES_PATH = path.join(DATA_DIR, "episodes.json");
const THEMES_PATH = path.join(DATA_DIR, "themes.json");
const TAG_TAXONOMY_PATH = path.join(DATA_DIR, "tag-taxonomy.json");

const MIN_TAGS = 2;
const MAX_TAGS = 3;

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

function fillTags(primaryTags, fallbackTags, minCount, maxCount) {
  const tags = [...primaryTags];
  for (const tag of fallbackTags) {
    if (tags.length >= maxCount) {
      break;
    }
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  if (tags.length > maxCount) {
    return tags.slice(0, maxCount);
  }

  return tags;
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function normalizeAllTags() {
  const episodes = readJson(EPISODES_PATH, "Episodes");
  const themes = readJson(THEMES_PATH, "Themes");
  const taxonomy = readJson(TAG_TAXONOMY_PATH, "Tag taxonomy");

  const allowedTags = new Set(Array.isArray(taxonomy.tags) ? taxonomy.tags : []);
  const tagAliases =
    taxonomy.aliases && typeof taxonomy.aliases === "object"
      ? taxonomy.aliases
      : {};
  const themeMap = new Map(themes.map((theme) => [theme.id, theme]));

  if (allowedTags.size === 0) {
    console.error("Tag taxonomy is empty.");
    process.exit(1);
  }

  let changedCount = 0;
  let emptyCount = 0;
  let underMinCount = 0;
  let missingThemeCount = 0;
  let totalDropped = 0;

  const updatedEpisodes = episodes.map((episode) => {
    const rawTags = Array.isArray(episode.tags) ? episode.tags : [];
    const normalizedTags = normalizeTags(rawTags, tagAliases, allowedTags);
    totalDropped += Math.max(0, rawTags.length - normalizedTags.length);

    const theme = episode.themeId ? themeMap.get(episode.themeId) : null;
    if (episode.themeId && !theme) {
      missingThemeCount += 1;
    }
    const fallbackTags = theme
      ? normalizeTags(theme.representativeTags, tagAliases, allowedTags)
      : [];
    const finalTags = fillTags(normalizedTags, fallbackTags, MIN_TAGS, MAX_TAGS);

    if (!arraysEqual(rawTags, finalTags)) {
      changedCount += 1;
    }
    if (finalTags.length === 0) {
      emptyCount += 1;
    }
    if (finalTags.length > 0 && finalTags.length < MIN_TAGS) {
      underMinCount += 1;
    }

    return {
      ...episode,
      tags: finalTags,
    };
  });

  fs.writeFileSync(EPISODES_PATH, JSON.stringify(updatedEpisodes, null, 2));

  console.log("Normalization complete.");
  console.log(`Episodes updated: ${changedCount}`);
  console.log(`Episodes with empty tags: ${emptyCount}`);
  console.log(`Episodes with < ${MIN_TAGS} tags: ${underMinCount}`);
  console.log(`Episodes with missing themeId: ${missingThemeCount}`);
  console.log(`Dropped tag entries: ${totalDropped}`);
}

normalizeAllTags();
