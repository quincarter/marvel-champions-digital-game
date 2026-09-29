/**
 * Guided mode's opportunistic tips (G10e part 1, `docs/guided-mode.md` §5.3): a short note the first time
 * something outside the five scripted lessons happens on the table, at the Full guide level only. Each tip is a
 * named, tested trigger over a `LessonObservation` (`view/lesson-model.ts` — the same `{ game, lastEvents,
 * perspectiveId }` shape the scripted lessons watch) and `GuidePrefs.seenTips`, so a controller can call this
 * alongside the lesson model with no extra state to thread through.
 *
 * **Two kinds, same as the parked prototype (`docs/guided-mode.md` §7, `cf134edf` `view/guide/game-tips.ts`):**
 *  - **Keyword and status tips come from the table's own glossary** (`rules-reference.ts`'s `rulesGlossaryOf`),
 *    generically — a new pack's keyword gets a tip for free, no copy added here. The three always-present
 *    table-state entries (exhausted, ready, facedown boost card) are excluded, same as the prototype: they would
 *    fire on the very first frame of every game, which teaches nothing.
 *  - **Situations** are read off live state and the most recent command's events: the first minion engaging, a
 *    side scheme or crisis icon in play, acceleration adding up, a boost card flipping, the villain advancing a
 *    stage, an obligation or nemesis card showing up, the first mulligan, the first Recover, hand size differing
 *    by form, and the first time an attack against you drew a card (a Spider-Sense-style interrupt, detected
 *    generically — see `drawOnAttackTip`).
 *
 * **No deps in the observation.** `LessonObservation` (deliberately) carries no `EngineDeps` — lesson predicates
 * never needed one. `tipsFor` takes its own `deps` parameter instead (G10e part 2), threaded straight through to
 * the queries that need one (`iconsInPlay`, `rulesGlossaryOf`) — the board's own mount
 * passes the session's real `EngineDeps` (`content/pool.ts`'s `POOL_DEPS`), so an ability-*granted* icon or
 * keyword counts here the same way it does everywhere else on the table, not just a printed one.
 *
 * **Never leaks hidden information** (`view/visibility.ts`'s rule, same as `view/guide-hints.ts`): nothing here
 * reads a facedown boost card's icons before it flips, or the encounter deck's order.
 *
 * **`tipsFor` is the one export a controller calls.** It returns at most one tip — the first not-yet-seen,
 * not-suppressed candidate, situations before the generic glossary catch-all, each family in the order this
 * module defines it — or an empty array when nothing new is showing, the level isn't "full", or there's no
 * perspective player yet.
 */
import type { HeroIdentityCard } from "@mc/content";
import {
  cardOf,
  getPlayer,
  heroFacesOf,
  iconsInPlay,
  minionsEngagedWith,
  type EngineDeps,
  type PlayerId,
} from "@mc/engine";
import type { GuidePrefs } from "../guide/guide-prefs.js";
import type { LessonObservation } from "./lesson-model.js";
import { rulesGlossaryOf } from "./rules-reference.js";

export interface Tip {
  readonly id: string;
  readonly title: string;
  /** `McTermText` markup (`[[id]]` / `[[id|label]]`, see `view/term-text-model.ts`). Links a glossary term where
   * one exists for the idea being taught — a couple of situations (the first mulligan) have no matching glossary
   * entry yet and are plain text; see that trigger's own comment. */
  readonly body: string;
}

const EXCLUDED_TABLE_STATE_IDS = new Set(["exhausted", "ready", "facedownBoostCard"]);

// ---------------------------------------------------------------------------
// Situations
// ---------------------------------------------------------------------------

function heroIdentityCardOf(state: LessonObservation["game"], playerId: PlayerId): HeroIdentityCard | undefined {
  const player = getPlayer(state, playerId);
  if (!player) return undefined;
  const card = cardOf(state, player.identity.instanceId);
  return card?.type === "hero_identity" ? card : undefined;
}

