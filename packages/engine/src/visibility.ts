/**
 * Who may see a card's face — as a rule over zones, owned by the engine.
 *
 * `CardInstance.faceup` is about the *table*, not about who is looking: a card in a hand is not faceup, and a card in
 * a discard pile may never have been turned over, yet both are things a player is plainly entitled to read. So
 * visibility is a question of zone first and of that flag second:
 *
 *  - a hand and any discard pile are open (RRG 1.8 "Discard Pile", p. 16: "Each discard pile is open information, and
 *    may be looked at by any player at any time"), as is the victory display (p. 47);
 *  - a deck is closed (p. 15 "Deck", p. 17 "Encounter Deck": a deck's order is secret), *except* for the cards an open
 *    decision is offering out of it — an ability that instructs a player to look at or search a deck lets that player
 *    read those cards (p. 27 "Look, Looked-At"), and the shuffle afterwards is what keeps the order secret; and for
 *    the top card of a player deck kept faceup by a card ("Play with the top card of your deck faceup",
 *    `RuleSpec topOfDeckFaceup`, docs/phase7-wave8.md §3.48), which every player sees while that rule holds, as they
 *    do the top card of the encounter deck under the same rule ("Play with the top card of the encounter deck
 *    faceup", `deck: "encounter"`, docs/phase7-wave9.md §3.42);
 *  - a card being played or resolving from out of play (a player's `resolving` area: an event while it resolves, RRG
 *    1.8 "Event", p. 19; a card played off the top of a deck; an Invocation whose Special is resolving) is on the table
 *    for every player to read, though nothing sets its `faceup` flag;
 *  - a set-aside card (the scenario's, or a player's nemesis set) that an open decision is offering is read by the
 *    player deciding ("add one set-aside ally to your hand": they choose among faces), as a card offered out of a
 *    deck is;
 *  - a facedown encounter card dealt to a player is closed, except while a look offers it ("look at each encounter
 *    card dealt to each player", docs/phase7-wave9.md §3.12), and then to the looking player alone; a facedown boost
 *    card on an enemy is the same ("look at that card and the top card of the encounter deck", §3.44);
 *  - a player's own card facedown in their own play area with no disguising role (Spectrum's inactive energy forms,
 *    issue #308) or attached facedown (George Stacy's events) is open, as its owner knows its face;
 *  - everything else is open exactly when it is faceup, which covers a tucked card and a
 *    set-aside nemesis set without naming any of them. Being offered by a decision does not open any of these: only
 *    the deck, dealt-card and set-aside arms read the open decision.
 *
 * **A look is one player's.** RRG 1.8 "Look, Looked-At" (p. 27): "only the player who is resolving the ability can
 * look at those cards". So while the open decision is a look (`ChoicePrompt lookAt` or `rearrange`), a named viewer
 * who is not the looking player sees none of its cards, in a deck or dealt. With no viewer named the deck arms keep
 * the table's answer (see "Whose eyes"). `lookedAtBy` lists the cards an open look shows a player.
 *
 * This lives in the engine because two things need the same answer and must not fork: the client's card rendering
 * (`view/visibility.ts` delegates here) and `preview()`'s truncation rule, which is the thing that stops an outcome
 * preview from quietly peeking at a deck.
 *
 * **Whose eyes.** Today the predicate is table-wide rather than per-player: Phase 4 is multi-handed solo, so every
 * hand at the table belongs to the one human. Phase 5 needs a viewer argument (and, more importantly, a server that
 * does not send a card the viewer may not see). The zone rules above are already written per-zone, so adding a viewer
 * is a change to two `case` arms, not a redesign.
 *
 * The one per-player permission that exists today is passed in as a `ViewerContext`: a card that only one player may
 * look at (RRG 1.8 "Look, Looked-At", p. 27: "only the player who is resolving the ability can look at those cards")
 * has no table-wide answer, so it is face-visible only when a viewer is named and the permission is that viewer's.
 * Without a viewer (the log's card names, `preview()`'s truncation) the card stays hidden.
 *
 * A card a decision offers out of a set-aside area follows the same shape: with a viewer named it is visible to the
 * player the decision belongs to and to no other viewer (p. 27 again); with no viewer named (the table, the log,
 * `preview()`) it is visible, which is the answer the deck arms have always given for an offered card and the right
 * one while one human holds every seat. A client that draws for one seat names that seat; one that draws the open
 * decision's own sheet names the decision's player or the table.
 *
 * **Hidden piles are nobody's.** A card in `GameState.hiddenPiles` (docs/phase7-wave9.md §3.29 (a); MC50 p. 5: put in
 * the envelope "**without looking at them**") is hidden from every player with no exception, and it is not an instance,
 * so `faceVisible` is never asked about it. What a player may be shown of a pile is its size (`hiddenPileViews`); what
 * a client holds or a server sends is the state with the piles' contents taken out (`sealHiddenPiles`). A card that
 * has come out of a pile (`GameState.revealedPileCards`) is open to all.
 *
 * **A hidden reverse is nobody's either.** A double-sided card whose other face no player may look at
 * (`CardInstance.reverseHidden`, docs/phase7-wave9.md §3.54; MC55 p. 7) is in play faceup and its showing face is as
 * open as any card's; its other face is hidden from every player until the card flips (`otherFaceVisible`). The
 * instance's card id is what names both faces, so a client or wire copy of the state names a stand-in instead
 * (`sealHiddenReverses`).
 *
 * A permission every player holds because of a rule on a card (the faceup top card of a deck) needs the rules read
 * but no viewer: a `TableContext` carries the deps alone. A caller that passes neither gets the answer of the zones
 * and the `faceup` flag only, in which that card is still closed.
 */

