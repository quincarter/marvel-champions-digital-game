/**
 * Campaign runs in a known state, for screenshots, screen development and tests — never reachable from the UI.
 *
 * `seedDesignRun` reproduces the design canvases' own story (`Campaign - *.dc.html`): Hawkeye and Spider-Woman,
 * issue #1 won on the first try (Hawkeye takes Emergency Teleporter, Spider-Woman Tactical Scanner), issue #2 lost
 * once and then won (Hawkeye takes Upgrade Attack, Spider-Woman Upgrade Thwart), with issue #3 up next. `"finished"`
 * carries on through all five issues so the Finale has a won run to show.
 *
 * Each game is a real game started through `EngineSessionCore` and folded through the real runner; only the
 * verdict of a "won" game is substituted, exactly as `@mc/cards`' `trors.test.ts` does, because nothing here can
 * play a scenario to a win.
 */
import type {
  CampaignChoiceAnswer,
  CampaignDefinition,
  CampaignPendingChoice,
  CardInstance,
  GameEvent,
  GameState,
  InstanceId,
  LogFieldDef,
} from "@mc/engine";
import { createCampaignLog, NO_STATUSES } from "@mc/engine";
import { campaignId, cardId, scenarioId, type AnyCard, type CardId, type Deck } from "@mc/content";
import { CARDS_BY_ID, POOL_VERSION } from "../content/pool.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { CAMPAIGN_STORAGE_SCHEMA, type CampaignRecord } from "../engine/campaign-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { preconDecks } from "../view/deck-list-model.js";
import type { CampaignService, CampaignStepResult } from "./campaign-service.js";

export type DesignRunStop = "fresh" | "issue1Composed" | "afterIssue1" | "afterIssue2" | "lostIssue3" | "finished";

/** MC10's TECH (p. 5) and "Basic" Condition (p. 7) upgrades, by what the design's heroes took. */
const DESIGN_PICKS: Readonly<Record<string, Readonly<Record<number, readonly string[]>>>> = {
  tech: { 1: ["04157"], 2: ["04156"] },
  basic: { 1: ["04160a"], 2: ["04159a"] },
};

/** The design's pick where it has one; otherwise decline anything optional and take the first option. */
function autoAnswer(choice: CampaignPendingChoice): CampaignChoiceAnswer {
  const scripted = DESIGN_PICKS[choice.slot]?.[choice.seatNumber ?? 0];
  const picked = scripted?.every((id) => choice.options.includes(id))
    ? scripted
    : choice.optional
      ? []
      : choice.options.slice(0, choice.count);
  return { instructionId: choice.instructionId, slot: choice.slot, seatNumber: choice.seatNumber, picked };
}

async function settleWith(
  step: (answers: readonly CampaignChoiceAnswer[]) => Promise<CampaignStepResult>,
  answerFor: (choice: CampaignPendingChoice) => CampaignChoiceAnswer,
): Promise<CampaignRecord> {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 48; guard++) {
    const result = await step(answers);
    if (result.kind === "done") return result.record;
    answers.push(answerFor(result.choice));
  }
  throw new Error("the campaign asked more than 48 questions in one step");
}

const settle = (step: (answers: readonly CampaignChoiceAnswer[]) => Promise<CampaignStepResult>) =>
  settleWith(step, autoAnswer);

