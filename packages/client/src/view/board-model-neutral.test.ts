/**
 * God of Lies on the board (docs/phase7-wave9.md sections 3.59 to 3.61, 3.66): the pod's neutral area, Loki's shared
 * dial and flip point, Worlds Collide's shared threat and the loss it causes, the Synergy environments' counters against
 * their limit, shatter counters on the Avatar, and the rules cards. A real game from the playable pool, so the numbers
 * are the engine's, never restated here.
 */
import { podOf, type GameState } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS, POOL_SCENARIOS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { boardModel, counterNote } from "./board-model.js";
import { inspectModel, referenceInspectModel } from "./inspect-model.js";
import { neutralNotes } from "./neutral-notes.js";
import { referenceCardViews } from "./reference-cards.js";
import { referenceArtFor } from "../art/reference-art.js";

let game: GameState;
let me: string;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "god-of-lies",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 7,
  });
  game = store.state.game!;
  me = store.state.perspectiveId!;
}, 30_000);

const model = (state: GameState) => boardModel(state, me as never, POOL_DEPS);

/** The shared record moved the way the engine's own reducer would leave it: a damaged and maybe flipped Loki, some threat. */
function withShared(state: GameState, patch: Partial<NonNullable<ReturnType<typeof podOf>["shared"]>>): GameState {
  const pod = podOf(state);
  return { ...state, pod: { ...pod, shared: { ...pod.shared!, ...patch } } } as GameState;
}

describe("the neutral area", () => {
  test("is its own area, named neutral, holding Loki and Worlds Collide apart from the Avatar and the main scheme", () => {
    const m = model(game);
    const area = m.scenarioPlayAreas.find((entry) => entry.neutral);
    expect(area?.name).toBe("neutral");
    expect(area?.closed).toBe(true);
    expect(area?.cards.map((card) => card.name)).toEqual(["Loki, God of Lies", "Worlds Collide"]);
    // The villain and main scheme the group plays against are the Avatar and Mischief and Mayhem.
    expect(m.villain!.name).toMatch(/^Loki the /);
    expect(m.mainScheme.name).toBe("Mischief and Mayhem");
    expect(area?.cards.map((card) => card.instanceId)).not.toContain(m.villain!.instanceId);
  });

  test("Loki shows the shared dial and the flip point; Worlds Collide the shared threat and the loss", () => {
    const [loki, worlds] = model(game).scenarioPlayAreas.find((entry) => entry.neutral)!.cards;
    expect(loki!.panel.hp).toEqual({ current: 20, max: 20 });
    expect(loki!.panel.stats.find((tile) => tile.label === "HP")?.value).toBe("20/20");
    expect(loki!.subtitle).toBe("Neutral villain");
    expect(loki!.note).toBe("Flips at 10 left");
    expect(worlds!.scheme).toMatchObject({ threat: 0, target: 2, meterMax: 2, isMain: true });
    expect(worlds!.note).toBe("Lose at 2 threat");
  });

  test("the numbers move with the shared record, not the instances", () => {
    const hurt = withShared(game, { villainDamage: 12, schemeThreat: 1 });
    const [loki, worlds] = model(hurt).scenarioPlayAreas.find((entry) => entry.neutral)!.cards;
    expect(loki!.panel.hp).toEqual({ current: 8, max: 20 });
    expect(worlds!.scheme?.threat).toBe(1);
    expect(worlds!.threat).toBe(1);
  });

  test("a flipped Loki says defeating him wins; a completed scheme says to defeat Loki or lose", () => {
    const late = withShared(game, {
      villainDamage: 12,
      villainFlipped: true,
      schemeThreat: 2,
      status: "schemeCompleted",
    });
    const [loki, worlds] = model(late).scenarioPlayAreas.find((entry) => entry.neutral)!.cards;
    expect(loki!.note).toBe("Flipped · defeat him to win");
    expect(worlds!.note).toBe("Complete · defeat Loki or lose");
    expect(model(withShared(late, { status: "lost" })).scenarioPlayAreas[0]!.cards[1]!.note).toBe(
      "Complete · you lose",
    );
  });

  test("the bySetup placeholder villain is not a tile: one Avatar in play, one villain on the board", () => {
    expect(game.villains.length).toBeGreaterThan(1);
    expect(model(game).villains).toHaveLength(1);
    expect(model(game).villains[0]!.active).toBe(true);
  });
});

