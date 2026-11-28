import type { PauseKeywordInput, PauseKeywordTone } from "../pause.types.js";

export interface McPauseKeywordProps {
  readonly keyword: PauseKeywordInput | null;
  readonly tone: PauseKeywordTone;
}
