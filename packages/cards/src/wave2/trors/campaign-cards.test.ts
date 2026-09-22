/**
 * The Hydra Campaign cards scripted in `campaign-cards.ts` (design §6.2, §11 step 8): the four TECH upgrades'
 * removal from the campaign log, the four Basic/Improved Condition upgrades (both faces each), Zola's Algorithm
 * and Medical Emergency. Each test proves the printed text: the in-game effect resolves, and — for a card that
 * prints "remove it from the campaign log" — the write lands in `GameState.campaignWrites` and a rebuilt deck
 * naming that card is refused by `validateDeck` afterward through the campaign context.
 *
 * Martial Law (04165) and Anti-Hero Propaganda (04166) are not here — see `campaign-cards.ts`'s own docblock and
 * `wave2/coverage.test.ts`'s `KNOWN_SKIPPED.trors` for the content-data gap blocking them.
 */
import { campaignId, cardId, WAVE2_CARDS, type CardId, type DeckContents } from "@mc/content";
import {
  cardsInPlay,
  characterProfile,
  validateDeck,
  type CampaignGameInput,
  type DeckContext,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { wave2Scenario, wave2StarterDeckSetup } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

// --- building a game with specific Hydra Campaign cards in a player's deck -------------------------------------

const HAWKEYE = wave2StarterDeckSetup("hawkeye-leadership");
const HAWKEYE_ASPECTS = HAWKEYE.aspects ?? [];

/**
 * A minimal `CampaignGameInput` — just enough for `GameState.campaign` to be truthy (design §6.1: `removeFromCampaign`
 * is a no-op outside a campaign game, `packages/engine/src/resolve/campaign.ts`). No real box's own instructions are
 * exercised here — that's `campaigns/trors.test.ts`'s job.
 */
function campaignInputFor(identityCardId: CardId): CampaignGameInput {
  return {
    campaignId: campaignId("trors"),
    nodeId: "campaign-cards-test",
    definitionVersion: "1",
    modes: {},
    log: { shared: {}, perSeat: [] },
    instructions: [],
    removedFromCampaign: [],
    seats: [{ seatNumber: 1, identityCardId, deck: [], aspects: [], grantedCardIds: [] }],
    seed: 1,
  };
}

/**
 * The Hawkeye (Leadership) precon plus `extra` cards, against `scenarioId`. `requireLegalDecks: false`: `createGame`
 * always judges a deck with no `DeckContext` (`packages/engine/src/setup.ts`), so a campaign-specific or obligation
 * card in `extra` would otherwise refuse setup outright — legality against the *campaign* context is this file's
 * own `expectRemovedFromCampaign`'s job (`validateDeck` called directly, with the context these cards actually need).
 */
function deckConfig(scenarioId: string, extra: readonly string[], seed: number): GameSetupConfig {
  return {
    ...wave2Scenario(scenarioId, {
      players: [
        { identityCardId: HAWKEYE.identityCardId, aspects: HAWKEYE_ASPECTS, deck: [...HAWKEYE.deck, ...extra] },
      ],
      seed,
    }),
    requireLegalDecks: false,
  };
}

/** `deckConfig`, with `GameState.campaign` set — for the TECH upgrades, whose text touches the campaign log. */
function campaignConfig(scenarioId: string, extra: readonly string[], seed = 2026): GameSetupConfig {
  return { ...deckConfig(scenarioId, extra, seed), campaign: campaignInputFor(HAWKEYE.identityCardId) };
}

/**
 * Moves an instance already in a player's hand or deck straight into their play area — test-only surgery for a card
 * MC10 p. 17 says enters play the moment it is drawn ("Obligations in Player Decks"), a card-type rule outside this
 * task's scope (`campaign-cards.ts`'s own docblock). Nothing here depends on *how* the card reached play, only on
 * what its own ability does once it is there — the same principle `taskmaster.test.ts`'s Hydra Hunter surgery uses.
 */
function putIntoPlayArea(
  state: GameState,
  player: PlayerId,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const id = [...owner.hand, ...owner.deck].find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`${player} has no ${code} in hand or deck`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: p.hand.filter((h) => h !== id),
              deck: p.deck.filter((h) => h !== id),
              playArea: [...p.playArea, id],
            }
          : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true } },
    },
  };
}