describe("Synergy environments and shatter counters", () => {
  test("each environment reads 0/1 for one player, with the kind named", () => {
    const { environments } = model(game);
    expect(environments.map((env) => env.name).sort()).toEqual([
      "Domineering Force",
      "Feigned Retreat",
      "Mounting Resistance",
      "Unified Front",
    ]);
    for (const env of environments) expect(env.counters).toEqual([{ name: "synergy", count: 0, limit: 1 }]);
  });

  test("a held counter keeps its count against the limit", () => {
    const env = model(game).environments[0]!;
    const held = {
      ...game,
      instances: {
        ...game.instances,
        [env.instanceId]: { ...game.instances[env.instanceId]!, counters: { synergy: 1 } },
      },
    } as GameState;
    expect(model(held).environments.find((entry) => entry.instanceId === env.instanceId)!.counters).toEqual([
      { name: "synergy", count: 1, limit: 1 },
    ]);
  });

  test("counterNote words a limit as a fraction with the word max, and a goal as before", () => {
    expect(counterNote([], {}, { synergy: 1 })).toBe("0/1 synergy counters (max)");
    expect(counterNote([{ name: "synergy", count: 1 }], {}, { synergy: 1 })).toBe("1/1 synergy counters (max)");
    expect(counterNote([{ name: "charm", count: 2 }], { charm: 5 })).toBe("2 of 5 charm counters");
  });

  test("shatter counters on the Avatar show on its panel", () => {
    const avatar = game.activeVillainId;
    const marked = {
      ...game,
      instances: { ...game.instances, [avatar]: { ...game.instances[avatar]!, counters: { shatter: 2 } } },
    } as GameState;
    expect(model(marked).villain!.counters).toEqual([{ name: "shatter", count: 2 }]);
  });
});

describe("Inspect", () => {
  test("words the shared numbers for both neutral cards, and leaves every other card alone", () => {
    const area = model(game).scenarioPlayAreas.find((entry) => entry.neutral)!;
    const [loki, worlds] = area.cards;
    expect(neutralNotes(game, loki!.instanceId)?.damage).toBe(
      "20 of 20 hit points left, shared by the whole pod · flips at 10 left",
    );
    expect(neutralNotes(game, worlds!.instanceId)?.threat).toBe(
      "0 of 2 threat, shared by the whole pod · the players lose at 2",
    );
    expect(neutralNotes(game, game.activeVillainId)).toBeNull();
    const sheet = inspectModel(game, worlds!.instanceId, null, me as never, POOL_DEPS);
    expect(sheet?.threatNote).toContain("0 of 2 threat");
    expect(sheet?.areaNotes.join(" ")).toContain("neutral area");
  });

  test("the scenario's two rules cards are reference sheets with their text and scan", () => {
    const scenario = POOL_SCENARIOS.find((entry) => entry.id === "god-of-lies")!;
    const cards = referenceCardViews(scenario);
    expect(cards.map((card) => card.id)).toEqual(["shatter-the-illusion", "epic-multiplayer-reminder"]);
    expect(cards[0]!.art).not.toBeNull();
    const sheet = referenceInspectModel(cards[0]!);
    expect(sheet.name).toBe("Shatter the Illusion");
    expect(sheet.typeLine).toBe("Rules card");
    expect(sheet.rulesText).toContain("Deal each player 1 facedown encounter card.");
    expect(sheet.art).toBe(cards[0]!.art);
  });

  test("a rules card with no scan in the bundle is the text alone", () => {
    expect(referenceArtFor("docs/campaign-modes/mc55-reference-cards/none.png", {})).toBeNull();
    const [card] = referenceCardViews(
      POOL_SCENARIOS.find((entry) => entry.id === "god-of-lies")!,
      () => null,
    );
    expect(card!.art).toBeNull();
    expect(referenceInspectModel(card!).rulesText).toContain("Remove each shatter counter");
  });

  test("a scenario with no rules cards has none", () => {
    expect(referenceCardViews(POOL_SCENARIOS.find((entry) => entry.id === "enchantress"))).toEqual([]);
  });
});
