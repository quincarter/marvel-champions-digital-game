import { NCRAWLER_STARTER_DECKS, WAVE8_CARDS as CONTENT_CARDS, cardId } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  iconsInPlay,
  activeEncounterDeckId,
  createGame,
  handSize,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario, encounterCardsOf, modularSetupCardIds } from "../../../core/setup.js";
import { playToOutcome } from "../../../testing/driver.js";
import { P1, P2, firstLegal, moveToHand, patchInstance, playerOf, settle } from "../../../testing/harness.js";
import { encounterCardInVillainArea, stageNemesisCardForReveal, withForm } from "../../../testing/staging.js";
import { WAVE8_CARDS, WAVE8_DEPS, wave8Scenario, wave8StarterDeckSetup } from "../../index.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Nightcrawler's precon (`nightcrawler-protection`, cards 48002-48025) through the real engine and the
 * real wave 8 scripts, played by the card-name-agnostic greedy driver (`../../../testing/driver.ts`) one command at a
 * time, so every state is checked against the invariants below and an observer reads the events for his signature
 * mechanics (the `seen` tally; the last test asserts each was seen at least once).
 *
 * Scenario: Core's Rhino with the Crazy Gang (his pack's modular set) added to the deck, the way a hero pack's own
 * modular set is played at a Core scenario. `coreScenario` only accepts the playable pool's modular sets (the wave is not
 * joined to the playable pool), so the Crazy Gang's cards are appended to the built `encounterDeck` with the same two
 * helpers the builder uses (`encounterCardsOf`, `modularSetupCardIds`). Rhino, not a wave 8 scenario, is the main game
 * because it is the scenario every wave 7 precon game and the scripting authors' tests use, so a failure here is
 * comparable. Second, a short game through `wave8Scenario("unus")` (the new builder): The Crazy Gang is not part of
 * Unus's own deck, so that game checks the builder and the nemesis set only.
 *
 * Invariants checked after every command:
 * - no engine error on a command the driver chose from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices"): `minSelections` fits the options offered;
 * - the game never rests between steps with nothing pending outside a player turn (RRG Appendix II, pp. 51-52);
 * - no card instance sits in two zones; every card a deck started with is still somewhere;
 * - Azazel never has an upgrade attached ("Azazel cannot have upgrades attached", 48027), and no enemy carries two
 *   copies of Bamf! (48006 data: max 1 per enemy);
 * - the session log replays to the identical final state (the engine's determinism contract).
 *
 * Mechanics read from events: Bamf! (the defender is declared without exhausting Nightcrawler, the copy goes to the
 * discard pile, the moment "bamf" is raised), Tally Ho! (the copy returns to hand, 3 damage that is not attack damage),
 * 'Port and Punch (one attack; the 3 damage to each enemy with a Bamf! is attack damage, docs/phase7-wave8.md §4.1
 * Q47 to Q50), Rogue (her cost: 1 damage from her to another friendly character), Teleport Drop (a copy discarded from an enemy as the cost, one attack of 8 on that enemy), Daytripper (a copy attached, 1 damage to each enemy with one), Rapid Teleportation (once per phase),
 * Kurt Wagner's search (once per round, shuffled), the hazard extra deal (RRG 1.8 "Hazard Icon", p. 21; "Villain
 * Phase", p. 47), Azazel's Boost going to the Nightcrawler seat, and ready-and-draw at the end of the player phase (after every player has had a turn: RRG 1.8 "Player Phase"; the handoff said "end of turn", which is the same moment in a one-player game).
 */

const DECK_ID = "nightcrawler-protection";
const NC = { starterDeckId: DECK_ID } as const;
const BAMF = "48006";
const AZAZEL = "48027";
const BRIMSTONE_DIMENSION = "48028";
const BRIMSTONE_STRIKE = "48030";
const CRAZY_GANG_CARDS = ["48033", "48034", "48035", "48036", "48037", "48038"];
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;

