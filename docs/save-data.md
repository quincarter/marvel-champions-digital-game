# Save data export and import

Settings → **Save data** writes everything the game keeps on this device to one JSON file, and reads such a file
back, replacing what is there. It is how a player moves to a new device or browser, keeps a backup, or recovers
after clearing site data. The format is also meant to be what a later cloud sync uploads and downloads unchanged.

## What travels

Everything persisted, nothing per-feature:

| Where                    | What                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------- |
| IndexedDB `mc-saves`     | saved games: `games` (summaries), `baselines`, `commands` (replay logs)             |
| IndexedDB `mc-decks`     | imported and player-built decks                                                     |
| IndexedDB `mc-campaigns` | campaign runs                                                                       |
| `localStorage` `mc-*`    | unlock picks and points (`mc-unlocks`), guide preferences (`mc-guide`), legacy keys |

The list of databases lives in `packages/client/src/save-data/databases.ts`. A test opens each database through its
storage class and fails if the list no longer matches, so a new database or a schema bump has to be added there.
In-game display settings (`settings.ts`) aren't persisted today, so they don't travel either.

## The file

```json
{
  "format": "mc-save-data",
  "version": 1,
  "exportedAt": 1790812800000,
  "appVersion": "0.13.0",
  "databases": {
    "mc-decks": { "version": 1, "stores": { "decks": [{ "id": "…", "…": "…" }] } }
  },
  "localStorage": { "mc-unlocks": "{\"version\":2,…}" }
}
```

Records are stored verbatim (each carries its own key), and `localStorage` values are the raw strings.

## Versioning rules

- `version` is the envelope's format. A build reads every version up to its own `SAVE_FILE_VERSION` and refuses a
  newer one. Bump it only when the envelope's shape changes, and keep reading the old shape.
- Each database carries the IndexedDB schema version it was exported at. A build refuses a database newer than its
  own. An older one restores as-is, and the storage class's read-time migrations (`migrateSaveMeta` and the like)
  upgrade its records the same way they upgrade data that never left the device. A schema bump that changes record
  shapes therefore needs a read-time migration, which it needs anyway for existing players.
- Databases the build doesn't know are ignored, and a known store missing from the file restores empty.

## Import

The file is fully validated before anything is written (`parseSaveFile`): envelope, versions, every record's key,
and that every `localStorage` key is the game's. The player then confirms a summary ("3 saved games, 2 decks, 1
campaign and unlocks, exported …"). Import clears and refills each database in one transaction per database, swaps
the `mc-*` `localStorage` entries, and reloads the page so every cache reads the new data.

## Platforms

The web downloads the file and picks it with the browser's file picker. The Capacitor and Tauri webviews don't
download, so there export goes to the system share sheet when the webview can share files and falls back to a
download link otherwise; this path still needs checking on a device.
