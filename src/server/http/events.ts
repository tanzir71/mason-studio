import type { IncomingMessage, ServerResponse } from "node:http";
import type { EventHub } from "../../contracts/ports.ts";

export function handleEvents(req: IncomingMessage, res: ServerResponse, hub: EventHub): void {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  res.write(": connected\n\n");
  const off = hub.subscribe((e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
  const timer = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    clearInterval(timer);
    off();
  });
}