/** The printed decklist, transcribed in docs/phase7-wave8-handoff.md ("Nightcrawler Hero Pack"): card number -> [title, copies]. */
const PRINTED_DECK: Record<string, readonly [string, number]> = {
  "48002": ["Daytripper", 1],
  "48003": ["Kurt's Chapel", 1],
  "48004": ["Kurt's Cutlasses", 1],
  "48005": ["Prehensile Tail", 1],
  "48006": ["Bamf!", 3],
  "48007": ["'Port and Punch", 2],
  "48008": ["Teleport Drop", 1],
  "48009": ["Scout Ahead", 2],
  "48010": ["'Port Away", 1],
  "48011": ["Tally Ho!", 2],
  "48012": ["Rogue", 1],
  "48013": ["Northstar", 1],
  "48014": ["Change of Fortune", 3],
  "48015": ["Under Control", 3],
  "48016": ['"Come Get Me, Bub!"', 3],
  "48017": ["Powerful Punch", 3],
  "48018": ["Riposte", 3],
  "48019": ["The Power of Protection", 2],
  "48020": ["Astonishing X-Men", 1],
  "48021": ["Gambit", 1],
  "48022": ["Moira MacTaggert", 1],
  "48023": ["Energy", 1],
  "48024": ["Genius", 1],
  "48025": ["Strength", 1],
};

const seen = {
  bamfDefense: [] as string[],
  tallyHo: [] as string[],
  portAndPunch: [] as string[],
  portAndPunchExtraHit: [] as string[],
  daytripper: [] as string[],
  rapidTeleportation: [] as string[],
  kurtWagnerSearch: [] as string[],
  azazelBoostToNightcrawler: [] as string[],
  hazardExtraDeal: [] as string[],
  hazardAuditSkipped: [] as string[],
  portAndPunchStunned: [] as string[],
  teleportDrop: [] as string[],
  rogue: [] as string[],
  endOfPlayerPhaseReadyAndDraw: [] as string[],
  crazyGangCard: [] as string[],
  nemesisCard: [] as string[],
  azazelQuickstrike: [] as string[],
  azazelQuickstrikeSkipped: [] as string[],
  unusGame: [] as string[],
};

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const cardType = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.type;
const cardName = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;

/** Enemies in play: the villain(s) and every minion. */
const enemiesOf = (s: GameState): InstanceId[] =>
  cardsInPlay(s).filter((id) => cardType(s, id) === "villain" || cardType(s, id) === "minion");
const bamfsOn = (s: GameState, enemy: InstanceId): InstanceId[] =>
  s.instances[enemy]!.attachments.filter((a) => codeOf(s, a) === BAMF);
const withBamf = (s: GameState): InstanceId[] => enemiesOf(s).filter((e) => bamfsOn(s, e).length > 0);
const ncSeat = (s: GameState): PlayerId =>
  s.players.find((p) => codeOf(s, p.identity.instanceId).startsWith("48001"))!.playerId;

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
  for (const id of Object.keys(s.instances) as InstanceId[]) {
    const instance = s.instances[id]!;
    if (codeOf(s, id) === AZAZEL) {
      const upgrades = instance.attachments.filter((a) => cardType(s, a) === "upgrade");
      if (upgrades.length > 0) fail(`Azazel (${id}) carries upgrades: ${upgrades.map((a) => codeOf(s, a)).join(", ")}`);
    }
    if (instance.attachments.filter((a) => codeOf(s, a) === BAMF).length > 1)
      fail(`${cardName(s, id)} (${id}) carries two copies of Bamf!`);
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

const attachedToEnemyBy = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "cardMoved" }> =>
      e.type === "cardMoved" && e.to.kind === "attachment" && e.cardId === (BAMF as never),
  );
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

