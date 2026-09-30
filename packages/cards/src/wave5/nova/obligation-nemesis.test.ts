import { cardId } from "@mc/content";
import { cardsInPlay, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  runWith,
  settle,
  settleUntil,
  stackEncounterDeck,
  threatOn,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEvents, stageNemesisCardForReveal } from "../../testing/staging.js";
import { expectResolved, traceAbilities } from "../../testing/trace.js";
import { revealFromEncounterDeck, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { novaScenarioWithExtras } from "./support.js";
import type { Picker } from "../../testing/harness.js";

/** Accepts a named optional Response/Interrupt when offered (a trigger's own option id is `<instance>:<ability>`),
 * declining like `firstLegal` otherwise — `identity.test.ts`'s own local `accepting()` precedent, needed here
 * because Nova's Response ("ready Supernova Helmet") is optional, not forced: bare `firstLegal` declines it every
 * time, which would make a "the helmet stays exhausted" assertion true for the wrong reason (the Response never
 * even ran) rather than because Weight of the World's own constant stopped the ready. */
const accepting =
  (wantedAbility: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => id === wantedAbility || id.endsWith(`:${wantedAbility}`));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

const ADVANCE = "01186";
// Wakanda Forever! (core 01043d): an event, cost 1, prints one [wild] resource icon (identity.test.ts's own
// precedent) — off-precon, so it needs `extraCodes` (legality off).
const WAKANDA_FOREVER = "01043d";
// Spider-Woman (01011): a core ally that also prints one [wild] resource icon, so a copy can sit in a discard pile
// without depending on any not-yet-scripted Nova card.
const SPIDER_WOMAN = "01011";
// Ticket to the Multiverse (sm 27008): an upgrade printing *two* [wild] resource icons (`resourceIcons: { wild: 2
// }`) — the "icons, not cards" case for 28025's own X (`obligation-nemesis.ts`'s own docblock).
const TICKET_TO_THE_MULTIVERSE = "27008";
// Five of Nova's own real precon cards that print no [wild] resource at all (physical/mental/energy only) — safe
// hand filler for a test that needs a known, non-[wild] hand.
const SAFE_FILLERS = ["28002", "28003", "28004", "28005", "28006"] as const;

const novaVsRhino = (seed = 1, extraCodes: readonly string[] = []) =>
  startWave5Game(novaScenarioWithExtras("rhino", { seed, extraCodes }));

/**
 * Replaces `player`'s hand with exactly these cards (test-only surgery: `moveToHand`'s own zone-search, but for
 * the *whole* hand rather than one addition on top of whatever a seeded mulligan happened to keep). Needed because
 * Nova's own real precon carries three "resource" cards (Connection to the Worldmind 28007, The Power of
 * Aggression 28015, Everyday Hero 28019) whose own face icon (`producesIcons`) the engine's `printedResources`
 * (`packages/engine/src/resources.ts`) already treats as printed, for every card that reads `anyPrintedResource`/
 * `totalPrintedResources` across the whole pool (`obligation-nemesis.ts`'s own docblock has the fuller ruling
 * discussion) — so a plain freshly-dealt hand is not reliably [wild]-free, and this file's own filters (correctly,
 * by that same shared primitive) match them too. Displaces whatever the hand held onto the deck.
 */
function setHand(state: GameState, player: PlayerId, codes: readonly string[]): GameState {
  const owner = playerOf(state, player);
  const wanted: InstanceId[] = [];
  for (const code of codes) {
    const want = cardId(code);
    const found =
      owner.hand.find((id) => state.instances[id]?.cardId === want && !wanted.includes(id)) ??
      owner.deck.find((id) => state.instances[id]?.cardId === want && !wanted.includes(id)) ??
      owner.discard.find((id) => state.instances[id]?.cardId === want && !wanted.includes(id));
    if (!found) throw new Error(`${player} has no ${code} in hand, deck, or discard`);
    wanted.push(found);
  }
  const displaced = owner.hand.filter((id) => !wanted.includes(id));
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: wanted,
            deck: [...p.deck.filter((id) => !wanted.includes(id)), ...displaced],
            discard: p.discard.filter((id) => !wanted.includes(id)),
          }
        : p,
    ),
  };
}

