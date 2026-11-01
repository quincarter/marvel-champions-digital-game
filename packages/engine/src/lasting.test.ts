import { activeEncounterDeck, activeVillain } from "./query.js";
import { withEncounterPiles } from "./testing/scenario.js";
import { flat, trait, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { characterProfile, handSize, mustInstance, mustPlayer, textBoxBlank } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubAttachment,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import {
  ALLY,
  giveCard,
  giveCards,
  newGame,
  resolvePending,
  RESOURCE,
  runWith,
  settle,
  settleUntil,
} from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const play = (id: InstanceId, payment: readonly InstanceId[] = []): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: payment.map((fromHand) => ({ fromHand })),
  attachToInstanceId: null,
});
const use = (id: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: abilityId as never,
  payment: [],
});
const you = { kind: "identityOf", player: { kind: "controller" } } as const;
const AERIAL = trait("Aerial");
const TECH = trait("Tech");
const DRONE = trait("Drone");

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });

interface Setup {
  readonly cards?: readonly AnyCard[];
  readonly abilities?: readonly StubAbility[];
  readonly villain?: ReturnType<typeof stubVillain>;
  readonly scheme?: ReturnType<typeof stubMainScheme>;
  readonly encounter?: readonly CardId[];
  readonly identity?: ReturnType<typeof stubIdentity>;
}

function setup({ cards = [], abilities = [], villain = VILLAIN, scheme = SCHEME, encounter, identity }: Setup) {
  const deps = depsOf(...abilities);
  const playerCards = cards.filter((c) => ["ally", "event", "support", "upgrade", "resource"].includes(c.type));
  const state = newGame({
    villain,
    mainScheme: scheme,
    extraCards: [BLANK, ...cards],
    deck: [...playerCards.flatMap((c) => copies(c.id)), ...copies(RESOURCE.id, 8), ...copies(ALLY.id)],
    encounterDeck: encounter ?? copies(BLANK.id, 20),
    ...(identity ? { identity } : {}),
    deps,
  });
  return { deps, state };
}

const identityOf = (state: GameState) => mustPlayer(state, p1).identity.instanceId;
const profile = (deps: EngineDeps, state: GameState, id: InstanceId) => characterProfile(state, id, deps);
const patch = (state: GameState, id: InstanceId, change: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...(state.instances[id] as CardInstance), ...change } },
});
const kick = stubAbility(
  "kick",
  def({
    trigger: { kind: "action" },
    label: ["attack"],
    effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 3 } }],
  }),
);
const KICK = stubEvent({ id: "kick", cost: 0, abilities: [kick.ref] });
const engaged = (state: GameState, card: AnyCard) =>
  mustPlayer(state, p1).playArea.filter((id) => state.instances[id]?.cardId === card.id);

