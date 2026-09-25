import { cardId, MTS_STARTER_DECKS, type AnyCard } from "@mc/content";
import {
  cardsInPlay,
  characterProfile,
  handSize,
  instanceId,
  NO_STATUSES,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
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
  use,
} from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { WAVE4_CARDS, WAVE4_DEPS } from "../index.js";
import { runWave4, startWave4Game } from "../testing.js";
import { adamWarlockScenario, spectrumScenario } from "./support.js";

/**
 * Real-game tests for the campaign cards scripted in `mts-campaign-cards.ts` (`mts` 21180-21193). Every one is
 * added directly via `GameSetupConfig.setAside`, standing in for the campaign's own `putSideSchemeIntoPlay`/
 * `shuffleIntoEncounterDeck`/`grantCard` instructions (`../../campaigns/mts.ts`'s own job to prove end to end,
 * `campaigns/mts.qa.test.ts`) — this file proves each *card's own* text against a real game.
 */

function campaignGame(extra: readonly string[], seed = 1): GameState {
  const config = spectrumScenario("ebony-maw", { seed });
  return startWave4Game({ ...config, setAside: [...(config.setAside ?? []), ...extra.map((c) => cardId(c))] });
}

/**
 * Like `campaignGame`, but for a card that must be *revealed* from the actual encounter deck (Security Breach,
 * Summoned Back — both genuinely `shuffleIntoEncounterDeck`d by the campaign, `../../campaigns/mts.ts`). Built on
 * "hela" rather than "ebony-maw": Ebony Maw's own scenario deck deals extra facedown cards during setup (its Spell
 * environments), which makes staging a plain top-of-deck reveal for one of these cards unreliable; Hela's own
 * setup only removes/reveals encounter-deck cards it names by title (module docblock elsewhere in this repo,
 * `hela.ts`), which never collides with a campaign card added here.
 */
function campaignEncounterGame(extra: readonly string[], seed = 1): GameState {
  const config = spectrumScenario("hela", { seed });
  return startWave4Game({ ...config, encounterDeck: [...config.encounterDeck, ...extra.map((c) => cardId(c))] });
}

