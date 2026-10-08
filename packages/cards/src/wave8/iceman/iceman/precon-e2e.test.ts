import { ICEMAN_STARTER_DECKS, WAVE8_CARDS as CONTENT_CARDS } from "@mc/content";
import {
  cardsInPlay,
  iconsInPlay,
  createGame,
  handSize,
  replay,
  sessionApply,
  startSession,
  modifiersFor,
  type Command,
  type GameEvent,
  type GameSession,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario, encounterCardsOf, modularSetupCardIds } from "../../../core/setup.js";
import { playToOutcome } from "../../../testing/driver.js";
import { P1, firstLegal, playerOf, settle } from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE8_CARDS, WAVE8_DEPS, wave8Scenario, wave8StarterDeckSetup } from "../../index.js";
import { FREEZE_MOMENT } from "./identity.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Iceman's precon (`iceman-aggression`, cards 46002-46023, 40 cards plus the six Permanent Frostbite)
 * through the real engine and the real wave 8 scripts, played by the card-name-agnostic greedy driver
 * (`../../../testing/driver.ts`) one command at a time, so every state is checked against the invariants below and an
 * observer reads the events for his signature mechanics (the `seen` tally; the last test asserts each was seen).
 *
 * Scenarios: Core's Rhino with Sauron (his pack's modular set) added to the deck, the way a hero pack's own modular set
 * is played at a Core scenario. `coreScenario` only accepts the playable pool's modular sets (the wave is not joined to
 * the playable pool), so Sauron's cards are appended to the built `encounterDeck` with the two helpers the builder uses
 * (`encounterCardsOf`, `modularSetupCardIds`). Second, games through `wave8Scenario("unus")` (the new builder), which
 * does not include Sauron, so those check the builder, Frostbite and the nemesis set. Two-player rounds pair him with
 * Spider-Man's Core deck.
 *
 * Invariants checked after every command:
 * - no engine error on a command the driver chose from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices"): `minSelections` fits the options offered;
 * - the game never rests between steps with nothing pending outside a player turn (RRG Appendix II, pp. 51-52);
 * - no card instance sits in two zones; every card a deck started with is still somewhere;
 * - Frostbite (46002) is Permanent (6 copies set aside at setup, wave 6 section 3.74): the six copies are always all
 *   somewhere, a copy attached to anything is attached to an enemy, and never more than six are attached;
 * - every enemy carrying Frostbite has its ATK or SCH lowered by it (46002 constant: -1 each, to the floor of 0);
 * - the session log replays to the identical final state (the engine's determinism contract).
 *
 * Mechanics read from events: "Freeze!" (46001a: an Interrupt on his basic attack or basic defense that attaches a
 * set-aside Frostbite to the enemy and raises the moment "freeze"; nothing set aside, nothing attached and no moment),
 * Frostbite returning to the set-aside area after the host activates (46002, Q35 = A), Arctic Attack (46009), Ice Blast
 * (46010: one copy per enemy, 3 damage to each enemy with a copy), Chill Out! (46011: 3 threat removed, then a copy),
 * Frozen Solid (46007: the activation is replaced), Ice Wall (46008: attack damage to an identity lands on it), Cool Off
 * (46001b), Take That! (46016, one attack, Q48), the hazard extra deal (RRG 1.8 "Hazard Icon", p. 21), and ready-and-
 * draw at the end of the player phase (RRG 1.8 "Player Phase").
 *
 * Known gaps, asserted only as "no error": Shark-Girl 46012, Keep Up the Pressure 46018, the leaves-play half of
 * Frostbite 46002's Forced Response, Snow Clone 46003's consequential-damage reading (Q38), Cryokinetic Perception
 * 46005's bound draw, and Hot-Headed 46024's Forced Response are unregistered or held. Surprise Move 46015 is not
 * offered after "Freeze!" attaches Frostbite in the same basic attack (pinned in `../aspect-basic.test.ts`).
 */

const DECK_ID = "iceman-aggression";
const ICE = { starterDeckId: DECK_ID } as const;
const FROSTBITE = "46002";
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const SAURON_CARDS = ["46029", "46030", "46031", "46032"];
const NEMESIS_CARDS = ["46025", "46026", "46027", "46028"];

/** The printed decklist, transcribed in docs/phase7-wave8-handoff.md ("Iceman Hero Pack"): card number -> [title, copies]. */
const PRINTED_DECK: Record<string, readonly [string, number]> = {
  "46002": ["Frostbite", 6],
  "46003": ["Snow Clone", 2],
  "46004": ["Power Belt", 1],
  "46005": ["Cryokinetic Perception", 1],
  "46006": ["Ice Slide", 1],
  "46007": ["Frozen Solid", 2],
  "46008": ["Ice Wall", 1],
  "46009": ["Arctic Attack", 2],
  "46010": ["Ice Blast", 2],
  "46011": ["Chill Out!", 3],
  "46012": ["Shark-Girl", 1],
  "46013": ["Glob", 1],
  "46014": ["Suppressing Fire", 3],
  "46015": ["Surprise Move", 3],
  "46016": ["Take That!", 3],
  "46017": ["Looking for Trouble", 3],
  "46018": ["Keep Up the Pressure", 1],
  "46019": ["Shadowcat", 1],
  "46020": ["Beak", 1],
  "46021": ["Team-Building Exercise", 3],
  "46022": ["Recuperation", 3],
  "46023": ["The Power in All of Us", 2],
};

const seen = {
  freezeAttack: [] as string[],
  freezeDefense: [] as string[],
  freezeNoCopy: [] as string[],
  freezeMoment: [] as string[],
  frostbiteAttached: [] as string[],
  frostbiteReturned: [] as string[],
  frostbiteOnEnemy: [] as string[],
  arcticAttack: [] as string[],
  iceBlast: [] as string[],
  chillOut: [] as string[],
  frozenSolid: [] as string[],
  iceWall: [] as string[],
  coolOff: [] as string[],
  takeThat: [] as string[],
  hazardExtraDeal: [] as string[],
  hazardAuditSkipped: [] as string[],
  endOfPlayerPhaseReadyAndDraw: [] as string[],
  sauron: [] as string[],
  nemesisCard: [] as string[],
  unusGame: [] as string[],
};

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const cardType = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.type;
const cardName = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;

/** Enemies in play: the villain(s) and every minion. */
const enemiesOf = (s: GameState): InstanceId[] =>
  cardsInPlay(s).filter((id) => cardType(s, id) === "villain" || cardType(s, id) === "minion");
const frostbitesOn = (s: GameState, enemy: InstanceId): InstanceId[] =>
  s.instances[enemy]!.attachments.filter((a) => codeOf(s, a) === FROSTBITE);
const setAsideFrostbite = (s: GameState, p: PlayerId): number =>
  playerOf(s, p).setAside.filter((id) => codeOf(s, id) === FROSTBITE).length;

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
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${cardName(s, id as InstanceId)} (${id}) is in no zone`);
  // Frostbite: the six permanent copies are all accounted for, and a copy is only ever attached to an enemy (a lost game
  // clears the table, so the attachment check stops at the outcome).
  const copies = Object.keys(s.instances).filter((id) => codeOf(s, id as InstanceId) === FROSTBITE) as InstanceId[];
  if (copies.length > 0 && !s.outcome) {
    if (copies.length !== 6) fail(`${copies.length} copies of Frostbite exist, expected 6`);
    for (const id of copies) {
      const host = s.instances[id]!.attachedTo;
      if (host && !enemiesOf(s).includes(host))
        fail(`Frostbite (${id}) is attached to ${cardName(s, host)}, not an enemy`);
      // 46002 constant: the host gets -1 ATK and -1 SCH from this copy (other modifiers may offset the total).
      if (host)
        for (const stat of ["atk", "sch"] as const)
          if (!modifiersFor(s, WAVE8_DEPS, host, stat).some((m) => m.sourceInstanceId === id && m.amount === -1))
            fail(`Frostbite (${id}) does not lower ${cardName(s, host)}'s ${stat.toUpperCase()}`);
      if (host) seen.frostbiteOnEnemy.push(where);
    }
  }
}

