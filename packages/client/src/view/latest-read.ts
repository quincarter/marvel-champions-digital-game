/**
 * Which of several overlapping reads of one store to keep (issue #957): each read takes a ticket when it is issued, and
 * a read's answer is kept only if no read issued after it has been kept already. A store that serves reads in the
 * order they were issued (IndexedDB does) never answers a later read with older data, so the newest data always wins
 * however the answers' arrival interleaves with other work (the Mod Store's load waiting on the catalog while an
 * Update all refreshes the installed list).
 */
export class LatestRead {
  #issued = 0;
  #kept = 0;

  /** Call as the read is issued. */
  issue(): number {
    return ++this.#issued;
  }

  /** Whether the answer to read `ticket` may be used; marks it kept when so. */
  keep(ticket: number): boolean {
    if (ticket < this.#kept) return false;
    this.#kept = ticket;
    return true;
  }
}
