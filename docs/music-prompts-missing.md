# Music prompts for every empty slot (2026-10-10)

Every scenario and campaign slot in `music/` that has no track today, with a prompt and a title for each. 53 tracks:
23 for wave 9 and 30 for earlier boxes. The titles here are the ones to use for the files and the `TRACK_TITLES`
entries, whatever name the generator gives the download. None repeats a title already in the jukebox.

How to use: paste the **style block**, then one **length line**, then the track's own description.

## Style block (paste first, every time)

> Instrumental only, no vocals, no lyrics, no spoken words, no sound effects. Cinematic orchestral superhero score with
> modern hybrid production: full strings, bold brass, driving percussion, subtle synth textures. Heroic comic-book
> adventure tone, clear melodic theme, polished studio mix. No copyrighted melodies and no imitation of any existing
> film theme.

## Length lines (paste one)

- **Battle:** About 3 minutes. Steady energy from start to finish so it can loop: no long intro, no fade-out, end on a
  phrase that leads back into the opening.
- **Villain wins** (the players lose): About 45 to 60 seconds. The villain's theme in triumph, dark and final, ending on
  a held chord.
- **Heroes win** (the villain loses): About 45 to 60 seconds. The villain's theme breaks apart and a heroic fanfare
  takes over, ending bright and resolved.
- **Campaign interlude:** About 2 minutes. Calm and reflective, low intensity, loops cleanly; music for reading a
  campaign log between missions.
- **Campaign finale:** About 2 minutes. Builds from quiet relief to a full triumphant statement and a long, warm ending.

## Wave 9: Agents of S.H.I.E.L.D. (`aos`)

**Black Widow** (`scenarios/black-widow/`). Spy thriller: tense pizzicato strings, muted brass stabs, a cold Russian
folk-tinged melody on cimbalom or balalaika, ticking percussion, sudden bursts of action.

- `battle`: **Red Room Protocol**
- `villain-wins`: **The Widow's Bite**
- `villain-loses`: **Cover Blown**

**Batroc** (`scenarios/batroc/`). Swaggering mercenary acrobat: fast French-flavored accordion and gypsy-jazz guitar
figures over a punchy action orchestra, playful and arrogant, quick leaping rhythms.

- `battle`: **The Leaper's Gambit**
- `villain-wins`: **Paid in Full**
- `villain-loses`: **Contract Canceled**

**M.O.D.O.K.** (`scenarios/modok/`). Mad science: pulsing analog synth arpeggios, theremin-like lead, heavy low brass,
mechanical percussion like a lab running out of control; menacing but slightly absurd.

- `battle`: **Designed Only for Killing**
- `villain-wins`: **A Superior Intellect**
- `villain-loses`: **System Failure at A.I.M.**

**Thunderbolts** (`scenarios/thunderbolts/`). False heroes: a bright, noble fanfare that keeps bending into minor keys
and dissonance, snare-driven march, several short competing motifs for a team of villains wearing masks.

- `battle`: **Justice, Like Lightning**
- `villain-wins`: **Heroes in Name Only**
- `villain-loses`: **Masks Off**

**Baron Zemo** (`scenarios/baron-zemo/`). Aristocratic mastermind and a traitor inside S.H.I.E.L.D.: cold harpsichord
and solo cello over a dark European waltz that swells into full orchestra, paranoia and intrigue, a slow reveal.

- `battle`: **The Baron's Design**
- `villain-wins`: **Thirteenth Baron Triumphant**
- `villain-loses`: **The Mole Exposed**

**Campaign** (`campaigns/aos/`). S.H.I.E.L.D. itself: confident, disciplined, helicarrier-at-dawn feel; warm brass
chorale, steady snare, a hint of spy-film guitar.

- `interlude`: **Briefing on the Helicarrier**. Quiet version: soft strings, muted trumpet, a distant radio-room pulse.
- `finale`: **Agents Assembled**

## Wave 9: Trickster Takeover (`tt`)

**Enchantress** (`scenarios/enchantress/`). Asgardian sorceress and hypnosis: shimmering harp and celesta, a seductive
solo violin, wordless-sounding woodwinds (no voices), swirling 6/8 rhythm that feels like falling under a spell, with
sudden imperious brass.

- `battle`: **The Hypnotic Gaze**
- `villain-wins`: **All Hearts Are Hers**
- `villain-loses`: **The Spell Is Broken**

**God of Lies** (`scenarios/god-of-lies/`). Loki as a reality-bending god with many false copies of himself: a
mischievous theme that keeps changing instruments and key, mirrored phrases, sudden silences and fake endings, building
to a huge, epic, many-heroes-at-once climax.

- `battle`: **A Thousand Lokis**
- `villain-wins`: **Mischief Managed the World**
- `villain-loses`: **The Last Illusion Fades**

## Earlier boxes: scenarios with no music

