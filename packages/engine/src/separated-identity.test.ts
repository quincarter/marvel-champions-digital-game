/**
 * docs/phase7-wave5.md §3.24: a separated identity (the SP//dr insert, "New Rule: Separated Identity Card"): "Start the
 * game with the Peni Parker alter-ego in play and, following her 'Setup' instructions, put the INACTIVE support side of
 * the SP//dr Suit card into play. … Both identity cards share a single hit point dial … if one form is defeated, both
 * forms are considered to be defeated simultaneously and the player is eliminated from the game." Synthetic cards shaped
 * like SP//dr Suit / Peni Parker (`spdr` 31001a/b, 31002a/b), with §3.31's "cannot be treated as if it were blank" on
 * both non-identity sides.
 */

import { trait, unerrataedText, type DeckContents, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { validateDeck } from "./deck.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { currentName, locateCard, maxHitPoints, mustInstance, mustPlayer } from "./query.js";
import { activeAbilityRefs, categoriesOf, textBoxBlankFor, traitsOf } from "./select.js";
import { separatedSideCardId } from "./separated-identity.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubIdentity, stubUpgrade } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";
import { P1, P2, playFree } from "./testing/wave3.js";

const unblankable = (id: string) =>
  stubAbility(id, {
    trigger: { kind: "constant", rules: [{ kind: "textBoxCannotBeBlanked" }] },
    effects: [],
  } satisfies AbilityDefinition);
const SUIT_UNBLANKABLE = unblankable("suit-side.constant");
const PILOT_UNBLANKABLE = unblankable("pilot-side.constant");
// "Deal 99 damage to your identity": a defeat from either form.
const SELF_DESTRUCT = stubAbility("spdr.self-destruct", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: 99 },
    },
  ],
});

const SPDR: HeroIdentityCard = {
  ...stubIdentity({
    id: "spdr",
    name: "Suit",
    hp: 14,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 4,
    heroHandSize: 3,
    alterEgoHandSize: 4,
    heroTraits: [trait("ACTIVE")],
    heroAbilities: [SELF_DESTRUCT.ref],
    alterEgoAbilities: [SELF_DESTRUCT.ref],
  }),
  separatedIdentity: {
    alterEgoCardNumber: "2",
    heroCardOtherSide: {
      cardType: "support",
      name: "Suit",
      traits: [trait("INACTIVE"), trait("TECH")],
      keywords: [{ name: "permanent" }],
      text: unerrataedText("Permanent. This card's printed text box cannot be treated as if it were blank."),
      abilities: [SUIT_UNBLANKABLE.ref],
    },
    alterEgoCardOtherSide: {
      cardType: "upgrade",
      name: "Pilot",
      traits: [trait("INTERFACE"), trait("PILOT")],
      keywords: [{ name: "permanent" }],
      text: unerrataedText("Permanent. This card's printed text box cannot be treated as if it were blank."),
      abilities: [PILOT_UNBLANKABLE.ref],
      resourceIcons: { wild: 1 },
    },
  },
};
const GEAR = stubUpgrade({ id: "gear", cost: 0 });
const SUPPORT_SIDE = separatedSideCardId(SPDR.id, "heroCardOtherSide");
const UPGRADE_SIDE = separatedSideCardId(SPDR.id, "alterEgoCardOtherSide");

const deps: EngineDeps = depsOf(SUIT_UNBLANKABLE, PILOT_UNBLANKABLE, SELF_DESTRUCT);
const config: GameSetupConfig = {
  seed: 1,
  cards: [...DEFAULT_CARDS, SPDR, GEAR],
  villainCardId: VILLAIN.id,
  mainSchemeCardId: MAIN_SCHEME.id,
  encounterDeck: [],
  includeIdentitySets: false,
  players: [
    { identityCardId: SPDR.id, deck: [...DEFAULT_DECK, GEAR.id] },
    { identityCardId: HERO.id, deck: DEFAULT_DECK },
  ],
};

