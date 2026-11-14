/**
 * House-rule packs in the client (docs/custom-content-packs.md §11.11), on the two community packs as they build:
 * Lost Traits' traits reach a game only while its rule is on, a trait-gated card sees them, the game's save carries the
 * rule, and GMW Fixes is what offers the Balanced campaign option without which a Balanced run still plays.
 */
import "fake-indexeddb/auto";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PackManifest } from "@mc/content";
import { applyCommand, createGame, legalActions, traitsOf, type GameState, type EngineDeps } from "@mc/engine";
import type { CorePlayer } from "@mc/cards";
import { buildPack } from "@mc/mod-sdk/build";
import { setGamePacks } from "../content/game-deps.js";
import {
  CARDS_BY_ID,
  POOL_CARDS,
  POOL_STARTER_DECKS,
  POOL_VERSION,
  buildScenario,
  currentPool,
  poolViewWithPacks,
} from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { MemoryGameStorage, isCustomSave } from "../engine/game-storage.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { CampaignService } from "../campaign/campaign-service.js";
import { balancedScansOf } from "../art/balanced-art.js";
import { hasBalancedPrompt } from "../view/campaign-balanced-model.js";
import { preconDecks } from "../view/deck-list-model.js";
import { applySetupOption, setupOptionRowsOf } from "../view/setup-options.js";
import { initialSetupDraft, toSessionConfig } from "../view/setup-draft.js";
import { balancedModInstalled, installedSetupHouseRules, withLoadedPacks } from "./game-packs.js";
import { loadPackRuntime } from "./pack-load.js";
import { setLoadedPacks } from "./pack-registry.js";
import type { PackRuntime } from "./pack-runtime.js";

const COMMUNITY = fileURLToPath(new URL("../../../../content-packs/community", import.meta.url));
const dirs: string[] = [];
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

/** A community pack built and loaded as the client loads an installed one (`loadPackRuntime`, validation included). */
async function loaded(name: string): Promise<PackRuntime> {
  const out = mkdtempSync(join(tmpdir(), `mc-house-rule-${name}-`));
  dirs.push(out);
  // The cover is git-ignored like the pictures: build a copy without it when a checkout (CI) has none.
  const src = mkdtempSync(join(tmpdir(), `mc-house-rule-src-${name}-`));
  dirs.push(src);
  cpSync(join(COMMUNITY, name), src, { recursive: true });
  const manifestFile = join(src, "pack.json");
  const source = JSON.parse(readFileSync(manifestFile, "utf8")) as Record<string, unknown>;
  if (typeof source.cover === "string" && !existsSync(join(src, ...source.cover.split("/")))) {
    delete source.cover;
    writeFileSync(manifestFile, JSON.stringify(source));
  }
  await buildPack(src, out);
  const manifest = JSON.parse(readFileSync(join(out, "pack.json"), "utf8")) as PackManifest;
  const files = new Map<string, Uint8Array>();
  for (const full of walk(out)) {
    const path = relative(out, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
  const result = loadPackRuntime(manifest, files);
  if (!result.ok) throw new Error(result.reason);
  return result.runtime;
}

let lostTraits: PackRuntime;
let gmwFixes: PackRuntime;
beforeAll(async () => {
  lostTraits = await loaded("lost-traits-bf");
  gmwFixes = await loaded("gmw-fixes-gg");
});
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  setLoadedPacks([]);
  setGamePacks(undefined);
});

const heroTraitsIn = (cards: readonly { readonly id: unknown; readonly type: string }[], id: string): string[] => {
  const card = cards.find((one) => one.id === id) as { hero?: { traits: readonly string[] } } | undefined;
  return [...(card?.hero?.traits ?? [])];
};

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" };

describe("Lost Traits: the pool a game runs on", () => {
  it("loads as a house rule with its trait additions and the setup toggle's words", () => {
    expect(lostTraits.cards).toEqual([]);
    expect(lostTraits.houseRule?.traitAdditions).toHaveLength(13);
    expect(lostTraits.houseRule?.description).toMatch(/Bluefire/);
  });

  it("gives Spider-Man Web-Warrior in a game that carries the rule, and never in the app's browsing pool", () => {
    expect(heroTraitsIn(poolViewWithPacks([lostTraits]).cards, "01001a")).toContain("WEB-WARRIOR");
    expect(heroTraitsIn(poolViewWithPacks([]).cards, "01001a")).not.toContain("WEB-WARRIOR");
    setLoadedPacks([lostTraits]);
    expect(heroTraitsIn(currentPool(), "01001a")).not.toContain("WEB-WARRIOR");
    expect(heroTraitsIn([CARDS_BY_ID.get("01001a")!], "01001a")).toEqual(["AVENGER"]);
  });
});

