/**
 * Where an attachment (encounter attachment or player upgrade) may be attached.
 * Shared by `AttachmentCard.attachesTo` and `UpgradeCard.attachesTo`.
 *
 * - "Attach to Rhino/Klaw/Ultron" / "Attach to the villain" → `{ kind: "villain" }`.
 * - `hero` means a hero-form identity; `anyCharacter` is any character in play
 *   (identities, allies, minions, the villain).
 * - `namedCard`: "Attach to the Ultron Drones environment" — the in-play card
 *   with that exact printed name.
 * - `minionWithHighestPrintedHp`: "Attach to the minion with the highest printed
 *   hit points [and without another <name> attached]". Ties are chosen by the
 *   revealing player.
 */
export type AttachmentHost =
  | { readonly kind: "villain" }
  | { readonly kind: "mainScheme" }
  | { readonly kind: "sideScheme" }
  | { readonly kind: "hero" }
  | { readonly kind: "ally" }
  | { readonly kind: "minion" }
  | { readonly kind: "enemy" }
  | { readonly kind: "anyCharacter" }
  | { readonly kind: "namedCard"; readonly name: string }
  | { readonly kind: "minionWithHighestPrintedHp"; readonly withoutAttachmentNamed?: string };

export type AttachmentHostKind = AttachmentHost["kind"];

export const ATTACHMENT_HOST_KINDS: readonly AttachmentHostKind[] = [
  "villain",
  "mainScheme",
  "sideScheme",
  "hero",
  "ally",
  "minion",
  "enemy",
  "anyCharacter",
  "namedCard",
  "minionWithHighestPrintedHp",
];

/**
 * Stat changes printed in an attachment's stat boxes (Charge +3 ATK, Program
 * Transmitter +1 SCH). The engine applies them as constant modifiers to the
 * host while the attachment is attached.
 */
export interface PrintedStatModifiers {
  readonly atk?: number;
  readonly sch?: number;
  readonly thw?: number;
  readonly hp?: number;
}
