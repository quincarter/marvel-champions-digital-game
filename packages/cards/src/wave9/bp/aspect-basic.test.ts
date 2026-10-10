import { BP_CARDS, PLAYABLE_CARDS, cardId, trait, type AnyCard } from "@mc/content";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  use,
} from "../../testing/harness.js";
import { moveToDiscard, withDamage, withForm } from "../../testing/staging.js";
import { VENOM_KIT } from "../../wave3/vnm/venom-kit.js";
import { BLANK, onlyDeck, piles, types } from "../testing.js";
import { BP_ASPECT_BASIC as REGISTRY, BP_ASPECT_BASIC_SKIPPED as SKIPPED } from "./aspect-basic.js";
import { AYO_DEPS, AYO_RESPONSE_DEPS, DEPS, engaged, scripted, type ScriptOpts } from "./aspect-basic.testing.js";
import { bpGame, bpHeroGame } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 9 `bp/aspect-basic`, first half (51014 to 51022), docs/phase7-wave9.md sections 3.36, 3.38, 3.39, 3.43 and 3.52.
 * The real precon `bp-justice` against Core's Rhino (ATK 2, SCH 1). Black Panther is ATK 1, THW 2, DEF 2 in hero form; Shuri is the
 * alter-ego. Only Core, the earlier waves and this pack's modules are scripted; Ayo's Special (second half) is a test
 * stand-in in the Aneka tests only (`AYO_DEPS`).
 */
const MANIFOLD = "51014";
const INFILTRATION = "51015";
const UNDERCOVER = "51016";
const EMPATHY = "51017";
const RAFT = "51018";
const GEAR = "51019";
const RIFLE = "51020";
const STING = "51021";
const ANEKA = "51022";
const AYO = "51023";
const BUILD_SUPPORT = "51026"; // the precon's third player side scheme (second half of the module)
const SHOCKER = "01103"; // minion: ATK 2, SCH 1, 3 hit points, not Elite
const SANDMAN = "01102"; // minion: ATK 3, SCH 2, 4 hit points, Elite, Toughness
const MERCENARY = "01101"; // minion: ATK 1, SCH 0, 3 hit points, Guard

type Card = AnyCard & Record<string, unknown>;
const card = <T = Card>(code: string): T => BP_CARDS.find((c) => c.id === cardId(code)) as unknown as T;
const traitsOf = (code: string): string[] => ((card(code).traits ?? []) as unknown[]).map(String);

const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const threat = (s: GameState): number => inst(s, schemeOf(s)).threat;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const handOf = (s: GameState, p: PlayerId = P1): readonly InstanceId[] => playerOf(s, p).hand;
const discardOf = (s: GameState, p: PlayerId = P1): readonly InstanceId[] => playerOf(s, p).discard;
const refusal = (s: GameState, ...commands: Parameters<typeof scripted>[1][number][]): boolean => {
  try {
    scripted(s, commands);
    return false;
  } catch {
    return true;
  }
};
const basicAttack = (s: GameState, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: target }) as const;
const basicThwart = (s: GameState, scheme: InstanceId, thwarter: InstanceId = identityOf(s)) =>
  ({ type: "basicThwart", playerId: P1, thwarterInstanceId: thwarter, schemeInstanceId: scheme }) as const;

/** `code` moved to the hand and played, paid with other hand cards; returns the new instance and settled state. */
function played(
  state: GameState,
  code: string,
  opts: ScriptOpts & { readonly attachTo?: InstanceId; readonly player?: PlayerId } = {},
) {
  const player = opts.player ?? P1;
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const cost = card<{ cost: number }>(code).cost;
  const out = scripted(
    given.state,
    [
      play(
        player,
        id,
        payWith(given.state, player, cost, [id]),
        opts.attachTo ? { attachToInstanceId: opts.attachTo } : {},
      ),
    ],
    opts,
  );
  return { ...out, id, before: given.state };
}

