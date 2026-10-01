import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { forceMinionIntoPlay } from "../../wave1/thor/testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Gamora pack
 * (`gam`, 18001a-18032) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:18001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Gamora deck could hold) —
 * played through the engine from a Core hero's own precon instead of Gamora's.
 *
 * Covered (11): 18011 Angela (Forced Response search, hit and miss), 18012 Clobber, 18013 Plan of Attack (a plain
 * "Action:" usable in alter-ego form, top 4 / top 7), 18015 First Hit (Hero Action and Hero Interrupt), 18016
 * Impede, 18018 Godslayer (Hero Interrupt on a basic attack, unique targets only), 18019 Drax (refused without the
 * guardian trait; cannot attack minions), 18020 Hit and Run, 18029 Pivotal Moment, 18030 Comms Implant (guardian
 * ally only), 18031 True Grit (Response after the hero defends).
 * Skipped: 18014 Uppercut (verbatim Core 01054), 18017 Combat Training (verbatim Core 01057) and 18032 Enhanced
 * Reflexes (verbatim reprint) are aliased in `../reprints.ts`; 18021-18023 (Energy, Genius, Strength) print no
 * ability; 18024-18028 are the obligation/nemesis cards. The pack has no Team-Up card, so there is no "createGame
 * refuses a Team-Up deck" case (RRG 1.8 "Team-Up", p. 43).
 *
 * Seats: protection cards in Black Panther/Protection, justice and basic in Spider-Man/Justice, aggression in
 * She-Hulk/Aggression, leadership in Captain Marvel/Leadership. Every "Hero Action" card is also checked to be
 * refused in alter-ego form (RRG 1.8 "Hero Action" / "Alter-Ego Action", form restriction).
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
const singleIcon = (card: AnyCard): boolean => iconTotal(card) === 1;

/** Moves `n` single-icon non-resource cards into P1's hand (never `exclude`) and returns their ids, so a payment's
 * size is exactly its value. */
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

/** Accepts the named optional response/interrupt (by ability id), and declines everything else. */
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

/** Takes as many options as a prompt allows for card/target choices ("up to X"), `firstLegal` otherwise. */
const takingMax: Picker = (state) => {
  const choice = state.pendingChoice;
  if (!choice) return [];
  const kind = choice.prompt.kind;
  return kind === "chooseTarget" || kind === "chooseCards"
    ? choice.options.slice(0, choice.maxSelections).map((o) => o.optionId)
    : firstLegal(state);
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

const profileOf = (state: GameState, id: InstanceId) => characterProfile(state, id, PLAYABLE_DEPS)!;

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

/** Ending the turn discards down to hand size from the front of the hand: keep only the tracked cards. */
function keepOnlyInHand(state: GameState, keep: readonly InstanceId[]): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: p.hand.filter((c) => keep.includes(c)),
            deck: [...p.deck, ...p.hand.filter((c) => !keep.includes(c))],
          }
        : p,
    ),
  };
}

/** Sets P1's deck order: `top` first, then the rest in their existing order. */
function deckOrder(state: GameState, top: readonly InstanceId[]): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: [...top, ...p.deck.filter((c) => !top.includes(c))] } : p,
    ),
  };
}

/** Hero-form state to the declare-defender prompt of Rhino's villain-phase attack (Crowd Control boost: 2 + 2). */
function atDefenderPrompt(state: GameState, boost = "01108"): GameState {
  const stacked = stackEncounterDeck(state, boost, "01186");
  return settle(
    runWith(PLAYABLE_DEPS, stacked, endTurn()),
    firstLegal,
    (s) => s.pendingChoice?.prompt.kind === "declareDefender",
    PLAYABLE_DEPS,
  );
}

/** Pays any `payForCard` with the option ending in `payOptionSuffix`, accepts the named response/interrupt, and
 * declines everything else (including the defender prompt). */
const withEvent =
  (ability: string, payOptionSuffix?: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      const wanted = payOptionSuffix ? choice.options.filter((o) => o.optionId.endsWith(payOptionSuffix)) : [];
      return (wanted.length > 0 ? wanted : choice.options).slice(0, 1).map((o) => o.optionId);
    }
    return accepting(ability)(state);
  };

/** An alter-ego-form copy of the card in hand is refused ("Hero Action" is hero-form only). */
function expectRefusedInAlterEgo(code: string, coreHero: string): void {
  const { state: ego, id } = openHandFor(code, coreHero, { alterEgo: true });
  const pay = filler(ego, costOf(code), [id]);
  expect(applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS).ok).toBe(false);
}