/** Answers every pending choice with the fewest selections, declining defense, until the player phase. */
function toPlayerPhase(start: GameState, deps: EngineDeps): GameState {
  let state = start;
  for (let guard = 0; state.pendingChoice && !state.outcome && state.step.phase !== "player"; guard++) {
    if (guard > 200) throw new Error("setup choices did not settle");
    const choice = state.pendingChoice;
    const picked =
      choice.prompt.kind === "declareDefender"
        ? ["decline"]
        : choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
    const next = applyCommand(
      state,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: picked },
      deps,
    );
    if (!next.ok) throw new Error(next.error.message);
    state = next.state;
  }
  return state;
}

/**
 * A Core Spider-Man game with Spider-Ham (31021: "Play only if you control a Web-Warrior card.") moved into hand and
 * Peter flipped to Spider-Man. Whether Spider-Ham is offered is what a trait-gated card sees.
 */
function spiderHamOffered(packs: readonly PackRuntime[]): { offered: boolean; identityTraits: readonly string[] } {
  const view = poolViewWithPacks(packs);
  const precon = POOL_STARTER_DECKS.find((deck) => (deck.id as string) === SPIDER_MAN.starterDeckId)!;
  const seat: CorePlayer = {
    identityCardId: "01001a",
    aspects: precon.aspects as never,
    deck: [
      ...precon.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId as string)),
      "31021",
    ],
  };
  const built = buildScenario("rhino", { difficulty: "standard", players: [seat], seed: 21 });
  const created = createGame({ ...built, cards: view.cards }, view.deps);
  if (!created.ok) throw new Error(created.error.message);
  let state = toPlayerPhase(created.state, view.deps);
  const player = state.players[0]!;
  const flipped = applyCommand(state, { type: "changeForm", playerId: player.playerId }, view.deps);
  if (!flipped.ok) throw new Error(flipped.error.message);
  state = toPlayerPhase(flipped.state, view.deps);
  const me = state.players[0]!;
  const ham = [...me.deck, ...me.discard, ...me.hand].find((id) => state.instances[id]?.cardId === "31021")!;
  state = {
    ...state,
    players: state.players.map((p, i) =>
      i === 0
        ? {
            ...p,
            deck: p.deck.filter((id) => id !== ham),
            discard: p.discard.filter((id) => id !== ham),
            hand: p.hand.includes(ham) ? p.hand : [...p.hand, ham],
          }
        : p,
    ),
  };
  const actions = legalActions(state, me.playerId, view.deps);
  return {
    offered:
      actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === ham),
    identityTraits: traitsOf(state, me.identity.instanceId, view.deps).map(String),
  };
}

describe("Lost Traits: a trait-gated card sees the added trait", () => {
  it("offers Spider-Ham to Core Spider-Man only with the rule on (he is a Web-Warrior then)", () => {
    const on = spiderHamOffered([lostTraits]);
    expect(on.identityTraits).toContain("WEB-WARRIOR");
    expect(on.offered).toBe(true);
    const off = spiderHamOffered([]);
    expect(off.identityTraits).not.toContain("WEB-WARRIOR");
    expect(off.offered).toBe(false);
  });
});

