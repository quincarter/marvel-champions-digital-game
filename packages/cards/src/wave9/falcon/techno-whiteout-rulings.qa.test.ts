/**
 * Rules QA for the Techno set (Falcon: 53038 Fixer, 53039 Jet Pack, 53040 Tech-Pac, 53041 Technological Innovation, 53042
 * Techno), the Whiteout set (Winter Soldier: 54034 Blizzard, 54035 Encased in Ice, 54036 Slippery Conditions, 54037
 * Whiteout) and Strength in Diversity 53019: the interactions the module tests (`techno.test.ts`, `../winter/whiteout.test.ts`,
 * `aspect-basic.test.ts`) and the scenario game (`../aos/thunderbolts-new-sets-scenario.test.ts`) do not assert, each tied to
 * an RRG 1.8 entry (`mc_rulesreference_v18_compressed.pdf`), an FFG ruling by its date heading
 * (marvel-champions-rulings-post-rrg-1-7.md), the box rulebook (MC50) or an owner answer (docs/phase7-wave9.md sections 3.48
 * to 3.50 and 4.1). A `FINDING` comment marks a case where the game and its source disagree: the expected behavior is an
 * `it.fails`, with a passing companion that pins today's behavior. Findings are tabled in docs/phase7-wave9-qa.md.
 */
import { WAVE9_CARDS } from "../cards.js";
import { WAVE2_CARDS, WAVE2_STARTER_DECKS, cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  createGame,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
  statBonus,
  traitsOf,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  encounterCardInVillainArea,
  moveToDiscard,
  withForm,
} from "../../testing/staging.js";
import { attachToHost, engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE9_DEPS } from "../index.js";
import { wave9Scenario, wave9StarterDeckSetup } from "../setup.js";
import {
  BLACK_PANTHER_CORE,
  BLANK,
  CAPTAIN_MARVEL,
  IRON_MAN,
  ONE_ICON,
  SHE_HULK,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroForm,
  inPlayCard,
  onlyDeck,
  piles,
  revealedCodes,
  types,
} from "../testing.js";

vi.setConfig({ testTimeout: 300_000 });

const DEPS = WAVE9_DEPS;

// Techno (Falcon)
const FIXER = "53038";
const JET_PACK = "53039";
const TECH_PAC = "53040";
const INNOVATION = "53041";
const TECHNO_CARD = "53042";
const TRUNCHEON = "51040"; // Energy Truncheon (Tech attachment): attach to Joystick, otherwise the villain
const ARMAMENT = "54030"; // High-Tech Armament (Tech attachment): attach to Crossbones, otherwise the villain
// Whiteout (Winter Soldier)
const BLIZZARD = "54034";
const ICE = "54035";
const SLIPPERY = "54036";
const WHITEOUT_CARD = "54037";
// Thunderbolts scenario
const JUSTICE = "50131a";
const BYSTANDERS = "50134";
// Core cards
const ARC_REACTOR = "01035"; // Tech upgrade
const RELENTLESS = "01053"; // Hero Action (attack): 5 damage to a minion; overkill when paid with a physical resource
const MOCKINGBIRD = "01083";
const BLACK_CAT = "01002";
/** A harmless filler: Advance again (the table adds a dozen copies; Assault 01187 would make the villain attack). */
const FILLER = "01186";

// ---------------------------------------------------------------------------------------------------------------------
// Shared staging
// ---------------------------------------------------------------------------------------------------------------------

const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);
const seat = (starterDeckId: string) => {
  const wave2 = WAVE2_STARTER_DECKS.find((d) => d.id === starterDeckId);
  if (!wave2) return wave9StarterDeckSetup(starterDeckId);
  return {
    identityCardId: wave2.identityCardId,
    aspects: wave2.aspects,
    deck: wave2.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
};
const FALCON_SEAT = "falcon-leadership";
const CORE_SEAT = (s: { readonly starterDeckId: string }) => s.starterDeckId;

/**
 * Rhino against `seats` (printed precons or Core starter decks, deck legality unchecked), with the two sets, Energy
 * Truncheon x2 and High-Tech Armament added to the encounter deck, past setup. `hero` puts the seats in hero form.
 */
function table(seats: readonly string[], opts: { readonly hero?: boolean } = { hero: true }): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...new Map([...WAVE2_CARDS, ...WAVE9_CARDS].map((c) => [c.id, c] as const)).values()],
  } as never);
  const sets = WAVE9_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.some((e) => e === "techno" || e === "whiteout"),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const extra = [TRUNCHEON, TRUNCHEON, ARMAMENT, ...Array.from({ length: 12 }, () => BLANK)].map((code) =>
    cardId(code),
  );
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: seats.map(seat),
      encounterDeck: [...base.encounterDeck, ...sets, ...extra],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const ready = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return opts.hero === false ? ready : heroForm(ready, ...ready.players.map((p) => p.playerId));
}
const SPIDER = CORE_SEAT(SPIDER_MAN);
const IRON = CORE_SEAT(IRON_MAN);
const MARVEL = CORE_SEAT(CAPTAIN_MARVEL);
const HULK = CORE_SEAT(SHE_HULK);
const PANTHER = CORE_SEAT(BLACK_PANTHER_CORE);

/** Answers choices with the first option whose label starts with one of `labels`, else the first legal option. */
const labeled =
  (...labels: readonly string[]): Picker =>
  (s) => {
    const option = s.pendingChoice!.options.find((o) => labels.some((l) => o.label.startsWith(l)));
    return option ? [option.optionId] : firstLegal(s);
  };
/** The target prompt answered with `target` (a card), a defender prompt declined, anything else first-legal. */
const aiming =
  (target: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    const hit = choice.options.find(
      (o) => o.optionId === target || (o.ref.kind === "card" && o.ref.instanceId === target),
    );
    return hit ? [hit.optionId] : firstLegal(s);
  };
const villainPhase = (state: GameState, pick: Picker = firstLegal) =>
  driveEventsPicking(DEPS, state, pick, ...state.players.map((p) => endTurn(p.playerId)));
const basic = (attacker: InstanceId, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const refusal = (s: GameState, command: Command): string | undefined => {
  const result = applyCommand(s, command, DEPS);
  return result.ok ? undefined : result.error.message;
};
const attackAs = (s: GameState, attacker: InstanceId, target: InstanceId, player: PlayerId = P1, pick = firstLegal) =>
  driveEventsPicking(DEPS, s, pick, basic(attacker, target, player));
const ready = (s: GameState, id: InstanceId) => patchInstance(s, id, { exhausted: false });
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: n } });

