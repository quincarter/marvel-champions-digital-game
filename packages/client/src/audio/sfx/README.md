# Sound effects

The game's short sounds (#191). They live here, outside the repo's `music/` folder, so the jukebox, the music
player and the shuffle never list them. The music controller plays them over the music
(`audio/music-controller.ts`, `playEffect` / `playEffects`), loading each file the first time it is needed. Sound off
in Settings mutes them with the music.

| File                      | Plays                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `extras-unlocked.mp3`     | Something new opens in Extras (with the "New song earned" notice, `scenes/music-button.ts`) |
| `hand-refill.mp3`         | A hand draws up to its hand size at the end of the player phase                             |
| `basic-attack.mp3`        | A basic attack: the Attack button (hero or ally), or a card that has a character make one   |
| `basic-thwart.mp3`        | A basic thwart, the same two ways                                                           |
| `card-played.mp3`         | A card played (events too), or a card entering play on either side                          |
| `spell-cast.mp3`          | A played card with the Spell trait, in place of `card-played`                               |
| `cloak-of-levitation.mp3` | Doctor Strange uses Cloak of Levitation's ability                                           |
| `shield-toss.mp3`         | Captain America plays Shield Toss, in place of `card-played`                                |

When one command makes several, they play in order, each starting as the one before ends (at most 600 ms in): the
card's sound, then its attack or thwart, then the refill (`tableSoundsOf` in `view/sound-effects.ts`).

## Adding one

1. **The file.** Put the MP3 here, named for what it is (`kebab-case.mp3`). Keep it short: if the source runs on
   past the sound, trim it with `node scripts/trim-mp3.mjs <in.mp3> <out.mp3> <seconds>`, which cuts by whole MP3
   frames with no re-encoding. Pick a cut where the sound has died away.
2. **Its name.** Add it to `SoundEffect` and `SOUND_EFFECT_VOLUME` in `view/sound-effects.ts` (volumes sit around
   0.6–0.7, under the music).
3. **Its file.** Import it with `?url` in `audio/music-controller.ts` and add it to `SOUND_EFFECT_URLS`.
4. **When it plays.**
   - **A card's own sound** (played, or one of its abilities used): add the card's printed name to `CARD_SOUNDS` in
     `view/sound-effects.ts`. That is all; the board already asks for it.
   - **Something on the table** (a kind of command or event): extend `tableSoundsOf`, which the board
     (`scenes/board.ts#onState`) calls with each new command and its events. Read the command trail, never
     `lastEvents` alone: the store appends the trail just after a command's state lands, and reading it is what keeps
     a back out or a resumed game's past silent.
   - **Anywhere else:** `appSession().music?.playEffect("<name>")`.
5. **A test** in `view/sound-effects.test.ts` for when it plays, and a changie fragment (`Added`).

Never put a sound effect under `music/`: everything there is a song the jukebox lists and the shuffle can pick.
