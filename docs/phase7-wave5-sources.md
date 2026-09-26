# Phase 7, Wave 5: Cycle 4 – Sinister Motives – Sources

> **Status:** In preparation for Phase 7 wave 5, cycle 4 (Sinister Motives) card scripting.
> **Scope:** Campaign box MC27, hero packs Nova/Ironheart/Spider-Ham/SP//dr; no scenario pack in cycle 4.
> **Note on RRG citations:** printed page = PDF page index + 1. Checked with `pypdf` by the main session: Requirement (Resources) p. 37, Steady p. 41, Appendix VI p. 71.

---

## 1. Pack list and release order

Cycle 4 is one campaign box and four hero packs (no scenario pack). Per **RRG 1.8 Appendix VI, "Limited Environment", cycle 4** (printed page 71 of the PDF, which indexes as page 70):

> **5.** The _Sinister Motives_ campaign expansion, the _Nova Hero Pack_ , the _Ironheart Hero Pack_ , the _Spider-Ham Hero Pack_ , and the _SP//dr Hero Pack_ .

| Release date (Hall of Heroes) | Product                  | Type         | Contents                                                                           |
| ----------------------------- | ------------------------ | ------------ | ---------------------------------------------------------------------------------- |
| April 8, 2022                 | Sinister Motives (`sm`)  | Campaign box | Ghost-Spider (Gwen Stacy), Spider-Man (Miles Morales); 5 scenarios; campaign cards |
| May 20, 2022                  | Nova (`nova`)            | Hero pack    | Sam Alexander / Nova                                                               |
| May 20, 2022                  | Ironheart (`ironheart`)  | Hero pack    | Riri Williams / Ironheart                                                          |
| July 15, 2022                 | Spider-Ham (`spiderham`) | Hero pack    | Peter Porker / Spider-Ham                                                          |
| July 15, 2022                 | SP//dr (`spdr`)          | Hero pack    | Peni Parker / SP//dr                                                               |

- **No scenario pack** in cycle 4's release window (Mojo Mania is cycle 5, November 11, 2022).
- **Order note:** Nova and Ironheart released together (May 20); Spider-Ham and SP//dr released together (July 15).

---

## 2. The Sinister Motives box rulebook (MC27)

**Source documents:**

- PDF: `docs/campaign-modes/mc27_sinister_motives_rules_v5-compressed.pdf` (24 pages)
- Markdown conversion: `docs/campaign-modes/markdown/mc27_sinister_motives.md`

**Sections in the rulebook (from the markdown TOC):**

