import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../../contracts/model.ts";
import type { Settings } from "../../contracts/model.ts";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { Button } from "../components/Button.tsx";
import { Tabs } from "../components/Tabs.tsx";
import "./agent.css";

/** Agent endpoint, model, API key, MCP switch and theme. An empty API key field keeps the stored key. */
export function SettingsDialog() {
  const actions = useActions();
  const open = useStudio((s) => s.settingsOpen);
  const settings = useStudio((s) => s.settings);
  const [draft, setDraft] = useState<Settings>(settings ?? DEFAULT_SETTINGS);
  useEffect(() => { if (open) setDraft(settings ?? DEFAULT_SETTINGS); }, [open, settings]);
  if (!open) return null;
  const agent = (patch: Partial<Settings["agent"]>) => setDraft({ ...draft, agent: { ...draft.agent, ...patch } });
  const mcpUrl = `${window.location.origin}/mcp`;
  return (
    <div className="m-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) actions.closeSettings(); }}>
      <div className="m-dialog" role="dialog" aria-modal="true" aria-labelledby="m-settings-title" data-testid={TEST_IDS.settingsDialog}
        onKeyDown={(e) => { if (e.key === "Escape") actions.closeSettings(); }}>
        <header className="m-dialog__head"><h2 className="m-dialog__title" id="m-settings-title">Settings</h2></header>
        <div className="m-dialog__body">
          <label className="m-dialog__row">Agent endpoint
            <input className="m-input" value={draft.agent.baseUrl} onChange={(e) => agent({ baseUrl: e.target.value })} />
            <span className="m-dialog__hint">Any OpenAI-compatible API. Ollama and LM Studio run locally.</span>
          </label>
          <label className="m-dialog__row">Model
            <input className="m-input" value={draft.agent.model} onChange={(e) => agent({ model: e.target.value })} />
          </label>
          <label className="m-dialog__row">API key
            <input className="m-input" type="password" autoComplete="off" value={draft.agent.apiKey}
              placeholder={settings?.hasApiKey ? "Saved. Type to replace it." : "Not needed for local models"}
              onChange={(e) => agent({ apiKey: e.target.value })} />
          </label>
          <label className="m-dialog__check">
            <input type="checkbox" checked={draft.mcpEnabled} onChange={(e) => setDraft({ ...draft, mcpEnabled: e.target.checked })} />
            Let MCP agents read pages and propose changes
          </label>
          <span className="m-dialog__hint">{`MCP endpoint: ${mcpUrl}`}</span>
          <div className="m-dialog__row">Theme
            <Tabs<Settings["theme"]> variant="segmented" label="Theme" value={draft.theme} onChange={(theme) => setDraft({ ...draft, theme })}
              items={[{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }]} />
          </div>
        </div>
        <footer className="m-dialog__foot">
          <Button variant="ghost" onClick={() => actions.closeSettings()}>Cancel</Button>
          <Button variant="primary" onClick={() => { void actions.saveSettings(draft); }}>Save</Button>
        </footer>
      </div>
    </div>
  );
}
