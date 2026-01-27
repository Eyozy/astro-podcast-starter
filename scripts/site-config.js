import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模板用户只需修改 src/data/site.json，无需改动脚本代码。
const SITE_CONFIG_PATH = path.join(__dirname, "../src/data/site.json");

export function loadSiteConfig() {
  if (!fs.existsSync(SITE_CONFIG_PATH)) {
    throw new Error(`Site config not found: ${SITE_CONFIG_PATH}`);
  }
  const raw = fs.readFileSync(SITE_CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

export function getRssUrl() {
  const config = loadSiteConfig();
  if (!config?.podcast?.rssUrl) {
    throw new Error("Missing podcast.rssUrl in site config.");
  }
  return config.podcast.rssUrl;
}

/**
 * 检查 AI 标签/主题功能是否启用
 * @returns {boolean} 是否启用 AI 功能
 */
export function isAiEnabled() {
  const config = loadSiteConfig();
  return config?.features?.aiTagging === true;
}
