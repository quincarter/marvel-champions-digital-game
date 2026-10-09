import { MAGNETO_STARTER_DECKS, WAVE8_CARDS as CONTENT_CARDS, trait } from "@mc/content";
import {
  cardOf,
  cardsInPlay,
  characterProfile,
  createGame,
  handSize,
  iconsInPlay,
  printedResources,
  remainingHitPoints,
  replay,
  sessionApply,
  startSession,
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
import { stackSetAside, stageNemesisCardForReveal } from "../../../testing/staging.js";
import { WAVE8_CARDS, WAVE8_DEPS, wave8Scenario, wave8StarterDeckSetup } from "../../index.js";
import { MAGNETIC_PULL_MOMENT, MAGNETIC_PULL_USED_MOMENT } from "./identity.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Magneto's precon (`magneto-leadership`, cards 49002-49026, 40 cards) through the real engine and the
 * real wave 8 scripts, played by the card-name-agnostic greedy driver (`../../../testing/driver.ts`) one command at a
 * time, so every state is checked against the invariants below and an observer reads the events for his signature
 * mechanics (the `seen` tally; the last test asserts each was seen).
 *
 * Scenarios: Core's Rhino with Hellfire (his pack's modular set) added to the deck, the way a hero pack's own modular
 * set is played at a Core scenario. `coreScenario` only accepts the playable pool's modular sets (the wave is not joined
 * to the playable pool), so Hellfire's cards are appended to the built `encounterDeck` with the two helpers the builder
 * uses (`encounterCardsOf`, `modularSetupCardIds`). Second, games through `wave8Scenario("unus")` (the new builder).
 * Two-player rounds pair him with Spider-Man's Core deck.
 *
 * Invariants checked after every command:
 * - no engine error on a command the driver chose from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices"): `minSelections` fits the options offered;
 * - the game never rests between steps with nothing pending outside a player turn (RRG Appendix II, pp. 51-52);
 * - no card instance sits in two zones; every card a deck started with is still somewhere;
 * - a minion carrying Wrapped in Metal (49007) never activates: no `enemyActivated` for it (card text "cannot activate");
 * - the session log replays to the identical final state (the engine's determinism contract).
 *
 * Mechanics read from events: Magnetic Pull (49001a: once per round; discards until a MAGNETIC card, which is taken to
 * hand; `magneticPullUsed` always, `magneticPull` only when one was found; both carry every discarded card; a deck that
 * runs out resets), Old Grievances (49027: damage equal to the cards the Pull discarded, the found card included),
 * Magneto's Armor (49004: +1 THW / ATK / DEF for the round per resource type among the discarded cards), Magneto's Cape
 * (49005: readies him), Magnetic Bubble (49006: takes the damage; discarded at 6), the Helmet (49003: wild only for a
 * MAGNETIC card), Wrapped in Metal and Magnetic Missile (49010: discards a wrapped minion, 5 damage and stun, not an
 * attack), Metal Shards (49009: one attack of 7), Survivor (49001b: top 3 of the discard pile shuffled into the deck),
 * Frenzy, Fabian Cortez and Angry Acolyte, the hazard extra deal (RRG 1.8 "Hazard Icon", p. 21), and ready-and-draw at
 * the end of the player phase (RRG 1.8 "Player Phase"), M (49012: the minion she defeats had fewer remaining hit points)
 * and "You Got This!" (49019: an ally discarded as the cost, the hero readied).
 *
 * Exodus (49028): after his attack he discards as many cards as his total ATK for it (ATK plus boost icons).
 * Power and Decadence (49042): revealed, it is given to the villain as a facedown boost card and not discarded.
 */

const DECK_ID = "magneto-leadership";
const MAG = { starterDeckId: DECK_ID } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const MAGNETIC = String(trait("MAGNETIC"));
const NEMESIS_CARDS = ["49028", "49029", "49030", "49031", "49032"];
const HELLFIRE_CARDS = ["49038", "49039", "49040", "49041", "49042"];
const BUBBLE = "49006";
const WRAPPED = "49007";

/** The printed decklist, transcribed in docs/phase7-wave8-handoff.md ("Magneto Hero Pack"): card number -> [title, copies]. */
const PRINTED_DECK: Record<string, readonly [string, number]> = {
  "49002": ["Asteroid M", 1],
  "49003": ["Magneto's Helmet", 1],
  "49004": ["Magneto's Armor", 1],
  "49005": ["Magneto's Cape", 1],
  "49006": ["Magnetic Bubble", 1],
  "49007": ["Wrapped in Metal", 2],
  "49008": ["Electromagnetic Blast", 2],
  "49009": ["Metal Shards", 2],
  "49010": ["Magnetic Missile", 2],
  "49011": ["Master of Magnetism", 2],
  "49012": ["M", 1],
  "49013": ["Kid Omega", 1],
  "49014": ["Phoenix", 1],
  "49015": ["Cyclops", 1],
  "49016": ["Won't Stay Down", 3],
  "49017": ["Squared Off", 3],
  "49018": ["Noble Sacrifice", 3],
  "49019": ['"You Got This!"', 3],
  "49020": ["New Recruits", 1],
  "49021": ["White Queen", 1],
  "49022": ["Face the Past", 1],
  "49023": ["Deft Focus", 3],
  "49024": ["Energy", 1],
  "49025": ["Genius", 1],
  "49026": ["Strength", 1],
};

const seen = {
  pull: [] as string[],
  pullFound: [] as string[],
  pullNotFound: [] as string[],
  pullDeckReset: [] as string[],
  pullTwiceInRound: [] as string[],
  oldGrievances: [] as string[],
  armor: [] as string[],
  armorStat: [] as string[],
  cape: [] as string[],
  bubbleHit: [] as string[],
  bubbleDiscarded: [] as string[],
  helmetResource: [] as string[],
  wrappedBlocked: [] as string[],
  wrappedAttached: [] as string[],
  missile: [] as string[],
  metalShards: [] as string[],
  mDefeat: [] as string[],
  youGotThis: [] as string[],
  blast: [] as string[],
  survivor: [] as string[],
  asteroid: [] as string[],
  exodus: [] as string[],
  decadenceRevealed: [] as string[],
  frenzy: [] as string[],
  fabian: [] as string[],
  acolyte: [] as string[],
  nemesisCard: [] as string[],
  hellfire: [] as string[],
  hazardExtraDeal: [] as string[],
  hazardAuditSkipped: [] as string[],
  endOfPlayerPhaseReadyAndDraw: [] as string[],
  unusGame: [] as string[],
  stunOrConfuseSpent: [] as string[],
};

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const cardType = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.type;
const cardName = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const isMagnetic = (s: GameState, id: InstanceId): boolean =>
  ((cardOf(s, id) as unknown as { traits?: readonly string[] } | undefined)?.traits ?? []).some(
    (t) => String(t) === MAGNETIC,
  );

/** The seat of Magneto (49001). */
const seatOf = (s: GameState): PlayerId =>
  s.players.find((p) => codeOf(s, p.identity.instanceId).startsWith("49001"))!.playerId;

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
}

