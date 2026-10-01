import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  handSize,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  putOnTopOfDeck,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { forceMinionIntoPlay } from "../../wave1/thor/testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Ant-Man pack
 * (`ant`, 12001a-12033) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:12001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only an Ant-Man deck could
 * hold) — played through the engine from a Core hero's own precon instead of Ant-Man's.
 *
 * Covered (15): 12011 Ant-Man, 12012 Giant-Man, 12013 Ronin, 12014 Stinger (play gate and ally-limit exemption),
 * 12015 Call for Aid, 12016 Moxie, 12017 Power Gloves, 12018 Reinforced Suit, 12024 Team-Building Exercise,
 * 12030 Moment of Triumph, 12031 Lay Down the Law, 12032 Muster Courage (and its Avenger gate), 12033 Assess the
 * Situation, 12020 Swarm Tactics (refused: Team-Up, RRG 1.8 "Team-Up" p. 43, the deck itself is illegal).
 * Skipped: 12019 First Aid (verbatim Core 01067), 12021 Energy, 12022 Genius, 12023 Strength (verbatim Core
 * 01075-01077 reprints aliased in `../reprints.ts`; the last three print no ability anyway); 12025-12029 are the
 * obligation/nemesis/encounter cards, not player aspect cards.
 *
 * Seats: leadership cards in Captain Marvel/Leadership, justice in Spider-Man/Justice, aggression in
 * She-Hulk/Aggression, protection in Black Panther/Protection (`CORE_HERO_FOR_ASPECT`), basic in whichever suits.
 * Every Core hero (hero face) has the Avenger trait; every alter-ego face but She-Hulk's/Cap's lacks it.
 */

const buildScenario = (players: readonly PlayerSetup[]) =>
  playableScenario("rhino", { seed: 11, players: players as never });

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;
const costOf = (code: string): number => {
  const card = BY_ID.get(code)!;
  return "cost" in card ? card.cost : 0;
};

const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";
const CAP_MARVEL = "core-captain-marvel-leadership";
const BLACK_PANTHER = "core-black-panther-protection";

const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);

interface OpenOptions {
  readonly alterEgo?: boolean;
  /** Extra copies of other cards to seat in the deck (legal in the hero's aspect). */
  readonly extraDeck?: readonly string[];
}

