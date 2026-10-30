import { describe, expect, it } from "vitest";
import {
  GLOBAL_MAX_BODY_BYTES,
  GLOBAL_MIN_GAMES,
  type GlobalError,
  type GlobalResult,
  type GlobalStats,
  type GlobalVillainCards,
} from "./global-protocol.js";
import {
  GLOBAL_MAX_CARD_ROW_BYTES,
  GLOBAL_MAX_KEYS,
  GLOBAL_RESULTS_PER_DAY,
  GLOBAL_SUMMARY_TTL_MS,
  GlobalStatsLogic,
} from "./global-stats.js";
import { handleRequest, type HandlerDeps } from "./handler.js";
import { GLOBAL_READS_PER_IP_PER_HOUR, GLOBAL_RESULTS_PER_IP_PER_DAY } from "./rate-limiter.js";
import { MemoryStorage, makeEnv, type TestEnv } from "./test-support.js";

const ORIGIN = "https://marvel-champions-digital-game.netlify.app";
const START = Date.UTC(2026, 9, 15, 12);
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function setup(overrides: Parameters<typeof makeEnv>[0] = {}) {
  const clock = { now: START };
  const env = makeEnv(overrides);
  const deps: HandlerDeps = {
    now: () => clock.now,
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    fetch: async () => Response.json({ success: true }),
  };
  const call = (request: Request, e: TestEnv = env) => handleRequest(request, e, deps);
  const store = () => env.GLOBAL_STATS.instances.get("global")!.storage;
  return { clock, env, call, store };
}
type Call = ReturnType<typeof setup>["call"];

const idOf = (n: number) => n.toString(16).padStart(32, "0");
const game = (n: number, patch: Partial<GlobalResult> = {}): GlobalResult => ({
  v: 1,
  id: idOf(n),
  villain: "Rhino",
  difficulty: "standard",
  modulars: ["bomb_scare"],
  seats: [{ hero: "spider_man", aspects: ["justice"], deck: ["card_a", "card_b"] }],
  won: true,
  cause: null,
  ...patch,
});
const loss = (n: number, cause: GlobalResult["cause"] = "scheme", patch: Partial<GlobalResult> = {}) =>
  game(n, { won: false, cause, ...patch });

