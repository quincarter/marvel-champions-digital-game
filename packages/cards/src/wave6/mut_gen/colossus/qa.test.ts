import { cardId } from "@mc/content";
import {
  activeVillain,
  cardsInPlay,
  createGame,
  replay,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../../testing/driver.js";
import {
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { revealFromEncounterDeck, stackSetAside, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../../index.js";
import { engageMinion } from "../project-wideawake-testing.js";
import { colossusGame } from "./support.js";

/**
 * Wave 6 rules QA, Colossus (`docs/phase7-wave6-qa-colossus-shadowcat.md`). Two parts.
 *
 * 1. Rulings that touch a card of Colossus's kit, his nemesis set (Juggernaut) or the box's shared precon cards.
 *    Already pinned exactly by another test, so not copied here:
 *    - FAQ "Mutant Protectors (#17)" (RRG 1.8 p. 63) first half: `../precon-player-cards.test.ts` "announces only the
 *      ally as the defender" (`it.fails`, known engine gap) and its `it.todo` for the second half (ally leaves play).
 *    - FAQ "Powerful Punch (#14)" (p. 63): `../precon-player-cards.test.ts` "Powerful Punch (32014)" and, with Shadowcat's
 *      mass form, `../shadowcat/e2e.test.ts` "Powerful Punch (FAQ #14 ...)"; Shadowcat's own QA file adds the Phased half.
 *    - Ruling July 9, 2026 (1) (redirecting with Powerful Punch is not "initiated against you"): `../precon-player-cards
 *      .test.ts` "Powerful Punch (32014) when another player is attacked".
 *    - Erratum p. 68, Armor Up ("When the villain would activate"): `events.test.ts` "Armor Up (32010)".
 *    - FAQ "Magik" (p. 64, Mutant Protectors puts into play, does not play): `../precon-player-cards.test.ts` (cardPlayed
 *      is the Protectors alone).
 *    - RRG "Tough" (p. 44) and "Piercing" (p. 32) in Colossus's own terms, two tough cards, Juggernaut's piercing boost and
 *      Unstoppable's: `obligation-nemesis.test.ts`, `e2e.test.ts`. The cases below are the interactions those leave open.
 *    The erratum for Steel Fist (p. 68) is tested below: it exposes a bug, pinned with `it.fails`.
 * 2. Whole games with Colossus's precon, 2 players standard (with Shadowcat, the box's other hero) and 1 hero expert,
 *    played by the greedy driver and replayed deep-equal, each containing his signature tough mechanic.
 */

const hero = (state: GameState): InstanceId => identityOf(state, P1);
const toughOf = (state: GameState, id: InstanceId = hero(state)): number => inst(state, id).statuses.tough;
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const inHero = (): GameState => withForm(colossusGame(), { heroForm: 0 });
const withStatus = (state: GameState, id: InstanceId, statuses: Partial<ReturnType<typeof inst>["statuses"]>) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, ...statuses } });
const kinds = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type);

/** The player's hand becomes exactly `codes` plus `fillers` other deck cards (to pay with), so end of turn discards nothing. */
function withHand(state: GameState, player: PlayerId, codes: readonly string[], fillers: number): GameState {
  const owner = playerOf(state, player);
  let current: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: [], deck: [...p.deck, ...owner.hand] } : p,
    ),
  };
  current = moveToHand(current, player, ...codes).state;
  const spare = playerOf(current, player)
    .deck.filter((id) => {
      const card = current.cardPool[current.instances[id]!.cardId] as { type: string };
      return !codes.includes(current.instances[id]!.cardId) && card.type !== "treachery";
    })
    .slice(0, fillers);
  return {
    ...current,
    players: current.players.map((p) =>
      p.playerId === player
        ? { ...p, hand: [...p.hand, ...spare], deck: p.deck.filter((id) => !spare.includes(id)) }
        : p,
    ),
  };
}