/** Opening state with `code` in P1's hand, seated in `coreHero`'s own precon (`buildCrossHeroDeck`). */
function openHandFor(
  code: string,
  coreHero: string,
  options: OpenOptions = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const seat = buildCrossHeroDeck(PLAYABLE_CARDS, coreHero, code);
  const seated: PlayerSetup = options.extraDeck
    ? { ...seat, deck: [...seat.deck, ...options.extraDeck.map((c) => c as never)] }
    : seat;
  const created = createGame(buildScenario([seated]), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const ready = options.alterEgo ? opening : toHeroFirst(opening);
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

const iconTotal = (card: AnyCard): number =>
  "resourceIcons" in card ? Object.values(card.resourceIcons).reduce((a, b) => a + (b ?? 0), 0) : 0;
const hasIcon = (card: AnyCard, icon: "energy" | "mental" | "physical"): boolean =>
  "resourceIcons" in card && (card.resourceIcons[icon] ?? 0) > 0;
const singleIcon = (card: AnyCard): boolean => iconTotal(card) === 1;
const singleNonMental = (card: AnyCard): boolean => singleIcon(card) && !hasIcon(card, "mental");

/** Moves `n` non-resource cards passing `ok` into P1's hand (never `exclude`) and returns their ids — single-value
 * payment cards, so a payment's size is exactly its value (docs/phase7-wave1-scripting.md "Test conventions"). */
function filler(
  state: GameState,
  n: number,
  exclude: readonly InstanceId[] = [],
  ok: (card: AnyCard) => boolean = singleIcon,
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, P1);
  const codes: string[] = [];
  const seen = new Set<InstanceId>(exclude);
  for (const id of [...owner.hand, ...owner.deck]) {
    if (codes.length >= n) break;
    const card = cardOf(state, id);
    if (seen.has(id) || card.type === "resource" || !ok(card)) continue;
    seen.add(id);
    codes.push(card.id as string);
  }
  if (codes.length < n) throw new Error(`only ${codes.length} filler cards found`);
  const probe = moveToHand(state, P1, ...codes);
  const ids = probe.ids.filter((id) => !exclude.includes(id));
  return { state: probe.state, ids };
}

/** Accepts the named optional response/interrupt (by ability id), and pays/declines everything else. */
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

const playCard = (
  state: GameState,
  id: InstanceId,
  payment: readonly InstanceId[],
  pick: Picker = firstLegal,
  attachTo?: InstanceId,
): GameState =>
  settle(
    runWith(PLAYABLE_DEPS, state, play(P1, id, payment, attachTo ? { attachToInstanceId: attachTo } : {})),
    pick,
    undefined,
    PLAYABLE_DEPS,
  );

/** Plays ally/upgrade `code` (already seated in the deck by `extraDeck`) paying its printed cost with fillers. */
function playExtra(
  state: GameState,
  code: string,
  exclude: readonly InstanceId[],
  attachTo?: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as readonly [InstanceId];
  const pay = filler(given.state, costOf(code), [...exclude, id]);
  return { state: playCard(pay.state, id, pay.ids, firstLegal, attachTo), id };
}

function withMinion(state: GameState, code: string): { state: GameState; minion: InstanceId } {
  const minion = instancesOf(state, code)[0]!;
  return { state: forceMinionIntoPlay(state, minion, P1), minion };
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

const profileOf = (state: GameState, id: InstanceId) => characterProfile(state, id, PLAYABLE_DEPS)!;

describe("Ant-Man's leadership cards, from Captain Marvel (Leadership)'s own deck", () => {
  it("12011.ant-man-interrupt: places 1 pym counter per resource overpaid for his cost, and 12011.ant-man-constant gives +1 hit point per counter", () => {
    const { state: opened, id: antMan } = openHandFor("12011", CAP_MARVEL);
    const pay = filler(opened, 3, [antMan]); // cost 0, three single-icon cards: all three resources are overpaid.
    const after = playCard(pay.state, antMan, pay.ids);
    expect(cardsInPlay(after)).toContain(antMan);
    expect(inst(after, antMan).counters.pym).toBe(3);
    expect(profileOf(after, antMan).maxHp).toBe(3); // printed 0 hit points + 3 pym counters
  });

  it("12012.giant-man-constant: +2 ATK while he has 3 or more remaining hit points", () => {
    const { state: opened, id: giantMan } = openHandFor("12012", CAP_MARVEL);
    const pay = filler(opened, costOf("12012"), [giantMan]);
    const after = playCard(pay.state, giantMan, pay.ids);
    expect(cardsInPlay(after)).toContain(giantMan);
    expect(profileOf(after, giantMan).atk).toBe(4); // printed 2 + 2 at 4 remaining hit points
    expect(profileOf(patchInstance(after, giantMan, { damage: 1 }), giantMan).atk).toBe(4); // 3 remaining
    expect(profileOf(patchInstance(after, giantMan, { damage: 2 }), giantMan).atk).toBe(2); // 2 remaining
  });

  it("12013.ronin-constant: +1 THW and +1 ATK while an upgrade is attached to him", () => {
    const { state: opened, id: ronin } = openHandFor("12013", CAP_MARVEL, { extraDeck: ["12018"] });
    const pay = filler(opened, costOf("12013"), [ronin]);
    const inPlay = playCard(pay.state, ronin, pay.ids);
    const bare = profileOf(inPlay, ronin);
    expect([bare.atk, bare.thw]).toEqual([2, 1]);
    const { state: suited, id: suit } = playExtra(inPlay, "12018", [ronin], ronin);
    expect(inst(suited, suit).attachedTo).toBe(ronin);
    const armed = profileOf(suited, ronin);
    expect([armed.atk, armed.thw]).toEqual([3, 2]);
  });

  it("12014.stinger-constant: refused when your identity lacks the Avenger trait (Captain Marvel's alter-ego)", () => {
    const { state, id } = openHandFor("12014", CAP_MARVEL, { alterEgo: true });
    const pay = filler(state, costOf("12014"), [id]);
    const result = applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS);
    expect(result.ok).toBe(false);
  });

  it("12014.stinger-constant: played in hero form (Avenger), it does not count against the ally limit of 3", () => {
    const { state: opened, id: stinger } = openHandFor("12014", CAP_MARVEL);
    // Three other allies already in play (state surgery: the precon's own cost would otherwise eat the hand).
    const ownerBefore = playerOf(opened, P1);
    const allyCodes: string[] = [];
    for (const id of [...ownerBefore.hand, ...ownerBefore.deck]) {
      const card = cardOf(opened, id);
      if (card.type === "ally" && card.id !== "12014" && allyCodes.length < 3 && !allyCodes.includes(card.id as string))
        allyCodes.push(card.id as string);
    }
    expect(allyCodes).toHaveLength(3);
    const allies = moveToHand(opened, P1, ...allyCodes);
    const inPlayArea = (s: GameState): GameState => ({
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: p.hand.filter((id) => !allies.ids.includes(id)),
              playArea: [...p.playArea, ...allies.ids],
            }
          : p,
      ),
    });
    const staged = inPlayArea(allies.state);
    const pay = filler(staged, costOf("12014"), [stinger, ...allies.ids]);
    const after = playCard(pay.state, stinger, pay.ids);
    expect(cardsInPlay(after)).toContain(stinger);
    for (const ally of allies.ids) expect(cardsInPlay(after)).toContain(ally);
  });

  it("12015.call-for-aid-action: discards from the top of the deck until an Avenger ally, then adds that ally to hand", () => {
    const { state: opened, id: callForAid } = openHandFor("12015", CAP_MARVEL, { extraDeck: ["12011"] });
    const owner = playerOf(opened, P1);
    const nonAlly = owner.deck.find((id) => cardOf(opened, id).type !== "ally" && cardOf(opened, id).id !== "12011")!;
    const stacked = putOnTopOfDeck(opened, P1, cardOf(opened, nonAlly).id as string, "12011");
    const [top, antMan] = stacked.ids as readonly [InstanceId, InstanceId];
    const after = playCard(stacked.state, callForAid, []);
    expect(playerOf(after, P1).hand).toContain(antMan);
    expect(playerOf(after, P1).discard).toContain(top);
  });

  it("12016.moxie-response: after you change form, your hero gets +1 THW, +1 ATK, +1 DEF until the end of the round", () => {
    const { state: opened, id: moxie } = openHandFor("12016", CAP_MARVEL, { alterEgo: true });
    const pay = filler(opened, costOf("12016"), [moxie]);
    const before = profileOf(pay.state, identityOf(pay.state));
    const changed = settle(
      runWith(PLAYABLE_DEPS, pay.state, toHero(P1)),
      (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "payForCard" || choice?.prompt.kind === "spendResources") {
          return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
        }
        return accepting("12016.moxie-response")(state);
      },
      undefined,
      PLAYABLE_DEPS,
    );
    const heroBefore = profileOf(toHeroFirst(opened), identityOf(opened));
    void before;
    expect(playerOf(changed, P1).discard).toContain(moxie);
    const after = profileOf(changed, identityOf(changed));
    expect([after.thw, after.atk, after.def]).toEqual([heroBefore.thw + 1, heroBefore.atk + 1, heroBefore.def + 1]);
  });

  it("12017.power-gloves-response: after the attached Avenger ally attacks, deals 1 damage to an enemy", () => {
    const { state: opened, id: gloves } = openHandFor("12017", CAP_MARVEL, { extraDeck: ["12013"] });
    const { state: withRonin, id: ronin } = playExtra(opened, "12013", [gloves]);
    const pay = filler(withRonin, costOf("12017"), [gloves, ronin]);
    const armed = playCard(pay.state, gloves, pay.ids, firstLegal, ronin);
    expect(inst(armed, gloves).attachedTo).toBe(ronin);
    const villain = armed.villains[0]!.instanceId;
    const before = inst(armed, villain).damage;
    const after = basicAttack(armed, ronin, villain, accepting("12017.power-gloves-response"));
    expect(inst(after, villain).damage).toBe(before + profileOf(armed, ronin).atk + 1);
  });

  it("12018.reinforced-suit-constant: the attached ally gets +2 hit points", () => {
    const { state: opened, id: suit } = openHandFor("12018", CAP_MARVEL, { extraDeck: ["12013"] });
    const { state: withRonin, id: ronin } = playExtra(opened, "12013", [suit]);
    const printed = profileOf(withRonin, ronin).maxHp;
    const pay = filler(withRonin, costOf("12018"), [suit, ronin]);
    const after = playCard(pay.state, suit, pay.ids, firstLegal, ronin);
    expect(inst(after, suit).attachedTo).toBe(ronin);
    expect(profileOf(after, ronin).maxHp).toBe(printed + 2);
  });
});

