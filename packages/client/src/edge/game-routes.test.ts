import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { GAME_URL, LANDING_URL } from "../site/site-urls.js";
import { RELEASE_NOTICE_VERSION } from "../view/release-notice.js";
import { handleGameRequest, MARVELCDB_IMPORT_ROUTE } from "./game-routes.js";

const CLIENT = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(CLIENT, path), "utf8").replace(/\r\n/g, "\n");

const ASSET = new Response("asset");
const env = { ASSETS: { fetch: async () => ASSET } };
const request = (path: string, method = "GET") => new Request(`${GAME_URL.replace(/\/$/, "")}${path}`, { method });

describe("the game Worker", () => {
  test("hands every other path to the static assets", async () => {
    expect(await handleGameRequest(request("/card-art/x.png"), env)).toBe(ASSET);
    expect(await handleGameRequest(request("/api/other"), env)).toBe(ASSET);
  });

  test("passes a MarvelCDB deck through, uncached", async () => {
    const asked: string[] = [];
    const response = await handleGameRequest(request("/api/marvelcdb-import/decklist/123"), env, async (url) => {
      asked.push(String(url));
      return new Response('{"id":123}', { headers: { "content-type": "application/json" } });
    });
    expect(asked).toEqual(["https://marvelcdb.com/api/public/decklist/123.json"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe('{"id":123}');
  });

  test("turns MarvelCDB's empty and login-page answers into a 404 with a message", async () => {
    const empty = await handleGameRequest(
      request("/api/marvelcdb-import/decklist/9"),
      env,
      async () => new Response(""),
    );
    expect(empty.status).toBe(404);
    const login = await handleGameRequest(
      request("/api/marvelcdb-import/deck/9"),
      env,
      async () => new Response("<html>", { headers: { "content-type": "text/html" } }),
    );
    expect(login.status).toBe(404);
    expect(((await login.json()) as { error: string }).error).toMatch(/no deck at id 9/);
  });

  test("refuses a malformed reference, a write and an unreachable MarvelCDB", async () => {
    const never = async (): Promise<Response> => {
      throw new Error("offline");
    };
    expect((await handleGameRequest(request("/api/marvelcdb-import/deck/abc"), env, never)).status).toBe(400);
    expect((await handleGameRequest(request("/api/marvelcdb-import/deck/1", "POST"), env, never)).status).toBe(405);
    const down = await handleGameRequest(request("/api/marvelcdb-import/deck/1"), env, never);
    expect(down.status).toBe(502);
    expect(((await down.json()) as { error: string }).error).toContain("offline");
  });

  test("answers a body that breaks off mid-read with the same JSON error", async () => {
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"id":'));
        controller.error(new Error("connection reset"));
      },
    });
    const response = await handleGameRequest(
      request("/api/marvelcdb-import/decklist/1"),
      env,
      async () => new Response(broken, { headers: { "content-type": "application/json" } }),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(((await response.json()) as { error: string }).error).toContain("connection reset");
  });
});

describe("the game's Cloudflare config", () => {
  const wrangler = read("wrangler.game.jsonc");
  const redirects = read("cloudflare/game/_redirects");
  const headers = read("cloudflare/game/_headers");
  const netlify = read("../../netlify.toml");

  test("declares the game's address as its custom domain, so a deploy keeps it", () => {
    const host = new URL(GAME_URL).host;
    expect(wrangler).toContain(`"routes": [{ "pattern": "${host}", "custom_domain": true }]`);
    const landing = read("wrangler.landing.jsonc");
    for (const host of [new URL(LANDING_URL).host, `www.${new URL(LANDING_URL).host}`])
      expect(landing).toContain(`{ "pattern": "${host}", "custom_domain": true }`);
  });

  test("sends only the MarvelCDB route to the script, matching the client's route", () => {
    expect(wrangler).toContain(`"run_worker_first": ["${MARVELCDB_IMPORT_ROUTE}*"]`);
    expect(read("src/platform/deck-fetch.ts")).toContain(`const ROUTE = "${MARVELCDB_IMPORT_ROUTE}";`);
  });

  test("sends the release pages to the landing site, and the retired page to the same report netlify.toml does", () => {
    expect(redirects).toContain(`/releases/*            ${LANDING_URL}releases/:splat    301`);
    const netlifyTarget = /from = "\/shadowland-info\.html"\nto = "\/releases\/(v[\d.]+)\/index\.html"/.exec(netlify);
    expect(netlifyTarget).not.toBeNull();
    expect(redirects).toContain(`/shadowland-info.html  ${LANDING_URL}releases/${netlifyTarget![1]}/  302`);
  });

  test("the retired page opens the report the title bar points at", () => {
    expect(redirects).toContain(`releases/${RELEASE_NOTICE_VERSION}/`);
  });

  test("caches everything netlify.toml caches", () => {
    const netlifyCached = [...netlify.matchAll(/for = "([^"]+)"\n\[headers\.values\]\nCache-Control = "([^"]+)"/g)];
    expect(netlifyCached.length).toBeGreaterThan(0);
    for (const [, path, value] of netlifyCached) expect(headers).toContain(`${path}\n  Cache-Control: ${value}`);
  });
});