class Observer {
  private readonly rapid = new Map<string, number>();
  private readonly kurt = new Map<string, number>();
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
    const nc = ncSeat(after);
    const here = `${this.label} round ${before.round} ${first.type}`;
    const identity = playerOf(before, nc).identity.instanceId;
    const each = (ref: string, check: (seg: GameEvent[], index: number) => void) =>
      events.forEach((e, i) => {
        if (e.type === "abilityResolved" && String(e.abilityId) === ref) check(segmentFrom(events, i), i);
      });

    // Bamf! (48006): "Hero Interrupt (defense): when the attached enemy attacks, discard this card: Nightcrawler is
    // declared the defender (not exhausted)", then the moment "bamf" is raised for Tally Ho!.
    each("48006.bamf-interrupt", (seg) => {
      const copy = (seg[0] as Extract<GameEvent, { type: "abilityResolved" }>).instanceId;
      const defended = seg.map(trigger).find((t) => t?.kind === "defended" && t.phase === "initiated");
      expect(defended?.defenderInstanceId, `${here}: Bamf! declares Nightcrawler`).toBe(identity);
      expect(
        seg.some((e) => e.type === "momentRaised" && e.name === "bamf" && e.sourceInstanceId === copy),
        `${here}: the bamf moment is raised with the discarded copy as its source`,
      ).toBe(true);
      expect(
        seg.some((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === copy) ||
          events.some((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === copy),
        `${here}: the copy is discarded from play`,
      ).toBe(true);
      // Declared without exhausting (a defender normally exhausts, RRG 1.8 "Defend", p. 14).
      expect(
        seg.some((e) => e.type === "cardExhausted" && e.instanceId === identity),
        `${here}: Nightcrawler exhausted by a Bamf! defense`,
      ).toBe(false);
      seen.bamfDefense.push(here);
    });

    // Tally Ho! (48011): the Bamf! copy from the discard pile to hand, then 3 damage to the attacker; not an attack.
    each("48011.tally-ho-response", (seg) => {
      const back = seg.filter(
        (e) => e.type === "cardMoved" && e.cardId === (BAMF as never) && e.from.kind !== "hand" && e.to.kind === "hand",
      );
      // (A second Tally Ho! answering the same Bamf! finds the copy already in hand: "return that copy" moves hand to hand.)
      const alreadyBack = seg.some(
        (e) => e.type === "cardMoved" && e.cardId === (BAMF as never) && e.from.kind === "hand",
      );
      expect(back.length === 1 || alreadyBack, `${here}: Tally Ho! returns the Bamf! to hand`).toBe(true);
      const hits = seg
        .map(trigger)
        .filter((t) => t?.kind === "dealDamage" && t.phase === "initiated" && t.amount === 3);
      expect(hits.length, `${here}: Tally Ho!'s 3 damage`).toBeGreaterThanOrEqual(1);
      expect(hits[0]!.fromAttack === true, `${here}: Tally Ho!'s damage is not attack damage`).toBe(false);
      expect(enemiesOf(before).length, `${here}: Tally Ho! needs an enemy`).toBeGreaterThan(0);
      seen.tallyHo.push(here);
    });

    // 'Port and Punch (48007): one attack of 3; then 3 damage to each enemy with a Bamf! attached, which is damage from
    // that attack (docs/phase7-wave8.md section 4.1 Q47, Q49, Q50).
    each("48007.port-and-punch-action", (seg) => {
      const triggers = seg.map(trigger).filter((t) => t !== null);
      const attacks = triggers.filter((t) => t.kind === "attack" && t.phase === "initiated");
      // A stunned Nightcrawler's attack is not made: the stunned status is removed instead (RRG 1.8 "Stunned"), and the
      // whole ability is the one attack, so none of its damage is dealt either.
      if (attacks.length === 0 && seg.some((e) => e.type === "statusRemoved")) {
        expect(
          triggers.filter((t) => t.kind === "dealDamage" && t.amount === 3),
          `${here}: a stunned 'Port and Punch deals no damage`,
        ).toHaveLength(0);
        seen.portAndPunchStunned.push(here);
        return;
      }
      expect(attacks, `${here}: 'Port and Punch is one attack`).toHaveLength(1);
      expect(attacks[0]!.amount, `${here}: the attack is 3`).toBe(3);
      const damage = triggers.filter((t) => t.kind === "dealDamage" && t.phase === "initiated" && t.amount === 3);
      for (const hit of damage)
        expect(hit.fromAttack, `${here}: 'Port and Punch's damage to ${String(hit.targetInstanceId)}`).toBe(true);
      const stillThere = new Set(enemiesOf(after));
      for (const enemy of withBamf(before).filter((e) => stillThere.has(e) && bamfsOn(after, e).length > 0)) {
        expect(
          damage.some((h) => h.targetInstanceId === enemy),
          `${here}: ${cardName(after, enemy)} has a Bamf! and takes 3`,
        ).toBe(true);
        seen.portAndPunchExtraHit.push(here);
      }
      seen.portAndPunch.push(here);
    });

    // Teleport Drop (48008): the cost discards a copy of Bamf! from an enemy; one attack of 8 on that enemy, then a stun.
    each("48008.teleport-drop-action", (seg) => {
      const dropped = events.filter(
        (e) =>
          e.type === "cardMoved" &&
          e.cardId === (BAMF as never) &&
          e.from.kind === "attachment" &&
          e.to.kind === "discard",
      ) as Extract<GameEvent, { type: "cardMoved" }>[];
      expect(dropped.length, `${here}: Teleport Drop discards a copy of Bamf! from an enemy`).toBeGreaterThanOrEqual(1);
      const hosts = dropped.map((m) => (m.from as { hostInstanceId: InstanceId }).hostInstanceId);
      const attacks = seg.map(trigger).filter((t) => t !== null && t.kind === "attack" && t.phase === "initiated");
      // A stunned Nightcrawler's attack is not made (RRG 1.8 "Stunned"); the copy is still spent: it was the cost.
      if (attacks.length === 0 && seg.some((e) => e.type === "statusRemoved")) return;
      expect(attacks, `${here}: Teleport Drop is one attack`).toHaveLength(1);
      expect(attacks[0]!.amount, `${here}: the attack is 8`).toBe(8);
      expect(hosts, `${here}: the attack is on the enemy the copy was on`).toContain(attacks[0]!.targetInstanceId);
      seen.teleportDrop.push(here);
    });

    // Rogue (48012): the cost deals 1 damage from her to another friendly character (an identity or an ally).
    each("48012.rogue-action", (seg) => {
      const rogue = (seg[0] as Extract<GameEvent, { type: "abilityResolved" }>).instanceId;
      const hits = events
        .map(trigger)
        .filter(
          (t) => t !== null && t.kind === "dealDamage" && t.phase === "initiated" && t.sourceInstanceId === rogue,
        );
      expect(hits.length, `${here}: Rogue's cost deals damage once`).toBeGreaterThanOrEqual(1);
      const target = hits[0]!.targetInstanceId as InstanceId;
      expect(hits[0]!.amount, `${here}: Rogue's cost is 1 damage`).toBe(1);
      expect(target, `${here}: another character, not Rogue herself`).not.toBe(rogue);
      expect(["hero_identity", "ally"], `${here}: a friendly character`).toContain(cardType(before, target));
      seen.rogue.push(here);
    });

    // Daytripper (48002): a Bamf! attached, then 1 damage to each enemy with one.
    each("48002.daytripper-response", (seg) => {
      const attached = attachedToEnemyBy(seg);
      if (attached.length === 0) return;
      const hosts = new Set(attached.map((m) => (m.to as { hostInstanceId: InstanceId }).hostInstanceId));
      const hits = seg
        .map(trigger)
        .filter((t) => t?.kind === "dealDamage" && t.phase === "initiated" && t.amount === 1);
      for (const enemy of [...hosts, ...withBamf(before)].filter((e) => enemiesOf(after).includes(e))) {
        expect(
          hits.some((h) => h?.targetInstanceId === enemy),
          `${here}: Daytripper's 1 damage reaches ${cardName(after, enemy)}`,
        ).toBe(true);
      }
      seen.daytripper.push(here);
    });

    // Rapid Teleportation (48001a): spend 1 resource, a Bamf! from the discard pile to hand; once per phase.
    each("48001a.rapid-teleportation", (seg) => {
      expect(first.type, here).toBe("useAbility");
      if (first.type === "useAbility") expect(first.payment ?? [], `${here}: pays 1 resource`).toHaveLength(1);
      expect(
        seg.filter(
          (e) =>
            e.type === "cardMoved" && e.cardId === (BAMF as never) && e.from.kind === "discard" && e.to.kind === "hand",
        ),
        `${here}: a Bamf! returns to hand`,
      ).toHaveLength(1);
      const key = `${before.round}:${before.step.phase}`;
      this.rapid.set(key, (this.rapid.get(key) ?? 0) + 1);
      expect(this.rapid.get(key), `${here}: once per phase`).toBe(1);
      seen.rapidTeleportation.push(here);
    });

    // Kurt Wagner (48001b): search the deck for a Bamf!, shuffle; once per round; alter-ego form only.
    each("48001b.kurt-wagner-action", (seg) => {
      expect(playerOf(before, nc).identity.form, `${here}: Kurt Wagner's action in alter-ego form`).toBe("alterEgo");
      const hadCopy = playerOf(before, nc).deck.some((id) => codeOf(before, id) === BAMF);
      const found = seg.filter(
        (e) => e.type === "cardMoved" && e.cardId === (BAMF as never) && e.from.kind === "deck" && e.to.kind === "hand",
      );
      expect(found, `${here}: found exactly when a copy was in the deck`).toHaveLength(hadCopy ? 1 : 0);
      expect(
        seg.some((e) => e.type === "deckShuffled"),
        `${here}: the searched deck is shuffled`,
      ).toBe(true);
      this.kurt.set(String(before.round), (this.kurt.get(String(before.round)) ?? 0) + 1);
      expect(this.kurt.get(String(before.round)), `${here}: once per round`).toBe(1);
      seen.kurtWagnerSearch.push(here);
    });
  }

  /** Step-bound checks, read per command. */
  private perCommand(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    const nc = ncSeat(after);
    const here = `${this.label} round ${before.round} ${command.type}`;

    // Azazel's Boost (48027): the boost card is dealt to the Nightcrawler seat as an encounter card, whoever is attacked.
    for (const f of events.filter((e) => e.type === "boostCardFlipped" && codeOf(after, e.instanceId) === AZAZEL)) {
      const dealt = events.find(
        (e) =>
          e.type === "cardMoved" &&
          e.instanceId === (f as { instanceId: InstanceId }).instanceId &&
          e.to.kind === "dealtEncounter",
      ) as Extract<GameEvent, { type: "cardMoved" }> | undefined;
      expect(dealt, `${here}: Azazel's boost deals him as an encounter card`).toBeDefined();
      expect((dealt!.to as { playerId: PlayerId }).playerId, `${here}: ... to the Nightcrawler seat`).toBe(nc);
      seen.azazelBoostToNightcrawler.push(here);
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
        if (CRAZY_GANG_CARDS.includes(code)) seen.crazyGangCard.push(`${here} ${code}`);
        if (["48026", AZAZEL, BRIMSTONE_DIMENSION, "48029", BRIMSTONE_STRIKE].includes(code))
          seen.nemesisCard.push(`${here} ${code}`);
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

/** Rhino (Core, standard) with the Crazy Gang's cards appended to the encounter deck. `seats` default to Nightcrawler alone. */
function rhinoCrazyGang(
  seed: number,
  seats: readonly { starterDeckId: string }[] = [NC],
  crazyGang = true,
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
      ...(crazyGang ? encounterCardsOf(["crazy_gang"], WAVE8_CARDS) : []),
      ...(crazyGang ? modularSetupCardIds(["crazy_gang"], WAVE8_CARDS) : []),
    ],
  };
}

describe("Nightcrawler's printed deck", () => {
  const deck = NCRAWLER_STARTER_DECKS.find((d) => d.id === DECK_ID)!;
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
    const config = rhinoCrazyGang(1);
    expect(config.requireLegalDecks).toBe(true);
    const created = createGame(config, WAVE8_DEPS);
    expect(created.ok ? "ok" : created.error.message).toBe("ok");
    if (created.ok) {
      const p = created.state.players[0]!;
      // 40 deck cards in all (hand + deck); the nemesis set and obligation start outside the player deck.
      expect(p.hand.length + p.deck.length + p.discard.length).toBe(40);
      expect(p.setAside.map((id) => codeOf(created.state, id)).sort()).toEqual(
        expect.arrayContaining([AZAZEL, BRIMSTONE_DIMENSION]),
      );
    }
  });
});