/** Surgery: the first copy of `code` of `player` put into their play area (an ally or support), ready. */
function inPlay(state: GameState, code: string, player: PlayerId = P1) {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const s = given.state;
  return {
    id,
    state: {
      ...s,
      players: s.players.map((p) =>
        p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: { ...s.instances, [id]: { ...s.instances[id]!, faceup: true, controllerId: player } },
    } as GameState,
  };
}

/** Surgery: the upgrade `code` attached to `host` (default P1's identity), faceup. */
function attached(state: GameState, code: string, host: InstanceId = identityOf(state), player: PlayerId = P1) {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const s = given.state;
  const stripped = {
    ...s,
    players: s.players.map((p) => (p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const hosted = patchInstance(stripped, host, { attachments: [...stripped.instances[host]!.attachments, id] });
  return { id, state: patchInstance(hosted, id, { faceup: true, controllerId: player, attachedTo: host }) };
}

const withFormP2 = (s: GameState): GameState => withForm(s, { heroForm: 0 }, P2);

describe("registry", () => {
  it("every registered script validates", () => {
    for (const [id, def] of Object.entries(REGISTRY)) expect(validateDefinition(def), id).toEqual([]);
  });
  it("registers exactly these eight refs", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([
      "51014.manifold-response",
      "51016.when-defeated",
      "51017.show-of-empathy-forced-interrupt",
      "51018.the-raft-response",
      "51019.invisibility-gear-interrupt",
      "51020.sonic-rifle-action",
      "51021.sting-operation-response",
      "51022.aneka-response",
      "51022.aneka-special",
    ]);
  });
  it("every printed ref of the twenty cards is registered or skipped, none twice", () => {
    const codes = [...Array.from({ length: 17 }, (_, i) => String(51014 + i)), "51036", "51037", "51038"];
    const printed = codes.flatMap((code) => abilityRefIds(card(code) as never));
    expect(printed).toHaveLength(Object.keys(REGISTRY).length + Object.keys(SKIPPED).length);
    for (const ref of printed) expect(ref in REGISTRY !== ref in SKIPPED, ref).toBe(true);
  });
  it("skips Infiltration naming engine task 26, and the second half with its reason", () => {
    expect(Object.keys(SKIPPED).sort()).toEqual([
      "51015.infiltration-action",
      "51023.ayo-response",
      "51023.ayo-special",
      "51024.okoye-response",
      "51024.okoye-special",
      "51025.heart-of-the-panther-action",
      "51026.when-defeated",
      "51030.dora-milaje-action",
      "51030.dora-milaje-constant",
      "51036.redemption-constant",
      "51037.white-wolf-forced-response",
      "51038.target-spotter-interrupt",
    ]);
    expect(SKIPPED["51015.infiltration-action"]).toContain("task 26");
    expect(SKIPPED["51015.infiltration-action"]).toContain("discardFromEncounterDeck");
    for (const ref of Object.keys(SKIPPED).filter((r) => !r.startsWith("51015"))) {
      expect(SKIPPED[ref], ref).toBe("second half of the module, not started");
    }
  });
  it("timing words, costs, forms and labels", () => {
    expect(REGISTRY["51014.manifold-response"]).toMatchObject({ trigger: { kind: "response", forced: false } });
    expect(REGISTRY["51014.manifold-response"]!.cost).toBeUndefined();
    expect(REGISTRY["51016.when-defeated"]!.trigger).toMatchObject({ kind: "whenDefeated" });
    expect(REGISTRY["51017.show-of-empathy-forced-interrupt"]).toMatchObject({
      trigger: { kind: "interrupt", forced: true },
    });
    expect(REGISTRY["51018.the-raft-response"]).toMatchObject({ trigger: { kind: "response", forced: false } });
    expect(REGISTRY["51019.invisibility-gear-interrupt"]).toMatchObject({
      trigger: { kind: "interrupt", forced: false, would: true },
      cost: { discardSelf: true },
    });
    expect(REGISTRY["51021.sting-operation-response"]).toMatchObject({
      trigger: { kind: "response", forced: false },
      cost: { discardSelf: true },
    });
    expect(REGISTRY["51022.aneka-response"]).toMatchObject({ trigger: { kind: "response", forced: false } });
    expect(REGISTRY["51022.aneka-special"]!.trigger.kind).toBe("special");
    expect((REGISTRY["51022.aneka-special"] as unknown as { label?: unknown }).label).toBeUndefined();
  });
  it("Sonic Rifle aliases Venom's 20015 script and prints its name, cost, aspect, traits, keywords and text", () => {
    expect(REGISTRY["51020.sonic-rifle-action"]).toBe(VENOM_KIT["20015.sonic-rifle-action"]);
    const source = PLAYABLE_CARDS.find((c) => c.id === cardId("20015")) as unknown as Card;
    const mine = card(RIFLE);
    for (const key of ["name", "cost", "aspect", "traits", "keywords", "resourceIcons", "deckLimit", "unique"]) {
      expect(mine[key], key).toEqual(source[key]);
    }
    expect(mine.text).toEqual(source.text);
    expect(DEPS.abilities["20015.sonic-rifle-action"]).toBe(VENOM_KIT["20015.sonic-rifle-action"]);
  });
});

describe("printed data", () => {
  it("Manifold: unique Justice ally, cost 3, ATK 1, THW 2, 2 hit points, consequential 1/1, Avenger Wakanda, [energy]", () => {
    const c = card(MANIFOLD);
    expect([c.type, c.name, c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique, c.deckLimit]).toEqual([
      "ally",
      "Manifold",
      3,
      1,
      2,
      2,
      "justice",
      true,
      1,
    ]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(traitsOf(MANIFOLD)).toEqual(["AVENGER", "WAKANDA"]);
    expect(c.resourceIcons).toEqual({ energy: 1 });
  });
  it("Infiltration: Justice event, cost 1, [mental], Thwart, max 3, text 'remove 1 threat' (corrected from 'remote')", () => {
    const c = card(INFILTRATION);
    expect([c.type, c.cost, c.aspect, c.deckLimit]).toEqual(["event", 1, "justice", 3]);
    expect(traitsOf(INFILTRATION)).toEqual(["THWART"]);
    expect(c.resourceIcons).toEqual({ mental: 1 });
    expect((c.text as { current: string }).current).toContain("remove 1 threat from a scheme for each card");
  });
  it("Going Undercover: unique Justice player side scheme, cost 0, [physical], 4 threat (not per player), Victory 0", () => {
    const c = card(UNDERCOVER);
    expect([c.type, c.cost, c.aspect, c.unique]).toEqual(["player_side_scheme", 0, "justice", true]);
    expect(c.startingThreat).toEqual({ base: 4, perPlayer: 0 });
    expect(c.keywords).toEqual([{ name: "victory", value: 0 }]);
    expect(c.resourceIcons).toEqual({ physical: 1 });
  });
  it("Show of Empathy: unique Justice player side scheme, cost 0, [energy], 6 threat (not per player), Victory 0", () => {
    const c = card(EMPATHY);
    expect([c.type, c.cost, c.aspect, c.unique]).toEqual(["player_side_scheme", 0, "justice", true]);
    expect(c.startingThreat).toEqual({ base: 6, perPlayer: 0 });
    expect(c.keywords).toEqual([{ name: "victory", value: 0 }]);
    expect(c.resourceIcons).toEqual({ energy: 1 });
  });
  it("The Raft: unique Justice support, cost 2, [physical], Location and S.H.I.E.L.D.", () => {
    const c = card(RAFT);
    expect([c.type, c.cost, c.aspect, c.unique]).toEqual(["support", 2, "justice", true]);
    expect(traitsOf(RAFT)).toEqual(["LOCATION", "S.H.I.E.L.D."]);
    expect(c.resourceIcons).toEqual({ physical: 1 });
  });
  it("Invisibility Gear: Justice upgrade, cost 1, [energy], Item and Tech, any player's control, max 1 per player", () => {
    const c = card(GEAR);
    expect([c.type, c.cost, c.aspect, c.deckLimit]).toEqual(["upgrade", 1, "justice", 3]);
    expect(traitsOf(GEAR)).toEqual(["ITEM", "TECH"]);
    expect(c.resourceIcons).toEqual({ energy: 1 });
    expect(c.playRestrictions).toEqual({ anyPlayerControl: true, maxPerPlayer: 1 });
  });
  it("Sonic Rifle: Justice upgrade, cost 3, [mental], Tech and Weapon, Restricted, Uses (2 charge counters)", () => {
    const c = card(RIFLE);
    expect([c.type, c.cost, c.aspect, c.deckLimit]).toEqual(["upgrade", 3, "justice", 3]);
    expect(traitsOf(RIFLE)).toEqual(["TECH", "WEAPON"]);
    expect(c.keywords).toEqual([{ name: "restricted" }, { name: "uses", count: 2, counterType: "charge" }]);
  });
  it("Sting Operation: Justice upgrade, cost 2, [physical], Preparation and Tactic, max 1 per player", () => {
    const c = card(STING);
    expect([c.type, c.cost, c.aspect, c.deckLimit]).toEqual(["upgrade", 2, "justice", 3]);
    expect(traitsOf(STING)).toEqual(["PREPARATION", "TACTIC"]);
    expect(c.resourceIcons).toEqual({ physical: 1 });
    expect(c.playRestrictions).toEqual({ maxPerPlayer: 1 });
  });
  it("Aneka: unique Basic ally, cost 3, ATK 2, THW 1, 3 hit points, consequential 1/1, Dora Milaje Wakanda, [mental]", () => {
    const c = card(ANEKA);
    expect([c.type, c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique, c.deckLimit]).toEqual([
      "ally",
      3,
      2,
      1,
      3,
      "basic",
      true,
      1,
    ]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(traitsOf(ANEKA)).toEqual(["DORA MILAJE", "WAKANDA"]);
    expect(c.resourceIcons).toEqual({ mental: 1 });
    expect(trait("DORA MILAJE")).toBeDefined();
  });
});

/** Surgery: moves the first copy of `code` from P1 to `to`'s discard pile (owner and zone), as if `to` had always held it. */
function giveToDiscard(state: GameState, code: string, to: PlayerId): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, P1);
  const id = [...owner.deck, ...owner.hand, ...owner.discard].find((i) => codeOf(state, i) === code)!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              deck: p.deck.filter((i) => i !== id),
              hand: p.hand.filter((i) => i !== id),
              discard: p.discard.filter((i) => i !== id),
            }
          : p.playerId === to
            ? { ...p, discard: [...p.discard, id] }
            : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, ownerId: to, controllerId: to } },
    } as GameState,
  };
}

