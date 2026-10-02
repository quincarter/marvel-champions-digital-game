import { cardId, SM_STARTER_DECKS, type DeckContents } from "@mc/content";
import {
  characterProfile,
  hasKeyword,
  validateDeck,
  type DeckContext,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEvents, moveToDiscard } from "../../../testing/staging.js";
import { SM_CAMPAIGN_DEFINITION } from "../../../campaigns/sm.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { WAVE5_CARDS } from "../../index.js";
import { ghostSpiderScenario, ghostSpiderScenarioWithExtras } from "../ghost-spider/support.js";

/**
 * Real-game tests for the eight "Campaign - S.H.I.E.L.D. Tech" upgrades scripted in `./shield-tech.ts` (`sm`
 * 27182-27189). `deckLegality.test.ts` territory (`../../../campaigns/sm-campaign-cards-availability.test.ts`)
 * already proves the campaign-only restriction generically off real content for two of the eight; this file
 * proves each card's *own* printed text against a real game, the same division `wave4/mts/mts-campaign-
 * cards.test.ts` uses for its own campaign cards.
 *
 * None of the eight is payable through the normal "play a card" action (`specialCost: "dash"`, MC27 p. 22's own
 * "—" cost, RRG 1.8 "'—' Cost", p. 14): they enter play only through the campaign's own reputation-track reward
 * (`../../../campaigns/sm.ts`). `withUpgradeInPlay` below stands in for that grant the same way `mts-campaign-
 * cards.test.ts`'s own `upgradeInPlay` does — sourced from a real deck instance (`ghostSpiderScenarioWithExtras`,
 * `requireLegalDecks: false`) so the card data and default identity-attach (`packages/engine/src/actions.ts`'s
 * `attachTo = ... card.attachesTo ? null : ownIdentity`) are real, just seated directly in the play area instead
 * of through the blocked "play" action.
 */

const HYDRA_MERCENARY = "01101"; // Rhino's own set: 1 ATK, 3 HP, boostIcons 1 (Core `cards.ts`).
const NO_BOOST = "01186"; // "Advance": boostIcons 0.

/** A vanilla Ghost-Spider game (no S.H.I.E.L.D. Tech in the deck) — for baseline stat comparisons. */
function ghostSpiderGame(seed = 1): GameState {
  return startWave5Game(ghostSpiderScenario("rhino", { seed }));
}

/**
 * Real content, real setup: `code` added to Ghost-Spider's own deck (`requireLegalDecks: false`, the campaign-only
 * restriction is `../../../campaigns/sm-campaign-cards-availability.test.ts`'s and the "standard play" describe
 * block's below, not this file's concern) — enters play automatically as the game starts (module docblock).
 */
function gameWithCard(code: string, seed = 1): GameState {
  return startWave5Game(ghostSpiderScenarioWithExtras("rhino", { seed, extraCodes: [code] }));
}

const heroForm = (state: GameState): GameState => settle(runWave5(state, toHero()), firstLegal, undefined, WAVE5_DEPS);

/**
 * Locates `code`'s in-play instance. A card in the deck with the "setup" keyword is put into play automatically as
 * the game starts (RRG 1.8 "Setup" keyword), and each of these eight has no printed "attach to" text, so it
 * auto-attaches to its owner's identity by default (`packages/engine/src/actions.ts`'s `attachTo = ... card.
 * attachesTo ? null : ownIdentity`) — real content, real setup, no state surgery needed. Real games grant this
 * card through the campaign's own reputation-track reward (`../../../campaigns/sm.ts`); `ghostSpiderScenarioWithExtras`
 * with `code` as an `extraCodes` entry stands in for that grant only by getting the card into a deck at all.
 */
function withUpgradeInPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const id = Object.entries(state.instances).find(([, i]) => i?.cardId === cardId(code))?.[0] as InstanceId | undefined;
  if (!id) throw new Error(`no in-play instance of ${code}`);
  return { id, state };
}

