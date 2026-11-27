import { request } from "node:http";

/** Raw HTTP request to 127.0.0.1 with an explicit Host header. Resolves { status, headers, body }. */
export function rawRequest(port: number, method: string, path: string, options: { host?: string; body?: string } = {}):
  Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, method, path, headers: { host: options.host ?? `127.0.0.1:${port}`, "content-type": "application/json" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => { body += c; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}