/** The driver's choice, except that a prompt it cannot answer is reported. */
function nextCommand(session: GameSession, turn: { key: string; n: number }): Command {
  const s = session.state;
  if (!s.pendingChoice && s.step.phase === "player" && s.step.kind === "turn") {
    const key = `${s.round}:${s.step.activePlayerId}`;
    if (turn.key !== key) Object.assign(turn, { key, n: 0 });
    if (++turn.n > 40) return { type: "endTurn", playerId: s.step.activePlayerId };
  }
  const [command] = playToOutcome(s, WAVE8_DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

const trigger = (e: GameEvent): Record<string, unknown> | null =>
  e.type === "triggerEvent" ? ({ ...(e.event as unknown as Record<string, unknown>), phase: e.phase } as never) : null;

/**
 * The events of the abilities this file reads: an ability's `abilityResolved` opens its effects, which can run on past
 * prompts into later commands (an attack's target, a card to return). The observer therefore collects every event since
 * the last time nothing was pending (a "window") and reads each ability's events from its `abilityResolved` up to the
 * next one of the same ability or the next step change.
 */
function segmentFrom(events: readonly GameEvent[], from: number): GameEvent[] {
  const opener = events[from] as Extract<GameEvent, { type: "abilityResolved" }>;
  let cut = events.length;
  for (let i = from + 1; i < events.length; i++) {
    const e = events[i]!;
    if (
      (e.type === "abilityResolved" && e.abilityId === opener.abilityId) ||
      e.type === "stepChanged" ||
      e.type === "turnStarted" ||
      e.type === "turnEnded"
    ) {
      cut = i;
      break;
    }
  }
  return events.slice(from, cut);
}

const moved = (events: readonly GameEvent[], code: string, from: string | null, to: string | null) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "cardMoved" }> =>
      e.type === "cardMoved" &&
      e.cardId === (code as never) &&
      (from === null || e.from.kind === from) &&
      (to === null || e.to.kind === to),
  );