describe("51014.manifold-response: the chosen player searches for a player side scheme", () => {
  const REF = "51014.manifold-response";
  it("costs 3 [energy-icon card], enters play ready as an ally; accepted, the controller searches the deck and discard for either side scheme", () => {
    const base = bpGame();
    const r = played(base, MANIFOLD, { accept: [REF], target: [] });
    expect(r.taken()).toBe(1);
    expect(playerOf(r.state, P1).playArea).toContain(r.id);
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 4 + 1);
  });
  it("offers every player side scheme of the deck (Going Undercover and Show of Empathy), takes the chosen one to the hand", () => {
    const base = bpGame();
    // The three side schemes of the precon (Build Support too) are in the deck or the hand; those in the hand are not offered.
    const gu = moveToDiscard(base, P1, UNDERCOVER).id;
    const se = moveToDiscard(base, P1, EMPATHY).id;
    const bs = moveToDiscard(base, P1, BUILD_SUPPORT).id;
    const all = [UNDERCOVER, EMPATHY, BUILD_SUPPORT].reduce((acc, code) => moveToDiscard(acc, P1, code).state, base);
    const r0 = played(all, MANIFOLD, { accept: [REF], target: [gu] });
    expect(r0.offers["chooseCards"]).toEqual(expect.arrayContaining([gu, se, bs]));
    expect(r0.offers["chooseCards"]).toHaveLength(3);
    expect(handOf(r0.state)).toContain(gu);
    expect(handOf(r0.state)).not.toContain(se);
    expect(playerOf(r0.state, P1).deck).not.toContain(gu);
    const r1 = played(all, MANIFOLD, { accept: [REF], target: [se] });
    expect(handOf(r1.state)).toContain(se);
    expect(handOf(r1.state)).not.toContain(gu);
  });
  it("finds a side scheme in the discard pile, too, and offers it with the deck's", () => {
    const base = bpGame();
    const moved = moveToDiscard(bpGame(), P1, UNDERCOVER);
    const r = played(moved.state, MANIFOLD, { accept: [REF], target: [moved.id] });
    expect(handOf(r.state)).toContain(moved.id);
    expect(discardOf(r.state)).not.toContain(moved.id);
    expect(r.offers["chooseCards"]).toContain(moved.id);
    expect(base).toBeDefined();
  });
  it("declined: no search, no card added", () => {
    const r = played(bpGame(), MANIFOLD, { accept: [] });
    expect(r.taken()).toBe(0);
    expect(r.kinds).not.toContain("chooseCards");
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 4);
  });
  it("the search is compulsory: the pick is exactly 1 (min 1), made by the chosen player", () => {
    const base = [UNDERCOVER, EMPATHY, BUILD_SUPPORT].reduce(
      (acc, code) => moveToDiscard(acc, P1, code).state,
      bpGame(),
    );
    const r = played(base, MANIFOLD, { accept: [REF] });
    expect(r.mins["chooseCards"]).toBe(1);
    expect(
      handOf(r.state).filter((i) => [UNDERCOVER, EMPATHY, BUILD_SUPPORT].includes(codeOf(r.state, i))),
    ).toHaveLength(1);
  });
  it("with no player side scheme left in the deck or discard, nothing is asked and nothing is added", () => {
    let s = bpGame();
    for (const code of [UNDERCOVER, EMPATHY, BUILD_SUPPORT]) s = moveToHand(s, P1, code).state;
    const r = played(s, MANIFOLD, { accept: [REF] });
    expect(r.taken()).toBe(1);
    expect(r.kinds).not.toContain("chooseCards");
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 4);
  });
  it("two players: choosing the other player searches THEIR deck and discard pile and adds the card to THEIR hand", () => {
    const base = bpGame({ twoPlayers: true });
    const given = giveToDiscard(base, UNDERCOVER, P2);
    const r = played(given.state, MANIFOLD, { accept: [REF], target: [P2, given.id] });
    expect(r.kinds).toContain("choosePlayer");
    expect(handOf(r.state, P2)).toContain(given.id);
    expect(discardOf(r.state, P2)).not.toContain(given.id);
    // P1's own side scheme (Show of Empathy) was not searched for or taken.
    expect(handOf(r.state, P1).filter((i) => codeOf(r.state, i) === EMPATHY)).toHaveLength(
      handOf(r.before, P1).filter((i) => codeOf(r.before, i) === EMPATHY).length,
    );
  });
  it("two players: choosing a player whose deck holds no side scheme adds nothing, and P1's side schemes are not offered", () => {
    const base = bpGame({ twoPlayers: true });
    const r = played(base, MANIFOLD, { accept: [REF], target: [P2] });
    expect(r.kinds).not.toContain("chooseCards");
    expect(handOf(r.state, P2)).toHaveLength(handOf(base, P2).length);
  });
});

