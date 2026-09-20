import type { GameState, InstanceId } from "@mc/engine";
import { endTurn, firstLegal, identityOf, instancesOf, moveToHand, P1, payWith, play, playerOf, settle, toHero, use } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { KANG_ENCOUNTER_SET } from "./kang-encounter-set.js";

/** Damages `target` to the brink, then lands the killing blow with a real `basicAttack` — the same trick
 * `kang.test.ts` uses, so the engine's own defeat pipeline (When Defeated triggers included) runs normally. */
function defeatWithAttack(state: GameState, target: InstanceId) {
  const near = { ...state, instances: { ...state.instances, [target]: { ...state.instances[target]!, damage: 999 } } };
  const identity = identityOf(near);
  return settle(runWave2(near, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: target }), firstLegal, undefined, WAVE2_DEPS);
}

const kangVsHeroes = () => startWave2Game(wave2Scenario("kang", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }));

/**
 * The Kang/Temporal set's own four obligations (11018-11021) carry no `encounterSetIds` (a data gap flagged for
 * `card-data-pipeline`, `kang.test.ts`'s own module docblock precedent, and this file's Time-Travel Hijinks test
 * above), so none of them are ever actually shuffled into a real deck. Relabels an already-in-the-deck filler card
 * as `code` (`patchInstance`'s own "swap the data, keep the instance" convention) rather than routing around the
 * data gap, and reveals it during the villain phase. Index 1, not the top card: index 0 is dealt to Kang (I) as his
 * own boost card before any player's own reveal (RRG 1.8 "Villain Phase", p. 47).
 */
function revealAsObligation(state: GameState, code: string): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const fillerId = state.encounterDecks[deckId]!.deck[1]!;
  const relabeled = { ...state, instances: { ...state.instances, [fillerId]: { ...state.instances[fillerId]!, cardId: code as never } } };
  return settle(runWave2(relabeled, endTurn()), firstLegal, undefined, WAVE2_DEPS);
}

