/**
 * Cell Phone (47019) has another player make a basic attack or thwart, off their own turn (#888 follow-up, from a
 * Discord report by BluefireF5ran): "that player makes a basic attack or thwart with a character they control". The
 * power is the ordinary basic power (`basicPowerBy`, docs/phase7-wave8.md §3.64), so what answers a basic attack or
 * thwart answers this one too, for the player who controls the card that answers:
 *
 * - another player's ally's own Response ("After Spider-Man attacks or thwarts, choose another Web-Warrior character →
 *   ready that character", 27049 / 52022), which names no controller and so may ready the Cell Phone player's hero:
 *   the SP//dr-plays-Spider-Man, Silk-holds-Cell-Phone line of a four-player Silk deck;
 * - an ally's Forced Response (Spider-Ham 31021, "After Spider-Ham attacks or thwarts");
 * - a hero's own interrupts on its basic power (Silk's Spider Claws 52011, "When Silk makes a basic attack"), checked
 *   with Silk choosing herself, the hero side of the "identities that trigger on activation" half of the report.
 */
import { cardId } from "@mc/content";
import { createGame, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { coreScenario } from "./core/setup.js";
import { PLAYABLE_DEPS } from "./playable/index.js";
import { firstLegal, identityOf, inst, P1, P2, patchInstance, playerOf, settle, use } from "./testing/harness.js";
import { picker } from "./testing/qa-bench.js";
import { driveEventsPicking, withForm } from "./testing/staging.js";
import { WAVE9_CARDS } from "./wave9/cards.js";
import { silkSeat } from "./wave9/silk/testing.js";

const DEPS = PLAYABLE_DEPS;
const PHONE = "47019.cell-phone-action";

/** Silk (P1) and She-Hulk (P2) against Rhino, both in hero form, on Silk's turn. */
function table(): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const second = coreScenario("rhino", {
    players: [{ starterDeckId: "core-she-hulk-aggression" }],
    seed: 3,
    modularSetIds: [],
  }).players[0]!;
  const created = createGame({ ...base, requireLegalDecks: false, players: [silkSeat(), second] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const ready = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return withForm(withForm(ready, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
}

/** A deck card of `player`'s relabelled `code` and put straight into their play area (surgery: no cost, no enter-play). */
function inPlay(
  state: GameState,
  player: PlayerId,
  code: string,
  counters: Readonly<Record<string, number>> = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const deck = playerOf(state, player).deck;
  const id = deck[deck.length - 1]!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, cardId: cardId(code), faceup: true, controllerId: player, counters },
      },
    },
  };
}

/** Silk holds a charged Cell Phone and is exhausted; She-Hulk is exhausted too; `allyCode` is She-Hulk's ready ally. */
function board(allyCode: string) {
  const phone = inPlay(table(), P1, "47019", { charge: 3 });
  const ally = inPlay(phone.state, P2, allyCode);
  const silk = identityOf(ally.state, P1);
  const sheHulk = identityOf(ally.state, P2);
  const state = patchInstance(patchInstance(ally.state, silk, { exhausted: true }), sheHulk, { exhausted: true });
  return { state, phone: phone.id, ally: ally.id, silk, sheHulk };
}

const villainDamage = (state: GameState): number => inst(state, state.activeVillainId!).damage;

describe("Cell Phone: the character making the basic power, any player's, gets every answer to it", () => {
  it("She-Hulk's Spider-Man ally attacks on Silk's turn, and his Response readies Silk, another player's hero", () => {
    const b = board("52022");
    const { state: after, events } = driveEventsPicking(
      DEPS,
      b.state,
      picker({ use: ["spider-man-response", `attack:${b.ally}`], target: b.silk }),
      use(P1, b.phone, PHONE),
    );
    expect(inst(after, b.ally).exhausted).toBe(true);
    expect(villainDamage(after)).toBeGreaterThan(0);
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId.includes("52022.spider-man-response"))).toBe(
      true,
    );
    // "Choose another Web-Warrior character" names no controller: Silk, Silk's player's hero, can be readied.
    expect(inst(after, b.silk).exhausted).toBe(false);
  });

  it("Spider-Ham's Forced Response answers his attack made for Silk's Cell Phone", () => {
    const b = board("31021");
    const { events } = driveEventsPicking(
      DEPS,
      b.state,
      picker({ use: [`attack:${b.ally}`] }),
      use(P1, b.phone, PHONE),
    );
    expect(
      events.some((e) => e.type === "abilityResolved" && e.abilityId.includes("31021.spider-ham-forced-response")),
    ).toBe(true);
  });

  it("Silk's own Spider Claws answers her basic attack made through her Cell Phone", () => {
    const phone = inPlay(table(), P1, "47019", { charge: 3 });
    const claws = inPlay(phone.state, P1, "52011");
    const { state: after, events } = driveEventsPicking(
      DEPS,
      claws.state,
      picker({ use: ["spider-claws-interrupt", `attack:${identityOf(claws.state, P1)}`] }),
      use(P1, phone.id, PHONE),
    );
    expect(inst(after, claws.id).exhausted).toBe(true);
    expect(
      events.some((e) => e.type === "abilityResolved" && e.abilityId.includes("52011.spider-claws-interrupt")),
    ).toBe(true);
  });
});
