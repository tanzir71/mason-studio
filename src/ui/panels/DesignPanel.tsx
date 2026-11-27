import { Hash, Image, Link, RotateCcw, Rows3, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { PROP_LABELS } from "../../contracts/model.ts";
import type { LayerKind } from "../../contracts/model.ts";
import { Button, cx } from "../components/Button.tsx";
import { Field, Section } from "../components/Field.tsx";
import { DESIGN_FIELDS, SCOPE_LABELS, SECTION_TITLES, fieldView, nodeAt, sectionsFor } from "./design-fields.ts";
import { ScopeControl } from "./ScopeControl.tsx";
import "./design.css";

const KIND_ICONS: Record<LayerKind, LucideIcon> = { frame: Hash, stack: Rows3, text: Type, image: Image, link: Link };
const MONO = new Set(["grid-template-columns", "box-shadow", "font-family"]);

export function DesignPanel() {
  const actions = useActions();
  const selection = useStudio((s) => s.selection);
  const inspect = useStudio((s) => s.inspect);
  const tree = useStudio((s) => s.tree);
  const scope = useStudio((s) => s.scope);
  if (selection === null) return <div className="m-empty" data-testid={TEST_IDS.designPanel}>Select a layer to edit its style.</div>;
  if (!inspect || inspect.path !== selection) return <div className="m-empty" data-testid={TEST_IDS.designPanel}>Loading styles…</div>;
  const kind = (tree && nodeAt(tree, selection)?.kind) || "frame";
  const Icon = KIND_ICONS[kind];
  return (
    <div className={cx("m-design", scope === "mobile" && "is-mobile")} data-testid={TEST_IDS.designPanel}>
      <header className="m-design-head">
        <Icon className="m-design-head__icon" aria-hidden="true" />
        <span className="m-design-head__name">{inspect.name}</span>
        <span className="m-design-head__tag">{inspect.tag}</span>
      </header>
      <ScopeControl />
      {sectionsFor(kind).map((section) => {
        const fields = DESIGN_FIELDS.filter((f) => f.section === section);
        const overridden = scope === "all" ? [] : fields.filter((f) => fieldView(inspect, f.prop, scope).override);
        return (
          <Section key={section} title={SECTION_TITLES[section]} testId={`design-${section}`}>
            <div className="m-grid2">
              {fields.map((f) => {
                const view = fieldView(inspect, f.prop, scope);
                return (
                  <div key={f.prop} className={f.wide ? "is-wide" : undefined}>
                    <Field label={f.label} prefix={f.prefix} value={view.value} override={view.override}
                      mono={MONO.has(f.prop)} onCommit={(value) => { void actions.applyStyle(f.prop, value); }} />
                  </div>
                );
              })}
            </div>
            {overridden.map((f) => {
              const label = PROP_LABELS[f.prop];
              return (
                <div key={f.prop} className={cx("m-override-note", scope === "mobile" && "is-mobile")}>
                  <span><span className="m-dot" />{`${label.charAt(0).toUpperCase()}${label.slice(1)} set for ${SCOPE_LABELS[scope]}. Desktop: ${fieldView(inspect, f.prop, scope).desktop ?? "none"}`}</span>
                  <Button size="sm" variant="ghost" onClick={() => { void actions.resetStyle(f.prop); }}><RotateCcw size={12} />Reset</Button>
                </div>
              );
            })}
          </Section>
        );
      })}
    </div>
  );
}