describe("lasting effects (RRG 'Lasting Effects')", () => {
  it("'Until the end of the phase, X gets +2 ATK' expires with the phase", () => {
    const boost = stubAbility(
      "vision",
      def({
        trigger: { kind: "action" },
        effects: [
          {
            kind: "modifyStatUntil",
            stat: "atk",
            amount: { kind: "const", value: 2 },
            target: you,
            until: "endOfPhase",
          },
        ],
      }),
    );
    const VISION = stubSupport({ id: "vision", cost: 0, abilities: [boost.ref] });
    const { deps, state } = setup({ cards: [VISION], abilities: [boost] });
    const given = giveCards(state, p1, "vision");
    const boosted = runWith(
      deps,
      given.state,
      toHero,
      play(given.ids[0] as InstanceId),
      use(given.ids[0] as InstanceId, "vision"),
    );
    expect(profile(deps, boosted, identityOf(boosted))?.atk).toBe(4);
    const later = settle(
      runWith(deps, boosted, endTurn),
      (s) =>
        s.pendingChoice?.prompt.kind === "declareDefender"
          ? ["decline"]
          : (s.pendingChoice?.options.slice(0, s.pendingChoice.minSelections).map((o) => o.optionId) ?? []),
      deps,
    );
    expect(later.round).toBe(2);
    expect(profile(deps, later, identityOf(later))?.atk).toBe(2);
    expect(later.lastingEffects).toEqual([]);
  });

  it("'Each character that player controls gets +1 THW' also affects a character that enters play later", () => {
    const lead = stubAbility(
      "lead",
      def({
        trigger: { kind: "action" },
        effects: [
          {
            kind: "modifyStatUntil",
            stat: "thw",
            amount: { kind: "const", value: 1 },
            affects: { categories: ["character"], controller: "you" },
            until: "endOfPhase",
          },
        ],
      }),
    );
    const LEAD = stubEvent({ id: "lead", cost: 0, abilities: [lead.ref] });
    const { deps, state } = setup({ cards: [LEAD], abilities: [lead] });
    const given = giveCards(state, p1, "lead", ALLY.id, RESOURCE.id, RESOURCE.id);
    const [leadId, allyId, r1, r2] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const after = runWith(deps, given.state, toHero, play(leadId), play(allyId, [r1, r2]));
    expect(profile(deps, after, identityOf(after))?.thw).toBe(3);
    expect(profile(deps, after, allyId)?.thw).toBe(2);
  });

  it("'Until the end of his attack, Ultron gets +N ATK' ends with the attack", () => {
    const surge = stubAbility(
      "ultron-ii",
      def({
        trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
        effects: [
          {
            kind: "modifyStatUntil",
            stat: "atk",
            amount: { kind: "const", value: 2 },
            target: { kind: "villain" },
            until: "endOfAttack",
          },
        ],
      }),
    );
    const villain = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0, abilities: [surge.ref] }] });
    const { deps, state } = setup({ abilities: [surge], villain });
    const atDefense = settleUntil(runWith(deps, state, toHero, endTurn), "declareDefender", deps);
    const after = resolvePending(atDefense, ["decline"], deps);
    expect(mustInstance(after, identityOf(after)).damage).toBe(4);
    expect(profile(deps, after, activeVillain(after).instanceId)?.atk).toBe(2);
    expect(after.lastingEffects).toEqual([]);
  });

  it("'gain the Aerial trait until the end of the phase' feeds 'N damage (M instead if you have the Aerial trait)'", () => {
    const boots = stubAbility(
      "rocket-boots",
      def({
        trigger: { kind: "action", form: "hero" },
        effects: [{ kind: "grantTraitUntil", trait: AERIAL, target: you, until: "endOfPhase" }],
      }),
    );
    const punch = stubAbility(
      "supersonic",
      def({
        trigger: { kind: "action", form: "hero" },
        label: ["attack"],
        effects: [
          {
            kind: "attack",
            target: { kind: "villain" },
            amount: {
              kind: "conditional",
              if: { kind: "hasTrait", of: you, trait: AERIAL },
              then: { kind: "const", value: 8 },
              else: { kind: "const", value: 4 },
            },
          },
        ],
      }),
    );
    const BOOTS = stubUpgrade({ id: "boots", cost: 0, abilities: [boots.ref] });
    const PUNCH = stubEvent({ id: "punch", cost: 0, abilities: [punch.ref] });
    const { deps, state } = setup({ cards: [BOOTS, PUNCH], abilities: [boots, punch] });
    const given = giveCards(state, p1, "boots", "punch", "punch");
    const [bootsId, p1Id, p2Id] = given.ids as [InstanceId, InstanceId, InstanceId];
    const first = runWith(deps, given.state, toHero, play(bootsId), play(p1Id));
    expect(mustInstance(first, activeVillain(first).instanceId).damage).toBe(4);
    const second = runWith(deps, first, use(bootsId, "rocket-boots"), play(p2Id));
    expect(mustInstance(second, activeVillain(second).instanceId).damage).toBe(12);
  });

  it("'At the end of the round, if Nick Fury is still in play, discard him' (a delayed effect)", () => {
    const fury = stubAbility(
      "nick-fury",
      def({
        trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
        effects: [
          {
            kind: "atEndOfRound",
            effects: [
              {
                kind: "if",
                condition: { kind: "exists", query: { self: true } },
                then: [{ kind: "discardFromPlay", target: { kind: "self" } }],
              },
            ],
          },
        ],
      }),
    );
    const FURY = stubAlly({ id: "fury", cost: 0, atk: 2, thw: 2, hp: 3, abilities: [fury.ref] });
    const { deps, state } = setup({ cards: [FURY], abilities: [fury] });
    const given = giveCards(state, p1, "fury");
    const furyId = given.ids[0] as InstanceId;
    const inPlay = runWith(deps, given.state, play(furyId));
    expect(inPlay.lastingEffects.map((e) => e.kind)).toEqual(["delayedEffects"]);
    expect(mustPlayer(inPlay, p1).playArea).toContain(furyId);
    const nextRound = settle(runWith(deps, inPlay, endTurn), undefined, deps);
    expect(nextRound.round).toBe(2);
    expect(mustPlayer(nextRound, p1).discard).toContain(furyId);
    expect(nextRound.lastingEffects).toEqual([]);
  });
});