const post = (call: Call, body: unknown, headers: Record<string, string> = {}) =>
  call(
    new Request("https://sync.test/global/result", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.1", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const get = (call: Call, path: string, headers: Record<string, string> = {}) =>
  call(new Request(`https://sync.test${path}`, { headers: { "CF-Connecting-IP": "203.0.113.1", ...headers } }));

describe("POST /global/result validation", () => {
  const rejected: [string, unknown][] = [
    ["wrong v", { ...game(1), v: 2 }],
    ["bad id", { ...game(1), id: "XYZ" }],
    ["uppercase id", { ...game(1), id: "A".repeat(32) }],
    ["bad villain", { ...game(1), villain: "<script>" }],
    ["empty villain", { ...game(1), villain: "" }],
    ["unknown difficulty", { ...game(1), difficulty: "heroic" }],
    ["bad modular key", { ...game(1), modulars: ["no spaces"] }],
    ["too many modulars", { ...game(1), modulars: Array.from({ length: 9 }, (_, i) => `m${i}`) }],
    ["repeated modular", { ...game(1), modulars: ["a", "a"] }],
    ["no seats", { ...game(1), seats: [] }],
    [
      "five seats",
      { ...game(1), seats: Array.from({ length: 5 }, (_, i) => ({ hero: `h${i}`, aspects: [], deck: [] })) },
    ],
    ["repeated hero", { ...game(1), seats: [game(1).seats[0], game(1).seats[0]] }],
    ["bad hero", { ...game(1), seats: [{ hero: "a b", aspects: [], deck: [] }] }],
    [
      "deck over cap",
      { ...game(1), seats: [{ hero: "h", aspects: [], deck: Array.from({ length: 81 }, (_, i) => `c${i}`) }] },
    ],
    ["bad card key", { ...game(1), seats: [{ hero: "h", aspects: [], deck: ["x".repeat(65)] }] }],
    ["win with a cause", { ...game(1), cause: "scheme" }],
    ["loss without a cause", { ...game(1), won: false, cause: null }],
    ["unknown cause", loss(1, "boredom" as never)],
    ["won not a boolean", { ...game(1), won: "yes" }],
    ["not an object", [1, 2]],
    ["null", null],
    ["not json", "{nope"],
  ];
  for (const [name, body] of rejected) {
    it(`rejects ${name}`, async () => {
      const { call, env } = setup();
      const res = await post(call, body);
      expect(res.status).toBe(400);
      expect(((await res.json()) as GlobalError).reason).toBe("bad-request");
      expect(env.GLOBAL_STATS.instances.size).toBe(0);
    });
  }

  it("accepts a win and a loss, and repeats a card once", async () => {
    const { call, store } = setup();
    const dup = game(1, { seats: [{ hero: "h", aspects: [], deck: ["a", "a", "b"] }] });
    expect((await post(call, dup)).status).toBe(200);
    expect((await post(call, loss(2, "other"))).status).toBe(200);
    expect(store().map.get("c:Rhino")).toMatchObject({ inWins: { a: 1, b: 1 } });
  });

  it("refuses a body over the cap, declared or streamed", async () => {
    const { call } = setup();
    const big = JSON.stringify({ ...game(1), pad: "x".repeat(GLOBAL_MAX_BODY_BYTES) });
    const res = await post(call, big);
    expect(res.status).toBe(413);
    expect(((await res.json()) as GlobalError).reason).toBe("too-large");
    const declared = await post(call, "{}", { "Content-Length": String(GLOBAL_MAX_BODY_BYTES + 1) });
    expect(declared.status).toBe(413);
  });
});

describe("counting", () => {
  it("counts a game into villain, modular, hero and card rows", async () => {
    const { call, store } = setup();
    const res = await post(call, loss(1, "villain"));
    expect(await res.json()).toEqual({ counted: true });
    const map = store().map;
    expect(map.get("v:Rhino")).toEqual({ games: 1, wins: 0, causes: { villain: 1 } });
    expect(map.get("m:bomb_scare")).toEqual({ games: 1, wins: 0, causes: { villain: 1 } });
    expect(map.get("h:spider_man")).toEqual({ games: 1, wins: 0, causes: { villain: 1 } });
    expect(map.get("c:Rhino")).toEqual({
      wins: 0,
      losses: 1,
      inWins: {},
      inLosses: { card_a: 1, card_b: 1 },
    });
  });

  it("counts a hero once per game and a deck card per seat", async () => {
    const { call, store } = setup();
    const seats = [
      { hero: "a", aspects: [], deck: ["shared", "only_a"] },
      { hero: "b", aspects: [], deck: ["shared"] },
    ];
    await post(call, game(1, { seats, modulars: [] }));
    expect(store().map.get("h:a")).toMatchObject({ games: 1 });
    expect(store().map.get("h:b")).toMatchObject({ games: 1 });
    expect(store().map.get("c:Rhino")).toMatchObject({ wins: 2, inWins: { shared: 2, only_a: 1 } });
  });

  it("writes a game in one put of about 7 rows", async () => {
    const { call, store } = setup();
    await post(call, game(1));
    // dedupe, villain, modular, hero, cards, meta.
    expect(store().rowsWritten).toBe(6);
    const before = store().rowsWritten;
    await post(call, game(1));
    expect(store().rowsWritten).toBe(before);
  });

  it("counts a retry and a second device once", async () => {
    const { call, store } = setup();
    expect(await (await post(call, game(1))).json()).toEqual({ counted: true });
    const again = await post(call, game(1));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ counted: false });
    // Another device, another address, the same game id.
    const other = await post(call, game(1), { "CF-Connecting-IP": "198.51.100.9" });
    expect(await other.json()).toEqual({ counted: false });
    expect(store().map.get("v:Rhino")).toMatchObject({ games: 1 });
  });

  it("stores nothing about the caller", async () => {
    const { call, store } = setup();
    await post(call, game(1), { "CF-Connecting-IP": "203.0.113.77" });
    expect(JSON.stringify([...store().map])).not.toContain("203.0.113.77");
  });
});

