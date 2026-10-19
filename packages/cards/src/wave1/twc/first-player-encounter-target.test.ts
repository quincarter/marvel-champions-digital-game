import { maxHitPoints, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEventsPicking, withActive } from "../../testing/staging.js";
import { wave1Scenario } from "../setup.js";
import { runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

/**
 * E32 (docs/phase7-wave11-scenarios.md §S7 item 37; RRG 1.8 "First Player", p. 19): an encounter card's target among
 * several eligible cards, where the card does not print "choose", is selected by the first player; "you control"
 * defines the pool, not the chooser, and so does a tie on "highest" or "fewest".
 *
 * P2 controls two supports (both Med Team, cost 3), a cost tie; the card is revealed to or boosts an attack on P2, yet
 * P1, the first player, is the one asked.
 */
const twoPlayersWithTiedSupports = () => {
  let state = startTwcGame(
    wave1Scenario("breakout", {
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-black-panther-protection" }],
      seed: 41,
    }),
  );
  const medTeams = playerOf(state, P2)
    .deck.filter((i) => state.instances[i]!.cardId === "01080")
    .slice(0, 2);
  expect(medTeams).toHaveLength(2);
  state = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P2
        ? { ...p, deck: p.deck.filter((i) => !medTeams.includes(i)), playArea: [...p.playArea, ...medTeams] }
        : p,
    ),
    instances: Object.fromEntries(
      Object.entries(state.instances).map(([id, v]) => [
        id,
        medTeams.includes(id as InstanceId) ? { ...v, faceup: true, controllerId: P2 } : v,
      ]),
    ) as GameState["instances"],
  };
  return { state, medTeams };
};

const askedFor = (state: GameState, slot: string, ...commands: Parameters<typeof runTwc>[1][]) =>
  settle(
    runTwc(state, ...commands),
    firstLegal,
    (s) =>
      s.pendingChoice?.prompt.kind === "chooseTarget" && (s.pendingChoice.prompt as { slot?: string }).slot === slot,
    TWC_DEPS,
  );

