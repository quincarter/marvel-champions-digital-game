import {
  activeEncounterDeck,
  activeVillain,
  characterProfile as characterProfileOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { WAVE3_DEPS } from "../index.js";
import { playFromHand, revealFromEncounterDeck, startWave3Game } from "../testing.js";
import { draxScenario } from "./support.js";

const draxVsRhino = (seed = 1) => startWave3Game(draxScenario("rhino", { seed }));

/** Accepts the named optional response/interrupt; declines everything else. Mirrors `../drax/drax-kit.test.ts`. */
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

/** Picks the offered option whose label starts with `prefix`; declines/first-legals everything else. Mirrors
 * `../gam/gamora-obligation-nemesis.test.ts`. */
const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

function characterProfile(state: GameState, id: InstanceId) {
  const profile = characterProfileOf(state, id, WAVE3_DEPS);
  if (!profile) throw new Error(`no character profile for ${id}`);
  return profile;
}

describe("Gamora (ally, 19020)", () => {
  it("Hero Response: after Gamora attacks or thwarts, discard from the top of your deck until an event, add it to hand (19020.gamora-response)", () => {
    const hero = runWith(WAVE3_DEPS, draxVsRhino(1), toHero());
    const given = moveToHand(hero, P1, "19020");
    const [gamoraCard] = given.ids as [InstanceId];
    const played = runWith(WAVE3_DEPS, given.state, play(P1, gamoraCard, payWith(given.state, P1, 3, [gamoraCard])));
    const gamoraId = instancesOf(played, "19020")[0] as InstanceId;
    const readied = patchInstance(played, gamoraId, { exhausted: false });
    const villain = activeVillain(readied).instanceId;
    const beforeDeck = playerOf(readied, P1).deck.length;
    const beforeHand = playerOf(readied, P1).hand.length;
    const attacked = settle(
      runWith(WAVE3_DEPS, readied, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: gamoraId,
        targetInstanceId: villain,
      } as never),
      accepting("19020.gamora-response"),
      undefined,
      WAVE3_DEPS,
    );
    // A real discard-until-an-event search: the deck strictly shrank (at least the matched event, plus every
    // non-event discarded along the way) and the hand grew by exactly the one card found.
    expect(playerOf(attacked, P1).deck.length).toBeLessThan(beforeDeck);
    expect(playerOf(attacked, P1).hand.length).toBe(beforeHand + 1);
  });
});