describe("Nightcrawler precon vs Rhino with the Crazy Gang, one player", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("seed %i plays to an outcome with every invariant intact", (seed) => {
    const start = started(rhinoCrazyGang(seed));
    const result = play(start, new Observer(`rhino+gang#${seed}`));
    expect(result.session.state.outcome).not.toBeNull();
    expect(result.session.state.round).toBeGreaterThanOrEqual(3);
    expectReplays(result);
  });
});

describe("Nightcrawler and Spider-Man, two players, Rhino with the Crazy Gang", () => {
  it.each([1, 2, 3])("seed %i plays three full rounds with every invariant intact", (seed) => {
    const start = started(rhinoCrazyGang(seed, [SPIDER_MAN, NC]));
    const result = play(start, new Observer(`rhino+gang#${seed}+spidey`), { stopAtRound: 4 });
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Staged: Azazel's Boost goes to the Nightcrawler seat whoever is attacked (48027)", () => {
  it("two players, the other seat first and attacked: Azazel, flipped as Rhino's boost, is dealt to Nightcrawler", () => {
    // Spider-Man is seat 1 (first player; Rhino attacks him), Nightcrawler seat 2. Azazel is put on top of the encounter
    // deck, so Rhino's boost draw turns him up.
    let s = started(rhinoCrazyGang(1, [SPIDER_MAN, NC], false));
    s = withForm(s, { heroForm: 0 }, P1);
    s = stageNemesisCardForReveal(s, AZAZEL, P2, 0);
    expect(ncSeat(s)).toBe(P2);
    const observer = new Observer("staged-azazel-boost");
    // Both seats end their turns at once: his own "Come Get Me, Bub!" would otherwise find Azazel in the player phase.
    const result = play(s, observer, {
      stopAtRound: 2,
      script: [() => ({ type: "endTurn", playerId: P1 }), () => ({ type: "endTurn", playerId: P2 })],
    });
    expect(seen.azazelBoostToNightcrawler.some((x) => x.startsWith("staged-azazel-boost"))).toBe(true);
    expectReplays(result);
  });
});

describe("Staged: hazard deals one extra encounter card to the first player (Brimstone Dimension, 48028)", () => {
  it("two players: the first player is dealt 2, the other seat 1", () => {
    let s = started(rhinoCrazyGang(2, [SPIDER_MAN, NC], false));
    s = encounterCardInVillainArea(s, "01107", 0).state; // a side scheme without a hazard icon, to be sure it is not counted
    s = stageNemesisCardForReveal(s, BRIMSTONE_DIMENSION, P2, 1);
    s = { ...s, players: s.players };
    const inPlay = s.villainArea.length;
    expect(inPlay).toBeGreaterThan(0);
    const observer = new Observer("staged-hazard");
    play(s, observer, { stopAtRound: 3 });
    expect(
      seen.hazardExtraDeal.filter((x) => x.startsWith("staged-hazard")).length,
      "a villain phase dealt with Brimstone Dimension in play",
    ).toBeGreaterThanOrEqual(1);
  });
});

/** Surgery: a minion from the encounter deck into this player's play area, engaged and faceup. */
function engageMinion(state: GameState, code: string, seat: PlayerId): { state: GameState; id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => codeOf(state, i) === code) ?? pile.discard.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((pl) => (pl.playerId === seat ? { ...pl, playArea: [...pl.playArea, id] } : pl)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, engagedWith: seat, faceup: true, controllerId: null },
      },
    },
  };
}