describe("constant abilities with computed amounts, grants and rules", () => {
  it("'+1 THW for each side scheme in play' (Jessica Jones)", () => {
    const jj = stubAbility(
      "jessica",
      def({
        trigger: {
          kind: "constant",
          modifiers: [
            { stat: "thw", amount: { kind: "count", query: { categories: ["sideScheme"] } }, target: { self: true } },
          ],
        },
        effects: [],
      }),
    );
    const JJ = stubAlly({ id: "jj", cost: 0, atk: 2, thw: 1, hp: 3, abilities: [jj.ref] });
    const SIDE = stubSideScheme({ id: "side", startingThreat: 2, boostIcons: 0 });
    const { deps, state } = setup({
      cards: [JJ, SIDE],
      abilities: [jj],
      encounter: [SIDE.id, ...copies(BLANK.id, 10)],
    });
    const sideId = activeEncounterDeck(state).deck.find((id) => state.instances[id]?.cardId === SIDE.id) as InstanceId;
    const withSide: GameState = {
      ...withEncounterPiles(state, { deck: activeEncounterDeck(state).deck.filter((id) => id !== sideId) }),
      villainArea: [...state.villainArea, sideId],
    };
    const given = giveCards(withSide, p1, "jj");
    const after = runWith(deps, given.state, play(given.ids[0] as InstanceId));
    expect(profile(deps, after, given.ids[0] as InstanceId)?.thw).toBe(2);
  });

  it("'X is equal to Titania's remaining hit points' (printed ATK X)", () => {
    const titaniaX = stubAbility(
      "titania",
      def({
        trigger: {
          kind: "constant",
          modifiers: [{ stat: "atk", amount: { kind: "remainingHp", of: { kind: "self" } }, target: { self: true } }],
        },
        effects: [],
      }),
    );
    const TITANIA = stubMinion({ id: "titania", atk: "X", sch: 1, hp: 6, boostIcons: 0, abilities: [titaniaX.ref] });
    const { deps, state } = setup({ cards: [TITANIA], abilities: [titaniaX], encounter: copies(TITANIA.id, 20) });
    const roundTwo = settle(runWith(deps, state, endTurn), undefined, deps);
    const [titania] = engaged(roundTwo, TITANIA) as [InstanceId];
    expect(profile(deps, roundTwo, titania)?.atk).toBe(6);
    expect(profile(deps, patch(roundTwo, titania, { damage: 2 }), titania)?.atk).toBe(4);
  });

  it("'You get +1 hand size for each Tech upgrade you control (to a maximum hand size of 7)' (Iron Man)", () => {
    const armor = stubAbility(
      "iron-man",
      def({
        trigger: {
          kind: "constant",
          modifiers: [
            {
              stat: "handSize",
              amount: {
                kind: "scaled",
                value: { kind: "count", query: { categories: ["upgrade"], controller: "you", trait: TECH } },
                max: 6,
              },
              target: { self: true },
            },
          ],
        },
        effects: [],
      }),
    );
    const identity = stubIdentity({
      id: "stark",
      hp: 9,
      atk: 1,
      thw: 2,
      def: 1,
      rec: 3,
      heroHandSize: 1,
      alterEgoHandSize: 6,
      heroAbilities: [armor.ref],
    });
    const GADGET = stubUpgrade({ id: "gadget", cost: 0, traits: [TECH] });
    const { deps, state } = setup({ cards: [GADGET], abilities: [armor], identity });
    const given = giveCards(state, p1, "gadget", "gadget");
    const hero = runWith(deps, given.state, toHero);
    expect(handSize(hero, p1, deps)).toBe(1);
    const suited = runWith(deps, hero, play(given.ids[0] as InstanceId), play(given.ids[1] as InstanceId));
    expect(handSize(suited, p1, deps)).toBe(3);
  });

  it("'Klaw gains retaliate 1' — a granted keyword works like a printed one", () => {
    const body = stubAbility(
      "solid-sound",
      def({
        trigger: {
          kind: "constant",
          keywordGrants: [{ keyword: { name: "retaliate", value: 1 }, target: { hostOfSelf: true } }],
        },
        effects: [],
      }),
    );
    const BODY = stubAttachment({
      id: "body",
      attachesTo: { kind: "villain" },
      keywords: [{ name: "setup" }],
      abilities: [body.ref],
    });
    const { deps, state } = setup({
      cards: [BODY, KICK],
      abilities: [body, kick],
      encounter: [BODY.id, ...copies(BLANK.id, 20)],
    });
    const given = giveCards(state, p1, "kick");
    const after = runWith(deps, given.state, toHero, play(given.ids[0] as InstanceId));
    expect(mustInstance(after, identityOf(after)).damage).toBe(1);
  });

  it("'Captain Marvel gains the Aerial trait' + '+1 DEF (+2 DEF instead if you have the Aerial trait)'", () => {
    const flight = stubAbility(
      "cosmic-flight",
      def({
        trigger: {
          kind: "constant",
          traitGrants: [{ trait: AERIAL, target: { categories: ["identity"], controller: "you" } }],
        },
        effects: [],
      }),
    );
    const helmet = stubAbility(
      "helmet",
      def({
        trigger: {
          kind: "constant",
          modifiers: [
            {
              stat: "def",
              amount: {
                kind: "conditional",
                if: { kind: "hasTrait", of: you, trait: AERIAL },
                then: { kind: "const", value: 2 },
                else: { kind: "const", value: 1 },
              },
              target: { categories: ["hero"], controller: "you" },
            },
          ],
        },
        effects: [],
      }),
    );
    const FLIGHT = stubUpgrade({ id: "flight", cost: 0, abilities: [flight.ref] });
    const HELMET = stubUpgrade({ id: "helmet", cost: 0, abilities: [helmet.ref] });
    const { deps, state } = setup({ cards: [FLIGHT, HELMET], abilities: [flight, helmet] });
    const given = giveCards(state, p1, "helmet", "flight");
    const withHelmet = runWith(deps, given.state, toHero, play(given.ids[0] as InstanceId));
    expect(profile(deps, withHelmet, identityOf(withHelmet))?.def).toBe(3);
    const flying = runWith(deps, withHelmet, play(given.ids[1] as InstanceId));
    expect(profile(deps, flying, identityOf(flying))?.def).toBe(4);
  });

  it("'Ultron cannot take damage while a Drone minion is in play'", () => {
    const shield = stubAbility(
      "ultron-iii",
      def({
        trigger: {
          kind: "constant",
          rules: [
            {
              kind: "cannotTakeDamage",
              target: { categories: ["villain"] },
              while: { kind: "exists", query: { categories: ["minion"], trait: DRONE } },
            },
          ],
        },
        effects: [],
      }),
    );
    const villain = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0, abilities: [shield.ref] }] });
    const DRONE_MINION = stubMinion({ id: "drone", atk: 0, sch: 0, hp: 1, boostIcons: 0, traits: [DRONE] });
    const { deps, state } = setup({
      cards: [KICK, DRONE_MINION],
      abilities: [shield, kick],
      villain,
      encounter: copies(DRONE_MINION.id, 20),
    });
    const roundTwo = settle(runWith(deps, state, endTurn), undefined, deps);
    const [drone] = engaged(roundTwo, DRONE_MINION) as [InstanceId];
    const given = giveCards(roundTwo, p1, "kick", "kick");
    // RRG 1.8 "Target" (p. 43): the villain is no valid target for an attack whose only effect on it is its damage.
    const shielded = runWith(deps, given.state, toHero);
    expect(applyCommand(shielded, play(given.ids[0] as InstanceId), deps)).toMatchObject({
      ok: false,
      error: { code: "no_valid_target" },
    });
    const noDrone: GameState = {
      ...shielded,
      players: shielded.players.map((p) =>
        p.playerId === p1 ? { ...p, playArea: p.playArea.filter((id) => id !== drone) } : p,
      ),
      encounterDecks: withEncounterPiles(shielded, { discard: [...activeEncounterDeck(shielded).discard, drone] })
        .encounterDecks,
    };
    const hit = runWith(deps, noDrone, play(given.ids[1] as InstanceId));
    expect(mustInstance(hit, activeVillain(hit).instanceId).damage).toBe(3);
  });

  it("'Killmonger cannot take damage from Black Panther upgrades' — other damage still lands", () => {
    const immune = stubAbility(
      "killmonger",
      def({
        trigger: {
          kind: "constant",
          rules: [
            {
              kind: "cannotTakeDamage",
              target: { self: true },
              fromSource: { categories: ["upgrade"], trait: trait("Black Panther") },
            },
          ],
        },
        effects: [],
      }),
    );
    const KILLMONGER = stubMinion({ id: "killmonger", atk: 0, sch: 0, hp: 5, boostIcons: 0, abilities: [immune.ref] });
    const strike = (id: string, amount: number) =>
      stubAbility(
        id,
        def({
          trigger: { kind: "action" },
          label: ["attack"],
          effects: [
            { kind: "chooseTarget", slot: "m", chooser: { kind: "controller" }, query: { categories: ["minion"] } },
            { kind: "attack", target: { kind: "slot", slot: "m" }, amount: { kind: "const", value: amount } },
          ],
        }),
      );
    const claws = strike("claws", 2);
    const blast = strike("blast", 3);
    const CLAWS = stubUpgrade({
      id: "claws",
      cost: 0,
      traits: [trait("Black Panther"), trait("Weapon")],
      abilities: [claws.ref],
    });
    const BLAST = stubEvent({ id: "blast", cost: 0, abilities: [blast.ref] });
    const { deps, state } = setup({
      cards: [KILLMONGER, CLAWS, BLAST],
      abilities: [immune, claws, blast],
      encounter: copies(KILLMONGER.id, 20),
    });
    const roundTwo = settle(runWith(deps, state, endTurn), undefined, deps);
    const [km] = engaged(roundTwo, KILLMONGER) as [InstanceId];
    const given = giveCards(roundTwo, p1, "claws", "blast");
    const [clawsId, blastId] = given.ids as [InstanceId, InstanceId];
    // RRG 1.8 "Target" (p. 43): Killmonger is no valid target for the upgrade's attack, and he is the only minion.
    const clawed = runWith(deps, given.state, toHero, play(clawsId));
    expect(applyCommand(clawed, use(clawsId, "claws"), deps)).toMatchObject({
      ok: false,
      error: { code: "no_valid_target" },
    });
    const blasted = resolvePending(runWith(deps, clawed, play(blastId)), [km], deps);
    expect(mustInstance(blasted, km).damage).toBe(3);
  });

  it("'Threat cannot be removed from this scheme' (Countdown to Oblivion)", () => {
    const countdown = stubAbility(
      "countdown",
      def({
        trigger: {
          kind: "constant",
          rules: [{ kind: "threatCannotBeRemoved", target: { categories: ["mainScheme"] } }],
        },
        effects: [],
      }),
    );
    const scheme = stubMainScheme({
      id: "scheme",
      stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0), abilities: [countdown.ref] }],
    });
    const thwart = stubAbility(
      "thwart",
      def({
        trigger: { kind: "action" },
        label: ["thwart"],
        effects: [{ kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 } }],
      }),
    );
    const THWART = stubEvent({ id: "thwart", cost: 0, abilities: [thwart.ref] });
    const { deps, state } = setup({ cards: [THWART], abilities: [countdown, thwart], scheme });
    const given = giveCards(state, p1, "thwart");
    const hero = runWith(deps, given.state, toHero);
    // The main scheme cannot be thwarted, so it is no valid target and the thwart cannot be played at all (RRG 1.8
    // "Target", pp. 42–43; docs/phase7-wave3.md §4 Q5). The threat stays.
    const result = applyCommand(hero, play(given.ids[0] as InstanceId), deps);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(mustInstance(hero, hero.mainScheme.instanceId).threat).toBe(5);
  });

  it("RRG 'Ally Limit': a fourth ally forces a discard, unless the ally limit was increased (The Triskelion)", () => {
    const tris = stubAbility(
      "triskelion",
      def({ trigger: { kind: "constant", rules: [{ kind: "allyLimit", amount: 1 }] }, effects: [] }),
    );
    const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 2 });
    const TRIS = stubSupport({ id: "tris", cost: 0, abilities: [tris.ref] });
    const { deps, state } = setup({ cards: [PAL, TRIS], abilities: [tris] });
    const given = giveCards(state, p1, "pal", "pal", "pal", "pal", "tris");
    const [a, b, c, d, trisId] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const four = runWith(deps, given.state, play(a), play(b), play(c), play(d));
    expect(four.pendingChoice?.prompt).toEqual({ kind: "discardOverAllyLimit", limit: 3 });
    const discarded = resolvePending(four, [a], deps);
    expect(mustPlayer(discarded, p1).discard).toContain(a);
    const withTris = runWith(deps, given.state, play(trisId), play(a), play(b), play(c), play(d));
    expect(withTris.pendingChoice).toBeNull();
  });

  it("'The engaged player must defend against Melter's attacks with an ally they control, if able'", () => {
    const melter = stubAbility(
      "melter",
      def({
        trigger: { kind: "constant", rules: [{ kind: "mustDefendWithAlly", attacker: { self: true } }] },
        effects: [],
      }),
    );
    const MELTER = stubMinion({ id: "melter", atk: 3, sch: 1, hp: 5, boostIcons: 0, abilities: [melter.ref] });
    const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 4 });
    const { deps, state } = setup({ cards: [MELTER, PAL], abilities: [melter], encounter: copies(MELTER.id, 20) });
    const roundTwo = settle(runWith(deps, state, endTurn), undefined, deps);
    const given = giveCards(roundTwo, p1, "pal");
    const palId = given.ids[0] as InstanceId;
    const villainDefense = settleUntil(
      runWith(deps, given.state, toHero, play(palId), endTurn),
      "declareDefender",
      deps,
    );
    expect(villainDefense.pendingChoice?.options.map((o) => o.optionId)).toContain("decline");
    const melterDefense = settleUntil(resolvePending(villainDefense, ["decline"], deps), "declareDefender", deps);
    expect(melterDefense.pendingChoice?.options.map((o) => o.optionId)).toEqual([palId]);
  });
});