async function playIssueWith(
  service: CampaignService,
  record: CampaignRecord,
  outcome: "win" | "loss",
  answerFor: (choice: CampaignPendingChoice) => CampaignChoiceAnswer,
  /**
   * Applied to the substituted win state before it's folded — the same "hand a real `GameState` to the runner"
   * approach the win-outcome swap below already uses, so a fixture can seed a scenario-specific victory-display
   * fact (e.g. `withHeadhunterDefeated`) without writing to the campaign log directly.
   */
  transformWon: (state: GameState) => GameState = (state) => state,
  /**
   * Extra `GameEvent`s handed to `foldState` alongside the substituted win — a campaign query like
   * `cardsThatEnteredPlay` (MC21 p. 7's own Security Breach condition) reads the *event log*, not just the final
   * state, so a fixture that needs one true has to hand the runner a real event, not just a state fact. Takes the
   * real post-setup state so a synthetic event can reference a real instance id from it (never a fabricated one).
   */
  eventsFor: (state: GameState) => readonly GameEvent[] = () => [],
): Promise<CampaignRecord> {
  const composed = await settleWith((answers) => service.compose(record, answers), answerFor);
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  const started = await core.start(service.launchConfig(composed));
  if (outcome === "loss") {
    const conceded = core.dispatch({ type: "concede", playerId: started.snapshot.state.firstPlayerId });
    if (!conceded.ok) throw new Error(conceded.error.message);
    const saved = core.save();
    return settleWith((answers) => service.fold(composed, saved, answers), answerFor);
  }
  const preWin: GameState = { ...started.snapshot.state, cardPool: started.cardPool };
  const won: GameState = transformWon({ ...preWin, outcome: { result: "win", reason: "villainDefeated" } });
  return settleWith((answers) => service.foldState(composed, won, eventsFor(preWin), answers), answerFor);
}

const playIssue = (service: CampaignService, record: CampaignRecord, outcome: "win" | "loss") =>
  playIssueWith(service, record, outcome, autoAnswer);

export type GmwRunStop =
  | "fresh"
  | "afterIssue1"
  | "afterIssue2"
  | "afterIssue2HeadhuntersDown"
  | "afterIssue3"
  | "afterIssue4"
  | "expertAfterIssue1"
  | "lostIssue3"
  | "finished";

/**
 * The Market's own choices default to "decline" under `autoAnswer` (every `choose` slot in
 * `marketShoppingSetup`, `packages/cards/src/campaigns/gmw.ts`, is optional). For a fixture that should show real
 * purchases in the Dossier/Deck edit screens, this instead takes the *first* offered card at every affordable
 * tier — never a named card (the shape of `THE_MARKET`'s pool is data this file has no business hard-coding).
 */
function gmwAutoAnswer(choice: CampaignPendingChoice): CampaignChoiceAnswer {
  if (choice.slot.startsWith("market-") && choice.optional && choice.options.length > 0) {
    return {
      instructionId: choice.instructionId,
      slot: choice.slot,
      seatNumber: choice.seatNumber,
      picked: choice.options.slice(0, 1),
    };
  }
  return autoAnswer(choice);
}

/** MC16 p. 8's minion: `headhunterLadder`'s own setup only ever shuffles it into the *encounter deck*, so by the
 * time a scenario's fake "win" substitutes a state (before the card is ever drawn, let alone defeated), no real
 * instance of it exists to move into the victory display. */
const BADOON_HEADHUNTER_ID = cardId("16183");

/**
 * Fabricates a won state where the Badoon Headhunter minion (16183) is in the victory display —
 * `headhunterRecordVictory`'s own condition (MC16 p. 8/p. 10/p. 12/p. 14: "If Badoon Headhunter is in the victory
 * display, mark the box…") — the same "hand the runner a real `GameState`" substitution `playIssueWith`'s win
 * branch already uses for the villain-defeated outcome itself, not a write to `CampaignLog.shared` directly. The
 * instance itself is fabricated (a fresh id, no home in the real setup this state never played out) because there
 * is no way to *actually* defeat a minion inside a substituted win — `campaignResultOf`'s query only reads the
 * card's id and its presence in `state.victoryDisplay`, so a minimal, correctly-shaped instance answers it exactly
 * as a real one would.
 */
function withHeadhunterDefeated(state: GameState): GameState {
  const instance: CardInstance = {
    instanceId: "fixture-headhunter-defeated" as InstanceId,
    cardId: BADOON_HEADHUNTER_ID,
    ownerId: null,
    controllerId: null,
    home: { kind: "activeEncounterDeck" },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: NO_STATUSES,
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
  };
  return {
    ...state,
    instances: { ...state.instances, [instance.instanceId]: instance },
    victoryDisplay: [...state.victoryDisplay, instance.instanceId],
  };
}

