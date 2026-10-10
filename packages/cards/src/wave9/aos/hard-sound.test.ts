import { cardId } from "@mc/content";
import { activeEncounterDeckId, keywordsOf, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
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
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import {
  BLANK,
  CAPTAIN_MARVEL,
  CHARGE,
  FILLER_A,
  FILLER_B,
  ONE_ICON,
  SHE_HULK,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  dataOf,
  heroAttacks as sharedHeroAttacks,
  heroForm,
  inDiscard,
  inPlayCard,
  onlyDeck,
  revealedCodes,
  schemesBy,
  setKit,
  stunWith,
  types,
  without,
} from "../testing.js";
import { HARD_SOUND, HARD_SOUND_SKIPPED } from "./hard-sound.js";
import { MODOK } from "./modok.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Hard Sound set (50143 Songbird, 50144 Solid Sound Constructs, 50145 Hard Sound Bindings, 50146 Sonic Bubble,
 * 50147 Hard Sound), docs/phase7-wave9.md sections 3.25, 3.33 and 3.35. Rhino (Core, standard) against Core starter
 * decks, the set's cards added to the encounter deck by hand and put into play by surgery where a test needs a state
 * rather than a reveal.
 *
 * Songbird has no stalwart of her own: the stalwart tests give it to her with Psionic Force Field (50117, M.O.D.O.K.'s
 * attachment, which grants it to its host), so that module's registry is merged in. No card in reach stuns or confuses
 * an enemy from the encounter deck, so "given by an encounter card" is covered by the engine's own
 * status-being-given.test.ts; here the givers are player cards (Mockingbird's stun, Spider-Woman's confuse).
 */
const SONGBIRD = "50143";
const CONSTRUCTS = "50144";
const BINDINGS = "50145";
const BUBBLE = "50146";
const HARD_SOUND_CARD = "50147";
const FORCE_FIELD = "50117";
const SET = [SONGBIRD, CONSTRUCTS, BINDINGS, BUBBLE, HARD_SOUND_CARD];
const REFS = [
  "50143.songbird-forced-interrupt",
  "50144.solid-sound-constructs-constant",
  "50144.solid-sound-constructs-forced-interrupt",
  "50145.hard-sound-bindings-forced-interrupt",
  "50145.boost",
  "50146.sonic-bubble-forced-interrupt",
  "50147.when-revealed",
  "50147.boost",
];
const SPIDER_WOMAN = "01011";
/** `n` boost cards that add nothing (Advance, Hard to Keep Down, "I'm Tough!", Assault; two copies each). */
const blanks = (n: number) => ["01186", "01186", "01104", "01104", "01105", "01105", "01187", "01187"].slice(0, n);

const { deps: DEPS, setupGame, villainPhase } = setKit("hard_sound", mergeRegistries(HARD_SOUND, MODOK));
const heroAttacks = (state: GameState, target: InstanceId, player: PlayerId = P1) =>
  sharedHeroAttacks(DEPS, state, target, { player });
const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
const engagedWith = (s: GameState, code: string) => inst(s, inPlayCard(s, code)!).engagedWith;
const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
const stalwart = (s: GameState, id: InstanceId) => keywordsOf(s, id, DEPS).some((k) => k.name === "stalwart");
const stunnedOn = (s: GameState, id: InstanceId) => inst(s, id).statuses.stunned;
const confusedOn = (s: GameState, id: InstanceId) => inst(s, id).statuses.confused;
const ready = (s: GameState, id: InstanceId) => patchInstance(s, id, { exhausted: false });
const attachedCodes = (s: GameState, host: InstanceId) => inst(s, host).attachments.map((a) => codeOf(s, a));

/** The first copy of `code` in the encounter deck or discard pile attached to `host` (by surgery), faceup. */
function attachTo(
  state: GameState,
  code: string,
  host: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: host },
        [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
      },
    },
  };
}

/**
 * A Psionic Force Field (a clone of an instance already in the game, so the deck holds no extra) attached to `host`: it
 * gives the host stalwart.
 */
