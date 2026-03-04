import { useState, useRef, useEffect } from "react";

const PLATFORMS = ["Facebook 粉專", "Instagram"];
const SCENARIOS = ["貼文留言", "私訊 (DM)", "活動報名詢問", "代禱需求", "初訪者詢問"];

const iMPersona = `你是 iM行動教會 的社群小編，代表教會在 Facebook 粉專和 Instagram 上與會友及訪客互動。

【身份與語氣】
- 你是一位有信仰、有愛心的基督徒，語氣溫暖、真誠、親切
- 說話自然像朋友，帶有 iM 的品牌感：年輕、有活力、有深度
- iM 的精神是「探索世界、擴張神國、沒有極限」
- 適時使用 1-2 個溫暖的 emoji（如 🙏✨💛），不要過多

【回覆原則】
- 對初次接觸教會的人：熱情歡迎，讓人感到被接納，鼓勵他們來主日看看
- 對會友的提問：親切回答，若不確定請說「我幫你確認一下，稍後回覆你！」
- 對代禱需求：以溫柔同理的態度回應，表達願意為對方禱告
- 對負面或敏感訊息：不爭辯，以愛心回應，必要時請對方私訊或直接聯繫教會
- 回覆長度：留言 30-60 字，私訊可稍長至 80-120 字

【避免事項】
- 不主動評論政治或社會爭議議題
- 不說「非常抱歉造成您的不便」等過度商業化語句
- 不對信仰問題給出教條答案，鼓勵對方親身來了解`;

const iMKnowledge = `【教會基本資訊】
教會名稱：iM行動教會
地址：台北市信義區松德路171號B1
電話：02-2769-0177
官網：https://www.im-church.org
Facebook：https://www.facebook.com/iMChurch
Instagram：https://www.instagram.com/imchurch/
YouTube：https://www.youtube.com/@im.church

【教會異象】
iM被呼召前往一般人不願、不敢、不想去的地方與族群，在那裡作光作鹽，擴張神國。核心精神：「探索世界、擴張神國、沒有極限！」

【主日崇拜】
時間：每週日 10:00–11:30
地點：台北市信義區松德路171號B1
兒童主日學（同時段）：幼幼班1-3歲／幼兒班3-6歲／國小班6-12歲／青少年12-17歲

【其他定期聚會】
禱告會：每月第1、第3週 週三 20:00–21:00
豐盛生命課程：iM門徒必修課，分四單元

【常見問題 Q&A】
Q：我沒有信仰，可以來嗎？
A：當然歡迎！iM 對所有人開放，不需要任何宗教背景，輕鬆來坐坐就好 😊

Q：第一次去教會要準備什麼？
A：什麼都不需要帶，穿著舒適來就好！到了會有人陪你的 💛

Q：如何加入 iM？
A：可以填寫官網的加入表單，或主日後直接找同工聊聊！

Q：有沒有兒童/青少年的聚會？
A：有！每週日 10:00 同步進行，從幼幼班到青少年都有！

Q：如何報名受洗？
A：請至官網報名，或私訊我們，我們會提供最新場次 🙏

Q：錯過主日信息怎麼辦？
A：官網有整理文字版信息精華，YouTube 頻道也可以觀看！`;

