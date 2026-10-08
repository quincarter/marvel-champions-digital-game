import {
  cardsInPlay,
  characterProfile,
  locateCard,
  pairOptionId,
  sessionApply,
  startSession,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  firstLegal,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import {
  atMission,
  atTheMission,
  attempting,
  ATTEMPT,
  CAMPAIGN_DEPS,
  campaignGame,
  MISSION_TEAM,
  MISSION_TEAM_ACTION,
  theCard,
} from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Overseers' Mission Responses, Mister Sinister's limit and Desperate Measures in a mission attempt
 * (docs/phase7-wave8.md §3.36, §3.38, §3.42; MC45 pp. 5–6; ruling April 30, 2026 – Ruling 4 (1)). One player;
 * Evacuate Survivors (45167a, 5 threat) and one Overseer in the mission area; Randall ([wild]), X-23 ([physical]) and
 * Marrow ([energy]) at the mission; Mission Team in front of the player.
 */
const RANDALL = "45003";
const X23 = "45012";
const MARROW = "45021";
const CROWN = "45033";
const CLOBBER = "45046";
const BLOODGEM = "45050";
const DIGGING_DEEP = "40060";
const ENERGY = "01088";
const GENIUS = "01089";
const DESPERATE_MEASURES = "45176";
const SINISTER = "45179a";
const SHADOW_KING = "45180a";
const ABYSS = "45181a";
const SUGAR_MAN = "45182a";
const MIKHAIL = "45183a";
const DIGGING_DEEP_RESPONSE = "40060.digging-deep-response";

function table(overseer: string, top: readonly string[], extra: readonly string[] = []) {
  const game = campaignGame({
    deck: [RANDALL, X23, MARROW, CROWN, CLOBBER, CLOBBER, BLOODGEM, DIGGING_DEEP, ...extra],
    mission: { mission: "45167a", overseer, team: true },
  });
  const allies = atMission(game, P1, RANDALL, X23, MARROW);
  const stacked = putOnTopOfDeck(allies.state, P1, ...top);
  const [randall, x23, marrow] = allies.ids as [InstanceId, InstanceId, InstanceId];
  return {
    state: stacked.state,
    randall,
    x23,
    marrow,
    mission: theCard(stacked.state, "45167a"),
    overseer: theCard(stacked.state, overseer),
    team: theCard(stacked.state, MISSION_TEAM),
    top: stacked.ids,
  };
}
type Table = ReturnType<typeof table>;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const resolved = (events: readonly GameEvent[], ref: string) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === ref).length;
/** Runs an attempt, recording the cards and allies each pairing prompt offered. */
function attempt(
  t: Table,
  pairs: (cards: readonly InstanceId[]) => readonly (readonly [InstanceId, InstanceId])[],
  fallback: Picker = firstLegal,
  state: GameState = t.state,
) {
  const offered: { cards: readonly InstanceId[]; allies: readonly InstanceId[]; limited: boolean }[] = [];
  const pick = attempting(pairs, fallback);
  const run = driveEventsPicking(
    CAMPAIGN_DEPS,
    state,
    (s) => {
      const prompt = s.pendingChoice?.prompt;
      if (prompt?.kind === "pairCards")
        offered.push({ cards: prompt.cards, allies: prompt.with, limited: prompt.limit !== undefined });
      return pick(s);
    },
    use(P1, t.team, MISSION_TEAM_ACTION),
  );
  return { ...run, offered };
}
/** Accepts the first optional response offered, and otherwise answers like `firstLegal`. */
const accept: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.slice(0, 1).map((o) => o.optionId);
  return firstLegal(state);
};

