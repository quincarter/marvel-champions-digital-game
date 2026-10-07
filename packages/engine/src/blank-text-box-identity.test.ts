/**
 * docs/phase7-wave7.md §3.19 (a): "Treat your identity's printed text box as if it were blank (except for traits)" on
 * an attachment or an obligation, the constant `RuleSpec blankTextBox` (`blank-text-box.test.ts`) aimed at an identity.
 * Owner decision §4.1 Q12 = A: while the blanking card is in play both faces are blank, keywords included, so the
 * showing face reads as blank and flipping restores nothing.
 *
 * What the rule removes and keeps, each from the RRG 1.8 text:
 *
 * - "Text Box" (p. 44): "the area of a card that contains the card's printed abilities, traits, and flavor text"; an
 *   ability that references a text box "only references the printed abilities within", and "Icons printed within a
 *   card's text box are considered abilities". So every printed ability goes: triggered (action, interrupt, response,
 *   resource, with the resource icons a resource ability prints) and constant, and the keywords (themselves abilities
 *   printed in the box; "Permanent", p. 32, counts a keyword as "part of its text box").
 * - "Traits" (p. 45): "Traits are not considered to be part of a card's printed text box for the purpose of card
 *   abilities." They stay with no special case, which is what the cards' "(except for traits)" reminds.
 * - The stat line, hand size and hit points are printed outside the text box ("Appendix III: Card Anatomy") and stay.
 *   "Star Icon" (pp. 40-41): a power "with the value of star" is defined in the card's text and "If it is not defined
 *   (for instance, if the card's text is blanked), that value is treated as 0"; "Non-Numerical Variable" (p. 30) says
 *   the same of any undefined variable.
 * - "Form, Change Form" (p. 21): changing form is a game rule, not text, so a blanked identity still flips once a round
 *   and "only the form changes": the attachment stays, and the other face is blank too.
 * - "Initiating Abilities" (pp. 24-25): "If the ability being initiated is on a card that is in play, the sequence does
 *   not stop from completing if that card leaves play during this sequence". The engine treats a text box blanked
 *   mid-resolution the same way: an ability already initiated resolves its remaining effects.
 * - "Permanent" (p. 32) protects a card "with the permanent keyword"; an identity prints none, so it has no protection
 *   of its own against a card from outside its set. One that is granted the keyword is protected like any other card.
 */