/** Plays `code` (hero form, `coreHero`) with its own cost paid by filler cards; `prep` stages the state first. */
function playHeroEvent(
  code: string,
  coreHero: string,
  prep: (state: GameState) => GameState = (s) => s,
  pick: Picker = firstLegal,
) {
  const { state: opened, id } = openHandFor(code, coreHero);
  const staged = prep(opened);
  const pay = filler(staged, costOf(code), [id]);
  const after = playCard(pay.state, id, pay.ids, pick);
  return { before: staged, after, id };
}

const threatSet = (n: number) => (s: GameState) => patchInstance(s, s.mainScheme.instanceId, { threat: n });

describe("Gamora's aggression cards, from She-Hulk (Aggression)'s own deck", () => {
  it("18011.angela-forced-response: puts a minion from the top 10 of the encounter deck into play engaged with you; discarded when none is found", () => {
    const { state: opened, id } = openHandFor("18011", SHE_HULK);
    const stacked = stackEncounterDeck(opened, "01101");
    const pay = filler(stacked, costOf("18011"), [id]);
    const after = playCard(pay.state, id, pay.ids, takingMax);
    expect(cardsInPlay(after)).toContain(id);
    const minions = playerOf(after, P1).playArea.filter((c) => cardOf(after, c).type === "minion");
    expect(minions).toHaveLength(1);
    expect(inst(after, minions[0]!).engagedWith).toBe(P1);

    // No minion anywhere in the encounter deck: "If a minion was not put into play this way, discard Angela."
    const noMinions: GameState = {
      ...opened,
      encounterDecks: Object.fromEntries(
        Object.entries(opened.encounterDecks).map(([deckId, piles]) => {
          const isMinion = (c: InstanceId) => cardOf(opened, c).type === "minion";
          return [
            deckId,
            {
              deck: piles.deck.filter((c) => !isMinion(c)),
              discard: [...piles.discard, ...piles.deck.filter(isMinion)],
            },
          ];
        }),
      ) as GameState["encounterDecks"],
    };
    const pay2 = filler(noMinions, costOf("18011"), [id]);
    const missed = playCard(pay2.state, id, pay2.ids, takingMax);
    expect(cardsInPlay(missed)).not.toContain(id);
    expect(playerOf(missed, P1).discard).toContain(id);
  });

  // Printed: "Hero Action (attack): Deal 3 damage to an enemy. If this is the first card you have played this round,
  // return this card to your hand."
  it("18012.clobber-action: a Hero Action, 3 damage to an enemy; returns to hand when it is the first card played this round; refused in alter-ego form", () => {
    const { before, after, id } = playHeroEvent("18012", SHE_HULK);
    const villain = before.villains[0]!.instanceId;
    expect(inst(after, villain).damage).toBe(inst(before, villain).damage + 3);
    expect(playerOf(after, P1).hand).toContain(id);
    expect(playerOf(after, P1).discard).not.toContain(id);
    expectRefusedInAlterEgo("18012", SHE_HULK);
  });

  // Printed: "Action: Search the top 4 cards of your deck (top 7 cards instead if you are in alter-ego form) for an
  // attack event and add that card to your hand." A plain Action: usable in either form.
  it("18013.plan-of-attack-action: top 4 cards in hero form, top 7 in alter-ego form", () => {
    const search = (alterEgo: boolean, depth: number) => {
      const { state: opened, id } = openHandFor("18013", SHE_HULK, { alterEgo });
      const owner = playerOf(opened, P1);
      const attackEvent = owner.deck.find((c) => {
        const card = cardOf(opened, c);
        return card.type === "event" && card.traits.includes("ATTACK" as never);
      })!;
      const others = owner.deck.filter((c) => c !== attackEvent && cardOf(opened, c).type !== "event");
      // The attack event sits at (0-based) index `depth`, behind `depth` non-event cards.
      const arranged = deckOrder(opened, [...others.slice(0, depth), attackEvent]);
      const pay = filler(arranged, costOf("18013"), [id, attackEvent]);
      const rearranged = deckOrder(pay.state, [
        ...others.slice(0, depth).filter((c) => !pay.ids.includes(c)),
        attackEvent,
      ]);
      const after = playCard(rearranged, id, pay.ids, takingMax);
      return playerOf(after, P1).hand.includes(attackEvent);
    };
    expect(search(false, 3)).toBe(true); // 4th card from the top, hero form
    expect(search(false, 4)).toBe(false); // 5th card: outside the top 4
    expect(search(true, 4)).toBe(true); // alter-ego form: top 7
    expect(search(true, 7)).toBe(false); // 8th card: outside the top 7
  });

  it("18018.godslayer-interrupt: attached upgrade; exhausts for +2 ATK on a basic attack against a unique enemy only", () => {
    const { state: opened, id } = openHandFor("18018", SHE_HULK);
    const hero = identityOf(opened);
    const atk = profileOf(opened, hero).atk;
    const pay = filler(opened, costOf("18018"), [id]);
    const armed = playCard(pay.state, id, pay.ids, firstLegal, hero);
    expect(inst(armed, id).attachedTo).toBe(hero);
    const villain = armed.villains[0]!.instanceId; // Rhino is unique
    const hit = basicAttack(armed, hero, villain, accepting("18018.godslayer-interrupt"));
    expect(inst(hit, villain).damage).toBe(inst(armed, villain).damage + atk + 2);
    expect(inst(hit, id).exhausted).toBe(true);

    // A non-unique minion (Hydra Mercenary) is not a legal trigger target.
    const minion = instancesOf(armed, "01101")[0]!;
    const engaged = forceMinionIntoPlay(armed, minion, P1);
    const swat = basicAttack(engaged, hero, minion, accepting("18018.godslayer-interrupt"));
    expect(inst(swat, id).exhausted).toBe(false);
  });
});