/** Plays `code` from hand (cost paid with other hand cards, printed icons counted), attached to `host` for an upgrade. */
const playCardCommand =
  (code: string, host: InstanceId | null = null) =>
  (state: GameState): Command => {
    const hand = playerOf(state, P1).hand;
    const id = hand.find((h) => codeOf(state, h) === code)!;
    const cost = (state.cardPool[code as never] as unknown as { cost: number }).cost;
    const payment: { fromHand: InstanceId }[] = [];
    let paid = 0;
    for (const h of hand) {
      if (paid >= cost) break;
      if (h === id || KIT.has(codeOf(state, h))) continue;
      const icons = (state.cardPool[codeOf(state, h) as never] as unknown as { resourceIcons?: Record<string, number> })
        .resourceIcons;
      payment.push({ fromHand: h });
      paid += Object.values(icons ?? {}).reduce((a, b) => a + b, 0);
    }
    return { type: "playCard", playerId: P1, cardInstanceId: id, payment, attachToInstanceId: host };
  };
/** Cards a staged play never spends as payment. */
const KIT = new Set([BAMF, "48007"]);

describe("Staged: 'Port and Punch hits every enemy with a Bamf! (48007; docs/phase7-wave8.md section 4.1 Q47 to Q50)", () => {
  it("attacks once, then deals 3 attack damage to the villain and the minion that each carry a Bamf!", () => {
    let s = started(rhinoCrazyGang(5, [NC], false));
    s = withForm(s, { heroForm: 0 }, P1);
    const minion = engageMinion(s, "01101", P1); // Mercenary: 3 hit points, so the 3 damage defeats it
    s = minion.state;
    const villain = s.villains[0]!.instanceId;
    // Hand: two Bamf! (to attach, cost 0 each), 'Port and Punch (cost 2?) and spare cards to pay with.
    s = moveToHand(s, P1, BAMF, BAMF, "48007").state;
    const observer = new Observer("staged-pnp");
    const result = play(s, observer, {
      stopAtRound: 2,
      script: [playCardCommand(BAMF, villain), playCardCommand(BAMF, minion.id), playCardCommand("48007")],
    });
    expect(seen.portAndPunchExtraHit.filter((x) => x.startsWith("staged-pnp"))).not.toHaveLength(0);
    // Mercenary (3 hit points) took the 3 and is gone; the villain's damage is the attack's 3 plus the 3 from the Bamf!.
    expect(
      result.session.state.instances[minion.id]!.damage === 3 || !enemiesOf(result.session.state).includes(minion.id),
    ).toBe(true);
    expectReplays(result);
  });
});

