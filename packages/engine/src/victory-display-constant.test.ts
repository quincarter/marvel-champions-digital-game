/**
 * docs/phase7-wave7.md §3.50: a constant ability that applies while its card is in the victory display
 * (`AbilityDefinition.activeIn: "victoryDisplay"`). "While this card is in the victory display, your identity gains the
 * [Psionic] trait and your hero gets +1 THW, +1 ATK and +1 DEF."
 *
 * Synthetic cards: a Victory 0 player side scheme printing that constant, a constant meant for play ("your identity
 * gets +3 ATK"), a When Defeated, a forced response to an upgrade entering play and an action; a support with the
 * victory display constant alone; a plain upgrade; an upgrade "Play only if your identity has the [Psionic] trait"; an
 * encounter attachment that blanks the identity it is on; events for each instruction. The cards reach and leave the
 * victory display the ways `victory-display-source-destination.test.ts` (§3.49) built.
 *
 * Sources, RRG 1.8:
 *
 * - "Victory Display" (p. 46): "an out-of-play game area shared by all players. Cards in the victory display follow the
 *   standard rules for out-of-play cards."
 * - "In Play and Out of Play" (p. 23): "If a card is out of play, its text is inactive and cannot affect the game", and
 *   card abilities "can only be initiated or affect the game while they are in play unless they specifically refer to
 *   being used from an out-of-play area". So in the victory display only the ability that names it applies, and that
 *   ability does nothing in play.
 * - "Ownership and Control" (p. 31): "A player controls the cards in their own out-of-play areas (such as the hand, the
 *   deck, and the discard pile)". The shared victory display is no player's own area, so a card there has no
 *   controller and its "you" is its owner, "the player whose deck contained the card", whoever defeated it.
 * - "Victory X" (p. 46): a side scheme with the keyword "is placed in the victory display when it is defeated"; the
 *   value, 0 here, is only what the card is worth there.
 * - "Constant Abilities" and "Modifiers": a constant applies for as long as its condition holds and is recomputed on
 *   every read, so the bonus starts the moment the card is in the display and ends the moment it is not.
 * - "Text Box" (p. 44) and "Traits" (p. 45): a blank removes the blanked card's own printed abilities. A trait or a
 *   stat bonus another card's constant gives the identity is not in the identity's text box.
 * - "Player Elimination" (p. 34), steps 4-5: "each card owned by the eliminated player" goes to their discard pile and
 *   is removed from the game, so the constant ends with its owner. Their cards already in the victory display stay
 *   there and still count (owner ruling 2026-10-05, docs/phase7-wave7.md §4.1).
 */

import { flat, trait, type AnyCard, type PlayerSideSchemeCard, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { legalActions } from "./legal.js";
import { statBonus } from "./modifiers.js";
import { characterProfile, locateCard, mustInstance, mustPlayer } from "./query.js";
import { activeRules, resolveValue, textBoxBlankFor, traitsOf, type EffectContext } from "./select.js";
import type { CardSelector, EffectSpec, Predicate, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubEvent, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const you = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: you };
const each = (query: TargetQuery): TargetRef => ({ kind: "each", query });
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const PSIONIC = trait("PSIONIC");
const YOUR_IDENTITY: TargetQuery = { categories: ["identity"], controller: "you" };
const SIDE_SCHEME: TargetQuery = { categories: ["sideScheme"] };
const IN_HERO_FORM: Predicate = { kind: "form", player: you, form: "hero" };

/**
 * "While this card is in the victory display, your identity gains the [Psionic] trait and your hero gets +1 THW, +1 ATK
 * and +1 DEF." The trait is for both forms; the stats name the hero, so they carry the form condition.
 */
const displayConstant = (id: string) =>
  stubAbility(
    id,
    def({
      trigger: {
        kind: "constant",
        traitGrants: [{ trait: PSIONIC, target: YOUR_IDENTITY }],
        modifiers: (["thw", "atk", "def"] as const).map((stat) => ({
          stat,
          amount: 1,
          target: YOUR_IDENTITY,
          while: IN_HERO_FORM,
        })),
        // A rule and a keyword grant ride along, to show every part of the constant is read from there.
        rules: [{ kind: "cannotRecover", player: you }],
        keywordGrants: [{ keyword: { name: "retaliate", value: 1 }, target: YOUR_IDENTITY }],
      },
      effects: [],
      activeIn: "victoryDisplay",
    }),
  );
const PURGE_DISPLAY = displayConstant("purge.display");
/** A constant meant for play: "Your identity gets +3 ATK." */
const PURGE_IN_PLAY = stubAbility(
  "purge.in-play",
  def({ trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 3, target: YOUR_IDENTITY }] }, effects: [] }),
);
/** "When Defeated: The first player takes 1 damage." */
const PURGE_DEFEATED = stubAbility(
  "purge.when-defeated",
  def({
    trigger: { kind: "whenDefeated" },
    effects: [{ kind: "dealDamage", target: { kind: "identityOf", player: { kind: "firstPlayer" } }, amount: n(1) }],
  }),
);
/** "Forced Response: After an upgrade enters play, the first player takes 2 damage." */
const PURGE_WATCH = stubAbility(
  "purge.forced-response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "cardEntersPlay", targetIs: { categories: ["upgrade"] } },
    },
    effects: [{ kind: "dealDamage", target: { kind: "identityOf", player: { kind: "firstPlayer" } }, amount: n(2) }],
  }),
);
/** "Action: Take 1 damage." */
const PURGE_ACTION = stubAbility(
  "purge.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "dealDamage", target: yourIdentity, amount: n(1) }] }),
);