describe("Ant-Man's basic cards, from Captain Marvel / Spider-Man's own deck", () => {
  it("12024.team-building-exercise-action: exhaust → play a card sharing a trait with your hero at -1 cost", () => {
    // Giant-Man (cost 5, Avenger) shares the Avenger trait with every Core hero face; reduced cost is 4.
    const { state: opened, id: exercise } = openHandFor("12024", CAP_MARVEL, { extraDeck: ["12012"] });
    const given = moveToHand(opened, P1, "12012");
    const [giantMan] = given.ids as readonly [InstanceId];
    const pay = filler(given.state, costOf("12024"), [exercise, giantMan]);
    const played = playCard(pay.state, exercise, pay.ids);
    expect(cardsInPlay(played)).toContain(exercise);
    const spare = filler(played, 4, [exercise, giantMan]);
    const handBefore = playerOf(spare.state, P1).hand.length;
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseCards") {
        const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === giantMan);
        if (option) return [option.optionId];
      }
      if (choice.prompt.kind === "spendResources") {
        const req = choice.prompt.requirement;
        const needed =
          (req.generic ?? 0) + (req.physical ?? 0) + (req.mental ?? 0) + (req.energy ?? 0) + (req.wild ?? 0);
        return choice.options.slice(0, needed).map((o) => o.optionId);
      }
      return firstLegal(state);
    };
    const after = settle(
      runWith(PLAYABLE_DEPS, spare.state, use(P1, exercise, "12024.team-building-exercise-action", [])),
      pick,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(cardsInPlay(after)).toContain(giantMan);
    expect(inst(after, exercise).exhausted).toBe(true);
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - 4); // Giant-Man leaves hand, 5 - 1 = 4 paid
  });

  it("12033.assess-the-situation-action: +1 hand size until the end of the phase", () => {
    const { state: opened, id } = openHandFor("12033", SPIDER_MAN);
    const before = handSize(opened, P1, PLAYABLE_DEPS);
    const after = playCard(opened, id, []);
    expect(handSize(after, P1, PLAYABLE_DEPS)).toBe(before + 1);
  });

  // RRG 1.8 "Team-Up" (p. 43): "You cannot include this card in your deck unless your alter-ego or hero title matches
  // name 1 or name 2." Swarm Tactics (Ant-Man and Wasp) is therefore not a card a Core deck may hold at all.
  it("12020.swarm-tactics-action: refused, since no Core hero deck may include a Team-Up (Ant-Man and Wasp) card", () => {
    const seat = buildCrossHeroDeck(PLAYABLE_CARDS, SPIDER_MAN, "12020");
    const created = createGame(buildScenario([seat]), PLAYABLE_DEPS);
    expect(created.ok).toBe(false);
  });
});