/**
 * The Galaxy's Most Wanted (MC16), Groot and Rocket Raccoon: `"afterIssue1"` reaches the Market with units unspent
 * (issue 1's own victory grants units but nothing has been composed against issue 2 yet — the Market's own
 * `choose`/`spend`/`grantCard` loop is issue 2's *setup*, run the next time this record is composed). `"afterIssue2"`
 * plays through to issue 2 as well, taking the cheapest affordable Market card each visit
 * (`gmwAutoAnswer`), so the Dossier and Deck edit screens have real purchases and campaign cards to show.
 * `"afterIssue2HeadhuntersDown"` plays the same two issues but with `withHeadhunterDefeated` applied to both wins,
 * so `headhunterDefeated` reaches 2 and the Dossier's Bounty Ladder panel has real ACTIVE/NOT YET rungs to show
 * (`"afterIssue2"` alone always shows 0 marks — a substituted win never puts anything in a real victory display).
 * `"expertAfterIssue1"` starts the run in expert mode: `packages/client/src/view/campaign-deck-edit-model.ts`'s
 * `frozenNonCampaignCardsOf` needs a history entry for scenario 1, which only exists once it has been played.
 * `"lostIssue3"` plays issues 1–2 to a win, then loses issue 3 ("escape-the-museum") once — a real, foldable loss
 * for Rewind (C09) to read, on an issue whose `comicBeats` point at a real page (`02-museum`) so the screen's
 * torn-panel art has something to crop.
 * `"afterIssue3"` plays through issue 3 as well, so the next issue composed against this record is #4
 * ("nebula") — `seedGmwWonGame`'s own default stop, so its own Aftermath page (`04-knowhere`) is reachable.
 * `"finished"` plays through all five issues to a win, the way `seedDesignRun`'s own `"finished"` stop does, so the
 * GMW Finale (reached only from a `status: "won"` run) has something to open.
 */
export async function seedGmwRun(
  service: CampaignService,
  stop: GmwRunStop = "afterIssue1",
  options: { readonly expertCampaign?: boolean } = {},
): Promise<CampaignRecord> {
  const decks = preconDecks(POOL_VERSION);
  const deck = (hero: string) => {
    const found = decks.find((candidate) => (candidate.id as string).includes(hero));
    if (!found) throw new Error(`no precon for ${hero}`);
    return { identityCardId: found.identityCardId, deck: found };
  };
  let record = await service.start({
    campaignId: "gmw",
    seats: [deck("groot"), deck("rocket-raccoon")],
    expertCampaign: options.expertCampaign ?? stop === "expertAfterIssue1",
    poolVersion: POOL_VERSION,
    seed: 1616,
  });
  if (stop === "fresh") return record;
  const headhuntersDown = stop === "afterIssue2HeadhuntersDown";
  record = await playIssueWith(
    service,
    record,
    "win",
    gmwAutoAnswer,
    headhuntersDown ? withHeadhunterDefeated : undefined,
  );
  if (stop === "afterIssue1" || stop === "expertAfterIssue1") return record;
  record = await playIssueWith(
    service,
    record,
    "win",
    gmwAutoAnswer,
    headhuntersDown ? withHeadhunterDefeated : undefined,
  );
  if (stop === "afterIssue2" || stop === "afterIssue2HeadhuntersDown") return record;
  if (stop === "lostIssue3") return playIssueWith(service, record, "loss", gmwAutoAnswer);
  record = await playIssueWith(service, record, "win", gmwAutoAnswer);
  if (stop === "afterIssue3") return record;
  record = await playIssueWith(service, record, "win", gmwAutoAnswer);
  if (stop === "afterIssue4") return record;
  while (record.status === "active") record = await playIssueWith(service, record, "win", gmwAutoAnswer);
  return record;
}

