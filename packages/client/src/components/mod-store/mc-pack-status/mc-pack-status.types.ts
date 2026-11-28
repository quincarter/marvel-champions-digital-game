/** What a pack page's status line says. */
export type PackStatusModel =
  | { readonly kind: "none" }
  /** The last failure, in words. */
  | { readonly kind: "failure"; readonly text: string }
  /** What the pack is waiting on (a newer app). */
  | { readonly kind: "requirement"; readonly text: string }
  /** An install or update going: its words and how far it is, 0 to 1. */
  | { readonly kind: "progress"; readonly text: string; readonly fraction: number };

export interface McPackStatusProps {
  status: PackStatusModel;
}
