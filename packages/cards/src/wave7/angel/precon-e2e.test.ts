import {
  activeVillain,
  applyCommand,
  cardsInPlay,
  createGame,
  hasKeyword,
  iconsInPlay,
  mainSchemeValue,
  playerSideSchemeLimit,
  printedResources,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type PlayerId,
  type PlayerState,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  firstLegal,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  putOnTopOfDeck,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import {
  encounterCardInVillainArea,
  stackSetAside,
  stageNemesisCardForReveal,
  withForm,
} from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Angel's precon (`angel-protection`, cards 42001a/b/c-42023) through the real engine and the real
 * wave 7 scripts, played by the card-name-agnostic greedy driver (`../../testing/driver.ts`) one command at a time, so
 * that every state is checked against the invariants below (the same ones as `cable-precon-e2e.test.ts`):
 *
 * - no engine error on a command the driver chose from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices"): `minSelections` fits the options offered;
 * - the game never stops between steps with nothing pending: the villain phase always completes (RRG Appendix II,
 *   "Villain Phase", pp. 51-52) and rounds advance by exactly one;
 * - the player side scheme limit is one for one or two starting players (RRG 1.8 "Player Side Scheme Limit", p. 34);
 * - no card instance sits in two zones; every card a player's deck started with is still somewhere; cards stay in their
 *   owner's zones (RRG 1.8 "Owner", "Controller", p. 31);
 * - no two matching unique cards, and no unique card matching a chosen identity, are in play together (RRG 1.8
 *   "Unique Icon", p. 45: the Angel identity, alter-ego title Warren Worthington III, matches an Angel ally; the
 *   Psylocke identity, alter-ego title Betsy Braddock, matches the Psylocke ally);
 * - a player changes form voluntarily at most once a round (RRG 1.8 "Form", "Change Form");
 * - the first player token passes to the next seat at the end of each round (RRG 1.8 "First Player", p. 20);
 * - the session log replays to the identical final state.
 *
 * Deviations from the driver, all policy and none about the rules: Hope Summers is never declared a defender (Stryfe:
 * "If Hope Summers is defeated, you lose"), no Morlock defends in Morlock Siege (2B: "no Morlock allies in play"), a
 * turn is ended after 40 commands, and Angel's form change is chosen here: the driver's only form command is the bare
 * `changeForm`, which a three-face identity refuses from Warren Worthington III (it names no face), so on its own it
 * never leaves alter-ego (see "driver finding" below). The test picks the hero face (Angel and Archangel alternately)
 * and, every third round, switches between the two hero faces, so that all three faces and all six legal changes occur.
 */

const ANGEL_DECK = { starterDeckId: "angel-protection" } as const;
const PSYLOCKE_DECK = { starterDeckId: "psylocke-justice" } as const;
const HOPE_SUMMERS = "40130";
const ANGEL_ID = "42001a";

type Face = "Warren" | "Angel" | "Archangel";

/** Targeted checks (task item 4) observed anywhere in this file's games, with where. */
const SEEN = new Map<string, string[]>();
const saw = (check: string, where: string): void => {
  SEEN.set(check, [...(SEEN.get(check) ?? []), where]);
};

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
  readonly label: string;
}

const cardType = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.type;
const PLAYER_CARD_TYPES: readonly string[] = ["ally", "event", "resource", "support", "upgrade", "player_side_scheme"];
const cardName = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const codeOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
const printedCost = (s: GameState, code: string): number =>
  (s.cardPool[code] as unknown as { cost?: number }).cost ?? 0;
const isAerialEvent = (s: GameState, code: string): boolean => {
  const card = s.cardPool[code] as unknown as { type: string; traits?: readonly string[] };
  return card.type === "event" && (card.traits ?? []).map(String).some((t) => t.toUpperCase() === "AERIAL");
};

const angelOf = (s: GameState): PlayerState | undefined =>
  s.players.find((p) => String(p.identity.cardId).startsWith(ANGEL_ID));
const faceOf = (p: PlayerState): Face =>
  p.identity.form === "alterEgo" ? "Warren" : p.identity.heroFormIndex === 1 ? "Archangel" : "Angel";
const faceOfEvent = (to: string, index: number | null | undefined): Face =>
  to === "alterEgo" ? "Warren" : index === 1 ? "Archangel" : "Angel";

/** Every list an instance can be in, labeled; attachments, tucked and boost cards are listed under their host. */
function zoneIndex(s: GameState): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (id: InstanceId, label: string) => index.set(id, [...(index.get(id) ?? []), label]);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea", "dealtEncounter", "resolving", "setAside"] as const)
      for (const id of p[zone]) add(id, `${p.playerId}.${zone}`);
    for (const [name, sep] of Object.entries(p.separateDecks)) {
      for (const id of sep.deck) add(id, `${p.playerId}.sep.${name}.deck`);
      for (const id of sep.discard) add(id, `${p.playerId}.sep.${name}.discard`);
    }
    add(p.identity.instanceId, `${p.playerId}.identity`);
  }
  for (const [deckId, pile] of Object.entries(s.encounterDecks)) {
    for (const id of pile.deck) add(id, `enc.${deckId}.deck`);
    for (const id of pile.discard) add(id, `enc.${deckId}.discard`);
  }
  for (const id of s.encounterSetAside) add(id, "encounterSetAside");
  for (const id of s.villainArea) add(id, "villainArea");
  for (const id of s.victoryDisplay) add(id, "victoryDisplay");
  for (const id of s.removedFromGame) add(id, "removedFromGame");
  for (const [id, instance] of Object.entries(s.instances)) {
    for (const t of instance.tucked) add(t, `tuckedUnder.${id}`);
    for (const b of instance.boostCards) add(b, `boostOn.${id}`);
  }
  return index;
}

/** Titles and alter-ego titles a unique card in play answers to, per RRG "Unique Icon": the identity's and its cards'. */
const IDENTITY_TITLES: Readonly<Record<string, readonly string[]>> = {
  "42001a": ["Angel", "Warren Worthington III"],
  "41001a": ["Psylocke", "Betsy Braddock"],
};

