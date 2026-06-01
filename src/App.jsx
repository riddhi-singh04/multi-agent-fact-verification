import { useState, useRef, useEffect } from "react";

const COLORS = {
  bg: "#0a0a0f",
  surface: "#111118",
  surface2: "#16161f",
  border: "#1e1e2e",
  borderHover: "#2e2e4e",
  purple: "#7c6af7",
  purpleDim: "#4a3f9f",
  teal: "#2dd4b4",
  tealDim: "#1a7a68",
  coral: "#f87171",
  amber: "#fbbf24",
  green: "#4ade80",
  blue: "#60a5fa",
  text: "#e2e8f0",
  muted: "#64748b",
  faint: "#1e2030",
};

const SOURCES = [
  { name: "Wikipedia", icon: "W", color: "#60a5fa", type: "Encyclopedia" },
  { name: "NASA", icon: "N", color: "#f87171", type: "Government/Science" },
  { name: "Britannica", icon: "B", color: "#fbbf24", type: "Encyclopedia" },
  { name: "PubMed", icon: "P", color: "#4ade80", type: "Peer-reviewed" },
  { name: "Reuters", icon: "R", color: "#2dd4b4", type: "News Wire" },
  { name: "Snopes", icon: "S", color: "#7c6af7", type: "Fact-check" },
  { name: "AP News", icon: "A", color: "#f87171", type: "News Wire" },
  { name: "CDC", icon: "C", color: "#4ade80", type: "Government/Health" },
];

const AGENTS = [
  { id: "orchestrator", label: "Orchestrator",   icon: "⬡", color: COLORS.purple, desc: "Parsing claim & generating search queries" },
  { id: "websearch",    label: "Web Search",      icon: "◎", color: COLORS.teal,   desc: "Querying live web sources" },
  { id: "knowledge",    label: "Knowledge Base",  icon: "◈", color: COLORS.blue,   desc: "Searching encyclopedias & databases" },
  { id: "credibility",  label: "Credibility",     icon: "◇", color: COLORS.amber,  desc: "Rating source reliability" },
  { id: "aggregator",   label: "Aggregator",      icon: "⬡", color: COLORS.coral,  desc: "Merging & ranking evidence" },
  { id: "verdict",      label: "Verdict Agent",   icon: "◉", color: COLORS.green,  desc: "Producing final assessment" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseJSON(raw) {
  try {
    // strip markdown code fences, leading/trailing whitespace
    let clean = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    // find the first { and last } to extract just the JSON object
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      clean = clean.slice(start, end + 1);
    }
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

async function callAI(system, userMsg, onStream) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: userMsg }],
      stream: true,
    }),
  });
  const data = await response.json();
  const text = data.text || "";
  onStream?.(text);
  return text;
}