import { cardId, trait, type HeroIdentityCard, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { legalActions } from "./legal.js";
import { characterProfile, handSize, mustInstance, mustPlayer } from "./query.js";
import { activeAbilityRefs, textBoxBlankFor, traitsOf } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAttachment, stubIdentity, stubObligation, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard, newGame, RESOURCE, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, P1, P2 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const AVENGER = trait("AVENGER");
const GENIUS = trait("GENIUS");
const SELF = { categories: ["identity"], controller: "you" } as const;

/** An ability whose whole effect is one counter of its own name on the identity, so each use is countable. */
const tally = (name: string) =>
  ({ kind: "addCounters", target: { kind: "self" }, counterType: name, amount: { kind: "const", value: 1 } }) as const;
const afterUpgrade = { on: "cardEntersPlay", playerIs: "controller", targetIs: { categories: ["upgrade"] } } as const;

/** One face's text: an action, an interrupt and a response to an upgrade entering play, and a constant stat bonus. */
function faceText(form: "hero" | "alterEgo", stat: "atk" | "rec") {
  const action = stubAbility(`${form}.action`, def({ trigger: { kind: "action", form }, effects: [tally("action")] }));
  const interrupt = stubAbility(
    `${form}.interrupt`,
    def({ trigger: { kind: "interrupt", forced: false, form, on: afterUpgrade }, effects: [tally("interrupt")] }),
  );
  const response = stubAbility(
    `${form}.response`,
    def({ trigger: { kind: "response", forced: false, form, on: afterUpgrade }, effects: [tally("response")] }),
  );
  const constant = stubAbility(
    `${form}.constant`,
    def({ trigger: { kind: "constant", modifiers: [{ stat, amount: 2, target: SELF }] }, effects: [] }),
  );
  return { action, interrupt, response, constant };
}
const HERO_TEXT = faceText("hero", "atk");
const ALTER_EGO_TEXT = faceText("alterEgo", "rec");
/** "THW ★. Your THW is 3.": the printed value is a star, which the text box defines (RRG 1.8 "Star Icon", pp. 40-41). */
const STAR_THW = stubAbility(
  "hero.star",
  def({
    trigger: { kind: "constant", modifiers: [{ stat: "thw", amount: 3, target: SELF, setBase: true }] },
    effects: [],
  }),
);
/** "Resource: Exhaust your identity → generate a [wild] resource." */
const HERO_RESOURCE = stubAbility(
  "hero.resource",
  def({ trigger: { kind: "resource", form: "hero" }, cost: { exhaustSelf: true }, generates: 1, effects: [] }),
);
/** "Hero Action: Treat this card's text box as blank until the end of the phase. Then tally." (mid-resolution blank.) */
const SELF_BLANK = stubAbility(
  "hero.self-blank",
  def({
    trigger: { kind: "action", form: "hero" },
    effects: [{ kind: "blankTextBox", target: { kind: "self" }, until: "endOfPhase" }, tally("afterBlank")],
  }),
);

const base = stubIdentity({
  id: "host",
  hp: 11,
  atk: 2,
  // A star: 0 until the text box defines it.
  thw: 0,
  def: 1,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroAbilities: [
    HERO_TEXT.action.ref,
    HERO_TEXT.interrupt.ref,
    HERO_TEXT.response.ref,
    HERO_TEXT.constant.ref,
    STAR_THW.ref,
    HERO_RESOURCE.ref,
    SELF_BLANK.ref,
  ],
  alterEgoAbilities: [
    ALTER_EGO_TEXT.action.ref,
    ALTER_EGO_TEXT.interrupt.ref,
    ALTER_EGO_TEXT.response.ref,
    ALTER_EGO_TEXT.constant.ref,
  ],
  heroKeywords: [{ name: "retaliate", value: 1 }],
  alterEgoKeywords: [{ name: "steady" }],
  heroTraits: [AVENGER],
});
const HOST: HeroIdentityCard = { ...base, alterEgo: { ...base.alterEgo, traits: [GENIUS] } };

/** "Action: Discard this card." on each blanking card, so it leaves play by a real command. */
const leave = (id: string) =>
  stubAbility(
    id,
    def({ trigger: { kind: "action" }, effects: [{ kind: "discardFromPlay", target: { kind: "self" } }] }),
  );
const blankHost = (id: string, target: "attached" | "yours") =>
  stubAbility(
    id,
    def({
      trigger: {
        kind: "constant",
        rules: [
          {
            kind: "blankTextBox",
            target: target === "attached" ? { categories: ["identity"], hostOfSelf: true } : SELF,
          },
        ],
      },
      effects: [],
    }),
  );
/** An attachment: "Attach to your identity. Treat your identity's printed text box as if it were blank." */
const COLLAR_RULE = blankHost("collar.constant", "attached");
const COLLAR_LEAVE = leave("collar.leave");
const COLLAR = stubAttachment({ id: "collar", abilities: [COLLAR_RULE.ref, COLLAR_LEAVE.ref] });
/** A second attachment with the same text, for two blanks at once. */
const SHACKLE_RULE = blankHost("shackle.constant", "attached");
const SHACKLE_LEAVE = leave("shackle.leave");
const SHACKLE = stubAttachment({ id: "shackle", abilities: [SHACKLE_RULE.ref, SHACKLE_LEAVE.ref] });
/** An obligation in a player's play area: "Treat your identity's printed text box as if it were blank." */
const MEMORY_RULE = blankHost("memory.constant", "yours");
const MEMORY_LEAVE = leave("memory.leave");
const MEMORY = stubObligation({ id: "memory", abilities: [MEMORY_RULE.ref, MEMORY_LEAVE.ref] });

/**
 * The same identity printing the permanent keyword on both faces, and its own obligation with the blanking text: the
 * obligation `HeroIdentityCard.obligationCardId` names is of the identity's hero set (RRG 1.8 "Obligation", p. 30).
 */
const WARD: HeroIdentityCard = {
  ...HOST,
  id: cardId("ward"),
  name: "ward",
  obligationCardId: cardId("ward-obligation"),
  hero: { ...HOST.hero, faceName: "ward (hero)", keywords: [...HOST.hero.keywords, { name: "permanent" }] },
  alterEgo: { ...HOST.alterEgo, faceName: "ward (alter-ego)", keywords: [{ name: "permanent" }] },
};
const OWN_RULE = blankHost("own.constant", "yours");
const OWN = stubObligation({ id: "ward-obligation", abilities: [OWN_RULE.ref] });

const GIZMO = stubUpgrade({ id: "gizmo", cost: 0 });
const PRICEY = stubUpgrade({ id: "pricey", cost: 1 });
/** "Play only if your identity has the [Avenger] trait." */
const BADGE: UpgradeCard = {
  ...stubUpgrade({ id: "badge", cost: 0 }),
  playRestrictions: { requiresIdentityTrait: AVENGER },
};

const ALL: readonly StubAbility[] = [
  ...Object.values(HERO_TEXT),
  ...Object.values(ALTER_EGO_TEXT),
  STAR_THW,
  HERO_RESOURCE,
  SELF_BLANK,
  COLLAR_RULE,
  COLLAR_LEAVE,
  SHACKLE_RULE,
  SHACKLE_LEAVE,
  MEMORY_RULE,
  MEMORY_LEAVE,
  OWN_RULE,
];
const deps: EngineDeps = depsOf(...ALL);

const start = (): GameState =>
  newGame({
    identity: HOST,
    players: 2,
    extraCards: [COLLAR, SHACKLE, MEMORY, GIZMO, PRICEY, BADGE],
    deck: [...copiesOf(RESOURCE.id, 10), ...copiesOf(GIZMO.id, 6), ...copiesOf(PRICEY.id, 2), ...copiesOf(BADGE.id, 2)],
    encounterDeck: [COLLAR.id, SHACKLE.id, MEMORY.id, ...copiesOf(TREACHERY.id, 20)],
    deps,
  });

const identityOf = (state: GameState, player: PlayerId = P1): InstanceId =>
  mustPlayer(state, player).identity.instanceId;

/** Surgery: an encounter attachment on `player`'s identity (no reveal). */
function attach(state: GameState, card: typeof COLLAR, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const taken = encounterCardInVillainArea(state, card.id);
  const host = identityOf(taken.state, player);
  return {
    id: taken.id,
    state: {
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
    },
  };
}

/** Surgery: the obligation in `player`'s play area, controlled by no one ("Give to the X player"). */
function oblige(
  state: GameState,
  player: PlayerId = P1,
  card: typeof MEMORY = MEMORY,
): { state: GameState; id: InstanceId } {
  const taken = encounterCardInVillainArea(state, card.id);
  return {
    id: taken.id,
    state: {
      ...taken.state,
      villainArea: taken.state.villainArea.filter((id) => id !== taken.id),
      players: taken.state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...p.playArea, taken.id] } : p,
      ),
    },
  };
}

