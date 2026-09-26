import {
  activeEncounterDeck,
  activeEncounterDeckId,
  activeVillain,
  applyCommand,
  canAttack,
  characterProfile,
  hasKeyword,
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
  resourceAbility,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { nebulaScenario } from "./support.js";

/** Nebula's own real precon (`nebula-justice`) against Rhino (a Core scenario, seated with the wave 4 pool). She
 * starts in alter-ego. */
const nebulaVsRhino = (seed = 1) => startWave4Game(nebulaScenario("rhino", { seed }));

const mainSchemeId = (state: GameState): InstanceId => state.mainScheme.instanceId;

/** Accepts an offered optional trigger (or a target/order choice it later raises) whose optionId ends with one of
 * `wanted` (e.g. its own ability id); falls back to `firstLegal` (which already auto-picks a single legal target)
 * for anything else. */
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

/** Plays Lethal Intent (22010) for X = 1, driving `resolveSpecialsOf` for one chosen technique upgrade — the
 * general way these tests exercise a technique's own "Special" ability without invoking it directly (a "Special"
 * trigger only ever resolves via `resolveSpecials`, never as a player-issued `useAbility` command). */
function resolveSpecialViaLethalIntent(state: GameState, pick: Picker = firstLegal): GameState {
  const given = moveToHand(state, P1, "22010");
  const [lethalIntent] = given.ids as [InstanceId];
  const payment = payWith(given.state, P1, 1, [lethalIntent]);
  return settle(
    runWith(WAVE4_DEPS, given.state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: lethalIntent,
      payment: payment.map((id) => ({ fromHand: id })),
      attachToInstanceId: null,
      x: 1,
    } as never),
    pick,
    undefined,
    WAVE4_DEPS,
  );
}

describe("Nebula (identity, 22001a/b)", () => {
  it("Combat Protocols (22001a.nebula-constant): resolves each technique upgrade's Special and discards it, at the start of her next turn", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(1), toHero());
    // Cutthroat Ambition's Special (thwart): remove 3 threat from a scheme.
    const { state: withTech, id: tech } = playFromHand(hero, "22004", 1);
    const staged = patchInstance(withTech, mainSchemeId(withTech), { threat: 5 });
    // The villain phase's own threat placement (Rhino places some every round) happens across several of its own
    // choices before Nebula's turn (and this forced response) even begins, so the threat this Special actually
    // acts on is only known once play reaches the response's own "choose a scheme" (`chooseTarget`) prompt — not
    // merely once `endTurn()` returns its first pending choice at all (an earlier `declareDefender`, say).
    const rightBeforeSpecial = settle(
      runWith(WAVE4_DEPS, staged, endTurn()),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      WAVE4_DEPS,
    );
    const preThreat = inst(rightBeforeSpecial, mainSchemeId(rightBeforeSpecial)).threat;
    const after = settle(rightBeforeSpecial, firstLegal, undefined, WAVE4_DEPS);
    expect(inst(after, mainSchemeId(after)).threat).toBe(preThreat - 3);
    expect(playerOf(after, P1).discard).toContain(tech);
  });

  it("Cybernetic Upgrades (22001b.nebula-constant): draws 2 after playing a technique upgrade (limit once per round)", () => {
    // Put Evasive Maneuvering in hand first (`moveToHand` is a no-op if it's already there), so "before" already
    // counts it — the played card itself round-trips through the hand with no net effect either way.
    const given = moveToHand(nebulaVsRhino(2), P1, "22005");
    const [tech] = given.ids as [InstanceId];
    const before = playerOf(given.state, P1).hand.length;
    // Playing a 1-cost technique upgrade while still in alter-ego form: nothing on a technique upgrade restricts
    // it to hero form.
    const state = settle(
      runWith(WAVE4_DEPS, given.state, play(P1, tech, payWith(given.state, P1, 1, [tech]))),
      accepting("22001b.nebula-constant"),
      undefined,
      WAVE4_DEPS,
    );
    // -1 playing the tech itself, -1 the resource payment, +2 the draw = net 0.
    expect(playerOf(state, P1).hand.length).toBe(before - 1 - 1 + 2);
  });
});