describe("Lost Traits: switched on in Table setup", () => {
  it("is one toggle in the setup options, only while installed, and goes into the session config", () => {
    const draft = initialSetupDraft({ scenarioId: "rhino", seatDeckId: null, seed: 1 });
    expect(installedSetupHouseRules()).toEqual([]);
    expect(setupOptionRowsOf(draft, new Map(), undefined, installedSetupHouseRules())).toEqual(
      setupOptionRowsOf(draft, new Map()),
    );
    setLoadedPacks([lostTraits, gmwFixes]);
    const rules = installedSetupHouseRules();
    // GMW Fixes enables a campaign mode: it is no per-game toggle.
    expect(rules.map((rule) => rule.id)).toEqual(["lost-traits-bf"]);
    const row = setupOptionRowsOf(draft, new Map(), undefined, rules).find((r) => r.id === "houseRule:lost-traits-bf");
    expect(row).toMatchObject({ name: "House rule: Lost Traits", active: false, control: { kind: "toggle" } });
    const on = applySetupOption(draft, "houseRule:lost-traits-bf", undefined, rules);
    expect(on.houseRules).toEqual(["lost-traits-bf"]);
    expect(setupOptionRowsOf(on, new Map(), undefined, rules).find((r) => r.id === row!.id)?.active).toBe(true);
    expect(toSessionConfig(on, [SPIDER_MAN]).houseRules).toEqual(["lost-traits-bf"]);
    const off = applySetupOption(on, "houseRule:lost-traits-bf", undefined, rules);
    expect(off.houseRules).toBeUndefined();
    expect(Object.hasOwn(toSessionConfig(off, [SPIDER_MAN]), "houseRules")).toBe(false);
    // A rule that is not installed cannot be switched on.
    expect(applySetupOption(draft, "houseRule:lost-traits-bf", undefined, []).houseRules).toBeUndefined();
  });

  it("embeds the rule in the game it is on for, and in no other", () => {
    setLoadedPacks([lostTraits]);
    const base = { scenarioId: "rhino", difficulty: "standard" as const, players: [SPIDER_MAN], seed: 3 };
    const on = withLoadedPacks({ ...base, houseRules: ["lost-traits-bf"] });
    expect(on.packs?.map((pack) => pack.id)).toEqual(["lost-traits-bf"]);
    expect(on.houseRules).toEqual(["lost-traits-bf"]);
    expect(Object.hasOwn(withLoadedPacks(base), "packs")).toBe(false);
    // Switched on but no longer installed: nothing is embedded, and the config does not claim it.
    setLoadedPacks([]);
    const gone = withLoadedPacks({ ...base, houseRules: ["lost-traits-bf"] });
    expect(Object.hasOwn(gone, "packs")).toBe(false);
    expect(Object.hasOwn(gone, "houseRules")).toBe(false);
  });

  it("plays and resumes with the traits from the save, installed or not, and counts as an ordinary game", async () => {
    setLoadedPacks([lostTraits]);
    const storage = new MemoryGameStorage();
    const host = new LocalEngineHost(storage);
    const update = await host.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [SPIDER_MAN],
      seed: 3,
      houseRules: ["lost-traits-bf"],
    });
    const identity = update.state.players[0]!.identity.instanceId;
    const deps = poolViewWithPacks([lostTraits]).deps;
    // Peter Parker's alter-ego is unchanged; the hero face (Spider-Man) is the one with Web-Warrior.
    expect(traitsOf(update.state, identity, deps).map(String)).not.toContain("WEB-WARRIOR");
    const [meta] = await storage.list();
    expect(meta!.config.packs?.map((pack) => pack.id)).toEqual(["lost-traits-bf"]);
    expect(isCustomSave(meta!)).toBe(false);
    expect(isCustomSave({ config: { packs: [{ id: "sample-hero" }] } })).toBe(true);

    setLoadedPacks([]);
    const resumed = await new LocalEngineHost(storage).resume(meta!.id);
    expect(resumed.config?.packs?.map((pack) => pack.id)).toEqual(["lost-traits-bf"]);
    const cardOf = resumed.state.instances[identity]!.cardId as string;
    expect(cardOf).toBe("01001a");
    expect(heroTraitsIn(poolViewWithPacks(resumed.config!.packs!).cards, "01001a")).toContain("WEB-WARRIOR");
    // The engine sees it: built from the resumed config's packs alone (nothing installed), flipped Spider-Man is a
    // Web-Warrior and a trait-gated card (Spider-Ham) is offered.
    const afterResume = spiderHamOffered(resumed.config!.packs!);
    expect(afterResume.identityTraits).toContain("WEB-WARRIOR");
    expect(afterResume.offered).toBe(true);
  });
});

describe("GMW Fixes: the Balanced campaign option", () => {
  const POOL = Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card]));
  const deckNamed = (id: string) => preconDecks(POOL_VERSION).find((deck) => (deck.id as string).includes(id))!;
  const ROSTER = [deckNamed("groot"), deckNamed("rocket")].map((deck) => ({
    identityCardId: deck.identityCardId,
    deck,
  }));
  const service = (): CampaignService =>
    new CampaignService({
      storage: new MemoryCampaignStorage(),
      campaignDeps: { pool: POOL },
      engineDeps: poolViewWithPacks([]).deps,
      now: () => 1_000,
      newId: () => "run-1",
    });

  it("is offered only with the GMW Fixes pack installed", () => {
    expect(balancedModInstalled()).toBe(false);
    expect(hasBalancedPrompt("gmw", balancedModInstalled())).toBe(false);
    setLoadedPacks([lostTraits]);
    expect(hasBalancedPrompt("gmw", balancedModInstalled())).toBe(false);
    setLoadedPacks([gmwFixes]);
    expect(hasBalancedPrompt("gmw", balancedModInstalled())).toBe(true);
  });

  it("keeps a run signed Balanced loading and playing its rules with the pack removed", async () => {
    setLoadedPacks([gmwFixes]);
    const campaigns = service();
    const signed = await campaigns.start({
      campaignId: "gmw",
      seats: ROSTER,
      balanced: { toggles: ["spacePirates"] },
      poolVersion: POOL_VERSION,
      seed: 7,
    });
    setLoadedPacks([]);
    const loadedRun = await campaigns.load(signed.id);
    expect(loadedRun?.modes.campaign?.balanced).toBe(true);
    // Its games are set up from the run's own modes (`launchConfig`), which still say Balanced: the scripted rules
    // gate on that flag, and its Balanced cards still show (the old edited scans without the pack).
    expect([...balancedScansOf({ modes: loadedRun!.modes })]).toContain("16070");
  });
});
