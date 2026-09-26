# Phase 7, Wave 4: Cycle 3 – The Mad Titan's Shadow – Sources

> **Verified by `game-rules-architect` (2026-09-24).** The draft (content-release-tracker, same day) cited line numbers
> in `mc_rulesreference_v18_compressed.md` as "p. NNNN" and mixed older keywords in with cycle 3's. Every entry below
> was re-checked against the RRG 1.8 PDF's printed page footers (PDF page index + 1 = printed page, checked with
> `pypdf` on pp. 21, 42, 62, 67), the MC21 rulebook conversion and `marvel-champions-rulings-post-rrg-1-7.md`. Entries
> that were wrong are corrected in place, and each correction says what changed. `docs/phase7-wave4.md` §0 is the
> authority list this file feeds.

## 1. Pack list and release order

Cycle 3 is one campaign box, four hero packs and one scenario pack (RRG 1.8 Appendix VI, "Limited Environment", p. 71,
wave **4**: "The Mad Titan's Shadow campaign expansion, the Nebula Hero Pack, the War Machine Hero Pack, the Valkyrie
Hero Pack, and the Vision Hero Pack"). The Hood is a scenario pack with no player cards, so Appendix VI (a player-card
environment list) does not name it.

| Release date (Hall of Heroes) | Product                        | Type          | Contents                                                                           |
| ----------------------------- | ------------------------------ | ------------- | ---------------------------------------------------------------------------------- |
| Sept 17, 2021                 | Nebula (`nebu`)                | Hero pack     | Nebula                                                                             |
| Oct 29, 2021                  | The Mad Titan's Shadow (`mts`) | Campaign box  | Spectrum, Adam Warlock; 5 scenarios (Ebony Maw, Tower Defense, Thanos, Hela, Loki) |
| Nov 12, 2021                  | War Machine (`warm`)           | Hero pack     | James Rhodes / War Machine                                                         |
| Nov 26, 2021                  | The Hood (`hood`)              | Scenario pack | One scenario (The Hood), nine modular sets, Standard II and Expert II              |
| Jan 14, 2022                  | Vision (`vision`)              | Hero pack     | Vision                                                                             |
| Jan 21, 2022                  | Valkyrie (`valk`)              | Hero pack     | Brunnhilde / Valkyrie                                                              |

- **Corrected:** the draft said "six hero/ally kits". There are four hero packs and the box's two heroes.
- **Order.** By the Hall of Heroes dates, Nebula (Sept 17) came out before The Mad Titan's Shadow (Oct 29; its Aug 27
  US date slipped, per Hall of Heroes "Here's where to import Mad Titan's Shadow in the US", Aug 25, 2021), and Vision
  (Jan 14) before Valkyrie (Jan 21).
- **The Hood's modular sets** (Hall of Heroes The Hood page; raw `card_set_name`): Beasty Boys, Brothers Grimm,
  Crossfire's Crew, Mister Hyde, Ransacked Armory, Sinister Syndicate, State of Emergency, Streets of Mayhem, Wrecking
  Crew, plus Standard II and Expert II. **Corrected:** the draft listed "5 scenarios". There is no "Ghost Rider" set.

## 2. New rules and keywords

### 2.1 What is new in cycle 3