/** The one instance of `code` sitting in the shared `encounterSetAside` pool (`GameSetupConfig.setAside`'s home). */
function fromSetAside(state: GameState, code: string): InstanceId {
  const wanted = cardId(code);
  const id = state.encounterSetAside.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in encounterSetAside`);
  return id;
}

/** Moves a set-aside `code` into the villain area as a side scheme (with `threat`), the way `putIntoPlay` would. */
function schemeInPlay(
  state: GameState,
  code: string,
  threat = 1,
): { readonly state: GameState; readonly id: InstanceId } {
  const id = fromSetAside(state, code);
  return {
    id,
    state: {
      ...state,
      encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
      villainArea: [...state.villainArea, id],
      gameAreas: state.gameAreas.map((a, i) => (i === 0 ? { ...a, sideSchemeIds: [...a.sideSchemeIds, id] } : a)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, threat, faceup: true } },
    },
  };
}

/** A real ally already in the player's own deck, straight into their play area under their control. */
function allyInPlay(state: GameState, player: PlayerId): { readonly state: GameState; readonly id: InstanceId } {
  const starter = MTS_STARTER_DECKS.find((d) => (d.id as string) === "spectrum-leadership")!;
  const byId = new Map(WAVE4_CARDS.map((c) => [c.id as string, c]));
  const allyIds = new Set(
    starter.cards.map((c) => c.cardId as string).filter((id) => (byId.get(id) as AnyCard | undefined)?.type === "ally"),
  );
  const owner = playerOf(state, player);
  const used = new Set(owner.playArea);
  const id = owner.deck.find((i) => allyIds.has(state.instances[i]?.cardId as string) && !used.has(i));
  if (!id) throw new Error("no distinct ally left in deck to place in play");
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, controllerId: player, faceup: true } },
    },
  };
}

const heroForm = (state: GameState, player: PlayerId = P1): GameState =>
  settle(runWave4(state, toHero(player)), firstLegal, undefined, WAVE4_DEPS);

/** Sets `id`'s threat low, then thwarts it away with the player's identity (switched to hero form first — only a
 * hero form may attack or thwart) — a real `basicThwart`, so the engine's own defeat pipeline (When Defeated
 * included) runs normally. */
function defeatScheme(state: GameState, id: InstanceId, player: PlayerId = P1): GameState {
  const near = patchInstance(heroForm(state, player), id, { threat: 1 });
  const identity = identityOf(near, player);
  return settle(
    runWave4(near, { type: "basicThwart", playerId: player, thwarterInstanceId: identity, schemeInstanceId: id }),
    firstLegal,
    undefined,
    WAVE4_DEPS,
  );
}

describe("Secure the Landing Pad (21180a) / Cosmo (21180b)", () => {
  it("flips into Cosmo, controlled by the first player, on defeat (21180a.when-defeated, 21180b.cosmo-constant: covered by the engine's own flip-controller default)", () => {
    const base = campaignGame(["21180a"]);
    const staged = schemeInPlay(base, "21180a");
    expect(base.firstPlayerId).toBe(P1);
    const defeated = defeatScheme(staged.state, staged.id);
    expect(cardsInPlay(defeated)).toContain(staged.id);
    expect(inst(defeated, staged.id).cardId).toBe(cardId("21180b"));
    // "The first player gains control of Cosmo" (21180b.cosmo-constant, coveredByEngineRule): a side scheme's own
    // When Defeated has no ability controller, so `apply-effect.ts`'s `flipCard` case resolves the new face's
    // controller to `ctx.state.firstPlayerId` by construction (`other-face.ts`'s own doc comment).
    expect(inst(defeated, staged.id).controllerId).toBe(base.firstPlayerId);
  });

  it("does not count against the ally limit (21180b.cosmo-constant-2)", () => {
    const base = campaignGame(["21180a"]);
    const a1 = allyInPlay(base, P1);
    const a2 = allyInPlay(a1.state, P1);
    const a3 = allyInPlay(a2.state, P1);
    const staged = schemeInPlay(a3.state, "21180a");
    const beforePlayArea = playerOf(staged.state, P1).playArea.length;
    const defeated = defeatScheme(staged.state, staged.id);
    // Three real allies plus Cosmo (a fourth, entering after them): no forced "discard down to the ally limit"
    // prompt appeared, and all four (plus whatever was already there) remain.
    expect(playerOf(defeated, P1).playArea).toHaveLength(beforePlayArea + 1);
    expect(playerOf(defeated, P1).playArea).toEqual(expect.arrayContaining([a1.id, a2.id, a3.id, staged.id]));
    expect(defeated.pendingChoice).toBeNull();
  });

  it("leaving play removes him from the game, not the discard pile (21180b.cosmo-forced-interrupt: covered by the engine's own double-sided-card rule)", () => {
    // A real "hela" game (not "ebony-maw"), so a real minion (Garm, already engaged with the first player from
    // Hela's own setup) exists to attack Cosmo (a friendly ally is never a legal `basicAttack` target, so his own
    // defeat has to come from declaring him as a defender against an enemy attack, the same shape `hela.test.ts`'s
    // own Odin test uses) — merged with 21180a the same way the Find the Norn Stones test above merges Hela's own
    // game with a set-aside campaign card.
    const withSchemeCard = campaignGame(["21180a"]);
    const schemeId = fromSetAside(withSchemeCard, "21180a");
    const game = startWave4Game(spectrumScenario("hela", { seed: 1 }));
    const merged: GameState = {
      ...game,
      encounterSetAside: [...game.encounterSetAside, schemeId],
      instances: { ...game.instances, [schemeId]: withSchemeCard.instances[schemeId]! },
    };
    const staged = schemeInPlay(merged, "21180a");
    const defeated = defeatScheme(staged.state, staged.id);
    const cosmo = staged.id;
    expect(inst(defeated, cosmo).cardId).toBe(cardId("21180b")); // flipped, and now controlled by P1
    // `defeatScheme` already put P1 into hero form (a real `changeForm` this round, so a second one would be
    // rejected) — 2 of Cosmo's 3 hit points already spent: Garm's own 2 ATK finishes him off as a declared defender.
    const wounded = patchInstance(defeated, cosmo, { damage: 2 });
    const pick = (s: GameState) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "declareDefender" && choice.options.some((o) => o.optionId === cosmo)) return [cosmo];
      return firstLegal(s);
    };
    const after = settle(runWave4(wounded, { type: "endTurn", playerId: P1 }), pick, undefined, WAVE4_DEPS);
    expect(after.removedFromGame).toContain(cosmo);
    expect(playerOf(after, P1).discard).not.toContain(cosmo);
  });
});

describe("Security Breach (21181)", () => {
  it("When Revealed: each player places a random card from their hand facedown here (21181.when-revealed)", () => {
    const state = campaignEncounterGame(["21181"]);
    const handBefore = playerOf(state, P1).hand.length;
    // "01186" filler absorbs the villain's own unconditional boost draw (`staging.ts`'s own documented trap), so
    // 21181 is dealt to the first player as their own reveal instead.
    const staged = stackEncounterDeck(state, "01186", "21181");
    const { state: revealed } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    const scheme = instancesOf(revealed, "21181").find((id) => revealed.villainArea.includes(id))!;
    expect(revealed.villainArea).toContain(scheme);
    expect(playerOf(revealed, P1).hand.length).toBe(handBefore - 1);
    expect(inst(revealed, scheme).tucked).toHaveLength(1);
    const [tuckedCard] = inst(revealed, scheme).tucked;
    expect(playerOf(revealed, P1).hand).not.toContain(tuckedCard);
  });

  it("When Defeated: returns each facedown card here to its owner's hand (21181.when-defeated)", () => {
    const base = campaignGame(["21181"]);
    const staged = schemeInPlay(base, "21181");
    const [tuckedCard] = playerOf(staged.state, P1).hand;
    if (!tuckedCard) throw new Error("expected at least one hand card to tuck");
    const withTucked = patchInstance(
      {
        ...staged.state,
        players: staged.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.slice(1) } : p)),
      },
      staged.id,
      { tucked: [tuckedCard] },
    );
    const handBefore = playerOf(withTucked, P1).hand.length;
    const defeated = defeatScheme(withTucked, staged.id);
    expect(inst(defeated, staged.id).tucked).toHaveLength(0);
    expect(playerOf(defeated, P1).hand.length).toBe(handBefore + 1);
    expect(playerOf(defeated, P1).hand).toContain(tuckedCard);
  });
});

describe("Save the Shawarma Place (21182a) / Black Swan (21182b)", () => {
  it("on defeat, shuffles Shawarma into the player's deck, then flips into Black Swan (21182a.when-defeated)", () => {
    const base = campaignGame(["21182a", "21183"]);
    const staged = schemeInPlay(base, "21182a");
    const defeated = defeatScheme(staged.state, staged.id);
    expect(inst(defeated, staged.id).cardId).toBe(cardId("21182b"));
    const shawarma = defeated.encounterSetAside.find((i) => defeated.instances[i]?.cardId === cardId("21183"));
    expect(shawarma).toBeUndefined();
    const inDeck = playerOf(defeated, P1).deck.some((i) => defeated.instances[i]?.cardId === cardId("21183"));
    expect(inDeck).toBe(true);
  });

  it("engages the first player, and discards a hand card in response (21182b.black-swan-constant: covered by the engine's own flip-controller default, 21182b.black-swan-forced-response)", () => {
    const base = campaignGame(["21182a", "21183"]);
    const staged = schemeInPlay(base, "21182a");
    expect(base.firstPlayerId).toBe(P1);
    const handBefore = playerOf(heroForm(staged.state, P1), P1).hand.length;
    const defeated = defeatScheme(staged.state, staged.id);
    // "Black Swan engages the first player" (21182b.black-swan-constant, coveredByEngineRule): the same
    // `ctx.state.firstPlayerId` default `flipCard` resolves for a flip with no ability controller, feeding the
    // newly-minion-typed face's own `engagedEvent` push (`other-face.ts`).
    expect(inst(defeated, staged.id).engagedWith).toBe(base.firstPlayerId);
    expect(playerOf(defeated, P1).hand.length).toBe(handBefore - 1);
  });
});

describe("Hack Sanctuary's Computer (21184a) / Defensive Protocols (21184b)", () => {
  it("on defeat, tutors 1 card from deck/discard to hand and flips into Defensive Protocols (21184a.when-defeated)", () => {
    const base = campaignGame(["21184a"]);
    const before = playerOf(base, P1);
    const handBefore = before.hand.length;
    const poolBefore = before.deck.length + before.discard.length;
    const staged = schemeInPlay(base, "21184a");
    const defeated = defeatScheme(staged.state, staged.id, P1);
    expect(inst(defeated, staged.id).cardId).toBe(cardId("21184b"));
    const after = playerOf(defeated, P1);
    expect(after.hand.length).toBe(handBefore + 1);
    expect(after.deck.length + after.discard.length).toBe(poolBefore - 1);
  });

  it("counts crash counters to 2, then grants System Shock to hand and removes itself (21184b.defensive-protocols-forced-interrupt)", () => {
    const base = campaignGame(["21184b", "21185"]);
    const staged = schemeInPlay(base, "21184b");
    const round1 = settle(runWave4(staged.state, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(inst(round1, staged.id)?.counters.crash).toBe(1);
    // Two full player-phase-ending interrupts have now added 2 crash counters worth of hand cards on top of a full
    // round's own draw — enough to exceed hand size, so the *end-of-round* hand-size cleanup (a real, separate RRG
    // rule, `firstLegal`'s own auto-discard) can discard the very card just granted in the same settle. That later
    // cleanup is not this card's own text, so the grant is asserted from the event log at the moment it happens,
    // not from the hand's own state after the whole round (including that cleanup) has finished settling.
    const { state: round2, events } = driveEvents(WAVE4_DEPS, round1, { type: "endTurn", playerId: P1 });
    expect(round2.removedFromGame).toContain(staged.id);
    const systemShockId = Object.values(round2.instances).find((i) => i?.cardId === cardId("21185"))!.instanceId;
    expect(events).toContainEqual({
      type: "cardMoved",
      instanceId: systemShockId,
      cardId: cardId("21185"),
      from: { kind: "encounterSetAside" },
      to: { kind: "hand", playerId: P1 },
    });
  });
});

describe("System Shock (21185)", () => {
  it("Alter-Ego Action spends a [mental] resource to remove itself from the game (21185.system-shock-action)", () => {
    const base = campaignGame(["21185"]); // players start in alter-ego form
    const shock = cardInHand(base, "21185");
    const paidWith = mentalCardInHand(shock.state, P1);
    const used = settle(
      runWave4(paidWith.state, use(P1, shock.id, "21185.system-shock-action", [{ fromHand: paidWith.id }])),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(used.removedFromGame).toContain(shock.id);
    expect(playerOf(used, P1).hand).not.toContain(shock.id);
  });

  it("cannot be chosen for the end-of-round 'discard down to hand size' step, even with an over-limit hand (21185.system-shock-constant)", () => {
    const base = campaignGame(["21185"]);
    const shock = cardInHand(base, "21185");
    const limit = handSize(shock.state, P1, WAVE4_DEPS);
    const overfull = overfillHand(shock.state, P1, limit);
    expect(playerOf(overfull, P1).hand.length).toBeGreaterThan(limit);
    const afterDiscard = settle(
      runWave4(overfull, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(afterDiscard, P1).hand).toContain(shock.id);
  });
});

describe("Find the Norn Stones (21186a) / Retrieve Odin's Armor (21186b)", () => {
  it("threat cannot be removed while Hela is not Wounded, but can once she is (21186a.find-the-norn-stones-constant)", () => {
    // A real "hela" game (not "ebony-maw"): Hela's own Wounded trait is read off `VillainState.side` (`select.ts`'s
    // `printedTraitsOf`, which only reads `villainStageOf` for a real, tracked villain — a raw injected instance
    // has no `VillainState` entry and would never read as Wounded, however its `flipped` field is patched).
    const game = heroForm(startWave4Game(spectrumScenario("hela", { seed: 1 })));
    const withSchemeCard = campaignGame(["21186a"]);
    const schemeId = fromSetAside(withSchemeCard, "21186a");
    const merged: GameState = {
      ...game,
      encounterSetAside: [...game.encounterSetAside, schemeId],
      instances: { ...game.instances, [schemeId]: withSchemeCard.instances[schemeId]! },
    };
    const staged = schemeInPlay(merged, "21186a", 5);
    const identity = identityOf(staged.state, P1);
    const blocked = settle(
      runWave4(staged.state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: staged.id,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // Hela's Mystic (side A, un-Wounded) is in play — the "unless Wounded" gate holds threat at 5.
    expect(inst(blocked, staged.id).threat).toBe(5);

    const woundedHela: GameState = {
      ...staged.state,
      villains: staged.state.villains.map((v) => ({ ...v, side: "B" as const })),
    };
    const allowed = settle(
      runWave4(woundedHela, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(woundedHela, P1),
        schemeInstanceId: staged.id,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // Wounded (side B) now: the gate lifts, and a real thwart removes threat normally.
    expect(inst(allowed, staged.id).threat).toBeLessThan(5);
  });

  it("on defeat, grants each player a Norn Stone on its Setup side, then flips to Retrieve Odin's Armor (21186a.when-defeated)", () => {
    const withSchemeCard = campaignGame(["21186a", "21187a"]);
    const schemeId = fromSetAside(withSchemeCard, "21186a");
    const nornStoneId = fromSetAside(withSchemeCard, "21187a");
    const game = startWave4Game(spectrumScenario("hela", { seed: 1 }));
    const merged: GameState = {
      ...game,
      encounterSetAside: [...game.encounterSetAside, schemeId, nornStoneId],
      instances: {
        ...game.instances,
        [schemeId]: withSchemeCard.instances[schemeId]!,
        [nornStoneId]: withSchemeCard.instances[nornStoneId]!,
      },
    };
    const staged = schemeInPlay(merged, "21186a");
    // 21186a's own gate needs Hela Wounded (side B) for a real thwart to defeat it.
    const woundedHela: GameState = {
      ...staged.state,
      villains: staged.state.villains.map((v) => ({ ...v, side: "B" as const })),
    };
    const defeated = defeatScheme(woundedHela, staged.id);
    expect(inst(defeated, staged.id).cardId).toBe(cardId("21186b"));
    const nornStone = playerOf(defeated, P1).playArea.find((i) => defeated.instances[i]?.cardId === cardId("21187a"));
    expect(nornStone).toBeDefined();
  });

  it("threat cannot be removed unless the first player controls Odin (21186b.retrieve-odins-armor-constant)", () => {
    const base = heroForm(campaignGame(["21186b"]));
    const staged = schemeInPlay(base, "21186b", 5);
    const identity = identityOf(staged.state, P1);
    const blocked = settle(
      runWave4(staged.state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: staged.id,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(blocked, staged.id).threat).toBe(5);
  });

  it("on defeat, heals Odin and flips him to his King side (21186b.when-defeated)", () => {
    const base = campaignGame(["21186b", "21139a"]);
    // Odin must actually be "in play" (the first player's own play area, not the shared villain area) for
    // `flipCard` to find him (`cardsInPlay`'s own ally check reads a player's `playArea`).
    const odin = upgradeInPlay(base, "21139a", P1);
    const damaged = patchInstance(odin.state, odin.id, { damage: 2 });
    const staged = schemeInPlay(damaged, "21186b");
    const defeated = defeatScheme(staged.state, staged.id);
    expect(inst(defeated, odin.id).damage).toBe(0);
    // Odin (21139a) is a single card with an inline flip side (like Hela and Norn Stone), not a separately emitted
    // otherFaceId pair: flipping toggles `flipped`, not `cardId` (`hela.ts`'s own "21139a"/"21139b" ref-prefix
    // naming names the two *faces* of one card, the same convention Norn Stone's "21187a"/"21187b" uses).
    expect(inst(defeated, odin.id).flipped).toBe(true);
  });
});

/** Moves a set-aside `code` (a player upgrade) into `player`'s own play area under their control. */
function upgradeInPlay(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const id = fromSetAside(state, code);
  return {
    id,
    state: {
      ...state,
      encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, ownerId: player, controllerId: player, faceup: true },
      },
    },
  };
}

/** A card in `player`'s hand printing a [physical] resource icon (any type; RRG "Resource"), for a real `spend`
 * cost. Data-driven, so it works regardless of which starter deck seeded the game. */
function physicalCardInHand(state: GameState, player: PlayerId): InstanceId {
  const byId = new Map(WAVE4_CARDS.map((c) => [c.id as string, c]));
  const id = playerOf(state, player).hand.find((i) => {
    const card = byId.get(state.instances[i]?.cardId as string) as
      | { readonly resourceIcons?: Readonly<Record<string, number>> }
      | undefined;
    return (card?.resourceIcons?.physical ?? 0) > 0;
  });
  if (!id) throw new Error(`${player} has no physical-resource card in hand`);
  return id;
}

/** Same as `physicalCardInHand`, but for a printed [mental] resource icon (System Shock's own spend cost) — and,
 * unlike `physicalCardInHand`, pulled from the deck into hand if the opening hand doesn't happen to have one
 * (Spectrum's Leadership starter deck doesn't reliably draw one at this seed). */
function mentalCardInHand(state: GameState, player: PlayerId): { readonly state: GameState; readonly id: InstanceId } {
  const byId = new Map(WAVE4_CARDS.map((c) => [c.id as string, c]));
  const isMental = (i: InstanceId): boolean => {
    const card = byId.get(state.instances[i]?.cardId as string) as
      | { readonly resourceIcons?: Readonly<Record<string, number>> }
      | undefined;
    return (card?.resourceIcons?.mental ?? 0) > 0;
  };
  const owner = playerOf(state, player);
  const inHand = owner.hand.find(isMental);
  if (inHand) return { state, id: inHand };
  const fromDeck = owner.deck.find(isMental);
  if (!fromDeck) throw new Error(`${player} has no mental-resource card in hand or deck`);
  return {
    id: fromDeck,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== fromDeck), hand: [...p.hand, fromDeck] } : p,
      ),
    },
  };
}

/** Moves a set-aside `code` into `player`'s own hand — System Shock's own home, unlike every other obligation
 * (module docblock: RRG 1.8 "Obligation", p. 30's play-area default is overridden by this card's printed text). */
function cardInHand(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const id = fromSetAside(state, code);
  return {
    id,
    state: {
      ...state,
      encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
      players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [...p.hand, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, ownerId: player, controllerId: player, faceup: true },
      },
    },
  };
}

/** Moves `extra` cards from the top of `player`'s deck into their hand — enough to force the end-of-round "discard
 * down to hand size" choice regardless of the starter deck's own draws. */
function overfillHand(state: GameState, player: PlayerId, extra: number): GameState {
  const moved = playerOf(state, player).deck.slice(0, extra);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: [...p.hand, ...moved], deck: p.deck.slice(extra) } : p,
    ),
  };
}

describe("Norn Stone (21187a front / 21187b back)", () => {
  it("Hero Action readies your hero and flips it to the back face (21187a.norn-stone-constant, 21187a.norn-stone-action)", () => {
    const base = heroForm(campaignGame(["21187a"]));
    const stone = upgradeInPlay(base, "21187a", P1);
    const identity = identityOf(stone.state, P1);
    const exhausted = patchInstance(stone.state, identity, { exhausted: true });
    const used = settle(
      runWave4(exhausted, use(P1, stone.id, "21187a.norn-stone-action")),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(used, identity).exhausted).toBe(false);
    // Norn Stone is a single card with an inline flip side (like Hela, unlike the campaign's a/b pairs): flipping
    // toggles `flipped`, not `cardId`.
    expect(inst(used, stone.id).flipped).toBe(true);
  });

  it("back face: Alter-Ego Action exhausts Norn Stone to heal 1 damage from your identity (21187b.norn-stone-constant, 21187b.norn-stone-action)", () => {
    const base = campaignGame(["21187a"]); // players start in alter-ego form
    const front = upgradeInPlay(base, "21187a", P1);
    const flipped = patchInstance(front.state, front.id, { flipped: true });
    const identity = identityOf(flipped, P1);
    const damaged = patchInstance(flipped, identity, { damage: 2 });
    const used = settle(
      runWave4(damaged, use(P1, front.id, "21187b.norn-stone-action")),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(used, identity).damage).toBe(1);
    expect(inst(used, front.id).exhausted).toBe(true);
  });
});

describe("Summoned Back (21188)", () => {
  it("When Revealed searches for the revealer's own nemesis minion and puts it into play engaged with them (21188.when-revealed)", () => {
    // Adam Warlock, not Spectrum: `nemesisMinionOf` requires the card data's own `nemesisMinion: true` flag
    // (`select.ts`), which only a *multi*-card nemesis set's disambiguating parenthetical carries (RRG 1.8 "Nemesis
    // Encounter Set", p. 30). Spectrum's own nemesis set (`spectrum_nemesis`) has just one minion (Radioactive
    // Man, 21027) and so prints no such parenthetical — the same real-card data-completeness gap `toafk/kang.ts`'s
    // own 11013b test already names for Hawkeye's single-minion Crossfire set — while Adam Warlock's own nemesis
    // set (`warlock_nemesis`) has several cards and so does flag its one minion, The Magus (21067,
    // `nemesisMinion: true`).
    const config = adamWarlockScenario("hela", { seed: 1 });
    const state = startWave4Game({ ...config, encounterDeck: [...config.encounterDeck, cardId("21188")] });
    const theMagus = playerOf(state, P1).setAside.find((i) => state.instances[i]?.cardId === cardId("21067"))!;
    expect(theMagus).toBeDefined();
    // "01186" filler absorbs the villain's own unconditional boost draw (`staging.ts`'s own documented trap), so
    // 21188 is dealt to the first player as their own reveal instead.
    const staged = stackEncounterDeck(state, "01186", "21188");
    const { state: revealed, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(playerOf(revealed, P1).setAside).not.toContain(theMagus);
    expect(cardsInPlay(revealed)).toContain(theMagus);
    expect(inst(revealed, theMagus).engagedWith).toBe(P1);
    // "Shuffle the encounter deck": a real `deckShuffled` event fired for the active encounter deck.
    expect(events.some((e) => e.type === "deckShuffled")).toBe(true);
  });
});

/** Attaches a raw Jormungand (21189b) instance to `loki` directly (there is no "attach an encounter card to a
 * villain" player command to drive this through) — the shape both Jormungand tests below need. */
function attachJormungandTo(
  state: GameState,
  loki: InstanceId,
  rawId: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const jormungand = instanceId(rawId);
  return {
    id: jormungand,
    state: {
      ...state,
      instances: {
        ...state.instances,
        [jormungand]: {
          instanceId: jormungand,
          cardId: cardId("21189b"),
          ownerId: null,
          controllerId: null,
          home: { kind: "activeEncounterDeck" },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 0,
          statuses: NO_STATUSES,
          counters: {},
          attachedTo: loki,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
        },
        [loki]: { ...state.instances[loki]!, attachments: [...state.instances[loki]!.attachments, jormungand] },
      },
    },
  };
}

describe("Open the Dungeons (21189a) / Jormungand (21189b)", () => {
  it("on defeat, each player chooses a Captive ally and puts it into play; the scheme flips (21189a.when-defeated)", () => {
    const base = campaignGame(["21189a", "21190", "21191", "21192", "21193"]);
    const staged = schemeInPlay(base, "21189a");
    const defeated = defeatScheme(staged.state, staged.id);
    expect(inst(defeated, staged.id).cardId).toBe(cardId("21189b"));
    const captiveIds = new Set([cardId("21190"), cardId("21191"), cardId("21192"), cardId("21193")]);
    const gained = playerOf(defeated, P1).playArea.filter((i) => captiveIds.has(defeated.instances[i]!.cardId));
    expect(gained).toHaveLength(1);
  });

  it("[star] grants Loki +4[per_hero] hit points while attached (21189b.jormungand-constant)", () => {
    // A real "loki" game (not "ebony-maw"), so Loki exists as a properly-tracked villain instance `characterProfile`
    // can read a real `maxHp` for (a raw injected instance has no `VillainState` entry).
    const base = heroForm(startWave4Game(spectrumScenario("loki", { seed: 1 })));
    const loki = cardsInPlay(base).find(
      (i) => base.instances[i]?.cardId && `${base.instances[i]?.cardId}`.startsWith("2116"),
    )!;
    const before = characterProfile(base, loki, WAVE4_DEPS)!;
    const { state: attached } = attachJormungandTo(base, loki, "test-jormungand-hp");
    const after = characterProfile(attached, loki, WAVE4_DEPS)!;
    // 1 player in this game (`spectrumScenario`'s own single Spectrum seat): perHero(4) is +4.
    expect(after.maxHp - before.maxHp).toBe(4);
  });

  it("attaches to Loki, and is removed from the game (not discarded) when Loki is defeated (21189b.jormungand-forced-interrupt)", () => {
    // A real "loki" game (not "ebony-maw"), so Loki exists as a properly-tracked villain instance a real
    // `basicAttack` can target (a raw injected instance has no `VillainState` entry to make that legal).
    const base = heroForm(startWave4Game(spectrumScenario("loki", { seed: 1 })));
    const loki = cardsInPlay(base).find(
      (i) => base.instances[i]?.cardId && `${base.instances[i]?.cardId}`.startsWith("2116"),
    )!;
    const { state: attached, id: jormungand } = attachJormungandTo(base, loki, "test-jormungand");
    const identity = identityOf(attached, P1);
    const nearDeath = patchInstance(attached, loki, { damage: 999 });
    const defeated = settle(
      runWave4(nearDeath, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: loki }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(defeated.removedFromGame).toContain(jormungand);
    expect(playerOf(defeated, P1).discard).not.toContain(jormungand);
  });
});

describe("Lady Sif (21190)", () => {
  it("Action: spend a [physical] resource to ready Lady Sif", () => {
    const base = campaignGame(["21190"]);
    const sif = upgradeInPlay(base, "21190", P1);
    const exhausted = patchInstance(sif.state, sif.id, { exhausted: true });
    const paidWith = physicalCardInHand(exhausted, P1);
    const used = settle(
      runWave4(exhausted, use(P1, sif.id, "21190.lady-sif-action", [{ fromHand: paidWith }])),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(used, sif.id).exhausted).toBe(false);
  });
});

describe("Fandral (21191)", () => {
  it("[star] ignores crisis icons on his basic THW", () => {
    const ability = WAVE4_DEPS.abilities["21191.fandral-constant"]!;
    expect(ability.trigger.kind).toBe("constant");
    expect(ability.trigger.kind === "constant" ? ability.trigger.rules : undefined).toEqual([
      { kind: "characterIgnores", target: { self: true }, ignores: ["crisis"] },
    ]);
  });
});

describe("Hogun (21192)", () => {
  it("[star] his attacks gain piercing", () => {
    const ability = WAVE4_DEPS.abilities["21192.hogun-constant"]!;
    expect(ability.trigger.kind).toBe("constant");
    expect(ability.trigger.kind === "constant" ? ability.trigger.keywordGrants : undefined).toEqual([
      { keyword: { name: "piercing" }, target: { self: true } },
    ]);
  });
});
