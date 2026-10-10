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
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  use,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, moveToDiscard, withDamage, withForm } from "../../testing/staging.js";
import { VENOM_KIT } from "../../wave3/vnm/venom-kit.js";
import { NEXT_EVOL_PRECON_CABLE_DECK } from "../../wave7/next_evol/precon-cable-deck.js";
import { BLANK, onlyDeck, piles, types } from "../testing.js";
import { BP_ASPECT_BASIC as REGISTRY, BP_ASPECT_BASIC_SKIPPED as SKIPPED } from "./aspect-basic.js";
import { DEPS, engaged, scripted, tchallaGame, type ScriptOpts } from "./aspect-basic.testing.js";
import { bpGame, bpHeroGame } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 9 `bp/aspect-basic` (51014 to 51030, 51036 to 51038), docs/phase7-wave9.md sections 3.36, 3.38, 3.39, 3.43 and 3.52.
 * The real precon `bp-justice` against Core's Rhino (ATK 2, SCH 1). Black Panther is ATK 1, THW 2, DEF 2 in hero form; Shuri is the
 * alter-ego. Core, the earlier waves and this pack's modules are scripted.
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
const OKOYE = "51024";
const HEART = "51025";
const ENERGY = "51027";
const GENIUS = "51028";
const STRENGTH = "51029";
const DORA = "51030";
const REDEMPTION = "51036";
const WHITE_WOLF = "51037";
const SPOTTER = "51038";
const BEADS = "51010";
const CLAWS = "51011";
const BITES = "51012";
const SUIT = "51013";
const BUILD_SUPPORT = "51026"; // the precon's third player side scheme
const BLACK_CAT_ALLY = "01002"; // Core ally of the Spider-Man precon: not Wakanda
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
  it("registers exactly these refs", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([
      "51014.manifold-response",
      "51015.infiltration-action",
      "51016.when-defeated",
      "51017.show-of-empathy-forced-interrupt",
      "51018.the-raft-response",
      "51019.invisibility-gear-interrupt",
      "51020.sonic-rifle-action",
      "51021.sting-operation-response",
      "51022.aneka-response",
      "51022.aneka-special",
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
  });
  it("every printed ref of the twenty cards is registered or skipped, none twice", () => {
    const codes = [...Array.from({ length: 17 }, (_, i) => String(51014 + i)), "51036", "51037", "51038"];
    const printed = codes.flatMap((code) => abilityRefIds(card(code) as never));
    expect(printed).toHaveLength(Object.keys(REGISTRY).length + Object.keys(SKIPPED).length);
    for (const ref of printed) expect(ref in REGISTRY !== ref in SKIPPED, ref).toBe(true);
  });
  it("skips nothing", () => {
    expect(Object.keys(SKIPPED)).toEqual([]);
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
    for (const code of ["51023", "51024"]) {
      expect(REGISTRY[`${code}.${code === "51023" ? "ayo" : "okoye"}-response`]).toMatchObject({
        trigger: { kind: "response", forced: false },
      });
      expect(REGISTRY[`${code}.${code === "51023" ? "ayo" : "okoye"}-special`]!.trigger.kind).toBe("special");
    }
    expect(REGISTRY["51025.heart-of-the-panther-action"]).toMatchObject({ trigger: { kind: "action", form: "hero" } });
    expect(REGISTRY["51030.dora-milaje-action"]).toMatchObject({
      trigger: { kind: "action" },
      cost: { exhaustSelf: true },
    });
    expect(REGISTRY["51030.dora-milaje-constant"]!.trigger.kind).toBe("constant");
    expect(REGISTRY["51036.redemption-constant"]!.trigger.kind).toBe("constant");
    expect(REGISTRY["51037.white-wolf-forced-response"]).toMatchObject({ trigger: { kind: "response", forced: true } });
    expect(REGISTRY["51038.target-spotter-interrupt"]).toMatchObject({
      trigger: { kind: "interrupt", forced: false },
      cost: { spendCounters: { counterType: "target", amount: 1 } },
    });
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
  it("Ayo: unique Basic ally, cost 3, ATK 2, THW 1, 3 hit points, consequential 1/1, Dora Milaje Wakanda, [physical]", () => {
    const c = card(AYO);
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
    expect(traitsOf(AYO)).toEqual(["DORA MILAJE", "WAKANDA"]);
    expect(c.resourceIcons).toEqual({ physical: 1 });
  });
  it("Okoye: unique Basic ally, cost 4, ATK 2, THW 2, 3 hit points, consequential 1/1, Dora Milaje Wakanda, [energy]", () => {
    const c = card(OKOYE);
    expect([c.type, c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique, c.deckLimit]).toEqual([
      "ally",
      4,
      2,
      2,
      3,
      "basic",
      true,
      1,
    ]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(traitsOf(OKOYE)).toEqual(["DORA MILAJE", "WAKANDA"]);
    expect(c.resourceIcons).toEqual({ energy: 1 });
  });
  it("Heart of the Panther: Basic event, cost 2, [wild], Wakanda, Team-Up (Black Panther/T'Challa and Black Panther/Shuri), max 1 per deck", () => {
    const c = card(HEART);
    expect([c.type, c.cost, c.aspect, c.unique, c.deckLimit]).toEqual(["event", 2, "basic", false, 1]);
    expect(traitsOf(HEART)).toEqual(["WAKANDA"]);
    expect(c.resourceIcons).toEqual({ wild: 1 });
    expect(c.keywords).toEqual([{ name: "teamUp", names: ["Black Panther/T'Challa", "Black Panther/Shuri"] }]);
  });
  it("Build Support: unique Basic player side scheme, cost 1, [mental], 3 threat per player, Victory 0", () => {
    const c = card(BUILD_SUPPORT);
    expect([c.type, c.cost, c.aspect, c.unique, c.deckLimit]).toEqual(["player_side_scheme", 1, "basic", true, 1]);
    expect(c.startingThreat).toEqual({ base: 0, perPlayer: 3 });
    expect(c.keywords).toEqual([{ name: "victory", value: 0 }]);
    expect(c.resourceIcons).toEqual({ mental: 1 });
  });
  it("the three resources: Basic, no text and no ability, two icons each (Energy [energy], Genius [mental], Strength [physical]), max 1 per deck", () => {
    for (const [code, name, icons] of [
      [ENERGY, "Energy", { energy: 2 }],
      [GENIUS, "Genius", { mental: 2 }],
      [STRENGTH, "Strength", { physical: 2 }],
    ] as const) {
      const c = card(code);
      expect([c.type, c.name, c.aspect, c.deckLimit]).toEqual(["resource", name, "basic", 1]);
      expect(c.producesIcons, code).toEqual(icons);
      expect(c.abilities, code).toEqual([]);
      expect(abilityRefIds(c as never), code).toEqual([]);
    }
  });
  it("Dora Milaje: unique Basic support, cost 3, [wild], Wakanda", () => {
    const c = card(DORA);
    expect([c.type, c.cost, c.aspect, c.unique, c.deckLimit]).toEqual(["support", 3, "basic", true, 1]);
    expect(traitsOf(DORA)).toEqual(["WAKANDA"]);
    expect(c.resourceIcons).toEqual({ wild: 1 });
  });
  it("Redemption: Justice Condition upgrade with no cost, [mental], Linked (Show of Empathy), Victory 0", () => {
    const c = card(REDEMPTION);
    expect([c.type, c.cost, c.specialCost, c.aspect]).toEqual(["upgrade", 0, "dash", "justice"]);
    expect(traitsOf(REDEMPTION)).toEqual(["CONDITION"]);
    expect(c.resourceIcons).toEqual({ mental: 1 });
    expect(c.keywords).toEqual([
      { name: "linked", cardTitle: "Show of Empathy" },
      { name: "victory", value: 0 },
    ]);
  });
  it("White Wolf: unique Leadership ally, cost 3, ATK 2, THW 2, 3 hit points, consequential 0 attack / 2 thwart, Wakanda, [physical]", () => {
    const c = card(WHITE_WOLF);
    expect([c.type, c.name, c.subtitle, c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique]).toEqual([
      "ally",
      "White Wolf",
      "Hunter",
      3,
      2,
      2,
      3,
      "leadership",
      true,
    ]);
    expect(c.consequentialDamage).toEqual({ attack: 0, thwart: 2 });
    expect(traitsOf(WHITE_WOLF)).toEqual(["WAKANDA"]);
    expect(c.resourceIcons).toEqual({ physical: 1 });
  });
  it("Target Spotter: Aggression support, cost 1, [mental], Persona and S.H.I.E.L.D., Uses (2 target counters), max 3", () => {
    const c = card(SPOTTER);
    expect([c.type, c.cost, c.aspect, c.unique, c.deckLimit]).toEqual(["support", 1, "aggression", false, 3]);
    expect(traitsOf(SPOTTER)).toEqual(["PERSONA", "S.H.I.E.L.D."]);
    expect(c.resourceIcons).toEqual({ mental: 1 });
    expect(c.keywords).toEqual([{ name: "uses", count: 2, counterType: "target" }]);
  });
  it("Build Support aliases the script of 40027 and prints its name, cost, aspect, threat, keywords and text", () => {
    expect(REGISTRY["51026.when-defeated"]).toBe(NEXT_EVOL_PRECON_CABLE_DECK["40027.when-defeated"]);
    const source = PLAYABLE_CARDS.find((c) => c.id === cardId("40027")) as unknown as Card;
    const mine = card(BUILD_SUPPORT);
    for (const key of [
      "type",
      "name",
      "cost",
      "aspect",
      "traits",
      "keywords",
      "resourceIcons",
      "startingThreat",
      "unique",
    ]) {
      expect(mine[key], key).toEqual(source[key]);
    }
    expect(mine.text).toEqual(source.text);
    expect(DEPS.abilities["40027.when-defeated"]).toBe(NEXT_EVOL_PRECON_CABLE_DECK["40027.when-defeated"]);
  });
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

  it("after Aneka attacks (ATK 2) and the response is accepted, Ayo's Special resolves: 1 more damage (Ayo's real Special), 3 in all; Aneka takes 1 consequential damage", () => {
    const { state, aneka } = staged();
    const r = attackWithAneka(state, aneka, { accept: [REF] });
    expect(r.taken()).toBe(1);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(3);
    expect(inst(r.state, aneka).damage).toBe(1);
  });
  it("after Aneka thwarts (THW 1): 5 to 4, then the Special of Ayo (1 damage to the villain); Aneka takes 1 consequential damage", () => {
    const { state, aneka } = staged();
    const r = thwartWithAneka(state, aneka, { accept: [REF] });
    expect(threat(r.state)).toBe(4);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(1);
    expect(inst(r.state, aneka).damage).toBe(1);
  });
  it("the response is optional: declined, only the attack's 2 damage is dealt", () => {
    const { state, aneka } = staged();
    const r = attackWithAneka(state, aneka, { accept: [] });
    expect(r.taken()).toBe(0);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
  });
  it("with no other Dora Milaje ally in play nothing is chosen and nothing resolves (Aneka herself is not 'another')", () => {
    const hero = bpHeroGame();
    const aneka = inPlay(hero, ANEKA);
    const r = attackWithAneka(aneka.state, aneka.id, { accept: [REF] });
    expect(r.offers["chooseTarget"]).toBeUndefined();
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
  });
  it("only Dora Milaje allies count: Ayo is chosen from an ally of another trait too (the choice offers Ayo alone)", () => {
    const { state, aneka, ayo } = staged();
    const withOther = inPlay(state, MANIFOLD); // an ally without the Dora Milaje trait
    const r = attackWithAneka(withOther.state, aneka, { accept: [REF] });
    // The first target prompt is the response's own; the last one is Ayo's Special choosing an enemy.
    expect(asked(r, "chooseTarget")[0]!.ids).toEqual([ayo]);
  });
  it("the Special takes any player's ally: the query names the trait and 'not Aneka', no controller", () => {
    const effects = (REGISTRY["51022.aneka-response"] as unknown as { effects: { query: unknown }[] }).effects;
    expect(effects[0]!.query).toEqual({ categories: ["ally"], trait: trait("DORA MILAJE"), not: { self: true } });
  });
  it("Aneka's Special removes exactly 1 threat from a scheme: Ayo's real response resolves it, 5 to 4; a resolved Special chains no further response", () => {
    const { state, ayo } = staged();
    const r = attackWithAnekaAs(state, ayo);
    expect(threat(r.state)).toBe(4);
    // Resolving the Special is not a basic power, so Aneka's own response did not run (the villain only took Ayo's 2).
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
    function attackWithAnekaAs(s: GameState, attacker: InstanceId) {
      return scripted(s, [{ ...basicAttack(s, villainOf(s)), attackerInstanceId: attacker }], {
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

describe("51015.infiltration-action: choose 1 to 5, discard that many encounter cards, thwart for each", () => {
  const REF = "51015.infiltration-action";
  const CROWD_CONTROL = "01108"; // side scheme with a crisis icon
  const CHARGE = "01099"; // Rhino attachment, two copies
  const FILLER_A = "01098";
  /** Black Panther in hero form, the main scheme at 6 threat, the encounter deck exactly `deck` (top first). */
  const staged = (...deck: readonly string[]): GameState => {
    const hero = bpHeroGame();
    return onlyDeck(patchInstance(hero, schemeOf(hero), { threat: 6 }), ...deck);
  };
  /** Infiltration moved to hand and played for its cost of 1, the number named in the command when given. */
  const infiltrate = (state: GameState, number?: number, opts: ScriptOpts = {}) => {
    const given = moveToHand(state, P1, INFILTRATION);
    const id = given.ids[0]!;
    const selection = number === undefined ? {} : { costSelection: { discardFromEncounterDeck: number } };
    const out = scripted(given.state, [play(P1, id, payWith(given.state, P1, 1, [id]), selection)], opts);
    return { ...out, id, before: given.state };
  };
  const engagedWith = (s: GameState, id: InstanceId) => inst(s, id).engagedWith;

  it("is a Hero Action labeled thwart whose cost is the chosen discard", () => {
    expect(REGISTRY[REF]).toMatchObject({
      trigger: { kind: "action", form: "hero" },
      label: ["thwart"],
      cost: { discardFromEncounterDeck: { amount: { choose: { min: 1, max: 5 } }, slot: "discarded" } },
    });
    const printed = card<{ text: { current: string } }>(INFILTRATION).text.current;
    expect(printed).toContain("Choose a number from 1 to 5.");
    expect(printed).toContain("Put 1 minion discarded this way into play engaged with you.");
    expect(traitsOf(INFILTRATION)).toEqual(["THWART"]);
  });

  it("choosing 1: 1 card discarded, 1 threat removed; choosing 5: 5 and 5", () => {
    const deck = [BLANK, FILLER, FILLER_A, CHARGE, CHARGE, BLANK];
    const one = infiltrate(staged(...deck), 1);
    expect(threat(one.state)).toBe(5);
    expect(piles(one.state).discard.map((id) => codeOf(one.state, id))).toEqual([BLANK]);
    expect(piles(one.state).deck).toHaveLength(5);
    expect(types(one.events, "encounterDiscardCostSettled")).toMatchObject([{ chosen: 1, paid: true }]);
    expect(one.kinds).not.toContain("chooseNumber");

    const five = infiltrate(staged(...deck), 5);
    expect(threat(five.state)).toBe(1);
    expect(piles(five.state).discard).toHaveLength(5);
    expect(piles(five.state).deck.map((id) => codeOf(five.state, id))).toEqual([BLANK]);
    // One thwart of 5 against one scheme, by the player who played the card.
    expect(types(five.events, "threatRemoved").map((e) => e.amount)).toEqual([5]);
    // The event itself is in its owner's discard pile.
    expect(discardOf(five.state)).toContain(five.id);
  });

  it("without a number in the command the player is asked for one from 1 to 5", () => {
    const r = infiltrate(staged(BLANK, FILLER, FILLER_A, CHARGE, CHARGE, BLANK));
    expect(r.offers.chooseNumber).toEqual(["1", "2", "3", "4", "5"]);
    // The scripted player takes the first: 1 card, 1 threat.
    expect(threat(r.state)).toBe(5);
    expect(piles(r.state).discard).toHaveLength(1);
  });

  it("choosing 4 with a minion third from the top: 4 threat removed, the minion engaged with the player", () => {
    const r = infiltrate(staged(BLANK, FILLER, SHOCKER, CHARGE, CHARGE), 4);
    expect(threat(r.state)).toBe(2);
    const shocker = instancesOf(r.state, SHOCKER).find((id) => engagedWith(r.state, id) === P1);
    expect(shocker).toBeDefined();
    expect(playerOf(r.state, P1).playArea).toContain(shocker);
    expect(piles(r.state).discard.map((id) => codeOf(r.state, id))).not.toContain(SHOCKER);
    expect(piles(r.state).discard).toHaveLength(3);
    // Put into play, not revealed: Shocker's When Revealed dealt nothing.
    expect(types(r.events, "encounterCardRevealed")).toEqual([]);
    expect(inst(r.state, identityOf(r.state)).damage).toBe(inst(r.before, identityOf(r.before)).damage);
    // One minion among the discards: it is the only card offered, and it must be taken.
    expect(r.offers.chooseCards).toEqual([shocker]);
    expect(r.mins.chooseCards).toBe(1);
  });

  it("two minions among the discards: the player chooses the one that enters play; the other stays discarded", () => {
    const start = staged(SHOCKER, BLANK, MERCENARY, CHARGE);
    const [shocker, , mercenary] = piles(start).deck;
    const r = infiltrate(start, 3, { target: [mercenary!] });
    expect(r.offers.chooseCards).toEqual([shocker, mercenary]);
    expect(r.mins.chooseCards).toBe(1);
    expect(r.maxes.chooseCards).toBe(1);
    expect(engagedWith(r.state, mercenary!)).toBe(P1);
    expect(piles(r.state).discard).toContain(shocker);
    expect(engagedWith(r.state, shocker!)).toBeNull();
    expect(threat(r.state)).toBe(3);
  });

  it("no minion among the discards: nothing enters play and nothing is asked", () => {
    const r = infiltrate(staged(BLANK, FILLER, SHOCKER, CHARGE), 2);
    expect(threat(r.state)).toBe(4);
    expect(r.kinds).not.toContain("chooseCards");
    expect(instancesOf(r.state, SHOCKER).some((id) => engagedWith(r.state, id) === P1)).toBe(false);
    expect(piles(r.state).deck.map((id) => codeOf(r.state, id))).toEqual([SHOCKER, CHARGE]);
  });

  it("choosing 5 with 2 cards left: 2 discarded, the deck reset with one acceleration token, 2 threat removed", () => {
    const start = staged(BLANK, FILLER);
    const tokens = start.mainScheme.accelerationTokens;
    const r = infiltrate(start, 5);
    expect(types(r.events, "encounterDiscardCostSettled")).toMatchObject([
      { chosen: 5, deckEmptied: true, paid: true },
    ]);
    expect(threat(r.state)).toBe(4);
    expect(r.state.mainScheme.accelerationTokens).toBe(tokens + 1);
    expect(piles(r.state).deck).toHaveLength(2);
    expect(piles(r.state).discard).toEqual([]);
  });

  it("a discard that empties the deck still puts its minion into play, from the new deck", () => {
    const start = staged(BLANK, SHOCKER);
    const shocker = piles(start).deck[1]!;
    const r = infiltrate(start, 5);
    expect(threat(r.state)).toBe(4);
    expect(engagedWith(r.state, shocker)).toBe(P1);
    expect(piles(r.state).deck.map((id) => codeOf(r.state, id))).toEqual([BLANK]);
  });

  it("is a thwart: with a crisis icon in play the main scheme cannot be chosen", () => {
    const hero = bpHeroGame();
    const crisis = encounterCardInVillainArea(patchInstance(hero, schemeOf(hero), { threat: 6 }), CROWD_CONTROL, 2);
    const r = infiltrate(onlyDeck(crisis.state, BLANK, FILLER, CHARGE, CHARGE), 3);
    expect(r.offers.chooseTarget).toEqual([crisis.id]);
    // 3 against the 2 threat there defeats the side scheme; the main scheme keeps its 6.
    expect(threat(r.state)).toBe(6);
    expect(r.state.villainArea).not.toContain(crisis.id);
    expect(piles(r.state).discard).toHaveLength(3 + 1);
  });

  it("cannot be played in alter-ego form, and nothing is discarded for it", () => {
    const alterEgo = onlyDeck(bpGame(), BLANK, FILLER);
    const given = moveToHand(patchInstance(alterEgo, schemeOf(alterEgo), { threat: 6 }), P1, INFILTRATION);
    const id = given.ids[0]!;
    expect(refusal(given.state, play(P1, id, payWith(given.state, P1, 1, [id])))).toBe(true);
    expect(piles(given.state).deck).toHaveLength(2);
  });
});

describe("51023.ayo-response / 51023.ayo-special", () => {
  const REF = "51023.ayo-response";
  const staged = (extra?: (s: GameState) => GameState) => {
    const hero = bpHeroGame();
    const patched = patchInstance(hero, schemeOf(hero), { threat: 5 });
    const ayo = inPlay(patched, AYO);
    const aneka = inPlay(ayo.state, ANEKA);
    return { state: extra ? extra(aneka.state) : aneka.state, ayo: ayo.id, aneka: aneka.id };
  };
  const attackWith = (s: GameState, who: InstanceId, opts: ScriptOpts = {}) =>
    scripted(s, [{ ...basicAttack(s, villainOf(s)), attackerInstanceId: who }], opts);
  const thwartWith = (s: GameState, who: InstanceId, opts: ScriptOpts = {}) =>
    scripted(s, [basicThwart(s, schemeOf(s), who)], opts);

  it("costs 3 and enters play as an ally with no damage", () => {
    const r = played(bpHeroGame(), AYO);
    expect(playerOf(r.state, P1).playArea).toContain(r.id);
    expect(inst(r.state, r.id).damage).toBe(0);
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 4);
  });
  it("after Ayo attacks (ATK 2) and the response is accepted, Aneka's Special removes 1 threat: 5 to 4; Ayo takes 1 consequential damage", () => {
    const { state, ayo } = staged();
    const r = attackWith(state, ayo, { accept: [REF] });
    expect(r.taken()).toBe(1);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
    expect(threat(r.state)).toBe(4);
    expect(inst(r.state, ayo).damage).toBe(1);
  });
  it("after Ayo thwarts (THW 1): 5 to 4, then Aneka's Special: 3; Ayo takes 1 consequential damage", () => {
    const { state, ayo } = staged();
    const r = thwartWith(state, ayo, { accept: [REF] });
    expect(threat(r.state)).toBe(3);
    expect(inst(r.state, ayo).damage).toBe(1);
  });
  it("the response is optional: declined, only the attack's 2 damage is dealt and no threat is removed", () => {
    const { state, ayo } = staged();
    const r = attackWith(state, ayo, { accept: [] });
    expect(r.taken()).toBe(0);
    expect(threat(r.state)).toBe(5);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
  });
  it("with no other Dora Milaje ally in play nothing is chosen and nothing resolves", () => {
    const hero = bpHeroGame();
    const ayo = inPlay(patchInstance(hero, schemeOf(hero), { threat: 5 }), AYO);
    const r = thwartWith(ayo.state, ayo.id, { accept: [REF] });
    expect(r.kinds).not.toContain("chooseTarget");
    expect(threat(r.state)).toBe(4);
  });
  it("is not offered after the hero's own basic power or an ally without it: Aneka thwarting offers only her own response", () => {
    const { state, aneka } = staged();
    const r = thwartWith(state, aneka, { accept: [] });
    expect(asked(r, "chooseTriggers")[0]!.ids.map((id) => id.split(".").pop())).toHaveLength(1);
    expect(r.taken()).toBe(0);
  });
  it("Ayo's Special (resolved by Aneka's response): 1 damage to the villain, besides Aneka's own 2", () => {
    const { state, aneka } = staged();
    const r = attackWith(state, aneka, { accept: ["51022.aneka-response"] });
    expect(inst(r.state, villainOf(r.state)).damage).toBe(3);
  });
  it("the Special offers every enemy, a guarded minion too: Guard does not apply to 1 damage that is not an attack", () => {
    const { state, aneka } = staged((s) => engaged(s, MERCENARY, "m-guard"));
    const r = thwartWith(state, aneka, { accept: ["51022.aneka-response"], target: [villainOf(state)] });
    const prompts = asked(r, "chooseTarget");
    expect(prompts[prompts.length - 1]!.ids.sort()).toEqual([villainOf(r.state), "m-guard"].sort());
    expect(inst(r.state, villainOf(r.state)).damage).toBe(1);
    expect(inst(r.state, "m-guard" as InstanceId).damage).toBe(0);
  });
  it("the Special deals exactly 1: on a minion with 3 hit points it leaves 2 remaining, and never defeats the villain at 1 hit point", () => {
    const { state, aneka } = staged((s) => engaged(s, SHOCKER, "m-shock"));
    const r = thwartWith(state, aneka, { accept: ["51022.aneka-response"], target: ["m-shock"] });
    expect(inst(r.state, "m-shock" as InstanceId).damage).toBe(1);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
  });
});

describe("51024.okoye-response / 51024.okoye-special", () => {
  const REF = "51024.okoye-response";
  const ANEKA_REF = "51022.aneka-response";
  const staged = (opts: { form?: "hero" | "alterEgo"; extra?: (s: GameState) => GameState } = {}) => {
    const base =
      opts.form === "alterEgo" ? bpGame({ twoPlayers: true }) : withForm(bpGame({ twoPlayers: true }), { heroForm: 0 });
    const patched = patchInstance(base, schemeOf(base), { threat: 5 });
    const okoye = inPlay(patched, OKOYE);
    const aneka = inPlay(okoye.state, ANEKA);
    return { state: opts.extra ? opts.extra(aneka.state) : aneka.state, okoye: okoye.id, aneka: aneka.id };
  };
  const thwartWith = (s: GameState, who: InstanceId, opts: ScriptOpts = {}) =>
    scripted(s, [basicThwart(s, schemeOf(s), who)], opts);

  it("costs 4 and enters play as an ally with no damage", () => {
    const r = played(bpHeroGame(), OKOYE);
    expect(playerOf(r.state, P1).playArea).toContain(r.id);
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 5);
  });
  it("her own response: after Okoye thwarts (THW 2) Aneka's Special removes 1 more: 5 to 3, then 2; Okoye takes 1 consequential damage", () => {
    const { state, okoye } = staged();
    const r = thwartWith(state, okoye, { accept: [REF] });
    expect(r.taken()).toBe(1);
    expect(threat(r.state)).toBe(2);
    expect(inst(r.state, okoye).damage).toBe(1);
  });
  it("the Special: Aneka's response resolves it, and the chosen Okoye gets +1 ATK until the end of the phase: her basic attack deals 3", () => {
    const { state, okoye, aneka } = staged();
    const first = thwartWith(state, aneka, { accept: [ANEKA_REF], target: [okoye] });
    expect(threat(first.state)).toBe(4);
    const attack = scripted(first.state, [
      { ...basicAttack(first.state, villainOf(first.state)), attackerInstanceId: okoye },
    ]);
    expect(inst(attack.state, villainOf(attack.state)).damage).toBe(3);
  });
  it("the Special gives +1 THW too: Okoye's basic thwart removes 3", () => {
    const { state, okoye, aneka } = staged();
    const first = thwartWith(state, aneka, { accept: [ANEKA_REF], target: [okoye] });
    const second = thwartWith(first.state, okoye);
    expect(threat(second.state)).toBe(4 - 3);
  });
  it("the Special offers a Wakanda hero or ally: Black Panther in hero form and every Wakanda ally; the other player's non-Wakanda hero and ally are not", () => {
    const { state, okoye, aneka } = staged({
      extra: (s) => withForm(inPlay(s, BLACK_CAT_ALLY, P2).state, { heroForm: 0 }, P2),
    });
    const r = thwartWith(state, aneka, { accept: [ANEKA_REF], target: [okoye] });
    const prompts = asked(r, "chooseTarget");
    const special = prompts[prompts.length - 1]!;
    // P1's Black Panther (Wakanda trait), Aneka and Okoye; P2's Spider-Man and Black Cat are not Wakanda.
    expect(special.ids.sort()).toEqual([identityOf(r.state), aneka, okoye].sort());
  });
  it("Black Panther in hero form can be chosen: his basic thwart (THW 2) removes 3", () => {
    const { state, okoye, aneka } = staged();
    const hero = identityOf(state);
    const first = thwartWith(state, aneka, { accept: [ANEKA_REF], target: [hero, okoye] });
    expect(threat(first.state)).toBe(4);
    const second = scripted(first.state, [basicThwart(first.state, schemeOf(first.state))]);
    expect(threat(second.state)).toBe(1);
  });
  it("and +1 ATK: his basic attack (ATK 1) deals 2", () => {
    const { state, okoye, aneka } = staged();
    const hero = identityOf(state);
    const first = thwartWith(state, aneka, { accept: [ANEKA_REF], target: [hero, okoye] });
    const attack = scripted(first.state, [basicAttack(first.state, villainOf(first.state))]);
    expect(inst(attack.state, villainOf(attack.state)).damage).toBe(2);
  });
  it("in alter-ego form Black Panther is not a hero: only the Wakanda allies are offered", () => {
    const { state, okoye, aneka } = staged({ form: "alterEgo" });
    const r = scripted(state, [basicThwart(state, schemeOf(state), aneka)], { accept: [ANEKA_REF], target: [okoye] });
    const prompts = asked(r, "chooseTarget");
    expect(prompts[prompts.length - 1]!.ids.sort()).toEqual([aneka, okoye].sort());
  });
  it("lasts until the end of the phase only: two lasting effects (THW and ATK) now, none after the round", () => {
    const { state, okoye, aneka } = staged();
    const first = thwartWith(state, aneka, { accept: [ANEKA_REF], target: [okoye] });
    expect(first.state.lastingEffects).toHaveLength(2);
    const later = scripted(first.state, [endTurn(P1), endTurn(P2)]);
    expect(later.state.lastingEffects).toHaveLength(0);
  });
  it("without the response nothing is granted: declined, Okoye's attack deals 2", () => {
    const { state, okoye, aneka } = staged();
    const first = thwartWith(state, aneka, { accept: [] });
    expect(first.state.lastingEffects).toHaveLength(0);
    const attack = scripted(first.state, [
      { ...basicAttack(first.state, villainOf(first.state)), attackerInstanceId: okoye },
    ]);
    expect(inst(attack.state, villainOf(attack.state)).damage).toBe(2);
  });
});

/** Surgery: the first copy of `code` of P1 handed to `to` (owner, controller and hand). */
function giveToHand(state: GameState, code: string, to: PlayerId): { state: GameState; id: InstanceId } {
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
            ? { ...p, hand: [...p.hand, id] }
            : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, ownerId: to, controllerId: to } },
    } as GameState,
  };
}

describe("51030.dora-milaje-constant / 51030.dora-milaje-action", () => {
  const CONSTANT = "51030.dora-milaje-constant";
  const ACTION = "51030.dora-milaje-action";
  const staged = (opts: { damage?: number } = {}) => {
    const hero = bpHeroGame();
    const patched = patchInstance(hero, schemeOf(hero), { threat: 5 });
    const dora = inPlay(patched, DORA);
    const aneka = inPlay(dora.state, ANEKA);
    const withDamageOn = withDamage(aneka.state, aneka.id, opts.damage ?? 0);
    return { state: withDamageOn, dora: dora.id, aneka: aneka.id };
  };

  it("Wakanda identity (Black Panther, hero form): played for 0 with no card paid, and the card is not discarded as payment", () => {
    const given = moveToHand(bpHeroGame(), P1, DORA);
    const id = given.ids[0]!;
    const out = scripted(given.state, [play(P1, id, [])]);
    expect(playerOf(out.state, P1).playArea).toContain(id);
    expect(handOf(out.state)).toHaveLength(handOf(given.state).length - 1);
  });
  it("also in alter-ego form (Shuri has the Wakanda trait): played for 0", () => {
    const given = moveToHand(bpGame(), P1, DORA);
    const id = given.ids[0]!;
    const out = scripted(given.state, [play(P1, id, [])]);
    expect(playerOf(out.state, P1).playArea).toContain(id);
  });
  it("an identity without the Wakanda trait (the Spider-Man player) pays the full 3: refused with 2 cards, played with 3", () => {
    const two = bpGame({ twoPlayers: true });
    const given = giveToHand(two, DORA, P2);
    const hand = handOf(given.state, P2).filter((i) => i !== given.id);
    expect(refusal(given.state, play(P2, given.id, hand.slice(0, 2)), endTurn(P1))).toBe(true);
    const turn = scripted(given.state, [endTurn(P1), play(P2, given.id, payWith(given.state, P2, 3, [given.id]))]);
    expect(playerOf(turn.state, P2).playArea).toContain(given.id);
    expect(handOf(turn.state, P2).length).toBeLessThan(handOf(given.state, P2).length - 1);
  });
  it("the cost is ignored, not set: with T'Challa's Shadow (51031, +1 to each card you play) in play the card costs 1", () => {
    const base = bpHeroGame();
    const shadow = instancesOf(base, "51031")[0]!;
    const withShadow = patchInstance(
      {
        ...base,
        players: base.players.map((p) =>
          p.playerId === P1
            ? { ...p, setAside: p.setAside.filter((i) => i !== shadow), playArea: [...p.playArea, shadow] }
            : p,
        ),
        encounterDecks: Object.fromEntries(
          Object.entries(base.encounterDecks).map(([k, v]) => [
            k,
            { ...v, deck: v.deck.filter((i) => i !== shadow), discard: v.discard.filter((i) => i !== shadow) },
          ]),
        ),
      } as GameState,
      shadow,
      { faceup: true, controllerId: P1, counters: { doubt: 4 } },
    );
    const given = moveToHand(withShadow, P1, DORA);
    const id = given.ids[0]!;
    expect(refusal(given.state, play(P1, id, []))).toBe(true);
    const paid = scripted(given.state, [play(P1, id, payWith(given.state, P1, 1, [id]))]);
    expect(playerOf(paid.state, P1).playArea).toContain(id);
    expect(handOf(paid.state)).toHaveLength(handOf(given.state).length - 2);
  });
  it("Action: exhausts Dora Milaje, resolves the Special of Aneka (1 threat) and heals 1 damage from her: 2 damage to 1", () => {
    const { state, dora, aneka } = staged({ damage: 2 });
    const r = scripted(state, [use(P1, dora, ACTION)]);
    expect(inst(r.state, dora).exhausted).toBe(true);
    expect(threat(r.state)).toBe(4);
    expect(inst(r.state, aneka).damage).toBe(1);
  });
  it("an undamaged Dora Milaje ally: the Special still resolves, nothing is healed", () => {
    const { state, dora, aneka } = staged();
    const r = scripted(state, [use(P1, dora, ACTION)]);
    expect(threat(r.state)).toBe(4);
    expect(inst(r.state, aneka).damage).toBe(0);
  });
  it("heals only 1 even from a heavily damaged ally: 2 damage on Aneka (3 hit points) becomes 1, not 0", () => {
    const { state, dora, aneka } = staged({ damage: 2 });
    const r = scripted(state, [use(P1, dora, ACTION)]);
    expect(inst(r.state, aneka).damage).toBe(1);
  });
  it("the choice offers each Dora Milaje ally in play; with Ayo too, picking Ayo resolves her Special (1 damage to the villain) and heals her", () => {
    const base = staged();
    const ayo = inPlay(base.state, AYO);
    const damaged = withDamage(ayo.state, ayo.id, 1);
    const r = scripted(damaged, [use(P1, base.dora, ACTION)], { target: [ayo.id] });
    expect(asked(r, "chooseTarget")[0]!.ids.sort()).toEqual([base.aneka, ayo.id].sort());
    expect(inst(r.state, villainOf(r.state)).damage).toBe(1);
    expect(inst(r.state, ayo.id).damage).toBe(0);
    expect(threat(r.state)).toBe(5);
  });
  it("a non-Dora Milaje ally (Manifold) is not offered", () => {
    const base = staged();
    const manifold = inPlay(base.state, MANIFOLD);
    const r = scripted(manifold.state, [use(P1, base.dora, ACTION)]);
    expect(asked(r, "chooseTarget")[0]?.ids ?? [base.aneka]).toEqual([base.aneka]);
  });
  it("usable in alter-ego form as well as hero form (an Action, not a Hero Action)", () => {
    const hero = bpGame();
    const dora = inPlay(patchInstance(hero, schemeOf(hero), { threat: 5 }), DORA);
    const aneka = inPlay(dora.state, ANEKA);
    const r = scripted(aneka.state, [use(P1, dora.id, ACTION)]);
    expect(threat(r.state)).toBe(4);
  });
  it("refused while exhausted, and with no Dora Milaje ally in play", () => {
    const { state, dora } = staged();
    expect(refusal(patchInstance(state, dora, { exhausted: true }), use(P1, dora, ACTION))).toBe(true);
    const lone = inPlay(bpHeroGame(), DORA);
    expect(refusal(lone.state, use(P1, lone.id, ACTION))).toBe(true);
  });
  it("is a cost-reduction constant read from the hand and only for Dora Milaje itself", () => {
    const def = REGISTRY[CONSTANT] as unknown as { trigger: { costModifiers: { activeIn: string; delta: unknown }[] } };
    expect(def.trigger.costModifiers).toHaveLength(1);
    expect(def.trigger.costModifiers[0]!.activeIn).toBe("hand");
  });
});

/** Surgery: the first copy of `code` of `player`, wherever it is, moved to the `zone` ("deck" bottom, "discard" or "hand"). */
function placeIn(state: GameState, code: string, zone: "deck" | "discard" | "hand", player: PlayerId = P1): GameState {
  const owner = playerOf(state, player);
  const id = [...owner.deck, ...owner.hand, ...owner.discard].find((i) => codeOf(state, i) === code)!;
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            deck: [...p.deck.filter((i) => i !== id), ...(zone === "deck" ? [id] : [])],
            hand: [...p.hand.filter((i) => i !== id), ...(zone === "hand" ? [id] : [])],
            discard: [...p.discard.filter((i) => i !== id), ...(zone === "discard" ? [id] : [])],
          }
        : p,
    ),
  } as GameState;
}

