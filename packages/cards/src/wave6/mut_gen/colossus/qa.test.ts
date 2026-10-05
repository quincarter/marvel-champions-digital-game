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
import { playFromHand, revealFromEncounterDeck, stackSetAside, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../../index.js";
import { engageMinion } from "../project-wideawake-testing.js";
import { colossusGame } from "./support.js";

/**
 * Wave 6 rules QA, Colossus (`docs/phase7-wave6-qa-colossus-shadowcat.md`). Two parts.
 *
 * 1. Rulings that touch a card of Colossus's kit, his nemesis set (Juggernaut) or the box's shared precon cards.
 *    Already pinned exactly by another test, so not copied here:
 *    - FAQ "Mutant Protectors (#17)" (RRG 1.8 p. 63) first half: `../precon-player-cards.test.ts` "announces only the
 *      ally as the defender" and, for the second half, "the ally leaves play before damage".
 *    - FAQ "Powerful Punch (#14)" (p. 63): `../precon-player-cards.test.ts` "Powerful Punch (32014)" and, with Shadowcat's
 *      mass form, `../shadowcat/e2e.test.ts` "Powerful Punch (FAQ #14 ...)"; Shadowcat's own QA file adds the Phased half.
 *    - Ruling July 9, 2026 (1) (redirecting with Powerful Punch is not "initiated against you"): `../precon-player-cards
 *      .test.ts` "Powerful Punch (32014) when another player is attacked".
 *    - Erratum p. 68, Armor Up ("When the villain would activate"): `events.test.ts` "Armor Up (32010)".
 *    - FAQ "Magik" (p. 64, Mutant Protectors puts into play, does not play): `../precon-player-cards.test.ts` (cardPlayed
 *      is the Protectors alone).
 *    - RRG "Tough" (p. 44) and "Piercing" (p. 32) in Colossus's own terms, two tough cards, Juggernaut's piercing boost and
 *      Unstoppable's: `obligation-nemesis.test.ts`, `e2e.test.ts`. The cases below are the interactions those leave open.
 *    The erratum for Steel Fist (p. 68) is tested below (it found a missing label, since fixed).
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
    // Ruling April 30, 2026 (2) #2 gives the same timing for a stun card met in step 6. Steel Fist is scripted with the
    // (attack) label (card data `32008` carries it, `curation/mut_gen.ts`), so a stunned Colossus is stopped.
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

    it("stunned: the ability is cancelled (cost paid), the stun card is removed and no damage is dealt", () => {
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

    // "Prevent all damage from that attack" (`modifyAttack({ preventAllDamage })`) is prevention of damage taken: the
    // attack still deals damage, so piercing's "would deal no damage" exception (p. 32) does not apply and the engine
    // discards the tough card first (`pierceForDamage`).
    it("#1: Shadow and Steel prevents damage taken, not dealt, so a piercing attack still discards the tough card", () => {
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

/**
 * Known issue 1 (browser play 2026-10-04, Colossus solo vs Rhino): "Polaris was ready and in play but the defender
 * prompt offered only Colossus." RRG 1.8 "Defend, Defense" (p. 15): "An ally can exhaust to defend against an enemy
 * attack. Damage from the attack is dealt to that ally." and "While a hero is defending against an attack, other
 * friendly characters cannot defend against that attack."; "When a player initiates a triggered ability labeled as a
 * defense ... during an enemy attack, that player's identity becomes the defender and is considered to have defended
 * the attack if there is not already a defender." Powerful Punch (32014) is "Hero Interrupt (attack/defense)", and
 * FAQ "Powerful Punch (#14)" (p. 63): after it "Shadowcat is now considered defending that attack". The raw driver
 * output (`out-151`, `out-157`) shows Powerful Punch played in the same attack, so the hero was already the defender
 * and the ally was correctly not offered: not a defect.
 */
describe("Known issue 1: an ally is offered as a defender (RRG 1.8 'Defend, Defense', p. 15)", () => {
  /** Colossus in hero form, Polaris (32012) in play and ready with a tough card, Rhino stage II, an empty hand. */
  const staged = (): { state: GameState; polaris: InstanceId } => {
    const base = withForm(colossusGame(), { heroForm: 0 });
    const { state, id } = playFromHand(WAVE6_DEPS, base, "32012", 3);
    const villain = activeVillain(state).instanceId;
    const stageII: GameState = {
      ...state,
      villains: state.villains.map((v) => (v.instanceId === villain ? { ...v, stageIndex: 1 } : v)),
    };
    const ready = patchInstance(stageII, id, {
      exhausted: false,
      statuses: { ...inst(stageII, id).statuses, tough: 1 },
    });
    return { state: withHand(ready, P1, [], 0), polaris: id };
  };

  interface Prompt {
    readonly attacker: InstanceId;
    readonly options: readonly string[];
  }
  /**
   * Ends the turn and records every defender prompt of the villain phase (declining each). `pick` answers every other
   * prompt; `atFirstPause` edits the state at the villain phase's first optional window (the ready step has already run
   * by then, so this is how a test has a character exhausted *during* the villain phase, RRG "Player Phase" p. 34).
   */
  const defenderPrompts = (
    state: GameState,
    pick: Picker = firstLegal,
    atFirstPause: (s: GameState) => GameState = (s) => s,
  ): Prompt[] => {
    const seen: Prompt[] = [];
    let step = applyOk(state, endTurn(P1), WAVE6_DEPS);
    let edited = false;
    for (let guard = 0; step.state.pendingChoice && !step.state.outcome && guard < 80; guard++) {
      let current = step.state;
      if (!edited && current.step.phase === "villain") {
        edited = true;
        current = atFirstPause(current);
      }
      const choice = current.pendingChoice!;
      let picked: readonly string[];
      if (choice.prompt.kind === "declareDefender") {
        seen.push({ attacker: choice.prompt.attack.enemyInstanceId, options: choice.options.map((o) => o.optionId) });
        picked = ["decline"];
      } else picked = pick(current);
      step = applyOk(
        current,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: picked },
        WAVE6_DEPS,
      );
    }
    return seen;
  };

  /** Staged with a Powerful Punch in hand so the villain phase pauses at its attack-interrupt window (declined by default). */
  const pausing = (state: GameState): GameState => withHand(state, P1, ["32014"], 2);

  it("ready hero and ready Polaris: both are offered against the villain's attack", () => {
    const { state, polaris } = staged();
    const [first] = defenderPrompts(state);
    expect(first!.attacker).toBe(villainOf(state));
    expect(first!.options).toEqual(expect.arrayContaining(["decline", hero(state), polaris]));
  });

  it("exhausted hero: Polaris is still offered (p. 15: an ally can exhaust to defend)", () => {
    const { state, polaris } = staged();
    const [first] = defenderPrompts(pausing(state), firstLegal, (s) =>
      patchInstance(s, hero(state), { exhausted: true }),
    );
    expect(first!.options).toContain(polaris);
    expect(first!.options).not.toContain(hero(state));
  });

  it("stunned, confused and tough hero: statuses do not stop a defense, so both are offered", () => {
    const { state, polaris } = staged();
    const marked = withStatus(state, hero(state), { stunned: 1, confused: 1, tough: 1 });
    const [first] = defenderPrompts(marked);
    expect(first!.options).toEqual(expect.arrayContaining([hero(state), polaris]));
  });

  it("exhausted Polaris is not offered, the hero is (control)", () => {
    const { state, polaris } = staged();
    const [first] = defenderPrompts(pausing(state), firstLegal, (s) => patchInstance(s, polaris, { exhausted: true }));
    expect(first!.options).toContain(hero(state));
    expect(first!.options).not.toContain(polaris);
  });

  it("Juggernaut (the nemesis minion) attacking: Polaris is offered against his attack too", () => {
    const { state: given, polaris } = staged();
    const { state: engaged, id: juggernaut } = revealFromEncounterDeck(WAVE6_DEPS, given, "32026");
    const state = patchInstance(withHand(engaged, P1, [], 0), polaris, { exhausted: false });
    const prompts = defenderPrompts(state);
    const against = prompts.find((p) => p.attacker === juggernaut);
    expect(against, "Juggernaut attacked and a defender prompt opened").toBeDefined();
    expect(against!.options).toEqual(expect.arrayContaining([hero(state), polaris]));
  });

  it("the observed case: Powerful Punch (attack/defense) played at the attack makes the hero the defender, so Polaris is not offered", () => {
    // `out-151`/`out-157`: "You played Powerful Punch" precedes the prompt, which listed only "No defense" and Colossus.
    const { state, polaris } = staged();
    const [declined] = defenderPrompts(pausing(state)); // control: the same hand, Powerful Punch declined
    expect(declined!.options).toContain(polaris);
    const [first] = defenderPrompts(pausing(state), using(["32014.powerful-punch-constant"], { pay: 2 }));
    expect(first!.options).toContain(hero(state)); // "can still be declared the defender during the Declare Defender step" (p. 15)
    expect(first!.options).not.toContain(polaris);
  });
});

