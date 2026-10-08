import {
  validateDeck,
  cardOf,
  characterProfile,
  cardsInPlay,
  createGame,
  deckTopPlayOf,
  handSize,
  iconsInPlay,
  printedResources,
  replay,
  sessionApply,
  shownDeckTop,
  startSession,
  applyCommand,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { AOA_STARTER_DECKS, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import {
  P1,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play as playCard,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { playToOutcome } from "../../../testing/driver.js";
import { stackSetAsideBehindBoost, withForm } from "../../../testing/staging.js";
import { WAVE8_CARDS, WAVE8_DEPS } from "../../index.js";
import { wave8Scenario, wave8StarterDeckSetup } from "../../setup.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Magik's precon (`magik-aggression`, MC45 box rulebook: 40 cards) through the real engine and the real
 * wave 8 scripts, played by the card-name-agnostic greedy driver (`../../../testing/driver.ts`) one command at a time,
 * so every state is checked against the invariants below. Scenarios: Unus the Untouched (`wave8Scenario("unus")`,
 * standard, one player), Core's Rhino (standard, no modular set, built by `coreScenario` with Magik's seat swapped in),
 * and a few two-player rounds of Rhino with Spider-Man's Core deck. The driver never plays from the top of the deck, so
 * `nextCommand` below tries that first (the permission it needs is `deckTopPlayableBy`, the engine's own query) and
 * hands every other decision to the driver; the shared driver is untouched.
 *
 * Invariants checked after every command:
 * - no engine error on a command chosen from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices"): `minSelections` fits the options offered;
 * - the game never rests between steps with nothing pending outside a player turn (RRG Appendix II, pp. 51-52);
 * - no card instance sits in two zones; every card a deck started with is still somewhere (RRG "Owner", p. 31);
 * - the top card of her deck is shown (`shownDeckTop`) exactly while she is in hero form and the deck has a card
 *   (45030a "Play with the top card of your deck faceup"; docs/phase7-wave8.md section 3.48, Q26 = B);
 * - Crown, Soulsword and Mystical Armor (45033 to 45035): her THW / ATK / DEF equal the printed value plus 1 for each
 *   attached upgrade whose icon (mental / physical / energy, or wild) shows on the top card, hero form only (card text);
 * - the session log replays to the identical final state (the engine's determinism contract).
 *
 * Targeted checks (the `seen` tally; the last test asserts each was seen at least once, naturally or staged, as the
 * test says):
 * - 45030a play from the deck top (RRG 1.8 FAQ "Magik (#30A)", p. 64): `cardPlayed { from: "deckTop", countsAsFrom:
 *   "hand" }`, in hero form, once per phase, the card was the top card, it is not in the hand at any point, the cost
 *   paid is at least the printed cost less 1;
 * - Limbo (45032): the hand card and the top card swap places (RRG "Swap", p. 42), neither drawn nor discarded;
 * - Scrying (45036), Stepping Disc (45037): the top 3 / the discard pile move as printed;
 * - Exorcism (45038) and Soul Strike (45039) read the live top card when they resolve; Soul Strike is one attack
 *   (owner ruling Q48); Magic Barrier (45040) prevents 3 and hits back for 3 on an energy / wild top card;
 * - Belasco (45054) is villainous and draws a boost card each activation (RRG "Boost Icon / Boost Cards", p. 6, and the
 *   Villainous keyword); his forced response mills 3; Ruler of Limbo (45055) attaches Limbo facedown when revealed;
 * - hazard deals one extra card per icon in player order (RRG "Hazard Icon", p. 21); ready and draw happen at the end of
 *   the player phase (RRG Appendix II "Player Phase", p. 51).
 *
 * Known gaps, asserted only to cause no error: Illyana Rasputin's interrupt 45030b (unregistered, no window before the
 * form change) and Colossus 45031 (unregistered, no affordability gate on an in-hand self-play interrupt).
 */

const MAGIK = { starterDeckId: "magik-aggression" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const DECK_ID = "magik-aggression";
const LIMBO = "45032";
const SCRYING = "45036";
const STEPPING_DISC = "45037";
const EXORCISM = "45038";
const SOUL_STRIKE = "45039";
const MAGIC_BARRIER = "45040";
const CROWN = "45033";
const SOULSWORD = "45034";
const ARMOR = "45035";
const BELASCO = "45054";
const RULER = "45055";
const NEMESIS = ["45054", "45055", "45056", "45057", "45058"];

/** Which targeted checks were observed, and where. */
const seen = {
  deckTopShown: [] as string[],
  deckTopHiddenOnAlterEgo: [] as string[],
  deckTopPlay: [] as string[],
  deckTopPlayEvent: [] as string[],
  deckTopPlayUpgrade: [] as string[],
  limboSwap: [] as string[],
  scrying: [] as string[],
  steppingDisc: [] as string[],
  exorcism: [] as string[],
  exorcismConfused: [] as string[],
  soulStrike: [] as string[],
  soulStrikeStunned: [] as string[],
  magicBarrier: [] as string[],
  magicBarrierHitBack: [] as string[],
  upgradeBonus: [] as string[],
  belascoBoost: [] as string[],
  belascoMill: [] as string[],
  rulerLimbo: [] as string[],
  nemesis: [] as string[],
  darkchilde: [] as string[],
  hazardExtraDeal: [] as string[],
  readyAndDraw: [] as string[],
  stunnedCanceled: [] as string[],
  confusedCanceled: [] as string[],
  twoPlayer: [] as string[],
};

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
  readonly label: string;
}

const typeOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.type;
const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const seatOf = (s: GameState): PlayerId =>
  s.players.find((p) => codeOf(s, p.identity.instanceId).startsWith("45030"))!.playerId;
const magikOf = (s: GameState) => s.players.find((p) => p.playerId === seatOf(s))!;

/** Whether the printed resource icons of `id` include `type` or a wild (what `topOfYourDeckHas` reads, section 3.50). */
function hasIcon(s: GameState, id: InstanceId, type: "mental" | "physical" | "energy"): boolean {
  const card = cardOf(s, id);
  if (!card) return false;
  const icons = printedResources(card);
  return icons[type] > 0 || icons.wild > 0;
}

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
    if (labels.length > 1) fail(`${id} (${nameOf(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${nameOf(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard"] as const)
      for (const id of p[zone]) {
        const dealt = dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${nameOf(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        if (zone !== "hand" && dealt === undefined)
          fail(`${nameOf(s, id)} (${id}) is in ${p.playerId}'s ${zone} but no deck started with it`);
      }
  // The top card is shown exactly in hero form with a card in the deck (45030a; Q26 = B).
  const m = s.players.find((p) => codeOf(s, p.identity.instanceId).startsWith("45030"));
  if (m) {
    const shown = shownDeckTop(s, WAVE8_DEPS, m.playerId);
    if (m.identity.form === "hero" && m.deck.length > 0)
      expect(shown, `[${where}] the top card of her deck is faceup in hero form`).toBe(m.deck[0]);
    else expect(shown, `[${where}] nothing shown in alter-ego form or with an empty deck`).toBeNull();
  }
}

/** An ability of Magik's kit that started: judged once nothing is pending, from the events since it started. */
interface Watch {
  readonly id: string;
  readonly here: string;
  /** The state before the command in which it started. */
  readonly before: GameState;
  /** Every event from the start of the ability on. */
  readonly events: GameEvent[];
  /** A later activation of the same ability began: no more events are collected. */
  closed: boolean;
}

const WATCHED = [
  "45054.belasco-forced-response",
  "45032.limbo-response",
  "45032.limbo-action",
  "45036.scrying-action",
  "45037.stepping-disc-action",
  "45038.exorcism-action",
  "45039.soul-strike-action",
  "45040.magic-barrier-interrupt",
];

/** Watches events, one command at a time, for the targeted checks and the per-round rules. */
class Observer {
  private lastRound = 0;
  /** Phase key of the latest deck-top play, per seat: at most one per phase. */
  private deckTopPlays = new Map<string, number>();
  private watch: Watch[] = [];
  constructor(readonly label: string) {}

  observe(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    if (this.lastRound === 0) this.lastRound = before.round;
    const pid = seatOf(after);
    const here = `${this.label} round ${before.round} ${command.type}`;
    const magikBefore = before.players.find((p) => p.playerId === pid)!;
    const magikAfter = magikOf(after);
    const identity = magikAfter.identity.instanceId;
    const formBefore = magikBefore.identity.form;
    const topBefore = magikBefore.deck[0];
    const nm = (id: InstanceId) => nameOf(after, id);

    // The top card shown / hidden announcements follow the form (deckTopShown / deckTopHidden).
    for (const e of events) {
      if (e.type === "deckTopShown" && e.playerId === pid) {
        expect(magikAfter.identity.form, `${here}: deckTopShown only while in hero form`).toBe("hero");
        seen.deckTopShown.push(here);
      }
      if (e.type === "deckTopHidden" && e.playerId === pid) {
        // (Hidden too when she is eliminated: the game ends with her deck dealt out.)
        if (!magikAfter.eliminated)
          expect(magikAfter.identity.form, `${here}: deckTopHidden when the hero face is gone`).toBe("alterEgo");
        seen.deckTopHiddenOnAlterEgo.push(here);
      }
    }

    for (const e of events) {
      for (const w of this.watch) if (!w.closed) w.events.push(e);
      switch (e.type) {
        case "cardPlayed": {
          if (e.from === "deckTop") {
            // RRG 1.8 FAQ "Magik (#30A)" (p. 64): played from the top of her deck, counted as played from her hand.
            expect(e.playerId, `${here}: deck-top play by Magik`).toBe(pid);
            expect(e.countsAsFrom, `${here}: counts as played from hand`).toBe("hand");
            expect(formBefore, `${here}: hero form only`).toBe("hero");
            expect(e.instanceId, `${here}: the card was the top card`).toBe(topBefore);
            expect(magikBefore.hand.includes(e.instanceId), `${here}: it was never in her hand`).toBe(false);
            const key = `${before.round}:${before.step.phase}`;
            expect(this.deckTopPlays.get(key) ?? 0, `${here}: once per phase`).toBe(0);
            this.deckTopPlays.set(key, 1);
            const printed = (cardOf(before, e.instanceId) as unknown as { cost: number }).cost;
            expect(e.resourcesPaid, `${here}: cost less 1`).toBeGreaterThanOrEqual(Math.max(0, printed - 1));
            expect(magikAfter.hand.includes(e.instanceId), `${here}: not in the hand afterward`).toBe(false);
            seen.deckTopPlay.push(`${here} ${nm(e.instanceId)}`);
            if (typeOf(after, e.instanceId) === "event") seen.deckTopPlayEvent.push(here);
            if (typeOf(after, e.instanceId) === "upgrade") seen.deckTopPlayUpgrade.push(here);
          }
          break;
        }
        case "encounterCardRevealed":
          if (NEMESIS.includes(String(e.cardId))) seen.nemesis.push(`${here} ${String(e.cardId)}`);
          if (String(e.cardId) === "45053") seen.darkchilde.push(here);
          if (String(e.cardId) === RULER) this.checkRulerLimbo(before, after, here);
          break;
        case "boostCardFlipped":
          if (codeOf(after, e.enemyInstanceId) === BELASCO) {
            // Belasco is villainous (data): he draws a boost card each activation (Villainous keyword, RRG p. 48).
            seen.belascoBoost.push(here);
          }
          break;
        case "abilityResolved": {
          // The event is raised as the ability starts; its effects (and any prompt of theirs) finish later, so the
          // checks run once nothing is pending (`finish`), against the state before the command that started it.
          const id = String(e.abilityId);
          if (WATCHED.includes(id)) {
            // A later activation of the same ability opens its own window: the earlier one ends here.
            for (const w of this.watch) if (w.id === id) w.closed = true;
            this.watch.push({ id, here, before, events: [], closed: false });
          }
          break;
        }

        case "roundStarted":
          expect(e.round - this.lastRound, "rounds advance one at a time").toBe(1);
          this.lastRound = e.round;
          break;
        default:
      }
    }

    if (!after.pendingChoice) {
      const done = this.watch;
      this.watch = [];
      for (const w of done) this.finish(w, after);
    }

    // Upgrade stat bonuses follow the live top card (45033 to 45035), hero form only.
    if (!after.outcome && magikAfter.identity.form === "hero") {
      const card = cardOf(after, identity) as unknown as HeroIdentityCard;
      const profile = characterProfile(after, identity, WAVE8_DEPS);
      const top = magikAfter.deck[0];
      const attached = (code: string) => after.instances[identity]!.attachments.some((a) => codeOf(after, a) === code);
      if (profile && top && !after.pendingChoice) {
        const tally = (code: string, stat: "thw" | "atk" | "def", type: "mental" | "physical" | "energy") => {
          if (!attached(code)) return;
          // Other cards that move her stats are not in this deck; a temporary modifier would still be a bonus.
          const bonus = hasIcon(after, top, type) ? 1 : 0;
          const expected = card.hero[stat] + bonus;
          expect(profile[stat], `${here}: ${stat} with ${nm(top)} on top`).toBe(expected);
          seen.upgradeBonus.push(`${stat}${bonus}`);
        };
        tally(CROWN, "thw", "mental");
        tally(SOULSWORD, "atk", "physical");
        tally(ARMOR, "def", "energy");
      }
    }

    // Stunned / confused labeled abilities do nothing at all (RRG p. 26): a stunned Soul Strike makes no attack.
    for (const e of events) {
      if (e.type === "statusRemoved" && e.instanceId === identity && ["stunned", "confused"].includes(e.status)) {
        const played = events.find((x) => x.type === "cardPlayed" && x.playerId === pid);
        const code = played && played.type === "cardPlayed" ? String(played.cardId) : "";
        if (e.status === "stunned" && code === SOUL_STRIKE) {
          expect(
            this.triggers(events).some((x) => x.kind === "attack" && x.phase === "initiated"),
            `${here}: stunned Soul Strike attacks`,
          ).toBe(false);
          seen.stunnedCanceled.push(here);
        }
        if (e.status === "confused" && code === EXORCISM) {
          expect(
            this.triggers(events).some((x) => x.kind === "thwart" && x.phase === "initiated"),
            `${here}: confused Exorcism thwarts`,
          ).toBe(false);
          seen.confusedCanceled.push(here);
        }
      }
    }

    // Villain phase step 3: one card to each player, plus one to a player per hazard icon, in player order (RRG p. 21, 47).
    const dealStep = events.findIndex(
      (e) => e.type === "stepChanged" && e.to.phase === "villain" && e.to.kind === "dealEncounterCards",
    );
    if (dealStep >= 0) {
      const end = events.findIndex(
        (e, i) => i > dealStep && e.type === "stepChanged" && e.to.kind === "revealEncounterCards",
      );
      const slice = events.slice(dealStep, end < 0 ? events.length : end);
      const dealtCount = (p: PlayerId) =>
        slice.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.to.playerId === p).length;
      const preDeal = events.slice(0, dealStep);
      const stale = preDeal.some(
        (e) =>
          e.type === "encounterCardRevealed" ||
          e.type === "cardDiscardedFromPlay" ||
          (e.type === "cardMoved" &&
            (e.to.kind === "villainArea" || e.to.kind === "playArea" || e.to.kind === "attachment")),
      );
      const hazards = iconsInPlay(before, WAVE8_DEPS, "hazard");
      const dealt = slice.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter").length;
      const order = before.players.filter((pl) => !pl.eliminated);
      const start = Math.max(
        0,
        order.findIndex((pl) => pl.playerId === before.firstPlayerId),
      );
      const expected = new Map(order.map((pl) => [pl.playerId, 1]));
      for (let i = 0; i < hazards; i++) {
        const pl = order[(start + i) % order.length]!;
        expected.set(pl.playerId, expected.get(pl.playerId)! + 1);
      }
      if (!stale && dealt > 0) {
        for (const pl of order)
          expect(dealtCount(pl.playerId), `${here}: cards dealt to ${pl.playerId} with ${hazards} hazard icons`).toBe(
            expected.get(pl.playerId),
          );
      }
      if (hazards > 0) seen.hazardExtraDeal.push(`${here} hazards=${hazards}`);
    }

    // End of the player phase: each player draws up to hand size and readies each exhausted card (RRG Appendix II, p. 51).
    const leftPlayerPhase = events.some(
      (e) => e.type === "stepChanged" && e.from.phase === "player" && e.to.phase === "villain",
    );
    if (leftPlayerPhase && !after.outcome) {
      for (const p of before.players.filter((pl) => !pl.eliminated)) {
        const size = handSize(before, p.playerId, WAVE8_DEPS);
        const drawn = events.filter((e) => e.type === "cardDrawn" && e.playerId === p.playerId).length;
        const wantedDraw = Math.max(0, size - p.hand.length);
        if (p.deck.length + p.discard.length >= wantedDraw)
          expect(
            drawn,
            `${here}: ${p.playerId} draws from ${p.hand.length} to hand size ${size}`,
          ).toBeGreaterThanOrEqual(wantedDraw);
        if (before.instances[p.identity.instanceId]!.exhausted)
          expect(
            events.some((e) => e.type === "cardReadied" && e.instanceId === p.identity.instanceId),
            `${here}: ${p.playerId}'s exhausted identity readies`,
          ).toBe(true);
      }
      seen.readyAndDraw.push(here);
    }
  }

  /** Judges one watched ability against the state in which it finished. */
  private finish(w: Watch, after: GameState): void {
    const { here, before, events } = w;
    const pid = seatOf(after);
    const magikBefore = before.players.find((p) => p.playerId === pid)!;
    const magikAfter = magikOf(after);
    const identity = magikAfter.identity.instanceId;
    const nm = (id: InstanceId) => nameOf(after, id);
    const moves = (from: string, to: string) =>
      events.filter(
        (x): x is Extract<GameEvent, { type: "cardMoved" }> =>
          x.type === "cardMoved" && x.from.kind === from && x.to.kind === to,
      );
    const top = magikAfter.deck[0];
    // The top card read at resolution is the top card now only while nothing changed it since the ability began.
    const stable = !events.some((x) => x.type === "deckTopShown" || x.type === "deckTopHidden");
    switch (w.id) {
      case "45054.belasco-forced-response": {
        const milled = events.filter((x) => x.type === "cardDiscardedFromDeck" && x.playerId === pid).length;
        if (magikBefore.deck.length >= 3) expect(milled, `${here}: Belasco mills 3`).toBe(3);
        seen.belascoMill.push(`${here} milled=${milled}`);
        break;
      }
      case "45032.limbo-response":
      case "45032.limbo-action": {
        // RRG "Swap" (p. 42): the hand card goes on top, the top card enters the hand; neither is drawn nor discarded.
        const mine = (x: Extract<GameEvent, { type: "cardMoved" }>) =>
          (x.to as { playerId?: PlayerId }).playerId === pid || (x.from as { playerId?: PlayerId }).playerId === pid;
        const toHand = moves("deck", "hand").filter(mine);
        const toDeck = moves("hand", "deck").filter(mine);
        expect(toHand.length, `${here}: one card from the deck to the hand`).toBeGreaterThanOrEqual(1);
        expect(toDeck.length, `${here}: one card from the hand to the deck`).toBeGreaterThanOrEqual(1);
        // (Later events of a long window may spend the swapped-in card, so the state afterward is not read: the swap
        // is the `cardsSwapped` event and the two moves before it.)
        const swapped = events.findIndex((x) => x.type === "cardsSwapped");
        expect(swapped, `${here}: a cardsSwapped event`).toBeGreaterThanOrEqual(0);
        expect(events.indexOf(toHand[0]!), `${here}: the moves precede the swap announcement`).toBeLessThan(swapped);
        expect(events.indexOf(toDeck[0]!), `${here}: the moves precede the swap announcement`).toBeLessThan(swapped);
        const firstMove = events.indexOf(toHand[0]!);
        const lastMove = events.indexOf(toDeck[0]!);
        expect(
          events.slice(0, Math.max(firstMove, lastMove)).some((x) => x.type === "cardDrawn" && x.playerId === pid),
          `${here}: a swap is not a draw`,
        ).toBe(false);
        seen.limboSwap.push(here);
        break;
      }
      case "45036.scrying-action": {
        // Choose one of the top 3 to draw, one of the 2 still on top to discard; the last stays on top.
        const drawn = moves("deck", "hand");
        const discarded = events.filter(
          (x) =>
            x.type === "cardDiscardedFromDeck" ||
            (x.type === "cardMoved" && x.from.kind === "deck" && x.to.kind === "discard"),
        );
        const window = magikBefore.deck.slice(0, 4);
        if (magikBefore.deck.length >= 4) {
          expect(drawn.length, `${here}: Scrying draws one`).toBe(1);
          expect(window, `${here}: ... of the top 3`).toContain(drawn[0]!.instanceId);
          expect(discarded.length, `${here}: Scrying discards one`).toBeGreaterThanOrEqual(1);
          expect(window, `${here}: the card left on top was among the top 3`).toContain(top);
          seen.scrying.push(here);
        }
        break;
      }
      case "45037.stepping-disc-action": {
        expect(after.instances[identity]!.exhausted, `${here}: Stepping Disc readies her`).toBe(false);
        const toTop = moves("discard", "deck");
        for (const m of toTop)
          expect(nm(m.instanceId), `${here}: never a second Stepping Disc`).not.toBe("Stepping Disc");
        seen.steppingDisc.push(`${here} ${toTop.map((m) => nm(m.instanceId)).join(",") || "(none)"}`);
        break;
      }
      case "45038.exorcism-action": {
        const villain = after.villains[0]?.instanceId;
        seen.exorcism.push(here);
        if (
          stable &&
          villain &&
          top &&
          magikAfter.identity.form === "hero" &&
          !events.some((x) => x.type === "statusRemoved")
        ) {
          if (hasIcon(after, top, "mental")) {
            expect(after.instances[villain]!.statuses.confused, `${here}: ${nm(top)} shows mental: confused`).toBe(1);
            seen.exorcismConfused.push(here);
          } else if (!before.instances[villain]!.statuses.confused)
            expect(after.instances[villain]!.statuses.confused, `${here}: ${nm(top)} shows no mental`).toBe(0);
        }
        break;
      }
      case "45039.soul-strike-action": {
        const trig = this.triggers(events);
        expect(
          trig.filter((x) => x.kind === "attack" && x.phase === "initiated").length,
          `${here}: Soul Strike is one attack (Q48)`,
        ).toBe(events.some((x) => x.type === "statusRemoved" && x.status === "stunned") ? 0 : 1);
        const hit = trig.find((x) => x.kind === "dealDamage" && x.phase === "initiated" && x.fromAttack === true);
        const target = hit?.targetInstanceId as InstanceId | undefined;
        seen.soulStrike.push(here);
        if (
          stable &&
          target &&
          top &&
          !events.some((x) => x.type === "statusRemoved" || x.type === "villainStageAdvanced")
        ) {
          if (after.instances[target] && cardsInPlay(after).includes(target)) {
            if (hasIcon(after, top, "physical")) {
              expect(after.instances[target]!.statuses.stunned, `${here}: ${nm(top)} shows physical: stunned`).toBe(1);
              seen.soulStrikeStunned.push(here);
            } else if (!before.instances[target]!.statuses.stunned)
              expect(after.instances[target]!.statuses.stunned, `${here}: ${nm(top)} shows no physical`).toBe(0);
          }
        }
        break;
      }
      case "45040.magic-barrier-interrupt": {
        seen.magicBarrier.push(here);
        if (stable && top && hasIcon(after, top, "energy")) {
          // (3 damage, not an attack: the attacker's tough status may prevent it, which is still a dealDamage of 3.)
          expect(
            this.triggers(events).some(
              (x) =>
                x.kind === "dealDamage" &&
                x.phase === "initiated" &&
                x.amount === 3 &&
                x.fromAttack !== true &&
                x.targetInstanceId !== identity,
            ),
            `${here}: ${nm(top)} shows energy: 3 damage back at the attacker`,
          ).toBe(true);
          seen.magicBarrierHitBack.push(here);
        }
        break;
      }
      default:
    }
  }

  /** Ruler of Limbo reveals: Limbo, wherever she holds it, is attached facedown (45055 When Revealed). */
  private checkRulerLimbo(before: GameState, after: GameState, here: string): void {
    const p = magikOf(before);
    const holdsLimbo = [...p.deck, ...p.hand, ...p.discard].some((id) => codeOf(before, id) === LIMBO);
    const ruler = Object.values(after.instances).find((i) => i.cardId === RULER && i.attachments.length >= 0);
    if (!ruler || after.pendingChoice) return;
    const limbo = ruler.attachments.filter((a) => codeOf(after, a) === LIMBO);
    if (holdsLimbo) {
      expect(limbo.length, `${here}: Limbo attached to Ruler of Limbo`).toBe(1);
      expect(after.instances[limbo[0]!]!.faceup, `${here}: ... facedown`).toBe(false);
      seen.rulerLimbo.push(here);
    }
  }

  private triggers(events: readonly GameEvent[]): Record<string, unknown>[] {
    return events.flatMap((e): Record<string, unknown>[] =>
      e.type === "triggerEvent" ? [{ ...(e.event as unknown as Record<string, unknown>), phase: e.phase }] : [],
    );
  }
}

/**
 * The driver never plays from the top of the deck: try that first when Magik is in hero form, the permission is in
 * force and a payment from her hand covers the cost less 1. The play is committed only when the engine accepts it.
 */
function deckTopPlay(s: GameState, playerId: PlayerId): Command | null {
  const p = s.players.find((x) => x.playerId === playerId)!;
  if (!codeOf(s, p.identity.instanceId).startsWith("45030") || p.identity.form !== "hero") return null;
  for (const id of p.deck.slice(0, 1).filter((c) => deckTopPlayOf(s, WAVE8_DEPS, playerId, c) !== null)) {
    const card = cardOf(s, id);
    if (!card || card.type === "resource" || !("cost" in card)) continue;
    const needed = Math.max(0, card.cost - 1);
    const hosts: (InstanceId | null)[] = card.type === "upgrade" ? [p.identity.instanceId] : [null];
    for (const order of [
      [...p.hand].sort((a, b) => Number(typeOf(s, b) === "resource") - Number(typeOf(s, a) === "resource")),
    ]) {
      const payment: { fromHand: InstanceId }[] = [];
      let sum = 0;
      for (const h of order) {
        if (sum >= needed) break;
        const c = cardOf(s, h);
        const icons = c ? printedResources(c) : null;
        payment.push({ fromHand: h });
        sum += icons ? icons.physical + icons.mental + icons.energy + icons.wild : 0;
      }
      if (sum < needed) continue;
      for (const host of hosts) {
        const command: Command = {
          type: "playCard",
          playerId,
          cardInstanceId: id,
          payment,
          attachToInstanceId: host,
        };
        if (applyCommand(s, command, WAVE8_DEPS).ok) return command;
      }
    }
  }
  return null;
}

function nextCommand(
  session: GameSession,
  turn: { key: string; n: number },
  script: ((s: GameState) => Command)[],
): Command {
  const s = session.state;
  if (!s.pendingChoice && !s.outcome && script.length > 0) return script.shift()!(s);
  if (!s.pendingChoice && s.step.phase === "player" && s.step.kind === "turn") {
    const key = `${s.round}:${s.step.activePlayerId}`;
    if (turn.key !== key) Object.assign(turn, { key, n: 0 });
    if (++turn.n > 40) return { type: "endTurn", playerId: s.step.activePlayerId };
    const top = deckTopPlay(s, s.step.activePlayerId);
    if (top) return top;
  }
  const [command] = playToOutcome(s, WAVE8_DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

interface PlayOptions {
  readonly stopAtRound?: number;
  readonly maxCommands?: number;
  /** Commands issued first, one per step at which nothing is pending, before the driver takes over. */
  readonly script?: readonly ((s: GameState) => Command)[];
}

/** Plays `initial` to an outcome (or `stopAtRound`), checking every invariant after every command. */
function play(initial: GameState, observer: Observer, options: PlayOptions = {}): GameResult {
  const dealtTo = new Map<string, PlayerId>();
  for (const p of initial.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) if (initial.instances[id]!.ownerId === p.playerId) dealtTo.set(id, p.playerId);
  checkState(initial, dealtTo, "start");
  let session = startSession(initial);
  const turn = { key: "", n: 0 };
  const script = [...(options.script ?? [])];
  const maxCommands = options.maxCommands ?? 2500;
  let commands = 0;
  while (!session.state.outcome && (options.stopAtRound === undefined || session.state.round < options.stopAtRound)) {
    if (commands >= maxCommands)
      throw new Error(`no outcome after ${maxCommands} commands (round ${session.state.round})`);
    const before = session.state;
    const command = nextCommand(session, turn, script);
    const result = sessionApply(session, command, WAVE8_DEPS);
    if (!result.ok)
      throw new Error(`engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    commands++;
    observer.observe(before, session.state, result.events, command);
    checkState(session.state, dealtTo, `${observer.label} command ${commands} ${JSON.stringify(command)}`);
  }
  return { session, commands, label: observer.label };
}

/** The log replays to a deep-equal final state (and the replay itself reports no error). */
function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, WAVE8_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

const start = (config: ReturnType<typeof wave8Scenario>): GameState => {
  const created = createGame(config, WAVE8_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
};

/** Unus the Untouched, standard, Magik alone (the opening hand kept). */
const unus = (seed: number): GameState => start(wave8Scenario("unus", { players: [MAGIK], seed }));

/** Core's Rhino, standard, no modular set, with Magik's precon seated (and Spider-Man's Core deck in seat 1 for two). */
const rhino = (seed: number, seats: readonly { starterDeckId: string }[] = [MAGIK]): GameState =>
  start({
    ...coreScenario("rhino", {
      players: [SPIDER_MAN],
      seed,
      modularSetIds: [],
      cardPool: WAVE8_CARDS,
    }),
    players: seats.map((seat) => wave8StarterDeckSetup(seat.starterDeckId)),
  });

const completedRounds = (r: GameResult) => r.session.state.round - 1;

describe("the printed deck", () => {
  const deck = AOA_STARTER_DECKS.find((d) => d.id === DECK_ID)!;
  it("is 40 cards and legal against the wave 8 pool (box rulebook; RRG 1.8 Appendix I)", () => {
    expect(deck.cards.reduce((n, c) => n + c.quantity, 0)).toBe(40);
    expect(
      validateDeck({ identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards }, WAVE8_CARDS),
    ).toEqual({ ok: true });
  });
  it("seats as 40 cards in the opening zones with the nemesis set aside and the obligation out of the deck", () => {
    const s = unus(1);
    const p = playerOf(s, P1);
    expect(p.hand.length + p.deck.length + p.discard.length + p.playArea.length).toBe(40);
    expect(p.hand).toHaveLength(6);
    expect(p.setAside.map((id) => codeOf(s, id)).sort()).toEqual(
      expect.arrayContaining([BELASCO, RULER, "45056", "45057", "45058"]),
    );
  });
});

describe("Magik precon, Unus the Untouched, standard, one player", () => {
  it.each([1, 2, 3, 4, 5, 6])("seed %i plays to an outcome with every invariant intact", (seed) => {
    const result = play(unus(seed), new Observer(`unus#${seed}`));
    expect(result.session.state.outcome).not.toBeNull();
    expect(completedRounds(result)).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Magik precon, Rhino, standard, one player", () => {
  it.each([1, 2, 3, 4, 5, 6])("seed %i plays to an outcome with every invariant intact", (seed) => {
    const result = play(rhino(seed), new Observer(`rhino#${seed}`));
    expect(result.session.state.outcome).not.toBeNull();
    expect(completedRounds(result)).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Magik and Spider-Man, two players, Rhino", () => {
  it.each([1, 2, 3])("seed %i plays three full rounds with every invariant intact", (seed) => {
    const result = play(rhino(seed, [SPIDER_MAN, MAGIK]), new Observer(`rhino#${seed}+spidey`), { stopAtRound: 4 });
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    seen.twoPlayer.push(`rhino#${seed}`);
    expectReplays(result);
  });
});

/** Surgery: these cards (from the deck, hand or discard pile) go on top of Magik's deck, in order. */
function stackDeck(state: GameState, ...wanted: readonly string[]): GameState {
  const owner = playerOf(state, P1);
  const used: InstanceId[] = [];
  for (const code of wanted) {
    const id = [...owner.deck, ...owner.discard, ...owner.hand].find(
      (c) => codeOf(state, c) === code && !used.includes(c),
    );
    if (!id) throw new Error(`no ${code}`);
    used.push(id);
  }
  const strip = (zone: readonly InstanceId[]) => zone.filter((id) => !used.includes(id));
  const takenFromHand = owner.hand.length - strip(owner.hand).length;
  const rest = [...strip(owner.deck), ...strip(owner.discard)];
  const refill = rest.slice(rest.length - takenFromHand);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            deck: [...used, ...rest.slice(0, rest.length - takenFromHand)],
            discard: [],
            hand: [...strip(owner.hand), ...refill],
          }
        : p,
    ),
  };
}

const handCard = (s: GameState, code: string): InstanceId => playerOf(s, P1).hand.find((h) => codeOf(s, h) === code)!;

/** Plays `code` from the hand, paying with the other hand cards named in `pay` (or the first ones that cover it). */
const playFromHandCommand =
  (code: string, host: "identity" | null = null) =>
  (s: GameState): Command => {
    const id = handCard(s, code);
    const cost = (s.cardPool[code as never] as unknown as { cost: number }).cost;
    const payment: InstanceId[] = [];
    let paid = 0;
    for (const h of playerOf(s, P1).hand) {
      if (paid >= cost) break;
      if (
        h === id ||
        ["45036", "45037", "45038", "45039", "45040", "45032", "45033", "45034", "45035"].includes(codeOf(s, h))
      )
        continue;
      const c = cardOf(s, h);
      const icons = c ? printedResources(c) : null;
      payment.push(h);
      paid += icons ? icons.physical + icons.mental + icons.energy + icons.wild : 0;
    }
    return playCard(P1, id, payment, host === "identity" ? { attachToInstanceId: identityOf(s) } : {});
  };

const heroRhino = (seed = 1): GameState => withForm(rhino(seed), { heroForm: 0 }, P1);

describe("Staged: the top card of her deck", () => {
  it("is faceup in hero form, hidden in alter-ego form, and follows the top card (45030a)", () => {
    const ego = rhino(1);
    expect(shownDeckTop(ego, WAVE8_DEPS, P1)).toBeNull();
    // Alter-ego to hero (round 1), end the turn, hero back to alter-ego (round 2: one voluntary change per round).
    const result = play(ego, new Observer("staged-form"), {
      stopAtRound: 3,
      script: [
        () => ({ type: "changeForm", playerId: P1 }),
        () => endTurn(P1),
        () => ({ type: "changeForm", playerId: P1 }),
      ],
    });
    expect(seen.deckTopShown.some((x) => x.startsWith("staged-form"))).toBe(true);
    expect(playerOf(result.session.state, P1).identity.form).toBe("alterEgo");
    expect(seen.deckTopHiddenOnAlterEgo.some((x) => x.startsWith("staged-form"))).toBe(true);
    expectReplays(result);
  });

  it("she may play it once per phase at 1 less: Colossus (3) from the top costs 2, then no second play", () => {
    // Colossus is unregistered (no ability), so this proves only the permission and the reduced cost; his interrupt
    // is held (docs/phase7-wave8.md section 3.60): playing him as an ally from hand raises no error.
    const s = stackDeck(heroRhino(), "45031", LIMBO);
    const pay = playerOf(s, P1).hand.slice(0, 2);
    const colossus = playerOf(s, P1).deck[0]!;
    const before = playerOf(s, P1).hand.length;
    const next = applyOk(s, playCard(P1, colossus, pay), WAVE8_DEPS).state;
    const done = settle(next, firstLegal, undefined, WAVE8_DEPS);
    expect(playerOf(done, P1).playArea).toContain(colossus);
    expect(playerOf(done, P1).hand.length).toBe(before - 2);
    expect(codeOf(done, playerOf(done, P1).deck[0]!)).toBe(LIMBO);
    expect(applyCommand(done, playCard(P1, playerOf(done, P1).deck[0]!), WAVE8_DEPS).ok).toBe(false);
  });
});

describe("Staged: Limbo (45032) swaps a hand card with the top card", () => {
  it("action: the chosen hand card goes on top, the top card enters the hand", () => {
    const s = moveToHand(stackDeck(heroRhino(), SCRYING, "45031"), P1, LIMBO).state;
    const result = play(s, new Observer("staged-limbo"), {
      stopAtRound: 2,
      script: [
        playFromHandCommand(LIMBO),
        (st) => ({
          type: "useAbility",
          playerId: P1,
          cardInstanceId: playerOf(st, P1).playArea.find((i) => codeOf(st, i) === LIMBO)!,
          abilityId: "45032.limbo-action" as never,
          payment: [],
        }),
      ],
    });
    expect(seen.limboSwap.some((x) => x.startsWith("staged-limbo"))).toBe(true);
    expectReplays(result);
  });
});

describe("Staged: Scrying and Stepping Disc (45036, 45037)", () => {
  it("Scrying draws one of the top 3, discards one of the other two, the last stays on top", () => {
    const s = stackDeck(heroRhino(), SCRYING, "45031", LIMBO, EXORCISM);
    const scrying = playerOf(s, P1).deck[0]!;
    const result = play(withHandOf(s, scrying), new Observer("staged-scrying"), {
      stopAtRound: 2,
      script: [playFromHandCommand(SCRYING)],
    });
    expect(seen.scrying.some((x) => x.startsWith("staged-scrying"))).toBe(true);
    expectReplays(result);
  });
  it("Stepping Disc readies her and puts a Magik card from the discard pile on top, never a second Stepping Disc", () => {
    let s = stackDeck(heroRhino(), STEPPING_DISC, SCRYING);
    const [disc, scrying] = playerOf(s, P1).deck.slice(0, 2) as [InstanceId, InstanceId];
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              deck: p.deck.filter((i) => i !== scrying && i !== disc),
              hand: [...p.hand, disc],
              discard: [scrying],
            }
          : p,
      ),
    };
    s = patchInstance(s, identityOf(s), { exhausted: true });
    const result = play(s, new Observer("staged-disc"), {
      stopAtRound: 2,
      script: [playFromHandCommand(STEPPING_DISC)],
    });
    expect(seen.steppingDisc.some((x) => x.startsWith("staged-disc") && x.includes("Scrying"))).toBe(true);
    expectReplays(result);
  });
});

