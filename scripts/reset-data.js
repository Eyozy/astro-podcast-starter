import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, "../src/data/episodes.json");
const THEMES_PATH = path.join(__dirname, "../src/data/themes.json");
const TRANSCRIPTS_DIR = path.join(__dirname, "../src/content/transcripts");
const RSS_CACHE_PATH = path.join(__dirname, "../.last-rss-url");

async function askUserConfirm(question) {
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

function resetData() {
  let deletedCount = 0;

  // 清空 episodes.json
  if (fs.existsSync(DATA_PATH)) {
    fs.unlinkSync(DATA_PATH);
    console.log("   ✓ 已删除 episodes.json");
    deletedCount++;
  }

  // 清空 themes.json
  if (fs.existsSync(THEMES_PATH)) {
    fs.unlinkSync(THEMES_PATH);
    console.log("   ✓ 已删除 themes.json");
    deletedCount++;
  }

  // 清空 RSS 缓存
  if (fs.existsSync(RSS_CACHE_PATH)) {
    fs.unlinkSync(RSS_CACHE_PATH);
    console.log("   ✓ 已删除 RSS 地址缓存");
    deletedCount++;
  }

  // 清空 transcripts 目录
  if (fs.existsSync(TRANSCRIPTS_DIR)) {
    const files = fs.readdirSync(TRANSCRIPTS_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    mdFiles.forEach((file) => {
      fs.unlinkSync(path.join(TRANSCRIPTS_DIR, file));
    });
    if (mdFiles.length > 0) {
      console.log(`   ✓ 已删除 ${mdFiles.length} 个文字稿文件`);
      deletedCount += mdFiles.length;
    }
  }

  return deletedCount;
}

async function main() {
  console.log("\n⚠️  此操作将清空以下数据：");
  console.log("   - src/data/episodes.json（节目元数据）");
  console.log("   - src/data/themes.json（主题分类）");
  console.log("   - src/content/transcripts/*.md（文字稿文件）");
  console.log("   - .last-rss-url（RSS 地址缓存）\n");

  const confirm = await askUserConfirm("确定要重置所有播客数据吗？[Y/n] ");

  if (!confirm) {
    console.log("\n已取消操作。\n");
    process.exit(0);
  }

  console.log("\n正在重置数据...");
  const count = resetData();

  if (count > 0) {
    console.log(`\n✅ 重置完成！共删除 ${count} 个文件。`);
    console.log("   现在可以运行 npm run sync 同步新的播客内容。\n");
  } else {
    console.log("\nℹ️  没有需要清理的数据。\n");
  }
}

main().catch((error) => {
  console.error("重置失败：", error);
  process.exit(1);
});