/**
 * A hand card whose printed resource icons can pay a `type` cost (a wild icon pays any type), as the instance id a
 * `useAbility` command's `payment` needs. Directly-commanded Actions price their payment up front (`actions.ts`
 * `useAbility`), unlike a triggered ability's own follow-up `payForAbility` choice (docs/phase7-wave2-scripting.md's
 * note on Mockingbird's interrupt) — so the obligations' typed "spend a [mental]/[physical] resource" costs need a
 * matching card *named* in the command, not merely picked off a later prompt.
 */
function payTyped(state: GameState, player: PlayerId, type: "mental" | "physical" | "energy"): InstanceId {
  for (const id of playerOf(state, player).hand) {
    const card = WAVE2_CARDS.find((c) => c.id === state.instances[id]!.cardId);
    const icons = card && "resourceIcons" in card ? card.resourceIcons : undefined;
    if (icons && ((icons[type] ?? 0) > 0 || (icons.wild ?? 0) > 0)) return id;
  }
  throw new Error(`${player} has no hand card that can pay a ${type} resource`);
}

/**
 * Engages an already-instantiated minion (from the scenario's own encounter set, e.g. `04101` Hydra Hunter in the
 * Taskmaster scenario — `taskmaster.test.ts`'s own precedent) with `player` — test-only surgery for a minion a real
 * reveal would put into play. A minion's play zone is the *engaged player's* `playArea` (`resolve/reveal.ts`'s own
 * `case "minion"`), **not** `GameState.villainArea` (side schemes/environments only) — `checkDefeats`
 * (`resolve/defeat.ts`) only sweeps `player.playArea` for ally/minion defeat, so a minion staged in `villainArea`
 * by mistake would take damage but never be recognized as defeated.
 */
function engageMinion(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const found = Object.values(state.instances).find((i) => i.cardId === cardId(code));
  if (!found) throw new Error(`no ${code} instance exists yet`);
  return {
    id: found.instanceId,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...p.playArea, found.instanceId] } : p,
      ),
      instances: { ...state.instances, [found.instanceId]: { ...found, faceup: true, engagedWith: player } },
    },
  };
}

const inHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave2(state, toHero());
const inAlterEgo = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "alterEgo" ? state : runWave2(state, toHero());

// --- Hydra Campaign TECH upgrades (04155-04158): Setup. Hero Action: Discard this card and remove it from the ----
// --- campaign log → <effect>. ------------------------------------------------------------------------------------

