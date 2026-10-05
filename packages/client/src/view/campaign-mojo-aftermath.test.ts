/**
 * MojoMania's recorded-card choice on the Aftermath: the cost is shown, the decline row says what it does, and each
 * hero is offered their own cards (the runner asks one hero at a time, from that hero's own supports and upgrades).
 */
import { describe, expect, test } from "vitest";
import type { CampaignPendingChoice } from "@mc/engine";
import { CARDS_BY_ID } from "../content/pool.js";
import { aftermathCallCopyFor } from "../campaign/story.js";
import {
  advanceAftermathGroup,
  aftermathColumns,
  aftermathOptionOf,
  decideForSeat,
  offersAnswer,
  readyToCommit,
  startAftermathGroup,
  type AftermathChoiceGroup,
} from "./campaign-aftermath-model.js";

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

  // The engine asks each hero in turn; a hero with no eligible card is asked with an empty, optional offer.
  const pendingFor = (seatNumber: number, options: string[]): CampaignPendingChoice =>
    ({
      instructionId: "mojo.s1.victory.card",
      slot: "recordedCard",
      seatNumber,
      text: "x",
      citation: "MojoMania insert p. 9",
      chooser: "eachSeat",
      options,
      count: 1,
      optional: true,
    }) as CampaignPendingChoice;
  const names = ["", "Gambit", "Rogue", "Storm", "Psylocke"];
  const optionOf = (id: string) => aftermathOptionOf(id as never, CARDS_BY_ID);
  const seatsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ seatNumber: i + 1, heroName: names[i + 1]! }));
  const columnsOf = (group: AftermathChoiceGroup) => aftermathColumns(group, (seat) => names[seat]!);

  /** Plays the whole choice: `offers[i]` is seat i+1's own options; `picks[i]` is a card to pick or null to decline. */
  function play(offers: string[][], picks: (string | null)[]) {
    const seats = seatsOf(offers.length);
    let group = startAftermathGroup(pendingFor(1, offers[0]!), seats, optionOf);
    const sent: string[][] = [];
    for (let i = 0; i < offers.length; i++) {
      const seat = i + 1;
      expect(group.currentSeatNumber).toBe(seat);
      if (offers[i]!.length > 0) {
        // A seat with options is undecided until its player chooses, and has an explicit decline row.
        expect(group.decisions[seat]!.kind).toBe("undecided");
        expect(columnsOf(group)[i]!.optional).toBe(true);
        group = decideForSeat(
          group,
          seat,
          picks[i] === null ? { kind: "declined" } : { kind: "picked", cardId: picks[i] as never },
        );
      }
      // Confirm is enabled for the current seat: it has decided, whether by choice or because it had nothing.
      expect(group.decisions[seat]!.kind).not.toBe("undecided");
      const decision = group.decisions[seat]!;
      sent.push(decision.kind === "picked" ? [decision.cardId as string] : []);
      expect(
        offersAnswer(pendingFor(seat, offers[i]!), {
          instructionId: "x",
          slot: "recordedCard",
          seatNumber: seat,
          picked: sent[i] as never,
        }),
      ).toBe(true);
      const next = i + 1 < offers.length ? pendingFor(seat + 1, offers[i + 1]!) : null;
      const advanced = advanceAftermathGroup(group, seat, next, optionOf);
      if (advanced) group = advanced;
    }
    return { group, sent };
  }

  test("seat 1 with nothing to record is settled and never blocks seat 2", () => {
    const seats = seatsOf(2);
    const group = startAftermathGroup(pendingFor(1, []), seats, optionOf);
    const [first, second] = columnsOf(group);
    expect(first!.nothingToPick).toBe(true);
    expect(first!.awaitingOffer).toBe(false);
    expect(first!.heading).toBe("Nothing to record.");
    expect(group.decisions[1]!.kind).toBe("declined");
    // Seat 2 is still not known (dealt on its own turn) and is the only one waiting.
    expect(second!.awaitingOffer).toBe(true);
    expect(second!.nothingToPick).toBe(false);
    const { sent } = play([[], ["01010"]], [null, "01010"]);
    expect(sent).toEqual([[], ["01010"]]);
  });

  test("seat 2 with nothing to record is settled when its turn comes", () => {
    const { group, sent } = play([["01010"], []], ["01010", null]);
    expect(sent).toEqual([["01010"], []]);
    expect(columnsOf(group)[1]!.nothingToPick).toBe(true);
    expect(readyToCommit(group)).toBe(true);
  });

  test("both heroes with nothing to record are each settled", () => {
    const { sent } = play([[], []], [null, null]);
    expect(sent).toEqual([[], []]);
  });

  test("both with options: each picks, or one declines with an explicit Record nothing", () => {
    expect(play([["01010"], ["01010"]], ["01010", "01010"]).sent).toEqual([["01010"], ["01010"]]);
    expect(play([["01010"], ["01010"]], [null, "01010"]).sent).toEqual([[], ["01010"]]);
  });

  test("an empty seat in any position of 1 to 4 heroes never deadlocks", () => {
    for (let count = 1; count <= 4; count++) {
      for (let empty = 0; empty < count; empty++) {
        const offers = Array.from({ length: count }, (_, i) => (i === empty ? [] : ["01010"]));
        const { sent } = play(
          offers,
          offers.map((offer) => (offer.length > 0 ? "01010" : null)),
        );
        expect(sent.map((picked) => picked.length)).toEqual(offers.map((offer) => (offer.length > 0 ? 1 : 0)));
      }
    }
  });
});
