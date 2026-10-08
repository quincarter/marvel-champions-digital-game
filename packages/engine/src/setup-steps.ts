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

import type { CardId } from "@mc/content";
import type { CampaignWindow } from "./campaign.js";
import { emit, moveCard, pushFrames, updateInstance, type Ctx } from "./ctx.js";
import { isPermanentCard } from "./deck.js";
import { applyToughness, shuffleZone } from "./effects.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { encounterDeckOf, mainSchemeValue, mustCardOf, undefeatedVillains, villainOf } from "./query.js";
import { announce, applyEnterPlayKeywords, gameAbilityFrames, shuffleSeparateDeck } from "./resolve/index.js";
import { buildScenarioDeck } from "./resolve/cards.js";
import { base } from "./resolve/frames.js";
import { mainSchemeStageFrames } from "./resolve/main-scheme-side.js";
import { encounterSetupCardEntersPlay, waitingSetupCardsEnterPlay } from "./resolve/setup-cards.js";
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
  stackDecks(ctx);

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

  // RRG "Toughness": each villain's starting stage enters play with its tough status. A villain that starts set aside
  // (docs/phase7-wave5.md §3.1) is not in play, so neither this nor its Setup / When Revealed below applies to it:
  // `addVillain` gives it its tough status as it enters, and step 12c is its own step (`resolveVillainSetupAbilities`).
  for (const villain of undefeatedVillains(ctx.state)) {
    applyToughness(ctx, villain.instanceId);
  }
  // Step 11's own frames (each setup card's starting threat and its entering play) resolve before anything of step
  // 12: they are lifted off here and put back on top once step 12's frames are pushed, so the stack reads step 11,
  // the setup options, step 12 (RRG 1.8 Appendix II, p. 51; docs/phase7-wave8.md §3.5).
  const heldBeforeStep11 = ctx.state.stack.length;
  putSetupCardsIntoPlay(ctx, firstPlayerId);
  const step11Frames = ctx.state.stack.slice(0, ctx.state.stack.length - heldBeforeStep11);
  ctx.state = { ...ctx.state, stack: ctx.state.stack.slice(step11Frames.length) };
  // RRG Appendix II step 12: main scheme 1A setup text, the flip to 1B and its "When Revealed", then each villain's,
  // in printed order. Side 1A is the faceup one through step 11 and step 12a (`MainSchemeState.faceupSide`).
  pushFrames(ctx, [
    // Between step 11 and step 12: the optional setup rules the players turned on (docs/phase7-wave8.md §3.5).
    ...setupOptionFrames(ctx),
    // Steps 12a and 12b: 1A's Setup, then the flip to 1B, whose own Setup and When Revealed resolve once it is the
    // faceup side (docs/phase7-wave8.md §4.1 Q56).
    ...mainSchemeStageFrames(ctx, mainSchemeInstanceId, "setup", ["setup", "whenRevealed"], firstPlayerId),
    ...undefeatedVillains(ctx.state).flatMap((villain) => [
      ...gameAbilityFrames(ctx, villain.instanceId, ["setup"], null, undefined, firstPlayerId),
      // RRG Appendix II "Resolve Scenario Setup and When Revealed Abilities": the starting villain
      // stage is revealed too (expert Rhino II reveals Breakin' & Takin' during setup).
      ...gameAbilityFrames(ctx, villain.instanceId, ["whenRevealed"], null, undefined, firstPlayerId),
    ]),
  ]);
  ctx.state = { ...ctx.state, stack: [...step11Frames, ...ctx.state.stack] };
}

/**
 * `ScenarioRules.setupOptions`: one `setupOptionApplied` entry and one effects frame per option, in the order listed,
 * resolved by the first player as scenario text (no "self"). They go ahead of step 12's frames, so the cards step 11
 * put into play are there and no Setup or When Revealed ability has resolved yet (RRG 1.8 Appendix II, p. 51). An
 * option stated at 0 is logged and resolves its instruction for 0.
 */
function setupOptionFrames(ctx: Ctx): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const option of ctx.state.scenarioRules.setupOptions ?? []) {
    emit(ctx, {
      type: "setupOptionApplied",
      option: option.option,
      amount: option.amount,
      text: option.text,
      citation: option.citation,
    });
    if (option.effects.length === 0) continue;
    frames.push({
      ...base(ctx),
      kind: "effects",
      effects: option.effects,
      cursor: 0,
      bindings: {},
      vars: {},
      scopedPlayerId: null,
      selfInstanceId: null,
      controllerId: ctx.state.firstPlayerId,
      event: null,
      eventFrameId: null,
      instruction: { kind: "scenario", instructionId: option.option, text: option.text, citation: option.citation },
    });
  }
  return frames;
}

/**
 * The step after Appendix II steps 12a and 12b: step 12c as its own step when every villain started set aside
 * (`GameState.villainsEnteringAtSetup`), else what follows step 12 (`stepAfterVillainSetupAbilities`). A game with a
 * villain in play from the start keeps exactly the step sequence it had.
 */