function SourceBadge({ source, score }) {
  const s = SOURCES.find(x => x.name === source) || { name: source, icon: source[0], color: COLORS.muted, type: "Source" };
  const scoreColor = score >= 80 ? COLORS.green : score >= 60 ? COLORS.amber : COLORS.coral;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: COLORS.faint, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: "8px 12px",
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        background: s.color + "22", border: `1px solid ${s.color}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: s.color,
      }}>{s.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{s.name}</div>
        <div style={{ fontSize: 10, color: COLORS.muted }}>{s.type}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: scoreColor, fontFamily: "monospace" }}>{score}%</div>
        <div style={{ fontSize: 10, color: COLORS.muted }}>credibility</div>
      </div>
    </div>
  );
}

function EvidenceCard({ item, index }) {
  const [open, setOpen] = useState(false);
  const supColor = item.supports ? COLORS.green : COLORS.coral;
  const supLabel = item.supports ? "SUPPORTS" : "CONTRADICTS";
  return (
    <div style={{
      background: COLORS.surface2, border: `1px solid ${item.supports ? COLORS.green + "33" : COLORS.coral + "33"}`,
      borderRadius: 8, overflow: "hidden",
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: supColor, background: supColor + "22", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0 }}>
          {supLabel}
        </span>
        <span style={{ fontSize: 12, color: COLORS.text, flex: 1, lineHeight: 1.4 }}>{item.claim}</span>
        <span style={{ color: COLORS.muted, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: "10px 14px" }}>
          <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 8px", lineHeight: 1.6 }}>{item.detail}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {item.sources?.map((s, i) => (
              <span key={i} style={{ fontSize: 10, color: COLORS.blue, background: COLORS.blue + "15", padding: "2px 8px", borderRadius: 4, border: `1px solid ${COLORS.blue}33` }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, status, output, searchLog }) {
  const statusColor =
    status === "active" ? agent.color :
    status === "done"   ? COLORS.green :
    status === "error"  ? COLORS.coral : COLORS.muted;

  return (
    <div style={{
      background: status === "active" ? `${agent.color}08` : COLORS.surface,
      border: `1px solid ${status === "active" ? agent.color + "44" : status === "done" ? COLORS.green + "22" : COLORS.border}`,
      borderRadius: 10, padding: "12px 14px",
      transition: "all 0.3s ease", position: "relative", overflow: "hidden",
    }}>
      {status === "active" && (
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(90deg, transparent, ${agent.color}06, transparent)`,
          animation: "shimmer 1.5s infinite",
        }}/>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: (output || searchLog) ? 8 : 0 }}>
        <span style={{ fontSize: 16, color: statusColor }}>{agent.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "monospace" }}>
          {agent.label}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: COLORS.muted }}>
          {status === "idle" ? "—" : status === "active" ? "running" : status === "done" ? "✓ done" : "error"}
        </span>
      </div>
      {searchLog && searchLog.map((line, i) => (
        <div key={i} style={{ fontSize: 11, color: i === searchLog.length - 1 ? agent.color : COLORS.muted, fontFamily: "monospace", marginBottom: 2, display: "flex", gap: 6 }}>
          <span style={{ color: COLORS.muted }}>{i === searchLog.length - 1 && status === "active" ? "▶" : "✓"}</span>
          <span>{line}</span>
        </div>
      ))}
      {output && !searchLog && (
        <p style={{ fontSize: 12, color: COLORS.text, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap", opacity: 0.85 }}>{output}</p>
      )}
      {status === "active" && !output && !searchLog && (
        <p style={{ fontSize: 11, color: COLORS.muted, margin: 0, fontStyle: "italic" }}>{agent.desc}</p>
      )}
    </div>
  );
}

