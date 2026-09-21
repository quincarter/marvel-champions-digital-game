import { activeEncounterDeck, activeVillain } from "./query.js";
import { withEncounterPiles } from "./testing/scenario.js";
import { flat, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubAttachment,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubResource,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { giveCards, newGame, resolvePending, RESOURCE, runWith, settle, settleUntil } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const play = (
  id: InstanceId,
  attachTo: InstanceId | null = null,
  payment: Command extends never ? never : readonly { fromHand: InstanceId }[] = [],
): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: attachTo,
});

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });
const SCHEME = (acceleration = 0) =>
  stubMainScheme({
    id: "scheme",
    stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(acceleration) }],
  });
const VILLAIN = (atk = 2, sch = 0) => stubVillain({ id: "villain", stages: [{ hp: flat(30), atk, sch }] });
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 3, boostIcons: 0 });

interface Setup {
  readonly cards?: readonly AnyCard[];
  readonly abilities?: readonly StubAbility[];
  readonly villain?: ReturnType<typeof stubVillain>;
  readonly scheme?: ReturnType<typeof stubMainScheme>;
  readonly encounter?: readonly CardId[];
  readonly identity?: ReturnType<typeof stubIdentity>;
}

function setup({ cards = [], abilities = [], villain = VILLAIN(), scheme = SCHEME(), encounter, identity }: Setup) {
  const deps = depsOf(...abilities);
  const playerCards = cards.filter((c) => ["ally", "event", "support", "upgrade", "resource"].includes(c.type));
  const state = newGame({
    villain,
    mainScheme: scheme,
    extraCards: [BLANK, MENTAL, THUG, ...cards],
    deck: [...playerCards.flatMap((c) => copies(c.id)), ...copies(MENTAL.id), ...copies(RESOURCE.id, 8)],
    encounterDeck: encounter ?? copies(BLANK.id, 20),
    ...(identity ? { identity } : {}),
    deps,
  });
  return { deps, state };
}

const identityOf = (state: GameState) => mustPlayer(state, p1).identity.instanceId;
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const pick = (deps: EngineDeps, state: GameState, optionPrefix: string) => {
  const option = state.pendingChoice?.options.find((o) => o.optionId.startsWith(optionPrefix));
  if (!option) throw new Error(`no option ${optionPrefix} in ${state.pendingChoice?.prompt.kind}`);
  return resolvePending(state, [option.optionId], deps);
};
/**
 * An in-hand event offered in a window: selecting it *is* playing it.
 *
 * A 0-cost event asks for no payment. The player already opted in at
 * `chooseTriggers` (which allows selecting nothing, and is where declining
 * belongs), so a second sheet offering to pay nothing is a prompt with no
 * question in it — see `requestWindowPayment`, which now short-circuits at zero
 * the way `triggerCandidate` always did for in-play abilities.
 */
const playFromWindow = (deps: EngineDeps, state: GameState, eventId: InstanceId) => {
  const offered = settleUntil(state, "chooseTriggers", deps);
  return pick(deps, offered, `${eventId}:`);
};
const minionIn = (state: GameState) =>
  mustPlayer(state, p1).playArea.filter((id) => state.instances[id]?.cardId === THUG.id);
const blastAbility = stubAbility(
  "blast",
  def({
    trigger: { kind: "action" },
    label: ["attack"],
    effects: [
      { kind: "chooseTarget", slot: "m", chooser: { kind: "controller" }, query: { categories: ["minion"] } },
      { kind: "attack", target: { kind: "slot", slot: "m" }, amount: { kind: "const", value: 3 } },
    ],
  }),
);
const BLAST = stubEvent({ id: "blast", cost: 0, abilities: [blastAbility.ref] });
const blast = (deps: EngineDeps, state: GameState, eventId: InstanceId, minion: InstanceId) =>
  resolvePending(runWith(deps, state, play(eventId)), [minion], deps);