function withStalwart(state: GameState, host: InstanceId): { readonly state: GameState; readonly id: InstanceId } {
  const donor = Object.keys(state.instances).find((i) => codeOf(state, i as InstanceId) === BINDINGS) as InstanceId;
  const id = "force-field-clone" as InstanceId;
  const base = patchInstance(state, donor, {});
  return {
    id,
    state: {
      ...base,
      instances: {
        ...base.instances,
        [id]: { ...base.instances[donor]!, cardId: cardId(FORCE_FIELD), faceup: true, attachedTo: host },
        [host]: { ...base.instances[host]!, attachments: [...base.instances[host]!.attachments, id] },
      },
    },
  };
}

/** Songbird engaged with player 1 (hero form), Solid Sound Constructs on her. */
function constructed(players: typeof TWO | undefined = undefined) {
  const base = heroForm(setupGame(players ?? [SPIDER_MAN]));
  const { state: engaged, id: songbird } = engageMinion(base, SONGBIRD, P1);
  const { state, id: constructs } = attachTo(engaged, CONSTRUCTS, songbird);
  return { state, songbird, constructs };
}

/** Spider-Woman (Captain Marvel's ally, cost 3) played by player 1: her response confuses the villain. */
function confuseVillain(state: GameState) {
  const given = moveToHand(state, P1, SPIDER_WOMAN);
  const [id] = given.ids as [InstanceId];
  const pay = payWith(given.state, P1, 3, [id]);
  return driveEventsPicking(
    DEPS,
    given.state,
    (s) => {
      const choice = s.pendingChoice!;
      const take = choice.options.find((o) => o.optionId !== "decline" && o.optionId.includes("spider-woman"));
      return take ? [take.optionId] : firstLegal(s);
    },
    play(P1, id, pay),
  );
}

