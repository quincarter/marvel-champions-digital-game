/**
 * The Briefing's (C08) story words in the player's language, as `campaign-text.ts` does for the Saga, Cover and Roster:
 * each issue's opening line, its "Handled for you" rows, the setup calls' plain sentences and the box's plain-words
 * facts. English is the story data itself (`stories/*.ts`), passed in unchanged; Spanish comes from
 * `briefing-copy-es.ts`, `briefing-notes-es.ts` and `briefing-calls-es.ts`. Anything with no Spanish entry (a pack
 * campaign's own story, an issue or call not yet written) reads in English, never blank.
 */
import { artLanguageNow } from "../art/art-source.js";
import type { CardLanguage } from "../art/card-language.js";
import type { BriefingNoteCopy } from "../view/campaign-briefing-model.js";
import { BRIEFING_LINE_ES } from "./briefing-copy-es.js";
import { BRIEFING_NOTES_ES } from "./briefing-notes-es.js";
import { HANDLED_WORDS_ES, SETUP_CALL_COPY_ES } from "./briefing-calls-es.js";
import type { HandledWords, SetupCallCopy, StoryLine } from "./story.js";

/**
 * An issue's Briefing line (`IssueStory.briefing`) in `lang`: the same speaker and placement, with the Spanish text and
 * narrator fallback. A Spanish entry with no fallback keeps none (the speaker is a villain or a guest, never absent).
 */
export function briefingLineIn(
  campaignId: string,
  nodeId: string,
  line: StoryLine,
  lang: CardLanguage = artLanguageNow(),
): StoryLine {
  const es = lang === "en" ? undefined : BRIEFING_LINE_ES[`${campaignId}/${nodeId}`];
  if (!es) return line;
  const { fallback: _english, ...rest } = line;
  return es.fallback === undefined ? { ...rest, text: es.text } : { ...rest, text: es.text, fallback: es.fallback };
}

/** A printed citation's words in Spanish ("MC40 p. 9" -> "MC40 pág. 9", "Insert p. 7" -> "Inserto pág. 7"). */
export function citationIn(citation: string, lang: CardLanguage = artLanguageNow()): string {
  if (lang === "en") return citation;
  return citation.replace(/^Insert\b/, "Inserto").replace(/\bp\. (?=\d)/g, "pág. ");
}

/**
 * An issue's own "Handled for you" rows (`IssueStory.briefingNotes`) in `lang`: each row keeps its status and
 * citation and takes the Spanish words. Undefined stays undefined (the generic rows are built elsewhere), and an issue
 * whose Spanish rows are missing or do not line up with the English keeps the English rows.
 */
export function briefingNotesIn(
  campaignId: string,
  nodeId: string,
  notes: readonly BriefingNoteCopy[] | undefined,
  lang: CardLanguage = artLanguageNow(),
): readonly BriefingNoteCopy[] | undefined {
  if (notes === undefined || lang === "en") return notes;
  const es = BRIEFING_NOTES_ES[`${campaignId}/${nodeId}`];
  if (!es || es.length !== notes.length) return notes;
  return notes.map((note, index) => {
    const words = es[index]!;
    const citation = note.citation === undefined ? {} : { citation: citationIn(note.citation, lang) };
    const repeat = note.repeatDetail === undefined ? {} : { repeatDetail: words.repeatDetail ?? note.repeatDetail };
    return { status: note.status, title: words.title, detail: words.detail, ...repeat, ...citation };
  });
}

/** A setup call's plain words (`setupCallCopyFor(instructionId)`) in `lang`; null stays null. */
export function setupCallCopyIn(
  instructionId: string,
  english: SetupCallCopy | null,
  lang: CardLanguage = artLanguageNow(),
): SetupCallCopy | null {
  if (english === null || lang === "en") return english;
  return SETUP_CALL_COPY_ES[instructionId] ?? english;
}

/**
 * A box's plain-words facts (`CampaignStory.handledWords`) in `lang`; a story with none keeps none, and a box with no
 * Spanish (a pack campaign's own) keeps its English.
 */
export function handledWordsIn(
  campaignId: string,
  english: HandledWords | undefined,
  lang: CardLanguage = artLanguageNow(),
): HandledWords | undefined {
  if (english === undefined || lang === "en") return english;
  return HANDLED_WORDS_ES[campaignId] ?? english;
}