/** Moves `id` (the first copy of a card on the deck) into the hand, leaving the rest of the deck in order. */
function withHandOf(s: GameState, id: InstanceId): GameState {
  return {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), hand: [...p.hand, id] } : p,
    ),
  };
}

describe("Staged: Exorcism and Soul Strike read the live top card (45038, 45039)", () => {
  // Top cards by icon: Limbo shows no icon of interest (support), so use cards whose resource icons are known.
  type Icon = "mental" | "physical" | "!mental" | "!physical";
  const topShowing = (state: GameState, type: Icon): GameState => {
    const owner = playerOf(state, P1);
    const bare = type.replace("!", "") as "mental" | "physical";
    const wanted = owner.deck.find((id) => {
      const card = cardOf(state, id)!;
      if (card.type === "event" && ["45038", "45039", "45040"].includes(card.id as string)) return false;
      return type.startsWith("!") ? !hasIcon(state, id, bare) : hasIcon(state, id, bare);
    });
    if (!wanted) throw new Error(`no ${type} card in the deck`);
    return {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [wanted, ...p.deck.filter((i) => i !== wanted)] } : p,
      ),
    };
  };
  const withCard = (code: string, type: Icon) => {
    let s = heroRhino(2);
    const id =
      playerOf(s, P1).deck.find((i) => codeOf(s, i) === code) ??
      playerOf(s, P1).hand.find((i) => codeOf(s, i) === code);
    if (!id) throw new Error(`no ${code}`);
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1
          ? { ...p, deck: p.deck.filter((i) => i !== id), hand: [...p.hand.filter((i) => i !== id), id] }
          : p,
      ),
    };
    return topShowing(s, type);
  };
  const exorcism = (s: GameState): Command => playFromHandCommand(EXORCISM)(s);
  const soulStrike = (s: GameState): Command => playFromHandCommand(SOUL_STRIKE)(s);

  it.each(["mental", "!mental"] as const)("Exorcism with a %s top card", (type) => {
    const s = withCard(EXORCISM, type);
    play(s, new Observer(`staged-exorcism-${type}`), { stopAtRound: 2, script: [exorcism] });
    expect(seen.exorcism.some((x) => x.startsWith(`staged-exorcism-${type}`))).toBe(true);
  });
  it.each(["physical", "!physical"] as const)("Soul Strike with a %s top card", (type) => {
    const s = withCard(SOUL_STRIKE, type);
    play(s, new Observer(`staged-strike-${type}`), { stopAtRound: 2, script: [soulStrike] });
    expect(seen.soulStrike.some((x) => x.startsWith(`staged-strike-${type}`))).toBe(true);
  });
  // RRG 1.8 "Labeled Ability" (p. 26): a stunned identity's (attack) labeled ability does nothing at all, costs excepted.
  it("a stunned Soul Strike makes no attack; a confused Exorcism thwarts nothing", () => {
    let s = withCard(SOUL_STRIKE, "physical");
    s = patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, stunned: 1 } });
    play(s, new Observer("staged-stunned"), { stopAtRound: 2, script: [soulStrike] });
    let t = withCard(EXORCISM, "mental");
    t = patchInstance(t, identityOf(t), { statuses: { ...inst(t, identityOf(t)).statuses, confused: 1 } });
    play(t, new Observer("staged-confused"), { stopAtRound: 2, script: [exorcism] });
    expect(seen.stunnedCanceled.some((x) => x.startsWith("staged-stunned"))).toBe(true);
    expect(seen.confusedCanceled.some((x) => x.startsWith("staged-confused"))).toBe(true);
  });
});

