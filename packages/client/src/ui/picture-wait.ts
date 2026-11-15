/**
 * Waiting for pictures a screen drew without (issue #716): a screen that holds itself on the void until its pictures
 * are in (`holdScreenFor`) needs a promise that settles when they arrive. `ensurePictureLoaded` tells a waiter once a
 * batch of pictures has arrived, through the callback it was given; `PictureWait` turns that callback into a promise.
 * Plain TypeScript, no Phaser: the scenes own the drawing.
 */
export class PictureWait {
  /** The texture keys drawn without their picture, still on their way. */
  readonly #pending = new Set<string>();
  #promise: Promise<void> | null = null;
  #resolve: (() => void) | null = null;

  /**
   * `isLoaded` says whether a texture key has settled (`isPictureSettled`: loaded, or its load failed and was
   * forgotten): `ensurePictureLoaded` tells a waiter once
   * per batch, and a batch need not hold every picture waited for (#713 review: Deadpool's and Spider-Man's portraits
   * can land in different batches), so each arrival checks which of the expected keys are in.
   */
  constructor(private readonly isLoaded: (key: string) => boolean) {}

  /** The picture with this texture key was drawn without, and is on its way. */
  expect(key: string): void {
    if (!this.isLoaded(key)) this.#pending.add(key);
  }

  /**
   * A batch of pictures arrived: the keys now in stop being waited for, and the wait settles once none is left. An
   * arrow property, so the same function can be handed to `ensurePictureLoaded` for every picture, which then tells
   * it once per batch.
   */
  readonly arrived = (): void => {
    for (const key of [...this.#pending]) if (this.isLoaded(key)) this.#pending.delete(key);
    if (this.#pending.size > 0) return;
    const resolve = this.#resolve;
    this.#promise = null;
    this.#resolve = null;
    resolve?.();
  };

  /** True while a picture expected is still on its way. */
  get pending(): boolean {
    return this.#pending.size > 0;
  }

  /** Settles when every picture expected so far has arrived, or at once when none is expected. */
  settled(): Promise<void> {
    if (this.#pending.size === 0) return Promise.resolve();
    this.#promise ??= new Promise<void>((resolve) => {
      this.#resolve = resolve;
    });
    return this.#promise;
  }
}

/**
 * `promise`, but settled (never rejected) after `ms` at the latest: a picture that fails to load is never announced,
 * so whatever waits on it moves on anyway.
 */
export function settleWithin(
  promise: Promise<unknown>,
  ms: number,
  timer: (callback: () => void, ms: number) => unknown = setTimeout,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = (): void => resolve();
    timer(done, ms);
    promise.then(done, done);
  });
}
