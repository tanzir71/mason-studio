import type { CheckFinding, ElementPath, HardBan, TasteProfile } from "../../contracts/model.ts";

/** See ParseTaste in src/contracts/engine.ts. */
export function parseTaste(markdown: string): TasteProfile {
  const lines = markdown.split(/\r?\n/);
  const bodies: Record<string, string[]> = {};
  const bans: HardBan[] = [];
  const invalid: string[] = [];
  let current: string | null = null;
  lines.forEach((line, i) => {
    const head = /^##\s+(.+?)\s*$/.exec(line);
    if (head) { current = head[1].toLowerCase(); bodies[current] = []; return; }
    if (current === null) return;
    bodies[current].push(line);
    if (current !== "hard bans") return;
    const m = /^\s*-\s*(literal|regex):\s*(.+)$/.exec(line);
    if (!m) return;
    const rest = m[2];
    const cut = rest.lastIndexOf(" | ");
    const pattern = (cut >= 0 ? rest.slice(0, cut) : rest).trim();
    const note = (cut >= 0 ? rest.slice(cut + 3) : "").trim() || pattern;
    const kind = m[1] as HardBan["kind"];
    if (kind === "regex") {
      try { new RegExp(pattern, "i"); } catch { invalid.push(`regex: ${pattern}`); return; }
    }
    bans.push({ kind, pattern, note, line: i + 1 });
  });
  const sections: Record<string, string> = {};
  for (const [k, v] of Object.entries(bodies)) sections[k] = v.join("\n").trim();
  return { sections, bans, invalid };
}

/** See CheckBans in src/contracts/engine.ts. */
export function checkBans(profile: TasteProfile, text: string,
  where: { file: string | null; line: number | null; path: ElementPath | null }): CheckFinding[] {
  const out: CheckFinding[] = [];
  for (const ban of profile.bans) {
    const hit = ban.kind === "literal" ? text.toLowerCase().includes(ban.pattern.toLowerCase()) : new RegExp(ban.pattern, "i").test(text);
    if (!hit) continue;
    out.push({ id: `taste:${ban.line}`, kind: "taste", severity: "blocked", title: ban.note,
      detail: `Matches "${ban.kind}: ${ban.pattern}".`, file: where.file, line: where.line, path: where.path });
  }
  return out;
}