/** Takes every optional interrupt and response offered; every other choice gets the default answer. */
const takingTriggers = (state: GameState): readonly string[] => {
  const offered = state.pendingChoice?.options.find((o) => /\.(interrupt|response)/.test(o.optionId));
  return offered ? [offered.optionId] : defaultPick(state);
};
const run = (state: GameState, ...commands: readonly Command[]): GameState =>
  runCommandsPicking(state, deps, takingTriggers, ...commands).state;
const flip: Command = { type: "changeForm", playerId: P1 };
const use = (card: InstanceId, ability: StubAbility, player: PlayerId = P1): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: card,
  abilityId: ability.ref.id,
  payment: [],
});
const play = (card: InstanceId, payment: readonly Payment[] = []): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
});
/** Plays a 0-cost upgrade from the deck: the interrupt's and the response's triggering condition. */
function playUpgrade(state: GameState, card: UpgradeCard = GIZMO): GameState {
  const given = giveCard(state, P1, card.id);
  return run(given.state, play(given.id));
}
const tallies = (state: GameState, player: PlayerId = P1) => {
  const counters = mustInstance(state, identityOf(state, player)).counters;
  return { action: counters.action ?? 0, interrupt: counters.interrupt ?? 0, response: counters.response ?? 0 };
};
/** The identity's own abilities `legalActions` offers `player` right now. */
function offeredAbilities(state: GameState, player: PlayerId = P1): readonly string[] {
  const actions = legalActions(state, player, deps);
  if (actions.kind !== "turn") return [];
  const identity = identityOf(state, player);
  return actions.legal.flatMap((a) =>
    a.action.kind === "useAbility" && a.action.instanceId === identity ? [String(a.action.abilityId)] : [],
  );
}
const canChangeForm = (state: GameState): boolean => {
  const actions = legalActions(state, P1, deps);
  return actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "changeForm");
};
const profile = (state: GameState, player: PlayerId = P1) => characterProfile(state, identityOf(state, player), deps);

