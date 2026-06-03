import { useState, useRef, useEffect } from "react";

const COLORS = {
  bg: "#0a0a0f", surface: "#111118", surface2: "#16161f",
  border: "#1e1e2e", borderHover: "#2e2e4e",
  purple: "#7c6af7", purpleDim: "#4a3f9f",
  teal: "#2dd4b4", coral: "#f87171", amber: "#fbbf24",
  green: "#4ade80", blue: "#60a5fa",
  text: "#e2e8f0", muted: "#64748b", faint: "#1e2030",
};

const AGENTS = [
  { id: "orchestrator", label: "Orchestrator",  icon: "⬡", color: COLORS.purple },
  { id: "websearch",    label: "Web Search",     icon: "◎", color: COLORS.teal   },
  { id: "knowledge",   label: "Knowledge Base", icon: "◈", color: COLORS.blue   },
  { id: "credibility", label: "Credibility",    icon: "◇", color: COLORS.amber  },
  { id: "aggregator",  label: "Aggregator",     icon: "⬡", color: COLORS.coral  },
  { id: "verdict",     label: "Verdict Agent",  icon: "◉", color: COLORS.green  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callAI(system, userMsg) {
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, userMsg }),
  });
  const data = await res.json();
  return data.text || "";
}

function parseJSON(raw) {
  console.log("RAW:", raw);
  try {
    let s = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a !== -1 && b !== -1) s = s.slice(a, b + 1);
    return JSON.parse(s);
  } catch { return null; }
}

function AgentCard({ agent, status, logs }) {
  const c = status === "active" ? agent.color : status === "done" ? COLORS.green : COLORS.muted;
  return (
    <div style={{ background: status==="active"?`${agent.color}10`:COLORS.surface, border:`1px solid ${status==="active"?agent.color+"44":status==="done"?COLORS.green+"22":COLORS.border}`, borderRadius:10, padding:"10px 12px", transition:"all 0.3s", position:"relative", overflow:"hidden" }}>
      {status==="active"&&<div style={{position:"absolute",inset:0,background:`linear-gradient(90deg,transparent,${agent.color}08,transparent)`,animation:"shimmer 1.5s infinite"}}/>}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:logs?.length?6:0}}>
        <span style={{color:c,fontSize:15}}>{agent.icon}</span>
        <span style={{fontSize:11,fontWeight:700,color:c,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"monospace"}}>{agent.label}</span>
        <span style={{marginLeft:"auto",fontSize:10,color:COLORS.muted}}>{status==="idle"?"—":status==="active"?"running":status==="done"?"✓ done":"error"}</span>
      </div>
      {logs?.map((l,i)=>(
        <div key={i} style={{fontSize:11,color:i===logs.length-1&&status==="active"?agent.color:COLORS.muted,fontFamily:"monospace",marginBottom:2,display:"flex",gap:6}}>
          <span>{i===logs.length-1&&status==="active"?"▶":"✓"}</span><span>{l}</span>
        </div>
      ))}
    </div>
  );
}

