import type { Meta, StoryObj } from "@storybook/react-vite";
import { Hand, MousePointer2, Square } from "lucide-react";
import { Button, Chip, IconButton } from "./Button.tsx";

const meta: Meta<typeof Button> = { title: "Primitives/Button", component: Button };
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: "primary", children: "Commit" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Export" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Reset" } };
export const Danger: Story = { args: { variant: "danger", children: "Reject" } };
export const Tools: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 4 }}>
      <IconButton label="Move" active><MousePointer2 /></IconButton>
      <IconButton label="Rectangle"><Square /></IconButton>
      <IconButton label="Hand"><Hand /></IconButton>
    </div>
  ),
};
export const Chips: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 4 }}>
      <Chip active dot="var(--bp-desktop)" meta="1280">Desktop</Chip>
      <Chip dot="var(--bp-tablet)" meta="≤ 768">Tablet</Chip>
      <Chip dot="var(--bp-mobile)" meta="≤ 375">Mobile</Chip>
    </div>
  ),
};
