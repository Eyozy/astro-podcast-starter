import Parser from "rss-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { getRssUrl, loadSiteConfig } from "./site-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RSS_URL = getRssUrl();
const DATA_PATH = path.join(__dirname, "../src/data/episodes.json");
const TRANSCRIPTS_DIR = path.join(__dirname, "../src/content/transcripts");
const SITE_CONFIG = loadSiteConfig();
const TRANSCRIPT_PLACEHOLDER = SITE_CONFIG?.transcripts?.placeholderNotice;

if (!TRANSCRIPT_PLACEHOLDER) {
  throw new Error("Missing transcripts.placeholderNotice in site config.");
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
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
}

function writeEpisodes(episodes) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(episodes, null, 2));
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
  return {
    id: extractEpisodeId(item, index),
    title: item.title || "",
    link: item.link || "",
    pubDate: item.pubDate || "",
    content: item.content || "",
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

function runTagging(ids) {
  if (options.skipTag) {
    console.log("Skip tagging: --skip-tag enabled.");
    return;
  }
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("Skip tagging: OPENROUTER_API_KEY not set.");
    return;
  }
  if (ids.length === 0) {
    console.log("Skip tagging: no updated episodes.");
    return;
  }

  const tagScript = path.join(__dirname, "tag-episodes.js");
  const args = [tagScript, "--ids", ids.join(",")];
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function syncContent() {
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

  runTagging(updatedIds);
}

syncContent().catch((error) => {
  console.error("Failed to sync content:", error);
  process.exit(1);
});