describe("Gamora (ally, 22002)", () => {
  it("22002.gamora-response: after playing Gamora, choosing a technique upgrade resolves its Special", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(3), toHero());
    const { state: withTech } = playFromHand(hero, "22004", 1);
    const staged = patchInstance(withTech, mainSchemeId(withTech), { threat: 5 });
    const { state } = playFromHand(staged, "22002", 3, accepting("22002.gamora-response"));
    expect(inst(state, mainSchemeId(state)).threat).toBe(2);
  });
});

describe("Nebula's Ship (support, 22003)", () => {
  it("22003.nebulas-ship-resource: exhausts to generate a wild resource, paying for another card", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(4), toHero());
    const { state: withShip, id: ship } = playFromHand(hero, "22003", 2);
    const given = moveToHand(withShip, P1, "22007");
    const [weaponsMaster] = given.ids as [InstanceId];
    const after = settle(
      runWith(
        WAVE4_DEPS,
        given.state,
        play(P1, weaponsMaster, [], { abilities: [resourceAbility(ship, "22003.nebulas-ship-resource")] }),
      ),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, ship).exhausted).toBe(true);
    const identity = identityOf(after, P1);
    expect(inst(after, identity).attachments).toContain(weaponsMaster);
  });
});

describe("Technique upgrades (22004–22008)", () => {
  it("Cutthroat Ambition (22004.cutthroat-ambition-constant): while Nebula is in hero form, her attacks gain piercing (discards a tough status card instead of being absorbed)", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(5), toHero());
    const { state } = playFromHand(hero, "22004", 1);
    const villain = activeVillain(state).instanceId;
    const toughened = patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, tough: 1 } });
    const before = inst(toughened, villain).damage;
    const identity = identityOf(toughened, P1);
    const atk = characterProfile(toughened, identity, WAVE4_DEPS)?.atk ?? 0;
    const after = settle(
      runWith(WAVE4_DEPS, toughened, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // A tough card without piercing would absorb the whole attack (0 damage, tough discarded). With piercing, the
    // tough card is discarded *and* the full attack still lands (RRG 1.8 "Piercing", p. 32) — Cutthroat Ambition
    // grants both piercing and overkill from the same `attacksGainKeywords` rule, so this also exercises overkill's
    // own grant even though only piercing's effect is asserted here.
    expect(inst(after, villain).statuses.tough).toBe(0);
    expect(inst(after, villain).damage).toBe(before + atk);
  });

  it("Cutthroat Ambition's Special (22004.cutthroat-ambition-special): thwart — removes 3 threat from a scheme", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(6), toHero());
    const { state: withTech, id: tech } = playFromHand(hero, "22004", 1);
    const staged = patchInstance(withTech, mainSchemeId(withTech), { threat: 5 });
    const after = resolveSpecialViaLethalIntent(staged, accepting(tech));
    expect(inst(after, mainSchemeId(after)).threat).toBe(2);
  });

  it("Evasive Maneuvering's Special (22005.evasive-maneuvering-constant-2): choose to stun or confuse an enemy", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(7), toHero());
    const { state: withTech } = playFromHand(hero, "22005", 1);
    const villain = activeVillain(withTech).instanceId;
    const after = resolveSpecialViaLethalIntent(withTech, accepting(villain, "Stun it"));
    expect(inst(after, villain).statuses.stunned).toBe(1);
  });

  it("Evasive Maneuvering (22005.evasive-maneuvering-constant): in hero form Nebula attacks past guard and thwarts the main scheme past patrol and the crisis icon", () => {
    // Hydra Mercenary (guard, 01101) engaged with Nebula and Crowd Control (crisis, 01108) in play.
    const board = (state: GameState): GameState => {
      const stacked = stackEncounterDeck(state, "01101", "01108");
      const [mercenary, crowd] = activeEncounterDeck(stacked).deck as [InstanceId, InstanceId];
      const deckId = activeEncounterDeckId(stacked);
      const piles = stacked.encounterDecks[deckId]!;
      const p1 = playerOf(stacked, P1);
      return {
        ...stacked,
        encounterDecks: { ...stacked.encounterDecks, [deckId]: { ...piles, deck: piles.deck.slice(2) } },
        villainArea: [...stacked.villainArea, crowd],
        players: stacked.players.map((p) => (p === p1 ? { ...p, playArea: [...p.playArea, mercenary] } : p)),
        instances: {
          ...stacked.instances,
          [mercenary]: { ...stacked.instances[mercenary]!, faceup: true, engagedWith: P1 },
          [crowd]: { ...stacked.instances[crowd]!, faceup: true, threat: 2 },
          [stacked.mainScheme.instanceId]: { ...stacked.instances[stacked.mainScheme.instanceId]!, threat: 5 },
        },
      };
    };
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(9), toHero());
    const identity = identityOf(hero, P1);
    const thwart = (state: GameState) =>
      applyCommand(
        state,
        { type: "basicThwart", playerId: P1, thwarterInstanceId: identity, schemeInstanceId: mainSchemeId(state) },
        WAVE4_DEPS,
      );
    const bare = board(hero);
    expect(canAttack(bare, identity, activeVillain(bare).instanceId, WAVE4_DEPS)).toBe(false);
    expect(thwart(bare).ok).toBe(false);
    const equipped = board(playFromHand(hero, "22005", 1).state);
    expect(canAttack(equipped, identity, activeVillain(equipped).instanceId, WAVE4_DEPS)).toBe(true);
    const thwarted = thwart(equipped);
    expect(thwarted.ok).toBe(true);
    if (thwarted.ok)
      expect(
        inst(settle(thwarted.state, firstLegal, undefined, WAVE4_DEPS), mainSchemeId(equipped)).threat,
      ).toBeLessThan(5);
  });

  it("Unyielding Persistence (22006.unyielding-persistence-constant, 22006.unyielding-persistence-constant-2): +1 THW, +1 ATK, and stalwart while in hero form; Special gives Nebula a tough status", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(8), toHero());
    const identity = identityOf(hero, P1);
    const before = characterProfile(hero, identity, WAVE4_DEPS)!;
    const { state: withTech } = playFromHand(hero, "22006", 1);
    const equipped = characterProfile(withTech, identity, WAVE4_DEPS)!;
    expect(equipped.thw).toBe(before.thw + 1);
    expect(equipped.atk).toBe(before.atk + 1);
    expect(hasKeyword(withTech, identity, "stalwart", WAVE4_DEPS)).toBe(true);
    const after = resolveSpecialViaLethalIntent(withTech);
    expect(inst(after, identity).statuses.tough).toBe(1);
  });

  it("Weapons Master (22007.weapons-master-constant, 22007.weapons-master-special): retaliate 1 while in hero form; Special (attack) deals 4 damage to an enemy", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(9), toHero());
    const identity = identityOf(hero, P1);
    const { state: withTech } = playFromHand(hero, "22007", 1);
    expect(hasKeyword(withTech, identity, "retaliate", WAVE4_DEPS)).toBe(true);
    const villain = activeVillain(withTech).instanceId;
    const before = inst(withTech, villain).damage;
    const after = resolveSpecialViaLethalIntent(withTech, accepting(villain));
    expect(inst(after, villain).damage).toBe(before + 4);
  });

  it("Wide Stance (22008.wide-stance-constant, 22008.wide-stance-constant-2): reduces damage Nebula takes from an attack by 1 while in hero form; Special looks at the top 3 encounter cards, discards 1, and reorders the rest", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(10), toHero());
    const { state: withTech } = playFromHand(hero, "22008", 1);
    const identity = identityOf(withTech, P1);
    const villain = activeVillain(withTech).instanceId;
    // Reduction: an undefended villain attack normally deals the villain's full printed ATK; with Wide Stance in
    // play it deals 1 less.
    const villainAtk = characterProfile(withTech, villain, WAVE4_DEPS)!.atk;
    const before = inst(withTech, identity).damage;
    const attacked = settle(runWith(WAVE4_DEPS, withTech, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    if (villainAtk > 0) {
      expect(inst(attacked, identity).damage - before).toBeLessThanOrEqual(villainAtk - 1);
    }
    // Special: exercised via Lethal Intent, whose own "X" cost spends 1 resource card to the player's discard pile
    // (+1) and which is itself discarded once played (+1) = +2 in the *player's* discard pile. The Special's own
    // "discard 1 [of the 3 looked-at cards]" moves an *encounter* card to the encounter discard pile instead.
    const before2 = playerOf(withTech, P1).discard.length;
    const beforeEncounterDiscard = activeEncounterDeck(withTech).discard.length;
    const after = resolveSpecialViaLethalIntent(withTech);
    expect(playerOf(after, P1).discard.length).toBe(before2 + 2);
    expect(activeEncounterDeck(after).discard.length).toBe(beforeEncounterDiscard + 1);
  });
});