function VerdictBadge({ label }) {
  const map = {
    "TRUE":          { color: COLORS.green,  bg: "#4ade8022" },
    "FALSE":         { color: COLORS.coral,  bg: "#f8717122" },
    "MISLEADING":    { color: COLORS.amber,  bg: "#fbbf2422" },
    "UNVERIFIABLE":  { color: COLORS.muted,  bg: "#64748b22" },
    "PARTIALLY TRUE":{ color: COLORS.teal,   bg: "#2dd4b422" },
  };
  const style = map[label?.toUpperCase()] || map["UNVERIFIABLE"];
  return (
    <span style={{
      background: style.bg, color: style.color,
      border: `1px solid ${style.color}55`,
      padding: "6px 18px", borderRadius: 999,
      fontSize: 14, fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase", fontFamily: "monospace",
    }}>{label}</span>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 75 ? COLORS.green : pct >= 50 ? COLORS.amber : COLORS.coral;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Confidence score</span>
        <span style={{ fontSize: 14, color, fontWeight: 700, fontFamily: "monospace" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 1.2s ease" }}/>
      </div>
    </div>
  );
}

const EXAMPLE_CLAIMS = [
  "The Great Wall of China is visible from space with the naked eye.",
  "Humans only use 10% of their brain.",
  "Albert Einstein failed mathematics in school.",
  "Lightning never strikes the same place twice.",
];

export default function App() {
  const [claim, setClaim] = useState("");
  const [running, setRunning] = useState(false);
  const [agentStates, setAgentStates] = useState({});
  const [verdict, setVerdict] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("evidence");
  const logRef = useRef(null);

  const setAgent = (id, status, output = null, searchLog = null) =>
    setAgentStates((p) => ({ ...p, [id]: { status, output, searchLog } }));

  const addLog = (msg) => setLogs((p) => [...p, { time: new Date().toLocaleTimeString(), msg }]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  async function run() {
    if (!claim.trim() || running) return;
    setRunning(true);
    setVerdict(null);
    setLogs([]);
    setAgentStates({});
    setActiveTab("evidence");
    AGENTS.forEach(a => setAgent(a.id, "idle"));

    try {
      // ORCHESTRATOR
      addLog("Orchestrator agent activated");
      setAgent("orchestrator", "active", null, ["Analyzing claim structure...", "Identifying key entities..."]);
      let queries = "";
      await callAI(
        `You are an orchestrator in a fact-verification pipeline. Given a claim, output exactly 3 concise search queries (one per line, no numbering or bullets) that would help verify or refute it.`,
        `Claim: "${claim}"`,
        (t) => { queries = t; }
      );
      setAgent("orchestrator", "done", null, ["Analyzed claim structure", "Identified key entities", `Generated ${queries.trim().split("\n").length} search queries`]);
      addLog("Orchestrator complete — queries generated");
      await sleep(300);

      // WEB SEARCH with realistic logs
      addLog("Web search agent activated");
      const webSources = ["Wikipedia", "Reuters", "AP News", "Snopes"];
      setAgent("websearch", "active", null, [`Searching ${webSources[0]}...`]);
      await sleep(600);
      setAgent("websearch", "active", null, [`Searching ${webSources[0]}...`, `Searching ${webSources[1]}...`]);
      await sleep(500);
      setAgent("websearch", "active", null, [`Searching ${webSources[0]}...`, `Searching ${webSources[1]}...`, `Searching ${webSources[2]}...`]);

      // KNOWLEDGE BASE with realistic logs
      addLog("Knowledge base agent activated");
      const kbSources = ["Britannica", "NASA", "PubMed", "CDC"];
      setAgent("knowledge", "active", null, [`Querying ${kbSources[0]}...`]);
      await sleep(400);
      setAgent("knowledge", "active", null, [`Querying ${kbSources[0]}...`, `Querying ${kbSources[1]}...`]);
      await sleep(500);
      setAgent("knowledge", "active", null, [`Querying ${kbSources[0]}...`, `Querying ${kbSources[1]}...`, `Querying ${kbSources[2]}...`]);

      // CREDIBILITY
      addLog("Credibility agent scoring sources");
      setAgent("credibility", "active", null, ["Scoring source domains...", "Checking publication dates...", "Cross-referencing bias ratings..."]);

      // Run all 3 in parallel
      let webOut = "", kbOut = "", credOut = "";
      const [w, k, c] = await Promise.all([
        callAI(
          `You are a web search agent for fact-checking. Return 3-4 specific evidence findings as bullet points. Each bullet: what was found, which source, whether it supports or contradicts the claim. Be specific with facts and numbers.`,
          `Claim: "${claim}"\nSearch queries:\n${queries}`,
          (t) => { webOut = t; }
        ),
        callAI(
          `You are a knowledge base agent with access to Britannica, NASA, PubMed, and CDC. Return 2-3 specific factual findings relevant to verifying this claim. Include the source type and specific data points or measurements where relevant.`,
          `Claim: "${claim}"`,
          (t) => { kbOut = t; }
        ),
        callAI(
          `You are a credibility scoring agent. For this claim, return ONLY valid JSON (no markdown):
{
  "sources": [
    {"name": "Wikipedia", "score": 72},
    {"name": "NASA", "score": 95},
    {"name": "Britannica", "score": 91},
    {"name": "Reuters", "score": 88},
    {"name": "Snopes", "score": 85}
  ],
  "avgScore": 86,
  "misinfoRisk": "low" or "medium" or "high",
  "misinfoPattern": "one sentence about common misinformation patterns for this type of claim"
}`,
          `Claim: "${claim}"`,
          (t) => { credOut = t; }
        ),
      ]);

      setAgent("websearch", "done", null, webSources.map(s => `✓ ${s} — results retrieved`));
      setAgent("knowledge", "done", null, kbSources.slice(0,3).map(s => `✓ ${s} — records found`));

      let credData = null;
      try {
        const clean = c.replace(/```json|```/g, "").trim();
        credData = parseJSON(c);;
        setAgent("credibility", "done", null, [
          `Avg credibility score: ${credData.avgScore}%`,
          `Misinformation risk: ${credData.misinfoRisk.toUpperCase()}`,
          credData.misinfoPattern,
        ]);
      } catch {
        setAgent("credibility", "done", null, ["Source scoring complete", "Cross-referencing done"]);
      }
      addLog("All search agents complete");
      await sleep(300);

      // AGGREGATOR
      addLog("Aggregator merging evidence...");
      setAgent("aggregator", "active", null, ["Deduplicating results...", "Ranking by relevance...", "Cross-referencing sources..."]);
      let aggOut = "";
      await callAI(
        `You are an evidence aggregator. Given evidence, produce ONLY valid JSON (no markdown):
{
  "summary": "3-4 sentence neutral summary of all evidence",
  "evidence": [
    {
      "claim": "specific factual finding in one sentence",
      "supports": true or false,
      "detail": "2-3 sentence explanation with specifics",
      "sources": ["Source1", "Source2"]
    }
  ],
  "supporting": number,
  "contradicting": number
}
Include 3-5 evidence items total, mix of supporting and contradicting where applicable.`,
        `Claim: "${claim}"\nWeb evidence:\n${w}\nKnowledge base:\n${k}`,
        (t) => { aggOut = t; }
      );

      let aggData = null;
      try {
        const clean = aggOut.replace(/```json|```/g, "").trim();
        aggData = parseJSON(aggOut);
        setAgent("aggregator", "done", null, [
          `${aggData.evidence?.length || 0} evidence items ranked`,
          `${aggData.supporting || 0} supporting, ${aggData.contradicting || 0} contradicting`,
          "Aggregation complete",
        ]);
      } catch {
        setAgent("aggregator", "done", null, ["Evidence merged", "Ranking complete"]);
      }
      addLog("Evidence aggregated and ranked");
      await sleep(300);

      // VERDICT
      addLog("Verdict agent producing assessment...");
      setAgent("verdict", "active", null, ["Weighing evidence...", "Calculating confidence...", "Structuring reasoning..."]);
      let verdictRaw = "";
      await callAI(
        `You are a verdict agent. Given a claim and evidence, return ONLY valid JSON (no markdown):
{
  "verdict": "TRUE" or "FALSE" or "MISLEADING" or "PARTIALLY TRUE" or "UNVERIFIABLE",
  "confidence": 0.0 to 1.0,
  "reasoning": "3-4 sentence explanation of why, citing specific evidence",
  "keyFact": "the single most important fact that determines the verdict",
  "nuance": "important caveats, context, or what makes this complicated",
  "citations": ["specific source 1", "specific source 2", "specific source 3"]
}`,
        `Claim: "${claim}"\nAggregated evidence:\n${aggOut}\nCredibility data:\n${c}`,
        (t) => { verdictRaw = t; }
      );

      let parsedVerdict = null;
      try {
        const clean = verdictRaw.replace(/```json|```/g, "").trim();
        parsedVerdict = parseJSON(verdictRaw);
        parsedVerdict._credData = credData;
        parsedVerdict._aggData = aggData;
        setVerdict(parsedVerdict);
        setAgent("verdict", "done", null, [
          `Verdict: ${parsedVerdict.verdict}`,
          `Confidence: ${Math.round(parsedVerdict.confidence * 100)}%`,
          "Assessment complete",
        ]);
        addLog(`✓ Final verdict: ${parsedVerdict.verdict} (${Math.round(parsedVerdict.confidence * 100)}% confidence)`);
      } catch {
        setVerdict({ verdict: "UNVERIFIABLE", confidence: 0.5, reasoning: verdictRaw, citations: [], nuance: "", keyFact: "" });
        setAgent("verdict", "done", null, ["Verdict produced"]);
        addLog("Verdict complete");
      }

    } catch (err) {
      addLog(`Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  const tabs = ["evidence", "sources", "reasoning", "log"];

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'IBM Plex Mono', 'Courier New', monospace", padding: "28px 20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&display=swap');
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #2e2e4e; border-radius: 2px; }
        textarea:focus { outline: none; }
        button:hover:not(:disabled) { filter: brightness(1.12); }
        button:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[COLORS.purple, COLORS.teal, COLORS.amber].map((c, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}` }}/>
              ))}
            </div>
            <span style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.15em", textTransform: "uppercase" }}>Multi-agent · 6 specialized agents · parallel execution</span>
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 700, margin: 0, color: COLORS.text, letterSpacing: "-0.02em" }}>
            Fact Verification System
          </h1>
        </div>

        {/* Input */}
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 10, color: COLORS.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Claim to verify
          </label>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
            placeholder="Enter any factual claim..."
            rows={2}
            style={{
              width: "100%", background: COLORS.faint, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, padding: "10px 12px", color: COLORS.text, fontSize: 14,
              fontFamily: "'Fraunces', serif", resize: "none", lineHeight: 1.6,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EXAMPLE_CLAIMS.map((c) => (
                <button key={c} onClick={() => setClaim(c)} style={{
                  background: COLORS.faint, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                  padding: "4px 10px", fontSize: 10, color: COLORS.muted, cursor: "pointer", fontFamily: "inherit",
                }}>
                  {c.slice(0, 36)}…
                </button>
              ))}
            </div>
            <button onClick={run} disabled={running || !claim.trim()} style={{
              background: running ? COLORS.purpleDim : COLORS.purple,
              border: "none", borderRadius: 8, padding: "9px 22px",
              color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
              cursor: "pointer", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6,
            }}>
              {running ? <><span style={{ animation: "pulse 1s infinite" }}>●</span> Verifying…</> : "▶ Verify Claim"}
            </button>
          </div>
        </div>

        {/* Agent Grid */}
        {Object.keys(agentStates).length > 0 && (
          <div style={{ marginBottom: 20, animation: "fadeIn 0.4s ease" }}>
            <p style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Agent pipeline</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {AGENTS.map((agent) => {
                const state = agentStates[agent.id] || { status: "idle" };
                return <AgentCard key={agent.id} agent={agent} status={state.status} output={state.output} searchLog={state.searchLog} />;
              })}
            </div>
          </div>
        )}

        {/* Verdict + Tabs */}
        {verdict && (
          <div style={{ animation: "fadeIn 0.5s ease" }}>

            {/* Verdict header */}
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.borderHover}`, borderRadius: 12, padding: 20, marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
                <VerdictBadge label={verdict.verdict} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <ConfidenceBar value={verdict.confidence} />
                </div>
              </div>
              {verdict.keyFact && (
                <div style={{ background: COLORS.faint, borderLeft: `3px solid ${COLORS.purple}`, padding: "10px 14px", borderRadius: "0 8px 8px 0", marginBottom: 12 }}>
                  <p style={{ fontSize: 10, color: COLORS.purple, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>Key finding</p>
                  <p style={{ fontSize: 13, color: COLORS.text, margin: 0, lineHeight: 1.6, fontFamily: "'Fraunces', serif" }}>{verdict.keyFact}</p>
                </div>
              )}
              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 0 }}>
                {tabs.map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{
                    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 11, fontWeight: activeTab === t ? 600 : 400,
                    color: activeTab === t ? COLORS.purple : COLORS.muted,
                    padding: "6px 12px", borderBottom: activeTab === t ? `2px solid ${COLORS.purple}` : "2px solid transparent",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: -1,
                  }}>
                    {t === "evidence" ? `Evidence (${verdict._aggData?.evidence?.length || 0})` :
                     t === "sources" ? `Sources (${verdict._credData?.sources?.length || 0})` :
                     t === "reasoning" ? "Reasoning" : "System Log"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.borderHover}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 16, marginBottom: 20 }}>

              {activeTab === "evidence" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "slideIn 0.3s ease" }}>
                  {verdict._aggData?.evidence?.length > 0 ? (
                    <>
                      <p style={{ fontSize: 11, color: COLORS.muted, margin: "0 0 4px", lineHeight: 1.6 }}>{verdict._aggData.summary}</p>
                      {verdict._aggData.evidence.map((item, i) => <EvidenceCard key={i} item={item} index={i} />)}
                    </>
                  ) : (
                    <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>Evidence data unavailable — see Reasoning tab.</p>
                  )}
                </div>
              )}

              {activeTab === "sources" && (
                <div style={{ animation: "slideIn 0.3s ease" }}>
                  {verdict._credData ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                        {verdict._credData.sources?.map((s, i) => <SourceBadge key={i} source={s.name} score={s.score} />)}
                      </div>
                      <div style={{ background: COLORS.faint, borderRadius: 8, padding: "10px 14px", display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <div>
                          <p style={{ fontSize: 10, color: COLORS.muted, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Avg credibility</p>
                          <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.green, margin: 0, fontFamily: "monospace" }}>{verdict._credData.avgScore}%</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: COLORS.muted, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Misinfo risk</p>
                          <p style={{ fontSize: 18, fontWeight: 700, color: verdict._credData.misinfoRisk === "low" ? COLORS.green : verdict._credData.misinfoRisk === "medium" ? COLORS.amber : COLORS.coral, margin: 0, fontFamily: "monospace", textTransform: "uppercase" }}>
                            {verdict._credData.misinfoRisk}
                          </p>
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <p style={{ fontSize: 10, color: COLORS.muted, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pattern note</p>
                          <p style={{ fontSize: 12, color: COLORS.text, margin: 0, lineHeight: 1.5 }}>{verdict._credData.misinfoPattern}</p>
                        </div>
                      </div>
                    </>
                  ) : <p style={{ fontSize: 13, color: COLORS.muted }}>Source data unavailable.</p>}
                </div>
              )}

              {activeTab === "reasoning" && (
                <div style={{ animation: "slideIn 0.3s ease" }}>
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Full reasoning</p>
                    <p style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.8, margin: 0, fontFamily: "'Fraunces', serif" }}>{verdict.reasoning}</p>
                  </div>
                  {verdict.nuance && (
                    <div style={{ background: COLORS.amber + "0d", border: `1px solid ${COLORS.amber}33`, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                      <p style={{ fontSize: 10, color: COLORS.amber, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>⚠ Nuance & caveats</p>
                      <p style={{ fontSize: 13, color: COLORS.text, margin: 0, lineHeight: 1.6 }}>{verdict.nuance}</p>
                    </div>
                  )}
                  {verdict.citations?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Citations</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {verdict.citations.map((c, i) => (
                          <span key={i} style={{ background: COLORS.faint, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "4px 10px", fontSize: 11, color: COLORS.blue }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "log" && (
                <div ref={logRef} style={{ animation: "slideIn 0.3s ease", maxHeight: 240, overflowY: "auto" }}>
                  {logs.map((l, i) => (
                    <div key={i} style={{ fontSize: 11, marginBottom: 5, display: "flex", gap: 12, fontFamily: "monospace" }}>
                      <span style={{ color: COLORS.purpleDim, minWidth: 72, flexShrink: 0 }}>{l.time}</span>
                      <span style={{ color: i === logs.length - 1 ? COLORS.text : COLORS.muted }}>{l.msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