describe("Ant-Man's aggression card, from She-Hulk (Aggression)'s own deck", () => {
  // Printed: "Hero Response: After you attack and defeat an enemy, heal 1 damage from your hero for each point of
  // excess damage dealt" (RRG 1.8 "Overkill", p. 31 for excess). The attacker is your hero, not this event.
  it("12030.moment-of-triumph-response: after you defeat an enemy, heals 1 damage from your hero per point of excess damage", () => {
    const { state: opened, id: moment } = openHandFor("12030", SHE_HULK);
    const { state: staged, minion } = withMinion(opened, "01101");
    const hp = profileOf(staged, minion).maxHp;
    const primed = patchInstance(staged, minion, { damage: hp - 1 }); // 1 remaining; the rest of the hit is excess
    const hero = identityOf(primed);
    const hurt = patchInstance(primed, hero, { damage: 6 });
    const atk = profileOf(hurt, hero).atk;
    expect(atk).toBeGreaterThan(1);
    const after = basicAttack(hurt, hero, minion, accepting("12030.moment-of-triumph-response"));
    expect(cardsInPlay(after)).not.toContain(minion);
    expect(playerOf(after, P1).discard).toContain(moment);
    expect(inst(after, hero).damage).toBe(6 - (atk - 1));
  });
});