const hostsOf = (moves: readonly Extract<GameEvent, { type: "cardMoved" }>[]) =>
  moves.map((m) => (m.to as { hostInstanceId: InstanceId }).hostInstanceId);

class Observer {
  constructor(readonly label: string) {}

  private window: GameEvent[] = [];
  private windowBefore: GameState | null = null;
  private windowCommand: Command | null = null;

  observe(commandBefore: GameState, after: GameState, commandEvents: readonly GameEvent[], command: Command): void {
    if (this.windowBefore === null) {
      this.windowBefore = commandBefore;
      this.windowCommand = command;
    }
    this.window.push(...commandEvents);
    this.perCommand(commandBefore, after, commandEvents, command);
    if (!after.pendingChoice || after.outcome) {
      this.perWindow(this.windowBefore, after, this.window, this.windowCommand!);
      this.window = [];
      this.windowBefore = null;
      this.windowCommand = null;
    }
  }

  /** Abilities, read over a whole window (see `segmentFrom`). */
  private perWindow(before: GameState, after: GameState, events: readonly GameEvent[], first: Command): void {
    const here = `${this.label} round ${before.round} ${first.type}`;
    const each = (
      ref: string,
      check: (seg: GameEvent[], opener: Extract<GameEvent, { type: "abilityResolved" }>) => void,
    ) =>
      events.forEach((e, i) => {
        if (e.type === "abilityResolved" && String(e.abilityId) === ref) check(segmentFrom(events, i), e);
      });
    const attacksIn = (seg: readonly GameEvent[]) =>
      seg.map(trigger).filter((t) => t?.kind === "attack" && t.phase === "initiated");

    for (const m of moved(events, FROSTBITE, null, "attachment"))
      seen.frostbiteAttached.push(`${here} ${m.instanceId}`);
    for (const m of moved(events, FROSTBITE, "attachment", "setAside"))
      seen.frostbiteReturned.push(`${here} ${m.instanceId}`);

    // "Freeze!" (46001a): an Interrupt on his basic attack or basic defense; a set-aside Frostbite goes on the enemy and
    // the moment "freeze" is raised; with none set aside, neither happens.
    each("46001a.freeze", (seg) => {
      const attached = moved(seg, FROSTBITE, "setAside", "attachment");
      const raised = seg.filter((e) => e.type === "momentRaised" && e.name === FREEZE_MOMENT);
      expect(attached.length, `${here}: Freeze! attaches at most one copy`).toBeLessThanOrEqual(1);
      expect(raised.length, `${here}: the freeze moment is raised exactly when a copy was attached`).toBe(
        attached.length,
      );
      if (attached.length === 1) {
        expect(enemiesOf(before).concat(enemiesOf(after)), `${here}: the copy goes on an enemy`).toContain(
          hostsOf(attached)[0],
        );
        seen.freezeMoment.push(here);
        (first.type === "basicAttack" ? seen.freezeAttack : seen.freezeDefense).push(here);
      } else seen.freezeNoCopy.push(here);
    });

    // Arctic Attack (46009): one attack of 4 (then a copy) or of 6 (against an enemy with a copy attached).
    each("46009.arctic-attack-action", (seg) => {
      const attacks = attacksIn(seg);
      expect(attacks.length, `${here}: Arctic Attack is one attack`).toBeLessThanOrEqual(1);
      for (const a of attacks) expect([4, 6], `${here}: the attack is 4 or 6`).toContain(a!.amount);
      expect(moved(seg, FROSTBITE, "setAside", "attachment").length).toBeLessThanOrEqual(1);
      seen.arcticAttack.push(here);
    });

    // Ice Blast (46010): one copy per enemy at most, 3 damage to each enemy with a copy; not an attack, no "freeze".
    each("46010.ice-blast-action", (seg) => {
      const hosts = hostsOf(moved(seg, FROSTBITE, "setAside", "attachment"));
      expect(new Set(hosts).size, `${here}: one copy per named enemy`).toBe(hosts.length);
      const hit = new Set(
        seg
          .map(trigger)
          .filter((t) => t?.kind === "dealDamage" && t.phase === "initiated" && t.amount === 3)
          .map((t) => t!.targetInstanceId),
      );
      for (const h of hosts) expect(hit.has(h), `${here}: ${cardName(before, h)} takes 3`).toBe(true);
      expect(attacksIn(seg), `${here}: Ice Blast is not an attack`).toHaveLength(0);
      expect(seg.some((e) => e.type === "momentRaised" && e.name === FREEZE_MOMENT)).toBe(false);
      seen.iceBlast.push(here);
    });

    // Chill Out! (46011): 3 threat off a scheme, then at most one copy.
    each("46011.chill-out-action", (seg) => {
      expect(moved(seg, FROSTBITE, "setAside", "attachment").length).toBeLessThanOrEqual(1);
      expect(seg.some((e) => e.type === "momentRaised" && e.name === FREEZE_MOMENT)).toBe(false);
      seen.chillOut.push(here);
    });

    // Frozen Solid (46007): the activation is replaced by discarding it and attaching a copy.
    each("46007.frozen-solid-forced-interrupt", (seg, opener) => {
      expect(
        events.some((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === opener.instanceId),
        `${here}: Frozen Solid is discarded`,
      ).toBe(true);
      expect(moved(seg, FROSTBITE, "setAside", "attachment").length).toBeLessThanOrEqual(1);
      seen.frozenSolid.push(here);
    });

    // Ice Wall (46008): the attack damage lands on it.
    each("46008.ice-wall-forced-interrupt", (seg, opener) => {
      const wall = opener.instanceId;
      const gone = !cardsInPlay(after).includes(wall);
      expect(
        gone || after.instances[wall]!.damage > before.instances[wall]!.damage,
        `${here}: damage on Ice Wall`,
      ).toBe(true);
      void seg;
      seen.iceWall.push(here);
    });

    // Cool Off (46001b): at most one ICE card per Frostbite in play shuffled from the discard pile into the deck.
    each("46001b.cool-off", (seg) => {
      const inPlay = Object.keys(before.instances).filter(
        (id) => codeOf(before, id as InstanceId) === FROSTBITE && before.instances[id as InstanceId]!.attachedTo,
      ).length;
      const shuffled = seg.filter((e) => e.type === "cardMoved" && e.from.kind === "discard" && e.to.kind === "deck");
      expect(shuffled.length, `${here}: at most one ICE card per Frostbite`).toBeLessThanOrEqual(Math.max(inPlay, 6));
      seen.coolOff.push(here);
    });

    // Take That! (46016): one attack (owner ruling Q48).
    each("46016.take-that-action", (seg) => {
      expect(attacksIn(seg).length, `${here}: Take That! is one attack`).toBeLessThanOrEqual(1);
      seen.takeThat.push(here);
    });
  }

  /** Step-bound checks, read per command. */
  private perCommand(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    const here = `${this.label} round ${before.round} ${command.type}`;

    // Villain phase step 3: one card to each player, plus one to the first player per hazard icon in play (RRG p. 21, 47).
    const dealStep = events.findIndex(
      (e) => e.type === "stepChanged" && e.to.phase === "villain" && e.to.kind === "dealEncounterCards",
    );
    if (dealStep >= 0) {
      const end = events.findIndex(
        (e, i) => i > dealStep && e.type === "stepChanged" && e.to.kind === "revealEncounterCards",
      );
      const slice = events.slice(dealStep, end < 0 ? events.length : end);
      const dealtTo = (p: PlayerId) =>
        slice.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.to.playerId === p).length;
      // Icons in play at that moment: this command's start. A scheme or enemy that enters play earlier in the same command
      // would make that stale, so those commands are not audited (their count is `hazardAuditSkipped`).
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
      // RRG 1.8 "Hazard Icon" (p. 21): one card each, then one additional card per hazard icon, "in player order (first
      // additional card to the first player, the second to the second player, etc.)", not one card per player.
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
      if (stale) seen.hazardAuditSkipped.push(here);
      else if (dealt > 0) {
        for (const pl of order)
          expect(dealtTo(pl.playerId), `${here}: cards dealt to ${pl.playerId} with ${hazards} hazard icons`).toBe(
            expected.get(pl.playerId),
          );
      }
      if (hazards > 0) seen.hazardExtraDeal.push(`${here} hazards=${hazards}`);
    }

    // End of the player phase, after every player has taken a turn: each player draws up to hand size and readies each
    // exhausted card (RRG 1.8 "Player Phase", Appendix II step 1 "Player Phase"; the hand check is "Hand Size", p. 21).
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
      seen.endOfPlayerPhaseReadyAndDraw.push(here);
    }

