import { cardId } from "@mc/content";
import { activeEncounterDeckId, activeVillain, characterProfile, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea } from "../../../testing/staging.js";
import { runWave5, WAVE5_DEPS } from "../../testing.js";
import { startWave5Game } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const sandmanGame = (seed = 1) => startWave5Game(ghostSpiderScenario("sandman", { seed }));
const cityStreetsId = (state: GameState) => instancesOf(state, "27065")[0]!;
const sandCounters = (state: GameState) => inst(state, cityStreetsId(state)).counters["sand"] ?? 0;
const discardCount = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!.discard.length;
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;

/** Attaches `code` (found in the encounter deck or discard) to `hostId` — `wave4/mts/thanos.test.ts`'s own
 * `attachToHost` helper, copied (test-only surgery, no shared file to import it from). */
function attachToHost(
  state: GameState,
  code: string,
  hostId: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  const host = state.instances[hostId]!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: hostId },
        [hostId]: { ...host, attachments: [...host.attachments, id] },
      },
    },
  };
}

describe("Sand Form (27066)", () => {
  it("27066.sand-form-forced-interrupt: damage to Sandman discards Sand Form instead and resolves Surging Sands", () => {
    const state = sandmanGame();
    const villain = villainOf(state);
    const attached = attachToHost(state, "27066", villain);
    const before = sandCounters(attached.state);
    const beforeDiscard = discardCount(attached.state);
    const identity = identityOf(attached.state);
    const hero = settle(runWave5(attached.state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
    const attacked = settle(
      runWave5(hero, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // Sand Form is discarded instead of the villain taking damage, and Surging Sands resolves once.
    expect(inst(attacked, villain).damage).toBe(0);
    expect(attacked.encounterDecks[activeEncounterDeckId(attacked)]!.discard).toContain(attached.id);
    expect(sandCounters(attacked)).toBe(before + 1);
    expect(discardCount(attacked)).toBeGreaterThanOrEqual(beforeDiscard + 1 + (before + 1));
  });
});

/**
 * Sandman's own natural villain-phase activation (Sand Blast, `villain.ts`) attacks every round with no forcing
 * card needed, and its own Surging Sands then discards cards from the top of the encounter deck equal to the new
 * sand-counter total (4 -> 5 after one attack) — *before* the "deal encounter cards to each player" step ever
 * looks at the deck. A card merely stacked on top (`stackEncounterDeck`'s usual one-filler shape,
 * `wave4/mts/thanos.test.ts`'s own `revealTopEncounterCard`) is therefore eaten by that cascade rather than dealt
 * to a player, silently making the reveal test pass or fail on the natural attack's own numbers instead of the
 * staged card's. `dealPastNaturalAttack` stacks enough filler cards (1 consumed as Sandman's own boost card, 5 more
 * silently discarded by Surging Sands — discarding from the deck this way never reveals a card, RRG 1.8 "Encounter
 * Deck", p. 17) to survive past that cascade so `code` lands as the actual top card once the deal step reaches it.
 */
const NATURAL_ATTACK_FILLERS = ["01186", "01186", "01187", "01188", "01189", "01190"] as const;
const dealPastNaturalAttack = (state: GameState, code: string): GameState =>
  stackEncounterDeck(state, ...NATURAL_ATTACK_FILLERS, code);

describe("Sand Clone (27067)", () => {
  it("27067.sand-clone-constant: ATK equals the sand counters on City Streets; when-defeated resolves Surging Sands", () => {
    // Revealed for real (not `encounterCardInVillainArea` surgery): a minion enters play in its engaged player's
    // own `playArea`, not `villainArea` (`apply-effect.ts`), which is also where the engine's own defeat sweep
    // looks for allies/minions to defeat (`resolve/defeat.ts`'s `for (const id of player.playArea)`) — a minion
    // surgically dropped into `villainArea` instead is invisible to that sweep and can never be defeated.
    const state = sandmanGame();
    const revealed = settle(
      runWave5(dealPastNaturalAttack(state, "27067"), toHero(P1), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const identity = identityOf(revealed);
    const clone = instancesOf(revealed, "27067").find((id) => playerOf(revealed, P1).playArea.includes(id))!;
    expect(clone).toBeDefined();
    // 4 (setup) + 1 (the natural attack's own Surging Sands) = 5 sand counters by now.
    const before = sandCounters(revealed);
    expect(before).toBe(5);
    expect(characterProfile(revealed, clone, WAVE5_DEPS)?.atk).toBe(before); // X = sand counters on City Streets
    // 1 damage already taken (of 3 HP), so a real 2-ATK basic attack defeats it exactly.
    const damaged = patchInstance(revealed, clone, { damage: 1 });
    const defeated = settle(
      runWave5(damaged, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: clone }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(defeated, P1).playArea).not.toContain(clone);
    expect(sandCounters(defeated)).toBe(before + 1);
  });
});

describe("Dirt Trap (27068)", () => {
  it("27068.when-defeated: resolves Surging Sands twice", () => {
    const state = sandmanGame();
    const placed = encounterCardInVillainArea(state, "27068", 1); // its own printed starting threat
    const before = sandCounters(placed.state);
    const identity = identityOf(placed.state);
    const withHero = settle(runWave5(placed.state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
    const removed = settle(
      runWave5(withHero, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: placed.id,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(removed.villainArea).not.toContain(placed.id);
    expect(sandCounters(removed)).toBe(before + 2);
  });
});

describe("Tidal Sands (27069)", () => {
  it("27069.when-revealed: places additional threat equal to the sand counters on City Streets", () => {
    const state = sandmanGame();
    const revealed = settle(
      runWave5(dealPastNaturalAttack(state, "27069"), toHero(P1), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const tidal = instancesOf(revealed, "27069").find((id) => revealed.villainArea.includes(id))!;
    // Starting threat 2, +5 (the sand counters on City Streets: 4 from setup, +1 from the natural attack's own
    // Surging Sands, by the time Tidal Sands reveals) = 7.
    expect(inst(revealed, tidal).threat).toBe(7);
  });
});

describe("Sand Smash (27072)", () => {
  it("27072.when-revealed-hero: Sandman attacks you with +1 ATK", () => {
    const state = sandmanGame();
    const identity = identityOf(state);
    const before = inst(state, identity).damage;
    const revealed = settle(
      runWave5(dealPastNaturalAttack(state, "27072"), toHero(P1), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // The natural attack's own indirect 2 damage, then Sand Smash's own "Sandman attacks you with +1 ATK" (2 + 1 =
    // 3 more, also indirect via the same constant rule), undefended: 2 + 3 = 5.
    expect(inst(revealed, identity).damage).toBeGreaterThanOrEqual(before + 5);
  });

  it("27072.when-revealed-alter-ego: resolves Surging Sands and gains surge", () => {
    // Staying in alter-ego form (no `toHero`), Sandman's own natural villain-phase activation schemes rather than
    // attacks (Sand Blast only triggers "when Sandman attacks"), so there is no Surging Sands cascade to survive
    // here — one filler card is enough to keep Sand Smash off the villain's own boost draw.
    const state = sandmanGame();
    const before = sandCounters(state);
    const revealed = settle(
      runWave5(stackEncounterDeck(state, "01186", "27072"), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(sandCounters(revealed)).toBe(before + 1);
  });
});