describe("51025.heart-of-the-panther-action: Team-Up event; search for a Black Panther upgrade, put it into play, resolve up to 4 Specials", () => {
  const BP_UPGRADES = [BEADS, CLAWS, BITES, SUIT];
  /** Shuri's hero form with Core's T'Challa as the second player (both identities Heart names are in play). */
  const withTchalla = () => {
    const base = tchallaGame();
    const stocked = BP_UPGRADES.reduce((acc, code) => placeIn(acc, code, "deck"), base);
    return withForm(patchInstance(stocked, schemeOf(stocked), { threat: 5 }), { heroForm: 0 });
  };
  const cast = (state: GameState, opts: ScriptOpts = {}) => {
    const given = moveToHand(state, P1, HEART);
    const id = given.ids[0]!;
    const out = scripted(given.state, [play(P1, id, payWith(given.state, P1, 2, [id]))], opts);
    return { ...out, id, before: given.state };
  };

  it("Team-Up: playable with Core's T'Challa (the other player's identity) in play; costs 2 and the event ends in the discard pile", () => {
    const r = cast(withTchalla(), { target: [] });
    expect(discardOf(r.state)).toContain(r.id);
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 3);
  });
  it("Team-Up: also with T'Challa in his hero form (Black Panther/T'Challa names both sides)", () => {
    const state = withForm(withTchalla(), { heroForm: 0 }, P2);
    const r = cast(state, { target: [] });
    expect(discardOf(r.state)).toContain(r.id);
  });
  it("Team-Up: refused in a solo game (T'Challa is not in play)", () => {
    const given = moveToHand(bpHeroGame(), P1, HEART);
    expect(refusal(given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 2, [given.ids[0]!])))).toBe(true);
  });
  it("Team-Up: refused in a two-player game whose other hero is not T'Challa", () => {
    const state = withForm(bpGame({ twoPlayers: true }), { heroForm: 0 });
    const given = moveToHand(state, P1, HEART);
    expect(refusal(given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 2, [given.ids[0]!])))).toBe(true);
  });
  it("Hero Action: refused in alter-ego form even with T'Challa in play", () => {
    const given = moveToHand(tchallaGame(), P1, HEART);
    expect(refusal(given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 2, [given.ids[0]!])))).toBe(true);
  });
  it("searches the deck and the discard pile: all four Black Panther upgrades are offered, one of them from the discard pile", () => {
    const base = withTchalla();
    const r = cast(placeIn(base, BEADS, "discard"), { target: [] });
    const found = asked(r, "chooseCards")[0]!;
    expect(found.ids.map((id) => codeOf(r.state, id as InstanceId)).sort()).toEqual([...BP_UPGRADES].sort());
  });
  it("puts the chosen upgrade into play on Black Panther (not for a cost), shuffles the deck, then its Special resolves: Kimoyo Beads removes 1 threat", () => {
    const base = withTchalla();
    const beads = instancesOf(base, BEADS)[0]!;
    const r = cast(base, { target: [beads] });
    expect(inst(r.state, beads).attachedTo).toBe(identityOf(r.state));
    expect(playerOf(r.state, P1).deck).not.toContain(beads);
    expect(types(r.events, "deckShuffled").length).toBeGreaterThan(0);
    expect(threat(r.state)).toBe(4);
  });
  it("the choice of Specials is 'up to 4', at least one when one can resolve (wave 3 Q16): with all four attached, four are offered; Beads alone chosen, only Beads resolves", () => {
    const base = withTchalla();
    const all = [BEADS, CLAWS, BITES, SUIT].reduce(
      (acc, code) => {
        const next = attached(acc.state, code);
        return { state: next.state, ids: [...acc.ids, next.id] };
      },
      { state: base, ids: [] as InstanceId[] },
    );
    const r = cast(all.state, { target: [all.ids[0]!] });
    // Nothing is left to search for, so the only prompt is the Specials': 1 to 4.
    expect(asked(r, "chooseCards")).toHaveLength(1);
    expect(asked(r, "chooseCards")[0]!.ids.sort()).toEqual([...all.ids].sort());
    expect([r.mins["chooseCards"], r.maxes["chooseCards"]]).toEqual([1, 4]);
    expect(threat(r.state)).toBe(4);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
  });
  it("Specials resolve on every chosen upgrade: with Panther Claws already attached, Beads (1 threat) and Claws (2 damage to an enemy) both resolve", () => {
    const base = withTchalla();
    const claws = attached(base, CLAWS);
    const beads = instancesOf(claws.state, BEADS)[0]!;
    const r = cast(claws.state, { target: [beads, claws.id] });
    expect(threat(r.state)).toBe(4);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
  });
  it("with no Black Panther upgrade left in the deck or discard pile nothing is found, and the Specials of those in play still resolve", () => {
    const base = withTchalla();
    const claws = attached(base, CLAWS);
    // The other three are in the hand, out of the search.
    const emptied = [BEADS, BITES, SUIT].reduce((acc, code) => moveToHand(acc, P1, code).state, claws.state);
    const r = cast(emptied, { target: [claws.id] });
    expect(r.kinds).toContain("chooseCards");
    expect(asked(r, "chooseCards")).toHaveLength(1);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
    expect(discardOf(r.state)).toContain(r.id);
  });
  it("only upgrades the player controls: another player's Black Panther upgrade is not offered for a Special", () => {
    const base = withTchalla();
    const beads = instancesOf(base, BEADS)[0]!;
    const r = cast(base, { target: [beads] });
    const prompts = asked(r, "chooseCards");
    expect(prompts[prompts.length - 1]!.ids).toEqual([beads]);
  });
  it("a Black Panther upgrade only: a non-Black Panther upgrade of the deck (Sonic Rifle) is not offered for the search", () => {
    const base = withTchalla();
    const r = cast(base, { target: [] });
    const found = asked(r, "chooseCards")[0]!;
    expect(found.ids.map((id) => codeOf(r.state, id as InstanceId))).not.toContain(RIFLE);
  });
});