describe("Gamora's protection cards, from Black Panther (Protection)'s own deck", () => {
  // Printed: "Hero Action (attack): Deal 2 damage to the villain." / "Hero Interrupt (attack): When a minion
  // initiates an attack, deal 2 damage to that minion."
  it("18015.first-hit-action: a Hero Action, 2 damage to the villain; refused in alter-ego form", () => {
    const { before, after, id } = playHeroEvent("18015", BLACK_PANTHER);
    const villain = before.villains[0]!.instanceId;
    expect(inst(after, villain).damage).toBe(inst(before, villain).damage + 2);
    expect(playerOf(after, P1).discard).toContain(id);
    expectRefusedInAlterEgo("18015", BLACK_PANTHER);
  });

  it("18015.first-hit-interrupt: when a minion initiates an attack, deals 2 damage to that minion", () => {
    const damageToMinion = (accept: boolean): number => {
      const { state: opened, id } = openHandFor("18015", BLACK_PANTHER);
      const minion = instancesOf(opened, "01101")[0]!;
      const staged = forceMinionIntoPlay(opened, minion, P1);
      const pay = filler(staged, costOf("18015"), [id]);
      const ready = keepOnlyInHand(pay.state, [id, ...pay.ids]);
      const after = settle(
        runWith(PLAYABLE_DEPS, stackEncounterDeck(ready, "01186"), endTurn()),
        accept ? withEvent("18015.first-hit-interrupt", pay.ids[0]) : firstLegal,
        undefined,
        PLAYABLE_DEPS,
      );
      if (accept) expect(playerOf(after, P1).discard).toContain(id);
      return playerOf(after, P1).playArea.includes(minion) ? inst(after, minion).damage : 99;
    };
    // Hydra Mercenary has 3 HP. Black Panther's own Retaliate 1 hits it in both runs (1 damage, still in play); the
    // interrupt's 2 more damage defeats it (3 total), so it leaves play only when the interrupt is accepted.
    expect(damageToMinion(false)).toBe(1);
    expect(damageToMinion(true)).toBe(99);
  });

  // Printed: "Response (thwart): After your hero defends against an enemy attack, remove threat from a scheme equal
  // to your hero's THW."
  it("18031.true-grit-response: after your hero defends, removes threat from a scheme equal to your hero's THW", () => {
    const { state: opened, id } = openHandFor("18031", BLACK_PANTHER);
    const pay = filler(opened, costOf("18031"), [id]);
    const hero = identityOf(opened);
    const thw = profileOf(opened, hero).thw;
    const reached = atDefenderPrompt(keepOnlyInHand(threatSet(4)(pay.state), [id, ...pay.ids]));
    expect(reached.pendingChoice?.prompt.kind).toBe("declareDefender");
    const declined = settle(
      reached,
      (s) => (s.pendingChoice?.prompt.kind === "declareDefender" ? [hero] : firstLegal(s)),
      undefined,
      PLAYABLE_DEPS,
    );
    const after = settle(
      reached,
      (s) =>
        s.pendingChoice?.prompt.kind === "declareDefender"
          ? [hero]
          : withEvent("18031.true-grit-response", pay.ids[0])(s),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(id);
    // Control: the same villain phase without the response; the rest of the phase adds threat identically.
    expect(mainThreat(after)).toBe(mainThreat(declined) - thw);
  });
});

describe("Gamora's justice cards, from Spider-Man (Justice)'s own deck", () => {
  // Printed: "Hero Action (thwart): Remove 3 threat from the main scheme. If this is the first card you have played
  // this round, return this card to your hand."
  it("18016.impede-action: a Hero Action, removes 3 threat from the main scheme; returns to hand when first card played; refused in alter-ego form", () => {
    const { after, id } = playHeroEvent("18016", SPIDER_MAN, threatSet(10));
    expect(mainThreat(after)).toBe(7);
    expect(playerOf(after, P1).hand).toContain(id);
    expectRefusedInAlterEgo("18016", SPIDER_MAN);
  });

  // Printed: "Hero Action (attack): Deal 2 damage to the villain (5 damage instead if there is no threat on the main
  // scheme)."
  it("18029.pivotal-moment-action: a Hero Action, 2 damage to the villain, 5 when the main scheme has no threat; refused in alter-ego form", () => {
    const withThreat = playHeroEvent("18029", SPIDER_MAN, threatSet(4));
    const villain = withThreat.before.villains[0]!.instanceId;
    expect(inst(withThreat.after, villain).damage).toBe(inst(withThreat.before, villain).damage + 2);
    const none = playHeroEvent("18029", SPIDER_MAN, threatSet(0));
    expect(inst(none.after, villain).damage).toBe(inst(none.before, villain).damage + 5);
    expect(playerOf(none.after, P1).discard).toContain(none.id);
    expectRefusedInAlterEgo("18029", SPIDER_MAN);
  });
});

describe("Gamora's basic cards, from Spider-Man (Justice)'s own deck", () => {
  // Printed: "Hero Action (attack/thwart): Deal 2 damage to an enemy. Remove 2 threat from a scheme."
  it("18020.hit-and-run-constant: a Hero Action, 2 damage to an enemy and 2 threat from a scheme; refused in alter-ego form", () => {
    const { before, after, id } = playHeroEvent("18020", SPIDER_MAN, threatSet(10), takingMax);
    const villain = before.villains[0]!.instanceId;
    expect(inst(after, villain).damage).toBe(inst(before, villain).damage + 2);
    expect(mainThreat(after)).toBe(8);
    expect(playerOf(after, P1).discard).toContain(id);
    expectRefusedInAlterEgo("18020", SPIDER_MAN);
  });

  // Printed: "Play only if your identity has the guardian trait. Drax cannot attack minions." Spider-Man has no
  // guardian trait, so the card is refused from a Core deck.
  it("18019.drax-constant: refused without the guardian trait; if in play, cannot attack minions", () => {
    const { state: opened, id } = openHandFor("18019", SPIDER_MAN);
    const pay = filler(opened, costOf("18019"), [id]);
    expect(applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS).ok).toBe(false);

    // State surgery past the identity gate, to prove the constant itself reads generically.
    const inPlay: GameState = {
      ...opened,
      players: opened.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((c) => c !== id), playArea: [...p.playArea, id] } : p,
      ),
    };
    const minion = instancesOf(inPlay, "01101")[0]!;
    const engaged = forceMinionIntoPlay(inPlay, minion, P1);
    const attackCmd = (target: InstanceId) =>
      applyCommand(
        engaged,
        { type: "basicAttack", playerId: P1, attackerInstanceId: id, targetInstanceId: target } as never,
        PLAYABLE_DEPS,
      );
    expect(attackCmd(minion).ok).toBe(false);
    // Control: the hero (without the constant) attacks the same minion fine.
    const hero = identityOf(engaged);
    const heroAttack = applyCommand(
      engaged,
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: minion } as never,
      PLAYABLE_DEPS,
    );
    expect(heroAttack.ok).toBe(true);
  });
});

