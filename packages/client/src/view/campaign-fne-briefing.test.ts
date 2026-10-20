import { describe, expect, test } from "vitest";
import { CORE_STARTER_DECKS, PLAYABLE_CARDS, type PlayModes } from "@mc/content";
import { createCampaignLog, resolveBetweenGames, type CampaignChoiceAnswer, type CampaignLog } from "@mc/engine";
import { campaignDefinitionOf } from "@mc/cards";
import { handledRowsOf } from "./campaign-briefing-model.js";

const DEF = campaignDefinitionOf("fne")!;
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const starter = CORE_STARTER_DECKS[0]!;
const SEATS = [
  {
    seatNumber: 1,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: [...starter.cards] },
  },
];

function compose(pick: (c: { slot: string; options: readonly string[] }) => string): CampaignLog {
  const log = createCampaignLog(DEF, { id: "fne-t", seats: SEATS, modes: STANDARD, poolVersion: "test", seed: 11 });
  const answers: CampaignChoiceAnswer[] = [];
  for (let round = 0; round < 40; round++) {
    const result = resolveBetweenGames(DEF, log, { pool: PLAYABLE_CARDS }, log.modes, answers);
    if (result.kind === "done") return result.value;
    const c = result.choice;
    answers.push({ instructionId: c.instructionId, slot: c.slot, seatNumber: c.seatNumber, picked: [pick(c)] });
  }
  throw new Error("loop");
}

const nodeIds = DEF.graph.nodes.map((n) => n.id);
const rowsOf = (pick: Parameters<typeof compose>[0]) => {
  const log = compose(pick);
  return handledRowsOf(log.attempt!, log as never, ((id: string) => id) as never, DEF, nodeIds);
};
const firstPlaythrough = (method: "listed" | "random") => (c: { slot: string; options: readonly string[] }) =>
  c.slot === "playthrough"
    ? "First playthrough"
    : c.slot === "villainMethod"
      ? c.options.find((o) => (method === "listed" ? /recommended/ : /random/).test(o))!
      : c.options[0]!;

describe("the Fear No Evil Handled for you rows", () => {
  test("read as plain sentences, never log field keys or ids", () => {
    const text = rowsOf(firstPlaythrough("listed"))
      .map((row) => `${row.title} | ${row.detail}`)
      .join(" / ");
    expect(text).toContain("This is the group's first time through the campaign.");
    expect(text).toContain("Hammerhead is the villain for Art Museum Heist.");
    expect(text).toContain("Villains not yet faced: Bullseye, Electro, Purple Man, Typhoid Mary.");
    expect(text).toContain("The group took the next villain on the recommended list.");
    expect(text).toMatch(/was drawn and gets a check mark/);
    expect(text).toMatch(/Art Museum Heist has 1 check mark in the campaign log\./);
    expect(text).not.toMatch(/Recorded|Unrecorded|Villain\.|villain\.|Villain Method|Draw A|[a-z]+-[a-z]+-[a-z]+ was/);
  });

  test("a random villain is named the same way, and the method is not asked as a log field", () => {
    const text = rowsOf(firstPlaythrough("random"))
      .map((row) => row.detail)
      .join(" ");
    expect(text).toMatch(/[A-Z][a-z]+(?: [A-Z][a-z]+)? is the villain for [A-Z]/);
    expect(text).toContain("The group took a random unrecorded villain.");
    expect(text).not.toMatch(/Recorded|Unrecorded/);
  });
});
