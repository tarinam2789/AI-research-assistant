import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown.jsx";
import Logo from "./Logo.jsx";

const STAGES = [
  { label: "SEARCH", hint: "querying the web" },
  { label: "INDEX", hint: "reading & embedding" },
  { label: "SYNTHESIZE", hint: "writing cited answer" },
];

const EXAMPLES = [
  "How does CRISPR gene editing work?",
  "Explain the P vs NP problem simply",
  "What is quantum error correction?",
  "How do transformers use attention?",
  "Why is the sky blue but sunsets red?",
];

const EMPTY = { id: null, text: "", answer: "", sources: [], status: "idle", error: "" };

const expId = (id) => `EXP-${String(id).padStart(4, "0")}`;

function domain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function toRun(d) {
  return {
    id: d.id,
    text: d.text,
    answer: d.answer || "",
    sources: d.sources || [],
    status: d.status === "done" ? "done" : d.status === "failed" ? "failed" : "running",
    error: d.error || "",
  };
}

function toMarkdown(run) {
  const refs = run.sources
    .map((s) => `${s.number}. [${s.title || s.url}](${s.url})`)
    .join("\n");
  return `# ${run.text}\n\n${run.answer.trim()}\n\n## Sources\n\n${refs}\n`;
}

function readTheme() {
  try {
    return localStorage.getItem("lab-theme") || "dark";
  } catch {
    return "dark";
  }
}

