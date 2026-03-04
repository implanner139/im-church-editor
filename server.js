const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Serve built frontend
app.use(express.static(path.join(__dirname, "dist")));

// Proxy: fetch Notion database (with confidential filter)
app.get("/api/notion-events", async (req, res) => {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;

  if (!token || !dbId) {
    return res.status(500).json({ error: "Notion 環境變數未設定" });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "公開活動（打勾）",
          checkbox: { equals: true }
        },
        sorts: [{ property: "Date", direction: "ascending" }]
      }),
    });

    const data = await response.json();

    if (!data.results) {
      return res.status(500).json({ error: "Notion 回應異常", detail: data });
    }

    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" })).toISOString().split("T")[0];

    // Format results, filter out expired events using end date if available
    const events = data.results.map(page => {
      const props = page.properties;
      const name = props["任務名稱"]?.title?.[0]?.plain_text || "（未命名）";
      const content = props["Content"]?.rich_text?.[0]?.plain_text || "";
      const dateStart = props["Date"]?.date?.start || "";
      const dateEnd = props["Date"]?.date?.end || "";
      const dept = props["部門"]?.multi_select?.map(s => s.name).join(", ") || "";

      // Use end date if available, otherwise start date
      const relevantDate = dateEnd ? dateEnd.split("T")[0] : dateStart.split("T")[0];

      // Skip if event has already ended
      if (relevantDate && relevantDate < today) return null;

      const dateDisplay = dateEnd ? `${dateStart} → ${dateEnd}` : dateStart;
      return `【${name}】${dateDisplay ? ` 日期：${dateDisplay}` : ""}${dept ? ` 部門：${dept}` : ""}${content ? `\n內容：${content}` : ""}`;
    }).filter(Boolean).join("\n\n");

    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fallback to index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