/** Uses the face's action and plays an upgrade, returning how many of the three triggered abilities resolved. */
function exercise(state: GameState, text: ReturnType<typeof faceText>): ReturnType<typeof tallies> {
  const before = tallies(state);
  const acted = applyCommand(state, use(identityOf(state), text.action), deps);
  const after = tallies(playUpgrade(acted.ok ? run(state, use(identityOf(state), text.action)) : state));
  return {
    action: after.action - before.action,
    interrupt: after.interrupt - before.interrupt,
    response: after.response - before.response,
  };
}

describe("§3.19 (a) an attachment blanks the identity it is attached to: the hero face", () => {
  it("stops the action, interrupt, response and constant ability, and they return the moment it leaves", () => {
    const hero = run(start(), flip);
    expect(exercise(hero, HERO_TEXT)).toEqual({ action: 1, interrupt: 1, response: 1 });
    expect(profile(hero)?.atk).toBe(4);

    const collared = attach(hero, COLLAR);
    expect(textBoxBlankFor(collared.state, identityOf(collared.state), deps)).toBe(true);
    expect(activeAbilityRefs(collared.state, identityOf(collared.state), deps)).toEqual([]);
    expect(exercise(collared.state, HERO_TEXT)).toEqual({ action: 0, interrupt: 0, response: 0 });
    // The constant "+2 ATK" is gone; the printed 2 is outside the text box.
    expect(profile(collared.state)?.atk).toBe(2);
    // Used by command, the action is refused and not merely hidden.
    expect(applyCommand(collared.state, use(identityOf(collared.state), HERO_TEXT.action), deps)).toMatchObject({
      ok: false,
    });

    const freed = run(collared.state, use(collared.id, COLLAR_LEAVE));
    expect(mustInstance(freed, identityOf(freed)).attachments).toEqual([]);
    expect(textBoxBlankFor(freed, identityOf(freed), deps)).toBe(false);
    expect(exercise(freed, HERO_TEXT)).toEqual({ action: 1, interrupt: 1, response: 1 });
    expect(profile(freed)?.atk).toBe(4);
  });

  it("removes the printed keyword and brings it back (RRG 1.8 'Text Box', p. 44; 'Permanent', p. 32)", () => {
    const hero = run(start(), flip);
    expect(hasKeyword(hero, identityOf(hero), "retaliate", deps)).toBe(true);
    const collared = attach(hero, COLLAR);
    expect(hasKeyword(collared.state, identityOf(collared.state), "retaliate", deps)).toBe(false);
    const freed = run(collared.state, use(collared.id, COLLAR_LEAVE));
    expect(hasKeyword(freed, identityOf(freed), "retaliate", deps)).toBe(true);
  });

  it("keeps the traits, so a card that needs one can still be played (RRG 1.8 'Traits', p. 45)", () => {
    const collared = attach(run(start(), flip), COLLAR);
    expect(traitsOf(collared.state, identityOf(collared.state), deps)).toEqual([AVENGER]);
    const played = playUpgrade(collared.state, BADGE);
    // An upgrade with no "attach to" text sits on its controller's identity, beside the blanking attachment.
    const attached = mustInstance(played, identityOf(played)).attachments.map((id) => mustInstance(played, id).cardId);
    expect(attached).toEqual([COLLAR.id, BADGE.id]);
  });

  it("leaves the printed stats, hand size and hit points alone", () => {
    const hero = run(start(), flip);
    const collared = attach(hero, COLLAR).state;
    expect(profile(collared)).toMatchObject({ atk: 2, def: 1, maxHp: 11 });
    expect(profile(collared)?.maxHp).toBe(profile(hero)?.maxHp);
    expect(handSize(collared, P1, deps)).toBe(5);
    expect(handSize(hero, P1, deps)).toBe(5);
  });

  it("reads a star stat the text box defines as 0 (RRG 1.8 'Star Icon', pp. 40-41)", () => {
    const hero = run(start(), flip);
    expect(profile(hero)?.thw).toBe(3);
    const collared = attach(hero, COLLAR);
    expect(profile(collared.state)?.thw).toBe(0);
    expect(profile(run(collared.state, use(collared.id, COLLAR_LEAVE)))?.thw).toBe(3);
  });

  it("stops the identity's resource ability paying for a card", () => {
    const hero = run(start(), flip);
    const pay = (state: GameState) => {
      const given = giveCard(state, P1, PRICEY.id);
      const payment: Payment = { ability: { instanceId: identityOf(state), abilityId: HERO_RESOURCE.ref.id } };
      return applyCommand(given.state, play(given.id, [payment]), deps);
    };
    expect(pay(hero)).toMatchObject({ ok: true });
    expect(pay(attach(hero, COLLAR).state)).toMatchObject({ ok: false });
  });

  it("no longer lists the blanked abilities among the legal actions", () => {
    const hero = run(start(), flip);
    expect(offeredAbilities(hero)).toEqual(
      expect.arrayContaining([String(HERO_TEXT.action.ref.id), String(SELF_BLANK.ref.id)]),
    );
    const collared = attach(hero, COLLAR);
    expect(offeredAbilities(collared.state)).toEqual([]);
    expect(offeredAbilities(run(collared.state, use(collared.id, COLLAR_LEAVE)))).toContain(
      String(HERO_TEXT.action.ref.id),
    );
  });
});

