import {
  applyCommand,
  createGame,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, moveToDiscard, withForm } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { MSM_PACK_CARDS } from "../../wave1/msm/pack-cards.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { PSYLOCKE_EVENTS } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Psylocke's hero and pack events, docs/phase7-wave7.md §7.2, §3.69: Flurry of Blades 41004, Mental Detection 41005,
 * Psionic Redirect 41006, Telepathic Suggestion 41007, Concussive Blow 41014, Upside the Head 41015, Directed Force
 * 41019 and Soaring Hearts 41020. Her real precon (`psylocke-justice`) against Stryfe through `wave7Scenario` with the
 * real registry (the blades' own abilities are the upgrades module's: Psi-Katana's +1 ATK and piercing are used by the
 * Directed Force tests). The blades' faces are set by surgery (`blades`), since the events count the showing face.
 * Zero (40174) is the staged second enemy.
 */
const FLURRY = "41004.flurry-of-blades-action";
const DETECTION = "41005.mental-detection-action";
const REDIRECT = "41006.psionic-redirect-interrupt";
const SUGGESTION = "41007.telepathic-suggestion-interrupt";
const BLOW = "41014.concussive-blow-action";
const UPSIDE = "41015.upside-the-head-response";
const FORCE = "41019.directed-force-interrupt";
const HEARTS = "41020.soaring-hearts-action";
const ALL = [FLURRY, DETECTION, REDIRECT, SUGGESTION, BLOW, UPSIDE, FORCE, HEARTS];

const PSYLOCKE = { starterDeckId: "psylocke-justice" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const ANGEL = { starterDeckId: "angel-protection" } as const;
type Seat = typeof PSYLOCKE | typeof SPIDER_MAN | typeof ANGEL;

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const handCodes = (s: GameState, p = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
const damage = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const statusOf = (s: GameState, id: InstanceId, status: "confused" | "stunned" | "tough"): number =>
  inst(s, id).statuses[status] ?? 0;
const bladesOf = (s: GameState, p = P1): InstanceId[] =>
  inst(s, identityOf(s, p)).attachments.filter((id) => codeOf(s, id) === "41002a");

/** Psylocke in hero form (at `seat`; the other seat Spider-Man), Stryfe without his starting tough card. */
function game(players: readonly Seat[] = [PSYLOCKE], seed = 1, seat: PlayerId = P1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  const hero = withForm(settled, { heroForm: 0 }, seat);
  return patchInstance(hero, stryfe(hero), { statuses: { ...inst(hero, stryfe(hero)).statuses, tough: 0 } });
}
/** The blades' faces by play order: `true` is Psi-Katana, `false` Psi-Knife. */
function blades(state: GameState, faces: readonly [boolean, boolean], player: PlayerId = P1): GameState {
  return bladesOf(state, player).reduce((s, id, i) => patchInstance(s, id, { flipped: faces[i]! }), state);
}
const KNIVES = [false, false] as const;
const MIXED = [false, true] as const;
const KATANAS = [true, true] as const;

/** End-of-turn discard down to hand size that never discards these cards (by printed number). */
const keeping =
  (inner: Picker, ...codes: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "discardDownToHandSize") return inner(s);
    return choice.options
      .filter((o) => !codes.includes(codeOf(s, o.optionId as InstanceId)))
      .slice(0, choice.minSelections)
      .map((o) => o.optionId);
  };

/** Picks the queued ids in order, one per prompt that offers the next one; anything else as `firstLegal`. */
function queue(...ids: readonly InstanceId[]): Picker {
  const left = [...ids];
  return (s) => {
    const offered = s.pendingChoice?.options.map((o) => o.optionId) ?? [];
    if (left.length > 0 && offered.includes(left[0]!)) return [left.shift()!];
    return firstLegal(s);
  };
}
/** Accepts the trigger of this ability when offered and pays its cost from the first hand cards; other prompts as `inner`. */
const accepting =
  (ability: string | readonly string[], inner: Picker = firstLegal): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "payForCard")
      return choice.options
        .filter((o) => o.optionId.startsWith("hand:"))
        .slice(0, choice.prompt.cost)
        .map((o) => o.optionId);
    if (choice?.prompt.kind === "chooseTriggers") {
      const wanted = typeof ability === "string" ? [ability] : ability;
      const hit = choice.options.find((o) => wanted.some((w) => o.optionId.includes(w)));
      return hit ? [hit.optionId] : [];
    }
    return inner(s);
  };