export const stepAfterScenarioSetupAbilities = (state: GameState, after: GameStep): GameStep =>
  state.villainsEnteringAtSetup !== undefined
    ? { phase: "setup", kind: "villainSetupAbilities" }
    : stepAfterVillainSetupAbilities(state, after);

/**
 * The step after Appendix II step 12 when the scenario has rulebook-printed setup instructions
 * (`ScenarioRules.setupInstructions`), else `after`. A game without any keeps exactly the step sequence it had.
 */
export const stepAfterVillainSetupAbilities = (state: GameState, after: GameStep): GameStep =>
  (state.scenarioRules.setupInstructions?.length ?? 0) > 0
    ? { phase: "setup", kind: "scenarioSetupInstructions" }
    : after;

/**
 * RRG 1.8 Appendix II step 12c (p. 51) for a game whose villains all started set aside (docs/phase7-wave7.md §3.42).
 * Step 12 reads "a. Resolve any 'Setup' abilities on main scheme card 1A. b. Flip the main scheme card to side 1B and
 * resolve any 'When Revealed' abilities on that side. c. Resolve any 'Setup' and 'When Revealed' abilities on the
 * villain", and "When Revealed Abilities" (p. 48): "If an encounter card with a 'When Revealed' ability enters play
 * during setup, resolve that ability during the 'Resolve Scenario Setup and When Revealed Abilities' step." So a
 * villain that 12a's text puts into play is not revealed as it enters: its own abilities wait for 12c, after 1B's When
 * Revealed has fully resolved, which is why this is a flow step and not part of the batch `resolveScenarioSetup` pushes
 * (that batch is built before 12a has chosen anyone). Each villain still in play resolves its Setup and then its When
 * Revealed once, in the order they entered, and the window closes.
 *
 * A step 11 setup card still waiting for a card to attach to (`GameState.setupCardsAwaitingHost`) is settled first: no
 * later villain can enter inside the window.
 */
export function resolveVillainSetupAbilities(ctx: Ctx): void {
  waitingSetupCardsEnterPlay(ctx, true);
  const entered = ctx.state.villainsEnteringAtSetup ?? [];
  const { villainsEnteringAtSetup: _closed, ...rest } = ctx.state;
  ctx.state = rest;
  const firstPlayerId = ctx.state.firstPlayerId;
  pushFrames(
    ctx,
    entered
      .filter((id) => villainOf(ctx.state, id)?.defeated === false)
      .flatMap((id) => [
        ...gameAbilityFrames(ctx, id, ["setup"], null, undefined, firstPlayerId),
        ...gameAbilityFrames(ctx, id, ["whenRevealed"], null, undefined, firstPlayerId),
      ]),
  );
}

/** Where the flow goes once the scenario's setup instructions are on the stack. */
export const stepAfterScenarioSetupInstructions = (state: GameState): GameStep =>
  state.campaign ? STEP_AFTER_SCENARIO_SETUP : FIRST_STANDALONE_STEP;

/**
 * `ScenarioRules.setupInstructions`, resolved as their own flow step so they run only after every Setup and When
 * Revealed ability of Appendix II step 12 has fully resolved (MC21 p. 11 places damage on Avengers Tower, which The
 * Armies of Thanos 2A's When Revealed — reached through Under Siege 1A's Setup — is what puts into play). One effects
 * frame per instruction so the trace shows each resolving on its own, resolved by the first player as scenario text
 * (no "self"), exactly as `resolveCampaignWindow` resolves a campaign instruction.
 */
export function resolveScenarioSetupInstructions(ctx: Ctx): void {
  const frames: StackFrame[] = [];
  for (const instruction of ctx.state.scenarioRules.setupInstructions ?? []) {
    emit(ctx, {
      type: "scenarioSetupInstructionResolved",
      instructionId: instruction.id,
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
      instruction: {
        kind: "scenario",
        instructionId: instruction.id,
        text: instruction.text,
        citation: instruction.citation,
      },
    });
  }
  pushFrames(ctx, frames);
}

/**
 * `GameSetupConfig.stack` (`GameState.setupStack`): the listed cards go on top of their decks, top card first, right
 * after the step 6 shuffle and before anything reads a deck. Tutorials and scripted scenarios only; RRG 1.8 Appendix II
 * step 6 (p. 51) always shuffles, so a game without a stack never reaches this. Consumes no randomness. Each code takes
 * the topmost copy after the shuffle, so every other card keeps its shuffled relative order. `createGame` has already
 * checked every code against its deck.
 */