/** Accepts the named interrupt/response (paying `pay` hand cards) and, when asked, defends with the hero; else declines. */
const using =
  (ability: readonly string[], options: { pay?: number; defend?: InstanceId } = {}): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers") {
      const hit = choice.options.filter((o) => ability.some((a) => o.optionId.includes(a))).map((o) => o.optionId);
      return hit.length > 0 ? hit : firstLegal(state);
    }
    if (choice.prompt.kind === "payForCard" || choice.prompt.kind === "payForAbility")
      return choice.options.slice(0, options.pay ?? 0).map((o) => o.optionId);
    if (choice.prompt.kind === "declareDefender" && options.defend) {
      const hit = choice.options.find((o) => o.optionId.includes(options.defend!));
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

/** Ends each player's turn in order (flipping later players to hero form first) and settles the villain phase. */
function villainPhase(
  state: GameState,
  pick: Picker,
  players: readonly PlayerId[] = [P1],
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let current = state;
  const step = (command: Parameters<typeof applyOk>[1]) => {
    const result = applyOk(current, command, WAVE6_DEPS);
    current = result.state;
    events.push(...result.events);
  };
  const settleAll = () => {
    for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
      if (guard > 200) throw new Error("did not settle");
      const choice = current.pendingChoice;
      step({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(current),
      });
    }
  };
  for (const player of players) {
    if (playerOf(current, player).identity.form !== "hero") {
      step(toHero(player));
      settleAll();
    }
    step(endTurn(player));
    settleAll();
  }
  return { state: current, events };
}

