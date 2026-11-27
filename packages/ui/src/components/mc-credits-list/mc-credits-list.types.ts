/** One row of the Art & Credits list, already worded and translated by the client (`view/credits-model.ts`). */
export type CreditsListRow =
  | { readonly kind: "notice"; readonly text: string }
  | { readonly kind: "section"; readonly title: string; readonly count: string }
  | {
      readonly kind: "entry";
      readonly title: string;
      /** The lines under the title, in order: "body" for the credit itself, "small" for the rest. */
      readonly lines: readonly { readonly text: string; readonly tone: "body" | "small" }[];
    };
