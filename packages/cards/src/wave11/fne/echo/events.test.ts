import { FNE_STARTER_DECKS, PLAYABLE_CARDS, cardId } from "@mc/content";
import { applyCommand, createGame, type Command, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import type { PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveStepwise, withForm } from "../../../testing/staging.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_ECHO_EVENTS as REGISTRY, FNE_ECHO_EVENTS_SKIPPED as SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Echo's events (docs/phase7-wave11.md section 3.9 and 8.4 line 7): Photographic Reflexes 60040a/b/c and Study the
 * Tape 60041, in the printed starter deck `fne-echo-protection` against Core's Rhino. Cards are placed by surgery
 * (retagging deck cards). Rulings: MC60 FAQ p. 26 (Photographic Reflexes' timing); August 13, 2026 (1) answer 2 (a
 * borrowed event cannot be tucked).
 */
const REFLEXES_IDS = [
  "60040a.photographic-reflexes-constant",
  "60040b.photographic-reflexes-constant",
  "60040c.photographic-reflexes-constant",
];
const STUDY = "60041.study-the-tape-action";
const WATCH = "60037a.watch-and-learn";

const HAYMAKER = "01087"; // basic event, cost 2, Attack
const FIRST_AID = "01086"; // basic event, cost 1
const ENERGY = "01088"; // basic resource
const ARMY_OF_ONE = "60048"; // protection event
const REFLEXES = "60040a";
const STUDY_THE_TAPE = "60041";
const MAKE_THE_CALL = "01071"; // leadership event, cost 0, "Pay the printed cost of an ally in any player's discard"
const HAWKEYE = "01066"; // ally, cost 3
const MARIA_HILL = "01067"; // ally, cost 2
const BACKFLIP = "01003"; // Spider-Man's event (identity-specific, another hero's), not found by the search

function newGame(twoPlayers = false): GameState {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-echo-protection")!;
  const config = coreScenario("rhino", {
    players: twoPlayers
      ? [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-spider-man-justice" }]
      : [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
  const created = createGame({ ...config, players: twoPlayers ? [seat, config.players[1]!] : [seat] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((i) => codeOf(s, i));
const handCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).discard);
const tuckedCodes = (s: GameState): string[] => codes(s, inst(s, identityOf(s)).tucked);

/** Moves a retagged deck card of `player` out of the deck into the named zone (or under the identity). */
function place(
  state: GameState,
  player: PlayerId,
  code: string,
  to: "hand" | "discard" | "tucked",
  exclude: readonly InstanceId[] = [],
) {
  const id = playerOf(state, player).deck.find((i) => !exclude.includes(i))!;
  let current = patchInstance(state, id, { cardId: cardId(code) });
  current = {
    ...current,
    players: current.players.map((p) =>
      p.playerId !== player
        ? p
        : { ...p, deck: p.deck.filter((i) => i !== id), ...(to === "tucked" ? {} : { [to]: [...p[to], id] }) },
    ),
  };
  if (to === "tucked") {
    const host = identityOf(current, player);
    current = patchInstance(current, host, { tucked: [...inst(current, host).tucked, id] });
  }
  return { state: current, id };
}
/** An empty hand for `player`, their cards back in the deck. */
const emptyHand = (state: GameState, player: PlayerId = P1): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [], deck: [...p.hand, ...p.deck] } : p)),
});

const taking =
  (...abilityIds: readonly string[]): Picker =>
  (state) => {
    const options = state.pendingChoice?.options ?? [];
    const hit = options.find((o) => abilityIds.some((a) => o.optionId.endsWith(`:${a}`)));
    return hit ? [hit.optionId] : firstLegal(state);
  };
function drive(state: GameState, command: Command, pick: Picker = taking()) {
  const first = applyCommand(state, command, WAVE11_DEPS);
  if (!first.ok) throw new Error(first.error.message);
  const rest = driveStepwise(WAVE11_DEPS, first.state, pick);
  return { state: rest.state, events: [...first.events, ...rest.events] as readonly GameEvent[] };
}
const accepted = (state: GameState, command: Command): boolean => applyCommand(state, command, WAVE11_DEPS).ok;

describe("wave 11 fne/echo/events", () => {
  it("registers only valid definitions, all four refs of the four cards, none skipped", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFLEXES_IDS, STUDY].sort());
    expect(SKIPPED).toEqual({});
  });

  it("has the printed timing: a constant working from the hand, and an Action", () => {
    for (const id of REFLEXES_IDS) {
      expect(REGISTRY[id]!.activeIn, id).toBe("hand");
      expect(REGISTRY[id]!.trigger, id).toMatchObject({
        kind: "constant",
        playableAsIfInHand: { costReduction: 2, form: "hero", discardSelfFromHand: true, reducesAbilityCost: true },
      });
    }
    expect(REGISTRY[STUDY]!.trigger).toEqual({ kind: "action" });
  });

  describe("Photographic Reflexes 60040a/b/c", () => {
    function table(code = HAYMAKER, form: "hero" | "alterEgo" = "hero") {
      let state = emptyHand(form === "hero" ? withForm(newGame(), { heroForm: 0 }) : withForm(newGame(), "alterEgo"));
      const tucked = place(state, P1, code, "tucked");
      const reflexes = place(tucked.state, P1, REFLEXES, "hand", [tucked.id]);
      state = reflexes.state;
      return { state, tucked: tucked.id, reflexes: reflexes.id };
    }

    it("plays a tucked Action event for its cost less 2, discarding the Reflexes from hand", () => {
      const t = table(); // Haymaker costs 2, so it is free
      const run = drive(t.state, play(P1, t.tucked));
      expect(handCodes(run.state)).toEqual([]);
      expect(discardCodes(run.state)).toEqual(expect.arrayContaining([HAYMAKER, REFLEXES]));
      expect(tuckedCodes(run.state)).toEqual([]);
      const villain = inst(run.state, run.state.activeVillainId!);
      expect(villain.damage).toBeGreaterThan(0);
    });

    it("Watch and Learn is not offered for that event: it goes to the discard pile, not back under Echo", () => {
      const t = table();
      const run = drive(t.state, play(P1, t.tucked), taking(WATCH));
      expect(tuckedCodes(run.state)).toEqual([]);
      expect(discardCodes(run.state)).toContain(HAYMAKER);
    });

    it("control: the same event played from hand is tucked by Watch and Learn", () => {
      const base = emptyHand(withForm(newGame(), { heroForm: 0 }));
      const hay = place(base, P1, HAYMAKER, "hand");
      const e1 = place(hay.state, P1, ENERGY, "hand", [hay.id]);
      const e2 = place(e1.state, P1, ENERGY, "hand", [hay.id, e1.id]);
      const run = drive(e2.state, play(P1, hay.id, [e1.id, e2.id]), taking(WATCH));
      expect(tuckedCodes(run.state)).toEqual([HAYMAKER]);
    });

    it("works for a cost-1 event too: the reduction does not go below 0", () => {
      const t = table(ARMY_OF_ONE); // printed cost 1: free
      expect(accepted(t.state, play(P1, t.tucked))).toBe(true);
    });

    describe("with Make the Call: the reduction covers the chosen ally's cost (August 26, 2026 - Ruling 1)", () => {
      /** Make the Call (cost 0) tucked, the Reflexes and `resources` Haymakers (1 resource each) in hand, `ally` discarded. */
      function callTable(ally: string, resources: number) {
        const t = table(MAKE_THE_CALL);
        let state = t.state;
        const used = [t.tucked, t.reflexes];
        const target = place(state, P1, ally, "discard", used);
        state = target.state;
        used.push(target.id);
        const paid: InstanceId[] = [];
        for (let i = 0; i < resources; i++) {
          const e = place(state, P1, HAYMAKER, "hand", used);
          state = e.state;
          used.push(e.id);
          paid.push(e.id);
        }
        const command = (payment: readonly InstanceId[] = paid) =>
          play(P1, t.tucked, payment, { costChoices: { ally: [target.id] } });
        return { state, ally: target.id, paid, command };
      }

      it("a 3-cost ally costs 1: refused with nothing paid, played with 1 resource", () => {
        const c = callTable(HAWKEYE, 1);
        expect(accepted(c.state, c.command([]))).toBe(false);
        const run = drive(c.state, c.command());
        expect(playerOf(run.state, P1).playArea).toContain(c.ally);
        expect(discardCodes(run.state)).toEqual(expect.arrayContaining([MAKE_THE_CALL, REFLEXES, HAYMAKER]));
      });

      it("a 2-cost ally is free", () => {
        const c = callTable(MARIA_HILL, 0);
        const run = drive(c.state, c.command());
        expect(playerOf(run.state, P1).playArea).toContain(c.ally);
      });

      it("control: a permission reducing only the resource cost leaves the ally's 3 to pay", () => {
        const deps = {
          ...WAVE11_DEPS,
          abilities: Object.fromEntries(
            Object.entries(WAVE11_DEPS.abilities).map(([id, def]) => {
              const trigger = def.trigger;
              if (!REFLEXES_IDS.includes(id) || trigger.kind !== "constant" || !trigger.playableAsIfInHand)
                return [id, def];
              const { reducesAbilityCost: _dropped, ...spec } = trigger.playableAsIfInHand;
              return [id, { ...def, trigger: { ...trigger, playableAsIfInHand: spec } }];
            }),
          ),
        } as typeof WAVE11_DEPS;
        const c = callTable(HAWKEYE, 3);
        expect(applyCommand(c.state, c.command(c.paid.slice(0, 1)), deps).ok).toBe(false);
        expect(applyCommand(c.state, c.command(c.paid.slice(0, 2)), deps).ok).toBe(false);
        expect(applyCommand(c.state, c.command(), deps).ok).toBe(true);
      });
    });

    it("is not offered in alter-ego form", () => {
      const t = table(HAYMAKER, "alterEgo");
      expect(accepted(t.state, play(P1, t.tucked))).toBe(false);
    });

    it("is not offered without the Reflexes in hand", () => {
      const t = table();
      const gone = {
        ...t.state,
        players: t.state.players.map((p) => ({ ...p, hand: p.hand.filter((i) => i !== t.reflexes) })),
      } as GameState;
      expect(accepted(gone, play(P1, t.tucked))).toBe(false);
    });

    it("the star-cost card is never played itself", () => {
      const t = table();
      expect(accepted(t.state, play(P1, t.reflexes))).toBe(false);
    });
  });

  describe("Study the Tape 60041", () => {
    function table() {
      let state = emptyHand(emptyHand(withForm(newGame(true), { heroForm: 0 }), P2), P1);
      const study = place(state, P1, STUDY_THE_TAPE, "hand");
      state = study.state;
      return { state, study: study.id };
    }
    /** Picks player `owner` for the search, and the card with code `want`. */
    const searching =
      (owner: PlayerId, want: string): Picker =>
      (s) => {
        const options = s.pendingChoice?.options ?? [];
        const hit =
          options.find((o) => o.ref.kind === "player" && (o.ref as { playerId?: PlayerId }).playerId === owner) ??
          options.find(
            (o) => o.ref.kind === "card" && codeOf(s, (o.ref as { instanceId: InstanceId }).instanceId) === want,
          );
        return hit ? [hit.optionId] : firstLegal(s);
      };

    it("adds an aspect or basic event from another player's discard pile to Echo's hand; it stays its owner's", () => {
      const t = table();
      const filler = place(t.state, P2, FIRST_AID, "discard");
      const withHay = place(filler.state, P2, HAYMAKER, "discard", [filler.id]);
      const run = drive(withHay.state, play(P1, t.study), searching(P2, HAYMAKER));
      expect(handCodes(run.state)).toContain(HAYMAKER);
      expect(discardCodes(run.state, P2)).not.toContain(HAYMAKER);
      expect(inst(run.state, withHay.id).ownerId).toBe(P2);
    });

    it("finds a copy of Photographic Reflexes in a discard pile", () => {
      const t = table();
      const reflexes = place(t.state, P1, REFLEXES, "discard");
      const run = drive(reflexes.state, play(P1, t.study), searching(P1, REFLEXES));
      expect(handCodes(run.state)).toContain(REFLEXES);
    });

    it("does not find an identity-specific event or a non-event", () => {
      const t = table();
      const a = place(t.state, P1, STUDY_THE_TAPE, "discard");
      const b = place(a.state, P1, ENERGY, "discard", [a.id]);
      const c = place(b.state, P1, BACKFLIP, "discard", [a.id, b.id]);
      const run = drive(c.state, play(P1, t.study), searching(P1, STUDY_THE_TAPE));
      // The only legal event is none of these, so nothing is added (the Study the Tape just played is in the discard too).
      expect(handCodes(run.state)).toEqual([]);
    });

    it("a borrowed event played by Echo is not tucked by Watch and Learn (August 13, 2026 (1) answer 2)", () => {
      const t = table();
      const hay = place(t.state, P2, HAYMAKER, "discard");
      const taken = drive(hay.state, play(P1, t.study), searching(P2, HAYMAKER));
      const e1 = place(taken.state, P1, ENERGY, "hand", [hay.id]);
      const e2 = place(e1.state, P1, ENERGY, "hand", [hay.id, e1.id]);
      const run = drive(e2.state, play(P1, hay.id, [e1.id, e2.id]), taking(WATCH));
      expect(tuckedCodes(run.state)).toEqual([]);
      expect(discardCodes(run.state, P2)).toContain(HAYMAKER);
    });
  });
});