describe("dedupe month buckets", () => {
  it("dedupes across the month boundary, then forgets after the alarm drops the bucket", async () => {
    const { call, clock, store } = setup();
    await post(call, game(1));
    expect(store().map.has(`g:202610:${idOf(1)}`)).toBe(true);
    expect(store().alarm).toBe(Date.UTC(2026, 10, 1, 1));

    clock.now = Date.UTC(2026, 10, 2); // next month: the previous bucket still dedupes
    expect(await (await post(call, game(1))).json()).toEqual({ counted: false });

    // Two months on, the alarm drops the October bucket.
    clock.now = Date.UTC(2026, 11, 2);
    await new GlobalStatsLogic(store()).expire(clock.now);
    expect(store().map.has(`g:202610:${idOf(1)}`)).toBe(false);
  });

  it("keeps the previous month's bucket and drops older ones, in batches", async () => {
    const storage = new MemoryStorage();
    const logic = new GlobalStatsLogic(storage);
    for (let i = 0; i < 150; i++) storage.map.set(`g:202601:${idOf(i)}`, 1);
    storage.map.set(`g:202609:${idOf(1)}`, 1);
    storage.map.set(`g:202610:${idOf(2)}`, 1);
    await logic.record(game(900), Date.UTC(2026, 9, 15));
    const now = Date.UTC(2026, 9, 15);
    await logic.expire(now);
    expect([...storage.map.keys()].filter((k) => k.startsWith("g:202601")).length).toBe(50);
    expect(storage.alarm).toBe(now + 60_000);
    await logic.expire(now);
    expect([...storage.map.keys()].filter((k) => k.startsWith("g:202601")).length).toBe(0);
    expect(storage.map.has(`g:202609:${idOf(1)}`)).toBe(true);
    expect(storage.map.has(`g:202610:${idOf(2)}`)).toBe(true);
    expect(storage.alarm).toBe(Date.UTC(2026, 10, 1, 1));
  });
});

describe("store caps", () => {
  it("answers full for a game that needs a key past the cap, and counts known keys still", async () => {
    const storage = new MemoryStorage();
    const logic = new GlobalStatsLogic(storage);
    const now = START;
    // Each villain costs two keys (its row and its card row); one hero shared by all.
    let n = 0;
    for (; ; n++) {
      const out = await logic.record(game(n, { villain: `V${n}`, modulars: [] }), now);
      if (!out.ok) {
        expect(out.reason).toBe("full");
        break;
      }
    }
    expect(n).toBeGreaterThan(1000);
    const keys = [...storage.map.keys()].filter((k) => /^[vmhc]:/.test(k)).length;
    expect(keys).toBeLessThanOrEqual(GLOBAL_MAX_KEYS);
    // A full store wrote nothing for the refused game, and still counts games on rows it already has.
    expect(storage.map.has(`g:202610:${idOf(n)}`)).toBe(false);
    expect(await logic.record(game(99_999, { villain: "V0", modulars: [] }), now)).toEqual({ ok: true, counted: true });
  });

  it("caps results per day, resets next day, and still answers a retry", async () => {
    const storage = new MemoryStorage();
    const logic = new GlobalStatsLogic(storage);
    for (let i = 0; i < GLOBAL_RESULTS_PER_DAY; i++) await logic.record(game(i), START);
    const refused = await logic.record(game(GLOBAL_RESULTS_PER_DAY), START);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe("rate-limited");
      expect(refused.retryAfterMs).toBe(Math.floor(START / DAY + 1) * DAY - START);
    }
    expect(await logic.record(game(0), START)).toEqual({ ok: true, counted: false });
    expect((await logic.record(game(GLOBAL_RESULTS_PER_DAY), START + DAY)).ok).toBe(true);
  });

  it("answers 429 with Retry-After at the daily cap and 507 when full", async () => {
    const { call, env } = setup();
    await post(call, game(1));
    const storage = env.GLOBAL_STATS.instances.get("global")!.storage;
    const meta = storage.map.get("meta") as { dayCount: number; keys: number };
    meta.dayCount = GLOBAL_RESULTS_PER_DAY;
    const capped = await post(call, game(2));
    expect(capped.status).toBe(429);
    expect(Number(capped.headers.get("Retry-After"))).toBeGreaterThan(0);
    meta.dayCount = 0;
    meta.keys = GLOBAL_MAX_KEYS;
    const full = await post(call, game(3, { villain: "Brand New" }));
    expect(full.status).toBe(507);
    expect(((await full.json()) as GlobalError).reason).toBe("full");
  });

  it("bounds a card row: the game counts, new cards are left out past the cap", async () => {
    const storage = new MemoryStorage();
    const logic = new GlobalStatsLogic(storage);
    for (let g = 0; g < 80; g++) {
      const deck = Array.from(
        { length: 80 },
        (_, i) => `card_${String(g).padStart(3, "0")}_${String(i).padStart(3, "0")}_xxxxxxxxxxxxxxxx`,
      );
      const out = await logic.record(game(g, { seats: [{ hero: "h", aspects: [], deck }], modulars: [] }), START);
      expect(out).toEqual({ ok: true, counted: true });
    }
    const row = storage.map.get("c:Rhino") as { wins: number };
    expect(row.wins).toBe(80);
    expect(JSON.stringify(row).length).toBeLessThanOrEqual(GLOBAL_MAX_CARD_ROW_BYTES);
    // Cards already in the row still count after it is full.
    await logic.record(
      game(500, { seats: [{ hero: "h", aspects: [], deck: ["card_000_000_xxxxxxxxxxxxxxxx"] }], modulars: [] }),
      START,
    );
    expect(
      (storage.map.get("c:Rhino") as { inWins: Record<string, number> }).inWins["card_000_000_xxxxxxxxxxxxxxxx"],
    ).toBe(2);
  });
});