describe("prevention (RRG 'Prevent')", () => {
  it("'prevent all of that damage' (Backflip) — a (defense) interrupt to attack damage", () => {
    const backflip = stubAbility(
      "backflip",
      def({
        trigger: {
          kind: "interrupt",
          forced: false,
          on: { on: "dealDamage", fromAttack: true, targetIs: { categories: ["identity"], controller: "you" } },
        },
        label: ["defense"],
        effects: [{ kind: "preventDamage" }],
      }),
    );
    const BACKFLIP = stubEvent({ id: "backflip", cost: 0, abilities: [backflip.ref] });
    const { deps, state } = setup({ cards: [BACKFLIP], abilities: [backflip] });
    const given = giveCards(state, p1, "backflip");
    const atDefense = settleUntil(runWith(deps, given.state, toHero, endTurn), "declareDefender", deps);
    const after = settle(
      playFromWindow(deps, resolvePending(atDefense, ["decline"], deps), given.ids[0] as InstanceId),
      undefined,
      deps,
    );
    expect(damageOn(after, identityOf(after))).toBe(0);
    expect(mustPlayer(after, p1).discard).toContain(given.ids[0]);
  });

  it("'discard Cosmic Flight → prevent 3 of that damage'", () => {
    const flight = stubAbility(
      "cosmic-flight",
      def({
        trigger: {
          kind: "interrupt",
          forced: false,
          form: "hero",
          on: { on: "dealDamage", targetIs: { categories: ["identity"], controller: "you" } },
        },
        label: ["defense"],
        cost: { discardSelf: true },
        effects: [{ kind: "preventDamage", amount: { kind: "const", value: 3 } }],
      }),
    );
    const FLIGHT = stubUpgrade({ id: "flight", cost: 0, abilities: [flight.ref] });
    const { deps, state } = setup({ cards: [FLIGHT], abilities: [flight], villain: VILLAIN(5) });
    const given = giveCards(state, p1, "flight");
    const flightId = given.ids[0] as InstanceId;
    const atDefense = settleUntil(runWith(deps, given.state, toHero, play(flightId), endTurn), "declareDefender", deps);
    const offered = settleUntil(resolvePending(atDefense, ["decline"], deps), "chooseTriggers", deps);
    const after = settle(pick(deps, offered, `${flightId}:`), undefined, deps);
    expect(damageOn(after, identityOf(after))).toBe(2);
    expect(mustPlayer(after, p1).discard).toContain(flightId);
  });

  it("'When threat would be placed on a scheme, prevent 1 of that threat' (limit once per round)", () => {
    const iObject = stubAbility(
      "i-object",
      def({
        trigger: { kind: "interrupt", forced: false, form: "alterEgo", on: { on: "placeThreat" } },
        limit: { count: 1, period: "round" },
        effects: [{ kind: "preventThreat", amount: { kind: "const", value: 1 } }],
      }),
    );
    const identity = stubIdentity({
      id: "walters",
      hp: 15,
      atk: 3,
      thw: 1,
      def: 2,
      rec: 5,
      heroHandSize: 4,
      alterEgoHandSize: 6,
      alterEgoAbilities: [iObject.ref],
    });
    const { deps, state } = setup({ abilities: [iObject], identity, villain: VILLAIN(0, 2), scheme: SCHEME(1) });
    const offered = settleUntil(runWith(deps, state, endTurn), "chooseTriggers", deps);
    // Step 1 places 1 (prevented); the villain then schemes for 2 (limit used up).
    const after = settle(pick(deps, offered, `${identityOf(state)}:`), undefined, deps);
    expect(threat(after)).toBe(7);
  });

  it("'When the villain schemes, reduce the amount of threat placed by 1' (Emergency)", () => {
    const emergency = stubAbility(
      "emergency",
      def({
        trigger: { kind: "interrupt", forced: false, on: { on: "enemyScheme", sourceIs: { categories: ["villain"] } } },
        label: ["thwart"],
        effects: [{ kind: "modifyAttack", threatBonus: { kind: "const", value: -1 } }],
      }),
    );
    const EMERGENCY = stubEvent({ id: "emergency", cost: 0, abilities: [emergency.ref] });
    const { deps, state } = setup({ cards: [EMERGENCY], abilities: [emergency], villain: VILLAIN(0, 2) });
    const given = giveCards(state, p1, "emergency");
    const after = settle(
      playFromWindow(deps, runWith(deps, given.state, endTurn), given.ids[0] as InstanceId),
      undefined,
      deps,
    );
    expect(threat(after)).toBe(6);
  });
});

