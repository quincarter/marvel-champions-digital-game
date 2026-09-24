/**
 * The setup half of RRG 1.8 Appendix II (p. 51), as steps the flow can stop between.
 *
 * `createGame` builds the state and then has to *run* setup: shuffle, starting threat, setup cards, the scenario's
 * own setup abilities, the draw, the mulligan. A standalone game runs the whole block inline, exactly as it always
 * has, and its step sequence is untouched. A **campaign** game cannot: MC60 p. 9 prints instructions that resolve
 * *before* scenario setup, and a campaign instruction is an ordinary `EffectSpec` list that may stop for a choice —
 * so it has to resolve through the stack, between flow steps. Hence this module: one function per block, called
 * inline by `createGame` for a standalone game and by `flow.ts` as a step for a campaign game, so the two can never
 * drift apart.
 *
 * Where each window sits, and why, is `CAMPAIGN_WINDOW_ORDER` in `campaign.ts`.
 */

import type { CampaignWindow } from "./campaign.js";
import { emit, moveCard, pushFrames, updateInstance, type Ctx } from "./ctx.js";
import { giveStatus, shuffleZone } from "./effects.js";
import type { PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { encounterDeckOf, mainSchemeStage, mainSchemeValue, mustCardOf } from "./query.js";
import {
  announce,
  applyEnterPlayKeywords,
  enterPlayOnReveal,
  gameAbilityFrames,
  shuffleSeparateDeck,
} from "./resolve/index.js";
import { buildScenarioDeck } from "./resolve/cards.js";
import { base } from "./resolve/frames.js";
import type { StackFrame } from "./stack.js";
import type { GameState, GameStep } from "./state.js";

/** The step a campaign game starts on: nothing of Appendix II has happened yet (MC60 p. 9 steps 1-7). */
export const FIRST_CAMPAIGN_STEP: GameStep = { phase: "setup", kind: "campaignWindow", window: "beforeScenarioSetup" };

/** The step a standalone game starts on — unchanged, and the reason a standalone game's event stream is unchanged. */
export const FIRST_STANDALONE_STEP: GameStep = { phase: "setup", kind: "drawStartingHands" };

/**
 * RRG 1.8 Appendix II steps 6-12 (p. 51): shuffle every deck, place starting threat, give the villains their tough
 * status, put the setup-keyword cards into play, then push the scenario's own "Setup" and "When Revealed" abilities.
 *
 * A pure function of the context — every id it needs is already in `GameState` — which is what lets it be both an
 * inline call and a flow step.
 */
export function resolveScenarioSetup(ctx: Ctx): void {
  const firstPlayerId = ctx.state.firstPlayerId;
  const mainSchemeInstanceId = ctx.state.mainScheme.instanceId;
  for (const player of ctx.state.players) {
    const shuffled = shuffleZone(ctx, { kind: "deck", playerId: player.playerId }, player.deck);
    ctx.state = {
      ...ctx.state,
      players: ctx.state.players.map((p) => (p.playerId === player.playerId ? { ...p, deck: shuffled } : p)),
    };
    // RRG 1.8 Appendix II step 6 (p. 51), for separate decks too; the top card turns faceup as the identity says.
    for (const name of Object.keys(player.separateDecks)) shuffleSeparateDeck(ctx, player.playerId, name);
  }
  for (const deckId of ctx.state.encounterDeckOrder) {
    const shuffled = shuffleZone(ctx, { kind: "encounterDeck", deckId }, encounterDeckOf(ctx.state, deckId).deck);
    ctx.state = {
      ...ctx.state,
      encounterDecks: { ...ctx.state.encounterDecks, [deckId]: { deck: shuffled, discard: [] } },
    };
  }

  // An encounter set's own deck (the Infinity Stone deck) is made from its cards in the encounter deck (MC21 p. 16:
  // "shuffle the six Infinity Stone environment cards together and set them aside, facedown"; docs/phase7-wave4.md §3.6).
  for (const [name, piles] of Object.entries(ctx.state.scenarioDecks))
    if (piles.buildAtSetup) buildScenarioDeck(ctx, name);

  const startingThreat = mainSchemeValue(ctx.state, "startingThreat", ctx.deps);
  if (startingThreat > 0) {
    updateInstance(ctx, mainSchemeInstanceId, (i) => ({ ...i, threat: i.threat + startingThreat }));
    emit(ctx, {
      type: "threatPlaced",
      schemeInstanceId: mainSchemeInstanceId,
      amount: startingThreat,
      sourceInstanceId: null,
    });
  }

  // RRG "Toughness": each villain's starting stage enters play with its tough status.
  for (const villain of ctx.state.villains) {
    if (hasKeyword(ctx.state, villain.instanceId, "toughness", ctx.deps)) giveStatus(ctx, villain.instanceId, "tough");
  }
  putSetupCardsIntoPlay(ctx, firstPlayerId);
  // RRG Appendix II step 12: main scheme 1A setup text, then each villain's, in printed order.
  // "Advance to stage 1B" is implicit (the engine already sits on 1B), so 1B's
  // own "When Revealed" resolves right after the 1A setup text.
  pushFrames(ctx, [
    ...gameAbilityFrames(
      ctx,
      mainSchemeInstanceId,
      ["setup"],
      null,
      mainSchemeStage(ctx.state).aSide.abilities,
      firstPlayerId,
    ),
    ...gameAbilityFrames(ctx, mainSchemeInstanceId, ["setup"], null, undefined, firstPlayerId),
    ...gameAbilityFrames(ctx, mainSchemeInstanceId, ["whenRevealed"], null, undefined, firstPlayerId),
    ...ctx.state.villains.flatMap((villain) => [
      ...gameAbilityFrames(ctx, villain.instanceId, ["setup"], null, undefined, firstPlayerId),
      // RRG Appendix II "Resolve Scenario Setup and When Revealed Abilities": the starting villain
      // stage is revealed too (expert Rhino II reveals Breakin' & Takin' during setup).
      ...gameAbilityFrames(ctx, villain.instanceId, ["whenRevealed"], null, undefined, firstPlayerId),
    ]),
  ]);
}

/** RRG Appendix II step 11: every card with the setup keyword begins the game in play. */
function putSetupCardsIntoPlay(ctx: Ctx, revealingPlayerId: PlayerId): void {
  for (const deckId of ctx.state.encounterDeckOrder) {
    for (const id of [...encounterDeckOf(ctx.state, deckId).deck]) {
      if (!hasKeyword(ctx.state, id, "setup")) continue;
      updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
      enterPlayOnReveal(ctx, id, revealingPlayerId);
    }
  }
  for (const player of ctx.state.players) {
    for (const id of [...player.deck]) {
      if (!hasKeyword(ctx.state, id, "setup")) continue;
      const card = mustCardOf(ctx.state, id);
      updateInstance(ctx, id, (i) => ({ ...i, faceup: true, controllerId: player.playerId }));
      if (card.type === "upgrade") {
        moveCard(ctx, id, { kind: "attachment", hostInstanceId: player.identity.instanceId });
      } else {
        moveCard(ctx, id, { kind: "playArea", playerId: player.playerId });
      }
      applyEnterPlayKeywords(ctx, id);
      announce(ctx, { kind: "cardEntersPlay", instanceId: id, playerId: player.playerId });
    }
  }
}

/**
 * Resolves the campaign's instructions for one window, in the order the runner put them in — already gated by mode
 * and by their `when` predicate (`CampaignGameInput.instructions`; design §7.1), so the engine runs the list as given
 * and never sees a `CampaignDefinition`.
 *
 * Each instruction becomes its own effects frame, so the trace shows one instruction resolving at a time and a
 * choice inside one does not swallow the next. They are pushed as a batch, `frames[0]` first, because `pushFrames`
 * prepends. The first player resolves them: campaign setup is scenario text, and "you" in a campaign instruction is
 * the first player unless the instruction says `forEachPlayer`.
 */
export function resolveCampaignWindow(ctx: Ctx, window: CampaignWindow): void {
  const input = ctx.state.campaign;
  if (!input) return;
  const frames: StackFrame[] = [];
  for (const instruction of input.instructions) {
    if (instruction.window !== window) continue;
    emit(ctx, {
      type: "campaignInstructionResolved",
      instructionId: instruction.instructionId,
      window,
      text: instruction.text,
      citation: instruction.citation,
    });
    if (instruction.effects.length === 0) continue;
    frames.push({
      ...base(ctx),
      kind: "effects",
      effects: instruction.effects,
      cursor: 0,
      bindings: {},
      vars: {},
      scopedPlayerId: null,
      selfInstanceId: null,
      controllerId: ctx.state.firstPlayerId,
      event: null,
      eventFrameId: null,
    });
  }
  pushFrames(ctx, frames);
}

/**
 * The setup step that follows a campaign window, keyed by which window just resolved. Exhaustive on purpose: adding
 * a `CampaignWindow` without giving it a place in the setup flow is a compile error, not a silent no-op.
 */
export function stepAfterCampaignWindow(window: CampaignWindow): GameStep {
  switch (window) {
    // MC60 p. 9 steps 1-7, "Before beginning setup for each game": nothing of Appendix II has run yet.
    case "beforeScenarioSetup":
      return { phase: "setup", kind: "scenarioSetup" };
    // The three that share the gap after Appendix II step 12 and before step 14 (see `CAMPAIGN_WINDOW_ORDER`).
    case "afterScenarioSetup":
      return { phase: "setup", kind: "campaignWindow", window: "beforeStartingHands" };
    case "beforeStartingHands":
      return { phase: "setup", kind: "campaignWindow", window: "beforePlayerSetup" };
    case "beforePlayerSetup":
      return { phase: "setup", kind: "drawStartingHands" };
    // MC50 p. 11, "After resolving mulligans": Appendix II step 15 is done, step 16 has not begun.
    case "afterMulligans":
      return { phase: "setup", kind: "playerSetupAbilities" };
  }
}

/** After Appendix II step 12, a campaign game resolves the first of the three windows that share that gap. */
export const STEP_AFTER_SCENARIO_SETUP: GameStep = {
  phase: "setup",
  kind: "campaignWindow",
  window: "afterScenarioSetup",
};

/** RRG Appendix II step 16 — preceded by MC50 p. 11's window in a campaign game, and by nothing in a standalone one. */
export const stepAfterMulligans = (state: GameState): GameStep =>
  state.campaign
    ? { phase: "setup", kind: "campaignWindow", window: "afterMulligans" }
    : { phase: "setup", kind: "playerSetupAbilities" };