import type { CardId } from "@mc/content";
import { withoutSealedFields } from "./campaign/log.js";
import { hiddenPileOf, hiddenPileSizesOf } from "./hidden-pile-state.js";
import { otherFaceVisible, standInOf } from "./hidden-reverse.js";
import type { EngineDeps } from "./abilities.js";
import { activeEncounterDeck, cardOf, getInstance, getPlayer, locateCard } from "./query.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeRules, rulePlayers, shownDeckTop, shownEncounterTop } from "./select.js";
import type { GameState, ZoneId } from "./state.js";

/** Whose eyes: the player looking, and the deps that let their per-player permissions (rules on cards) be read. */
export interface ViewerContext {
  readonly viewer: PlayerId;
  readonly deps: EngineDeps;
}

/** The table's eyes: no one player, with the deps that let a rule every player benefits from be read. */
export interface TableContext {
  readonly deps: EngineDeps;
}

/**
 * The deck zones: closed by rule, whatever a card's `faceup` flag says. A scenario deck is one (the Red Skull rulebook,
 * p. 5: "set them facedown next to the main-scheme deck"; the show deck, docs/phase7-wave6.md §3.66).
 */
const isDeckZone = (zone: ZoneId): boolean =>
  zone.kind === "deck" || zone.kind === "encounterDeck" || zone.kind === "separateDeck" || zone.kind === "scenarioDeck";

/**
 * A card the open decision is offering is one the deciding player is looking at (RRG 1.8 "Look, Looked-At", p. 27).
 *
 * Every choice the engine opens over a deck is a real look: a search, or "look at the top 3". Deliberately not scoped
 * to deck zones here — the caller decides where it matters — because being offered a card that is facedown *in play*
 * (a facedown Drone as an attack target) does not turn it over. Nor does this ask whose decision it is:
 * `faceVisible` does, for the zones where that is the rule.
 */
export const offeredByOpenChoice = (state: GameState, id: InstanceId): boolean =>
  state.pendingChoice?.options.some(
    (option) => (option.ref.kind === "card" || option.ref.kind === "ability") && option.ref.instanceId === id,
  ) ?? false;

/**
 * The open decision offers the card to this viewer: to whoever it belongs to when a viewer is named, and to the table
 * when none is (see "Whose eyes" in the file comment).
 */
