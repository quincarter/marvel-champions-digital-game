import type { PauseLinkInput } from "../pause.types.js";

export interface McPauseLinkRowProps {
  readonly row: PauseLinkInput | null;
  readonly variant: PauseLinkInput["variant"];
}
