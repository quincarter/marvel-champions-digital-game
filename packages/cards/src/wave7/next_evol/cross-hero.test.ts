import {
  activeVillain,
  applyCommand,
  characterProfile,
  legalActions,
  traitsOf,
  type GameState,
  type InstanceId,
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
  codesOf,
  conjure,
  drive,
  iconCards,
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
import { WAVE7_DEPS, wave7StarterDeckSetup } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` step 4b) for the
 * NeXt Evolution box's aspect and basic player cards: Cable's deck 40014-40025 and 40027-40030, Domino's deck
 * 40050-40064, and the basic ally Hope Summers 40204 (32 cards; 40026 Frenemies is a Team-Up card and out of this
 * slice, and the campaign-only cards 40079, 40130, 40190-40197 are not deck cards). Each is played from a Core hero's
 * deck (Captain Marvel for Leadership, She-Hulk for Aggression, Black Panther for Protection, Spider-Man for Justice
 * and basic) in a Morlock Siege game (Blockbuster, villain ATK 2). A card whose script quietly assumed its precon hero
 * (Cable or Domino: X-FORCE, PSIONIC, SOLDIER, a POSSE ally, E.V.A.'s Fantomex) is asserted both without what it
 * wants (refused or inert) and with it satisfied legitimately: an edited card pool (`identityTraits`, rules untouched)
 * or the supporting cards actually played (Fantomex before E.V.A.).
 */
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const dmg = (state: GameState, id: InstanceId): number => inst(state, id).damage;
const handIds = (state: GameState): readonly InstanceId[] => playerOf(state, P1).hand;
const inPlay = (state: GameState, id: InstanceId): boolean => playerOf(state, P1).playArea.includes(id);
const inDiscard = (state: GameState, id: InstanceId): boolean => playerOf(state, P1).discard.includes(id);
const status = (state: GameState, id: InstanceId, name: "stunned" | "confused" | "tough"): number =>
  inst(state, id).statuses[name] ?? 0;
const me = (state: GameState): InstanceId => identityOf(state, P1);
const atk = (state: GameState, id: InstanceId): number => characterProfile(state, id, WAVE7_DEPS)!.atk;
const thw = (state: GameState, id: InstanceId): number => characterProfile(state, id, WAVE7_DEPS)!.thw;
const hasTraitOn = (state: GameState, id: InstanceId, name: string): boolean =>
  traitsOf(state, id, WAVE7_DEPS).some((t) => (t as string) === name);

function cast(
  state: GameState,
  code: string,
  opts: { pay?: readonly InstanceId[]; pick?: Picker; attach?: InstanceId } = {},
) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const pay = opts.pay ?? payWith(given.state, P1, printedCost(code), [id]);
  const run = drive(
    given.state,
    opts.pick ?? firstLegal,
    play(P1, id, pay, opts.attach ? { attachToInstanceId: opts.attach } : {}),
  );
  return { ...run, id };
}

/** A conjured copy of `code` played from hand (for a card the seated deck does not hold). */
function castConjured(state: GameState, code: string, opts: { pick?: Picker; attach?: InstanceId } = {}) {
  return cast(conjure(state, code, "hand").state, code, opts);
}

function expectRefused(state: GameState, code: string): void {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const actions = legalActions(given.state, P1, WAVE7_DEPS);
  expect(
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id),
  ).toBe(false);
  expect(
    applyCommand(given.state, play(P1, id, payWith(given.state, P1, printedCost(code), [id])), WAVE7_DEPS).ok,
  ).toBe(false);
}

/** Answers `chooseOption` prompts with the given indexes in order; every other prompt as `inner`. */
const optionsInOrder = (indexes: readonly string[], inner: Picker = firstLegal): Picker => {
  let n = 0;
  return (s) => (s.pendingChoice?.prompt.kind === "chooseOption" ? [indexes[n++] ?? "0"] : inner(s));
};

const XFORCE = { identityTraits: ["X-FORCE"] } as const;
const PSIONIC = { identityTraits: ["PSIONIC"] } as const;
const quietBoost = (state: GameState): GameState => stackEncounterDeck(state, "01186");
const SOLDIER_CODE = "01182"; // Hydra Soldier: ATK 2, 4 hit points, Guard

describe("NeXt Evolution aspect and basic cards, from a Core hero's deck", () => {
  it("every one builds a legal Core deck and a game (one copy added to the Core precon)", () => {
    const codes = [
      "40014",
      "40015",
      "40016",
      "40017",
      "40018",
      "40019",
      "40020",
      "40021",
      "40022",
      "40023",
      "40024",
      "40025",
      "40027",
      "40028",
      "40029",
      "40030",
      "40050",
      "40051",
      "40052",
      "40053",
      "40054",
      "40055",
      "40056",
      "40057",
      "40058",
      "40059",
      "40060",
      "40061",
      "40062",
      "40063",
      "40064",
      "40204",
    ];
    expect(codes).toHaveLength(32);
    for (const code of codes) {
      const state = openedCrossHero(code);
      const all = [...playerOf(state, P1).hand, ...playerOf(state, P1).deck];
      expect(codesOf(state, all), code).toContain(code);
    }
  });

  // ---- Cable's deck: Leadership, Aggression, Protection, basic -------------------------------------------------

  describe("40014 Caliban (leadership ally)", () => {
    it("after he enters play, discards from the deck until an X-FORCE ally and adds that ally to hand", () => {
      const base = openedHero("40014");
      const feral = conjure(base, "40050", "topOfDeck");
      const coreCard = playerOf(feral.state, P1).deck[1]!;
      const { state } = cast(feral.state, "40014", { pick: accepting(["40014.caliban-response"]) });
      expect(handIds(state)).toContain(feral.id);
      expect(inDiscard(state, feral.id)).toBe(false);
      expect(playerOf(state, P1).deck[0]).toBe(coreCard);
    });
    it("a Core deck with no X-FACTOR, X-FORCE or X-MEN ally: nothing is added; the emptied deck is reshuffled and no more is discarded (RRG 1.8 Player Deck, p. 33)", () => {
      const base = openedHero("40014");
      const given = moveToHand(base, P1, "40014");
      const encounterBefore = Object.values(given.state.encounterDecks).reduce((n, d) => n + d.deck.length, 0);
      const handBefore = handIds(given.state).length;
      const { state } = cast(given.state, "40014", { pick: accepting(["40014.caliban-response"]) });
      // Played Caliban (3 paid + himself leave the hand): nothing came back.
      expect(handIds(state)).toHaveLength(handBefore - 4);
      // The deck emptied while discarding: discard pile shuffled back, and a facedown encounter card dealt to the player.
      expect(playerOf(state, P1).discard).toHaveLength(0);
      expect(playerOf(state, P1).deck.length).toBeGreaterThan(30);
      const encounterAfter = Object.values(state.encounterDecks).reduce((n, d) => n + d.deck.length, 0);
      expect(encounterAfter).toBeLessThan(encounterBefore);
    });
  });

  describe("40015 Fantomex (leadership ally)", () => {
    it("after he enters play, searches the deck for E.V.A. and puts it into play", () => {
      const base = openedHero("40015");
      const eva = conjure(base, "40021", "deck");
      const { state } = cast(eva.state, "40015", { pick: acceptingAndPicking(["40015.fantomex-response"], [eva.id]) });
      expect(inPlay(state, eva.id)).toBe(true);
      expect(inDiscard(state, eva.id)).toBe(false);
    });
    it("a deck with no E.V.A.: the search comes up empty, nothing enters play", () => {
      const { state, id } = cast(openedHero("40015"), "40015", { pick: accepting(["40015.fantomex-response"]) });
      expect(inPlay(state, id)).toBe(true);
      expect(codesOf(state, playerOf(state, P1).playArea)).not.toContain("40021");
    });
  });

  describe("40016 Sunspot (leadership ally)", () => {
    const sunspot = (pay: "energy" | "physical") => {
      const base = openedHero("40016");
      const m = spawnMinion(base, { code: SOLDIER_CODE });
      const given = moveToHand(m.state, P1, "40016");
      const icons = iconCards(given.state, pay, 3, { only: true, exclude: given.ids });
      const run = drive(icons.state, accepting(["40016.sunspot-response"]), play(P1, given.ids[0]!, icons.ids));
      return { ...run, minion: m.id };
    };
    it("after you play him paying 3 [energy]: 3 damage to the villain and to the minion engaged with the player", () => {
      const run = sunspot("energy");
      expect(dmg(run.state, villainOf(run.state))).toBe(3);
      expect(dmg(run.state, run.minion)).toBe(3);
    });
    it("paying with [physical] only: no [energy], no damage", () => {
      const run = sunspot("physical");
      expect(dmg(run.state, villainOf(run.state))).toBe(0);
    });
  });

  describe("40017 Mission Planning (leadership event)", () => {
    it("refused while no side scheme is in the victory display", () => {
      expectRefused(openedHero("40017"), "40017");
    });
    it("with a side scheme in the victory display: allies you control take no consequential damage this phase", () => {
      const base = spawnVictorySideScheme(openedHero("40017")).state;
      const ally = castConjured(base, "40016");
      const plan = cast(ally.state, "40017");
      const m = spawnMinion(plan.state, { code: SOLDIER_CODE });
      const run = drive(m.state, firstLegal, basicAttackCmd(m.state, m.id, ally.id));
      expect(dmg(run.state, m.id)).toBe(2);
      expect(dmg(run.state, ally.id)).toBe(0);
      // Control: the same ally attacking without the event takes its printed consequential damage (Sunspot: 1).
      const m2 = spawnMinion(ally.state, { code: SOLDIER_CODE });
      const control = drive(m2.state, firstLegal, basicAttackCmd(m2.state, m2.id, ally.id));
      expect(dmg(control.state, ally.id)).toBe(1);
    });
  });

  describe("40018 Call for Backup (leadership player side scheme)", () => {
    it("when defeated: the player may search deck and discard for an ally and put it into play", () => {
      const base = openedHero("40018");
      const sunspot = conjure(base, "40016", "deck");
      const { state: s, id } = cast(sunspot.state, "40018");
      const ready = patchInstance(s, id, { threat: 1 });
      const run = drive(ready, acceptingAndPicking([], [sunspot.id]), basicThwartCmd(ready, id));
      expect(inPlay(run.state, sunspot.id)).toBe(true);
    });
  });

  describe("40019 Lock and Load (aggression player side scheme)", () => {
    it("when defeated: finds a WEAPON upgrade costing 3 or less (Psimitar) and puts it into play on the identity", () => {
      const base = openedHero("40019");
      const psimitar = conjure(base, "40029", "deck");
      const { state: s, id } = cast(psimitar.state, "40019");
      const ready = patchInstance(s, id, { threat: 1 });
      const run = drive(ready, acceptingAndPicking([], [psimitar.id]), basicThwartCmd(ready, id));
      expect(inst(run.state, psimitar.id).attachedTo).toBe(me(run.state));
    });
  });

  describe("40020 Establish Perimeter (protection player side scheme)", () => {
    it("when defeated: gives each identity a tough status card", () => {
      const { state: s, id } = cast(openedHero("40020"), "40020");
      const ready = patchInstance(s, id, { threat: 1 });
      const run = drive(ready, firstLegal, basicThwartCmd(ready, id));
      expect(status(run.state, me(run.state), "tough")).toBe(1);
    });
  });

  describe("40021 E.V.A. (leadership support): needs Fantomex in play", () => {
    it("played with no Fantomex in play: discarded at once", () => {
      const { state, id } = castConjured(openedHero("40021"), "40021");
      expect(inPlay(state, id)).toBe(false);
      expect(inDiscard(state, id)).toBe(true);
    });
    it("with Fantomex played: stays, and its Action removes 1 threat, deals 1 damage, or heals Fantomex 1", () => {
      const fantomex = castConjured(openedHero("40021"), "40015");
      const eva = castConjured(withoutSideSchemes(fantomex.state, 6), "40021");
      expect(inPlay(eva.state, eva.id)).toBe(true);
      const thwartIt = drive(eva.state, optionsInOrder(["0"]), use(P1, eva.id, "40021.eva-action"));
      expect(mainThreat(thwartIt.state)).toBe(5);
      expect(inst(thwartIt.state, eva.id).exhausted).toBe(true);
      const hit = drive(eva.state, optionsInOrder(["1"]), use(P1, eva.id, "40021.eva-action"));
      expect(dmg(hit.state, villainOf(hit.state))).toBe(1);
      const hurt = withDamage(eva.state, fantomex.id, 2);
      const heal = drive(hurt, optionsInOrder(["2"]), use(P1, eva.id, "40021.eva-action"));
      expect(dmg(heal.state, fantomex.id)).toBe(1);
    });
  });

  describe("40022 Uncanny X-Force (leadership support)", () => {
    it("a Core hero is not X-FORCE: the allies get no +1 THW", () => {
      const ally = castConjured(openedHero("40022"), "40016");
      const before = thw(ally.state, ally.id);
      const { state } = cast(ally.state, "40022");
      expect(thw(state, ally.id)).toBe(before);
    });
    it("with an X-FORCE identity and only X-FORCE allies: +1 THW, and -1 consequential damage after thwarting a side scheme", () => {
      const ally = castConjured(openedHero("40022", XFORCE), "40016");
      const side = spawnSideScheme(ally.state, 5);
      const plain = drive(side.state, firstLegal, basicThwartCmd(side.state, side.id, ally.id));
      const { state } = cast(side.state, "40022");
      expect(thw(state, ally.id)).toBe(thw(ally.state, ally.id) + 1);
      const run = drive(state, firstLegal, basicThwartCmd(state, side.id, ally.id));
      expect(dmg(plain.state, ally.id)).toBeGreaterThan(0);
      expect(dmg(run.state, ally.id)).toBe(dmg(plain.state, ally.id) - 1);
    });
    it("with an X-FORCE identity but another of your characters that is not X-FORCE (Luke Cage): no bonus", () => {
      const sunspot = castConjured(openedHero("40022", XFORCE), "40016");
      const luke = conjure(sunspot.state, "01076", "play");
      const before = thw(luke.state, sunspot.id);
      const { state } = cast(luke.state, "40022");
      expect(thw(state, sunspot.id)).toBe(before);
    });
  });

  describe("40023 Mission Leader (leadership upgrade): costs 1 less while your identity has SOLDIER", () => {
    const tryPaying = (state: GameState, resources: number): boolean => {
      const given = moveToHand(conjure(state, "40023", "hand").state, P1, "40023");
      const id = given.ids[0]!;
      return applyCommand(given.state, play(P1, id, payWith(given.state, P1, resources, [id])), WAVE7_DEPS).ok;
    };
    it("Captain Marvel's hero face has SOLDIER: 1 resource pays, 0 does not", () => {
      const s = openedHero("40023");
      expect(tryPaying(s, 1)).toBe(true);
      expect(tryPaying(s, 0)).toBe(false);
    });
    it("Spider-Man has no SOLDIER trait: 1 resource is not enough, 2 pay", () => {
      const s = openedHero("40050");
      expect(tryPaying(s, 1)).toBe(false);
      expect(tryPaying(s, 2)).toBe(true);
    });
    it("after a side scheme is defeated, exhausts to make each player draw 1", () => {
      const { state: s, id } = cast(openedHero("40023"), "40023");
      const side = spawnSideScheme(s, 1);
      const run = drive(side.state, accepting(["40023.mission-leader-response"]), basicThwartCmd(side.state, side.id));
      expect(inst(run.state, id).exhausted).toBe(true);
      expect(handIds(run.state)).toHaveLength(handIds(side.state).length + 1);
    });
  });

  describe("40024 Deadpool (basic ally)", () => {
    const hurtDeadpool = () => {
      const { state, id } = cast(openedHero("40024"), "40024");
      return { state: withDamage(state, id, 2), id };
    };
    it("consequential damage that would defeat him heals 3 instead and adds an acceleration token to the main scheme", () => {
      const { state: s, id } = hurtDeadpool();
      const tokens = s.mainScheme.accelerationTokens;
      const m = spawnMinion(s, { code: SOLDIER_CODE });
      const run = drive(m.state, firstLegal, basicAttackCmd(m.state, m.id, id));
      expect(inPlay(run.state, id)).toBe(true);
      expect(dmg(run.state, id)).toBe(0);
      expect(run.state.mainScheme.accelerationTokens).toBe(tokens + 1);
    });
    it("damage that is not consequential (the villain's attack on him as defender) defeats him as usual", () => {
      const { state: s, id } = hurtDeadpool();
      const run = drive(quietBoost(s), accepting([], { defender: id }), endTurn(P1));
      expect(inPlay(run.state, id)).toBe(false);
    });
  });

  describe("40025 Deathlok (basic ally)", () => {
    it("after he enters play, attaches a cost-1 upgrade from a discard pile that can attach to him (Sidearm)", () => {
      const base = openedHero("40025");
      const sidearm = conjure(base, "40030", "discard");
      const { state, id } = cast(sidearm.state, "40025", {
        pick: acceptingAndPicking(["40025.deathlok-response"], [sidearm.id]),
      });
      expect(inst(state, sidearm.id).attachedTo).toBe(id);
      expect(inDiscard(state, sidearm.id)).toBe(false);
    });
    it("an upgrade that attaches to an identity (Psimitar costs 2) is not a choice: nothing is attached", () => {
      const base = openedHero("40025");
      const psimitar = conjure(base, "40029", "discard");
      const { state } = cast(psimitar.state, "40025", { pick: accepting(["40025.deathlok-response"]) });
      expect(inst(state, psimitar.id).attachedTo).toBe(null);
      expect(inDiscard(state, psimitar.id)).toBe(true);
    });
  });

  describe("40027 Build Support (basic player side scheme)", () => {
    it("when defeated: the player may search for a support costing 3 or less (Uncanny X-Force) and put it into play", () => {
      const base = openedHero("40027");
      const support = conjure(base, "40022", "deck");
      const { state: s, id } = cast(support.state, "40027");
      const ready = patchInstance(s, id, { threat: 1 });
      const run = drive(ready, acceptingAndPicking([], [support.id]), basicThwartCmd(ready, id));
      expect(inPlay(run.state, support.id)).toBe(true);
    });
  });

  describe("40028 The Power of the Mind (basic resource, reprint of 41021)", () => {
    it("alone pays for a cost-2 PSIONIC card (Psimitar) but not for a cost-2 card that is not (Even the Odds)", () => {
      const base = openedHero("40028");
      const mind = moveToHand(base, P1, "40028");
      const psimitar = conjure(mind.state, "40029", "hand");
      const ok = drive(psimitar.state, firstLegal, play(P1, psimitar.id, [mind.ids[0]!]));
      expect(inst(ok.state, psimitar.id).attachedTo).toBe(me(ok.state));
      const odds = conjure(mind.state, "40053", "hand");
      expect(applyCommand(odds.state, play(P1, odds.id, [mind.ids[0]!]), WAVE7_DEPS).ok).toBe(false);
    });
  });

  describe("40029 Psimitar (basic upgrade)", () => {
    it("attaches to the identity; after a PSIONIC card is played, exhausts to deal 2 damage to an enemy (an attack)", () => {
      const base = openedHero("40029", PSIONIC);
      const { state: s, id } = cast(base, "40029");
      expect(inst(s, id).attachedTo).toBe(me(s));
      const kinesis = conjure(s, "41033", "hand");
      const run = drive(
        kinesis.state,
        accepting(["40029.psimitar-response"]),
        play(P1, kinesis.id, payWith(kinesis.state, P1, 1, [kinesis.id])),
      );
      expect(wasOffered(run.offered, "40029.psimitar-response")).toBe(true);
      expect(dmg(run.state, villainOf(run.state))).toBe(2);
      expect(inst(run.state, id).exhausted).toBe(true);
    });
    it("a card that is not PSIONIC played afterwards offers nothing", () => {
      const { state: s } = cast(openedHero("40029"), "40029");
      const cat = moveToHand(s, P1, "01002");
      const run = drive(
        cat.state,
        accepting(["40029.psimitar-response"]),
        play(P1, cat.ids[0]!, payWith(cat.state, P1, 2, cat.ids)),
      );
      expect(wasOffered(run.offered, "40029.psimitar-response")).toBe(false);
    });
  });

  describe("40030 Sidearm (basic upgrade): attach to an ally", () => {
    it("on an ally: +1 ATK; not attachable to the identity", () => {
      const ally = castConjured(openedHero("40030"), "40016");
      const before = atk(ally.state, ally.id);
      const { state, id } = cast(ally.state, "40030", { attach: ally.id });
      expect(inst(state, id).attachedTo).toBe(ally.id);
      expect(atk(state, ally.id)).toBe(before + 1);
      const second = conjure(state, "40030", "hand");
      expect(
        applyCommand(
          second.state,
          play(P1, second.id, payWith(second.state, P1, 1, [second.id]), { attachToInstanceId: ally.id }),
          WAVE7_DEPS,
        ).ok,
      ).toBe(false);
      const onHero = conjure(ally.state, "40030", "hand");
      expect(
        applyCommand(
          onHero.state,
          play(P1, onHero.id, payWith(onHero.state, P1, 1, [onHero.id]), { attachToInstanceId: me(onHero.state) }),
          WAVE7_DEPS,
        ).ok,
      ).toBe(false);
    });
  });

  // ---- Domino's deck -------------------------------------------------------------------------------------------

  describe("40050 Feral (justice ally)", () => {
    it("after she thwarts, discards the top card and deals 1 damage to the villain per resource icon on it", () => {
      const { state: s, id } = cast(openedHero("40050"), "40050");
      const top = conjure(withoutSideSchemes(s, 6), "41019", "topOfDeck");
      const run = drive(
        top.state,
        accepting(["40050.feral-response"]),
        basicThwartCmd(top.state, top.state.mainScheme.instanceId, id),
      );
      expect(wasOffered(run.offered, "40050.feral-response")).toBe(true);
      expect(inDiscard(run.state, top.id)).toBe(true);
      expect(dmg(run.state, villainOf(run.state))).toBe(1);
    });
  });

  describe("40051 Wolfsbane (justice ally)", () => {
    const thwartNaming = (typeIndex: string) => {
      const { state: s, id } = cast(openedHero("40051"), "40051");
      const top = conjure(withoutSideSchemes(s, 6), "41019", "topOfDeck");
      // Types in order: Ally, Event, Upgrade, Support, Resource, Player side scheme.
      const run = drive(
        top.state,
        optionsInOrder([typeIndex, "0"], accepting(["40051.wolfsbane-response"])),
        basicThwartCmd(top.state, top.state.mainScheme.instanceId, id),
      );
      return { run, top: top.id };
    };
    it("names Event and the discarded card is an event: may add it to hand", () => {
      const { run, top } = thwartNaming("1");
      expect(handIds(run.state)).toContain(top);
    });
    it("names Ally and the discarded card is an event: it stays in the discard pile", () => {
      const { run, top } = thwartNaming("0");
      expect(inDiscard(run.state, top)).toBe(true);
      expect(handIds(run.state)).not.toContain(top);
    });
  });

  describe("40052 Even the Odds (justice event): Requirement ([energy])", () => {
    const withTwoSideSchemes = () => {
      const base = openedHero("40052");
      const a = spawnSideScheme(base, 1);
      const b = spawnSideScheme(a.state, 3);
      return { ...b, a: a.id, b: b.id };
    };
    it("paid with an [energy] resource: removes 1 threat from each side scheme and 1 villain damage per scheme defeated", () => {
      const s = withTwoSideSchemes();
      const given = moveToHand(s.state, P1, "40052");
      const energy = iconCards(given.state, "energy", 1, { only: true, exclude: given.ids });
      const physical = iconCards(energy.state, "physical", 1, { only: true, exclude: [...given.ids, ...energy.ids] });
      const run = drive(physical.state, firstLegal, play(P1, given.ids[0]!, [...energy.ids, ...physical.ids]));
      expect(inst(run.state, s.b).threat).toBe(2);
      expect(dmg(run.state, villainOf(run.state))).toBe(1);
    });
    it("paid with no [energy] resource: refused (Requirement)", () => {
      const s = withTwoSideSchemes();
      const given = moveToHand(s.state, P1, "40052");
      const physical = iconCards(given.state, "physical", 2, { only: true, exclude: given.ids });
      expect(applyCommand(physical.state, play(P1, given.ids[0]!, physical.ids), WAVE7_DEPS).ok).toBe(false);
    });
  });

  describe("40053 Team Investigation (justice event, Alliance)", () => {
    it("removes 3 threat (3 per hero, 1 hero) from a side scheme", () => {
      const side = spawnSideScheme(openedHero("40053"), 5);
      const { state } = cast(side.state, "40053");
      expect(inst(state, side.id).threat).toBe(2);
    });
  });

  describe("40054 Take Out the Guards (justice player side scheme)", () => {
    it("when defeated: the player may discard a non-ELITE minion from play", () => {
      const { state: s, id } = cast(openedHero("40054"), "40054");
      const m = spawnMinion(patchInstance(s, id, { threat: 1 }), { code: SOLDIER_CODE });
      const run = drive(m.state, acceptingAndPicking([], [m.id]), basicThwartCmd(m.state, id));
      expect(playerOf(run.state, P1).playArea).not.toContain(m.id);
    });
  });

  describe("40055 Overwatch (justice upgrade)", () => {
    it("attached to a scheme, a thwart on it can discard Overwatch to remove the same amount from a different scheme", () => {
      const base = openedHero("40055");
      const a = spawnSideScheme(base, 4);
      const b = spawnSideScheme(a.state, 4);
      const { state: s, id } = cast(b.state, "40055", { attach: a.id });
      expect(inst(s, id).attachedTo).toBe(a.id);
      const run = drive(s, acceptingAndPicking(["40055.overwatch-interrupt"], [b.id]), basicThwartCmd(s, a.id));
      const removedFromA = 4 - inst(run.state, a.id).threat;
      expect(removedFromA).toBe(1);
      expect(inst(run.state, b.id).threat).toBe(4 - removedFromA);
      expect(inDiscard(run.state, id)).toBe(true);
    });
  });

  describe("40056 Atlas Bear (basic ally)", () => {
    it("Action: exhaust to look at the top card of a deck; an event may be added to hand for 1 damage to him", () => {
      const { state: s, id } = cast(openedHero("40056"), "40056");
      const top = conjure(s, "41019", "topOfDeck");
      const run = drive(top.state, optionsInOrder(["0"]), use(P1, id, "40056.atlas-bear-action"));
      expect(inst(run.state, id).exhausted).toBe(true);
      expect(handIds(run.state)).toContain(top.id);
      expect(dmg(run.state, id)).toBe(1);
    });
    it("a top card that is not an event is only looked at", () => {
      const { state: s, id } = cast(openedHero("40056"), "40056");
      const top = conjure(s, "40024", "topOfDeck");
      const run = drive(top.state, firstLegal, use(P1, id, "40056.atlas-bear-action"));
      expect(playerOf(run.state, P1).deck[0]).toBe(top.id);
      expect(dmg(run.state, id)).toBe(0);
    });
  });

  describe("40057 White Fox and 40060 Digging Deep (responses from the discard pile), milled by Feral", () => {
    const milledBy = (code: string) => {
      const feral = castConjured(openedHero(code), "40050");
      const top = conjure(withoutSideSchemes(feral.state, 6), code, "topOfDeck");
      const run = drive(
        top.state,
        accepting(["40050.feral-response", `${code}.`]),
        basicThwartCmd(top.state, top.state.mainScheme.instanceId, feral.id),
      );
      return { run, top: top.id };
    };
    it("White Fox discarded from the top of the deck is put into play", () => {
      const { run, top } = milledBy("40057");
      expect(inPlay(run.state, top)).toBe(true);
    });
    it("Digging Deep discarded from the top of the deck is added to hand", () => {
      const { run, top } = milledBy("40060");
      expect(handIds(run.state)).toContain(top);
    });
  });

  describe("40058 The Posse (basic event): play only if you control 3 POSSE characters", () => {
    it("refused for a Core hero with no POSSE character", () => {
      expectRefused(openedHero("40058"), "40058");
    });
    it("with 2 POSSE allies: still refused", () => {
      let s = openedHero("40058");
      s = conjure(s, "40056", "play").state;
      s = conjure(s, "40057", "play").state;
      expectRefused(s, "40058");
    });
    it("with 3 POSSE allies: heals 1 from each POSSE character and readies them", () => {
      let s = openedHero("40058");
      const bear = conjure(s, "40056", "play");
      const fox = conjure(bear.state, "40057", "play");
      const domino = conjure(fox.state, "41031", "play");
      let hurt = domino.state;
      for (const id of [bear.id, fox.id, domino.id])
        hurt = patchInstance(withDamage(hurt, id, 1), id, { exhausted: true, damage: 1 });
      const { state } = cast(hurt, "40058");
      for (const id of [bear.id, fox.id, domino.id]) {
        expect(dmg(state, id)).toBe(0);
        expect(inst(state, id).exhausted).toBe(false);
      }
    });
  });

  describe("40059 Superpower Training (basic player side scheme)", () => {
    it("when defeated: finds an identity-specific upgrade in the deck and attaches it to the identity", () => {
      const { state: s, id } = cast(openedHero("40059"), "40059");
      const identityUpgrade = playerOf(s, P1).deck.find((i) => {
        const card = s.cardPool[s.instances[i]!.cardId]!;
        return card.type === "upgrade" && "aspect" in card && card.aspect.startsWith("hero:");
      })!;
      const ready = patchInstance(s, id, { threat: 1 });
      const run = drive(ready, acceptingAndPicking([], [identityUpgrade]), basicThwartCmd(ready, id));
      expect(inst(run.state, identityUpgrade).attachedTo).toBe(me(run.state));
    });
  });

  describe("40061 Energy, 40062 Genius, 40063 Strength (basic resources, Max 1 per deck)", () => {
    const payOdds = (resource: string) => {
      const base = openedHero("40052");
      const side = spawnSideScheme(base, 1);
      const res = conjure(side.state, resource, "hand");
      const odds = moveToHand(res.state, P1, "40052");
      const physical = iconCards(odds.state, "physical", 1, { only: true, exclude: [...odds.ids, res.id] });
      return applyCommand(physical.state, play(P1, odds.ids[0]!, [res.id, ...physical.ids]), WAVE7_DEPS).ok;
    };
    it("Energy produces the [energy] that Even the Odds' Requirement asks for", () => {
      expect(payOdds("40061")).toBe(true);
    });
    it("Genius ([mental]) and Strength ([physical]) do not satisfy an [energy] Requirement", () => {
      expect(payOdds("40062")).toBe(false);
      expect(payOdds("40063")).toBe(false);
    });
  });

  describe("40064 Sharpshooter (basic upgrade)", () => {
    it("on a ranged attack (Psi-Bow Attack for a PSIONIC hero), discards the top card for +1 damage per resource icon", () => {
      const base = openedHero("40064", PSIONIC);
      const { state: s, id } = cast(base, "40064");
      const top = conjure(s, "41019", "topOfDeck");
      const bow = conjure(top.state, "41030", "hand");
      const run = drive(
        bow.state,
        accepting(["40064.sharpshooter-interrupt"]),
        play(P1, bow.id, payWith(bow.state, P1, 2, [bow.id])),
      );
      expect(wasOffered(run.offered, "40064.sharpshooter-interrupt")).toBe(true);
      expect(inDiscard(run.state, top.id)).toBe(true);
      expect(dmg(run.state, villainOf(run.state))).toBe(5);
      expect(inst(run.state, id).attachedTo).toBe(me(run.state));
    });
    it("a basic attack is not ranged: not offered", () => {
      const { state: s } = cast(openedHero("40064"), "40064");
      const run = drive(s, accepting(["40064.sharpshooter-interrupt"]), basicAttackCmd(s, villainOf(s)));
      expect(wasOffered(run.offered, "40064.sharpshooter-interrupt")).toBe(false);
    });
  });

  describe("40204 Hope Summers (basic ally)", () => {
    it("gains each trait of the controller's identity (hero form: AVENGER)", () => {
      const { state, id } = cast(openedHero("40204"), "40204");
      expect(hasTraitOn(state, id, "AVENGER")).toBe(true);
      expect(hasTraitOn(state, id, "X-FORCE")).toBe(true);
    });
    it("after you play her from hand, searches the deck for a SUPERPOWER card (Telepathy) and adds it to hand", () => {
      const base = openedHero("40204");
      const tele = conjure(base, "41024", "deck");
      const { state } = cast(tele.state, "40204", {
        pick: acceptingAndPicking(["40204.hope-summers-response"], [tele.id]),
      });
      expect(handIds(state)).toContain(tele.id);
    });
  });

  // ---- Two seats: "each player" wording must not assume the card's own player ----------------------------------

  describe("two players (a second Core hero in seat 2: Black Panther, or She-Hulk against Black Panther)", () => {
    const twoSeats = (code: string, hero?: string) =>
      openedHero(code, {
        ...(hero ? { coreHero: hero } : {}),
        otherPlayers: [wave7StarterDeckSetup(hero === BLACK_PANTHER ? SHE_HULK : BLACK_PANTHER)],
      });

    it("40023 Mission Leader: after a side scheme is defeated, each player draws 1 (seat 2 too)", () => {
      const { state: s } = cast(twoSeats("40023"), "40023");
      const side = spawnSideScheme(s, 1);
      const handTwo = playerOf(side.state, P2).hand.length;
      const run = drive(side.state, accepting(["40023.mission-leader-response"]), basicThwartCmd(side.state, side.id));
      expect(playerOf(run.state, P2).hand).toHaveLength(handTwo + 1);
    });
    it("40020 Establish Perimeter: when defeated, each identity (both seats) gets a tough status card", () => {
      const { state: s, id } = cast(twoSeats("40020", BLACK_PANTHER), "40020");
      const run = drive(patchInstance(s, id, { threat: 1 }), firstLegal, basicThwartCmd(s, id));
      expect(status(run.state, identityOf(run.state, P1), "tough")).toBe(1);
      expect(status(run.state, identityOf(run.state, P2), "tough")).toBe(1);
    });
    it("40018 Call for Backup: seat 2 may search its own deck for an ally and put it into play under its control", () => {
      const base = twoSeats("40018");
      const ally = conjure(base, "40016", "deck", P2);
      const { state: s, id } = cast(ally.state, "40018");
      const run = drive(patchInstance(s, id, { threat: 1 }), acceptingAndPicking([], [ally.id]), basicThwartCmd(s, id));
      expect(playerOf(run.state, P2).playArea).toContain(ally.id);
      expect(inst(run.state, ally.id).controllerId).toBe(P2);
    });
    it("40025 Deathlok: an upgrade from the other player's discard pile is attached to him and Deathlok's controller controls it", () => {
      const base = twoSeats("40025");
      const sidearm = conjure(base, "40030", "discard", P2);
      const { state, id } = cast(sidearm.state, "40025", {
        pick: acceptingAndPicking(["40025.deathlok-response"], [sidearm.id]),
      });
      expect(inst(state, sidearm.id).attachedTo).toBe(id);
      expect(inst(state, sidearm.id).controllerId).toBe(P1);
    });
  });

  describe("identity form: traits are those of the face showing", () => {
    it("40204 Hope Summers in alter-ego form gains the alter-ego's traits (GENIUS), not the hero's (AVENGER)", () => {
      const ego = openedCrossHero("40204");
      const hope = conjure(ego, "40204", "play");
      expect(hasTraitOn(hope.state, hope.id, "GENIUS")).toBe(true);
      expect(hasTraitOn(hope.state, hope.id, "AVENGER")).toBe(false);
    });
    it("40023 Mission Leader: Carol Danvers (alter-ego face) is a SOLDIER too, so it costs 1", () => {
      const ego = openedCrossHero("40023");
      const given = moveToHand(ego, P1, "40023");
      const id = given.ids[0]!;
      const run = applyCommand(given.state, play(P1, id, payWith(given.state, P1, 1, [id])), WAVE7_DEPS);
      expect(run.ok).toBe(true);
    });
  });

  describe("what counts as 'you control' and 'in play'", () => {
    it("40058 The Posse: the identity is a character you control, so a POSSE identity plus 2 POSSE allies is 3", () => {
      let s = openedHero("40058", { identityTraits: ["POSSE"] });
      s = conjure(s, "40056", "play").state;
      s = conjure(s, "40057", "play").state;
      const { state, id } = cast(s, "40058");
      expect(inDiscard(state, id)).toBe(true);
    });
    it("40021 E.V.A.: Fantomex under another player's control keeps it in play (the text says 'in play', not 'you control')", () => {
      const base = openedHero("40021", { otherPlayers: [wave7StarterDeckSetup(BLACK_PANTHER)] });
      const fantomex = conjure(base, "40015", "play", P2);
      const eva = castConjured(fantomex.state, "40021");
      expect(inPlay(eva.state, eva.id)).toBe(true);
    });
  });
});
