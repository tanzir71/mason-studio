/** Error codes and exact user-visible messages. Planner-owned contract: never edit. */
export type MasonErrorCode =
  | "NOT_IMPLEMENTED" | "NO_PROJECT" | "NOT_A_PROJECT" | "FOLDER_NOT_EMPTY" | "PAGE_NOT_FOUND" | "PAGE_EXISTS"
  | "ELEMENT_NOT_FOUND" | "NOT_TEXT_ELEMENT" | "FILE_NOT_FOUND" | "PATH_OUTSIDE_PROJECT" | "CSS_PARSE_ERROR"
  | "EDIT_CONFLICT" | "NO_STYLESHEET" | "NOTHING_TO_UNDO" | "NOTHING_TO_REDO" | "INVALID_INPUT" | "TOKENS_INVALID"
  | "PROPOSAL_NOT_FOUND" | "PROPOSAL_CLOSED" | "LLM_UNAVAILABLE" | "LLM_BAD_RESPONSE" | "GIT_FAILED"
  | "MCP_DISABLED" | "UNKNOWN_METHOD";

export const ERROR_MESSAGES: Record<MasonErrorCode, string> = {
  NOT_IMPLEMENTED: "Not implemented yet.",
  NO_PROJECT: "No project is open.",
  NOT_A_PROJECT: "That folder has no .html files.",
  FOLDER_NOT_EMPTY: "That folder is not empty.",
  PAGE_NOT_FOUND: "Page not found.",
  PAGE_EXISTS: "A page with that name already exists.",
  ELEMENT_NOT_FOUND: "Element not found.",
  NOT_TEXT_ELEMENT: "Only text elements can be edited as text.",
  FILE_NOT_FOUND: "File not found.",
  PATH_OUTSIDE_PROJECT: "Path is outside the project folder.",
  CSS_PARSE_ERROR: "The stylesheet could not be parsed.",
  EDIT_CONFLICT: "Two edits overlap.",
  NO_STYLESHEET: "This page has no local stylesheet.",
  NOTHING_TO_UNDO: "Nothing to undo.",
  NOTHING_TO_REDO: "Nothing to redo.",
  INVALID_INPUT: "Invalid input.",
  TOKENS_INVALID: "The tokens file could not be read.",
  PROPOSAL_NOT_FOUND: "Proposal not found.",
  PROPOSAL_CLOSED: "This proposal was already accepted or rejected.",
  LLM_UNAVAILABLE: "The agent endpoint did not respond.",
  LLM_BAD_RESPONSE: "The agent reply was not valid JSON.",
  GIT_FAILED: "Git command failed.",
  MCP_DISABLED: "MCP is off. Turn it on in Mason settings.",
  UNKNOWN_METHOD: "Unknown method.",
};

/** message = ERROR_MESSAGES[code], or `${ERROR_MESSAGES[code]} ${detail}` when detail is given. */
export class MasonError extends Error {
  readonly code: MasonErrorCode;
  readonly detail: string | null;
  constructor(code: MasonErrorCode, detail?: string) {
    super(detail ? `${ERROR_MESSAGES[code]} ${detail}` : ERROR_MESSAGES[code]);
    this.name = "MasonError";
    this.code = code;
    this.detail = detail ?? null;
  }
}

export function isMasonError(value: unknown): value is MasonError {
  return value instanceof Error && (value as { name?: string }).name === "MasonError" && "code" in value;
}