describe("Combat Ready (event, 22009)", () => {
  // 22009.combat-ready-constant and 22009.combat-ready-constant-2 are the two bulleted lines of Combat Ready's own
  // "Choose one:" (the same parser artifact `nebula-kit.ts`'s own docblock names), stood up as
  // `coveredByEngineRule()` — both bullets are fully exercised by 22009.combat-ready-action's own test below.
  it("22009.combat-ready-action: shuffles up to 2 technique upgrades from discard into deck", () => {
    // Playing a technique upgrade needs no form (nothing on it restricts to hero), so Nebula stays in alter-ego
    // (Combat Ready's own printed form) the whole test — no `changeForm` command needed.
    const start = nebulaVsRhino(11);
    const { state: withTech } = playFromHand(start, "22005", 1);
    const techId = instancesOf(withTech, "22005")[0]!;
    const identity = identityOf(withTech, P1);
    const toDiscard = {
      ...withTech,
      instances: {
        ...withTech.instances,
        [identity]: {
          ...inst(withTech, identity),
          attachments: inst(withTech, identity).attachments.filter((id) => id !== techId),
        },
      },
      players: withTech.players.map((p) => (p.playerId === P1 ? { ...p, discard: [...p.discard, techId] } : p)),
    };
    // Put Combat Ready in hand first (so playing it doesn't itself pull a card out of the deck and mask the +1 the
    // shuffle-back makes) — same normalization the Cybernetic Upgrades test above needs.
    const given = moveToHand(toDiscard, P1, "22009");
    const [combatReady] = given.ids as [InstanceId];
    const beforeDeck = playerOf(given.state, P1).deck.length;
    const state = settle(
      runWith(WAVE4_DEPS, given.state, play(P1, combatReady, [])),
      accepting("Shuffle up to 2 technique upgrades from your discard pile into your deck", techId),
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(state, P1).discard).not.toContain(techId);
    expect(playerOf(state, P1).deck.length).toBe(beforeDeck + 1);
  });
});

describe("Lethal Intent (event, 22010)", () => {
  it("22010.lethal-intent-action: choosing X = 1 resolves that many technique upgrades' Specials", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(12), toHero());
    const { state: withTech, id: tech } = playFromHand(hero, "22004", 1);
    const staged = patchInstance(withTech, mainSchemeId(withTech), { threat: 5 });
    const after = resolveSpecialViaLethalIntent(staged, accepting(tech));
    expect(inst(after, mainSchemeId(after)).threat).toBe(2);
  });
});
