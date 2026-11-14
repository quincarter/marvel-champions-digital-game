import { keywordTotal, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { P1, identityOf, inst, patchInstance, play, playerOf, resourceAbility, use } from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import {
  IRON_FIST_IRON_FIST_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  IRON_FIST_IRON_FIST_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";
import {
  IF_DEPS,
  chiOf,
  drive,
  ironFistGame,
  pickCard,
  rejected,
  staged,
  takeAbility,
  withChi,
  withUpgradeInPlay,
} from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

const LEI_KUNG = "64006.lei-kung-action";
const BOOK = "64007.book-of-the-iron-fist-action";
const CHANNEL = "64008.channel-the-iron-fist-interrupt";
const EMBODY_C = "64009.embody-the-dragon-constant";
const EMBODY_A = "64009.embody-the-dragon-action";
const FLOW = "64010.feel-the-flow-action";
const COMING = "64011.keep-em-coming-action";
const REDIRECT = "64012.redirect-chi-resource";

const codes = (s: GameState, ids: readonly InstanceId[]) => ids.map((id) => inst(s, id).cardId as string);
const attached = (s: GameState, code: string) => codes(s, inst(s, identityOf(s)).attachments).includes(code);
const villainOf = (s: GameState) => s.activeVillainId as InstanceId;

/** Puts these cards on top of the discard pile (the last one named on top), from the hand or deck. */
function discardTop(state: GameState, ...cardCodes: readonly string[]): GameState {
  let s = state;
  for (const code of cardCodes) {
    const owner = playerOf(s, P1);
    const id = [...owner.hand, ...owner.deck].find((i) => inst(s, i).cardId === (code as never));
    if (!id) throw new Error(`no ${code}`);
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: p.hand.filter((x) => x !== id),
              deck: p.deck.filter((x) => x !== id),
              discard: [id, ...p.discard],
            }
          : p,
      ),
    };
  }
  return s;
}

describe("wave 11 iron_fist/iron-fist/support-upgrades-allies", () => {
  it("registers only valid definitions and skips none", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [LEI_KUNG, BOOK, CHANNEL, EMBODY_C, EMBODY_A, FLOW, COMING, REDIRECT].sort(),
    );
  });
});

describe(`${LEI_KUNG}: exhaust and remove 1 chi from your identity to draw 1`, () => {
  const inPlay = (form: "hero" | "alterEgo", chi: number) => {
    const s = staged(ironFistGame(form), "64006", 1);
    const { state } = drive(s.state, s.command);
    return { state: withChi(state, chi), id: s.id };
  };
  it.each(["hero", "alterEgo"] as const)("draws a card for 1 chi in %s form", (form) => {
    const { state, id } = inPlay(form, 2);
    const handBefore = playerOf(state, P1).hand.length;
    const { state: after } = drive(state, use(P1, id, LEI_KUNG));
    expect(chiOf(after)).toBe(1);
    expect(inst(after, id).exhausted).toBe(true);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 1);
  });
  it("cannot be used with no chi", () => {
    const { state, id } = inPlay("hero", 0);
    expect(rejected(state, use(P1, id, LEI_KUNG))).toBe(true);
  });
});

describe(`${BOOK}: put the top discard card into play if it is a Technique`, () => {
  const bookGame = (...top: string[]) => {
    const s = staged(ironFistGame(), "64007", 2);
    const { state } = drive(s.state, s.command);
    return { state: discardTop(state, ...top), id: s.id };
  };
  it("puts a Technique on top of the discard into play without giving chi", () => {
    const { state, id } = bookGame("64009");
    const { state: after } = drive(state, use(P1, id, BOOK));
    expect(attached(after, "64009")).toBe(true);
    expect(chiOf(after)).toBe(0);
    expect(inst(after, id).exhausted).toBe(true);
  });
  it("does nothing when the Technique is in the discard pile but not on top", () => {
    const { state, id } = bookGame("64009", "64004");
    const { state: after } = drive(state, use(P1, id, BOOK));
    expect(attached(after, "64009")).toBe(false);
    expect(inst(after, id).exhausted).toBe(true); // the cost is paid either way
  });
});