const offeredToViewer = (state: GameState, id: InstanceId, view: ViewerContext | TableContext | undefined): boolean =>
  offeredByOpenChoice(state, id) && (!view || !("viewer" in view) || state.pendingChoice?.playerId === view.viewer);

/** The open decision is a look: its options are shown, not chosen among by what they are (p. 27). */
const openLook = (state: GameState): boolean =>
  state.pendingChoice?.prompt.kind === "lookAt" || state.pendingChoice?.prompt.kind === "rearrange";

/**
 * A deck card the open decision offers, as this viewer sees it: every offered card, unless the decision is a look and
 * the viewer named is not the player looking (RRG 1.8 "Look, Looked-At", p. 27).
 */
const offeredFromDeck = (state: GameState, id: InstanceId, view: ViewerContext | TableContext | undefined): boolean =>
  openLook(state) ? offeredToViewer(state, id, view) : offeredByOpenChoice(state, id);

/**
 * The cards an open look is showing `viewer`: the looked-at cards for the player looking, and none for anyone else
 * (RRG 1.8 "Look, Looked-At", p. 27). Empty when no look is open. A client draws a look's sheet from this, so a seat
 * that is not the looking player has no card of it to draw.
 */
export function lookedAtBy(state: GameState, viewer: PlayerId): readonly InstanceId[] {
  const choice = state.pendingChoice;
  if (!choice || !openLook(state) || choice.playerId !== viewer) return [];
  return choice.options.flatMap((option) => (option.ref.kind === "card" ? [option.ref.instanceId] : []));
}

/**
 * "You may look at the top card of the encounter deck at any time" (`RuleSpec mayLookAtTopOfEncounterDeck`,
 * docs/phase7-wave5.md §3.28): the card is the active encounter deck's top card and one of the viewer's rules says so.
 */
const viewerMayLookAtEncounterTop = (
  state: GameState,
  id: InstanceId,
  view: ViewerContext | TableContext | undefined,
): boolean => {
  if (!view || !("viewer" in view) || activeEncounterDeck(state).deck[0] !== id) return false;
  return activeRules(state, view.deps, "mayLookAtTopOfEncounterDeck").some((active) =>
    rulePlayers(state, active.rule, active).includes(view.viewer),
  );
};

/**
 * "Play with the top card of your deck faceup" (`RuleSpec topOfDeckFaceup`, docs/phase7-wave8.md §3.48): the card is
 * the one that rule shows on top of its player's deck. Derived from the deck's order and the rule on each call
 * (`shownDeckTop`); the card's own `faceup` stays false. The same for every viewer, so `view` is only read for its deps.
 */
const shownOnTopOfDeck = (
  state: GameState,
  id: InstanceId,
  playerId: PlayerId,
  view: ViewerContext | TableContext | undefined,
): boolean =>
  // The deck's order is asked first, so the rules are read for one card of a deck and not for each.
  view !== undefined && getPlayer(state, playerId)?.deck[0] === id && shownDeckTop(state, view.deps, playerId) === id;

/**
 * "Play with the top card of the encounter deck faceup" (`RuleSpec topOfDeckFaceup { deck: "encounter" }`,
 * docs/phase7-wave9.md §3.42): the card is the one that rule shows on top of the active villain's encounter deck
 * (`shownEncounterTop`). The same for every viewer, so `view` is only read for its deps; another villain's deck (The
 * Wrecking Crew) is not "the encounter deck" and stays closed.
 */
const shownOnTopOfEncounterDeck = (
  state: GameState,
  id: InstanceId,
  view: ViewerContext | TableContext | undefined,
): boolean =>
  // The deck's order is asked first, so the rules are read for one card of the deck and not for each.
  view !== undefined && activeEncounterDeck(state).deck[0] === id && shownEncounterTop(state, view.deps) === id;