function playerSideScheme(
  id: string,
  abilities: readonly { readonly ref: PlayerSideSchemeCard["abilities"][number] }[],
) {
  return {
    ...stubSupport({ id, cost: 0, abilities: abilities.map((ability) => ability.ref) }),
    type: "player_side_scheme",
    startingThreat: flat(3),
    keywords: [{ name: "victory", value: 0 }],
  } satisfies PlayerSideSchemeCard;
}
/** Victory 0, with every kind of text. */
const PURGE = playerSideScheme("purge", [PURGE_DISPLAY, PURGE_IN_PLAY, PURGE_DEFEATED, PURGE_WATCH, PURGE_ACTION]);
/** A support with the victory display constant alone, for two at once. */
const SECOND_DISPLAY = displayConstant("second.display");
const SECOND = stubSupport({ id: "second", cost: 0, abilities: [SECOND_DISPLAY.ref] });
const GIZMO = stubUpgrade({ id: "gizmo", cost: 0 });
/** "Play only if your identity has the [Psionic] trait." */
const BADGE: UpgradeCard = {
  ...stubUpgrade({ id: "badge", cost: 0 }),
  playRestrictions: { requiresIdentityTrait: PSIONIC },
};
/** An encounter attachment: "Treat the attached identity's printed text box as if it were blank." */
const COLLAR_RULE = stubAbility(
  "collar.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "blankTextBox", target: { categories: ["identity"], hostOfSelf: true } }],
    },
    effects: [],
  }),
);
const COLLAR = stubAttachment({ id: "collar", abilities: [COLLAR_RULE.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [...effects] });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const inDisplay = (filter: TargetQuery): CardSelector => ({ kind: "victoryDisplay", filter });
/** "Remove 20 threat from each side scheme." */
const THWART = event("thwart", [{ kind: "removeThreat", target: each(SIDE_SCHEME), amount: n(20) }]);
/** "Add each side scheme to the victory display." */
const BURY = event("bury", [
  { kind: "moveCards", cards: { kind: "ref", ref: each(SIDE_SCHEME) }, to: "victoryDisplay" },
]);
/** "Add each support to the victory display." */
const BURY_SUPPORTS = event("bury-supports", [
  { kind: "moveCards", cards: { kind: "ref", ref: each({ categories: ["support"] }) }, to: "victoryDisplay" },
]);
/** "Put each side scheme in the victory display into play." */
const RETURN = event("return", [
  { kind: "selectCards", slot: "back", cards: inDisplay(SIDE_SCHEME) },
  { kind: "putIntoPlay", card: slot("back"), controller: you },
]);
/** "Remove each side scheme in the victory display from the game." */
const EXILE = event("exile", [{ kind: "moveCards", cards: inDisplay(SIDE_SCHEME), to: "removedFromGame" }]);
/** "Deal 50 damage to the second player's identity." */
const SMITE = event("smite", [
  { kind: "dealDamage", target: { kind: "identityOf", player: { kind: "id", playerId: P2 } }, amount: n(50) },
]);
const EVENTS = [THWART, BURY, BURY_SUPPORTS, RETURN, EXILE, SMITE];

const deps: EngineDeps = depsOf(
  PURGE_DISPLAY,
  PURGE_IN_PLAY,
  PURGE_DEFEATED,
  PURGE_WATCH,
  PURGE_ACTION,
  SECOND_DISPLAY,
  COLLAR_RULE,
  ...EVENTS.map((e) => e.ability),
);
const PLAYER_CARDS: readonly AnyCard[] = [PURGE, SECOND, GIZMO, BADGE, ...EVENTS.map((e) => e.card)];

/** Each player in hero form at the first player's first turn. */
function start(players: 1 | 2 = 1): GameState {
  const base = gameAtFirstTurn({
    players,
    cards: [...PLAYER_CARDS, COLLAR, FILLER],
    deps,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [COLLAR.id, ...copiesOf(FILLER.id, 30)],
  });
  expect(base.firstPlayerId).toBe(P1);
  return inForm(inForm(base, "hero", P1), "hero", P2);
}
function inForm(state: GameState, form: "hero" | "alterEgo", player: PlayerId = P1): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, identity: { ...p.identity, form } } : p)),
  };
}

interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/** Drives `commands` with the default pick for every choice, and checks that the log replays to the same state. */
function run(state: GameState, commands: readonly Command[]): Step {
  const { session, events } = driveSession(startSession(state), deps, commands, defaultPick);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const playCommand = (player: PlayerId, id: InstanceId): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
/** `player` plays `card` from hand for 0. The step's `id` is the played card. */
function play(state: GameState, card: AnyCard, player: PlayerId = P1): Step & { readonly id: InstanceId } {
  const given = giveCard(state, player, card.id);
  return { ...run(given.state, [playCommand(player, given.id)]), id: given.id };
}

const identityOf = (state: GameState, player: PlayerId = P1): InstanceId =>
  mustPlayer(state, player).identity.instanceId;
const damageOn = (state: GameState, player: PlayerId = P1) => mustInstance(state, identityOf(state, player)).damage;
const psionic = (state: GameState, player: PlayerId = P1) =>
  traitsOf(state, identityOf(state, player), deps).filter((t) => t === PSIONIC).length;
/** The identity's THW, ATK and DEF bonus from every modifier in force. */
const bonus = (state: GameState, player: PlayerId = P1) =>
  (["thw", "atk", "def"] as const).map((stat) => statBonus(state, deps, identityOf(state, player), stat));
const stats = (state: GameState, player: PlayerId = P1) => {
  const profile = characterProfile(state, identityOf(state, player), deps);
  return [profile?.thw, profile?.atk, profile?.def];
};
const NONE = [0, 0, 0];
/** `victoryDisplayCount(filter)` as a card ability would read it. */
function displayCount(state: GameState, filter?: TargetQuery): number {
  const context: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
  const value: ValueSpec = { kind: "victoryDisplayCount", ...(filter ? { filter } : {}) };
  return resolveValue(state, value, context, deps);
}

/** Surgery: `owner`'s copy of the scheme in play with its starting threat, under their control. */
function schemeInPlay(state: GameState, owner: PlayerId): { readonly state: GameState; readonly id: InstanceId } {
  const given = giveCard(state, owner, PURGE.id);
  return {
    id: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === owner ? { ...p, hand: p.hand.filter((id) => id !== given.id) } : p,
      ),
      villainArea: [...given.state.villainArea, given.id],
      instances: {
        ...given.state.instances,
        [given.id]: { ...mustInstance(given.state, given.id), controllerId: owner, faceup: true, threat: 3 },
      },
    },
  };
}
/**
 * `owner`'s scheme in play (played from hand by the first player; surgery for another player, who cannot play a card
 * on this turn), then defeated by the first player: it goes to the victory display by its Victory 0.
 */
function purgeInDisplay(players: 1 | 2 = 1, owner: PlayerId = P1) {
  const played = owner === P1 ? play(start(players), PURGE) : schemeInPlay(start(players), owner);
  const defeated = play(played.state, THWART.card, P1);
  expect(defeated.state.victoryDisplay).toEqual([played.id]);
  return { state: defeated.state, purge: played.id, events: defeated.events };
}

