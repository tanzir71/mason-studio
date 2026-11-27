import { Circle, CodeXml, Frame, Hand, Image, MessageSquare, MousePointer2, Square, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { ToolId } from "../../contracts/ui.tsx";
import { IconButton } from "../components/Button.tsx";
import "./app.css";

export const TOOLS: readonly { id: ToolId; label: string; icon: LucideIcon }[] = [
  { id: "move", label: "Move (V)", icon: MousePointer2 },
  { id: "frame", label: "Frame (F)", icon: Frame },
  { id: "rect", label: "Rectangle (R)", icon: Square },
  { id: "ellipse", label: "Ellipse (O)", icon: Circle },
  { id: "text", label: "Text (T)", icon: Type },
  { id: "image", label: "Image (Shift+Mod+K)", icon: Image },
  { id: "hand", label: "Hand (H)", icon: Hand },
];

export function ToolDock() {
  const actions = useActions();
  const tool = useStudio((s) => s.tool);
  const project = useStudio((s) => s.project);
  const page = useStudio((s) => s.page);
  const file = project?.pages.find((p) => p.name === page)?.file ?? null;
  return (
    <div className="m-dock" role="toolbar" aria-label="Tools" data-testid={TEST_IDS.toolDock}>
      {TOOLS.map(({ id, label, icon: Icon }) => (
        <IconButton key={id} label={label} active={tool === id} onClick={() => actions.setTool(id)}><Icon /></IconButton>
      ))}
      <span className="m-dock__sep" />
      <IconButton label="Ask agent (Mod+I)" onClick={() => actions.openAgentPrompt()}><MessageSquare /></IconButton>
      <IconButton label="Code (Mod+E)" disabled={!file} onClick={() => { if (file) void actions.openCode(file, null); }}><CodeXml /></IconButton>
    </div>
  );
}