describe("Hydra Campaign TECH upgrades: Hero Action discards, removes from the campaign log, then resolves", () => {
  /**
   * A TECH upgrade also carries the "Setup" keyword (`campaign-cards.ts`'s own comment on `.setup-keyword`), so it
   * is already in play — attached to the identity, the way `setup-steps.ts`'s `putSetupCardsIntoPlay` puts every
   * setup-keyword *upgrade* (as opposed to a bare `playArea` card) — the instant `startWave2Game` returns; nothing
   * needs to be drawn or played.
   */
  function playedTech(
    code: string,
    scenarioId = "rhino",
    seed = 2026,
  ): { readonly state: GameState; readonly id: InstanceId } {
    const state = inHero(startWave2Game(campaignConfig(scenarioId, [code], seed)));
    const identity = identityOf(state);
    const id = inst(state, identity).attachments.find((i) => state.instances[i]?.cardId === cardId(code));
    if (!id) throw new Error(`${code} did not enter play, attached to the identity, at setup`);
    return { state, id };
  }

  /**
   * After using a TECH upgrade's Hero Action: the card left play, the removal landed in `GameState.campaignWrites`
   * (RRG 1.8 p. 29), and a fresh deck line naming it is refused by `validateDeck` through the campaign context
   * (ruling April 30, 2026 (4): a removal is by card face — this card has only one).
   */
  function expectRemovedFromCampaign(state: GameState, code: string): void {
    expect(cardsInPlay(state).some((id) => state.instances[id]?.cardId === cardId(code))).toBe(false);
    const removed = state.campaignWrites?.removedFromCampaign ?? [];
    expect(removed).toEqual([{ cardId: cardId(code) }]);
    const deck: DeckContents = {
      identityCardId: HAWKEYE.identityCardId,
      aspects: HAWKEYE_ASPECTS,
      cards: [{ cardId: cardId(code), quantity: 1 }],
    };
    const context: DeckContext = {
      campaign: {
        campaignId: "trors",
        campaignSetIds: ["hydra_camp"],
        identityCardId: HAWKEYE.identityCardId,
        grantedCardIds: [cardId(code)],
        removedFromCampaign: removed,
      },
    };
    const verdict = validateDeck(deck, WAVE2_CARDS, context);
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.problems.map((p) => p.code)).toContain("campaign_removed_card");
  }

  it("Adrenal Stims (04155): readies your hero and heals 5 damage from them", () => {
    const { state, id } = playedTech("04155");
    const identity = identityOf(state);
    const damaged = patchInstance(patchInstance(state, identity, { damage: 5 }), identity, { exhausted: true });
    const used = runWave2(damaged, use(P1, id, "04155.adrenal-stims-action"));
    expect(inst(used, identity).damage).toBe(0);
    expect(inst(used, identity).exhausted).toBe(false);
    expectRemovedFromCampaign(used, "04155");
  });

  it("Tactical Scanner (04156): draws 5 cards", () => {
    const { state, id } = playedTech("04156");
    const before = playerOf(state, P1).hand.length;
    const used = runWave2(state, use(P1, id, "04156.tactical-scanner-action"));
    expect(playerOf(used, P1).hand.length).toBe(before + 5);
    expectRemovedFromCampaign(used, "04156");
  });

  it("Emergency Teleporter (04157): searches deck and discard for an ally, puts it into play, gives it tough", () => {
    const { state, id } = playedTech("04157");
    const used = settle(
      runWave2(state, use(P1, id, "04157.emergency-teleporter-action")),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    const ally = playerOf(used, P1).playArea.find((i) => {
      const card = WAVE2_CARDS.find((c) => c.id === used.instances[i]!.cardId);
      return card?.type === "ally";
    });
    expect(ally).toBeDefined();
    expect(inst(used, ally!).statuses.tough).toBeGreaterThan(0);
    expectRemovedFromCampaign(used, "04157");
  });

  it("Laser Cannon (04158): deals 5 damage to the villain and each enemy engaged with you", () => {
    const { state, id } = playedTech("04158", "taskmaster");
    const hydraHunter = engageMinion(state, "04101");
    const villainBefore = inst(hydraHunter.state, hydraHunter.state.villains[0]!.instanceId).damage;
    const used = runWave2(hydraHunter.state, use(P1, id, "04158.laser-cannon-action"));
    expect(inst(used, used.villains[0]!.instanceId).damage).toBe(villainBefore + 5);
    // Hydra Hunter's printed hp is 3: 5 damage overkills and defeats it (RRG 1.8 "Defeat"), so it leaves play
    // rather than showing 5 damage on a surviving instance.
    expect(playerOf(used, P1).playArea).not.toContain(hydraHunter.id);
    expectRemovedFromCampaign(used, "04158");
  });
});

// --- Basic/Improved Condition upgrades (04159-04162): Permanent. Setup. You get +N hit points. Your hero gets ----
// --- +1 [STAT]. [Improved only:] Response: After <trigger>, exhaust this card → draw 1 card. ----------------------

/**
 * Enters play through the generic RRG 1.8 Appendix II step 11 sweep (every "Setup"-keyword card in a player's
 * deck; `setup-steps.ts`'s `putSetupCardsIntoPlay`) — the same mechanism MC10 p. 7 restates for these cards
 * (`campaign-cards.ts`'s own comment on `.setup-keyword`), **attached to the identity** (an upgrade, not a bare
 * `playArea` card — the same mechanism `playedTech` above uses). No campaign context or play cost needed.
 */