describe("a constant that applies while its card is in the victory display (§3.50; RRG 1.8 pp. 23, 46)", () => {
  it("before: in hand and in play it gives nothing, and the card's constant for play applies in play", () => {
    const fresh = start();
    expect(stats(fresh)).toEqual([2, 2, 2]);
    const held = giveCard(fresh, P1, PURGE.id);
    expect(psionic(held.state)).toBe(0);
    expect(bonus(held.state)).toEqual(NONE);
    const played = run(held.state, [playCommand(P1, held.id)]);
    expect(mustInstance(played.state, held.id).threat).toBe(3);
    expect(psionic(played.state)).toBe(0);
    // In play only "your identity gets +3 ATK" applies.
    expect(bonus(played.state)).toEqual([0, 3, 0]);
    expect(stats(played.state)).toEqual([2, 5, 2]);
    expect(hasKeyword(played.state, identityOf(played.state), "retaliate", deps)).toBe(false);
    expect(activeRules(played.state, deps, "cannotRecover")).toEqual([]);
  });

  it("while: defeated with Victory 0 it goes to the display, and the trait and +1 THW, ATK and DEF start", () => {
    const { state, purge, events } = purgeInDisplay();
    expect(events.some((e) => e.type === "schemeDefeated" && e.instanceId === purge)).toBe(true);
    expect(locateCard(state, purge)).toEqual({ kind: "victoryDisplay" });
    expect(mustInstance(state, purge).ownerId).toBe(P1);
    expect(psionic(state)).toBe(1);
    expect(bonus(state)).toEqual([1, 1, 1]);
    expect(stats(state)).toEqual([3, 3, 3]);
  });

  it("every part of the constant is read from there: its keyword grant and its rule, with the owner as 'you'", () => {
    const { state, purge } = purgeInDisplay();
    expect(hasKeyword(state, identityOf(state), "retaliate", deps)).toBe(true);
    const rules = activeRules(state, deps, "cannotRecover");
    expect(rules.map((active) => [active.context.selfInstanceId, active.speakerId])).toEqual([[purge, P1]]);
  });

  it("it arrives by an effect too: added to the display undefeated, the constant starts the same", () => {
    const played = play(start(), PURGE);
    const buried = play(played.state, BURY.card);
    expect(buried.events.some((e) => e.type === "schemeDefeated")).toBe(false);
    expect(buried.state.victoryDisplay).toEqual([played.id]);
    expect(psionic(buried.state)).toBe(1);
    expect(bonus(buried.state)).toEqual([1, 1, 1]);
  });

  it("two such cards in the display stack: +2 each, and the trait is granted by both", () => {
    const { state, purge } = purgeInDisplay();
    const second = play(state, SECOND);
    expect(bonus(second.state)).toEqual([1, 1, 1]);
    const buried = play(second.state, BURY_SUPPORTS.card);
    expect(buried.state.victoryDisplay).toEqual([purge, second.id]);
    expect(bonus(buried.state)).toEqual([2, 2, 2]);
    expect(stats(buried.state)).toEqual([4, 4, 4]);
    expect(psionic(buried.state)).toBe(2);
  });
});