describe("Staged: the three upgrades follow the top card (45033 to 45035)", () => {
  it.each([
    [CROWN, "thw"],
    [SOULSWORD, "atk"],
    [ARMOR, "def"],
  ] as const)("%s adds 1 %s only while the top card shows its icon (hero form)", (code, stat) => {
    let s = heroRhino(3);
    s = moveToHand(s, P1, code).state;
    const result = play(s, new Observer(`staged-${code}`), {
      stopAtRound: 3,
      script: [playFromHandCommand(code, "identity")],
    });
    expect(
      inst(result.session.state, identityOf(result.session.state)).attachments.map((a) =>
        codeOf(result.session.state, a),
      ),
    ).toContain(code);
    expect(seen.upgradeBonus.filter((x) => x.startsWith(stat)).length).toBeGreaterThan(0);
    expectReplays(result);
  });
});

describe("Staged: Magic Barrier (45040) prevents 3 and strikes back on an energy top card", () => {
  it("is played as an interrupt to Rhino's attack under every invariant", () => {
    let s = heroRhino(4);
    s = moveToHand(s, P1, MAGIC_BARRIER).state;
    const result = play(s, new Observer("staged-barrier"), { stopAtRound: 3, script: [() => endTurn(P1)] });
    expectReplays(result);
  });
});

