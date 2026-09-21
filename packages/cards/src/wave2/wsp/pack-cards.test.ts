import type { InstanceId } from "@mc/engine";
import { firstLegal, inst, moveToHand, P1, play, playerOf, settle, type Picker } from "../../testing/harness.js";
import { withDamage } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { playFromHand, runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { WSP_PACK_CARDS } from "./pack-cards.js";

// Real wave 2 content: the Wasp (Aggression) precon against Rhino, standard, solo. Nadia Van Dyne starts in alter-ego.
const waspVsRhino = () =>
  startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "wsp-aggression" }], seed: 2026 }));

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Wasp pack cards", () => {
  it("Thor (Jane Foster): deals 2 damage to the villain when played, 3 if paid with a physical resource (Responses are optional even without 'you may' — `firstLegal` alone would decline it)", () => {
    const start = waspVsRhino();
    const villain = start.villains[0]!.instanceId;
    const { state } = playFromHand(withDamage(start, villain, 0), "13011", 4, accepting("13011.thor-response"));
    expect(inst(state, villain).damage).toBeGreaterThanOrEqual(2);
  });

  it("Ironheart: draws 1 card when played from hand", () => {
    const start = waspVsRhino();
    const before = playerOf(start, P1).hand.length;
    const { state } = playFromHand(start, "13018", 2, accepting("13018.ironheart-response"));
    // Relative to the hand *before* Ironheart was even moved into it: +1 (moved to hand), -1 (played), -2 (its own
    // resource payment), +1 (the draw) — net -1.
    expect(playerOf(state, P1).hand.length).toBe(before - 1);
  });

  it("Wasp (Janet Van Dyne, ally): gets +1 hit point for each pym counter on her", () => {
    expect(WSP_PACK_CARDS["13012.wasp-constant"]).toBeDefined();
  });

  // docs/phase7-wave2.md §18.3: `overpaid.energy` is readable from Wasp's own later `cardEntersPlay` interrupt, per
  // resource type. Wasp costs 0, so a single paid card is entirely overpaid; her own deck's two basic resource
  // cards (13021 Energy: 2 [energy] icons, 13023 Strength: 2 [physical] icons — `producesIcons`, since a
  // "resource"-type card's own printed resource is what it *produces*) isolate the type filter with a real command.
  it("Wasp (ally): Interrupt places 1 pym counter for each [energy] resource overpaid for her cost", () => {
    const given = moveToHand(waspVsRhino(), P1, "13012", "13021");
    const [wasp, energy] = given.ids as [InstanceId, InstanceId];
    const after = settle(runWave2(given.state, play(P1, wasp, [energy])), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(after, wasp).counters.pym).toBe(2);
  });

  it("Wasp (ally): a [physical] overpayment counts nothing toward her pym counters", () => {
    const given = moveToHand(waspVsRhino(), P1, "13012", "13023");
    const [wasp, strength] = given.ids as [InstanceId, InstanceId];
    const after = settle(runWave2(given.state, play(P1, wasp, [strength])), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(after, wasp).counters.pym ?? 0).toBe(0);
  });

  // Justice/Leadership/Protection/Basic-aspect cards (13031-13034) print no printedResources of their own aspect
  // in Wasp's own single-aspect Aggression precon (docs/phase7-wave2.md §2.1), so they're never in her starter
  // deck to move into hand for a real playthrough the way the pack's own Aggression cards above are — same modest
  // "is defined" bar trors/toafk/ant already use for a card that's mechanically simple and not reachable from a
  // pack's own precon.
  it("Running Interference, Athletic Conditioning, Surprise Attack, Perseverance, Boot Camp, Lie in Wait, The Power in All of Us, All for One, Into the Fray, Spider-Man: scripted", () => {
    expect(WSP_PACK_CARDS["13031.running-interference-action"]).toBeDefined();
    expect(WSP_PACK_CARDS["13034.athletic-conditioning-action"]).toBeDefined();
    expect(WSP_PACK_CARDS["13014.surprise-attack-response"]).toBeDefined();
    expect(WSP_PACK_CARDS["13033.perseverance-response"]).toBeDefined();
    expect(WSP_PACK_CARDS["13016.boot-camp-constant"]).toBeDefined();
    expect(WSP_PACK_CARDS["13017.lie-in-wait-response"]).toBeDefined();
    expect(WSP_PACK_CARDS["13024.the-power-in-all-of-us-constant"]).toBeDefined();
    expect(WSP_PACK_CARDS["13032.all-for-one-action"]).toBeDefined();
    expect(WSP_PACK_CARDS["13019.spider-man-response"]).toBeDefined();
    expect(WSP_PACK_CARDS["13013.into-the-fray-action"]).toBeDefined();
  });
});
