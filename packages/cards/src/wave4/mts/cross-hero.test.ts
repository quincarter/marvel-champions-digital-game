import { CORE_STARTER_DECKS, PLAYABLE_CARDS, type AnyCard, type CardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeVillain,
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  handCardResources,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  putOnTopOfDeck,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, moveToDiscard } from "../../testing/staging.js";
import { engageMinion } from "../../wave3/drax/support.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Mad Titan's
 * Shadow (`mts`) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:<id>` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only that hero's deck could hold) —
 * played through the engine from a Core hero's own precon instead of Spectrum's or Adam Warlock's.
 *
 * Covered, from Captain Marvel (Leadership): 21011 Captain America, 21012 Power Man (also in alter-ego form), 21013
 * White Tiger (printed plain Response, also in alter-ego form), 21014 Kaluu, 21015 Mighty Avengers, 21016 Mass Attack,
 * 21017 Moxie, 21018 Band Together, 21053 Major Victory, 21054 Eternity, 21056 Make the Call, 21057 Inspired, 21058
 * Innovation. From Spider-Man (Justice and basic): 21047 Quasar, 21048 Living Tribunal, 21049 For Justice!, 21051 Heroic
 * Intuition, 21052 Determination, 21019 Blade, 21020 Avengers Tower, 21021 Avengers Mansion, 21022 Ready to Rumble.
 * From She-Hulk (Aggression): 21041 Marvel Boy, 21042 In-Betweener, 21044 Uppercut, 21045 Combat Training, 21046
 * Audacity. From Black Panther (Protection): 21060 The Gardener, 21062 Counter-Punch, 21063 Armored Vest, 21064
 * Preservation. Refused for a gate no Core hero meets: 21043 Magic Attack, 21050 Zone of Silence, 21055 Summoning
 * Spell, 21061 Shield Spell (all "Play only if your identity has the Mystic trait"), and 21065 Martinex's Guardian
 * cost reduction (no Core identity has Guardian, so it is asserted to NOT apply).
 * Skipped: 21038-21040 Karmic Blast, Cosmic Awareness, Quantum Magic (aspect `hero:21031a`, Adam Warlock only);
 * 21023-21025 Energy, Genius, Strength (resources with no ability script); 21059 Charlie-27 (keywords only, no ability
 * script); 21026+ are the obligation/nemesis cards. The four Cosmic Entity events are checked from play through the
 * villain phase reveal; the shuffle-in/reveal mechanics themselves are the engine's own `cosmic-entity.test.ts`.
 * Nothing in the pack is a verbatim reprint aliased in `../reprints.ts` (the pack's own scripts win,
 * `PACK_OWN_ABILITIES`), so the pack's reprints of Core cards (Uppercut, Combat Training, For Justice!, Heroic
 * Intuition, Make the Call, Inspired, Counter-Punch, Armored Vest, Avengers Mansion) are exercised here too.
 * No `mts` player card is a Team-Up card (RRG 1.8 "Team-Up", p. 43), so there is no Team-Up refusal to assert.
 *
 * Also covered: 21047 Quasar's "each scheme in play" with a side scheme as well as the main scheme (staged by
 * surgery), and 21013 White Tiger's X = the villain's stage number (Rhino stages II and III, by patching
 * `VillainState.stageIndex`).
 * Not covered: White Tiger's "maximum of three" cap. Every villain stage number in the pool that a stage can be set
 * to here is at most 3 (the 4s in the data are main schemes), so X > 3 is unreachable from the engine.
 *
 * Every Core hero face has the Avenger trait and none has Mystic or Guardian.
 */

const buildScenario = (players: readonly PlayerSetup[]) =>
  playableScenario("rhino", { seed: 11, players: players as never });

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;
const costOf = (code: string): number => {
  const card = BY_ID.get(code)!;
  return "cost" in card && typeof card.cost === "number" ? card.cost : 0;
};

const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";
const CAP_MARVEL = "core-captain-marvel-leadership";
const BLACK_PANTHER = "core-black-panther-protection";
const SHOCKER = "01103"; // ATK 2, HP 3, no keywords

const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);

interface OpenOptions {
  readonly alterEgo?: boolean;
  /** Extra copies of other cards to seat in the deck. They need not be legal in the hero's aspect, so the deck is
   * seated with `requireLegalDecks: false` (only used to reach allies for ally-limit and Team-Up style set-ups). */
  readonly extraDeck?: readonly string[];
}

/** `buildCrossHeroDeck`, falling back for a verbatim reprint of a card the precon already holds (Make the Call,
 * Inspired, ...): that helper drops the precon's same-titled copies and cannot refill the deck, so here the precon's
 * own copies are swapped for the pack's reprint instead (same title, same count, still a legal deck). */
function seatFor(code: string, coreHero: string): PlayerSetup {
  try {
    return buildCrossHeroDeck(PLAYABLE_CARDS, coreHero, code);
  } catch {
    const starter = CORE_STARTER_DECKS.find((deck) => deck.id === coreHero)!;
    const name = (BY_ID.get(code) as { name: string }).name;
    const deck = starter.cards.flatMap((entry) => {
      const card = BY_ID.get(entry.cardId as string) as { name?: string } | undefined;
      const id = (card?.name === name ? code : entry.cardId) as CardId;
      return Array.from({ length: entry.quantity }, () => id);
    });
    return { identityCardId: starter.identityCardId as CardId, aspects: starter.aspects, deck };
  }
}

/** Opening state with `code` in P1's hand, seated in `coreHero`'s own precon (`buildCrossHeroDeck`). */
function openHandFor(
  code: string,
  coreHero: string,
  options: OpenOptions = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const seat = seatFor(code, coreHero);
  const seated: PlayerSetup = options.extraDeck
    ? { ...seat, deck: [...seat.deck, ...options.extraDeck.map((c) => c as never)] }
    : seat;
  const config = buildScenario([seated]);
  const created = createGame(options.extraDeck ? { ...config, requireLegalDecks: false } : config, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const ready = options.alterEgo ? opening : toHeroFirst(opening);
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

const iconTotal = (card: AnyCard): number =>
  "resourceIcons" in card ? Object.values(card.resourceIcons).reduce((a, b) => a + (b ?? 0), 0) : 0;
const singleIcon = (card: AnyCard): boolean => iconTotal(card) === 1;

/** Moves `n` single-icon non-resource cards into P1's hand (never `exclude`) and returns their ids — single-value
 * payment cards, so a payment's size is exactly its value (docs/phase7-wave1-scripting.md "Test conventions").
 * `icon` restricts them to that printed icon, `notIcon` excludes it. */
function filler(
  state: GameState,
  n: number,
  exclude: readonly InstanceId[] = [],
  icon?: string,
  notIcon?: string,
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, P1);
  const codes: string[] = [];
  const seen = new Set<InstanceId>(exclude);
  for (const id of [...owner.hand, ...owner.deck]) {
    if (codes.length >= n) break;
    const card = cardOf(state, id);
    if (seen.has(id) || card.type === "resource" || !singleIcon(card)) continue;
    const icons = "resourceIcons" in card ? (card.resourceIcons as Record<string, number | undefined>) : {};
    if (icon && !icons[icon]) continue;
    if (notIcon && icons[notIcon]) continue;
    seen.add(id);
    codes.push(card.id as string);
  }
  if (codes.length < n) throw new Error(`only ${codes.length} filler cards found`);
  const probe = moveToHand(state, P1, ...codes);
  const ids = probe.ids.filter((id) => !exclude.includes(id));
  return { state: probe.state, ids };
}

/** Accepts the named optional response/interrupt (by ability id), pays a `payForCard` prompt with whatever hand
 * cards it offers up to the printed cost, and declines everything else. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    }
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Picks the option whose label contains `text`, `firstLegal` otherwise. */
const labeled =
  (text: string, base: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.label.includes(text));
    return hit ? [hit.optionId] : base(state);
  };

/** Picks `target` at a `chooseTarget` prompt, `base` otherwise. */
const targeting =
  (target: string, base: Picker = firstLegal): Picker =>
  (state) =>
    state.pendingChoice?.prompt.kind === "chooseTarget" ? [target] : base(state);

const playCard = (
  state: GameState,
  id: InstanceId,
  payment: readonly InstanceId[],
  pick: Picker = firstLegal,
  extra: Parameters<typeof play>[3] = {},
): GameState => settle(runWith(PLAYABLE_DEPS, state, play(P1, id, payment, extra)), pick, undefined, PLAYABLE_DEPS);

/** Moves `code` to hand and plays it, paying its printed cost with single-icon fillers. */
function playCode(
  state: GameState,
  code: string,
  exclude: readonly InstanceId[] = [],
  pick: Picker = firstLegal,
  extra: Parameters<typeof play>[3] = {},
) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as readonly [InstanceId];
  const pay = filler(given.state, costOf(code), [...exclude, id]);
  return { state: playCard(pay.state, id, pay.ids, pick, extra), id };
}

/** Puts `code` straight into P1's play area, free (surgery: no cost, no enters-play triggers). */
function seatInPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as readonly [InstanceId];
  return {
    id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((h) => h !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: { ...given.state.instances, [id]: { ...given.state.instances[id]!, controllerId: P1, faceup: true } },
    },
  };
}

const basicAttack = (state: GameState, attacker: InstanceId, target: InstanceId, pick: Picker = firstLegal) =>
  settle(
    runWith(PLAYABLE_DEPS, state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: target,
    }),
    pick,
    undefined,
    PLAYABLE_DEPS,
  );

/** Ends P1's turn so the villain phase attacks P1 (an Advance, no boost icons, stacked so the boost card cannot change
 * the damage; `boostCode` overrides it). `defender` null leaves the attack undefended. `initiate` answers the prompts at
 * attack initiation; `defend` those after `defender` is declared. */
function villainAttack(
  state: GameState,
  defender: InstanceId | null,
  initiate: Picker = firstLegal,
  defend: Picker = firstLegal,
  stack: readonly string[] = ["01186"],
  until?: (s: GameState) => boolean,
): GameState {
  const stacked = stackEncounterDeck(state, ...stack);
  const atDefend = settle(
    runWith(PLAYABLE_DEPS, stacked, endTurn(P1)),
    initiate,
    (s) => s.pendingChoice?.prompt.kind === "declareDefender",
    PLAYABLE_DEPS,
  );
  return settle(answer(atDefend, defender ? [defender] : ["decline"], PLAYABLE_DEPS), defend, until, PLAYABLE_DEPS);
}

const withThreat = (state: GameState, threat: number): GameState =>
  patchInstance(state, state.mainScheme.instanceId, { threat });

const refused = (state: GameState, id: InstanceId, payment: readonly InstanceId[], extra = {}): boolean =>
  !applyCommand(state, play(P1, id, payment, extra), PLAYABLE_DEPS).ok;

describe("mts leadership cards, from Captain Marvel (Leadership)'s own deck", () => {
  it("21011.captain-america-constant: costs 1 less per Avenger character you control (hero face, then +1 ally)", () => {
    const { state: opened, id: cap } = openHandFor("21011", CAP_MARVEL, { extraDeck: ["21012"] });
    // Printed cost 6; Captain Marvel's hero face is the one Avenger: 5.
    const pay = filler(opened, 5, [cap]);
    expect(refused(pay.state, cap, pay.ids.slice(0, 4))).toBe(true);
    expect(cardsInPlay(playCard(pay.state, cap, pay.ids))).toContain(cap);
    // A second Avenger character (Power Man) brings it to 4.
    const { state: withPowerMan } = playCode(opened, "21012", [cap]);
    const pay2 = filler(withPowerMan, 4, [cap]);
    expect(refused(pay2.state, cap, pay2.ids.slice(0, 3))).toBe(true);
    expect(cardsInPlay(playCard(pay2.state, cap, pay2.ids))).toContain(cap);
  });

  it("21012.power-man-constant, 21012.power-man-action: enters with 2 chi; the plain Action turns each into +2 ATK, in either form", () => {
    for (const alterEgo of [false, true]) {
      const { state: opened, id: powerMan } = openHandFor("21012", CAP_MARVEL, { alterEgo });
      const pay = filler(opened, 3, [powerMan]);
      const inPlay = playCard(pay.state, powerMan, pay.ids);
      expect(inst(inPlay, powerMan).counters.chi).toBe(2);
      const atk = characterProfile(inPlay, powerMan, PLAYABLE_DEPS)!.atk;
      const used = settle(
        runWith(PLAYABLE_DEPS, inPlay, use(P1, powerMan, "21012.power-man-action")),
        firstLegal,
        undefined,
        PLAYABLE_DEPS,
      );
      expect(inst(used, powerMan).counters.chi).toBe(0);
      expect(characterProfile(used, powerMan, PLAYABLE_DEPS)!.atk).toBe(atk + 4);
    }
  });

  it("21013.white-tiger-response: after you play her, draw 1 card (Rhino has no stage number) — printed plain Response, so in either form", () => {
    for (const alterEgo of [false, true]) {
      const { state: opened, id } = openHandFor("21013", CAP_MARVEL, { alterEgo });
      const pay = filler(opened, 3, [id]);
      const handBefore = playerOf(pay.state, P1).hand.length;
      const after = playCard(pay.state, id, pay.ids, accepting("21013.white-tiger-response"));
      expect(cardsInPlay(after)).toContain(id);
      expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - 3 + 1);
    }
  });

  it("21013.white-tiger-response: draws X cards where X is the villain's stage number (II draws 2, III draws 3)", () => {
    // Printed text: "draw X cards (to a maximum of three), where X is equal to the villain's stage number".
    const drawnAt = (stageIndex: number): number => {
      const { state: opened, id } = openHandFor("21013", CAP_MARVEL);
      const staged: GameState = {
        ...opened,
        villains: opened.villains.map((v) => (v.instanceId === opened.activeVillainId ? { ...v, stageIndex } : v)),
      };
      const pay = filler(staged, 3, [id]);
      const handBefore = playerOf(pay.state, P1).hand.length;
      const after = playCard(pay.state, id, pay.ids, accepting("21013.white-tiger-response"));
      expect(cardsInPlay(after)).toContain(id);
      return playerOf(after, P1).hand.length - (handBefore - 1 - 3);
    };
    expect(drawnAt(0)).toBe(1); // stage I (control)
    expect(drawnAt(1)).toBe(2);
    expect(drawnAt(2)).toBe(3);
  });

  it("21014.kaluu-response: after she enters play, search the top 5 for an event and add it to hand", () => {
    const { state: opened, id: kaluu } = openHandFor("21014", CAP_MARVEL);
    const owner = playerOf(opened, P1);
    const eventId = owner.deck.find((id) => cardOf(opened, id).type === "event")!;
    const eventCode = cardOf(opened, eventId).id as string;
    const stacked = putOnTopOfDeck(opened, P1, eventCode);
    const pay = filler(stacked.state, 2, [kaluu]);
    // The fillers may themselves have been drawn from the top; re-stack the event on top before playing.
    const restacked = putOnTopOfDeck(pay.state, P1, eventCode);
    const handBefore = playerOf(restacked.state, P1).hand.length;
    const after = playCard(restacked.state, kaluu, pay.ids, accepting("21014.kaluu-response"));
    expect(playerOf(after, P1).hand).toContain(restacked.ids[0]!);
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - 2 + 1);
  });

  it("21015.mighty-avengers-constant: allies get +1 THW and +1 ATK only while each of your characters is an Avenger", () => {
    const { state: opened, id: mighty } = openHandFor("21015", CAP_MARVEL, { extraDeck: ["21014"] });
    const { state: withAvenger, id: kaluu } = playCode(opened, "21014", [mighty]);
    const before = characterProfile(withAvenger, kaluu, PLAYABLE_DEPS)!;
    const pay = filler(withAvenger, 3, [mighty]);
    const after = playCard(pay.state, mighty, pay.ids);
    const boosted = characterProfile(after, kaluu, PLAYABLE_DEPS)!;
    expect(boosted.thw).toBe(before.thw + 1);
    expect(boosted.atk).toBe(before.atk + 1);
    // Control: a non-Avenger ally in play (Core Nick Fury's trait list has no Avenger) turns the bonus off.
    const nonAvenger = [...playerOf(opened, P1).hand, ...playerOf(opened, P1).deck].find((id) => {
      const c = cardOf(opened, id);
      return c.type === "ally" && !c.traits.includes("AVENGER" as never) && costOf(c.id as string) <= 3;
    });
    expect(nonAvenger).toBeDefined();
    const seated = seatInPlay(after, cardOf(opened, nonAvenger!).id as string);
    expect(characterProfile(seated.state, kaluu, PLAYABLE_DEPS)!.thw).toBe(before.thw);
    expect(characterProfile(seated.state, kaluu, PLAYABLE_DEPS)!.atk).toBe(before.atk);
  });

  it("21016.mass-attack-action: exhaust 3 allies sharing a trait with your hero → X damage, X = their ATK + your hero's", () => {
    const { state: opened, id: mass } = openHandFor("21016", CAP_MARVEL, { extraDeck: ["21019", "21014", "21012"] });
    const villain = activeVillain(opened).instanceId;
    // Blade (2 ATK), Kaluu (1), Power Man (0): three Avengers, like Captain Marvel's hero face.
    let state = opened;
    const allies: InstanceId[] = [];
    for (const code of ["21019", "21014", "21012"]) {
      const played = playCode(state, code, [mass]);
      state = played.state;
      allies.push(played.id);
    }
    const x =
      allies.reduce((sum, id) => sum + characterProfile(state, id, PLAYABLE_DEPS)!.atk, 0) +
      characterProfile(state, identityOf(state), PLAYABLE_DEPS)!.atk;
    const pay = filler(state, 3, [mass]);
    const after = playCard(pay.state, mass, pay.ids, targeting(villain as string), { costChoices: { allies } });
    for (const id of allies) expect(inst(after, id).exhausted).toBe(true);
    expect(inst(after, villain).damage).toBe(inst(state, villain).damage + x);
  });

  it("21017.moxie-response: after you change form, your hero gets +1 THW, +1 ATK, +1 DEF until end of round", () => {
    const { state: opened, id: moxie } = openHandFor("21017", CAP_MARVEL, { alterEgo: true });
    const control = toHeroFirst(opened);
    const after = settle(
      runWith(PLAYABLE_DEPS, opened, toHero(P1)),
      accepting("21017.moxie-response"),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(moxie);
    const hero = identityOf(after);
    const base = characterProfile(control, hero, PLAYABLE_DEPS)!;
    const boosted = characterProfile(after, hero, PLAYABLE_DEPS)!;
    expect(boosted.thw).toBe(base.thw + 1);
    expect(boosted.atk).toBe(base.atk + 1);
    expect(boosted.def).toBe(base.def + 1);
  });

  it("21018.band-together-constant: generates [wild] for each ally you control", () => {
    const { state: opened, id: band } = openHandFor("21018", CAP_MARVEL, { extraDeck: ["21019", "21014"] });
    expect(handCardResources(opened, PLAYABLE_DEPS, band, P1, null).wild).toBe(0);
    const one = playCode(opened, "21019", [band]);
    expect(handCardResources(one.state, PLAYABLE_DEPS, band, P1, null).wild).toBe(1);
    const two = playCode(one.state, "21014", [band]);
    expect(handCardResources(two.state, PLAYABLE_DEPS, band, P1, null).wild).toBe(2);
  });

  it("21053.major-victory-interrupt: when defeated, ready a friendly Guardian character", () => {
    // Martinex (Guardian) is the only Guardian: no Core hero is one.
    const { state: opened, id: victory } = openHandFor("21053", CAP_MARVEL, { extraDeck: ["21065"] });
    const withMartinex = seatInPlay(opened, "21065");
    const pay = filler(withMartinex.state, 2, [victory]);
    const inPlay = playCard(pay.state, victory, pay.ids);
    const hp = (cardOf(inPlay, victory) as { hp: number }).hp;
    const staged = patchInstance(inPlay, victory, { damage: hp - 1 });
    // Martinex defends against the villain's attack (an ally exhausts to defend, RRG 1.8 "Defend", p. 15) and survives;
    // then a minion's attack is defended by Major Victory, who is defeated. Hero and allies ready at the end of the
    // player phase (before the villain phase), so the exhaustion is still there when his interrupt fires.
    const run = (accept: boolean): GameState => {
      const withMinion = engageMinion(staged, SHOCKER, "mv-shocker");
      let defenders = 0;
      const picker: Picker = (s) => {
        if (s.pendingChoice?.prompt.kind === "declareDefender") {
          defenders += 1;
          return [(defenders === 1 ? withMartinex.id : victory) as string];
        }
        return targeting(
          withMartinex.id as string,
          accept ? accepting("21053.major-victory-interrupt") : firstLegal,
        )(s);
      };
      return settle(
        runWith(PLAYABLE_DEPS, stackEncounterDeck(withMinion, "01186", "01186"), endTurn(P1)),
        picker,
        undefined,
        PLAYABLE_DEPS,
      );
    };
    const after = run(true);
    expect(playerOf(after, P1).discard).toContain(victory);
    expect(inst(after, withMartinex.id).exhausted).toBe(false);
    const control = run(false);
    expect(playerOf(control, P1).discard).toContain(victory);
    expect(inst(control, withMartinex.id).exhausted).toBe(true);
  });

  it("21054.eternity-action: shuffles into the encounter deck; revealed, it is removed from the game (plain Action: usable in alter-ego form too)", () => {
    for (const alterEgo of [false, true]) {
      const { state: opened, id } = openHandFor("21054", CAP_MARVEL, { alterEgo });
      const pay = filler(opened, 2, [id]);
      const shuffled = playCard(pay.state, id, pay.ids);
      expect(activeEncounterDeck(shuffled).deck).toContain(id);
      expect(playerOf(shuffled, P1).hand).not.toContain(id);
      if (alterEgo) continue;
      const revealed = villainAttack(shuffled, null, firstLegal, firstLegal, ["01186", "21054"]);
      expect(revealed.removedFromGame).toContain(id);
    }
  });

  it("21056.make-the-call-action: pay the printed cost of an ally in a discard pile → put it into play under your control", () => {
    const { state: opened, id: call } = openHandFor("21056", CAP_MARVEL);
    const owner = playerOf(opened, P1);
    const allyId = [...owner.hand, ...owner.deck].find((id) => {
      const c = cardOf(opened, id);
      return c.type === "ally" && costOf(c.id as string) >= 1 && costOf(c.id as string) <= 3;
    })!;
    const allyCode = cardOf(opened, allyId).id as string;
    const discarded = moveToDiscard(opened, P1, allyCode);
    const pay = filler(discarded.state, costOf(allyCode), [call]);
    const after = playCard(pay.state, call, pay.ids, firstLegal, { costChoices: { ally: [discarded.id] } });
    expect(playerOf(after, P1).playArea).toContain(discarded.id);
    expect(playerOf(after, P1).discard).not.toContain(discarded.id);
  });

  it("21057.inspired-constant: attached ally gets +1 THW and +1 ATK; not attachable to a hero", () => {
    const { state: opened, id: inspired } = openHandFor("21057", CAP_MARVEL, { extraDeck: ["21014"] });
    const { state: withAlly, id: ally } = playCode(opened, "21014", [inspired]);
    const before = characterProfile(withAlly, ally, PLAYABLE_DEPS)!;
    const pay = filler(withAlly, 1, [inspired]);
    expect(refused(pay.state, inspired, pay.ids, { attachToInstanceId: identityOf(pay.state) })).toBe(true);
    const after = playCard(pay.state, inspired, pay.ids, firstLegal, { attachToInstanceId: ally });
    const equipped = characterProfile(after, ally, PLAYABLE_DEPS)!;
    expect(equipped.thw).toBe(before.thw + 1);
    expect(equipped.atk).toBe(before.atk + 1);
  });

  it("21058.innovation-response: Hero Response, after you spend this card, heal 1 damage from an ally you control", () => {
    const { state: opened, id: innovation } = openHandFor("21058", CAP_MARVEL, { extraDeck: ["21014", "21019"] });
    const { state: withAlly, id: ally } = playCode(opened, "21014", [innovation]);
    const hurt = patchInstance(withAlly, ally, { damage: 1 });
    const given = moveToHand(hurt, P1, "21019"); // Blade, cost 1
    const [blade] = given.ids as readonly [InstanceId];
    const after = playCard(
      given.state,
      blade,
      [innovation],
      targeting(ally as string, accepting("21058.innovation-response")),
    );
    expect(inst(after, ally).damage).toBe(0);
  });
});

describe("mts basic cards, from Spider-Man (Justice)'s own deck", () => {
  it("21019.blade-forced-response: after he attacks, spend a [physical] resource from hand or discard him", () => {
    const { state: opened, id: blade } = openHandFor("21019", SPIDER_MAN);
    const pay = filler(opened, 1, [blade]);
    const inPlay = playCard(pay.state, blade, pay.ids);
    const villain = activeVillain(inPlay).instanceId;
    const physical = [...playerOf(inPlay, P1).hand, ...playerOf(inPlay, P1).deck].find((id) => {
      const c = cardOf(inPlay, id);
      return "resourceIcons" in c && (c.resourceIcons as Record<string, number | undefined>).physical;
    })!;
    const code = cardOf(inPlay, physical).id as string;
    const staged = moveToHand(inPlay, P1, code).state;
    const handBefore = playerOf(staged, P1).hand.length;
    const spent = basicAttack(staged, blade, villain, labeled("Spend a [physical]"));
    expect(cardsInPlay(spent)).toContain(blade);
    expect(playerOf(spent, P1).hand.length).toBe(handBefore - 1);
    const discarded = basicAttack(staged, blade, villain, labeled("Discard Blade"));
    expect(cardsInPlay(discarded)).not.toContain(blade);
    expect(playerOf(discarded, P1).discard).toContain(blade);
    expect(playerOf(discarded, P1).hand.length).toBe(handBefore);
  });

  it("21020.avengers-tower-action: exhaust → the next Avenger ally played this phase costs 1 less", () => {
    const { state: opened, id: tower } = openHandFor("21020", SPIDER_MAN, { extraDeck: ["21019"] });
    const pay = filler(opened, 2, [tower]);
    const withTower = playCard(pay.state, tower, pay.ids);
    const used = settle(
      runWith(PLAYABLE_DEPS, withTower, use(P1, tower, "21020.avengers-tower-action")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(used, tower).exhausted).toBe(true);
    // Blade (Avenger, cost 1) is now free.
    const given = moveToHand(used, P1, "21019");
    const [blade] = given.ids as readonly [InstanceId];
    expect(cardsInPlay(playCard(given.state, blade, []))).toContain(blade);
    // Control: without the Action it costs 1.
    const control = moveToHand(withTower, P1, "21019");
    expect(refused(control.state, control.ids[0]!, [])).toBe(true);
  });

  it("21020.avengers-tower-constant: ally limit +1 while each of your allies has the Avenger trait", () => {
    const extras = ["21014", "21012", "21013", "21019"];
    const allyCount = (s: GameState) => playerOf(s, P1).playArea.filter((id) => cardOf(s, id).type === "ally").length;
    const { state: opened, id: tower } = openHandFor("21020", SPIDER_MAN, { extraDeck: extras });
    const pay = filler(opened, 2, [tower]);
    const withTower = playCard(pay.state, tower, pay.ids);
    let seated = withTower;
    for (const code of extras.slice(0, 3)) seated = seatInPlay(seated, code).state;
    const blade = playCode(seated, "21019", [tower]);
    expect(allyCount(blade.state)).toBe(4);
    // Control: without the Tower in play a fourth ally exceeds the limit of 3 (RRG 1.8 "Ally Limit", p. 5).
    let bare = opened;
    for (const code of extras.slice(0, 3)) bare = seatInPlay(bare, code).state;
    const bareBlade = playCode(bare, "21019", [tower]);
    expect(allyCount(bareBlade.state)).toBeLessThanOrEqual(3);
  });

  it("21021.avengers-mansion-action: exhaust → choose a player, who draws 1 card", () => {
    const { state: opened, id: mansion } = openHandFor("21021", SPIDER_MAN);
    const pay = filler(opened, 4, [mansion]);
    const inPlay = playCard(pay.state, mansion, pay.ids);
    const handBefore = playerOf(inPlay, P1).hand.length;
    const used = settle(
      runWith(PLAYABLE_DEPS, inPlay, use(P1, mansion, "21021.avengers-mansion-action")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(used, mansion).exhausted).toBe(true);
    expect(playerOf(used, P1).hand.length).toBe(handBefore + 1);
  });

  it("21022.ready-to-rumble-response: after you change form, discard it → ready your hero", () => {
    const { state: opened, id: rumble } = openHandFor("21022", SPIDER_MAN, { alterEgo: true });
    const pay = filler(opened, 1, [rumble]);
    const inPlay = playCard(pay.state, rumble, pay.ids);
    expect(cardsInPlay(inPlay)).toContain(rumble);
    const identity = identityOf(inPlay);
    const tired = patchInstance(inPlay, identity, { exhausted: true });
    const after = settle(
      runWith(PLAYABLE_DEPS, tired, toHero(P1)),
      accepting("21022.ready-to-rumble-response"),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, identity).exhausted).toBe(false);
    expect(playerOf(after, P1).discard).toContain(rumble);
    const control = toHeroFirst(tired);
    expect(inst(control, identity).exhausted).toBe(true);
  });

  it("21065.martinex-constant: the Guardian discount does not apply to a Core hero (printed cost 3)", () => {
    for (const alterEgo of [false, true]) {
      const { state, id } = openHandFor("21065", SPIDER_MAN, { alterEgo });
      const pay = filler(state, 3, [id]);
      expect(refused(pay.state, id, pay.ids.slice(0, 2))).toBe(true);
      expect(cardsInPlay(playCard(pay.state, id, pay.ids))).toContain(id);
    }
  });
});

describe("mts justice cards, from Spider-Man (Justice)'s own deck", () => {
  it("21047.quasar-response: after she enters play, remove 1 threat from each scheme in play", () => {
    const { state: opened, id } = openHandFor("21047", SPIDER_MAN);
    const staged = withThreat(opened, 5);
    const pay = filler(staged, 3, [id]);
    const after = playCard(pay.state, id, pay.ids, accepting("21047.quasar-response"));
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(4);
  });

  it("21047.quasar-response: with a side scheme in play too, removes 1 threat from it as well as from the main scheme", () => {
    // Bomb Scare (01109) has no Crisis icon, so both schemes lose threat. Control below: Crowd Control (01108) has the
    // Crisis icon (RRG 1.8 "Crisis Icon", p. 14), so the main scheme is protected while the side scheme still loses 1.
    for (const [code, mainAfter] of [
      ["01109", 4],
      ["01108", 5],
    ] as const) {
      const { state: opened, id } = openHandFor("21047", SPIDER_MAN);
      const side = encounterCardInVillainArea(withThreat(opened, 5), code, 3);
      const pay = filler(side.state, 3, [id]);
      const after = playCard(pay.state, id, pay.ids, accepting("21047.quasar-response"));
      expect(inst(after, after.mainScheme.instanceId).threat).toBe(mainAfter);
      expect(inst(after, side.id).threat).toBe(2);
    }
  });

  it("21048.living-tribunal-action: shuffles into the encounter deck; revealed, it is removed from the game", () => {
    const { state: opened, id } = openHandFor("21048", SPIDER_MAN);
    const pay = filler(opened, 2, [id]);
    const shuffled = playCard(pay.state, id, pay.ids);
    expect(activeEncounterDeck(shuffled).deck).toContain(id);
    const revealed = villainAttack(shuffled, null, firstLegal, firstLegal, ["01186", "21048"]);
    expect(revealed.removedFromGame).toContain(id);
  });

  it("21049.for-justice-action: Hero Action, remove 3 threat (4 if paid with a [mental] resource); refused in alter-ego form", () => {
    const { state: opened, id } = openHandFor("21049", SPIDER_MAN);
    const main = opened.mainScheme.instanceId;
    const staged = withThreat(opened, 10);
    const plain = filler(staged, 2, [id], undefined, "mental");
    const three = playCard(plain.state, id, plain.ids, targeting(main as string));
    expect(inst(three, main).threat).toBe(7);
    const mental = filler(staged, 2, [id], "mental");
    const four = playCard(mental.state, id, mental.ids, targeting(main as string));
    expect(inst(four, main).threat).toBe(6);
    const ego = openHandFor("21049", SPIDER_MAN, { alterEgo: true });
    const egoPay = filler(ego.state, 2, [ego.id]);
    expect(refused(egoPay.state, ego.id, egoPay.ids)).toBe(true);
  });

  it("21051.heroic-intuition-constant: your hero gets +1 THW", () => {
    const { state: opened, id } = openHandFor("21051", SPIDER_MAN);
    const before = characterProfile(opened, identityOf(opened), PLAYABLE_DEPS)!.thw;
    const pay = filler(opened, 2, [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(characterProfile(after, identityOf(after), PLAYABLE_DEPS)!.thw).toBe(before + 1);
  });

  it("21052.determination-response: after you spend this card, remove 1 threat from the main scheme (Hero Response: not in alter-ego form)", () => {
    const { state: opened, id: determination } = openHandFor("21052", SPIDER_MAN, { extraDeck: ["21019"] });
    const given = moveToHand(withThreat(opened, 5), P1, "21019"); // Blade, cost 1
    const [blade] = given.ids as readonly [InstanceId];
    const after = playCard(given.state, blade, [determination], accepting("21052.determination-response"));
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(4);
    const ego = openHandFor("21052", SPIDER_MAN, { alterEgo: true, extraDeck: ["21019"] });
    const egoGiven = moveToHand(withThreat(ego.state, 5), P1, "21019");
    const egoAfter = playCard(egoGiven.state, egoGiven.ids[0]!, [ego.id], accepting("21052.determination-response"));
    expect(inst(egoAfter, egoAfter.mainScheme.instanceId).threat).toBe(5);
  });
});

describe("mts aggression cards, from She-Hulk (Aggression)'s own deck", () => {
  it("21041.marvel-boy-interrupt: when he attacks, spend a [physical] resource → this attack gains piercing (discards tough first, RRG 1.8 p. 32)", () => {
    const { state: opened, id: boy } = openHandFor("21041", SHE_HULK);
    const pay = filler(opened, 2, [boy]);
    const inPlay = playCard(pay.state, boy, pay.ids);
    const staged = patchInstance(engageMinion(inPlay, SHOCKER, "mb-shocker"), "mb-shocker" as InstanceId, {
      statuses: { stunned: 0, confused: 0, tough: 1 },
    });
    const physical = [...playerOf(staged, P1).hand, ...playerOf(staged, P1).deck].find((id) => {
      const c = cardOf(staged, id);
      return "resourceIcons" in c && (c.resourceIcons as Record<string, number | undefined>).physical;
    })!;
    const withResource = moveToHand(staged, P1, cardOf(staged, physical).id as string).state;
    const control = basicAttack(withResource, boy, "mb-shocker" as InstanceId, firstLegal);
    expect(inst(control, "mb-shocker" as InstanceId).damage).toBe(0); // tough absorbed the attack
    const handBefore = playerOf(withResource, P1).hand.length;
    const spendPhysical: Picker = (st) =>
      st.pendingChoice?.prompt.kind === "payForAbility"
        ? [`hand:${physical}`]
        : accepting("21041.marvel-boy-interrupt")(st);
    const piercing = basicAttack(withResource, boy, "mb-shocker" as InstanceId, spendPhysical);
    expect(inst(piercing, "mb-shocker" as InstanceId).damage).toBe(2);
    expect(inst(piercing, "mb-shocker" as InstanceId).statuses.tough).toBe(0);
    expect(playerOf(piercing, P1).hand.length).toBe(handBefore - 1); // the spent resource
  });

  it("21042.in-betweener-action: shuffles into the encounter deck; revealed, deals 2 damage to the villain and is removed from the game", () => {
    const { state: opened, id } = openHandFor("21042", SHE_HULK);
    const pay = filler(opened, 2, [id]);
    const shuffled = playCard(pay.state, id, pay.ids);
    expect(activeEncounterDeck(shuffled).deck).toContain(id);
    const villain = activeVillain(shuffled).instanceId;
    const revealed = villainAttack(shuffled, null, firstLegal, firstLegal, ["01186", "21042"]);
    expect(revealed.removedFromGame).toContain(id);
    expect(inst(revealed, villain).damage).toBe(inst(shuffled, villain).damage + 2);
  });

  it("21043.magic-attack-action: refused (Play only if your identity has the Mystic trait), in either form", () => {
    for (const alterEgo of [false, true]) {
      const { state, id } = openHandFor("21043", SHE_HULK, { alterEgo });
      const pay = filler(state, 1, [id]);
      expect(refused(pay.state, id, pay.ids)).toBe(true);
    }
  });

  it("21044.uppercut-action: Hero Action, deal 5 damage to an enemy; refused in alter-ego form", () => {
    const { state: opened, id } = openHandFor("21044", SHE_HULK);
    const villain = activeVillain(opened).instanceId;
    const pay = filler(opened, 3, [id]);
    const hit = playCard(pay.state, id, pay.ids, targeting(villain as string));
    expect(inst(hit, villain).damage).toBe(inst(opened, villain).damage + 5);
    const ego = openHandFor("21044", SHE_HULK, { alterEgo: true });
    const egoPay = filler(ego.state, 3, [ego.id]);
    expect(refused(egoPay.state, ego.id, egoPay.ids)).toBe(true);
  });

  it("21045.combat-training-constant: your hero gets +1 ATK", () => {
    const { state: opened, id } = openHandFor("21045", SHE_HULK);
    const before = characterProfile(opened, identityOf(opened), PLAYABLE_DEPS)!.atk;
    const pay = filler(opened, 2, [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(characterProfile(after, identityOf(after), PLAYABLE_DEPS)!.atk).toBe(before + 1);
  });

  it("21046.audacity-response: Hero Response, after you spend this card, deal 1 damage to the villain (not in alter-ego form)", () => {
    const { state: opened, id: audacity } = openHandFor("21046", SHE_HULK, { extraDeck: ["21019"] });
    const villain = activeVillain(opened).instanceId;
    const given = moveToHand(opened, P1, "21019"); // Blade, cost 1
    const after = playCard(given.state, given.ids[0]!, [audacity], accepting("21046.audacity-response"));
    expect(inst(after, villain).damage).toBe(inst(opened, villain).damage + 1);
    const ego = openHandFor("21046", SHE_HULK, { alterEgo: true, extraDeck: ["21019"] });
    const egoGiven = moveToHand(ego.state, P1, "21019");
    const egoAfter = playCard(egoGiven.state, egoGiven.ids[0]!, [ego.id], accepting("21046.audacity-response"));
    expect(inst(egoAfter, villain).damage).toBe(inst(ego.state, villain).damage);
  });
});

describe("mts protection cards, from Black Panther (Protection)'s own deck", () => {
  it("21060.the-gardener-action: shuffles into the encounter deck; revealed, it is removed from the game", () => {
    const { state: opened, id } = openHandFor("21060", BLACK_PANTHER);
    const pay = filler(opened, 2, [id]);
    const shuffled = playCard(pay.state, id, pay.ids);
    expect(activeEncounterDeck(shuffled).deck).toContain(id);
    const revealed = villainAttack(shuffled, null, firstLegal, firstLegal, ["01186", "21060"]);
    expect(revealed.removedFromGame).toContain(id);
  });

  it("21061.shield-spell-interrupt: refused (Play only if your identity has the Mystic trait), in either form", () => {
    for (const alterEgo of [false, true]) {
      const { state, id } = openHandFor("21061", BLACK_PANTHER, { alterEgo });
      expect(refused(state, id, [])).toBe(true);
    }
  });

  it("21062.counter-punch-response: after your hero defends, deal damage to that enemy equal to your hero's ATK", () => {
    const { state: opened, id: punch } = openHandFor("21062", BLACK_PANTHER);
    const hero = identityOf(opened);
    const villain = activeVillain(opened).instanceId;
    const atk = characterProfile(opened, hero, PLAYABLE_DEPS)!.atk;
    // Control: the hero defends and declines the response (Black Panther's own kit may add damage of its own).
    const control = villainAttack(opened, hero);
    const after = villainAttack(opened, hero, firstLegal, accepting("21062.counter-punch-response"));
    expect(playerOf(after, P1).discard).toContain(punch);
    expect(inst(after, villain).damage).toBe(inst(control, villain).damage + atk);
    // Undefended: no "your hero defends" window, so no Counter-Punch.
    const undefended = villainAttack(opened, null, firstLegal, accepting("21062.counter-punch-response"));
    expect(playerOf(undefended, P1).discard).not.toContain(punch);
  });

  it("21063.armored-vest-constant: your hero gets +1 DEF", () => {
    const { state: opened, id } = openHandFor("21063", BLACK_PANTHER);
    const before = characterProfile(opened, identityOf(opened), PLAYABLE_DEPS)!.def;
    const pay = filler(opened, 1, [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(characterProfile(after, identityOf(after), PLAYABLE_DEPS)!.def).toBe(before + 1);
  });

  it("21064.preservation-response: Hero Response, after you spend this card, heal 1 damage from your hero", () => {
    const { state: opened, id: preservation } = openHandFor("21064", BLACK_PANTHER, { extraDeck: ["21019"] });
    const hero = identityOf(opened);
    const hurt = patchInstance(opened, hero, { damage: 2 });
    const given = moveToHand(hurt, P1, "21019"); // Blade, cost 1
    const after = playCard(given.state, given.ids[0]!, [preservation], accepting("21064.preservation-response"));
    expect(inst(after, hero).damage).toBe(1);
  });
});

describe("mts cards no Core hero can play", () => {
  for (const [code, hero] of [
    ["21050", SPIDER_MAN],
    ["21055", CAP_MARVEL],
  ] as const) {
    it(`${code}: refused in a Core hero's deck (Play only if your identity has the Mystic trait), in either form`, () => {
      for (const alterEgo of [false, true]) {
        const { state, id } = openHandFor(code, hero, { alterEgo });
        const pay = filler(state, costOf(code), [id]);
        expect(refused(pay.state, id, pay.ids)).toBe(true);
      }
    });
  }

  // RRG 1.8 "Identity-Specific Card" (p. 23): a `hero:21031a` card is legal only in Adam Warlock's deck.
  it("21038: Karmic Blast is Adam Warlock's own card, so a Core hero's deck holding it is refused", () => {
    const seat = buildCrossHeroDeck(PLAYABLE_CARDS, SPIDER_MAN, "21038");
    expect(createGame(buildScenario([seat]), PLAYABLE_DEPS).ok).toBe(false);
  });
});
