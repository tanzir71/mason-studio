import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createEventActions(ctx: StoreContext): Pick<StudioActions, "handleEvent" | "showToast" | "dismissToast"> {
  return {
    handleEvent(event) {
      if (event.type === "written") {
        if (event.revision === ctx.get().revision) return;
        ctx.set({ revision: event.revision });
        ctx.reloadPage().catch(() => {});
      } else if (event.type === "external-change") {
        ctx.set((s) => ({ revision: s.revision + 1 }));
        ctx.reloadPage().catch(() => {});
      } else if (event.type === "proposal") {
        ctx.set((s) => ({ proposals: [event.proposal, ...s.proposals.filter((p) => p.id !== event.proposal.id)] }));
      }
    },
    showToast(tone, text, undo) { ctx.toast(tone, text, undo); },
    dismissToast() { ctx.set({ toast: null }); },
  };
}
