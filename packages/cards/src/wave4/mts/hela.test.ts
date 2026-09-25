import { cardId } from "@mc/content";
import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { defeatWithAttack as defeatWithAttackWith } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { wave4Scenario } from "../setup.js";
import { runWave4, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

/**
 * Real-game tests for the Hela scenario's own scripted refs (`hela.ts`). Every test seats Spectrum's own precon
 * (`spectrum-leadership`) at the "hela" scenario (`wave4Scenario`, `MTS_SCENARIOS`'s single-villain record).
 */

const helaGame = (seed = 1) => startWave4Game(spectrumScenario("hela", { seed }));

/** Hela's own expert villain (21137a/21137b) is a whole separate card, not a later stage of 21136a/b (MC21 p. 20:
 * "Villain deck Hela A (Hela B instead for expert mode)") — built by hand, `hela-e2e.test.ts`'s own module docblock
 * has the exact `card-data-pipeline` gap (`MTS_SCENARIOS`'s `hela` record has no `expertVillains` yet). */
const expertHelaGame = (seed = 1) =>
  startWave4Game({
    ...wave4Scenario("hela", { players: [{ starterDeckId: "spectrum-leadership" }], seed, difficulty: "expert" }),
    villainCardId: cardId("21137a"),
  });

const heroForm = (state: GameState): GameState =>
  settle(runWave4(state, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);

const odinId = (state: GameState): InstanceId => instancesOf(state, "21139a")[0]!;

/** Reveal `code` from the encounter deck, past the villain's own unconditional boost draw (a filler copy of Core's
 * "Advance", 01186, already in every scenario deck — `gmw/escape-the-museum.test.ts`'s own `reveal` helper). */
/** The keyword grants a `constant`-triggered ability compiles to (`gainsKeyword`'s own `keywordGrants` field, which
 * only that trigger kind carries) — narrowed with a real `if`, not a cast, so a ref accidentally compiled to a
 * different trigger kind fails loudly here instead of silently reading `undefined`. */
const keywordGrantsOf = (abilityId: string): readonly { readonly keyword: { readonly name: string } }[] => {
  const trigger = WAVE4_DEPS.abilities[abilityId]!.trigger;
  if (trigger.kind !== "constant") throw new Error(`${abilityId} is not a constant ability`);
  return trigger.keywordGrants ?? [];
};

const reveal = (state: GameState, code: string): GameState =>
  settle(
    runWave4(stackEncounterDeck(state, "01186", code), { type: "endTurn", playerId: P1 }),
    firstLegal,
    undefined,
    WAVE4_DEPS,
  );

/** Damages `target` to the brink, then lands the killing blow with a real `basicAttack` — `../../testing/staging.ts`'s
 * `defeatWithAttack`, but taking `state` first so it reads like this file's other helpers. */
const defeatWithAttack = (state: GameState, target: InstanceId): GameState =>
  defeatWithAttackWith(WAVE4_DEPS, state, target);

/** A single basic thwart that removes exactly `state`'s current threat on `schemeId` (readying the identity first,
 * so a second call this same round doesn't hit "already exhausted"). */
const thwartToZero = (state: GameState, schemeId: InstanceId): GameState => {
  const identity = identityOf(state, P1);
  const ready = patchInstance(patchInstance(state, identity, { exhausted: false }), schemeId, {
    threat: 1,
  });
  return settle(
    runWave4(ready, { type: "basicThwart", playerId: P1, thwarterInstanceId: identity, schemeInstanceId: schemeId }),
    firstLegal,
    undefined,
    WAVE4_DEPS,
  );
};

describe("Odin's Torment Setup (21138a.setup)", () => {
  it("attaches Odin (captive side) to the main scheme, reveals Gnipahellir and Garm, sets the other four cards aside, and shuffles the deck", () => {
    const state = helaGame();
    const odin = odinId(state);
    expect(inst(state, odin).attachedTo).toBe(state.mainScheme.instanceId);
    const gnipahellir = instancesOf(state, "21140")[0]!;
    const garm = instancesOf(state, "21143")[0]!;
    expect(state.villainArea).toContain(gnipahellir);
    expect(garm).toBeDefined();
    expect(inst(state, garm).engagedWith).toBe(state.firstPlayerId); // §3.8's own reveal composition, module docblock
    const setAsideCodes = state.encounterSetAside.map((id) => state.instances[id]?.cardId).sort();
    expect(setAsideCodes).toEqual([cardId("21141"), cardId("21142"), cardId("21144"), cardId("21145")].sort());
    const anyDeck = Object.values(state.encounterDecks)[0]!;
    for (const code of ["21141", "21142", "21144", "21145"]) {
      expect(instancesOf(state, code).some((id) => anyDeck.deck.includes(id))).toBe(false);
    }
  });
});

describe("Odin, Captive side (21139a)", () => {
  it("while attached to the main scheme, cannot be reached as an ally/character and takes no attachments (21139a.odin-constant, 21139a.odin-constant-2)", () => {
    const state = helaGame();
    const odin = odinId(state);
    // Structural proof of "not a friendly character while attached" (ruling Jun 25, 2026 (4) #5) and "cannot have
    // cards attached" (ruling Aug 3, 2026 (4) #1): neither is in any player's play area, and stays with no
    // attachments — the same primitive `packages/engine/src/captive-ally.test.ts` proves generically for this exact
    // card shape. This test's own contribution is that *this* card (Hela's own Odin, seated by a real scenario) is
    // wired to it.
    expect(state.players.every((p) => !p.playArea.includes(odin))).toBe(true);
    expect(inst(state, odin).attachments).toEqual([]);
  });

  it("once detached, the first player controls him as an ally in play (21139a.odin-constant)", () => {
    // Hall of Nastrond's own when-defeated (21141) detaches Odin; simplest real path there without playing three
    // rounds of side-scheme chain is to put Hall of Nastrond into play directly (state surgery for reach only, the
    // way `docs/card-scripting-process.md` §6 sanctions), then defeat it with a real thwart.
    const state = helaGame();
    const odin = odinId(state);
    const hallOfNastrond = instancesOf(state, "21141")[0]!;
    const withNastrondInPlay: GameState = {
      ...state,
      villainArea: [...state.villainArea, hallOfNastrond],
      encounterSetAside: state.encounterSetAside.filter((id) => id !== hallOfNastrond),
      instances: {
        ...state.instances,
        [hallOfNastrond]: { ...state.instances[hallOfNastrond]!, threat: 1 },
      },
    };
    const defeated = thwartToZero(heroForm(withNastrondInPlay), hallOfNastrond);
    expect(inst(defeated, odin).attachedTo).toBeNull();
    expect(defeated.players.some((p) => p.playArea.includes(odin))).toBe(true);
    expect(inst(defeated, odin).controllerId).toBe(defeated.firstPlayerId);
  });

  it("if Odin ever leaves play, the players lose the game (21139a.odin-constant-2)", () => {
    // `leavingPlayLoses` itself, live, is `packages/engine/src/captive-ally.test.ts`'s own job (docs/phase7-wave4.md
    // §3.8: "detached, the first player controls him, in play; defeated, he is removed from the game and the players
    // lose the game") — that fixture is this exact card shape (Captive/King, attached to the main scheme). This
    // card's own contribution is that the rule is actually wired to *Odin's own compiled ability*, not just proven
    // generically: no player command deals direct damage to a controlled ally outside combat, and defending a real
    // villain/minion attack with him needs the full `declareDefender` choice machinery for no added rigor over the
    // engine's own fixture, so the compiled rule is asserted directly.
    const ability = WAVE4_DEPS.abilities["21139a.odin-constant-2"]!;
    if (ability.trigger.kind !== "constant") throw new Error("not a constant ability");
    expect(ability.trigger.rules).toContainEqual({ kind: "leavingPlayLoses", target: { self: true } });
  });
});

describe("Odin, King side (21139b)", () => {
  it("names the same first-player-control and ally-limit exclusion unconditionally (never gated on attachment, since the King side is never attached) — 21139b.odin-constant, 21139b.odin-constant-2", () => {
    // The King side is reached only via `flipCard` (module docblock: no `mts` card triggers it in a standalone Hela
    // game — MC21 p. 20 keeps Odin Captive throughout; the King side exists on this card for the Loki
    // scenario/campaign carry-over, MC21 p. 24, out of this task's scope). Its own compiled rules are asserted
    // directly instead of reached through a game this scenario never puts them in.
    const constant = WAVE4_DEPS.abilities["21139b.odin-constant"]!;
    if (constant.trigger.kind !== "constant") throw new Error("not a constant ability");
    expect(constant.trigger.rules).toEqual([{ kind: "controlledByFirstPlayer", target: { self: true } }]);
    const constant2 = WAVE4_DEPS.abilities["21139b.odin-constant-2"]!;
    if (constant2.trigger.kind !== "constant") throw new Error("not a constant ability");
    expect(constant2.trigger.rules).toEqual([
      { kind: "cannotHaveAttachments", target: { self: true }, from: "encounter" },
      { kind: "excludedFromAllyLimit", target: { self: true } },
    ]);
  });
});

describe("Hela, Wounded side (21136b)", () => {
  it("cannot be defeated, and flips back to Mystic after any side scheme is defeated, hit points reset (21136b.hela-constant, 21136b.hela-forced-response)", () => {
    const state = helaGame();
    const hero = heroForm(state);
    // Flip Hela to her Wounded side directly (state surgery for reach — the interrupt itself is tested below). Both
    // sides live on the *same* card record (`21136a`, with an "A"/"B" `sides` array — not two separate card ids the
    // way Escape the Museum's Collector is): only `side` changes, never `cardId`.
    const wounded: GameState = {
      ...hero,
      villains: hero.villains.map((v) => ({ ...v, side: "B" as const })),
    };
    const hit = defeatWithAttack(wounded, wounded.villains[0]!.instanceId);
    expect(hit.villains[0]!.defeated).toBe(false); // cannot be defeated on the Wounded face
    expect(hit.villains[0]!.side).toBe("B");
    expect(inst(hit, hit.villains[0]!.instanceId).damage).toBeGreaterThan(0); // damage still lands, just never defeats it

    // Garm's own printed rule ("Threat cannot be removed from Gnipahellir", `21143.garm-constant-2`) is unconditional
    // while he's in play — genuinely blocking a thwart here, an interaction this test isn't about — so he's removed
    // by surgery first, purely to reach a side scheme's defeat by the shortest path.
    const gnipahellir = instancesOf(hit, "21140")[0]!;
    const garmGone = removeMinionFromPlay(hit, "21143");
    const readied = patchInstance(garmGone, identityOf(garmGone, P1), { exhausted: false });
    const flipped = thwartToZero(readied, gnipahellir);
    expect(flipped.villains[0]!.cardId).toBe(cardId("21136a")); // the same card record throughout
    expect(flipped.villains[0]!.side).toBe("A"); // flipped back to Mystic
    expect(inst(flipped, flipped.villains[0]!.instanceId).damage).toBe(0); // dial reset by the engine's own flip rule
  });
});

describe("Hela, expert villain (21137a/21137b) — the same shape as 21136a/21136b, on the box's own separate expert card", () => {
  it("cannot be defeated on the Wounded side, and the Mystic side wins the game when Odin is free (21137a.hela-constant-2, 21137b.hela-constant, 21137b.hela-forced-response)", () => {
    const state = expertHelaGame();
    expect(state.villains[0]!.cardId).toBe(cardId("21137a"));
    const odin = odinId(state);
    const detached: GameState = {
      ...state,
      instances: { ...state.instances, [odin]: { ...state.instances[odin]!, attachedTo: null, controllerId: P1 } },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, odin] } : p)),
    };
    const hero = heroForm(detached);
    const hit = defeatWithAttack(hero, hero.villains[0]!.instanceId);
    expect(hit.villains[0]!.defeated).toBe(true); // Odin was free: a real defeat
    expect(hit.outcome).toEqual({ result: "win", reason: "villainDefeated" }); // 21137a.hela-constant-2

    const woundedState = expertHelaGame(2);
    const woundedHero = heroForm(woundedState);
    const wounded: GameState = {
      ...woundedHero,
      villains: woundedHero.villains.map((v) => ({ ...v, side: "B" as const })),
    };
    const woundedHit = defeatWithAttack(wounded, wounded.villains[0]!.instanceId);
    expect(woundedHit.villains[0]!.defeated).toBe(false); // 21137b.hela-constant: cannot be defeated
    const gnipahellir = instancesOf(woundedHit, "21140")[0]!;
    const garmGone = removeMinionFromPlay(woundedHit, "21143");
    const readied = patchInstance(garmGone, identityOf(garmGone, P1), { exhausted: false });
    const flippedBack = thwartToZero(readied, gnipahellir);
    expect(flippedBack.villains[0]!.side).toBe("A"); // 21137b.hela-forced-response: flips back after a side scheme falls
  });
});

