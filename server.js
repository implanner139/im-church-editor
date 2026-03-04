const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "dist")));

const KNOWLEDGE_PAGE_ID = "30347bf610698082a40aecf4d280c117";

// Helper: fetch Notion knowledge base page content
async function getKnowledgeBase() {
  const token = process.env.NOTION_TOKEN;
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${KNOWLEDGE_PAGE_ID}/children?page_size=100`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      }
    });
    const data = await res.json();
    if (!data.results) return "";
    return data.results.map(block => {
      const type = block.type;
      const richText = block[type]?.rich_text || [];
      return richText.map(t => t.plain_text).join("");
    }).filter(Boolean).join("\n");
  } catch (e) {
    return "";
  }
}

// Helper: fetch Notion events
async function getNotionEvents() {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "公開活動（打勾）", checkbox: { equals: true } },
        sorts: [{ property: "Date", direction: "ascending" }]
      }),
    });
    const data = await response.json();
    if (!data.results) return "";
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" })).toISOString().split("T")[0];
    return data.results.map(page => {
      const props = page.properties;
      const name = props["任務名稱"]?.title?.[0]?.plain_text || "（未命名）";
      const content = (props["Content"]?.rich_text || []).map(t => t.plain_text).join("") || "";
      const dateStart = props["Date"]?.date?.start || "";
      const dateEnd = props["Date"]?.date?.end || "";
      const dept = props["部門"]?.multi_select?.map(s => s.name).join(", ") || "";
      const relevantDate = dateEnd ? dateEnd.split("T")[0] : dateStart.split("T")[0];
      if (relevantDate && relevantDate < today) return null;
      const dateDisplay = dateEnd ? `${dateStart} → ${dateEnd}` : dateStart;
      return `【${name}】${dateDisplay ? ` 日期：${dateDisplay}` : ""}${dept ? ` 部門：${dept}` : ""}${content ? `\n內容：${content}` : ""}`;
    }).filter(Boolean).join("\n\n");
  } catch (e) {
    return "";
  }
}

// GET /api/notion-events
app.get("/api/notion-events", async (req, res) => {
  try {
    const events = await getNotionEvents();
    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/knowledge - for frontend to display
app.get("/api/knowledge", async (req, res) => {
  try {
    const knowledge = await getKnowledgeBase();
    res.json({ knowledge });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/chat - for n8n integration
app.post("/api/chat", async (req, res) => {
  const { message, platform = "Facebook" } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  const [notionEvents, knowledge] = await Promise.all([
    getNotionEvents(),
    getKnowledgeBase()
  ]);

  const systemPrompt = `你是 iM行動教會 的社群小編，代表教會在 ${platform} 上與會友及訪客互動。

【身份與語氣】
- 語氣溫暖、真誠、親切，說話自然像朋友
- iM 的精神是「探索世界、擴張神國、沒有極限」
- 適時使用 1-2 個溫暖的 emoji（如 🙏✨💛）

【回覆原則】
- 對初次接觸教會的人：熱情歡迎，讓人感到被接納
- 對代禱需求：以溫柔同理的態度回應
- 涉及具體時間、地點、費用、報名等細節若不確定：請說「這個問題我幫你確認一下，稍後由同工回覆你！🙏」
- 回覆長度：50-80 字
- 每則回覆結尾換行後加上：— iM AI 小編 · 有任何疑問，同工隨時在 🙏

【知識庫】
${knowledge}
${notionEvents ? `\n【近期公開活動】\n${notionEvents}` : ""}`;

  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.VITE_ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: message }]
      })
    });
    const claudeData = await claudeRes.json();
    if (claudeData.error) throw new Error(claudeData.error.message);
    const reply = claudeData.content?.[0]?.text || "";
    const needsHumanFollowUp = reply.includes("稍後由同工回覆");
    res.json({ reply, needsHumanFollowUp });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