describe("§3.38 the Mission Responses", () => {
  it("test 1 (the ruling): Sugar Man with 4 damage; Digging Deep, Clobber and Bloodgem discarded. Clobber's [physical] heals him 3. Taking Digging Deep: hand +1, two cards left to assign, no card discarded in its place. Declining: three cards", () => {
    const t = table(SUGAR_MAN, [DIGGING_DEEP, CLOBBER, BLOODGEM]);
    const [digging, clobber, gem] = t.top as [InstanceId, InstanceId, InstanceId];
    const hurt = patchInstance(t.state, t.overseer, { damage: 4 });
    const deckBefore = playerOf(hurt, P1).deck.length;
    const handBefore = playerOf(hurt, P1).hand.length;

    const taken = attempt(t, () => [], accept, hurt);
    expect(resolved(taken.events, "45182a.sugar-man-forced-response")).toBe(1);
    // Nobody was paired, so the pool was 0: his 4 damage less the 3 healed.
    expect(inst(taken.state, t.overseer).damage).toBe(1);
    expect(resolved(taken.events, DIGGING_DEEP_RESPONSE)).toBe(1);
    expect(playerOf(taken.state, P1).hand).toContain(digging);
    expect(playerOf(taken.state, P1).hand.length).toBe(handBefore + 1);
    expect(taken.offered).toMatchObject([{ cards: [clobber, gem] }]);
    expect(taken.offered[0]?.allies).toHaveLength(3);
    // Three cards left the deck and no fourth: "no replacement card is drawn".
    expect(playerOf(taken.state, P1).deck.length).toBe(deckBefore - 3);
    // The Mission Response (forced) resolved before the card's own Response.
    const forced = taken.events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === "45182a.sugar-man-forced-response",
    );
    const own = taken.events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === DIGGING_DEEP_RESPONSE);
    expect(forced).toBeLessThan(own);

    const declined = attempt(t, () => [], firstLegal, hurt);
    expect(resolved(declined.events, DIGGING_DEEP_RESPONSE)).toBe(0);
    expect(declined.offered).toMatchObject([{ cards: [digging, clobber, gem] }]);
    expect(inst(declined.state, t.overseer).damage).toBe(1);
  });

  it("test 2: The Shadow King, the mission at 5: Genius (two [mental]) discarded with two cards that have none: 9 threat before step 5", () => {
    const t = table(SHADOW_KING, [GENIUS, CLOBBER, BLOODGEM]);
    const run = attempt(t, () => []);
    expect(resolved(run.events, "45180a.the-shadow-king-forced-response")).toBe(1);
    expect(of(run.events, "threatPlaced").filter((e) => e.schemeInstanceId === t.mission)).toMatchObject([
      { amount: 4 },
    ]);
    expect(inst(run.state, t.mission).threat).toBe(9);
  });

  it("test 3: Abyss: Digging Deep and Bloodgem ([wild]) discarded with Clobber: both are attached to him facedown, Digging Deep's Response is not offered, and one card is left to assign. Abyss defeated in step 4: both cards are in their owner's discard pile", () => {
    const t = table(ABYSS, [DIGGING_DEEP, CLOBBER, BLOODGEM]);
    const [digging, clobber, gem] = t.top as [InstanceId, InstanceId, InstanceId];
    // 2 damage on Abyss already: X-23's ATK 3 finishes him.
    const hurt = patchInstance(t.state, t.overseer, { damage: 2 });
    const offeredTriggers: string[] = [];
    const run = attempt(
      t,
      () => [[clobber, t.x23]],
      (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "chooseTriggers") offeredTriggers.push(...choice.options.map((o) => o.optionId));
        return accept(state);
      },
      hurt,
    );
    expect(resolved(run.events, "45181a.abyss-forced-response")).toBe(2);
    expect(offeredTriggers.filter((id) => id.includes(DIGGING_DEEP_RESPONSE))).toEqual([]);
    expect(resolved(run.events, DIGGING_DEEP_RESPONSE)).toBe(0);
    expect(run.offered).toMatchObject([{ cards: [clobber] }]);
    // Attached facedown, then gone with him to their owner's discard pile; he goes to the victory display.
    const attached = of(run.events, "cardMoved").filter(
      (e) => e.to.kind === "attachment" && e.to.hostInstanceId === t.overseer,
    );
    expect(attached.map((e) => e.instanceId).sort()).toEqual([digging, gem].sort());
    expect(locateCard(run.state, t.overseer)).toEqual({ kind: "victoryDisplay" });
    for (const id of [digging, gem]) {
      expect(playerOf(run.state, P1).discard).toContain(id);
      expect(inst(run.state, id)).toMatchObject({ faceup: true, attachedTo: null });
    }
  });

  it("test 3: the cards on Abyss are out of play and do nothing there: his hit points stay 5", () => {
    const t = table(ABYSS, [DIGGING_DEEP, CLOBBER, BLOODGEM]);
    const run = attempt(t, () => []);
    expect(inst(run.state, t.overseer).attachments).toHaveLength(2);
    for (const id of inst(run.state, t.overseer).attachments) {
      expect(inst(run.state, id).faceup).toBe(false);
      expect(cardsInPlay(run.state)).not.toContain(id);
    }
    expect(characterProfile(run.state, t.overseer, CAMPAIGN_DEPS)).toMatchObject({ maxHp: 5 });
  });

  it("test 4: Mikhail Rasputin: Energy (two [energy]) discarded: two separate 1-damage choices among the allies at the mission. Both on Marrow (2 hit points) defeat her before the cards are assigned, and X is not recounted: three cards, two allies", () => {
    const t = table(MIKHAIL, [ENERGY, CLOBBER, BLOODGEM]);
    const choices: string[][] = [];
    const run = attempt(
      t,
      () => [],
      (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "chooseTarget" && choice.options.some((o) => o.optionId === t.marrow)) {
          choices.push(choice.options.map((o) => o.optionId));
          return [t.marrow];
        }
        return firstLegal(state);
      },
    );
    expect(resolved(run.events, "45183a.mikhail-rasputin-forced-response")).toBe(1);
    expect(choices).toEqual([
      [t.randall, t.x23, t.marrow],
      [t.randall, t.x23, t.marrow],
    ]);
    expect(of(run.events, "damageDealt").filter((e) => e.targetInstanceId === t.marrow)).toMatchObject([
      { amount: 1, sourceInstanceId: t.overseer },
      { amount: 1, sourceInstanceId: t.overseer },
    ]);
    expect(playerOf(run.state, P1).discard).toContain(t.marrow);
    expect(run.offered).toMatchObject([{ allies: [t.randall, t.x23] }]);
    expect(run.offered[0]?.cards).toHaveLength(3);
  });
});

