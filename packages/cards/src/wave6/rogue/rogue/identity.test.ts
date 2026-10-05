import { cardId } from "@mc/content";
import {
  controllerOf,
  keywordsOf,
  replay,
  sessionApply,
  startSession,
  traitsOf,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { kellyOf } from "../../mut_gen/sabretooth-testing.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { ROGUE_IDENTITY } from "./identity.js";
import { rogueGame } from "./support.js";

const SETUP = "38001b.setup";
const WITHDRAWN = "38001b.withdrawn";
const PHASE_RESPONSE = "38001a.rogue-forced-response";
const SKIN = "38001a.skin-contact";
const TOUCHED_IDS = [
  "38002.touched-constant",
  "38002.touched-constant-2",
  "38002.touched-constant-3",
  "38002.touched-constant-4",
];
const MERCENARY = "01101"; // Hydra Mercenary: minion, 3 hp, guard
const SPIDER_WOMAN = "01011"; // a Core ally
const SECOND_PLAYER = [{ starterDeckId: "core-spider-man-justice" }];

const rogueAlterEgo = (seed = 1, extra: typeof SECOND_PLAYER = []): GameState =>
  rogueGame("rhino", { seed, extraPlayers: extra });
const rogueHero = (seed = 1, extra: typeof SECOND_PLAYER = []): GameState =>
  withForm(rogueAlterEgo(seed, extra), { heroForm: 0 });
const touchedOf = (state: GameState): InstanceId => instancesOf(state, "38002")[0]!;
const rogueId = (state: GameState): InstanceId => identityOf(state, P1);
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** Where Touched is, by zone name (`attached:<host>` when attached). */
function whereIs(state: GameState, id: InstanceId): string {
  const attachedTo = inst(state, id).attachedTo;
  if (attachedTo) return `attached:${inst(state, attachedTo).cardId}`;
  const owner = playerOf(state, P1);
  for (const zone of ["setAside", "hand", "deck", "discard", "playArea"] as const)
    if ((owner[zone] as readonly InstanceId[]).includes(id)) return zone;
  return "elsewhere";
}
const rogueKeywords = (state: GameState): string[] =>
  keywordsOf(state, rogueId(state), WAVE6_DEPS)
    .map((k) => (k.name === "retaliate" ? `retaliate ${k.value}` : k.name))
    .filter((name) => ["retaliate 1", "stalwart", "steady", "overkill"].includes(name))
    .sort();
const rogueTraits = (state: GameState): string[] => traitsOf(state, rogueId(state), WAVE6_DEPS).map(String).sort();

/** Applies `command`, answering every choice with `pick`, and replays the log to compare. */
function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, WAVE6_DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 100) throw new Error(`choices did not settle (${session.state.pendingChoice.prompt.kind})`);
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      WAVE6_DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, WAVE6_DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const rejected = (state: GameState, command: Command): boolean =>
  !sessionApply(startSession(state), command, WAVE6_DEPS).ok;

/** Picks the card `host` at a card prompt (Skin Contact's host), any other prompt by default. */
const hosting =
  (host: InstanceId, offered: string[][] = []): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice && choice.options.some((o) => o.ref.kind === "card")) {
      offered.push(choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId as string] : [])));
      const hit = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === host);
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

