/**
 * One import at a time (the room deck picker's MarvelCDB import): a run started while another is still going does
 * nothing, and the flight is busy until the whole run has finished, its save included. A second Enter during a slow
 * IndexedDB write once started a second import and stored the deck twice (review on #904, 2026-11-23). A screen
 * left and opened again keeps the flight until that run settles; its own generation guard drops its result.
 */
export class ImportFlight {
  #busy = false;

  get busy(): boolean {
    return this.#busy;
  }

  /** Runs `job` unless one is already running; resolves false when it was refused. Busy until `job` settles. */
  async run(job: () => Promise<void>): Promise<boolean> {
    if (this.#busy) return false;
    this.#busy = true;
    try {
      await job();
    } finally {
      this.#busy = false;
    }
    return true;
  }
}
