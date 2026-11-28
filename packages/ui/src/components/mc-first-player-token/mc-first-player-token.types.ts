/** A box in px on the screen (the token's resting place). */
export interface TokenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A point, or an offset from the token's resting place, in px. */
export interface TokenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Where the token is and how it is held at one moment of a flight, as an offset from where it comes to rest. `lift` is how
 * far above the table it is, so its shadow can stay on the table; `angle` is degrees; `scaleX` is the spin's flip.
 */
export interface TokenFrame {
  readonly x: number;
  readonly y: number;
  readonly lift: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly angle: number;
}

/** A flight as sampled frames played over `durationMs`; the first frame is where the token was, the last is rest. */
export interface TokenFlight {
  readonly frames: readonly TokenFrame[];
  readonly durationMs: number;
}
