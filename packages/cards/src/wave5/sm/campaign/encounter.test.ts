/**
 * MC27's three campaign-only encounter sets, scripted in `encounter.ts` (its own module docblock cites every
 * printed sentence). Most refs are exercised directly (`gameWithExtras`: `ghostSpiderScenario("sandman", …)` with
 * the campaign card appended to the shared encounter deck and put into play by test surgery, since none of these
 * cards is ever a member of a *scenario's own* encounter set) — "test through that path where practical" is Snitches
 * Get Stitches and its Venom ally, which do need `campaigns/sm.ts`'s real `putVenomIntoPlay`/
 * `shuffleSmearAndSnitches` instructions (`realGame`, this file's own copy of `campaigns/sm.test.ts`'s harness,
 * trimmed to the one node this file needs, "mysterio"/node 2).
 */
import { abilityId, cardId, SM_CARDS as _SM_CARDS, SM_STARTER_DECKS, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  cardsInPlay,
  createCampaignLog,
  createGame,
  hasKeyword,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignSeatSetup,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { cardsOfComposedSets } from "../../../campaigns/composed-sets.js";
import { SM_CAMPAIGN_DEFINITION } from "../../../campaigns/sm.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import { action, defineAbilities, mergeRegistries, resolveWhenRevealedOf, self } from "../../../dsl/index.js";
import { WAVE5_ABILITIES, WAVE5_CARDS, wave5Scenario } from "../../index.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

void _SM_CARDS;

/**
 * A test-only ability that resolves Smear Campaign's own registered "27175.when-revealed" directly
 * (`resolveWhenRevealedOf`, the same primitive a "[star] Boost: resolve this card's own When Revealed ability"
 * card uses on itself, `venom/encounter-set.ts`'s "27083.boost" precedent) — the villain phase's own natural boost
 * draws consume an unpredictable number of cards ahead of a stacked reveal (Sandman's own kit runs two enemy
 * activations a round, each drawing its own boost card), so pinning down exactly how many filler cards absorb
 * them is fragile; resolving the ability directly, on a card already in play, exercises the exact same registered
 * ability ref without depending on that.
 */
const RESOLVE_WHEN_REVEALED = abilityId("27175.dbg-resolve-when-revealed");
const RESOLVE_DEPS = {
  abilities: mergeRegistries(
    WAVE5_ABILITIES,
    defineAbilities({ [RESOLVE_WHEN_REVEALED]: action(resolveWhenRevealedOf(self)) }),
  ),
};

/**
 * A card's own legal actions are gated by its *content-data* `abilities` list, not just what a merged registry
 * defines (RESOLVE_DEPS alone isn't enough) — this test-only surgery adds `RESOLVE_WHEN_REVEALED` to `code`'s
 * `cardPool` entry for this one game, so `use(P1, id, RESOLVE_WHEN_REVEALED)` is legal on it.
 */
function withDebugAbility(state: GameState, code: string): GameState {
  const card = state.cardPool[code];
  if (!card || !("abilities" in card))
    throw new Error(`${code} is not an ability-carrying card in this game's cardPool`);
  return {
    ...state,
    cardPool: {
      ...state.cardPool,
      [code]: { ...card, abilities: [...card.abilities, { id: RESOLVE_WHEN_REVEALED }] },
    },
  };
}

/** `toHero`, but a no-op if the identity is already hero (a new round keeps last round's form). */
const asHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave5(state, toHero(P1));

/**
 * A one-player Sandman game, `extraCodes` appended once each to the shared encounter deck for test surgery
 * (`encounterCardInVillainArea`) to pull out later — none of this file's cards is ever printed into a scenario's
 * own encounter set, so nothing else puts them there.
 */
function gameWithExtras(
  extraCodes: readonly string[],
  opts: { readonly seed?: number; readonly difficulty?: "standard" | "expert" } = {},
): GameState {
  const config = ghostSpiderScenario("sandman", {
    seed: opts.seed ?? 1,
    ...(opts.difficulty ? { difficulty: opts.difficulty } : {}),
  });
  return startWave5Game({ ...config, encounterDeck: [...config.encounterDeck, ...extraCodes.map((c) => cardId(c))] });
}

/**
 * Pays a `spendResources` prompt with exactly its minimum legal selection (not "every option offered" — a real
 * hand has many cards with a matching resource icon, so selecting all of them, as the engine's own synthetic
 * `additional-thwart-cost.test.ts` `payAll` does against a one-card hand, overpays with the whole hand here);
 * `firstLegal` otherwise.
 */
const payMinimal: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "spendResources") {
    // Any hand card is offered, whether or not it can actually pay a [physical] cost (the "min 0" declines it
    // instead if the pick can't cover it) — pick one that actually carries a [physical] icon, so the payment
    // succeeds instead of silently falling through to the "declined" branch.
    const match = choice.options.find((o) => {
      const instanceId = o.ref.kind === "card" ? o.ref.instanceId : undefined;
      const card = instanceId ? state.cardPool[state.instances[instanceId]?.cardId as string] : undefined;
      return card && "resourceIcons" in card && (card.resourceIcons?.physical ?? 0) > 0;
    });
    return match ? [match.optionId] : choice.options.slice(0, 1).map((o) => o.optionId);
  }
  return firstLegal(state);
};