/** Stores a run at `stop` and returns it. Each call makes a new run. */
export async function seedDesignRun(
  service: CampaignService,
  stop: DesignRunStop = "afterIssue2",
  options: { readonly expertCampaign?: boolean } = {},
): Promise<CampaignRecord> {
  const decks = preconDecks(POOL_VERSION);
  const deck = (hero: string) => {
    const found = decks.find((candidate) => (candidate.id as string).includes(hero));
    if (!found) throw new Error(`no precon for ${hero}`);
    return { identityCardId: found.identityCardId, deck: found };
  };
  let record = await service.start({
    campaignId: "trors",
    seats: [deck("hawkeye"), deck("spider-woman")],
    expertCampaign: options.expertCampaign ?? false,
    poolVersion: POOL_VERSION,
    seed: 2026,
  });
  if (stop === "fresh") return record;
  if (stop === "issue1Composed") return settle((answers) => service.compose(record, answers));
  record = await playIssue(service, record, "win");
  if (stop === "afterIssue1") return record;
  record = await playIssue(service, record, "loss");
  record = await playIssue(service, record, "win");
  if (stop === "afterIssue2") return record;
  if (stop === "lostIssue3") return playIssue(service, record, "loss");
  while (record.status === "active") record = await playIssue(service, record, "win");
  return record;
}

// ---------------------------------------------------------------------------------------------------------------
// A real, unfolded win — reachable through the live `appSession().store`, not just this file's own `foldState`
// shortcut. `main.ts`'s dev-only `__mcCampaign.seedGmwWon`/`seedDesignWon` write `WonGame.won` as a save's own
// replay baseline (0 commands) and resume the live store from it, so `CampaignAftermathScene` runs a *real*
// `fold` against a live game exactly as a played-and-won game would — the seed only stands in for playing the
// scenario to a win, never for anything downstream of that.
// ---------------------------------------------------------------------------------------------------------------

export interface WonGame {
  /** Composed for the issue this win is for (`record.attempt` set) — never folded by this file. */
  readonly record: CampaignRecord;
  /** `outcome: { result: "win", … }`, otherwise a real post-setup state — the same substitution `playIssueWith`'s
   * win branch already makes, here left unfolded for a caller to save and resume into instead. */
  readonly won: GameState;
}

/** Composes `record`'s own next issue for real, then fabricates its win the same way `playIssueWith` does. */
async function composeAndFabricateWin(
  service: CampaignService,
  record: CampaignRecord,
  answerFor: (choice: CampaignPendingChoice) => CampaignChoiceAnswer,
): Promise<WonGame> {
  const composed = await settleWith((answers) => service.compose(record, answers), answerFor);
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  const started = await core.start(service.launchConfig(composed));
  const won: GameState = {
    ...started.snapshot.state,
    cardPool: started.cardPool,
    outcome: { result: "win", reason: "villainDefeated" },
  };
  return { record: composed, won };
}

/**
 * `record`'s own next issue, composed for real (Market/heal offers declined-or-cheapest via `gmwAutoAnswer`, the
 * same policy `seedGmwRun`'s own issue-to-issue transitions use) but neither started nor won — the composed record
 * alone, for a caller that wants to run `service.launchConfig(composed)` through a real `EngineSessionCore` itself
 * (the client-layer `start.encounterSets` regression coverage below needs the actual launched `GameState`, not a
 * substituted win).
 */
export async function seedGmwComposed(service: CampaignService, record: CampaignRecord): Promise<CampaignRecord> {
  return settleWith((answers) => service.compose(record, answers), gmwAutoAnswer);
}

/**
 * `stop`'s own next issue, composed and won for real but not folded — defaults to `"afterIssue3"`, so the game
 * this returns is issue #4 ("nebula"), the Aftermath page (`04-knowhere`) this box's own comic pass added.
 */
export async function seedGmwWonGame(
  service: CampaignService,
  stop: GmwRunStop = "afterIssue3",
  options: { readonly expertCampaign?: boolean } = {},
): Promise<WonGame> {
  const record = await seedGmwRun(service, stop, options);
  return composeAndFabricateWin(service, record, gmwAutoAnswer);
}

