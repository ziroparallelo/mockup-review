// tests/e2e/preflight.spec.ts
import { test, expect } from "@playwright/test";
import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");
const PREFLIGHT = path.join(PLUGIN_ROOT, "scripts", "preflight.sh");
const STOP = path.join(PLUGIN_ROOT, "scripts", "stop.sh");

const SCRATCH = "/tmp/mr-e2e-preflight";
const PORT = "8810";

test.beforeAll(() => {
    rmSync(SCRATCH, { recursive: true, force: true });
    mkdirSync(SCRATCH, { recursive: true });
    const r = spawnSync("bash", [PREFLIGHT, SCRATCH], {
        env: { ...process.env, MOCKUP_REVIEW_PORT: PORT, MOCKUP_REVIEW_NO_BROWSER: "1" },
        encoding: "utf-8",
        timeout: 10000,
    });
    if (r.status !== 0) {
        throw new Error(`preflight failed: ${r.stderr}`);
    }
});

test.afterAll(() => {
    spawnSync("bash", [STOP, SCRATCH, PORT], { timeout: 5000 });
    rmSync(SCRATCH, { recursive: true, force: true });
});

test.use({ baseURL: `http://127.0.0.1:${PORT}` });

test("preflight scaffolded files are served", async ({ request }) => {
    const server = await request.get("/.preview/mockups/_server.py");
    expect(server.status()).toBe(200);
    const js = await request.get("/.preview/mockups/_decisions.js");
    expect(js.status()).toBe(200);
    const css = await request.get("/.preview/mockups/_shared.css");
    expect(css.status()).toBe(200);
});

test("decisions.json starts empty", async ({ request }) => {
    const r = await request.get("/.preview/decisions.json");
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({});
});

test("POST round-trip still works after auto-bootstrap", async ({ request }) => {
    const post = await request.post("/.preview/decisions", {
        data: { fixId: "fix-bootstrap-e2e", status: "approved" },
    });
    expect(post.status()).toBe(200);
    const saved = await (await request.get("/.preview/decisions.json")).json();
    expect(saved["fix-bootstrap-e2e"].status).toBe("approved");
});

test("mtime endpoint reachable", async ({ request }) => {
    const r = await request.get("/.preview/mtime?path=/.preview/mockups/_server.py");
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.mtime).toBeGreaterThan(0);
});