/** Accepts the named optional interrupt/response (by ability id suffix); declines everything else (`venom/
 * encounter-set.test.ts`'s own `accepting` precedent). */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/**
 * Test surgery: put `code` into play already engaged with P1 — a minion `encounterCardInVillainArea` alone leaves
 * in `villainArea`, not a player's own `playArea` where an engaged minion actually lives (`wave5/spdr/sinister-
 * syndicate.test.ts`'s own `engagedWithP1` precedent; without this, a basic attack never defeats it).
 */
const engagedWithP1 = (state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } => {
  const staged = encounterCardInVillainArea(state, code);
  const id = staged.id;
  return {
    id,
    state: {
      ...staged.state,
      villainArea: staged.state.villainArea.filter((i) => i !== id),
      players: staged.state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...staged.state.instances, [id]: { ...staged.state.instances[id]!, engagedWith: P1 } },
    },
  };
};

describe("Public Outcry (174a/174b)", () => {
  it("27174a.public-outcry-response: Response removes 1 notoriety counter after a minion is defeated (accepted)", () => {
    const state = gameWithExtras(["27174a", "27131"]);
    const { state: withOutcry, id: outcry } = encounterCardInVillainArea(state, "27174a");
    const primed = patchInstance(withOutcry, outcry, { counters: { notoriety: 2 } });
    const { state: withMinion, id: minion } = engagedWithP1(primed, "27131");
    const damaged = patchInstance(withMinion, minion, { damage: 999 });
    const attacked = settle(
      runWave5(asHero(damaged), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(damaged),
        targetInstanceId: minion,
      }),
      accepting("27174a.public-outcry-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(cardsInPlay(attacked)).not.toContain(minion); // Common Criminal's printed 3 HP: defeated and discarded.
    expect(inst(attacked, outcry).counters["notoriety"]).toBe(1);
  });

  it("27174a.public-outcry-response: declining the Response leaves the counter unchanged", () => {
    const state = gameWithExtras(["27174a", "27131"]);
    const { state: withOutcry, id: outcry } = encounterCardInVillainArea(state, "27174a");
    const primed = patchInstance(withOutcry, outcry, { counters: { notoriety: 2 } });
    const { state: withMinion, id: minion } = engagedWithP1(primed, "27131");
    // `defeatWithAttack` settles with `firstLegal`, which declines the optional Response.
    const after = defeatWithAttack(WAVE5_DEPS, asHero(withMinion), minion);
    expect(inst(after, outcry).counters["notoriety"]).toBe(2);
  });
});

describe("Smear Campaign (175)", () => {
  it("27175.smear-campaign-constant: gains surge in expert mode, not in standard mode", () => {
    const expert = gameWithExtras(["27175"], { difficulty: "expert" });
    const { state: expertState, id: expertId } = encounterCardInVillainArea(expert, "27175");
    expect(hasKeyword(expertState, expertId, "surge", WAVE5_DEPS)).toBe(true);

    const standard = gameWithExtras(["27175"]);
    const { state: standardState, id: standardId } = encounterCardInVillainArea(standard, "27175");
    expect(hasKeyword(standardState, standardId, "surge", WAVE5_DEPS)).toBe(false);
  });

  it("27175.when-revealed: with Public Outcry in play, 2 notoriety counters on it and this card is removed from the game", () => {
    const state = gameWithExtras(["27175", "27174a"]);
    const { state: withOutcry, id: outcry } = encounterCardInVillainArea(state, "27174a");
    const { state: withSmear, id: smear } = encounterCardInVillainArea(withOutcry, "27175");
    const revealed = settle(
      runWith(RESOLVE_DEPS, withDebugAbility(withSmear, "27175"), use(P1, smear, RESOLVE_WHEN_REVEALED)),
      firstLegal,
      undefined,
      RESOLVE_DEPS,
    );
    expect(inst(revealed, outcry).counters["notoriety"]).toBe(2);
    expect(revealed.removedFromGame).toContain(smear);
  });

  it("27175.when-revealed: without Public Outcry in play, 2 threat on the main scheme instead", () => {
    const state = gameWithExtras(["27175"]);
    const before = mainThreat(state);
    const { state: withSmear, id: smear } = encounterCardInVillainArea(state, "27175");
    const revealed = settle(
      runWith(RESOLVE_DEPS, withDebugAbility(withSmear, "27175"), use(P1, smear, RESOLVE_WHEN_REVEALED)),
      firstLegal,
      undefined,
      RESOLVE_DEPS,
    );
    expect(mainThreat(revealed)).toBe(before + 2);
  });
});

describe("Back Alley Burglary (176)", () => {
  it("27176.back-alley-burglary-forced-response: paying the [physical] resource — the hand card spent has a printed [physical] icon", () => {
    const state = gameWithExtras(["27176"]);
    const { state: withScheme, id: scheme } = encounterCardInVillainArea(state, "27176", 3);
    const identity = identityOf(withScheme);
    const readied = patchInstance(asHero(withScheme), identity, { exhausted: false });
    const handBefore = playerOf(readied, P1).hand;
    const { state: after } = driveEventsPicking(WAVE5_DEPS, readied, payMinimal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identity,
      schemeInstanceId: scheme,
    });
    // Paying a resource discards the paying card too (RRG 1.8 "Cost", p. 13), so the hand shrinks by 1 either
    // way (the "decline" test below, too) — what distinguishes "spent as the cost" from "discarded at random" is
    // *which* card left: paying must spend a card with a printed [physical] icon; a random discard need not.
    const handAfter = playerOf(after, P1).hand;
    expect(handAfter.length).toBe(handBefore.length - 1);
    const removed = handBefore.find((id) => !handAfter.includes(id))!;
    const removedCard = after.cardPool[after.instances[removed]!.cardId];
    const physicalIcons =
      removedCard && "resourceIcons" in removedCard ? (removedCard.resourceIcons?.physical ?? 0) : 0;
    expect(physicalIcons).toBeGreaterThan(0);
  });

  it("27176.back-alley-burglary-forced-response: declining the resource discards 1 random card from hand instead", () => {
    const state = gameWithExtras(["27176"]);
    const { state: withScheme, id: scheme } = encounterCardInVillainArea(state, "27176", 3);
    const identity = identityOf(withScheme);
    const readied = patchInstance(asHero(withScheme), identity, { exhausted: false });
    const handBefore = playerOf(readied, P1).hand.length;
    const { state: after } = driveEventsPicking(WAVE5_DEPS, readied, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identity,
      schemeInstanceId: scheme,
    });
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1);
  });
});

