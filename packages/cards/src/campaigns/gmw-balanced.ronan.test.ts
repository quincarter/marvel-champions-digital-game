/**
 * Balanced house rule, issue #609, Gideon's Gaming: Ronan the Accuser.
 * 4. No Kree Command Ship, and the Universal Weapon stays in the deck.
 * 5. Acceleration down 1 per hero and starting threat 0, on both stages.
 * 6. The Free Milano Mods, chosen between games and attached to the Milano.
 * 10. The exhausted Milano blanks its mods (toggle).
 */
import { describe, expect, it } from "vitest";
import { WAVE3_CARDS } from "@mc/content";
import {
  applyCampaignResult,
  applyCommand,
  matchesQuery,
  resolveBetweenGames,
  type CampaignGameResult,
  type CampaignLog,
  type GameState,
} from "@mc/engine";
import {
  firstLegal,
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../testing/harness.js";
import { playFromHand, runWave3, WAVE3_DEPS } from "../wave3/testing.js";
import { query } from "../dsl/index.js";
import { GMW_CAMPAIGN_DEFINITION } from "./gmw.js";
import {
  answer,
  buildGame,
  countOf,
  DEPS,
  deckCards,
  logAt,
  modesOf,
  schemeValues,
  settleCampaign,
  type BuiltGame,
  type RunChoice,
} from "./gmw-balanced-testing.js";

const RONAN = "ronan-the-accuser";
const NORMAL: RunChoice = { balanced: false };
const BALANCED: RunChoice = { balanced: true };

const PICK = "mc16.s5.setup.balanced-mods-pick";
const KREE = answer("mc16.s5.setup.kree-decide", "kree", null, []);
const picks = (six: string, fourA: string, fourB: string) => [
  answer(PICK, "balanced-mod-6", null, [six]),
  answer(PICK, "balanced-mod-4a", null, [fourA]),
  answer(PICK, "balanced-mod-4b", null, [fourB]),
];
/** Cargo Hold (unit cost 6), Armor Plating and Heavy Cannon (unit cost 4). */
const MODS = ["16170", "16162", "16163"] as const;
const SCRIPT = [KREE, ...picks(...MODS)];

const ronan = (choice: RunChoice, seatCount = 1, seed = 4242, script = SCRIPT, units = 0): BuiltGame =>
  buildGame(logAt(RONAN, choice, seatCount, units, seed), choice, seatCount, script);
const milanoOf = (state: GameState) => instancesOf(state, "16142")[0]!;
const modInstances = (state: GameState) => MODS.map((code) => instancesOf(state, code));

describe("5. Ronan: acceleration down 1 per hero, starting threat 0, on both stages (Balanced)", () => {
  it.each([1, 2, 3])("%i hero(es): Normal is the printed value, Balanced is lowered", (n) => {
    const normal = schemeValues(ronan(NORMAL, n).state);
    const balanced = schemeValues(ronan(BALANCED, n).state);
    expect(normal[0]).toMatchObject({ acceleration: 2 * n, startingThreat: 2 * n });
    expect(normal[1]).toMatchObject({ startingThreat: n });
    for (const stage of [0, 1] as const) {
      expect(balanced[stage]?.acceleration, `stage ${stage + 1}`).toBe(normal[stage]!.acceleration - n);
      expect(balanced[stage]?.startingThreat, `stage ${stage + 1}`).toBe(0);
      expect(balanced[stage]?.targetThreat, `stage ${stage + 1}`).toBe(normal[stage]!.targetThreat);
    }
    expect(balanced[0]?.acceleration).toBe(n);
  });

  it("stage 2 starts at 0 through a real flip: Balanced ends 2 threat under Normal (1 starting, 1 acceleration per hero)", () => {
    const flip = (choice: RunChoice): GameState => {
      const { state } = ronan(choice);
      const staged = patchInstance(state, state.mainScheme.instanceId, { threat: 6 });
      const after = settle(runWave3(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
      expect(after.mainScheme.stageIndex).toBe(1);
      return after;
    };
    const normal = flip(NORMAL);
    const balanced = flip(BALANCED);
    expect(
      inst(normal, normal.mainScheme.instanceId).threat - inst(balanced, balanced.mainScheme.instanceId).threat,
    ).toBe(2);
  });

  it("the game begins with no threat on the main scheme; Normal begins with the printed amount", () => {
    for (const n of [1, 2]) {
      const balanced = ronan(BALANCED, n).state;
      expect(inst(balanced, balanced.mainScheme.instanceId).threat).toBe(0);
      const normal = ronan(NORMAL, n).state;
      expect(inst(normal, normal.mainScheme.instanceId).threat).toBe(2 * n);
    }
  });

  it("the Expert Campaign instruction still places its additional 1[per_hero] threat", () => {
    for (const n of [1, 2]) {
      const run = (choice: RunChoice): GameState => {
        const log = logAt(RONAN, choice, n);
        const withHp: CampaignLog = {
          ...log,
          seats: log.seats.map((seat) => ({
            ...seat,
            fields: { ...seat.fields, remainingHp: { kind: "number" as const, value: 8 } },
          })),
        };
        return buildGame(withHp, choice, n, SCRIPT).state;
      };
      const normal = run({ ...NORMAL, expertCampaign: true });
      const balanced = run({ ...BALANCED, expertCampaign: true });
      expect(inst(balanced, balanced.mainScheme.instanceId).threat).toBe(n);
      expect(inst(normal, normal.mainScheme.instanceId).threat).toBe(2 * n + n);
    }
  });
});

describe("4. Ronan setup: no Kree Command Ship, and the Universal Weapon stays in the deck (Balanced)", () => {
  const SHIP = "16108";
  const WEAPON = "16109";
  const weaponAttached = (state: GameState) =>
    instancesOf(state, WEAPON).some((id) => inst(state, id).attachedTo === state.villains[0]!.instanceId);

  it("Normal: the ship is in play and the weapon is attached to Ronan", () => {
    const { state } = ronan(NORMAL);
    expect(instancesOf(state, SHIP).some((id) => state.villainArea.includes(id))).toBe(true);
    expect(weaponAttached(state)).toBe(true);
    expect(countOf(deckCards(state), WEAPON)).toBe(0);
    expect(state.removedFromGame).toHaveLength(0);
  });

  it("Balanced: the ship is removed from the game, and the weapon is an unattached card in the deck", () => {
    const { state } = ronan(BALANCED);
    const ships = instancesOf(state, SHIP);
    expect(ships.map((id) => state.removedFromGame.includes(id))).toEqual([true]);
    expect(ships.some((id) => state.villainArea.includes(id))).toBe(false);
    expect(weaponAttached(state)).toBe(false);
    expect(countOf(deckCards(state), WEAPON)).toBe(1);
  });

  it("Balanced: the weapon sits wherever the deck's shuffle put it, not on a known position", () => {
    const positions = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => deckCards(ronan(BALANCED, 1, seed).state).indexOf(WEAPON)),
    );
    expect(positions.size).toBeGreaterThan(2);
    expect(positions.has(-1)).toBe(false);
  });

  it("Kree Supremacy's (Optional) reveal is still offered, and accepting it reveals the side scheme", () => {
    const { state, composed } = buildGame(logAt(RONAN, BALANCED, 1), BALANCED, 1, [
      answer("mc16.s5.setup.kree-decide", "kree", null, ["accept"]),
      ...picks(...MODS),
    ]);
    expect(composed.asked.some((choice) => choice.slot === "kree")).toBe(true);
    expect(instancesOf(state, "16182a").some((id) => state.villainArea.includes(id))).toBe(true);
  });
});

describe("6. The Free Milano Mods (Balanced, Scenario 5)", () => {
  it("Normal: no pick is offered, nothing is set aside, and no Market card is on the Milano", () => {
    const run = ronan(NORMAL, 1, 4242, [KREE]);
    expect(run.composed.asked.some((choice) => choice.instructionId === PICK)).toBe(false);
    expect(run.composed.value.hidden.balancedMods).toBeUndefined();
    for (const code of ["16162", "16163", "16164", "16165", "16170", "16171", "16172", "16173"]) {
      expect(instancesOf(run.state, code), code).toHaveLength(0);
    }
  });

  it("the first player (the group) is offered one unit cost 6 and two different unit cost 4, free", () => {
    const { composed } = ronan(BALANCED, 2);
    const asked = composed.asked.filter((choice) => choice.instructionId === PICK);
    expect(asked.map((choice) => [choice.slot, choice.seatNumber, choice.chooser, choice.options])).toEqual([
      ["balanced-mod-6", null, "group", ["16170", "16171", "16172", "16173"]],
      ["balanced-mod-4a", null, "group", ["16162", "16163", "16164", "16165"]],
      // The second unit cost 4 pick cannot repeat the first.
      ["balanced-mod-4b", null, "group", ["16163", "16164", "16165"]],
    ]);
    expect(asked.every((choice) => choice.optional === true)).toBe(true);
  });

  it("declining all three picks: no crash, nothing recorded, nothing attached", () => {
    const { state, composed } = ronan(BALANCED, 1, 4242, [
      KREE,
      answer(PICK, "balanced-mod-6", null, []),
      answer(PICK, "balanced-mod-4a", null, []),
      answer(PICK, "balanced-mod-4b", null, []),
    ]);
    expect(composed.value.hidden.balancedMods).toBeUndefined();
    expect(modInstances(state).every((copies) => copies.length === 0)).toBe(true);
    expect(Object.values(state.instances).filter((i) => i.attachedTo === milanoOf(state))).toHaveLength(0);
  });

  it("declining the first unit cost 4 pick: the second offers all four, and only the other two mods attach", () => {
    const { state, composed } = ronan(BALANCED, 1, 4242, [
      KREE,
      answer(PICK, "balanced-mod-6", null, ["16170"]),
      answer(PICK, "balanced-mod-4a", null, []),
      answer(PICK, "balanced-mod-4b", null, ["16165"]),
    ]);
    const asked = composed.asked.filter((choice) => choice.instructionId === PICK);
    expect(asked[2]?.options).toEqual(["16162", "16163", "16164", "16165"]);
    expect(composed.value.hidden.balancedMods).toEqual({ kind: "cardList", cardIds: ["16170", "16165"] });
    const attached = Object.values(state.instances).filter((i) => i.attachedTo === milanoOf(state));
    expect(attached.map((i) => i.cardId).sort()).toEqual(["16165", "16170"]);
  });

  it("they are recorded in balancedMods and cost nothing: no unit spent, no marketCards entry, no granted card", () => {
    const { composed } = ronan(BALANCED, 2, 4242, SCRIPT, 5);
    expect(composed.value.hidden.balancedMods).toEqual({ kind: "cardList", cardIds: [...MODS] });
    expect(composed.value.shared.balancedMods).toBeUndefined(); // hidden: never on the printed sheet
    for (const seat of composed.value.seats) {
      expect(seat.fields.units).toEqual({ kind: "number", value: 5 });
      expect(seat.fields.marketCards).toBeUndefined();
      expect(seat.grants).toEqual([]);
    }
  });

  it("a Market card any player bought is not offered (one copy per campaign), and the bought copy is untouched", () => {
    const buy = answer("mc16.s5.setup.market", "market-6-0", 1, ["16170"]);
    const buyFour = answer("mc16.s5.setup.market", "market-4-0", 1, ["16162"]);
    const { composed, state } = ronan(BALANCED, 2, 4242, [KREE, buy, buyFour, ...picks("16171", "16163", "16164")], 10);
    const asked = composed.asked.filter((choice) => choice.instructionId === PICK);
    expect(asked[0]?.options).toEqual(["16171", "16172", "16173"]);
    expect(asked[1]?.options).toEqual(["16163", "16164", "16165"]);
    // The bought copies stay what they were: seat 1 spent 10 - 6 - 4 = 0, holds both, and has them in its deck.
    expect(composed.value.seats[0]?.fields.units).toEqual({ kind: "number", value: 0 });
    expect(composed.value.seats[0]?.fields.marketCards).toEqual({ kind: "cardList", cardIds: ["16162", "16170"] });
    expect(composed.value.seats[0]?.grants.map((grant) => grant.cardId).sort()).toEqual(["16162", "16170"]);
    // The bought copies are in the deck (or its hand) and never on the Milano.
    for (const code of ["16170", "16162"]) {
      const copies = instancesOf(state, code);
      expect(copies, code).toHaveLength(1);
      expect(inst(state, copies[0]!).attachedTo, code).not.toBe(milanoOf(state));
    }
  });

  it("a tier with no card left is skipped: it offers nothing and picks nothing", () => {
    const buys = [0, 1, 2, 3].map((copy) =>
      answer("mc16.s5.setup.market", `market-6-${copy}`, 1, [["16170", "16171", "16172", "16173"][copy]!]),
    );
    const { composed } = ronan(
      BALANCED,
      1,
      4242,
      [
        KREE,
        ...buys,
        answer(PICK, "balanced-mod-4a", null, ["16162"]),
        answer(PICK, "balanced-mod-4b", null, ["16163"]),
      ],
      24,
    );
    const asked = composed.asked.filter((choice) => choice.instructionId === PICK);
    expect(asked[0]?.options).toEqual([]);
    expect(composed.value.hidden.balancedMods).toEqual({ kind: "cardList", cardIds: ["16162", "16163"] });
  });

  it("in the game each mod is attached to the Milano, owned and controlled by the first player, at no cost", () => {
    const { state } = ronan(BALANCED, 2);
    const milano = milanoOf(state);
    expect(inst(state, milano).controllerId).toBe(P1);
    for (const [index, code] of MODS.entries()) {
      const copies = modInstances(state)[index]!;
      expect(copies, code).toHaveLength(1);
      const mod = inst(state, copies[0]!);
      expect(mod.attachedTo, code).toBe(milano);
      expect(mod.controllerId, code).toBe(P1);
      expect(mod.ownerId, code).toBe(P1);
      expect(mod.faceup, code).toBe(true);
    }
    // No other Market card is in the game at all, and none is in a deck, hand or discard pile.
    const mods = new Set<string>(MODS);
    for (const player of state.players) {
      for (const id of [...player.deck, ...player.hand, ...player.discard]) {
        expect(mods.has(state.instances[id]!.cardId as string)).toBe(false);
      }
    }
    const market = WAVE3_CARDS.filter(
      (card) => "specificTo" in card && card.specificTo?.encounterSetId === "the_market",
    );
    expect(market).toHaveLength(28);
    expect(Object.values(state.instances).filter((i) => market.some((card) => card.id === i.cardId))).toHaveLength(3);
  });

  it("their Hero Actions are usable, and 'if you control the Milano' reads true for the first player", () => {
    const { state } = ronan(BALANCED, 2);
    const [cannon] = modInstances(state)[2]!;
    const milano = milanoOf(state);
    const ctx = (controllerId: typeof P1) => ({
      selfInstanceId: cannon!,
      controllerId,
      event: null,
      bindings: {},
      deps: WAVE3_DEPS,
    });
    const controlled = query("support", { name: "Milano", controller: "you" });
    expect(matchesQuery(state, milano, controlled, ctx(P1))).toBe(true);
    expect(matchesQuery(state, milano, controlled, ctx(P2))).toBe(false);
    const hero = runWave3(state, toHero());
    const used = applyCommand(hero, use(P1, cannon!, "16163.heavy-cannon-action"), WAVE3_DEPS);
    expect(used.ok).toBe(true);
    if (used.ok) expect(inst(used.state, cannon!).exhausted).toBe(true);
  });

  it("they pass with the Milano when the first player changes (RRG 1.8 p. 31)", () => {
    const { state } = ronan(BALANCED, 2);
    const [cannon] = modInstances(state)[2]!;
    const hero = runWave3(state, toHero());
    const passed = applyCommand({ ...hero, firstPlayerId: P2 }, { type: "endTurn", playerId: P1 }, WAVE3_DEPS);
    if (!passed.ok) throw new Error(passed.error.message);
    expect(inst(passed.state, milanoOf(passed.state)).controllerId).toBe(P2);
    for (const copies of modInstances(passed.state)) expect(inst(passed.state, copies[0]!).controllerId).toBe(P2);
    expect(playerOf(passed.state, P2).playArea).toContain(milanoOf(passed.state));
    // Player 1 no longer controls it, so cannot use it.
    const asP1 = applyCommand(passed.state, use(P1, cannon!, "16163.heavy-cannon-action"), WAVE3_DEPS);
    expect(asP1.ok).toBe(false);
    // Known engine reading: ownership stays with the player who first controlled the mod (see the report).
    expect(inst(passed.state, cannon!).ownerId).toBe(P1);
  });

  it("a discarded mod goes to its owner's discard pile, not the encounter discard, without a crash", () => {
    const { state } = ronan(BALANCED, 1);
    const [armor] = modInstances(state)[1]!;
    // Caught Off Guard (01188): "Discard an upgrade or support you control." The player chooses the mod. Ronan and the
    // Badoon Headhunter each draw a boost card first, so it is the third card.
    const pick = (st: GameState): readonly string[] => {
      const choice = st.pendingChoice;
      if (!choice) return [];
      const mod = choice.options.find((option) => option.optionId === String(armor));
      if (mod && choice.prompt.kind !== "declareDefender") return [mod.optionId];
      if (choice.prompt.kind === "declareDefender") return ["decline"];
      return choice.options.slice(0, choice.minSelections).map((option) => option.optionId);
    };
    const staged = stackEncounterDeck(state, "01186", "01187", "01188");
    const after = settle(runWave3(staged, { type: "endTurn", playerId: P1 }), pick, undefined, WAVE3_DEPS);
    expect(playerOf(after, P1).discard).toContain(armor);
    expect(inst(after, armor!).attachedTo).toBeNull();
  });
});

describe("6. A retry of Ronan re-offers the pick cleanly", () => {
  it("a lost attempt restores the log: the second attempt asks all three picks again and records 3 cards, not 6", () => {
    const modes = modesOf(BALANCED);
    const log = logAt(RONAN, BALANCED, 1);
    const first = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, modes, answers),
      SCRIPT,
    );
    expect(first.value.hidden.balancedMods).toEqual({ kind: "cardList", cardIds: [...MODS] });
    const lost: CampaignGameResult = {
      nodeId: RONAN,
      outcome: "lost",
      records: [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const afterLoss = settleCampaign(
      (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, first.value, lost, { at: 1 }, DEPS, answers),
      [],
    ).value;
    // The flag survives the loss, so the retry is still Balanced.
    expect(afterLoss.hidden.balanced).toEqual({ kind: "flag", value: true });
    const retryPicks = picks("16172", "16164", "16165");
    const second = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, afterLoss, DEPS, modes, answers),
      [KREE, ...retryPicks],
    );
    const asked = second.asked.filter((choice) => choice.instructionId === PICK);
    expect(asked.map((choice) => choice.slot)).toEqual(["balanced-mod-6", "balanced-mod-4a", "balanced-mod-4b"]);
    expect(asked[0]?.options).toEqual(["16170", "16171", "16172", "16173"]);
    expect(second.value.hidden.balancedMods).toEqual({ kind: "cardList", cardIds: ["16172", "16164", "16165"] });
  });
});

