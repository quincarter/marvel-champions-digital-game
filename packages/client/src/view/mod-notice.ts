/**
 * The Mod Store's heads-up (`scenes/mod-notice.ts`): Deadpool and Spider-Man warn that mods carry risk. Pure
 * wording, when it shows, what its buttons do and where its two speakers sit, so all of it is tested once.
 */
import { t } from "../i18n/translate.js";

export interface ModNoticeLine {
  readonly speaker: string;
  /** The hero's identity card id, for the portrait (`art/heroes/<id>-<name>/`). */
  readonly identityId: string;
  readonly text: string;
}

export const MOD_NOTICE_LINES: readonly [ModNoticeLine, ModNoticeLine] = [
  {
    speaker: "Deadpool",
    identityId: "44001a",
    text: "Psst, fourth wall chat: the Mod Store comes with some risk. Mods are made by the community, not by the pros, and the repo owner vets every single one before it shows up here.",
  },
  {
    speaker: "Spider-Man",
    identityId: "01001a",
    text: "Which means there could be bugs. Please be patient with us, okay? If something gets tangled in the web, hit Report a problem and tell us.",
  },
];

export type ModNoticeAnswer = "report" | "close";

export const MOD_NOTICE_BUTTONS: readonly { readonly id: ModNoticeAnswer; readonly label: string }[] = [
  { id: "report", label: "Report a problem" },
  { id: "close", label: "Got it" },
];

/**
 * The caption box above the store's content (Quin, 2026-11-13): a comic narration box, not a speech bubble, saying
 * why the store is in beta. The top bar's BETA tag says the same in one word.
 */
export const modStoreBetaCaption = (): {
  readonly heading: string;
  readonly body: string;
  readonly phoneBody: string;
} => ({
  heading: t("modStore.beta.heading"),
  body: t("modStore.beta.body"),
  phoneBody: t("modStore.beta.phoneBody"),
});

export const modNoticeControlLabelOf = (phone: boolean): string => (phone ? "!" : t("modStore.about"));

/** Opening the store shows the notice until it has been seen once. */
export const showNoticeOnOpen = (seen: boolean): boolean => !seen;

/** The first install (or update) shows it when it was never seen; later ones go straight ahead. */
export const showNoticeBeforeInstall = (seen: boolean): boolean => !seen;

/** What answering the notice does: it is remembered either way; "report" also opens the report tool. */
export function modNoticeOutcomeOf(answer: ModNoticeAnswer): { readonly remember: true; readonly openReport: boolean } {
  return { remember: true, openReport: answer === "report" };
}