function created(): GameState {
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
const start = (): GameState => driveSession(startSession(created()), deps).session.state;

const seat = (state: GameState) => mustPlayer(state, P1);
const identityId = (state: GameState): InstanceId => seat(state).identity.instanceId;
const otherCardId = (state: GameState): InstanceId => {
  const id = seat(state).identity.separatedCardInstanceId;
  if (!id) throw new Error("no separated card");
  return id;
};
const changeForm: Command = { type: "changeForm", playerId: P1 };
const run = (state: GameState, ...commands: Command[]) => driveSession(startSession(state), deps, commands);
/** Test surgery: a fresh round's form change is available again. */
const newRound = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) =>
    p.playerId === P1 ? { ...p, identity: { ...p.identity, changedFormThisRound: false } } : p,
  ),
});
const patch = (state: GameState, id: InstanceId, fields: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...fields } },
});

describe("§3.24 setup: the alter-ego in play, then the hero card's support side", () => {
  it("sets the other card aside at creation and puts it into play at setup step 16", () => {
    const early = created();
    expect(early.cardPool[SUPPORT_SIDE]?.type).toBe("support");
    expect(early.cardPool[UPGRADE_SIDE]?.type).toBe("upgrade");
    expect(locateCard(early, otherCardId(early))?.kind).toBe("setAside");

    const state = start();
    const other = otherCardId(state);
    expect(seat(state).identity.form).toBe("alterEgo");
    expect(seat(state).playArea).toContain(other);
    expect(mustInstance(state, other)).toMatchObject({ cardId: SUPPORT_SIDE, controllerId: P1, faceup: true });
    expect(categoriesOf(state, other)).toEqual(["support"]);
    expect(currentName(state, other)).toBe("Suit");
    expect(traitsOf(state, other, deps)).toEqual([trait("INACTIVE"), trait("TECH")]);
    expect(hasKeyword(state, other, "permanent", deps)).toBe(true);
    expect(currentName(state, identityId(state))).toBe("Suit (alter-ego)");
    expect(maxHitPoints(state, identityId(state))).toBe(14);
  });

  it("validateDeck no longer reports it unsupported", () => {
    const deck: DeckContents = { identityCardId: SPDR.id, aspects: ["protection"], cards: [] };
    const verdict = validateDeck(deck, [SPDR]);
    expect(verdict.ok ? [] : verdict.problems.map((p) => p.code)).not.toContain("unsupported_identity");
  });
});