/** Surgery: Azazel from the Nightcrawler seat's set-aside cards into that seat's play area, faceup and engaged with them. */
function azazelEngaged(state: GameState, seat: PlayerId): GameState {
  const owner = playerOf(state, seat);
  const id = owner.setAside.find((i) => codeOf(state, i) === AZAZEL)!;
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === seat ? { ...p, setAside: p.setAside.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
    ),
    instances: {
      ...state.instances,
      [id]: { ...state.instances[id]!, engagedWith: seat, faceup: true, controllerId: null },
    },
  };
}

describe("Staged: Brimstone Strike (48030) and Azazel's quickstrike", () => {
  /** Azazel attack events (attackResolved) after the Brimstone Strike reveal in one villain phase. */
  function azazelAttacksAfterStrike(s: GameState): { attacks: number; revealed: boolean } {
    let session = startSession(s);
    let afterReveal = false;
    let attacks = 0;
    const apply = (command: Command) => {
      const r = sessionApply(session, command, WAVE8_DEPS);
      if (!r.ok) throw new Error(r.error.message);
      session = r.session;
      for (const e of r.events) {
        if (e.type === "encounterCardRevealed" && String(e.cardId) === BRIMSTONE_STRIKE) afterReveal = true;
        if (afterReveal && e.type === "attackResolved" && codeOf(session.state, e.enemyInstanceId) === AZAZEL)
          attacks++;
      }
    };
    apply({ type: "endTurn", playerId: P1 });
    for (let guard = 0; session.state.pendingChoice && guard < 200; guard++) {
      const choice = session.state.pendingChoice as PendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(session.state),
      });
    }
    return { attacks, revealed: afterReveal };
  }

  // Quickstrike (keyword list: "Quickstrike: after this minion engages a player, it attacks that player"); the
  // docs/phase7-wave8.md §3.75 note says a found minion already engaged with the revealer does not engage, so no attack.
  it("a found Azazel that engages the revealer attacks at once (hero form)", () => {
    let s = started(rhinoCrazyGang(3, [NC], false));
    s = withForm(s, { heroForm: 0 }, P1);
    s = stageNemesisCardForReveal(s, BRIMSTONE_STRIKE, P1, 1);
    const seenStrike = azazelAttacksAfterStrike(s);
    expect(seenStrike.revealed, "Brimstone Strike was revealed").toBe(true);
    expect(seenStrike.attacks).toBeGreaterThanOrEqual(1);
    seen.azazelQuickstrike.push("staged");
  });

  it("a found Azazel already engaged with the revealer does not attack again (quickstrike needs a new engagement)", () => {
    let s = started(rhinoCrazyGang(3, [NC], false));
    s = withForm(s, { heroForm: 0 }, P1);
    s = azazelEngaged(s, P1);
    // Azazel is already in play and activates before the reveal; his own activation is stunned away so only the reveal is measured.
    s = patchInstance(
      s,
      playerOf(s, P1).playArea.find((i) => codeOf(s, i) === AZAZEL)!,
      {
        statuses: {
          ...s.instances[playerOf(s, P1).playArea.find((i) => codeOf(s, i) === AZAZEL)!]!.statuses,
          stunned: 1,
        },
      },
    );
    s = stageNemesisCardForReveal(s, BRIMSTONE_STRIKE, P1, 1); // (a stunned Azazel draws no boost card)
    const seenStrike = azazelAttacksAfterStrike(s);
    expect(seenStrike.revealed, "Brimstone Strike was revealed").toBe(true);
    expect(seenStrike.attacks).toBe(0);
    seen.azazelQuickstrikeSkipped.push("staged");
  });
});

describe("A short game through the wave 8 builder: Unus (Age of Apocalypse)", () => {
  it.each([1, 2])("seed %i: Nightcrawler plays three rounds under every invariant", (seed) => {
    const config = wave8Scenario("unus", { players: [NC], seed });
    const start = started(config);
    expect(start.players[0]!.hand.length).toBeGreaterThan(0);
    const result = play(start, new Observer(`unus#${seed}`), { stopAtRound: 4 });
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    seen.unusGame.push(`unus#${seed}`);
    expectReplays(result);
  });
});

describe("Targeted checks seen across the games", () => {
  it("every targeted check was seen at least once", () => {
    const counts = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length]));
    console.info(JSON.stringify(counts));
    const missing = Object.entries(counts)
      .filter(([, n]) => n === 0)
      .map(([k]) => k);
    expect(missing, `never seen: ${missing.join(", ")}`).toEqual([]);
  });
});

void cardId;
void applyCommand;