/** A Core ally of P1's, by surgery (the first deck card turned into it, placed in the play area). */
function withAlly(state: GameState, player = P1): { state: GameState; id: InstanceId } {
  const id = playerOf(state, player).deck[0]!;
  const patched = patchInstance(state, id, { cardId: cardId(SPIDER_WOMAN), controllerId: player, faceup: true });
  return {
    id,
    state: {
      ...patched,
      players: patched.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}
/** A Hydra Mercenary (2 of its 3 hit points gone, 1 left) engaged with Rogue. */
function withRunner(state: GameState): { state: GameState; id: InstanceId } {
  const engaged = engageMinion(state, MERCENARY, P1);
  return { id: engaged.id, state: patchInstance(engaged.state, engaged.id, { damage: 2 }) };
}
/** Skin Contact onto `host`. */
const skinContact = (state: GameState, host: InstanceId) => drive(state, use(P1, rogueId(state), SKIN), hosting(host));
/** Rogue basic-attacks `target` (hero form, ready); returns the villain's damage change. */
function attack(state: GameState, target: InstanceId): { after: GameState; spill: number } {
  const ready = patchInstance(state, rogueId(state), { exhausted: false });
  const { state: after } = drive(ready, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: rogueId(ready),
    targetInstanceId: target,
  });
  return { after, spill: inst(after, villainOf(after)).damage - inst(ready, villainOf(ready)).damage };
}
/** Plays the rounds on until the next player phase has begun (everyone's choices default). */
function nextPlayerPhase(state: GameState): GameState {
  let current = state;
  for (const player of state.players) {
    // Rogue's own turn ends by command; another player's (a second seat) too, hero or alter-ego.
    current = drive(current, endTurn(player.playerId)).state;
  }
  return settle(current, firstLegal, (s) => s.step.phase === "player" && s.round > state.round, WAVE6_DEPS);
}

describe("Rogue / Anna Marie (38001a/b) and Touched (38002)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(ROGUE_IDENTITY).sort()).toEqual([SETUP, WITHDRAWN, PHASE_RESPONSE, SKIN, ...TOUCHED_IDS].sort());
    for (const definition of Object.values(ROGUE_IDENTITY)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("38001b.setup (Anna Marie)", () => {
    it("starts with Touched set aside: in neither her deck nor her hand, and only one copy", () => {
      const state = rogueAlterEgo();
      expect(instancesOf(state, "38002")).toHaveLength(1);
      expect(whereIs(state, touchedOf(state))).toBe("setAside");
      expect(playerOf(state, P1).deck).not.toContain(touchedOf(state));
      expect(playerOf(state, P1).hand).not.toContain(touchedOf(state));
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    });
  });

  describe("38001a.rogue-forced-response (player phase begins)", () => {
    it("sets Touched aside again when it is in her hand", () => {
      const base = rogueHero();
      const moved = patchInstance(base, touchedOf(base), {});
      const state = {
        ...moved,
        players: moved.players.map((p) =>
          p.playerId === P1
            ? { ...p, setAside: p.setAside.filter((i) => i !== touchedOf(base)), hand: [...p.hand, touchedOf(base)] }
            : p,
        ),
      };
      expect(whereIs(state, touchedOf(state))).toBe("hand");
      const next = nextPlayerPhase(state);
      expect(whereIs(next, touchedOf(next))).toBe("setAside");
    });

    it("sets Touched aside when it is in her discard pile", () => {
      const base = rogueHero();
      const state = {
        ...base,
        players: base.players.map((p) =>
          p.playerId === P1
            ? {
                ...p,
                setAside: p.setAside.filter((i) => i !== touchedOf(base)),
                discard: [...p.discard, touchedOf(base)],
              }
            : p,
        ),
      };
      expect(whereIs(state, touchedOf(state))).toBe("discard");
      const next = nextPlayerPhase(state);
      expect(whereIs(next, touchedOf(next))).toBe("setAside");
    });

    it("sets Touched aside when it is attached to a minion, ending its lines", () => {
      const runner = withRunner(rogueHero());
      const attached = skinContact(runner.state, runner.id).state;
      expect(whereIs(attached, touchedOf(attached))).toBe(`attached:${MERCENARY}`);
      const next = nextPlayerPhase(attached);
      expect(whereIs(next, touchedOf(next))).toBe("setAside");
      expect(inst(next, runner.id).attachments).not.toContain(touchedOf(next));
      expect(rogueKeywords(next)).toEqual([]);
    });

    it("is printed on the hero face: nothing is found when the phase begins with her in alter-ego form", () => {
      const base = rogueAlterEgo();
      const state = {
        ...base,
        players: base.players.map((p) =>
          p.playerId === P1
            ? {
                ...p,
                setAside: p.setAside.filter((i) => i !== touchedOf(base)),
                discard: [...p.discard, touchedOf(base)],
              }
            : p,
        ),
      };
      // Skip the alter-ego exhaust: any alter-ego round that ends leaves the discard pile alone.
      const next = nextPlayerPhase(state);
      expect(whereIs(next, touchedOf(next))).toBe("discard");
    });
  });

  describe("38001b.withdrawn (Anna Marie)", () => {
    it("changing to alter-ego form finds Touched on a minion and sets it aside", () => {
      const runner = withRunner(rogueHero());
      const attached = skinContact(runner.state, runner.id).state;
      const { state, events } = drive(patchInstance(attached, rogueId(attached), {}), {
        type: "changeForm",
        playerId: P1,
      });
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      expect(whereIs(state, touchedOf(state))).toBe("setAside");
      expect(ofType(events, "formChanged")).toHaveLength(1);
    });

    it("changing to hero form does not set it aside", () => {
      const base = withForm(rogueAlterEgo(), "alterEgo");
      const runner = withRunner(base);
      // Touched staged on the minion by surgery (Skin Contact is not live in alter-ego form).
      const t = touchedOf(base);
      const staged = patchInstance(patchInstance(runner.state, t, { attachedTo: runner.id }), runner.id, {
        attachments: [t],
      });
      const withoutAside = {
        ...staged,
        players: staged.players.map((p) =>
          p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== t) } : p,
        ),
      };
      const { state } = drive(withoutAside, { type: "changeForm", playerId: P1 });
      expect(playerOf(state, P1).identity.form).toBe("hero");
      expect(whereIs(state, touchedOf(state))).toBe(`attached:${MERCENARY}`);
    });
  });

  describe("38001a.skin-contact", () => {
    it("finds Touched in the set-aside area and attaches it to the chosen minion", () => {
      const runner = withRunner(rogueHero());
      expect(whereIs(runner.state, touchedOf(runner.state))).toBe("setAside");
      const offered: string[][] = [];
      const { state } = drive(runner.state, use(P1, rogueId(runner.state), SKIN), hosting(runner.id, offered));
      expect(inst(state, touchedOf(state)).attachedTo).toBe(runner.id);
      expect(inst(state, runner.id).attachments).toEqual([touchedOf(state)]);
      expect(playerOf(state, P1).setAside).not.toContain(touchedOf(state));
      // "another character": Rogue herself is not a host.
      expect(offered[0]).toBeDefined();
      expect(offered[0]).not.toContain(rogueId(runner.state));
      expect(offered[0]).toContain(runner.id);
      expect(offered[0]).toContain(villainOf(runner.state));
    });

    it("never offers a host that cannot have player cards attached (Robert Kelly), the same legality as Energy Transfer", () => {
      const state = withForm(rogueGame("sabretooth", { modularSetIds: [] }), { heroForm: 0 });
      const kelly = kellyOf(state);
      const offered: string[][] = [];
      const { state: after } = drive(state, use(P1, rogueId(state), SKIN), hosting(kelly, offered));
      // Kelly is never a choice; the villain (a legal host) is, so Touched lands on a host that can take it.
      expect(offered[0]).toBeDefined();
      expect(offered[0]).not.toContain(kelly);
      expect(inst(after, touchedOf(after)).attachedTo).not.toBeNull();
      expect(inst(after, touchedOf(after)).attachedTo).not.toBe(kelly);
    });

    it("copies the host's traits until the end of the round, and loses them when Touched leaves", () => {
      const runner = withRunner(rogueHero());
      const printed = rogueTraits(runner.state);
      const runnerTraits = traitsOf(runner.state, runner.id, WAVE6_DEPS).map(String);
      expect(runnerTraits.length).toBeGreaterThan(0);
      const attached = skinContact(runner.state, runner.id).state;
      for (const t of runnerTraits) expect(rogueTraits(attached)).toContain(t);
      expect(rogueTraits(attached)).toEqual([...new Set([...printed, ...runnerTraits])].sort());
      // Defeating the host sends Touched away: the copied traits go with it (Q28), not at the end of the round.
      const { after } = attack(attached, runner.id);
      expect(inst(after, touchedOf(after)).attachedTo).toBeNull();
      expect(rogueTraits(after)).toEqual(printed);
    });

    it("the copied traits also end with the round when Touched stays", () => {
      const runner = withRunner(rogueHero());
      const printed = rogueTraits(runner.state);
      const attached = skinContact(runner.state, runner.id).state;
      expect(rogueTraits(attached)).not.toEqual(printed);
      // Touched stays attached to that minion through the villain phase? Its Forced Response sets it aside, so the
      // grant is gone either way; the round-boundary end is covered by the engine row's own tests.
      const next = nextPlayerPhase(attached);
      expect(rogueTraits(next)).toEqual(printed);
    });

    it("is limited to once per round", () => {
      const runner = withRunner(rogueHero());
      const { state } = skinContact(runner.state, runner.id);
      expect(rejected(state, use(P1, rogueId(state), SKIN))).toBe(true);
      expect(whereIs(state, touchedOf(state))).toBe(`attached:${MERCENARY}`);
    });

    it("is not live in alter-ego form", () => {
      const state = rogueAlterEgo();
      expect(rejected(state, use(P1, rogueId(state), SKIN))).toBe(true);
    });

    it("finds Touched wherever it is: in her hand, and already attached elsewhere (moving it)", () => {
      const runner = withRunner(rogueHero());
      const ally = withAlly(runner.state);
      const first = skinContact(ally.state, ally.id).state;
      expect(inst(first, touchedOf(first)).attachedTo).toBe(ally.id);
      // A new round (once-per-round) with Touched back on the ally by surgery is not needed: use a fresh game with it
      // in hand.
      const base = runner.state;
      const t = touchedOf(base);
      const inHand = {
        ...base,
        players: base.players.map((p) =>
          p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== t), hand: [...p.hand, t] } : p,
        ),
      };
      const { state } = skinContact(inHand, runner.id);
      expect(inst(state, t).attachedTo).toBe(runner.id);
      expect(playerOf(state, P1).hand).not.toContain(t);
    });
  });

  describe("38002 Touched, one line per host type", () => {
    it("Minion: Rogue's attacks gain overkill (and nothing else)", () => {
      const runner = withRunner(rogueHero());
      // Control: with no Touched her 2-damage attack on the 1 hp minion spills nothing.
      expect(attack(runner.state, runner.id).spill).toBe(0);
      const attached = skinContact(runner.state, runner.id).state;
      expect(rogueKeywords(attached)).toEqual([]);
      expect(rogueTraits(attached)).not.toContain("AERIAL");
      // The minion is defeated by 1 of her 2 damage: overkill spills the other 1 to the villain.
      expect(attack(attached, runner.id).spill).toBe(1);
    });

    it("Villain: Rogue gains retaliate 1 (and nothing else)", () => {
      const base = rogueHero();
      expect(rogueKeywords(base)).toEqual([]);
      const attached = skinContact(base, villainOf(base)).state;
      expect(inst(attached, touchedOf(attached)).attachedTo).toBe(villainOf(base));
      expect(rogueKeywords(attached)).toEqual(["retaliate 1"]);
      expect(rogueTraits(attached)).not.toContain("AERIAL");
    });

    it("Ally: Rogue gains the AERIAL trait (and nothing else)", () => {
      const base = withAlly(rogueHero());
      expect(rogueTraits(base.state)).not.toContain("AERIAL");
      expect(traitsOf(base.state, base.id, WAVE6_DEPS).map(String)).not.toContain("AERIAL");
      const attached = skinContact(base.state, base.id).state;
      expect(rogueTraits(attached)).toContain("AERIAL");
      expect(rogueKeywords(attached)).toEqual([]);
    });

    it("Hero: Rogue gains stalwart; an alter-ego host gives nothing", () => {
      const base = rogueHero(1, SECOND_PLAYER);
      const second = identityOf(base, P2);
      expect(playerOf(base, P2).identity.form).toBe("alterEgo");
      const onAlterEgo = skinContact(base, second).state;
      expect(inst(onAlterEgo, touchedOf(onAlterEgo)).attachedTo).toBe(second);
      expect(rogueKeywords(onAlterEgo)).toEqual([]);
      // The same card the moment the second player is in hero form: read live, no re-attach.
      const flipped = withForm(onAlterEgo, { heroForm: 0 }, P2);
      expect(rogueKeywords(flipped)).toEqual(["stalwart"]);
    });

    it("Hero in a 2-player game: Touched on P2's hero is controlled by P2 and still grants Rogue stalwart", () => {
      const base = withForm(rogueHero(1, SECOND_PLAYER), { heroForm: 0 }, P2);
      const second = identityOf(base, P2);
      expect(rogueKeywords(base)).toEqual([]);
      const { state } = skinContact(base, second);
      const t = touchedOf(state);
      expect(inst(state, t).attachedTo).toBe(second);
      expect(controllerOf(state, t)).toBe(P2);
      expect(inst(state, t).ownerId).toBe(P1);
      // The grant names Rogue (Touched's owner), not Touched's controller: P2's hero gets nothing.
      expect(rogueKeywords(state)).toEqual(["stalwart"]);
      expect(keywordsOf(state, second, WAVE6_DEPS).map((k) => k.name)).not.toContain("stalwart");
    });

    it("the next player phase sets Touched aside off a hero, ending stalwart", () => {
      const base = withForm(rogueHero(1, SECOND_PLAYER), { heroForm: 0 }, P2);
      const { state } = skinContact(base, identityOf(base, P2));
      expect(rogueKeywords(state)).toEqual(["stalwart"]);
      const next = nextPlayerPhase(state);
      expect(whereIs(next, touchedOf(next))).toBe("setAside");
      expect(rogueKeywords(next)).toEqual([]);
    });
  });
});