describe("Odin's Torment (21138b.odins-torment-forced-interrupt)", () => {
  it("while Odin is attached to the main scheme, a lethal hit discards Hela's attachments and flips her to Wounded instead of defeating her", () => {
    const state = helaGame();
    const hero = heroForm(state);
    const villain = hero.villains[0]!;
    // Attach Nightsword to Hela first (state surgery for reach), so "discard each attachment" has something to
    // prove — removed from the encounter deck it started in, not just linked by `attachedTo`/`attachments`, so
    // `locateCard` finds it as an attachment rather than still-in-the-deck (`relocateCard`'s own zone lookup order).
    const nightsword = instancesOf(hero, "21146")[0]!;
    const deckId = Object.keys(hero.encounterDecks)[0]!;
    const pile = hero.encounterDecks[deckId]!;
    const withNightsword: GameState = {
      ...hero,
      encounterDecks: {
        ...hero.encounterDecks,
        [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== nightsword) },
      },
      instances: {
        ...hero.instances,
        [nightsword]: { ...hero.instances[nightsword]!, attachedTo: villain.instanceId, faceup: true },
        [villain.instanceId]: {
          ...hero.instances[villain.instanceId]!,
          attachments: [...hero.instances[villain.instanceId]!.attachments, nightsword],
        },
      },
    };
    const hit = defeatWithAttack(withNightsword, villain.instanceId);
    expect(hit.villains[0]!.defeated).toBe(false); // never actually defeated — Odin was attached
    expect(hit.villains[0]!.side).toBe("B"); // flipped to Wounded
    expect(inst(hit, villain.instanceId).attachments).toEqual([]); // Nightsword discarded
    expect(hit.encounterDecks[deckId]!.discard).toContain(nightsword); // to its own (encounter) discard pile
  });

  it("once Odin is not attached, a lethal hit defeats Hela for real and the players win (21136a.hela-constant-2)", () => {
    const state = helaGame();
    const odin = odinId(state);
    const detached: GameState = {
      ...state,
      instances: { ...state.instances, [odin]: { ...state.instances[odin]!, attachedTo: null, controllerId: P1 } },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, odin] } : p)),
    };
    const hero = heroForm(detached);
    const villain = hero.villains[0]!;
    const hit = defeatWithAttack(hero, villain.instanceId);
    expect(hit.villains[0]!.defeated).toBe(true);
    expect(hit.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });
});

