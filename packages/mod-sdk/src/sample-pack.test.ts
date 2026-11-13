import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYABLE_DEPS, coreScenario } from "@mc/cards";
import { PLAYABLE_CARDS, type PackManifest, type StarterDeck } from "@mc/content";
import { createGame, replay, type GameState } from "@mc/engine";
import { buildPack } from "./build.js";
import { cardPoolWithPack, gameDepsWithPack } from "./game.js";
import { buildPreview } from "./preview.js";
import { readPackInput, validatePack, type PackInput } from "./validate.js";
// The cards package's headless greedy player, as the precon e2e tests use it.
import { playToOutcome } from "@mc/cards/testing";

/**
 * The sample pack (content-packs/sample-hero): build it, validate the built output, then play its precon headless
 * against Core's Rhino with the pack's cards and abilities read back from the built JSON (what a client installs).
 */
const SAMPLE_DIR = fileURLToPath(new URL("../../../content-packs/sample-hero", import.meta.url));
const PACK = "x.sample-hero.";

let outDir = "";
let built: PackInput;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mc-sample-pack-"));
  await buildPack(SAMPLE_DIR, outDir);
  const manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
  const files = new Map<string, Uint8Array>();
  for (const full of walk(outDir)) {
    const path = relative(outDir, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
  built = readPackInput(manifest, files);
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe("sample-hero pack", () => {
  it("validates as built", () => {
    expect(validatePack(built)).toEqual([]);
  });

  it("carries its example achievements into the built pack.json and preview.json, naming only its own hero", () => {
    const list = built.manifest.achievements ?? [];
    expect(list.map((a) => a.id)).toEqual(["suited-up", "sentinel-rising", "seasoned-sentinel", "no-sweat"]);
    expect(list.every((a) => a.when.hero === "x.sample-hero.01a")).toBe(true);
    expect(buildPreview(built).preview.achievements).toEqual(list);
  });

  it("has one of each player card kind, an obligation and a nemesis set under the pack's own codes", () => {
    const types = built.cards.map((c) => c.type).sort();
    expect(types).toEqual(
      [
        "ally",
        "event",
        "hero_identity",
        "minion",
        "obligation",
        "side_scheme",
        "support",
        "treachery",
        "upgrade",
      ].sort(),
    );
    const identity = built.cards.find((c) => c.type === "hero_identity");
    if (identity?.type !== "hero_identity") throw new Error("no identity");
    expect(String(identity.obligationCardId)).toBe(`${PACK}06`);
    const nemesis = built.cards.filter(
      (c) =>
        "encounterSetIds" in c &&
        (c.encounterSetIds as readonly string[]).includes(String(identity.nemesisEncounterSetId)),
    );
    expect(nemesis.map((c) => c.type).sort()).toEqual(["minion", "side_scheme", "treachery"]);
  });
});

describe("sample-hero precon against Rhino (standard), greedy driver", () => {
  const deck = built_deck();
  function built_deck(): () => StarterDeck {
    return () => built.decks!.find((d) => d.id === "sample-hero-justice")!;
  }

  const open = (seed: number): GameState => {
    const precon = deck();
    const config = coreScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed,
      difficulty: "standard",
      modularSetIds: [],
      cardPool: cardPoolWithPack(PLAYABLE_CARDS, built),
    } as never);
    const created = createGame(
      {
        ...config,
        players: [
          {
            identityCardId: precon.identityCardId,
            aspects: precon.aspects,
            deck: precon.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
          },
        ],
      },
      gameDepsWithPack(PLAYABLE_DEPS, built),
    );
    if (!created.ok) throw new Error(created.error.message);
    return created.state;
  };

  it("is a 40-card deck", () => {
    expect(deck().cards.reduce((n, c) => n + c.quantity, 0)).toBe(40);
  });

  it("sets up with the pack's obligation shuffled in and its nemesis set aside", () => {
    const state = open(1);
    const codes = Object.values(state.instances).map((i) => String(i.cardId));
    for (const code of ["06", "07", "08", "09"]) expect(codes, `${PACK}${code}`).toContain(PACK + code);
  });

  const packCardsPlayed = new Set<string>();
  afterAll(() => {
    // Over the three games the greedy player plays at least one of the pack's own cards, so its scripts really ran.
    expect(packCardsPlayed.size, `pack cards played: ${[...packCardsPlayed].join(", ")}`).toBeGreaterThan(0);
  });

  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: plays to an outcome without an engine error, and replays deep-equal`, () => {
      const deps = gameDepsWithPack(PLAYABLE_DEPS, built);
      const run = playToOutcome(open(seed), deps, { maxCommands: 4000 });
      const state = run.session.state;
      expect(run.outcome, `no outcome after ${run.commands} commands, round ${run.rounds}`).not.toBeNull();
      expect(state.pendingChoice, "a prompt is still open at the end").toBeNull();
      const replayed = replay(run.session.log, deps);
      if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
      expect(replayed.state).toEqual(state);
      const played = replayed.events.flatMap((e) => (e.type === "cardPlayed" ? [String(e.cardId)] : []));
      expect(played.length, "cards played").toBeGreaterThanOrEqual(3);
      for (const code of played) if (code.startsWith(PACK)) packCardsPlayed.add(code);
    });
  }
});