/**
 * Whether this table may read the card's face right now. `view` names the player looking, for the permissions only one
 * player holds, or the table (`TableContext`) for those a rule gives every player; without it the answer is the one
 * the zones and the `faceup` flag give.
 */
export function faceVisible(state: GameState, id: InstanceId, view?: ViewerContext | TableContext): boolean {
  const instance = getInstance(state, id);
  if (!instance) return false;
  const zone = locateCard(state, id);
  if (!zone) return instance.faceup;
  switch (zone.kind) {
    case "hand":
    case "discard":
    case "encounterDiscard":
    case "separateDiscard":
    case "victoryDisplay":
    // Being played, or resolving from out of play: chosen and laid on the table (RRG 1.8 "Event", p. 19).
    case "resolving":
      return true;
    case "encounterSetAside":
    case "setAside":
      return instance.faceup || offeredToViewer(state, id, view);
    case "encounterDeck":
      return (
        instance.faceup ||
        offeredFromDeck(state, id, view) ||
        viewerMayLookAtEncounterTop(state, id, view) ||
        shownOnTopOfEncounterDeck(state, id, view)
      );
    case "deck":
      return instance.faceup || offeredFromDeck(state, id, view) || shownOnTopOfDeck(state, id, zone.playerId, view);
    case "separateDeck":
    case "scenarioDeck":
      // A separate deck's top card can be faceup by its own rules (the Invocation deck), which `faceup` already says.
      // A scenario deck's card is seen only while a look offers it ("look at the top card of the show deck", Erratic
      // Teleportation, `mojo` 39019; docs/phase7-wave6.md §3.66).
      return instance.faceup || offeredFromDeck(state, id, view);
    case "dealtEncounter":
      // Facedown until revealed; a look shows it to the looking player alone (docs/phase7-wave9.md §3.12). No other
      // decision opens it: being passed or chosen as a facedown card does not turn it over.
      return instance.faceup || (openLook(state) && offeredToViewer(state, id, view));
    case "boost":
      // Facedown until the activation turns it up; a look shows it to the looking player alone ("look at that card
      // and the top card of the encounter deck", docs/phase7-wave9.md §3.44). No other decision opens it.
      return instance.faceup || (openLook(state) && offeredToViewer(state, id, view));
    case "attachment":
      // A player's own card attached facedown (George Stacy's events, docs/phase7-wave5.md §3.15) is one its owner may
      // look at and play; table-wide today, as every hand is (see "Whose eyes" above).
      return instance.faceup || (instance.facedownAs !== null && instance.ownerId !== null);
    case "playArea":
      // A player's own card put facedown into their own play area as a blank card, not as something else (Spectrum's
      // inactive energy forms, `mts` 21001b's Setup; issue #308), is one its owner placed knowing its face, so its face
      // hides nothing from them. A card in play as a facedown minion (a Controlled minion) stays closed. Engine
      // interpretation: RRG 1.8 has no entry on looking at your own facedown cards (p. 23 "In Play and Out of Play" says
      // only where a facedown card is), so this follows the attachment arm above.
      return (
        instance.faceup ||
        ((instance.facedownAs === null || instance.facedownAs.kind === "blank") &&
          instance.ownerId !== null &&
          instance.ownerId === zone.playerId)
      );
    default:
      return instance.faceup;
  }
}

/**
 * The card is inside a closed deck: its identity is not derivable from anything a player may look at.
 *
 * This is the half of the rule `preview()` truncates on. It is deliberately about *zones*, not about a list of risky
 * event kinds, so it cannot rot as new effects are added.
 */
export const zoneHidden = (state: GameState, id: InstanceId, view?: ViewerContext | TableContext): boolean => {
  const zone = locateCard(state, id);
  return zone !== null && isDeckZone(zone) && !faceVisible(state, id, view);
};

/**
 * The card is out of a deck but has never been turned over: a facedown boost card, a dealt encounter card, a facedown
 * Drone, a tucked card, a set-aside nemesis set card. Turning one of these faceup is a reveal.
 */
