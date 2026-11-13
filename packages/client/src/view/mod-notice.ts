/**
 * The Mod Store's heads-up (`scenes/mod-notice.ts`): Deadpool and Spider-Man warn that mods carry risk. Pure
 * wording, when it shows, what its buttons do and where its two speakers sit, so all of it is tested once.
 */
import type { Rect } from "./layout.js";

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

/** The store's "about mods" control: a "!" on a phone, words elsewhere. */
/**
 * The caption box above the store's content (Quin, 2026-11-13): a comic narration box, not a speech bubble, saying
 * why the store is in beta. The top bar's BETA tag says the same in one word.
 */
export const MOD_STORE_BETA_CAPTION = {
  heading: "Beta",
  body:
    "The Mod Store is brand new. Every pack here is fan-made, and many needed new rules in the game to work, so expect " +
    "rough edges: a card that resolves oddly, a picture that is missing. If something looks wrong, open About mods and " +
    "report it.",
  phoneBody: "Brand new and fan-made: expect rough edges. Spot one? Tap ! and report it.",
} as const;

export const MOD_NOTICE_CONTROL_LABEL = "About mods";
export const modNoticeControlLabelOf = (phone: boolean): string => (phone ? "!" : MOD_NOTICE_CONTROL_LABEL);

/** Opening the store shows the notice until it has been seen once. */
export const showNoticeOnOpen = (seen: boolean): boolean => !seen;

/** The first install (or update) shows it when it was never seen; later ones go straight ahead. */
export const showNoticeBeforeInstall = (seen: boolean): boolean => !seen;

/** What answering the notice does: it is remembered either way; "report" also opens the report tool. */
export function modNoticeOutcomeOf(answer: ModNoticeAnswer): { readonly remember: true; readonly openReport: boolean } {
  return { remember: true, openReport: answer === "report" };
}

export interface ModNoticeLayout {
  readonly speakers: readonly { readonly portrait: Rect; readonly bubble: Rect; readonly tailSide: "left" | "right" }[];
  readonly buttons: readonly Rect[];
}

const BUTTON_HEIGHT = 56;

/**
 * Wide screens: Deadpool top left, Spider-Man below right, each portrait beside its bubble. A phone stacks them, portrait
 * left of the bubble on both, so each bubble keeps the width its words need at 375 px.
 */
export function modNoticeLayoutOf(width: number, height: number, phone: boolean): ModNoticeLayout {
  const margin = phone ? 16 : 32;
  const inner = Math.min(width - margin * 2, 900);
  const left = (width - inner) / 2;
  const portraitSize = phone ? 64 : Math.min(150, Math.round(height * 0.2));
  const gap = phone ? 10 : 20;
  const buttonGap = 10;
  const buttonWidth = phone ? inner : Math.min(260, (inner - buttonGap) / 2);
  const buttonsHeight = phone ? BUTTON_HEIGHT * 2 + buttonGap : BUTTON_HEIGHT;
  const bubbleWidth = phone ? inner - portraitSize - gap : Math.min(520, inner - portraitSize - gap);
  const bubbleHeight = phone ? 160 : 140;
  const rowGap = phone ? 14 : 28;
  const afterRows = phone ? 16 : 28;
  const stackHeight = bubbleHeight * 2 + rowGap + afterRows + buttonsHeight;
  const top = Math.max(8, (height - stackHeight) / 2);
  const rows = [0, 1].map((index) => {
    const y = top + index * (bubbleHeight + rowGap);
    const mirrored = !phone && index === 1;
    const portraitX = mirrored ? left + inner - portraitSize : left;
    const bubbleX = mirrored ? portraitX - gap - bubbleWidth : left + portraitSize + gap;
    return {
      portrait: { x: portraitX, y, width: portraitSize, height: portraitSize },
      bubble: { x: bubbleX, y, width: bubbleWidth, height: bubbleHeight },
      tailSide: mirrored ? ("right" as const) : ("left" as const),
    };
  });
  const buttonsY = top + bubbleHeight * 2 + rowGap + afterRows;
  const buttons: Rect[] = [0, 1].map((i) =>
    phone
      ? { x: left, y: buttonsY + i * (BUTTON_HEIGHT + buttonGap), width: buttonWidth, height: BUTTON_HEIGHT }
      : {
          x: left + inner - buttonWidth * 2 - buttonGap + i * (buttonWidth + buttonGap),
          y: buttonsY,
          width: buttonWidth,
          height: BUTTON_HEIGHT,
        },
  );
  return { speakers: rows, buttons };
}
