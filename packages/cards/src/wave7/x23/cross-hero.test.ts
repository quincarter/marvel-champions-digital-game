import {
  activeVillain,
  applyCommand,
  characterProfile,
  legalActions,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { withDamage } from "../../testing/staging.js";
import {
  accepting,
  acceptingAndPicking,
  basicAttackCmd,
  basicThwartCmd,
  BLACK_PANTHER,
  CAPTAIN_MARVEL,
  codesOf,
  conjure,
  conjureInHand,
  drive,
  openedCrossHero,
  openedHero,
  printedCost,
  SHE_HULK,
  spawnMinion,
  spawnSideScheme,
  spawnVictorySideScheme,
  wasOffered,
  withoutSideSchemes,
} from "../cross-hero-testing.js";
import { WAVE7_CARDS, WAVE7_DEPS, wave7StarterDeckSetup } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` step 4b) for the
 * x23 pack's aspect and basic cards: 43013-43027 and 43034-43040 (22 cards: 8 aggression 43013-43020, 7 basic
 * 43021-43027, 4 linked Specialists 43034-43037 (basic), Predictable Ploy 43038 (justice), Rally the Troops 43039
 * (leadership), Anticipated Attack 43040 (protection)). 43028-43033 are the obligation and nemesis set, not in this
 * slice. Each is played from a Core hero's deck (She-Hulk for Aggression, Spider-Man for Justice and basic, Captain
 * Marvel for Leadership, Black Panther for Protection) in a Morlock Siege game (Blockbuster, villain ATK 2), through
 * `wave7Scenario` and the wave 7 deps. The Specialists are set aside at setup and reach play only through Specialized
 * Training (RRG 1.8 "Linked (Card Title)", p. 27), so they are tested that way. No Core identity has X-FORCE or MUTANT:
 * a gated card is asserted for the plain Core hero first, then with the trait added to the Core identity through an
 * edited card pool (`identityTraits`; the rules are untouched).
 */
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const dmg = (state: GameState, id: InstanceId): number => inst(state, id).damage;
const handIds = (state: GameState, p = P1): readonly InstanceId[] => playerOf(state, p).hand;
const inPlay = (state: GameState, id: InstanceId, p = P1): boolean => playerOf(state, p).playArea.includes(id);
const status = (state: GameState, id: InstanceId, name: "stunned" | "confused" | "tough"): number =>
  inst(state, id).statuses[name] ?? 0;
const me = (state: GameState, p = P1): InstanceId => identityOf(state, p);
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE7_DEPS)!;
/** The blank Advance (01186) as boost card and as the card dealt, so a villain activation is just the attack. */
const quiet = (state: GameState): GameState => stackEncounterDeck(state, "01186", "01186");
const MR_HYDE = "24035"; // hp 10, ATK 3, no keyword: a minion that survives the attacks below and can be attacked.
const SHOCKER = "01103"; // hp 3, ATK 2, no Guard.

function cast(
  state: GameState,
  code: string,
  opts: { pay?: readonly InstanceId[]; pick?: Picker; attach?: InstanceId; controller?: PlayerId } = {},
) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const pay = opts.pay ?? payWith(given.state, P1, printedCost(code), [id]);
  // "Play under any player's control": the command names the controller.
  const command = {
    ...play(P1, id, pay, opts.attach ? { attachToInstanceId: opts.attach } : {}),
    ...(opts.controller ? { controllerId: opts.controller } : {}),
  };
  const run = drive(given.state, opts.pick ?? firstLegal, command);
  return { ...run, id };
}

function refused(state: GameState, code: string, attach?: InstanceId): boolean {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  return !applyCommand(
    given.state,
    play(P1, id, payWith(given.state, P1, printedCost(code), [id]), attach ? { attachToInstanceId: attach } : {}),
    WAVE7_DEPS,
  ).ok;
}

function expectRefused(state: GameState, code: string): void {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const actions = legalActions(given.state, P1, WAVE7_DEPS);
  expect(
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id),
  ).toBe(false);
  expect(refused(state, code)).toBe(true);
}

/** Picks the option of a `chooseOption` prompt whose label contains `label`; anything else is `firstLegal`. */
const labeled =
  (label: string): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.label.includes(label));
    return hit ? [hit.optionId] : firstLegal(state);
  };

const XFORCE = { identityTraits: ["X-FORCE"] } as const;
const SH = { coreHero: SHE_HULK } as const;
const twoSeats = (code: string, extra: object = {}, other = BLACK_PANTHER) =>
  openedHero(code, { ...extra, otherPlayers: [wave7StarterDeckSetup(other)] });

/** A printed-resource total of `n` on a player card (to stage Rictor's discarded card). */
function codeWithResources(n: number): string {
  const card = WAVE7_CARDS.find((c) => {
    if (!("deckLimit" in c) || !(c.type === "event" || c.type === "upgrade" || c.type === "ally")) return false;
    const icons = ("resourceIcons" in c ? (c.resourceIcons ?? {}) : {}) as Record<string, number>;
    return Object.values(icons).reduce((a, b) => a + b, 0) === n;
  });
  return card!.id as string;
}

describe("x23 pack aspect and basic cards, from a Core hero's deck", () => {
  it("every one builds a legal Core deck and a game (one copy added to the Core precon)", () => {
    const codes = [
      ...["43013", "43014", "43015", "43016", "43017", "43018", "43019", "43020"],
      ...["43021", "43022", "43023", "43024", "43025", "43026", "43027"],
      ...["43038", "43039", "43040"],
    ];
    // The four Specialists 43034-43037 are Linked: a deck cannot include them ("linked cards cannot be included in a
    // deck", RRG 1.8 "Linked (Card Title)", p. 27), so they are tested through Specialized Training below.
    expect(codes).toHaveLength(18);
    for (const code of codes) {
      const card = WAVE7_CARDS.find((c) => (c.id as string) === code)!;
      const aspect = "aspect" in card ? card.aspect : "basic";
      const hero =
        aspect === "leadership"
          ? CAPTAIN_MARVEL
          : aspect === "aggression"
            ? SHE_HULK
            : aspect === "protection"
              ? BLACK_PANTHER
              : undefined;
      const state = openedCrossHero(code, hero ? { coreHero: hero } : {});
      const all = [...playerOf(state, P1).hand, ...playerOf(state, P1).deck];
      // The Specialists are Specialized Training's set-aside cards, not deck cards: the deck helper adds one copy anyway.
      expect(codesOf(state, all), code).toContain(code);
    }
  });

  describe("43013 Boom Boom (aggression ally)", () => {
    it("Action: exhaust, add a boom counter; kept, she stays with 1 counter", () => {
      const { state: s, id } = cast(openedHero("43013", SH), "43013");
      expect(inPlay(s, id)).toBe(true);
      const run = drive(s, labeled("Keep Boom Boom"), use(P1, id, "43013.boom-boom-action"));
      expect(inst(run.state, id).counters.boom).toBe(1);
      expect(inst(run.state, id).exhausted).toBe(true);
      expect(inPlay(run.state, id)).toBe(true);
    });
    it("with 2 counters, discarding her deals 2 to each enemy (the villain and an engaged minion)", () => {
      const { state: s, id } = cast(openedHero("43013", SH), "43013");
      const m = spawnMinion(s, { code: MR_HYDE });
      const first = drive(m.state, labeled("Keep Boom Boom"), use(P1, id, "43013.boom-boom-action"));
      const ready = patchInstance(first.state, id, { exhausted: false });
      const second = drive(ready, labeled("Discard Boom Boom"), use(P1, id, "43013.boom-boom-action"));
      expect(inPlay(second.state, id)).toBe(false);
      expect(dmg(second.state, villainOf(second.state))).toBe(2);
      expect(dmg(second.state, m.id)).toBe(2);
      // She is discarded as a cost-free effect: no damage to the heroes.
      expect(dmg(second.state, me(second.state))).toBe(0);
    });
  });

  describe("43014 Rictor (aggression ally)", () => {
    const attack = (milled: string) => {
      const { state: s, id } = cast(openedHero("43014", SH), "43014");
      const top = conjure(s, milled, "topOfDeck");
      const m = spawnMinion(top.state, { code: MR_HYDE });
      const run = drive(m.state, accepting(["43014.rictor-response"]), basicAttackCmd(m.state, villainOf(m.state), id));
      return { run, m, top };
    };
    it("after he attacks, discards the top card; each engaged minion takes 1 damage per printed resource on it", () => {
      const two = attack(codeWithResources(2));
      expect(wasOffered(two.run.offered, "43014.rictor-response")).toBe(true);
      expect(codesOf(two.run.state, playerOf(two.run.state, P1).discard)).toContain(codeWithResources(2));
      expect(dmg(two.run.state, two.m.id)).toBe(2);
      // The villain takes only the attack (Rictor ATK 2), never the response.
      expect(dmg(two.run.state, villainOf(two.run.state))).toBe(2);
    });
    it("a discarded card with no resource icon deals no damage", () => {
      const none = attack(codeWithResources(0));
      expect(dmg(none.run.state, none.m.id)).toBe(0);
    });
  });

  describe("43015 Shatterstar (aggression ally)", () => {
    it("attacking a minion engaged with the player: +1 ATK (ATK 2 -> 3)", () => {
      const { state: s, id } = cast(openedHero("43015", SH), "43015");
      const m = spawnMinion(s, { code: MR_HYDE });
      const run = drive(m.state, accepting(["43015.shatterstar-interrupt"]), basicAttackCmd(m.state, m.id, id));
      expect(dmg(run.state, m.id)).toBe(3);
      expect(inst(run.state, m.id).engagedWith).toBe(P1);
    });
    it("two players: attacking a minion engaged with the other player engages it with the player, no bonus (2)", () => {
      const { state: s, id } = cast(twoSeats("43015", SH), "43015");
      const m = spawnMinion(s, { code: MR_HYDE, player: P2 });
      const run = drive(m.state, accepting(["43015.shatterstar-interrupt"]), basicAttackCmd(m.state, m.id, id));
      expect(inst(run.state, m.id).engagedWith).toBe(P1);
      expect(dmg(run.state, m.id)).toBe(2);
    });
  });

  describe("43016 Critical Hit (aggression event; play only if a side scheme is in the victory display)", () => {
    it("cannot be played with no side scheme in the victory display", () => {
      expectRefused(openedHero("43016", SH), "43016");
    });
    it("with one: after the hero attacks an enemy, pays 2 and stuns it", () => {
      const base = spawnVictorySideScheme(openedHero("43016", SH)).state;
      const given = moveToHand(base, P1, "43016");
      const m = spawnMinion(given.state, { code: MR_HYDE });
      const handBefore = handIds(m.state).length;
      const run = drive(m.state, accepting(["43016.critical-hit-response"]), basicAttackCmd(m.state, m.id));
      expect(wasOffered(run.offered, "43016.critical-hit-response")).toBe(true);
      expect(status(run.state, m.id, "stunned")).toBe(1);
      expect(codesOf(run.state, playerOf(run.state, P1).discard)).toContain("43016");
      expect(handIds(run.state)).toHaveLength(handBefore - 3);
    });
    it("declined: no stun and the card stays in hand", () => {
      const base = spawnVictorySideScheme(openedHero("43016", SH)).state;
      const given = moveToHand(base, P1, "43016");
      const m = spawnMinion(given.state, { code: MR_HYDE });
      const run = drive(m.state, firstLegal, basicAttackCmd(m.state, m.id));
      expect(status(run.state, m.id, "stunned")).toBe(0);
      expect(handIds(run.state)).toContain(given.ids[0]);
    });
  });

  describe("43017 Moment of Triumph (aggression event, cost 0)", () => {
    const strike = (damage: number, code = SHOCKER) => {
      const base = withDamage(moveToHand(openedHero("43017", SH), P1, "43017").state, me(openedHero("43017", SH)), 5);
      const m = spawnMinion(base, { code, damage });
      const run = drive(m.state, accepting(["43017.moment-of-triumph-response"]), basicAttackCmd(m.state, m.id));
      return { run, m };
    };
    it("She-Hulk (ATK 3) defeats a Shocker with 1 hit point left: 2 excess heals 2 (5 -> 3)", () => {
      const { run } = strike(2);
      expect(me(run.state)).toBeDefined();
      expect(dmg(run.state, me(run.state))).toBe(3);
      expect(codesOf(run.state, playerOf(run.state, P1).discard)).toContain("43017");
    });
    it("an exact kill has no excess: heals nothing", () => {
      const { run } = strike(0);
      expect(dmg(run.state, me(run.state))).toBe(5);
    });
    it("not offered when the enemy survives", () => {
      const { run } = strike(0, MR_HYDE);
      expect(wasOffered(run.offered, "43017.moment-of-triumph-response")).toBe(false);
    });
  });

  describe("43018 Keep Them Busy (aggression player side scheme; Assault; remove 5 per hero from the main scheme)", () => {
    it("starts with 3 threat per player and uses ATK for a basic thwart: She-Hulk (ATK 3, THW 1) defeats it", () => {
      const base = withoutSideSchemes(openedHero("43018", SH), 8);
      const { state: s, id } = cast(base, "43018");
      expect(inst(s, id).threat).toBe(3);
      const run = drive(s, firstLegal, basicThwartCmd(s, id));
      expect(mainThreat(run.state)).toBe(3);
      expect(codesOf(run.state, run.state.victoryDisplay)).toContain("43018");
    });
    it("a thwart of 1 (the THW) would not have: threat 5 under ATK 3 leaves 2", () => {
      const base = withoutSideSchemes(openedHero("43018", SH), 8);
      const { state: s, id } = cast(base, "43018");
      const hurt = patchInstance(s, id, { threat: 5 });
      const run = drive(hurt, firstLegal, basicThwartCmd(hurt, id));
      expect(inst(run.state, id).threat).toBe(2);
      expect(mainThreat(run.state)).toBe(8);
    });
    it("two players: 3 per player, defeated by the first player, removes 10 (5 per hero) from the main scheme", () => {
      const base = withoutSideSchemes(twoSeats("43018", SH), 12);
      const { state: s, id } = cast(base, "43018");
      expect(inst(s, id).threat).toBe(6);
      const run = drive(patchInstance(s, id, { threat: 3 }), firstLegal, basicThwartCmd(s, id));
      expect(mainThreat(run.state)).toBe(2);
    });
  });

  describe('43019 "Now I\'m Mad" (aggression upgrade)', () => {
    const withDamageOf = (damage: number) => {
      const { state: s, id } = cast(openedHero("43019", SH), "43019");
      return { state: withDamage(s, me(s), damage), id };
    };
    it("attaches to the identity; with 7 damage on She-Hulk's 15 (remaining 8, not below half) no change", () => {
      const { state, id } = withDamageOf(7);
      expect(inst(state, id).attachedTo).toBe(me(state));
      expect(profile(state, me(state)).atk).toBe(3);
      expect(profile(state, me(state)).thw).toBe(1);
    });
    it("with 8 damage (remaining 7, less than half of 15): +1 ATK and -1 THW", () => {
      const { state } = withDamageOf(8);
      expect(profile(state, me(state)).atk).toBe(4);
      expect(profile(state, me(state)).thw).toBe(0);
    });
    it("Max 1 per player: a second copy is refused", () => {
      const { state } = withDamageOf(0);
      const second = conjureInHand(state, "43019");
      expect(
        applyCommand(second.state, play(P1, second.id, payWith(second.state, P1, 1, [second.id])), WAVE7_DEPS).ok,
      ).toBe(false);
    });
    it("two players: played under the other player's control, it affects that player's hero", () => {
      const base = twoSeats("43019", SH);
      const { state } = cast(base, "43019", { controller: P2 });
      const hurt = withDamage(state, me(state, P2), 8);
      expect(profile(hurt, me(hurt, P2)).atk).toBe(profile(base, me(base, P2)).atk + 1);
      expect(profile(hurt, me(hurt, P1)).atk).toBe(3);
    });
  });

  describe("43020 The Direct Approach (aggression upgrade on a side scheme)", () => {
    it("attached side scheme gains assault: She-Hulk's basic thwart removes 3 (ATK), not 1 (THW)", () => {
      const side = spawnSideScheme(openedHero("43020", SH), 5);
      const { state: s, id } = cast(side.state, "43020", { attach: side.id });
      expect(inst(s, id).attachedTo).toBe(side.id);
      const run = drive(s, firstLegal, basicThwartCmd(s, side.id));
      expect(inst(run.state, side.id).threat).toBe(2);
    });
    it("without it the same thwart removes only 1", () => {
      const side = spawnSideScheme(openedHero("43020", SH), 5);
      const run = drive(side.state, firstLegal, basicThwartCmd(side.state, side.id));
      expect(inst(run.state, side.id).threat).toBe(4);
    });
    it("cannot attach to the main scheme", () => {
      const base = openedHero("43020", SH);
      expect(refused(base, "43020", base.mainScheme.instanceId)).toBe(true);
    });
    it("Limit 1 per side scheme: a second copy cannot attach to the same scheme", () => {
      const side = spawnSideScheme(openedHero("43020", SH), 5);
      const { state } = cast(side.state, "43020", { attach: side.id });
      const second = conjureInHand(state, "43020");
      expect(
        applyCommand(
          second.state,
          play(P1, second.id, payWith(second.state, P1, 1, [second.id]), { attachToInstanceId: side.id }),
          WAVE7_DEPS,
        ).ok,
      ).toBe(false);
    });
  });

  describe("43021 Specialized Training (basic player side scheme) and the four linked Specialists 43034-43037", () => {
    const choosing =
      (...codes: readonly string[]): Picker =>
      (state) => {
        const queue = [...codes];
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "chooseCards" || choice?.prompt.kind === "chooseTarget") {
          const want = queue[0] ?? "";
          const hit = choice.options.find((o) => (state.instances[o.optionId]?.cardId as string) === want);
          if (hit) return [hit.optionId];
        }
        return firstLegal(state);
      };
    /** Plays Training, defeats it with a basic thwart, and takes the Specialist `code`. */
    const trained = (code: string, base = openedHero("43021")) => {
      const { state: s, id } = cast(base, "43021");
      const live = patchInstance(s, id, { threat: 1 });
      const run = drive(live, choosing(code), basicThwartCmd(live, id));
      const ready = patchInstance(run.state, me(run.state), { exhausted: false });
      const specialist = inst(ready, me(ready)).attachments.find(
        (i) => (ready.instances[i]!.cardId as string) === code,
      );
      return { state: ready, specialist };
    };
    it("when defeated: the player takes a set-aside Specialist and puts it into play under their control", () => {
      const { state, specialist } = trained("43034");
      expect(specialist).toBeDefined();
      expect(inst(state, specialist!).attachedTo).toBe(me(state));
      expect(codesOf(state, state.victoryDisplay)).toContain("43021");
    });
    it("43034 Combat Specialist: your hero gets +1 ATK (2 -> 3); after a basic attack, exhaust it to draw 1", () => {
      const { state, specialist } = trained("43034");
      expect(profile(state, me(state)).atk).toBe(3);
      const m = spawnMinion(state, { code: MR_HYDE });
      const hand = handIds(m.state).length;
      const run = drive(m.state, accepting(["43034.combat-specialist-response"]), basicAttackCmd(m.state, m.id));
      expect(dmg(run.state, m.id)).toBe(3);
      expect(inst(run.state, specialist!).exhausted).toBe(true);
      expect(handIds(run.state)).toHaveLength(hand + 1);
    });
    it("43035 Defense Specialist: +1 DEF (3 -> 4); after a basic defense, exhaust it to draw 1", () => {
      const { state, specialist } = trained("43035");
      expect(profile(state, me(state)).def).toBe(4);
      const hand = handIds(state).length;
      const run = drive(quiet(state), accepting(["43035.defense-specialist-response"], { defend: true }), endTurn(P1));
      expect(inst(run.state, specialist!).exhausted).toBe(true);
      // Blockbuster ATK 2 against DEF 4: no damage. The draw is the response's.
      expect(dmg(run.state, me(run.state))).toBe(0);
      expect(handIds(run.state).length).toBeGreaterThan(hand);
    });
    it("43036 Front Line Specialist: +4 hit points; after enemy-attack damage to the identity, exhaust it to draw 1", () => {
      const { state, specialist } = trained("43036");
      expect(profile(state, me(state)).maxHp).toBe(14);
      const hand = handIds(state).length;
      const run = drive(quiet(state), accepting(["43036.front-line-specialist-response"]), endTurn(P1));
      expect(wasOffered(run.offered, "43036.front-line-specialist-response")).toBe(true);
      expect(dmg(run.state, me(run.state))).toBe(2);
      expect(inst(run.state, specialist!).exhausted).toBe(true);
      expect(handIds(run.state).length).toBeGreaterThan(hand);
    });
    it("43037 Surveillance Specialist: +1 THW (1 -> 2); after a basic thwart, exhaust it to draw 1", () => {
      const { state, specialist } = trained("43037");
      expect(profile(state, me(state)).thw).toBe(2);
      const side = spawnSideScheme(state, 5);
      const hand = handIds(side.state).length;
      const run = drive(
        side.state,
        accepting(["43037.surveillance-specialist-response"]),
        basicThwartCmd(side.state, side.id),
      );
      expect(inst(run.state, side.id).threat).toBe(3);
      expect(inst(run.state, specialist!).exhausted).toBe(true);
      expect(handIds(run.state)).toHaveLength(hand + 1);
    });
    it("two players: each player who controls no Specialist takes one; a player who already has one does not", () => {
      const base = twoSeats("43021");
      const have = (state: GameState, p: typeof P1) =>
        inst(state, me(state, p)).attachments.filter((i) =>
          ["43034", "43035", "43036", "43037"].includes(state.instances[i]!.cardId as string),
        );
      const { state: s, id } = cast(base, "43021");
      const live = patchInstance(s, id, { threat: 1 });
      const first = drive(live, choosing("43034"), basicThwartCmd(live, id));
      expect(have(first.state, P1).length + have(first.state, P2).length).toBeGreaterThanOrEqual(1);
      expect(have(first.state, P1)).toHaveLength(1);
      expect(have(first.state, P2)).toHaveLength(1);
    });
  });

  describe("43022-43024 Energy, Genius, Strength (basic resources, 2 of one type each)", () => {
    // Concussive Blow (41014, cost 3): confuses the villain, deals 3 damage if paid with a [physical] resource.
    const blow = (codes: readonly string[]) => {
      const base = openedHero("41014");
      let s = moveToHand(base, P1, "41014").state;
      const paid: InstanceId[] = [];
      for (const code of codes) {
        const c = conjureInHand(s, code);
        s = c.state;
        paid.push(c.id);
      }
      const id = moveToHand(s, P1, "41014").ids[0]!;
      return drive(s, firstLegal, play(P1, id, paid));
    };
    it("Strength (2 physical) + 1 other card pays the 3 and Concussive Blow counts a [physical] resource: 3 damage", () => {
      const run = blow(["43024", "43023"]);
      expect(dmg(run.state, villainOf(run.state))).toBe(3);
    });
    it("Genius (2 mental) + Energy (2 energy) pay the 3 with no [physical]: confuses, no damage", () => {
      const run = blow(["43023", "43022"]);
      expect(status(run.state, villainOf(run.state), "confused")).toBe(1);
      expect(dmg(run.state, villainOf(run.state))).toBe(0);
    });
    it("one resource card pays 2: Strength alone cannot pay a cost-3 card", () => {
      const base = openedHero("41014");
      const c = conjureInHand(moveToHand(base, P1, "41014").state, "43024");
      const id = moveToHand(c.state, P1, "41014").ids[0]!;
      expect(applyCommand(c.state, play(P1, id, [c.id]), WAVE7_DEPS).ok).toBe(false);
    });
  });

  describe("43025 IPAC (basic support; play only if your identity has X-FORCE)", () => {
    it("refused for a Core hero without X-FORCE", () => {
      expectRefused(openedHero("43025"), "43025");
    });
    it("with an X-FORCE identity: exhaust, deal a facedown encounter card to the player, who draws 2", () => {
      const { state: s, id } = cast(openedHero("43025", XFORCE), "43025");
      expect(inPlay(s, id)).toBe(true);
      const hand = handIds(s).length;
      const run = drive(s, firstLegal, use(P1, id, "43025.ipac-action"));
      expect(inst(run.state, id).exhausted).toBe(true);
      expect(handIds(run.state)).toHaveLength(hand + 2);
    });
    it("two players: the chosen player (seat 2) is dealt the card and draws 2", () => {
      const { state: s, id } = cast(twoSeats("43025", XFORCE), "43025");
      const two = handIds(s, P2).length;
      const one = handIds(s).length;
      const run = drive(s, acceptingAndPicking([], ["p2"]), use(P1, id, "43025.ipac-action"));
      expect(handIds(run.state, P2)).toHaveLength(two + 2);
      expect(handIds(run.state)).toHaveLength(one);
    });
  });

  describe("43026 X-Bunker (basic support; the chosen player's identity must have MUTANT)", () => {
    it("a Core hero (not MUTANT) cannot use it", () => {
      const { state: s, id } = cast(openedHero("43026"), "43026");
      expect(inPlay(s, id)).toBe(true);
      expect(applyCommand(s, use(P1, id, "43026.x-bunker-action"), WAVE7_DEPS).ok).toBe(false);
    });
    it("with a MUTANT identity and 2 side schemes in the victory display: finds 1 card in the top 2 and adds it", () => {
      const { state: s, id } = cast(openedHero("43026", { identityTraits: ["MUTANT"] }), "43026");
      const b = spawnVictorySideScheme(spawnVictorySideScheme(s).state);
      const top = playerOf(b.state, P1).deck.slice(0, 2);
      const run = drive(b.state, acceptingAndPicking([], [top[1]!]), use(P1, id, "43026.x-bunker-action"));
      expect(inst(run.state, id).exhausted).toBe(true);
      expect(handIds(run.state)).toContain(top[1]);
      expect(handIds(run.state)).toHaveLength(handIds(b.state).length + 1);
    });
  });

  describe("43027 Endurance (basic upgrade, +3 hit points)", () => {
    it("on the player's own identity: Spider-Man 10 -> 13 hit points", () => {
      const base = openedHero("43027");
      const { state, id } = cast(base, "43027");
      expect(inst(state, id).attachedTo).toBe(me(state));
      expect(profile(state, me(state)).maxHp).toBe(13);
    });
    it("Max 1 per player: a second copy is refused", () => {
      const { state } = cast(openedHero("43027"), "43027");
      const second = conjureInHand(state, "43027");
      expect(
        applyCommand(second.state, play(P1, second.id, payWith(second.state, P1, 1, [second.id])), WAVE7_DEPS).ok,
      ).toBe(false);
    });
    it("two players: played under the other player's control, +3 to that hero (Black Panther 11 -> 14)", () => {
      const base = twoSeats("43027");
      const { state } = cast(base, "43027", { controller: P2 });
      expect(profile(state, me(state, P2)).maxHp).toBe(14);
      expect(profile(state, me(state, P1)).maxHp).toBe(10);
    });
  });

  describe("43038 Predictable Ploy (justice event; play only if a side scheme is in the victory display)", () => {
    const reveal = (state: GameState, pick: Picker) => drive(quiet(state), pick, endTurn(P1));
    it("cannot be played with no side scheme in the victory display", () => {
      expectRefused(openedHero("43038"), "43038");
    });
    it("without it, Advance's When Revealed resolves and the villain schemes", () => {
      const base = spawnVictorySideScheme(withoutSideSchemes(openedHero("43038"), 2)).state;
      const run = reveal(base, firstLegal);
      expect(mainThreat(run.state)).toBeGreaterThan(mainThreat(base));
    });
    it("cancelled: the villain does not schemes for it, 2 cards are paid and the event is discarded", () => {
      const base = spawnVictorySideScheme(withoutSideSchemes(openedHero("43038"), 2)).state;
      const held = moveToHand(base, P1, "43038").state;
      const uncancelled = reveal(held, firstLegal);
      const run = reveal(held, accepting(["43038.predictable-ploy-interrupt"]));
      expect(wasOffered(run.offered, "43038.predictable-ploy-interrupt")).toBe(true);
      expect(mainThreat(run.state)).toBeLessThan(mainThreat(uncancelled.state));
      expect(codesOf(run.state, playerOf(run.state, P1).discard)).toContain("43038");
    });
  });

  describe("43039 Rally the Troops (leadership player side scheme)", () => {
    it("when defeated: heals 2 damage from each ally, every player's (3 -> 1 on each)", () => {
      const base = twoSeats("43039", { coreHero: CAPTAIN_MARVEL });
      const mine = conjure(base, "43013", "play", P1);
      const theirs = conjure(mine.state, "43014", "play", P2);
      const hurt = withDamage(withDamage(theirs.state, mine.id, 3), theirs.id, 3);
      const { state: s, id } = cast(hurt, "43039");
      const live = patchInstance(s, id, { threat: 1 });
      const run = drive(live, firstLegal, basicThwartCmd(live, id));
      expect(dmg(run.state, mine.id)).toBe(1);
      expect(dmg(run.state, theirs.id)).toBe(1);
    });
    it("heals nothing from heroes: the identity keeps its damage", () => {
      const base = openedHero("43039", { coreHero: CAPTAIN_MARVEL });
      const { state: s, id } = cast(withDamage(base, me(base), 4), "43039");
      const live = patchInstance(s, id, { threat: 1 });
      const run = drive(live, firstLegal, basicThwartCmd(live, id));
      expect(dmg(run.state, me(run.state))).toBe(4);
    });
  });

  describe("43040 Anticipated Attack (protection event; play only if a side scheme is in the victory display)", () => {
    const BP = { coreHero: BLACK_PANTHER } as const;
    it("cannot be played with no side scheme in the victory display", () => {
      expectRefused(openedHero("43040", BP), "43040");
    });
    it("when an enemy initiates an attack: pays 2; the tough status prevents the 2 damage and is discarded", () => {
      const base = spawnVictorySideScheme(openedHero("43040", BP)).state;
      const held = moveToHand(base, P1, "43040").state;
      const plain = drive(quiet(base), firstLegal, endTurn(P1));
      expect(dmg(plain.state, me(plain.state))).toBe(2);
      const run = drive(quiet(held), accepting(["43040.anticipated-attack-interrupt"]), endTurn(P1));
      expect(wasOffered(run.offered, "43040.anticipated-attack-interrupt")).toBe(true);
      expect(dmg(run.state, me(run.state))).toBe(0);
      expect(status(run.state, me(run.state), "tough")).toBe(0);
      expect(codesOf(run.state, playerOf(run.state, P1).discard)).toContain("43040");
    });
  });
});
