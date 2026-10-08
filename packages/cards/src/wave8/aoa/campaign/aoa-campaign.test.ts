import { AOA_CARDS } from "@mc/content";
import { applyCommand, type Command, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  putOnTopOfDeck,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { AOA_CAMPAIGN, AOA_CAMPAIGN_SKIPPED } from "./aoa-campaign.js";
import { CAMPAIGN_DEPS, campaignGame } from "./testing.js";

const SEA_WALL = "45177";
const REFUGEES = "45178";
const FILLER = "01186";
const REFS = [
  "45177.north-american-sea-wall-constant",
  "45177.boost",
  "45178.obligation",
  "45178.panicked-refugees-forced-response",
  "45178.panicked-refugees-action",
];
const refs = AOA_CARDS.filter((c) => [SEA_WALL, REFUGEES].includes(c.id as string)).flatMap((c) => abilityRefIds(c));

const drive = (state: GameState, pick: Picker, ...commands: Command[]) =>
  driveEventsPicking(CAMPAIGN_DEPS, state, pick, ...commands);
const accept: Picker = (s) =>
  s.pendingChoice?.prompt.kind === "chooseTriggers" ? [s.pendingChoice.options[0]!.optionId] : firstLegal(s);
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const inVictory = (s: GameState, code: string) => s.victoryDisplay.some((i) => s.instances[i]!.cardId === code);

/** The Sea Wall revealed in the villain phase (a filler above it absorbs the villain's boost draw). */
function revealedSeaWall() {
  const game = stackEncounterDeck(campaignGame({ encounter: [SEA_WALL, FILLER] }), FILLER, SEA_WALL);
  const run = drive(game, firstLegal, endTurn(P1));
  const wall = instancesOf(run.state, SEA_WALL)[0]!;
  return { ...run, wall };
}
const attackVillain = (s: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s, P1),
  targetInstanceId: villainOf(s),
});

describe("registry", () => {
  it("registers every ref of both cards as a valid definition; nothing is skipped", () => {
    expect(Object.keys(AOA_CAMPAIGN).sort()).toEqual([...REFS].sort());
    expect([...refs].sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(AOA_CAMPAIGN)) expect(validateDefinition(def), id).toEqual([]);
    expect(AOA_CAMPAIGN_SKIPPED).toEqual({});
  });
});

describe("North American Sea Wall (45177)", () => {
  it("revealed: 2 threat flat, in the villain area, with the surge card dealt after it", () => {
    const { state, events, wall } = revealedSeaWall();
    expect(state.villainArea).toContain(wall);
    expect(inst(state, wall).threat).toBe(2 + 2);
    expect(ofType(events, "encounterCardRevealed").map((e) => e.cardId)).toContain(SEA_WALL);
    expect(ofType(events, "encounterCardRevealed").length).toBeGreaterThanOrEqual(2);
  });

  it("the villain cannot take damage while it is in play; defeated, damage lands again and it scores 2", () => {
    const { state, wall } = revealedSeaWall();
    const hero = patchInstance(withForm(state, { heroForm: 0 }), identityOf(state, P1), { exhausted: false });
    const blocked = applyCommand(hero, attackVillain(hero), CAMPAIGN_DEPS);
    expect(blocked.ok).toBe(false);
    expect(!blocked.ok && blocked.error.code).toBe("no_valid_target");

    const down = patchInstance(hero, wall, { threat: 1 });
    const thwarted = drive(down, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(down, P1),
      schemeInstanceId: wall,
    } as Command);
    expect(inVictory(thwarted.state, SEA_WALL)).toBe(true);
    const ready = patchInstance(thwarted.state, identityOf(thwarted.state, P1), { exhausted: false });
    const hit = drive(ready, firstLegal, attackVillain(ready));
    expect(inst(hit.state, villainOf(hit.state)).damage).toBeGreaterThan(0);
  });

  it("as a boost card (2 icons): it is dealt to the player the activation is against and revealed", () => {
    const game = stackEncounterDeck(campaignGame({ encounter: [SEA_WALL] }), SEA_WALL);
    const run = drive(game, firstLegal, endTurn(P1));
    const flipped = ofType(run.events, "boostCardFlipped");
    expect(flipped[0]).toMatchObject({ boostIcons: 2 });
    const wall = instancesOf(run.state, SEA_WALL)[0]!;
    const dealt = run.events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === wall && e.to.kind === "dealtEncounter",
    );
    expect(dealt).toBeGreaterThan(-1);
    expect(ofType(run.events, "encounterCardRevealed").some((e) => e.cardId === SEA_WALL && e.playerId === P1)).toBe(
      true,
    );
    expect(run.state.villainArea).toContain(wall);
  });
});