const turns = (players: readonly Seat[]): Command[] =>
  players.length === 2 ? [endTurn(P1), endTurn(P2)] : [endTurn(P1)];
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** Plays `code` from hand paying `cost` with other hand cards (or `pay` ids), answering prompts with `pick`. */
function playEvent(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  player: PlayerId = P1,
  pay?: readonly InstanceId[],
) {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const payment = pay ?? payWith(given.state, player, cost, [id]);
  const run = driveEventsPicking(WAVE7_DEPS, given.state, pick, play(player, id, payment));
  return { ...run, id, before: given.state };
}
const refused = (state: GameState, code: string, cost: number, player: PlayerId = P1): boolean => {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  return !applyCommand(given.state, play(player, id, payWith(given.state, player, cost, [id])), WAVE7_DEPS).ok;
};

describe("Psylocke events registry", () => {
  it.each(ALL)("%s validates", (id) => {
    expect(validateDefinition(PSYLOCKE_EVENTS[id]!)).toEqual([]);
  });
  it("holds exactly the eight event refs", () => {
    expect(Object.keys(PSYLOCKE_EVENTS).sort()).toEqual([...ALL].sort());
  });
  it("Concussive Blow (41014) is the same definition object as its 05031 reprint", () => {
    expect(PSYLOCKE_EVENTS[BLOW]).toBe(MSM_PACK_CARDS["05031.concussive-blow-action"]);
  });
});

describe("Flurry of Blades (41004)", () => {
  /** Stryfe plus Zero (engaged with P1), Psylocke's blades as given. */
  function staged(faces: readonly [boolean, boolean], players: readonly Seat[] = [PSYLOCKE]) {
    // Zero guards, which would make Stryfe unattackable: it sits unengaged in the villain area, still an enemy in play.
    const staged = encounterCardInVillainArea(game(players), "40174");
    return { state: blades(staged.state, faces), zero: staged.id };
  }
  it("two Psi-Knives: 2 damage to the attacked enemy, then two separate chosen enemies are confused", () => {
    const { state, zero } = staged(KNIVES);
    const v = stryfe(state);
    const run = playEvent(state, "41004", 3, queue(v, zero, v));
    expect(damage(run.state, v)).toBe(2);
    expect(damage(run.state, zero)).toBe(0);
    expect(statusOf(run.state, zero, "confused")).toBe(1);
    expect(statusOf(run.state, v, "confused")).toBe(1);
    expect(discardCodes(run.state)).toContain("41004");
    expect(handCodes(run.state)).toHaveLength(handCodes(run.before).length - 1 - 3);
    // An attack by an event: Psylocke does not exhaust.
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
  });
  it("two Psi-Katanas: 2 damage, then 2 damage to each of two chosen enemies (the same one may be chosen twice)", () => {
    const { state, zero } = staged(KATANAS);
    const v = stryfe(state);
    const run = playEvent(state, "41004", 3, queue(v, zero, v));
    expect(damage(run.state, v)).toBe(2 + 2);
    expect(damage(run.state, zero)).toBe(2);
    expect(statusOf(run.state, v, "confused")).toBe(0);
  });
  it("one of each: one confuse and one 2 damage", () => {
    const { state, zero } = staged(MIXED);
    const v = stryfe(state);
    const run = playEvent(state, "41004", 3, queue(v, zero, zero));
    expect(damage(run.state, v)).toBe(2);
    expect(statusOf(run.state, zero, "confused")).toBe(1);
    expect(damage(run.state, zero)).toBe(2);
  });
  it("the blade count is read as the event resolves, by the face showing", () => {
    const { state, zero } = staged(KNIVES);
    const flipped = blades(state, [true, false]);
    const v = stryfe(flipped);
    const run = playEvent(flipped, "41004", 3, queue(v, zero, v));
    expect(statusOf(run.state, zero, "confused")).toBe(1); // the second blade is the Knife: confuse Zero
    expect(damage(run.state, v)).toBe(2 + 2); // the first is a Katana: 2 more to Stryfe
  });
  it("is a Hero Action: refused in alter-ego form", () => {
    const { state } = staged(KNIVES);
    expect(refused(withForm(state, "alterEgo"), "41004", 3)).toBe(true);
  });
  it("two players: Zero engaged with the other player (a guard for them, not for her) takes both Katanas' 2 damage", () => {
    const engaged = engageMinion(game([SPIDER_MAN, PSYLOCKE], 1, P2), "40174", P1);
    const state = driveEventsPicking(WAVE7_DEPS, blades(engaged.state, KATANAS, P2), firstLegal, endTurn(P1)).state;
    const v = stryfe(state);
    const run = playEvent(state, "41004", 3, queue(v, engaged.id, engaged.id), P2);
    // Two separate instances of 2 damage to Zero (4 hit points): it is defeated, and its own When Defeated shuffles it away.
    const dealt = events(run.events, "damageDealt");
    expect(dealt.filter((e) => e.targetInstanceId === engaged.id).map((e) => e.amount)).toEqual([2, 2]);
    expect(playerOf(run.state, P1).playArea).not.toContain(engaged.id);
    expect(damage(run.state, v)).toBe(2);
    expect(bladesOf(run.state, P1)).toHaveLength(0);
  });
});