describe("Staged: the nemesis set and the obligation reveal and resolve under every invariant", () => {
  it.each(["45053", "45054", "45055", "45056", "45057", "45058"])("card %s is revealed in a Rhino game", (code) => {
    // Darkchilde is an obligation: it starts in the encounter deck, not set aside (Rhino's boost draw takes the filler).
    const s =
      code === "45053" ? stackEncounterDeck(heroRhino(1), "01186", code) : stackSetAsideBehindBoost(heroRhino(1), code);
    const result = play(s, new Observer(`staged-${code}`), { stopAtRound: 3 });
    const revealed =
      code === "45053"
        ? seen.darkchilde.some((x) => x.startsWith(`staged-${code}`))
        : seen.nemesis.some((x) => x.startsWith(`staged-${code}`) && x.endsWith(code));
    expect(revealed).toBe(true);
    expectReplays(result);
  });

  it("Ruler of Limbo attaches Limbo facedown when revealed", () => {
    // Limbo is in her opening hand or deck; the reveal finds it.
    const s = stackSetAsideBehindBoost(heroRhino(1), RULER);
    play(s, new Observer("staged-ruler"), { stopAtRound: 3 });
    expect(seen.rulerLimbo.some((x) => x.startsWith("staged-ruler"))).toBe(true);
  });
});

