import type { CheckFinding, CssSheet, ElementNode, Token } from "../../contracts/model.ts";

const finding = (id: string, title: string, path: string | null): CheckFinding =>
  ({ id, kind: "a11y", severity: "warning", title, detail: "", file: null, line: null, path });

/** See CheckPageStructure in src/contracts/engine.ts. */
export function checkPageStructure(body: ElementNode): { findings: CheckFinding[]; passed: string[] } {
  const headings: ElementNode[] = [];
  const findings: CheckFinding[] = [];
  let altMissing = 0;
  const walk = (n: ElementNode) => {
    if (/^h[1-6]$/.test(n.tag)) headings.push(n);
    if (n.tag === "img" && n.attrs.alt === undefined) { findings.push(finding(`a11y:alt:${n.path}`, "Image has no alt text", n.path)); altMissing += 1; }
    n.children.forEach(walk);
  };
  walk(body);
  const headingFindings: CheckFinding[] = [];
  const h1s = headings.filter((h) => h.tag === "h1").length;
  if (h1s > 1) headingFindings.push(finding("a11y:h1-count", `Page has ${h1s} H1 headings`, null));
  for (let i = 1; i < headings.length; i++) {
    const prev = Number(headings[i - 1].tag[1]);
    const next = Number(headings[i].tag[1]);
    if (next > prev + 1) headingFindings.push(finding(`a11y:heading:${headings[i].path}`, `Heading jumps from H${prev} to H${next}`, headings[i].path));
  }
  const passed: string[] = [];
  if (headingFindings.length === 0) passed.push("Headings in order");
  if (altMissing === 0) passed.push("Images have alt text");
  return { findings: [...headingFindings, ...findings], passed };
}

/** "#abc" → "#aabbcc"; 6- and 8-digit hex keep their first 6 digits; lowercase. */
export function normalizeHex(hex: string): string {
  const h = hex.slice(1).toLowerCase();
  const six = h.length === 3 || h.length === 4 ? [...h.slice(0, 3)].map((c) => c + c).join("") : h.slice(0, 6);
  return `#${six}`;
}

/** See CheckRawColors in src/contracts/engine.ts. */
export function checkRawColors(sheets: CssSheet[], tokens: Token[]): CheckFinding[] {
  const out: CheckFinding[] = [];
  for (const sheet of sheets) {
    for (const rule of sheet.rules) {
      if (rule.selector === ":root") continue;
      for (const d of rule.declarations) {
        const m = /#[0-9a-f]{3,8}\b/i.exec(d.value);
        if (!m) continue;
        const hex = normalizeHex(m[0]);
        const token = tokens.find((t) => t.type === "color" && /^#[0-9a-f]{3,8}$/i.test(t.value) && normalizeHex(t.value) === hex);
        out.push({ id: `tokens:${rule.file}:${rule.line}:${d.prop}`, kind: "tokens", severity: "info", title: `Raw color ${m[0]} in ${rule.selector}`,
          detail: token ? `Use ${token.name} instead.` : "Not a token.", file: rule.file, line: rule.line, path: null });
      }
    }
  }
  return out;
}