describe("rulings", () => {
  describe("Erratum RRG 1.8 p. 68, Steel Fist (#8): 'Hero Action (attack)' is an attack-labeled ability (labeled ability, p. 26)", () => {
    // "Should read: 'Hero Action (attack): Deal 5 damage to an enemy. You may discard a tough status card from your hero
    // to stun and confuse that enemy.'" RRG "Labeled ability" (p. 26): "If a player triggers a labeled ability while their
    // identity has one or more status cards that cancel any of the labeled ability's types, the entire ability (except
    // for its costs) is canceled ... Each status card ... that cancels any of the labeled ability's types is removed".
    // Ruling April 30, 2026 (2) #2 gives the same timing for a stun card met in step 6. The script has no (attack) label
    // (`colossus/events.ts` reads it as plain damage; card data `32008` prints "Hero Action:" without "(attack)"), so a
    // stunned Colossus is not stopped: the 5 damage lands and the stun card stays.
    const cast = (state: GameState) => {
      const given = moveToHand(state, P1, "32008");
      const [id] = given.ids as [InstanceId];
      const after = settle(
        runWith(WAVE6_DEPS, given.state, play(P1, id, payWith(given.state, P1, 2, [id]))),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      return { after, id };
    };

    it("control: unstunned, it deals 5 damage to the enemy", () => {
      const { after } = cast(inHero());
      expect(inst(after, villainOf(after)).damage).toBe(5);
    });

    it.fails("stunned: the ability is cancelled (cost paid), the stun card is removed and no damage is dealt", () => {
      const stunned = withStatus(inHero(), hero(inHero()), { stunned: 1 });
      const { after, id } = cast(stunned);
      expect(playerOf(after, P1).discard).toContain(id); // the card's cost was still paid
      expect(inst(after, hero(after)).statuses.stunned).toBe(0);
      expect(inst(after, villainOf(after)).damage).toBe(0);
    });
  });

  describe("RRG 1.8 Tough (p. 44) and Piercing (p. 32), Ruling January 17, 2026 (3)", () => {
    // Juggernaut (32026) boost: "If this activation is an attack, that attack gains overkill and piercing." Colossus's
    // tough cards are the ruling's Bulletproof Belle case in his own kit.
    const duo = (): GameState =>
      withForm(colossusGame("rhino", { extraPlayers: [{ starterDeckId: "shadowcat-aggression" }] }), { heroForm: 0 });

    it("control: the Juggernaut boost does give the attack piercing (no Shadow and Steel: tough discarded, damage lands)", () => {
      const base = withStatus(duo(), identityOf(duo(), P1), { tough: 1 });
      const state = withHand(stackSetAside(base, "32026"), P2, [], 0);
      const result = villainPhase(state, firstLegal, [P1, P2]);
      expect(kinds(result.events, "statusRemoved")).toContainEqual(
        expect.objectContaining({ instanceId: identityOf(state, P1), status: "tough", reason: "piercing" }),
      );
      expect(inst(result.state, identityOf(state, P1)).damage).toBeGreaterThan(0);
    });

    // `it.fails`: the engine models "prevent all damage from that attack" (`modifyAttack({ preventAllDamage })`) as the
    // attack dealing 0, so piercing's "would deal no damage" exception (p. 32) applies and the tough card stays. The
    // ruling says prevention is of damage taken, so the attack still deals damage and piercing still discards the card.
    // Remove the `.fails` when the engine discards first.
    it.fails("#1: Shadow and Steel prevents damage taken, not dealt, so a piercing attack still discards the tough card", () => {
      // "Effects that 'prevent damage' prevent damage taken, not damage dealt ... an attack with Piercing that still
      // deals damage to her will remove that Tough status card." Shadow and Steel (32021): "prevent all damage from that attack".
      const base = withStatus(duo(), identityOf(duo(), P1), { tough: 1 });
      const state = withHand(withHand(stackSetAside(base, "32026"), P1, ["32021"], 2), P2, [], 0);
      const colossus = identityOf(state, P1);
      const result = villainPhase(state, using(["32021.shadow-and-steel-constant"], { pay: 2 }), [P1, P2]);
      expect(kinds(result.events, "damagePrevented").length).toBeGreaterThan(0);
      expect(inst(result.state, colossus).damage).toBe(0);
      expect(toughOf(result.state, colossus)).toBe(0);
    });

    it("control: without piercing the same tough card is not touched by a fully prevented attack", () => {
      const base = withStatus(duo(), identityOf(duo(), P1), { tough: 1 });
      const state = withHand(withHand(stackEncounterDeck(base, "01186"), P1, ["32021"], 2), P2, [], 0);
      const colossus = identityOf(state, P1);
      const result = villainPhase(state, using(["32021.shadow-and-steel-constant"], { pay: 2 }), [P1, P2]);
      expect(inst(result.state, colossus).damage).toBe(0);
      expect(toughOf(result.state, colossus)).toBe(1);
    });

    it("Tough (p. 44): a basic defense that reduces the damage to 0 keeps the tough card", () => {
      // "When a hero with a tough status card defends an attack, they reduce the damage from the attack by their DEF
      // first. If the damage is reduced to 0, the hero does not lose their tough status card."
      const state = withStatus(stackEncounterDeck(inHero(), "01186"), hero(inHero()), { tough: 1 });
      const defended = villainPhase(state, using([], { defend: hero(state) }));
      expect(toughOf(defended.state)).toBe(1);
      expect(inst(defended.state, hero(state)).damage).toBe(0);
      // Control: undefended, the tough card is what stops the 2 damage.
      const undefended = villainPhase(state, firstLegal);
      expect(toughOf(undefended.state)).toBe(0);
      expect(inst(undefended.state, hero(state)).damage).toBe(0);
    });
  });

  describe("Juggernaut (32026, Stalwart, Toughness) against Colossus's Steel Fist and Made of Rage", () => {
    // RRG 1.8 Toughness (p. 44): a toughness character is given a tough status card as it enters play; Stalwart (p. 42):
    // it "cannot have confused or stunned status cards"; Tough (p. 44): the tough card "prevents all of that damage ...
    // the character who had the tough status card is not considered to have taken damage."
    const withJuggernaut = () => revealFromEncounterDeck(WAVE6_DEPS, inHero(), "32026");

    it("enters play with a tough card (Toughness)", () => {
      const { state, id } = withJuggernaut();
      expect(cardsInPlay(state)).toContain(id);
      expect(toughOf(state, id)).toBe(1);
    });

    it("Steel Fist: the 5 damage is absorbed by the tough card, and Stalwart refuses the stun and confuse", () => {
      const { state, id: juggernaut } = withJuggernaut();
      const staged = withStatus(state, hero(state), { tough: 1 });
      const given = moveToHand(staged, P1, "32008");
      const [card] = given.ids as [InstanceId];
      const pick: Picker = (s) => {
        const choice = s.pendingChoice;
        const target = choice?.options.find((o) => o.optionId.includes(juggernaut));
        if (target) return [target.optionId];
        const stun = choice?.options.find((o) => o.label?.includes("stun and confuse"));
        return stun ? [stun.optionId] : firstLegal(s);
      };
      const after = settle(
        runWith(WAVE6_DEPS, given.state, play(P1, card, payWith(given.state, P1, 2, [card]))),
        pick,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, juggernaut).damage).toBe(0);
      expect(toughOf(after, juggernaut)).toBe(0);
      expect(inst(after, juggernaut).statuses.stunned).toBe(0);
      expect(inst(after, juggernaut).statuses.confused).toBe(0);
    });

    it("Made of Rage: overkill counts damage taken (Ruling January 26, 2026 (3)), so a tough minion passes none on", () => {
      // "Overkill counts damage taken ... Nimrod took only 3 damage ... so 0 excess damage was taken, resulting in no
      // overkill damage dealt to the villain." A Hydra Mercenary with a tough card absorbs the whole +6 ATK attack.
      const attack = (tough: number) => {
        const given = moveToHand(withStatus(inHero(), hero(inHero()), { tough: 1 }), P1, "32007");
        const { state: engaged, id: minion } = engageMinion(given.state, "01101");
        const ready = withStatus(engaged, minion, { tough });
        const after = settle(
          runWith(WAVE6_DEPS, ready, {
            type: "basicAttack",
            playerId: P1,
            attackerInstanceId: hero(ready),
            targetInstanceId: minion,
          } as never),
          using(["32007.made-of-rage-interrupt"]),
          undefined,
          WAVE6_DEPS,
        );
        return { after, minion };
      };
      const open = attack(0);
      expect(cardsInPlay(open.after)).not.toContain(open.minion);
      expect(inst(open.after, villainOf(open.after)).damage).toBeGreaterThan(0);
      const shielded = attack(1);
      expect(cardsInPlay(shielded.after)).toContain(shielded.minion);
      expect(inst(shielded.after, shielded.minion).statuses.tough).toBe(0);
      expect(inst(shielded.after, villainOf(shielded.after)).damage).toBe(0);
    });
  });
});

