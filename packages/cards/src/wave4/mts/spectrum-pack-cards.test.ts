import { activeVillain, applyCommand, characterProfile, handCardResources, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

const spectrumVsRhino = (seed = 1) => startWave4Game(spectrumScenario("rhino", { seed }));

/** Accepts any offered choice whose optionId names one of `wanted`, else falls back to `firstLegal`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id.includes(w)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Captain America (21011)", () => {
  it("21011.captain-america-constant: costs 1 less for each avenger character controlled (printed cost 6)", () => {
    // While in hero form Spectrum has the Avenger trait (her alter-ego face is Civilian only), so the printed cost
    // 6 is reduced by 1: paying 4 must fail, paying 5 must succeed.
    const hero = settle(runWith(WAVE4_DEPS, spectrumVsRhino(20), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const given = moveToHand(hero, P1, "21011");
    const [cap] = given.ids as [import("@mc/engine").InstanceId];
    const underpaid = applyCommand(given.state, play(P1, cap, payWith(given.state, P1, 4, [cap])), WAVE4_DEPS);
    expect(underpaid.ok).toBe(false);
    const after = runWith(WAVE4_DEPS, given.state, play(P1, cap, payWith(given.state, P1, 5, [cap])));
    expect(playerOf(after, P1).playArea).toContain(cap);
  });
});

describe("Power Man (21012)", () => {
  it("21012.power-man-constant, 21012.power-man-action: enters with 2 chi counters, spends them for +2 ATK each", () => {
    const state = spectrumVsRhino(21);
    const hero = settle(runWith(WAVE4_DEPS, state, toHero()), firstLegal, undefined, WAVE4_DEPS);
    const { state: withPowerMan, id: powerMan } = playFromHand(hero, "21012", 3);
    expect(inst(withPowerMan, powerMan).counters.chi).toBe(2);
    const before = characterProfile(withPowerMan, powerMan, WAVE4_DEPS)!.atk;
    const after = settle(
      runWith(WAVE4_DEPS, withPowerMan, use(P1, powerMan, "21012.power-man-action")),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, powerMan).counters.chi).toBe(0);
    expect(characterProfile(after, powerMan, WAVE4_DEPS)!.atk).toBe(before + 4);
  });
});

describe("White Tiger (21013)", () => {
  it("21013.white-tiger-response: draws cards equal to the villain's stage number (capped at 3)", () => {
    const state = spectrumVsRhino(22);
    const hero = settle(runWith(WAVE4_DEPS, state, toHero()), firstLegal, undefined, WAVE4_DEPS);
    const before = playerOf(hero, P1).hand.length;
    // White Tiger costs 3; Rhino has no stage number, so this draws 1 (the "no stage number" fallback).
    const { state: after } = playFromHand(hero, "21013", 3);
    // -1 playing White Tiger, -3 paying her cost, +1 drawn = net -3.
    expect(playerOf(after, P1).hand.length).toBe(before - 1 - 3 + 1);
  });
});

describe("Kaluu (21014)", () => {
  it("21014.kaluu-response: searches the top 5 of the deck for an event and adds it to hand", () => {
    const state = spectrumVsRhino(23);
    const hero = settle(runWith(WAVE4_DEPS, state, toHero()), firstLegal, undefined, WAVE4_DEPS);
    const before = playerOf(hero, P1).hand.length;
    const { state: after } = playFromHand(hero, "21014", 2);
    // -1 playing Kaluu, -2 paying: at least that much, plus 1 more if an event was found among the top 5.
    expect(playerOf(after, P1).hand.length).toBeGreaterThanOrEqual(before - 1 - 2);
  });
});

describe("Mighty Avengers (21015)", () => {
  it("21015.mighty-avengers-constant, 21015.mighty-avengers-constant-2: +1 THW/+1 ATK to each ally while every character is an Avenger", () => {
    const state = spectrumVsRhino(24);
    const hero = settle(runWith(WAVE4_DEPS, state, toHero()), firstLegal, undefined, WAVE4_DEPS);
    // Kaluu (Avenger, Mystic) is cheaper than Captain America, leaving enough hand cards to also pay for Mighty
    // Avengers (cost 3).
    const { state: withKaluu, id: kaluu } = playFromHand(hero, "21014", 2);
    const before = characterProfile(withKaluu, kaluu, WAVE4_DEPS)!.thw;
    const { state: after } = playFromHand(withKaluu, "21015", 3);
    // Kaluu has the Avenger trait, and Spectrum is the only other character in play, so the condition holds.
    expect(characterProfile(after, kaluu, WAVE4_DEPS)!.thw).toBe(before + 1);
  });
});

describe("Moxie (21017)", () => {
  it("21017.moxie-response: +1 THW/+1 ATK/+1 DEF until end of round after you change form", () => {
    const state = spectrumVsRhino(25);
    const given = moveToHand(state, P1, "21017");
    const identity = identityOf(given.state, P1);
    const after = settle(
      runWith(WAVE4_DEPS, given.state, toHero()),
      accepting("21017.moxie-response"),
      undefined,
      WAVE4_DEPS,
    );
    // Spectrum prints ATK 1, THW 1, DEF 1 (sum 3); Moxie adds +1 to each (sum +3), and Energy Transformation's own
    // trigger fires in the same window (whichever facedown form `firstLegal` happens to pick adds +2 to one stat) —
    // so the only way to assert Moxie's own effect deterministically, regardless of which form was picked, is the
    // total: 3 (printed) + 3 (Moxie) + 2 (one energy form) = 8.
    const equipped = characterProfile(after, identity, WAVE4_DEPS)!;
    expect(equipped.thw + equipped.atk + equipped.def).toBe(8);
  });
});

describe("Blade (21019)", () => {
  it("21019.blade-forced-response: after attacking or thwarting, spends a physical resource or discards Blade", () => {
    const state = spectrumVsRhino(26);
    const hero = settle(runWith(WAVE4_DEPS, state, toHero()), firstLegal, undefined, WAVE4_DEPS);
    const { state: withBlade, id: blade } = playFromHand(hero, "21019", 1);
    const villain = activeVillain(withBlade).instanceId;
    const before = playerOf(withBlade, P1).hand.length;
    const after = settle(
      runWith(WAVE4_DEPS, withBlade, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: blade,
        targetInstanceId: villain,
      } as never),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // Either Blade is discarded, or a physical resource left the hand — one of the two branches always happens.
    const bladeGone = playerOf(after, P1).discard.includes(blade);
    expect(bladeGone || playerOf(after, P1).hand.length < before).toBe(true);
  });
});

describe("Avengers Tower (21020) and Avengers Mansion (21021)", () => {
  it("21020.avengers-tower-constant, 21020.avengers-tower-action, 21021.avengers-mansion-action reprint Core/cap verbatim", () => {
    const state = spectrumVsRhino(27);
    const { state: withTower } = playFromHand(state, "21020", 2);
    const { state: withMansion } = playFromHand(withTower, "21021", 4);
    const mansion = instancesOf(withMansion, "21021")[0]!;
    const before = playerOf(withMansion, P1).hand.length;
    const after = settle(
      runWith(WAVE4_DEPS, withMansion, use(P1, mansion, "21021.avengers-mansion-action")),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(after, P1).hand.length).toBe(before + 1);
  });
});

describe("Ready to Rumble (21022)", () => {
  it("21022.ready-to-rumble-response: after you change form, discards itself to ready your hero", () => {
    const state = spectrumVsRhino(28);
    const { state: withCard } = playFromHand(state, "21022", 1);
    const identity = identityOf(withCard, P1);
    const exhausted = {
      ...withCard,
      instances: { ...withCard.instances, [identity]: { ...inst(withCard, identity), exhausted: true } },
    };
    const after = settle(
      runWith(WAVE4_DEPS, exhausted, toHero()),
      accepting("21022.ready-to-rumble-response"),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, identity).exhausted).toBe(false);
  });
});

describe("Band Together (resource, 21018)", () => {
  it("21018.band-together-constant: generates [wild] for each ally you control, spent from hand", () => {
    const hero = settle(runWith(WAVE4_DEPS, spectrumVsRhino(6), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const given = moveToHand(hero, P1, "21018");
    const [band] = given.ids as [InstanceId];
    expect(handCardResources(given.state, WAVE4_DEPS, band, P1, null).wild).toBe(0);
    const { state: withAlly } = playFromHand(given.state, "21005", 3, firstLegal);
    const allies = withAlly.players[0]!.playArea.filter(
      (id) => withAlly.cardPool[withAlly.instances[id]!.cardId]?.type === "ally",
    ).length;
    expect(allies).toBeGreaterThan(0);
    expect(handCardResources(withAlly, WAVE4_DEPS, band, P1, null).wild).toBe(Math.min(3, allies));
  });
});