test("lasting and delayed effects replay to an identical state", () => {
  const boost = stubAbility(
    "vision",
    def({
      trigger: { kind: "action" },
      effects: [
        { kind: "modifyStatUntil", stat: "atk", amount: { kind: "const", value: 2 }, target: you, until: "endOfPhase" },
      ],
    }),
  );
  const fury = stubAbility(
    "nick-fury",
    def({
      trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
      effects: [{ kind: "atEndOfRound", effects: [{ kind: "discardFromPlay", target: { kind: "self" } }] }],
    }),
  );
  const VISION = stubSupport({ id: "vision", cost: 0, abilities: [boost.ref] });
  const FURY = stubAlly({ id: "fury", cost: 0, atk: 2, thw: 2, hp: 3, abilities: [fury.ref] });
  const { deps, state } = setup({ cards: [VISION, FURY], abilities: [boost, fury] });
  const given = giveCards(state, p1, "vision", "fury");
  const [visionId, furyId] = given.ids as [InstanceId, InstanceId];
  let session: GameSession = startSession(given.state);
  const apply = (command: Command) => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  };
  for (const command of [play(visionId), use(visionId, "vision"), play(furyId), endTurn]) apply(command);
  while (session.state.pendingChoice) {
    const choice = session.state.pendingChoice;
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: choice.options.slice(0, choice.minSelections).map((o) => o.optionId),
    });
  }
  expect(mustPlayer(session.state, p1).discard).toContain(furyId);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
});

