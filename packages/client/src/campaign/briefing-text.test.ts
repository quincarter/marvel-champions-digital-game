import { describe, expect, it } from "vitest";
import { BRIEFING_LINE_ES } from "./briefing-copy-es.js";
import { BRIEFING_NOTES_ES } from "./briefing-notes-es.js";
import { HANDLED_WORDS_ES, SETUP_CALL_COPY_ES } from "./briefing-calls-es.js";
import { briefingLineIn, briefingNotesIn, citationIn, handledWordsIn, setupCallCopyIn } from "./briefing-text.js";
import { SAGA_VOLUMES, storyFor, type HandledWords, type StoryLine } from "./story.js";

const BOXES = SAGA_VOLUMES.filter((volume) => !volume.custom).map((volume) => volume.campaignId);
const storiesOf = () => BOXES.map((id) => ({ id, story: storyFor(id)! }));

describe("the Briefing's Spanish", () => {
  it("covers all eleven base boxes", () => {
    expect(BOXES).toHaveLength(11);
    for (const { id, story } of storiesOf()) expect(story, id).toBeDefined();
  });

  it("has a Spanish line for every issue's Briefing line, with a fallback wherever the English has one", () => {
    const keys: string[] = [];
    for (const { id, story } of storiesOf()) {
      for (const issue of story.issues) {
        const key = `${id}/${issue.nodeId}`;
        keys.push(key);
        const es = BRIEFING_LINE_ES[key];
        expect(es, key).toBeDefined();
        expect(es!.text, key).not.toBe("");
        expect(es!.fallback === undefined, `${key} fallback`).toBe(issue.briefing.fallback === undefined);
        const line = briefingLineIn(id, issue.nodeId, issue.briefing, "es");
        expect(line.text).toBe(es!.text);
        expect(line.speaker).toEqual(issue.briefing.speaker);
      }
    }
    expect(Object.keys(BRIEFING_LINE_ES).sort()).toEqual(keys.sort());
  });

  it("has Spanish rows for every issue with its own Handled for you rows, row for row", () => {
    const keys: string[] = [];
    for (const { id, story } of storiesOf()) {
      for (const issue of story.issues) {
        const notes = issue.briefingNotes;
        if (notes === undefined) continue;
        const key = `${id}/${issue.nodeId}`;
        keys.push(key);
        const es = BRIEFING_NOTES_ES[key];
        expect(es?.length, key).toBe(notes.length);
        notes.forEach((note, index) => {
          expect(es![index]!.repeatDetail === undefined, `${key} #${index} repeatDetail`).toBe(
            note.repeatDetail === undefined,
          );
        });
        const shown = briefingNotesIn(id, issue.nodeId, notes, "es")!;
        expect(shown.map((row) => row.status)).toEqual(notes.map((row) => row.status));
        expect(shown.map((row) => row.title)).toEqual(es!.map((row) => row.title));
        expect(shown.map((row) => row.citation === undefined)).toEqual(notes.map((row) => row.citation === undefined));
      }
    }
    expect(Object.keys(BRIEFING_NOTES_ES).sort()).toEqual(keys.sort());
  });

  it("has Spanish words for every setup call a box writes, and none it does not", () => {
    const ids = storiesOf().flatMap(({ story }) => Object.keys(story.setupCalls ?? {}));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(SETUP_CALL_COPY_ES[id], id).toBeDefined();
    expect(Object.keys(SETUP_CALL_COPY_ES).sort()).toEqual([...ids].sort());
  });

  it("has Spanish plain-words facts for every box that writes them", () => {
    const boxes = storiesOf()
      .filter(({ story }) => story.handledWords !== undefined)
      .map(({ id }) => id);
    expect(Object.keys(HANDLED_WORDS_ES).sort()).toEqual(boxes.sort());
  });

  it("says Fear No Evil's facts in Spanish, leaving out the same bookkeeping the English does", () => {
    const english = storyFor("fne")!.handledWords!;
    const say = handledWordsIn("fne", english, "es")!;
    const villain = say({
      kind: "write",
      field: "villain.art-museum-heist",
      mode: "set",
      value: { kind: "choice", option: "typhoid_mary" },
      options: undefined,
    });
    expect(villain).toBe("María Tifoidea es el villano de Robo en el museo de arte.");
    const draw = say({ kind: "choice", slot: "drawA", picked: ["the-getaway"], random: true, seatNumber: null });
    expect(draw).toBe("Ha salido La huida, que recibe una marca.");
    const checks = say({ kind: "field", field: "checks", value: { kind: "number", value: 1 }, nodeId: "kingpin" });
    expect(checks).toBe("Kingpin tiene 1 marca en el registro de campaña.");
    const method = say({
      kind: "choice",
      slot: "villainMethod",
      picked: ["The next villain on the recommended list"],
      random: false,
      seatNumber: null,
    });
    expect(method).toBe("El grupo eligió el siguiente villano de la lista recomendada.");
    const bookkeeping = {
      kind: "choice",
      slot: "villain",
      picked: ["bullseye"],
      random: false,
      seatNumber: null,
    } as const;
    expect(say(bookkeeping)).toBe(english(bookkeeping));
  });

  it("writes page citations the Spanish way", () => {
    expect(citationIn("MC40 p. 9", "es")).toBe("MC40 pág. 9");
    expect(citationIn("Insert p. 17", "es")).toBe("Inserto pág. 17");
    expect(citationIn("Insert p. 17", "en")).toBe("Insert p. 17");
  });

  it("keeps English in English, and for a pack campaign or an issue with no Spanish", () => {
    const line: StoryLine = { speaker: { kind: "narrator" }, text: "Pack words.", fallback: "Pack fallback." };
    expect(briefingLineIn("pack-x", "n1", line, "es")).toBe(line);
    expect(briefingLineIn("trors", "not-an-issue", line, "es")).toBe(line);
    const trors = storyFor("trors")!.issues[0]!;
    expect(briefingLineIn("trors", trors.nodeId, trors.briefing, "en")).toBe(trors.briefing);

    const notes = [{ status: "done", title: "Pack row", detail: "Pack detail.", citation: "Pack p. 2" }] as const;
    expect(briefingNotesIn("pack-x", "n1", notes, "es")).toBe(notes);
    expect(briefingNotesIn("pack-x", "n1", undefined, "es")).toBeUndefined();
    // Rows that no longer line up with the Spanish fall back to the English, never a mix.
    expect(briefingNotesIn("mts", "thanos", notes, "es")).toBe(notes);

    const call = { name: "Pack call", explain: "Pack explain." };
    expect(setupCallCopyIn("pack.setup.call", call, "es")).toBe(call);
    expect(setupCallCopyIn("pack.setup.call", null, "es")).toBeNull();
    expect(setupCallCopyIn("mc40.s2.setup.heal", call, "en")).toBe(call);

    const words: HandledWords = () => "Pack fact.";
    expect(handledWordsIn("pack-x", words, "es")).toBe(words);
    expect(handledWordsIn("trors", undefined, "es")).toBeUndefined();
    expect(handledWordsIn("fne", words, "en")).toBe(words);
  });
});