const DUO = [{ starterDeckId: "colossus-protection" }, { starterDeckId: "shadowcat-aggression" }] as const;
const SOLO = [{ starterDeckId: "colossus-protection" }] as const;

const eventsOf = (result: DriverResult): readonly GameEvent[] => {
  const again = replay(result.session.log, WAVE6_DEPS);
  expect(again.ok).toBe(true);
  if (!again.ok) throw new Error("replay failed");
  expect(again.state).toEqual(result.session.state);
  return again.events;
};

const VARIANTS: readonly { label: string; options: Omit<Wave6ScenarioOptions, "seed"> }[] = [
  { label: "2 players, standard (with Shadowcat)", options: { players: DUO } },
  { label: "1 hero, expert", options: { players: SOLO, difficulty: "expert" } },
];

describe.each(VARIANTS)("Colossus vs Rhino ($label)", ({ options }) => {
  it("plays to an outcome and replays deep-equal, a tough card given and then discarded from Colossus", () => {
    // The signature mechanic as scripted: Steel Skin / Perseverance / Organic Steel give Colossus tough cards
    // (`statusGiven`) and a hit, a Made of Rage / Steel Fist / piercing step takes one away (`statusRemoved`).
    // Seeds are the first match of a fixed range, so a run always finds the same game. Played from setup, no surgery.
    let found: { result: DriverResult; events: readonly GameEvent[] } | null = null;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const created = createGame(wave6Scenario("rhino", { ...options, seed }), WAVE6_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const result = playToOutcome(created.state, WAVE6_DEPS);
      if (!result.outcome) continue;
      const played = replay(result.session.log, WAVE6_DEPS);
      if (!played.ok) throw new Error("replay failed");
      const colossus = identityOf(result.session.state, P1);
      const tough = (type: "statusGiven" | "statusRemoved") =>
        played.events.some((e) => e.type === type && e.status === "tough" && e.instanceId === colossus);
      if (tough("statusGiven") && tough("statusRemoved")) found = { result, events: played.events };
    }
    if (!found) throw new Error("no seed of 1..40 gave and then discarded a tough card on Colossus");
    expect(found.result.outcome).not.toBeNull();
    expect(eventsOf(found.result)).toEqual(found.events);
    expect(cardId("32001a")).toBeDefined();
  }, 600_000);
});