describe("Mental Detection (41005)", () => {
  function staged(faces: readonly [boolean, boolean]) {
    const side = encounterCardInVillainArea(game(), "40131", 10);
    return { state: blades(side.state, faces), side: side.id };
  }
  it("two Psi-Knives: one thwart of 1 + 2 + 2 = 5", () => {
    const { state, side } = staged(KNIVES);
    const run = playEvent(state, "41005", 2, queue(side));
    expect(threat(run.state, side)).toBe(5);
    expect(handCodes(run.state)).toHaveLength(handCodes(run.before).length - 1 - 2);
  });
  it("one Knife and one Katana: thwart 3 and draw 1 card", () => {
    const { state, side } = staged(MIXED);
    const run = playEvent(state, "41005", 2, queue(side));
    expect(threat(run.state, side)).toBe(7);
    expect(handCodes(run.state)).toHaveLength(handCodes(run.before).length - 1 - 2 + 1);
    expect(playerOf(run.state, P1).deck).toHaveLength(playerOf(run.before, P1).deck.length - 1);
  });
  it("two Psi-Katanas: thwart 1 and draw 2 cards", () => {
    const { state, side } = staged(KATANAS);
    const run = playEvent(state, "41005", 2, queue(side));
    expect(threat(run.state, side)).toBe(9);
    expect(handCodes(run.state)).toHaveLength(handCodes(run.before).length - 1 - 2 + 2);
  });
  it("is a thwart by her, so threat cannot go below the scheme's own and the hero does not exhaust", () => {
    const { state, side } = staged(KNIVES);
    const low = patchInstance(state, side, { threat: 3 });
    const run = playEvent(low, "41005", 2, queue(side));
    expect(threat(run.state, side)).toBe(0);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
  });
  it("is refused in alter-ego form", () => {
    expect(refused(withForm(staged(KNIVES).state, "alterEgo"), "41005", 2)).toBe(true);
  });
});