describe("§3.19 (a) the alter-ego face, and both faces at once (§4.1 Q12 = A)", () => {
  it("stops the alter-ego face's abilities, constant and keyword, and they return when the attachment leaves", () => {
    const base = start();
    expect(exercise(base, ALTER_EGO_TEXT)).toEqual({ action: 1, interrupt: 1, response: 1 });
    expect(profile(base)?.rec).toBe(5);
    expect(hasKeyword(base, identityOf(base), "steady", deps)).toBe(true);

    const collared = attach(base, COLLAR);
    expect(exercise(collared.state, ALTER_EGO_TEXT)).toEqual({ action: 0, interrupt: 0, response: 0 });
    expect(offeredAbilities(collared.state)).toEqual([]);
    expect(profile(collared.state)?.rec).toBe(3);
    expect(hasKeyword(collared.state, identityOf(collared.state), "steady", deps)).toBe(false);
    expect(traitsOf(collared.state, identityOf(collared.state), deps)).toEqual([GENIUS]);
    expect(handSize(collared.state, P1, deps)).toBe(6);

    const freed = run(collared.state, use(collared.id, COLLAR_LEAVE));
    expect(exercise(freed, ALTER_EGO_TEXT)).toEqual({ action: 1, interrupt: 1, response: 1 });
    expect(profile(freed)?.rec).toBe(5);
    expect(hasKeyword(freed, identityOf(freed), "steady", deps)).toBe(true);
  });

  it("can still change form while blanked, and the other face is blank too (RRG 1.8 'Form, Change Form', p. 21)", () => {
    const collared = attach(start(), COLLAR);
    expect(canChangeForm(collared.state)).toBe(true);
    const hero = run(collared.state, flip);
    expect(mustPlayer(hero, P1).identity.form).toBe("hero");
    // The attachment came along and the hero face it now shows is blank: no abilities, keyword or star value.
    expect(mustInstance(hero, identityOf(hero)).attachments).toEqual([collared.id]);
    expect(activeAbilityRefs(hero, identityOf(hero), deps)).toEqual([]);
    expect(exercise(hero, HERO_TEXT)).toEqual({ action: 0, interrupt: 0, response: 0 });
    expect(hasKeyword(hero, identityOf(hero), "retaliate", deps)).toBe(false);
    expect(profile(hero)).toMatchObject({ atk: 2, thw: 0, def: 1 });
    expect(traitsOf(hero, identityOf(hero), deps)).toEqual([AVENGER]);
    expect(handSize(hero, P1, deps)).toBe(5);

    const freed = run(hero, use(collared.id, COLLAR_LEAVE));
    expect(exercise(freed, HERO_TEXT)).toEqual({ action: 1, interrupt: 1, response: 1 });
    expect(profile(freed)).toMatchObject({ atk: 4, thw: 3 });
  });
});