describe("§3.36 test 3: Mister Sinister's limit", () => {
  it("Clobber, Clobber and Bloodgem: the second Clobber cannot be assigned, so at most two allies participate", () => {
    const t = table(SINISTER, [CLOBBER, CLOBBER, BLOODGEM]);
    const [first, second, gem] = t.top as [InstanceId, InstanceId, InstanceId];
    // Up to the pairing prompt, by hand.
    let session = startSession(t.state);
    const used = sessionApply(session, use(P1, t.team, MISSION_TEAM_ACTION), CAMPAIGN_DEPS);
    if (!used.ok) throw new Error(used.error.message);
    session = used.session;
    const option = session.state.pendingChoice!;
    const chosen = sessionApply(
      session,
      { type: "resolveChoice", playerId: P1, choiceId: option.choiceId, selectedOptionIds: [ATTEMPT] },
      CAMPAIGN_DEPS,
    );
    if (!chosen.ok) throw new Error(chosen.error.message);
    const choice = chosen.session.state.pendingChoice!;
    if (choice.prompt.kind !== "pairCards") throw new Error(choice.prompt.kind);
    expect(choice.prompt.limit).toEqual({ distinctBy: "resourceIcon" });
    const answer = (...pairs: readonly (readonly [InstanceId, InstanceId])[]) =>
      sessionApply(
        chosen.session,
        {
          type: "resolveChoice",
          playerId: P1,
          choiceId: choice.choiceId,
          selectedOptionIds: pairs.map(([card, ally]) => pairOptionId(card, ally)),
        },
        CAMPAIGN_DEPS,
      );
    expect(answer([first, t.x23], [second, t.randall], [gem, t.marrow]).ok).toBe(false);
    expect(answer([first, t.x23], [gem, t.marrow]).ok).toBe(true);
  });

  it("with another Overseer the same three cards make three participants", () => {
    const t = table(SUGAR_MAN, [CLOBBER, CLOBBER, BLOODGEM]);
    const [first, second, gem] = t.top as [InstanceId, InstanceId, InstanceId];
    const run = attempt(t, () => [
      [first, t.x23],
      [second, t.randall],
      [gem, t.marrow],
    ]);
    expect(run.offered).toMatchObject([{ limited: false }]);
    expect(of(run.events, "cardsPaired")[0]?.pairs.filter((p) => p.matched)).toHaveLength(3);
  });
});