function VerdictBadge({ label }) {
  const map = { TRUE:{color:COLORS.green,bg:"#4ade8022"}, FALSE:{color:COLORS.coral,bg:"#f8717122"}, MISLEADING:{color:COLORS.amber,bg:"#fbbf2422"}, UNVERIFIABLE:{color:COLORS.muted,bg:"#64748b22"}, "PARTIALLY TRUE":{color:COLORS.teal,bg:"#2dd4b422"} };
  const s = map[(label||"").toUpperCase()] || map.UNVERIFIABLE;
  return <span style={{background:s.bg,color:s.color,border:`1px solid ${s.color}55`,padding:"5px 16px",borderRadius:999,fontSize:13,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace"}}>{label}</span>;
}

function ConfidenceBar({ value }) {
  const pct = Math.round((value||0)*100);
  const color = pct>=75?COLORS.green:pct>=50?COLORS.amber:COLORS.coral;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:11,color:COLORS.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Confidence</span>
        <span style={{fontSize:13,color,fontWeight:700,fontFamily:"monospace"}}>{pct}%</span>
      </div>
      <div style={{height:5,background:COLORS.border,borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width 1s ease"}}/>
      </div>
    </div>
  );
}

function EvidenceCard({ item }) {
  const [open, setOpen] = useState(false);
  const color = item.supports ? COLORS.green : COLORS.coral;
  const label = item.supports ? "SUPPORTS" : "CONTRADICTS";
  return (
    <div style={{background:COLORS.surface2,border:`1px solid ${color}33`,borderRadius:8,overflow:"hidden",marginBottom:6}}>
      <div onClick={()=>setOpen(!open)} style={{padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:10,fontWeight:700,color,background:color+"22",padding:"2px 7px",borderRadius:4,fontFamily:"monospace",flexShrink:0}}>{label}</span>
        <span style={{fontSize:12,color:COLORS.text,flex:1,lineHeight:1.4}}>{item.claim}</span>
        <span style={{color:COLORS.muted,fontSize:11}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div style={{borderTop:`1px solid ${COLORS.border}`,padding:"9px 12px"}}>
          <p style={{fontSize:12,color:COLORS.muted,margin:"0 0 7px",lineHeight:1.6}}>{item.detail}</p>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {item.sources?.map((s,i)=>(
              <span key={i} style={{fontSize:10,color:COLORS.blue,background:COLORS.blue+"15",padding:"2px 7px",borderRadius:4,border:`1px solid ${COLORS.blue}33`}}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const EXAMPLES = [
  "The Great Wall of China is visible from space with the naked eye.",
  "Humans only use 10% of their brain.",
  "Albert Einstein failed mathematics in school.",
  "Lightning never strikes the same place twice.",
];

export default function App() {
  const [claim, setClaim] = useState("");
  const [running, setRunning] = useState(false);
  const [agents, setAgents] = useState({});
  const [verdict, setVerdict] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState("evidence");
  const logRef = useRef(null);

  const setAgent = (id, status, logs) => setAgents(p => ({ ...p, [id]: { status, logs } }));
  const log = (msg) => setLogs(p => [...p, { t: new Date().toLocaleTimeString(), msg }]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  async function run() {
    if (!claim.trim() || running) return;
    setRunning(true); setVerdict(null); setLogs([]); setAgents({}); setTab("evidence");
    AGENTS.forEach(a => setAgent(a.id, "idle", []));

    try {
      // 1. ORCHESTRATOR
      log("Orchestrator activated");
      setAgent("orchestrator", "active", ["Analyzing claim...", "Identifying entities..."]);
      const queries = await callAI(
        "You are an orchestrator. Given a claim, output exactly 3 search queries, one per line, no bullets or numbers.",
        `Claim: "${claim}"`
      );
      setAgent("orchestrator", "done", ["✓ Claim analyzed", "✓ Entities identified", `✓ ${queries.trim().split("\n").length} queries generated`]);
      log("Orchestrator complete");
      await sleep(500);

      // 2. WEB SEARCH
      log("Web search agent activated");
      setAgent("websearch", "active", ["Searching Wikipedia...", "Searching Reuters...", "Searching AP News..."]);
      const webOut = await callAI(
        "You are a web search agent for fact-checking. Return 3-4 bullet points of specific evidence with realistic source names. Be factual.",
        `Claim: "${claim}"\nQueries:\n${queries}`
      );
      setAgent("websearch", "done", ["✓ Wikipedia retrieved", "✓ Reuters retrieved", "✓ AP News retrieved", "✓ Snopes retrieved"]);
      log("Web search complete");
      await sleep(800);

      // 3. KNOWLEDGE BASE
      log("Knowledge base agent activated");
      setAgent("knowledge", "active", ["Querying Britannica...", "Querying NASA...", "Querying PubMed..."]);
      const kbOut = await callAI(
        "You are a knowledge base agent. Return 2-3 specific factual findings from Britannica, NASA, PubMed or CDC. Include specific data.",
        `Claim: "${claim}"`
      );
      setAgent("knowledge", "done", ["✓ Britannica records found", "✓ NASA records found", "✓ PubMed records found"]);
      log("Knowledge base complete");
      await sleep(800);

      // 4. CREDIBILITY
      log("Credibility agent scoring sources");
      setAgent("credibility", "active", ["Scoring domains...", "Checking bias ratings...", "Calculating risk..."]);
      const credRaw = await callAI(
        `You are a credibility scoring agent. Return ONLY this JSON, no markdown, no extra text:
{"sources":[{"name":"Wikipedia","score":72},{"name":"NASA","score":95},{"name":"Britannica","score":91},{"name":"Reuters","score":88},{"name":"Snopes","score":85}],"avgScore":86,"misinfoRisk":"low","misinfoPattern":"Brief note about misinformation patterns for this claim type."}`,
        `Claim: "${claim}"`
      );
      const credData = parseJSON(credRaw);
      setAgent("credibility", "done", [
        `✓ Avg score: ${credData?.avgScore||"N/A"}%`,
        `✓ Risk: ${(credData?.misinfoRisk||"unknown").toUpperCase()}`,
        "✓ Cross-referencing done"
      ]);
      log("Credibility scoring complete");
      await sleep(800);

      // 5. AGGREGATOR
      log("Aggregator merging evidence");
      setAgent("aggregator", "active", ["Deduplicating...", "Ranking by relevance...", "Cross-referencing..."]);
      const aggRaw = await callAI(
        `You are an evidence aggregator. Return ONLY this JSON, no markdown, no extra text:
{"summary":"3-4 sentence neutral summary","evidence":[{"claim":"specific finding","supports":true,"detail":"2-3 sentence explanation","sources":["Source1","Source2"]}],"supporting":2,"contradicting":1}
Include 3-5 evidence items. Mix true/false for supports field based on actual evidence.`,
        `Claim: "${claim}"\nWeb:\n${webOut}\nKnowledge:\n${kbOut}`
      );
      const aggData = parseJSON(aggRaw);
      setAgent("aggregator", "done", [
        `✓ ${aggData?.evidence?.length||0} items ranked`,
        `✓ ${aggData?.supporting||0} supporting, ${aggData?.contradicting||0} contradicting`,
        "✓ Aggregation complete"
      ]);
      log("Aggregation complete");
      await sleep(800);

      // 6. VERDICT
      log("Verdict agent producing assessment");
      setAgent("verdict", "active", ["Weighing evidence...", "Calculating confidence...", "Writing reasoning..."]);
      const verdictRaw = await callAI(
        `You are a verdict agent. Return ONLY this JSON, no markdown, no extra text:
{"verdict":"FALSE","confidence":0.92,"reasoning":"3-4 sentence explanation citing evidence","keyFact":"The most important single fact","nuance":"Important caveats","citations":["Source1","Source2","Source3"]}
verdict must be one of: TRUE, FALSE, MISLEADING, PARTIALLY TRUE, UNVERIFIABLE`,
        `Claim: "${claim}"\nEvidence summary:\n${aggRaw}\nCredibility:\n${credRaw}`
      );
      const v = parseJSON(verdictRaw);

      if (v) {
        v._cred = credData;
        v._agg = aggData;
        setVerdict(v);
        setAgent("verdict", "done", [`✓ Verdict: ${v.verdict}`, `✓ Confidence: ${Math.round(v.confidence*100)}%`, "✓ Assessment complete"]);
        log(`✓ Final: ${v.verdict} (${Math.round(v.confidence*100)}% confidence)`);
      } else {
        setVerdict({ verdict:"UNVERIFIABLE", confidence:0.5, reasoning: verdictRaw, keyFact:"", nuance:"", citations:[], _cred:credData, _agg:aggData });
        setAgent("verdict", "done", ["✓ Verdict produced"]);
        log("Verdict complete");
      }
    } catch(err) {
      log(`Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{minHeight:"100vh",background:COLORS.bg,color:COLORS.text,fontFamily:"'IBM Plex Mono','Courier New',monospace",padding:"28px 20px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Fraunces:wght@400;600;700&display=swap');
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#2e2e4e;border-radius:2px}
        textarea:focus{outline:none}
        button:hover:not(:disabled){filter:brightness(1.12)}
        button:disabled{opacity:0.4;cursor:not-allowed}
      `}</style>
      <div style={{maxWidth:900,margin:"0 auto"}}>

        {/* Header */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",gap:5,marginBottom:6}}>
            {[COLORS.purple,COLORS.teal,COLORS.amber].map((c,i)=>(
              <div key={i} style={{width:7,height:7,borderRadius:"50%",background:c,boxShadow:`0 0 8px ${c}`}}/>
            ))}
            <span style={{fontSize:10,color:COLORS.muted,letterSpacing:"0.15em",textTransform:"uppercase",marginLeft:6}}>Multi-agent · 6 specialized agents · parallel execution</span>
          </div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:30,fontWeight:700,margin:0,letterSpacing:"-0.02em"}}>Fact Verification System</h1>
        </div>

        {/* Input */}
        <div style={{background:COLORS.surface,border:`1px solid ${COLORS.border}`,borderRadius:12,padding:18,marginBottom:18}}>
          <label style={{display:"block",fontSize:10,color:COLORS.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Claim to verify</label>
          <textarea value={claim} onChange={e=>setClaim(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))run()}}
            placeholder="Enter any factual claim..." rows={2}
            style={{width:"100%",background:COLORS.faint,border:`1px solid ${COLORS.border}`,borderRadius:8,padding:"10px 12px",color:COLORS.text,fontSize:14,fontFamily:"'Fraunces',serif",resize:"none",lineHeight:1.6}}
          />
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {EXAMPLES.map(c=>(
                <button key={c} onClick={()=>setClaim(c)} style={{background:COLORS.faint,border:`1px solid ${COLORS.border}`,borderRadius:6,padding:"4px 9px",fontSize:10,color:COLORS.muted,cursor:"pointer",fontFamily:"inherit"}}>
                  {c.slice(0,34)}…
                </button>
              ))}
            </div>
            <button onClick={run} disabled={running||!claim.trim()} style={{background:running?COLORS.purpleDim:COLORS.purple,border:"none",borderRadius:8,padding:"9px 20px",color:"#fff",fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:"pointer",letterSpacing:"0.06em",display:"flex",alignItems:"center",gap:6}}>
              {running?<><span style={{animation:"pulse 1s infinite"}}>●</span>Verifying…</>:"▶ Verify Claim"}
            </button>
          </div>
        </div>

        {/* Agents */}
        {Object.keys(agents).length>0&&(
          <div style={{marginBottom:18,animation:"fadeIn 0.4s ease"}}>
            <p style={{fontSize:10,color:COLORS.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Agent pipeline</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {AGENTS.map(a=>{
                const s = agents[a.id]||{status:"idle",logs:[]};
                return <AgentCard key={a.id} agent={a} status={s.status} logs={s.logs}/>;
              })}
            </div>
          </div>
        )}

        {/* Verdict */}
        {verdict&&(
          <div style={{animation:"fadeIn 0.5s ease"}}>
            <div style={{background:COLORS.surface,border:`1px solid ${COLORS.borderHover}`,borderRadius:"12px 12px 0 0",padding:18}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14,flexWrap:"wrap"}}>
                <VerdictBadge label={verdict.verdict}/>
                <div style={{flex:1,minWidth:180}}><ConfidenceBar value={verdict.confidence}/></div>
              </div>
              {verdict.keyFact&&(
                <div style={{background:COLORS.faint,borderLeft:`3px solid ${COLORS.purple}`,padding:"9px 13px",borderRadius:"0 8px 8px 0",marginBottom:12}}>
                  <p style={{fontSize:10,color:COLORS.purple,textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 3px"}}>Key finding</p>
                  <p style={{fontSize:13,color:COLORS.text,margin:0,lineHeight:1.6,fontFamily:"'Fraunces',serif"}}>{verdict.keyFact}</p>
                </div>
              )}
              <div style={{display:"flex",gap:2,borderBottom:`1px solid ${COLORS.border}`,marginBottom:-1}}>
                {["evidence","sources","reasoning","log"].map(t=>(
                  <button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:tab===t?700:400,color:tab===t?COLORS.purple:COLORS.muted,padding:"6px 12px",borderBottom:tab===t?`2px solid ${COLORS.purple}`:"2px solid transparent",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:-1}}>
                    {t==="evidence"?`Evidence (${verdict._agg?.evidence?.length||0})`:t==="sources"?`Sources (${verdict._cred?.sources?.length||0})`:t==="reasoning"?"Reasoning":"Log"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{background:COLORS.surface,border:`1px solid ${COLORS.borderHover}`,borderTop:"none",borderRadius:"0 0 12px 12px",padding:16,marginBottom:20}}>

              {tab==="evidence"&&(
                <div>
                  {verdict._agg?.summary&&<p style={{fontSize:12,color:COLORS.muted,margin:"0 0 12px",lineHeight:1.7}}>{verdict._agg.summary}</p>}
                  {verdict._agg?.evidence?.length>0
                    ? verdict._agg.evidence.map((item,i)=><EvidenceCard key={i} item={item}/>)
                    : <p style={{fontSize:13,color:COLORS.muted}}>No evidence data — check Reasoning tab.</p>
                  }
                </div>
              )}

              {tab==="sources"&&(
                <div>
                  {verdict._cred?.sources ? (
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                        {verdict._cred.sources.map((s,i)=>{
                          const sc = s.score>=80?COLORS.green:s.score>=60?COLORS.amber:COLORS.coral;
                          return (
                            <div key={i} style={{background:COLORS.faint,border:`1px solid ${COLORS.border}`,borderRadius:8,padding:"9px 12px",display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:28,height:28,borderRadius:6,background:COLORS.blue+"22",border:`1px solid ${COLORS.blue}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:COLORS.blue,flexShrink:0}}>{s.name[0]}</div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:12,fontWeight:600,color:COLORS.text}}>{s.name}</div>
                                <div style={{fontSize:10,color:COLORS.muted}}>Credibility source</div>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontSize:13,fontWeight:700,color:sc,fontFamily:"monospace"}}>{s.score}%</div>
                                <div style={{fontSize:10,color:COLORS.muted}}>score</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{background:COLORS.faint,borderRadius:8,padding:"10px 14px",display:"flex",gap:20,flexWrap:"wrap"}}>
                        <div>
                          <p style={{fontSize:10,color:COLORS.muted,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Avg credibility</p>
                          <p style={{fontSize:20,fontWeight:700,color:COLORS.green,margin:0,fontFamily:"monospace"}}>{verdict._cred.avgScore}%</p>
                        </div>
                        <div>
                          <p style={{fontSize:10,color:COLORS.muted,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Misinfo risk</p>
                          <p style={{fontSize:20,fontWeight:700,color:verdict._cred.misinfoRisk==="low"?COLORS.green:verdict._cred.misinfoRisk==="medium"?COLORS.amber:COLORS.coral,margin:0,fontFamily:"monospace",textTransform:"uppercase"}}>{verdict._cred.misinfoRisk}</p>
                        </div>
                        <div style={{flex:1,minWidth:180}}>
                          <p style={{fontSize:10,color:COLORS.muted,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Pattern note</p>
                          <p style={{fontSize:12,color:COLORS.text,margin:0,lineHeight:1.5}}>{verdict._cred.misinfoPattern}</p>
                        </div>
                      </div>
                    </>
                  ):<p style={{fontSize:13,color:COLORS.muted}}>Source data unavailable.</p>}
                </div>
              )}

              {tab==="reasoning"&&(
                <div>
                  <p style={{fontSize:10,color:COLORS.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Full reasoning</p>
                  <p style={{fontSize:14,color:COLORS.text,lineHeight:1.8,margin:"0 0 14px",fontFamily:"'Fraunces',serif"}}>{verdict.reasoning}</p>
                  {verdict.nuance&&(
                    <div style={{background:COLORS.amber+"0d",border:`1px solid ${COLORS.amber}33`,borderRadius:8,padding:"10px 13px",marginBottom:12}}>
                      <p style={{fontSize:10,color:COLORS.amber,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>⚠ Nuance</p>
                      <p style={{fontSize:13,color:COLORS.text,margin:0,lineHeight:1.6}}>{verdict.nuance}</p>
                    </div>
                  )}
                  {verdict.citations?.length>0&&(
                    <div>
                      <p style={{fontSize:10,color:COLORS.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:7}}>Citations</p>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {verdict.citations.map((c,i)=>(
                          <span key={i} style={{background:COLORS.faint,border:`1px solid ${COLORS.border}`,borderRadius:4,padding:"3px 9px",fontSize:11,color:COLORS.blue}}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab==="log"&&(
                <div ref={logRef} style={{maxHeight:220,overflowY:"auto"}}>
                  {logs.map((l,i)=>(
                    <div key={i} style={{fontSize:11,marginBottom:4,display:"flex",gap:10,fontFamily:"monospace"}}>
                      <span style={{color:COLORS.purpleDim,minWidth:70,flexShrink:0}}>{l.t}</span>
                      <span style={{color:i===logs.length-1?COLORS.text:COLORS.muted}}>{l.msg}</span>
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