function withConditionUpgrade(
  code: string,
  scenarioId = "rhino",
  seed = 2026,
): { readonly state: GameState; readonly id: InstanceId } {
  const started = startWave2Game(deckConfig(scenarioId, [code], seed));
  const identity = identityOf(started);
  const id = inst(started, identity).attachments.find((i) => started.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`${code} did not enter play at setup`);
  return { state: started, id };
}

describe("Basic Thwart Upgrade (04159a) / Improved Thwart Upgrade (04159b)", () => {
  it("Basic face: +2 hit points, +1 THW (in hero form)", () => {
    const { state } = withConditionUpgrade("04159a");
    const hero = inHero(state);
    const profile = characterProfile(hero, identityOf(hero), WAVE2_DEPS)!;
    expect(profile.maxHp).toBe(11); // Hawkeye's printed 9 + 2
    expect(profile.thw).toBe(2); // printed 1 + 1
  });

  it("Improved face (flipped): the same bonuses, plus Response: After you defeat a side scheme, exhaust → draw 1", () => {
    const { state, id } = withConditionUpgrade("04159a", "crossbones", 5);
    const flipped = { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, flipped: true } } };
    const profile = characterProfile(inHero(flipped), identityOf(flipped), WAVE2_DEPS)!;
    expect(profile.maxHp).toBe(11);
    expect(profile.thw).toBe(2);

    // Crossbones' Assault (04070) reveals as the scenario's own side scheme (`crossbones.test.ts`'s own setup).
    const stacked = stackEncounterDeck(flipped, "01186", "04070");
    const hero = runWave2(stacked, toHero());
    const revealed = settle(runWave2(hero, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const scheme = instancesOf(revealed, "04070").find((i) => cardsInPlay(revealed).includes(i))!;
    const identity = identityOf(revealed);
    const ready = patchInstance(patchInstance(revealed, scheme, { threat: 1 }), identity, { exhausted: false });
    const handBefore = playerOf(ready, P1).hand.length;
    const thwarted = settle(
      runWave2(ready, { type: "basicThwart", playerId: P1, thwarterInstanceId: identity, schemeInstanceId: scheme }),
      (s) => {
        const option = `${id}:04159b.improved-thwart-upgrade-response`;
        if (s.pendingChoice?.options.some((o) => o.optionId === option)) return [option];
        return firstLegal(s);
      },
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(thwarted, id).exhausted).toBe(true);
    expect(playerOf(thwarted, P1).hand.length).toBe(handBefore + 1);
  });
});

describe("Basic Attack Upgrade (04160a) / Improved Attack Upgrade (04160b)", () => {
  it("Basic face: +1 hit point, +1 ATK (in hero form)", () => {
    const { state } = withConditionUpgrade("04160a");
    const hero = inHero(state);
    const profile = characterProfile(hero, identityOf(hero), WAVE2_DEPS)!;
    expect(profile.maxHp).toBe(10); // 9 + 1
    expect(profile.atk).toBe(3); // printed 2 + 1
  });

  it("Improved face (flipped): the same bonuses, plus Hero Response: After you defeat a minion, exhaust → draw 1", () => {
    const { state, id } = withConditionUpgrade("04160a", "taskmaster", 2026);
    const flipped = { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, flipped: true } } };
    const profile = characterProfile(inHero(flipped), identityOf(flipped), WAVE2_DEPS)!;
    expect(profile.maxHp).toBe(10);
    expect(profile.atk).toBe(3);

    const hero = inHero(flipped);
    const hydraHunter = engageMinion(hero, "04101");
    const handBefore = playerOf(hydraHunter.state, P1).hand.length;
    // Not `defeatWithAttack` (`testing/staging.ts`): it settles every pending choice with `firstLegal` internally,
    // which would decline the Response's own `chooseTriggers` offer (optional) before this test's own picker ever
    // saw it — the same trap `docs/card-scripting-process.md` §7's "vacuous assertion" warning is about.
    const near = patchInstance(hydraHunter.state, hydraHunter.id, { damage: 999 });
    const identity = identityOf(near);
    const attacked = runWave2(near, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: hydraHunter.id,
    });
    const defeated = settle(
      attacked,
      (s) => {
        const option = `${id}:04160b.improved-attack-upgrade-response`;
        if (s.pendingChoice?.options.some((o) => o.optionId === option)) return [option];
        return firstLegal(s);
      },
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(defeated, id).exhausted).toBe(true);
    expect(playerOf(defeated, P1).hand.length).toBe(handBefore + 1);
  });
});

