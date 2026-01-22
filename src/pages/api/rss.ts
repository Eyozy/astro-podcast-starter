import site from "../../data/site.json";

export const prerender = false; // 标记为服务端渲染

const RSS_URL = site.podcast.rssUrl;

export async function GET() {

  try {
    const response = await fetch(RSS_URL);
    const text = await response.text();

    return new Response(text, {
      headers: {
        "Content-Type": "application/xml",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response("Error fetching RSS", { status: 500 });
  }
}