describe("10. Milano exhausted blanks its mods (Balanced toggle)", () => {
  const exhausted = (state: GameState): GameState => patchInstance(state, milanoOf(state), { exhausted: true });
  const canUse = (state: GameState, id: ReturnType<typeof milanoOf>): boolean =>
    applyCommand(runWave3(state, toHero()), use(P1, id, "16163.heavy-cannon-action"), WAVE3_DEPS).ok;
  const on: RunChoice = { balanced: true, toggles: ["milanoExhausted"] };

  it("on: a mod's Hero Action is gone while the Milano is exhausted, and back when it is ready", () => {
    const { state } = ronan(on);
    const [cannon] = modInstances(state)[2]!;
    expect(canUse(state, cannon!)).toBe(true);
    expect(canUse(exhausted(state), cannon!)).toBe(false);
  });

  it("Balanced with the toggle off: an exhausted Milano changes nothing", () => {
    const { state } = ronan(BALANCED);
    const [cannon] = modInstances(state)[2]!;
    expect(canUse(exhausted(state), cannon!)).toBe(true);
  });

  it("Normal: no mods are on the Milano, and an exhausted Milano changes nothing else", () => {
    const { state } = ronan(NORMAL, 1, 4242, [KREE]);
    expect(Object.values(state.instances).filter((i) => i.attachedTo === milanoOf(state))).toHaveLength(0);
    expect(inst(exhausted(state), milanoOf(state)).exhausted).toBe(true);
  });

  it("a bought mod in a player's play area is not affected", () => {
    // Seat 1 bought Heavy Cannon; the free mods are the other three.
    const buy = answer("mc16.s5.setup.market", "market-4-0", 1, ["16163"]);
    const { state } = ronan(on, 1, 4242, [KREE, buy, ...picks("16170", "16162", "16164")], 4);
    const bought = playFromHand(runWave3(state, toHero()), "16163", 0);
    const mine = bought.id;
    expect(inst(bought.state, mine).attachedTo).not.toBe(milanoOf(bought.state));
    const withMilanoExhausted = exhausted(bought.state);
    const used = applyCommand(withMilanoExhausted, use(P1, mine, "16163.heavy-cannon-action"), WAVE3_DEPS);
    expect(used.ok).toBe(true);
    // The free mod on the Milano is blanked at the same moment.
    const [armor] = modInstances(withMilanoExhausted)[1]!;
    expect(inst(withMilanoExhausted, armor!).attachedTo).toBe(milanoOf(withMilanoExhausted));
  });
});
