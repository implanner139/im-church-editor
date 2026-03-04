const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "dist")));

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
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
    return res.status(500).json({ error: "Notion 環境變數未設定" });
  }
  try {
    const events = await getNotionEvents();
    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/chat - for n8n integration
app.post("/api/chat", async (req, res) => {
  const { message, platform = "Facebook" } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  const notionEvents = await getNotionEvents();

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

【教會基本資訊】
地址：台北市信義區松德路171號B1
電話：02-2769-0177
官網：https://www.im-church.org
主日崇拜：每週日 10:00–11:30
兒童主日學：幼幼班(1-3歲)、幼兒班(3-6歲)、國小班(6-12歲)、青少年(12-17歲)
禱告會：每月第1、第3週 週三 20:00–21:00

【常見問題】
Q：沒有信仰可以來嗎？A：當然歡迎！iM 對所有人開放。
Q：第一次去要準備什麼？A：什麼都不需要，穿著舒適來就好！
Q：如何加入？A：填寫官網加入表單，或主日後找同工聊聊！
Q：有兒童/青少年聚會嗎？A：有！每週日 10:00 同步進行。
Q：如何報名受洗？A：請至官網報名或私訊我們。
Q：錯過主日信息？A：官網有文字版，YouTube 也可以觀看！
Q：奉獻收據何時寄出？A：114年度收據將於三月底-四月初寄出，有問題請週二~週五 10:00-18:00 來電 2769-0177 找會計小姐。
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