describe("51026.when-defeated (Build Support, a reprint of 40027)", () => {
  /** Hero form, Build Support played for 1 and dropped to `left` threat. */
  function ready(left: number, opts: { twoPlayers?: boolean } = {}) {
    const hero = bpHeroGame(opts);
    const given = played(hero, BUILD_SUPPORT, {});
    return { ...given, state: patchInstance(given.state, given.id, { threat: left }) };
  }
  const thwart = (s: { state: GameState; id: InstanceId }, opts: ScriptOpts = {}) =>
    scripted(s.state, [basicThwart(s.state, s.id)], opts);

  it("played for 1 it enters with 3 threat in a solo game, 6 with two players", () => {
    const solo = played(bpHeroGame(), BUILD_SUPPORT, {});
    expect(inst(solo.state, solo.id).threat).toBe(3);
    expect(handOf(solo.state)).toHaveLength(handOf(solo.before).length - 2);
    const duo = played(bpHeroGame({ twoPlayers: true }), BUILD_SUPPORT, {});
    expect(inst(duo.state, duo.id).threat).toBe(6);
  });
  it("a thwart that does not defeat it (3 threat, THW 2) leaves 1 and puts nothing into play", () => {
    const s = played(bpHeroGame(), BUILD_SUPPORT, {});
    const r = thwart(s);
    expect(inst(r.state, s.id).threat).toBe(1);
    expect(r.kinds).not.toContain("chooseCards");
  });
  it("defeated (2 threat, THW 2): Victory 0 sends it to the victory display, and the player searches deck and discard for a support of cost 3 or less", () => {
    const s = ready(2);
    const r = thwart(s, { target: [] });
    expect(r.state.victoryDisplay).toContain(s.id);
    const offered = asked(r, "chooseCards")[0]!.ids.map((id) => codeOf(r.state, id as InstanceId));
    expect(offered.length).toBeGreaterThan(0);
    for (const code of offered) expect(card<{ cost: number; type: string }>(code)).toMatchObject({ type: "support" });
    for (const code of offered) expect(card<{ cost: number }>(code).cost).toBeLessThanOrEqual(3);
  });
  it("the search is 'may': declined (nothing chosen), no support enters play; the choice is min 0", () => {
    const s = ready(2);
    const r = thwart(s, { target: [] });
    expect(r.mins["chooseCards"]).toBe(0);
    const supports = playerOf(r.state, P1).playArea.filter(
      (i) => card<{ type: string }>(codeOf(r.state, i)).type === "support",
    );
    expect(supports).toHaveLength(0);
  });
  it("a chosen support (The Raft, cost 2) from the deck is put into play without paying and the deck is shuffled", () => {
    const base = placeIn(bpHeroGame(), RAFT, "deck");
    const given = played(base, BUILD_SUPPORT, {});
    const s = { ...given, state: patchInstance(given.state, given.id, { threat: 2 }) };
    const raft = instancesOf(s.state, RAFT)[0]!;
    const r = thwart(s, { target: [raft] });
    expect(playerOf(r.state, P1).playArea).toContain(raft);
    expect(types(r.events, "deckShuffled").length).toBeGreaterThan(0);
    expect(handOf(r.state)).toHaveLength(handOf(s.state).length);
  });
  it("a support from the discard pile is found too", () => {
    const base = placeIn(bpHeroGame(), RAFT, "discard");
    const given = played(base, BUILD_SUPPORT, {});
    const s = { ...given, state: patchInstance(given.state, given.id, { threat: 2 }) };
    const raft = instancesOf(s.state, RAFT)[0]!;
    const r = thwart(s, { target: [raft] });
    expect(playerOf(r.state, P1).playArea).toContain(raft);
    expect(discardOf(r.state)).not.toContain(raft);
  });
  it("each player searches: in a two-player game the other player is asked too, for their own deck", () => {
    const s = ready(2, { twoPlayers: true });
    const r = thwart(s, { target: [] });
    expect(asked(r, "chooseCards").map((h) => h.player)).toEqual(expect.arrayContaining([P1]));
    const prompts = asked(r, "chooseCards");
    expect(prompts.map((h) => h.player)).toEqual([P1, P2]);
    // P1's deck and discard pile hold one support of cost 3 or less (the rest of the precon's are in the opening hand).
    expect(prompts[0]!.ids.map((id) => codeOf(r.state, id as InstanceId))).toEqual(["51007"]);
    // P2's offer is made of P2's own cards, every one a support costing 3 or less.
    for (const id of prompts[1]!.ids) {
      expect(playerOf(r.state, P2).deck.concat(playerOf(r.state, P2).discard)).toContain(id);
      const printed = PLAYABLE_CARDS.find((c) => c.id === cardId(codeOf(r.state, id as InstanceId))) as unknown as Card;
      expect(printed["type"]).toBe("support");
      expect(printed["cost"] as number).toBeLessThanOrEqual(3);
    }
  });
});