/** A minion revealed at setup/via a chained reveal enters the *revealing player's own* `playArea`, not
 * `villainArea` (`enterPlayOnReveal`'s own minion branch) — checked directly, this module's own trap to name once.
 * `removeFromPlay` strips a minion out entirely (surgery), used only to get *around* Garm's own unconditional
 * "Threat cannot be removed from Gnipahellir" rule (`21143.garm-constant-2`) in tests that aren't about that rule. */
const removeMinionFromPlay = (state: GameState, code: string): GameState => {
  const id = instancesOf(state, code)[0]!;
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== id) })),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, engagedWith: null } },
  };
};

describe("Gnipahellir (21140.when-defeated)", () => {
  it("reveals Gjallerbru and Skurge into play, and deals each other player 1 facedown encounter card", () => {
    const twoPlayers = startWave4Game(
      spectrumScenario("hela", { seed: 2, extraPlayers: [{ starterDeckId: "adam-warlock-all-aspects" }] }),
    );
    const gnipahellir = instancesOf(twoPlayers, "21140")[0]!;
    // Garm's own unconditional "Threat cannot be removed from Gnipahellir" (`21143.garm-constant-2`, its own test
    // above) would otherwise block every thwart below outright — not an interaction this test is about.
    const withoutGarm = removeMinionFromPlay(twoPlayers, "21143");
    const hero = settle(runWave4(withoutGarm, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const p2DealtBefore = playerOf(hero, hero.players[1]!.playerId).dealtEncounter.length;
    const defeated = thwartToZero(hero, gnipahellir);
    const gjallerbru = instancesOf(defeated, "21142")[0]!;
    const skurge = instancesOf(defeated, "21144")[0]!;
    expect(defeated.villainArea).toContain(gjallerbru);
    expect(Object.values(defeated.instances).some((i) => i.instanceId === skurge && i.engagedWith)).toBe(true);
    expect(defeated.encounterSetAside).not.toContain(gjallerbru);
    expect(defeated.encounterSetAside).not.toContain(skurge);
    const p2DealtAfter = playerOf(defeated, defeated.players[1]!.playerId).dealtEncounter.length;
    expect(p2DealtAfter).toBe(p2DealtBefore + 1); // "each *other* player" — not P1, the first player who revealed
    expect(playerOf(defeated, P1).dealtEncounter.length).toBe(playerOf(hero, P1).dealtEncounter.length);
  });
});

describe("Hall of Nastrond (21141.when-defeated)", () => {
  it("detaches Odin (first player takes control) and deals *each* player (including the first) 1 facedown encounter card", () => {
    const state = helaGame();
    const odin = odinId(state);
    const hallOfNastrond = instancesOf(state, "21141")[0]!;
    const withNastrondInPlay: GameState = {
      ...state,
      villainArea: [...state.villainArea, hallOfNastrond],
      encounterSetAside: state.encounterSetAside.filter((id) => id !== hallOfNastrond),
      instances: {
        ...state.instances,
        [hallOfNastrond]: { ...state.instances[hallOfNastrond]!, threat: 1 },
      },
    };
    const p1DealtBefore = playerOf(withNastrondInPlay, P1).dealtEncounter.length;
    const defeated = thwartToZero(heroForm(withNastrondInPlay), hallOfNastrond);
    expect(inst(defeated, odin).attachedTo).toBeNull();
    expect(inst(defeated, odin).controllerId).toBe(defeated.firstPlayerId);
    expect(playerOf(defeated, P1).dealtEncounter.length).toBe(p1DealtBefore + 1); // "each player" includes the first
  });
});

describe("Gjallerbru (21142.when-defeated)", () => {
  it("reveals Hall of Nastrond and Nidhogg into play, and deals each other player 1 facedown encounter card", () => {
    const twoPlayers = startWave4Game(
      spectrumScenario("hela", { seed: 3, extraPlayers: [{ starterDeckId: "adam-warlock-all-aspects" }] }),
    );
    const gjallerbru = instancesOf(twoPlayers, "21142")[0]!;
    const withGjallerbruInPlay: GameState = {
      ...twoPlayers,
      villainArea: [...twoPlayers.villainArea, gjallerbru],
      encounterSetAside: twoPlayers.encounterSetAside.filter((id) => id !== gjallerbru),
      instances: {
        ...twoPlayers.instances,
        [gjallerbru]: { ...twoPlayers.instances[gjallerbru]!, threat: 1 },
      },
    };
    const hero = settle(runWave4(withGjallerbruInPlay, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const p2DealtBefore = playerOf(hero, hero.players[1]!.playerId).dealtEncounter.length;
    const defeated = thwartToZero(hero, gjallerbru);
    const hallOfNastrond = instancesOf(defeated, "21141")[0]!;
    const nidhogg = instancesOf(defeated, "21145")[0]!;
    expect(defeated.villainArea).toContain(hallOfNastrond);
    expect(Object.values(defeated.instances).some((i) => i.instanceId === nidhogg && i.engagedWith)).toBe(true);
    const p2DealtAfter = playerOf(defeated, defeated.players[1]!.playerId).dealtEncounter.length;
    expect(p2DealtAfter).toBe(p2DealtBefore + 1);
  });
});

/** Puts `code`'s one copy directly into the villain area, engaged with the first player — every minion here prints
 * "engages the first player" (`coveredByEngineRule`, module docblock), so this state matches how they actually
 * enter play in a real game (setup/side-scheme reveal, always by the first player). */
function minionInPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const id = instancesOf(state, code)[0]!;
  return {
    id,
    state: {
      ...state,
      villainArea: [...state.villainArea, id],
      encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, engagedWith: state.firstPlayerId },
      },
    },
  };
}

/** A set-aside side scheme (Gjallerbru/Hall of Nastrond), put into play — the same shape `minionInPlay` uses. */
function sideSchemeInPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const id = instancesOf(state, code)[0]!;
  return {
    id,
    state: {
      ...state,
      villainArea: [...state.villainArea, id],
      encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, threat: 5 } },
    },
  };
}