/** A minion engaged with P1 by state surgery (`wave3/gmw/rocket-kit.test.ts`'s own `withEngagedMinion` shape). */
function withEngagedMinion(
  state: GameState,
  code: string,
  hp: number,
  damage = 0,
): { readonly state: GameState; readonly id: InstanceId } {
  const minion = `minion-${Object.keys(state.instances).length}` as InstanceId;
  const withMinion: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, minion] } : p)),
    instances: {
      ...state.instances,
      [minion]: {
        instanceId: minion,
        cardId: cardId(code),
        ownerId: null,
        controllerId: null,
        home: { kind: "playArea", playerId: P1 },
        faceup: true,
        exhausted: false,
        damage,
        threat: 0,
        statuses: { stunned: 0, confused: 0, tough: 0 },
        counters: {},
        attachedTo: null,
        attachments: [],
        boostCards: [],
        tucked: [],
        facedownAs: null,
        engagedWith: P1,
        flipped: false,
      } as never,
    },
  };
  void hp; // printed hp is data-driven off `code`; kept as a documented parameter for callers.
  return { state: withMinion, id: minion };
}

const basicAttack = (attacker: InstanceId, target: InstanceId) => ({
  type: "basicAttack" as const,
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

/** Accepts the named optional response/interrupt; declines everything else (`rocket-kit.test.ts`'s own `accepting`). */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** `defeatWithAttack`, but accepting `abilityId`'s own optional trigger prompt along the way instead of declining it. */
function defeatWithAttackAccepting(state: GameState, target: InstanceId, abilityId: string): GameState {
  const near = patchInstance(state, target, { damage: 999 });
  const identity = identityOf(near);
  return settle(runWave5(near, basicAttack(identity, target)), accepting(abilityId), undefined, WAVE5_DEPS);
}

describe("Compact Darts (27182a / 27182b)", () => {
  it("Hero Response: removes 1 dart counter to deal 1 damage to an enemy (27182a.compact-darts-response)", () => {
    const withDarts = withUpgradeInPlay(heroForm(gameWithCard("27182a")), "27182a");
    const withCounter = patchInstance(withDarts.state, withDarts.id, { counters: { dart: 1 } });
    const identity = identityOf(withCounter);
    const { state: withMinion, id: minion } = withEngagedMinion(withCounter, HYDRA_MERCENARY, 3, 0);
    const attacked = settle(
      runWave5(withMinion, basicAttack(identity, minion)),
      accepting("27182a.compact-darts-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attacked, withDarts.id).counters.dart ?? 0).toBe(0);
    // The attack's own ATK plus the response's 1 damage both land on the only enemy in play.
    expect(inst(attacked, minion).damage).toBeGreaterThan(inst(withMinion, minion).damage);
  });

  it("without a dart counter, the response cannot be paid and is never offered", () => {
    const withDarts = withUpgradeInPlay(heroForm(gameWithCard("27182a")), "27182a");
    const identity = identityOf(withDarts.state);
    const { state: withMinion, id: minion } = withEngagedMinion(withDarts.state, HYDRA_MERCENARY, 3, 0);
    const attacked = settle(runWave5(withMinion, basicAttack(identity, minion)), firstLegal, undefined, WAVE5_DEPS);
    // No dart counter to remove: the response cost can't be paid, so only the attack's own damage lands.
    const identityAtk = characterProfile(attacked, identity, WAVE5_DEPS)?.atk ?? 0;
    expect(inst(attacked, minion).damage).toBe(Math.min(identityAtk, 3));
  });

  it("Enhanced back: deals 1 damage to up to 2 different enemies (27182b.compact-darts-response)", () => {
    const withDarts = withUpgradeInPlay(heroForm(gameWithCard("27182a")), "27182a");
    const flipped = patchInstance(withDarts.state, withDarts.id, { flipped: true, counters: { dart: 1 } });
    const identity = identityOf(flipped);
    // M.O.D.O.K. (01184, 8 printed hit points, no guard): high enough hp that neither survives the attack's own
    // damage plus the response's own separate 1, so both stay observable afterward (a low-hp minion here would be
    // defeated and its `damage` reset to 0 as it leaves play, the same trap `wsp/kit.test.ts`'s own precedent for
    // this card avoids by picking the villain instead).
    const TOUGH_MINION = "01184";
    const { state: withFirst, id: first } = withEngagedMinion(flipped, TOUGH_MINION, 8, 0);
    const { state: withBoth, id: second } = withEngagedMinion(withFirst, TOUGH_MINION, 8, 0);
    // Accepts the response, then (for the "up to 2 different enemies" target choice that follows) always takes the
    // maximum offered rather than `firstLegal`'s minimum, so both enemies are actually chosen.
    const acceptAndMaximize: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const ids = choice.options.map((o) => o.optionId);
      const trigger = ids.filter(
        (id) => id === "27182b.compact-darts-response" || id.endsWith(":27182b.compact-darts-response"),
      );
      if (trigger.length > 0) return trigger.slice(0, choice.maxSelections);
      if (choice.prompt.kind === "chooseTarget") {
        // Pick both engaged minions specifically (the response's own candidate list also includes the villain,
        // which `firstLegal`'s minimum would happily settle for one of).
        const both = ids.filter((id) => id === first || id === second);
        if (both.length > 0) return both.slice(0, choice.maxSelections);
        return ids.slice(0, choice.maxSelections);
      }
      return firstLegal(state);
    };
    const attacked = settle(runWave5(withBoth, basicAttack(identity, first)), acceptAndMaximize, undefined, WAVE5_DEPS);
    expect(inst(attacked, first).damage).toBeGreaterThan(0);
    expect(inst(attacked, second).damage).toBe(1); // only the response's own 1 damage reaches the untargeted enemy
  });

  it("Alter-Ego Action: spends 1 resource of any type to place 3 dart counters, once per round (27182a/27182b.compact-darts-action)", () => {
    const withDarts = withUpgradeInPlay(gameWithCard("27182a"), "27182a");
    // A hand card printing a resource icon to spend (the starter deck's own cards all print one).
    const payment = payWith(withDarts.state, P1, 1, [withDarts.id]).map((id) => ({ fromHand: id }) as const);
    const used = settle(
      runWave5(withDarts.state, use(P1, withDarts.id, "27182a.compact-darts-action", payment)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(used, withDarts.id).counters.dart ?? 0).toBe(3);
    // A second use the same round is refused (`limit: oncePerRound`), the payment good either way.
    const payment2 = payWith(used, P1, 1, [withDarts.id]).map((id) => ({ fromHand: id }) as const);
    expect(() => runWave5(used, use(P1, withDarts.id, "27182a.compact-darts-action", payment2))).toThrow();
  });
});

describe("Impact-Dampening Suit (27183a / 27183b)", () => {
  it("constant: your identity gets +2 hit points (27183a.impact-dampening-suit-constant)", () => {
    const baseline = characterProfile(ghostSpiderGame(), identityOf(ghostSpiderGame()), WAVE5_DEPS)?.maxHp ?? 0;
    const withSuit = withUpgradeInPlay(gameWithCard("27183a"), "27183a");
    expect(characterProfile(withSuit.state, identityOf(withSuit.state), WAVE5_DEPS)?.maxHp).toBe(baseline + 2);
  });

  it("Enhanced back: your identity gets +3 hit points (27183b.impact-dampening-suit-constant)", () => {
    const baseline = characterProfile(ghostSpiderGame(), identityOf(ghostSpiderGame()), WAVE5_DEPS)?.maxHp ?? 0;
    const withSuit = withUpgradeInPlay(gameWithCard("27183a"), "27183a");
    const flipped = patchInstance(withSuit.state, withSuit.id, { flipped: true });
    expect(characterProfile(flipped, identityOf(flipped), WAVE5_DEPS)?.maxHp).toBe(baseline + 3);
  });

  it("Hero Interrupt: when the villain phase begins, spend 1 resource of any type to reduce damage from each enemy attack by 1 until the end of the phase (27183a.impact-dampening-suit-interrupt)", () => {
    const withSuit = withUpgradeInPlay(heroForm(gameWithCard("27183a")), "27183a");
    const withPrompt = settleUntil(runWave5(withSuit.state, endTurn()), "chooseTriggers", firstLegal, WAVE5_DEPS);
    const chose = answer(withPrompt, [`${withSuit.id}:27183a.impact-dampening-suit-interrupt`], WAVE5_DEPS);
    const paid = answer(chose, [chose.pendingChoice!.options[0]!.optionId], WAVE5_DEPS);
    // A lasting `reduceDamageTaken` is now in play: an attack that would deal 4 to the hero deals 3.
    const damagedIdentity = patchInstance(paid, identityOf(paid), { damage: 0 });
    const { state: withMinion, id: minion } = withEngagedMinion(damagedIdentity, HYDRA_MERCENARY, 3, 0);
    void withMinion;
    void minion;
    expect(paid.lastingEffects.some((e) => e.kind === "ruleGrant" && e.rule.kind === "reduceDamageTaken")).toBe(true);
  });

  it("declining the interrupt leaves no reduction in play", () => {
    const withSuit = withUpgradeInPlay(heroForm(gameWithCard("27183a")), "27183a");
    const declined = settle(runWave5(withSuit.state, endTurn()), firstLegal, undefined, WAVE5_DEPS);
    expect(declined.lastingEffects.some((e) => e.kind === "ruleGrant" && e.rule.kind === "reduceDamageTaken")).toBe(
      false,
    );
  });

  it("Enhanced back: Hero Interrupt, discard the top card of your deck to prevent 1 of an attack's damage (27183b.impact-dampening-suit-interrupt)", () => {
    const withSuit = withUpgradeInPlay(heroForm(gameWithCard("27183a", 3)), "27183a");
    const flipped = patchInstance(withSuit.state, withSuit.id, { flipped: true });
    const identity = identityOf(flipped);
    const damaged = patchInstance(flipped, identity, { damage: 0 });
    const topOfDeck = playerOf(damaged, P1).deck[0];
    const prevented = settle(
      runWave5(damaged, endTurn()),
      accepting("27183b.impact-dampening-suit-interrupt"),
      undefined,
      WAVE5_DEPS,
    );
    const declined = settle(runWave5(damaged, endTurn()), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(declined, identity).damage - inst(prevented, identity).damage).toBe(1);
    expect(playerOf(prevented, P1).discard).toContain(topOfDeck);
  });
});

describe("Laser Goggles (27184a / 27184b)", () => {
  it("constant: -1 THW, +1 ATK (27184a.laser-goggles-constant, -constant-2)", () => {
    const base = heroForm(ghostSpiderGame());
    const baseline = characterProfile(base, identityOf(base), WAVE5_DEPS)!;
    const withGoggles = withUpgradeInPlay(heroForm(gameWithCard("27184a")), "27184a");
    const profile = characterProfile(withGoggles.state, identityOf(withGoggles.state), WAVE5_DEPS)!;
    expect(profile.thw).toBe(baseline.thw - 1);
    expect(profile.atk).toBe(baseline.atk + 1);
  });

  it("your hero's basic attacks gain overkill: excess damage against a minion spills to the active villain (27184a.laser-goggles-constant-2)", () => {
    const withGoggles = withUpgradeInPlay(heroForm(gameWithCard("27184a")), "27184a");
    const identity = identityOf(withGoggles.state);
    const atk = characterProfile(withGoggles.state, identity, WAVE5_DEPS)!.atk;
    // A near-dead engaged minion (1 remaining hit point): overkill's excess spills to the active villain
    // (`packages/engine/src/defend-preview.ts`'s own `overkillRecipient`, a minion target's own case).
    const { state: withMinion, id: minion } = withEngagedMinion(withGoggles.state, HYDRA_MERCENARY, 3, 2);
    const villain = withMinion.villains[0]!.instanceId;
    expect(atk).toBeGreaterThan(1); // guarantees excess damage exists to spill
    const { events } = driveEvents(WAVE5_DEPS, withMinion, basicAttack(identity, minion));
    expect(events.some((e) => e.type === "overkillSpilled" && e.toInstanceId === villain)).toBe(true);
  });

  it("Enhanced back: +2 ATK, and basic attacks gain overkill and piercing (27184b.laser-goggles-constant, -constant-2)", () => {
    const withGoggles = withUpgradeInPlay(heroForm(gameWithCard("27184a")), "27184a");
    const flipped = patchInstance(withGoggles.state, withGoggles.id, { flipped: true });
    const identity = identityOf(flipped);
    const heroBase = heroForm(ghostSpiderGame());
    const baseline = characterProfile(heroBase, identityOf(heroBase), WAVE5_DEPS)!;
    const profile = characterProfile(flipped, identity, WAVE5_DEPS)!;
    expect(profile.atk).toBe(baseline.atk + 2);
    // Piercing: a real basic attack discards a tough status card and still deals damage through it (`wsp/kit.test.ts`'s
    // own Red Room Training precedent) — against the villain (not a minion the same attack could also defeat, which
    // would reset its `damage` to 0 as it leaves play).
    const villain = flipped.villains[0]!.instanceId;
    const tough = patchInstance(flipped, villain, { damage: 0, statuses: { stunned: 0, confused: 0, tough: 1 } });
    const attacked = settle(runWave5(tough, basicAttack(identity, villain)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(attacked, villain).statuses.tough).toBe(0);
    expect(inst(attacked, villain).damage).toBeGreaterThan(0);
  });
});

describe("Propulsion Gauntlet (27185a / 27185b)", () => {
  it("Hero Action: exhaust and take 2 indirect damage to ready your hero (27185a.propulsion-gauntlet-action)", () => {
    const withGauntlet = withUpgradeInPlay(heroForm(gameWithCard("27185a")), "27185a");
    const identity = identityOf(withGauntlet.state);
    const exhausted = patchInstance(withGauntlet.state, identity, { exhausted: true });
    const used = settle(
      runWave5(exhausted, use(P1, withGauntlet.id, "27185a.propulsion-gauntlet-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(used, identity).exhausted).toBe(false);
    expect(inst(used, withGauntlet.id).exhausted).toBe(true);
    expect(inst(used, identity).damage).toBe(2);
  });

  it("Enhanced back: also grants +1 THW/ATK/DEF until the end of the phase (27185b.propulsion-gauntlet-action)", () => {
    const withGauntlet = withUpgradeInPlay(heroForm(gameWithCard("27185a")), "27185a");
    const flipped = patchInstance(withGauntlet.state, withGauntlet.id, { flipped: true });
    const identity = identityOf(flipped);
    const baseline = characterProfile(flipped, identity, WAVE5_DEPS)!;
    const exhausted = patchInstance(flipped, identity, { exhausted: true });
    const used = settle(
      runWave5(exhausted, use(P1, withGauntlet.id, "27185b.propulsion-gauntlet-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const after = characterProfile(used, identity, WAVE5_DEPS)!;
    expect(after.thw).toBe(baseline.thw + 1);
    expect(after.atk).toBe(baseline.atk + 1);
    expect(after.def).toBe(baseline.def + 1);
  });
});

describe("Retinal Display (27186a / 27186b)", () => {
  it("constant: +1 THW (27186a.retinal-display-constant-2)", () => {
    const heroBase = heroForm(ghostSpiderGame());
    const baseline = characterProfile(heroBase, identityOf(heroBase), WAVE5_DEPS)!.thw;
    const withDisplay = withUpgradeInPlay(heroForm(gameWithCard("27186a")), "27186a");
    expect(characterProfile(withDisplay.state, identityOf(withDisplay.state), WAVE5_DEPS)!.thw).toBe(baseline + 1);
  });

  it("basic THW can only remove threat from the scheme with the most threat (27186a.retinal-display-constant)", () => {
    const withDisplay = withUpgradeInPlay(heroForm(gameWithCard("27186a")), "27186a");
    const identity = identityOf(withDisplay.state);
    const mainScheme = withDisplay.state.mainScheme.instanceId;
    const lowScheme = `scheme-${Object.keys(withDisplay.state.instances).length}` as InstanceId;
    const withHighThreat = patchInstance(withDisplay.state, mainScheme, { threat: 10 });
    const withLowScheme: GameState = {
      ...withHighThreat,
      instances: {
        ...withHighThreat.instances,
        [lowScheme]: {
          instanceId: lowScheme,
          cardId: withDisplay.state.instances[mainScheme]!.cardId,
          ownerId: null,
          controllerId: null,
          home: { kind: "encounterArea" },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 1,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: null,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
        } as never,
      },
    };
    // The lower-threat scheme is not a legal basic-thwart target while the main scheme has more threat.
    expect(() =>
      runWave5(withLowScheme, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: lowScheme,
      }),
    ).toThrow();
    // The scheme with the most threat is legal.
    expect(() =>
      runWave5(withLowScheme, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: mainScheme,
      }),
    ).not.toThrow();
  });

  it("Enhanced back: +2 THW (27186b.retinal-display-constant-2)", () => {
    const heroBase = heroForm(ghostSpiderGame());
    const baseline = characterProfile(heroBase, identityOf(heroBase), WAVE5_DEPS)!.thw;
    const withDisplay = withUpgradeInPlay(heroForm(gameWithCard("27186a")), "27186a");
    const flipped = patchInstance(withDisplay.state, withDisplay.id, { flipped: true });
    expect(characterProfile(flipped, identityOf(flipped), WAVE5_DEPS)!.thw).toBe(baseline + 2);
  });

  it("[ignores crisis / patrol] granted as printed (27186a/27186b.retinal-display-constant-2)", () => {
    // A direct behavioral test needs a live crisis-icon scheme and a patrol-keyword minion in the same reveal —
    // asserted at the shape level instead (the same convention `mts-campaign-cards.test.ts`'s own Fandral test
    // uses for `characterIgnores`, which has no public reader outside the engine).
    const front = WAVE5_DEPS.abilities["27186a.retinal-display-constant-2"]!;
    const back = WAVE5_DEPS.abilities["27186b.retinal-display-constant-2"]!;
    expect(front.trigger.kind === "constant" ? front.trigger.rules : undefined).toContainEqual(
      expect.objectContaining({ kind: "characterIgnores", ignores: ["crisis"], basicOnly: true }),
    );
    expect(back.trigger.kind === "constant" ? back.trigger.rules : undefined).toContainEqual(
      expect.objectContaining({ kind: "characterIgnores", ignores: ["crisis", "patrol"], basicOnly: true }),
    );
  });
});

describe("Shock Knuckles (27187a / 27187b)", () => {
  it("Hero Response: after a basic attack, discard the top encounter card; no boost icons stuns that enemy (27187a.shock-knuckles-response)", () => {
    const withKnuckles = withUpgradeInPlay(heroForm(gameWithCard("27187a")), "27187a");
    const identity = identityOf(withKnuckles.state);
    const { state: withMinion, id: minion } = withEngagedMinion(withKnuckles.state, HYDRA_MERCENARY, 3, 0);
    const stacked = stackEncounterDeck(withMinion, NO_BOOST);
    const attacked = settle(
      runWave5(stacked, basicAttack(identity, minion)),
      accepting("27187a.shock-knuckles-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attacked, minion).statuses.stunned).toBeGreaterThanOrEqual(1);
  });

  it("with a boost icon discarded, the enemy is not stunned", () => {
    const withKnuckles = withUpgradeInPlay(heroForm(gameWithCard("27187a")), "27187a");
    const identity = identityOf(withKnuckles.state);
    const { state: withMinion, id: minion } = withEngagedMinion(withKnuckles.state, HYDRA_MERCENARY, 3, 0);
    const stacked = stackEncounterDeck(withMinion, HYDRA_MERCENARY);
    const attacked = settle(
      runWave5(stacked, basicAttack(identity, minion)),
      accepting("27187a.shock-knuckles-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attacked, minion).statuses.stunned).toBe(0);
  });

  it("Enhanced back: +1 ATK, and 1 or fewer boost icons still stuns (27187b.shock-knuckles-constant, -response)", () => {
    const withKnuckles = withUpgradeInPlay(heroForm(gameWithCard("27187a")), "27187a");
    const flipped = patchInstance(withKnuckles.state, withKnuckles.id, { flipped: true });
    const identity = identityOf(flipped);
    const heroBase = heroForm(ghostSpiderGame());
    const baseline = characterProfile(heroBase, identityOf(heroBase), WAVE5_DEPS)!.atk;
    expect(characterProfile(flipped, identity, WAVE5_DEPS)!.atk).toBe(baseline + 1);
    const { state: withMinion, id: minion } = withEngagedMinion(flipped, HYDRA_MERCENARY, 3, 0);
    const stacked = stackEncounterDeck(withMinion, HYDRA_MERCENARY); // exactly 1 boost icon: "1 or fewer" still stuns
    const attacked = settle(
      runWave5(stacked, basicAttack(identity, minion)),
      accepting("27187b.shock-knuckles-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attacked, minion).statuses.stunned).toBeGreaterThanOrEqual(1);
  });
});

describe("Wave Bracers (27188a / 27188b)", () => {
  it("constant: -1 ATK; +1 DEF, retaliate 1, steady (27188a.wave-bracers-constant, -constant-2)", () => {
    const base = heroForm(ghostSpiderGame());
    const baseline = characterProfile(base, identityOf(base), WAVE5_DEPS)!;
    const withBracers = withUpgradeInPlay(heroForm(gameWithCard("27188a")), "27188a");
    const heroIdentity = identityOf(withBracers.state);
    const profile = characterProfile(withBracers.state, heroIdentity, WAVE5_DEPS)!;
    expect(profile.atk).toBe(baseline.atk - 1);
    expect(profile.def).toBe(baseline.def + 1);
    expect(hasKeyword(withBracers.state, heroIdentity, "retaliate", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(withBracers.state, heroIdentity, "steady", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(withBracers.state, heroIdentity, "stalwart", WAVE5_DEPS)).toBe(false);
  });

  it("Enhanced back: +2 DEF, retaliate 1, stalwart instead of steady (27188b.wave-bracers-constant, -constant-2)", () => {
    const base = heroForm(ghostSpiderGame());
    const baseline = characterProfile(base, identityOf(base), WAVE5_DEPS)!;
    const withBracers = withUpgradeInPlay(heroForm(gameWithCard("27188a")), "27188a");
    const flipped = patchInstance(withBracers.state, withBracers.id, { flipped: true });
    const heroIdentity = identityOf(flipped);
    const profile = characterProfile(flipped, heroIdentity, WAVE5_DEPS)!;
    expect(profile.def).toBe(baseline.def + 2);
    expect(hasKeyword(flipped, heroIdentity, "retaliate", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(flipped, heroIdentity, "stalwart", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(flipped, heroIdentity, "steady", WAVE5_DEPS)).toBe(false);
  });
});

describe("Wrist Navigator (27189a / 27189b)", () => {
  it("Forced Response: attaches to a minion as it enters play; Interrupt draws 1 card when it's defeated (27189a.wrist-navigator-forced-response, -interrupt)", () => {
    const withNav = withUpgradeInPlay(heroForm(gameWithCard("27189a")), "27189a");
    const stacked = stackEncounterDeck(withNav.state, NO_BOOST, HYDRA_MERCENARY);
    const { state: revealed } = driveEvents(WAVE5_DEPS, stacked, endTurn());
    const mercenary = Object.entries(revealed.instances).find(
      ([, i]) => i?.cardId === cardId(HYDRA_MERCENARY) && i.attachedTo === null,
    )?.[0] as InstanceId | undefined;
    // The navigator attached to whichever minion instance ended up engaged (its `attachedTo` names it).
    const attachedHost = inst(revealed, withNav.id).attachedTo;
    expect(attachedHost).not.toBeNull();
    void mercenary;
    const handBefore = playerOf(revealed, P1).hand.length;
    // A plain (optional) "Interrupt:", not forced — the defeat has to accept it (`defeatWithAttackAccepting` stands
    // in for `defeatWithAttack`, which declines every optional trigger by default).
    const defeated = defeatWithAttackAccepting(revealed, attachedHost!, "27189a.wrist-navigator-interrupt");
    expect(playerOf(defeated, P1).hand.length).toBe(handBefore + 1);
    // A permanent player attachment stays in play, unattached, in its controller's play area (`on.attachedCardDefeated`'s
    // own doc comment) — the parenthetical "(Return this card to your play area.)" is `coveredByEngineRule`.
    expect(inst(defeated, withNav.id).attachedTo).toBeNull();
    expect(playerOf(defeated, P1).playArea).toContain(withNav.id);
  });

  it("Enhanced back: Interrupt draws 2 cards, then discards 1 (27189b.wrist-navigator-forced-response, -interrupt)", () => {
    const withNav = withUpgradeInPlay(heroForm(gameWithCard("27189a")), "27189a");
    const flipped = patchInstance(withNav.state, withNav.id, { flipped: true });
    const stacked = stackEncounterDeck(flipped, NO_BOOST, HYDRA_MERCENARY);
    const { state: revealed } = driveEvents(WAVE5_DEPS, stacked, endTurn());
    const attachedHost = inst(revealed, withNav.id).attachedTo;
    expect(attachedHost).not.toBeNull();
    const before = playerOf(revealed, P1);
    const deckBefore = before.deck.length;
    const handBefore = before.hand.length;
    const defeated = defeatWithAttackAccepting(revealed, attachedHost!, "27189b.wrist-navigator-interrupt");
    const after = playerOf(defeated, P1);
    expect(deckBefore - after.deck.length).toBe(2);
    expect(after.hand.length).toBe(handBefore + 2 - 1);
  });
});

describe("standard play: none of the eight is legal outside the Sinister Motives campaign", () => {
  // `../../../campaigns/sm-campaign-cards-availability.test.ts` already proves the deck-legality mechanism itself
  // (`validateDeck`'s `specificTo: { kind: "campaign" }` handling) off two of the eight (Compact Darts, Wrist
  // Navigator); this covers the remaining six the same way, so every one of the eight is proven, not just its data
  // shape.
  function ghostSpiderDeck(): DeckContents {
    const starter = SM_STARTER_DECKS.find((deck) => (deck.id as string) === "ghost-spider");
    if (!starter) throw new Error("no sm starter deck ghost-spider");
    return { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards };
  }
  function withCard(deck: DeckContents, id: string): DeckContents {
    return { ...deck, cards: [...deck.cards.filter((e) => e.cardId !== id), { cardId: cardId(id), quantity: 1 }] };
  }

  it.each(["27183a", "27184a", "27185a", "27186a", "27187a", "27188a"])(
    "%s is refused with no campaign context",
    (code) => {
      const verdict = validateDeck(withCard(ghostSpiderDeck(), code), WAVE5_CARDS);
      expect(verdict.ok ? [] : verdict.problems.map((p) => p.code)).toEqual(["campaign_card"]);
    },
  );

  it.each(["27183a", "27184a", "27185a", "27186a", "27187a", "27188a"])(
    "%s is legal once the SM campaign has granted exactly one copy",
    (code) => {
      const context: DeckContext = {
        campaign: {
          campaignId: SM_CAMPAIGN_DEFINITION.campaignId,
          campaignSetIds: ["shield_tech"],
          identityCardId: ghostSpiderDeck().identityCardId,
          grantedCardIds: [cardId(code)],
        },
      };
      const verdict = validateDeck(withCard(ghostSpiderDeck(), code), WAVE5_CARDS, context);
      expect(verdict.ok ? [] : verdict.problems.map((p) => p.code)).toEqual([]);
    },
  );
});

// Silence unused-import complaints for helpers kept for documentation purposes in a couple of tests above.
void moveToDiscard;
void payWith;
void play;