describe("Gamora's leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  // Printed: "Attach to a guardian ally. Max 1 per ally. Attached ally gets +1 THW and +1 hit point."
  it("18030.comms-implant-constant: attaches only to a guardian ally, giving +1 THW and +1 hit point", () => {
    const { state: opened, id } = openHandFor("18030", CAP_MARVEL);
    const owner = playerOf(opened, P1);
    const allyId = [...owner.deck, ...owner.hand].find((c) => cardOf(opened, c).type === "ally" && c !== id)!;
    // The plain ally (not a guardian) is no legal host.
    const hostPlain: GameState = {
      ...opened,
      players: opened.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: p.hand.filter((c) => c !== allyId),
              deck: p.deck.filter((c) => c !== allyId),
              playArea: [...p.playArea, allyId],
            }
          : p,
      ),
    };
    const pay = filler(hostPlain, costOf("18030"), [id, allyId]);
    const refused = applyCommand(pay.state, play(P1, id, pay.ids, { attachToInstanceId: allyId }), PLAYABLE_DEPS);
    expect(refused.ok).toBe(false);

    // Surgery: the same ally instance becomes Drax (18019, a GUARDIAN ally), a legal host.
    const drax = patchInstance(pay.state, allyId, { cardId: "18019" as never });
    const thw = profileOf(drax, allyId).thw;
    const hp = profileOf(drax, allyId).maxHp;
    const after = playCard(drax, id, pay.ids, firstLegal, allyId);
    expect(inst(after, id).attachedTo).toBe(allyId);
    expect(profileOf(after, allyId).thw).toBe(thw + 1);
    expect(profileOf(after, allyId).maxHp).toBe(hp + 1);
  });
});
