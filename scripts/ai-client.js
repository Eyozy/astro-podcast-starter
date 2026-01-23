import "dotenv/config";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL =
  process.env.DEEPSEEK_API_URL ||
  "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

export { DEEPSEEK_API_KEY, DEEPSEEK_API_URL, DEEPSEEK_MODEL };

/**
 * Sends a prompt to the AI and expects a JSON response.
 * @param {string} prompt - The user prompt.
 * @param {string} [systemPrompt="You are a helpful assistant."] - The system prompt.
 * @returns {Promise<Object>} - The parsed JSON response.
 */
export async function askAI(
  prompt,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  options = {},
) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is missing in .env");
  }

  const { timeoutMs = 30000, temperature = 0.7 } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 统一封装请求体，便于调试/日志追踪
    const payload = {
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    };

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API Error: ${response.status} - ${text}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No content received from AI");
    }

    const content = data.choices[0].message.content;

    try {
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse JSON response:", content);
      throw new Error(`Failed to parse JSON response: ${e.message}`);
    }
  } catch (error) {
    console.error("Error in askAI:", error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