describe("Staged: Belasco is villainous and draws a boost card each activation (45054)", () => {
  it("Belasco engaged: his activation flips a boost card and his forced response mills 3", () => {
    const s = stackSetAsideBehindBoost(heroRhino(2), BELASCO);
    play(s, new Observer("staged-belasco"), { stopAtRound: 4 });
    expect(seen.belascoBoost.some((x) => x.startsWith("staged-belasco"))).toBe(true);
    expect(seen.belascoMill.some((x) => x.startsWith("staged-belasco"))).toBe(true);
  });
});

describe("Held cards cause no error", () => {
  it("Illyana's interrupt (45030b) is unregistered: changing to hero form just shows the top card", () => {
    const s = rhino(1);
    const next = applyOk(s, { type: "changeForm", playerId: P1 }, WAVE8_DEPS).state;
    const done = settle(next, firstLegal, undefined, WAVE8_DEPS);
    expect(playerOf(done, P1).identity.form).toBe("hero");
  });
  it("Colossus (45031) in hand through a villain phase causes no error", () => {
    const s = stackDeck(heroRhino(1), "45031");
    const inHand = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: [...p.hand, p.deck[0]!], deck: p.deck.slice(1) } : p,
      ),
    };
    const result = play(inHand, new Observer("staged-colossus"), { stopAtRound: 3 });
    expectReplays(result);
  });
});

describe("Targeted checks seen across the games", () => {
  it("every targeted check was seen at least once", () => {
    const counts = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length]));
    // Each upgrade's bonus was seen both on (+1) and off (+0) the top card's icon.
    for (const stat of ["thw", "atk", "def"])
      for (const bonus of [0, 1])
        expect(seen.upgradeBonus, `${stat} bonus ${bonus} never seen`).toContain(`${stat}${bonus}`);
    const missing = Object.entries(counts)
      .filter(([, n]) => n === 0)
      .map(([k]) => k);
    expect(missing, `never seen: ${missing.join(", ")}`).toEqual([]);
  });
});