export default function App() {
  const [input, setInput] = useState("");
  const [run, setRun] = useState(EMPTY);
  const [stage, setStage] = useState(0);
  const [history, setHistory] = useState([]);
  const [elapsed, setElapsed] = useState(null);
  const [hot, setHot] = useState(null);
  const [theme, setTheme] = useState(readTheme);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const inputRef = useRef(null);

  const busy = run.status === "running";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("lab-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    loadHistory();
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && tag !== "textarea" && tag !== "input") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearInterval(timerRef.current);
      closeWs();
    };
  }, []);

  async function loadHistory() {
    try {
      const res = await fetch("/api/questions/");
      if (res.ok) setHistory(await res.json());
    } catch {
      /* ignore */
    }
  }

  function closeWs() {
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }

  function startTimer() {
    clearInterval(timerRef.current);
    startRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(
      () => setElapsed((Date.now() - startRef.current) / 1000),
      200
    );
  }

  function stopTimer() {
    clearInterval(timerRef.current);
    setElapsed((Date.now() - startRef.current) / 1000);
  }

  function attach(id) {
    closeWs();
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/questions/${id}/`);
    wsRef.current = ws;

    ws.onopen = async () => {
      try {
        const data = await (await fetch(`/api/questions/${id}/`)).json();
        if (wsRef.current === ws && (data.status === "done" || data.status === "failed")) {
          setRun(toRun(data));
          setStage(3);
          stopTimer();
          closeWs();
          loadHistory();
        }
      } catch {
        /* ignore */
      }
    };

    ws.onmessage = (msg) => {
      if (wsRef.current !== ws) return;
      const ev = JSON.parse(msg.data);
      if (ev.type === "status") {
        setStage(ev.message.startsWith("Searching") ? 0 : ev.message.startsWith("Reading") ? 1 : 2);
      }
      if (ev.type === "sources") setRun((r) => ({ ...r, sources: ev.sources }));
      if (ev.type === "token") setRun((r) => ({ ...r, answer: r.answer + ev.text }));
      if (ev.type === "done") {
        setRun((r) => ({ ...r, status: "done" }));
        setStage(3);
        stopTimer();
        closeWs();
        loadHistory();
      }
      if (ev.type === "error") {
        setRun((r) => ({ ...r, status: "failed", error: ev.message }));
        stopTimer();
        closeWs();
        loadHistory();
      }
    };
  }

  async function ask(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    closeWs();
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setMenu(false);
    setHot(null);
    setStage(0);
    setRun({ ...EMPTY, text: q, status: "running" });
    startTimer();
    try {
      const res = await fetch("/api/questions/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: q }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const { id } = await res.json();
      setRun((r) => ({ ...r, id }));
      attach(id);
      loadHistory();
    } catch (err) {
      setRun((r) => ({ ...r, status: "failed", error: String(err.message || err) }));
      stopTimer();
    }
  }

  async function openQuestion(id) {
    closeWs();
    clearInterval(timerRef.current);
    setElapsed(null);
    setHot(null);
    setMenu(false);
    try {
      const data = await (await fetch(`/api/questions/${id}/`)).json();
      const next = toRun(data);
      setRun(next);
      if (next.status === "running") {
        setStage(1);
        attach(id);
      } else {
        setStage(3);
      }
    } catch {
      /* ignore */
    }
  }

  async function removeItem(id, e) {
    e.stopPropagation();
    try {
      await fetch(`/api/questions/${id}/`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    setHistory((h) => h.filter((x) => x.id !== id));
    if (run.id === id) newResearch();
  }

  function newResearch() {
    closeWs();
    clearInterval(timerRef.current);
    setRun(EMPTY);
    setStage(0);
    setElapsed(null);
    setHot(null);
    setMenu(false);
    inputRef.current?.focus();
  }

  function onCite(n) {
    document.getElementById(`src-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHot(n);
    setTimeout(() => setHot(null), 1600);
  }

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(toMarkdown(run));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function exportMd() {
    const blob = new Blob([toMarkdown(run)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${expId(run.id || 0).toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      ask();
    }
  }

  function onChange(e) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  const words = run.answer.trim().split(/\s+/).filter(Boolean).length;
  const cites = (run.answer.match(/\[\d+/g) || []).length;
  const statusLabel = { idle: "READY", running: "RUNNING", done: "COMPLETE", failed: "FAILED" }[run.status];

  return (
    <div className="app">
      <aside className={`side ${menu ? "open" : ""}`}>
        <div className="brand">
          <Logo size={40} />
          <div>
            <b>RESEARCH//LAB</b>
            <small>cited answers from the open web</small>
          </div>
        </div>
        <button className="new" onClick={newResearch}>
          + NEW EXPERIMENT
        </button>
        <div className="side-title">
          <span>LAB NOTEBOOK</span>
          <span>{history.length}</span>
        </div>
        <ul className="history">
          {history.length === 0 && <li className="empty-h">No experiments yet.</li>}
          {history.map((h) => (
            <li
              key={h.id}
              role="button"
              tabIndex={0}
              className={`hitem ${run.id === h.id ? "active" : ""}`}
              onClick={() => openQuestion(h.id)}
              onKeyDown={(e) => e.key === "Enter" && openQuestion(h.id)}
            >
              <span className={`dot ${h.status}`} />
              <div className="t">
                <div className="q">{h.text}</div>
                <small>
                  {expId(h.id)} · {ago(h.created_at)}
                </small>
              </div>
              <button
                className="del"
                title="Delete"
                aria-label="Delete experiment"
                onClick={(e) => removeItem(h.id, e)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="side-foot">
          <button className="btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "☀ Paper mode" : "☾ Terminal mode"}
          </button>
          <div className="keys">
            <kbd>/</kbd> focus · <kbd>Enter</kbd> run · <kbd>Shift</kbd>+<kbd>Enter</kbd> newline
          </div>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}

      <main>
        <div className="wrap">
          <header className="top">
            <button className="burger" aria-label="Open menu" onClick={() => setMenu(true)}>
              ☰
            </button>
            <span className="path">
              ~/lab/<b>{run.id ? expId(run.id).toLowerCase() : "new"}</b>
            </span>
            <span className="sp" />
            <span className={`pill ${run.status}`}>{statusLabel}</span>
          </header>

          <form
            className="prompt"
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <span className="ps1">researcher@lab:~$</span>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={onChange}
              onKeyDown={onKeyDown}
              disabled={busy}
              placeholder="ask anything, e.g. how does CRISPR work?"
            />
            <button className="run" type="submit" disabled={busy || !input.trim()}>
              {busy ? "RUNNING…" : "RUN ▸"}
            </button>
          </form>

          {run.status === "idle" && (
            <section className="welcome">
              <div className="hero">
                <Logo size={116} ring />
                <div>
                  <h1>
                    What do you want to <em>investigate</em>?
                  </h1>
                  <p className="sub">
                    Ask a question. I search the web, read the sources, and write a cited answer
                    you can verify.
                  </p>
                </div>
              </div>
              <div className="chips">
                {EXAMPLES.map((ex) => (
                  <button key={ex} className="chip" onClick={() => ask(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
              <div className="tiles">
                <div className="tile">
                  <b>01 // LIVE SEARCH</b>
                  <span>Pulls and reads the top web sources for every question.</span>
                </div>
                <div className="tile">
                  <b>02 // CITED CLAIMS</b>
                  <span>Click any numbered chip to jump to the source behind it.</span>
                </div>
                <div className="tile">
                  <b>03 // LAB NOTEBOOK</b>
                  <span>Every experiment is saved. Reopen it or export it as Markdown.</span>
                </div>
              </div>
            </section>
          )}

          {run.status !== "idle" && (
            <section className="result">
              <div className="qecho">
                <span>Q.</span>
                {run.text}
              </div>

              {run.status !== "failed" && (
                <ol className="pipe">
                  {STAGES.map((s, i) => {
                    let state = "idle";
                    if (i < stage) state = "done";
                    else if (i === stage) state = busy ? "active" : "done";
                    return (
                      <li key={s.label} className={`node ${state}`}>
                        <span className="bub">{state === "done" ? "✓" : i + 1}</span>
                        <span className="lbl">
                          <b>{s.label}</b>
                          <small>{s.hint}</small>
                        </span>
                      </li>
                    );
                  })}
                  <li className="timer">t+{elapsed == null ? "—" : `${elapsed.toFixed(1)}s`}</li>
                </ol>
              )}

              {run.status === "failed" && (
                <div className="err">
                  <b>EXPERIMENT FAILED</b>
                  <p>{run.error || "Something went wrong."}</p>
                  <button className="btn" onClick={() => ask(run.text)}>
                    ↻ Retry
                  </button>
                </div>
              )}

              {(run.answer || busy) && (
                <article className="card">
                  <div className="card-h">
                    <span>ANSWER</span>
                    <span className="sp" />
                    {run.status === "done" && (
                      <>
                        <button className="btn" onClick={copyAnswer}>
                          {copied ? "✓ Copied" : "Copy"}
                        </button>
                        <button className="btn" onClick={exportMd}>
                          Export .md
                        </button>
                      </>
                    )}
                  </div>
                  <div className="card-b">
                    {run.answer ? (
                      <Markdown
                        text={run.answer}
                        sources={run.sources}
                        onCite={onCite}
                        onHover={setHot}
                        caret={busy}
                      />
                    ) : (
                      <>
                        <div className="sk" style={{ width: "92%" }} />
                        <div className="sk" style={{ width: "78%" }} />
                        <div className="sk" style={{ width: "86%" }} />
                        <div className="sk" style={{ width: "54%" }} />
                      </>
                    )}
                  </div>
                  {run.status === "done" && (
                    <div className="card-f">
                      <span>{words} words</span>
                      <span>{cites} citations</span>
                      <span>{run.sources.length} sources</span>
                      {elapsed != null && <span>{elapsed.toFixed(1)}s</span>}
                    </div>
                  )}
                </article>
              )}

              {run.sources.length > 0 && (
                <>
                  <h2 className="sec">REFERENCES</h2>
                  <div className="refs">
                    {run.sources.map((s) => (
                      <a
                        key={s.number}
                        id={`src-${s.number}`}
                        className={`ref ${hot === s.number ? "hot" : ""}`}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="num">{s.number}</span>
                        <span className="meta">
                          <b>{s.title || domain(s.url)}</b>
                          <small>{domain(s.url)} ↗</small>
                        </span>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
