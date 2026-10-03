import { cardId } from "@mc/content";
import {
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
  mainThreat,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { moveToDiscard, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { ROGUE_EVENTS } from "./events.js";
import { rogueGame } from "./support.js";

const DEPS = WAVE6_DEPS;
const GOIN_ROGUE = "38005";
const SOUTHERN_CROSS = "38006";
const ENERGY_TRANSFER = "38007";
const BELLE = "38008";
const ADAPTATION = "38009";
const SKIN = "38001a.skin-contact";
const MERCENARY = "01101"; // Hydra Mercenary: minion, 3 hp, guard
const DAREDEVIL = "01058"; // a Justice ally (P2's deck)
const BACKFLIP = "01003"; // Spider-Man identity-specific event
const FOR_JUSTICE = "01060"; // Justice event
const GREAT_RESPONSIBILITY = "01061"; // Justice event, cost 0
const EMERGENCY = "01085"; // basic event
const SECOND = [{ starterDeckId: "core-spider-man-justice" }];

const rogue = (extra: typeof SECOND = []): GameState =>
  withForm(rogueGame("rhino", { seed: 1, extraPlayers: extra }), { heroForm: 0 });
const duo = (): GameState => withForm(rogue(SECOND), { heroForm: 0 }, P2);
const rogueId = (state: GameState): InstanceId => identityOf(state, P1);
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const touchedOf = (state: GameState): InstanceId => instancesOf(state, "38002")[0]!;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const handOf = (state: GameState, player = P1) => playerOf(state, player).hand;
const withThreat = (state: GameState, threat: number): GameState =>
  patchInstance(state, state.mainScheme.instanceId, { threat });

/** Applies `command`, answering every choice with `pick`; the log replays to the same state. */
function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, DEPS);
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
      DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const rejected = (state: GameState, command: Command): boolean => !sessionApply(startSession(state), command, DEPS).ok;

/** Picks `wanted` (in order) at any prompt that offers a card among them; anything else as `firstLegal`. */
const choosing =
  (wanted: readonly InstanceId[], offered: string[][] = []): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice && choice.prompt.kind !== "chooseTriggers" && choice.options.some((o) => o.ref.kind === "card")) {
      offered.push(choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId as string] : [])));
      const hit = choice.options.find((o) => o.ref.kind === "card" && wanted.includes(o.ref.instanceId as InstanceId));
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

/** A Core ally of P1's by surgery (the first deck card turned into Spider-Woman, in the play area). */
function withAlly(state: GameState, player = P1): { state: GameState; id: InstanceId } {
  const id = playerOf(state, player).deck[0]!;
  const patched = patchInstance(state, id, { cardId: cardId("01011"), controllerId: player, faceup: true });
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
/** A Hydra Mercenary engaged with Rogue. */
const withMinion = (state: GameState) => engageMinion(state, MERCENARY, P1);
/** Skin Contact: Touched onto `host`. */
const touchOnto = (state: GameState, host: InstanceId): GameState =>
  drive(state, use(P1, rogueId(state), SKIN), choosing([host])).state;

/** Rogue plays `code` (paying `cost`), answering choices with `pick`. */
function playEvent(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  costChoices?: Record<string, InstanceId[]>,
) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const command = play(P1, id, payWith(given.state, P1, cost, [id]), costChoices ? { costChoices } : {});
  return { ...drive(given.state, command, pick), id, before: given.state };
}
/** Energy Transfer onto `host` (the cost's host pick rides the play command). */
const transfer = (state: GameState, host: InstanceId) =>
  playEvent(state, ENERGY_TRANSFER, 2, firstLegal, { host: [host] });