describe("Basic Defense Upgrade (04161a) / Improved Defense Upgrade (04161b)", () => {
  it("Basic face: +3 hit points, +1 DEF (in hero form)", () => {
    const { state } = withConditionUpgrade("04161a");
    const hero = inHero(state);
    const profile = characterProfile(hero, identityOf(hero), WAVE2_DEPS)!;
    expect(profile.maxHp).toBe(12); // 9 + 3
    expect(profile.def).toBe(2); // printed 1 + 1
  });

  it("Improved face (flipped): the same bonuses, plus Hero Response: After you defend against an attack, exhaust → draw 1", () => {
    // Seed 1: Rhino attacks (rather than schemes) on the very first villain phase (`hawkeye.test.ts`'s own note).
    const { state, id } = withConditionUpgrade("04161a", "rhino", 1);
    const flipped = { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, flipped: true } } };
    const profile = characterProfile(inHero(flipped), identityOf(flipped), WAVE2_DEPS)!;
    expect(profile.maxHp).toBe(12);
    expect(profile.def).toBe(2);

    const hero = inHero(flipped);
    const identity = identityOf(hero);
    const reached = settle(
      runWave2(hero, endTurn()),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE2_DEPS,
    );
    const defending = answer(reached, [identity], WAVE2_DEPS);
    const handBefore = playerOf(defending, P1).hand.length;
    const defended = settle(
      defending,
      (s) => {
        const option = `${id}:04161b.improved-defense-upgrade-response`;
        if (s.pendingChoice?.options.some((o) => o.optionId === option)) return [option];
        return firstLegal(s);
      },
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(defended, id).exhausted).toBe(true);
    expect(playerOf(defended, P1).hand.length).toBe(handBefore + 1);
  });
});

describe("Basic Recovery Upgrade (04162a) / Improved Recovery Upgrade (04162b)", () => {
  it("Basic face: +4 hit points, +1 REC (alter-ego)", () => {
    const { state } = withConditionUpgrade("04162a");
    const alterEgo = inAlterEgo(state);
    const profile = characterProfile(alterEgo, identityOf(alterEgo), WAVE2_DEPS)!;
    expect(profile.maxHp).toBe(13); // 9 + 4
    expect(profile.rec).toBe(4); // printed 3 + 1
  });

  it("Improved face (flipped): the same bonuses, plus Response: After you use your REC, exhaust → draw 1", () => {
    const { state, id } = withConditionUpgrade("04162a");
    const flipped = { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, flipped: true } } };
    const alterEgo = inAlterEgo(flipped);
    const profile = characterProfile(alterEgo, identityOf(alterEgo), WAVE2_DEPS)!;
    expect(profile.maxHp).toBe(13);
    expect(profile.rec).toBe(4);

    const identity = identityOf(alterEgo);
    const damaged = patchInstance(alterEgo, identity, { damage: 5, exhausted: false });
    const handBefore = playerOf(damaged, P1).hand.length;
    const recovered = settle(
      runWave2(damaged, { type: "basicRecover", playerId: P1 }),
      (s) => {
        const option = `${id}:04162b.improved-recovery-upgrade-response`;
        if (s.pendingChoice?.options.some((o) => o.optionId === option)) return [option];
        return firstLegal(s);
      },
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(recovered, id).exhausted).toBe(true);
    expect(playerOf(recovered, P1).hand.length).toBe(handBefore + 1);
  });
});

