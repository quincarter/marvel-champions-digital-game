import type { AspectStamp } from "../../../view/aspect-stamp.js";

/** A tile of a call choice (a role, an encounter set) or a toggle (the easier start): framed, with a name, its words and one press. */
export interface OptionTileModel {
  /** The focus stop key (`role:<id>`, `call-option:<id>`, `easier-start`). */
  readonly stop: string;
  /** What a tap raises as `mc-pressed` `action`. */
  readonly action: unknown;
  readonly title: string;
  /** Aspect chips at the right end of the name. */
  readonly chips?: readonly Pick<AspectStamp, "aspect" | "label">[];
  readonly body: string;
  /** The body in the warning red capitals (a taken role says so in words). */
  readonly bodyWarn?: boolean;
  /** A small label at the tile foot. */
  readonly footer?: string;
  readonly footerTone?: "red" | "cost" | "heal";
  /** A tile that cannot be picked: shown, dimmed, spelled out, with no press and no stop. */
  readonly available: boolean;
  /** A heal-green stripe down the left edge (the set already chosen). */
  readonly stripe?: boolean;
  /** A switched-on toggle: the 4px red frame. */
  readonly on?: boolean;
}