describe("§3.19 (a) who is blanked, and by how many cards", () => {
  it("an obligation in a player's play area blanks that player's identity the same way", () => {
    const hero = run(start(), flip);
    const obliged = oblige(hero);
    expect(mustInstance(obliged.state, obliged.id).controllerId).toBeNull();
    expect(textBoxBlankFor(obliged.state, identityOf(obliged.state), deps)).toBe(true);
    expect(exercise(obliged.state, HERO_TEXT)).toEqual({ action: 0, interrupt: 0, response: 0 });
    expect(offeredAbilities(obliged.state)).toEqual([]);
    expect(hasKeyword(obliged.state, identityOf(obliged.state), "retaliate", deps)).toBe(false);
    expect(profile(obliged.state)).toMatchObject({ atk: 2, thw: 0 });
    expect(traitsOf(obliged.state, identityOf(obliged.state), deps)).toEqual([AVENGER]);

    const freed = run(obliged.state, use(obliged.id, MEMORY_LEAVE));
    expect(exercise(freed, HERO_TEXT)).toEqual({ action: 1, interrupt: 1, response: 1 });
    expect(profile(freed)).toMatchObject({ atk: 4, thw: 3 });
  });

  it("leaves another player's identity alone, from an attachment and from an obligation", () => {
    for (const blanked of [attach(start(), COLLAR).state, oblige(start()).state]) {
      expect(textBoxBlankFor(blanked, identityOf(blanked, P1), deps)).toBe(true);
      expect(textBoxBlankFor(blanked, identityOf(blanked, P2), deps)).toBe(false);
      expect(activeAbilityRefs(blanked, identityOf(blanked, P2), deps).map((ref) => ref.id)).toEqual(
        HOST.alterEgo.abilities.map((ref) => ref.id),
      );
      expect(profile(blanked, P2)?.rec).toBe(5);
      expect(hasKeyword(blanked, identityOf(blanked, P2), "steady", deps)).toBe(true);
    }
  });

  it("stays blank while one of two blanking cards remains, and clears when the last one leaves", () => {
    const first = attach(run(start(), flip), COLLAR);
    const both = attach(first.state, SHACKLE);
    expect(textBoxBlankFor(both.state, identityOf(both.state), deps)).toBe(true);

    const one = run(both.state, use(first.id, COLLAR_LEAVE));
    expect(mustInstance(one, identityOf(one)).attachments).toEqual([both.id]);
    expect(textBoxBlankFor(one, identityOf(one), deps)).toBe(true);
    expect(exercise(one, HERO_TEXT)).toEqual({ action: 0, interrupt: 0, response: 0 });
    expect(profile(one)).toMatchObject({ atk: 2, thw: 0 });

    const none = run(one, use(both.id, SHACKLE_LEAVE));
    expect(textBoxBlankFor(none, identityOf(none), deps)).toBe(false);
    expect(exercise(none, HERO_TEXT)).toEqual({ action: 1, interrupt: 1, response: 1 });
  });
});