/** The driver's choice, except that a runaway turn is ended. */
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
 * The events of an ability from its `abilityResolved` up to the next one of the same ability or the next step change
 * (an ability's effects can run on past prompts into later commands, so the observer reads a whole window).
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

type Moved = Extract<GameEvent, { type: "cardMoved" }>;
const movedTo = (events: readonly GameEvent[], to: string): Moved[] =>
  events.filter((e): e is Moved => e.type === "cardMoved" && e.to.kind === to);

class Observer {
  constructor(readonly label: string) {}

  private window: GameEvent[] = [];
  private windowBefore: GameState | null = null;
  private windowCommand: Command | null = null;
  private pullRounds = new Set<string>();

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

  private perWindow(before: GameState, after: GameState, events: readonly GameEvent[], first: Command): void {
    const here = `${this.label} round ${before.round} ${first.type}`;
    const pid = seatOf(after);
    const identity = playerOf(after, pid).identity.instanceId;
    const each = (
      ref: string,
      check: (seg: GameEvent[], opener: Extract<GameEvent, { type: "abilityResolved" }>, index: number) => void,
    ) =>
      events.forEach((e, i) => {
        if (e.type === "abilityResolved" && String(e.abilityId) === ref) check(segmentFrom(events, i), e, i);
      });

    // The Pull in this window, if any: the cards it discarded (read from the "used" moment).
    let pulled: readonly InstanceId[] = [];

    // Magnetic Pull (49001a): once per round; a MAGNETIC card found goes to hand; "used" always, "resolved" only then.
    each("49001a.magnetic-pull", (seg) => {
      const used = seg.filter((e) => e.type === "momentRaised" && e.name === MAGNETIC_PULL_USED_MOMENT);
      const resolved = seg.filter((e) => e.type === "momentRaised" && e.name === MAGNETIC_PULL_MOMENT);
      expect(used, `${here}: the used moment is raised exactly once`).toHaveLength(1);
      const carried = (used[0] as Extract<GameEvent, { type: "momentRaised" }>).carried?.pulled ?? [];
      pulled = carried;
      const key = `${before.round}`;
      if (this.pullRounds.has(key)) seen.pullTwiceInRound.push(here);
      this.pullRounds.add(key);
      seen.pull.push(here);
      const reset = seg.some((e) => e.type === "playerDeckReset" && e.playerId === pid);
      const found = carried.some((id) => isMagnetic(after, id));
      expect(resolved.length, `${here}: the resolved moment exactly when a MAGNETIC card was found`).toBe(
        found ? 1 : 0,
      );
      if (found) {
        // The Pull stops at the first MAGNETIC card, which is the last one discarded, and takes it to hand.
        const last = carried[carried.length - 1]!;
        expect(isMagnetic(after, last), `${here}: the last card discarded is the MAGNETIC one`).toBe(true);
        expect(
          movedTo(seg, "hand").some((m) => m.instanceId === last),
          `${here}: the found card goes to hand`,
        ).toBe(true);
        expect(
          carried.slice(0, -1).some((id) => isMagnetic(after, id)),
          `${here}: nothing MAGNETIC before the last`,
        ).toBe(false);
        seen.pullFound.push(here);
      } else seen.pullNotFound.push(here);
      if (reset) {
        // RRG 1.8 "Deck" (p. 33): a deck that runs out resets and an encounter card is dealt to the player.
        seen.pullDeckReset.push(here);
        expect(
          seg.some(
            (e) =>
              (e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.to.playerId === pid) ||
              e.type === "encounterCardRevealed",
          ),
          `${here}: a reset mid-Pull deals an encounter card`,
        ).toBe(true);
      } else {
        for (const id of carried)
          expect(
            seg.some((e) => e.type === "cardMoved" && e.instanceId === id && e.to.kind === "discard"),
            `${here}: ${cardName(after, id)} was discarded`,
          ).toBe(true);
      }
    });

    // Old Grievances (49027): damage equal to the cards the Pull discarded (the found card counts), taken as one amount.
    each("49027.old-grievances-forced-response", (seg) => {
      const hits = seg.filter(
        (e) =>
          (e.type === "damageDealt" || e.type === "damagePlaced" || e.type === "damagePrevented") &&
          (e.targetInstanceId === identity ||
            codeOf(after, e.targetInstanceId) === BUBBLE ||
            e.targetInstanceId === identity),
      ) as { amount: number }[];
      if (pulled.length > 0 && hits.length > 0)
        expect(
          hits.reduce((n, e) => n + e.amount, 0),
          `${here}: Old Grievances deals one damage per discarded card`,
        ).toBe(pulled.length);
      seen.oldGrievances.push(here);
    });

    // Magneto's Armor (49004): +1 THW / ATK / DEF per resource type among the discarded cards, until end of round.
    each("49004.magnetos-armor-response", () => {
      const types = { mental: false, physical: false, energy: false };
      for (const id of pulled) {
        const icons = printedResources(cardOf(after, id)!);
        for (const k of Object.keys(types) as (keyof typeof types)[]) if (icons[k] > 0) types[k] = true;
      }
      const was = characterProfile(before, identity, WAVE8_DEPS);
      const now = characterProfile(after, identity, WAVE8_DEPS);
      if (was && now && after.round === before.round) {
        const stat = { mental: "thw", physical: "atk", energy: "def" } as const;
        for (const k of Object.keys(types) as (keyof typeof types)[]) {
          if (types[k]) {
            expect(now[stat[k]] - was[stat[k]], `${here}: +1 ${stat[k]} for a ${k} icon`).toBe(1);
            seen.armorStat.push(`${here} ${stat[k]}`);
          } else expect(now[stat[k]], `${here}: no ${k} icon, no ${stat[k]} bonus`).toBe(was[stat[k]]);
        }
      }
      seen.armor.push(here);
    });

    // Magneto's Cape (49005): readies him.
    each("49005.magnetos-cape-response", (seg) => {
      expect(
        seg.some((e) => e.type === "cardReadied" && e.instanceId === identity) ||
          !before.instances[identity]!.exhausted,
        `${here}: the Cape readies Magneto (or he was not exhausted)`,
      ).toBe(true);
      seen.cape.push(here);
    });

    // Magnetic Missile (49010): discards a wrapped minion (not defeated), 5 damage to an enemy, stuns it; not an attack.
    each("49010.magnetic-missile-action", (seg) => {
      const discarded = seg.filter((e) => e.type === "cardDiscardedFromPlay");
      expect(discarded.length, `${here}: the wrapped minion is discarded`).toBeGreaterThanOrEqual(1);
      expect(
        seg.filter((e) => e.type === "characterDefeated"),
        `${here}: discarded, not defeated`,
      ).toHaveLength(0);
      expect(
        seg.map(trigger).some((t) => t?.kind === "attack" && t.phase === "initiated"),
        `${here}: Magnetic Missile is not an attack`,
      ).toBe(false);
      seen.missile.push(here);
    });

    // Metal Shards (49009): one attack of 7.
    each("49009.metal-shards-action", (seg) => {
      const attacks = seg.map(trigger).filter((t) => t?.kind === "attack" && t.phase === "initiated");
      expect(attacks.length, `${here}: Metal Shards is at most one attack`).toBeLessThanOrEqual(1);
      for (const a of attacks) expect(a!.amount, `${here}: 7 damage`).toBe(7);
      seen.metalShards.push(here);
    });

    // Electromagnetic Blast (49008): 3 threat off a scheme (a hero action thwart).
    // M (49012): the minion she defeats had fewer remaining hit points than she has.
    each("49012.m-response", (seg, opener) => {
      const m = opener.instanceId;
      const chosenMinions = seg.flatMap((e) => (e.type === "targetChosen" && e.slot === "minion" ? e.instanceIds : []));
      expect(chosenMinions.length, `${here}: M's Response names one minion`).toBe(1);
      const minion = chosenMinions[0]!;
      expect(cardType(before, minion), `${here}: M defeats a minion`).toBe("minion");
      expect(
        remainingHitPoints(before, minion, WAVE8_DEPS)!,
        `${here}: fewer remaining hit points than M`,
      ).toBeLessThan(remainingHitPoints(after, m, WAVE8_DEPS) ?? 4);
      expect(cardsInPlay(after), `${here}: the minion is defeated`).not.toContain(minion);
      seen.mDefeat.push(here);
    });

    // "You Got This!" (49019): an ally is discarded as the cost and the hero is readied.
    each("49019.you-got-this-response", (seg, opener) => {
      const player = opener.controllerId!;
      const allyLeft = events.some(
        (e) =>
          e.type === "cardMoved" &&
          e.from.kind === "playArea" &&
          e.to.kind === "discard" &&
          cardType(before, e.instanceId) === "ally",
      );
      expect(allyLeft, `${here}: "You Got This!" discards an ally`).toBe(true);
      const identity = after.players.find((p) => p.playerId === player)!.identity.instanceId;
      expect(
        seg.some((e) => e.type === "cardReadied" && e.instanceId === identity),
        `${here}: "You Got This!" readies the hero`,
      ).toBe(true);
      seen.youGotThis.push(here);
    });

    each("49008.electromagnetic-blast-action", (seg) => {
      const removed = seg.filter((e) => e.type === "threatRemoved");
      expect(removed.length, `${here}: at most one scheme loses threat`).toBeLessThanOrEqual(1);
      seen.blast.push(here);
    });

    // Survivor (49001b): after he changes to this form, the top 3 of the discard pile are shuffled into the deck.
    each("49001b.survivor", (seg) => {
      const shuffled = seg.filter((e) => e.type === "cardMoved" && e.from.kind === "discard" && e.to.kind === "deck");
      expect(shuffled.length, `${here}: at most 3 cards shuffled into the deck`).toBeLessThanOrEqual(3);
      const room = playerOf(before, pid).discard.length;
      if (room >= 3 && !seg.some((e) => e.type === "playerDeckReset"))
        expect(shuffled.length, `${here}: the top 3 of the discard pile`).toBe(3);
      seen.survivor.push(here);
    });

    // Asteroid M (49002): at most one MAGNETIC card from the discard pile into the deck.
    each("49002.asteroid-m-action", (seg) => {
      const shuffled = seg.filter((e) => e.type === "cardMoved" && e.from.kind === "discard" && e.to.kind === "deck");
      expect(shuffled.length, `${here}: one card at most`).toBeLessThanOrEqual(1);
      for (const m of shuffled as Moved[])
        expect(isMagnetic(after, m.instanceId), `${here}: it is MAGNETIC`).toBe(true);
      seen.asteroid.push(here);
    });

    // The Helmet's wild resource (49003): generated only to pay for a MAGNETIC card.
    for (const e of events) {
      if (e.type === "resourcesGenerated" && String(e.abilityId).startsWith("49003")) {
        seen.helmetResource.push(here);
        const played = events.find((x) => x.type === "cardPlayed");
        if (played && played.type === "cardPlayed")
          expect(isMagnetic(after, played.instanceId), `${here}: the Helmet paid for a non-MAGNETIC card`).toBe(true);
      }
    }

    // Magnetic Bubble (49006): the damage lands on it instead (damage placed there); at 6 or more it is discarded.
    each("49006.magnetic-bubble-forced-interrupt", (seg, opener) => {
      const bubble = opener.instanceId;
      const placed = seg.filter((e) => e.type === "damagePlaced" && e.targetInstanceId === bubble);
      expect(placed.length, `${here}: the damage is placed on Magnetic Bubble`).toBeGreaterThanOrEqual(1);
      seen.bubbleHit.push(here);
    });
    for (const e of events) {
      if (e.type === "cardDiscardedFromPlay" && String(e.cardId) === BUBBLE) {
        // All the damage ever placed on it: what it had when the window opened plus what the window placed.
        const total =
          before.instances[e.instanceId]!.damage +
          events
            .filter((x) => x.type === "damagePlaced" && x.targetInstanceId === e.instanceId)
            .reduce((n, x) => n + (x as { amount: number }).amount, 0);
        expect(total, `${here}: Magnetic Bubble is discarded at 6 or more damage`).toBeGreaterThanOrEqual(6);
        seen.bubbleDiscarded.push(here);
      }
    }
    if (events.some((x) => x.type === "damagePlaced")) {
      for (const id of cardsInPlay(after))
        if (codeOf(after, id) === BUBBLE)
          expect(after.instances[id]!.damage, `${here}: Bubble in play has under 6 damage`).toBeLessThan(6);
    }

    // Nemesis: Frenzy discards 2, Fabian Cortez / Frenzy boosts discard 4, Angry Acolyte.
    each("49031.frenzy-forced-response", (seg) => {
      expect(
        seg.filter((e) => e.type === "cardMoved" && e.from.kind === "deck" && e.to.kind === "discard").length,
        `${here}: Frenzy discards two`,
      ).toBeLessThanOrEqual(2);
      seen.frenzy.push(here);
    });
    // Exodus (49028): he discards as many cards as his total ATK for that attack (his ATK plus the boost icons of the
    // attack, whatever was defended); fewer only when the deck ran short.
    each("49028.exodus-forced-response", (seg, opener, index) => {
      const attack = events
        .slice(0, index)
        .filter(
          (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
            e.type === "attackResolved" && e.enemyInstanceId === opener.instanceId,
        )
        .at(-1);
      expect(attack, `${here}: Exodus's Forced Response follows his attack`).toBeDefined();
      const total = attack!.baseAtk + attack!.boostIcons;
      const discarded = seg.filter(
        (e) => e.type === "cardMoved" && e.from.kind === "deck" && e.to.kind === "discard",
      ).length;
      expect(discarded, `${here}: Exodus discards his total ATK (${total}) at most`).toBeLessThanOrEqual(total);
      if (!seg.some((e) => e.type === "deckShuffled"))
        expect(discarded, `${here}: Exodus discards ${total}`).toBe(total);
      seen.exodus.push(here);
    });
    each("49030.boost", () => {
      seen.fabian.push(here);
    });
    each("49032.when-revealed", () => {
      seen.acolyte.push(here);
    });
    // Power and Decadence (49042) When Revealed: the revealed card itself goes facedown onto the villain as a boost
    // card dealt outside its activation, and is not discarded by its reveal.
    each("49042.when-revealed", (seg, opener) => {
      const given = seg.filter(
        (e) => e.type === "boostCardDealt" && e.instanceId === opener.instanceId && e.outsideActivation === true,
      );
      expect(given, `${here}: Power and Decadence is given as a facedown boost card`).toHaveLength(1);
      expect(
        seg.some(
          (e) => e.type === "cardMoved" && e.instanceId === opener.instanceId && e.to.kind === "encounterDiscard",
        ),
        `${here}: Power and Decadence is not discarded by its reveal`,
      ).toBe(false);
      seen.decadenceRevealed.push(here);
    });
    each("49042.boost", () => {
      seen.hellfire.push(`${here} 49042`);
    });
  }

  private perCommand(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    const here = `${this.label} round ${before.round} ${command.type}`;

    // A minion with Wrapped in Metal attached cannot activate (49007 constant): none is ever activated.
    const wrappedBefore = (s: GameState) =>
      cardsInPlay(s).filter(
        (id) => cardType(s, id) === "minion" && s.instances[id]!.attachments.some((a) => codeOf(s, a) === WRAPPED),
      );
    const wrapped = new Set([...wrappedBefore(before), ...wrappedBefore(after)]);
    for (const w of wrappedBefore(after)) if (!wrappedBefore(before).includes(w)) seen.wrappedAttached.push(here);
    for (const e of events) {
      if (e.type === "enemyActivated" && wrappedBefore(after).includes(e.enemyInstanceId))
        throw new Error(`${here}: wrapped ${cardName(after, e.enemyInstanceId)} activated`);
      if (e.type === "activationBlocked" && wrapped.has(e.enemyInstanceId)) seen.wrappedBlocked.push(here);
      if (e.type === "statusRemoved" && (e.status === "stunned" || e.status === "confused"))
        seen.stunOrConfuseSpent.push(here);
    }

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
      // RRG 1.8 "Hazard Icon" (p. 21): one card each, then one additional card per hazard icon, in player order.
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

    // End of the player phase: each player draws up to hand size and readies each exhausted card (RRG "Player Phase").
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
      if (e.type === "cardMoved" && e.to.kind === "dealtEncounter" && NEMESIS_CARDS.includes(String(e.cardId)))
        seen.nemesisCard.push(`${here} dealt ${String(e.cardId)}`);
      if (e.type === "encounterCardRevealed") {
        const code = String(e.cardId);
        if (NEMESIS_CARDS.includes(code)) seen.nemesisCard.push(`${here} ${code}`);
        if (HELLFIRE_CARDS.includes(code)) seen.hellfire.push(`${here} ${code}`);
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
  options: { stopAtRound?: number; maxCommands?: number } = {},
): GameResult {
  const dealtTo = new Map<string, PlayerId>();
  for (const p of initial.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) if (initial.instances[id]!.ownerId === p.playerId) dealtTo.set(id, p.playerId);
  checkState(initial, dealtTo, "start");
  let session = startSession(initial);
  const turn = { key: "", n: 0 };
  const maxCommands = options.maxCommands ?? 2500;
  let commands = 0;
  while (!session.state.outcome && (options.stopAtRound === undefined || session.state.round < options.stopAtRound)) {
    if (commands >= maxCommands) throw new Error(`no outcome after ${maxCommands} commands`);
    const before = session.state;
    const command = nextCommand(session, turn);
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

/** Rhino (Core, standard) with Hellfire's cards appended to the encounter deck. `seats` default to Magneto alone. */
function rhinoHellfire(seed: number, seats: readonly { starterDeckId: string }[] = [MAG]): GameSetupConfig {
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
      ...encounterCardsOf(["hellfire"], WAVE8_CARDS),
      ...modularSetupCardIds(["hellfire"], WAVE8_CARDS),
    ],
  };
}

describe("Magneto's printed deck", () => {
  const deck = MAGNETO_STARTER_DECKS.find((d) => d.id === DECK_ID)!;
  it("matches the printed decklist card for card, title and quantity", () => {
    const actual = Object.fromEntries(
      deck.cards.map((c) => [
        c.cardId as string,
        [CONTENT_CARDS.find((card) => card.id === c.cardId)!.name, c.quantity],
      ]),
    );
    expect(actual).toEqual(PRINTED_DECK);
  });
  it("is 40 cards and legal at setup (requireLegalDecks)", () => {
    expect(deck.cards.reduce((n, c) => n + c.quantity, 0)).toBe(40);
    const config = rhinoHellfire(1);
    expect(config.requireLegalDecks).toBe(true);
    const created = createGame(config, WAVE8_DEPS);
    expect(created.ok ? "ok" : created.error.message).toBe("ok");
    if (created.ok) {
      const p = created.state.players[0]!;
      expect(p.hand.length + p.deck.length + p.discard.length).toBe(40);
    }
  });
});

describe("Magneto precon vs Rhino with Hellfire, one player", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("seed %i plays to an outcome with every invariant intact", (seed) => {
    const start = started(rhinoHellfire(seed));
    const result = play(start, new Observer(`rhino+hellfire#${seed}`));
    expect(result.session.state.outcome).not.toBeNull();
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Magneto and Spider-Man, two players, Rhino with Hellfire", () => {
  it.each([1, 2, 3])("seed %i plays three full rounds with every invariant intact", (seed) => {
    const start = started(rhinoHellfire(seed, [SPIDER_MAN, MAG]));
    const result = play(start, new Observer(`rhino+hellfire#${seed}+spidey`), { stopAtRound: 4 });
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Games through the wave 8 builder: Unus (Age of Apocalypse)", () => {
  it.each([1, 2, 3, 4])("seed %i: Magneto plays to an outcome under every invariant", (seed) => {
    const start = started(wave8Scenario("unus", { players: [MAG], seed }));
    expect(start.players[0]!.hand.length).toBeGreaterThan(0);
    const result = play(start, new Observer(`unus#${seed}`));
    expect(result.session.state.outcome).not.toBeNull();
    seen.unusGame.push(`unus#${seed}`);
    expectReplays(result);
  });
});

describe("Staged: his nemesis set and a Pull with no MAGNETIC card left", () => {
  // Frenzy 49031 on the encounter deck behind a filler (Forced Response: after she attacks you, discard the top 2). The
  // driver may bring her into play from its own card effects first; either way she attacks him in round 1 or 2.
  it("Frenzy's Forced Response resolves", () => {
    const start = stageNemesisCardForReveal(started(rhinoHellfire(1)), "49031");
    const result = play(start, new Observer("staged-frenzy#1"), { stopAtRound: 3 });
    expect(seen.frenzy.some((x) => x.startsWith("staged-frenzy#1"))).toBe(true);
    expectReplays(result);
  });

  // Fabian Cortez 49030 on top of the encounter deck is the villain's boost card (Boost: the player the activation is
  // against discards the top 4 cards of their deck); a seed in which the driver's own plays do not take it first.
  it("Fabian Cortez's boost resolves", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const before = seen.fabian.length;
      const result = play(stackSetAside(started(rhinoHellfire(seed)), "49030"), new Observer(`staged-fabian#${seed}`), {
        stopAtRound: 3,
      });
      expectReplays(result);
      if (seen.fabian.length > before) return;
    }
    throw new Error("Fabian Cortez was never turned up as a boost card");
  });

  // Angry Acolyte 49032 (a treachery) dealt behind a filler: it resolves, whatever ACOLYTE minions are engaged; a seed in
  // which the driver's own plays do not take it first.
  it("Angry Acolyte's When Revealed resolves without error", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const before = seen.acolyte.length;
      const result = play(
        stageNemesisCardForReveal(started(rhinoHellfire(seed)), "49032"),
        new Observer(`staged-acolyte#${seed}`),
        { stopAtRound: 3 },
      );
      expectReplays(result);
      if (seen.acolyte.length > before) return;
    }
    throw new Error("Angry Acolyte was never revealed");
  });

  // Magnetic Pull with no MAGNETIC card anywhere in the deck or discard pile: the used moment only, nothing to hand
  // (docs/phase7-wave8.md Q41 = A). The MAGNETIC cards are set aside, so the Pull runs the deck out (a reset, RRG p. 33).
  it("a Pull that finds nothing raises only the used moment", () => {
    let s = started(rhinoHellfire(3));
    const p = playerOf(s, P1);
    const gone = [...p.hand, ...p.deck, ...p.discard].filter((id) => isMagnetic(s, id));
    const drop = (ids: readonly InstanceId[]) => ids.filter((id) => !gone.includes(id));
    s = {
      ...s,
      players: s.players.map((pl) =>
        pl.playerId === P1
          ? {
              ...pl,
              hand: drop(pl.hand),
              deck: drop(pl.deck),
              discard: drop(pl.discard),
              setAside: [...pl.setAside, ...gone],
            }
          : pl,
      ),
    };
    const result = play(s, new Observer("staged-nomagnetic#3"), { stopAtRound: 2 });
    expect(seen.pullNotFound.filter((x) => x.startsWith("staged-nomagnetic")).length).toBeGreaterThanOrEqual(1);
    expectReplays(result);
  });
});

describe("Targeted checks seen across the games", () => {
  it("every targeted check was seen at least once", () => {
    const counts = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length]));
    console.info(JSON.stringify(counts));
    expect(seen.pullTwiceInRound, "Magnetic Pull is once per round").toEqual([]);
    // Not required: these checks run whenever a game reaches them, but no seed here does. youGotThis: the greedy driver
    // never takes that optional Response (it would spend an ally); exodus: the nemesis minion never gets to attack.
    // `../aspect-basic.test.ts` and `./obligation-nemesis.test.ts` play both cards out.
    const optional = ["pullTwiceInRound", "youGotThis", "exodus"];
    const missing = Object.entries(counts)
      .filter(([k, n]) => n === 0 && !optional.includes(k))
      .map(([k]) => k);
    expect(missing, `never seen: ${missing.join(", ")}`).toEqual([]);
  });
});