/** MC10's own equivalent, for proving its plain Aftermath is unchanged through the same live-store path. */
export async function seedDesignWonGame(
  service: CampaignService,
  stop: DesignRunStop = "afterIssue2",
  options: { readonly expertCampaign?: boolean } = {},
): Promise<WonGame> {
  const record = await seedDesignRun(service, stop, options);
  return composeAndFabricateWin(service, record, autoAnswer);
}

// ---------------------------------------------------------------------------------------------------------------
// The Mad Titan's Shadow (MC21), Spectrum and Adam Warlock — real, played-and-folded games (wave 4 is registered
// in the playable pool as of `client, cards: wire wave 4 into @mc/cards' playable pool and the client's pool.ts`),
// the same "real game, substituted win" shape every other box's fixture above already uses. The one addition MC21
// needs: three of its own campaign-pool victory conditions read a fact a bare win substitution doesn't produce on
// its own (a side scheme "was defeated", a card "is in the victory display"), so each issue's own `transformWon`
// edits the *real* post-setup state to match, by instance id, rather than fabricating a whole card the way
// `withHeadhunterDefeated` above does for MC16 — MC21's own facts are all about a side scheme this game already
// set up for real, never a card no real instance of exists.
// ---------------------------------------------------------------------------------------------------------------

export type MtsRunStop = "fresh" | "afterIssue2" | "afterIssue3" | "beforeFinale";

const cardOf = (id: CardId): AnyCard | undefined => CARDS_BY_ID.get(id as string);

/** The first real instance whose card is named `name` — `campaign-pool-model.ts`'s own "a pool field names a card,
 * never an id" applies here too: the printed instructions this fixture is standing in for name a card by name. */
function instanceNamed(state: GameState, name: string): InstanceId | null {
  for (const [instanceId, instance] of Object.entries(state.instances)) {
    if (cardOf(instance.cardId)?.name === name) return instanceId as InstanceId;
  }
  return null;
}

/**
 * Stands in for "the players defeated `name`" (MC21 p. 7's Cosmo/p. 13's Shawarma/p. 21's Norn Stone conditions):
 * removes the real side scheme instance this scenario's own setup put into play from `villainArea`, the one place
 * `cardsInPlay` (`packages/engine/src/select.ts`) reads a side scheme from. A name this scenario's setup never
 * actually put into play (a typo, or the wrong issue) leaves the state untouched rather than throwing — the pool
 * field simply won't resolve true, which is the same outcome a real game that failed to defeat it would produce.
 *
 * Pair with `schemeDefeatedEventFor` (same `name`, called against the *pre-transform* state) — `notDefeated`
 * (`@mc/cards`' `campaigns/mts.ts`) reads the defeat off the event log (`cardsDefeated`), not off `villainArea`,
 * so removing the instance here is necessary for "not in play" but not sufficient on its own for the pool field.
 */
function withSideSchemeDefeated(state: GameState, name: string): GameState {
  const id = instanceNamed(state, name);
  if (!id) return state;
  return { ...state, villainArea: state.villainArea.filter((candidate) => candidate !== id) };
}

/**
 * A synthetic `schemeDefeated` event for the real side scheme instance named `name` — the event `notDefeated`
 * (`@mc/cards`' `campaigns/mts.ts`) actually reads, since a substituted win produces no defeat resolution of its
 * own. Read against the *pre-transform* state (before `withSideSchemeDefeated`/`withSideSchemeFlippedAndDefeated`
 * edits it), so the recorded `cardId` is the scheme's face at the moment of defeat — Find the Norn Stones' own id,
 * never Retrieve Odin's Armor's, matching `cardsDefeated`'s own "the card it was at the moment of defeat".
 */
function schemeDefeatedEventFor(state: GameState, name: string): readonly GameEvent[] {
  const id = instanceNamed(state, name);
  if (!id) return [];
  return [{ type: "schemeDefeated", instanceId: id, cardId: state.instances[id]!.cardId }];
}