describe("Garm (21143)", () => {
  it("engages the first player by construction, and threat cannot be removed from Gnipahellir (21143.garm-constant, 21143.garm-constant-2)", () => {
    const state = helaGame();
    const garm = instancesOf(state, "21143")[0]!;
    expect(inst(state, garm).engagedWith).toBe(state.firstPlayerId); // Setup's own reveal already proves -constant
    const gnipahellir = instancesOf(state, "21140")[0]!;
    const withThreat = patchInstance(heroForm(state), gnipahellir, { threat: 5 });
    const identity = identityOf(withThreat, P1);
    const attempted = settle(
      runWave4(withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: gnipahellir,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(attempted, gnipahellir).threat).toBe(5); // unchanged: threat cannot be removed from Gnipahellir
  });
});

describe("Skurge (21144)", () => {
  it("engages the first player, its attacks gain piercing, and threat cannot be removed from Gjallerbru (21144.skurge-constant, 21144.skurge-constant-2, 21144.skurge-constant-3)", () => {
    const { state, id: skurge } = minionInPlay(helaGame(), "21144");
    expect(inst(state, skurge).engagedWith).toBe(state.firstPlayerId);
    // The keyword grant itself, live: a minion's own attack is engine/AI-driven (no direct "attack as this minion"
    // player command exists to drive one deterministically without full villain-phase AI scaffolding), so — the same
    // trade-off `gmw/band-of-badoon.test.ts`'s own Badoon Assassin boost test makes for exactly this shape — the
    // compiled grant is asserted directly: `gainsKeyword`'s own `keywordGrants` entry, unconditional and on `self`.
    expect(keywordGrantsOf("21144.skurge-constant-2")).toEqual([
      { keyword: { name: "piercing" }, target: { self: true } },
    ]);

    const { state: withGjallerbru, id: gjallerbru } = sideSchemeInPlay(state, "21142");
    const withThreat = heroForm(withGjallerbru);
    const attempted = settle(
      runWave4(withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(withThreat, P1),
        schemeInstanceId: gjallerbru,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(attempted, gjallerbru).threat).toBe(5); // unchanged: threat cannot be removed from Gjallerbru
  });
});

describe("Nidhogg (21145)", () => {
  it("engages the first player, its attacks gain overkill, and threat cannot be removed from Hall of Nastrond (21145.nidhogg-constant, 21145.nidhogg-constant-2, 21145.nidhogg-constant-3)", () => {
    const { state, id: nidhogg } = minionInPlay(helaGame(), "21145");
    expect(inst(state, nidhogg).engagedWith).toBe(state.firstPlayerId);
    expect(keywordGrantsOf("21145.nidhogg-constant-2")).toEqual([
      { keyword: { name: "overkill" }, target: { self: true } },
    ]);

    const { state: withNastrond, id: hallOfNastrond } = sideSchemeInPlay(state, "21141");
    const withThreat = heroForm(withNastrond);
    const attempted = settle(
      runWave4(withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(withThreat, P1),
        schemeInstanceId: hallOfNastrond,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(attempted, hallOfNastrond).threat).toBe(5); // unchanged: threat cannot be removed from Hall of Nastrond
  });
});

describe("Hela's attachments (21146-21148)", () => {
  it("Nightsword: Hela's attacks gain piercing (21146.nightsword-constant)", () => {
    expect(keywordGrantsOf("21146.nightsword-constant")[0]?.keyword.name).toBe("piercing");
  });

  it("Nightsword: [star] Boost attaches it to Hela (21146.boost)", () => {
    // A boost card's own resolution needs a live attack/scheme activation in progress (engine/AI-driven, no direct
    // player command) — the same trade-off `ebony-maw.test.ts`'s own "21089.boost" test makes for a data-shape
    // assertion. The compiled effect is exact and simple enough to assert directly.
    expect(WAVE4_DEPS.abilities["21146.boost"]!.effects).toEqual([
      { kind: "attach", card: { kind: "self" }, to: { kind: "villain" } },
    ]);
  });

  it("Hela's Crown: Forced Response, after Hela schemes, gives her a facedown boost card (21147.helas-crown-forced-response)", () => {
    // A villain's own scheme activation is engine/AI-driven during the villain phase (no direct player command
    // triggers one deterministically without full villain-phase AI scaffolding — the same trade-off the Skurge/
    // Nidhogg attack-keyword tests above make). The trigger pattern and effect are asserted directly instead: "After
    // [host, i.e. Hela] schemes" → `giveBoostCard()`, defaulting to the villain (Hela's own only possible host).
    const ability = WAVE4_DEPS.abilities["21147.helas-crown-forced-response"]!;
    expect(ability.trigger).toMatchObject({
      kind: "response",
      forced: true,
      on: { on: "enemyScheme", sourceIs: { hostOfSelf: true } },
    });
    expect(ability.effects).toEqual([{ kind: "giveBoostCard", enemy: { kind: "villain" } }]);
  });

  it("Hela's Crown: [star] Boost attaches it to Hela (21147.boost)", () => {
    expect(WAVE4_DEPS.abilities["21147.boost"]!.effects).toEqual([
      { kind: "attach", card: { kind: "self" }, to: { kind: "villain" } },
    ]);
  });

  it("Hela's Cloak: Hela gains stalwart (21148.helas-cloak-constant)", () => {
    expect(keywordGrantsOf("21148.helas-cloak-constant")[0]?.keyword.name).toBe("stalwart");
  });

  it("Hela's Cloak: [star] Boost attaches it to Hela (21148.boost)", () => {
    expect(WAVE4_DEPS.abilities["21148.boost"]!.effects).toEqual([
      { kind: "attach", card: { kind: "self" }, to: { kind: "villain" } },
    ]);
  });
});

describe("Hela's Domain (21149)", () => {
  it("When Revealed: places 1 threat on the main scheme, plus 1 for each side scheme in the victory display (21149.when-revealed)", () => {
    // Unlike Gnipahellir's own threat (side scheme) or the identity's own damage, the *main scheme's* threat this
    // round is also touched by step one's own placement and by Hela's/Garm's own real per-round activation, neither
    // of which this ability's own text is about — the same trade-off the Skurge/Nidhogg attack-keyword tests above
    // make, and `gmw/escape-the-museum.test.ts`'s own "I Have You Now!" test (loose-bounded for the same reason:
    // Collector's own attack lands the same phase). The compiled effect is exact and dynamic-value-free enough
    // (`victoryDisplayCount`, a real `ValueSpec`, not a baked-in number) to assert directly instead.
    expect(WAVE4_DEPS.abilities["21149.when-revealed"]!.effects).toEqual([
      { kind: "placeThreat", amount: { kind: "const", value: 1 }, target: { kind: "mainScheme" } },
      {
        kind: "placeThreat",
        amount: { kind: "victoryDisplayCount", filter: { categories: ["sideScheme"] } },
        target: { kind: "mainScheme" },
      },
    ]);
  });

  it("[star] Boost: if damage from this attack defeats an ally, place 2 threat on the main scheme (21149.boost)", () => {
    // A boost card's own resolution needs a live attack in progress (engine/AI-driven, no direct player command);
    // the same trade-off `wave4/mts/tower-defense.ts`'s own Rain Fire boost test makes. Trigger and shape asserted
    // directly: `atEndOfActivation` guarding a `placeThreat` on "defeated" + "an ally" via `refMatches`.
    const ability = WAVE4_DEPS.abilities["21149.boost"]!;
    expect(ability.trigger.kind).toBe("boost");
    expect(ability.effects).toEqual([
      {
        kind: "atEndOfActivation",
        effects: [
          {
            kind: "if",
            condition: {
              kind: "and",
              of: [
                { kind: "eventResultAtLeast", key: "defeated", amount: 1 },
                { kind: "refMatches", ref: { kind: "eventTarget" }, query: { categories: ["ally"] }, anywhere: true },
              ],
            },
            then: [{ kind: "placeThreat", amount: { kind: "const", value: 2 }, target: { kind: "mainScheme" } }],
          },
        ],
      },
    ]);
  });
});

describe("The Queen of Hel (21150)", () => {
  it("When Revealed (Alter-Ego): Hela schemes, and 1 threat goes on each side scheme (21150.when-revealed-alter-ego)", () => {
    const state = helaGame();
    expect(state.players[0]!.identity.form).toBe("alterEgo");
    const gnipahellir = instancesOf(state, "21140")[0]!;
    const threatBefore = inst(state, gnipahellir).threat;
    const revealed = reveal(state, "21150");
    expect(inst(revealed, gnipahellir).threat).toBe(threatBefore + 1);
  });

  it("When Revealed (Hero): Hela attacks you, and 1 threat goes on each side scheme (21150.when-revealed-hero)", () => {
    const state = heroForm(helaGame());
    const identity = identityOf(state, P1);
    const damageBefore = inst(state, identity).damage;
    const gnipahellir = instancesOf(state, "21140")[0]!;
    const threatBefore = inst(state, gnipahellir).threat;
    const revealed = reveal(state, "21150");
    expect(inst(revealed, identity).damage).toBeGreaterThan(damageBefore); // Hela's own attack landed
    expect(inst(revealed, gnipahellir).threat).toBe(threatBefore + 1);
  });
});

describe("The Wastes of Niffleheim (21151)", () => {
  it("When Revealed: 1 indirect damage, plus 1 for each side scheme in the victory display (21151.when-revealed)", () => {
    const state = helaGame();
    const withVictoryDisplay: GameState = { ...state, victoryDisplay: [instancesOf(state, "21140")[0]!] };
    const identity = identityOf(withVictoryDisplay, P1);
    const damageBefore = inst(withVictoryDisplay, identity).damage;
    const revealed = reveal(withVictoryDisplay, "21151");
    expect(inst(revealed, identity).damage).toBe(damageBefore + 2); // 1 + 1 (one side scheme)
  });

  it("[star] Boost: gains boost icons equal to the number of side schemes in the victory display (21151.boost)", () => {
    expect(WAVE4_DEPS.abilities["21151.boost"]!.effects[0]).toMatchObject({
      kind: "modifyAttack",
      atkBonus: { kind: "victoryDisplayCount", filter: { categories: ["sideScheme"] } },
      threatBonus: { kind: "victoryDisplayCount", filter: { categories: ["sideScheme"] } },
    });
  });
});

describe("the villain/main-scheme interrupt composes with a real scenario game (the full playthrough is `hela-e2e.test.ts`)", () => {
  it("standard mode: Odin never detached, an eventual lethal hit on Hela flips her instead of ending the game", () => {
    const state = helaGame(42);
    const hero = heroForm(state);
    const villain = hero.villains[0]!;
    const before = defeatWithAttack(hero, villain.instanceId);
    expect(before.villains[0]!.side).toBe("B"); // Odin was never detached in this short run — flips instead of dying
    expect(before.outcome).toBeNull();
  });
});