- Page 2: Components and villain card overview (Sandman, Venom, Mysterio, Sinister Six, Venom Goblin)
- Page 3: Featured Keywords (Hinder X, Team-Up, Incite X, Patrol, Permanent, Piercing, Requirement (Resources), Setup, Stalwart, Villainous, Victory X, Steady; Victory Display; Amplify icon)
- Pages 4–8: Campaign mode rules (prohibited cards: Venom Eddie Brock #190, Symbiote Suit #191; campaign-specific player cards 182–189; campaign encounter cards 176–180, the "Campaign - Community Service" modular)
- Pages 9–19: Five scenarios (Sandman, Venom, Mysterio, Sinister Six, Venom Goblin) with setup, villain rules, and modular sets
- Page 20: Starter deck listings for Ghost-Spider and Spider-Man (Miles)
- Page 21: Frequently Asked Questions
- Pages 22–24: Reputation track reference, victory conditions, credits

**Notable features:**

- Reputation track system (a new campaign mode mechanic for cycle 4)
- S.H.I.E.L.D. Tech upgrade set (campaign-specific player cards)
- Community Service modular set (campaign-specific encounter cards)
- Scenario mechanics named in the rulebook text: Venom's Vengeance (a Forced Response after Venom is attacked and damaged), the Sinister Six's activation order and active counter, Venom Goblin's glider counter. The architect's survey covers the rest from card text.

**Conversions note:** The markdown conversion captures text and structure but does not include the full-page illustrations or some callout graphics from the PDF. Page numbers in the markdown correspond to printed page numbers in the PDF (printed page = PDF index + 1 for the campaign rulebooks).

---

## 3. RRG 1.8 and official rulings for cycle 4

### 3.1 Keywords the box features

MC27 p. 3 lists its featured keywords: Hinder X, Team-Up, Incite X, Patrol, Permanent, Piercing, **Requirement
(Resources)**, Setup, Stalwart, Villainous, Victory X, Steady, plus the Victory Display and the Amplify icon.

- **Requirement (Resources)** (MC27 p. 3; RRG 1.8 "Requirement (Resources)", p. 37): "A card with the requirement
  keyword cannot be played unless each resource of the specified type is spent while paying for that card's cost." This
  is a **play restriction checked when the cost is paid**, not a deckbuilding rule.
- **Steady** (RRG 1.8 p. 41) is not new: the engine already has it from earlier waves. The architect should check which
  cycle 4 cards print it rather than rely on this doc.
- **Web-Warrior** is a trait, not a keyword. It is printed in `sm`, `spiderham` and `spdr` (raw JSON hits: 36, 42, 18;
  none in `nova` or `ironheart`). Which cards reference it in their text is for the architect's card survey.

### 3.2 FFG rulings in `marvel-champions-rulings-post-rrg-1-7.md` touching cycle 4 cards

Found by matching every cycle 4 card name against the rulings file (with `**` stripped), then reading each hit; hits
where the name belongs to a different card (Falcon's Aerial Evacuation, Daredevil's Raising Hell, "Energy" in other
cards' names) are excluded.

| Ruling (date heading)        | Card(s) (pack)                              | Summary                                                                                                                                       |
| ---------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| December 17, 2025 - Ruling 3 | Concussive Bombs 27137 (`sm`)               | "After the villain attacks you": same triggering condition as Drax's Payback; the ruling settles character vs player and card origin.         |
| January 11, 2026 - Ruling 3  | Bring the War! vs Supernova Helmet (`nova`) | Only a printed resource in the resource area counts; the resource in Supernova Helmet's ability text does not.                                |
| January 11, 2026 - Ruling 4  | Bombshell (`ironheart`)                     | Against a guard minion with only the villain otherwise in play, all her divided damage goes to the minion; the villain is not a valid target. |
| January 26, 2026 - Ruling 1  | Ms. Marvel ally (`nova`)                    | Her cost (damage + exhaust) is not a damage-only ability, so she stays a valid target under Go for Champions!.                                |
| January 26, 2026 - Ruling 2  | Captain Americat (`spiderham`)              | An all-purpose counter placed on a card takes that card's counter type (Cameo toon counter on Drax).                                          |
| March 30, 2026 - Ruling 1    | George Stacy (`sm`)                         | "(to a maximum of X)": local vs global maximum.                                                                                               |
| April 30, 2026 - Ruling 2    | Return the Favor (`sm`)                     | Cost → effect events: paying the cost engages a guard/patrol minion, or leaves the hero stunned/confused.                                     |
| June 25, 2026 - Ruling 3     | Go All Out (`ironheart`)                    | Interaction with "The Best Offense..." (THW/ATK replaced by DEF).                                                                             |
| June 25, 2026 - Ruling 6     | Clarity of Purpose (`spdr`)                 | Damage taken as a cost can be reduced to 0 and the cost is still paid.                                                                        |
| July 9, 2026 - Ruling 2      | Clarity of Purpose (`spdr`)                 | "Reduce" and "prevent" are synonymous for cost damage.                                                                                        |
| August 3, 2026 - Ruling 4    | Sinister Motives campaign (#2)              | "No. Negative victory points do not mark nodes on the reputation track."                                                                      |

Read each ruling in full before scripting its card; the summaries above are pointers.

---

## 4. Errata and taboo entries affecting cycle 4

### 4.1 Taboo list

The Hall of Heroes taboo list is **unofficial (community)** and is not an authority for this repo (CLAUDE.md: RRG, FAQ
and errata only). The tracker's first draft reported an Ironheart entry that could not be read coherently; it was not
verified and is **dropped**. Nothing from the taboo list is implemented.

### 4.2 Errata (RRG 1.8 and MC27 FAQ)

No cycle 4 card text errata was found in this pass. The architect's card survey should check RRG 1.8's errata pages
(cycle 4 FAQ/errata entries) and the MC27 FAQ (MC27 p. 21) directly, and record anything found in the spec's §0.

---

## 5. Precon decklists (starter decks)

All four hero packs in cycle 4 include pre-built starter decks. The campaign box (SM) includes two precon decks:

| Hero                       | Pack             | Release      | Starter Deck Link                                                 |
| -------------------------- | ---------------- | ------------ | ----------------------------------------------------------------- |
| Ghost-Spider (Gwen Stacy)  | Sinister Motives | Apr 8, 2022  | Hall of Heroes Sinister Motives page (embedded image)             |
| Spider-Man (Miles Morales) | Sinister Motives | Apr 8, 2022  | Hall of Heroes Sinister Motives page (embedded image)             |
| Nova (Sam Alexander)       | Nova             | May 20, 2022 | https://hallofheroeslcg.com/wp-content/uploads/2022/05/deck1.jpeg |
| Ironheart (Riri Williams)  | Ironheart        | May 20, 2022 | https://hallofheroeslcg.com/wp-content/uploads/2022/04/card.jpg   |
| Spider-Ham (Peter Porker)  | Spider-Ham       | Jul 15, 2022 | https://hallofheroeslcg.com/wp-content/uploads/2022/07/sd.jpg     |
| SP//dr (Peni Parker)       | SP//dr           | Jul 15, 2022 | https://hallofheroeslcg.com/wp-content/uploads/2022/07/z1.jpg     |

**Status in the codebase:** Starter decks for Nova, Ironheart, Spider-Ham, and SP//dr are already in `packages/content/src/data/<pack>/starterDecks.ts`. The `card-data-pipeline` agent should verify that the deck lists match the Hall of Heroes images before scripting (or after, as a regression check).

---

## 6. For the rules architect

Grounded in the MC27 rulebook; everything about hero kits is left to the architect's survey of the card text, since
this pass did not read the hero cards.

- **Reputation Track** (MC27 p. 5, track on p. 22): a group score marked node by node after each scenario from the
  "Conditions" section; white boxes resolve once when their node is marked, pink boxes add Setup instructions to every
  remaining scenario; reputation past the last node is still recorded for the final score. Negative victory points
  mark no nodes (August 3, 2026 - Ruling 4 #2).
- **Prohibited cards** (MC27 p. 4): Venom (Eddie Brock) 190 and Symbiote Suit 191 cannot go in player decks, and the
  Osborn Tech modular (147–152) cannot be used, "unless a campaign rule states otherwise".
- **Campaign-specific player cards** (MC27 p. 4): 182–189, deckbuilding classification "Campaign - S.H.I.E.L.D. Tech";
  campaign mode only.
- **Glider counter** (Venom Goblin, MC27 pp. 17–19): scenario-specific counter; check whether an existing counter
  primitive covers it.
- **Requirement (Resources)**: a play-time check on the resources spent (§3.1).

## 7. Open items

1. **Precons:** confirm `starterDecks.ts` for `nova`, `ironheart`, `spiderham`, `spdr` against their decklists, and
   Ghost-Spider/Miles Morales against MC27 p. 20 (step 2, `card-data-pipeline`).
2. **Errata:** check RRG 1.8's errata pages for cycle 4 entries (§4.2).
3. **Hero kits** (Ghost-Spider, Miles Morales, Nova, Ironheart, Spider-Ham, SP//dr): not surveyed here; the spec's §2–§3
   covers them from the card text.

---

## Sources (Hall of Heroes pages)

- [Sinister Motives](https://hallofheroeslcg.com/sinister-motives/)
- [Nova / Sam Alexander](https://hallofheroeslcg.com/sam-alexander-nova/)
- [Ironheart / Riri Williams](https://hallofheroeslcg.com/ironheart-riri-williams/)
- [Spider-Ham / Peter Porker](https://hallofheroeslcg.com/spider-ham-peter-porker/)
- [SP//dr / Peni Parker](https://hallofheroeslcg.com/peni-parker-sp-dr/)
- [Marvel Champions LCG Unofficial Taboo List](https://hallofheroeslcg.com/marvel-champions-lcg-unofficial-taboo-list/)
- [Latest FFG Rulings (post-RRG 1.7 & 1.8)](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/)
- [Errata Pack](https://hallofheroeslcg.com/errata-pack/)

## Internal sources

- `mc_rulesreference_v18_compressed.pdf` (July 2026), Appendix VI (p. 71)
- `mc_rulesreference_v18_compressed.md` (searchable markdown conversion)
- `docs/campaign-modes/mc27_sinister_motives_rules_v5-compressed.pdf`
- `docs/campaign-modes/markdown/mc27_sinister_motives.md`
- `marvel-champions-rulings-post-rrg-1-7.md`
- `packages/content/src/data/nova/starterDecks.ts`
- `packages/content/src/data/ironheart/starterDecks.ts`
- `packages/content/src/data/spiderham/starterDecks.ts`
- `packages/content/src/data/spdr/starterDecks.ts`
