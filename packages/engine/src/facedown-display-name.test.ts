import { flat, trait, type CardId } from "@mc/content";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { candidateOption } from "./resolve/window.js";
import type { FacedownRole, GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, newGame, RESOURCE } from "./testing/scenario.js";
import { displayNameOf } from "./visibility.js";

// A card in play facedown as something else has no name the table may read (`displayNameOf`): RRG 1.8 "In Play and Out
// of Play" (p. 23), ruling of Jan 26, 2026 (4) answer 5. Every label, ref text and event field that names it says what
// it is treated as, and its printed name comes back once it leaves play.
const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const endTurn: Command = { type: "endTurn", playerId: p1 };
const toHero: Command = { type: "changeForm", playerId: p1 };
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const HIDDEN_NAME = "Hidden Printed Name";
const HIDDEN_ID = "hidden-printed-id";
const SECRET = { ...stubEvent({ id: HIDDEN_ID, cost: 0 }), name: HIDDEN_NAME };
const VILLAIN = {
  ...stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] }),
  name: "Faceup Villain",
};
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
});

// "Deal 1 damage to an enemy": the villain and the facedown minion are both offered.
const zap = stubAbility(
  "zap",
  def({
    trigger: { kind: "action", form: "hero" },
    label: ["attack"],
    effects: [
      { kind: "chooseTarget", slot: "e", chooser: { kind: "controller" }, query: { categories: ["enemy"] } },
      { kind: "attack", target: { kind: "slot", slot: "e" }, amount: { kind: "const", value: 1 } },
    ],
  }),
);
const ZAP = stubEvent({ id: "zap", cost: 0, abilities: [zap.ref] });
// Two forced responses to the same attack, so the trigger-order prompt opens over an event about the facedown minion.
const witness = (id: string) =>
  stubAbility(
    id,
    def({
      trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller" } },
      effects: [],
    }),
  );
const first = witness("first-witness");
const second = witness("second-witness");
const FIRST = stubSupport({ id: "first-witness", cost: 0, abilities: [first.ref] });
const SECOND = stubSupport({ id: "second-witness", cost: 0, abilities: [second.ref] });

const roles: readonly (readonly [string, FacedownRole, string])[] = [
  ["a Drone (Core's Ultron Drones)", { kind: "minion", traits: [trait("Drone")] }, "Drone minion"],
  ["a Controlled minion", { kind: "minion", traits: [trait("Controlled")] }, "Controlled minion"],
  ["a minion with no trait", { kind: "minion", traits: [] }, "Facedown minion"],
];

function start(role: FacedownRole) {
  // "Put the top card of your deck into play facedown, engaged with you as a [role] minion", with 3 hit points so one
  // damage leaves it in play.
  const enlist = stubAbility(
    "enlist",
    def({
      trigger: { kind: "whenRevealed" },
      effects: [{ kind: "putIntoPlayFacedown", player: { kind: "each" }, as: role }],
    }),
  );
  const ENLIST = stubTreachery({ id: "enlist", boostIcons: 0, abilities: [enlist.ref] });
  const facedown = { categories: ["minion"], facedown: true } as const;
  const stats = stubAbility(
    "facedown-stats",
    def({
      trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 3, setBase: true, target: facedown }] },
      effects: [],
    }),
  );
  const ENVIRONMENT = {
    ...stubTreachery({ id: "facedown-env", boostIcons: 0 }),
    type: "environment" as const,
    keywords: [{ name: "setup" as const }],
    abilities: [stats.ref],
  };
  const deps = depsOf(zap, first, second, enlist, stats);
  const dealt = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [SECRET, ZAP, FIRST, SECOND, ENLIST, ENVIRONMENT],
    deck: [SECRET.id, ...copies(ZAP.id, 10), ...copies(RESOURCE.id, 9)],
    encounterDeck: [ENVIRONMENT.id, ...copies(ENLIST.id, 20)],
    deps,
  });
  // The one card with the hidden name goes on top of the deck, and the two witnesses start in play.
  const secret = Object.values(dealt.instances).find((i) => i.cardId === SECRET.id)?.instanceId as InstanceId;
  const player = mustPlayer(dealt, p1);
  const inHand = player.hand.includes(secret);
  const rest = player.deck.filter((id) => id !== secret);
  const state: GameState = {
    ...dealt,
    players: dealt.players.map((p) =>
      p.playerId !== p1
        ? p
        : {
            ...p,
            hand: inHand ? [...p.hand.filter((id) => id !== secret), rest[0] as InstanceId] : p.hand,
            deck: [secret, ...(inHand ? rest.slice(1) : rest)],
          },
    ),
  };
  return { deps, state, secret };
}