/**
 * Known issue 2 (browser play 2026-10-04, game 8): in the villain phase Colossus (alter-ego, Armor Up and Perseverance
 * in hand) played Armor Up; the response window to the form change listed "USE COLOSSUS" (Steel Skin, `32001a.colossus-
 * constant-2`) and "PLAY PERSEVERANCE" (`32016.perseverance-response`); after "USE COLOSSUS" the Perseverance button
 * was gone (`out-213`/`out-214`/`out-215`).
 *
 * RRG 1.8 "Response" (p. 36): "Multiple responses may be triggered from the same triggering condition, but each
 * response may only be triggered once per occurrence of the triggering condition." and "Once all players decide they do
 * not wish to resolve any (further) responses to a triggering condition, (further) responses to that instance of that
 * triggering condition cannot be used." So the window stays open, and Perseverance stays playable, until the player
 * declines the rest. Colossus can hold 2 tough cards (his identity text), so Perseverance is legal after Steel Skin.
 *
 * Engine: `chooseTriggers` is one multi-select prompt (`resolve/window.ts` `askNextController`: min 0, max N); the
 * answer queues the picked abilities and the tier closes (`absorbWindowAnswer`), so an unpicked response is forfeited
 * with no further offer. The client's inline interrupt window (`scenes/villain-phase.ts`, `#resolve([option.optionId])`)
 * submits exactly one option per button, so a player who clicks "USE COLOSSUS" has answered "just that one".
 */