/** Throws a descriptive error on the first broken invariant of `state`. */
function checkState(s: GameState, dealtTo: ReadonlyMap<string, PlayerId>, where: string): void {
  const fail = (message: string): never => {
    throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${message}`);
  };
  const choice = s.pendingChoice;
  if (choice) {
    if (choice.minSelections > choice.options.length)
      fail(`soft lock: ${choice.prompt.kind} needs ${choice.minSelections} but offers ${choice.options.length}`);
    if (choice.minSelections > choice.maxSelections) fail(`${choice.prompt.kind}: min > max`);
  } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
    fail("the game stopped between steps with nothing pending");
  }
  const zones = zoneIndex(s);
  for (const [id, labels] of zones)
    if (labels.length > 1) fail(`${id} (${cardName(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  const limit = playerSideSchemeLimit(s);
  const sideSchemes = s.villainArea.filter((id) => cardType(s, id) === "player_side_scheme");
  if (choice?.prompt.kind !== "discardOverPlayerSideSchemeLimit" && sideSchemes.length > limit)
    fail(`${sideSchemes.length} player side schemes in play, limit ${limit}`);
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${cardName(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) {
        const dealt = dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${cardName(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        if (zone !== "hand" && zone !== "playArea" && dealt === undefined)
          fail(`${cardName(s, id)} (${id}) is in ${p.playerId}'s ${zone} but no deck started with it`);
      }
  }
  // Unique Icon (RRG p. 45): matching unique cards are never in play together.
  const titles = new Map<string, string>();
  const claim = (title: string, what: string) => {
    const prior = titles.get(title);
    if (prior !== undefined) fail(`unique rule broken: ${what} and ${prior} both answer to "${title}" in play`);
    titles.set(title, what);
  };
  // An eliminated player's identity has left play (RRG 1.8 "Player Elimination"), so it matches nothing.
  for (const p of s.players.filter((x) => !x.eliminated))
    for (const title of IDENTITY_TITLES[String(p.identity.cardId).replace(/[ab]$/, "") + "a"] ?? [])
      claim(title, `${p.playerId}'s identity`);
  for (const p of s.players)
    for (const id of p.playArea) {
      const card = s.cardPool[codeOf(s, id)] as unknown as { unique?: boolean; name: string };
      if (card.unique && ["ally", "support", "upgrade"].includes(cardType(s, id)))
        claim(card.name, `${card.name} (${id})`);
    }
}

/** The driver's own answer, except that Hope Summers and Morlocks never defend and nothing else changes. */
function ownAnswer(s: GameState, choice: PendingChoice): readonly string[] | null {
  if (choice.prompt.kind !== "declareDefender") return null;
  const ids = choice.options.map((o) => o.optionId);
  const allies = ids.filter(
    (id) =>
      id !== "decline" &&
      cardType(s, id as InstanceId) === "ally" &&
      codeOf(s, id as InstanceId) !== HOPE_SUMMERS &&
      cardName(s, id as InstanceId) !== "Morlock",
  );
  if (allies[0]) return [allies[0]];
  return ids.includes("decline") ? ["decline"] : null;
}

/** An event card being played: its events are gathered until it leaves the resolving zone. */
interface PlayInFlight {
  readonly code: string;
  readonly instanceId: InstanceId;
  readonly playerId: PlayerId;
  /** The face showing when it was played, and the state before the command that played it. */
  readonly face: Face;
  readonly start: GameState;
  readonly paidWith: readonly InstanceId[];
  readonly events: GameEvent[];
}

/** Hero Action / hero interrupt events of Angel's kit: "hero" timing cannot be used in alter-ego form (RRG "Form"). */
const HERO_FORM_ONLY = new Set(["42003", "42004", "42006", "42007", "42015", "42016", "42029", "42031"]);

/** Watches events, one command at a time, for the targeted checks and the per-round rules. */
class Observer {
  readonly firstPlayerByRound = new Map<number, PlayerId>();
  readonly turnOrder = new Map<number, PlayerId[]>();
  private lastRound = 0;
  private readonly voluntary = new Map<string, number>();
  private readonly uses = new Map<string, number>();
  /** AERIAL events Angel's player played, by `round:phase`. */
  readonly aerialPlays = new Map<string, number>();
  private firstEliminated: number | null = null;
  private lastPlayerState: GameState | null = null;
  private stepOneFrom: GameState | null = null;
  private readonly stepOneDone = new Set<number>();
  private readonly inFlight: PlayInFlight[] = [];
  private lastAerialCost: number | null = null;
  private pendingDeath: { readonly cost: number; readonly identityId: InstanceId } | null = null;
  private pendingMedical: { readonly expected: number; healed: number; resolved: boolean } | null = null;

  constructor(readonly label: string) {}

  observe(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    if (before.step.phase === "player") this.lastPlayerState = before;
    for (const e of events)
      if (e.type === "turnStarted")
        this.turnOrder.set(after.round, [...(this.turnOrder.get(after.round) ?? []), e.playerId]);
    if (after.round !== this.lastRound) {
      expect(after.round - this.lastRound).toBe(1);
      this.firstPlayerByRound.set(after.round, after.firstPlayerId);
      this.lastRound = after.round;
    }
    if (this.firstEliminated === null && after.players.some((p) => p.eliminated)) this.firstEliminated = after.round;
    const angelB = angelOf(before);
    const angelA = angelOf(after);
    if (!angelB || !angelA) return;
    const angelId = angelA.playerId;

    // Faces and the changes between them (RRG "Form", "Change Form"; Angel insert, "Foldable Cards").
    let current = faceOf(angelB);
    for (const e of events) {
      if (e.type !== "formChanged" || e.playerId !== angelId) continue;
      const to = faceOfEvent(e.to, e.heroFormIndex);
      expect(to, `${this.label}: a change of form to the face already showing`).not.toBe(current);
      saw(`change ${current} -> ${to}`, this.label);
      if (!e.byEffect) {
        const key = `${before.round}:${angelId}`;
        this.voluntary.set(key, (this.voluntary.get(key) ?? 0) + 1);
        expect(this.voluntary.get(key), `${this.label}: second voluntary form change in round ${before.round}`).toBe(1);
        expect(command.type).toBe("changeForm");
      }
      current = to;
    }
    saw(`face ${faceOf(angelA)} showing`, this.label);

    this.checkStepOne(events);
    this.checkPlays(before, after, events, command, angelA);
    this.checkResponses(before, after, events, angelA);
    this.settleMedical(after);
  }

  /**
   * Step one of the villain phase (RRG "Acceleration Icon", p. 5; Appendix II step 1): the threat placed on the main
   * scheme is its own acceleration, its acceleration tokens, the acceleration icons in play, and 1 more while Archangel
   * (printed acceleration icon on 42001c) shows, once however many players there are. The baseline is computed with the
   * Angel player turned to Warren, so the identity's own icon is not read through the engine's own face logic.
   */
  private checkStepOne(events: readonly GameEvent[]): void {
    if (events.some((e) => e.type === "stepChanged" && e.to.phase === "villain" && e.to.kind === "placeThreat"))
      this.stepOneFrom = this.lastPlayerState;
    const from = this.stepOneFrom;
    if (!from) return;
    for (const e of events) {
      if (
        e.type !== "threatPlaced" ||
        e.schemeInstanceId !== from.mainScheme.instanceId ||
        e.sourceInstanceId !== null ||
        this.stepOneDone.has(from.round)
      )
        continue;
      this.stepOneDone.add(from.round);
      const angel = angelOf(from)!;
      const base = withForm(from, "alterEgo", angel.playerId);
      const expectedBase =
        mainSchemeValue(base, "acceleration", WAVE7_DEPS) +
        base.mainScheme.accelerationTokens +
        cardsInPlay(base)
          .filter((id) => id !== base.mainScheme.instanceId)
          .reduce((sum, id) => sum + (base.instances[id]?.counters["acceleration"] ?? 0), 0) +
        iconsInPlay(base, WAVE7_DEPS, "acceleration");
      const face = faceOf(angel);
      // A card with a blank text box shows no icons (FFG ruling relayed for Vivian, docs/phase7-wave5.md §4.1 Q73): Mister
      // Sinister's Telepathy upgrade "treats your identity's printed text box as if it were blank".
      const blanked = from.instances[angel.identity.instanceId]!.attachments.some((id) =>
        (from.cardPool[codeOf(from, id)] as unknown as { text?: { current?: string } }).text?.current?.includes(
          "as if it were blank",
        ),
      );
      // An eliminated player's identity has left play, so its icon shows nowhere (RRG "Player Elimination").
      const inPlay = cardsInPlay(from).includes(angel.identity.instanceId);
      const expected = expectedBase + (face === "Archangel" && !blanked && inPlay ? 1 : 0);
      expect(
        e.amount,
        `${this.label}: round ${from.round} step one with ${face} showing: scheme's own ${expectedBase}${blanked ? " (text box blank)" : ""}${!inPlay ? " (eliminated)" : ""}`,
      ).toBe(expected);
      if (face === "Archangel" && !inPlay) saw("step one with an eliminated Archangel (+0)", this.label);
      else if (blanked && face === "Archangel") saw("step one with Archangel showing, text box blank (+0)", this.label);
      else
        saw(
          face === "Archangel" ? "step one with Archangel showing (+1)" : "step one without Archangel showing",
          this.label,
        );
      this.stepOneFrom = null;
    }
  }

  /** Whether a player had been eliminated by the start of `round` (the token no longer passes among everyone). */
  eliminatedBy(round: number): boolean {
    return this.firstEliminated !== null && this.firstEliminated <= round;
  }

  /** How many times `abilityId` resolved in `round`'s `phase`. */
  usesOf(abilityId: string, round: number, phase: string): number {
    return this.uses.get(`${abilityId}:${round}:${phase}`) ?? 0;
  }

  /** Event plays: restrictions when played, and what each Angel event did once it left the resolving zone. */
  private checkPlays(
    before: GameState,
    after: GameState,
    events: readonly GameEvent[],
    command: Command,
    angel: PlayerState,
  ): void {
    for (const e of events) {
      if (e.type === "cardPlayed" && e.playerId === angel.playerId) {
        const code = String(e.cardId);
        const face = faceOf(angelOf(before)!);
        if (HERO_FORM_ONLY.has(code)) expect(face, `${this.label}: ${code} played as Warren`).not.toBe("Warren");
        if (code === "42021")
          expect(face, `${this.label}: Soaring Hearts played as Archangel (Q37)`).not.toBe("Archangel");
        if (isAerialEvent(before, code)) {
          this.lastAerialCost = printedCost(before, code);
          const key = `${before.round}:${before.step.phase}`;
          this.aerialPlays.set(key, (this.aerialPlays.get(key) ?? 0) + 1);
        }
        if (cardType(after, e.instanceId) === "event")
          this.inFlight.push({
            code,
            instanceId: e.instanceId,
            playerId: e.playerId,
            face,
            start: before,
            paidWith:
              command.type === "playCard" ? command.payment.flatMap((p) => ("fromHand" in p ? [p.fromHand] : [])) : [],
            events: [],
          });
        if (code === "42017") saw("Render Medical Aid entered play", this.label);
      }
    }
    for (const play of this.inFlight) play.events.push(...events);
    for (const e of events) {
      if (e.type !== "cardMoved" || e.from.kind !== "resolving") continue;
      const at = this.inFlight.findIndex((p) => p.instanceId === e.instanceId);
      if (at < 0) continue;
      const [done] = this.inFlight.splice(at, 1);
      this.judgePlay(done!, e.to.kind, after);
    }
  }

  private judgePlay(play: PlayInFlight, movedTo: string, after: GameState): void {
    const { code, events } = play;
    const label = this.label;
    const removed = events.filter((e) => e.type === "threatRemoved");
    const statuses = (status: string) => events.filter((e) => e.type === "statusGiven" && e.status === status);
    const enemyTypes = ["villain", "minion"];
    const where = `${label}: ${code} played as ${play.face}`;

    // Avian Anatomy (42008): spent to pay for an AERIAL event, the event returns to hand after resolving its effects.
    const avian = play.paidWith.filter((id) => codeOf(play.start, id) === "42008");
    if (avian.length > 0 && isAerialEvent(play.start, code)) {
      expect(movedTo, `${where}: paid with Avian Anatomy, so the event returns to hand`).toBe("hand");
      saw("Avian Anatomy returned an AERIAL event to hand", label);
    }

    if (code === "42003" && play.face === "Angel") {
      // "Remove 3 threat from a scheme. Confuse an enemy."
      const scheme = removed.find((e) => e.type === "threatRemoved");
      const heroConfused = play.start.instances[angelOf(play.start)!.identity.instanceId]!.statuses.confused > 0;
      if (!scheme && heroConfused) {
        expect(
          events.some((e) => e.type === "statusRemoved" && e.status === "confused"),
          where,
        ).toBe(true);
        saw("Adaptive Plumage's thwart cancelled by the hero's confused status", label);
        return;
      }
      expect(scheme, `${where}: no threat removed`).toBeDefined();
      if (scheme?.type === "threatRemoved") {
        const had = play.start.instances[scheme.schemeInstanceId]!.threat;
        expect(scheme.amount, `${where}: scheme had ${had} threat`).toBe(Math.min(3, had));
      }
      const confused = statuses("confused");
      if (confused.length === 0) {
        // Juggernaut wears Juggernaut's Helmet (stalwart, RRG "Stalwart", p. 40): nothing to confuse.
        // Nothing new to confuse: stalwart (RRG "Stalwart", p. 40; Juggernaut wears Juggernaut's Helmet), or already
        // confused (a character has one confused status card, "Confuse, Confused", p. 13).
        const enemies = cardsInPlay(after).filter((id) => enemyTypes.includes(cardType(after, id)));
        const stalwart = enemies.some((id) => hasKeyword(after, id, "stalwart", WAVE7_DEPS));
        const already = enemies.some((id) => after.instances[id]!.statuses.confused > 0);
        expect(stalwart || already, `${where}: no enemy confused and none stalwart or already confused`).toBe(true);
        saw(`Adaptive Plumage confused no one (${stalwart ? "stalwart" : "already confused"})`, label);
      } else {
        expect(confused, `${where}: confused more than one enemy`).toHaveLength(1);
        if (confused[0]?.type === "statusGiven") expect(enemyTypes).toContain(cardType(after, confused[0].instanceId));
        saw("Adaptive Plumage as Angel: thwart 3 and confuse", label);
      }
    }
    if (code === "42003" && play.face === "Archangel") {
      // "Deal 4 damage to an enemy. Stun it." The attack's amount before any prevention (Aerial Intervention may cut it).
      const attacks = events.filter(
        (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack",
      );
      const first = attacks[0];
      const hero = play.start.instances[angelOf(play.start)!.identity.instanceId]!;
      if (!first && hero.statuses.stunned > 0) {
        // A stunned hero's attack is replaced by removing the stunned status card (RRG "Stun, Stunned", p. 40).
        expect(
          events.some((e) => e.type === "statusRemoved" && e.status === "stunned"),
          where,
        ).toBe(true);
        saw("Adaptive Plumage's attack cancelled by the hero's stunned status", label);
        return;
      }
      expect(first, `${where}: no attack`).toBeDefined();
      if (first?.type === "triggerEvent") expect((first.event as { amount?: number }).amount, where).toBe(4);
      const stunned = statuses("stunned");
      if (stunned.length === 0) {
        const enemies = cardsInPlay(after).filter((id) => enemyTypes.includes(cardType(after, id)));
        const stalwart = enemies.some((id) => hasKeyword(after, id, "stalwart", WAVE7_DEPS));
        const already = enemies.some((id) => after.instances[id]!.statuses.stunned > 0);
        expect(stalwart || already, `${where}: no enemy stunned and none stalwart or already stunned`).toBe(true);
        saw(`Adaptive Plumage stunned no one (${stalwart ? "stalwart" : "already stunned"})`, label);
      } else {
        expect(stunned, `${where}: stunned more than one enemy`).toHaveLength(1);
        saw("Adaptive Plumage as Archangel: attack 4 and stun", label);
      }
    }
    if (code === "42005") {
      const changes = events.filter((e) => e.type === "formChanged" && e.playerId === play.playerId);
      const last = changes.at(-1);
      expect(last, `${where}: Metamorphosis changed no form`).toBeDefined();
      if (last?.type !== "formChanged") return;
      const reached = faceOfEvent(last.to, last.heroFormIndex);
      const drawn = events.filter((e) => e.type === "cardDrawn").length;
      if (reached === "Warren") {
        expect(drawn, `${where}: reached Warren and did not draw exactly 1`).toBe(1);
      } else if (reached === "Angel") {
        const scheme = removed[0];
        if (scheme?.type === "threatRemoved") {
          const had = play.start.instances[scheme.schemeInstanceId]!.threat;
          expect(scheme.amount, `${where}: reached Angel, scheme had ${had}`).toBe(Math.min(2, had));
        } else expect.fail(`${where}: reached Angel and removed no threat`);
      } else {
        const hit = events.find(
          (e) => e.type === "damageDealt" && enemyTypes.includes(cardType(after, e.targetInstanceId)),
        );
        expect(hit?.type === "damageDealt" ? hit.amount : -1, `${where}: reached Archangel`).toBe(3);
      }
      saw(`Metamorphosis reached ${reached}`, label);
    }
  }

  /** Responses of the identity, Render Medical Aid, the obligation and Hook, Line, and Sinker. */
  private checkResponses(before: GameState, after: GameState, events: readonly GameEvent[], angel: PlayerState): void {
    const faceAfter = faceOf(angel);
    const faceBefore = faceOf(angelOf(before)!);
    const identity = angel.identity.instanceId;
    for (const e of events) {
      if (e.type === "stepChanged" || (e.type === "cardPlayed" && this.pendingDeath)) this.pendingDeath = null;
      if (e.type === "damageDealt" && this.pendingDeath && e.sourceInstanceId === identity) {
        expect(["villain", "minion"], `${this.label}: Angel of Death hit a non-enemy`).toContain(
          cardType(after, e.targetInstanceId),
        );
        expect(e.amount, `${this.label}: Angel of Death with a cost-${this.pendingDeath.cost} event`).toBe(
          this.pendingDeath.cost,
        );
        saw(`Angel of Death dealt ${e.amount} (the event's printed cost)`, this.label);
        this.pendingDeath = null;
      }
      if (e.type === "damageHealed" && this.pendingMedical) this.pendingMedical.healed += e.amount;
      if (e.type === "schemeDefeated" && String(e.cardId) === "42017") {
        saw("Render Medical Aid defeated", this.label);
        const total = after.players.reduce((sum, p) => {
          const own = [p.identity.instanceId, ...p.playArea.filter((id) => cardType(before, id) === "ally")];
          return (
            sum +
            Math.min(
              5,
              own.reduce((n, id) => n + before.instances[id]!.damage, 0),
            )
          );
        }, 0);
        this.pendingMedical = { expected: total, healed: 0, resolved: false };
      }
      if (e.type !== "abilityResolved") continue;
      const id = String(e.abilityId);
      const key = `${id}:${before.round}:${before.step.phase}`;
      if (id === "42017.when-defeated" && this.pendingMedical) this.pendingMedical.resolved = true;
      if (id === "42001a.angel-of-life") {
        // Once per phase; the face showing when it resolves is Angel (Q42), and it draws exactly 1.
        this.uses.set(key, (this.uses.get(key) ?? 0) + 1);
        expect(this.uses.get(key), `${this.label}: Angel of Life twice in one phase`).toBe(1);
        expect(faceAfter).toBe("Angel");
        const after1 = events.slice(events.indexOf(e) + 1);
        expect(after1.find((x) => x.type === "cardDrawn")?.type, `${this.label}: Angel of Life drew nothing`).toBe(
          "cardDrawn",
        );
        saw("Angel of Life drew 1 after an AERIAL event", this.label);
      }
      if (id === "42001c.angel-of-death") {
        this.uses.set(key, (this.uses.get(key) ?? 0) + 1);
        expect(this.uses.get(key), `${this.label}: Angel of Death twice in one phase`).toBe(1);
        expect(faceAfter).toBe("Archangel");
        if (this.lastAerialCost !== null && this.lastAerialCost > 0)
          this.pendingDeath = { cost: this.lastAerialCost, identityId: identity };
      }
      if (id === "42001b.regrowth") {
        this.uses.set(key.replace(/:[a-z]+$/, ""), (this.uses.get(key.replace(/:[a-z]+$/, "")) ?? 0) + 1);
        expect(this.uses.get(key.replace(/:[a-z]+$/, "")), `${this.label}: Regrowth twice in one round`).toBe(1);
        expect(faceBefore).toBe("Warren");
        const had = before.instances[identity]!.damage;
        const healed = events.filter((x) => x.type === "damageHealed" && x.targetInstanceId === identity);
        expect(
          healed.reduce((n, x) => n + (x.type === "damageHealed" ? x.amount : 0), 0),
          `${this.label}: Regrowth with ${had} damage`,
        ).toBe(Math.min(1, had));
        saw("Regrowth healed 1 (once per round)", this.label);
      }
      if (id === "42024.when-revealed") {
        // Archangel: 2 threat on the main scheme and he stays Archangel; any other face: change to Archangel.
        if (faceBefore === "Archangel") {
          const placed = events.filter(
            (x) => x.type === "threatPlaced" && x.schemeInstanceId === after.mainScheme.instanceId,
          );
          expect(
            placed.map((x) => (x.type === "threatPlaced" ? x.amount : 0)),
            `${this.label}: Apocalyptic Influence as Archangel`,
          ).toContain(2);
          expect(faceAfter).toBe("Archangel");
          saw("Apocalyptic Influence as Archangel: 2 threat", this.label);
        } else {
          expect(faceAfter, `${this.label}: Apocalyptic Influence from ${faceBefore}`).toBe("Archangel");
          saw(`Apocalyptic Influence forced Archangel from ${faceBefore}`, this.label);
        }
      }
      if (id === "42026.hook-line-and-sinker-forced-response") {
        const exhausted = events.filter((x) => x.type === "cardExhausted");
        expect(exhausted.length, `${this.label}: Hook, Line, and Sinker exhausted no one`).toBeGreaterThan(0);
        for (const x of exhausted)
          if (x.type === "cardExhausted") {
            expect(after.instances[x.instanceId]!.exhausted).toBe(true);
            const damaged = events.some(
              (d) =>
                (d.type === "damageDealt" || d.type === "damagePlaced") &&
                d.targetInstanceId === x.instanceId &&
                d.amount > 0,
            );
            expect(damaged, `${this.label}: Hook exhausted a character that took no damage`).toBe(true);
          }
        saw("Hook, Line, and Sinker exhausted a character that took indirect damage", this.label);
      }
      if (id === "42027.harpoons-harpoon-forced-response")
        saw("Harpoon's Harpoon forced response resolved", this.label);
      if (id === "42028.when-revealed") saw("Spear Shot revealed", this.label);
      if (id === "42025.when-revealed") saw("Harpoon revealed", this.label);
    }
  }

  private settleMedical(after: GameState): void {
    const m = this.pendingMedical;
    if (!m?.resolved || after.pendingChoice) return;
    // "Each player heals a total of 5 damage from among characters they control": up to 5 each, what there is.
    expect(m.healed, `${this.label}: Render Medical Aid healed`).toBe(m.expected);
    saw(`Render Medical Aid healed ${m.healed}`, this.label);
    this.pendingMedical = null;
  }
}

/** Own policy for the form: from Warren the hero face alternates Angel, Archangel; some rounds change hero face. */
class FormPolicy {
  private next = 0;
  constructor(private readonly seed: number) {}
  choose(s: GameState, firstCommandOfTurn: boolean): Command | null {
    const angel = angelOf(s);
    if (!angel || s.step.phase !== "player" || s.step.kind !== "turn" || s.step.activePlayerId !== angel.playerId)
      return null;
    if (angel.identity.changedFormThisRound || !firstCommandOfTurn) return null;
    const identity = s.instances[angel.identity.instanceId]!;
    const face = faceOf(angel);
    const hp = 12 - identity.damage;
    if (face === "Warren") {
      if (hp * 2 <= 12) return null; // the driver recovers
      const heroForm = this.next++ % 2;
      return { type: "changeForm", playerId: angel.playerId, to: { heroForm } };
    }
    if ((s.round + this.seed) % 3 === 0 && hp > 4)
      return { type: "changeForm", playerId: angel.playerId, to: { heroForm: face === "Angel" ? 1 : 0 } };
    return null;
  }
}

function nextCommand(
  session: GameSession,
  turn: { key: string; n: number },
  script: ((s: GameState) => Command)[],
  policy: FormPolicy | null,
  choose: PlayOptions["choose"],
): Command {
  const s = session.state;
  const choice = s.pendingChoice;
  if (!choice && !s.outcome && script.length > 0) return script.shift()!(s);
  if (choice) {
    const picked = choose?.(s, choice);
    if (picked)
      return { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: picked };
    const own = ownAnswer(s, choice);
    if (own)
      return { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: own };
  } else if (s.step.phase === "player" && s.step.kind === "turn") {
    const key = `${s.round}:${s.step.activePlayerId}`;
    if (turn.key !== key) Object.assign(turn, { key, n: 0 });
    const first = turn.n === 0;
    if (++turn.n > 40) return { type: "endTurn", playerId: s.step.activePlayerId };
    const own = policy?.choose(s, first);
    if (own) return own;
  }
  const [command] = playToOutcome(s, WAVE7_DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

interface PlayOptions {
  readonly stopAtRound?: number;
  readonly maxCommands?: number;
  readonly script?: readonly ((s: GameState) => Command)[];
  readonly seed?: number;
  /** Staged games: no form policy, so the face the staging chose is the one played. */
  readonly noPolicy?: true;
  /** Answers a prompt itself (selected option ids), or null to leave it to the driver. */
  readonly choose?: (s: GameState, choice: PendingChoice) => readonly string[] | null;
}

/** Plays `initial` to an outcome (or `stopAtRound`), checking every invariant after every command. */
function play(label: string, initial: GameState, observer: Observer, options: PlayOptions = {}): GameResult {
  const dealtTo = new Map<string, PlayerId>();
  for (const p of initial.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) if (initial.instances[id]!.ownerId === p.playerId) dealtTo.set(id, p.playerId);
  for (const [id, instance] of Object.entries(initial.instances))
    if (instance.ownerId !== null && PLAYER_CARD_TYPES.includes(cardType(initial, id as InstanceId)))
      dealtTo.set(id, instance.ownerId);
  checkState(initial, dealtTo, "start");
  let session = startSession(initial);
  const turn = { key: "", n: 0 };
  const script = [...(options.script ?? [])];
  const policy = options.noPolicy ? null : new FormPolicy(options.seed ?? 0);
  const maxCommands = options.maxCommands ?? 2500;
  let commands = 0;
  while (!session.state.outcome && (options.stopAtRound === undefined || session.state.round < options.stopAtRound)) {
    if (commands >= maxCommands)
      throw new Error(`${label}: no outcome after ${maxCommands} commands (round ${session.state.round})`);
    const before = session.state;
    const command = nextCommand(session, turn, script, policy, options.choose);
    const result = sessionApply(session, command, WAVE7_DEPS);
    if (!result.ok)
      throw new Error(
        `${label}: engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`,
      );
    session = result.session;
    commands++;
    observer.observe(before, session.state, result.events, command);
    checkState(session.state, dealtTo, `${label} command ${commands} ${command.type}`);
  }
  return { session, commands, label };
}

function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, WAVE7_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

type Seat = typeof ANGEL_DECK | typeof PSYLOCKE_DECK;

/** Setup with the opening hands kept. */
function newGame(scenario: string, players: readonly Seat[], seed: number): GameState {
  const created = createGame(wave7Scenario(scenario, { players, seed, modularSetIds: [] }), WAVE7_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}

const outcomeOf = (r: GameResult) => r.session.state.outcome;
const completedRounds = (r: GameResult) => r.session.state.round - 1;

describe("The driver and a three-face identity", () => {
  // The driver's only form command is the bare `changeForm`. From Warren Worthington III it names no hero face, which a
  // three-face identity refuses (docs/phase7-wave2.md §3.2), so the driver alone never leaves alter-ego by that command;
  // the games below choose the face themselves (`FormPolicy`).
  it("a bare change of form from Warren is refused, so the driver cannot pick a hero face", () => {
    const start = newGame("juggernaut", [ANGEL_DECK], 1);
    expect(applyCommand(start, { type: "changeForm", playerId: P1 }, WAVE7_DEPS).ok).toBe(false);
    expect(applyCommand(start, { type: "changeForm", playerId: P1, to: { heroForm: 1 } }, WAVE7_DEPS).ok).toBe(true);
  });
});

describe("Angel precon, Juggernaut, standard, one player", () => {
  // Seeds picked (by trying seeds 1-15) for games that last: rounds reached are 8, 6, 4, 4 and 4. The greedy driver
  // loses every Juggernaut game, so each is played to its loss; a loss is legitimate only if the outcome is one the rules
  // define, which `outcomeOf` shows.
  it.each([
    [4, 8],
    [6, 6],
    [8, 4],
    [10, 4],
    [13, 4],
  ])("seed %i plays to an outcome (round %i or later) with every invariant intact", (seed, rounds) => {
    const label = `juggernaut#${seed}`;
    const result = play(label, newGame("juggernaut", [ANGEL_DECK], seed), new Observer(label), { seed });
    expect(outcomeOf(result)).not.toBeNull();
    expect(result.session.state.round).toBeGreaterThanOrEqual(rounds);
    expectReplays(result);
  });
});

describe("Angel precon, a second scenario, one player", () => {
  it.each([
    ["morlock-siege", 2, 6],
    ["morlock-siege", 7, 7],
    ["stryfe", 3, 5],
    ["stryfe", 5, 5],
  ])("%s seed %i reaches round %i", (scenario, seed, rounds) => {
    const label = `${scenario}#${seed}`;
    const result = play(label, newGame(scenario, [ANGEL_DECK], seed), new Observer(label), { seed });
    expect(outcomeOf(result)).not.toBeNull();
    expect(completedRounds(result)).toBeGreaterThanOrEqual(3);
    expect(result.session.state.round).toBeGreaterThanOrEqual(rounds);
    expectReplays(result);
  });
});

describe("Angel and Psylocke, two players", () => {
  // Mister Sinister seeds 3 and 4 reach round 4 with both players in the game; On the Run seed 2 lasts to round 7 but a player
  // is eliminated early, so only the rounds before that count for the token.
  it.each([
    ["mister-sinister", 3, 2],
    ["mister-sinister", 4, 2],
    ["on-the-run", 2, 0],
  ])(
    "%s seed %i: three full rounds, the first player token passes, cards stay in their owners' zones",
    (scenario, seed, minPasses) => {
      const label = `${scenario}#${seed}-2p`;
      const observer = new Observer(label);
      const start = newGame(scenario, [ANGEL_DECK, PSYLOCKE_DECK], seed);
      const result = play(label, start, observer, { seed });
      expect(completedRounds(result)).toBeGreaterThanOrEqual(3);
      // The first player token passes to the next seat each round (RRG 1.8 "First Player", p. 20), while both are in the game.
      const order = start.players.map((p) => p.playerId);
      let passes = 0;
      for (let round = 2; round <= result.session.state.round; round++) {
        const previous = observer.firstPlayerByRound.get(round - 1);
        const now = observer.firstPlayerByRound.get(round);
        if (previous === undefined || now === undefined) continue;
        if (observer.eliminatedBy(round)) continue;
        expect(now, `first player of round ${round}`).toBe(order[(order.indexOf(previous) + 1) % order.length]);
        passes++;
      }
      expect(passes, `${label}: rounds with the token passing`).toBeGreaterThanOrEqual(minPasses);
      // (Round 1's first turn began during setup, before the first observed command.)
      for (const [round, players] of observer.turnOrder)
        if (round > 1 && !observer.eliminatedBy(round))
          expect(players[0], `round ${round} starts with the first player`).toBe(
            observer.firstPlayerByRound.get(round),
          );
      // Every card a player's deck started with is still theirs (`checkState` after every command also holds each zone).
      for (const p of result.session.state.players)
        for (const id of [...p.hand, ...p.deck, ...p.discard])
          expect(
            result.session.state.instances[id]!.ownerId,
            `${cardName(result.session.state, id)} in ${p.playerId}`,
          ).toBe(p.playerId);
      expectReplays(result);
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Staged games: a real game state, a face and a hand chosen by surgery, then the real engine and driver from there.
// ---------------------------------------------------------------------------------------------------------------

type Stage = "Warren" | "Angel" | "Archangel";
const heroFormOf = (face: Stage) =>
  face === "Warren" ? "alterEgo" : ({ heroForm: face === "Angel" ? 0 : 1 } as const);

/** Angel's player in `face`, the given cards moved into his hand, the villain without tough, the main scheme at `threat`. */
function staged(scenario: string, seed: number, face: Stage, hand: readonly string[], threat = 8): GameState {
  let s = newGame(scenario, [ANGEL_DECK], seed);
  if (face !== "Warren") s = withForm(s, heroFormOf(face) as { heroForm: number });
  // The driver plays Aerial Intervention (an interrupt to any attack damage, its own attacks' included) whenever it can,
  // and that would answer for these plays, so its three copies are put in the discard pile first.
  s = {
    ...s,
    players: s.players.map((p) => {
      const out = [...p.hand, ...p.deck].filter((id) => codeOf(s, id) === "42014");
      return {
        ...p,
        hand: p.hand.filter((id) => !out.includes(id)),
        deck: p.deck.filter((id) => !out.includes(id)),
        discard: [...p.discard, ...out],
      };
    }),
  };
  s = moveToHand(s, P1, ...hand).state;
  s = patchInstance(s, s.mainScheme.instanceId, { threat });
  const villain = activeVillain(s).instanceId;
  return patchInstance(s, villain, { statuses: { ...s.instances[villain]!.statuses, tough: 0 } });
}

/** Surgery: every event in hand goes to the discard pile, so the driver keeps the face the staging chose (Metamorphosis). */
function withoutEventsInHand(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => {
      const out = p.hand.filter((id) => cardType(s, id) === "event");
      return { ...p, hand: p.hand.filter((id) => !out.includes(id)), discard: [...p.discard, ...out] };
    }),
  };
}

/** Plays an event from hand, paying with the first hand cards of the codes `pay` names (in that order). */
const playEvent =
  (code: string, pay: readonly string[]) =>
  (s: GameState): Command => {
    const hand = playerOf(s, P1).hand;
    const id = hand.find((h) => codeOf(s, h) === code);
    if (!id) throw new Error(`${code} is not in hand`);
    const used = new Set<InstanceId>();
    const payment: { fromHand: InstanceId }[] = [];
    let paid = 0;
    for (const c of pay) {
      if (paid >= printedCost(s, code)) break;
      const h = hand.find((x) => x !== id && !used.has(x) && codeOf(s, x) === c);
      if (!h) continue;
      used.add(h);
      payment.push({ fromHand: h });
      const pool = printedResources(s.cardPool[c]!);
      paid += pool.physical + pool.mental + pool.energy + pool.wild;
    }
    if (paid < printedCost(s, code)) throw new Error(`cannot pay for ${code}: ${paid}`);
    return { type: "playCard", playerId: P1, cardInstanceId: id, payment, attachToInstanceId: null };
  };

const pickFace = (to: string) => (_s: GameState, choice: PendingChoice) =>
  choice.prompt.kind === "chooseOption" && choice.options.some((o) => o.optionId === to) ? [to] : null;

describe("Staged games with the real engine (state surgery named in each test)", () => {
  // Surgery: Archangel showing, Razor Dive and Ever Vigilant (both AERIAL) in hand with Avian Anatomy and The Power of
  // Flight to pay. Angel of Death answers the first event only (once per phase) for its printed cost 3; both events
  // return to hand (Avian Anatomy); round 1's step one then adds Archangel's acceleration icon.
  it("Archangel: Angel of Death once per phase for the printed cost, Avian Anatomy, step one +1", () => {
    const label = "staged-archangel-death";
    const start = staged("juggernaut", 3, "Archangel", ["42007", "42015", "42008", "42008", "42022", "42022", "42022"]);
    const observer = new Observer(label);
    const result = play(label, start, observer, {
      noPolicy: true,
      stopAtRound: 2,
      script: [playEvent("42007", ["42008", "42022", "42022"]), playEvent("42015", ["42008", "42022"])],
    });
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    expect(observer.aerialPlays.get("1:player"), "two AERIAL events were played in the player phase").toBe(2);
    expect(observer.usesOf("42001c.angel-of-death", 1, "player")).toBe(1);
    expect(SEEN.get("Angel of Death dealt 3 (the event's printed cost)")).toContain(label);
    expect(SEEN.get("Avian Anatomy returned an AERIAL event to hand")).toContain(label);
    expect(SEEN.get("step one with Archangel showing (+1)")).toContain(label);
    expectReplays(result);
  });

  // Surgery: Angel showing, main scheme at 8 threat, Adaptive Plumage and Natural Flight in hand. Angel of Life draws
  // after the first AERIAL event only (once per phase).
  it("Angel: Adaptive Plumage thwarts 3 and confuses an enemy; Angel of Life once per phase", () => {
    const label = "staged-angel-plumage";
    const start = staged("stryfe", 6, "Angel", ["42003", "42006", "42022", "42022", "42022", "42008", "42008"]);
    const observer = new Observer(label);
    const result = play(label, start, observer, {
      noPolicy: true,
      stopAtRound: 2,
      script: [playEvent("42003", ["42022", "42022", "42008"]), playEvent("42006", ["42022", "42008"])],
    });
    expect(
      observer.aerialPlays.get("1:player") ?? 0,
      "two AERIAL events were played in the player phase",
    ).toBeGreaterThanOrEqual(2);
    expect(observer.usesOf("42001a.angel-of-life", 1, "player")).toBe(1);
    expect(SEEN.get("Adaptive Plumage as Angel: thwart 3 and confuse")).toContain(label);
    expectReplays(result);
  });

  // Surgery: Archangel showing, Adaptive Plumage in hand.
  it("Archangel: Adaptive Plumage attacks for 4 and stuns", () => {
    const label = "staged-archangel-plumage";
    const start = staged("stryfe", 6, "Archangel", ["42003", "42022", "42022", "42022"]);
    const result = play(label, start, new Observer(label), {
      noPolicy: true,
      stopAtRound: 2,
      script: [playEvent("42003", ["42022", "42022", "42022"])],
    });
    expect(SEEN.get("Adaptive Plumage as Archangel: attack 4 and stun")).toContain(label);
    expectReplays(result);
  });

  // Metamorphosis from each face to each other face (surgery: the face and the card in hand; the prompt answered here).
  it.each([
    ["Warren", "0"],
    ["Warren", "1"],
    ["Angel", "alterEgo"],
    ["Angel", "1"],
    ["Archangel", "alterEgo"],
    ["Archangel", "0"],
  ] as const)("Metamorphosis from %s to face %s", (from, to) => {
    const label = `staged-meta-${from}-${to}`;
    const start = staged("juggernaut", 6, from, ["42005", "42022", "42022"]);
    const result = play(label, start, new Observer(label), {
      noPolicy: true,
      stopAtRound: 2,
      script: [playEvent("42005", ["42022", "42022"])],
      choose: pickFace(to),
    });
    const reached = to === "alterEgo" ? "Warren" : to === "0" ? "Angel" : "Archangel";
    expect(SEEN.get(`Metamorphosis reached ${reached}`)).toContain(label);
    expectReplays(result);
  });

  // Surgery: as Warren, the hero-form events are in hand with the payment; the engine refuses each play.
  it("Warren cannot play a hero-form event (RRG Form: hero Actions need hero form)", () => {
    const start = staged("juggernaut", 6, "Warren", [
      "42003",
      "42006",
      "42007",
      "42015",
      "42016",
      "42022",
      "42022",
      "42022",
    ]);
    for (const code of ["42003", "42006", "42007", "42015", "42016"]) {
      const command = playEvent(code, ["42022", "42022", "42022"])(start);
      expect(applyCommand(start, command, WAVE7_DEPS).ok, `${code} played as Warren`).toBe(false);
    }
  });

  // Surgery: Hook, Line, and Sinker already in play (put there, 2 threat), Taunt (a non-AERIAL event, printed cost 1) on
  // top of Angel's deck, Spear Shot dealt to him in round 1's villain phase behind a filler card (the villain's boost).
  // Spear Shot discards Taunt and he takes 1 indirect damage, so Hook exhausts him; Juggernaut, a BRUTE, then attacks
  // with indirect damage too.
  it("Hook, Line, and Sinker exhausts a character that took indirect damage from Spear Shot", () => {
    const label = "staged-hook";
    let start = staged("juggernaut", 8, "Angel", []);
    start = stackSetAside(start, "42026");
    start = encounterCardInVillainArea(start, "42026", 2).state;
    start = stageNemesisCardForReveal(start, "42028");
    start = putOnTopOfDeck(start, P1, "42016").state;
    const result = play(label, start, new Observer(label), { noPolicy: true, stopAtRound: 2 });
    expect(SEEN.get("Hook, Line, and Sinker exhausted a character that took indirect damage")).toContain(label);
    expectReplays(result);
  });

  // Surgery: Apocalyptic Influence stacked behind a filler card (the villain's boost), Angel's player in each face.
  it.each(["Warren", "Angel", "Archangel"] as const)("Apocalyptic Influence revealed as %s", (face) => {
    const label = `staged-obligation-${face}`;
    // Stryfe, so that the villain's one activation takes one boost card (Juggernaut's completed scheme attacks again).
    const start = stackEncounterDeck(withoutEventsInHand(staged("stryfe", 6, face, [], 1)), "01186", "42024");
    const result = play(label, start, new Observer(label), { noPolicy: true, stopAtRound: 2 });
    expect(
      result.session.state.round,
      `${label}: ${JSON.stringify(result.session.state.outcome)}`,
    ).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Unique icon: the Psylocke ally against the Psylocke identity (two players)", () => {
  const trial = (psylockeForm: "alterEgo" | { heroForm: number }): boolean => {
    let s = newGame("on-the-run", [ANGEL_DECK, PSYLOCKE_DECK], 1);
    if (psylockeForm !== "alterEgo") s = withForm(s, psylockeForm, P2);
    s = moveToHand(s, P1, "42002", "42022", "42022", "42022").state;
    const hand = playerOf(s, P1).hand;
    const id = hand.find((h) => codeOf(s, h) === "42002")!;
    const payment = hand.filter((h) => codeOf(s, h) === "42022").map((h) => ({ fromHand: h }));
    return applyCommand(
      s,
      { type: "playCard", playerId: P1, cardInstanceId: id, payment, attachToInstanceId: null },
      WAVE7_DEPS,
    ).ok;
  };
  // RRG 1.8 "Unique Icon" (p. 45): the Psylocke ally's subtitle "Betsy Braddock" is the identity's alter-ego title, so they
  // match, and a matching card cannot be played while the other is in play, whichever face the identity shows.
  it("refuses Angel's Psylocke ally while the Psylocke identity is in alter-ego form", () => {
    expect(trial("alterEgo")).toBe(false);
  });
  it("refuses Angel's Psylocke ally while the Psylocke identity is in hero form", () => {
    expect(trial({ heroForm: 0 })).toBe(false);
  });
});

describe("Targeted checks seen across the games above", () => {
  const REQUIRED = [
    // the three faces and every legal change between them
    "face Warren showing",
    "face Angel showing",
    "face Archangel showing",
    "change Warren -> Angel",
    "change Warren -> Archangel",
    "change Angel -> Archangel",
    "change Archangel -> Angel",
    "change Angel -> Warren",
    "change Archangel -> Warren",
    // villain phase step one against the scheme's own acceleration
    "step one with Archangel showing (+1)",
    "step one without Archangel showing",
    // the identity's abilities
    "Angel of Life drew 1 after an AERIAL event",
    "Angel of Death dealt 3 (the event's printed cost)",
    "Angel of Death dealt 2 (the event's printed cost)",
    "Regrowth healed 1 (once per round)",
    // events and cards
    "Adaptive Plumage as Angel: thwart 3 and confuse",
    "Adaptive Plumage as Archangel: attack 4 and stun",
    "Metamorphosis reached Warren",
    "Metamorphosis reached Angel",
    "Metamorphosis reached Archangel",
    "Avian Anatomy returned an AERIAL event to hand",
    "Render Medical Aid entered play",
    "Render Medical Aid defeated",
    "Render Medical Aid healed 5",
    // obligation and nemesis
    "Apocalyptic Influence forced Archangel from Warren",
    "Apocalyptic Influence forced Archangel from Angel",
    "Apocalyptic Influence as Archangel: 2 threat",
    "Hook, Line, and Sinker exhausted a character that took indirect damage",
    "Harpoon revealed",
  ];
  it("every one was seen at least once", () => {
    const missing = REQUIRED.filter((check) => !SEEN.has(check));
    expect(missing, `never seen: ${missing.join("; ")}`).toEqual([]);
    // Every check but one came up in the played games themselves; the staged games (state surgery, named in each test)
    // are what make the rest repeatable. Only Metamorphosis reaching Archangel has no natural occurrence.
    const staged = REQUIRED.filter((check) => SEEN.get(check)!.every((label) => label.startsWith("staged-")));
    expect(staged).toEqual(["Metamorphosis reached Archangel"]);
  });
});
