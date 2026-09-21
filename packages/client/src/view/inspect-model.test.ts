/**
 * The Inspect model, checked against a real Core Set game.
 *
 * The thing worth guarding here is that Inspect and the engine never disagree:
 * the verdict it shows must be the engine's own, and it must not show a face
 * the player isn't entitled to see.
 */

import { activeEncounterDeck, activeVillain, keywordsOf } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { abilityId } from "@mc/content";
import type { GameState, InstanceId, LegalActions, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { appendCardHistory, emptyCardHistoryLog } from "./card-history.js";
import { inspectModel, type InspectPayment } from "./inspect-model.js";
import { faceVisible } from "./visibility.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 12,
};

let store: SessionStore;
let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  // Decline the mulligan so the game reaches a real turn.
  for (let step = 0; step < 10 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
});

const inspect = (id: InstanceId) => inspectModel(state, id, store.state.legal?.actions ?? null, me, CORE_DEPS);

describe("inspectModel", () => {
  test("shows a card in your own hand, which is not 'faceup' to the engine", () => {
    const inHand = state.players.find((player) => player.playerId === me)!.hand[0]!;
    // The engine models a hand card as not faceup — it isn't on the table. The
    // player holding it is still looking at it, and this is the regression.
    expect(state.instances[inHand]!.faceup).toBe(false);

    const model = inspect(inHand);
    expect(model.hidden).toBe(false);
    expect(model.name).not.toBe("a facedown card");
    expect(model.typeLine).not.toBe("Facedown");
  });

  test("gives the card's whole current wording, not the table's crop", () => {
    const hand = state.players.find((player) => player.playerId === me)!.hand;
    const withText = hand.map(inspect).find((model) => model.rulesText.length > 0);
    expect(withText).toBeDefined();
    const card = state.cardPool[state.instances[withText!.instanceId]!.cardId]!;
    // `current`, not `printed`: the errata'd wording is what the game plays by.
    expect(withText!.rulesText).toBe("text" in card ? card.text.current : "");
  });

  test("names the set and collector number from the content, never invented", () => {
    const inHand = state.players.find((player) => player.playerId === me)!.hand[0]!;
    const card = state.cardPool[state.instances[inHand]!.cardId]!;
    expect(inspect(inHand).footerLeft).toBe(`${card.setCode as string} · ${card.collectorNumber}`);
  });

  test("repeats the engine's own verdict on a hand card", () => {
    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const illegal = legal.illegal.find((entry) => entry.action.kind === "playCard");
    expect(illegal).toBeDefined();
    const model = inspect((illegal!.action as { instanceId: InstanceId }).instanceId);
    expect(model.status.playable).toBe(false);
    // Word for word the engine's message: Inspect must not rephrase a ruling.
    expect(model.status.message).toBe(illegal!.message);
  });

  test("an identity reads as the form it is in — name, type line, stats and text, not only the picture", async () => {
    const identity = state.players[0]!.identity.instanceId;
    // Every game starts in alter-ego.
    const peter = inspect(identity);
    expect(peter.name).toBe("Peter Parker");
    expect(peter.typeLine).toMatch(/^ALTER-EGO/);
    expect(peter.rulesText).toContain("Scientist");
    expect(peter.rulesText).not.toContain("Spider-Sense");
    expect(peter.stats.map((tile) => tile.label.toLowerCase())).toEqual(expect.arrayContaining(["rec"]));
    expect(peter.stats.map((tile) => tile.label.toLowerCase())).not.toContain("atk");

    // Flipped, in a game of its own so the shared fixture stays in alter-ego for every other test.
    const flipped = new SessionStore(new LocalEngineHost());
    await flipped.start(RHINO_SOLO);
    for (let step = 0; step < 10 && flipped.state.legal?.actions.kind === "choice"; step++)
      await flipped.resolveChoice([]);
    const actions = flipped.state.legal!.actions;
    if (actions.kind !== "turn") throw new Error("expected a turn");
    const flip = actions.legal.find((entry) => entry.action.kind === "changeForm");
    if (!flip) throw new Error("expected a legal form change");
    await flipped.dispatch(flip.example);
    const spidey = inspectModel(
      flipped.state.game!,
      flipped.state.game!.players[0]!.identity.instanceId,
      flipped.state.legal?.actions ?? null,
      flipped.state.perspectiveId!,
      CORE_DEPS,
    );
    expect(spidey.name).toBe("Spider-Man");
    expect(spidey.typeLine).toMatch(/^HERO/);
    expect(spidey.rulesText).toContain("Spider-Sense");
    expect(spidey.stats.map((tile) => tile.label.toLowerCase())).toEqual(expect.arrayContaining(["thw", "atk", "def"]));
    expect(spidey.stats.map((tile) => tile.label.toLowerCase())).not.toContain("rec");
  });

  test("keeps a card in the encounter deck hidden even so", () => {
    const top = activeEncounterDeck(state).deck[0]!;
    const model = inspect(top);
    expect(model.hidden).toBe(true);
    expect(model.rulesText).toContain("facedown");
  });

  test("carries the villain's keywords with their printed values", () => {
    const model = inspect(activeVillain(state).instanceId);
    expect(model.hidden).toBe(false);
    // Every keyword reads as a complete phrase — never a bare "Retaliate".
    for (const keyword of model.keywords) expect(keyword.trim().length).toBeGreaterThan(0);
    expect(model.stats.some((tile) => tile.label === "HP")).toBe(true);
  });

  test("carries the villain's printed traits, which live on its stage rather than the top-level card", () => {
    // Regression: `"traits" in card` reads as false for a villain — `VillainStage.traits`, not `VillainCard.traits`
    // — found inspecting Rhino in the browser while verifying this rebuild (BRUTE. CRIMINAL. on the printed card,
    // nothing in the sheet).
    const model = inspect(activeVillain(state).instanceId);
    expect(model.traits.length).toBeGreaterThan(0);
    expect(model.traits.map((t) => t.toLowerCase())).toContain("brute");
  });

  test("lists no usable ability for a card legalActions doesn't name one on", () => {
    const identity = state.players.find((player) => player.playerId === me)!.identity.instanceId;
    expect(inspect(identity).abilities).toEqual([]);
  });

  test("lists a usable ability straight off legalActions, named without inventing text", () => {
    const identity = state.players.find((player) => player.playerId === me)!.identity.instanceId;
    // A hand-built `LegalActions` standing in for a state where this card
    // actually has a usable ability — driving a real game to that exact point
    // is what `legal-actions.test.ts` (in `@mc/cards`, against three full
    // games) already does; this only checks that Inspect reads what
    // `legalActions` says rather than forming its own opinion.
    const auntMayAction = abilityId("01006.aunt-may-action");
    const fakeLegal: LegalActions = {
      kind: "turn",
      legal: [
        {
          action: { kind: "useAbility", instanceId: identity, abilityId: auntMayAction },
          example: {
            type: "useAbility",
            playerId: me,
            cardInstanceId: identity,
            abilityId: auntMayAction,
            payment: [],
          },
          targets: [],
          blockedTargets: [],
          needsPayment: false,
        },
      ],
      illegal: [],
    };
    const model = inspectModel(state, identity, fakeLegal, me, CORE_DEPS);
    expect(model.abilities).toEqual([
      { abilityId: auntMayAction, label: `${model.name} — exhaust`, needsPayment: false },
    ]);
  });

  test("shows no timing entry for an ordinary action/response header — the glossary has no term for those", () => {
    // Confirms the deliberate omission `timingEntriesFor` documents, rather than silently drifting into inventing
    // one: most Core cards' own action/response headers must produce nothing here.
    const identity = state.players.find((player) => player.playerId === me)!.identity.instanceId;
    const model = inspect(identity);
    for (const entry of model.timing) {
      expect(["Setup", "Boost"]).toContain(entry.label.replace(/^(Hero |Alter-Ego )/, ""));
    }
  });

  test("has no per-card history before anything has happened to it", () => {
    const identity = state.players.find((player) => player.playerId === me)!.identity.instanceId;
    expect(inspect(identity).history).toEqual([]);
  });

  test("reads a played card's own history straight from the accumulated log, never inventing it", () => {
    let history = emptyCardHistoryLog();
    const inHand = state.players.find((player) => player.playerId === me)!.hand[0]!;
    history = appendCardHistory(history, [{ type: "cardDrawn", playerId: me, instanceId: inHand }]);
    const model = inspectModel(state, inHand, store.state.legal?.actions ?? null, me, CORE_DEPS, { history });
    expect(model.history.length).toBe(1);
    expect(model.history[0]!.text).toContain("Drawn");
    expect(model.history[0]!.roundTag).toMatch(/^\d+\.\d{2,}$/);
  });

  test("names the resources-committed clause only while a payment for this exact card is open", () => {
    const inHand = state.players.find((player) => player.playerId === me)!.hand[0]!;
    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const playable = legal.legal.find(
      (entry) => entry.action.kind === "playCard" && entry.action.instanceId === inHand,
    );
    if (!playable) return; // Not every seat's first hand card is playable; the assertion below only means something when one is.
    const payment: InspectPayment = {
      subjectInstanceId: inHand,
      paid: 1,
      required: 3,
      spendableInstanceIds: new Set([inHand]),
    };
    const withPayment = inspectModel(state, inHand, legal, me, CORE_DEPS, { payment });
    expect(withPayment.status.message).toContain("2 short");
    expect(withPayment.canPayAsResource).toBe(true);

    const withoutPayment = inspectModel(state, inHand, legal, me, CORE_DEPS);
    expect(withoutPayment.status.message).not.toContain("resources committed");
    expect(withoutPayment.canPayAsResource).toBe(false);
  });
});

