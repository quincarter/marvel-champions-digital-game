import { activeEncounterDeckId, cardsInPlay, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  applyOk,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { stageNemesisCardForReveal } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, revealFromEncounterDeck, startWave4Game } from "../testing.js";
import { warMachineScenario } from "./support.js";

const warMachineVsRhino = (seed = 1) => startWave4Game(warMachineScenario("rhino", { seed }));

/** Picks the offered option whose id names one of `wanted`; anything else falls back to `firstLegal` (the
 * `../nebu/nebula-kit.test.ts` `accepting` shape). */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** War Machine changing to hero form places ammo through an ordinary — optional — "Response:", which `firstLegal`
 * alone would decline. */
const toHeroSettled = (state: GameState): GameState =>
  settle(runWith(WAVE4_DEPS, state, toHero()), accepting("23001a.war-machine-constant"), undefined, WAVE4_DEPS);

/** Picks the offered option whose label starts with `prefix`; declines/first-legals everything else (the
 * `../../wave3/gam/gamora-obligation-nemesis.test.ts` / `../nebu/nebula-obligation-nemesis.test.ts` shape). */
const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

/** `../nebu/nebula-obligation-nemesis.test.ts`'s own `driveEventsWith`: settles every choice with `pick`, then runs
 * each command, collecting every event along the way — needed to observe `surgeTriggered`, which doesn't reliably
 * leave a trace in any zone. */
function driveEventsWith(
  state: GameState,
  pick: Picker,
  ...commands: readonly Parameters<typeof runWith>[2][]
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const settleOne = () => {
    while (current.pendingChoice && !current.outcome) {
      const choice = current.pendingChoice;
      const result = applyOk(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(current),
        },
        WAVE4_DEPS,
      );
      current = result.state;
      events.push(...result.events);
    }
  };
  settleOne();
  for (const command of commands) {
    const result = applyOk(current, command, WAVE4_DEPS);
    current = result.state;
    events.push(...result.events);
    settleOne();
  }
  return { state: current, events };
}

/** Stacks `code` on top of the encounter deck behind a filler card (Advance, 01186), the `../nebu/nebula-
 * obligation-nemesis.test.ts` convention — an obligation is shuffled into the encounter deck at setup (unlike a
 * nemesis card, which starts set aside — `stageNemesisCardForReveal` below). */
function stageWithFiller(state: GameState, code: string): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === code) ??
    pile.discard.find((i) => state.instances[i]?.cardId === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  const filler = pile.deck.find((i) => state.instances[i]?.cardId === "01186" && i !== id);
  const rest = pile.deck.filter((i) => i !== id && i !== filler);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: filler ? [filler, id, ...rest] : [id, ...rest] },
    },
  };
}

/** Puts a nemesis-set side scheme straight into the villain area at a given threat (surgery: no reveal, no boost
 * draw) — Deadly Light Show starts set aside, unlike `wave3/gmw/galactic-artifacts.test.ts`'s own
 * `putSideSchemeIntoPlay` (an ordinary encounter-deck side scheme). */
function putNemesisSideSchemeIntoPlay(
  state: GameState,
  code: string,
  threat: number,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, P1);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === code);
  if (!id) throw new Error(`no ${code} set aside for ${P1}`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((x) => x !== id) } : p,
      ),
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: { ...state.instances[id]!, threat, faceup: true } },
    },
  };
}