export const faceHidden = (state: GameState, id: InstanceId): boolean => {
  const zone = locateCard(state, id);
  return zone !== null && !isDeckZone(zone) && !faceVisible(state, id);
};

/** What every player may know of one hidden pile: that it is there, and how many cards it holds. */
export interface HiddenPileView {
  readonly pile: string;
  readonly size: number;
}

/**
 * The hidden piles as a player sees them (docs/phase7-wave9.md §3.29 (a)): each pile's name and size, in the order the
 * piles were prepared, and nothing of what is in them. The same for every viewer: no player may look into a pile (MC50
 * p. 5, "without looking at them"), so there is no viewer to name. Empty in a game with no pile.
 */
export const hiddenPileViews = (state: GameState): readonly HiddenPileView[] =>
  Object.entries(hiddenPileSizesOf(state)).map(([pile, size]) => ({ pile, size }));

/**
 * A game state with the contents of its hidden piles taken out: `hiddenPiles` is absent and `hiddenPileSizes` says how
 * many cards each one holds. Everything else is the state as it is, `revealedPileCards` included.
 *
 * It has no `hiddenPiles` key in its type, so code that holds one cannot read a pile's cards, and it is assignable to
 * `GameState` (the key is optional there), so it can be handed to every engine query, to `preview()` and to
 * `applyCommand` as it is: they read a pile through `hidden-pile-state.ts`, which answers from the sizes.
 */
export type SealedGameState = Omit<GameState, "hiddenPiles">;

/**
 * The state a player's view is built from, or that is sent to a client: the same game with no hidden pile's card in
 * it (docs/phase7-wave9.md §3.29 (a)). Not a state the engine can resume or replay from (the piles are gone): a save
 * is the full `GameState`, held by whoever is the game's authority. Returns the state itself when it has no pile, so a
 * game without one costs nothing, and when it is already sealed (sealing twice is sealing once).
 *
 * A sealed state can still be asked the engine's questions and have a command previewed on it, with the result thrown
 * away: a pile's size and whether it was prepared read the same as on the authority's state, and anything that would
 * take a card out of a pile moves placeholders, which is where `preview()` stops (`hidden-pile-state.ts`).
 *
 * It closes the piles, and the sealed values of the campaign log the game was built from (the cards a campaign's
 * piles were seeded with), and nothing else. The cards of a deck or a hand are instances with a zone, and which of
 * those a given seat may read is `faceVisible`'s question (see "Whose eyes").
 */
export function sealHiddenPiles(state: GameState): SealedGameState {
  const sealed = withoutSealedCampaignLog(state);
  if (sealed.hiddenPiles === undefined) return sealed;
  const { hiddenPiles, ...rest } = sealed;
  return {
    ...rest,
    hiddenPileSizes: hiddenPileSizesOf({ hiddenPiles }),
  };
}

/**
 * The state with the sealed values of its frozen campaign log emptied (`CampaignLogView.hidden`,
 * docs/phase7-wave9.md §3.75): each keeps its kind and says how many entries it held, and names none. The piles a
 * campaign game was seeded with came from there, so closing the piles alone would leave their cards readable in the
 * game's own campaign input. The state itself when it carries no sealed value, or only emptied ones.
 */
function withoutSealedCampaignLog(state: GameState): GameState {
  const campaign = state.campaign;
  if (campaign?.log.hidden === undefined) return state;
  const hidden = withoutSealedFields(campaign.log.hidden);
  if (hidden === campaign.log.hidden) return state;
  return { ...state, campaign: { ...campaign, log: { ...campaign.log, hidden } } };
}