/**
 * RRG 1.8 "Leaves Play" (p. 27): "When a card leaves play, there is no memory of its previous state and it is
 * considered to be a new copy of the card." A delayed effect "At the end of the phase, discard Goliath" (Goliath 23015;
 * To Me, My X-Men! 36020 "return it to hand") is bound to the copy that was in play when it was created, so it stops
 * naming the card once a new copy enters play under the same instance id (`noteLeftPlayInLastingEffects`,
 * `forgetReturnedInLastingEffects`). So is a lasting effect on fixed targets ("Goliath gets +4 ATK until the end of the
 * phase").
 * FFG ruling January 26, 2026 - Ruling 6 (marvel-champions-rulings-post-rrg-1-7.md) applies the same rule to limits:
 * they "do not apply to 'new copies' of a card, which is what a card becomes when it leaves and re-enters play".
 * Special Funding 50007's card named while in hand and still named as it enters play is covered by
 * `packages/cards/src/wave9/aos/maria-hill/events.test.ts` ("Support Staff (cost 1) paid with Special Funding: enters
 * with 3 staff counters and gains one more").
 */
describe("a delayed 'discard this at the end of the phase' and a copy that left play and came back", () => {
  const controller = { kind: "controller" } as const;
  const GOLIATH_ACTION = stubAbility("goliath.action", {
    trigger: { kind: "action" },
    effects: [{ kind: "atEndOfPhase", effects: [{ kind: "discardFromPlay", target: { kind: "self" } }] }],
  });
  const GOLIATH = stubAlly({ id: "goliath", cost: 0, atk: 1, thw: 1, hp: 5, abilities: [GOLIATH_ACTION.ref] });
  const action = (id: string, ...effects: EffectSpec[]) => {
    const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
    return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
  };
  const OUT = action("out", {
    kind: "discardFromPlay",
    target: { kind: "each", query: { categories: ["ally"], name: GOLIATH.name } },
  });
  const BACK = action(
    "back",
    {
      kind: "chooseCards",
      slot: "taken",
      from: { kind: "zone", zone: "discard", player: controller, filter: { categories: ["ally"] } },
      chooser: controller,
      min: 1,
      max: 1,
    },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "taken" }, controller },
  );
  // Sneak Attack (23017)'s shape: the delayed effect names a chosen card (a binding), not its own card.
  const SNEAK = action(
    "sneak",
    {
      kind: "chooseCards",
      slot: "ally",
      from: { kind: "zone", zone: "hand", player: controller, filter: { categories: ["ally"], name: GOLIATH.name } },
      chooser: controller,
      min: 1,
      max: 1,
    },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "ally" }, controller },
    {
      kind: "atEndOfPhase",
      effects: [
        {
          kind: "if",
          condition: { kind: "refMatches", ref: { kind: "slot", slot: "ally" }, query: { categories: ["ally"] } },
          then: [{ kind: "discardFromPlay", target: { kind: "slot", slot: "ally" } }],
        },
      ],
    },
  );
  const BOUNCE = action("bounce", {
    kind: "moveCards",
    cards: { kind: "ref", ref: { kind: "each", query: { categories: ["ally"], name: GOLIATH.name } } },
    to: "hand",
  });
  // "At the end of the phase, return this card to your hand", acted on while the card is in the discard pile.
  const RECALL_ACTION = stubAbility("recall.action", {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "atEndOfPhase",
        effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "hand" }],
      },
    ],
  });
  const RECALLED = stubAlly({ id: "recalled", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [RECALL_ACTION.ref] });
  const OUT_RECALLED = action("out-recalled", {
    kind: "discardFromPlay",
    target: { kind: "each", query: { categories: ["ally"], name: RECALLED.name } },
  });
  // Goliath 23015's "Goliath gets +4 ATK until the end of the phase": a lasting effect with a fixed target, itself.
  const GROWN_ACTION = stubAbility("grown.action", {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "modifyStatUntil",
        stat: "atk",
        amount: { kind: "const", value: 4 },
        target: { kind: "self" },
        until: "endOfPhase",
      },
    ],
  });
  const GROWN = stubAlly({ id: "grown", cost: 0, atk: 1, thw: 1, hp: 5, abilities: [GROWN_ACTION.ref] });
  const OUT_GROWN = action("out-grown", {
    kind: "discardFromPlay",
    target: { kind: "each", query: { categories: ["ally"], name: GROWN.name } },
  });
  // A second ally, so one lasting effect can have two fixed targets.
  const OTHER = stubAlly({ id: "other", cost: 0, atk: 1, thw: 1, hp: 5 });
  const PAIR = action("pair", {
    kind: "modifyStatUntil",
    stat: "atk",
    amount: { kind: "const", value: 1 },
    target: { kind: "each", query: { categories: ["ally"] } },
    until: "endOfPhase",
  });
  // "Each Grown ally gets +2 ATK until the end of the phase", read by query (`affects`), not fixed targets.
  const RALLY = action("rally", {
    kind: "modifyStatUntil",
    stat: "atk",
    amount: { kind: "const", value: 2 },
    affects: { categories: ["ally"], name: GROWN.name },
    until: "endOfPhase",
  });
  // An in-play move with a change of control: the ally is attached to the villain as a captive, still in play.
  const CAPTURE = action("capture", {
    kind: "attach",
    card: { kind: "each", query: { categories: ["ally"], name: GROWN.name } },
    to: { kind: "villain" },
    as: "captive",
  });
  // "Treat this card's printed text box as if it were blank until the end of the phase", on itself.
  const MUTE_ACTION = stubAbility("mute.action", {
    trigger: { kind: "action" },
    effects: [{ kind: "blankTextBox", target: { kind: "self" }, until: "endOfPhase" }],
  });
  const MUTED = stubAlly({ id: "muted", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [MUTE_ACTION.ref] });
  const OUT_MUTED = action("out-muted", {
    kind: "discardFromPlay",
    target: { kind: "each", query: { categories: ["ally"], name: MUTED.name } },
  });
  const deps = depsOf(
    PAIR.ability,
    RALLY.ability,
    CAPTURE.ability,
    MUTE_ACTION,
    OUT_MUTED.ability,
    GOLIATH_ACTION,
    OUT.ability,
    BACK.ability,
    SNEAK.ability,
    BOUNCE.ability,
    RECALL_ACTION,
    OUT_RECALLED.ability,
    GROWN_ACTION,
    OUT_GROWN.ability,
  );
  const startWith = (cards: readonly AnyCard[], deck: readonly CardId[]): GameState => {
    const base = gameAtFirstTurn({
      cards: [...cards, BLANK],
      deps,
      villain: stubVillain({ id: "v", stages: [{ hp: flat(40), atk: 0, sch: 0 }] }),
      encounter: copies(BLANK.id, 20),
      deck,
    });
    return { ...base, players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
  };
  const playFromHand = (s: GameState, id: InstanceId): GameState =>
    runCommands(s, deps, { type: "playCard", playerId: P1, cardInstanceId: id, payment: [], attachToInstanceId: null })
      .state;
  const playEvent = (s: GameState, card: AnyCard): GameState => {
    const given = giveCard(s, P1, card.id);
    return playFromHand(given.state, given.id);
  };

  it("the copy that returned is a new card: the old delayed discard does not touch it", () => {
    const base = gameAtFirstTurn({
      cards: [GOLIATH, OUT.card, BACK.card, BLANK],
      deps,
      villain: stubVillain({ id: "v", stages: [{ hp: flat(40), atk: 0, sch: 0 }] }),
      encounter: copies(BLANK.id, 20),
      deck: [GOLIATH.id, OUT.card.id, BACK.card.id],
    });
    let state: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    };
    const put = playerCardIntoPlay(state, GOLIATH.id);
    state = put.state;
    const used = runCommands(state, deps, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: put.id,
      abilityId: GOLIATH_ACTION.ref.id,
      payment: [],
    });
    const outAndBack = (s: GameState, card: typeof OUT.card) => {
      const given = giveCard(s, P1, card.id);
      return runCommands(given.state, deps, {
        type: "playCard",
        playerId: P1,
        cardInstanceId: given.id,
        payment: [],
        attachToInstanceId: null,
      }).state;
    };
    const left = outAndBack(used.state, OUT.card);
    expect(mustPlayer(left, P1).discard).toContain(put.id);
    const returned = outAndBack(left, BACK.card);
    expect(mustPlayer(returned, P1).playArea).toContain(put.id);
    // End of the player phase: the delayed effect of the first copy fires.
    const ended = runCommands(returned, deps, { type: "endTurn", playerId: P1 }).state;
    expect(mustPlayer(ended, P1).playArea).toContain(put.id);
  });

  it("a chosen card (Sneak Attack's shape) bounced to hand and played again is not discarded by the old effect", () => {
    let state = startWith([GOLIATH, SNEAK.card, BOUNCE.card], [GOLIATH.id, SNEAK.card.id, BOUNCE.card.id]);
    state = playEvent(giveCard(state, P1, GOLIATH.id).state, SNEAK.card);
    const goliathId = mustPlayer(state, P1).playArea.find((i) => mustInstance(state, i).cardId === GOLIATH.id)!;
    expect(state.lastingEffects.some((e) => e.kind === "delayedEffects")).toBe(true);
    state = playEvent(state, BOUNCE.card);
    expect(mustPlayer(state, P1).hand).toContain(goliathId);
    state = playFromHand(state, goliathId);
    expect(mustPlayer(state, P1).playArea).toContain(goliathId);
    const delayed = state.lastingEffects.find((e) => e.kind === "delayedEffects");
    expect(delayed?.kind === "delayedEffects" && delayed.scope.bindings["ally"]).toEqual([]);
    const ended = runCommands(state, deps, { type: "endTurn", playerId: P1 }).state;
    expect(mustPlayer(ended, P1).playArea).toContain(goliathId);
  });

  /**
   * A lasting effect with fixed targets forgets a copy that left play and came back, as a delayed effect does
   * (`forgetReturnedInLastingEffects`), and ends when that was its only target. RRG 1.8 "Leaves Play" (p. 27): "there is
   * no memory of its previous state and it is considered to be a new copy of the card"; FFG ruling January 26, 2026 -
   * Ruling 6.
   */
  it("a lasting '+4 ATK until the end of the phase' on itself (Goliath's shape) does not follow the copy that returned", () => {
    let state = startWith([GROWN, OUT_GROWN.card, BACK.card], [GROWN.id, OUT_GROWN.card.id, BACK.card.id]);
    const put = playerCardIntoPlay(state, GROWN.id);
    state = runCommands(put.state, deps, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: put.id,
      abilityId: GROWN_ACTION.ref.id,
      payment: [],
    }).state;
    expect(characterProfile(state, put.id, deps)?.atk).toBe(5);
    state = playEvent(state, OUT_GROWN.card);
    expect(mustPlayer(state, P1).discard).toContain(put.id);
    state = playEvent(state, BACK.card);
    expect(mustPlayer(state, P1).playArea).toContain(put.id);
    // Still the same phase: the effect has not expired, but the returned copy is a new card.
    expect(characterProfile(state, put.id, deps)?.atk).toBe(1);
    expect(state.lastingEffects.some((e) => e.kind === "statModifier")).toBe(false);
  });

  it("a lasting '+4 ATK' on a card that left play and has not come back still names it", () => {
    let state = startWith([GROWN, OUT_GROWN.card], [GROWN.id, OUT_GROWN.card.id]);
    const put = playerCardIntoPlay(state, GROWN.id);
    state = runCommands(put.state, deps, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: put.id,
      abilityId: GROWN_ACTION.ref.id,
      payment: [],
    }).state;
    state = playEvent(state, OUT_GROWN.card);
    expect(mustPlayer(state, P1).discard).toContain(put.id);
    const modifier = state.lastingEffects.find((e) => e.kind === "statModifier");
    expect(modifier?.kind === "statModifier" && modifier.targets).toEqual([put.id]);
    expect(modifier?.kind === "statModifier" && modifier.leftPlay).toEqual([put.id]);
  });

  const grow = (s: GameState, id: InstanceId): GameState =>
    runCommands(s, deps, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: id,
      abilityId: GROWN_ACTION.ref.id,
      payment: [],
    }).state;

  it("an effect on two fixed targets drops only the one that left play and came back, and stays on the other", () => {
    let state = startWith(
      [GROWN, OTHER, PAIR.card, OUT_GROWN.card, BACK.card],
      [GROWN.id, OTHER.id, PAIR.card.id, OUT_GROWN.card.id, BACK.card.id],
    );
    const grown = playerCardIntoPlay(state, GROWN.id);
    const other = playerCardIntoPlay(grown.state, OTHER.id);
    state = playEvent(other.state, PAIR.card);
    expect(characterProfile(state, grown.id, deps)?.atk).toBe(2);
    expect(characterProfile(state, other.id, deps)?.atk).toBe(2);
    state = playEvent(state, OUT_GROWN.card);
    state = playEvent(state, BACK.card);
    expect(mustPlayer(state, P1).playArea).toContain(grown.id);
    expect(characterProfile(state, grown.id, deps)?.atk).toBe(1);
    expect(characterProfile(state, other.id, deps)?.atk).toBe(2);
    const modifier = state.lastingEffects.find((e) => e.kind === "statModifier");
    expect(modifier?.kind === "statModifier" && modifier.targets).toEqual([other.id]);
    expect(modifier && "leftPlay" in modifier ? modifier.leftPlay : undefined).toBeUndefined();
  });

  it("a move that does not leave play (attached to the villain as a captive, no controller) keeps the effect", () => {
    let state = startWith([GROWN, CAPTURE.card], [GROWN.id, CAPTURE.card.id]);
    const put = playerCardIntoPlay(state, GROWN.id);
    state = grow(put.state, put.id);
    state = playEvent(state, CAPTURE.card);
    expect(mustInstance(state, put.id).attachedTo).toBe(state.activeVillainId);
    expect(mustInstance(state, put.id).controllerId).toBeNull();
    expect(characterProfile(state, put.id, deps)?.atk).toBe(5);
    const modifier = state.lastingEffects.find((e) => e.kind === "statModifier");
    expect(modifier?.kind === "statModifier" && modifier.targets).toEqual([put.id]);
    expect(modifier && "leftPlay" in modifier ? modifier.leftPlay : undefined).toBeUndefined();
  });

  it("a blank text box on a card that left play and came back does not blank the new copy, and ends", () => {
    let state = startWith([MUTED, OUT_MUTED.card, BACK.card], [MUTED.id, OUT_MUTED.card.id, BACK.card.id]);
    const put = playerCardIntoPlay(state, MUTED.id);
    const used = runCommands(put.state, deps, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: put.id,
      abilityId: MUTE_ACTION.ref.id,
      payment: [],
    });
    state = used.state;
    expect(textBoxBlank(state, put.id)).toBe(true);
    state = playEvent(state, OUT_MUTED.card);
    expect(textBoxBlank(state, put.id)).toBe(true);
    const blankId = state.lastingEffects.find((e) => e.kind === "blankTextBox")?.id;
    const given = giveCard(state, P1, BACK.card.id);
    const back = runCommands(given.state, deps, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    state = back.state;
    expect(mustPlayer(state, P1).playArea).toContain(put.id);
    expect(textBoxBlank(state, put.id)).toBe(false);
    expect(state.lastingEffects.some((e) => e.kind === "blankTextBox")).toBe(false);
    expect(back.events).toContainEqual({ type: "lastingEffectEnded", id: blankId, reason: "targetLeftPlay" });
  });

  it("an effect that reaches cards by query ('each Grown ally') reaches the copy that came back", () => {
    let state = startWith(
      [GROWN, RALLY.card, OUT_GROWN.card, BACK.card],
      [GROWN.id, RALLY.card.id, OUT_GROWN.card.id, BACK.card.id],
    );
    const put = playerCardIntoPlay(state, GROWN.id);
    state = playEvent(put.state, RALLY.card);
    expect(characterProfile(state, put.id, deps)?.atk).toBe(3);
    state = playEvent(state, OUT_GROWN.card);
    state = playEvent(state, BACK.card);
    expect(mustPlayer(state, P1).playArea).toContain(put.id);
    expect(characterProfile(state, put.id, deps)?.atk).toBe(3);
  });

  it("a card that left play and has not come back is still named: the delayed effect acts on it out of play", () => {
    let state = startWith([RECALLED, OUT_RECALLED.card], [RECALLED.id, OUT_RECALLED.card.id]);
    const put = playerCardIntoPlay(state, RECALLED.id);
    state = runCommands(put.state, deps, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: put.id,
      abilityId: RECALL_ACTION.ref.id,
      payment: [],
    }).state;
    state = playEvent(state, OUT_RECALLED.card);
    expect(mustPlayer(state, P1).discard).toContain(put.id);
    const ended = runCommands(state, deps, { type: "endTurn", playerId: P1 }).state;
    expect(mustPlayer(ended, P1).hand).toContain(put.id);
  });
});
