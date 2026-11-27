import type { MasonEvent } from "../../contracts/model.ts";
import type { CreateEventHub, EventHub } from "../../contracts/ports.ts";

export const createEventHub: CreateEventHub = (): EventHub => {
  const listeners: ((event: MasonEvent) => void)[] = [];
  return {
    emit(event) {
      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch {
          // A failing subscriber must not stop the others.
        }
      }
    },
    subscribe(listener) {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };
};