describe("51036.redemption-constant: take control of the attached minion as a Redeemed ally", () => {
  const M = "m-target" as InstanceId;
  /** Hero form, Shocker (ATK 2, SCH 1, 3 hit points) engaged with `damage` on it, Show of Empathy thwarted for 2: Redemption attaches. */
  function redeemed(damage = 1, opts: { twoPlayers?: boolean; thwarter?: PlayerId; minion?: string } = {}) {
    const hero = bpHeroGame(opts);
    const withMinion = withDamage(engaged(hero, opts.minion ?? SHOCKER, "m-target"), M, damage);
    const given = played(withMinion, EMPATHY, {});
    const scheme = patchInstance(given.state, given.id, { threat: 6 });
    const thwarter = opts.thwarter ?? P1;
    const staged = thwarter === P1 ? scheme : withFormP2(scheme);
    const commands =
      thwarter === P1
        ? [basicThwart(staged, given.id)]
        : [
            endTurn(P1),
            {
              type: "basicThwart",
              playerId: thwarter,
              thwarterInstanceId: identityOf(staged, thwarter),
              schemeInstanceId: given.id,
            } as const,
          ];
    const r = scripted(staged, commands, { target: [M] });
    const redemption = Object.values(r.state.instances).find((i) => i.cardId === REDEMPTION)!.instanceId;
    return { ...r, redemption, empathy: given.id };
  }
  const allyThwart = (s: GameState) =>
    scripted(s, [{ type: "basicThwart", playerId: P1, thwarterInstanceId: M, schemeInstanceId: schemeOf(s) }]);

  it("attached by Show of Empathy it is controlled and owned by the player who chose the minion, and the minion is treated as a Redeemed ally", () => {
    const r = redeemed();
    expect(inst(r.state, r.redemption)).toMatchObject({ attachedTo: M, ownerId: P1, controllerId: P1 });
    const minion = inst(r.state, M);
    expect(minion.controllerId).toBe(P1);
    expect(minion.engagedWith).toBeNull();
    expect(minion.treatedAs).toMatchObject({
      kind: "ally",
      traits: [trait("REDEEMED")],
      thwFromSch: true,
      consequential: 1,
      controller: P1,
    });
  });
  it("the redeemed ally keeps its damage (1) and the threat tokens placed on it (2)", () => {
    const r = redeemed();
    expect(inst(r.state, M).damage).toBe(1);
    expect(inst(r.state, M).threat).toBe(2);
  });
  it("its THW is its printed SCH: Shocker's basic thwart removes 1, not its ATK of 2, and it takes 1 consequential damage", () => {
    const base = withDamage(redeemed().state, M, 0);
    const s = patchInstance(base, schemeOf(base), { threat: 5 });
    const r = allyThwart(s);
    expect(threat(r.state)).toBe(4);
    expect(inst(r.state, M).damage).toBe(1);
    expect(inst(r.state, M).exhausted).toBe(true);
  });
  it("its basic attack uses its own ATK 2 and it takes 1 consequential damage after attacking", () => {
    const base = withDamage(redeemed().state, M, 0);
    const r = scripted(base, [{ ...basicAttack(base, villainOf(base)), attackerInstanceId: M }]);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
    expect(inst(r.state, M).damage).toBe(1);
  });
  it("it is no longer an enemy: the hero cannot attack it", () => {
    const base = redeemed().state;
    expect(refusal(base, basicAttack(base, M))).toBe(true);
  });
  it("defeated as an ally (3 hit points reached by its consequential damage) it goes to the encounter discard pile and Redemption to the victory display", () => {
    const base = redeemed(2);
    const r = scripted(patchInstance(base.state, schemeOf(base.state), { threat: 5 }), [
      { type: "basicThwart", playerId: P1, thwarterInstanceId: M, schemeInstanceId: schemeOf(base.state) },
    ]);
    expect(playerOf(r.state, P1).playArea).not.toContain(M);
    expect(piles(r.state).discard).toContain(M);
    expect(r.state.victoryDisplay).toContain(base.redemption);
    expect(r.state.victoryDisplay).toContain(base.empathy);
    expect(inst(r.state, base.redemption).attachedTo).toBeNull();
  });
  it("two players: when the other player's thwart removes the threat, that player chooses the minion and controls Redemption and the ally", () => {
    // Spider-Man's THW is 1, so the minion needs 1 hit point left for the 1 threat to flip Show of Empathy.
    const r = redeemed(2, { twoPlayers: true, thwarter: P2 });
    expect(inst(r.state, r.redemption)).toMatchObject({ attachedTo: M, ownerId: P2, controllerId: P2 });
    expect(inst(r.state, M).controllerId).toBe(P2);
    expect(inst(r.state, M).treatedAs).toMatchObject({ kind: "ally", controller: P2 });
  });
  it("is a constant with Mind Control's rule: THW from printed SCH, 1 consequential damage, the Redeemed trait", () => {
    expect(REGISTRY["51036.redemption-constant"]!.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "treatHostAsAlly", traits: [trait("REDEEMED")], thwFromSch: true, consequential: 1 }],
    });
  });
});

