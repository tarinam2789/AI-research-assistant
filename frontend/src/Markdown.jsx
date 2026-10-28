function Inline({ text, sources, onCite, onHover }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+(?:\s*,\s*\d+)*\])/g);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return <code key={i}>{p.slice(1, -1)}</code>;
    }
    const m = p.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
    if (m) {
      return m[1].split(/\s*,\s*/).map((raw, j) => {
        const n = Number(raw);
        const src = sources.find((s) => s.number === n);
        return (
          <button
            key={`${i}-${j}`}
            type="button"
            className="cite"
            title={src ? src.title || src.url : ""}
            onClick={() => onCite(n)}
            onMouseEnter={() => onHover(n)}
            onMouseLeave={() => onHover(null)}
          >
            {n}
          </button>
        );
      });
    }
    return p;
  });
}

function parse(text) {
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) {
      blocks.push({ t: "p", text: para.join(" ") });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^#{1,3}\s+(.*)/);
    const ul = line.match(/^\s*[-*]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      blocks.push({ t: "h", text: h[1] });
    } else if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      if (!list || list.t !== kind) {
        flushList();
        list = { t: kind, items: [] };
      }
      list.items.push((ul || ol)[1]);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return blocks;
}

export default function Markdown({ text, sources, onCite, onHover, caret }) {
  const blocks = parse(text);
  const inl = (t) => (
    <Inline text={t} sources={sources} onCite={onCite} onHover={onHover} />
  );
  const tail = caret ? <span className="caret" /> : null;
  return (
    <div className="md">
      {blocks.map((b, i) => {
        const last = i === blocks.length - 1;
        if (b.t === "h") {
          return (
            <h3 key={i}>
              {inl(b.text)}
              {last && tail}
            </h3>
          );
        }
        if (b.t === "ul" || b.t === "ol") {
          const Tag = b.t;
          return (
            <Tag key={i}>
              {b.items.map((it, j) => (
                <li key={j}>
                  {inl(it)}
                  {last && j === b.items.length - 1 && tail}
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i}>
            {inl(b.text)}
            {last && tail}
          </p>
        );
      })}
    </div>
  );
}