describe("Psionic Redirect (41006)", () => {
  /**
   * Stryfe's villain-phase attack on Psylocke with the event in hand. The boost card is Telepathic Camouflage (3 boost
   * icons, no Boost ability), so the attack deals 2 + 3 = 5. `accept`: play the event.
   */
  function defend(faces: readonly [boolean, boolean], accept: boolean, players: readonly Seat[] = [PSYLOCKE]) {
    const seat = players.length === 2 ? P2 : P1;
    const given = moveToHand(blades(game(players, 1, seat), faces, seat), seat, "41006");
    const base = stackEncounterDeck(given.state, "40176");
    const run = driveEventsPicking(
      WAVE7_DEPS,
      base,
      accept ? accepting(REDIRECT) : accepting("none"),
      ...turns(players),
    );
    return { ...run, base, seat };
  }
  const prevented = (run: { events: readonly GameEvent[] }) =>
    events(run.events, "damagePrevented").map((e) => e.amount);
  const hurt = (run: { state: GameState; seat: PlayerId }) => damage(run.state, identityOf(run.state, run.seat));

  it("baseline: with the event declined, Stryfe's attack deals 2 ATK + 3 boost = 5", () => {
    const run = defend(KNIVES, false);
    expect(hurt(run)).toBe(5);
    expect(prevented(run)).toEqual([]);
  });
  it("two Knives: prevents 2 of the 5, and confuses the attacking enemy; the event is paid for and discarded", () => {
    const run = defend(KNIVES, true);
    expect(prevented(run)).toEqual([2]);
    expect(hurt(run)).toBe(3);
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(1);
    expect(discardCodes(run.state)).toContain("41006");
  });
  it("one Katana: prevents 2 + 2 = 4 and one Knife still confuses", () => {
    const run = defend(MIXED, true);
    expect(prevented(run)).toEqual([4]);
    expect(hurt(run)).toBe(1);
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(1);
  });
  it("two Katanas: prevents 2 + 4 = 6, only the 5 pending; no Knife, no confuse", () => {
    const run = defend(KATANAS, true);
    expect(prevented(run)).toEqual([5]);
    expect(hurt(run)).toBe(0);
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(0);
  });
  it("two players: it answers only damage to Psylocke's own identity, not to the other player", () => {
    const run = defend(KNIVES, true, [SPIDER_MAN, PSYLOCKE]);
    // The only damage prevented is Psylocke's own (seat 2); the interrupt was played once.
    expect(prevented(run)).toEqual([2]);
    expect(events(run.events, "damagePrevented").map((e) => e.targetInstanceId)).toEqual([identityOf(run.state, P2)]);
    expect(hurt(run)).toBeLessThan(events(run.events, "attackResolved")[0]!.damageDealt);
  });
});

