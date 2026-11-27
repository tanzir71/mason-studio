import { ERROR_MESSAGES, MasonError } from "../../contracts/errors.ts";
import type { MasonErrorCode } from "../../contracts/errors.ts";
import { ROUTES } from "../../contracts/http.ts";
import type { MasonEvent } from "../../contracts/model.ts";
import { STUDIO_METHODS } from "../../contracts/ports.ts";
import type { CreateHttpClient, MasonClient } from "../../contracts/ui.tsx";

/** Turns an RPC `error` body into a MasonError (known code) or an Error, keeping the server's message. */
export function toClientError(error: { code?: string; message?: string } | undefined, status: number): Error {
  const message = error?.message ?? `Request failed (${status}).`;
  if (error?.code && error.code in ERROR_MESSAGES) {
    const e = new MasonError(error.code as MasonErrorCode);
    e.message = message;
    return e;
  }
  return new Error(message);
}

export const createHttpClient: CreateHttpClient = (baseUrl: string): MasonClient => {
  const call = async (method: string, args: unknown[]): Promise<unknown> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${ROUTES.rpc}${method}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args }),
      });
    } catch {
      throw new Error("Could not reach Mason. Is it still running?");
    }
    let body: { result?: unknown; error?: { code?: string; message?: string } };
    try { body = await res.json(); } catch { throw new Error(`Request failed (${res.status}).`); }
    if (res.ok) return body.result;
    throw toClientError(body.error, res.status);
  };
  const client: Record<string, unknown> = {};
  for (const m of STUDIO_METHODS) client[m] = (...args: unknown[]) => call(m, args);

  const listeners = new Set<(e: MasonEvent) => void>();
  let source: EventSource | null = null;
  client.subscribe = (listener: (e: MasonEvent) => void) => {
    listeners.add(listener);
    if (!source) {
      source = new EventSource(`${baseUrl}${ROUTES.events}`);
      source.onmessage = (m: MessageEvent<string>) => {
        let event: MasonEvent;
        try { event = JSON.parse(m.data) as MasonEvent; } catch { return; }
        for (const l of [...listeners]) l(event);
      };
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && source) { source.close(); source = null; }
    };
  };
  return client as unknown as MasonClient;
};