function stackDecks(ctx: Ctx): void {
  const stack = ctx.state.setupStack;
  if (!stack) return;
  const onTop = (deck: readonly InstanceId[], codes: readonly CardId[]) => {
    const rest = [...deck];
    const stacked: InstanceId[] = [];
    for (const code of codes) {
      const index = rest.findIndex((id) => ctx.state.instances[id]?.cardId === code);
      const [taken] = index < 0 ? [] : rest.splice(index, 1);
      if (!taken) throw new Error(`setup stack: ${code} is no longer in the deck`);
      stacked.push(taken);
    }
    return { stacked, order: [...stacked, ...rest] };
  };
  for (const [id, codes] of Object.entries(stack.players ?? {})) {
    const player = ctx.state.players.find((p) => p.playerId === id);
    if (!player) throw new Error(`setup stack: no player ${id}`);
    const { stacked, order } = onTop(player.deck, codes);
    ctx.state = {
      ...ctx.state,
      players: ctx.state.players.map((p) => (p.playerId === player.playerId ? { ...p, deck: order } : p)),
    };
    emit(ctx, { type: "deckStacked", zone: { kind: "deck", playerId: player.playerId }, stacked, order });
  }
  const deckId = ctx.state.encounterDeckOrder[0];
  if (stack.encounter && deckId) {
    const piles = encounterDeckOf(ctx.state, deckId);
    const { stacked, order } = onTop(piles.deck, stack.encounter);
    ctx.state = { ...ctx.state, encounterDecks: { ...ctx.state.encounterDecks, [deckId]: { ...piles, deck: order } } };
    emit(ctx, { type: "deckStacked", zone: { kind: "encounterDeck", deckId }, stacked, order });
  }
}

/**
 * RRG Appendix II step 11: every card with the setup keyword begins the game in play. "Search each deck and the set
 * aside area" (RRG 1.8 p. 51), read in that order: the encounter decks, each player's deck with that player's own
 * set-aside cards, then the encounter set-aside area.
 *
 * - A player's permanent cards were set aside before step 1 (docs/phase7-wave6.md §3.74), so a "Permanent. Setup." card
 *   (the campaign condition upgrades, MC10 p. 7) is found in their own set-aside area, after their deck. Only permanent
 *   player cards: the nemesis set waiting in the same area is never swept.
 * - An ally found in the encounter deck (an encounter set's own ally, docs/phase7-wave7.md §3.25) enters play in the
 *   first player's play area under their control (`enterPlayOnReveal`); the scenario still owns it. Its own text decides
 *   whether it then follows the first player token (`controlledByFirstPlayer`) and whether it counts against the ally
 *   limit (`excludedFromAllyLimit`).
 * - A card in the encounter set-aside area enters play as one found in an encounter deck does, under the first player
 *   when its type needs a player (docs/phase7-wave7.md §4.1 Q20 = B), unless the scenario's own text keeps it aside
 *   until called (`ScenarioRules.setAsideUntilCalled`; MC40 p. 16). The area is read as it stood when step 11 began, so
 *   a deck's card held there for a host is not found twice. A set-aside villain is not a card with keywords until it
 *   is in play (`addVillain`), so none is taken.
 * - A campaign-specific card there is the campaign's supply, not a card the scenario set aside: no printed step puts it
 *   in the set-aside area, it is brought from outside the game so that the instruction or ability naming it can find
 *   it (`CampaignOp` `composeEncounterSets` `into: "setAside"`, `setAsideCards`; MC21's Norn Stone, handed out by a
 *   side scheme's When Defeated). It is never taken. A campaign card a player has earned begins in play from that
 *   player's own deck or set-aside cards, above.
 * - An attachment with no card to attach to, in a game whose villains all start set aside, waits for the villain that
 *   step 12a puts into play (`resolve/setup-cards.ts`), wherever step 11 found it.
 */
function putSetupCardsIntoPlay(ctx: Ctx, revealingPlayerId: PlayerId): void {
  const setAsideAtStart = [...ctx.state.encounterSetAside];
  for (const deckId of ctx.state.encounterDeckOrder) {
    for (const id of [...encounterDeckOf(ctx.state, deckId).deck]) {
      if (!hasKeyword(ctx.state, id, "setup")) continue;
      encounterSetupCardEntersPlay(ctx, id, revealingPlayerId);
    }
  }
  for (const player of ctx.state.players) {
    const setAsidePermanent = player.setAside.filter((id) => isPermanentCard(mustCardOf(ctx.state, id)));
    for (const id of [...player.deck, ...setAsidePermanent]) {
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
  for (const id of setAsideAtStart) {
    if (!hasKeyword(ctx.state, id, "setup") || isSetAsideUntilCalled(ctx.state, id)) continue;
    encounterSetupCardEntersPlay(ctx, id, revealingPlayerId);
  }
}

/**
 * Whether step 11 leaves this card of the encounter set-aside area where it is: the scenario's own text keeps it aside
 * (`ScenarioRules.setAsideUntilCalled`), or it is a campaign-specific card, the campaign's supply.
 */
function isSetAsideUntilCalled(state: GameState, id: InstanceId): boolean {
  const card = mustCardOf(state, id);
  if ("specificTo" in card && card.specificTo?.kind === "campaign") return true;
  const rule = state.scenarioRules.setAsideUntilCalled;
  if (!rule) return false;
  if (rule.cardIds?.includes(card.id)) return true;
  const sets = rule.encounterSetIds ?? [];
  if (sets.length === 0) return false;
  const own: readonly string[] = [
    ...("encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : []),
    ...("specificTo" in card && card.specificTo ? [card.specificTo.encounterSetId as string] : []),
  ];
  return own.some((setId) => sets.includes(setId));
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
      instruction: {
        kind: "campaign",
        instructionId: instruction.instructionId,
        text: instruction.text,
        citation: instruction.citation,
      },
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
