import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiNotFound } from "./apiNotFound";

function fakeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.json = (body: unknown) => ((res.body = body), res);
  return res;
}

test("an unknown /api path answers a JSON 404 naming the method and path", () => {
  const res = fakeRes();
  apiNotFound({ method: "POST", baseUrl: "/api", path: "/organizations" } as any, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { message: "Not found: POST /api/organizations" });
});

test("server/index.ts mounts the /api 404 after the API routes and before the SPA fallback", () => {
  const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.ts"), "utf8");
  const routes = src.indexOf("await registerRoutes(app);");
  const notFound = src.indexOf('app.use("/api", apiNotFound);');
  const spa = src.indexOf("serveStatic(app);");
  assert.ok(routes > 0 && notFound > routes, "404 comes after registerRoutes");
  assert.ok(spa > notFound, "404 comes before the index.html catch-all");
});