describe("replacement effects (RRG 'Replacement Effect', '\"Instead\"')", () => {
  it("'When threat would be placed on a scheme, you take it as damage instead' (Great Responsibility)", () => {
    const great = stubAbility(
      "great-responsibility",
      def({
        trigger: { kind: "interrupt", forced: false, form: "hero", on: { on: "placeThreat" } },
        effects: [
          {
            kind: "replaceTriggeringEvent",
            with: [
              {
                kind: "dealDamage",
                target: { kind: "identityOf", player: { kind: "controller" } },
                amount: { kind: "eventAmount" },
              },
            ],
          },
        ],
      }),
    );
    const GREAT = stubEvent({ id: "great", cost: 0, abilities: [great.ref] });
    const { deps, state } = setup({ cards: [GREAT], abilities: [great], scheme: SCHEME(2) });
    const given = giveCards(state, p1, "great");
    const replaced = playFromWindow(deps, runWith(deps, given.state, toHero, endTurn), given.ids[0] as InstanceId);
    expect(threat(replaced)).toBe(5);
    expect(damageOn(replaced, identityOf(replaced))).toBe(2);
  });

  it("'When any amount of damage would be dealt to Rhino, place it here instead; at 5+ discard this' (Armored Rhino Suit)", () => {
    const suit = stubAbility(
      "rhino-suit",
      def({
        trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { categories: ["villain"] } } },
        effects: [
          {
            kind: "replaceTriggeringEvent",
            with: [
              { kind: "placeDamage", target: { kind: "self" }, amount: { kind: "eventAmount" } },
              {
                kind: "if",
                condition: { kind: "damagedAtLeast", of: { kind: "self" }, amount: 5 },
                then: [{ kind: "discardFromPlay", target: { kind: "self" } }],
              },
            ],
          },
        ],
      }),
    );
    const SUIT = stubAttachment({
      id: "suit",
      attachesTo: { kind: "villain" },
      keywords: [{ name: "setup" }],
      abilities: [suit.ref],
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
    const { deps, state } = setup({
      cards: [SUIT, KICK],
      abilities: [suit, kick],
      encounter: [SUIT.id, ...copies(BLANK.id, 20)],
    });
    const suitId = mustInstance(state, activeVillain(state).instanceId).attachments[0] as InstanceId;
    const given = giveCards(state, p1, "kick", "kick", "kick");
    const [k1, k2, k3] = given.ids as [InstanceId, InstanceId, InstanceId];
    const once = runWith(deps, given.state, toHero, play(k1));
    expect([damageOn(once, activeVillain(once).instanceId), damageOn(once, suitId)]).toEqual([0, 3]);
    const twice = runWith(deps, once, play(k2));
    expect(activeEncounterDeck(twice).discard).toContain(suitId);
    expect(damageOn(twice, activeVillain(twice).instanceId)).toBe(0);
    const thrice = runWith(deps, twice, play(k3));
    expect(damageOn(thrice, activeVillain(thrice).instanceId)).toBe(3);

    // Replay of the same line, from its log, reaches the identical state.
    let session: GameSession = startSession(given.state);
    for (const command of [toHero, play(k1), play(k2), play(k3)]) {
      const result = sessionApply(session, command, deps);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    }
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("'When attached minion would be defeated, heal all damage from it instead, then discard this card' (Biomechanical Upgrades)", () => {
    const bio = stubAbility(
      "bio",
      def({
        trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", targetIs: { hostOfSelf: true } } },
        effects: [
          {
            kind: "replaceTriggeringEvent",
            with: [
              { kind: "heal", target: { kind: "host" }, amount: { kind: "const", value: 99 } },
              { kind: "discardFromPlay", target: { kind: "self" } },
            ],
          },
        ],
      }),
    );
    const BIO = stubAttachment({ id: "bio", attachesTo: { kind: "minionWithHighestPrintedHp" }, abilities: [bio.ref] });
    const { deps, state } = setup({
      cards: [BIO, BLAST],
      abilities: [bio, blastAbility],
      encounter: [...copies(THUG.id, 20), BIO.id],
    });
    const roundTwo = settle(runWith(deps, state, endTurn), undefined, deps);
    const [thug] = minionIn(roundTwo) as [InstanceId];
    // Put the attachment on the minion directly (test surgery), wherever it currently is.
    const bioId = Object.values(roundTwo.instances).find((i) => i.cardId === BIO.id)?.instanceId as InstanceId;
    const withBio: GameState = {
      ...roundTwo,
      encounterDecks: withEncounterPiles(roundTwo, {
        deck: activeEncounterDeck(roundTwo).deck.filter((id) => id !== bioId),
        discard: activeEncounterDeck(roundTwo).discard.filter((id) => id !== bioId),
      }).encounterDecks,
      instances: {
        ...roundTwo.instances,
        [bioId]: { ...mustInstance(roundTwo, bioId), attachedTo: thug, faceup: true },
        [thug]: { ...mustInstance(roundTwo, thug), attachments: [...mustInstance(roundTwo, thug).attachments, bioId] },
      },
    };
    const given = giveCards(withBio, p1, "blast", "blast");
    const [b1, b2] = given.ids as [InstanceId, InstanceId];
    const saved = blast(deps, runWith(deps, given.state, toHero), b1, thug);
    expect(minionIn(saved)).toContain(thug);
    expect(damageOn(saved, thug)).toBe(0);
    expect(activeEncounterDeck(saved).discard).toContain(bioId);
    const gone = blast(deps, saved, b2, thug);
    expect(minionIn(gone)).not.toContain(thug);
  });

  it("'When attached enemy would attack, discard Webbed Up instead. Then, stun that enemy.'", () => {
    const webbed = stubAbility(
      "webbed-up",
      def({
        trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { hostOfSelf: true } } },
        effects: [
          { kind: "bindTargets", slot: "enemy", target: { kind: "host" } },
          { kind: "cancelTriggeringEvent" },
          { kind: "discardFromPlay", target: { kind: "self" } },
          { kind: "giveStatus", target: { kind: "slot", slot: "enemy" }, status: "stunned" },
        ],
      }),
    );
    // "Attach to an enemy."
    const WEBBED: AnyCard = {
      ...stubUpgrade({ id: "webbed", cost: 0, abilities: [webbed.ref] }),
      attachesTo: { kind: "enemy" },
    };
    const { deps, state } = setup({ cards: [WEBBED], abilities: [webbed], villain: VILLAIN(3) });
    const given = giveCards(state, p1, "webbed");
    const webbedId = given.ids[0] as InstanceId;
    const after = settle(
      runWith(deps, given.state, toHero, play(webbedId, activeVillain(state).instanceId), endTurn),
      undefined,
      deps,
    );
    expect(damageOn(after, identityOf(after))).toBe(0);
    expect(mustInstance(after, activeVillain(after).instanceId).statuses.stunned).toBe(1);
    expect(mustPlayer(after, p1).discard).toContain(webbedId);
  });

  it("'When attached minion is defeated, remove 3 threat from a scheme' (Spider-Tracer) — the defeat interrupt sees the host in play", () => {
    const tracer = stubAbility(
      "tracer",
      def({
        trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", targetIs: { hostOfSelf: true } } },
        effects: [{ kind: "removeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 } }],
      }),
    );
    // "Attach to a minion."
    const TRACER: AnyCard = {
      ...stubUpgrade({ id: "tracer", cost: 0, abilities: [tracer.ref] }),
      attachesTo: { kind: "minion" },
    };
    const { deps, state } = setup({
      cards: [TRACER, BLAST],
      abilities: [tracer, blastAbility],
      encounter: copies(THUG.id, 20),
    });
    const roundTwo = settle(runWith(deps, state, endTurn), undefined, deps);
    const [thug] = minionIn(roundTwo) as [InstanceId];
    const given = giveCards(roundTwo, p1, "tracer", "blast");
    const [tracerId, blastId] = given.ids as [InstanceId, InstanceId];
    const before = threat(given.state);
    const after = blast(deps, runWith(deps, given.state, toHero, play(tracerId, thug)), blastId, thug);
    expect(minionIn(after)).not.toContain(thug);
    expect(threat(after)).toBe(before - 3);
    expect(mustPlayer(after, p1).discard).toContain(tracerId);
  });
});

describe("cancelling a revealed encounter card (RRG 'Cancel', 'Surge')", () => {
  it("'cancel its When Revealed effects' (Enhanced Spider-Sense) also cancels surge", () => {
    const bomb = stubAbility(
      "bomb",
      def({
        trigger: { kind: "whenRevealed" },
        effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 } }],
      }),
    );
    const BOMB = stubTreachery({ id: "bomb", boostIcons: 0, keywords: [{ name: "surge" }], abilities: [bomb.ref] });
    const sense = stubAbility(
      "spider-sense",
      def({
        trigger: {
          kind: "interrupt",
          forced: false,
          form: "hero",
          on: { on: "encounterCardRevealing", targetIs: { categories: ["treachery"] } },
        },
        effects: [{ kind: "cancelWhenRevealed" }],
      }),
    );
    const SENSE = stubEvent({ id: "sense", cost: 0, abilities: [sense.ref] });
    const { deps, state } = setup({ cards: [BOMB, SENSE], abilities: [bomb, sense], encounter: copies(BOMB.id, 20) });
    const given = giveCards(state, p1, "sense");
    const atDefense = settleUntil(runWith(deps, given.state, toHero, endTurn), "declareDefender", deps);
    const after = settle(
      playFromWindow(deps, resolvePending(atDefense, ["decline"], deps), given.ids[0] as InstanceId),
      undefined,
      deps,
    );
    expect(threat(after)).toBe(5);
    expect(after.round).toBe(2);
    expect(mustPlayer(after, p1).discard).toContain(given.ids[0]);
  });

  it("'exhaust Black Widow and spend a [mental] resource → cancel the effects of that card and discard it; reveal another'", () => {
    const widow = stubAbility(
      "widow",
      def({
        trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
        cost: { exhaustSelf: true, resources: { mental: 1 } },
        effects: [{ kind: "cancelRevealedCard" }, { kind: "revealEncounterCard", player: { kind: "controller" } }],
      }),
    );
    const WIDOW = stubAlly({ id: "widow", cost: 0, atk: 1, thw: 2, hp: 2, abilities: [widow.ref] });
    const { deps, state } = setup({ cards: [WIDOW], abilities: [widow], encounter: copies(THUG.id, 20) });
    const given = giveCards(state, p1, "widow", "mental");
    const [widowId, mentalId] = given.ids as [InstanceId, InstanceId];
    const offered = settleUntil(runWith(deps, given.state, play(widowId), endTurn), "chooseTriggers", deps);
    const prompt = offered.pendingChoice?.prompt;
    const firstRevealed = (
      prompt?.kind === "chooseTriggers" && prompt.event.kind === "encounterCardRevealing"
        ? prompt.event.instanceId
        : null
    ) as InstanceId;
    const paying = pick(deps, offered, `${widowId}:`);
    const after = settle(resolvePending(paying, [`hand:${mentalId}`], deps), undefined, deps);
    expect(activeEncounterDeck(after).discard).toContain(firstRevealed);
    expect(minionIn(after)).toHaveLength(1);
    expect(minionIn(after)).not.toContain(firstRevealed);
    expect(mustInstance(after, widowId).exhausted).toBe(true);
  });
});