describe("E32: encounter-side targets go to the first player", () => {
  it("07042.boost: boosting an attack on P2, the first player (P1) picks which of P2's supports is discarded", () => {
    const { state, medTeams } = twoPlayersWithTiedSupports();
    const staged = stackEncounterDeck(withActive(state, state.villains[2]!.instanceId), "07042", "07043");
    const asked = askedFor(staged, "oversized-hands-support", toHero(P1), endTurn(P1), toHero(P2), endTurn(P2));
    const choice = asked.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    expect(choice.options.map((o) => o.optionId).sort()).toEqual([...medTeams].sort());
  });

  it("07042.when-revealed: revealed to P2, a tie on the highest-cost support is broken by P1", () => {
    const { state, medTeams } = twoPlayersWithTiedSupports();
    const staged = stackEncounterDeck(withActive(state, state.villains[2]!.instanceId), "07037", "07043", "07042");
    const asked = askedFor(staged, "oversized-hands-tied", endTurn(P1), endTurn(P2));
    const choice = asked.pendingChoice!;
    expect((asked.step as { remainingPlayerIds?: readonly string[] }).remainingPlayerIds).toEqual([P2]);
    expect(choice.playerId).toBe(P1);
    expect(choice.options.map((o) => o.optionId).sort()).toEqual([...medTeams].sort());
  });

  it("07016.when-revealed: a tie on the fewest remaining hit points between the heroes is broken by P1", () => {
    let { state } = twoPlayersWithTiedSupports();
    // Both heroes stay in alter-ego form, so the villain's activation does not touch their damage; both have 5 left.
    for (const player of [P1, P2]) {
      const id = identityOf(state, player);
      state = patchInstance(state, id, { damage: maxHitPoints(state, id, TWC_DEPS)! - 5 });
    }
    const staged = stackEncounterDeck(
      withActive(state, state.villains[0]!.instanceId),
      "07015",
      "07007",
      "07012",
      "07016",
    );
    const asked = askedFor(staged, "dead-meat-pick", endTurn(P1), endTurn(P2));
    const choice = asked.pendingChoice!;
    // The card is being revealed to P2, the last player to reveal.
    expect((asked.step as { remainingPlayerIds?: readonly string[] }).remainingPlayerIds).toEqual([P2]);
    expect(choice.playerId).toBe(P1);
    expect(choice.options.map((o) => o.optionId).sort()).toEqual([identityOf(state, P1), identityOf(state, P2)].sort());
  });

  // E36 setup (Thunderball's activations reach his scheme's cap of 10 and it falls to 3 (Thunderstruck); the others stay under 10 (Pile Drive)): each villain's signature side scheme at the given threat, and then the encounter cards stacked: every
  // villain's deck gets two boost cards with no boost ability of their own (one per player's activation), so the
  // villain phase moves no counter; the active villain's deck then holds the reveals, in player order.
  const withSideSchemes = (state: GameState, threats: readonly number[]): GameState =>
    state.villains.reduce((acc, v, i) => patchInstance(acc, v.signatureSideSchemeId!, { threat: threats[i]! }), state);
  /** `reveals` empty: two harmless cards stand in for them (a probe run that only measures threat). */
  const stackReveals = (state: GameState, activeIndex: number, ...reveals: readonly string[]): GameState => {
    let staged = state;
    for (const [i, villain] of state.villains.entries()) {
      staged = withActive(staged, villain.instanceId);
      const piles = staged.encounterDecks[villain.encounterDeckId]!;
      const calm = [
        ...new Set(
          piles.deck
            .map((id) => staged.instances[id]!.cardId as string)
            .filter((code) => !reveals.includes(code))
            .filter((code) => !Object.keys(TWC_DEPS.abilities).some((key) => key.startsWith(`${code}.boost`))),
        ),
      ].slice(0, 2);
      expect(calm).toHaveLength(2);
      staged = stackEncounterDeck(staged, ...calm, ...(i === activeIndex ? reveals : []));
    }
    return withActive(staged, state.villains[activeIndex]!.instanceId);
  };
  /**
   * The villain phase moves threat and the counter before the reveals (acceleration, Breakout's counter move, activations,
   * boost icons), so a probe run from `base` (stand-in cards for the reveals) shows where each side scheme stands when the
   * first card is revealed; `adjust` turns that into the change to each starting threat that makes the wanted tie. The
   * counter must still sit on `activeIndex`'s villain, whose deck holds the reveals.
   */
  const stagedForTie = (
    state: GameState,
    activeIndex: number,
    base: readonly number[],
    adjust: (atReveal: readonly number[]) => readonly number[],
    ...reveals: string[]
  ) => {
    const probe = settle(
      runTwc(stackReveals(withSideSchemes(state, base), activeIndex), endTurn(P1), endTurn(P2)),
      firstLegal,
      undefined,
      TWC_DEPS,
    );
    expect(probe.activeVillainId).toBe(state.villains[activeIndex]!.instanceId);
    const deltas = adjust(threatsOf(probe));
    const start = base.map((b, i) => b + deltas[i]!);
    expect(Math.min(...start)).toBeGreaterThanOrEqual(0);
    return stackReveals(withSideSchemes(state, start), activeIndex, ...reveals);
  };
  const threatsOf = (s: GameState) => s.villains.map((v) => s.instances[v.signatureSideSchemeId!]!.threat);
  /** Answers a target choice with its second option; every other choice is `firstLegal`'s. */
  const second: Parameters<typeof driveEventsPicking>[2] = (s) => {
    const choice = s.pendingChoice!;
    return choice.prompt.kind === "chooseTarget" ? [(choice.options[1] ?? choice.options[0]!).optionId] : firstLegal(s);
  };
  const twoPlayers = () => twoPlayersWithTiedSupports().state;

  // E36: a tie on a superlative that feeds a single-target effect is the first player's pick, never instance order.
  it("07013.when-revealed: revealed to P2, a tie on the villain with the most threat is P1's pick, and that villain schemes", () => {
    const state = withSideSchemes(twoPlayers(), [3, 3, 8, 8]);
    const staged = stackReveals(state, 0, "07014", "07013");
    const asked = askedFor(staged, "twc-villain-pick", endTurn(P1), endTurn(P2));
    const choice = asked.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    expect(choice.options.map((o) => o.optionId).sort()).toEqual(
      [asked.villains[2]!.instanceId, asked.villains[3]!.instanceId].sort(),
    );
    const { events } = driveEventsPicking(TWC_DEPS, asked, second);
    const schemers = events.flatMap((e) =>
      e.type === "enemyActivated" && e.activation === "scheme" ? [e.enemyInstanceId] : [],
    );
    expect([...new Set(schemers)]).toEqual([choice.options[1]!.optionId]);
  });

  it("07013.when-revealed: one villain with the most threat is no choice: solo, nobody is asked and it schemes", () => {
    const solo = startTwcGame(
      wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }),
    );
    const state = withSideSchemes(solo, [2, 3, 4, 5]);
    const getWrecked = ["07013", "07028", "07040", "07057"];
    const index = state.villains.findIndex((v) =>
      state.encounterDecks[v.encounterDeckId]!.deck.some((id) =>
        getWrecked.includes(state.instances[id]!.cardId as string),
      ),
    );
    const code = getWrecked.find((c) =>
      state.encounterDecks[state.villains[index]!.encounterDeckId]!.deck.some(
        (id) => state.instances[id]!.cardId === c,
      ),
    )!;
    const staged = stackReveals(state, index, code);
    // Side schemes 2/3/4/5 (the villains' own activations raise Thunderball's by 9, still unique): no tie, no prompt.
    expect(askedFor(staged, "twc-villain-pick", endTurn(P1)).pendingChoice).toBeNull();
  });

  it("07010.boost: a tie on the least-threat villain is broken by P1 when the boost is for P2's attack", () => {
    const state = twoPlayers();
    const tied = state.villains.reduce(
      (acc, v, i) => patchInstance(acc, v.signatureSideSchemeId!, { threat: i < 2 ? 3 : 8 }),
      state,
    );
    const staged = stackEncounterDeck(withActive(tied, tied.villains[0]!.instanceId), "07008", "07010");
    const asked = askedFor(staged, "twc-villain-pick", toHero(P1), endTurn(P1), toHero(P2), endTurn(P2));
    expect(asked.pendingChoice!.playerId).toBe(P1);
    const options = asked.pendingChoice!.options.map((o) => o.optionId);
    expect(options.length).toBeGreaterThan(1);
    const { events } = driveEventsPicking(TWC_DEPS, asked, second);
    const moved = events.find((e) => e.type === "activeVillainChanged");
    expect(moved && moved.type === "activeVillainChanged" && moved.to).toBe(options[1]);
  });

  it("07030.when-revealed: two side schemes tied for most threat, P1 picks the second and only it gets the 3 threat", () => {
    // Thunderball's scheme (7 start) and Piledriver's (7 start) meet at 8; Breakout's counter move leaves the counter,
    // and so the reveals, with Thunderball (the first of the tied pair).
    const staged = stagedForTie(twoPlayers(), 1, [2, 7, 7, 4], () => [0, 0, 0, 0], "07029", "07030");
    const asked = askedFor(staged, "blast-scheme", endTurn(P1), endTurn(P2));
    const choice = asked.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    const [one, two] = [asked.villains[1]!.signatureSideSchemeId!, asked.villains[2]!.signatureSideSchemeId!];
    expect(choice.options.map((o) => o.optionId).sort()).toEqual([one, two].sort());
    const picked = choice.options[1]!.optionId;
    const { events } = driveEventsPicking(TWC_DEPS, asked, second);
    const blast = events.flatMap((e) =>
      e.type === "threatPlaced" && e.amount === 3 && asked.instances[e.sourceInstanceId!]?.cardId === "07030"
        ? [e.schemeInstanceId]
        : [],
    );
    expect(blast).toEqual([picked]);
  });

  it("07031.when-revealed: tied for least, P1 picks the source; all its threat moves off it to the unique most", () => {
    // Least: Wrecker's and Bulldozer's schemes (5 each at the reveal); most: Thunderball's (8, unique).
    const staged = stagedForTie(twoPlayers(), 1, [4, 7, 5, 4], () => [0, 0, 0, 0], "07029", "07031");
    const asked = askedFor(staged, "prowess-from", endTurn(P1), endTurn(P2));
    const choice = asked.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    const before = threatsOf(asked);
    const picked = choice.options[1]!.optionId;
    const from = asked.villains.findIndex((v) => v.signatureSideSchemeId === picked);
    const most = before.indexOf(Math.max(...before));
    expect(from).not.toBe(most);
    const { events } = driveEventsPicking(TWC_DEPS, asked, second);
    const moved = events.filter(
      (e) =>
        (e.type === "threatRemoved" || e.type === "threatPlaced") &&
        e.sourceInstanceId !== null &&
        asked.instances[e.sourceInstanceId]?.cardId === "07031",
    );
    expect(
      moved.map((e) => [
        e.type,
        (e as { schemeInstanceId: string }).schemeInstanceId,
        (e as { amount: number }).amount,
      ]),
    ).toEqual([
      ["threatRemoved", picked, before[from]!],
      ["threatPlaced", asked.villains[most]!.signatureSideSchemeId!, before[from]!],
    ]);
  });
});