describe("51037.white-wolf-forced-response", () => {
  const REF = "51037.white-wolf-forced-response";
  const staged = () => {
    const base = withForm(bpGame({ swap: { "51006": WHITE_WOLF } }), { heroForm: 0 });
    const wolf = inPlay(patchInstance(base, schemeOf(base), { threat: 5 }), WHITE_WOLF);
    return { state: wolf.state, wolf: wolf.id };
  };
  const attackWith = (s: GameState, who: InstanceId) =>
    scripted(s, [{ ...basicAttack(s, villainOf(s)), attackerInstanceId: who }]);

  it("costs 3 and enters play as an ally", () => {
    const base = bpHeroGame({ swap: { "51006": WHITE_WOLF } });
    const r = played(base, WHITE_WOLF);
    expect(playerOf(r.state, P1).playArea).toContain(r.id);
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 4);
    expect(threat(r.state)).toBe(threat(base));
  });
  it("after he attacks (ATK 2) 1 threat is placed on the main scheme without being asked: 5 to 6; no consequential damage for an attack", () => {
    const { state, wolf } = staged();
    const r = attackWith(state, wolf);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
    expect(threat(r.state)).toBe(6);
    expect(inst(r.state, wolf).damage).toBe(0);
    expect(r.kinds).not.toContain("chooseTriggers");
  });
  it("a thwart (THW 2) does not trigger it, and costs him 2 consequential damage", () => {
    const { state, wolf } = staged();
    const r = scripted(state, [basicThwart(state, schemeOf(state), wolf)]);
    expect(threat(r.state)).toBe(3);
    expect(inst(r.state, wolf).damage).toBe(2);
  });
  it("is a forced response: the hero's own attack does not trigger it", () => {
    const { state } = staged();
    const r = scripted(state, [basicAttack(state, villainOf(state))]);
    expect(threat(r.state)).toBe(5);
  });
  it("places exactly 1 threat on the main scheme even when a side scheme is in play", () => {
    const { state, wolf } = staged();
    const withSide = played(state, EMPATHY, {});
    const mainBefore = threat(withSide.state);
    const r = attackWith(withSide.state, wolf);
    expect(threat(r.state)).toBe(mainBefore + 1);
    expect(inst(r.state, withSide.id).threat).toBe(6);
    expect(REF in REGISTRY).toBe(true);
  });
});