describe("registry", () => {
  it("registers the eight refs of the five cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(HARD_SOUND).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(HARD_SOUND)) expect(validateDefinition(def), id).toEqual([]);
    expect(HARD_SOUND_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("attachment data: Constructs attaches to Songbird, otherwise the villain; Bindings to your identity", () => {
    expect(dataOf(CONSTRUCTS).attachesTo).toEqual({
      kind: "ifAble",
      preferred: { kind: "namedCard", name: "Songbird" },
      otherwise: { kind: "villain" },
    });
    expect(dataOf(BINDINGS).attachesTo).toEqual({ kind: "yourIdentity" });
  });

  it("setup: all six encounter copies (1 each, 2 Hard Sound) are in the deck", () => {
    const s = setupGame();
    const deck = s.encounterDecks[Object.keys(s.encounterDecks)[0]!]!.deck;
    expect(SET.map((code) => deck.filter((id) => codeOf(s, id) === code).length)).toEqual([1, 1, 1, 1, 2]);
  });
});

describe("Songbird (50143)", () => {
  it("is data: an Elite Thunderbolt Aerial unique minion, ATK 0, SCH 0, 16 hit points, 4 boost icons, Villainous, Victory 1", () => {
    const card = dataOf(SONGBIRD);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([
      "minion",
      0,
      0,
      16,
      4,
      true,
    ]);
    expect(card.traits).toEqual(["AERIAL", "ELITE", "THUNDERBOLT"]);
    expect(card.keywords).toEqual([{ name: "villainous" }, { name: "victory", value: 1 }]);
  });

  it("FORCED INTERRUPT (attack): she gets 1 additional boost card, so two cards' icons (1 + 2) add to her 0 ATK: 3 damage", () => {
    const { state } = engageMinion(heroForm(setupGame()), SONGBIRD, P1);
    // Rhino's boost, then Songbird's two (one icon each), then the card dealt to the player.
    const run = villainPhase(state, [BLANK, ONE_ICON, CHARGE, FILLER_A]);
    expect(attacksBy(run.state, run.events, SONGBIRD)).toMatchObject([{ baseAtk: 0, boostIcons: 3, damageDealt: 3 }]);
    expect(types(run.events, "boostCardFlipped")).toHaveLength(3);
  });

  it("FORCED INTERRUPT (scheme): the same extra card on her scheme: SCH 0 + 3 icons = 3 threat on the main scheme", () => {
    const { state } = engageMinion(setupGame(), SONGBIRD, P1);
    const run = villainPhase(state, [BLANK, ONE_ICON, CHARGE, FILLER_A]);
    expect(schemesBy(run.state, run.events, SONGBIRD)).toMatchObject([{ baseSch: 0, boostIcons: 3, threatPlaced: 3 }]);
    expect(types(run.events, "boostCardFlipped")).toHaveLength(3);
  });

  it("only her own activation gets the extra card: Rhino alone turns one boost card", () => {
    const run = villainPhase(heroForm(setupGame()), [ONE_ICON, FILLER_A]);
    expect(types(run.events, "boostCardFlipped")).toHaveLength(1);
  });

  it("has 16 hit points: a hero's attack of 2 leaves her with 2 damage", () => {
    const { state, id } = engageMinion(heroForm(setupGame()), SONGBIRD, P1);
    const run = heroAttacks(state, id);
    expect(inst(run.state, id).damage).toBe(2);
  });
});

describe("Solid Sound Constructs (50144)", () => {
  it("is data: a Weapon attachment with 1 amplify icon and 2 boost icons, no keywords", () => {
    const card = dataOf(CONSTRUCTS);
    expect([card.type, card.amplifyIcons, card.boostIcons, card.traits, card.keywords]).toEqual([
      "attachment",
      1,
      2,
      ["WEAPON"],
      [],
    ]);
  });

  it("REVEALED with Songbird in play it attaches to her", () => {
    const { state } = engageMinion(heroForm(setupGame()), SONGBIRD, P1);
    const run = villainPhase(state, [...blanks(3), CONSTRUCTS]);
    const songbird = inPlayCard(run.state, SONGBIRD)!;
    expect(attachedCodes(run.state, songbird)).toEqual([CONSTRUCTS]);
  });

  it("REVEALED with Songbird not in play it attaches to the villain", () => {
    const run = villainPhase(heroForm(setupGame()), [BLANK, CONSTRUCTS, FILLER_A]);
    expect(attachedCodes(run.state, villainOf(run.state))).toContain(CONSTRUCTS);
  });

  it("CONSTANT: attached, she loses the stalwart a Psionic Force Field gives her", () => {
    const { state: engaged, id: songbird } = engageMinion(heroForm(setupGame()), SONGBIRD, P1);
    const field = withStalwart(engaged, songbird);
    expect(stalwart(field.state, songbird)).toBe(true);
    const { state } = attachTo(field.state, CONSTRUCTS, songbird);
    expect(stalwart(state, songbird)).toBe(false);
  });

  it("FORCED INTERRUPT: a stun from a player card is replaced by discarding the attachment; she is not stunned", () => {
    const { state, songbird, constructs } = constructed();
    const run = stunWith(DEPS, state, songbird);
    expect(stunnedOn(run.state, songbird)).toBe(0);
    expect(attachedCodes(run.state, songbird)).toEqual([]);
    expect(inDiscard(run.state, CONSTRUCTS)).toEqual([constructs]);
  });

  it("FORCED INTERRUPT: with stalwart from another card, discarding Constructs restores it: the next stun does nothing", () => {
    const { state: staged, songbird } = constructed();
    const { state } = withStalwart(staged, songbird);
    expect(stalwart(state, songbird)).toBe(false);
    const first = stunWith(DEPS, state, songbird);
    expect(stunnedOn(first.state, songbird)).toBe(0);
    expect(attachedCodes(first.state, songbird)).toEqual([FORCE_FIELD]);
    expect(stalwart(first.state, songbird)).toBe(true);
    // A second stun: stalwart again, nothing is placed and nothing is discarded.
    // Mockingbird goes back to the discard pile (by surgery) so the same stun can be played again.
    const bird = Object.keys(first.state.instances).find((i) => codeOf(first.state, i as InstanceId) === "01083")!;
    const recycled = {
      ...first.state,
      players: first.state.players.map((p) => ({
        ...p,
        playArea: p.playArea.filter((i) => i !== bird),
        discard: p.playerId === P1 ? [...p.discard, bird as InstanceId] : p.discard,
      })),
    };
    const second = stunWith(DEPS, recycled, songbird);
    expect(stunnedOn(second.state, songbird)).toBe(0);
    expect(inDiscard(second.state, CONSTRUCTS)).toHaveLength(1);
    expect(stalwart(second.state, songbird)).toBe(true);
  });

  it("FORCED INTERRUPT: a confuse is replaced the same way (Spider-Woman confuses the villain, who carries the attachment)", () => {
    const base = heroForm(setupGame([CAPTAIN_MARVEL]));
    const { state, id } = attachTo(base, CONSTRUCTS, villainOf(base));
    const run = confuseVillain(state);
    expect(confusedOn(run.state, villainOf(run.state))).toBe(0);
    expect(attachedCodes(run.state, villainOf(run.state))).toEqual([]);
    expect(inDiscard(run.state, CONSTRUCTS)).toEqual([id]);
  });

  it("without the attachment the same stun lands (control)", () => {
    const { state, id: songbird } = engageMinion(heroForm(setupGame()), SONGBIRD, P1);
    const run = stunWith(DEPS, state, songbird);
    expect(stunnedOn(run.state, songbird)).toBe(1);
  });

  it("an enemy already stunned opens no window: the attachment stays", () => {
    const { state, songbird } = constructed();
    const stunned = patchInstance(state, songbird, { statuses: { ...inst(state, songbird).statuses, stunned: 1 } });
    const run = stunWith(DEPS, stunned, songbird);
    expect(stunnedOn(run.state, songbird)).toBe(1);
    expect(attachedCodes(run.state, songbird)).toEqual([CONSTRUCTS]);
  });

  it("BOOST: 2 icons add to the attack of the enemy it is turned for (Rhino ATK + 2)", () => {
    const run = villainPhase(heroForm(setupGame()), [CONSTRUCTS, FILLER_A]);
    const [attack] = attacksBy(run.state, run.events, "01094");
    expect(attack).toMatchObject({ boostIcons: 2 });
  });
});

describe("Hard Sound Bindings (50145)", () => {
  /** Player 1's hero with the Bindings on their identity. */
  function bound(players: readonly (typeof SPIDER_MAN)[] = [SPIDER_MAN]) {
    const base = heroForm(setupGame(players));
    const { state, id } = attachTo(base, BINDINGS, identityOf(base, P1));
    return { state, id };
  }

  it("is data: an attachment with 1 boost icon and a star, no amplify icon", () => {
    const card = dataOf(BINDINGS);
    expect([card.type, card.boostIcons, card.starIcon, card.amplifyIcons]).toEqual(["attachment", 1, true, undefined]);
  });

  it("REVEALED it attaches to the identity of the player it was dealt to", () => {
    const run = villainPhase(heroForm(setupGame()), [BLANK, BINDINGS, FILLER_A]);
    expect(attachedCodes(run.state, identityOf(run.state, P1))).toContain(BINDINGS);
  });

  it("FORCED INTERRUPT: the identity's attack is replaced: the Bindings are discarded and you are stunned; the target takes nothing", () => {
    const { state, id } = bound();
    const { state: engaged, id: target } = engageMinion(state, SONGBIRD, P1);
    const run = heroAttacks(engaged, target);
    expect(inst(run.state, target).damage).toBe(0);
    expect(stunnedOn(run.state, identityOf(run.state, P1))).toBe(1);
    expect(attachedCodes(run.state, identityOf(run.state, P1))).toEqual([]);
    expect(inDiscard(run.state, BINDINGS)).toEqual([id]);
  });

  it("FORCED INTERRUPT: with the Bindings gone a later attack is not replaced (control, stun removed by hand)", () => {
    const { state } = bound();
    const { state: engaged, id: target } = engageMinion(state, SONGBIRD, P1);
    const first = heroAttacks(engaged, target);
    const hero = identityOf(first.state, P1);
    const cleared = patchInstance(first.state, hero, { statuses: { ...inst(first.state, hero).statuses, stunned: 0 } });
    const second = heroAttacks(ready(cleared, hero), target);
    expect(inst(second.state, target).damage).toBe(2);
  });

  it("it is the player's own identity: player 2's attack is not replaced", () => {
    const base = heroForm(setupGame(TWO), P1, P2);
    const { state } = attachTo(base, BINDINGS, identityOf(base, P1));
    const { state: engaged, id: target } = engageMinion(state, SONGBIRD, P2);
    const turn = driveEventsPicking(DEPS, engaged, firstLegal, endTurn(P1));
    const run = heroAttacks(turn.state, target, P2);
    expect(inst(run.state, target).damage).toBeGreaterThan(0);
    expect(attachedCodes(run.state, identityOf(run.state, P1))).toEqual([BINDINGS]);
  });

  it("BOOST: Rhino's attack turns it: the hero is stunned, and Rhino gets no extra card (not already stunned)", () => {
    const run = villainPhase(heroForm(setupGame()), [BINDINGS, ONE_ICON, FILLER_A]);
    expect(stunnedOn(run.state, identityOf(run.state, P1))).toBe(1);
    expect(types(run.events, "boostCardFlipped")).toHaveLength(1);
    expect(attacksBy(run.state, run.events, "01094")).toMatchObject([{ boostIcons: 1 }]);
  });

  it("BOOST: a hero already stunned stays stunned (one status card) and Rhino gets one additional boost card", () => {
    const base = heroForm(setupGame());
    const hero = identityOf(base, P1);
    const state = patchInstance(base, hero, { statuses: { ...inst(base, hero).statuses, stunned: 1 } });
    const run = villainPhase(state, [BINDINGS, ONE_ICON, FILLER_A]);
    expect(stunnedOn(run.state, hero)).toBe(1);
    expect(types(run.events, "boostCardFlipped")).toHaveLength(2);
    expect(attacksBy(run.state, run.events, "01094")).toMatchObject([{ boostIcons: 2 }]);
  });
});

describe("Sonic Bubble (50146)", () => {
  it("is data: a side scheme with 3 threat per player (none fixed), the crisis icon, 2 boost icons", () => {
    const card = dataOf(BUBBLE);
    expect([card.type, card.startingThreat, card.icons, card.boostIcons]).toEqual([
      "side_scheme",
      { base: 0, perPlayer: 3 },
      ["crisis"],
      2,
    ]);
  });

  it("revealed it has 3 threat with one player and 6 with two", () => {
    const one = villainPhase(setupGame(), [BLANK, BUBBLE, FILLER_A]);
    expect(inst(one.state, inPlayCard(one.state, BUBBLE)!).threat).toBe(3);
    const two = villainPhase(setupGame(TWO), [BLANK, BLANK, BUBBLE, FILLER_A, FILLER_B]);
    expect(inst(two.state, inPlayCard(two.state, BUBBLE)!).threat).toBe(6);
  });

  it("FORCED INTERRUPT: a 2 damage attack on a minion removes 2 threat instead; the minion takes none", () => {
    const { state: engaged, id: target } = engageMinion(heroForm(setupGame()), SONGBIRD, P1);
    const { state, id: bubble } = encounterCardInVillainArea(engaged, BUBBLE, 3);
    const run = heroAttacks(state, target);
    expect(inst(run.state, target).damage).toBe(0);
    expect(inst(run.state, bubble).threat).toBe(1);
  });

  it("FORCED INTERRUPT: the villain is protected too: threat 3, a 2 damage attack, the villain takes 0", () => {
    const { state, id: bubble } = encounterCardInVillainArea(heroForm(setupGame()), BUBBLE, 3);
    const run = heroAttacks(state, villainOf(state));
    expect(inst(run.state, villainOf(run.state)).damage).toBe(0);
    expect(inst(run.state, bubble).threat).toBe(1);
  });

  it("FORCED INTERRUPT: more damage than threat: a 4 damage attack with 3 threat removes all 3, the enemy takes 0, the scheme is defeated", () => {
    const { state: engaged, id: target } = engageMinion(heroForm(setupGame([SHE_HULK])), SONGBIRD, P1);
    const { state, id: bubble } = encounterCardInVillainArea(engaged, BUBBLE, 3);
    const run = heroAttacks(state, target);
    expect(inst(run.state, target).damage).toBe(0);
    expect(inPlayCard(run.state, BUBBLE)).toBeUndefined();
    expect(inDiscard(run.state, BUBBLE)).toEqual([bubble]);
  });

  it("FORCED INTERRUPT: threat equal to the damage: a 2 damage attack on 2 threat removes it, the enemy takes 0, defeated", () => {
    const { state: engaged, id: target } = engageMinion(heroForm(setupGame()), SONGBIRD, P1);
    const { state } = encounterCardInVillainArea(engaged, BUBBLE, 2);
    const run = heroAttacks(state, target);
    expect(inst(run.state, target).damage).toBe(0);
    expect(inPlayCard(run.state, BUBBLE)).toBeUndefined();
  });

  it("with no threat left (defeated) the next attack lands in full", () => {
    const { state: engaged, id: target } = engageMinion(heroForm(setupGame()), SONGBIRD, P1);
    const { state } = encounterCardInVillainArea(engaged, BUBBLE, 2);
    const first = heroAttacks(state, target);
    const second = heroAttacks(ready(first.state, identityOf(first.state, P1)), target);
    expect(inst(second.state, target).damage).toBe(2);
  });

  it("damage to a hero is not replaced: Rhino's attack lands and the threat stays", () => {
    const { state, id: bubble } = encounterCardInVillainArea(heroForm(setupGame()), BUBBLE, 3);
    const run = villainPhase(state, [BLANK, FILLER_A]);
    expect(attacksBy(run.state, run.events, "01094")[0]!.damageDealt).toBeGreaterThan(0);
    expect(inst(run.state, bubble).threat).toBe(3);
  });

  it("it is removed by thwarting like any side scheme: a basic thwart of 1 removes 1 threat", () => {
    const { state, id: bubble } = encounterCardInVillainArea(setupGame(), BUBBLE, 3);
    const run = driveEventsPicking(DEPS, heroForm(state), firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(state, P1),
      schemeInstanceId: bubble,
    });
    expect(inst(run.state, bubble).threat).toBe(2);
  });
});

describe("Hard Sound (50147)", () => {
  it("is data: a treachery with 1 boost icon and a star, two copies", () => {
    const card = dataOf(HARD_SOUND_CARD);
    expect([card.type, card.boostIcons, card.starIcon, card.quantityInSet, card.keywords]).toEqual([
      "treachery",
      1,
      true,
      2,
      [],
    ]);
  });

  it("WHEN REVEALED (alter-ego): Songbird is found and engages the revealing player, then schemes: 0 + 3 icons on her two boost cards = 3 threat; no surge", () => {
    const run = villainPhase(onlyDeck(setupGame(), BLANK, HARD_SOUND_CARD, SONGBIRD, ONE_ICON, CHARGE), []);
    expect(engagedWith(run.state, SONGBIRD)).toBe(P1);
    expect(schemesBy(run.state, run.events, SONGBIRD)).toMatchObject([{ baseSch: 0, boostIcons: 3, threatPlaced: 3 }]);
    expect(revealedCodes(run.state, run.events)).toEqual([HARD_SOUND_CARD, SONGBIRD]);
    expect(inDiscard(run.state, HARD_SOUND_CARD)).toHaveLength(1);
  });

  it("WHEN REVEALED (hero): Songbird attacks the revealing player: ATK 0 + 3 icons = 3 damage", () => {
    const run = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, HARD_SOUND_CARD, SONGBIRD, ONE_ICON, CHARGE), []);
    expect(attacksBy(run.state, run.events, SONGBIRD)).toMatchObject([{ baseAtk: 0, boostIcons: 3, damageDealt: 3 }]);
  });

  it("WHEN REVEALED: with Songbird in play engaged with player 2, she engages the revealing player 1 and schemes against them", () => {
    const { state: engaged } = engageMinion(setupGame(TWO), SONGBIRD, P2);
    // Rhino x2 and Songbird's own scheme each turn boost cards (hers two); player 1 is dealt the treachery.
    const run = villainPhase(onlyDeck(engaged, ...blanks(4), HARD_SOUND_CARD, FILLER_A, ONE_ICON), []);
    expect(engagedWith(run.state, SONGBIRD)).toBe(P1);
  });

  it("WHEN REVEALED: with no Songbird anywhere nothing activates and this card gains surge: the next card is revealed", () => {
    const run = villainPhase(onlyDeck(without(setupGame(), SONGBIRD), BLANK, HARD_SOUND_CARD, FILLER_A), []);
    expect(inPlayCard(run.state, SONGBIRD)).toBeUndefined();
    expect(revealedCodes(run.state, run.events)).toEqual([HARD_SOUND_CARD, FILLER_A]);
  });

  it("BOOST: the activating enemy gets an additional boost card: Rhino's attack counts two cards' icons", () => {
    const run = villainPhase(heroForm(setupGame()), [HARD_SOUND_CARD, ONE_ICON, FILLER_A]);
    expect(types(run.events, "boostCardFlipped")).toHaveLength(2);
    expect(attacksBy(run.state, run.events, "01094")).toMatchObject([{ boostIcons: 2 }]);
  });
});