describe("Memories of Another Life (Drax's obligation, 19025)", () => {
  it("(19025.obligation): exhausting your alter-ego removes it from the game, leaving your hand untouched", () => {
    const staged = stackEncounterDeck(draxVsRhino(), "01186", "19025");
    const handBefore = playerOf(staged, P1).hand.length;
    const revealed = settle(
      runWith(WAVE3_DEPS, staged, endTurn()),
      pickingLabelStartingWith("Exhaust"),
      undefined,
      WAVE3_DEPS,
    );
    const [obligation] = instancesOf(revealed, "19025");
    expect(revealed.removedFromGame).toContain(obligation);
    expect(playerOf(revealed, P1).hand.length).toBe(handBefore);
  });

  it("(19025.obligation): otherwise you are stunned and the obligation is discarded, not removed from the game", () => {
    const staged = stackEncounterDeck(draxVsRhino(), "01186", "19025");
    const identity = identityOf(staged);
    const revealed = settle(
      runWith(WAVE3_DEPS, staged, endTurn()),
      pickingLabelStartingWith("You are stunned"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(revealed, identity).statuses.stunned).toBeGreaterThan(0);
    const [obligation] = instancesOf(revealed, "19025");
    expect(revealed.removedFromGame).not.toContain(obligation);
  });

  it("choosing 'you are stunned' when not yet stunned gains no surge (16025's own precedent, `gmw/groot-obligation-nemesis.test.ts`)", () => {
    const staged = stackEncounterDeck(draxVsRhino(), "01186", "19025");
    const discardBefore = activeEncounterDeck(staged).discard.length;
    const revealed = settle(
      runWith(WAVE3_DEPS, staged, endTurn()),
      pickingLabelStartingWith("You are stunned"),
      undefined,
      WAVE3_DEPS,
    );
    // Rhino's own boost draw (the filler, ahead of the reveal step) plus the obligation reveal itself: +2, no more.
    expect(activeEncounterDeck(revealed).discard.length).toBe(discardBefore + 2);
  });

  it("(19025.obligation): gains surge when Drax is already stunned", () => {
    const staged = stackEncounterDeck(draxVsRhino(), "01186", "19025");
    const identity = identityOf(staged);
    const alreadyStunned = patchInstance(staged, identity, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const discardBefore = activeEncounterDeck(alreadyStunned).discard.length;
    const revealed = settle(
      runWith(WAVE3_DEPS, alreadyStunned, endTurn()),
      pickingLabelStartingWith("You are stunned"),
      undefined,
      WAVE3_DEPS,
    );
    // Baseline is +2 (the filler, then the obligation reveal itself). Surge draws and reveals a further card.
    expect(activeEncounterDeck(revealed).discard.length).toBeGreaterThan(discardBefore + 2);
  });
});

describe('Drax\'s nemesis set (Cull the Weak, Yotat the Destroyer, Challenge Accepted, "I Will Destroy You!")', () => {
  it("Cull the Weak (19026.cull-the-weak-constant): each enemy gets +2 ATK", () => {
    const start = draxVsRhino(1);
    const villain = activeVillain(start).instanceId;
    const printedAtk = characterProfile(start, villain).atk;
    const { state: revealed } = revealFromEncounterDeck(start, "19026", firstLegal);
    expect(characterProfile(revealed, villain).atk).toBe(printedAtk + 2);
  });

  it("Challenge Accepted (19028.challenge-accepted-forced-response): discarded after Drax deals 4+ damage to attached enemy with a single attack", () => {
    const start = draxVsRhino(1);
    // Attaches to "the enemy with the highest ATK" (data) — Rhino is the only enemy in play at this point, so it's
    // the automatic target.
    const { state: attached } = revealFromEncounterDeck(start, "19028", firstLegal);
    const villain = activeVillain(attached).instanceId;
    expect(inst(attached, villain).attachments.length).toBeGreaterThan(0);
    const hero = runWith(WAVE3_DEPS, attached, toHero());
    // Hard Knocks (19016): a guaranteed single 4-damage attack — the deterministic way to land "4 or more damage
    // ... with a single attack" without depending on Drax's own printed ATK plus vengeance counters.
    const { state } = playFromHand(hero, "19016", 3);
    expect(inst(state, villain).attachments.length).toBe(0);
  });

  it('"I Will Destroy You!" (19029.when-revealed-alter-ego): gains surge when revealed in alter-ego form', () => {
    const start = draxVsRhino(1);
    const beforeDiscard = activeEncounterDeck(start).discard.length;
    const { state: revealed } = revealFromEncounterDeck(start, "19029", firstLegal);
    // Alter-ego reveal: "This card gains surge" — one extra card consumed beyond the filler and the card itself.
    expect(activeEncounterDeck(revealed).discard.length).toBeGreaterThan(beforeDiscard + 1);
  });

  it('"I Will Destroy You!" (19029.when-revealed-hero): with no Yotat in play, the villain attacks you instead', () => {
    const hero = runWith(WAVE3_DEPS, draxVsRhino(1), toHero());
    const identity = identityOf(hero);
    const damageBefore = inst(hero, identity).damage;
    const { state } = revealFromEncounterDeck(hero, "19029", firstLegal);
    // Undefended (no ally to declare), so the villain's attack lands on Drax's identity directly.
    expect(inst(state, identity).damage).toBeGreaterThan(damageBefore);
  });
});