/**
 * Stands in for "the players defeated both sides of `name`, ending on its flip face, in the victory display"
 * (MC21 p. 21's own Norn Stone *and* Odin conditions — Find the Norn Stones' own "When Defeated: flip this card
 * over" turns it into Retrieve Odin's Armor, and only *that* side's own defeat sends it to the victory display;
 * collapsed into one edit here since nothing else in this fixture needs the intermediate flipped-but-still-in-play
 * moment). Flips the real instance to its printed other face and moves it from `villainArea` to `victoryDisplay`,
 * the same two places `cardsInPlay`/`cardsInVictoryDisplay` read a side scheme from.
 */
function withSideSchemeFlippedAndDefeated(state: GameState, name: string): GameState {
  const id = instanceNamed(state, name);
  if (!id) return state;
  const instance = state.instances[id]!;
  const otherFaceId = cardOf(instance.cardId)?.otherFaceId;
  if (!otherFaceId) return state;
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...instance, cardId: otherFaceId, flipped: true } },
    villainArea: state.villainArea.filter((candidate) => candidate !== id),
    victoryDisplay: [...state.victoryDisplay, id],
  };
}

/**
 * Stands in for "Attack on Knowhere 1B was completed" (MC21 p. 7's own Security Breach condition, the one MC21
 * pool condition that reads the *event log* — `cardsThatEnteredPlay` — rather than the final state): a synthetic
 * `cardEntersPlay` trigger event for the real "The Power Stone" instance this scenario's own setup already set
 * aside (the main scheme's own flip side), the same event kind `packages/engine/src/setup-steps.ts`'s own
 * `announce` call raises for a card entering play for real. Empty when this scenario has no such instance (the
 * wrong issue, or a name that changed) — `foldState` with no matching event is exactly what a game that never
 * reached that main scheme stage would report.
 */
function enteredPlayEventsFor(state: GameState, name: string): readonly GameEvent[] {
  const id = instanceNamed(state, name);
  if (!id) return [];
  return [
    { type: "triggerEvent", phase: "resolved", event: { kind: "cardEntersPlay", instanceId: id, playerId: null } },
  ];
}

const mtsDeck = (hero: string): { readonly identityCardId: CardId; readonly deck: Deck } => {
  const decks = preconDecks(POOL_VERSION);
  const found = decks.find((candidate) => (candidate.id as string).includes(hero));
  if (!found) throw new Error(`no precon for ${hero}`);
  return { identityCardId: found.identityCardId, deck: found };
};

/**
 * Forces `fields` true directly on a *real, already-folded* record — the one remaining exception (narrowed to
 * `securityBreachInPool` alone, see `seedMtsRun`'s own doc comment for why): a pool condition this fixture's own
 * `transformWon` edits can't reach because the fact it needs only exists once the engine has actually resolved a
 * main scheme's stage advance, which never happens in a game whose win is fabricated at the post-setup state.
 */
async function patchPoolFields(
  service: CampaignService,
  record: CampaignRecord,
  fields: Readonly<Record<string, boolean>>,
): Promise<CampaignRecord> {
  const patched: CampaignRecord = {
    ...record,
    shared: {
      ...record.shared,
      ...Object.fromEntries(Object.entries(fields).map(([field, value]) => [field, { kind: "flag", value }])),
    },
    updatedAt: Date.now(),
  };
  await service.storage.put(patched);
  return (await service.load(patched.id))!;
}

