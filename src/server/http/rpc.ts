import { ERROR_STATUS } from "../../contracts/http.ts";
import { STUDIO_METHODS } from "../../contracts/ports.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { MasonError, isMasonError } from "../../contracts/errors.ts";

export async function handleRpc(studio: StudioService, method: string, body: unknown): Promise<{ status: number; body: unknown }> {
  if (!(STUDIO_METHODS as readonly string[]).includes(method)) {
    return { status: 404, body: { error: { code: "UNKNOWN_METHOD", message: new MasonError("UNKNOWN_METHOD", method).message } } };
  }
  const args = body !== null && typeof body === "object" && Array.isArray((body as { args?: unknown }).args)
    ? (body as { args: unknown[] }).args
    : [];
  try {
    const result = await (studio[method as keyof StudioService] as (...a: unknown[]) => Promise<unknown>)(...args);
    return { status: 200, body: { result: result ?? null } };
  } catch (error) {
    if (isMasonError(error)) {
      return { status: ERROR_STATUS[error.code], body: { error: { code: error.code, message: error.message } } };
    }
    return { status: 500, body: { error: { code: "INTERNAL", message: error instanceof Error ? error.message : String(error) } } };
  }
}
