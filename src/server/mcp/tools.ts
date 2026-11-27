import { MasonError } from "../../contracts/errors.ts";
import { INSPECT_PROPS, NON_VISUAL_TAGS } from "../../contracts/model.ts";
import type { ElementNode } from "../../contracts/model.ts";
import { MCP_PROPOSAL_MESSAGE } from "../../contracts/mcp.ts";
import type { McpToolName } from "../../contracts/mcp.ts";
import type { StudioService } from "../../contracts/ports.ts";

type Args = Record<string, unknown>;
export interface StructureNode { path: string; tag: string; name: string; kind: string; children: StructureNode[] }

function str(args: Args, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || v === "") throw new MasonError("INVALID_INPUT", `"${key}" must be a non-empty string.`);
  return v;
}

/** Element tree without NON_VISUAL_TAGS, keeping only path, tag, name, kind and children. */
export function structureOf(node: ElementNode): StructureNode {
  return { path: node.path, tag: node.tag, name: node.name, kind: node.kind,
    children: node.children.filter((c) => !NON_VISUAL_TAGS.includes(c.tag)).map(structureOf) };
}

/** The data each MCP tool returns (see MCP_TOOLS descriptions). */
export async function runTool(studio: StudioService, name: McpToolName, args: Args): Promise<unknown> {
  switch (name) {
    case "list_pages":
      return (await studio.currentProject()).pages.map((p) => ({ name: p.name, file: p.file, title: p.title }));
    case "get_page_structure":
      return structureOf(await studio.pageTree(str(args, "page")));
    case "get_element": {
      const r = await studio.inspect(str(args, "page"), str(args, "path"));
      const values: Record<string, unknown> = {};
      for (const prop of INSPECT_PROPS) {
        const v = r.props[prop].values;
        if (v.desktop !== null || v.tablet !== null || v.mobile !== null) values[prop] = v;
      }
      return { name: r.name, tag: r.tag, selector: r.selector, values };
    }
    case "propose_style_changes": {
      const agent = typeof args.agent_name === "string" && args.agent_name.trim() !== "" ? args.agent_name.trim() : "MCP agent";
      const changes = Array.isArray(args.changes) ? args.changes as never[] : [];
      const p = await studio.propose({ source: agent, page: str(args, "page"), summary: str(args, "summary"), changes });
      return { proposal_id: p.id, blocked: p.changes.filter((c) => c.blocked).map((c) => ({ label: c.label, reason: c.blocked!.title })),
        message: MCP_PROPOSAL_MESSAGE.replace("{id}", p.id) };
    }
    case "get_proposal": {
      const id = str(args, "id");
      const p = (await studio.proposals()).find((x) => x.id === id);
      if (!p) throw new MasonError("PROPOSAL_NOT_FOUND", id);
      return { id: p.id, status: p.status, changes: p.changes.map((c) => ({ label: c.label, value: c.value, blocked: c.blocked !== null })) };
    }
    case "list_tokens":
      return (await studio.tokens()).tokens.map((t) => ({ name: t.name, type: t.type, value: t.value }));
    case "check_page":
      return (await studio.checks(str(args, "page"))).findings.map((f) => ({ severity: f.severity, title: f.title, detail: f.detail }));
  }
}
