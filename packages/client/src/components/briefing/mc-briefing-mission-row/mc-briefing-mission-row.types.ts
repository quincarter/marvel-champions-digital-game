/** One labelled row: a kind word, the card name, a short line beneath and an Inspect chip when it has a card. */
export interface MissionRowModel {
  readonly key: "mission" | "overseer";
  readonly kind: string;
  readonly name: string;
  readonly detail: string;
  readonly cardId: string | null;
}
