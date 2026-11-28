/**
 * Import by paste and by MarvelCDB link. One import at a time, busy until the deck is saved and the list reloaded (the rule the
 * room deck picker `view/import-flight.ts` keeps): a second press during a slow write is refused, and a failed write shows its
 * error and frees the screen instead of leaving Import stuck on "Importing...".
 */
import { POOL_VERSION, currentPool } from "../../content/pool.js";
import { importedDeckNote, importMarvelCdbDeck } from "../../platform/marvelcdb-import.js";
import { deckStorage } from "../../session.js";
import { importFromPasteText, type ImportEnv, type ImportOutcome } from "../../view/deck-import-model.js";
import type { DecksState } from "./decks-state.js";

export class DecksImport {
  constructor(
    private readonly st: DecksState,
    private readonly rebuild: () => void,
  ) {}

  /** The pasted decklist, imported as a new deck. */
  async paste(): Promise<void> {
    await this.#run(async () => this.#apply(importFromPasteText(this.st.pasteText, this.#env())));
  }

  /** The MarvelCDB link or id, fetched (the same flow the room deck picker uses) and imported. */
  async marvelcdb(): Promise<void> {
    await this.#run(async () => {
      const result = await importMarvelCdbDeck(this.st.marvelcdbText, this.#env());
      if (!result.ok) {
        this.st.status = { text: result.message, tone: "error" };
        return;
      }
      await this.#apply({ ok: true, deck: result.deck, warnings: result.warnings });
    });
  }

  async #run(job: () => Promise<void>): Promise<void> {
    const st = this.st;
    if (st.busy) return;
    st.busy = true;
    this.rebuild();
    try {
      await job();
    } catch (cause) {
      st.status = { text: cause instanceof Error ? cause.message : String(cause), tone: "error" };
    } finally {
      st.busy = false;
      this.rebuild();
    }
  }

  #env(): ImportEnv {
    return {
      pool: currentPool(),
      poolVersion: POOL_VERSION,
      now: () => new Date().toISOString(),
      newId: () => crypto.randomUUID(),
      existingNames: this.st.savedDecks.map((deck) => deck.name),
    };
  }

  async #apply(outcome: ImportOutcome): Promise<void> {
    const st = this.st;
    if (!outcome.ok) {
      st.status = { text: outcome.problems.map((problem) => problem.message).join(" "), tone: "error" };
      return;
    }
    await deckStorage().put(outcome.deck);
    st.pasteText = "";
    st.marvelcdbText = "";
    // Unreadable pasted lines are skipped but never silently: each is named by line number under the success line.
    st.status = { text: importedDeckNote(outcome.deck.name, outcome.warnings), tone: "success" };
    st.savedDecks = await deckStorage().list();
    st.selectedDeckId = outcome.deck.id as string;
    st.scrollToDeckId = outcome.deck.id as string;
  }
}
