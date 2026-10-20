import { characterProfile, cardsInPlay, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  threatOn,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../wave9/falcon/testing.js";
import { BLACK_CAT, CAPTAIN_MARVEL, SPIDER_MAN } from "../../wave9/testing.js";
import { WAVE11_CARDS } from "../cards.js";
import {
  ADVANCE,
  ASSAULT,
  DEPS,
  FILLER_A,
  FILLER_B,
  codeOf,
  deckCodes,
  discardCodes,
  idsOf,
  shadowGame,
  toEncounterDiscard,
} from "./corruption.testing.js";
import { SHADOWLAND_NINJA_SWARM as REGISTRY, SHADOWLAND_NINJA_SWARM_SKIPPED as SKIPPED } from "./ninja-swarm.js";

vi.setConfig({ testTimeout: 180_000 });

const MOUNTAIN = "65028";
const BO_STAFF = "65030";
const KATANA = "65032";
const SHADOWS = "65035";
const COUNTLESS = "65036";
const CORE_MINION = "01101";
const CARDS = [MOUNTAIN, BO_STAFF, KATANA, SHADOWS, COUNTLESS];
const REFS = [
  "65028.black-mountain-constant",
  "65028.boost",
  "65030.when-defeated",
  "65032.when-defeated",
  "65035.dancing-shadows-constant",
  "65035.dancing-shadows-constant-2",
  "65035.boost",
  "65036.when-revealed",
  "65036.boost",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const heroGame = (opts: Parameters<typeof shadowGame>[0] = {}) =>
  withForm(shadowGame({ encounter: [MOUNTAIN, BO_STAFF, KATANA, SHADOWS, COUNTLESS], ...opts }), { heroForm: 0 });
const twoHeroes = () => withForm(heroGame({ seats: [SPIDER_MAN, CAPTAIN_MARVEL] }), { heroForm: 0 }, P2);
const inPlay = (s: GameState, code: string): InstanceId[] => cardsInPlay(s).filter((i) => codeOf(s, i) === code);
const accepts = (state: GameState, command: Parameters<typeof applyOk>[1]): boolean => {
  try {
    applyOk(state, command, DEPS);
    return true;
  } catch {
    return false;
  }
};
const attack = (s: GameState, player: typeof P1, target: InstanceId) => ({
  type: "basicAttack" as const,
  playerId: player,
  attackerInstanceId: identityOf(s, player),
  targetInstanceId: target,
});

describe("registry", () => {
  it("registers every printed ref of the five cards; nothing is skipped", () => {
    const printed = CARDS.flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each(REFS)("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Black Mountain 65028", () => {
  /** P2's turn: Black Mountain and a Ninja (a) engaged with P1, another Ninja (b) engaged with P2. */
  function table(withMountain: boolean): GameState {
    let s = twoHeroes();
    if (withMountain) s = engageMinion(s, MOUNTAIN, "bm", P1);
    s = engageMinion(engageMinion(s, BO_STAFF, "ninjaA", P1), BO_STAFF, "ninjaB", P2);
    const p2Turn = settle(runWith(DEPS, s, endTurn(P1)), firstLegal, undefined, DEPS);
    expect(p2Turn.step.phase).toBe("player");
    return p2Turn;
  }

  it("constant: each other Ninja minion engaged with the same player cannot be attacked (by anyone)", () => {
    const s = table(true);
    expect(accepts(s, attack(s, P2, "ninjaA" as InstanceId))).toBe(false);
    // The Ninja engaged with the other player, and Black Mountain himself, can be attacked.
    expect(accepts(s, attack(s, P2, "ninjaB" as InstanceId))).toBe(true);
    expect(accepts(s, attack(s, P2, "bm" as InstanceId))).toBe(true);
  });

  it("constant: without Black Mountain the same Ninja can be attacked (control)", () => {
    const s = table(false);
    expect(accepts(s, attack(s, P2, "ninjaA" as InstanceId))).toBe(true);
  });

  it("boost: if an ally is defending against the attack, this minion is revealed (engages the defending player)", () => {
    const staged = stagedInPlay(heroGame(), BLACK_CAT);
    const defendWithAlly = (s: GameState) => {
      const c = s.pendingChoice!;
      const ally = c.options.find((o) => o.optionId === staged.id);
      return c.prompt.kind === "declareDefender" && ally ? [ally.optionId] : firstLegal(s);
    };
    const run = driveEventsPicking(
      DEPS,
      stackEncounterDeck(staged.state, MOUNTAIN, ADVANCE),
      defendWithAlly,
      endTurn(P1),
    );
    expect(ofType(run.events, "attackResolved")[0]!.targetInstanceId).toBe(staged.id);
    const mountain = idsOf(run.state, MOUNTAIN)[0]!;
    expect(cardsInPlay(run.state)).toContain(mountain);
    expect(inst(run.state, mountain).engagedWith).toBe(P1);
  });

  it("boost: with the hero (not an ally) defending, nothing is revealed", () => {
    const staged = stagedInPlay(heroGame(), BLACK_CAT);
    const run = driveEventsPicking(DEPS, stackEncounterDeck(staged.state, MOUNTAIN, ADVANCE), firstLegal, endTurn(P1));
    const mountain = idsOf(run.state, MOUNTAIN)[0]!;
    expect(cardsInPlay(run.state)).not.toContain(mountain);
  });
});

describe("Bo Staff Ninja 65030 and Katana Ninja 65032", () => {
  const defeatBoStaff = (s: GameState, defeater = P1): GameState => {
    const s1 = engageMinion(s, BO_STAFF, "bo", P1);
    return defeatWithAttack(DEPS, s1, "bo" as InstanceId, defeater);
  };

  it("when defeated: discards 2 cards from the encounter deck and reveals the first minion with teamwork", () => {
    const s = stackEncounterDeck(heroGame(), ASSAULT, KATANA, ADVANCE);
    const after = defeatBoStaff(s);
    // Both cards were discarded; Katana was revealed from them (in play, engaged with the defeating player).
    expect(discardCodes(after)).toContain(ASSAULT);
    expect(discardCodes(after)).toContain(BO_STAFF);
    const katana = inPlay(after, KATANA);
    expect(katana).toHaveLength(1);
    expect(inst(after, katana[0]!).engagedWith).toBe(P1);
    expect(deckCodes(after)[0]).toBe(ADVANCE);
  });

  it("when defeated: only the first of two teamwork minions is revealed; the other stays discarded", () => {
    const s = stackEncounterDeck(heroGame(), KATANA, BO_STAFF, ADVANCE);
    const after = defeatBoStaff(s);
    expect(inPlay(after, KATANA)).toHaveLength(1);
    expect(inPlay(after, BO_STAFF)).toHaveLength(0);
    expect(discardCodes(after).filter((c) => c === BO_STAFF).length).toBeGreaterThanOrEqual(2);
  });

  it("when defeated: nothing is revealed when neither discarded card is a teamwork minion", () => {
    const s = stackEncounterDeck(heroGame(), ASSAULT, ADVANCE, KATANA);
    const after = defeatBoStaff(s);
    expect(inPlay(after, KATANA)).toHaveLength(0);
    expect(discardCodes(after)).toEqual(expect.arrayContaining([ASSAULT, ADVANCE]));
    expect(deckCodes(after)[0]).toBe(KATANA);
  });

  it("when defeated: the defeating player (a teammate) reveals it and it engages them", () => {
    const s0 = stackEncounterDeck(twoHeroes(), ASSAULT, KATANA, ADVANCE);
    const s1 = engageMinion(s0, BO_STAFF, "bo", P1);
    const p2Turn = settle(runWith(DEPS, s1, endTurn(P1)), firstLegal, undefined, DEPS);
    const after = defeatWithAttack(DEPS, p2Turn, "bo" as InstanceId, P2);
    const katana = inPlay(after, KATANA)[0]!;
    expect(inst(after, katana).engagedWith).toBe(P2);
  });

  it("teamwork (Ninja): the defeated Ninja no longer counts when the revealed Ninja checks (insert FAQ p. 18)", () => {
    const s = stackEncounterDeck(heroGame(), ASSAULT, KATANA, ADVANCE);
    const run = driveEventsPicking(DEPS, engageMinion(s, BO_STAFF, "bo", P1), firstLegal);
    const killed = defeatBoStaffWithEvents(run.state);
    const katanaAttacks = ofType(killed.events, "attackResolved").filter(
      (e) => codeOf(killed.state, e.enemyInstanceId) === KATANA,
    );
    expect(katanaAttacks).toHaveLength(0);
  });

  it("teamwork (Ninja): with another Ninja in play the revealed Ninja does activate (control)", () => {
    const s = stackEncounterDeck(heroGame(), ASSAULT, KATANA, ADVANCE);
    const withOther = engageMinion(engageMinion(s, BO_STAFF, "bo", P1), BO_STAFF, "other", P1);
    const killed = defeatBoStaffWithEvents(withOther);
    const katanaAttacks = ofType(killed.events, "attackResolved").filter(
      (e) => codeOf(killed.state, e.enemyInstanceId) === KATANA,
    );
    expect(katanaAttacks).toHaveLength(1);
  });
});

/** Defeats the Ninja "bo" (already in play) with a real basic attack and returns every event. */
function defeatBoStaffWithEvents(state: GameState) {
  const near = patchInstance(state, "bo" as InstanceId, { damage: 999 });
  return driveEventsPicking(DEPS, near, firstLegal, attack(near, P1, "bo" as InstanceId));
}

describe("Dancing Shadows 65035", () => {
  const hp = (s: GameState, id: InstanceId): number => characterProfile(s, id, DEPS)!.maxHp;
  const scheme = (s: GameState, threat = 3) => encounterCardInVillainArea(s, SHADOWS, threat);

  it("constant: each Ninja minion gets +1 hit point; other minions do not", () => {
    const base = engageMinion(engageMinion(heroGame(), BO_STAFF, "ninja", P1), CORE_MINION, "other", P1);
    const before = [hp(base, "ninja" as InstanceId), hp(base, "other" as InstanceId)];
    const { state } = scheme(base);
    expect(hp(state, "ninja" as InstanceId)).toBe(before[0]! + 1);
    expect(hp(state, "other" as InstanceId)).toBe(before[1]!);
  });

  it("constant: threat cannot be removed while a Ninja minion is in play; it can once none is", () => {
    const withNinja = scheme(engageMinion(heroGame(), BO_STAFF, "ninja", P1));
    const thwart = (s: GameState, id: InstanceId) => ({
      type: "basicThwart" as const,
      playerId: P1,
      thwarterInstanceId: identityOf(s, P1),
      schemeInstanceId: id,
    });
    const blocked = (() => {
      try {
        return settle(
          runWith(DEPS, withNinja.state, thwart(withNinja.state, withNinja.id)),
          firstLegal,
          undefined,
          DEPS,
        );
      } catch {
        return withNinja.state;
      }
    })();
    expect(threatOn(blocked, withNinja.id)).toBe(3);
    const alone = scheme(heroGame());
    const removed = settle(runWith(DEPS, alone.state, thwart(alone.state, alone.id)), firstLegal, undefined, DEPS);
    expect(threatOn(removed, alone.id)).toBeLessThan(3);
  });

  it("boost: reveal this card (after the activation it is in play as a side scheme)", () => {
    const start = heroGame();
    const run = driveEventsPicking(DEPS, stackEncounterDeck(start, SHADOWS, ADVANCE), firstLegal, endTurn(P1));
    expect(cardsInPlay(run.state)).toContain(idsOf(run.state, SHADOWS)[0]!);
    const control = driveEventsPicking(DEPS, stackEncounterDeck(start, ASSAULT, ADVANCE), firstLegal, endTurn(P1));
    expect(inPlay(control.state, SHADOWS)).toHaveLength(0);
  });
});

describe("Countless Numbers 65036", () => {
  const ninjas = (s: GameState): string[] => discardCodes(s).filter((c) => c === BO_STAFF || c === KATANA);

  it("when revealed: shuffles each Ninja minion in the encounter discard into the deck; other cards stay", () => {
    const start = toEncounterDiscard(heroGame(), BO_STAFF, KATANA, ASSAULT);
    expect(ninjas(start)).toHaveLength(2);
    const run = driveEventsPicking(DEPS, stackEncounterDeck(start, ADVANCE, COUNTLESS), firstLegal, endTurn(P1));
    // Countless Numbers has surge, so the next card is revealed as well; whatever it was, the Ninjas left the discard.
    expect(ninjas(run.state)).toHaveLength(0);
    expect(discardCodes(run.state)).toContain(ASSAULT);
    // Control: with the card absent they stay.
    const control = driveEventsPicking(DEPS, stackEncounterDeck(start, ADVANCE, FILLER_A), firstLegal, endTurn(P1));
    expect(ninjas(control.state)).toHaveLength(2);
  });

  it("boost: resolves the When Revealed ability (Ninjas return to the deck); control with another boost does not", () => {
    const start = toEncounterDiscard(heroGame(), BO_STAFF, KATANA);
    const boosted = driveEventsPicking(
      DEPS,
      stackEncounterDeck(start, COUNTLESS, FILLER_A, FILLER_B),
      firstLegal,
      endTurn(P1),
    );
    expect(ninjas(boosted.state)).toHaveLength(0);
    const control = driveEventsPicking(
      DEPS,
      stackEncounterDeck(start, ASSAULT, FILLER_A, FILLER_B),
      firstLegal,
      endTurn(P1),
    );
    expect(ninjas(control.state)).toHaveLength(2);
  });

  // Provisional exception (owner decision 2026-10-20, spec §S7 E37): the Sep 22, 2026 ruling would have the boost
  // resolve the surge too; FFG's announced erratum for "Change of Venue and similar encounter cards" makes it non-surge.
  it("boost: resolves only the non-surge When Revealed: no surge from the boost card", () => {
    const start = toEncounterDiscard(heroGame(), BO_STAFF, KATANA);
    const run = driveEventsPicking(
      DEPS,
      stackEncounterDeck(start, COUNTLESS, FILLER_A, FILLER_B),
      firstLegal,
      endTurn(P1),
    );
    expect(ninjas(run.state)).toHaveLength(0);
    const countless = Object.values(run.state.instances).filter((i) => (i.cardId as string) === COUNTLESS);
    const surges = run.events.filter(
      (e) => e.type === "surgeTriggered" && countless.some((c) => c.instanceId === e.instanceId),
    );
    expect(surges).toEqual([]);
  });
});