/**
 * The state with each hidden-reverse card (`CardInstance.reverseHidden`) named by its stand-in (`standInOf`) instead
 * of its own card id: what a player's view is built from, or what is sent to a client, so that the other face of such
 * a card cannot be read out of the state (docs/phase7-wave9.md §3.54). The card keeps its instance id, zone, counters
 * and everything else. Returns the state itself when no card has a hidden reverse, or when each is already named by
 * its stand-in (sealing twice is sealing once).
 *
 * The card id is not the only thing that names the card: the id of an ability printed on its showing face is that
 * card's own ("55008a.hypnotic-gaze-constant-2"), and the state keeps ability ids in its bookkeeping
 * (`GameState.stateChecks` and `abilityUses`, keyed "<instance>:<ability id>"; a stack frame, an open choice, a lasting
 * effect or an event kept on a frame may name one too). So after the instances are renamed, every string in the
 * state, object keys included, has each hidden card's id and its showing face's ability ids rewritten to the
 * stand-in's (`hiddenNames`, `renameIn`); only the printed catalog (`cardPool`) and the RNG state are left alone.
 * Rewritten and not dropped, so the sealed state stays consistent with itself: the stand-in's abilities are the ones a
 * query over a sealed instance finds, and the memo of a state check or a use count is still found under them.
 *
 * The rewrite is by name, not by instance: a second copy of the same card that is not hidden would be renamed with it.
 * A hide covers a whole look-alike group of unique cards (`sameFront`), so no such copy exists today. The ids of the
 * hidden face's own abilities are not rewritten: that face is out of play until the flip and nothing may name them,
 * and naming the stand-in's other face instead would be a false answer.
 *
 * Like `sealHiddenPiles` this is not a state the authority can resume or replay from; the authority keeps the full
 * `GameState`. A client may still ask the engine questions of it or preview a command on it, and throws the result
 * away. One thing stays outside this function's reach, for whoever sends state over a wire: the game's RNG state
 * (`GameState.rng`, from which the shuffle of the look-alike cards can be recomputed) must not be sent.
 */
export function sealHiddenReverses<S extends Pick<GameState, "instances" | "cardPool">>(state: S): S {
  const names = hiddenNames(state);
  if (names.length === 0) return state;
  const sealed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    sealed[key] = UNSEALED_FIELDS.has(key) ? value : renameIn(value, names);
  }
  return sealed as S;
}

/** Top-level fields `sealHiddenReverses` passes through: the printed catalog, and the RNG state (no card is named). */
const UNSEALED_FIELDS: ReadonlySet<string> = new Set(["cardPool", "rng"]);

/** A name a hidden card goes by in the state, and the stand-in's name for the same thing. */
type Rename = readonly [from: string, to: string];

/**
 * Every name that tells a hidden-reverse card from its stand-in: the ids of the abilities on its showing face, each
 * paired with the stand-in's ability in the same printed position, then its card id. Ability ids come first because a
 * card id is usually their prefix. Empty when no card is hidden or each is its own stand-in.
 */
function hiddenNames(state: Pick<GameState, "instances" | "cardPool">): readonly Rename[] {
  const abilityIds = new Map<string, string>();
  const cardIds = new Map<string, string>();
  for (const instance of Object.values(state.instances)) {
    if (instance.reverseHidden !== true) continue;
    const standIn = standInOf(state, instance.cardId);
    if (standIn === instance.cardId) continue;
    cardIds.set(instance.cardId, standIn);
    const real = state.cardPool[instance.cardId];
    const shown = state.cardPool[standIn];
    if (!real || !shown || !("abilities" in real) || !("abilities" in shown)) continue;
    real.abilities.forEach((ref, index) => {
      const other = shown.abilities[index];
      if (other && other.id !== ref.id) abilityIds.set(ref.id, other.id);
    });
  }
  return [...abilityIds, ...cardIds];
}

const isIdCharacter = (character: string | undefined): boolean =>
  character !== undefined && /[A-Za-z0-9]/.test(character);

/** `text` with each whole occurrence of a hidden name replaced: one that is not part of a longer word or number. */
function renameText(text: string, names: readonly Rename[]): string {
  let out = text;
  for (const [from, to] of names) {
    let at = out.indexOf(from);
    while (at !== -1) {
      const whole = !isIdCharacter(out[at - 1]) && !isIdCharacter(out[at + from.length]);
      if (whole) out = out.slice(0, at) + to + out.slice(at + from.length);
      at = out.indexOf(from, at + (whole ? to.length : from.length));
    }
  }
  return out;
}