describe("Telepathic Suggestion (41007)", () => {
  /**
   * End Psylocke's turn with Gang-Up (01189) the card dealt to her: "When Revealed (Hero): The villain and each minion
   * engaged with you attacks you." The villain's own activation draws the blank boost 01186 first. `pick` answers the
   * interrupt and the choices of the event.
   */
  function reveal(
    faces: readonly [boolean, boolean],
    pick: Picker | null,
    extra: (s: GameState) => GameState = (s) => s,
  ) {
    const given = moveToHand(extra(blades(game(), faces)), P1, "41007");
    const base = stackEncounterDeck(given.state, "01186", "01189");
    return driveEventsPicking(WAVE7_DEPS, base, keeping(pick ?? accepting("none"), "41007"), endTurn(P1));
  }
  const hurt = (s: GameState) => damage(s, identityOf(s));
  it("baseline: Gang-Up resolves, the villain attacks again", () => {
    const run = reveal(KNIVES, null);
    expect(events(run.events, "revealCancelled")).toEqual([]);
    expect(events(run.events, "attackResolved")).toHaveLength(2); // the activation, then Gang-Up's attack
    expect(hurt(run.state)).toBe(events(run.events, "attackResolved").reduce((n, e) => n + e.damageDealt, 0));
  });
  it("cancels the 'When Revealed' effects of the card: no second attack", () => {
    const run = reveal(KATANAS.map(() => false) as unknown as readonly [boolean, boolean], accepting(SUGGESTION));
    expect(events(run.events, "revealCancelled").map((e) => e.scope)).toEqual(["whenRevealed"]);
    expect(events(run.events, "attackResolved")).toHaveLength(1);
    expect(discardCodes(run.state)).toContain("41007");
  });
  it("two Katanas: 2 damage to each of two chosen enemies; no Knife, no threat removed", () => {
    const base = game();
    const run = reveal(KATANAS, accepting(SUGGESTION, queue(stryfe(base), stryfe(base))));
    expect(
      events(run.events, "damageDealt")
        .filter((e) => e.targetInstanceId === stryfe(run.state))
        .map((e) => e.amount),
    ).toEqual([2, 2]);
    expect(damage(run.state, stryfe(run.state))).toBe(4);
    expect(events(run.events, "threatRemoved")).toEqual([]);
    expect(events(run.events, "attackResolved")).toHaveLength(1);
  });
  it("two Knives: 1 threat from each of two chosen schemes, one thwart-free removal apiece", () => {
    const main = game().mainScheme.instanceId;
    const run = reveal(KNIVES, accepting(SUGGESTION, queue(main, main)));
    expect(events(run.events, "threatRemoved").map((e) => e.amount)).toEqual([1, 1]);
    expect(damage(run.state, stryfe(run.state))).toBe(0);
  });
  it("one Knife and one Katana: 2 damage to an enemy and 1 threat from a scheme", () => {
    const base = game();
    const run = reveal(MIXED, accepting(SUGGESTION, queue(stryfe(base), base.mainScheme.instanceId)));
    expect(
      events(run.events, "damageDealt")
        .filter((e) => e.targetInstanceId === stryfe(run.state))
        .map((e) => e.amount),
    ).toEqual([2]);
    expect(events(run.events, "threatRemoved").map((e) => e.amount)).toEqual([1]);
  });
  it("two players: only the card revealed to Psylocke (seat 2) can be canceled, not the one revealed to the other player", () => {
    const given = moveToHand(blades(game([SPIDER_MAN, PSYLOCKE], 1, P2), KNIVES, P2), P2, "41007");
    const base = stackEncounterDeck(given.state, "40176", "40175", "01186", "01187");
    const run = driveEventsPicking(WAVE7_DEPS, base, keeping(accepting(SUGGESTION), "41007"), endTurn(P1), endTurn(P2));
    const revealed = events(run.events, "encounterCardRevealed");
    const cancelled = events(run.events, "revealCancelled");
    expect(revealed.map((e) => e.playerId)).toEqual([P1, P2]);
    expect(cancelled.map((e) => e.instanceId)).toEqual([revealed[1]!.instanceId]);
  });
  it("is a hero interrupt: with Psylocke in alter-ego form it is not offered", () => {
    const run = reveal(KNIVES, accepting(SUGGESTION), (s) => withForm(s, "alterEgo"));
    expect(discardCodes(run.state)).not.toContain("41007");
  });
});

describe("Concussive Blow (41014)", () => {
  /** Plays it on Stryfe, paying with the hand cards (by printed number) given. */
  function blow(paidWith: readonly string[], players: readonly Seat[] = [PSYLOCKE], seat: PlayerId = P1) {
    const base = game(players, 1, seat);
    const given = moveToHand(base, seat, ...paidWith);
    const pay = given.ids;
    return playEvent(given.state, "41014", 3, queue(stryfe(base)), seat, pay);
  }
  it("paid with a [physical] resource: confuses the enemy and deals 3 damage to it", () => {
    const run = blow(["41019", "41007", "41007"]);
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(1);
    expect(damage(run.state, stryfe(run.state))).toBe(3);
    expect(discardCodes(run.state)).toContain("41014");
  });
  it("paid with no [physical] resource: only confuses", () => {
    const run = blow(["41007", "41007", "41015"]);
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(1);
    expect(damage(run.state, stryfe(run.state))).toBe(0);
  });
  it("is an attack by an event: Psylocke does not exhaust, and it is refused in alter-ego form", () => {
    const run = blow(["41019", "41007", "41007"]);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
    expect(refused(withForm(game(), "alterEgo"), "41014", 3)).toBe(true);
  });
  it("two players: Psylocke as seat 2 pays and attacks on her own turn", () => {
    const base = game([SPIDER_MAN, PSYLOCKE], 1, P2);
    const turn = driveEventsPicking(WAVE7_DEPS, base, firstLegal, endTurn(P1)).state;
    const given = moveToHand(turn, P2, "41019", "41007", "41007");
    const run = playEvent(given.state, "41014", 3, queue(stryfe(turn)), P2, given.ids);
    expect(damage(run.state, stryfe(run.state))).toBe(3);
    expect(discardCodes(run.state, P2)).toContain("41014");
  });
});