describe(`${CHANNEL}: remove 1 chi when you attack to add 1 damage (2 if basic)`, () => {
  const basic = (state: GameState) => ({
    type: "basicAttack" as const,
    playerId: P1,
    attackerInstanceId: identityOf(state),
    targetInstanceId: villainOf(state),
  });
  it("a basic attack (ATK 2) deals 2 more", () => {
    const up = withUpgradeInPlay(withChi(ironFistGame(), 3), "64008");
    const { state: after } = drive(up.state, basic(up.state), takeAbility(CHANNEL));
    expect(chiOf(after)).toBe(2);
    expect(inst(after, villainOf(after)).damage).toBe(4);
  });
  it("an event attack (Fists of Fury) deals 1 more per instance", () => {
    const up = withUpgradeInPlay(withChi(ironFistGame(), 3), "64008");
    const s = staged(up.state, "64004", 1);
    const { state: after } = drive(s.state, s.command, takeAbility(CHANNEL, pickCard(villainOf(s.state))));
    expect(chiOf(after)).toBe(2);
    // Each of the three 1-damage instances of the one attack gets +1 (RRG 1.8 p. 10; owner ruling Q53): 3 x 2.
    expect(inst(after, villainOf(after)).damage).toBe(6);
  });
  it("is optional", () => {
    const up = withUpgradeInPlay(withChi(ironFistGame(), 3), "64008");
    const { state: after } = drive(up.state, basic(up.state));
    expect(chiOf(after)).toBe(3);
    expect(inst(after, villainOf(after)).damage).toBe(2);
  });
});

describe(`${EMBODY_C} / ${EMBODY_A}: move chi onto the card; retaliate X`, () => {
  it("moves 1 chi from Iron Fist and grants retaliate equal to the counters on the card", () => {
    const up = withUpgradeInPlay(withChi(ironFistGame(), 3), "64009");
    expect(keywordTotal(up.state, identityOf(up.state), "retaliate", IF_DEPS)).toBe(0);
    const { state: after } = drive(up.state, use(P1, up.id, EMBODY_A));
    expect(chiOf(after)).toBe(2);
    expect(inst(after, up.id).counters["chi"]).toBe(1);
    expect(keywordTotal(after, identityOf(after), "retaliate", IF_DEPS)).toBe(1);
    const { state: twice } = drive(after, use(P1, up.id, EMBODY_A));
    expect(keywordTotal(twice, identityOf(twice), "retaliate", IF_DEPS)).toBe(2);
  });
  it("is a hero action: refused in alter-ego form; retaliate only in hero form", () => {
    const up = withUpgradeInPlay(withChi(ironFistGame(), 3), "64009");
    const { state: moved } = drive(up.state, use(P1, up.id, EMBODY_A));
    const alter = withForm(moved, "alterEgo");
    expect(rejected(alter, use(P1, up.id, EMBODY_A))).toBe(true);
    expect(keywordTotal(alter, identityOf(alter), "retaliate", IF_DEPS)).toBe(0);
  });
});

describe(`${FLOW}: remove 1 chi to remove 1 threat`, () => {
  it("removes 1 threat for 1 chi", () => {
    const up = withUpgradeInPlay(withChi(ironFistGame(), 2), "64010");
    const state = patchInstance(up.state, up.state.mainScheme.instanceId, { threat: 5 });
    const { state: after } = drive(state, use(P1, up.id, FLOW));
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(4);
    expect(chiOf(after)).toBe(1);
  });
  it("cannot be used with no chi", () => {
    const up = withUpgradeInPlay(ironFistGame(), "64010");
    expect(rejected(up.state, use(P1, up.id, FLOW))).toBe(true);
  });
});

describe(`${COMING}: remove 2 chi to ready him`, () => {
  it("readies the exhausted identity for 2 chi", () => {
    const up = withUpgradeInPlay(withChi(ironFistGame(), 2), "64011");
    const tired = patchInstance(up.state, identityOf(up.state), { exhausted: true });
    const { state: after } = drive(tired, use(P1, up.id, COMING));
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
    expect(chiOf(after)).toBe(0);
  });
  it("cannot be used with 1 chi", () => {
    const up = withUpgradeInPlay(withChi(ironFistGame(), 1), "64011");
    expect(rejected(up.state, use(P1, up.id, COMING))).toBe(true);
  });
});

describe(`${REDIRECT}: remove 2 chi to generate two wild resources`, () => {
  it("pays for a 2-cost card", () => {
    const up = withUpgradeInPlay(withChi(ironFistGame(), 2), "64012");
    const g = staged(up.state, "64003", 0);
    const { state: after } = drive(g.state, play(P1, g.id, [], { abilities: [resourceAbility(up.id, REDIRECT)] }));
    expect(chiOf(after)).toBe(0);
    expect(playerOf(after, P1).discard).toContain(g.id);
  });
  it("cannot pay with 1 chi", () => {
    const up = withUpgradeInPlay(withChi(ironFistGame(), 1), "64012");
    const g = staged(up.state, "64003", 0);
    expect(rejected(g.state, play(P1, g.id, [], { abilities: [resourceAbility(up.id, REDIRECT)] }))).toBe(true);
  });
});