describe("routes", () => {
  it("answers 503 on every route when GLOBAL_STATS_ENABLED is not true, status included", async () => {
    for (const value of ["false", "", undefined]) {
      const { call, env } = setup(
        value === undefined ? { GLOBAL_STATS_ENABLED: undefined as never } : { GLOBAL_STATS_ENABLED: value },
      );
      for (const res of [
        await post(call, game(1)),
        await get(call, "/global/stats"),
        await get(call, "/global/cards?villain=Rhino"),
        await get(call, "/global/status"),
      ]) {
        expect(res.status).toBe(503);
        expect(((await res.json()) as GlobalError).reason).toBe("disabled");
      }
      expect(env.GLOBAL_STATS.instances.size).toBe(0);
      expect(env.RATE_LIMITER.instances.size).toBe(0);
    }
  });

  it("answers status without touching the limiter or the store", async () => {
    const { call, env } = setup();
    const res = await get(call, "/global/status");
    expect(await res.json()).toEqual({ global: true });
    expect(env.GLOBAL_STATS.instances.size).toBe(0);
    expect(env.RATE_LIMITER.instances.size).toBe(0);
  });

  it("refuses a foreign origin, allows the app's, and answers preflight", async () => {
    const { call } = setup();
    const foreign = await post(call, game(1), { Origin: "https://evil.example" });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const ok = await post(call, game(1), { Origin: ORIGIN });
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const pre = await call(
      new Request("https://sync.test/global/result", { method: "OPTIONS", headers: { Origin: ORIGIN } }),
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const badPre = await call(
      new Request("https://sync.test/global/stats", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }),
    );
    expect(badPre.status).toBe(403);
  });

  it("answers 404 for an unknown route or method", async () => {
    const { call } = setup();
    expect((await get(call, "/global/nope")).status).toBe(404);
    expect((await get(call, "/global/result")).status).toBe(404);
    expect((await post(call, "{}", {})).status).toBe(400);
    expect((await call(new Request("https://sync.test/global/stats", { method: "POST", body: "{}" }))).status).toBe(
      404,
    );
  });
});

describe("rate limiting", () => {
  it("allows GLOBAL_RESULTS_PER_IP_PER_DAY results per IP, then 429 with Retry-After, and resets", async () => {
    const { call, clock } = setup();
    for (let i = 0; i < GLOBAL_RESULTS_PER_IP_PER_DAY; i++) expect((await post(call, game(i))).status).toBe(200);
    const blocked = await post(call, game(5000));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBe(DAY / 1000);
    expect(((await blocked.json()) as GlobalError).reason).toBe("rate-limited");
    // Another address is untouched; the same one is fine a day later.
    expect((await post(call, game(5001), { "CF-Connecting-IP": "198.51.100.2" })).status).toBe(200);
    clock.now += DAY + 1;
    expect((await post(call, game(5002))).status).toBe(200);
  });

  it("keeps a separate GET allowance that does not use up results", async () => {
    const { call, clock } = setup();
    for (let i = 0; i < GLOBAL_READS_PER_IP_PER_HOUR; i++) expect((await get(call, "/global/stats")).status).toBe(200);
    const blocked = await get(call, "/global/stats");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBe(HOUR / 1000);
    expect((await post(call, game(1))).status).toBe(200);
    clock.now += HOUR + 1;
    expect((await get(call, "/global/stats")).status).toBe(200);
  });

  it("does not spend allowance on a request it rejects as malformed", async () => {
    const { call, env } = setup();
    for (let i = 0; i < 5; i++) await post(call, "{nope");
    expect(env.RATE_LIMITER.instances.size).toBe(0);
  });
});

