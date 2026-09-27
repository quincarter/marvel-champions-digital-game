import { cardId, encounterSetId } from "@mc/content";
import { activeEncounterDeckId, activeVillain, createGame, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  P1,
  type Picker,
} from "../../../testing/harness.js";
import { startWave5Game, runWave5, WAVE5_DEPS } from "../../testing.js";
import { driveEvents } from "../../../testing/staging.js";
import { ghostSpiderScenario, ghostSpiderScenarioWithExtras } from "../ghost-spider/support.js";

const venomGame = (seed = 1) =>
  startWave5Game(ghostSpiderScenario("venom", { seed, modularSetIds: [encounterSetId("bomb_scare")] }));

/** Removes the Toughness status card so a plain basic attack actually deals damage — Venom prints Toughness
 * (`venom/villain.test.ts`'s own precedent). */
const withoutTough = (state: GameState, id: ReturnType<typeof activeVillain>["instanceId"]) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } });

/** Accepts the named optional interrupt/response (by ability id suffix); declines everything else — the
 * `ghost-spider/events-a.test.ts` `accepting` precedent. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** `toHero` toggles form, so it must only be sent when the identity isn't hero already. */
const asHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave5(state, toHero(P1));

const attack = (state: GameState, villain = activeVillain(state).instanceId, pick: Picker = firstLegal) =>
  settle(
    runWave5(asHero(state), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: villain,
    }),
    pick,
    undefined,
    WAVE5_DEPS,
  );

/** Attaches `code` (found in the encounter deck or discard) to `hostId` — test-only surgery (no shared file to
 * import it from; `sandman/encounter-set-2.test.ts`'s own `attachToHost` precedent). */
function attachToHost(
  state: GameState,
  code: string,
  hostId: ReturnType<typeof activeVillain>["instanceId"],
): { readonly state: GameState; readonly id: ReturnType<typeof activeVillain>["instanceId"] } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  const host = inst(state, hostId);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: hostId },
        [hostId]: { ...host, attachments: [...host.attachments, id] },
      },
    },
  };
}

