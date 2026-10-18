import { CORE_STARTER_DECKS, WONDER_MAN_CARDS, cardId, type HeroIdentityCard, type UpgradeCard } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  legalActions,
  locateCard,
  replay,
  sessionApply,
  startSession,
  tuckLimitOf,
  tuckRoom,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { CORE_SPIDER_MAN, WAVE10_DEPS, heroPackConfig, wonderManGame, wonderManHeroGame } from "../../testing.js";
import { WONDER_MAN_DECK } from "../../testing.js";
import { WONDER_MAN_IDENTITY, WONDER_MAN_IDENTITY_SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wonder Man (58001a) and Simon Williams (58001b), and Ionic Physiology (58002), docs/phase7-wave10-hero-packs.md H2,
 * H3.12, H3.15 and H8.4 line HS1. The hand-built Justice deck `WONDER_MAN_DECK` against Core's Rhino. Hero face: ATK 1,
 * THW 2, DEF 2, hand size 5, 12 hit points; alter-ego face: REC 3, hand size 6.
 *
 * Sources: the card as errata'd (RRG 1.8 p. 70: the cost arrow became "Then"); FFG rulings March 6, 2026 - Ruling 3 (1)
 * (he may tuck at full hit points) and Ruling 4 (a basic attack, the event played during it tucked, then the Forced
 * Response discards); RRG 1.8 "'Then'" (p. 44), "Printed" (p. 35), "Tuck" (p. 45); January 17, 2026 - Ruling 4 (1) (a
 * wild resource is any type for a card that reads the resource spent).
 *
 * Cards used: Active Altruism 58003 (cost 0, [energy], removes threat), Ionic Blast 58004 (cost 1, [energy], 3 damage
 * to an enemy), Starstruck 58005 (cost 1, [energy], damage equal to ATK), Bombs Away 58017 (Aggression, [energy]),
 * Battlefield Benevolence 58016 (cost 1, [physical]), Energy 58023 (2 [energy], a resource), Wonder Fans 58007 (a
 * support printing [wild]).
 */
const ATK_CONSTANT = "58001a.wonder-man-constant";
const FORCED = "58001a.wonder-man-forced-response";
const SIMON_CONSTANT = "58001b.simon-williams-constant";
const SETUP = "58001b.setup";
const LIMIT = "58002.ionic-physiology-constant";
const RESPONSE = "58002.ionic-physiology-response";
const PHYSIOLOGY = "58002";
const ALTRUISM = "58003";
const BLAST = "58004";
const STRUCK = "58005";
const BENEVOLENCE = "58016";
const BOMBS = "58017";
const ENERGY = "58023";
const FANS = "58007";
const HAYMAKER = "01087"; // Core Spider-Man event, 2, [energy]: "Deal 3 damage to an enemy"

const IDENTITY = WONDER_MAN_CARDS.find((c) => c.id === cardId("58001a")) as HeroIdentityCard;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState) => characterProfile(s, identityOf(s), WAVE10_DEPS)!;
const discardCodes = (s: GameState, player: PlayerId = P1): string[] =>
  playerOf(s, player).discard.map((i) => codeOf(s, i));

/**
 * The game with `held` cards of the deck tucked under Ionic Physiology (surgery) and `damage` on Wonder Man. The main
 * scheme holds 5 threat, so Active Altruism (a thwart) has a scheme to remove threat from and can be played (RRG 1.8
 * "Target", p. 42).
 */
function table(base: GameState, held: number, damage = 0) {
  const physiology = instancesOf(base, PHYSIOLOGY)[0]!;
  const fodder = playerOf(base, P1)
    .deck.filter((id) => codeOf(base, id) !== ALTRUISM)
    .slice(0, held);
  const state0: GameState = {
    ...base,
    players: base.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => !fodder.includes(i)) } : p,
    ),
  };
  const state1 = patchInstance(patchInstance(state0, physiology, { tucked: fodder }), base.mainScheme.instanceId, {
    threat: 5,
  });
  return { state: patchInstance(state1, identityOf(state1, P1), { damage }), physiology, fodder };
}

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** The options of the choice that offered Ionic Physiology's Response, if one did. */
  readonly offered: readonly string[] | undefined;
}

