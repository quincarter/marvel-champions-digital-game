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

## Sending to another device

Settings → Save data → **Send to another device** moves the same file between devices without handling it: the
sender gets a code and a QR code, and **Receive from another device** on the other device (or scanning the QR code,
which opens the game at `#receive=…`) brings it across and lands on the same confirm-then-replace step as Import.
Online transfer is step 1 of [docs/cloud-sync-plan.md](cloud-sync-plan.md); the Worker is `packages/sync-worker`.

**The code** is 12 characters from a 31-symbol alphabet without lookalikes (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`: no
0/O, 1/I/L), shown as `ABCD-EFGH-JKMN` and accepted in any case or grouping. The first 8 name the room the Worker
holds the upload in, chosen by the Worker; the last 4 are the key part, chosen by the sending device and never sent to
the Worker. The QR code holds `https://<site>/#receive=ROOMCODE.KEYP`; a URL fragment never reaches a server, and the
game clears it from the address bar once read. The shared code helpers are `packages/sync-worker/src/protocol.ts`.

**On the sending device** (`save-data/transfer-crypto.ts`), from the same `SaveFile` JSON an export writes:

1. gzip it (`CompressionStream`): ciphertext doesn't compress, so this comes first.
2. Encrypt with AES-256-GCM. The key is HKDF-SHA256 of the key part with a random 16-byte salt and the info
   `mc-save-transfer/v1/aes-gcm`; the IV is 12 random bytes; the additional data is the magic `MCT1`.
3. Upload `MCT1 | salt (16) | iv (12) | ciphertext` with `POST /transfer`, and the header `X-Transfer-Proof`: HKDF-SHA256
   of the key part with the fixed salt `mc-save-transfer/v1/proof` and info `proof`, 32 bytes in base64url.

**The Worker** keeps the bytes and a hash of the proof for 15 minutes, hands them to the first `GET /transfer/<room>`
that presents the same proof, and deletes them. A wrong room or proof answers 404, and five of those from one IP in 10
minutes block it for an hour. The receiving device decrypts, gunzips, and runs the result through `parseSaveFile`, so
a transferred file is checked exactly like an imported one.

**What it protects against.** The Worker never sees the save or the key part. Someone guessing codes must hit room and
key part together (about 59.5 bits) at no more than a few guesses an hour per IP, and a wrong guess never returns the
encrypted bytes to attack offline. The limit, stated in `transfer-crypto.ts`: whoever runs the Worker sees the proof
and could search the key part's ~20 bits, so the encryption guards against everyone but the Worker's operator.

If the Worker isn't configured, is switched off, or can't be reached, the game says online transfer is unavailable and
points to Export.

## Platforms

The web downloads the file and picks it with the browser's file picker. The Capacitor and Tauri webviews don't
download, so there export goes to the system share sheet when the webview can share files and falls back to a
download link otherwise; this path still needs checking on a device.