/**
 * `value` with every string in it, object keys included, renamed (`renameText`). A part that names nothing hidden is
 * returned as it is, so an untouched branch of the state is shared and not copied. Should two keys of one object come
 * to the same name, the first is kept: every such map in the state is keyed by instance first, so none does.
 */
function renameIn(value: unknown, names: readonly Rename[]): unknown {
  if (typeof value === "string") return renameText(value, names);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item: unknown) => {
      const renamed = renameIn(item, names);
      if (renamed !== item) changed = true;
      return renamed;
    });
    return changed ? items : value;
  }
  let changed = false;
  const fields: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const renamedKey = renameText(key, names);
    const renamed = renameIn(item, names);
    if (renamedKey !== key || renamed !== item) changed = true;
    if (!(renamedKey in fields)) fields[renamedKey] = renamed;
  }
  return changed ? fields : value;
}

/** A game state as a client or a wire copy may hold it: `sealHiddenPiles`, then `sealHiddenReverses`. */
export const sealHiddenInformation = (state: GameState): SealedGameState => sealHiddenReverses(sealHiddenPiles(state));

/**
 * Every card id that is in a hidden pile right now: what no event a player reads, and no preview, may name. On a
 * sealed copy of the state, the placeholders its piles are read as (`hidden-pile-state.ts`), so a preview run on a
 * client's copy stops at the same event the authority's would.
 */
export const hiddenPileCardIds = (state: GameState): ReadonlySet<CardId> =>
  new Set(Object.keys(hiddenPileSizesOf(state)).flatMap((pile) => hiddenPileOf(state, pile)));

/** What a card in play facedown is called when it has no trait to be called by. */
const FACEDOWN_MINION_NAME = "Facedown minion";
const FACEDOWN_CARD_NAME = "Facedown card";

/**
 * The name the table calls a card by: what every option label, ref text and event field that names a card is built
 * from. The printed name, except for a card that is in play facedown as something else (`CardInstance.facedownAs`)
 * and whose face no player may read (`faceVisible` with no viewer): that one is named for what it is treated as, its
 * role's traits and type ("Drone minion", "Controlled minion"), or "Facedown minion" / "Facedown card" when the role
 * has no trait.
 *
 * RRG 1.8 "In Play and Out of Play" (p. 23): "If a card is double-sided, the facedown side is out of play", and a card
 * out of play has inactive text. Ruling, Jan 26, 2026 (4) answer 5: "The facedown side of a Drone is not in play and
 * does not matter." No rule lets a player look at a card put into play facedown off the top of a deck: "Look,
 * Looked-At" (p. 27) needs an ability that says so, and the ruling of Jan 11, 2026 (1) on counting a deck forbids
 * "inspect[ing] facedown cards". So the hidden printed name is nobody's to read, the controller's included, and the
 * shared prompt and the log never carry it. Once the card leaves play it is itself again (`facedownAs` null) and its
 * name is as public as its zone.
 *
 * A facedown card its owner may look at (a card attached facedown from their hand, `faceVisible`'s attachment arm)
 * keeps its printed name here, because the table's answer is the owner's while one human holds every seat (see "Whose
 * eyes" in the file comment); a per-viewer label for it is the view's job.
 */
export function displayNameOf(state: GameState, id: InstanceId): string {
  const role = getInstance(state, id)?.facedownAs;
  if (role && !faceVisible(state, id)) {
    // Traits are stored in capitals (`trait()`); the cards print them as words ("as a Drone minion").
    const traits = role.traits.map((t) => t.charAt(0) + t.slice(1).toLowerCase()).join(" ");
    if (role.kind !== "minion") return traits || FACEDOWN_CARD_NAME;
    return traits ? `${traits} minion` : FACEDOWN_MINION_NAME;
  }
  return cardOf(state, id)?.name ?? id;
}

export { otherFaceVisible };