/** The villain phase on an encounter deck of exactly `deck` (top first: boost cards, then the cards dealt). */
function villainPhase(state: GameState, deck: readonly string[], opts: ScriptOpts = {}) {
  const staged = onlyDeck(state, ...deck);
  return scripted(
    staged,
    staged.players.map((p) => endTurn(p.playerId)),
    opts,
  );
}
const FILLER = "01100"; // Enhanced Ivory Horn: dealt to a player it attaches to Rhino and touches nobody

describe("51022.aneka-response / 51022.aneka-special: resolve the Special of another Dora Milaje ally", () => {
  const REF = "51022.aneka-response";
  const staged = () => {
    const hero = bpHeroGame();
    const patched = patchInstance(hero, schemeOf(hero), { threat: 5 });
    const aneka = inPlay(patched, ANEKA);
    const ayo = inPlay(aneka.state, AYO);
    return { state: ayo.state, aneka: aneka.id, ayo: ayo.id };
  };
  const thwartWithAneka = (s: GameState, aneka: InstanceId, opts: ScriptOpts = {}) =>
    scripted(s, [basicThwart(s, schemeOf(s), aneka)], opts);
  const attackWithAneka = (s: GameState, aneka: InstanceId, opts: ScriptOpts = {}) =>
    scripted(s, [{ ...basicAttack(s, villainOf(s)), attackerInstanceId: aneka }], opts);

  it("after Aneka attacks (ATK 2) and the response is accepted, Ayo's Special resolves: 1 more damage (stand-in), 3 in all; Aneka takes 1 consequential damage", () => {
    const { state, aneka } = staged();
    const r = attackWithAneka(state, aneka, { deps: AYO_DEPS, accept: [REF] });
    expect(r.taken()).toBe(1);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(3);
    expect(inst(r.state, aneka).damage).toBe(1);
  });
  it("after Aneka thwarts (THW 1): 5 to 4, then the Special of Ayo (stand-in damage to the villain); Aneka takes 1 consequential damage", () => {
    const { state, aneka } = staged();
    const r = thwartWithAneka(state, aneka, { deps: AYO_DEPS, accept: [REF] });
    expect(threat(r.state)).toBe(4);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(1);
    expect(inst(r.state, aneka).damage).toBe(1);
  });
  it("the response is optional: declined, only the attack's 2 damage is dealt", () => {
    const { state, aneka } = staged();
    const r = attackWithAneka(state, aneka, { deps: AYO_DEPS, accept: [] });
    expect(r.taken()).toBe(0);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
  });
  it("with no other Dora Milaje ally in play nothing is chosen and nothing resolves (Aneka herself is not 'another')", () => {
    const hero = bpHeroGame();
    const aneka = inPlay(hero, ANEKA);
    const r = attackWithAneka(aneka.state, aneka.id, { deps: AYO_DEPS, accept: [REF] });
    expect(r.offers["chooseTarget"]).toBeUndefined();
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
  });
  it("only Dora Milaje allies count: Ayo is chosen from an ally of another trait too (the choice offers Ayo alone)", () => {
    const { state, aneka, ayo } = staged();
    const withOther = inPlay(state, MANIFOLD); // an ally without the Dora Milaje trait
    const r = attackWithAneka(withOther.state, aneka, { deps: AYO_DEPS, accept: [REF] });
    expect(r.offers["chooseTarget"]).toEqual([ayo]);
  });
  it("without a script for Ayo's Special (second half not loaded) the response resolves nothing", () => {
    const { state, aneka } = staged();
    const r = attackWithAneka(state, aneka, { accept: [REF] });
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
  });
  it("the Special takes any player's ally: the query names the trait and 'not Aneka', no controller", () => {
    const effects = (REGISTRY["51022.aneka-response"] as unknown as { effects: { query: unknown }[] }).effects;
    expect(effects[0]!.query).toEqual({ categories: ["ally"], trait: trait("DORA MILAJE"), not: { self: true } });
  });
  it("Aneka's Special removes exactly 1 threat from a scheme: Ayo's response (stand-in) resolves it, 5 to 4; a resolved Special chains no further response", () => {
    const { state, ayo } = staged();
    const r = attackWithAnekaAs(state, ayo);
    expect(threat(r.state)).toBe(4);
    // Resolving the Special is not a basic power, so Aneka's own response did not run (the villain only took Ayo's 2).
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
    function attackWithAnekaAs(s: GameState, attacker: InstanceId) {
      return scripted(s, [{ ...basicAttack(s, villainOf(s)), attackerInstanceId: attacker }], {
        deps: AYO_RESPONSE_DEPS,
        accept: ["51023.ayo-response"],
      });
    }
  });
});

describe("51020.sonic-rifle-action (Venom's 20015 reprinted)", () => {
  const REF = "51020.sonic-rifle-action";
  it("played for 3 in hero form it attaches to the hero with 2 charge counters", () => {
    const r = played(bpHeroGame(), RIFLE, { attachTo: identityOf(bpHeroGame()) });
    expect(inst(r.state, r.id).counters["charge"]).toBe(2);
    expect(inst(r.state, r.id).attachedTo).toBe(identityOf(r.state));
  });
  it("Hero Action: exhausts, removes 1 charge, confuses the villain (no damage); a second use on a confused enemy deals 3 and discards the empty rifle", () => {
    const hero = bpHeroGame();
    const worn = attached(hero, RIFLE);
    const armed = patchInstance(worn.state, worn.id, { counters: { charge: 2 } });
    const first = scripted(armed, [use(P1, worn.id, REF)]);
    expect(inst(first.state, villainOf(first.state)).statuses.confused).toBe(1);
    expect(inst(first.state, villainOf(first.state)).damage).toBe(0);
    expect(inst(first.state, worn.id).counters["charge"]).toBe(1);
    expect(inst(first.state, worn.id).exhausted).toBe(true);
    const second = scripted(patchInstance(first.state, worn.id, { exhausted: false }), [use(P1, worn.id, REF)]);
    expect(inst(second.state, villainOf(second.state)).damage).toBe(3);
    expect(inst(second.state, worn.id).attachedTo).toBeNull();
    expect(discardOf(second.state)).toContain(worn.id);
  });
  it("is refused exhausted, and in alter-ego form", () => {
    const hero = bpHeroGame();
    const worn = attached(hero, RIFLE);
    const armed = patchInstance(worn.state, worn.id, { counters: { charge: 2 }, exhausted: true });
    expect(refusal(armed, use(P1, worn.id, REF))).toBe(true);
    const alter = attached(bpGame(), RIFLE);
    const loaded = patchInstance(alter.state, alter.id, { counters: { charge: 2 } });
    expect(refusal(loaded, use(P1, alter.id, REF))).toBe(true);
  });
});