describe("§3.34 test 4, §3.36 test 6 and §3.42 test 1: Desperate Measures (45176)", () => {
  /** Desperate Measures played on Marrow at the mission by Spider-Man, for its cost of 1. */
  function upgraded(top: readonly string[]) {
    const t = table(SUGAR_MAN, top, [DESPERATE_MEASURES, DESPERATE_MEASURES]);
    const hand = moveToHand(t.state, P1, DESPERATE_MEASURES, DESPERATE_MEASURES);
    const [first, second] = hand.ids as [InstanceId, InstanceId];
    const played = driveEventsPicking(
      CAMPAIGN_DEPS,
      hand.state,
      firstLegal,
      play(P1, first, payWith(hand.state, P1, 1, [first, second]), { attachToInstanceId: t.marrow }),
    );
    return { t, state: played.state, first, second };
  }

  it("on Marrow at the mission (THW 1, ATK 2, 2 hit points): THW 2, ATK 3, 3 hit points, attached and in the area with her; a second copy on her is refused ('Limit 1 per ally')", () => {
    const { t, state, first, second } = upgraded([CROWN, CLOBBER, BLOODGEM]);
    expect(inst(state, first).attachedTo).toBe(t.marrow);
    expect(characterProfile(state, t.marrow, CAMPAIGN_DEPS)).toMatchObject({ thw: 2, atk: 3, maxHp: 3 });
    expect(atTheMission(state)).toContain(t.marrow);
    const again = sessionApply(
      startSession(state),
      play(P1, second, payWith(state, P1, 1, [second]), { attachToInstanceId: t.marrow }),
      CAMPAIGN_DEPS,
    );
    expect(again.ok).toBe(false);
  });

  it("assigned Magik's Crown ([mental]), Marrow ([energy]) participates through her considered [wild], adding her ATK 3 and THW 2; without the upgrade she does not", () => {
    const { t, state } = upgraded([CROWN, CLOBBER, BLOODGEM]);
    const [crown] = t.top as [InstanceId, InstanceId, InstanceId];
    const run = attempt(t, () => [[crown, t.marrow]], firstLegal, state);
    expect(of(run.events, "cardsPaired")[0]?.pairs).toEqual([
      { cardInstanceId: crown, characterInstanceId: t.marrow, matched: true },
    ]);
    expect(of(run.events, "damagePoolResolved")[0]).toMatchObject({ pool: 3 });
    expect(inst(run.state, t.mission).threat).toBe(3);

    const plain = attempt(t, () => [[crown, t.marrow]]);
    expect(of(plain.events, "cardsPaired")[0]?.pairs[0]?.matched).toBe(false);
    expect(of(plain.events, "damagePoolResolved")[0]).toMatchObject({ pool: 0 });
  });

  it("Marrow defeated at the mission: she and Desperate Measures are in their owner's discard pile", () => {
    const { t, state, first } = upgraded([CROWN, CLOBBER, BLOODGEM]);
    // 2 damage of her 3 hit points; the mission's Forced Response deals the third.
    const run = attempt(t, () => [], firstLegal, patchInstance(state, t.marrow, { damage: 2 }));
    expect(of(run.events, "characterDefeated").map((e) => e.instanceId)).toEqual([t.marrow]);
    expect(playerOf(run.state, P1).discard).toEqual(expect.arrayContaining([t.marrow, first]));
    expect(atTheMission(run.state)).not.toContain(t.marrow);
  });
});