    for (const e of events) {
      if (e.type === "encounterCardRevealed") {
        const code = String(e.cardId);
        if (SAURON_CARDS.includes(code)) seen.sauron.push(`${here} ${code}`);
        if (NEMESIS_CARDS.includes(code)) seen.nemesisCard.push(`${here} ${code}`);
      }
    }
  }
}

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
}

function play(
  initial: GameState,
  observer: Observer,
  options: { stopAtRound?: number; maxCommands?: number; script?: readonly ((s: GameState) => Command)[] } = {},
): GameResult {
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
    if (commands >= maxCommands) throw new Error(`no outcome after ${maxCommands} commands`);
    const before = session.state;
    const command =
      !session.state.pendingChoice && script.length > 0 ? script.shift()!(session.state) : nextCommand(session, turn);
    const result = sessionApply(session, command, WAVE8_DEPS);
    if (!result.ok)
      throw new Error(`engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    commands++;
    observer.observe(before, session.state, result.events, command);
    checkState(session.state, dealtTo, `${observer.label} command ${commands} ${JSON.stringify(command)}`);
  }
  return { session, commands };
}

function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, WAVE8_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

function started(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE8_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
}

/** Rhino (Core, standard) with Sauron's cards appended to the encounter deck. `seats` default to Iceman alone. */
function rhinoSauron(
  seed: number,
  seats: readonly { starterDeckId: string }[] = [ICE],
  sauron = true,
): GameSetupConfig {
  const base = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE8_CARDS,
  });
  return {
    ...base,
    players: seats.map((seat) => wave8StarterDeckSetup(seat.starterDeckId)),
    encounterDeck: [
      ...(base.encounterDeck ?? []),
      ...(sauron ? encounterCardsOf(["sauron"], WAVE8_CARDS) : []),
      ...(sauron ? modularSetupCardIds(["sauron"], WAVE8_CARDS) : []),
    ],
  };
}

describe("Iceman's printed deck", () => {
  const deck = ICEMAN_STARTER_DECKS.find((d) => d.id === DECK_ID)!;
  it("matches the printed decklist card for card, title and quantity", () => {
    const actual = Object.fromEntries(
      deck.cards.map((c) => [
        c.cardId as string,
        [CONTENT_CARDS.find((card) => card.id === c.cardId)!.name, c.quantity],
      ]),
    );
    expect(actual).toEqual(PRINTED_DECK);
  });
  it("is 40 cards (the six Permanent Frostbite aside) and legal at setup (requireLegalDecks)", () => {
    expect(deck.cards.reduce((n, c) => n + c.quantity, 0)).toBe(46);
    const config = rhinoSauron(1);
    expect(config.requireLegalDecks).toBe(true);
    const created = createGame(config, WAVE8_DEPS);
    expect(created.ok ? "ok" : created.error.message).toBe("ok");
    if (created.ok) {
      const p = created.state.players[0]!;
      expect(p.hand.length + p.deck.length + p.discard.length).toBe(40);
      expect(setAsideFrostbite(created.state, p.playerId), "six Frostbite set aside at setup").toBe(6);
      expect(p.hand.concat(p.deck).some((id) => codeOf(created.state, id) === FROSTBITE)).toBe(false);
    }
  });
});

describe("Iceman precon vs Rhino with Sauron, one player", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("seed %i plays to an outcome with every invariant intact", (seed) => {
    const start = started(rhinoSauron(seed));
    const result = play(start, new Observer(`rhino+sauron#${seed}`));
    expect(result.session.state.outcome).not.toBeNull();
    expect(result.session.state.round).toBeGreaterThanOrEqual(3);
    expectReplays(result);
  });
});