describe("Upside the Head (41015)", () => {
  /** Her basic attack on `target` (default Stryfe) with the response accepted (`take`) or declined. */
  function attackWith(state: GameState, take: boolean, attacker: PlayerId = P1, target: InstanceId = stryfe(state)) {
    const command: Command = {
      type: "basicAttack",
      playerId: attacker,
      attackerInstanceId: identityOf(state, attacker),
      targetInstanceId: target,
    };
    return driveEventsPicking(WAVE7_DEPS, state, take ? accepting(UPSIDE) : accepting("none"), command);
  }
  const withUpside = (s: GameState, player: PlayerId = P1): GameState => moveToHand(s, player, "41015").state;
  const confusedStryfe = (s: GameState): GameState =>
    patchInstance(s, stryfe(s), { statuses: { ...inst(s, stryfe(s)).statuses, confused: 1 } });

  it("after her basic attack damages an enemy: confuses it, and the event is paid and discarded", () => {
    const base = withUpside(game());
    const run = attackWith(base, true);
    expect(damage(run.state, stryfe(run.state))).toBe(1);
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(1);
    expect(statusOf(run.state, stryfe(run.state), "stunned")).toBe(0);
    expect(discardCodes(run.state)).toContain("41015");
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(true);
  });
  it("an enemy that is already confused is stunned instead (and stays confused)", () => {
    const run = attackWith(confusedStryfe(withUpside(game())), true);
    expect(statusOf(run.state, stryfe(run.state), "stunned")).toBe(1);
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(1);
  });
  it("is optional: declined, no status is given and the card stays in hand", () => {
    const run = attackWith(withUpside(game()), false);
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(0);
    expect(handCodes(run.state)).toContain("41015");
  });
  it("needs the attack to damage: a tough status card absorbs it and the response is not offered", () => {
    const base = withUpside(game());
    const tough = patchInstance(base, stryfe(base), { statuses: { ...inst(base, stryfe(base)).statuses, tough: 1 } });
    const run = attackWith(tough, true);
    expect(damage(run.state, stryfe(run.state))).toBe(0);
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(0);
    expect(handCodes(run.state)).toContain("41015");
  });
  it("only a basic attack: an attack by Flurry of Blades does not offer it", () => {
    const base = withUpside(blades(game(), KNIVES));
    const run = playEvent(base, "41004", 3, accepting(UPSIDE, queue(stryfe(base), stryfe(base), stryfe(base))));
    expect(damage(run.state, stryfe(run.state))).toBe(2);
    expect(handCodes(run.state)).toContain("41015");
    expect(statusOf(run.state, stryfe(run.state), "stunned")).toBe(0);
  });
  it("is a hero response: refused in alter-ego form (no basic attack is possible there either)", () => {
    const base = withUpside(withForm(game(), "alterEgo"));
    const command: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(base),
      targetInstanceId: stryfe(base),
    };
    expect(applyCommand(base, command, WAVE7_DEPS).ok).toBe(false);
  });
  it("two players: another player's basic attack does not offer it to Psylocke (seat 2)", () => {
    const base = withForm(withUpside(game([SPIDER_MAN, PSYLOCKE], 1, P2), P2), { heroForm: 0 }, P1);
    const run = attackWith(base, true, P1);
    expect(damage(run.state, stryfe(run.state))).toBeGreaterThan(0);
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(0);
    expect(handCodes(run.state, P2)).toContain("41015");
  });
});