// --- Zola's Algorithm (04163) and Medical Emergency (04164) -------------------------------------------------------

describe("Zola's Algorithm (04163)", () => {
  it("Alter-Ego Action: exhaust your alter-ego and spend a [mental] resource → discard this card", () => {
    const started = startWave2Game(deckConfig("rhino", ["04163"], 2026));
    const alterEgo = inAlterEgo(started);
    // Hawkeye's Bow (04002, wild icon, already in the starter deck) pays the typed cost below.
    const inHand = moveToHand(alterEgo, P1, "04163", "04002");
    const [zola] = inHand.ids as [InstanceId, InstanceId];
    const placed = putIntoPlayArea(inHand.state, P1, "04163");
    expect(placed.id).toBe(zola);
    const payment = payTyped(placed.state, P1, "mental");
    const identity = identityOf(placed.state);
    expect(inst(placed.state, identity).exhausted).toBe(false);
    const used = runWave2(placed.state, use(P1, zola, "04163.obligation", [{ fromHand: payment }]));
    expect(inst(used, identity).exhausted).toBe(true);
    expect(used.players.find((p) => p.playerId === P1)!.playArea).not.toContain(zola);
  });
});

describe("Medical Emergency (04164)", () => {
  it("Forced Response: at the end of your turn, take 1 damage if you are in hero form", () => {
    const started = startWave2Game(deckConfig("rhino", ["04164"], 2026));
    const hero = inHero(started);
    const inHand = moveToHand(hero, P1, "04164");
    const placed = putIntoPlayArea(inHand.state, P1, "04164");
    const identity = identityOf(placed.state);
    const before = inst(placed.state, identity).damage;
    // Not `settle(..., firstLegal, ...)`: that would decline "declare a defender" against Rhino's own following
    // villain-phase attack and let it resolve, adding damage this test isn't about. The forced response resolves
    // synchronously as part of the `endTurn` command itself (it is forced, so it needs no `chooseTriggers` pick).
    const ended = runWave2(placed.state, endTurn());
    expect(inst(ended, identity).damage).toBe(before + 1);
  });

  it("does not damage an alter-ego at the end of their turn", () => {
    const started = startWave2Game(deckConfig("rhino", ["04164"], 2026));
    const alterEgo = inAlterEgo(started);
    const inHand = moveToHand(alterEgo, P1, "04164");
    const placed = putIntoPlayArea(inHand.state, P1, "04164");
    const identity = identityOf(placed.state);
    const before = inst(placed.state, identity).damage;
    const ended = runWave2(placed.state, endTurn());
    expect(inst(ended, identity).damage).toBe(before);
  });

  it("Alter-Ego Action: discard the top 5 cards of your deck and spend a [physical] resource → discard this card", () => {
    const started = startWave2Game(deckConfig("rhino", ["04164"], 2026));
    const alterEgo = inAlterEgo(started);
    // Hawkeye's Bow (04002, wild icon, already in the starter deck) pays the typed cost below.
    const inHand = moveToHand(alterEgo, P1, "04164", "04002");
    const [medical] = inHand.ids as [InstanceId, InstanceId];
    const placed = putIntoPlayArea(inHand.state, P1, "04164");
    expect(placed.id).toBe(medical);
    const deckBefore = playerOf(placed.state, P1).deck.length;
    const discardBefore = playerOf(placed.state, P1).discard.length;
    const payment = payTyped(placed.state, P1, "physical");
    const used = runWave2(placed.state, use(P1, medical, "04164.medical-emergency-action", [{ fromHand: payment }]));
    expect(playerOf(used, P1).deck.length).toBe(deckBefore - 5);
    // 5 milled + Medical Emergency itself + the payment card (spending a resource discards the card spent).
    expect(playerOf(used, P1).discard.length).toBe(discardBefore + 5 + 1 + 1);
    expect(used.players.find((p) => p.playerId === P1)!.playArea).not.toContain(medical);
  });
});