/** RRG 1.8 "Obligation" (p. 30): a drawn obligation goes straight to its owner's play area, not their hand. */
function obligationTip({ lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const revealed = lastEvents.some(
    (event) => event.type === "drawnObligationPlaced" && event.playerId === perspectiveId,
  );
  if (!revealed) return null;
  return {
    id: "situation:obligation",
    title: "An obligation entered play",
    body:
      "This is an obligation: an [[encounterCard|encounter card]] tied to your identity. It went straight into " +
      "your play area instead of your hand, and it usually stays there until something removes it.",
  };
}

/**
 * RRG 1.8 "Nemesis Encounter Set" (p. 30): cards written for one identity, shuffled into the encounter deck at
 * setup rather than a shared modular set. Detected by the revealed card's `encounterSetIds` matching the
 * perspective player's own identity (`HeroIdentityCard.nemesisEncounterSetId`) — the same match setup itself uses.
 */
function nemesisSetTip({ game, lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const identity = heroIdentityCardOf(game, perspectiveId);
  if (!identity) return null;
  const revealed = lastEvents.some((event) => {
    if (event.type !== "encounterCardRevealed") return false;
    const card = cardOf(game, event.instanceId);
    return (
      card !== undefined && "encounterSetIds" in card && card.encounterSetIds.includes(identity.nemesisEncounterSetId)
    );
  });
  if (!revealed) return null;
  return {
    id: "situation:nemesisSet",
    title: "Your nemesis set is in play",
    body:
      "This card is from your identity's own nemesis set: [[encounterCard|encounter cards]] written just for " +
      "your hero, shuffled into the encounter deck at setup alongside the villain's own.",
  };
}

/**
 * The first mulligan (RRG 1.8 Appendix II "Setup" step 15, p. 51): detected as leaving the setup mulligan step
 * (`stepChanged` with `from.kind === "mulligan"`) after the perspective player actually discarded at least one
 * card during it (`cardDiscardedFromHand`) — keeping a whole opening hand doesn't teach anything new. G10e part 2
 * added a `mulligan` glossary concept (`@mc/content`'s concept list, `docs/guided-mode.md` G3a) that this now links.
 */
function mulliganTip({ lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const leftMulligan = lastEvents.some(
    (event) => event.type === "stepChanged" && event.from.phase === "setup" && event.from.kind === "mulligan",
  );
  if (!leftMulligan) return null;
  const discardedMine = lastEvents.some(
    (event) => event.type === "cardDiscardedFromHand" && event.playerId === perspectiveId,
  );
  if (!discardedMine) return null;
  return {
    id: "situation:mulligan",
    title: "Mulligan",
    body:
      "At the start of the game you can take a [[mulligan|mulligan]]: discard any number of cards from your " +
      "opening hand and draw that many new ones, once, before play really begins.",
  };
}

function minionEngagedTip({ game, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  if (minionsEngagedWith(game, perspectiveId).length === 0) return null;
  return {
    id: "situation:minionEngaged",
    title: "A minion is engaged with you",
    body:
      "It stays with you until it's defeated, and it activates against you every [[villainPhase|villain phase]] " +
      "— attacking your hero, or scheming against your alter-ego.",
  };
}

function sideSchemeTip({ game }: LessonObservation): Tip | null {
  const inPlay = game.villainArea.some((id) => {
    const card = cardOf(game, id);
    return card?.type === "side_scheme" || card?.type === "player_side_scheme";
  });
  if (!inPlay) return null;
  return {
    id: "situation:sideScheme",
    title: "A side scheme is in play",
    body:
      "A [[sideScheme|side scheme]] is an extra objective next to the main scheme, with its own starting threat. " +
      "You don't have to clear it, but leaving it alone usually costs you.",
  };
}

/** RRG 1.8 "Crisis Icon" (p. 14): while any crisis icon is in play, player cards can't remove threat from the main scheme. */
function crisisTip({ game }: LessonObservation, deps: EngineDeps): Tip | null {
  if (iconsInPlay(game, deps, "crisis") <= 0) return null;
  return {
    id: "situation:crisis",
    title: "Crisis: the main scheme is locked",
    body:
      "While a crisis icon is in play, your cards can't remove [[threat|threat]] from the main scheme — clearing " +
      "whatever carries the icon comes first.",
  };
}

/**
 * Fires only once *extra* acceleration exists — `mainSchemeValue(game, "acceleration", deps)` is the main scheme's
 * own printed per-phase rate, which is nonzero on many schemes from the very first frame of the game and teaches
 * nothing on its own; the tip's own copy is about acceleration piling up *on top of* that printed rate, so the
 * trigger checks only `accelerationTokens` and any acceleration icon actually in play, not the printed value.
 */
function accelerationTip({ game }: LessonObservation, deps: EngineDeps): Tip | null {
  const extra = game.mainScheme.accelerationTokens + iconsInPlay(game, deps, "acceleration");
  if (extra <= 0) return null;
  return {
    id: "situation:acceleration",
    title: "Acceleration is adding up",
    body: "[[acceleration|Acceleration]] adds extra threat to the main scheme every villain phase, on top of its own printed rate.",
  };
}

function boostCardFlippedTip({ lastEvents }: LessonObservation): Tip | null {
  if (!lastEvents.some((event) => event.type === "boostCardFlipped")) return null;
  return {
    id: "situation:boostFlip",
    title: "A boost card flipped",
    body:
      "Enemies get a facedown [[boost|boost card]] the moment they activate. It turns face up during that " +
      "activation, adding its icons — sometimes its own effect too — to the total.",
  };
}

function villainStageAdvancedTip({ lastEvents }: LessonObservation): Tip | null {
  if (!lastEvents.some((event) => event.type === "villainStageAdvanced")) return null;
  return {
    id: "situation:villainStageAdvanced",
    title: "The villain advanced a stage",
    body: "Villains fight in stages. Defeating one flips the villain to its next stage — often stronger — instead of ending the game.",
  };
}

function recoverTip({ lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const used = lastEvents.some(
    (event) =>
      event.type === "triggerEvent" &&
      event.event.kind === "basicPowerUsed" &&
      event.event.power === "recover" &&
      event.event.playerId === perspectiveId,
  );
  if (!used) return null;
  return {
    id: "situation:recover",
    title: "You recovered",
    body: "[[recover|Recovering]] is your alter-ego's basic power to heal damage, for the cost of exhausting your alter-ego.",
  };
}

function handSizeDiffersTip({ game, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const identity = heroIdentityCardOf(game, perspectiveId);
  if (!identity) return null;
  const heroSizes = heroFacesOf(identity).map((face) => face.handSize);
  if (heroSizes.every((size) => size === identity.alterEgo.handSize)) return null;
  return {
    id: "situation:handSizeDiffers",
    title: "Hand size differs by form",
    body: "Your [[handSize|hand size]] isn't the same in hero and alter-ego form — check the number on whichever side is face up.",
  };
}

/**
 * A Spider-Sense-style "draw a card when you're attacked" interrupt, detected generically rather than by naming
 * any specific card: the perspective player's own identity was an attack's target (`attackResolved`) and that
 * same command also drew them a card (`cardDrawn`). This can't tell *why* the draw happened — deps has no ability
 * registry to hand here (this module's own header) — so it's a heuristic, not a proof that the identity's own
 * interrupt fired; good enough for a once-ever tip that never reads hidden information.
 */
function drawOnAttackTip({ game, lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const player = getPlayer(game, perspectiveId);
  if (!player) return null;
  const heroId = player.identity.instanceId;
  const wasAttacked = lastEvents.some((event) => event.type === "attackResolved" && event.targetInstanceId === heroId);
  if (!wasAttacked) return null;
  const drewACard = lastEvents.some((event) => event.type === "cardDrawn" && event.playerId === perspectiveId);
  if (!drewACard) return null;
  return {
    id: "situation:drawOnAttack",
    title: "You drew a card from that attack",
    body: "Some heroes have an interrupt that draws them a card whenever they're attacked — a small edge for being ready for it.",
  };
}

/** Every situation trigger takes `deps` even when it doesn't read one, so `tipsFor` can map over them uniformly. */
type SituationTrigger = (observation: LessonObservation, deps: EngineDeps) => Tip | null;

const SITUATION_TIPS: readonly SituationTrigger[] = [
  obligationTip,
  nemesisSetTip,
  mulliganTip,
  minionEngagedTip,
  sideSchemeTip,
  crisisTip,
  accelerationTip,
  boostCardFlippedTip,
  villainStageAdvancedTip,
  recoverTip,
  handSizeDiffersTip,
  drawOnAttackTip,
];

// ---------------------------------------------------------------------------
// Keyword and status tips (generic, from the glossary)
// ---------------------------------------------------------------------------

function glossaryTips(game: LessonObservation["game"], deps: EngineDeps): readonly Tip[] {
  return rulesGlossaryOf(game, deps)
    .filter((entry) => !EXCLUDED_TABLE_STATE_IDS.has(entry.id))
    .map((entry) => ({
      id: `keyword:${entry.id}`,
      title: `New on the table: ${entry.displayName}`,
      body: `[[${entry.id}|${entry.displayName}]] — ${entry.definition}`,
    }));
}

// ---------------------------------------------------------------------------
// tipsFor
// ---------------------------------------------------------------------------

/**
 * Every tip fired for `observation`, filtered to `prefs.seenTips` and `suppress`, most-relevant first (situations,
 * in this module's own order, then the generic glossary catch-all, alphabetical by term) — but returns at most
 * one, since a guide surface shows one tip at a time (§5.3: "each is one line"). Empty at any level but "full", or
 * with no `perspectiveId` yet. `deps` should be the session's real `EngineDeps` (the board's own `POOL_DEPS`), not
 * `DEFAULT_DEPS`, so an ability-granted icon or keyword counts (this module's own header).
 */
export function tipsFor(
  observation: LessonObservation,
  deps: EngineDeps,
  prefs: GuidePrefs,
  suppress: readonly string[] = [],
): readonly Tip[] {
  if (prefs.level !== "full") return [];
  if (!observation.perspectiveId) return [];

  const candidates = [
    ...SITUATION_TIPS.map((trigger) => trigger(observation, deps)).filter((tip): tip is Tip => tip !== null),
    ...glossaryTips(observation.game, deps),
  ];

  const tip = candidates.find(
    (candidate) => !prefs.seenTips.includes(candidate.id) && !suppress.includes(candidate.id),
  );
  return tip ? [tip] : [];
}