describe("Directed Force (41019)", () => {
  const withForce = (s: GameState, copies = 1, player: PlayerId = P1): GameState => {
    let state = s;
    for (let i = 0; i < copies; i++) state = moveToHand(state, player, ...Array(i + 1).fill("41019")).state;
    return state;
  };
  /** Her basic attack on Stryfe, playing Directed Force (and flipping the blade `flip`, when given) as offered. */
  function attackWith(state: GameState, abilities: readonly string[], attacker: PlayerId = P1) {
    return driveEventsPicking(WAVE7_DEPS, state, accepting(abilities), {
      type: "basicAttack",
      playerId: attacker,
      attackerInstanceId: identityOf(state, attacker),
      targetInstanceId: stryfe(state),
    });
  }
  const CONTROL = "41001a.star-psi-energy-control";
  const forceCopies = (s: GameState, player: PlayerId = P1): number =>
    handCodes(s, player).filter((c) => c === "41019").length;

  it("her basic attack with a Psi-Katana (piercing): 2 additional damage, the event costs 0", () => {
    const base = withForce(blades(game(), MIXED));
    const plain = attackWith(base, ["none"]);
    const forced = attackWith(base, [FORCE]);
    const baseline = damage(plain.state, stryfe(plain.state));
    expect(baseline).toBeGreaterThan(0);
    expect(damage(forced.state, stryfe(forced.state))).toBe(baseline + 2);
    expect(discardCodes(forced.state)).toContain("41019");
    expect(handCodes(forced.state)).toHaveLength(handCodes(base).length - 1);
  });
  it("two Psi-Katanas: still one use per attack, the second copy is not offered", () => {
    const base = withForce(blades(game(), KATANAS), 2);
    expect(forceCopies(base)).toBeGreaterThanOrEqual(2);
    const plain = attackWith(base, ["none"]);
    const forced = attackWith(base, [FORCE]);
    expect(damage(forced.state, stryfe(forced.state))).toBe(damage(plain.state, stryfe(plain.state)) + 2);
    expect(discardCodes(forced.state).filter((c) => c === "41019")).toHaveLength(1);
    expect(forceCopies(forced.state)).toBe(forceCopies(base) - 1);
  });
  it("an attack without a keyword (two Psi-Knives): not offered, the card stays in hand", () => {
    const base = withForce(blades(game(), KNIVES));
    const plain = attackWith(base, ["none"]);
    const forced = attackWith(base, [FORCE]);
    expect(damage(forced.state, stryfe(forced.state))).toBe(damage(plain.state, stryfe(plain.state)));
    expect(forceCopies(forced.state)).toBe(forceCopies(base));
  });
  it("Psi-Energy Control flips a Knife to a Katana first, so the attack has piercing in time", () => {
    const base = withForce(blades(game(), KNIVES));
    const plain = attackWith(base, ["none"]);
    const forced = attackWith(base, [CONTROL, FORCE]);
    // The flip itself adds the Katana's +1 ATK; the event adds 2 more.
    expect(damage(forced.state, stryfe(forced.state))).toBe(damage(plain.state, stryfe(plain.state)) + 1 + 2);
    expect(forceCopies(forced.state)).toBe(forceCopies(base) - 1);
  });
  it("only her own attacks: another player's attack does not offer it (seat 2 holds it)", () => {
    const base = withForce(blades(game([SPIDER_MAN, PSYLOCKE], 1, P2), KATANAS, P2), 1, P2);
    const ready = withForm(base, { heroForm: 0 }, P1);
    const plain = attackWith(ready, ["none"], P1);
    const forced = attackWith(ready, [FORCE], P1);
    expect(damage(forced.state, stryfe(forced.state))).toBe(damage(plain.state, stryfe(plain.state)));
    expect(forceCopies(forced.state, P2)).toBe(forceCopies(ready, P2));
  });
});