describe("Rogue's events (38005-38009)", () => {
  it("registers exactly the ability refs the card data names, all valid", () => {
    expect(Object.keys(ROGUE_EVENTS).sort()).toEqual(
      [
        "38005.goin-rogue-action",
        "38006.southern-cross-action",
        "38007.energy-transfer-action",
        "38008.bulletproof-belle-interrupt",
        "38009.superpower-adaptation-action",
      ].sort(),
    );
    for (const definition of Object.values(ROGUE_EVENTS)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Goin' Rogue (38005): remove 3 threat; AERIAL +2, Retaliate confuses an enemy, Stalwart draws", () => {
    const threatRemoved = (state: GameState) => {
      const run = playEvent(withThreat(state, 10), GOIN_ROGUE, 2);
      return { ...run, removed: 10 - mainThreat(run.state) };
    };

    it("with none of the three: removes exactly 3, no confuse, no draw", () => {
      const run = threatRemoved(withMinion(rogue()).state);
      expect(run.removed).toBe(3);
      expect(inst(run.state, villainOf(run.state)).statuses.confused ?? 0).toBe(0);
      expect(handOf(run.state)).toHaveLength(handOf(run.before).length - 3);
    });

    it("with AERIAL from Touched on an ally: removes 5 in one removal", () => {
      const ally = withAlly(rogue());
      const touched = touchOnto(ally.state, ally.id);
      expect(traitsOf(touched, rogueId(touched), DEPS).map(String)).toContain("AERIAL");
      const run = threatRemoved(touched);
      expect(run.removed).toBe(5);
      expect(ofType(run.events, "threatRemoved").map((e) => e.amount)).toEqual([5]);
      expect(handOf(run.state)).toHaveLength(handOf(run.before).length - 3);
      expect(inst(run.state, villainOf(run.state)).statuses.confused ?? 0).toBe(0);
    });

    it("with Retaliate from Touched on the villain: removes 3 and confuses an enemy of her choice", () => {
      const minion = withMinion(rogue());
      const touched = touchOnto(minion.state, villainOf(minion.state));
      const run = (() => {
        const run = playEvent(withThreat(touched, 10), GOIN_ROGUE, 2, choosing([minion.id]));
        return { ...run, removed: 10 - mainThreat(run.state) };
      })();
      expect(run.removed).toBe(3);
      expect(inst(run.state, minion.id).statuses.confused ?? 0).toBe(1);
      expect(inst(run.state, villainOf(run.state)).statuses.confused ?? 0).toBe(0);
      expect(handOf(run.state)).toHaveLength(handOf(run.before).length - 3);
    });

    it("with Stalwart from Touched on another hero: removes 3 and draws 1 card", () => {
      const base = duo();
      const touched = touchOnto(base, identityOf(base, P2));
      const run = threatRemoved(touched);
      expect(run.removed).toBe(3);
      expect(handOf(run.state)).toHaveLength(handOf(run.before).length - 3 + 1);
      expect(ofType(run.events, "cardDrawn").length).toBeGreaterThan(0);
    });

    it("Touched on a minion (overkill only) gives none of the three bullets", () => {
      const minion = withMinion(rogue());
      const run = threatRemoved(touchOnto(minion.state, minion.id));
      expect(run.removed).toBe(3);
      expect(handOf(run.state)).toHaveLength(handOf(run.before).length - 3);
    });
  });

  describe("Southern Cross (38006): 6 damage; AERIAL +2, Retaliate stuns that enemy, Stalwart draws", () => {
    const hit = (state: GameState, pick: Picker = firstLegal, target?: InstanceId) => {
      const run = playEvent(state, SOUTHERN_CROSS, 3, target ? choosing([target], []) : pick);
      const into = target ?? villainOf(state);
      return { ...run, dealt: inst(run.state, into).damage - inst(run.before, into).damage, target: into };
    };

    it("with none of the three: 6 damage to the enemy, no stun, no draw", () => {
      const run = hit(rogue());
      expect(run.dealt).toBe(6);
      expect(inst(run.state, run.target).statuses.stunned ?? 0).toBe(0);
      expect(handOf(run.state)).toHaveLength(handOf(run.before).length - 4);
    });

    it("with AERIAL: the attack deals 8 as one instance of damage", () => {
      const ally = withAlly(rogue());
      const touched = touchOnto(ally.state, ally.id);
      const run = hit(touched);
      expect(run.dealt).toBe(8);
      expect(
        ofType(run.events, "damageDealt")
          .filter((e) => e.targetInstanceId === run.target)
          .map((e) => e.amount),
      ).toEqual([8]);
      expect(handOf(run.state)).toHaveLength(handOf(run.before).length - 4);
    });

    it("with Retaliate (Touched on the villain): 6 damage and that enemy is stunned", () => {
      const base = rogue();
      const touched = touchOnto(base, villainOf(base));
      const run = hit(touched);
      expect(run.dealt).toBe(6);
      expect(inst(run.state, run.target).statuses.stunned ?? 0).toBe(1);
    });

    it("with Stalwart (Touched on another hero): 6 damage and draws 1", () => {
      const base = duo();
      const touched = touchOnto(base, identityOf(base, P2));
      const run = hit(touched);
      expect(run.dealt).toBe(6);
      expect(handOf(run.state)).toHaveLength(handOf(run.before).length - 4 + 1);
      expect(inst(run.state, run.target).statuses.stunned ?? 0).toBe(0);
    });

    it("Retaliate's stun needs the attacked enemy still in play: a defeated minion is not stunned, nothing else is", () => {
      const minion = withMinion(rogue());
      const touched = touchOnto(minion.state, villainOf(minion.state));
      const run = hit(touched, firstLegal, minion.id);
      expect(inst(run.state, villainOf(touched)).statuses.stunned ?? 0).toBe(0);
      expect(ofType(run.events, "characterDefeated").map((e) => e.instanceId)).toContain(minion.id);
    });
  });

  describe("Energy Transfer (38007): find Touched, attach it elsewhere and deal 2 damage → heal 2, ready, gain traits", () => {
    const hurt = (state: GameState): GameState =>
      patchInstance(patchInstance(state, rogueId(state), { damage: 3 }), rogueId(state), { exhausted: true });
    const MERCENARY_TRAITS = ["HYDRA"];

    it("Touched starts set aside; the cost finds it and attaches it to the minion with 2 damage; Rogue heals 2 and readies", () => {
      const minion = withMinion(hurt(rogue()));
      expect(touchedOf(minion.state)).toBeDefined();
      const run = transfer(minion.state, minion.id);
      expect(inst(run.state, touchedOf(run.state)).attachedTo).toBe(minion.id);
      expect(inst(run.state, minion.id).attachments).toContain(touchedOf(run.state));
      expect(inst(run.state, minion.id).damage).toBe(2);
      expect(inst(run.state, rogueId(run.state)).damage).toBe(1);
      expect(inst(run.state, rogueId(run.state)).exhausted).toBe(false);
      expect(playerOf(run.state, P1).discard).toContain(run.id);
    });

    it("Rogue gains each of the host's traits until the end of the round (live while Touched stays)", () => {
      const minion = withMinion(hurt(rogue()));
      const traitsBefore = traitsOf(minion.state, rogueId(minion.state), DEPS).map(String);
      const hostTraits = traitsOf(minion.state, minion.id, DEPS).map(String);
      expect(hostTraits).toEqual(expect.arrayContaining(MERCENARY_TRAITS));
      const run = transfer(minion.state, minion.id);
      const gained = traitsOf(run.state, rogueId(run.state), DEPS).map(String);
      for (const t of hostTraits) expect(gained).toContain(t);
      expect(traitsBefore).not.toContain("HYDRA");
      // Touched leaving the host ends the grant (Q28).
      const left = patchInstance(patchInstance(run.state, minion.id, { attachments: [] }), touchedOf(run.state), {
        attachedTo: null,
      });
      expect(traitsOf(left, rogueId(left), DEPS).map(String)).not.toContain("HYDRA");
    });

    it("the host is never Rogue: naming her is refused, another character is accepted", () => {
      const ally = withAlly(withMinion(hurt(rogue(SECOND))).state);
      const given = moveToHand(ally.state, P1, ENERGY_TRANSFER);
      const [id] = given.ids as [InstanceId];
      const pay = payWith(given.state, P1, 2, [id]);
      const naming = (host: InstanceId) => play(P1, id, pay, { costChoices: { host: [host] } });
      expect(rejected(given.state, naming(rogueId(given.state)))).toBe(true);
      for (const host of [ally.id, identityOf(given.state, P2), villainOf(given.state)])
        expect(rejected(given.state, naming(host))).toBe(false);
    });

    it("Touched is found wherever it is: from her hand it is attached to the host", () => {
      const base = withMinion(hurt(rogue()));
      const touched = touchedOf(base.state);
      const inHand = {
        ...base.state,
        players: base.state.players.map((p) =>
          p.playerId === P1
            ? { ...p, setAside: p.setAside.filter((i) => i !== touched), hand: [...p.hand, touched] }
            : p,
        ),
      };
      const run = transfer(inHand, base.id);
      expect(inst(run.state, touched).attachedTo).toBe(base.id);
      expect(handOf(run.state)).not.toContain(touched);
    });

    it("Touched moves from its current host to the new one (a second attach, not a copy)", () => {
      const base = withMinion(hurt(rogue()));
      const ally = withAlly(base.state);
      const onAlly = touchOnto(ally.state, ally.id);
      expect(inst(onAlly, touchedOf(onAlly)).attachedTo).toBe(ally.id);
      const run = transfer(onAlly, base.id);
      expect(instancesOf(run.state, "38002")).toHaveLength(1);
      expect(inst(run.state, touchedOf(run.state)).attachedTo).toBe(base.id);
      expect(inst(run.state, ally.id).attachments).not.toContain(touchedOf(run.state));
      expect(inst(run.state, ally.id).damage).toBe(0);
      expect(inst(run.state, base.id).damage).toBe(2);
    });

    it("the 2 damage is a cost: a tough card on the host stops it, yet Touched stays attached and the effects resolve", () => {
      const minion = withMinion(hurt(rogue()));
      const tough = patchInstance(minion.state, minion.id, {
        statuses: { ...inst(minion.state, minion.id).statuses, tough: 1 },
      });
      const run = transfer(tough, minion.id);
      expect(inst(run.state, minion.id).damage).toBe(0);
      expect(inst(run.state, minion.id).statuses.tough ?? 0).toBe(0);
      expect(inst(run.state, touchedOf(run.state)).attachedTo).toBe(minion.id);
      expect(inst(run.state, rogueId(run.state)).damage).toBe(1);
      expect(inst(run.state, rogueId(run.state)).exhausted).toBe(false);
    });
  });

  describe("Bulletproof Belle (38008): when an enemy with Touched attacks, prevent all damage and gain tough", () => {
    /** Ends Rogue's turn; accepts Belle when offered (paying with the first card), counting how often it was offered. */
    function villainPhase(state: GameState, accept: boolean) {
      let offeredTimes = 0;
      const pick: Picker = (s) => {
        const open = s.pendingChoice;
        if (!open) return [];
        if (open.prompt.kind === "payForCard") return [open.options[0]!.optionId];
        const mine = open.options.filter((o) => o.optionId.includes("38008.bulletproof-belle-interrupt"));
        if (mine.length > 0) {
          offeredTimes++;
          if (accept) return [mine[0]!.optionId];
        }
        return firstLegal(s);
      };
      const run = drive(state, endTurn(P1), pick);
      return { ...run, offeredTimes };
    }
    const withBelle = (state: GameState) => moveToHand(state, P1, BELLE);

    it("Touched on the villain: Rhino's attack is prevented entirely, and Rogue gains a tough status card", () => {
      const base = rogue();
      const touched = withBelle(touchOnto(base, villainOf(base)));
      const baseline = villainPhase(touched.state, false);
      const played = villainPhase(touched.state, true);
      expect(baseline.offeredTimes).toBeGreaterThan(0);
      const takenFromVillain = (r: { events: readonly GameEvent[]; state: GameState }) =>
        ofType(r.events, "damageDealt").filter(
          (e) => e.sourceInstanceId === villainOf(r.state) && e.targetInstanceId === rogueId(r.state),
        );
      expect(takenFromVillain(baseline).length).toBeGreaterThan(0);
      expect(takenFromVillain(played)).toEqual([]);
      expect(ofType(played.events, "damagePrevented")[0]).toMatchObject({ targetInstanceId: rogueId(played.state) });
      expect(
        ofType(played.events, "statusGiven").filter(
          (e) => e.instanceId === rogueId(played.state) && e.status === "tough",
        ),
      ).toHaveLength(1);
      expect(playerOf(played.state, P1).discard).toContain(touched.ids[0]);
    });

    it("Touched on a minion: the minion's attack offers it; prevented, the minion's attack deals Rogue no damage", () => {
      const minion = withMinion(rogue());
      const touched = withBelle(touchOnto(minion.state, minion.id));
      const run = villainPhase(touched.state, true);
      expect(run.offeredTimes).toBeGreaterThan(0);
      const dealtByMinion = ofType(run.events, "damageDealt").filter(
        (e) => e.sourceInstanceId === minion.id && e.targetInstanceId === rogueId(run.state),
      );
      expect(dealtByMinion).toEqual([]);
      expect(
        ofType(run.events, "statusGiven").filter((e) => e.instanceId === rogueId(run.state) && e.status === "tough"),
      ).toHaveLength(1);
    });

    it("near miss: Touched on a different enemy than the attacker: not offered for the villain's attack", () => {
      const minion = withMinion(rogue());
      // Hydra Mercenary hosts Touched; the villain's own attack must not offer Belle. Only the minion's does.
      const touched = withBelle(touchOnto(minion.state, minion.id));
      const run = villainPhase(touched.state, false);
      const attacks = ofType(run.events, "enemyActivated").filter((e) => e.activation === "attack").length;
      expect(attacks).toBeGreaterThanOrEqual(2);
      expect(run.offeredTimes).toBe(1);
    });

    it("near miss: with no Touched attached to any enemy, never offered", () => {
      const withCard = withBelle(withMinion(rogue()).state);
      const run = villainPhase(withCard.state, false);
      expect(run.offeredTimes).toBe(0);
    });
  });

  describe("Superpower Adaptation (38009): search the host owner's discard pile for a same-classification event", () => {
    /** P2's discard pile gets `codes`; Rogue (P1) has Superpower Adaptation in hand. */
    function table(codes: readonly string[]) {
      let state = duo();
      const ids: Record<string, InstanceId> = {};
      for (const code of codes) {
        const moved = moveToDiscard(state, P2, code);
        state = moved.state;
        ids[code] = moved.id;
      }
      return { state, ids };
    }
    it("Touched on an ally (Justice): offers P2's Justice events only, adds the pick to Rogue's hand, still P2's card", () => {
      const { state, ids } = table([FOR_JUSTICE, GREAT_RESPONSIBILITY, BACKFLIP, EMERGENCY]);
      const ally = withAlly(patchInstance(state, playerOf(state, P2).deck[0]!, {}), P2);
      const patched = patchInstance(ally.state, ally.id, { cardId: cardId(DAREDEVIL) });
      const touched = touchOnto(patched, ally.id);
      // Rogue's own discard holds a hero event too: not P2's pile, never offered.
      const own = moveToDiscard(touched, P1, GOIN_ROGUE);
      const offered: string[][] = [];
      const run = playEvent(own.state, ADAPTATION, 0, choosing([ids[GREAT_RESPONSIBILITY]!], offered));
      const options = offered.flat();
      expect(options).toEqual(expect.arrayContaining([ids[FOR_JUSTICE]!, ids[GREAT_RESPONSIBILITY]!]));
      expect(options).not.toContain(ids[BACKFLIP]);
      expect(options).not.toContain(ids[EMERGENCY]);
      expect(options).not.toContain(own.id);
      expect(handOf(run.state)).toContain(ids[GREAT_RESPONSIBILITY]);
      expect(playerOf(run.state, P2).discard).not.toContain(ids[GREAT_RESPONSIBILITY]);
      expect(inst(run.state, ids[GREAT_RESPONSIBILITY]!).ownerId).toBe(P2);
      expect(playerOf(run.state, P1).discard).toContain(run.id);
    });

    it("the card taken stays P2's own (owner unchanged) while it is in Rogue's hand, and is played from there", () => {
      const { state, ids } = table([FOR_JUSTICE]);
      const ally = withAlly(state, P2);
      const patched = patchInstance(ally.state, ally.id, { cardId: cardId(DAREDEVIL) });
      const taken = playEvent(touchOnto(patched, ally.id), ADAPTATION, 0, choosing([ids[FOR_JUSTICE]!]));
      expect(inst(taken.state, ids[FOR_JUSTICE]!).ownerId).toBe(P2);
      const second = drive(taken.state, play(P1, ids[FOR_JUSTICE]!, payWith(taken.state, P1, 2, [ids[FOR_JUSTICE]!])));
      expect(inst(second.state, ids[FOR_JUSTICE]!).ownerId).toBe(P2);
      expect(handOf(second.state)).not.toContain(ids[FOR_JUSTICE]);
    });

    /**
     * ENGINE GAP (reported, Q29 / RRG p. 31): `resolve/play-card.ts` discards a played event to `frame.playerId`'s
     * pile, not its owner's, so the event P2 owns lands in Rogue's discard pile. `it.fails` flips to a failure
     * (remove the marker) once the engine discards to the owner's pile.
     */
    it.fails("the card stays P2's: played by Rogue, it goes to P2's discard pile, not hers", () => {
      const { state, ids } = table([GREAT_RESPONSIBILITY, FOR_JUSTICE]);
      const ally = withAlly(state, P2);
      const patched = patchInstance(ally.state, ally.id, { cardId: cardId(DAREDEVIL) });
      const touched = touchOnto(patched, ally.id);
      const taken = playEvent(touched, ADAPTATION, 0, choosing([ids[FOR_JUSTICE]!]));
      expect(handOf(taken.state)).toContain(ids[FOR_JUSTICE]);
      const second = drive(taken.state, play(P1, ids[FOR_JUSTICE]!, payWith(taken.state, P1, 2, [ids[FOR_JUSTICE]!])));
      expect(playerOf(second.state, P2).discard).toContain(ids[FOR_JUSTICE]);
      expect(playerOf(second.state, P1).discard).not.toContain(ids[FOR_JUSTICE]);
    });

    it("Touched on P2's hero (identity-specific): only that hero's events qualify, not aspect or basic", () => {
      const { state, ids } = table([FOR_JUSTICE, BACKFLIP, EMERGENCY]);
      const touched = touchOnto(state, identityOf(state, P2));
      const offered: string[][] = [];
      const run = playEvent(touched, ADAPTATION, 0, choosing([ids[BACKFLIP]!], offered));
      const options = offered.flat();
      expect(options).toContain(ids[BACKFLIP]);
      expect(options).not.toContain(ids[FOR_JUSTICE]);
      expect(options).not.toContain(ids[EMERGENCY]);
      expect(handOf(run.state)).toContain(ids[BACKFLIP]);
    });

    it("Touched on an enemy: nothing is searched or added", () => {
      const { state } = table([FOR_JUSTICE, GREAT_RESPONSIBILITY]);
      const minion = withMinion(state);
      const touched = touchOnto(minion.state, minion.id);
      const run = playEvent(touched, ADAPTATION, 0);
      expect(handOf(run.state)).toHaveLength(handOf(run.before).length - 1);
      expect(playerOf(run.state, P2).discard).toHaveLength(playerOf(run.before, P2).discard.length);
    });

    it("Touched set aside (nowhere in play): nothing is added", () => {
      const { state } = table([FOR_JUSTICE]);
      const run = playEvent(state, ADAPTATION, 0);
      expect(handOf(run.state)).toHaveLength(handOf(run.before).length - 1);
    });
  });
});