describe("§3.19 (a) an identity and the Permanent keyword's blank protection (RRG 1.8 'Permanent', p. 32)", () => {
  const warded = (): GameState =>
    newGame({
      identity: WARD,
      extraCards: [COLLAR, MEMORY, OWN],
      encounterDeck: [COLLAR.id, MEMORY.id, OWN.id, ...copiesOf(TREACHERY.id, 20)],
      deps,
    });

  it("an identity prints no permanent keyword, so a card from outside its set blanks it", () => {
    // Every test above: the attachment and the obligation are in no set of the identity's and blank it all the same.
    const collared = attach(start(), COLLAR).state;
    expect(hasKeyword(collared, identityOf(collared), "permanent", deps)).toBe(false);
    expect(textBoxBlankFor(collared, identityOf(collared), deps)).toBe(true);
  });

  it("an identity that has the keyword is blanked only by a card of its own hero set, in either form", () => {
    for (const state of [warded(), run(warded(), flip)]) {
      // From outside the set: an encounter attachment and another identity's obligation.
      const outside = oblige(attach(state, COLLAR).state).state;
      expect(textBoxBlankFor(outside, identityOf(outside), deps)).toBe(false);
      expect(hasKeyword(outside, identityOf(outside), "permanent", deps)).toBe(true);
      expect(activeAbilityRefs(outside, identityOf(outside), deps)).not.toEqual([]);
      // Its own obligation is of its hero set, and takes the keyword away with the rest of the text box.
      const own = oblige(state, P1, OWN).state;
      expect(textBoxBlankFor(own, identityOf(own), deps)).toBe(true);
      expect(activeAbilityRefs(own, identityOf(own), deps)).toEqual([]);
      expect(hasKeyword(own, identityOf(own), "permanent", deps)).toBe(false);
    }
  });
});

describe("§3.19 (a) what the blank does not undo", () => {
  it("lets an ability already initiated finish (RRG 1.8 'Initiating Abilities', pp. 24-25)", () => {
    const hero = run(start(), flip);
    const done = run(hero, use(identityOf(hero), SELF_BLANK));
    // The text box went blank as the ability's first effect; its second effect still resolved.
    expect(textBoxBlankFor(done, identityOf(done), deps)).toBe(true);
    expect(mustInstance(done, identityOf(done)).counters.afterBlank).toBe(1);
    expect(offeredAbilities(done)).toEqual([]);
  });

  it("keeps what the identity's abilities did before the blank", () => {
    const hero = run(start(), flip);
    const acted = run(hero, use(identityOf(hero), HERO_TEXT.action));
    const collared = attach(acted, COLLAR).state;
    // The counter an ability placed is game state, not text.
    expect(tallies(collared).action).toBe(1);
    expect(mustInstance(collared, identityOf(collared)).damage).toBe(mustInstance(acted, identityOf(acted)).damage);
  });
});