describe("Equipment Malfunction (23028), War Machine's obligation", () => {
  it("(23028.obligation): exhausting James Rhodes removes it from the game, leaving your ammo untouched", () => {
    const hero = toHeroSettled(warMachineVsRhino(1));
    const identity = identityOf(hero, P1);
    expect(inst(hero, identity).counters.ammo).toBe(5);
    const withObligation = stageWithFiller(hero, "23028");
    const revealed = settle(
      runWith(WAVE4_DEPS, withObligation, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Exhaust"),
      undefined,
      WAVE4_DEPS,
    );
    const [obligation] = instancesOf(revealed, "23028");
    expect(revealed.removedFromGame).toContain(obligation);
  });

  it("(23028.obligation): removing all ammo (more than 2) discards the obligation without surge", () => {
    const hero = toHeroSettled(warMachineVsRhino(2));
    const identity = identityOf(hero, P1);
    expect(inst(hero, identity).counters.ammo).toBe(5);
    const withObligation = stageWithFiller(hero, "23028");
    const [obligation] = instancesOf(withObligation, "23028");
    // Decline "You may flip to alter-ego form" first — James Rhodes' own forced response would otherwise discard
    // every ammo counter on the flip, before this obligation's own "remove all ammo" branch ever runs, and that
    // really would leave 2 or fewer removed (0) — a genuine, correct interaction (covered below), not this test's.
    const stayInHeroThenRemoveAmmo: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const stay = choice.options.find((o) => o.label === "Stay in hero form");
      if (stay) return [stay.optionId];
      const removeAll = choice.options.find((o) => o.label.startsWith("Remove all ammo"));
      return removeAll ? [removeAll.optionId] : firstLegal(state);
    };
    const { state: revealed, events } = driveEventsWith(withObligation, stayInHeroThenRemoveAmmo, {
      type: "endTurn",
      playerId: P1,
    });
    expect(revealed.removedFromGame).not.toContain(obligation);
    expect(inst(revealed, identity).counters.ammo).toBe(0);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === obligation)).toBe(false);
  });

  it("(23028.obligation): flipping to alter-ego first discards every ammo counter, so 'remove all ammo' finds none and gains surge", () => {
    const hero = toHeroSettled(warMachineVsRhino(2));
    const identity = identityOf(hero, P1);
    expect(inst(hero, identity).counters.ammo).toBe(5);
    const withObligation = stageWithFiller(hero, "23028");
    const [obligation] = instancesOf(withObligation, "23028");
    const { state: revealed, events } = driveEventsWith(withObligation, pickingLabelStartingWith("Remove all ammo"), {
      type: "endTurn",
      playerId: P1,
    });
    expect(inst(revealed, identity).counters.ammo).toBe(0);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === obligation)).toBe(true);
  });

  it("(23028.obligation): with 2 or fewer ammo counters removed, the card gains surge instead", () => {
    const start = warMachineVsRhino(3);
    const withObligation = stageWithFiller(start, "23028");
    const [obligation] = instancesOf(withObligation, "23028");
    // Never changed to hero form: no ammo counters on the identity to remove (0, at or under the threshold).
    const { events } = driveEventsWith(withObligation, pickingLabelStartingWith("Remove all ammo"), {
      type: "endTurn",
      playerId: P1,
    });
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === obligation)).toBe(true);
  });
});

describe("War Machine's nemesis set (Living Laser, Deadly Light Show, Laser Strike)", () => {
  it("Living Laser (23029.living-laser-constant): its own attacks gain piercing", () => {
    const { state, id: laser } = revealFromEncounterDeck(warMachineVsRhino(1), "23029");
    expect(cardsInPlay(state)).toContain(laser);
    expect(WAVE4_DEPS.abilities["23029.living-laser-constant"]).toMatchObject({
      trigger: { kind: "constant", rules: [{ kind: "attackKeywords", keywords: ["piercing"] }] },
    });
  });

  it("Deadly Light Show (23030.when-defeated): When Defeated, deals 1 damage to each identity", () => {
    const hero = toHeroSettled(warMachineVsRhino(1));
    const identity = identityOf(hero, P1);
    const withScheme = putNemesisSideSchemeIntoPlay(hero, "23030", 1);
    const readied = patchInstance(withScheme.state, identity, { exhausted: false });
    const before = inst(readied, identity).damage;
    const after = settle(
      runWith(WAVE4_DEPS, readied, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: withScheme.id,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, identity).damage).toBe(before + 1);
  });

  it("Laser Strike (23031.when-revealed): with no upgrade to discard, the card gains surge instead", () => {
    const hero = toHeroSettled(warMachineVsRhino(1));
    const staged = stageNemesisCardForReveal(hero, "23031", P1, 1);
    const { events } = driveEventsWith(staged, firstLegal, { type: "endTurn", playerId: P1 });
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
  });

  it("Laser Strike (23031.when-revealed): with an upgrade to discard, it discards one instead of gaining surge", () => {
    const hero = toHeroSettled(warMachineVsRhino(1));
    // Gauntlet Gun (23005) is an upgrade War Machine controls once played.
    const { state: withGun, id: gun } = playFromHand(hero, "23005", 2);
    const staged = stageNemesisCardForReveal(withGun, "23031", P1, 1);
    // "Discard an upgrade you control" is an optional `chooseCards` (min 0, max 1); `firstLegal` alone would decline
    // it (choosing nothing), so pick the option naming the gun whenever it's offered.
    const pickGun: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const hit = choice.options.find((o) => o.ref && o.ref.kind === "card" && o.ref.instanceId === gun);
      return hit ? [hit.optionId] : firstLegal(state);
    };
    const { state: after, events } = driveEventsWith(staged, pickGun, { type: "endTurn", playerId: P1 });
    expect(playerOf(after, P1).discard).toContain(gun);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(false);
  });

  it("Laser Strike (23031.boost): a boost ability, discarding an upgrade you control if this resolves during an undefended attack (the Hydra Flame-Soldier shape, `wave2/trors/red-skull.ts`)", () => {
    expect(WAVE4_DEPS.abilities["23031.boost"]?.trigger.kind).toBe("boost");
    expect(WAVE4_DEPS.abilities["23031.boost"]?.effects[0]).toMatchObject({ kind: "if" });
  });
});