export default function App() {
  const [activeTab, setActiveTab] = useState("test");
  const [persona, setPersona] = useState(iMPersona);
  const [knowledge, setKnowledge] = useState(iMKnowledge);
  const [notionEvents, setNotionEvents] = useState("");
  const [loadingNotion, setLoadingNotion] = useState(false);
  const [notionStatus, setNotionStatus] = useState(null);
  const [platform, setPlatform] = useState("Facebook 粉專");
  const [scenario, setScenario] = useState("貼文留言");
  const [userMessage, setUserMessage] = useState("");
  const [postContext, setPostContext] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Auto-load Notion on mount
  useEffect(() => {
    fetchNotionEvents();
  }, []);

  const fetchNotionEvents = async () => {
    setLoadingNotion(true);
    setNotionStatus(null);
    try {
      const res = await fetch("/api/notion-events");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNotionEvents(data.events);
      setNotionStatus({ ok: true, msg: `✅ 已從 Notion 載入 ${data.events.split("【").length - 1} 筆公開活動` });
    } catch (e) {
      setNotionStatus({ ok: false, msg: `⚠️ Notion 載入失敗：${e.message}` });
    }
    setLoadingNotion(false);
  };

  const buildSystemPrompt = () => `${persona}

【知識庫】
${knowledge}
${notionEvents ? `\n【近期活動（自動從 Notion 載入，已過濾非公開）】\n${notionEvents}` : ""}

【當前情境】
平台：${platform}
類型：${scenario}
${postContext ? `貼文/脈絡內容：${postContext}` : ""}

請根據以上設定，以小編身份自然地回覆粉絲的訊息。只輸出回覆內容本身，不需要加說明或前言。`;

  const sendMessage = async () => {
    if (!userMessage.trim() || loading) return;
    const msg = userMessage.trim();
    setUserMessage("");
    setChatHistory(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const messages = [
        ...chatHistory.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: msg }
      ];
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.content?.[0]?.text || "（回覆失敗，請重試）";
      setChatHistory(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: "assistant", content: `⚠️ 錯誤：${e.message}` }]);
    }
    setLoading(false);
  };

  const tabs = [
    { id: "test", label: "模擬測試", icon: "💬" },
    { id: "persona", label: "小編人設", icon: "🎭" },
    { id: "knowledge", label: "知識庫", icon: "📖" },
  ];

  const S = {
    page: { minHeight: "100vh", background: "#0f0e17", fontFamily: "'Noto Sans TC', 'PingFang TC', sans-serif", color: "#e8e4d8" },
    header: { borderBottom: "1px solid #2a2840", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(90deg, #13122a, #1a1830)" },
    tabBar: { display: "flex", borderBottom: "1px solid #2a2840", background: "#13122a", padding: "0 24px" },
    content: { maxWidth: 800, margin: "0 auto", padding: "24px 20px" },
    textarea: { width: "100%", padding: 16, background: "#1a1830", border: "1px solid #2a2840", borderRadius: 12, color: "#e8e4d8", fontSize: 13, lineHeight: 1.8, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
    input: { width: "100%", padding: "10px 14px", borderRadius: 8, background: "#1a1830", border: "1px solid #2a2840", color: "#e8e4d8", fontSize: 13, outline: "none", boxSizing: "border-box" },
    btn: { padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #ff6b6b, #ffa94d)", color: "#fff", fontWeight: 700, fontSize: 13 },
    card: { background: "#1a1830", border: "1px solid #2a2840", borderRadius: 12, padding: "16px 20px", marginBottom: 12 },
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #ff6b6b, #ffa94d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>iM</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>iM行動教會 · AI 小編系統</div>
            <div style={{ fontSize: 10, color: "#7c7a99", letterSpacing: 1 }}>CHURCH SOCIAL MEDIA AUTO-REPLY</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {notionStatus && (
            <span style={{ fontSize: 11, color: notionStatus.ok ? "#22c55e" : "#f59e0b" }}>{notionStatus.msg}</span>
          )}
          <button onClick={fetchNotionEvents} disabled={loadingNotion} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #2a2840", background: "transparent", color: "#7c7a99", fontSize: 11, cursor: "pointer" }}>
            {loadingNotion ? "載入中..." : "🔄 更新活動"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "14px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === t.id ? "#ff9a62" : "#5a5870", borderBottom: activeTab === t.id ? "2px solid #ff9a62" : "2px solid transparent", fontSize: 13, fontWeight: activeTab === t.id ? 700 : 400, display: "flex", alignItems: "center", gap: 6 }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div style={S.content}>

        {/* 模擬測試 */}
        {activeTab === "test" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 4 }}>💬 模擬回覆測試</div>
              <div style={{ fontSize: 12, color: "#7c7a99" }}>輸入粉絲的留言或私訊，看看 AI 小編怎麼回 ✨</div>
            </div>

            {/* Notion status bar */}
            {notionEvents && (
              <div style={{ padding: "8px 14px", background: "#22c55e15", border: "1px solid #22c55e25", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#22c55e" }}>
                🗓 已載入 Notion 活動資訊，AI 小編可回答近期活動問題
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
              {[{ label: "平台", value: platform, opts: PLATFORMS, set: setPlatform }, { label: "情境", value: scenario, opts: SCENARIOS, set: setScenario }].map(({ label, value, opts, set }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#7c7a99" }}>{label}：</span>
                  <select value={value} onChange={e => set(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, background: "#1a1830", border: "1px solid #2a2840", color: "#e8e4d8", fontSize: 12, outline: "none" }}>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <input placeholder="（選填）貼文內容或上下文說明..." value={postContext} onChange={e => setPostContext(e.target.value)} style={{ ...S.input, marginBottom: 10 }} />

            <div style={{ background: "#13122a", border: "1px solid #2a2840", borderRadius: 12, minHeight: 260, maxHeight: 360, overflowY: "auto", padding: 16, marginBottom: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {chatHistory.length === 0 && (
                <div style={{ textAlign: "center", color: "#3a3858", paddingTop: 70 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🙏</div>
                  <div style={{ fontSize: 13 }}>輸入粉絲留言，測試 AI 小編的回覆</div>
                  <div style={{ fontSize: 11, marginTop: 6, color: "#2a2840" }}>例：「請問這週有什麼活動？」</div>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  {msg.role === "assistant" && (
                    <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #ff6b6b, #ffa94d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", marginRight: 8 }}>iM</div>
                  )}
                  <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.7, background: msg.role === "user" ? "#ff6b6b18" : "#1a1830", border: `1px solid ${msg.role === "user" ? "#ff6b6b25" : "#2a2840"}`, color: "#e8e4d8" }}>
                    {msg.role === "assistant" && <div style={{ fontSize: 10, color: "#ff9a62", marginBottom: 4, fontWeight: 600 }}>AI 小編 · {platform} {scenario}</div>}
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #ff6b6b, #ffa94d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>iM</div>
                  <div style={{ padding: "10px 14px", background: "#1a1830", border: "1px solid #2a2840", borderRadius: 12, display: "flex", gap: 5 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff9a62", animation: `bounce 1.2s ${i*0.2}s infinite` }}/>)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="輸入粉絲的留言或私訊..." value={userMessage} onChange={e => setUserMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()}
                style={{ flex: 1, padding: "12px 14px", borderRadius: 10, background: "#1a1830", border: "1px solid #2a2840", color: "#e8e4d8", fontSize: 13, outline: "none" }} />
              <button onClick={sendMessage} disabled={loading || !userMessage.trim()} style={{ ...S.btn, opacity: !userMessage.trim() ? 0.5 : 1 }}>送出</button>
              <button onClick={() => setChatHistory([])} style={{ padding: "12px 12px", borderRadius: 10, cursor: "pointer", background: "transparent", border: "1px solid #2a2840", color: "#7c7a99", fontSize: 12 }}>清空</button>
            </div>
          </div>
        )}

        {/* 人設 */}
        {activeTab === "persona" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 4 }}>🎭 小編人設設定</div>
              <div style={{ fontSize: 12, color: "#7c7a99" }}>定義 AI 小編的個性、口吻與回覆原則。</div>
            </div>
            <textarea value={persona} onChange={e => setPersona(e.target.value)} style={{ ...S.textarea, minHeight: 380 }} />
            <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{ ...S.btn, marginTop: 12, background: saved ? "#22c55e" : "linear-gradient(135deg, #ff6b6b, #ffa94d)" }}>
              {saved ? "✓ 已儲存" : "儲存人設"}
            </button>
          </div>
        )}

        {/* 知識庫 */}
        {activeTab === "knowledge" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 4 }}>📖 知識庫管理</div>
              <div style={{ fontSize: 12, color: "#7c7a99" }}>教會基本資訊與 Q&A。近期活動會自動從 Notion 載入。</div>
            </div>

            {/* Notion status */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8 }}>🔗 Notion 活動資料庫</div>
              {notionStatus ? (
                <div style={{ fontSize: 12, color: notionStatus.ok ? "#22c55e" : "#f59e0b", marginBottom: 10 }}>{notionStatus.msg}</div>
              ) : (
                <div style={{ fontSize: 12, color: "#7c7a99", marginBottom: 10 }}>載入中...</div>
              )}
              {notionEvents && (
                <div style={{ background: "#0f0e17", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#9998b8", lineHeight: 1.7, maxHeight: 160, overflowY: "auto", marginBottom: 10 }}>
                  {notionEvents}
                </div>
              )}
              <button onClick={fetchNotionEvents} disabled={loadingNotion} style={{ ...S.btn, padding: "7px 16px", fontSize: 12 }}>
                {loadingNotion ? "載入中..." : "🔄 重新載入"}
              </button>
              <div style={{ marginTop: 10, fontSize: 11, color: "#5a5870", lineHeight: 1.7 }}>
                💡 「非公開活動（打勾）」的項目會自動略過，不會讓 AI 小編知道。
              </div>
            </div>

            <textarea value={knowledge} onChange={e => setKnowledge(e.target.value)} style={{ ...S.textarea, minHeight: 340 }} />
            <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{ ...S.btn, marginTop: 12, background: saved ? "#22c55e" : "linear-gradient(135deg, #ff6b6b, #ffa94d)" }}>
              {saved ? "✓ 已儲存" : "儲存知識庫"}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        select:focus, input:focus, textarea:focus { border-color: #ff9a62 !important; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:#1a1830} ::-webkit-scrollbar-thumb{background:#2a2840;border-radius:3px}
      `}</style>
    </div>
  );
}
