import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Field, Section } from "./Field.tsx";
import { Tabs } from "./Tabs.tsx";

const meta: Meta<typeof Field> = { title: "Primitives/Inputs", component: Field };
export default meta;
type Story = StoryObj<typeof Field>;

export const Plain: Story = { args: { label: "Width", prefix: "W", value: "Fill", onCommit: () => {} } };
export const Override: Story = { args: { label: "Font size", prefix: "Size", value: "32", override: true, onCommit: () => {} } };
export const TokenValue: Story = { args: { label: "Gap", prefix: "Gap", value: "space.5", suffix: "24", mono: true, onCommit: () => {} } };
export const PanelTabs: Story = {
  render: () => {
    const [tab, setTab] = useState<"design" | "inspect" | "checks">("design");
    return <Tabs<"design" | "inspect" | "checks"> label="Panel" value={tab} onChange={setTab} items={[{ id: "design", label: "Design" }, { id: "inspect", label: "Inspect" }, { id: "checks", label: "Checks" }]} />;
  },
};
export const Scope: Story = {
  render: () => {
    const [scope, setScope] = useState<"all" | "tablet" | "mobile">("tablet");
    return (
      <div style={{ width: 248 }}>
        <Tabs<"all" | "tablet" | "mobile"> variant="segmented" label="Applies to" value={scope} onChange={setScope}
          items={[{ id: "all", label: "All sizes" }, { id: "tablet", label: "≤ 768", dot: "var(--bp-tablet)" }, { id: "mobile", label: "≤ 375", dot: "var(--bp-mobile)" }]} />
      </div>
    );
  },
};
export const PanelSection: Story = {
  render: () => (
    <div style={{ width: 280, background: "var(--bg-panel)" }}>
      <Section title="Layout">
        <Field label="Width" prefix="W" value="Fill" onCommit={() => {}} />
      </Section>
    </div>
  ),
};