/**
 * Applies `command`, answering each choice: the Response is taken when `takeResponse` (else declined with an empty selection), anything else takes `pick`. The log replays to the same state.
 */
function drive(state: GameState, command: Command, opts: { takeResponse?: boolean; pick?: Picker } = {}): Run {
  const { takeResponse = true, pick = firstLegal } = opts;
  let session = startSession(state);
  const events: GameEvent[] = [];
  let offered: string[] | undefined;
  const apply = (c: Command) => {
    const result = sessionApply(session, c, WAVE10_DEPS);
    if (!result.ok) throw new Error(`${c.type} rejected: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
  };
  apply(command);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 60) throw new Error(`choices did not settle (${session.state.pendingChoice.prompt.kind})`);
    const choice = session.state.pendingChoice;
    const mine = choice.options.find((o) => JSON.stringify(o).includes(RESPONSE));
    let selected: string[];
    if (mine) {
      offered = choice.options.map((o) => o.optionId as string);
      selected = takeResponse ? [mine.optionId] : [];
    } else selected = [...pick(session.state)];
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: selected as never,
    });
  }
  const replayed = replay(session.log, WAVE10_DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events, offered };
}

/** `event` and exactly the cards that pay for it in the first seat's hand, and the command that plays it. */
function staged(base: GameState, event: string, payers: readonly string[] = [], player: PlayerId = P1) {
  const given = moveToHand(base, player, event, ...payers);
  const [id, ...paying] = given.ids as [InstanceId, ...InstanceId[]];
  const state: GameState = {
    ...given.state,
    players: given.state.players.map((p) => (p.playerId === player ? { ...p, hand: [id, ...paying] } : p)),
  };
  return { state, id, paying, command: play(player, id, paying) };
}
const healed = (events: readonly GameEvent[]) => events.filter((e) => e.type === "damageHealed");
const tuckedOf = (s: GameState, physiology: InstanceId) => inst(s, physiology).tucked;
const basicAttack = (s: GameState, target: InstanceId = villainOf(s)): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: target,
});
const withThreat = (s: GameState, threat: number): GameState => patchInstance(s, s.mainScheme.instanceId, { threat });
const offeredAbilities = (s: GameState): string[] => {
  const listed = legalActions(s, P1, WAVE10_DEPS);
  if (listed.kind !== "turn") throw new Error(listed.kind);
  return listed.legal.flatMap((a) => (a.action.kind === "useAbility" ? [a.action.abilityId as string] : []));
};

function spiderMan() {
  const deck = CORE_STARTER_DECKS.find((d) => d.id === CORE_SPIDER_MAN)!;
  return {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap((l) => Array.from({ length: l.quantity }, () => l.cardId)),
  };
}

/** A two-player game: Wonder Man and the Core Spider-Man deck, both in hero form. */
function twoPlayerGame(): GameState {
  const config = heroPackConfig(WONDER_MAN_DECK);
  const created = createGame({ ...config, players: [config.players[0]!, spiderMan()] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const open = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
  return withForm(withForm(open, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
}

describe("Wonder Man identity registry", () => {
  it("every ability validates, with the printed timing", () => {
    for (const id of [ATK_CONSTANT, FORCED, SIMON_CONSTANT, SETUP, LIMIT, RESPONSE])
      expect(validateDefinition(WONDER_MAN_IDENTITY[id]!), id).toEqual([]);
    expect(WONDER_MAN_IDENTITY[ATK_CONSTANT]!.trigger).toMatchObject({ kind: "constant" });
    expect(WONDER_MAN_IDENTITY[FORCED]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(WONDER_MAN_IDENTITY[SIMON_CONSTANT]!.trigger).toMatchObject({ kind: "constant" });
    expect(WONDER_MAN_IDENTITY[SETUP]!.trigger).toMatchObject({ kind: "setup" });
    expect(WONDER_MAN_IDENTITY[LIMIT]!.trigger).toMatchObject({ kind: "constant" });
    expect(WONDER_MAN_IDENTITY[RESPONSE]!.trigger).toMatchObject({ kind: "response" });
    expect((WONDER_MAN_IDENTITY[RESPONSE]!.trigger as { forced?: boolean }).forced).toBeFalsy();
  });

  it("all six printed refs are registered and none is skipped", () => {
    expect(WONDER_MAN_IDENTITY_SKIPPED).toEqual({});
    const ionic = WONDER_MAN_CARDS.find((c) => c.id === cardId(PHYSIOLOGY)) as UpgradeCard;
    const printed = [...IDENTITY.hero.abilities, ...IDENTITY.alterEgo.abilities, ...ionic.abilities].map(
      (a) => a.id as string,
    );
    expect(printed.sort()).toEqual([ATK_CONSTANT, FORCED, SIMON_CONSTANT, SETUP, LIMIT, RESPONSE].sort());
    expect(Object.keys(WONDER_MAN_IDENTITY).sort()).toEqual(printed.sort());
  });

  it("data: hero ATK 1, THW 2, DEF 2, hand size 5, 12 hit points; alter ego REC 3, hand size 6; the deck rule is carried by the data", () => {
    expect(IDENTITY.hp).toBe(12);
    expect(IDENTITY.hero).toMatchObject({ atk: 1, thw: 2, def: 2, handSize: 5 });
    expect(IDENTITY.alterEgo).toMatchObject({ rec: 3, handSize: 6 });
    // Ionic Energy Being (58001b.simon-williams-constant) is enforced by validateDeck: wave10/wonder-man-deck.test.ts.
    expect(IDENTITY.deckbuilding).toEqual({ offAspectAllowance: { cardType: "event", printedResource: "energy" } });
    expect(WONDER_MAN_IDENTITY[SIMON_CONSTANT]!.trigger).toEqual({ kind: "constant" });
  });
});

describe("Ionic Physiology (58002, Wonder Man hero pack) card data", () => {
  // RRG 1.8 Appendix V p. 70 (Wonder Man Hero Pack): "Should read: 'Response: After you play an event with a printed
  // [energy] resource, tuck that event from your discard pile under this card. Then, heal 1 damage from your identity.'
  // (Changed cost arrow to 'Then'.)" The pack is data-only (no ability scripts), but its `text.current` and `errata`
  // block still carry the pre-erratum cost arrow, unlike every other RRG 1.8 erratum in the pool.
  it("text.current carries the RRG 1.8 'Then, heal 1 damage' wording", () => {
    const card = WONDER_MAN_CARDS.find((c) => c.name === "Ionic Physiology")!;
    expect("text" in card ? card.text.current : "").toContain(
      "under this card. Then, heal 1 damage from your identity.",
    );
  });
});

describe(`${SETUP}: Setup: put Ionic Physiology into play`, () => {
  it("the game opens in alter-ego form with Ionic Physiology in play on Simon Williams, nothing tucked, 3 room", () => {
    const s = wonderManGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    const [physiology] = instancesOf(s, PHYSIOLOGY);
    expect(physiology).toBeDefined();
    expect(inst(s, physiology!)).toMatchObject({ faceup: true, controllerId: P1, attachedTo: identityOf(s) });
    expect(inst(s, identityOf(s)).attachments).toContain(physiology);
    expect(playerOf(s, P1).setAside).not.toContain(physiology);
    expect(playerOf(s, P1).hand).not.toContain(physiology);
    expect(playerOf(s, P1).deck).not.toContain(physiology);
    expect(inst(s, physiology!).tucked).toEqual([]);
    expect(tuckLimitOf(s, WAVE10_DEPS, physiology!)).toBe(3);
    expect(tuckRoom(s, WAVE10_DEPS, physiology!)).toBe(3);
  });
});

describe(`${RESPONSE}: after you play an event with a printed energy resource, tuck it from your discard pile; then heal 1`, () => {
  it("at full hit points the event is tucked from the discard pile and nothing heals (March 6, 2026 - Ruling 3 (1))", () => {
    const t = table(wonderManHeroGame(), 0, 0);
    const p = staged(withThreat(t.state, 5), ALTRUISM);
    const run = drive(p.state, p.command);
    expect(run.offered).toBeDefined();
    expect(tuckedOf(run.state, t.physiology)).toEqual([p.id]);
    expect(playerOf(run.state, P1).discard).not.toContain(p.id);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(0);
    expect(healed(run.events)).toEqual([]);
    // Active Altruism itself still resolved: it removed threat before being tucked.
    expect(run.state.mainScheme).toBeDefined();
  });

  it("with 3 damage on him, a tucked event heals exactly 1 damage from his identity (2 tucked before: the third)", () => {
    const t = table(wonderManHeroGame(), 2, 3);
    const p = staged(t.state, ALTRUISM);
    const run = drive(p.state, p.command);
    expect(tuckedOf(run.state, t.physiology)).toEqual([...t.fodder, p.id]);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(2);
    expect(healed(run.events)).toHaveLength(1);
    expect(tuckRoom(run.state, WAVE10_DEPS, t.physiology)).toBe(0);
  });

  it("Ionic Blast and Starstruck (both [energy]) are tucked as well, and Bombs Away from another aspect (his deck rule)", () => {
    for (const code of [BLAST, STRUCK]) {
      const t = table(wonderManHeroGame(), 0, 1);
      const p = staged(t.state, code, [ENERGY]);
      const run = drive(p.state, p.command);
      expect(tuckedOf(run.state, t.physiology), code).toEqual([p.id]);
      expect(inst(run.state, identityOf(run.state)).damage, code).toBe(0);
    }
    const t = table(wonderManHeroGame(), 0, 1);
    const p = staged(t.state, BOMBS, [ENERGY]);
    const run = drive(p.state, p.command, { pick: firstLegal });
    expect(tuckedOf(run.state, t.physiology)).toEqual([p.id]);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(0);
  });

  it("it is optional: declined, the event stays in the discard pile and nothing heals", () => {
    const t = table(wonderManHeroGame(), 1, 3);
    const p = staged(t.state, ALTRUISM);
    const run = drive(p.state, p.command, { takeResponse: false });
    expect(run.offered).toBeDefined();
    expect(tuckedOf(run.state, t.physiology)).toEqual(t.fodder);
    expect(playerOf(run.state, P1).discard).toContain(p.id);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(3);
  });

  it("an event with no printed energy resource is not tucked, and the response is not offered", () => {
    const t = table(wonderManHeroGame(), 0, 3);
    const hurt = patchInstance(t.state, villainOf(t.state), { damage: 4 });
    const p = staged(hurt, BENEVOLENCE, [FANS]);
    const run = drive(p.state, p.command);
    expect(run.offered).toBeUndefined();
    expect(tuckedOf(run.state, t.physiology)).toEqual([]);
    expect(playerOf(run.state, P1).discard).toContain(p.id);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(3);
    // Battlefield Benevolence (another module) is played and discarded all the same.
  });

  it("paying with [energy] resources does not make an event an energy event: Battlefield Benevolence paid with Energy", () => {
    const t = table(wonderManHeroGame(), 0, 3);
    const hurt = patchInstance(t.state, villainOf(t.state), { damage: 4 });
    const p = staged(hurt, BENEVOLENCE, [ENERGY]);
    const run = drive(p.state, p.command);
    expect(run.offered).toBeUndefined();
    expect(tuckedOf(run.state, t.physiology)).toEqual([]);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(3);
    // Energy (the resource card) was spent, not played: it is in the discard pile, never under Ionic Physiology.
    expect(discardCodes(run.state)).toEqual(expect.arrayContaining([BENEVOLENCE, ENERGY]));
  });

  it("a [wild] resource that pays for a [physical] event changes nothing (a wild is any type only when the resource is read)", () => {
    const t = table(wonderManHeroGame(), 0, 3);
    const hurt = patchInstance(t.state, villainOf(t.state), { damage: 4 });
    const p = staged(hurt, BENEVOLENCE, [FANS]);
    expect(p.paying).toHaveLength(1);
    const run = drive(p.state, p.command);
    expect(tuckedOf(run.state, t.physiology)).toEqual([]);
  });

  it("with 3 cards already tucked the Response is not offered and the event stays in the discard pile", () => {
    const t = table(wonderManHeroGame(), 3, 3);
    const p = staged(t.state, ALTRUISM);
    const run = drive(p.state, p.command);
    expect(run.offered).toBeUndefined();
    expect(tuckedOf(run.state, t.physiology)).toEqual(t.fodder);
    expect(playerOf(run.state, P1).discard).toContain(p.id);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(3);
    expect(healed(run.events)).toEqual([]);
    expect(tuckLimitOf(run.state, WAVE10_DEPS, t.physiology)).toBe(3);
  });

  it("the fourth tuck is refused: with 2 tucked one more event fills it, the next is not offered and stays in the discard pile", () => {
    const t = table(wonderManHeroGame(), 2, 3);
    const first = staged(t.state, ALTRUISM);
    const one = drive(first.state, first.command);
    expect(tuckedOf(one.state, t.physiology)).toEqual([...t.fodder, first.id]);
    expect(inst(one.state, identityOf(one.state)).damage).toBe(2);
    const second = staged(one.state, ALTRUISM);
    const two = drive(second.state, second.command);
    expect(two.offered).toBeUndefined();
    expect(tuckedOf(two.state, t.physiology)).toEqual([...t.fodder, first.id]);
    expect(playerOf(two.state, P1).discard).toContain(second.id);
    expect(inst(two.state, identityOf(two.state)).damage).toBe(2);
    expect(healed(two.events)).toEqual([]);
  });

  /**
   * Plays `command` with plain commands (no session: `change` is surgery in the middle), answering every choice by
   * default except Ionic Physiology's Response, which is taken after `change` has altered the state it was offered in.
   */
  function driveChanging(state: GameState, command: Command, change: (s: GameState) => GameState) {
    const events: GameEvent[] = [];
    let offeredFrom: string | undefined;
    let current = state;
    const apply = (c: Command) => {
      const result = applyCommand(current, c, WAVE10_DEPS);
      if (!result.ok) throw new Error(`${c.type} rejected: ${result.error.code}: ${result.error.message}`);
      current = result.state;
      events.push(...result.events);
    };
    apply(command);
    for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
      if (guard > 60) throw new Error(`choices did not settle (${current.pendingChoice.prompt.kind})`);
      const choice = current.pendingChoice;
      const mine = choice.options.find((o) => JSON.stringify(o).includes(RESPONSE));
      const selected = mine ? [mine.optionId as string] : [...firstLegal(current)];
      if (mine) {
        offeredFrom = locateCard(current, (command as { cardInstanceId: InstanceId }).cardInstanceId)?.kind;
        current = change(current);
      }
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: selected as never,
      });
    }
    return { state: current, events, offeredFrom };
  }

  it("the event is in his discard pile when the Response is offered: that is where it is tucked from", () => {
    const t = table(wonderManHeroGame(), 0, 3);
    const p = staged(withThreat(t.state, 5), ALTRUISM);
    const run = driveChanging(p.state, p.command, (s) => s);
    expect(run.offeredFrom).toBe("discard");
    expect(tuckedOf(run.state, t.physiology)).toEqual([p.id]);
    expect(playerOf(run.state, P1).discard).not.toContain(p.id);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(2);
  });

  it("an event that left the discard pile before the Response resolves is not tucked, and nothing heals (RRG 1.8 \"'Then'\", p. 44)", () => {
    const t = table(wonderManHeroGame(), 0, 3);
    const p = staged(withThreat(t.state, 5), ALTRUISM);
    // Between the Response being chosen and its tuck, the event is shuffled back into his deck (surgery).
    const intoDeck = (s: GameState): GameState => ({
      ...s,
      players: s.players.map((seat) =>
        seat.playerId === P1
          ? { ...seat, discard: seat.discard.filter((id) => id !== p.id), deck: [p.id, ...seat.deck] }
          : seat,
      ),
    });
    const run = driveChanging(p.state, p.command, intoDeck);
    expect(run.offeredFrom).toBe("discard");
    expect(tuckedOf(run.state, t.physiology)).toEqual([]);
    expect(playerOf(run.state, P1).deck).toContain(p.id);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(3);
    expect(healed(run.events)).toEqual([]);
    expect(run.events.flatMap((e) => (e.type === "preThenUnresolved" ? [e.cause] : []))).toEqual(["tuckNamedNoCard"]);
    expect(run.events.filter((e) => e.type === "thenSkipped")).toHaveLength(1);
  });

  it("the script takes the event from its owner's discard pile, and keeps to a tuck and its Then (so the limit is judged)", () => {
    expect(WONDER_MAN_IDENTITY[RESPONSE]!.effects).toMatchObject([
      { kind: "tuckCards", cards: { kind: "ref", ref: { kind: "eventTarget" }, ownerZone: "discard" } },
      { kind: "then" },
    ]);
  });

  it("plain Response, no form named: the trigger carries no hero or alter-ego restriction, so it is heard in either form", () => {
    expect(WONDER_MAN_IDENTITY[RESPONSE]!.trigger).not.toHaveProperty("form");
    expect(WONDER_MAN_IDENTITY[LIMIT]!.trigger).toMatchObject({ kind: "constant" });
    // Simon Williams: the limit is in force in alter-ego form too (the upgrade stays in play).
    const simon = wonderManGame();
    expect(playerOf(simon, P1).identity.form).toBe("alterEgo");
    const [physiology] = instancesOf(simon, PHYSIOLOGY);
    expect(tuckRoom(simon, WAVE10_DEPS, physiology!)).toBe(3);
  });

  it("another player's energy event is not tucked: Spider-Man's Haymaker in a two-player game", () => {
    const game = twoPlayerGame();
    const physiology = instancesOf(game, PHYSIOLOGY)[0]!;
    const hurt = patchInstance(game, identityOf(game, P1), { damage: 3 });
    const p = staged(hurt, HAYMAKER, [], P2);
    const pay = playerOf(p.state, P2).deck.slice(0, 2);
    const paid = moveToHand(p.state, P2, ...pay.map((i) => codeOf(p.state, i)));
    const state: GameState = {
      ...paid.state,
      players: paid.state.players.map((pl) => (pl.playerId === P2 ? { ...pl, hand: [p.id, ...paid.ids] } : pl)),
    };
    const run = drive(state, play(P2, p.id, paid.ids));
    expect(run.offered).toBeUndefined();
    expect(tuckedOf(run.state, physiology)).toEqual([]);
    expect(playerOf(run.state, P2).discard).toContain(p.id);
    expect(inst(run.state, identityOf(run.state, P1)).damage).toBe(3);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(3);
  });
});

describe(`${ATK_CONSTANT}: Wonder Man gets +1 ATK for each card tucked under Ionic Physiology`, () => {
  it.each([0, 1, 3])("with %i tucked his ATK is 1 plus that many", (held) => {
    const t = table(wonderManHeroGame(), held);
    expect(hero(t.state).atk).toBe(1 + held);
  });

  it("a basic attack with 3 tucked deals exactly 4 damage to the villain", () => {
    const t = table(wonderManHeroGame(), 3);
    const run = drive(t.state, basicAttack(t.state));
    expect(inst(run.state, villainOf(run.state)).damage).toBe(4);
  });

  it("a basic attack with nothing tucked deals exactly 1", () => {
    const t = table(wonderManHeroGame(), 0);
    const run = drive(t.state, basicAttack(t.state));
    expect(inst(run.state, villainOf(run.state)).damage).toBe(1);
  });

  it("it is the hero face's: in alter-ego form the tucked cards add nothing to the hero stat", () => {
    const hero0 = table(wonderManHeroGame(), 2);
    expect(hero(hero0.state).atk).toBe(3);
    expect(WONDER_MAN_IDENTITY[ATK_CONSTANT]!.trigger).toMatchObject({ kind: "constant" });
  });
});

describe(`${FORCED}: Forced Response: after Wonder Man makes a basic attack, discard each card tucked under Ionic Physiology`, () => {
  it("after a basic attack with 3 tucked, all three go to the owner's discard pile and the bonus is gone", () => {
    const t = table(wonderManHeroGame(), 3);
    const run = drive(t.state, basicAttack(t.state));
    expect(inst(run.state, villainOf(run.state)).damage).toBe(4);
    expect(tuckedOf(run.state, t.physiology)).toEqual([]);
    for (const id of t.fodder) expect(playerOf(run.state, P1).discard).toContain(id);
    expect(hero(run.state).atk).toBe(1);
    expect(tuckRoom(run.state, WAVE10_DEPS, t.physiology)).toBe(3);
    expect(run.events.filter((e) => e.type === "abilityResolved" && e.abilityId === FORCED)).toHaveLength(1);
  });

  it("a basic attack with nothing tucked is fine and discards nothing", () => {
    const t = table(wonderManHeroGame(), 0);
    const before = playerOf(t.state, P1).discard.length;
    const run = drive(t.state, basicAttack(t.state));
    expect(playerOf(run.state, P1).discard).toHaveLength(before);
    expect(tuckedOf(run.state, t.physiology)).toEqual([]);
  });

  it("an event's attack is not a basic attack: Ionic Blast with 2 tucked leaves them (and tucks itself as the third)", () => {
    const t = table(wonderManHeroGame(), 2);
    const p = staged(t.state, BLAST, [ENERGY]);
    const run = drive(p.state, p.command);
    expect(tuckedOf(run.state, t.physiology)).toEqual([...t.fodder, p.id]);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(5);
  });

  it("Starstruck deals damage equal to his ATK, which counts the cards tucked before it: 2 tucked, 3 damage", () => {
    const t = table(wonderManHeroGame(), 2);
    const p = staged(t.state, STRUCK, [ENERGY]);
    const run = drive(p.state, p.command, { takeResponse: false });
    expect(inst(run.state, villainOf(run.state)).damage).toBe(3);
    expect(tuckedOf(run.state, t.physiology)).toEqual(t.fodder);
  });

  it("an energy event played during the basic attack is tucked before the discard, then discarded with the rest (March 6, 2026 - Ruling 4)", () => {
    // Haymaker-like timing is out of reach here; the ruling's order is exercised with the attack first, the event
    // second: the basic attack discards the two tucked cards, and the event played afterwards is tucked fresh.
    const t = table(wonderManHeroGame(), 2);
    const attacked = drive(t.state, basicAttack(t.state));
    expect(tuckedOf(attacked.state, t.physiology)).toEqual([]);
    const p = staged(attacked.state, ALTRUISM);
    const after = drive(p.state, p.command);
    expect(tuckedOf(after.state, t.physiology)).toEqual([p.id]);
    expect(hero(after.state).atk).toBe(2);
  });

  it("it is not offered as an ability of the alter-ego face: Simon Williams has no basic attack", () => {
    expect(offeredAbilities(wonderManGame())).not.toContain(FORCED);
  });
});