describe("51021.sting-operation-response: after a non-Elite minion schemes, discard it", () => {
  const REF = "51021.sting-operation-response";
  const deck = [BLANK, BLANK, FILLER];
  const stung = (minion: string) => {
    const worn = attached(bpGame(), STING);
    return { ...worn, state: engaged(worn.state, minion, "m-target") };
  };
  it("costs 2 and attaches to your identity; a second copy is refused (max 1 per player)", () => {
    const r = played(bpHeroGame(), STING, { attachTo: identityOf(bpHeroGame()) });
    expect(inst(r.state, r.id).attachedTo).toBe(identityOf(r.state));
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 3);
    const second = moveToHand(r.state, P1, STING);
    expect(
      refusal(
        second.state,
        play(P1, second.ids[0]!, payWith(second.state, P1, 2, [second.ids[0]!]), {
          attachToInstanceId: identityOf(second.state),
        }),
      ),
    ).toBe(true);
  });
  it("Shocker (SCH 1, not Elite) schemes: Sting Operation is discarded and Shocker leaves play to the encounter discard pile, not defeated", () => {
    const { state, id } = stung(SHOCKER);
    const r = villainPhase(state, deck, { accept: [REF] });
    expect(r.taken()).toBe(1);
    expect(discardOf(r.state)).toContain(id);
    expect(playerOf(r.state, P1).playArea).not.toContain("m-target");
    // The three-card deck ran out during the phase, so the discard pile was reshuffled into the deck: it is in one or the other.
    expect([...piles(r.state).deck, ...piles(r.state).discard]).toContain("m-target");
    expect(types(r.events, "characterDefeated")).toHaveLength(0);
    // Both Rhino and Shocker schemed; the minion's scheme is not undone.
    expect(
      types(r.events, "schemeResolved").filter((e) => e.enemyInstanceId === ("m-target" as InstanceId)),
    ).toHaveLength(1);
  });
  it("the villain's own scheme does not offer it, and a declined response leaves the minion and the upgrade", () => {
    const { state, id } = stung(SHOCKER);
    const r = villainPhase(state, deck, { accept: [] });
    expect(r.taken()).toBe(0);
    expect(playerOf(r.state, P1).playArea).toContain("m-target");
    expect(inst(r.state, id).attachedTo).toBe(identityOf(r.state));
  });
  it("an Elite minion (Sandman) that schemes is not offered it", () => {
    const { state, id } = stung(SANDMAN);
    const r = villainPhase(state, deck, { accept: [REF] });
    expect(r.taken()).toBe(0);
    expect(playerOf(r.state, P1).playArea).toContain("m-target");
    expect(inst(r.state, id).attachedTo).toBe(identityOf(r.state));
  });
});

describe("51019.invisibility-gear-interrupt: when an enemy would attack you, discard it; that enemy schemes instead", () => {
  const REF = "51019.invisibility-gear-interrupt";
  const deck = [BLANK, BLANK, FILLER];
  it("costs 1, attaches to an identity, Tech and Item; a second copy is refused (max 1 per player)", () => {
    const worn = attached(bpHeroGame(), GEAR);
    const second = moveToHand(worn.state, P1, GEAR);
    expect(
      refusal(
        second.state,
        play(P1, second.ids[0]!, payWith(second.state, P1, 1, [second.ids[0]!]), {
          attachToInstanceId: identityOf(second.state),
        }),
      ),
    ).toBe(true);
  });
  it("accepted, Rhino (ATK 2, SCH 1) schemes instead of attacking: 1 threat on the main scheme, no damage, the gear is discarded", () => {
    const worn = attached(bpHeroGame(), GEAR);
    const control = villainPhase(worn.state, deck, { accept: [] });
    const r = villainPhase(worn.state, deck, { accept: [REF] });
    expect(r.taken()).toBe(1);
    expect(types(r.events, "attackResolved")).toHaveLength(0);
    expect(types(control.events, "attackResolved")).toHaveLength(1);
    expect(inst(r.state, identityOf(r.state)).damage).toBe(0);
    expect(inst(control.state, identityOf(control.state)).damage).toBe(2);
    expect(threat(r.state)).toBe(threat(control.state) + 1);
    expect(discardOf(r.state)).toContain(worn.id);
  });
  it("declined, Rhino attacks for 2 and the gear stays attached", () => {
    const worn = attached(bpHeroGame(), GEAR);
    const r = villainPhase(worn.state, deck, { accept: [] });
    expect(r.taken()).toBe(0);
    expect(inst(r.state, worn.id).attachedTo).toBe(identityOf(r.state));
  });
  it("is not offered in alter-ego form, where the enemy schemes anyway", () => {
    const worn = attached(bpGame(), GEAR);
    const r = villainPhase(worn.state, deck, { accept: [REF] });
    expect(r.taken()).toBe(0);
    expect(inst(r.state, worn.id).attachedTo).toBe(identityOf(r.state));
  });
  it("it answers a minion's attack too: Shocker (ATK 2) schemes instead", () => {
    const worn = attached(bpHeroGame(), GEAR);
    const state = engaged(worn.state, SHOCKER, "m-shocker");
    const control = villainPhase(state, deck, { accept: [] });
    // Rhino's attack (first offer) is declined; Shocker's would-attack (second offer) is not: accept only once more.
    const r = villainPhase(state, deck, { accept: [REF] });
    expect(r.taken()).toBe(1);
    expect(types(r.events, "attackResolved").length).toBe(types(control.events, "attackResolved").length - 1);
  });
});

