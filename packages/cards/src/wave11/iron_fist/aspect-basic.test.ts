import { LUKE_CAGE_STARTER_DECKS, PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  handSize,
  legalActions,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { validateDefinition } from "../../dsl/validate.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { stagedInPlay } from "../../wave9/falcon/testing.js";
import { WAVE11_DEPS as DEPS } from "../index.js";
import { IRON_FIST_AGGRESSION, IRON_FIST_AGGRESSION_SKIPPED } from "./aggression.js";
import { IRON_FIST_BASIC, IRON_FIST_BASIC_SKIPPED } from "./basic.js";
import { IRON_FIST_LEADERSHIP, IRON_FIST_LEADERSHIP_SKIPPED } from "./leadership.js";
import { IRON_FIST_PROTECTION, IRON_FIST_PROTECTION_SKIPPED } from "./protection.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Iron Fist's aspect and basic cards (docs/phase7-elektra-iron-fist.md): Protection 64013, 64016, 64019, 64020;
 * basic 64022, 64023, 64025; Aggression 64030; Leadership 64031. (The reprints 64015, 64017, 64024 are in
 * `reprints.test.ts`.) Each card is played from a Core hero's deck, against Core's Rhino with Advance (boost 0) stacked.
 */
const PROTECTION_HERO = "core-black-panther-protection";
const AGGRESSION_HERO = "core-she-hulk-aggression";
const LEADERSHIP_HERO = "core-captain-marvel-leadership";
const BASIC_HERO = "core-spider-man-justice";
const ADVANCE = "01186"; // Core treachery, boost 0
const ENERGY = "01088";
const MARTIAL_ARTIST_ALLY = "64014"; // Iron Fist (Lin Lie), Martial Artist

const BYSTANDER = "64013";
const DEMORALIZE = "64016";
const BLEED = "64019";
const TONFA = "64020";
const LUKE_CAGE = "64022";
const PUNCH = "64023";
const DOJO = "64025";
const CUTS = "64030";
const ZEN = "64031";

const SCRIPTED = {
  protection: [
    "64013.helpful-bystander-constant",
    "64013.helpful-bystander-forced-interrupt",
    "64015.defiance-interrupt",
    "64016.demoralize-action",
    "64017.the-night-nurse-action",
    "64019.no-time-to-bleed-response",
    "64020.tonfa-interrupt",
  ],
  basic: [
    "64022.luke-cage-constant",
    "64023.punch-reverse-punch-action",
    "64024.power-man-and-iron-fist-action",
    "64025.thunder-dojo-action",
  ],
  aggression: ["64030.death-by-a-thousand-cuts-response"],
  leadership: ["64031.zen-like-calm-action"],
} as const;

function coreGame(
  code: string,
  hero: string,
  form: "hero" | "alterEgo" = "hero",
  twoPlayers = false,
): { state: GameState; id: InstanceId } {
  const second = coreScenario("rhino", { players: [{ starterDeckId: BASIC_HERO }], seed: 1 }).players[0]!;
  const first = buildCrossHeroDeck(PLAYABLE_CARDS, hero, code);
  const config = coreScenario("rhino", {
    players: twoPlayers ? [first, second] : [first],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(`${code}: ${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  const given = moveToHand(form === "hero" ? withForm(opened, { heroForm: 0 }) : opened, P1, code);
  return { state: stackEncounterDeck(given.state, ADVANCE, ADVANCE), id: given.ids[0]! };
}

/** Surgery: a deck card retagged as `code` and put into play (or attached to the identity), as `stagedInPlay` does. */
const inPlay = (s: GameState, code: string, opts: { attach?: boolean } = {}) => {
  const spare = playerOf(s, P1).deck.filter((i) => (inst(s, i).cardId as string) !== code);
  return stagedInPlay(patchInstance(s, spare[spare.length - 1]!, { cardId: cardId(code) }), code, opts);
};

/** Takes the wanted options (ids or labels) where offered, else the first legal answer. */
const taking =
  (...wanted: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    const hit = wanted.find((w) => ids.some((i) => i === w || i.endsWith(w)));
    if (hit !== undefined) return [ids.find((i) => i === hit || i.endsWith(hit))!];
    if (choice.prompt.kind === "discardDownToHandSize") return ids.slice(0, choice.minSelections);
    return firstLegal(s);
  };
const drive = (s: GameState, pick: Picker, ...commands: Command[]): GameState =>
  settle(runWith(DEPS, s, ...commands), pick, undefined, DEPS);
/** Every player ends their turn, whoever's it is, until the player phase is over. */
const villainPhase = (s: GameState, pick: Picker): GameState => {
  let state = s;
  for (let i = 0; i < s.players.length && state.step.phase === "player"; i++) {
    const step = state.step as { readonly activePlayerId?: PlayerId };
    state = drive(state, pick, endTurn(step.activePlayerId ?? P1));
  }
  return state;
};
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
/** Surgery: `n` hand cards (not `exclude`) become Core energy resources, each paying exactly one resource; returns the new state and them. */
const withEnergy = (s: GameState, n: number, ...exclude: InstanceId[]) => {
  const ids = playerOf(s, P1)
    .hand.filter((i) => !exclude.includes(i))
    .slice(0, n);
  if (ids.length < n) throw new Error("not enough cards to pay");
  return { state: ids.reduce((acc, i) => patchInstance(acc, i, { cardId: cardId(ENERGY) }), s), ids };
};

describe("registries", () => {
  it("script exactly the cards listed, skip only the unscripted ones, and every definition validates", () => {
    const registries = {
      protection: IRON_FIST_PROTECTION,
      basic: IRON_FIST_BASIC,
      aggression: IRON_FIST_AGGRESSION,
      leadership: IRON_FIST_LEADERSHIP,
    };
    for (const [name, registry] of Object.entries(registries)) {
      expect(Object.keys(registry).sort(), name).toEqual([...SCRIPTED[name as keyof typeof SCRIPTED]].sort());
      for (const id of Object.keys(registry)) expect(validateDefinition(registry[id]!), id).toEqual([]);
    }
    expect(Object.keys(IRON_FIST_PROTECTION_SKIPPED).sort()).toEqual([
      "64014.iron-fist-response",
      "64018.redirection-mastery-response",
    ]);
    expect(Object.keys(IRON_FIST_BASIC_SKIPPED).sort()).toEqual([
      "64021.colleen-wing-constant",
      "64033.the-defenders-constant",
    ]);
    expect(IRON_FIST_AGGRESSION_SKIPPED).toEqual({});
    expect(Object.keys(IRON_FIST_LEADERSHIP_SKIPPED)).toEqual(["64032.sensei-constant"]);
  });

  it("types each trigger as printed", () => {
    expect(IRON_FIST_PROTECTION["64013.helpful-bystander-forced-interrupt"]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
    });
    expect(IRON_FIST_PROTECTION["64016.demoralize-action"]!.trigger).toMatchObject({ kind: "action" });
    expect(IRON_FIST_PROTECTION["64019.no-time-to-bleed-response"]!.trigger).toMatchObject({
      kind: "response",
      forced: false,
    });
    expect(IRON_FIST_PROTECTION["64020.tonfa-interrupt"]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(IRON_FIST_BASIC["64025.thunder-dojo-action"]!.trigger).toMatchObject({ kind: "action" });
    expect(IRON_FIST_AGGRESSION["64030.death-by-a-thousand-cuts-response"]!.trigger).toMatchObject({
      kind: "response",
    });
  });
});

describe("64013 Helpful Bystander", () => {
  it("gives your hero +1 hand size while in play", () => {
    const { state } = coreGame(BYSTANDER, PROTECTION_HERO);
    const before = handSize(state, P1, DEPS);
    const staged = inPlay(state, BYSTANDER);
    expect(handSize(staged.state, P1, DEPS)).toBe(before + 1);
  });

  it("takes the attack that was aimed at you, with overkill: the excess damage reaches your hero", () => {
    const { state } = coreGame(BYSTANDER, PROTECTION_HERO);
    const staged = inPlay(state, BYSTANDER);
    const hero = identityOf(staged.state, P1);
    const after = villainPhase(staged.state, taking());
    // Rhino's attack (ATK 2, boost 0) hits the 1-hit-point ally: it is defeated and the 1 excess spills onto the hero.
    expect(playerOf(after, P1).discard).toContain(staged.id);
    expect(damageOf(after, hero)).toBe(1);
  });

  it("the redirected attack can still be defended (RRG 1.8 p. 10): your hero defends and the ally lives", () => {
    const { state } = coreGame(BYSTANDER, PROTECTION_HERO);
    const staged = inPlay(state, BYSTANDER);
    const hero = identityOf(staged.state, P1);
    const after = villainPhase(staged.state, taking(hero as string));
    expect(playerOf(after, P1).playArea).toContain(staged.id);
    expect(damageOf(after, staged.id)).toBe(0);
    expect(inst(after, hero).exhausted).toBe(true);
  });

  it("does not redirect another player's attack: P2 makes Rhino attack P2, and P1's ally is untouched", () => {
    const { state } = coreGame(BYSTANDER, PROTECTION_HERO, "hero", true);
    const staged = inPlay(state, BYSTANDER);
    const hero2 = identityOf(staged.state, P2);
    const p2Card = playerOf(staged.state, P2).hand[0]!;
    const ready = withForm(patchInstance(staged.state, p2Card, { cardId: cardId(DEMORALIZE) }), { heroForm: 0 }, P2);
    const after = drive(ready, taking(), play(P2, p2Card, []));
    expect(damageOf(after, hero2)).toBe(2);
    expect(damageOf(after, staged.id)).toBe(0);
    expect(playerOf(after, P1).playArea).toContain(staged.id);
  });
});

describe("64016 Demoralize", () => {
  it("makes the chosen enemy attack you, then confuses it", () => {
    const { state, id } = coreGame(DEMORALIZE, PROTECTION_HERO);
    const hero = identityOf(state, P1);
    const after = drive(state, taking(), play(P1, id, []));
    // The attack is against the hero: Rhino's 2 ATK (boost 0) undefended.
    expect(damageOf(after, hero)).toBe(2);
    expect(inst(after, villainOf(after)).statuses.confused).toBe(1);
  });
});

describe("64019 No Time to Bleed", () => {
  it("after you play a card, this one included, heals 1 damage from your identity", () => {
    const { state, id } = coreGame(BLEED, PROTECTION_HERO);
    const hero = identityOf(state, P1);
    const paid = withEnergy(patchInstance(state, hero, { damage: 3 }), 2, id);
    const after = drive(
      paid.state,
      taking("64019.no-time-to-bleed-response"),
      play(P1, id, paid.ids, { attachToInstanceId: hero }),
    );
    expect(inst(after, hero).attachments).toContain(id);
    expect(damageOf(after, hero)).toBe(2);
  });
});

describe("64020 Tonfa", () => {
  const DECLINED_DAMAGE = 2;
  const setup = () => {
    const { state } = coreGame(TONFA, PROTECTION_HERO);
    // Sandman (2 boost icons) is the boost card, so the attack is big enough for the hero's DEF to matter.
    const staged = inPlay(stackEncounterDeck(state, "01102"), TONFA, { attach: true });
    return { ...staged, hero: identityOf(staged.state, P1) };
  };
  /** Rhino attacks; the hero defends (so the DEF option matters); the player takes `option` at the damage step. */
  const attacked = (option: string | null) => {
    const { state, id, hero } = setup();
    const pick = taking(hero as string, ...(option ? ["64020.tonfa-interrupt", option] : []));
    return { id, hero, villain: villainOf(state), state: villainPhase(state, pick) };
  };

  it("declined, the attack deals its full damage and Tonfa stays ready", () => {
    const { state, id, hero } = attacked(null);
    expect(inst(state, id).exhausted).toBe(false);
    // Rhino 2 ATK + 2 boost icons, less Black Panther's DEF.
    expect(damageOf(state, hero)).toBe(DECLINED_DAMAGE);
  });

  it("with +1 DEF the hero takes 1 less damage than declined, and Tonfa exhausts", () => {
    const declined = attacked(null);
    const taken = attacked("+1 DEF for this attack");
    expect(inst(taken.state, taken.id).exhausted).toBe(true);
    expect(damageOf(declined.state, declined.hero)).toBe(DECLINED_DAMAGE);
    expect(damageOf(taken.state, taken.hero)).toBe(DECLINED_DAMAGE - 1);
  });

  it("with retaliate 1 the attacker takes 1 damage", () => {
    const taken = attacked("Retaliate 1 for this attack");
    expect(inst(taken.state, taken.id).exhausted).toBe(true);
    expect(damageOf(taken.state, taken.villain)).toBe(1);
  });
});

describe("64022 Luke Cage (ally)", () => {
  /** The Luke Cage hero precon (a Defender) with the ally swapped in for its first non-identity card. */
  function lukeCageGame(): GameState {
    const deck = LUKE_CAGE_STARTER_DECKS.find((d) => d.id === "luke-cage-leadership")!;
    const codes = deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id));
    const config = coreScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
      difficulty: "standard",
      modularSetIds: [],
      cardPool: PLAYABLE_CARDS,
    } as never);
    const seat = { identityCardId: deck.identityCardId, aspects: deck.aspects, deck: codes };
    const created = createGame({ ...config, players: [seat] }, DEPS);
    if (!created.ok) throw new Error(created.error.message);
    return withForm(
      settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS),
      { heroForm: 0 },
    );
  }

  it("gives your hero +1 DEF if it shares a trait with him (a Defender hero), and not otherwise", () => {
    const luke = lukeCageGame();
    const hero = identityOf(luke, P1);
    const base = characterProfile(luke, hero, DEPS)!.def;
    const staged = inPlay(luke, LUKE_CAGE);
    expect(characterProfile(staged.state, hero, DEPS)!.def).toBe(base + 1);

    const { state } = coreGame(LUKE_CAGE, BASIC_HERO);
    const spider = identityOf(state, P1);
    const spiderBase = characterProfile(state, spider, DEPS)!.def;
    const withAlly = inPlay(state, LUKE_CAGE);
    // Spider-Man shares no trait with a Defender / Hero for Hire.
    expect(characterProfile(withAlly.state, spider, DEPS)!.def).toBe(spiderBase);
  });

  it("is a Toughness ally: the status card comes with the play", () => {
    const { state, id } = coreGame(LUKE_CAGE, BASIC_HERO);
    const paid = withEnergy(state, 4, id);
    const after = drive(paid.state, taking(), play(P1, id, paid.ids));
    expect(inst(after, id).statuses.tough).toBe(1);
  });
});

describe("64023 Punch, Reverse Punch", () => {
  it("deals 1 damage to an enemy twice (both may name the same one)", () => {
    const { state, id } = coreGame(PUNCH, BASIC_HERO);
    const villain = villainOf(state);
    const paid = withEnergy(state, 1, id);
    const after = drive(paid.state, taking(villain as string), play(P1, id, paid.ids));
    expect(damageOf(after, villain)).toBe(2);
  });
});

describe("64025 Thunder Dojo", () => {
  it("shuffles up to 2 Attack events from the discard pile into the deck (alter-ego action)", () => {
    const { state, id } = coreGame(DOJO, BASIC_HERO, "alterEgo");
    const dojo = inPlay(state, DOJO);
    const hand = playerOf(dojo.state, P1)
      .hand.filter((i) => i !== id)
      .slice(0, 3);
    // Three Attack events: copies of Punch, Reverse Punch.
    const retagged = hand.reduce((s, h) => patchInstance(s, h, { cardId: cardId(PUNCH) }), dojo.state);
    const discarded: GameState = {
      ...retagged,
      players: retagged.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((i) => !hand.includes(i)), discard: [...p.discard, ...hand] }
          : p,
      ),
    };
    const deckBefore = playerOf(discarded, P1).deck.length;
    const after = drive(discarded, taking(), use(P1, dojo.id, "64025.thunder-dojo-action"));
    expect(inst(after, dojo.id).exhausted).toBe(true);
    // "Up to 2": declining every card is legal.
    expect(playerOf(after, P1).deck.length).toBe(deckBefore);
    const both: Picker = (st) => {
      const choice = st.pendingChoice!;
      const ids = choice.options.map((o) => o.optionId as string);
      const hits = ids.filter((i) => hand.slice(0, 2).some((h) => i === h || i.endsWith(h)));
      return choice.prompt.kind === "chooseCards" ? hits.slice(0, choice.maxSelections) : firstLegal(st);
    };
    const two = drive(discarded, both, use(P1, dojo.id, "64025.thunder-dojo-action"));
    expect(playerOf(two, P1).deck.length).toBe(deckBefore + 2);
    expect(playerOf(two, P1).discard).toEqual([hand[2]]);
  });
});

describe("64025 Thunder Dojo, used by another player", () => {
  const DOJO_REF = "64025.thunder-dojo-action";
  /** P1's Dojo in play; P2 has 2 Attack events in their discard pile. P2 (first to act) is in alter-ego form. */
  const setup = () => {
    const { state } = coreGame(DOJO, PROTECTION_HERO, "alterEgo", true);
    const dojo = inPlay(state, DOJO);
    const events = playerOf(dojo.state, P2).hand.slice(0, 2);
    const retagged = events.reduce((acc, e) => patchInstance(acc, e, { cardId: cardId(PUNCH) }), dojo.state);
    const prepared: GameState = {
      ...retagged,
      players: retagged.players.map((p) =>
        p.playerId === P2
          ? { ...p, hand: p.hand.filter((i) => !events.includes(i)), discard: [...p.discard, ...events] }
          : p,
      ),
    };
    return { state: prepared, dojo: dojo.id, events };
  };
  const bothEvents =
    (events: readonly InstanceId[]): Picker =>
    (st) => {
      const choice = st.pendingChoice!;
      const ids = choice.options.map((o) => o.optionId as string);
      const hits = ids.filter((i) => events.some((e) => i === e || i.endsWith(e)));
      return choice.prompt.kind === "chooseCards" ? hits.slice(0, choice.maxSelections) : firstLegal(st);
    };

  it("a second player in alter-ego form uses their own discard pile and deck", () => {
    const { state, dojo, events } = setup();
    const p1Deck = playerOf(state, P1).deck.length;
    const p2Deck = playerOf(state, P2).deck.length;
    const after = drive(state, bothEvents(events), use(P2, dojo, DOJO_REF));
    expect(inst(after, dojo).exhausted).toBe(true);
    expect(playerOf(after, P2).deck.length).toBe(p2Deck + 2);
    expect(playerOf(after, P2).discard).toEqual([]);
    expect(playerOf(after, P1).deck.length).toBe(p1Deck);
  });

  it("is refused while that player is in hero form (an Alter-Ego Action)", () => {
    const { state, dojo } = setup();
    const hero = withForm(state, { heroForm: 0 }, P2);
    expect(applyCommand(hero, use(P2, dojo, DOJO_REF), DEPS).ok).toBe(false);
  });
});

describe("64030 Death by a Thousand Cuts", () => {
  it("after you play a card, this one included, makes an attack for 1 damage to an enemy", () => {
    const { state, id } = coreGame(CUTS, AGGRESSION_HERO);
    const hero = identityOf(state, P1);
    const villain = villainOf(state);
    const paid = withEnergy(state, 2, id);
    const after = drive(
      paid.state,
      taking("64030.death-by-a-thousand-cuts-response", villain as string),
      play(P1, id, paid.ids, { attachToInstanceId: hero }),
    );
    expect(inst(after, hero).attachments).toContain(id);
    expect(damageOf(after, villain)).toBe(1);
  });
});

describe("64031 Zen-Like Calm", () => {
  const setup = (allyDamage: number) => {
    const { state, id } = coreGame(ZEN, LEADERSHIP_HERO);
    const ally = inPlay(state, MARTIAL_ARTIST_ALLY);
    const hero = identityOf(ally.state, P1);
    const hurt = patchInstance(patchInstance(ally.state, ally.id, { damage: allyDamage }), hero, { damage: 2 });
    return { state: hurt, id, ally: ally.id, hero };
  };

  it("heals 1 from a Martial Artist; if that leaves no damage, heals 1 from another character", () => {
    const { state, id, ally, hero } = setup(1);
    const after = drive(state, taking(ally as string, hero as string), play(P1, id, []));
    expect(damageOf(after, ally)).toBe(0);
    expect(damageOf(after, hero)).toBe(1);
  });

  it("with damage left on the Martial Artist, heals nothing else", () => {
    const { state, id, ally, hero } = setup(2);
    const after = drive(state, taking(ally as string, hero as string), play(P1, id, []));
    expect(damageOf(after, ally)).toBe(1);
    expect(damageOf(after, hero)).toBe(2);
  });

  it("an undamaged Martial Artist is not a valid target: with none damaged the card cannot be played", () => {
    const { state, id } = setup(0);
    // Captain Marvel and the ally are both hurt or not, but no Martial Artist has damage: only the ally has the trait.
    const actions = legalActions(state, P1, DEPS);
    expect(
      actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id),
    ).toBe(false);
  });
});