describe("Known issue 2: two responses in one window (Steel Skin and Perseverance after Armor Up's form change)", () => {
  const STEEL_SKIN = "32001a.colossus-constant-2";
  const PERSEVERANCE = "32016.perseverance-response";

  /** Plays the villain phase from alter-ego with Armor Up and Perseverance in hand; `answer` picks in the response window. */
  const run = (answer: (offered: readonly string[]) => readonly string[]) => {
    const state = withHand(colossusGame(), P1, ["32010", "32016"], 2);
    const windows: string[][] = [];
    const events: GameEvent[] = [];
    let step = applyOk(state, endTurn(P1), WAVE6_DEPS);
    events.push(...step.events);
    for (let guard = 0; step.state.pendingChoice && !step.state.outcome && guard < 60; guard++) {
      const choice = step.state.pendingChoice;
      let picked: readonly string[];
      if (choice.prompt.kind === "chooseTriggers") {
        const offered = choice.options.map((o) => o.optionId);
        const armorUp = offered.find((id) => id.includes("32010.armor-up-interrupt"));
        if (armorUp) picked = [armorUp];
        else if (offered.some((id) => id.includes(STEEL_SKIN) || id.includes(PERSEVERANCE))) {
          windows.push(offered.map((id) => id.split(":")[1]!));
          picked = offered.filter((id) => answer(windows[windows.length - 1]!).some((a) => id.includes(a)));
        } else picked = [];
      } else if (choice.prompt.kind === "declareDefender") picked = ["decline"];
      else if (choice.prompt.kind === "payForCard") picked = choice.options.slice(0, 1).map((o) => o.optionId); // Perseverance costs 1
      else picked = firstLegal(step.state);
      step = applyOk(
        step.state,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: picked },
        WAVE6_DEPS,
      );
      events.push(...step.events);
      if (windows.length >= 3) break;
    }
    // Tough cards given to Colossus (the villain's attack later in the phase may discard them again).
    const colossus = identityOf(state, P1);
    const tough = events.filter((e) => e.type === "statusGiven" && e.status === "tough" && e.instanceId === colossus);
    return { windows, tough: tough.length };
  };

  it("control: the form change opens one window offering both responses", () => {
    const { windows } = run(() => []);
    expect(windows[0]).toEqual(expect.arrayContaining([STEEL_SKIN, PERSEVERANCE]));
  });

  it("control: picking both in the one prompt resolves both (two tough cards, the identity's maximum)", () => {
    expect(run(() => [STEEL_SKIN, PERSEVERANCE]).tough).toBe(2);
  });

  // The player's answer "just Steel Skin" is what the inline window sends for a click on "USE COLOSSUS". The window has
  // not been declined, so Perseverance must still be offered (and still legal: 1 tough card of a possible 2).
  it.fails("picking only Steel Skin keeps the window open: Perseverance is offered again, and playing it gives the second tough card", () => {
    const { windows, tough } = run((offered) => (offered.length > 1 ? [STEEL_SKIN] : [PERSEVERANCE]));
    expect(windows.length).toBeGreaterThanOrEqual(2);
    expect(windows[1]).toContain(PERSEVERANCE);
    expect(tough).toBe(2);
  });
});
