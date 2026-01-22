import Parser from "rss-parser";
import site from "../../data/site.json";

export const prerender = false; // 标记为服务端渲染

const RSS_URL = site.podcast.rssUrl;

function resolveItunesImage(itunesImage: unknown): string {
  if (!itunesImage) return "";
  if (typeof itunesImage === "string") return itunesImage;
  if (typeof itunesImage === "object") {
    const image = itunesImage as { href?: string; $?: { href?: string } };
    return image.href || image.$?.href || "";
  }
  return "";
}

export async function GET() {
  try {
    const parser = new Parser({
      customFields: {
        item: [
          ["itunes:episode", "itunesEpisode"],
          ["itunes:duration", "itunesDuration"],
          ["itunes:image", "itunesImage", { keepArray: false }],
          ["content:encoded", "contentEncoded"],
        ],
      },
    });

    const feed = await parser.parseURL(RSS_URL);

    const episodes = feed.items.map((item, index) => {
      // 从 guid 提取 ID
      const guidMatch = item.guid?.match(/\/([a-f0-9]+)$/);
      const id = guidMatch ? guidMatch[1] : `ep-${index}`;

      // 兼容不同字段结构的封面图
      const image = resolveItunesImage(item.itunesImage);

      return {
        id,
        title: item.title || "",
        pubDate: item.pubDate || "",
        contentSnippet: item.contentSnippet || "",
        content: item.contentEncoded || item.content || "",
        enclosure: item.enclosure,
        itunes: {
          episode: item.itunesEpisode,
          duration: item.itunesDuration,
          image,
        },
        tags: [], // RSS 中没有 tags，保持空数组
      };
    });

    // 计算统计数据
    const yearCounts: Record<number, number> = {};
    episodes.forEach((ep) => {
      const year = new Date(ep.pubDate).getFullYear();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        episodes,
        stats: {
          total: episodes.length,
          yearCounts,
        },
        updatedAt: new Date().toISOString(),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // 缓存 5 分钟
        },
      },
    );
  } catch (error) {
    console.error("Error fetching RSS:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch RSS" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