/** Fills a villain, a modular set and a hero to `n` games each through the real routes. */
async function fill(call: Call, n: number, from = 0, patch: Partial<GlobalResult> = {}) {
  for (let i = from; i < from + n; i++) {
    const res = await post(call, i % 4 === 0 ? loss(i, "minions", patch) : game(i, patch), {
      "CF-Connecting-IP": `10.0.${Math.floor(i / 50)}.${i % 50}`,
    });
    expect(res.status).toBe(200);
  }
}

describe("reads", () => {
  it("hides rows under the minimum and orders the rest", async () => {
    const { call } = setup();
    await fill(call, GLOBAL_MIN_GAMES);
    await fill(call, GLOBAL_MIN_GAMES - 1, 1000, { villain: "Klaw", modulars: ["rare_set"] });
    const res = await get(call, "/global/stats");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    const stats = (await res.json()) as GlobalStats;
    expect(stats.games).toBe(GLOBAL_MIN_GAMES * 2 - 1);
    expect(stats.villains.map((r) => r.key)).toEqual(["Rhino"]);
    expect(stats.modulars.map((r) => r.key)).toEqual(["bomb_scare"]);
    expect(stats.heroes[0]).toEqual({
      key: "spider_man",
      games: GLOBAL_MIN_GAMES * 2 - 1,
      wins: stats.heroes[0]!.wins,
      causes: stats.heroes[0]!.causes,
    });
    expect(stats.villains[0]).toMatchObject({ games: GLOBAL_MIN_GAMES, wins: 15, causes: { minions: 5 } });
  });

  it("serves the stored summary for an hour, then rebuilds on the next read", async () => {
    const { call, clock, store } = setup();
    await fill(call, GLOBAL_MIN_GAMES);
    const first = (await (await get(call, "/global/stats")).json()) as GlobalStats;
    expect(first.updatedAt).toBe(START);
    await fill(call, 5, 500);
    clock.now += GLOBAL_SUMMARY_TTL_MS - 1;
    const written = store().rowsWritten;
    const cached = (await (await get(call, "/global/stats")).json()) as GlobalStats;
    expect(cached).toEqual(first);
    expect(store().rowsWritten).toBe(written);
    clock.now += 1;
    const rebuilt = (await (await get(call, "/global/stats")).json()) as GlobalStats;
    expect(rebuilt.updatedAt).toBe(clock.now);
    expect(rebuilt.villains[0]!.games).toBe(GLOBAL_MIN_GAMES + 5);
  });

  it("serves cards only at the minimum decks, dropping cards in fewer than 3", async () => {
    const { call } = setup();
    await fill(call, GLOBAL_MIN_GAMES - 1);
    expect((await get(call, "/global/cards?villain=Rhino")).status).toBe(404);
    await post(call, game(900, { seats: [{ hero: "spider_man", aspects: [], deck: ["card_a", "rare_card"] }] }));
    await post(call, loss(901, "scheme", { seats: [{ hero: "spider_man", aspects: [], deck: ["rare_card"] }] }));
    const res = await get(call, "/global/cards?villain=Rhino");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    const cards = (await res.json()) as GlobalVillainCards;
    expect(cards.wins + cards.losses).toBe(GLOBAL_MIN_GAMES + 1);
    expect(cards.inWins.card_a).toBeGreaterThan(3);
    // rare_card is in 2 decks: left out.
    expect(cards.inWins.rare_card).toBeUndefined();
    expect(cards.inLosses.rare_card).toBeUndefined();
  });

  it("answers 404 for an unknown villain and 400 for a malformed one", async () => {
    const { call } = setup();
    expect((await get(call, "/global/cards?villain=Nobody")).status).toBe(404);
    expect((await get(call, "/global/cards")).status).toBe(400);
    expect((await get(call, "/global/cards?villain=%3Cb%3E")).status).toBe(400);
  });

  it("serves an empty summary before any game", async () => {
    const { call } = setup();
    const stats = (await (await get(call, "/global/stats")).json()) as GlobalStats;
    expect(stats).toMatchObject({ games: 0, villains: [], modulars: [], heroes: [] });
  });
});