describe("Soaring Hearts (41020)", () => {
  /** Psylocke with Angel (41003) in play as her ally, both exhausted, and three events in her discard pile. */
  function staged(extra: (s: GameState) => GameState = (s) => s) {
    let s = game();
    const angel = moveToHand(s, P1, "41003");
    s = angel.state;
    s = driveEventsPicking(
      WAVE7_DEPS,
      s,
      firstLegal,
      play(P1, angel.ids[0]!, payWith(s, P1, 3, [angel.ids[0]!])),
    ).state;
    for (const code of ["41004", "41014", "41019"]) s = moveToDiscard(s, P1, code).state;
    const angelId = instancesOf(s, "41003").find((id) => playerOf(s, P1).playArea.includes(id))!;
    s = patchInstance(s, angelId, { exhausted: true });
    s = patchInstance(s, identityOf(s), { exhausted: true });
    return { state: extra(s), angelId };
  }
  const offered: string[] = [];
  const takingSkill =
    (code: string): Picker =>
    (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseCards") {
        offered.splice(0, offered.length, ...choice.options.map((o) => codeOf(s, o.optionId as InstanceId)));
        const hit = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === code);
        if (hit) return [hit.optionId];
      }
      return firstLegal(s);
    };

  it("Angel and Psylocke in play: fetches an identity-specific event from the discard pile and readies both", () => {
    const { state, angelId } = staged();
    const run = playEvent(state, "41020", 2, takingSkill("41004"));
    // The two Telepathic Suggestions she paid with are in the discard pile by now; Concussive Blow (justice) and
    // Directed Force (basic) are events but not identity-specific.
    expect([...offered].sort()).toEqual(["41004", "41007", "41007"]);
    expect(handCodes(run.state)).toContain("41004");
    expect(discardCodes(run.state)).not.toContain("41004");
    expect(discardCodes(run.state)).toEqual(expect.arrayContaining(["41014", "41019", "41020"]));
    expect(inst(run.state, angelId).exhausted).toBe(false);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
  });
  it("the pick is optional: with none taken both are still readied", () => {
    const { state, angelId } = staged();
    const run = playEvent(state, "41020", 2, (s) =>
      s.pendingChoice?.prompt.kind === "chooseCards" ? [] : firstLegal(s),
    );
    expect(handCodes(run.state)).not.toContain("41004");
    expect(inst(run.state, angelId).exhausted).toBe(false);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
  });
  it("Team-Up: refused while Angel is not in play (Psylocke alone)", () => {
    expect(refused(game(), "41020", 2)).toBe(true);
  });
  it("Team-Up: accepted with Angel in play, refused in alter-ego form (a Hero Action)", () => {
    const { state } = staged();
    expect(refused(state, "41020", 2)).toBe(false);
    expect(refused(withForm(state, "alterEgo"), "41020", 2)).toBe(true);
  });
  it("two players: Angel as the other player's hero satisfies the Team-Up, and both identities are readied; Archangel and Warren do not (Q37)", () => {
    const hero = (form: { heroForm: number } | "alterEgo") => {
      const base = withForm(game([PSYLOCKE, ANGEL]), form, P2);
      return patchInstance(patchInstance(base, identityOf(base, P1), { exhausted: true }), identityOf(base, P2), {
        exhausted: true,
      });
    };
    const ok = hero({ heroForm: 0 });
    expect(refused(ok, "41020", 2)).toBe(false);
    const run = playEvent(ok, "41020", 2);
    expect(inst(run.state, identityOf(run.state, P1)).exhausted).toBe(false);
    expect(inst(run.state, identityOf(run.state, P2)).exhausted).toBe(false);
    expect(refused(hero({ heroForm: 1 }), "41020", 2)).toBe(true);
    expect(refused(hero("alterEgo"), "41020", 2)).toBe(true);
  });
});