describe("Panicked Refugees (45178)", () => {
  /**
   * The card added to the hand by a route other than a draw (a search, a hand-out; here test surgery that records the
   * entry the way `moveToHand` effects do), then the first player changes form so the flow announces it.
   */
  function addedToHand(pick: Picker) {
    const game = campaignGame({ deck: [REFUGEES] });
    const card = instancesOf(game, REFUGEES)[0]!;
    const staged: GameState = {
      ...game,
      players: game.players.map((p) => ({
        ...p,
        deck: p.deck.filter((i) => i !== card),
        hand: [...p.hand, card],
      })),
      pendingEnteredHand: [{ playerId: P1, instanceId: card, from: "deck" }],
    };
    return { ...drive(staged, pick, toHero(P1)), card, handBefore: playerOf(staged, P1).hand.length };
  }

  it("entering the hand forces it: revealed into the player's play area, then 1 card drawn", () => {
    const { state, events, card, handBefore } = addedToHand(firstLegal);
    expect(
      ofType(events, "abilityResolved").filter((e) => e.abilityId === "45178.panicked-refugees-forced-response"),
    ).toHaveLength(1);
    expect(playerOf(state, P1).hand).not.toContain(card);
    expect(playerOf(state, P1).playArea).toContain(card);
    expect(ofType(events, "cardDrawn")).toHaveLength(1);
    // Left the hand (-1), drew one (+1).
    expect(playerOf(state, P1).hand).toHaveLength(handBefore);
  });

  it("drawn from the deck it enters the hand: it is revealed into the play area and replaced by a draw", () => {
    // Owner decision, 2026-10-08 (docs/phase7-wave8.md §4.1 row 76): drawing this card is it entering the hand, the
    // card's own text read over RRG 1.8 "Obligation" (p. 30) by the golden rule (p. 4). Not an FFG ruling.
    let game = campaignGame({ deck: [REFUGEES] });
    const owner = playerOf(game, P1);
    game = { ...game, players: game.players.map((p) => ({ ...p, hand: [], discard: [...p.discard, ...owner.hand] })) };
    const staged = putOnTopOfDeck(game, P1, REFUGEES);
    const run = drive(staged.state, firstLegal, endTurn(P1));
    const card = staged.ids[0]!;
    expect(ofType(run.events, "drawnObligationPlaced")).toHaveLength(0);
    expect(
      ofType(run.events, "abilityResolved").filter((e) => e.abilityId === "45178.panicked-refugees-forced-response"),
    ).toHaveLength(1);
    expect(ofType(run.events, "encounterCardRevealed").some((e) => e.cardId === REFUGEES)).toBe(true);
    expect(playerOf(run.state, P1).playArea).toContain(card);
    expect(playerOf(run.state, P1).hand).not.toContain(card);
    // The card after it in the log is the replacement its Forced Response draws.
    const drawn = ofType(run.events, "cardDrawn").map((e) => e.instanceId);
    expect(drawn.indexOf(card)).toBeGreaterThan(-1);
    expect(drawn.length).toBeGreaterThan(drawn.indexOf(card) + 1);
  });

  it("its Alter-Ego Action exhausts the identity and removes the card from the game", () => {
    const { state, card } = addedToHand(firstLegal);
    const ready = patchInstance(withForm(state, "alterEgo"), identityOf(state, P1), { exhausted: false });
    const run = drive(ready, accept, use(P1, card, "45178.panicked-refugees-action"));
    expect(inst(run.state, identityOf(run.state, P1)).exhausted).toBe(true);
    expect(playerOf(run.state, P1).playArea).not.toContain(card);
    expect(ofType(run.events, "cardMoved").some((e) => e.instanceId === card && e.to.kind === "removedFromGame")).toBe(
      true,
    );
  });
});