/** Moves a still-set-aside nemesis-set card straight into `player`'s play area — the `spectrum-obligation-
 * nemesis.test.ts` `nemesisMinionEngaged` precedent, reused verbatim for Warbringer (`packages/engine/src/
 * setup.ts` sets aside every card in a hero's own nemesis encounter set, not only the minion). `engaged: false`
 * puts the card in play unengaged, so it does not take its own natural villain-phase activation — for exercising
 * only an *effect-initiated* attack against it (War Delivery's own "Warbringer attacks you"), isolated from his
 * own separate Forced Interrupt/natural activation in the same test. */
function nemesisCardInPlay(
  state: GameState,
  code: string,
  player: PlayerId = P1,
  opts: { readonly engaged?: boolean } = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const wanted = cardId(code);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} set aside for ${player}`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? { ...p, setAside: p.setAside.filter((i) => i !== id), playArea: [...p.playArea, id] }
          : p,
      ),
      instances: {
        ...state.instances,
        [id]: {
          ...state.instances[id]!,
          faceup: true,
          controllerId: null,
          engagedWith: opts.engaged === false ? null : player,
        },
      },
    },
  };
}

/** Test-only surgery: puts a copy of `code` directly into `player`'s play area from hand or deck — for a card
 * under test to count as "controlled", without needing that card's own (possibly unscripted) play-time ability. */
function putAllyInPlay(
  state: GameState,
  player: PlayerId,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const wanted = cardId(code);
  const id =
    owner.hand.find((i) => state.instances[i]?.cardId === wanted) ??
    owner.deck.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`${player} has no ${code} in hand or deck`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: p.hand.filter((x) => x !== id),
              deck: p.deck.filter((x) => x !== id),
              playArea: [...p.playArea, id],
            }
          : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true } },
    },
  };
}

/** Moves a copy of `code` straight to `player`'s discard pile — `staging.ts`'s own `moveToDiscard`, reused here
 * because that shared file is only for helpers every pack agent imports (this file's `WAKANDA_FOREVER`/`HELLCAT`/
 * `SPIDER_WOMAN` are local to this test). */
function toDiscard(
  state: GameState,
  player: PlayerId,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const wanted = cardId(code);
  const id =
    owner.hand.find((i) => state.instances[i]?.cardId === wanted) ??
    owner.deck.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`${player} has no ${code} in hand or deck`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: p.hand.filter((x) => x !== id),
              deck: p.deck.filter((x) => x !== id),
              discard: [...p.discard, id],
            }
          : p,
      ),
    },
  };
}

describe("Weight of the World (28021, obligation)", () => {
  it("28021.weight-of-the-world-constant: Supernova Helmet cannot ready while Weight of the World is in play", () => {
    const staged = stackEncounterDeck(novaVsRhino(1), ADVANCE, "28021");
    const revealed = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const [obligation] = instancesOf(revealed, "28021").filter((id) => cardsInPlay(revealed).includes(id));
    expect(obligation).toBeDefined();

    const hero = run(revealed, toHero(P1));
    const givenHelmet = moveToHand(hero, P1, "28009");
    const [helmet] = givenHelmet.ids as [InstanceId];
    const played = run(givenHelmet.state, play(P1, helmet, payWith(givenHelmet.state, P1, 1, [helmet])));
    const exhausted = patchInstance(played, helmet, { exhausted: true });
    const identity = identityOf(exhausted, P1);
    const villain = exhausted.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhausted, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      accepting("28001a.nova-response"),
      undefined,
      WAVE5_DEPS,
    );
    // Nova's own Response ("ready Supernova Helmet") still fires, but Weight of the World's own constant stops the
    // ready itself — the helmet stays exhausted, unlike `identity.test.ts`'s own positive case with no obligation
    // in play.
    expect(inst(after, helmet).exhausted).toBe(true);
  });

  it("28021.weight-of-the-world-action: exhausting Sam Alexander removes it from the game, and Supernova Helmet can ready again", () => {
    const staged = stackEncounterDeck(novaVsRhino(2), ADVANCE, "28021");
    const revealed = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const [obligation] = instancesOf(revealed, "28021").filter((id) => cardsInPlay(revealed).includes(id));
    expect(obligation).toBeDefined();
    const identity = identityOf(revealed, P1);

    const removed = settle(
      runWith(WAVE5_DEPS, revealed, use(P1, obligation!, "28021.weight-of-the-world-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(removed, identity).exhausted).toBe(true); // The action's own cost.
    expect(removed.removedFromGame).toContain(obligation);
    expect(cardsInPlay(removed)).not.toContain(obligation);

    // With Weight of the World gone, Nova's Response readies Supernova Helmet normally again.
    const readied = patchInstance(removed, identity, { exhausted: false }); // Ready the identity before the next round.
    const hero = run(readied, toHero(P1));
    const givenHelmet = moveToHand(hero, P1, "28009");
    const [helmet] = givenHelmet.ids as [InstanceId];
    const played = run(givenHelmet.state, play(P1, helmet, payWith(givenHelmet.state, P1, 1, [helmet])));
    const exhaustedHelmet = patchInstance(played, helmet, { exhausted: true });
    const nowHero = identityOf(exhaustedHelmet, P1);
    const villain = exhaustedHelmet.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhaustedHelmet, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: nowHero,
        targetInstanceId: villain,
      }),
      accepting("28001a.nova-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, helmet).exhausted).toBe(false);
  });
});

describe('"Bring the War!" (28022, side scheme)', () => {
  it("28022.when-revealed: discards the [wild]-resource card a player controls, placing 1 threat here for it", () => {
    const state = setHand(novaVsRhino(1, [WAKANDA_FOREVER]), P1, [WAKANDA_FOREVER, ...SAFE_FILLERS]);
    const wild = playerOf(state, P1).hand[0]!;
    const { state: after, id: sideScheme } = revealFromEncounterDeck(state, "28022");
    expect(playerOf(after, P1).hand).not.toContain(wild);
    expect(playerOf(after, P1).discard).toContain(wild);
    expect(threatOn(after, sideScheme)).toBe(3); // Printed startingThreat base 2, +1 for the 1 card discarded.
  });

  it("28022.when-revealed: discards nothing and places no extra threat when a player controls no [wild]-resource card", () => {
    const state = setHand(novaVsRhino(2), P1, [...SAFE_FILLERS]);
    const { state: after, id: sideScheme } = revealFromEncounterDeck(state, "28022");
    // No card of ours was forced to discard (the round's own automatic start-of-turn draw the next round is not a
    // discard, so a plain "hand unchanged" assertion would be too strict).
    expect(playerOf(after, P1).discard).toEqual([]);
    expect(threatOn(after, sideScheme)).toBe(2); // Printed startingThreat base only.
  });
});

describe("Warbringer (28023, nemesis minion)", () => {
  it("28023.warbringer-forced-interrupt: +1 ATK per [wild]-resource card in hand, and the attack gains overkill", () => {
    // Exactly 5 cards — Nova's own printed hero hand size — so nothing is discarded to a hand-size cap at the end
    // of this turn before Warbringer's own villain-phase activation is reached (a 7-card hand here once silently
    // lost both [wild] cards to that end-of-turn discard, `firstLegal` picking the first 2 offered).
    const withHand = setHand(novaVsRhino(1, [WAKANDA_FOREVER, WAKANDA_FOREVER]), P1, [
      WAKANDA_FOREVER,
      WAKANDA_FOREVER,
      ...SAFE_FILLERS.slice(0, 3),
    ]);
    // Minions attack a player in hero form, scheme against one in alter-ego form (RRG 1.8 "Activation", p. 6) — a
    // natural villain-phase activation needs hero form for Warbringer to *attack* rather than scheme, so his own
    // Forced Interrupt ("When Warbringer attacks you") has an attack to fire on at all.
    const staged = run(withHand, toHero(P1));
    const engaged = nemesisCardInPlay(staged, "28023");
    const { deps, trace } = traceAbilities(WAVE5_DEPS);
    const { events } = driveEvents(deps, stackEncounterDeck(engaged.state, ADVANCE), endTurn(P1));
    expectResolved(trace, "28023.warbringer-forced-interrupt");
    const resolved = events.find((e) => e.type === "attackResolved" && e.enemyInstanceId === engaged.id);
    expect(resolved).toMatchObject({ baseAtk: 5, damageDealt: 5 }); // printed ATK 3 + 1 per of 2 [wild] cards.
  });

  it("28023.warbringer-forced-interrupt: +0 ATK with no [wild]-resource card in hand", () => {
    const withHand = setHand(novaVsRhino(3), P1, [...SAFE_FILLERS]);
    const staged = run(withHand, toHero(P1));
    const engaged = nemesisCardInPlay(staged, "28023");
    const { deps, trace } = traceAbilities(WAVE5_DEPS);
    const { events } = driveEvents(deps, stackEncounterDeck(engaged.state, ADVANCE), endTurn(P1));
    expectResolved(trace, "28023.warbringer-forced-interrupt");
    const resolved = events.find((e) => e.type === "attackResolved" && e.enemyInstanceId === engaged.id);
    expect(resolved).toMatchObject({ baseAtk: 3, damageDealt: 3 }); // printed ATK only.
  });

  it("28023.warbringer-forced-interrupt: the ability's own effect grants overkill for that attack", () => {
    const def = WAVE5_DEPS.abilities["28023.warbringer-forced-interrupt"]!;
    expect(def.effects).toEqual([
      {
        kind: "modifyAttack",
        atkBonus: { kind: "handCount", player: { kind: "controller" }, filter: { anyPrintedResource: ["wild"] } },
        keywords: ["overkill"],
      },
    ]);
  });
});

describe("War Delivery (28024, treachery)", () => {
  it("28024.when-revealed: spending a [wild] resource stops both attacks", () => {
    const staged = setHand(novaVsRhino(1, [WAKANDA_FOREVER]), P1, [WAKANDA_FOREVER, ...SAFE_FILLERS]);
    const wild = playerOf(staged, P1).hand[0]!;
    const withWarbringer = nemesisCardInPlay(staged, "28023", P1, { engaged: false });
    const stagedEncounter = stageNemesisCardForReveal(withWarbringer.state, "28024", P1, 1);
    const identity = identityOf(stagedEncounter, P1);
    const before = inst(stagedEncounter, identity).damage;
    const atPrompt = settleUntil(
      runWith(WAVE5_DEPS, stagedEncounter, endTurn(P1)),
      "spendResources",
      firstLegal,
      WAVE5_DEPS,
    );
    const after = settle(answer(atPrompt, [`hand:${wild}`], WAVE5_DEPS), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(after, identity).damage).toBe(before); // Paid: neither attack happens.
    expect(playerOf(after, P1).hand).not.toContain(wild);
  });

  it("28024.when-revealed: declining to spend means the villain and Warbringer each attack you, in hero form", () => {
    const staged = setHand(novaVsRhino(2), P1, [...SAFE_FILLERS]); // No [wild] card to spend, and none for Warbringer's own bonus.
    const hero = run(staged, toHero(P1));
    const withWarbringer = nemesisCardInPlay(hero, "28023", P1, { engaged: false });
    const stagedEncounter = stageNemesisCardForReveal(withWarbringer.state, "28024", P1, 1);
    const identity = identityOf(stagedEncounter, P1);
    const before = inst(stagedEncounter, identity).damage;
    const after = settle(runWave5(stagedEncounter, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    // Rhino's printed ATK 2 + Warbringer's printed ATK 3 (no [wild] card in hand for his own +1 each): 5 total.
    // Loose by design: the same round's own ordinary villain-phase activation (Rhino's) can also deal damage.
    expect(inst(after, identity).damage).toBeGreaterThanOrEqual(before + 5);
  });

  it("28024.when-revealed: declining to spend also attacks you while in alter-ego form", () => {
    const staged = setHand(novaVsRhino(3), P1, [...SAFE_FILLERS]);
    expect(playerOf(staged, P1).identity.form).toBe("alterEgo");
    const withWarbringer = nemesisCardInPlay(staged, "28023", P1, { engaged: false });
    const stagedEncounter = stageNemesisCardForReveal(withWarbringer.state, "28024", P1, 1);
    const identity = identityOf(stagedEncounter, P1);
    const before = inst(stagedEncounter, identity).damage;
    const after = settle(runWave5(stagedEncounter, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(playerOf(after, P1).identity.form).toBe("alterEgo"); // Never changed form.
    expect(inst(after, identity).damage).toBeGreaterThanOrEqual(before + 5);
  });

  it("28024.boost: places 1 threat on the main scheme per [wild]-resource card in hand", () => {
    const def = WAVE5_DEPS.abilities["28024.boost"]!;
    expect(def.effects).toEqual([
      {
        kind: "placeThreat",
        amount: { kind: "handCount", player: { kind: "controller" }, filter: { anyPrintedResource: ["wild"] } },
        target: { kind: "mainScheme" },
      },
    ]);
  });
});

describe('"The War\'s Been Brought" (28025, treachery, Surge)', () => {
  it("28025.when-revealed: X is the total printed [wild] icons (not cards) in hand, under control, and in discard — a 2-icon card counts twice", () => {
    // Wakanda Forever (hand): 1 icon. Ticket to the Multiverse (control, `resourceIcons: { wild: 2 }`): 2 icons.
    // Spider-Woman (discard pile): 1 icon. X = 1 + 2 + 1 = 4 — a card-count bug would compute 3 (one per card)
    // instead, one short.
    const state = novaVsRhino(1, [WAKANDA_FOREVER, TICKET_TO_THE_MULTIVERSE, SPIDER_WOMAN]);
    const withHand = setHand(state, P1, [WAKANDA_FOREVER, ...SAFE_FILLERS]);
    const withControl = putAllyInPlay(withHand, P1, TICKET_TO_THE_MULTIVERSE);
    const withDiscardPile = toDiscard(withControl.state, P1, SPIDER_WOMAN);

    // The deck order after staging is deterministic (this seed's own shuffle): [the filler ADVANCE Rhino's own
    // activation consumes as a boost card, "28025" itself, then whatever `discardEncounterCards` reaches] — so the
    // 4 specific cards X=4 should discard are knowable up front.
    const staged = stageNemesisCardForReveal(withDiscardPile.state, "28025", P1, 1);
    const deckId = Object.keys(staged.encounterDecks)[0]!;
    const rest = staged.encounterDecks[deckId]!.deck.slice(2); // past the filler and "28025" itself.
    const expectedDiscarded = rest.slice(0, 4);

    // Surge's own additional reveal (RRG 1.8 "Surge") only resolves once this card is *fully* resolved, so a mere
    // "is it in the discard pile by the end" check can't tell "discarded by X" from "discarded later by Surge's own
    // chase reveal" (Surge always reveals whatever is on top *next*, so with a card-count bug computing X=3 instead
    // of 4, Surge's own reveal would land on this exact 4th card too, silently patching over the bug). Instead: an
    // `abilityResolved` event marks the *start* of an ability's own effects (`resolve/ability.ts`
    // `executeAbilityFrame` emits it before `pushEffects`), and "28025" itself is discarded, as the revealed card,
    // only once its own When Revealed is fully done — so every `cardMoved`-to-discard event for one of the 4
    // expected cards must fall strictly between this ability's own `abilityResolved` and its own card's later
    // `cardMoved`-to-discard, to prove *this ability* (not Surge, further downstream) discarded it.
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const resolved = events.find(
      (e): e is Extract<typeof e, { type: "abilityResolved" }> =>
        e.type === "abilityResolved" && e.abilityId === "28025.when-revealed",
    );
    expect(resolved).toBeDefined();
    const resolvedIndex = events.indexOf(resolved!);
    const selfDiscardedIndex = events.findIndex(
      (e, i) =>
        i > resolvedIndex &&
        e.type === "cardMoved" &&
        e.instanceId === resolved!.instanceId &&
        e.to.kind === "encounterDiscard",
    );
    expect(selfDiscardedIndex).toBeGreaterThan(resolvedIndex);
    for (const id of expectedDiscarded) {
      const movedIndex = events.findIndex(
        (e) => e.type === "cardMoved" && e.instanceId === id && e.to.kind === "encounterDiscard",
      );
      expect(movedIndex).toBeGreaterThan(resolvedIndex);
      expect(movedIndex).toBeLessThan(selfDiscardedIndex);
    }
  });

  it("28025.when-revealed: discards nothing extra when no [wild]-resource card is in hand, in play, or in discard", () => {
    const state = setHand(novaVsRhino(2), P1, [...SAFE_FILLERS]);
    const deckId = Object.keys(state.encounterDecks)[0]!;
    const discardBefore = state.encounterDecks[deckId]!.discard.length;
    const { state: after } = revealFromEncounterDeck(state, "28025", firstLegal, 1);
    // Only this card's own reveal (and Surge's own reveal-until-non-surge chain) grows the discard, not any X.
    expect(after.encounterDecks[deckId]!.discard.length).toBeGreaterThanOrEqual(discardBefore + 1);
  });
});