/** Applies commands through a session, stopping at the first choice of `stopAt` (others take the default pick). */
function drive(
  from: GameSession,
  deps: ReturnType<typeof start>["deps"],
  commands: readonly Command[],
  stopAt?: NonNullable<GameState["pendingChoice"]>["prompt"]["kind"],
  pick: (state: GameState) => readonly string[] = defaultPick,
) {
  let session = from;
  const events: GameEvent[] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
  };
  const answer = (): boolean => {
    for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
      if (guard > 100) throw new Error("choices did not settle");
      const choice = session.state.pendingChoice;
      if (choice.prompt.kind === stopAt) return true;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      });
    }
    return false;
  };
  if (answer()) return { session, events };
  for (const command of commands) {
    apply(command);
    if (answer()) break;
  }
  return { session, events };
}

const text = (value: unknown): string => JSON.stringify(value);
const handCard = (state: GameState, card: { readonly id: CardId }): InstanceId =>
  mustPlayer(state, p1).hand.find((id) => state.instances[id]?.cardId === card.id) as InstanceId;
const play = (state: GameState, card: { readonly id: CardId }): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: handCard(state, card),
  payment: [],
  attachToInstanceId: null,
});

describe.each(roles)("a card in play facedown as %s", (_title, role, shown) => {
  /** Round 2, hero form: the top card of the deck is in play facedown and the player is about to act. */
  const facedownInPlay = () => {
    const { deps, state, secret } = start(role);
    const opened = drive(startSession(state), deps, [endTurn, toHero]);
    expect(mustInstance(opened.session.state, secret).facedownAs).toEqual(role);
    return { deps, secret, ...opened };
  };

  it("is called by its role, and the faceup villain by its printed name", () => {
    const { session, secret } = facedownInPlay();
    expect(displayNameOf(session.state, secret)).toBe(shown);
    expect(displayNameOf(session.state, activeVillain(session.state).instanceId)).toBe("Faceup Villain");
  });

  it("is offered as a target under its role's name; the faceup option is unchanged", () => {
    const { deps, session, secret } = facedownInPlay();
    const { session: choosing } = drive(session, deps, [play(session.state, ZAP)], "chooseTarget");
    const choice = choosing.state.pendingChoice;
    expect(choice?.prompt.kind).toBe("chooseTarget");
    const labels = Object.fromEntries((choice?.options ?? []).map((o) => [o.optionId, o.label]));
    expect(labels).toEqual({ [secret]: shown, [activeVillain(choosing.state).instanceId]: "Faceup Villain" });
    expect(text(choice)).not.toContain(HIDDEN_NAME);
    expect(text(choice)).not.toContain(HIDDEN_ID);
  });

  it("is not named in a trigger-order prompt about it, nor as a trigger's own card", () => {
    const { secret } = facedownInPlay();
    const { deps: twoDeps, state } = start(role);
    const seeded = startSession(seedWitnesses(state));
    const ready = drive(seeded, twoDeps, [endTurn, toHero]);
    const facedown = Object.values(ready.session.state.instances).find((i) => i.facedownAs)?.instanceId as InstanceId;
    const ordering = drive(ready.session, twoDeps, [play(ready.session.state, ZAP)], "orderTriggers", (state) =>
      state.pendingChoice?.prompt.kind === "chooseTarget" ? [facedown] : defaultPick(state),
    );
    const choice = ordering.session.state.pendingChoice;
    expect(choice?.prompt.kind).toBe("orderTriggers");
    expect(choice?.options.map((o) => o.label).sort()).toEqual(["first-witness", "second-witness"]);
    expect(text(choice)).toContain(facedown);
    expect(text(choice)).not.toContain(HIDDEN_NAME);
    expect(text(choice)).not.toContain(HIDDEN_ID);
    // The label builder every trigger prompt shares, asked about the facedown card itself.
    const option = candidateOption(ordering.session.state)({
      instanceId: secret,
      abilityId: first.ref.id,
      controllerId: p1,
      forced: true,
      fromHand: false,
    });
    expect(option.label).toBe(shown);
    expect(text(option)).not.toContain(HIDDEN_NAME);
  });

  it("is not named by the legal-action listing", () => {
    const { deps, session, secret } = facedownInPlay();
    const listing = legalActions(session.state, p1, deps);
    expect(text(listing)).toContain(secret);
    expect(text(listing)).not.toContain(HIDDEN_NAME);
    expect(text(listing)).not.toContain(HIDDEN_ID);
  });

  it("is not named by any event while it is facedown, and is itself again once it leaves play", () => {
    const { deps, session, secret, events: entering } = facedownInPlay();
    const pickFacedown = (state: GameState): readonly string[] =>
      state.pendingChoice?.prompt.kind === "chooseTarget" ? [secret] : defaultPick(state);
    const hit = drive(session, deps, [play(session.state, ZAP)], undefined, pickFacedown);
    expect(mustInstance(hit.session.state, secret).damage).toBe(1);
    expect(mustInstance(hit.session.state, secret).facedownAs).toEqual(role);
    const log = text([...entering, ...hit.events]);
    expect(log).toContain(secret);
    expect(log).not.toContain(HIDDEN_NAME);
    // The log is the engine's own record, not a per-viewer feed: a move carries the moved card's code whatever its
    // zone (a dealt encounter card and a boost card do too), and nothing else names this one while it is facedown.
    const carriers = [...entering, ...hit.events].filter((event) => text(event).includes(HIDDEN_ID));
    expect(carriers.map((event) => event.type)).toEqual(["cardMoved"]);

    // Two more damage defeat it (3 hit points): it goes to its owner's discard pile, an open zone, and is itself again.
    const second = drive(hit.session, deps, [play(hit.session.state, ZAP)], undefined, pickFacedown);
    const third = drive(second.session, deps, [play(second.session.state, ZAP)], undefined, pickFacedown);
    expect(mustPlayer(third.session.state, p1).discard).toContain(secret);
    expect(mustInstance(third.session.state, secret).facedownAs).toBeNull();
    expect(displayNameOf(third.session.state, secret)).toBe(HIDDEN_NAME);
    expect(text(second.events)).not.toContain(HIDDEN_NAME);
    const replayed = replay(third.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(third.session.state);
  });
});

/** Both witness supports in `p1`'s play area, ready and faceup, from the card pool (test-only state surgery). */
function seedWitnesses(state: GameState): GameState {
  const template = mustInstance(state, mustPlayer(state, p1).deck[1] as InstanceId);
  const made = [FIRST, SECOND].map((card, index) => ({
    ...template,
    instanceId: `witness-${index}` as InstanceId,
    cardId: card.id,
    faceup: true,
    controllerId: p1,
  }));
  return {
    ...state,
    instances: { ...state.instances, ...Object.fromEntries(made.map((i) => [i.instanceId, i])) },
    players: state.players.map((p) =>
      p.playerId !== p1 ? p : { ...p, playArea: [...p.playArea, ...made.map((i) => i.instanceId)] },
    ),
  };
}
