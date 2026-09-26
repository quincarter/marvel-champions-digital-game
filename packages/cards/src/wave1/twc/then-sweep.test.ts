/**
 * The Wrecking Crew cards whose printed "Then" waits on an activation (docs/then-sweep.md, RRG 1.8 "'Then'", p. 44):
 * Held Hostage's "The villain … attacks you. Then, discard this card." and Crowbar Toss's "Wrecker schemes/attacks you.
 * Then, move the active villain counter …". A stunned villain removes its stun instead of attacking and a confused one
 * its confusion instead of scheming (RRG 1.8 "Stun", p. 41; "Confuse", p. 13), so the activation did not happen and
 * the post-"then" text is skipped.
 */

import { activeEncounterDeckId, villainOf, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { P1, endTurn, firstLegal, identityOf, inst, patchInstance, toHero, use } from "../../testing/harness.js";
import { driveEvents, driveStepwise } from "../../testing/staging.js";
import { wave1Scenario } from "../setup.js";
import { findInstance, forceAttachToVillain, runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

const spiderManVsBreakout = () =>
  startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));

const villainNamed = (state: GameState, name: string): InstanceId => {
  const found = state.villains.find((v) => state.cardPool[inst(state, v.instanceId).cardId]?.name === name);
  if (!found) throw new Error(`no villain ${name}`);
  return found.instanceId;
};
const skipped = (events: readonly GameEvent[]) => events.some((e) => e.type === "thenSkipped");
const causes = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "preThenUnresolved" ? [e.cause] : []));
const withStatus = (state: GameState, id: InstanceId, status: "stunned" | "confused") =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, [status]: 1 } });

describe.each([
  ["07005", "Wrecker"],
  ["07021", "Thunderball"],
  ["07036", "Piledriver"],
  ["07050", "Bulldozer"],
])("Held Hostage (%s, %s's set): 'Then, discard this card' waits on the attack", (code, name) => {
  /** Held Hostage attached to `name`'s side scheme (surgery), P1 in hero form. */
  function withHostage() {
    const start = spiderManVsBreakout();
    const villain = villainNamed(start, name);
    const scheme = villainOf(start, villain)!.signatureSideSchemeId!;
    const hostage = findInstance(start, code);
    return { state: runTwc(forceAttachToVillain(start, hostage, scheme), toHero()), villain, scheme, hostage };
  }

  it("a stunned villain removes its stun instead of attacking, and Held Hostage stays", () => {
    const { state, villain, scheme, hostage } = withHostage();
    const { state: after, events } = driveEvents(
      TWC_DEPS,
      withStatus(state, villain, "stunned"),
      use(P1, hostage, `${code}.held-hostage-action`),
    );
    expect(inst(after, villain).statuses.stunned).toBe(0);
    expect(causes(events)).toEqual(["activationDidNotHappen"]);
    expect(skipped(events)).toBe(true);
    expect(inst(after, scheme).attachments).toContain(hostage);
  });

  it("an attack that happens discards it", () => {
    const { state, villain, scheme, hostage } = withHostage();
    const { state: after, events } = driveEvents(TWC_DEPS, state, use(P1, hostage, `${code}.held-hostage-action`));
    expect(events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === villain)).toBe(true);
    expect(skipped(events)).toBe(false);
    expect(inst(after, scheme).attachments).not.toContain(hostage);
  });
});

describe("Crowbar Toss (07012): the counter moves only if Wrecker attacks", () => {
  /**
   * P1 in hero form, Crowbar Toss second from the top of Wrecker's deck: Wrecker's own villain-phase attack takes the
   * top card as its boost, then P1 reveals Crowbar Toss ("Wrecker attacks you. Then, move the active villain counter
   * …"). `stunAtFirstDefense` stuns Wrecker while his own attack is already under way (at its defender prompt), so the
   * stun cancels his *next* attack: Crowbar Toss's.
   */
  function crowbarToss(stunAtFirstDefense: boolean) {
    const start = runTwc(spiderManVsBreakout(), toHero());
    const wrecker = villainNamed(start, "Wrecker");
    const crowbar = findInstance(start, "07012");
    const deckId = activeEncounterDeckId(start);
    const piles = start.encounterDecks[deckId]!;
    const deck = piles.deck.filter((x) => x !== crowbar);
    const state: GameState = {
      ...start,
      encounterDecks: { ...start.encounterDecks, [deckId]: { ...piles, deck: [deck[0]!, crowbar, ...deck.slice(1)] } },
    };
    let stunned = !stunAtFirstDefense;
    const identity = identityOf(state);
    // Two undefended Wrecker attacks would defeat Spider-Man; heal him at each defender prompt (surgery) to keep going.
    const { state: after, events } = driveStepwise(TWC_DEPS, runTwc(state, endTurn()), firstLegal, (s) => {
      if (s.pendingChoice?.prompt.kind !== "declareDefender") return s;
      const healed = patchInstance(s, identity, { damage: 0 });
      if (stunned) return healed;
      stunned = true;
      return withStatus(healed, wrecker, "stunned");
    });
    const revealedAt = events.findIndex((e) => e.type === "encounterCardRevealed" && e.instanceId === crowbar);
    expect(revealedAt).toBeGreaterThanOrEqual(0);
    return { after, wrecker, afterReveal: events.slice(revealedAt) };
  }

  it("a stunned Wrecker removes his stun instead of attacking, so the counter does not move", () => {
    const { after, wrecker, afterReveal } = crowbarToss(true);
    expect(inst(after, wrecker).statuses.stunned).toBe(0);
    expect(causes(afterReveal)).toContain("activationDidNotHappen");
    expect(skipped(afterReveal)).toBe(true);
    expect(afterReveal.some((e) => e.type === "activeVillainChanged")).toBe(false);
  });

  it("Wrecker attacks, then the counter moves to the villain whose side scheme has the least threat", () => {
    const { afterReveal } = crowbarToss(false);
    console.log(
      afterReveal
        .filter((e) => !["cardMoved", "triggerEvent"].includes(e.type))
        .map((e) => JSON.stringify(e).slice(0, 160))
        .join("\n"),
    );
    expect(skipped(afterReveal)).toBe(false);
    expect(afterReveal.some((e) => e.type === "attackResolved")).toBe(true);
    expect(afterReveal.some((e) => e.type === "activeVillainChanged")).toBe(true);
  });
});