describe("§3.24 changing form flips both cards", () => {
  it("to hero: the upgrade side attaches to the identity; dial, counters, statuses and attachments stay; replay deep-equal", () => {
    const played = playFree(start(), deps, GEAR.id);
    const upgrade = mustInstance(played.state, identityId(played.state)).attachments[0];
    expect(upgrade).toBeDefined();
    const id = identityId(played.state);
    const other = otherCardId(played.state);
    // Peni exhausted (she recovered), the Suit ready.
    const before = patch(played.state, id, {
      damage: 3,
      exhausted: true,
      counters: { sym: 2 },
      statuses: { stunned: 0, confused: 0, tough: 1 },
    });

    const { session, events } = run(before, changeForm);
    const after = session.state;
    expect(seat(after).identity).toMatchObject({ instanceId: id, form: "hero", changedFormThisRound: true });
    expect(mustInstance(after, id)).toMatchObject({ damage: 3, counters: { sym: 2 }, exhausted: false });
    expect(mustInstance(after, id).statuses.tough).toBe(1);
    expect(mustInstance(after, id).attachments).toEqual([upgrade, other]);
    expect(mustInstance(after, other)).toMatchObject({ cardId: UPGRADE_SIDE, attachedTo: id, exhausted: true });
    expect(seat(after).playArea).not.toContain(other);
    expect(categoriesOf(after, other)).toEqual(["upgrade"]);
    expect(currentName(after, other)).toBe("Pilot");
    expect(after.cardPool[UPGRADE_SIDE]).toMatchObject({ resourceIcons: { wild: 1 } });
    expect(currentName(after, id)).toBe("Suit (hero)");
    expect(maxHitPoints(after, id)).toBe(14);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "separatedCardFlipped",
        instanceId: other,
        fromCardId: SUPPORT_SIDE,
        toCardId: UPGRADE_SIDE,
        identityExhausted: false,
        cardExhausted: true,
      }),
    );

    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the once-per-round voluntary form change still applies", () => {
    const hero = run(start(), changeForm).session;
    const again = sessionApply(hero, changeForm, deps);
    expect(again.ok).toBe(false);
  });

  it("back to alter-ego: the support side returns to the play area and nothing leaves the identity", () => {
    const hero = run(start(), changeForm).session.state;
    const id = identityId(hero);
    const other = otherCardId(hero);
    const tired = patch(patch(hero, id, { exhausted: true, damage: 5 }), other, { exhausted: false });

    const after = run(newRound(tired), changeForm).session.state;
    expect(seat(after).identity.form).toBe("alterEgo");
    expect(mustInstance(after, other)).toMatchObject({ cardId: SUPPORT_SIDE, attachedTo: null, exhausted: true });
    expect(seat(after).playArea).toContain(other);
    expect(mustInstance(after, id)).toMatchObject({ damage: 5, exhausted: false, attachments: [] });
  });

  it("counters on the card that becomes the identity are discarded (RRG 1.8 'Flip', p. 20: another card type)", () => {
    const base = start();
    const other = otherCardId(base);
    const { session, events } = run(patch(base, other, { counters: { sym: 2 } }), changeForm);
    expect(mustInstance(session.state, other).counters).toEqual({});
    expect(mustInstance(session.state, identityId(session.state)).counters).toEqual({});
    expect(events).toContainEqual(
      expect.objectContaining({ type: "separatedCardFlipped", discardedCounters: { sym: 2 } }),
    );
  });
});

describe("§3.24 'if one form is defeated, both forms are considered to be defeated'", () => {
  it("a defeat in hero form eliminates the player and takes the other card with the identity", () => {
    const hero = run(start(), changeForm).session.state;
    const other = otherCardId(hero);
    const { session } = run(hero, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: identityId(hero),
      abilityId: SELF_DESTRUCT.ref.id,
      payment: [],
    });
    const after = session.state;
    expect(seat(after).eliminated).toBe(true);
    expect(mustPlayer(after, P2).eliminated).toBe(false);
    expect(locateCard(after, other)).toEqual({ kind: "discard", playerId: P1 });
  });

  it("a defeat in alter-ego form does the same", () => {
    const base = start();
    const other = otherCardId(base);
    const { session } = run(base, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: identityId(base),
      abilityId: SELF_DESTRUCT.ref.id,
      payment: [],
    });
    expect(seat(session.state).eliminated).toBe(true);
    expect(locateCard(session.state, other)).toEqual({ kind: "discard", playerId: P1 });
  });
});

describe("§3.24 with §3.31: the non-identity sides cannot be blanked", () => {
  const blanked = (state: GameState, id: InstanceId): GameState => ({
    ...state,
    lastingEffects: [
      ...state.lastingEffects,
      { id: "test.blank", kind: "blankTextBox", targets: [id], duration: { kind: "endOfPhase" } },
    ],
  });

  it("a lasting blank leaves either side's text live, in both forms", () => {
    const base = start();
    const other = otherCardId(base);
    const aeState = blanked(base, other);
    expect(textBoxBlankFor(aeState, other, deps)).toBe(false);
    expect(activeAbilityRefs(aeState, other, deps).map((r) => r.id)).toEqual([SUIT_UNBLANKABLE.ref.id]);

    const heroState = run(aeState, changeForm).session.state;
    expect(textBoxBlankFor(heroState, other, deps)).toBe(false);
    expect(activeAbilityRefs(heroState, other, deps).map((r) => r.id)).toEqual([PILOT_UNBLANKABLE.ref.id]);
    expect(hasKeyword(heroState, other, "permanent", deps)).toBe(true);
  });
});
