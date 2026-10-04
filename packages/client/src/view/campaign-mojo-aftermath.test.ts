/**
 * MojoMania's recorded-card choice on the Aftermath: the cost is shown, the decline row says what it does, and each
 * hero is offered their own cards (the runner asks one hero at a time, from that hero's own supports and upgrades).
 */
import { describe, expect, test } from "vitest";
import type { CampaignPendingChoice } from "@mc/engine";
import { CARDS_BY_ID } from "../content/pool.js";
import { aftermathCallCopyFor } from "../campaign/story.js";
import { aftermathColumns, aftermathOptionOf, startAftermathGroup } from "./campaign-aftermath-model.js";

describe("the recorded-card Aftermath", () => {
  test("the recorded-card Aftermath names the cost, the decline and each hero's own offer", () => {
    const pending = {
      instructionId: "mojo.s1.victory.card",
      slot: "recordedCard",
      seatNumber: 1,
      text: "x",
      citation: "MojoMania insert p. 9",
      chooser: "eachSeat",
      options: ["01010"],
      count: 1,
      optional: true,
    } as CampaignPendingChoice;
    const group = startAftermathGroup(
      pending,
      [
        { seatNumber: 1, heroName: "Gambit" },
        { seatNumber: 2, heroName: "Rogue" },
      ],
      (id) => aftermathOptionOf(id, CARDS_BY_ID),
    );
    expect(aftermathCallCopyFor("mojo.s1.victory.card")).not.toBeNull();
    // Each hero is offered their own cards: seat 2 sees nothing until its turn rather than seat 1's list.
    expect(group.dealtPerSeat).toBe(true);
    const columns = aftermathColumns(group, (seat) => (seat === 1 ? "Gambit" : "Rogue"));
    expect(columns[0]!.rows).toHaveLength(1);
    expect(columns[1]!.rows).toHaveLength(0);
    expect(columns[1]!.waiting).toBe("Offered once the hero before has decided.");
    expect(columns.map((column) => column.declineLabel)).toEqual(["Record nothing", "Record nothing"]);
    expect(columns[0]!.heading).toBe("Record one card, or none.");
    expect(columns[0]!.showCost).toBe(true);
  });
});