/** The prompts of one kind, in the order asked. */
const asked = (r: { readonly history: readonly { kind: string; ids: string[]; player: PlayerId }[] }, kind: string) =>
  r.history.filter((h) => h.kind === kind);

describe("51016.when-defeated (Going Undercover): the defeating player looks at the top 5, may take 1 non-scenario-specific card", () => {
  // Rhino's own set (01098 to 01103) is scenario-specific; the Standard set (01186 and on) is not.
  const TOP = ["01100", "01186", "01188", "01099", "01187"] as const;
  const SCENARIO_SPECIFIC = ["01100", "01099"];
  /** Going Undercover played for real (cost 0), then dropped to `left` threat; Black Panther in hero form. */
  function ready(left: number, opts: { twoPlayers?: boolean } = {}) {
    const hero = onlyDeck(bpHeroGame(opts), ...TOP, "01098");
    const given = played(hero, UNDERCOVER, {});
    const lowered = patchInstance(given.state, given.id, { threat: left });
    return { ...given, state: lowered };
  }

  it("played for 0 it enters with 4 threat (not per player), unique, Victory 0", () => {
    const fresh = played(bpHeroGame(), UNDERCOVER, {});
    expect(inst(fresh.state, fresh.id).threat).toBe(4);
  });
  it("defeated by a thwart (2 threat left, THW 2): the defeating player is offered the three Standard cards only, not Rhino's two", () => {
    const s = ready(2);
    const r = scripted(s.state, [basicThwart(s.state, s.id)]);
    const first = asked(r, "chooseCards")[0]!;
    expect(first.ids).toHaveLength(3);
    const codes = first.ids.map((i) => codeOf(r.state, i as InstanceId)).sort();
    expect(codes).toEqual(["01186", "01187", "01188"]);
    for (const code of SCENARIO_SPECIFIC) expect(codes).not.toContain(code);
    expect(first.player).toBe(P1);
  });
  it("taking one: it goes to the victory display with Going Undercover; the other four stay in the encounter deck", () => {
    const s = ready(2);
    const pick = Object.values(s.state.instances).find((i) => i.cardId === "01188")!.instanceId;
    const r = scripted(s.state, [basicThwart(s.state, s.id)], { target: [pick] });
    expect(r.state.victoryDisplay).toContain(pick);
    expect(r.state.victoryDisplay).toContain(s.id);
    const deck = piles(r.state).deck;
    expect(deck).not.toContain(pick);
    expect(deck).toHaveLength(5);
    expect(deck.map((i) => codeOf(r.state, i)).sort()).toEqual(["01098", "01099", "01100", "01186", "01187"].sort());
  });
  it("the pick is optional ('may'): taking none leaves all six cards in the deck and only Going Undercover in the display", () => {
    const s = ready(2);
    const r = scripted(s.state, [basicThwart(s.state, s.id)], { target: [] });
    expect(asked(r, "chooseCards")[0]!.ids.length).toBeGreaterThan(0);
    expect(piles(r.state).deck).toHaveLength(6);
    expect(r.state.victoryDisplay).toEqual(expect.arrayContaining([s.id]));
    expect(r.state.victoryDisplay.filter((i) => codeOf(r.state, i) !== UNDERCOVER)).toHaveLength(
      s.state.victoryDisplay.filter((i) => codeOf(s.state, i) !== UNDERCOVER).length,
    );
  });
  it("the cards not taken are placed on the top and/or bottom: a placement prompt follows the pick", () => {
    const s = ready(2);
    const pick = Object.values(s.state.instances).find((i) => i.cardId === "01186")!.instanceId;
    const r = scripted(s.state, [basicThwart(s.state, s.id)], { target: [pick] });
    const prompts = r.history.map((h) => h.kind);
    expect(prompts.indexOf("chooseCards")).toBeGreaterThanOrEqual(0);
    expect(prompts.length).toBeGreaterThan(prompts.indexOf("chooseCards") + 1);
  });
  it("two players: when P2 thwarts it, P2 is the defeating player and makes the choices", () => {
    const base = ready(1, { twoPlayers: true });
    const p2hero = withFormP2(base.state);
    const r = scripted(p2hero, [
      endTurn(P1),
      { type: "basicThwart", playerId: P2, thwarterInstanceId: identityOf(p2hero, P2), schemeInstanceId: base.id },
    ]);
    const first = asked(r, "chooseCards")[0]!;
    expect(first.player).toBe(P2);
  });
});