describe("Kang / Temporal encounter set (kang-encounter-set.ts)", () => {
  it("Time-Travel Hijinks (11021): When Revealed discards the highest-cost card you control, then tucks it facedown under this card", () => {
    let state = runWave2(kangVsHeroes(), toHero());
    // Hawkeye (04011, cost 2) is the only ally in the hawkeye-leadership precon — the highest (and only) candidate.
    const moved = moveToHand(state, P1, "04011");
    state = moved.state;
    const allyId = moved.ids[0]!;
    const resources = payWith(state, P1, 2);
    state = settle(runWave2(state, play(P1, allyId, resources)), firstLegal, undefined, WAVE2_DEPS);
    expect(playerOf(state, P1).playArea).toContain(allyId);

    // Time-Travel Hijinks (11021) never surfaces in a real game today — see this file's own module docblock and
    // the test suite comment above: the Kang/Temporal set's four obligations (11018-11021) carry no
    // `encounterSetIds`, a data gap flagged for `card-data-pipeline`, so they're never shuffled into any deck.
    // This test proves the *ability* is correct by relabeling an already-in-the-deck filler encounter card as
    // 11021 (`patchInstance`'s own established "swap the data, keep the instance" convention) rather than
    // routing around the data gap.
    // Card at deck index 0 is dealt to Kang (I) as his own boost card before any player reveals theirs (RRG 1.8
    // "Villain Phase", p. 47: the active villain's activation, boost card included, precedes step 3's player
    // reveals) — relabel index 1, not the top card, so 11021 is what the player actually reveals.
    const deckId = Object.keys(state.encounterDecks)[0]!;
    const fillerId = state.encounterDecks[deckId]!.deck[1]!;
    state = { ...state, instances: { ...state.instances, [fillerId]: { ...state.instances[fillerId]!, cardId: "11021" as never } } };
    // `chooseTarget`'s own `optional: true` means `firstLegal` would decline it outright (it "declines every
    // optional thing"); with only one candidate, picking it explicitly is the real, intended resolution.
    // `picking(allyId)` alone is unsafe here: Kang (I) also attacks this round, and the ally (`i19`) is a legal
    // defender too, so a blanket "pick the ally whenever offered" picker would volunteer it to *defend* instead of
    // answering 11021's own `chooseTarget`. Scope the pick to that one prompt (`slot: "pick"`, this ability's own
    // slot name) and decline everything else, including the defender prompt, like `firstLegal`.
    const pickForTimeTravelHijinks = (s: import("@mc/engine").GameState) =>
      s.pendingChoice?.prompt.kind === "chooseTarget" && s.pendingChoice.prompt.slot === "pick" ? [allyId] : firstLegal(s);
    state = settle(runWave2(state, endTurn()), pickForTimeTravelHijinks, undefined, WAVE2_DEPS);

    // The ally is gone from play, tucked facedown under the obligation instead of sitting in the discard pile.
    expect(playerOf(state, P1).playArea).not.toContain(allyId);
    const obligation = Object.values(state.instances).find((i) => i.cardId === "11021");
    expect(obligation).toBeDefined();
    expect(obligation?.tucked).toContain(allyId);
  });

  // docs/phase7-wave2.md §19: `AbilityCost.discardFromHand` gained `filter`, so each of these three "Alter-Ego
  // Action: Discard a [type] resource from your hand → discard this obligation" refs can now be scripted and
  // exercised with a real command. The three basic resource cards (Hawkeye's own 04023/04024/04025) each carry
  // exactly one printed resource type of the matching kind (`printedResources` reads a "resource"-type card's
  // `producesIcons`, RRG 1.8 "Wild Resource" p. 48's own "printed resource" reading), and are already in the
  // `hawkeye-leadership` precon (1 copy each), so no synthetic card is needed.
  it("Weakened (11018): Alter-Ego Action discards a [physical] resource from hand to discard this obligation", () => {
    const revealed = revealAsObligation(kangVsHeroes(), "11018");
    const obligation = instancesOf(revealed, "11018").find((id) => playerOf(revealed, P1).playArea.includes(id));
    if (!obligation) throw new Error("Weakened never entered play");
    const given = moveToHand(revealed, P1, "04025"); // Strength — printed [physical] resource
    const [strength] = given.ids as [InstanceId];
    const after = settle(
      runWave2(given.state, use(P1, obligation, "11018.weakened-action", [], { discard: [strength] })),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(playerOf(after, P1).playArea).not.toContain(obligation);
    expect(playerOf(after, P1).hand).not.toContain(strength);
  });

  it("Stolen Memories (11019): Alter-Ego Action discards a [mental] resource from hand to discard this obligation, and the cards tucked beneath it", () => {
    // Genius moved to hand *before* the reveal: its own "When Revealed" tucks the top 8 cards of the deck (this
    // same file's `when-revealed` ability, proven separately above for 11021's own version) — left in the deck, it
    // could be one of the 8 tucked away instead of ending up payable from hand.
    const given = moveToHand(kangVsHeroes(), P1, "04024"); // Genius — printed [mental] resource
    const [genius] = given.ids as [InstanceId];
    const revealed = revealAsObligation(given.state, "11019");
    const obligation = instancesOf(revealed, "11019").find((id) => playerOf(revealed, P1).playArea.includes(id));
    if (!obligation) throw new Error("Stolen Memories never entered play");
    const tuckedBefore = revealed.instances[obligation]!.tucked;
    expect(tuckedBefore.length).toBeGreaterThan(0);
    const after = settle(
      runWave2(revealed, use(P1, obligation, "11019.stolen-memories-action", [], { discard: [genius] })),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(playerOf(after, P1).playArea).not.toContain(obligation);
    // RRG 1.8 "Tuck": a card that leaves play discards whatever is tucked beneath it — the printed parenthetical's
    // own "(Discard each facedown card under this obligation.)" needs no separate effect for the same reason.
    for (const id of tuckedBefore) expect(playerOf(after, P1).deck).not.toContain(id);
  });

  it("Time-Travel Hijinks (11021): Alter-Ego Action discards an [energy] resource from hand to discard this obligation", () => {
    const revealed = revealAsObligation(kangVsHeroes(), "11021");
    const obligation = instancesOf(revealed, "11021").find((id) => playerOf(revealed, P1).playArea.includes(id));
    if (!obligation) throw new Error("Time-Travel Hijinks never entered play");
    const given = moveToHand(revealed, P1, "04023"); // Energy — printed [energy] resource
    const [energy] = given.ids as [InstanceId];
    const after = settle(
      runWave2(given.state, use(P1, obligation, "11021.time-travel-hijinks-action", [], { discard: [energy] })),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(playerOf(after, P1).playArea).not.toContain(obligation);
    expect(playerOf(after, P1).hand).not.toContain(energy);
  });

  it("Terminatrix (11043): a constant keyword grant — her attacks gain piercing", () => {
    expect(KANG_ENCOUNTER_SET["11043.terminatrix-constant"]).toBeDefined();
  });

  // Same modest bar `kang.test.ts` already uses for Kang (Rama-Tut)'s structurally identical "+1 ATK for each
  // obligation" constant (11004.kang-rama-tut-constant) — a live per-obligation stat grant read off the engaged
  // player, not exercised end-to-end here.
  it("Kang (Master of Time) (11047): gets +1 SCH and +1 ATK for each obligation in the engaged player's play area (a live count)", () => {
    expect(KANG_ENCOUNTER_SET["11047.kang-master-of-time-constant"]).toBeDefined();
  });

  it("The Anachronauts (11045): When Defeated shuffles each Temporal card in the encounter discard pile back into the encounter deck", () => {
    expect(KANG_ENCOUNTER_SET["11045.when-defeated"]).toBeDefined();
  });

  it("Ancient Grudge (11051): Kang (Master of Time) activates against you; if he isn't in play, searches and puts him into play engaged with you", () => {
    expect(KANG_ENCOUNTER_SET["11051.when-revealed"]).toBeDefined();
  });
});