describe("'you' is the card's owner (RRG 1.8 'Ownership and Control', p. 31)", () => {
  it("the second player's card defeated by the first player: the second player's identity gets it, not the first's", () => {
    const { state, purge, events } = purgeInDisplay(2, P2);
    expect(mustInstance(state, purge).ownerId).toBe(P2);
    expect(events.some((e) => e.type === "schemeDefeated" && e.instanceId === purge)).toBe(true);
    expect(psionic(state, P2)).toBe(1);
    expect(bonus(state, P2)).toEqual([1, 1, 1]);
    expect(stats(state, P2)).toEqual([3, 3, 3]);
    expect(psionic(state, P1)).toBe(0);
    expect(bonus(state, P1)).toEqual(NONE);
    expect(stats(state, P1)).toEqual([2, 2, 2]);
  });

  it("the stats are the hero's: in alter-ego form the trait stays and the bonus does not", () => {
    const { state } = purgeInDisplay();
    const flipped = inForm(state, "alterEgo");
    expect(psionic(flipped)).toBe(1);
    expect(bonus(flipped)).toEqual(NONE);
    expect(bonus(inForm(flipped, "hero"))).toEqual([1, 1, 1]);
  });

  it("the owner, not the last controller a defeat leaves recorded on the card", () => {
    const { state, purge } = purgeInDisplay(2, P2);
    const stale: GameState = {
      ...state,
      instances: { ...state.instances, [purge]: { ...mustInstance(state, purge), controllerId: P1 } },
    };
    expect(bonus(stale, P2)).toEqual([1, 1, 1]);
    expect(psionic(stale, P2)).toBe(1);
    expect(bonus(stale, P1)).toEqual(NONE);
    expect(psionic(stale, P1)).toBe(0);
    expect(activeRules(stale, deps, "cannotRecover").map((active) => active.speakerId)).toEqual([P2]);
  });

  it("each form is read for its own player: the owner in alter-ego form, the other player in hero form", () => {
    const { state } = purgeInDisplay(2, P2);
    const flipped = inForm(state, "alterEgo", P2);
    expect(psionic(flipped, P2)).toBe(1);
    expect(bonus(flipped, P2)).toEqual(NONE);
    expect(bonus(flipped, P1)).toEqual(NONE);
  });
});

describe("the card's other abilities do nothing in the victory display (RRG 1.8 'In Play and Out of Play', p. 23)", () => {
  it("its constant for play is off: no +3 ATK", () => {
    const { state } = purgeInDisplay();
    expect(bonus(state)).toEqual([1, 1, 1]);
  });

  it("its When Defeated resolved once, on the defeat, and its response does not answer from there", () => {
    const played = play(start(), PURGE);
    const defeated = play(played.state, THWART.card);
    expect(damageOn(defeated.state)).toBe(1);
    const later = play(defeated.state, GIZMO);
    expect(mustInstance(later.state, later.id).attachedTo).toBe(identityOf(later.state));
    expect(damageOn(later.state)).toBe(1);
    // The same response from play: 2 damage when an upgrade enters play.
    const control = play(played.state, GIZMO);
    expect(damageOn(control.state)).toBe(2);
  });

  it("its action is not offered, and using it is refused", () => {
    const { state, purge } = purgeInDisplay();
    const actions = legalActions(state, P1, deps);
    expect(actions.kind).toBe("turn");
    const offered =
      actions.kind === "turn"
        ? actions.legal.filter((a) => a.action.kind === "useAbility" && a.action.instanceId === purge)
        : [];
    expect(offered).toEqual([]);
    const use: Command = {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: purge,
      abilityId: PURGE_ACTION.ref.id,
      payment: [],
    };
    expect(applyCommand(state, use, deps).ok).toBe(false);
  });
});

