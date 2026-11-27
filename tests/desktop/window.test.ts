import { describe, expect, it } from "vitest";
import { PICK_FOLDER_CHANNEL, decideWindowOpen, isSmoke, projectFromArgs, windowOptions } from "../../src/desktop/window.ts";

describe("desktop window helpers", () => {
  it("isolates the renderer and loads the preload bridge", () => {
    const o = windowOptions("/app/dist/desktop/preload.cjs");
    expect([o.width, o.height, o.minWidth, o.minHeight, o.backgroundColor]).toEqual([1440, 900, 1024, 640, "#111110"]);
    expect(o.webPreferences).toMatchObject({ preload: "/app/dist/desktop/preload.cjs", contextIsolation: true, sandbox: true, nodeIntegration: false });
    expect(PICK_FOLDER_CHANNEL).toBe("mason:pick-folder");
  });
  it("reads the folder and the smoke flag from the arguments", () => {
    expect(projectFromArgs(["--no-sandbox", "/sites/north", "--smoke"])).toBe("/sites/north");
    expect(projectFromArgs(["--smoke"])).toBeNull();
    expect([isSmoke(["--smoke"]), isSmoke(["/x"])]).toEqual([true, false]);
  });
  it("keeps app windows inside Mason and sends other links to the browser", () => {
    const origin = "http://127.0.0.1:51234";
    expect(decideWindowOpen("http://127.0.0.1:51234/p/index.html", origin)).toBe("allow");
    expect(decideWindowOpen("https://penpot.app/", origin)).toBe("external");
    expect(decideWindowOpen("file:///etc/passwd", origin)).toBe("deny");
    expect(decideWindowOpen("not a url", origin)).toBe("deny");
  });
});