| Rule                             | First printed                                                  | Authority                                                         |
| -------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Additional forms ("[type] form") | `mts` (Spectrum's energy forms)                                | RRG 1.8 "Form, Change Form" (p. 21); MC21 p. 2 "Additional Forms" |
| Alliance                         | `warm` (As One!, Stand Together)                               | RRG 1.8 "Alliance" (p. 6)                                         |
| Steady                           | `hood` (Formidable Foe, The Hood's Mantle, Warehouse District) | RRG 1.8 "Steady" (p. 41); "Stun, Stunned" (p. 41)                 |
| "Swap"                           | `mts` (Loki)                                                   | RRG 1.8 "'Swap'" (p. 42); MC21 p. 24                              |
| Infinite hit points              | `mts` (Hela); first used by `gmw`'s Collector                  | RRG 1.8 "Hit Points" (p. 22); MC21 p. 20                          |
| Two main schemes, two villains   | `mts` (Tower Defense)                                          | MC21 pp. 10–11; errata RRG 1.8 p. 67; FAQ p. 62                   |
| A modular set with its own deck  | `mts` (the Infinity Stone deck)                                | MC21 p. 16                                                        |

- **Form (RRG 1.8 p. 21):** "Cards with the '[type] form' keyword grant an identity unique forms. These forms are in
  addition to the identity's alter-ego and hero forms, and they come with their own conditions for changing into them.
  When an identity changes their additional form, it does not count against the once-per-turn limit on flipping from
  hero to alter-ego (or vice versa), but it does count as changing form for the purpose of triggering card effects."
- **Alliance (RRG 1.8 p. 6):** "When a player declares their intention to play a card with the alliance keyword, any
  player(s) may help pay the costs for that card", equivalent to "While paying costs for this card, any player may
  contribute to paying those costs." "Only the player playing the card with the alliance keyword is considered to be
  resolving that card."
- **Steady (RRG 1.8 p. 41):** equivalent to "This character can have 1 additional confused status card and 1
  additional stunned status card. While this character has fewer than 2 confused status cards, it is not considered
  confused and confused status cards on it do not resolve. While this character has fewer than 2 stunned status cards,
  it is not considered stunned and stunned status cards on it do not resolve." **Corrected:** the draft gave Stalwart's
  definition ("cannot be stunned or confused") under Steady, and said MC21 p. 13 introduces it. MC21 p. 13 prints no
  Steady entry. The engine already implements Steady from the RRG (`packages/engine/src/keywords.ts`, `select.ts`);
  `docs/phase7-wave4.md` §3 checks it against The Hood's cards.

### 2.2 Not new, though MC21 p. 13's keyword list reprints them

Amplify (printed on `gmw` cards; RRG 1.8 p. 7), Hinder X, Incite X, Permanent, Piercing, Ranged, Setup, Stalwart,
Villainous and Victory X all predate cycle 3. **Corrected:** the draft listed Amplify, Villainous, Piercing, Ranged,
Victory X, Hinder X, Incite X and Permanent as "New Keywords Introduced" by the box. MC21 p. 13 is headed "Important
Keywords", a reminder list.

- MC21 p. 13 words Hinder X as "When a card with the hinder X keyword is revealed, place X threat on that card"; RRG
  1.8 "Hinder X" (p. 22) says it "enters play with X threat on it". The RRG is the later text and the engine follows it
  (docs/phase7-wave3.md §3.3).

## 3. The box's scenario rules (MC21, cited by the PDF page the conversion labels)

- **Spell environments (Ebony Maw), MC21 p. 6:** "When a player reveals a Spell environment, they place that card in
  front of them in their play area." Rules clarification, p. 7: a Spell environment "put into play" by stage 1B is not
  revealed, so its surge does not resolve; a stunned or confused Ebony Maw removes the status card instead of resolving
  his activation, and his Forced Interrupt does not trigger.
- **Two main schemes, MC21 p. 10:** both active each round; "Encounter cards that refer to 'the main scheme' refer to
  both main scheme cards"; a player card that refers to it makes its controller choose one; "If a constant effect on a
  player card refers to 'the main scheme,' that card always refers to the scheme card with the attachment 'Focused
  Defense' attached to it." **Errata (RRG 1.8 p. 67):** "When a minion schemes, that threat is placed on the main scheme
  with the attachment 'Focused Defense' attached to it." FAQ "Scenario #2 – Tower Defense" (p. 62) answers the same.
- **Two villains, MC21 pp. 10–11:** each villain places its scheme threat on its own main scheme; the active villain
  (named by Focused Defense) is the only one that activates in step 2; "Encounter cards that refer to 'the villain'
  only refer to the active villain"; a player card makes its controller choose; a constant effect on a player card means
  the active villain.
- **Avengers Tower, MC21 p. 11:** a double-sided environment, Stronghold side up at the start; damage dealt to Avengers
  Tower goes on the environment, never on the Avengers Tower support. Suggested setup damage: 1/2/3 per player
  (standard/expert/heroic).
- **The Infinity Gauntlet set, MC21 p. 16:** attach the Gauntlet to the villain at setup; not usable with more than one
  villain (or none) at the start; the six stones form the facedown "Infinity Stone deck" with its own discard pile,
  reshuffled when empty with no penalty.
- **Infinite hit points and Odin, MC21 p. 20:** Hela is one double-sided villain card, Mystic side first; flipping
  between sides resets her hit points and keeps her status cards; "If the players control the Odin ally when Hela is
  defeated, they win the game." **Corrected:** the draft cited p. 18.
- **Loki, MC21 p. 24:** five stage-I Loki cards, one at random at setup; on defeat, a random set-aside Loki is revealed;
  "When a new version of Loki enters play, transfer all attachments, status cards, counters, and tokens"; the victory
  condition is the number of Lokis in the victory display (rookie 1, standard 2, expert 3, heroic 4). A swap "does not
  cause Loki to leave play, enter play, or be revealed". Rules clarification: a Loki that gains stalwart discards its
  stunned and confused status cards. **Corrected:** the draft put this clarification under Steady.
- **Campaign-only cards, MC21 p. 4:** cards 180–193 enter a deck only when campaign instructions direct it.
- **Expert campaign, MC21 p. 25:** persistent damage (record remaining hit points, capped at base), an acceleration token
  on the main scheme heals to full at setup, a defeated player sits out the victory steps and rejoins the same way, and
  losing the Loki scenario loses the campaign.

## 4. RRG 1.8 FAQ and errata for cycle 3

**FAQ (p. 62):**

- Tower Defense: a minion's scheme threat goes on the main scheme with Focused Defense.
- In-Betweener (#42), Living Tribunal (#48), Eternity (#54), The Gardener (#60): "Where does a Cosmic Entity event go
  after it is resolved as a boost card? That event is placed in the encounter deck discard pile." (Missing from the
  draft.)
- Old Rivals (#31, Nebula): Gamora attacking this way has attacked (her attack abilities may trigger), and a Gamora ally
  takes consequential damage.
- Gauntlet Gun (#5, War Machine): its resource ability can only be triggered while paying for a War Machine event.
- Dive Bomb (#28) is printed under the War Machine heading, but Dive Bomb is `stld` 17028 (Star-Lord, cycle 2).

**Errata (p. 67; the draft's "pp. ~4896–4934" were markdown line numbers):**

- MC21 rulebook p. 10, "Two Main Schemes", paragraph 1 (above).
- Sanctuary (#116): "Thanos cannot take damage from player cards."
- Infinity Gauntlet (#129): "Permanent. Setup. Attach to the villain. Forced Response: After attached villain activates
  against you, resolve the Special ability of each Infinity Stone in play. Otherwise, put the top card of the Infinity
  Stone deck into play." (Added "Attach to the villain" and "against you". **Corrected:** the draft said a cost arrow
  became a Forced Response; the errata note names only the two additions.)
- Eros (#11, Nebula): "for each [mental] resource you used to pay for him, choose a minion and confuse it."
- Cosmo (#20, Nebula; the same card as `stld` 17020): "a player deck or the encounter deck".
- Old Rivals (#31, Nebula): reminder text made rules text.
- James Rhodes (#1B): added "(Limit once per phase.)".
- Aragorn (#7, Valkyrie): "You get +4 hit points and gain the Aerial trait."
- Shieldmaiden (#11, Valkyrie, an **event**; the draft said upgrade): Defense trait and the "(defense)" label.
- Beguiled (#31, Valkyrie): Condition trait and the quoted When Revealed.
- Machine Man (#22, Vision, an **ally**; the draft said upgrade): "for this use".

## 5. FFG rulings touching cycle 3 (`marvel-champions-rulings-post-rrg-1-7.md`)

Replaced. The draft's list cited several rulings that do not touch these packs (Jan 11, 2026 (2) Cap's Shield; Jan 17,
2026 (2); Mar 6, 2026 (3) Wonder Man; Jun 2, 2026 (3), a Galaxy's Most Wanted ruling) and missed several that do.

| Ruling                                     | What it settles                                                                                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dec 17, 2025 (1) #3                        | Beguiled: the ally does not leave play and no minion enters play; it keeps its tokens and attachments ("essentially a status change").                                      |
| Dec 17, 2025 (4) #2                        | Odin (King side) defeated by consequential damage is removed from the game by his Forced Interrupt before Med Lab can respond.                                              |
| Jan 17, 2026 (4) #2                        | Paying for Repulsor Beam with two Gauntlet Guns places two ammo counters.                                                                                                   |
| Jan 17, 2026 (5)                           | The Wrecking Crew: a played Cosmic Entity event shuffles into the active villain's encounter deck.                                                                          |
| Jan 26, 2026 (4) #5, #7                    | A Drone minion's facedown side is not in play (Ultron, Vision's nemesis); the Valkyrie hero does not share a title with the Valkyrie ally.                                  |
| Feb 28, 2026 (3)                           | God of Lies (`tt`): swapping one Loki for another moves permanent attachments to the swapped-in villain ("scenario intent takes precedence"). The same swap as MC21's Loki. |
| Feb 28, 2026 (8) #1                        | Infinity Stones discarded after their Special go into The Collection (Infiltrate the Museum with the Infinity Gauntlet set).                                                |
| Mar 19, 2026 (4)                           | Under RRG 1.7's unique rules the Valkyrie Aggression ally (no subtitle) may be in a Valkyrie hero deck.                                                                     |
| Jun 25, 2026 (4) #1, #5                    | Old Rivals: "Gamora attacks you" is the minion, the second sentence the hero or ally. Odin attached to Odin's Torment is not a friendly character.                          |
| Aug 3, 2026 (4) #1                         | Odin attached to the main scheme cannot have attachments (Possessed cannot target him).                                                                                     |
| General: Jan 17, 2026 (3); Aug 3, 2026 (3) | Piercing has timing priority over triggered abilities; surge is a When Revealed ability and can be cancelled.                                                               |

## 6. Taboo list

Hall of Heroes' taboo list is community-maintained, not FFG's. It is not applied (CLAUDE.md: RRG, FAQ and errata only).