describe("after: the constant ends the moment the card leaves the victory display", () => {
  it("an effect puts it back into play: the trait and bonus end, and its constant for play applies again", () => {
    const { state, purge } = purgeInDisplay();
    const back = play(state, RETURN.card);
    expect(back.state.victoryDisplay).toEqual([]);
    expect(locateCard(back.state, purge)?.kind).toBe("villainArea");
    expect(mustInstance(back.state, purge).threat).toBe(3);
    expect(psionic(back.state)).toBe(0);
    expect(bonus(back.state)).toEqual([0, 3, 0]);
    expect(hasKeyword(back.state, identityOf(back.state), "retaliate", deps)).toBe(false);
    expect(activeRules(back.state, deps, "cannotRecover")).toEqual([]);
  });

  it("an effect removes it from the game: the trait and bonus end", () => {
    const { state, purge } = purgeInDisplay();
    const gone = play(state, EXILE.card);
    expect(gone.state.victoryDisplay).toEqual([]);
    expect(locateCard(gone.state, purge)).toEqual({ kind: "removedFromGame" });
    expect(psionic(gone.state)).toBe(0);
    expect(bonus(gone.state)).toEqual(NONE);
    expect(stats(gone.state)).toEqual([2, 2, 2]);
  });

  it("its owner is eliminated: the constant ends, and nothing passes to the players who remain", () => {
    const { state } = purgeInDisplay(2, P2);
    expect(bonus(state, P2)).toEqual([1, 1, 1]);
    const smitten = play(state, SMITE.card, P1);
    expect(mustPlayer(smitten.state, P2).eliminated).toBe(true);
    expect(smitten.state.outcome).toBeNull();
    expect(psionic(smitten.state, P2)).toBe(0);
    expect(bonus(smitten.state, P2)).toEqual(NONE);
    expect(activeRules(smitten.state, deps, "cannotRecover")).toEqual([]);
    expect(psionic(smitten.state, P1)).toBe(0);
    expect(bonus(smitten.state, P1)).toEqual(NONE);
  });

  // Owner ruling 2026-10-05 (docs/phase7-wave7.md §4.1): an eliminated player's cards in the victory display stay
  // there, and elimination does not change the victory count.
  it("its owner is eliminated: the card stays in the victory display and still counts there, applying to nobody", () => {
    const { state, purge } = purgeInDisplay(2, P2);
    expect(displayCount(state)).toBe(1);
    expect(displayCount(state, SIDE_SCHEME)).toBe(1);
    const smitten = play(state, SMITE.card, P1);
    expect(mustPlayer(smitten.state, P2).eliminated).toBe(true);
    expect(smitten.state.victoryDisplay).toEqual([purge]);
    expect(locateCard(smitten.state, purge)).toEqual({ kind: "victoryDisplay" });
    expect(mustInstance(smitten.state, purge).ownerId).toBe(P2);
    expect(smitten.state.removedFromGame).not.toContain(purge);
    expect(mustPlayer(smitten.state, P2).discard).not.toContain(purge);
    expect(displayCount(smitten.state)).toBe(1);
    expect(displayCount(smitten.state, SIDE_SCHEME)).toBe(1);
    // The constant is its eliminated owner's: neither that seat nor the remaining player has it.
    for (const player of [P1, P2]) {
      expect(psionic(smitten.state, player)).toBe(0);
      expect(bonus(smitten.state, player)).toEqual(NONE);
      expect(hasKeyword(smitten.state, identityOf(smitten.state, player), "retaliate", deps)).toBe(false);
    }
    expect(activeRules(smitten.state, deps, "cannotRecover")).toEqual([]);
  });
});

describe("a trait and a bonus granted from out of play", () => {
  it("a card that needs the trait becomes playable, and stops being playable when the card leaves the display", () => {
    const badge = giveCard(start(), P1, BADGE.id);
    const refused = applyCommand(badge.state, playCommand(P1, badge.id), deps);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.code).toBe("no_valid_target");

    const purge = play(badge.state, PURGE);
    const defeated = play(purge.state, THWART.card);
    expect(mustPlayer(defeated.state, P1).hand).toContain(badge.id);
    const allowed = run(defeated.state, [playCommand(P1, badge.id)]);
    expect(mustPlayer(allowed.state, P1).hand).not.toContain(badge.id);
    expect(mustInstance(allowed.state, badge.id).attachedTo).toBe(identityOf(allowed.state));

    const gone = play(defeated.state, EXILE.card);
    expect(applyCommand(gone.state, playCommand(P1, badge.id), deps).ok).toBe(false);
  });

  it("an attachment blanking the identity's text box removes neither: they are not printed in that box", () => {
    const { state } = purgeInDisplay();
    const taken = encounterCardInVillainArea(state, COLLAR.id);
    const host = identityOf(taken.state);
    const collared: GameState = {
      ...taken.state,
      villainArea: taken.state.villainArea.filter((id) => id !== taken.id),
      instances: {
        ...taken.state.instances,
        [taken.id]: { ...mustInstance(taken.state, taken.id), attachedTo: host },
        [host]: {
          ...mustInstance(taken.state, host),
          attachments: [...mustInstance(taken.state, host).attachments, taken.id],
        },
      },
    };
    expect(textBoxBlankFor(collared, host, deps)).toBe(true);
    expect(psionic(collared)).toBe(1);
    expect(bonus(collared)).toEqual([1, 1, 1]);
    expect(stats(collared)).toEqual([3, 3, 3]);
    expect(hasKeyword(collared, host, "retaliate", deps)).toBe(true);
  });

  it("with no registry (printed characteristics only) nothing is granted", () => {
    const { state } = purgeInDisplay();
    expect(traitsOf(state, identityOf(state))).not.toContain(PSIONIC);
  });
});