/**
 * `"afterIssue2"`: issue #1 (Ebony Maw) and #2 (Tower Defense) played and folded for real, each with the one state
 * edit its own victory bullet needs — Cosmo/Security Breach for #1, Shawarma for #2. Black Swan needs no edit at
 * all: "If Black Swan is NOT in the victory display" (MC21 p. 13) is already true of any fresh, unplayed victory
 * display. `"afterIssue3"` plays on through #3 (Thanos, no edit needed either — System Shock's own "Defensive
 * Protocols is NOT in the victory display" is the same free condition Black Swan's was), so the next issue composed
 * against this record is #4 ("hela"). `"beforeFinale"` plays #4 as well (Hela, Norn Stone/Odin's shared
 * flip-and-defeat edit), so the next issue composed is the finale ("loki"). Almost every pool field these issues
 * need is now a real fact off a real played-and-folded game: `campaignLaunchConfig` carries the composed encounter
 * sets into the launch path, so each side scheme setup instruction (`putSideSchemeIntoPlay`) finds a real instance,
 * and `schemeDefeatedEventFor` hands `foldState` the synthetic defeat event `notDefeated` reads. `patchPoolFields`
 * (below) is kept, narrowed to `securityBreachInPool` alone: "Attack on Knowhere 1B was completed" reads a real
 * main-scheme *stage advance* (`cardsThatEnteredPlay` for The Power Stone, its flip side), which a substituted win
 * fabricated at the post-setup state — before any stage ever advances — cannot produce, encounter-sets fix or not.
 */

export async function seedMtsRun(service: CampaignService, stop: MtsRunStop = "afterIssue2"): Promise<CampaignRecord> {
  let record = await service.start({
    campaignId: "mts",
    seats: [mtsDeck("spectrum"), mtsDeck("adam-warlock")],
    poolVersion: POOL_VERSION,
    seed: 2121,
  });
  if (stop === "fresh") return record;

  // The launch path now sets the campaign's own side schemes aside for real (`campaignLaunchConfig` carries
  // `CampaignGameStart.encounterSets`, `session-core.ts`'s `scenarioFor` turns them into `setAside` cards), so
  // `putSideSchemeIntoPlay` finds a real instance of each and a synthetic `schemeDefeated` event
  // (`schemeDefeatedEventFor`) is enough to drive `notDefeated` — Cosmo/Shawarma need no pool-field patching here
  // anymore. `enteredPlayEventsFor("The Power Stone")` still can't produce a real stage-advance fact from a
  // substituted win (see the module doc comment above), so `securityBreachInPool` is patched directly below.
  record = await playIssueWith(
    service,
    record,
    "win",
    autoAnswer,
    (state) => withSideSchemeDefeated(state, "Secure the Landing Pad"),
    (state) => [
      ...enteredPlayEventsFor(state, "The Power Stone"),
      ...schemeDefeatedEventFor(state, "Secure the Landing Pad"),
    ],
  );
  if (!(record.shared.securityBreachInPool?.kind === "flag" && record.shared.securityBreachInPool.value)) {
    record = await patchPoolFields(service, record, { securityBreachInPool: true });
  }
  record = await playIssueWith(
    service,
    record,
    "win",
    autoAnswer,
    (state) => withSideSchemeDefeated(state, "Save the Shawarma Place"),
    (state) => schemeDefeatedEventFor(state, "Save the Shawarma Place"),
  );
  if (stop === "afterIssue2") return record;

  record = await playIssueWith(service, record, "win", autoAnswer);
  if (stop === "afterIssue3") return record;

  record = await playIssueWith(
    service,
    record,
    "win",
    autoAnswer,
    (state) => withSideSchemeFlippedAndDefeated(state, "Find the Norn Stones"),
    (state) => schemeDefeatedEventFor(state, "Find the Norn Stones"),
  );
  return record;
}

/** `stop`'s own next issue, composed for real (`service.compose`). */
export async function seedMtsComposed(
  service: CampaignService,
  stop: MtsRunStop = "afterIssue2",
): Promise<CampaignRecord> {
  const record = await seedMtsRun(service, stop);
  return settle((answers) => service.compose(record, answers));
}

// ---------------------------------------------------------------------------------------------------------------
// Hidden-evidence envelope (campaign design Q4) — a synthetic box, not a real one
// ---------------------------------------------------------------------------------------------------------------