describe("Iceman and Spider-Man, two players, Rhino with Sauron", () => {
  it.each([1, 2, 3])("seed %i plays three full rounds with every invariant intact", (seed) => {
    const start = started(rhinoSauron(seed, [SPIDER_MAN, ICE]));
    const result = play(start, new Observer(`rhino+sauron#${seed}+spidey`), { stopAtRound: 4 });
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Games through the wave 8 builder: Unus (Age of Apocalypse)", () => {
  it.each([1, 2, 3, 4])("seed %i: Iceman plays to an outcome under every invariant", (seed) => {
    const start = started(wave8Scenario("unus", { players: [ICE], seed }));
    expect(start.players[0]!.hand.length).toBeGreaterThan(0);
    const result = play(start, new Observer(`unus#${seed}`));
    expect(result.session.state.outcome).not.toBeNull();
    seen.unusGame.push(`unus#${seed}`);
    expectReplays(result);
  });
});

/** Frostbite copies attached to an enemy right now, and set aside. */
const attachedCopies = (s: GameState): number =>
  Object.keys(s.instances).filter(
    (id) => codeOf(s, id as InstanceId) === FROSTBITE && s.instances[id as InstanceId]!.attachedTo !== null,
  ).length;

describe("Staged: Frostbite after its host activates (46002 Forced Response)", () => {
  /** Hero-form Iceman takes "Freeze!" on a basic attack against the villain, then ends the turn: Rhino activates. */
  function afterVillainActivation(seed: number) {
    let s = started(rhinoSauron(seed, [ICE], false));
    s = withForm(s, { heroForm: 0 }, P1);
    const villain = s.villains[0]!.instanceId;
    const observer = new Observer(`staged-frostbite#${seed}`);
    const result = play(s, observer, {
      stopAtRound: 2,
      script: [
        (st) => ({
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: playerOf(st, P1).identity.instanceId,
          targetInstanceId: villain,
        }),
        () => ({ type: "endTurn", playerId: P1 }),
      ],
    });
    return { result, villain };
  }

  // Card text: "Forced Response: After attached enemy activates or leaves play, set this card aside." The activation half
  // is documented as unregistered in support-upgrades-allies.ts (the ref has one trigger and cannot be split), so in
  // the shipped registry (WAVE8_DEPS) a copy attached by "Freeze!" stays on the villain through its activation.
  it.fails("EXPECTED: the copy attached by Freeze! is set aside after Rhino activates (six aside again)", () => {
    const { result } = afterVillainActivation(1);
    const end = result.session.state;
    expect(attachedCopies(end), "no Frostbite left on the villain after its activation").toBe(0);
    expect(setAsideFrostbite(end, P1)).toBe(6);
  });
  it("TODAY: the copy stays attached after the villain's activation, and no copy is ever set aside again", () => {
    const { result, villain } = afterVillainActivation(1);
    const end = result.session.state;
    expect(frostbitesOn(end, villain).length).toBeGreaterThanOrEqual(1);
    expect(setAsideFrostbite(end, P1)).toBeLessThan(6);
    expect(seen.frostbiteReturned.filter((x) => x.startsWith("staged-frostbite"))).toHaveLength(0);
    expectReplays(result);
  });
});

describe("Targeted checks seen across the games", () => {
  it("every targeted check was seen at least once", () => {
    const counts = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length]));
    console.info(JSON.stringify(counts));
    const missing = Object.entries(counts)
      // frostbiteReturned stays 0: the Forced Response is unregistered (pinned in the staged Frostbite tests above).
      .filter(([k, n]) => n === 0 && k !== "frostbiteReturned")
      .map(([k]) => k);
    expect(missing, `never seen: ${missing.join(", ")}`).toEqual([]);
  });
});