describe("Ant-Man's justice card, from Spider-Man (Justice)'s own deck", () => {
  /** Accepts the response, pays the card with `pay` first (a mental-icon card or not), settles the rest with first. */
  const changeFormPaying =
    (payIds: readonly InstanceId[]): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "payForCard" || choice?.prompt.kind === "spendResources") {
        const wanted = choice.options.filter((o) => payIds.some((id) => o.optionId.endsWith(id)));
        return wanted.map((o) => o.optionId);
      }
      return accepting("12031.lay-down-the-law-response")(state);
    };

  it("12031.lay-down-the-law-response: after you change form, removes 3 threat from a scheme, 4 if paid with [mental]", () => {
    for (const [mental, removed] of [
      [false, 3],
      [true, 4],
    ] as const) {
      const { state: opened, id: law } = openHandFor("12031", SPIDER_MAN, { alterEgo: true });
      const scheme = opened.mainScheme.instanceId;
      const threatened = patchInstance(opened, scheme, { threat: 20 });
      const pay = filler(threatened, 1, [law], mental ? (c) => singleIcon(c) && hasIcon(c, "mental") : singleNonMental);
      const after = settle(
        runWith(PLAYABLE_DEPS, pay.state, toHero(P1)),
        changeFormPaying(pay.ids),
        undefined,
        PLAYABLE_DEPS,
      );
      expect(playerOf(after, P1).discard).toContain(law);
      // Spider-Man's own changing-form triggers do not touch the main scheme; the event does.
      expect(inst(after, scheme).threat).toBe(20 - removed);
    }
  });
});

describe("Ant-Man's protection card, from Black Panther (Protection)'s own deck", () => {
  it("12032.muster-courage-action: gives up to X friendly characters (X = villain stage 1) a tough status card", () => {
    const { state: opened, id } = openHandFor("12032", BLACK_PANTHER);
    const hero = identityOf(opened);
    expect(inst(opened, hero).statuses.tough).toBe(0);
    const pay = filler(opened, costOf("12032"), [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(inst(after, hero).statuses.tough).toBe(1);
  });

  it("12032.muster-courage-action: refused while your identity lacks the Avenger trait (Black Panther's alter-ego, T'Challa)", () => {
    const { state, id } = openHandFor("12032", BLACK_PANTHER, { alterEgo: true });
    const pay = filler(state, costOf("12032"), [id]);
    const result = applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS);
    expect(result.ok).toBe(false);
  });
});