describe("51017.show-of-empathy-forced-interrupt: threat removed from it lands on a non-Elite minion", () => {
  const REF = "51017.show-of-empathy-forced-interrupt";
  const M = "m-target" as InstanceId;
  /** Hero form, a minion `code` engaged with `damage` on it, Show of Empathy played (6 threat, or `left`). */
  function staged(code = SHOCKER, damage = 1, left = 6, opts: { twoPlayers?: boolean } = {}) {
    const hero = bpHeroGame(opts);
    const withMinion = withDamage(engaged(hero, code, "m-target"), M, damage);
    const given = played(withMinion, EMPATHY, {});
    return { ...given, state: patchInstance(given.state, given.id, { threat: left }) };
  }
  const redemptions = (s: GameState) => Object.values(s.instances).filter((i) => i.cardId === "51036");

  it("played for 0 it enters with 6 threat (not per player); a set-aside Redemption exists for the deck that holds it", () => {
    const given = played(bpHeroGame(), EMPATHY, {});
    expect(inst(given.state, given.id).threat).toBe(6);
    expect(redemptions(given.state)).toHaveLength(1);
    expect(given.state.encounterSetAside).toContain(redemptions(given.state)[0]!.instanceId);
  });
  it("a thwart for 2 on a minion with 2 hit points remaining: 2 threat on the minion; the scheme goes to the victory display and Redemption attaches", () => {
    const s = staged(SHOCKER, 1);
    const r = scripted(s.state, [basicThwart(s.state, s.id)]);
    // The interrupt sends the scheme to the victory display before the thwart removes its threat: no tokens are left on it.
    expect(types(r.events, "threatRemoved").filter((e) => e.schemeInstanceId === s.id)).toHaveLength(0);
    expect(inst(r.state, M).threat).toBe(2);
    expect(r.state.victoryDisplay).toContain(s.id);
    const [redemption] = redemptions(r.state);
    expect(inst(r.state, redemption!.instanceId).attachedTo).toBe(M);
    expect(inst(r.state, M).attachments).toContain(redemption!.instanceId);
    expect(r.state.encounterSetAside).not.toContain(redemption!.instanceId);
    expect(redemptions(r.state)).toHaveLength(1);
  });
  it("with more hit points remaining (3) the same thwart only places the threat: 4 on the scheme, 2 on the minion, nothing flips, Redemption stays set aside", () => {
    const s = staged(SHOCKER, 0);
    const r = scripted(s.state, [basicThwart(s.state, s.id)]);
    expect(inst(r.state, s.id).threat).toBe(4);
    expect(inst(r.state, M).threat).toBe(2);
    expect(r.state.victoryDisplay).not.toContain(s.id);
    expect(inst(r.state, redemptions(r.state)[0]!.instanceId).attachedTo).toBeNull();
  });
  it("threat accumulates: 2, then 2 more on the same minion (4 against 3 remaining) flips it at the second thwart, not the first", () => {
    const s = staged(SHOCKER, 0);
    const first = scripted(s.state, [basicThwart(s.state, s.id)]);
    const readied = patchInstance(first.state, identityOf(first.state), { exhausted: false });
    const second = scripted(readied, [basicThwart(readied, s.id)]);
    expect(inst(first.state, s.id).threat).toBe(4);
    expect(first.state.victoryDisplay).not.toContain(s.id);
    expect(inst(second.state, M).threat).toBe(4);
    expect(second.state.victoryDisplay).toContain(s.id);
    expect(inst(second.state, redemptions(second.state)[0]!.instanceId).attachedTo).toBe(M);
  });
  it("the threat removed and the threat placed are the same amount: a thwart larger than what is left (1 left, THW 2) places only 1", () => {
    const s = staged(SHOCKER, 0, 1);
    const r = scripted(s.state, [basicThwart(s.state, s.id)]);
    expect(inst(r.state, M).threat).toBe(1);
    expect(types(r.events, "threatRemoved").find((e) => e.schemeInstanceId === s.id)!.amount).toBe(1);
  });
  it("the last threat gone without the check passing: the scheme is defeated and its Victory 0 puts it in the victory display; no Redemption", () => {
    const s = staged(SHOCKER, 0, 1);
    const r = scripted(s.state, [basicThwart(s.state, s.id)]);
    expect(r.state.victoryDisplay).toContain(s.id);
    expect(inst(r.state, redemptions(r.state)[0]!.instanceId).attachedTo).toBeNull();
  });
  it("only an Elite minion (Sandman) in play: the threat is removed, nothing is placed, nobody is asked, and nothing flips", () => {
    const s = staged(SANDMAN, 0);
    const r = scripted(s.state, [basicThwart(s.state, s.id)]);
    expect(inst(r.state, s.id).threat).toBe(4);
    expect(inst(r.state, redemptions(r.state)[0]!.instanceId).attachedTo).toBeNull();
    expect(inst(r.state, M).threat).toBe(0);
    expect(r.kinds).not.toContain("chooseTarget");
    expect(r.state.victoryDisplay).not.toContain(s.id);
  });
  it("the choice offers only non-Elite minions: with Sandman and Shocker, Shocker alone", () => {
    const s = staged(SHOCKER, 0);
    const both = engaged(s.state, SANDMAN, "m-sandman");
    const r = scripted(both, [basicThwart(both, s.id)]);
    expect(asked(r, "chooseTarget")[0]?.ids ?? [M]).toEqual([M]);
    expect(inst(r.state, "m-sandman" as InstanceId).threat).toBe(0);
  });
  it("with two non-Elite minions the thwarting player chooses which receives it", () => {
    const s = staged(SHOCKER, 0);
    const both = engaged(s.state, MERCENARY, "m-merc");
    const r = scripted(both, [basicThwart(both, s.id)], { target: ["m-merc"] });
    expect(asked(r, "chooseTarget")[0]!.ids.sort()).toEqual(["m-merc", "m-target"]);
    expect(inst(r.state, "m-merc" as InstanceId).threat).toBe(2);
    expect(inst(r.state, M).threat).toBe(0);
  });
  it("any player's minion: the minion engaged with the other player in a two-player game can receive it", () => {
    const s = staged(SHOCKER, 0, 6, { twoPlayers: true });
    const other = engaged(s.state, MERCENARY, "m-merc", P2);
    const r = scripted(other, [basicThwart(other, s.id)], { target: ["m-merc"] });
    expect(inst(r.state, "m-merc" as InstanceId).threat).toBe(2);
  });
  it("the player whose card removes the threat chooses the minion: P2 thwarting P1's scheme is asked", () => {
    const s = staged(SHOCKER, 0, 6, { twoPlayers: true });
    const p2hero = withFormP2(s.state);
    const r = scripted(p2hero, [
      endTurn(P1),
      { type: "basicThwart", playerId: P2, thwarterInstanceId: identityOf(p2hero, P2), schemeInstanceId: s.id },
    ]);
    expect(asked(r, "chooseTarget")[0]?.player ?? P2).toBe(P2);
  });
  it("it is not a choice of the scheme's text to be declined: the interrupt is forced (resolves with no trigger prompt)", () => {
    const s = staged(SHOCKER, 0);
    const r = scripted(s.state, [basicThwart(s.state, s.id)]);
    expect(r.kinds).not.toContain("chooseTriggers");
    expect(REF in REGISTRY).toBe(true);
  });
});

