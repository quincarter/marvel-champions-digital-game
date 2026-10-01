/**
 * Every IndexedDB database the client keeps, as plain data: name, schema version, and each object store's key path.
 *
 * The save-data file (`save-file.ts`) is a snapshot of exactly these, so a database the client adds later has to be
 * listed here too or it won't travel with an export. `databases.test.ts` opens each one through its own storage
 * class and checks this list against what that class actually created, so a schema bump there fails a test here
 * instead of silently writing files the new build can't read back.
 */

export interface StoreSpec {
  readonly name: string;
  readonly keyPath: string | readonly string[];
}

export interface DatabaseSpec {
  readonly name: string;
  readonly version: number;
  readonly stores: readonly StoreSpec[];
}

export const SAVED_DATABASES: readonly DatabaseSpec[] = [
  {
    // `engine/idb-game-storage.ts`: saved games, their replay baselines, and their command logs.
    name: "mc-saves",
    version: 1,
    stores: [
      { name: "games", keyPath: "id" },
      { name: "baselines", keyPath: "gameId" },
      { name: "commands", keyPath: ["gameId", "seq"] },
    ],
  },
  // `engine/idb-deck-storage.ts`: imported and player-built decks.
  { name: "mc-decks", version: 1, stores: [{ name: "decks", keyPath: "id" }] },
  // `engine/idb-campaign-storage.ts`: campaign runs.
  { name: "mc-campaigns", version: 1, stores: [{ name: "campaigns", keyPath: "id" }] },
];

/**
 * The `localStorage` keys that are save data: everything the client writes there starts with this prefix
 * (`mc-unlocks` for unlock picks and points, `mc-guide` for guide preferences, the legacy `mc-deck-freeze-optin:*`
 * keys a campaign migrates from).
 */
export const SAVED_LOCAL_STORAGE_PREFIX = "mc-";
