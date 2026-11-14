import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  use,
  type Picker,
} from "../../../testing/harness.js";
import {
  IRON_FIST_IRON_FIST_IDENTITY as REGISTRY,
  IRON_FIST_IRON_FIST_IDENTITY_SKIPPED as SKIPPED,
} from "./identity.js";
import { chiOf, drive, ironFistGame, pickCard, rejected, staged, withTopOfDeck } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

const MASTER = "64001a.martial-arts-master";
const FORCED = "64001a.iron-fist-forced-response";
const DANNY = "64001b.danny-rand-constant";
const MEDITATION = "64001b.meditation";
const CHANNEL = "64008"; // a Technique upgrade (temporary)

/** Takes the optional "Response" trigger for Martial Arts Master when it is offered. */
const takeMaster: Picker = (state) => {
  const hit = state.pendingChoice?.options.find(
    (o) => o.ref.kind === "ability" && o.ref.abilityId === (MASTER as never),
  );
  return hit ? [hit.optionId] : firstLegal(state);
};
const codes = (s: GameState, ids: readonly InstanceId[]) => ids.map((id) => inst(s, id).cardId as string);
/** In play: attached to the identity (a Technique is an upgrade). */
const inPlay = (s: GameState, code: string) => codes(s, inst(s, identityOf(s)).attachments).includes(code);

describe("wave 11 iron_fist/iron-fist/identity", () => {
  it("registers only valid definitions and skips none", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual([MASTER, FORCED, DANNY, MEDITATION].sort());
    expect(REGISTRY[MASTER]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[FORCED]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[DANNY]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY[MEDITATION]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
  });
});

describe(`${MASTER}: after you play a card, place 1 chi counter`, () => {
  it("places one chi counter after a card is played; the resources spent are not played", () => {
    const { state, command } = staged(ironFistGame(), "64004", 1);
    const { state: after } = drive(state, command, takeMaster);
    expect(chiOf(after)).toBe(1); // the played event, not the one card paid with
  });

  it("each played card gives one: a free Technique upgrade then a paid event", () => {
    const first = staged(ironFistGame(), CHANNEL, 0);
    const { state: mid } = drive(first.state, first.command, takeMaster);
    expect(chiOf(mid)).toBe(1);
    const second = staged(mid, "64004", 1);
    const { state: after } = drive(second.state, second.command, takeMaster);
    expect(chiOf(after)).toBe(2);
  });

  it("is optional: declining places nothing", () => {
    const { state, command } = staged(ironFistGame(), "64004", 1);
    const { state: after } = drive(state, command); // firstLegal declines the optional response
    expect(chiOf(after)).toBe(0);
  });

  it("gives no chi in alter-ego form (a hero-face ability)", () => {
    const { state, command } = staged(ironFistGame("alterEgo"), CHANNEL, 0);
    const { state: after } = drive(state, command, takeMaster);
    expect(chiOf(after)).toBe(0);
  });
});

describe(`${FORCED}: after the player phase ends, remove all but 4 chi and heal 1 each`, () => {
  const endPhase = (chi: number, damage: number) => {
    const base = ironFistGame();
    const hurt = patchInstance(base, identityOf(base), { damage, counters: { chi } });
    return drive(hurt, endTurn(P1));
  };
  const healed = (events: readonly { type: string; amount?: number }[]) =>
    events.filter((e) => e.type === "damageHealed").reduce((n, e) => n + (e.amount ?? 0), 0);

  it("with 7 chi removes 3 and heals 3 damage", () => {
    const { state, events } = endPhase(7, 5);
    expect(chiOf(state)).toBe(4);
    expect(healed(events)).toBe(3);
  });

  it("with exactly 4 chi removes and heals nothing", () => {
    const { state, events } = endPhase(4, 3);
    expect(chiOf(state)).toBe(4);
    expect(healed(events)).toBe(0);
  });

  it("with fewer than 4 chi removes and heals nothing", () => {
    const { state, events } = endPhase(2, 3);
    expect(chiOf(state)).toBe(2);
    expect(healed(events)).toBe(0);
  });
});

describe(`${DANNY}: Technique cards lose temporary`, () => {
  it("a Technique played as Danny Rand stays in play at the end of the round", () => {
    const { state, command } = staged(ironFistGame("alterEgo"), CHANNEL, 0);
    const { state: played } = drive(state, command);
    expect(inPlay(played, CHANNEL)).toBe(true);
    const { state: after } = drive(played, endTurn(P1));
    expect(inPlay(after, CHANNEL)).toBe(true);
  });

  it("as Iron Fist the same Technique keeps temporary and is discarded at the end of the round", () => {
    const { state, command } = staged(ironFistGame(), CHANNEL, 0);
    const { state: played } = drive(state, command);
    expect(inPlay(played, CHANNEL)).toBe(true);
    const { state: after } = drive(played, endTurn(P1));
    expect(inPlay(after, CHANNEL)).toBe(false);
    expect(codes(after, playerOf(after, P1).discard)).toContain(CHANNEL);
  });
});

describe(`${MEDITATION}: search deck and discard for a Technique and put it into play`, () => {
  const meditate = (state: GameState, pick: Picker) => drive(state, use(P1, identityOf(state), MEDITATION), pick);

  it("puts a Technique from the deck into play without playing it (no chi) and shuffles", () => {
    const base = ironFistGame("alterEgo");
    const deckState = withTopOfDeck(base, CHANNEL);
    const target = playerOf(deckState, P1).deck[0]!;
    const { state: after } = meditate(deckState, pickCard(target, takeMaster));
    expect(inPlay(after, CHANNEL)).toBe(true);
    expect(chiOf(after)).toBe(0);
  });

  it("finds a Technique in the discard pile too", () => {
    const base = ironFistGame("alterEgo");
    const given = moveToHand(base, P1, CHANNEL);
    const id = given.ids[0]!;
    const inDiscard = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((h) => h !== id), discard: [...p.discard, id] } : p,
      ),
    };
    const { state: after } = meditate(inDiscard, pickCard(id, takeMaster));
    expect(inPlay(after, CHANNEL)).toBe(true);
    expect(playerOf(after, P1).discard).not.toContain(id);
  });

  it("offers no choose-none when a Technique exists: the pick is forced to one", () => {
    const deckState = withTopOfDeck(ironFistGame("alterEgo"), CHANNEL);
    let offered: { min: number; max: number } | undefined;
    meditate(deckState, (s) => {
      const c = s.pendingChoice!;
      if (c.options.some((o) => o.ref.kind === "card" && codes(s, [o.ref.instanceId])[0] === CHANNEL))
        offered = { min: c.minSelections, max: c.maxSelections };
      return firstLegal(s);
    });
    expect(offered).toEqual({ min: 1, max: 1 });
  });

  it("is limited to once per phase", () => {
    const base = ironFistGame("alterEgo");
    const given = moveToHand(base, P1, CHANNEL);
    const { state: once } = meditate(given.state, firstLegal);
    expect(rejected(once, use(P1, identityOf(once), MEDITATION))).toBe(true);
  });

  it("is an alter-ego action: refused in hero form", () => {
    const base = ironFistGame();
    expect(rejected(base, use(P1, identityOf(base), MEDITATION))).toBe(true);
  });
});
