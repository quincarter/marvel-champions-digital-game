/** A button that names a choice and says whether a filter or sort is on (the ink fill). */
export interface ChoiceButtonModel {
  readonly label: string;
  readonly on: boolean;
}

/**
 * The pool's Pack control, Wave button and Sort and Then buttons (PR #88 step 5): a pack row (< name >) over a wave button
 * and a pair of sort buttons. A press on the pack name or the wave button opens a picker (issue #977); the arrows step one
 * pack at a time, wrapping through "All packs".
 */
export interface PackSortModel {
  readonly label: string;
  readonly pack: ChoiceButtonModel;
  readonly cycle: ChoiceButtonModel;
  readonly sort: ChoiceButtonModel;
  readonly then: ChoiceButtonModel;
}