describe("51038.target-spotter-interrupt: a minion that would engage a player engages the Spotter's player instead and cannot activate this phase", () => {
  const REF = "51038.target-spotter-interrupt";
  const SHOCKER_DEAL = "01103";
  /** The two-player game with Target Spotter in play for P1 (2 target counters). */
  function withSpotter(opts: { twoPlayers?: boolean } = {}) {
    const base = bpGame({ swap: { "51006": SPOTTER }, twoPlayers: opts.twoPlayers ?? true });
    const spotter = inPlay(base, SPOTTER);
    return { state: patchInstance(spotter.state, spotter.id, { counters: { target: 2 } }), id: spotter.id };
  }
  /** The villain phase with Shocker dealt to the last player (Rhino's two boost cards, then a filler for the first player). */
  const reveal = (s: GameState, opts: ScriptOpts = {}) => {
    const staged = onlyDeck(s, BLANK, BLANK, FILLER, SHOCKER_DEAL);
    return scripted(
      staged,
      staged.players.map((p) => endTurn(p.playerId)),
      opts,
    );
  };
  const shocker = (s: GameState): InstanceId => instancesOf(s, SHOCKER_DEAL)[0]!;
  const lasting = (r: { events: readonly { type: string }[] }, type: string) =>
    (
      r.events as readonly {
        type: string;
        effect?: { rule: { kind: string }; duration: { kind: string }; scope: { bindings: Record<string, string[]> } };
        reason?: string;
      }[]
    ).filter((e) => e.type === type);

  it("costs 1 and enters play with 2 target counters", () => {
    const base = bpGame({ swap: { "51006": SPOTTER } });
    const r = played(base, SPOTTER);
    expect(playerOf(r.state, P1).playArea).toContain(r.id);
    expect(inst(r.state, r.id).counters["target"]).toBe(2);
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 2);
  });
  it("a minion revealed to the other player engages the Spotter's player instead: P1 pays 1 counter, the minion is in P1's play area", () => {
    const { state, id } = withSpotter();
    const r = reveal(state, { accept: [REF], times: 1 });
    expect(r.taken()).toBe(1);
    const m = shocker(r.state);
    expect(inst(r.state, m).engagedWith).toBe(P1);
    expect(playerOf(r.state, P1).playArea).toContain(m);
    expect(playerOf(r.state, P2).playArea).not.toContain(m);
    expect(inst(r.state, id).counters["target"]).toBe(1);
  });
  it("declined it engages the player it was dealt to (P2) and the counters stay at 2", () => {
    const { state, id } = withSpotter();
    const r = reveal(state, { accept: [] });
    expect(r.taken()).toBe(0);
    const m = shocker(r.state);
    expect(inst(r.state, m).engagedWith).toBe(P2);
    expect(inst(r.state, id).counters["target"]).toBe(2);
    expect(lasting(r, "lastingEffectAdded")).toHaveLength(0);
  });
  it("the minion cannot activate until the end of the phase: a lasting cannotActivate rule on that minion, ended at the end of the villain phase", () => {
    const { state } = withSpotter();
    const r = reveal(state, { accept: [REF], times: 1 });
    const added = lasting(r, "lastingEffectAdded");
    expect(added).toHaveLength(1);
    expect(added[0]!.effect).toMatchObject({
      rule: { kind: "cannotActivate" },
      duration: { kind: "endOfPhase" },
      scope: { bindings: { minion: [shocker(r.state)] } },
    });
    expect(lasting(r, "lastingEffectEnded").map((e) => e.reason)).toEqual(["expired"]);
    expect(r.state.lastingEffects).toHaveLength(0);
  });
  it("the rule names only that minion: a second minion in play is not covered (the query reads the bound slot)", () => {
    const rule = (REGISTRY[REF] as unknown as { effects: { rule?: { target: unknown } }[] }).effects.find(
      (e) => e.rule,
    );
    expect(rule!.rule!.target).toEqual({ categories: ["minion"], inSlot: "minion" });
  });
  it("it also answers a minion engaging the Spotter's own player: offered in a solo game, 1 counter paid, still engaged with P1", () => {
    const { state, id } = withSpotter({ twoPlayers: false });
    const staged = onlyDeck(state, BLANK, SHOCKER_DEAL);
    const r = scripted(staged, [endTurn(P1)], { accept: [REF], times: 1 });
    expect(r.taken()).toBe(1);
    expect(inst(r.state, shocker(r.state)).engagedWith).toBe(P1);
    expect(inst(r.state, id).counters["target"]).toBe(1);
  });
  it("taking the interrupt again when the Spotter's player engages it spends the last counter; the empty Spotter is discarded", () => {
    const { state, id } = withSpotter();
    const r = reveal(state, { accept: [REF] });
    expect(r.taken()).toBe(2);
    expect(discardOf(r.state)).toContain(id);
    expect(playerOf(r.state, P1).playArea).not.toContain(id);
    expect(inst(r.state, shocker(r.state)).engagedWith).toBe(P1);
  });
  it("the cost is 1 target counter: the ability is not offered with none left", () => {
    const { state, id } = withSpotter();
    const r = reveal(patchInstance(state, id, { counters: { target: 0 } }), { accept: [REF] });
    expect(r.taken()).toBe(0);
    expect(inst(r.state, shocker(r.state)).engagedWith).toBe(P2);
  });
});

describe("51027 Energy / 51028 Genius / 51029 Strength: resources with no ability", () => {
  it("one resource card pays 2: Sting Operation (cost 2) is played with Genius alone, and the pair of icons is its own, not a third", () => {
    for (const code of [ENERGY, GENIUS, STRENGTH]) {
      const base = bpHeroGame();
      const res = moveToHand(base, P1, code);
      const sting = moveToHand(res.state, P1, STING);
      const host = identityOf(sting.state);
      const out = scripted(sting.state, [play(P1, sting.ids[0]!, [res.ids[0]!], { attachToInstanceId: host })]);
      expect(inst(out.state, sting.ids[0]!).attachedTo, code).toBe(host);
      expect(discardOf(out.state), code).toContain(res.ids[0]!);
      // Cost 3 is out of reach for a single resource card (2 icons).
      const rifle = moveToHand(res.state, P1, RIFLE);
      expect(refusal(rifle.state, play(P1, rifle.ids[0]!, [res.ids[0]!], { attachToInstanceId: host })), code).toBe(
        true,
      );
    }
  });
});