describe("51018.the-raft-response: a minion that left play is tucked here, then threat is removed and a 4th minion deals one", () => {
  const REF = "51018.the-raft-response";
  /** Hero form, the main scheme at 5 threat, The Raft in play, the target minion engaged with `damage` on it. */
  function staged(code = SHOCKER, damage = 2) {
    const hero = patchInstance(bpHeroGame({ twoPlayers: true }), schemeOf(bpHeroGame({ twoPlayers: true })), {
      threat: 5,
    });
    const raft = inPlay(hero, RAFT);
    const withMinion = withDamage(engaged(raft.state, code, "m-target"), "m-target" as InstanceId, damage);
    return { state: withMinion, raft: raft.id };
  }
  /** Surgery: `n` minions already tucked under the Raft (out of play, in its tucked list). */
  function tuckedMinions(state: GameState, raft: InstanceId, n: number): GameState {
    let s = state;
    const codes = [MERCENARY, SHOCKER, SANDMAN];
    for (let i = 0; i < n; i++) {
      const id = `t-${i}` as InstanceId;
      s = engaged(s, codes[i % codes.length]!, id);
      s = {
        ...s,
        players: s.players.map((p) => ({ ...p, playArea: p.playArea.filter((x) => x !== id) })),
      } as GameState;
      s = patchInstance(s, id, { engagedWith: null, home: { kind: "tucked", hostInstanceId: raft } as never });
      s = patchInstance(s, raft, { tucked: [...s.instances[raft]!.tucked, id] });
    }
    return s;
  }
  const kill = (s: GameState, opts: ScriptOpts = {}) => scripted(s, [basicAttack(s, "m-target" as InstanceId)], opts);

  it("costs 2 and is unique with Location and S.H.I.E.L.D.; played it enters your play area", () => {
    const r = played(bpHeroGame(), RAFT, {});
    expect(playerOf(r.state, P1).playArea).toContain(r.id);
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 3);
  });
  it("Shocker (printed SCH 1) defeated: tucked under The Raft, 1 threat removed from the main scheme (5 to 4)", () => {
    const { state, raft } = staged(SHOCKER);
    const r = kill(state, { accept: [REF] });
    expect(r.taken()).toBe(1);
    expect(inst(r.state, raft).tucked).toEqual(["m-target"]);
    expect(piles(r.state).discard).not.toContain("m-target");
    expect(threat(r.state)).toBe(4);
  });
  it("Sandman (printed SCH 2) defeated: 2 threat removed (5 to 3)", () => {
    const { state, raft } = staged(SANDMAN, 3);
    const r = kill(state, { accept: [REF] });
    expect(inst(r.state, raft).tucked).toEqual(["m-target"]);
    expect(threat(r.state)).toBe(3);
  });
  it("a minion with printed SCH 0 (Hydra Mercenary) is tucked and removes nothing", () => {
    const { state, raft } = staged(MERCENARY, 2);
    const r = kill(state, { accept: [REF] });
    expect(inst(r.state, raft).tucked).toEqual(["m-target"]);
    expect(threat(r.state)).toBe(5);
  });
  it("declined: the minion stays in the encounter discard pile, nothing is tucked, no threat is removed", () => {
    const { state, raft } = staged(SHOCKER);
    const r = kill(state, { accept: [] });
    expect(r.taken()).toBe(0);
    expect(inst(r.state, raft).tucked).toEqual([]);
    expect(threat(r.state)).toBe(5);
    expect([...piles(r.state).deck, ...piles(r.state).discard]).toContain("m-target");
  });
  it("any minion that leaves play, not only one you defeat: P2's attack defeats it and The Raft (P1's) still answers", () => {
    const { state, raft } = staged(SHOCKER);
    const p2 = withFormP2(state);
    const r = scripted(
      p2,
      [
        endTurn(P1),
        {
          type: "basicAttack",
          playerId: P2,
          attackerInstanceId: identityOf(p2, P2),
          targetInstanceId: "m-target" as InstanceId,
        },
      ],
      { accept: [REF] },
    );
    expect(r.taken()).toBe(1);
    expect(inst(r.state, raft).tucked).toEqual(["m-target"]);
    expect(threat(r.state)).toBe(4);
  });
  it("the third tucked minion makes no deal: 3 minions here, nothing dealt", () => {
    const { state, raft } = staged(SHOCKER);
    const three = tuckedMinions(state, raft, 2);
    const r = kill(three, { accept: [REF] });
    expect(inst(r.state, raft).tucked).toHaveLength(3);
    expect(r.kinds).not.toContain("choosePlayer");
    expect(playerOf(r.state, P1).dealtEncounter).toHaveLength(playerOf(three, P1).dealtEncounter.length);
  });
  it("the fourth tucked minion: 1 of the 4, picked at random, is dealt facedown to the chosen player (P2) and 3 remain here", () => {
    const { state, raft } = staged(SHOCKER);
    const four = tuckedMinions(state, raft, 3);
    const r = kill(four, { accept: [REF], target: [P2] });
    expect(r.kinds).toContain("choosePlayer");
    expect(asked(r, "choosePlayer")[0]!.ids.sort()).toEqual([P1, P2]);
    const here = inst(r.state, raft).tucked;
    expect(here).toHaveLength(3);
    const dealt = playerOf(r.state, P2).dealtEncounter;
    expect(dealt).toHaveLength(playerOf(four, P2).dealtEncounter.length + 1);
    const pool = ["t-0", "t-1", "t-2", "m-target"];
    expect(pool).toContain(dealt[dealt.length - 1]);
    expect(pool.filter((x) => !here.includes(x as InstanceId))).toEqual([dealt[dealt.length - 1]]);
    expect(threat(r.state)).toBe(4);
  });
  it("the pick among the four is the seeded random draw: the same game gives the same card", () => {
    const { state, raft } = staged(SHOCKER);
    const four = tuckedMinions(state, raft, 3);
    const a = kill(four, { accept: [REF], target: [P1] });
    const b = kill(four, { accept: [REF], target: [P1] });
    expect(playerOf(a.state, P1).dealtEncounter).toEqual(playerOf(b.state, P1).dealtEncounter);
    expect(inst(a.state, raft).tucked).toEqual(inst(b.state, raft).tucked);
  });
  it("only minions count toward the four (a non-minion tucked card does not): three minions plus a treachery tucked deal nothing", () => {
    const { state, raft } = staged(SHOCKER);
    const three = tuckedMinions(state, raft, 2);
    const withTreachery = patchInstance(engaged(three, "01186", "t-treachery"), "t-treachery" as InstanceId, {
      engagedWith: null,
      home: { kind: "tucked", hostInstanceId: raft } as never,
    });
    const stuffed = patchInstance(withTreachery, raft, {
      tucked: [...withTreachery.instances[raft]!.tucked, "t-treachery" as InstanceId],
    });
    const r = kill(stuffed, { accept: [REF] });
    expect(r.kinds).not.toContain("choosePlayer");
  });
});

describe("51015.infiltration-action: skipped (engine task 26), so the card is inert", () => {
  it("has no script: the card's ref is in the skipped map and not in the registry", () => {
    expect("51015.infiltration-action" in REGISTRY).toBe(false);
    expect("51015.infiltration-action" in SKIPPED).toBe(true);
  });
});