describe("Cat in a Tree (177)", () => {
  it("27177.cat-in-a-tree-constant: thwarting takes 2 indirect damage, then removes threat as normal", () => {
    const state = gameWithExtras(["27177"]);
    const { state: withScheme, id: scheme } = encounterCardInVillainArea(state, "27177", 6);
    const identity = identityOf(withScheme);
    const readied = patchInstance(asHero(withScheme), identity, { exhausted: false });
    const before = inst(readied, scheme).threat;
    const after = settle(
      runWith(WAVE5_DEPS, readied, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identity).damage).toBe(2);
    expect(inst(after, scheme).threat).toBe(before - 1); // Ghost-Spider's printed THW 1.
  });
});

describe("Henchmen Heist (178)", () => {
  it("27178.henchmen-heist-forced-response: threat removed from this scheme is placed on the main scheme too", () => {
    const state = gameWithExtras(["27178"]);
    const { state: withScheme, id: scheme } = encounterCardInVillainArea(state, "27178", 6);
    const identity = identityOf(withScheme);
    const readied = patchInstance(asHero(withScheme), identity, { exhausted: false });
    const before = mainThreat(readied);
    const after = settle(
      runWith(WAVE5_DEPS, readied, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(after)).toBe(before + 1); // Ghost-Spider's printed THW 1, mirrored onto the main scheme.
  });
});

describe("Off the Rails (179)", () => {
  it("27179.off-the-rails-forced-interrupt: 2 speed counters remove it from the game and discard the top 3 of each deck", () => {
    const state = gameWithExtras(["27179"]);
    const { state: withScheme, id: scheme } = encounterCardInVillainArea(state, "27179");
    const round1 = settle(runWave5(asHero(withScheme), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(round1, scheme).counters["speed"]).toBe(1);
    expect(round1.removedFromGame).not.toContain(scheme);
    // The top 3 cards of P1's own deck right now, by exact instance id — Sandman's own villain-phase mechanic
    // also discards from the deck this round (Sandslide), so "discard grew by exactly 3" isn't a safe assertion;
    // "these specific 3 cards are now in the discard pile" is.
    const topThree = playerOf(round1, P1).deck.slice(0, 3);
    const round2 = settle(runWave5(asHero(round1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(round2.removedFromGame).toContain(scheme);
    for (const id of topThree) expect(playerOf(round2, P1).discard).toContain(id);
  });
});

describe("Rubble Rescue (180)", () => {
  it("27180.rubble-rescue-interrupt: a basic thwart against this scheme may use ATK instead of THW", () => {
    const state = gameWithExtras(["27180"]);
    const { state: withScheme, id: scheme } = encounterCardInVillainArea(state, "27180", 10);
    const identity = identityOf(withScheme);
    const readied = patchInstance(asHero(withScheme), identity, { exhausted: false });
    const before = inst(readied, scheme).threat;
    const after = settle(
      runWith(WAVE5_DEPS, readied, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
        useAtk: true,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, scheme).threat).toBe(before - 2); // Ghost-Spider's printed ATK 2, not her THW 1.
  });

  it("27180.rubble-rescue-interrupt: a basic thwart may still use THW as normal (the rule is optional)", () => {
    const state = gameWithExtras(["27180"]);
    const { state: withScheme, id: scheme } = encounterCardInVillainArea(state, "27180", 10);
    const identity = identityOf(withScheme);
    const readied = patchInstance(asHero(withScheme), identity, { exhausted: false });
    const before = inst(readied, scheme).threat;
    const after = settle(
      runWith(WAVE5_DEPS, readied, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, scheme).threat).toBe(before - 1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Snitches Get Stitches (181): only reachable through the real campaign (Venom the ally has to actually be in
// play, controlled by a player), so this is `campaigns/sm.test.ts`'s own `realGame` harness, trimmed to the one
// node ("mysterio", index 2) whose setup runs `putVenomIntoPlay` and `shuffleSmearAndSnitches`.
// ---------------------------------------------------------------------------------------------------------------

const CAMPAIGN_DEPS: CampaignDeps = { pool: WAVE5_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: SM_CAMPAIGN_DEFINITION.campaignId } };
const NODES = ["sandman", "venom", "mysterio", "sinister-six", "venom-goblin"] as const;

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = SM_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no sm starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}
const SEATS: readonly CampaignSeatSetup[] = [seatFor("ghost-spider", 1), seatFor("spider-man-morales", 2)];
const newLog = (seed: number): CampaignLog =>
  createCampaignLog(SM_CAMPAIGN_DEFINITION, {
    id: `sm-enc-${seed}`,
    seats: SEATS,
    modes: STANDARD,
    poolVersion: "test",
    seed,
  });
const won = (nodeId: string): CampaignGameResult => ({
  nodeId,
  outcome: "won",
  records: [],
  removedFromCampaign: [],
  logWrites: [],
  expiringGrants: [],
});
const composed = (log: CampaignLog): CampaignLog => {
  const outcome = resolveBetweenGames(SM_CAMPAIGN_DEFINITION, log, CAMPAIGN_DEPS, log.modes);
  if (outcome.kind !== "done") throw new Error(`unexpected choice ${outcome.choice.slot} before ${log.id}'s game`);
  return outcome.value;
};
function logAt(nodeIndex: number, seed = 11): CampaignLog {
  let log = newLog(seed);
  for (let index = 0; index < nodeIndex; index++) {
    const applied = applyCampaignResult(
      SM_CAMPAIGN_DEFINITION,
      composed(log),
      won(NODES[index] as string),
      { at: index, gameId: `sm-enc-${seed}-${index}` },
      CAMPAIGN_DEPS,
    );
    if (applied.kind !== "done") throw new Error(`unexpected choice after ${NODES[index]}`);
    log = applied.value;
  }
  return log;
}
function realGame(log: CampaignLog, targetNode: string, pick: Picker = firstLegal): GameState {
  const ready = composed(log);
  const start = startGameFromLog(SM_CAMPAIGN_DEFINITION, ready);
  if (start.nodeId !== targetNode) throw new Error(`expected to compose ${targetNode}, got ${start.nodeId}`);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config: GameSetupConfig = wave5Scenario(start.scenarioId, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: log.modes,
  });
  const created = createGame(
    {
      ...config,
      encounterDeck: [...config.encounterDeck, ...cardsOfComposedSets(WAVE5_CARDS, start.encounterSets.deck)],
      setAside: [...(config.setAside ?? []), ...cardsOfComposedSets(WAVE5_CARDS, start.encounterSets.setAside)],
      campaign: start.input,
    },
    WAVE5_DEPS,
  );
  if (!created.ok) throw new Error(`${targetNode}: setup failed: ${created.error.message}`);
  return settle(created.state, pick, (state) => state.step.phase === "player", WAVE5_DEPS);
}

/** Every instance of `code` currently in play (`villainArea`, or attached to something in play). */
const inPlayInstancesOf = (state: GameState, code: string): readonly InstanceId[] =>
  instancesOf(state, code).filter((id) => cardsInPlay(state).includes(id));

/**
 * Attaches a set-aside/deck copy of Snitches Get Stitches (181) to Venom by test surgery, if the campaign's own
 * random encounter draw hasn't already revealed and attached it on its own — `shuffleSmearAndSnitches` only
 * shuffles the card into the encounter deck; whether it's drawn before this test's own moment is the encounter
 * deck's business, not this test's (`wave5/spdr/obligation-nemesis.test.ts`'s own "no shared file to import a
 * helper from" precedent for this kind of one-off surgery).
 */
function attachSnitches(state: GameState, venom: InstanceId): { readonly state: GameState; readonly id: InstanceId } {
  const already = instancesOf(state, "27181").find((i) => state.instances[i]?.attachedTo === venom);
  if (already) return { state, id: already };
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const id = instancesOf(state, "27181").find((i) => !cardsInPlay(state).includes(i));
  if (!id) throw new Error("no Snitches Get Stitches instance to attach anywhere in this game");
  const venomInstance = state.instances[venom]!;
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
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: venom },
        [venom]: { ...venomInstance, attachments: [...venomInstance.attachments, id] },
      },
    },
  };
}

describe("Snitches Get Stitches (181, real campaign game — mysterio, node 2)", () => {
  const mysteriosGame = () => realGame(logAt(2), "mysterio");

  it("MC27 p. 4/p. 13: Venom is in play (put there by the campaign's own setup)", () => {
    const state = mysteriosGame();
    expect(inPlayInstancesOf(state, "27190")).toHaveLength(1);
  });

  it("27181.snitches-get-stitches-constant: unattached (test surgery, off the board entirely), it has surge; attached, it does not", () => {
    const state = mysteriosGame();
    const venom = inPlayInstancesOf(state, "27190")[0]!;
    const { state: withSnitches, id: snitches } = attachSnitches(state, venom);
    expect(hasKeyword(withSnitches, snitches, "surge", WAVE5_DEPS)).toBe(false);
    const detached = {
      ...withSnitches,
      instances: { ...withSnitches.instances, [snitches]: { ...withSnitches.instances[snitches]!, attachedTo: null } },
    };
    expect(hasKeyword(detached, snitches, "surge", WAVE5_DEPS)).toBe(true);
  });

  it("27181.snitches-get-stitches-forced-interrupt: a villain attack is redirected to Venom, and defeating him there sends both Venom and Snitches Get Stitches to the victory display", () => {
    const state = mysteriosGame();
    const venom = inPlayInstancesOf(state, "27190")[0]!;
    const { state: withSnitches, id: snitches } = attachSnitches(state, venom);
    // Not granted yet: the "victory" keyword is scoped to the redirected attack itself (`gainKeywordUntil(…,
    // "endOfAttack")`), not standing while merely attached — the printed "if *that* attack defeats Venom" read
    // literally.
    expect(hasKeyword(withSnitches, venom, "victory", WAVE5_DEPS)).toBe(false);
    const overkilled = patchInstance(withSnitches, venom, { damage: 999 }); // any villain attack now defeats Venom.
    // The villain phase begins only once every seat's own turn ends (two seats in this real campaign game).
    const after = settle(runWave5(asHero(overkilled), endTurn(P1), endTurn(P2)), firstLegal, undefined, WAVE5_DEPS);
    expect(after.victoryDisplay).toContain(venom);
    // Snitches Get Stitches itself joins Venom there too: its own printed "Victory -1." is now a real
    // `keywords: [{ name: "victory", value: -1 }]` (503fbcff), so RRG 1.8 "Victory X"'s ordinary "an attachment
    // with the keyword follows its defeated host" routing (`effects.ts` `defeatFromPlay`) does the rest.
    expect(after.victoryDisplay).toContain(snitches);
  });

  it("27181.snitches-get-stitches-action: exhaust Venom and spend 2 resources of the same type to discard this card", () => {
    const state = mysteriosGame();
    const venom = inPlayInstancesOf(state, "27190")[0]!;
    const { state: withSnitches, id: snitches } = attachSnitches(state, venom);
    const readiedVenom = patchInstance(withSnitches, venom, { exhausted: false });
    // Ghost Kick (27002): resourceIcons.physical 1, deckLimit 3 — two copies are the same [physical] type.
    const { state: withHand, ids } = moveToHand(readiedVenom, P1, "27002", "27002");
    const after = settle(
      runWith(
        WAVE5_DEPS,
        withHand,
        use(
          P1,
          snitches,
          "27181.snitches-get-stitches-action",
          ids.map((id) => ({ fromHand: id })),
          {
            exhausted: [venom],
          },
        ),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, venom).exhausted).toBe(true);
    expect(cardsInPlay(after)).not.toContain(snitches);
    expect(after.victoryDisplay).not.toContain(snitches); // discarded, not defeated: no Victory X routing here.
  });
});