/**
 * The opening hand has no keyword-carrying card revealed yet (checked directly against this fixture: every
 * instance's `keywordsOf` is empty until a minion is dealt out of an encounter deck), so the keyword-definitions
 * box needs a game driven far enough to reveal one. A separate fixture, greedily playing cards, keeps the main
 * `beforeAll` above cheap for every other test.
 */
describe("inspectModel — keyword definitions, against a revealed minion", () => {
  let deep: GameState;
  let deepMe: PlayerId;

  beforeAll(async () => {
    const deepStore = new SessionStore(new LocalEngineHost());
    await deepStore.start(RHINO_SOLO);
    for (let step = 0; step < 200 && !deepStore.state.game!.outcome; step++) {
      const legal = deepStore.state.legal;
      if (!legal) break;
      if (legal.actions.kind === "choice") {
        const { choice } = legal.actions;
        await deepStore.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      } else if (legal.actions.kind === "turn") {
        const entry =
          legal.actions.legal.find((e) => e.action.kind === "playCard") ??
          legal.actions.legal.find((e) => e.action.kind === "endTurn") ??
          legal.actions.legal[0];
        if (!entry) break;
        await deepStore.dispatch(entry.example);
      } else break;
    }
    deep = deepStore.state.game!;
    deepMe = deepStore.state.perspectiveId!;
  }, 60_000);

  test("every keyword definition it shows traces back to the content glossary, never invented", () => {
    const carrier = Object.keys(deep.instances).find(
      (id) => faceVisible(deep, id as InstanceId) && keywordsOf(deep, id as InstanceId, CORE_DEPS).length > 0,
    ) as InstanceId | undefined;
    expect(carrier, "expected at least one revealed keyword-carrying card by this point in the game").toBeDefined();
    const model = inspectModel(deep, carrier!, null, deepMe, CORE_DEPS);
    expect(model.keywordDefinitions.length).toBeGreaterThan(0);
    for (const entry of model.keywordDefinitions) {
      expect(entry.definition.length).toBeGreaterThan(0);
      expect(entry.citeLabel.length).toBeGreaterThan(0);
    }
    expect(new Set(model.keywordDefinitions.map((e) => e.label)).size).toBe(model.keywordDefinitions.length);
  });
});
