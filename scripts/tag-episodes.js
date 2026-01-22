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

const DEFAULT_LIMIT = 5;
const MAX_CONTENT_CHARS = 800;
const REQUEST_DELAY_MS = 1500;

const { limit, ids } = parseArgs(process.argv.slice(2));

function parseArgs(args) {
  const parsed = {
    limit: DEFAULT_LIMIT,
    ids: [],
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" && args[i + 1]) {
      parsed.limit = parseInt(args[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === "--ids" && args[i + 1]) {
      parsed.ids = args[i + 1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (/^\\d+$/.test(arg)) {
      parsed.limit = parseInt(arg, 10);
    }
  }

  return parsed;
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`${label} file not found: ${filePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function writeEpisodes(episodes) {
  fs.writeFileSync(EPISODES_PATH, JSON.stringify(episodes, null, 2));
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
    const trimmed = String(rawTag).trim();
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

  return tags.length >= minCount ? tags : tags.slice(0, Math.max(minCount, 1));
}

function truncateContent(content) {
  if (!content) return "";
  if (content.length <= MAX_CONTENT_CHARS) return content;
  return `${content.substring(0, MAX_CONTENT_CHARS)}...`;
}

function getUntaggedEpisodes(episodes, validThemeIds) {
  return episodes.filter((episode) => {
    const hasValidTheme = episode.themeId && validThemeIds.has(episode.themeId);
    const hasTags =
      episode.tags && Array.isArray(episode.tags) && episode.tags.length > 0;
    return !hasValidTheme || !hasTags;
  });
}

function buildPrompt(episode, themes, allowedTags) {
  const content = episode.contentSnippet || episode.content || "";
  const truncatedContent = truncateContent(content);

  return `
I need to classify a podcast episode into one of the following themes:

${themes
  .map(
    (t) => `- ID: ${t.id}\n  Title: ${t.title}\n  Description: ${t.description}`,
  )
  .join("\n")}

Episode Title: ${episode.title}
Episode Content: ${truncatedContent}

Task:
1. Select exactly ONE theme ID from the list above that best fits this episode.
2. Select 2-3 relevant tags (keywords) for this episode in Simplified Chinese.
3. Tags MUST be selected only from the allowed list below. Do not invent new tags.

Allowed Tags:
${Array.from(allowedTags)
  .map((tag) => `- ${tag}`)
  .join("\n")}

Return JSON:
{
  "themeId": "theme_id_here",
  "tags": ["tag1", "tag2", "tag3"]
}
`;
}

async function tagEpisodes() {
  const themes = readJson(THEMES_PATH, "Themes");
  const taxonomy = readJson(TAG_TAXONOMY_PATH, "Tag taxonomy");
  const episodes = readJson(EPISODES_PATH, "Episodes");

  const allowedTags = new Set(Array.isArray(taxonomy.tags) ? taxonomy.tags : []);
  const tagAliases =
    taxonomy.aliases && typeof taxonomy.aliases === "object"
      ? taxonomy.aliases
      : {};

  if (allowedTags.size === 0) {
    console.error("Tag taxonomy is empty. Please provide a non-empty tags list.");
    process.exit(1);
  }

  const validThemeIds = new Set(themes.map((t) => t.id));
  let episodesToProcess = [];

  if (ids.length > 0) {
    const selectedIds = new Set(ids);
    episodesToProcess = episodes.filter((episode) =>
      selectedIds.has(episode.id),
    );
    if (episodesToProcess.length === 0) {
      console.log("No matching episodes found for provided ids.");
      return;
    }
    console.log(`Processing ${episodesToProcess.length} selected episodes...`);
  } else {
    // Find episodes that don't have tags OR don't have a valid themeId
    const untaggedEpisodes = getUntaggedEpisodes(episodes, validThemeIds);
    console.log(`Found ${untaggedEpisodes.length} untagged episodes.`);

    if (untaggedEpisodes.length === 0) {
      console.log("All episodes are tagged!");
      return;
    }

    episodesToProcess = untaggedEpisodes.slice(0, limit);
    console.log(`Processing batch of ${episodesToProcess.length} episodes...`);
  }

  let updatedCount = 0;

  for (const episode of episodesToProcess) {
    console.log(`Tagging [${episode.id}]: ${episode.title}...`);

    const prompt = buildPrompt(episode, themes, allowedTags);

    try {
      const result = await askAI(
        prompt,
        "You are a content classifier for a Chinese podcast. Output valid JSON only.",
        { temperature: 0.2 },
      );

      if (result && result.themeId && result.tags) {
        // Validation: Check if themeId exists
        const matchedTheme = themes.find((t) => t.id === result.themeId);

        if (matchedTheme) {
          // Find the episode in the main array to update it
          const index = episodes.findIndex((e) => e.id === episode.id);
          if (index !== -1) {
            episodes[index].themeId = result.themeId;
            const normalizedTags = normalizeTags(
              result.tags,
              tagAliases,
              allowedTags,
            );
            const fallbackTags = normalizeTags(
              matchedTheme.representativeTags,
              tagAliases,
              allowedTags,
            );
            const finalTags = fillTags(normalizedTags, fallbackTags, 2, 3);
            episodes[index].tags = finalTags;
            updatedCount++;
            console.log(`  -> Theme: ${matchedTheme.title} (${result.themeId})`);
            console.log(`  -> Tags: ${finalTags.join(", ")}`);

            // Save after every successful update to be safe
            writeEpisodes(episodes);
          }
        } else {
          console.warn(
            `  Warning: AI returned invalid themeId '${result.themeId}'. Skipping assignment.`,
          );
        }
      } else {
        console.warn("  Invalid response format from AI");
      }
    } catch (error) {
      console.error(`  Failed to tag ${episode.title}:`, error.message);
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  console.log(`Finished processing. Updated ${updatedCount} episodes.`);
}

tagEpisodes().catch((error) => {
  console.error(error);
  process.exit(1);
});
