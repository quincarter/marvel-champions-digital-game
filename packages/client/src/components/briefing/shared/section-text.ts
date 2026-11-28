/**
 * The words the sections' models author in English (a pool row's destination, a mission's setup line, the case file's flip note,
 * its carried numbers and hit-point lines, a carried-in fact). Chrome is translated in `en.ts` / `es.ts`; these are story text
 * and go through this one place, so the campaign copy translation (`campaign/campaign-copy-es.ts`, the Briefing's copy piece)
 * fills them without a section changing. Until then they read as the model wrote them.
 */
export interface SectionText {
  /** A pool row's destination line ("Put into play at setup."). */
  poolDestination(text: string): string;
  /** A mission's one-line Setup. */
  missionSetup(text: string): string;
  /** A carried-over penalty line. */
  carried(text: string): string;
  /** The case file's flip-threshold note. */
  flipNote(text: string): string;
  /** A carried number's label, and where it is read. */
  numberLabel(text: string): string;
  numberUsedIn(text: string): string;
  /** An expert seat's hit-point line. */
  seatStatus(text: string): string;
  /** A carried-in fact's title and detail. */
  carryTitle(text: string): string;
  carryDetail(text: string): string;
}

export const sectionTextIn = (): SectionText => ({
  poolDestination: (text) => text,
  missionSetup: (text) => text,
  carried: (text) => text,
  flipNote: (text) => text,
  numberLabel: (text) => text,
  numberUsedIn: (text) => text,
  seatStatus: (text) => text,
  carryTitle: (text) => text,
  carryDetail: (text) => text,
});