**Klaw** (`scenarios/klaw/`, Core Set). A man made of living sound and an arms dealer: distorted bass pulses, sonic
sweeps, metallic percussion, heist-movie groove with African drums underneath.

- `battle`: **The Sound of Vibranium**
- `villain-wins`: **Master of Sound**
- `villain-loses`: **Silence, at Last**

**Risky Business** (`scenarios/risky-business/`, The Green Goblin). Norman Osborn the ruthless businessman turning into
the Goblin: slick corporate noir (walking bass, muted trumpet) that keeps lurching into manic, cackling orchestral
chaos.

- `battle`: **Hostile Takeover**
- `villain-wins`: **Osborn Always Wins**
- `villain-loses`: **Stock in Freefall**

**Mutagen Formula** (`scenarios/mutagen-formula/`, The Green Goblin). The Goblin on his glider with an army of goblin
thralls over the city: frantic, carnival-of-horrors orchestra, shrieking strings, galloping rhythm, wicked glee.

- `battle`: **Pumpkin Bombs Over Manhattan**
- `villain-wins`: **A City of Goblins**
- `villain-loses`: **The Glider Goes Down**

**The Wrecking Crew** (`scenarios/breakout/`). Four super-strong brawlers breaking out of prison: heavy stomping
blues-rock riff with anvils, low brass and big drums, loud, dumb and fun.

- `battle`: **Four Against the World**
- `villain-wins`: **Wrecked**
- `villain-loses`: **Back Behind Bars**

**Kang** (`scenarios/kang/`, The Once and Future Kang). Conqueror from the future fighting across several timelines:
grand imperial brass over ticking clocks and reversed textures, tempo and era shifting (ancient, modern, futuristic)
within one piece.

- `battle`: **Conqueror of All Tomorrows**
- `villain-wins`: **History Belongs to Kang**
- `villain-loses`: **Time Runs Out**

**Absorbing Man** (`scenarios/absorbing-man/`, The Rise of Red Skull). A brawler who becomes whatever he touches: one
bruising theme restated in changing textures (stone, steel, ice, fire), wrecking-ball percussion, chain rattles as
rhythm.

- `battle`: **Whatever He Touches**
- `villain-wins`: **Ball and Chain**
- `villain-loses`: **Nothing Left to Absorb**

**Taskmaster** (`scenarios/taskmaster/`, The Rise of Red Skull). Mercenary who copies every hero's moves: sharp,
precise martial percussion and staccato strings, a theme that mimics heroic fanfares and twists them, cool and
professional.

- `battle`: **Photographic Reflexes**
- `villain-wins`: **Lesson Learned**
- `villain-loses`: **Class Dismissed**

**Zola** (`scenarios/zola/`, The Rise of Red Skull). Hydra's bio-engineer, a mind in a machine, in a lab of mutated
experiments: eerie retro electronics, detuned organ, crawling low strings, sudden monstrous brass.

- `battle`: **The Bio-Fanatic**
- `villain-wins`: **A Mind That Cannot Die**
- `villain-loses`: **The Screen Goes Dark**

**Red Skull** (`scenarios/red-skull/`, The Rise of Red Skull). Hydra's supreme leader with the Cosmic Cube: a massive,
merciless march in low brass and timpani, cold choir-like synth pads (no voices), cosmic shimmer rising over it.

- `battle`: **Hail the Skull**
- `villain-wins`: **The Cube Is His**
- `villain-loses`: **Cut Off One Head**

## Earlier boxes: campaigns with no interlude

Each of these has a finale already and nothing between scenarios.

- `campaigns/trors/interlude`: **Following Hydra's Trail**. The Rise of Red Skull: wartime-adventure feel, quiet snare
  and solo trumpet, a map-table mood, resolve under tension.
- `campaigns/gmw/interlude`: **Adrift Among the Stars**. The Galaxy's Most Wanted: laid-back space-western, warm
  synth pads, twangy guitar, the hum of a ship between jobs.
- `campaigns/mts/interlude`: **The Quiet Before Titan**. The Mad Titan's Shadow: solemn and cosmic, low strings and
  distant horns, a slow heartbeat pulse, dread held in check.

## Not on this list, on purpose

- The five Galaxy's Most Wanted scenarios each have a battle track only; their win and loss music is the box's shared
  pair in `music/packs/gmw/`. Say so if you want individual ones and I'll add 10 more prompts.
- No campaign has its own `battle` track; every scenario with a battle track uses that instead.

## Where the files go

Send the mp3s with a line saying which is which. A track for a scenario or campaign that is not playable yet (all of
wave 9 today) goes into `music/scenarios/_pending/<scenarioId>/` or `music/campaigns/_pending/<campaignId>/`; one for
a playable scenario goes straight into `music/scenarios/<scenarioId>/` or `music/campaigns/<campaignId>/` with its
`TRACK_TITLES` entry.