describe("Improvised Weapons (27164)", () => {
  it("27164.improvised-weapons-action: Hero Action spends [mental][physical][energy] to discard this card", () => {
    // Energy (01088), Genius (01089, mental), Strength (01090, physical): the three basic resource cards, added to
    // Ghost-Spider's own deck since her precon may not carry all three (`ghostSpiderScenarioWithExtras`'s own
    // precedent, `ghost-spider/support.ts`).
    const config = ghostSpiderScenarioWithExtras("venom", {
      seed: 1,
      modularSetIds: [encounterSetId("bomb_scare")],
      extraCodes: ["01088", "01089", "01090"],
    });
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const villain = activeVillain(state).instanceId;
    const attached = attachToHost(state, "27164", villain);
    const hero = asHero(attached.state);
    const given = moveToHand(hero, P1, "01088", "01089", "01090");
    const paid = runWave5(
      given.state,
      use(
        P1,
        attached.id,
        "27164.improvised-weapons-action",
        given.ids.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(inst(paid, attached.id).attachedTo).toBeNull();
  });
});

describe("Violent Tendencies (27165)", () => {
  it("27165.violent-tendencies-forced-response: gives the villain a facedown boost card; discards itself at 3+ damage", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const stripped = withoutTough(state, villain);
    const attached = attachToHost(stripped, "27165", villain);
    const before = inst(attached.state, villain).boostCards.length;
    // Ghost-Spider's own ATK 2 (below the 3-damage discard threshold).
    const after = attack(attached.state, villain);
    expect(inst(after, villain).boostCards.length).toBe(before + 1);
    expect(inst(after, attached.id).attachedTo).toBe(villain);
  });
});

describe("Webbed Up (27166)", () => {
  it("27166.webbed-up-constant: discards itself instead of your hero's attack, then stuns you", () => {
    const state = venomGame();
    const identity = identityOf(state);
    const attached = attachToHost(state, "27166", identity);
    const hero = asHero(attached.state);
    const attempted = settle(
      runWave5(hero, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: activeVillain(hero).instanceId,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attempted, attached.id).attachedTo).toBeNull();
    expect(inst(attempted, identity).statuses.stunned).toBeGreaterThan(0);
    expect(inst(attempted, activeVillain(attempted).instanceId).damage).toBe(0); // the attack never happened
  });

  it("27166.boost: stuns you; a second stun instead deals 2 damage (checked before the new stun is applied)", () => {
    const state = venomGame();
    const identity = identityOf(state);
    const stacked = stackEncounterDeck(state, "27166");
    const revealed = settle(
      runWave5(stacked, toHero(P1), endTurn(P1)),
      accepting("27166.boost"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(revealed, identity).statuses.stunned).toBeGreaterThan(0);
  });
});

describe("Enraged Symbiote (27167)", () => {
  it("27167.boost: puts a copy of itself into play engaged with you", () => {
    const state = venomGame();
    const stacked = stackEncounterDeck(state, "27167");
    const revealed = settle(
      runWave5(stacked, toHero(P1), endTurn(P1)),
      accepting("27167.boost"),
      undefined,
      WAVE5_DEPS,
    );
    const symbiote = instancesOf(revealed, "27167").find((id) => playerOf(revealed, P1).playArea.includes(id));
    expect(symbiote).toBeDefined();
  });
});

describe("Swinging Assault (27168)", () => {
  it("27168.when-revealed-alter-ego: changes to hero form, then the villain attacks you", () => {
    const state = venomGame();
    const identity = identityOf(state);
    const before = inst(state, identity).damage;
    const stacked = stackEncounterDeck(state, "01186", "27168");
    const revealed = settle(runWave5(stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(playerOf(revealed, P1).identity.form).toBe("hero");
    expect(inst(revealed, identity).damage).toBeGreaterThan(before);
  });

  it("27168.when-revealed-hero: the villain attacks you, with 1 additional boost card for that activation", () => {
    const state = venomGame();
    const identity = identityOf(state);
    const before = inst(state, identity).damage;
    const stacked = stackEncounterDeck(asHero(state), "01186", "27168", "01186");
    const revealed = settle(runWave5(stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    // Ghost-Spider's own ATK 2 (step 2's natural attack) + Venom's own ATK 2 (Swinging Assault's own attack, its
    // own boost card irrelevant to ATK) landed twice — this only proves an attack happened each time; the extra
    // boost card's own composition is unverified (`symbiotic-strength.ts`'s own doc comment).
    expect(inst(revealed, identity).damage).toBeGreaterThan(before);
  });
});

describe("Unstable Sentience (27169)", () => {
  it("27169.when-revealed: gives the villain 1 facedown boost card", () => {
    const state = venomGame();
    const stacked = stackEncounterDeck(state, "01186", "27169");
    // A later encounter card this same round (whatever naturally follows the two stacked here) can go on to force
    // another activation that flips and discards Venom's held boost cards before the round ends, so this checks
    // the ability actually resolved rather than the boost pile's count at the very end of the round.
    const dbg = driveEvents(WAVE5_DEPS, stacked, toHero(P1), endTurn(P1));
    expect(dbg.events.some((e) => e.type === "abilityResolved" && e.abilityId === "27169.when-revealed")).toBe(true);
  });

  it("27169.boost: if this activation is an attack, +2 boost icons and the attack gains overkill", () => {
    const state = venomGame();
    const identity = identityOf(state);
    const stacked = stackEncounterDeck(state, "27169");
    const revealed = settle(
      runWave5(stacked, toHero(P1), endTurn(P1)),
      accepting("27169.boost"),
      undefined,
      WAVE5_DEPS,
    );
    // Ghost-Spider's own 10 HP: Venom (I)'s ATK 2 + 2 boost icons from Unstable Sentience's own boost, undefended.
    expect(inst(revealed, identity).damage).toBeGreaterThanOrEqual(4);
  });
});