/** A card of `code` from a player's deck put into their play area, ready (an ally or a support). */
function inPlayFor(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const placed = patchInstance(given.state, id, { faceup: true, controllerId: player, exhausted: false });
  return {
    id,
    state: {
      ...placed,
      players: placed.players.map((p) =>
        p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}
/** A player upgrade of `code` attached to `host` by surgery. */
function upgradeOn(state: GameState, code: string, host: InstanceId, player: PlayerId = P1) {
  const s0 = inPlayFor(state, code, player);
  const placed = patchInstance(s0.state, s0.id, { attachedTo: host });
  return {
    id: s0.id,
    state: {
      ...placed,
      players: placed.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== s0.id) })),
      instances: {
        ...placed.instances,
        [host]: { ...placed.instances[host]!, attachments: [...placed.instances[host]!.attachments, s0.id] },
      },
    },
  };
}
/** Enough harmless cards that a villain phase never empties the deck (an emptied deck reshuffles its discard pile into it). */
const MANY_BLANKS = Array.from({ length: 8 }, () => BLANK);
const encounterDiscard = (s: GameState) => piles(s).discard;
/** Every Encased in Ice not in play moved to the encounter discard pile: Blizzard finds them there and the deck's shuffle cannot deal them. */
function iceInDiscard(state: GameState): GameState {
  const loose = idsOf(state, ICE).filter((i) => !cardsInPlay(state).includes(i) && inst(state, i).attachedTo === null);
  const id = activeEncounterDeckId(state);
  const pile = state.encounterDecks[id]!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [id]: {
        deck: pile.deck.filter((i) => !loose.includes(i)),
        discard: [...pile.discard.filter((i) => !loose.includes(i)), ...loose],
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Techno: Fixer's redirect
// ---------------------------------------------------------------------------------------------------------------------

describe("Fixer (53038): two Tech attachments revealed in one villain phase (RRG 1.8 'Attach To' p. 8)", () => {
  // Card: "When a non-scenario-specific Tech attachment would be attached to the villain, attach it to Fixer instead."
  // Each reveal is its own "would be attached"; with two players two cards are revealed in one phase. RRG "Attach To":
  // "The 'attach to' phrase on a card is not resolved if another ability causes that card to attach to a specific game
  // element", so neither Energy Truncheon nor High-Tech Armament attaches to Rhino first.
  it("Energy Truncheon (first player) and High-Tech Armament (second player) both end on Fixer; Rhino keeps nothing", () => {
    const base = table([SPIDER, MARVEL]);
    const fixer = engageMinion(base, FIXER, P1);
    // Rhino activates twice (a boost card each), Fixer once, then each player is dealt a card.
    const staged = onlyDeck(fixer.state, BLANK, BLANK, FILLER, TRUNCHEON, ARMAMENT, FILLER);
    const run = villainPhase(staged);
    const truncheon = inPlayCard(run.state, TRUNCHEON)!;
    const armament = inPlayCard(run.state, ARMAMENT)!;
    expect(inst(run.state, truncheon).attachedTo).toBe(fixer.id);
    expect(inst(run.state, armament).attachedTo).toBe(fixer.id);
    expect(inst(run.state, fixer.id).attachments).toEqual(expect.arrayContaining([truncheon, armament]));
    expect(inst(run.state, villainOf(run.state)).attachments).toEqual([]);
  });

  it("Tech-Pac counts a redirected attachment: Fixer attacks for 1 + 1 (own) before it, 1 + 1 + 1 (other Tech) + 1 (Truncheon's own ATK) after", () => {
    const base = table([SPIDER]);
    const fixer = engageMinion(base, FIXER, P1);
    const pac = attachToHost(fixer.state, TECH_PAC, fixer.id);
    // The Truncheon revealed in this phase attaches after Fixer's activation: it is counted from the next one.
    const first = villainPhase(onlyDeck(pac.state, BLANK, BLANK, TRUNCHEON, FILLER));
    expect(attacksBy(first.state, first.events, FIXER)[0]!.baseAtk).toBe(2);
    expect(inst(first.state, inPlayCard(first.state, TRUNCHEON)!).attachedTo).toBe(fixer.id);
    const second = villainPhase(onlyDeck(first.state, BLANK, BLANK, FILLER));
    expect(attacksBy(second.state, second.events, FIXER)[0]!.baseAtk).toBe(4);
  });
});

describe("Fixer (53038): defeated while holding attachments (RRG 1.8 'Attach To' p. 8, 'Victory X' p. 46)", () => {
  // RRG "Attach To": an attached card "remains in play until either the element it is attached to leaves play, in which
  // case the attached card is discarded". Fixer has Victory 1: he goes to the victory display and the three Tech
  // attachments (two printed "attach to Fixer", one redirected) go to the encounter discard pile, not on to the villain.
  it("Jet Pack, Tech-Pac and a redirected Energy Truncheon are discarded with him; Rhino ends with no attachment", () => {
    const base = table([SPIDER]);
    const fixer = engageMinion(base, FIXER, P1);
    const pack = attachToHost(fixer.state, JET_PACK, fixer.id);
    const pac = attachToHost(pack.state, TECH_PAC, fixer.id);
    const truncheon = attachToHost(pac.state, TRUNCHEON, fixer.id);
    const after = defeatWithAttack(DEPS, truncheon.state, fixer.id);
    expect(after.victoryDisplay).toContain(fixer.id);
    for (const id of [pack.id, pac.id, truncheon.id]) {
      expect(encounterDiscard(after), id).toContain(id);
      expect(cardsInPlay(after)).not.toContain(id);
    }
    expect(inst(after, villainOf(after)).attachments).toEqual([]);
  });
});

describe("Fixer (53038): only an attachment that would be attached (RRG 1.8 'Attach To' p. 8)", () => {
  it("a Tech attachment already on the villain stays there when Fixer arrives afterwards (the interrupt is not a sweep)", () => {
    const base = table([SPIDER]);
    const armed = attachToHost(base, TRUNCHEON, villainOf(base));
    const run = villainPhase(onlyDeck(armed.state, BLANK, TECHNO_CARD, FIXER, ONE_ICON));
    expect(inPlayCard(run.state, FIXER)).toBeDefined();
    expect(inst(run.state, armed.id).attachedTo).toBe(villainOf(run.state));
    expect(inst(run.state, inPlayCard(run.state, FIXER)!).attachments).toEqual([]);
  });

  // Owner default under test (docs/phase7-wave9.md 3.49): "the villain" in "attached to the villain" is any villain, not
  // only the scenario's current one. The card text and RRG "Villain" name no limit; the printed text never says "main".
  it("with Fixer engaged, a Tech attachment bound for the villain goes to Fixer whichever villain that is (here Rhino, in the Thunderbolts scenario Citizen V)", () => {
    const base = table([SPIDER]);
    const fixer = engageMinion(base, FIXER, P1);
    const run = villainPhase(onlyDeck(fixer.state, BLANK, BLANK, ARMAMENT, FILLER));
    expect(inst(run.state, inPlayCard(run.state, ARMAMENT)!).attachedTo).toBe(fixer.id);
  });

  // The redirect is the card entering play once (RRG "Enters Play" p. 18: revealing is one of the means). Engine default
  // (trigger-events.ts `cardAttached`): a card revealed onto a host its "attach to" (or an interrupt replacing it) names is
  // not announced as "an ability attached it" (that announcement is for `attachCard`), so no "after you attach" response
  // hears it. RRG "Attach To" p. 8, last bullet, keeps "attach to" and "another ability causes it to attach" apart; it does
  // not say whether the second counts as an attach for a response. Fixer's ability has no "you" (an encounter card), and
  // every printed "after you attach" names a player, so no printed card can tell the two readings apart yet.
  it("a redirected reveal enters play once: one move onto Fixer, one cardEntersPlay, and no 'ability attached it' announcement", () => {
    const base = table([SPIDER]);
    const fixer = engageMinion(base, FIXER, P1);
    const run = villainPhase(onlyDeck(fixer.state, BLANK, BLANK, TRUNCHEON, FILLER));
    const truncheon = inPlayCard(run.state, TRUNCHEON)!;
    const triggers = run.events.flatMap((e) => (e.type === "triggerEvent" ? [e] : []));
    const about = (kind: string) =>
      triggers.filter((e) => e.event.kind === kind && "instanceId" in e.event && e.event.instanceId === truncheon);
    expect(revealedCodes(run.state, run.events).filter((c) => c === TRUNCHEON)).toHaveLength(1);
    expect(about("cardEntersPlay").map((e) => e.phase)).toEqual(["initiated", "resolved"]);
    expect(about("cardAttached").filter((e) => !("imminent" in e.event && e.event.imminent))).toEqual([]);
    const moves = run.events.filter((e) => e.type === "cardMoved" && e.instanceId === truncheon);
    expect(moves.filter((e) => e.type === "cardMoved" && e.to.kind === "attachment")).toHaveLength(1);
    expect(inst(run.state, truncheon).attachedTo).toBe(fixer.id);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Techno: Jet Pack
// ---------------------------------------------------------------------------------------------------------------------

describe("Jet Pack (53039) against overkill, several small hits and a tough status card (RRG 1.8 'Prevent' p. 35, 'Overkill' p. 31)", () => {
  /** `n` cards of the player's deck with a printed [physical] icon, moved to hand (they pay Relentless Assault's overkill). */
  function physicalPayment(state: GameState, player: PlayerId, n: number) {
    const codes = playerOf(state, player)
      .deck.filter((id) => {
        const card = state.cardPool[state.instances[id]!.cardId]!;
        return "resourceIcons" in card && (card.resourceIcons?.physical ?? 0) > 0 && card.id !== cardId(RELENTLESS);
      })
      .slice(0, n)
      .map((id) => codeOf(state, id));
    if (codes.length < n) throw new Error("not enough physical resource cards in the deck");
    return moveToHand(state, player, ...codes);
  }

  /** Iron Man (Aggression) plays Relentless Assault at `fixer` (Fixer at 14 of 15 hit points), paid with two physical cards. */
  function relentless(jetPack: boolean) {
    const base = table([IRON]);
    const fixer = engageMinion(base, FIXER, P1);
    let s = patchInstance(fixer.state, fixer.id, { damage: 14 });
    if (jetPack) s = attachToHost(s, JET_PACK, fixer.id).state;
    const pay = physicalPayment(s, P1, 2);
    const given = moveToHand(pay.state, P1, RELENTLESS);
    const event = given.ids[0]!;
    const run = driveEventsPicking(DEPS, given.state, aiming(fixer.id), play(P1, event, pay.ids));
    return { run, fixer: fixer.id };
  }

  // Overkill (RRG p. 31) deals excess only "if a minion is defeated by an attack with the overkill keyword". Jet Pack's
  // interrupt prevents all of 5 damage (RRG "Prevent": the damage taken is reduced; ruling January 26, 2026 - Ruling 3
  // counts overkill from damage taken), so Fixer is not defeated and there is no excess for the villain.
  it("Relentless Assault (5, overkill) at a 1-hit-point-left Fixer: Jet Pack prevents it, Fixer survives, the villain takes nothing", () => {
    const { run, fixer } = relentless(true);
    expect(damageOf(run.state, fixer)).toBe(14);
    expect(cardsInPlay(run.state)).toContain(fixer);
    expect(damageOf(run.state, villainOf(run.state))).toBe(0);
    expect(types(run.events, "damagePrevented")).toMatchObject([{ targetInstanceId: fixer, amount: 5 }]);
  });

  it("control: without Jet Pack the same attack defeats Fixer and the 4 excess damage is dealt to the villain", () => {
    const { run, fixer } = relentless(false);
    expect(cardsInPlay(run.state)).not.toContain(fixer);
    expect(damageOf(run.state, villainOf(run.state))).toBe(4);
  });

  // The interrupt reads the damage of one instance ("would take 3 or more"), not a running total.
  it("two 2-damage attacks (4 in all) are both taken and Jet Pack stays; a 3-damage attack by the second player is then prevented", () => {
    const base = table([SPIDER, HULK]);
    const fixer = engageMinion(base, FIXER, P1);
    const packed = attachToHost(fixer.state, JET_PACK, fixer.id);
    const hero = identityOf(packed.state);
    const one = attackAs(packed.state, hero, fixer.id);
    const two = attackAs(ready(one.state, hero), hero, fixer.id);
    expect(damageOf(two.state, fixer.id)).toBe(4);
    expect(inst(two.state, packed.id).attachedTo).toBe(fixer.id);
    const hulk = identityOf(two.state, P2);
    const turn = driveEventsPicking(DEPS, two.state, firstLegal, endTurn(P1));
    const three = attackAs(turn.state, hulk, fixer.id, P2);
    expect(damageOf(three.state, fixer.id)).toBe(4);
    expect(encounterDiscard(three.state)).toContain(packed.id);
  });

  // Two "would take damage" interrupts on one hit: the tough status card (RRG "Tough" p. 44: prevent all of the damage and
  // discard one tough card) and Jet Pack. The RRG orders simultaneous forced effects by the first player (p. 19) and no
  // ruling says which of these two resolves first, so this pins today's behavior only; see the open point in the audit.
  it("a tough Fixer with Jet Pack hit for 3: the tough card is used and Jet Pack stays (pinned, no ruling)", () => {
    const base = table([HULK]);
    const fixer = engageMinion(base, FIXER, P1);
    const packed = attachToHost(withStatus(fixer.state, fixer.id, "tough"), JET_PACK, fixer.id);
    const run = attackAs(packed.state, identityOf(packed.state), fixer.id);
    expect(damageOf(run.state, fixer.id)).toBe(0);
    // Today the tough card answers first and Jet Pack, whose "would take 3 or more" no longer applies to damage already
    // prevented, stays on Fixer. Either order is a legal use of the first player's ordering (RRG p. 19).
    expect(inst(run.state, fixer.id).statuses.tough).toBe(0);
    expect(inst(run.state, packed.id).attachedTo).toBe(fixer.id);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Techno: Tech-Pac's cost
// ---------------------------------------------------------------------------------------------------------------------

describe("Tech-Pac (53040) Hero Action: 'Exhaust any number of characters you control with a combined THW greater than attached enemy's SCH'", () => {
  const ABILITY = "53040.tech-pac-action";
  const pay = (s: GameState, pac: InstanceId, who: readonly InstanceId[], player: PlayerId = P1) =>
    driveEventsPicking(DEPS, s, firstLegal, use(player, pac, ABILITY, [], { exhausted: who }));
  const tryPay = (s: GameState, pac: InstanceId, who: readonly InstanceId[], player: PlayerId = P1) =>
    refusal(s, use(player, pac, ABILITY, [], { exhausted: who }));

  /** Tech-Pac on Rhino (SCH 1 + 1 = 2); Spider-Man (THW 1), Black Cat and Mockingbird (THW 1 each) for the first player. */
  function onRhino(seats: readonly string[] = [SPIDER]) {
    const base = table(seats);
    const pac = attachToHost(base, TECH_PAC, villainOf(base));
    const cat = inPlayFor(pac.state, BLACK_CAT);
    const bird = inPlayFor(cat.state, MOCKINGBIRD);
    return { state: bird.state, pac: pac.id, cat: cat.id, bird: bird.id, hero: identityOf(bird.state) };
  }

  // RRG "Stun" p. 41 and "Confuse" p. 13 cancel an attack or a thwart attempt; neither status is a state that stops a
  // character being exhausted as a cost, and THW is a printed stat the status cards leave alone. Costs are paid by
  // exhausting (RRG "Exhaust", "Cost").
  it("a stunned and confused identity still pays: its THW counts and the status cards stay (stun and confuse only replace attacks and thwarts)", () => {
    const t = onRhino();
    const marked = withStatus(withStatus(t.state, t.hero, "stunned"), t.hero, "confused");
    const out = pay(marked, t.pac, [t.hero, t.cat, t.bird]);
    expect(encounterDiscard(out.state)).toContain(t.pac);
    expect(inst(out.state, t.hero).exhausted).toBe(true);
    expect(inst(out.state, t.hero).statuses).toMatchObject({ stunned: 1, confused: 1 });
  });

  // "Characters you control" (RRG "Ownership and Control" p. 31): another player's identity and allies are not the first player's to
  // exhaust, even though the Hero Action may be used by any player in hero form.
  /** The first copy of `code` relabeled onto the player's deck card and put in their play area (a card their deck does not hold). */
  function relabeledAlly(state: GameState, code: string, player: PlayerId) {
    const id = playerOf(state, player).deck[0]!;
    const relabeled = patchInstance(state, id, {
      cardId: cardId(code),
      faceup: true,
      controllerId: player,
      exhausted: false,
    });
    return {
      id,
      state: {
        ...relabeled,
        players: relabeled.players.map((p) =>
          p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
        ),
      },
    };
  }
  /** Spider-Man (THW 1) with Black Cat (1), Captain Marvel (THW 2) with Mockingbird (1); Tech-Pac on Rhino (SCH 2). */
  function twoPlayers() {
    const base = table([SPIDER, MARVEL]);
    const pac = attachToHost(base, TECH_PAC, villainOf(base));
    const cat = inPlayFor(pac.state, BLACK_CAT, P1);
    const bird = relabeledAlly(cat.state, MOCKINGBIRD, P2);
    return {
      state: bird.state,
      pac: pac.id,
      cat: cat.id,
      bird: bird.id,
      h1: identityOf(bird.state),
      h2: identityOf(bird.state, P2),
    };
  }

  it("two players: the first player cannot exhaust the second player's characters to pay, and their own two (1 + 1) are not above 2", () => {
    const t = twoPlayers();
    expect(tryPay(t.state, t.pac, [t.h1, t.cat, t.h2])).toBeDefined();
    expect(tryPay(t.state, t.pac, [t.h1, t.cat, t.bird])).toBeDefined();
    expect(tryPay(t.state, t.pac, [t.h1, t.cat])).toBeDefined();
  });

  // December 17, 2025 - Ruling 1 (answer 1): "any player can trigger an 'Action' ability on an encounter card, with the
  // exception of certain attachments and obligations", so the player not engaged with the host may use Tech-Pac's Hero Action.
  it("two players: the second player can use the Hero Action with their own Captain Marvel and Mockingbird (2 + 1 > 2); the first player's characters stay ready", () => {
    const t = twoPlayers();
    const turn = driveEventsPicking(DEPS, t.state, firstLegal, endTurn(P1));
    const out = pay(turn.state, t.pac, [t.h2, t.bird], P2);
    expect(encounterDiscard(out.state)).toContain(t.pac);
    expect(inst(out.state, t.h2).exhausted).toBe(true);
    expect(inst(out.state, t.bird).exhausted).toBe(true);
    expect(inst(out.state, t.h1).exhausted).toBe(false);
    expect(inst(out.state, t.cat).exhausted).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Techno: Technological Innovation and the Techno treachery
// ---------------------------------------------------------------------------------------------------------------------

describe("Technological Innovation (53041): 'Place 1 additional threat here for each Tech card in play'", () => {
  // Owner default under test (docs/phase7-wave9.md 3.48 'Tests'): any card type with the trait counts, every player's,
  // counted after the found attachment has entered play. The card text says "Tech card", not "Tech attachment" (the
  // search clause just before it says "Tech attachment"), and RRG "Traits" p. 45 puts no limit on the card type.
  it("counts a Tech upgrade of each player (Arc Reactor, Web-Shooter) and the Tech attachment it just revealed: 4 + 3 = 7", () => {
    const base = table([IRON, SPIDER]);
    const reactor = upgradeOn(base, ARC_REACTOR, identityOf(base), P1);
    const shooter = upgradeOn(reactor.state, "01008", identityOf(reactor.state, P2), P2);
    const picked: Picker = (s) => {
      const choice = s.pendingChoice!;
      const hit = choice.options.find(
        (o) => choice.prompt.kind === "chooseCards" && codeOf(s, o.optionId as InstanceId) === JET_PACK,
      );
      return hit ? [hit.optionId] : firstLegal(s);
    };
    const run = villainPhase(onlyDeck(shooter.state, BLANK, BLANK, INNOVATION, FILLER, JET_PACK), picked);
    const scheme = inPlayCard(run.state, INNOVATION)!;
    expect(inst(run.state, inPlayCard(run.state, JET_PACK)!).attachedTo).toBe(villainOf(run.state));
    expect(inst(run.state, scheme).threat).toBe(7);
  });

  it("a Tech card in a hand or a discard pile is not 'in play': the same game with Arc Reactor in the hand counts only Jet Pack (4 + 1)", () => {
    const base = table([IRON]);
    const held = moveToHand(base, P1, ARC_REACTOR).state;
    const picked: Picker = (s) => {
      const choice = s.pendingChoice!;
      const hit = choice.options.find(
        (o) => choice.prompt.kind === "chooseCards" && codeOf(s, o.optionId as InstanceId) === JET_PACK,
      );
      return hit ? [hit.optionId] : firstLegal(s);
    };
    const run = villainPhase(onlyDeck(held, BLANK, INNOVATION, JET_PACK, FILLER), picked);
    expect(inst(run.state, inPlayCard(run.state, INNOVATION)!).threat).toBe(5);
  });

  it("with Fixer engaged, the found Jet Pack is redirected to him and still counts: Fixer himself (Elite, Genius, Thunderbolt) does not: 4 + 1", () => {
    const base = table([SPIDER]);
    const fixer = engageMinion(base, FIXER, P1);
    const run = villainPhase(onlyDeck(fixer.state, BLANK, BLANK, INNOVATION, JET_PACK, FILLER));
    const pack = inPlayCard(run.state, JET_PACK)!;
    expect(inst(run.state, pack).attachedTo).toBe(fixer.id);
    expect(inst(run.state, inPlayCard(run.state, INNOVATION)!).threat).toBe(5);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Techno in the Thunderbolts scenario: Fixer held by Thunderbolt Backup, and after the end-of-round swap
// ---------------------------------------------------------------------------------------------------------------------

/** The Thunderbolts scenario past setup (hero form), the two new sets set aside, Energy Truncheon and Armament in the deck. */
function thunder(seed: number, sets: readonly string[], seats: readonly string[] = [SPIDER]): GameState {
  const config = wave9Scenario("thunderbolts", {
    players: seats.map((starterDeckId) => ({ starterDeckId })),
    seed,
    difficulty: "standard",
    setAsideModularSetIds: sets,
  } as never);
  const extra = [TRUNCHEON, ARMAMENT].map((code) => cardId(code));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...extra] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const s = settle(created.state, firstLegal, (st) => st.step.phase === "player", DEPS);
  return heroForm(s, ...s.players.map((p) => p.playerId));
}
const heldMinion = (s: GameState): InstanceId | undefined =>
  cardsInPlay(s).find((i) => inst(s, i).heldMinion && inst(s, i).attachedTo !== null);
/** The first seed from 1 on whose setup holds `code` under the environment (and which is engaged: the other minion). */
function thunderHolding(code: string, sets: readonly string[], seats: readonly string[] = [SPIDER]): GameState {
  for (let seed = 1; seed <= 30; seed++) {
    const s = thunder(seed, sets, seats);
    const held = heldMinion(s);
    if (held && codeOf(s, held) === code) return s;
  }
  throw new Error(`no seed holds ${code}`);
}
const THUNDER_SETS = ["techno", "supersonic"] as const;
const engagedMinionOf = (s: GameState, player: PlayerId = P1): InstanceId | undefined =>
  cardsInPlay(s).find((i) => inst(s, i).engagedWith === player && codeOf(s, i) !== JUSTICE && i !== villainOf(s));
const environmentOf = (s: GameState): InstanceId => inPlayCard(s, JUSTICE)!;

describe("Fixer held by Thunderbolt Backup (MC50 p. 15; Q26 = B; RRG 1.8 'Find' p. 19, 'Engage' p. 18)", () => {
  // MC50 p. 15: the attached minion "is considered to be in play, retains all tokens, status cards, and attachments on it",
  // so Fixer's Forced Interrupt (a constant ability of a card in play) is live while he is held.
  it("a Tech attachment bound for Citizen V is attached to the held Fixer, not to the villain", () => {
    const s = thunderHolding(FIXER, THUNDER_SETS);
    const fixer = heldMinion(s)!;
    const villain = villainOf(s);
    // The most damaged minion is the one held at the round's end: keep Fixer there.
    const staged = patchInstance(s, fixer, { damage: 5 });
    const run = villainPhase(stackEncounterDeck(staged, BLANK, ARMAMENT, FILLER));
    const armament = inPlayCard(run.state, ARMAMENT)!;
    expect(inst(run.state, armament).attachedTo).toBe(fixer);
    expect(inst(run.state, villain).attachments).toEqual([]);
    expect(inst(run.state, fixer).attachedTo).toBe(environmentOf(run.state));
  });

  it("Techno revealed while Fixer is held finds him in play: he leaves the environment, engages the revealer and attacks them", () => {
    const s = thunderHolding(FIXER, THUNDER_SETS);
    const fixer = heldMinion(s)!;
    // The engaged minion is the more damaged one, so the round-end swap leaves Fixer alone.
    const other = engagedMinionOf(s)!;
    const staged = patchInstance(s, other, { damage: 9 });
    const run = villainPhase(stackEncounterDeck(staged, BLANK, TECHNO_CARD, ONE_ICON, FILLER));
    expect(attacksBy(run.state, run.events, FIXER)).toHaveLength(1);
    expect(inst(run.state, fixer)).toMatchObject({ engagedWith: P1 });
    expect(inst(run.state, fixer).heldMinion).toBeFalsy();
  });

  // MC50 p. 15: the swap "retains all tokens, status cards, and attachments". Fixer engaged with the Jet Pack and the
  // Tech-Pac is the most damaged minion, so he goes under the environment at the round's end with both.
  it("after the end-of-round swap Fixer keeps Jet Pack and Tech-Pac and their effects while held, and the next Tech reveal still goes to him", () => {
    // A seed whose setup leaves Fixer engaged (the other Thunderbolt minion is the one held).
    let s: GameState | undefined;
    for (let seed = 1; seed <= 30 && !s; seed++) {
      const g = thunder(seed, THUNDER_SETS);
      const engaged = engagedMinionOf(g);
      if (engaged && codeOf(g, engaged) === FIXER) s = g;
    }
    expect(s, "a seed that engages Fixer").toBeDefined();
    const fixer = engagedMinionOf(s!)!;
    const pack = attachToHost(s!, JET_PACK, fixer);
    const pac = attachToHost(pack.state, TECH_PAC, fixer);
    const hurt = patchInstance(pac.state, fixer, { damage: 9 });
    const round1 = villainPhase(stackEncounterDeck(hurt, BLANK, FILLER));
    expect(inst(round1.state, fixer)).toMatchObject({ engagedWith: null, attachedTo: environmentOf(round1.state) });
    expect(inst(round1.state, fixer).attachments).toEqual(expect.arrayContaining([pack.id, pac.id]));
    expect(statBonus(round1.state, DEPS, fixer, "atk")).toBeGreaterThanOrEqual(2);
    expect((traitsOf(round1.state, fixer, DEPS) as readonly string[]).includes("AERIAL")).toBe(true);
    // Next round: a Tech attachment bound for the villain still finds the held Fixer.
    const round2 = villainPhase(stackEncounterDeck(round1.state, BLANK, ARMAMENT, FILLER));
    expect(inst(round2.state, inPlayCard(round2.state, ARMAMENT)!).attachedTo).toBe(fixer);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Whiteout: Encased in Ice
// ---------------------------------------------------------------------------------------------------------------------

/** Encased in Ice (surgery) on `host`: returns the state and the ice. */
const encase = (s: GameState, host: InstanceId) => attachToHost(s, ICE, host);
const iceDamage = (s: GameState, ice: InstanceId) => inst(s, ice).damage;
const canAttack = (s: GameState, attacker: InstanceId, target: InstanceId, player: PlayerId = P1) =>
  refusal(s, basic(attacker, target, player)) === undefined;

describe("Encased in Ice (54035) with two players (RRG 1.8 'Attach To' p. 8, 'Move' p. 30)", () => {
  // Card: "Any player can attack this card as if it were a minion" and "move all but 3 damage here to attached character".
  // The moved damage goes to the host (the first player's identity) whoever dealt the last blow (RRG "Move": moved damage
  // is "dealt to that character"); the attacker is not the host and takes nothing.
  it("the second player's hero breaks the first player's ice: the surplus damage is moved to the first player, not the attacker", () => {
    const base = table([SPIDER, HULK]);
    const hero1 = identityOf(base);
    const hero2 = identityOf(base, P2);
    const e = encase(base, hero1);
    const turn = driveEventsPicking(DEPS, patchInstance(e.state, e.id, { damage: 2 }), firstLegal, endTurn(P1));
    expect(canAttack(turn.state, hero2, e.id, P2)).toBe(true);
    const out = attackAs(turn.state, hero2, e.id, P2);
    // She-Hulk ATK 3: 2 + 3 = 5 on the card, all but 3 (2) moved to Spider-Man.
    expect(damageOf(out.state, hero1)).toBe(2);
    expect(damageOf(out.state, hero2)).toBe(0);
    expect(encounterDiscard(out.state)).toContain(e.id);
  });

  // Another copy is no enemy (RRG "Enemy" p. 18), wherever it is attached: see the two-copies finding below.
  it("an encased identity can attack its own copy and another player's copy (no enemy other than this card), not Rhino", () => {
    const base = table([SPIDER, HULK]);
    const hero1 = identityOf(base);
    const mine = encase(base, hero1);
    const theirs = encase(mine.state, identityOf(base, P2));
    expect(canAttack(theirs.state, hero1, mine.id)).toBe(true);
    expect(canAttack(theirs.state, hero1, theirs.id)).toBe(true);
    expect(canAttack(theirs.state, hero1, villainOf(theirs.state))).toBe(false);
  });

  // RRG "Consequential Damage" p. 13: "After an ally attacks, it takes consequential damage equal to the number of
  // consequential damage icons beneath its ATK field": the ally's own icons, whatever it attacked. Mockingbird (ATK 1,
  // one icon) attacking the other player's ice is an attack ("as if it were a minion"), so she takes 1.
  it("the first player's ally attacks the second player's ice: the card takes the ATK and the ally takes its consequential damage", () => {
    const base = table([SPIDER, MARVEL]);
    const e = encase(base, identityOf(base, P2));
    const bird = inPlayFor(e.state, MOCKINGBIRD, P1);
    expect(canAttack(bird.state, bird.id, e.id)).toBe(true);
    const out = attackAs(bird.state, bird.id, e.id);
    expect(iceDamage(out.state, e.id)).toBe(1);
    expect(damageOf(out.state, bird.id)).toBe(1);
    expect(damageOf(out.state, identityOf(out.state, P2))).toBe(0);
  });
});

describe("Encased in Ice (54035) host states", () => {
  // RRG "Stun" p. 41: "A stunned character can attempt to attack ... even if it has no valid target"; "If a stunned
  // identity or ally attempts to attack ... discard the stunned card instead. Costs ... must still be paid"; "not
  // considered to have attacked". The ice is a valid target, so the attempt may name it: the stun goes, the ice takes nothing.
  it("a stunned encased hero attacking the ice discards the stun, exhausts, and puts no damage on the ice", () => {
    const base = table([HULK]);
    const hero = identityOf(base);
    const e = encase(withStatus(base, hero, "stunned"), hero);
    const out = attackAs(e.state, hero, e.id);
    expect(inst(out.state, hero).statuses.stunned).toBe(0);
    expect(inst(out.state, hero).exhausted).toBe(true);
    expect(iceDamage(out.state, e.id)).toBe(0);
  });

  // RRG "Move" p. 30: moved damage "is considered to be dealt to that character"; RRG "Tough" p. 44: a character that
  // "would take any amount of damage" prevents all of it and discards one tough card. The moved damage is dealt, so a
  // tough host should absorb it, like any other damage that is not a cost.
  it("a tough host: the moved surplus is prevented by the tough status card (dealt damage, RRG 'Move' p. 30 and 'Tough' p. 44)", () => {
    const base = table([SPIDER, HULK]);
    const hero1 = identityOf(base);
    const e = encase(withStatus(base, hero1, "tough"), hero1);
    const turn = driveEventsPicking(DEPS, patchInstance(e.state, e.id, { damage: 2 }), firstLegal, endTurn(P1));
    const out = attackAs(turn.state, identityOf(turn.state, P2), e.id, P2);
    expect(encounterDiscard(out.state)).toContain(e.id);
    expect(damageOf(out.state, hero1)).toBe(0);
    expect(inst(out.state, hero1).statuses.tough).toBe(0);
  });

  // Retaliate X (RRG p. 38): "After a character with the retaliate X keyword is attacked". Black Panther's hero form has
  // Retaliate 1. An attack on the ice attached to him is not an attack on him, and the surplus is moved, not an attack.
  it("an attack on the ice of a Retaliate host does not retaliate (the host was not attacked), and neither does the moved surplus", () => {
    const base = table([PANTHER, HULK]);
    const panther = identityOf(base);
    const e = encase(base, panther);
    const turn = driveEventsPicking(DEPS, patchInstance(e.state, e.id, { damage: 2 }), firstLegal, endTurn(P1));
    const hulk = identityOf(turn.state, P2);
    const out = attackAs(turn.state, hulk, e.id, P2);
    expect(encounterDiscard(out.state)).toContain(e.id);
    expect(damageOf(out.state, panther)).toBe(2);
    expect(damageOf(out.state, hulk)).toBe(0);
  });

  // An ally that leaves play takes its attachments with it (RRG "Attach To" p. 8): the damage on the ice is lost, nothing
  // is moved, and the ice goes to the encounter discard pile where Blizzard can find it again.
  it("an encased ally defeated as a defender: the ice (with its damage) is discarded, no damage reaches the hero", () => {
    const base = table([SPIDER]);
    const cat = inPlayFor(base, BLACK_CAT);
    const e = encase(cat.state, cat.id);
    const hurt = patchInstance(e.state, e.id, { damage: 2 });
    const defend: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "declareDefender") return firstLegal(s);
      return [choice.options.find((o) => o.optionId === cat.id)?.optionId ?? "decline"];
    };
    const run = villainPhase(onlyDeck(hurt, BLANK, BLANK), defend);
    expect(cardsInPlay(run.state)).not.toContain(cat.id);
    expect(encounterDiscard(run.state)).toContain(e.id);
    expect(damageOf(run.state, identityOf(run.state))).toBe(0);
    expect(cardsInPlay(run.state)).not.toContain(e.id);
  });
});

describe("Encased in Ice (54035) against 'after you attack' responses and attack events that name several targets", () => {
  // OPEN, two readings (flagged, not picked). The card says players attack it "as if it were a minion". Engine default
  // (owner default under test, docs/phase7-wave9.md 3.50): it is a target of an attack, not an enemy, so "After you attack
  // an enemy" (Innocent Bystanders 50134) does not hear it.
  //   Against: RRG "Enemy" p. 18: "An enemy is a minion or villain"; the ice is neither, and the phrase "as if it were a
  //   minion" sits in the targeting sentence only (RRG "Attack (Player Ability Type)" p. 10 talks of "an enemy that can be
  //   attacked"). RRG "Attach To" p. 8 makes it an attachment.
  //   For: "as if it were a minion" with no stated limit could mean the whole attack procedure treats it as a minion, so
  //   "after you attack a minion/an enemy" fires. No FFG ruling in marvel-champions-rulings-post-rrg-1-7.md names the card
  //   or the phrase; the nearest, December 17, 2025 - Ruling 1 (question 3, Beguiled), is about an ally becoming a minion by a status
  //   change (not applicable).
  it("Innocent Bystanders (50134, 'After you attack an enemy'): the identity's attack on the ice removes no bystander counter (pinned, today's reading)", () => {
    const base = thunder(1, ["whiteout", "supersonic"]);
    const hero = identityOf(base);
    const deckId = activeEncounterDeckId(base);
    const pile = base.encounterDecks[deckId]!;
    const card = [...pile.deck, ...pile.discard].find((i) => codeOf(base, i) === BYSTANDERS)!;
    const given: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== card), discard: pile.discard.filter((i) => i !== card) },
      },
      players: base.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, card] } : p)),
      instances: {
        ...base.instances,
        [card]: { ...base.instances[card]!, faceup: true, controllerId: P1, counters: { bystander: 4 } },
      },
    };
    // Control: the same attack on the engaged Thunderbolt minion is "an enemy" and costs a counter.
    const control = attackAs(given, hero, engagedMinionOf(given)!);
    expect(inst(control.state, card).counters["bystander"]).toBe(3);
    const e = encase(given, hero);
    const out = attackAs(e.state, hero, e.id);
    expect(iceDamage(out.state, e.id)).toBeGreaterThan(0);
    expect(inst(out.state, card).counters["bystander"]).toBe(4);
  });

  // Spray Fire (50039; relabeled onto a hand card): "Hero Action (attack): Choose a player. Deal 3 damage to the villain
  // and each minion engaged with that player." A group-named attack: the ice is engaged with no one and is not the villain.
  const spray = (state: GameState, player: PlayerId) => {
    const hand = playerOf(state, player).hand;
    const id = hand[0]!;
    const relabeled = patchInstance(state, id, { cardId: cardId("50039") });
    return driveEventsPicking(DEPS, relabeled, firstLegal, play(player, id, payWith(relabeled, player, 3, [id]), {}));
  };

  it("an unencased player's Spray Fire hits the villain and not another player's ice (the ice is not a minion engaged with anyone)", () => {
    const base = table([SPIDER, IRON]);
    const e = encase(base, identityOf(base, P2));
    const out = spray(e.state, P1);
    expect(damageOf(out.state, villainOf(out.state))).toBe(3);
    expect(iceDamage(out.state, e.id)).toBe(0);
  });

  // "Attached character cannot attack enemies other than this card": Spray Fire's attack names only the villain and
  // minions, so an encased hero's Spray Fire cannot attack them. RRG "Attack (Player Ability Type)" p. 10: an ability
  // labeled as an attack "is considered to attack the specified target".
  it("an encased hero's Spray Fire deals nothing to the villain (it names no target but enemies other than the ice)", () => {
    const base = table([SPIDER]);
    const e = encase(base, identityOf(base));
    const out = spray(e.state, P1);
    expect(damageOf(out.state, villainOf(out.state))).toBe(0);
    expect(iceDamage(out.state, e.id)).toBe(0);
  });
});

describe("Encased in Ice (54035): two copies on one character (card text: 'cannot attack enemies other than this card')", () => {
  // Blizzard attacks the same character more than once (the set holds two copies). Each copy forbids attacks on "enemies
  // other than this card". RRG "Enemy" p. 18: an enemy is a minion or villain; the other copy is an attachment attackable
  // "as if it were a minion", not an enemy, so by the printed words neither copy forbids attacking the other and the
  // host may break either.
  // FINDING (Techno/Whiteout 1), fixed: the host with two copies used to be locked out of both, the engine reading the
  // other copy as an enemy for the prohibition. A `cannotAttack` target is now matched against what the card is
  // (select.ts `attackForbidden`), so the host may attack either copy and still no enemy.
  function twoCopies() {
    const base = table([HULK]);
    const hero = identityOf(base);
    const a = encase(base, hero);
    const b = encase(a.state, hero);
    return { state: b.state, hero, a: a.id, b: b.id };
  }
  it("the character with two copies can attack either of them, and not Rhino", () => {
    const t = twoCopies();
    expect(canAttack(t.state, t.hero, t.a)).toBe(true);
    expect(canAttack(t.state, t.hero, t.b)).toBe(true);
    expect(canAttack(t.state, t.hero, villainOf(t.state))).toBe(false);
  });
  it("another player's hero can still attack both copies (any player can attack the card)", () => {
    const base = table([SPIDER, HULK]);
    const a = encase(base, identityOf(base));
    const b = encase(a.state, identityOf(base));
    const turn = driveEventsPicking(DEPS, b.state, firstLegal, endTurn(P1));
    expect(canAttack(turn.state, identityOf(turn.state, P2), a.id, P2)).toBe(true);
    expect(canAttack(turn.state, identityOf(turn.state, P2), b.id, P2)).toBe(true);
  });
});

describe("Blizzard (54034) Forced Response: 'Otherwise, stun the attacked character' (RRG 1.8 '\"Otherwise\"' p. 31)", () => {
  const withBlizzard = () => {
    const base = table([SPIDER]);
    const blizzard = engageMinion(base, BLIZZARD, P1);
    const stunned = withStatus(blizzard.state, villainOf(base), "stunned");
    return { state: stunned, blizzard: blizzard.id };
  };
  const defendWith =
    (id: InstanceId): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "declareDefender") return firstLegal(s);
      return [choice.options.find((o) => o.optionId === id)?.optionId ?? "decline"];
    };

  // RRG "Otherwise": the second sentence resolves "only if the preceding effect was not resolved"; an effect "that cannot
  // at least partially resolve" counts. A copy that is found but cannot be attached (the defending ally is defeated by the
  // attack, so no longer in play) would therefore make "otherwise" apply, but a card that left play cannot be stunned: the
  // observable result is the same under either reading. Owner default (no stun when found but not attached) is consistent.
  it("the defending ally is defeated: nothing is encased, nobody is stunned, the copy stays findable and the deck was shuffled", () => {
    const { state, blizzard } = withBlizzard();
    const cat = inPlayFor(state, BLACK_CAT);
    const hurt = patchInstance(cat.state, cat.id, { damage: 1 });
    const run = villainPhase(iceInDiscard(onlyDeck(hurt, ...MANY_BLANKS)), defendWith(cat.id));
    expect(attacksBy(run.state, run.events, BLIZZARD)).toHaveLength(1);
    expect(cardsInPlay(run.state)).not.toContain(cat.id);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(0);
    expect(inst(run.state, identityOf(run.state)).attachments).toEqual([]);
    expect(encounterDiscard(run.state).filter((i) => codeOf(run.state, i) === ICE)).toHaveLength(2);
    expect(types(run.events, "deckShuffled").length).toBeGreaterThanOrEqual(1);
    expect(blizzard).toBeDefined();
  });

  it("two players: Blizzard (engaged with the first player) encases only the first player; the second player is untouched", () => {
    const base = table([SPIDER, MARVEL]);
    const blizzard = engageMinion(base, BLIZZARD, P1);
    const stunned = withStatus(blizzard.state, villainOf(base), "stunned");
    const run = villainPhase(iceInDiscard(onlyDeck(stunned, ...MANY_BLANKS)));
    expect(inst(run.state, identityOf(run.state)).attachments.map((a) => codeOf(run.state, a))).toEqual([ICE]);
    expect(inst(run.state, identityOf(run.state, P2)).attachments).toEqual([]);
    expect(inst(run.state, identityOf(run.state, P2)).statuses.stunned).toBe(0);
  });
});

describe("Whiteout (54037) boost: 'You are stunned' (RRG 1.8 'You, Your' p. 49, 'Boost' p. 11)", () => {
  // "You" on a boost card is the player the activation is against (spec 3.28's reading, used by the other boosts of the
  // wave): their identity is stunned, even when an ally defends and takes the hit.
  it("an ally defends Rhino's attack: the player's identity is stunned, the ally is not", () => {
    const base = table([SPIDER]);
    const cat = inPlayFor(base, BLACK_CAT);
    const defend: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "declareDefender") return firstLegal(s);
      return [choice.options.find((o) => o.optionId === cat.id)?.optionId ?? "decline"];
    };
    const run = villainPhase(onlyDeck(cat.state, WHITEOUT_CARD, BLANK), defend);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(1);
    expect(inst(run.state, cat.id).statuses.stunned).toBe(0);
  });

  it("two players: the boost on the activation against the second player stuns the second player only", () => {
    const base = table([SPIDER, MARVEL]);
    // Rhino activates against the first player (a blank boost), then against the second player (the Whiteout boost).
    const run = villainPhase(onlyDeck(base, BLANK, WHITEOUT_CARD, FILLER, FILLER));
    expect(inst(run.state, identityOf(run.state, P2)).statuses.stunned).toBe(1);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(0);
  });
});

describe("Slippery Conditions (54036): 'After an ally enters play, exhaust it' (RRG 1.8 'Enters Play' p. 18)", () => {
  // RRG "Enters Play": playing a card, putting a card into play by a card ability and revealing are all means of entering
  // play. Make the Call (01071) puts Maria Hill into play from the discard pile.
  function makeTheCall(withScheme: boolean) {
    const base = table([MARVEL], { hero: false });
    const staged = withScheme ? encounterCardInVillainArea(base, SLIPPERY, 3).state : base;
    const hill = moveToDiscard(staged, P1, "01067");
    const call = moveToHand(hill.state, P1, "01071");
    const pay = payWith(call.state, P1, 2, call.ids);
    const run = driveEventsPicking(
      DEPS,
      call.state,
      firstLegal,
      play(P1, call.ids[0]!, pay, { costChoices: { ally: [hill.id] } }),
    );
    return { run, ally: hill.id };
  }
  it("an ally put into play by an effect (Make the Call) from the discard pile enters exhausted", () => {
    const { run, ally } = makeTheCall(true);
    expect(playerOf(run.state, P1).playArea).toContain(ally);
    expect(inst(run.state, ally).exhausted).toBe(true);
  });
  it("control: without Slippery Conditions the same ally enters ready", () => {
    const { run, ally } = makeTheCall(false);
    expect(playerOf(run.state, P1).playArea).toContain(ally);
    expect(inst(run.state, ally).exhausted).toBe(false);
  });

  it("two players: an ally the second player plays is exhausted too (any ally, whoever controls it)", () => {
    const base = table([SPIDER, MARVEL], { hero: false });
    const staged = encounterCardInVillainArea(base, SLIPPERY, 6).state;
    const turn = driveEventsPicking(DEPS, staged, firstLegal, endTurn(P1));
    const given = moveToHand(turn.state, P2, MOCKINGBIRD);
    const pay = payWith(given.state, P2, 3, given.ids);
    const run = driveEventsPicking(DEPS, given.state, firstLegal, play(P2, given.ids[0]!, pay));
    expect(playerOf(run.state, P2).playArea).toContain(given.ids[0]);
    expect(inst(run.state, given.ids[0]!).exhausted).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Strength in Diversity
// ---------------------------------------------------------------------------------------------------------------------

describe("Strength in Diversity (53019): Alliance and a tough enemy (RRG 1.8 'Alliance' p. 6, 'Tough' p. 44, 'For Each' p. 20)", () => {
  const DIVERSITY = "53019";
  const pickDamage: Picker = labeled("Deal 1 damage");

  // RRG "Alliance": "any player(s) may help pay the costs", "Only the player playing the card ... is considered to be
  // resolving that card": the second player may pay part of the 2-per-player cost (4 at two players) and the first
  // player makes every choice.
  it("two players: the second player pays half of the cost from their hand and the first player alone makes the choices", () => {
    // Threat on the main scheme, so "Remove 1 threat from a scheme" can be chosen and each pass is a choice.
    const calm = table([FALCON_SEAT, MARVEL]);
    const base = patchInstance(calm, calm.mainScheme.instanceId, { threat: 5 });
    const given = moveToHand(base, P1, DIVERSITY);
    const mine = payWith(given.state, P1, 2, given.ids);
    const theirs = payWith(given.state, P2, 2);
    const asked: { kind: string; playerId: PlayerId }[] = [];
    const picker: Picker = (s) => {
      asked.push({ kind: s.pendingChoice!.prompt.kind, playerId: s.pendingChoice!.playerId });
      return pickDamage(s);
    };
    const run = driveEventsPicking(DEPS, given.state, picker, play(P1, given.ids[0]!, [...mine, ...theirs]));
    expect(theirs).toHaveLength(2);
    for (const id of theirs) expect(playerOf(run.state, P2).discard).toContain(id);
    expect(playerOf(run.state, P1).discard).toContain(given.ids[0]);
    // Falcon (Aerial, Avenger) and Captain Marvel (Avenger, Soldier): three traits, three choices, all made by the first player.
    const choices = asked.filter((a) => a.kind === "chooseOption");
    expect(choices).toHaveLength(3);
    expect(choices.every((a) => a.playerId === P1)).toBe(true);
    expect(damageOf(run.state, villainOf(run.state))).toBe(3);
  });

  it("Falcon alone (two traits, two choices), both on one tough enemy: the first damage discards the tough card, the second is dealt", () => {
    const base = table([FALCON_SEAT]);
    const rhino = withStatus(base, villainOf(base), "tough");
    const given = moveToHand(rhino, P1, DIVERSITY);
    const pay = payWith(given.state, P1, 2, given.ids);
    const run = driveEventsPicking(DEPS, given.state, pickDamage, play(P1, given.ids[0]!, pay));
    // Falcon: Aerial and Avenger = two choices; the first is absorbed by the tough card (RRG 'Tough': prevent all of that
    // damage and discard one tough card), the second is dealt.
    expect(inst(run.state, villainOf(run.state)).statuses.tough).toBe(0);
    expect(damageOf(run.state, villainOf(run.state))).toBe(1);
  });
});

describe("Encased in Ice (54035) and damage divided among enemies (Wasp Sting 13006, Giant form)", () => {
  // Owner default under test (docs/phase7-wave9.md 3.50, "an attack ... that names enemies by a group"): "deal a total of 4
  // damage divided among enemies you choose" does not offer the ice. Sources for the default: RRG "Enemy" p. 18 (the ice is not
  // an enemy) and the card's own "as if it were a minion", which speaks of attacking it. Against it: each recipient of the
  // divided damage is chosen as an attack's target (RRG "Attack (Player Ability Type)" p. 10: an attack ability "is
  // considered to attack the specified target"), which is where "as if it were a minion" applies. No FFG ruling covers it.
  it("the division offers the villain and the minion as recipients, not another player's Encased in Ice (pinned, today's reading)", () => {
    const base = table(["wsp-aggression", SPIDER]);
    const fixer = engageMinion(base, FIXER, P1);
    const minion = fixer.id;
    const wasp = withForm(fixer.state, { heroForm: 1 });
    const e = encase(wasp, identityOf(wasp, P2));
    const given = moveToHand(e.state, P1, "13006");
    const offered: string[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "divide") offered.push(...choice.options.map((o) => o.optionId.split("#")[0]!));
      return firstLegal(s);
    };
    driveEventsPicking(DEPS, given.state, pick, play(P1, given.ids[0]!, payWith(given.state, P1, 2, given.ids)));
    expect(offered.length).toBeGreaterThan(0);
    expect([...new Set(offered)].sort()).toEqual([villainOf(given.state), minion].sort());
    expect(offered).not.toContain(e.id);
  });
});