/**
 * A one-node, no-content synthetic box: MC50 (the first real hidden-log box) isn't scripted yet
 * (`view/campaign-hidden-evidence-model.ts`'s own doc comment). Exercises the generic contract — a `hidden`
 * `cardList` field plus this build's own `<id>Revealed` reveal convention — against a real `CampaignRecord`, the
 * way `view/campaign-hidden-evidence-model.test.ts` exercises it against a bare `CampaignLog` slice. Never in
 * `@mc/content`'s `CAMPAIGN_RECORDS` or `@mc/cards`' shipped `campaignDefinitionOf`: `session.ts`'s
 * `registerDevCampaignDefinition` is the only way `campaignService()` ever learns this id, and that registration is
 * itself a no-op outside `import.meta.env.DEV`.
 */
export const HIDDEN_EVIDENCE_FIXTURE_CAMPAIGN_ID = campaignId("dev-hidden-evidence");

const HIDDEN_EVIDENCE_FIELD: LogFieldDef = {
  id: "sealedEvidence",
  label: "A.I.M.",
  scope: "shared",
  type: { kind: "cardList" },
  hidden: true,
  citation: "dev fixture, not a printed box",
};

const HIDDEN_EVIDENCE_REVEALED_FIELD: LogFieldDef = {
  id: "sealedEvidenceRevealed",
  label: "A.I.M. unmasked",
  scope: "shared",
  type: { kind: "flag" },
  citation: "dev fixture, not a printed box",
};

/** Three real Core cards standing in for MC50's own "secret" cards — the point is the envelope, not their text. */
const HIDDEN_EVIDENCE_CARD_IDS: readonly CardId[] = [cardId("01003"), cardId("01004"), cardId("01005")];

export const HIDDEN_EVIDENCE_DEFINITION: CampaignDefinition = {
  campaignId: HIDDEN_EVIDENCE_FIXTURE_CAMPAIGN_ID,
  version: "dev-1",
  logFields: [HIDDEN_EVIDENCE_FIELD, HIDDEN_EVIDENCE_REVEALED_FIELD],
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "dev-issue",
        label: "Dev Fixture Issue",
        scenario: { kind: "fixed", scenarioId: scenarioId("rhino") },
        setup: [],
        victory: [],
      },
    ],
  },
  loss: { retry: "free", retryBaseline: "nodeStart" },
};

/**
 * A run of the synthetic box above, sealed or revealed (`view/campaign-hidden-evidence-model.ts`'s `<id>Revealed`
 * convention) — Dossier's overview and Briefing's top bar both read it straight off `CampaignLog.hidden`/`shared`,
 * so a single stored record demos both screens. `service` must already resolve
 * `HIDDEN_EVIDENCE_FIXTURE_CAMPAIGN_ID` (`session.ts`'s `registerDevCampaignDefinition`, called once by whichever
 * dev entry point seeds this); this function only builds and stores the record, the same `service.storage.create`
 * every other seat write in this file already uses.
 */
export async function seedHiddenEvidenceFixture(service: CampaignService, revealed: boolean): Promise<CampaignRecord> {
  const decks = preconDecks(POOL_VERSION);
  const seat = decks.find((deck) => (deck.id as string).includes("spider-man")) ?? decks[0]!;
  const log = createCampaignLog(HIDDEN_EVIDENCE_DEFINITION, {
    id: `dev-hidden-evidence-${revealed ? "revealed" : "sealed"}`,
    seats: [
      {
        seatNumber: 1,
        identityCardId: seat.identityCardId,
        deck: { identityCardId: seat.identityCardId, aspects: seat.aspects, cards: seat.cards },
      },
    ],
    modes: {},
    poolVersion: POOL_VERSION,
    seed: 1,
  });
  const at = Date.now();
  const record: CampaignRecord = {
    ...log,
    hidden: { sealedEvidence: { kind: "cardList", cardIds: HIDDEN_EVIDENCE_CARD_IDS } },
    ...(revealed ? { shared: { sealedEvidenceRevealed: { kind: "flag", value: true as const } } } : {}),
    recordSchema: CAMPAIGN_STORAGE_SCHEMA,
    name: "Dev Fixture: Hidden Evidence",
    box: "DEV",
    createdAt: at,
    updatedAt: at,
  };
  await service.storage.create(record);
  return record;
}
