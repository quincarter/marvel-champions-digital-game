# Competitive Mode plan (Civil War, MC56)

Status: plan only, no code. Written 2026-10-11 for wave 10 (scaffolding) and the Multiplayer phase (PLAN.md Phase 5).

Decision (owner, 2026-10-11): wave 10 ships Civil War in **cooperative play only**. Competitive mode is built in the
Multiplayer phase. The client says "Competitive mode coming soon" where a player would look for it, and wave 10 builds
the scaffolding in section 4 so that the mode is a matter of adding a second team as data, then the work in section 5.

Sources. "MC56" is `docs/campaign-modes/mc56_rulebook-web_1.pdf` (20 pages; page numbers are PDF pages, which match the
printed ones), read through the rough transcription `docs/campaign-modes/markdown/mc56_civil_war.md`. The transcription
of p. 15 (the table diagram) is garbled and the PDF could not be rendered when this was written, so the table layout in
1.2 is read from the labels and needs a look at the page. "Ruling" is `docs/rulings/marvel-champions-rulings-post-rrg-1-7.md`. "RRG"
is RRG 1.8. Card text is from `packages/content/raw/marvelcdb/cw.json` (top level is an object, `{ source, fetchedAt,
pack, cards: [...] }`; 214 records; a two-sided card's back face is the record's `linked_card`, so 234 faces).

## 1. The rules of competitive mode

### 1.1 Shape of the mode

- Two teams compete "to see which side will defeat the enemy team's leader first". The game otherwise plays as a normal
  game "with a few twists". (MC56 p. 6.)
- 1v1 (one registration player against one resistance player) or 2v2. (p. 14.) Nothing allows 3 or 4 players on a team.
- A **leader** is a card type that works "exactly the same" as a villain; the only difference is that "players can team
  up with their chosen leader in competitive play". Rules and abilities that affect villains affect leaders the same way
  (p. 3; RRG "Leader", p. 26). So in a competitive game each team has a leader of its own side, and that leader is the
  villain the **other** team fights.
- Each team picks a different side, registration (Iron Man or Captain Marvel) or resistance (Captain America or
  Spider-Woman). (pp. 4, 14.)

### 1.2 Setup (pp. 4, 5, 14, 15)

1. Each team builds the scenario the other team will face, with the custom scenario steps of pp. 4 to 5: a side, a
   leader of that side, three or four modular sets of that side (sides are not mixed), the leader's own 10-card set, the
   **Standard PvP set in place of the Standard set**, and one main scheme stage 1 plus one stage 2 of that side. Modular
   sets from other products are cooperative-only; in competitive mode only registration or resistance sets are legal (p.
   5). The two teams may pick different numbers of modular sets (FAQ, p. 20).
2. A team cannot use an identity that shares a title with its own leader, so Iron Man's team cannot field the Iron Man
   hero (pp. 14, 16).
3. The teams sit across from each other. Each team finds its chosen leader's four basic player cards and sets them
   aside; its players can earn them during the game (pp. 14, 16).
4. The teams **trade scenarios**: each team faces the leader, main scheme deck and encounter deck the other team built.
   A team brings exactly one scenario however many players it has (p. 14). The facing team therefore does not know what
   is in the deck it is about to face; that is the point of the mode (p. 6).
5. Then the normal setup rules apply (p. 14). Each identity's obligation is still shuffled into the encounter deck
   (FAQ, p. 20), which by 4 is the deck that player faces.
6. Table layout (p. 15, from the labels): each team's half has its players' heroes, decks and play areas, and, facing
   them, the enemy leader, the encounter deck, the main scheme deck, the Choosing Sides side scheme and a first player
   token.

Every stage 1A main scheme carries the mode's setup hook: in competitive mode "the enemy team finds the Choosing Sides
side scheme and your team reveals it"; in cooperative mode the chosen leader's own side scheme is found and revealed
instead (all eight 1A cards, 56063a and others, see 2.2). Each leader's Setup (or, in stage III, When Revealed) has the
enemy team find the card the leader needs (Energy Channel, Cap's Shield, Finesse, an Iron Man attachment).

"Find" (p. 9) searches every area where the card could be, but not the victory display, removed cards, or facedown
encounter cards dealt to players.

### 1.3 Who controls what

- Each team plays **only its own side of the table**. Its heroes act, its villain phase activates the enemy leader and
  the minions in its own game area, against its own heroes, from the encounter deck the other team built.
- Card abilities on a side "completely ignore cards on the other side of the table unless they specifically refer to
  them". (p. 16.) "Cards in your opponent's game area are not in play in your game area". (p. 20.)
- Wording, in a team's own area (pp. 16, 20):

| Phrase                         | Means                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| the villain / the enemy leader | the leader in your game area (the one you fight)                                               |
| your leader                    | the leader in your opponents' game area (the one your team teamed up with)                     |
| the enemy team                 | the players on the team you are playing against                                                |
| your team / the players        | the players on your team; "each player" and per-player (per hero) values count your team only  |
| enemy / enemies                | the leader you fight and the minions on your side; **not** the opponents' allies or identities |

- **Who makes the choices the text gives to the enemy team** ("the enemy team searches the encounter deck…", "the enemy
  team exhausts a character you control", "the enemy team attaches Drafted…"): the opposing team's players. They built
  the deck, so they are the ones who can search it, and the facing team "reveals" what they find. That is why those
  verbs are written the way they are.
- **Cooperatively** (p. 6) there is only one team: the leader in play is "the enemy leader" and is the villain; "the
  enemy team" refers to the players; those abilities are resolved "using the grim rule: imagine what an opponent would
  do if it were their choice"; an ability that refers to "your leader" cannot be resolved, "These cards typically have
  alternate effects that will resolve instead. Do as much as you can." The rulebook does not name which player makes the
  grim choice (Q1).

### 1.4 Round structure and turn order (p. 16, p. 20 quick reference)

The registration team goes first each round. A round is:

1. The registration team plays its entire hero phase, including readying and refilling hands.
2. The resistance team plays its entire hero phase.
3. The registration team plays its entire villain phase.
4. The resistance team plays its entire villain phase.

During the other team's phases "your side of the table is inactive" and its players observe, to catch missed effects. In
2v2 each team has its own first player token, which passes at the end of that team's villain phase. There is no
simultaneous play across teams anywhere in the rules. Within a team the normal Hero Phase freedom (any player order)
applies, and a team's villain phase is the normal one run on its own area (threat on its main scheme, encounter cards
dealt to its players, and so on). A player with several facedown encounter cards must reveal them in the order dealt (p.
16).

### 1.5 How the two sides coexist (pp. 15, 16)

- Two game areas, one per team. Each holds one leader, one main scheme deck, one encounter deck (with its own discard
  pile) and that team's players. A leader is both "the enemy leader" in its own area and "your leader" to the other
  team.
- The **unique rule** applies only among a team's own cards: "Unique enemy cards have no impact on unique friendly
  cards", and a leader counts as friendly to its team, minions in its deck do not (p. 16; FAQ, p. 20). A hero may not be
  fielded if it shares a title with the team's chosen leader (p. 16).
- Encounter cards from a leader's own set that name the leader by title mean only that leader, not a hero or ally of the
  same name (p. 16).
- Effects do cross between the areas when a card says so, and the set is built around that: the enemy leader attacks
  "your leader" (below); minions move between areas (Drafted 56080 moves a minion engaged with an enemy player to
  engage you; Recruited by Cap 56209 does the reverse); an ally can change sides (Switching Sides 56158); threat moves
  between the two main schemes (Neighborhood Hero 56183, Double Agent 56211, Spectacular! 56182, Cloak 56194, Darkforce
  56196); the leader's attachments are searched and discarded from the other side (Bullseye 56088). A minion defeated
  returns to the discard pile of the deck it came from, and so does a Drafted on it (FAQ, p. 20).

**Leader attacks leader** (p. 16): these attacks ignore guard and nobody may declare a defender. In order:

1. The attacking leader is given a facedown boost card from its encounter deck.
2. The first player on the **defending leader's team** turns it faceup and resolves it.
3. It goes to that deck's discard pile.
4. The attacker deals damage equal to its total ATK to the defending leader.

The quick reference (p. 20) words the same thing from the attacked side: the first player on your team gives the enemy
leader the boost card and resolves it. Both readings agree: the leader doing the attacking sits in the area of the team
whose leader is being attacked, and that team's first player does the boost. Energy Channel (56098) triggers when a
leader attacks Captain Marvel, so a leader-versus-leader attack can set it off, and then Captain Marvel attacks that
leader (FAQ, p. 20).

### 1.6 The Standard PvP set and the leader player cards

- **Standard PvP** (p. 3): a five-card encounter set that takes the place of the Standard set (56125 to 56128 and a
  second printing, 56203 to 56206). Righteous Cause makes the enemy leader scheme (an extra boost card if your team has
  more than one player); Whatever It Takes has the enemy leader attack your leader (alter-ego) or you (hero); Targeted
  Strike (two copies) lets the enemy team search the top 5 of the deck and deal you a card, with a boost that scales
  with your team's size; **Choosing Sides** is a permanent side scheme (the enemy leader takes at most 2 damage from
  each attack) which, when its last threat is removed, has the enemy team find per-hero encounter cards to deal and
  flips to Now It's Personal.
- **Leader player cards** (pp. 3, 16): each leader comes with four basic player cards, "used only when playing in
  competitive mode". They start set aside. Defeating Choosing Sides earns two of them (p. 16). The card's own back says
  to give it to the first player; its Action (remove it from the game) has each player on the team choose 2 of the
  leader's set-aside cards and add them to their hand (56128b, 56206b). Once a player has earned two, they are part of
  that player's deck for the rest of the game (p. 16). See Q12.

### 1.7 Winning and losing (pp. 17, 20)

Three ways to win: defeat the enemy leader first; have your leader complete its main scheme 2B first; have your leader
defeat all your opponents' identities first. The wording of the second and third is the mirror: a team **loses** when
the scheme in its own area (the enemy leader's) completes, or when each of its heroes is defeated. Every stage 2B prints
"If this stage is completed, the players lose the game".

"The game does not end until both sides have played an equal number of phases." If the registration team (which goes
first) is the first to lose, play continues through the end of the resistance team's next phase; if resistance also
loses in that time, **both teams lose**. If the registration team is the first to defeat the enemy leader, the game
continues through the end of the resistance team's next phase; if resistance also defeats its enemy leader, it is a
**tie**.

A leader defeated during its opponents' hero phase **does not leave play immediately**: it stays through the end of its
team's next phase "so it can still be targeted by resistance player card effects" (p. 17). The villain-phase FAQ adds
that revealing stage II of the enemy leader in the villain phase deals a facedown encounter card to each player on your
team and the leader cannot take damage until the end of the villain phase (p. 20).

**Tie-break** (p. 17), in order, "players can use" them: 1) the team whose enemy main scheme deck did not advance past
1B; 2) the fewest minions and side schemes in your game area; 3) the least threat on your main scheme; 4) the most
remaining hit points on your identities; 5) the fewest attachments on the leader in your area.

### 1.8 Every FAQ entry on the mode (p. 20)

| FAQ                                                                            | Answer in short                                                                                                              |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| The enemy leader or a minion shares a title with my identity?                  | Irrelevant; the unique rule covers friendly cards only, your leader included, not minions                                    |
| Must both teams choose the same number of modular sets?                        | No, each builds independently                                                                                                |
| Stage II of the enemy leader revealed in the villain phase?                    | Resolve its When Revealed (facedown encounter card to each player on your team); no damage to it until the end of that phase |
| Is the identity's obligation shuffled in during competitive play?              | Yes                                                                                                                          |
| Does a leader attacking Captain Marvel (56092) trigger Energy Channel (56098)? | Yes; it can make Captain Marvel attack that leader                                                                           |
| A minion with Drafted (56080) defeated in competitive mode?                    | Both go to the discard pile of the encounter deck the minion came from                                                       |
| Cap's Shield (56143) when its identity is defeated?                            | It attaches to the Captain America leader; permanent attachments resolve "attach to" when unattached                         |

The quick reference box repeats 1.3 to 1.5 and 1.7. Related rulings: Dec 17, 2025 (2) answer 3 (Cap's Shield: an
attack-labeled ability counts as using your ATK only if it names your ATK) and Jul 9, 2026 (3) answer 2 (outside Civil
War "enemy leader" is the villain).

### 1.9 Open questions (A is recommended)

Questions marked **(now)** change how a cooperative card must be scripted in wave 10 and need an answer before QA.

- **Q1 (now). Who makes the choices the text gives to the enemy team in cooperative play** (Daredevil 56189 exhausting
  a character, Secret Avengers 56159 picking a card, Resistance Fighter 56191's host)? The rulebook says only to use the
  grim rule (p. 6). A) The first player, using the existing `firstPlayerTargets` authority (RRG "First Player", p. 19:
  choices an encounter card gives to nobody in particular), with the prompt worded "choose as the enemy team would".
  B) The affected player. C) The engine picks the worst case by rule.
- **Q2 (now). Life Model Decoy (56084), "attaches this card to a minion or their leader", in cooperative play.**
  Replacing "the enemy team" with "the players" turns "their leader" into "your leader", which cannot be resolved (p.
  6), so it could only go on a minion. A) It may also attach to the enemy leader, as in competitive play, where "their
  leader" is the leader in the same area. B) Minion only.
- **Q3. When does a round end, and what do "this phase" / "end of the round" effects bound to?** A) A round is the four
  phases of 1.4 and ends after the resistance villain phase; "until the end of the phase" ends with the acting team's
  phase of that kind. B) Each team has its own round.
- **Q4. Setup order across the two areas** (mulligans, opening hands, obligations, the 1A Setup, leader Setups). A) Both
  areas set up by the normal steps, registration's area first wherever order matters.
- **Q5. Who is "you" in a boost resolved for a leader-versus-leader attack** (a boost such as "You are stunned" has no
  defending player)? A) The first player who turns the card faceup (step 2).
- **Q6. The p. 16 steps are written for the enemy leader attacking your leader. Does the same procedure apply when "your
  leader" attacks the enemy leader** (Target Lock 56130, You Started This 56134, Fighting Dirty 56208, Spider-Blast
  56212)? A) Yes, mirrored: the boost comes from the deck of the area the attacker sits in, turned by that team's first
  player, and the attacker's total ATK is dealt.
- **Q7. The end of the game.** Two sentences differ: p. 17 says play continues "through the end of the resistance team's
  next phase" when registration loses or wins first; the quick reference says that if the resistance leader wins first
  "the resistance team must play out their next phase". A) Apply p. 17: when a team loses or wins, the game ends once
  the other team has played one more phase, or at once if both have already played the same number. B) Follow the quick
  reference for the resistance case. (The quick-reference line probably means the other team.)
- **Q8. "Defeats all their opponents' identities"** (p. 17). A) Any cause counts, as for "having each of their heroes
  defeated". B) Only damage dealt by the leader.
- **Q9. Tie-breaks are optional ("players can use").** A) Applied automatically in order; still tied is a draw. B)
  Offered to the players, who may decline.
- **Q10. What a defeated leader that "does not leave play immediately" can still do** (p. 17). A) It can be targeted and
  attached to by its team's player cards, but cannot attack, scheme or activate, and takes no more damage. B) It acts
  normally until it leaves.
- **Q11. May the inactive team respond to anything during the other team's phase?** (p. 16: its side "is inactive".)
  A) No; it only answers decisions a card explicitly gives to the enemy team, plus conceding. B) It may use responses
  and interrupts on cards that name the other area.
- **Q12. Choosing Sides reward.** Card back: "adds them to their hand"; p. 16: "become part of that player's deck". A)
  Add to hand now; from then on they are ordinary cards of that player's deck (discard, reshuffle). In 2v2 the players
  choose in turn from the four set-aside cards, so each takes two; in 1v1 two stay set aside. B) Shuffle into the deck.
- **Q13. Expert mode in competitive play** (leaders III and IV, pp. 3, 4). The rules do not say. A) The building team
  picks, and says so at the table. B) Standard only. C) Both teams agree.
- **Q14. Team sizes.** p. 14 says 1v1 or 2v2. A) The lobby offers exactly those (the engine takes any sizes with each
  team's own per-hero count). B) Any 1 to 4 against 1 to 4.
- **Q15. The two printings of the Standard PvP set** (56125 to 56128 and 56203 to 56206): identical in play? A) Yes; a
  deck uses one printing (five cards: 1, 1, 2, 1), and the data survey confirms what differs.
- **Q16. Which obligation deck.** The FAQ says the obligation is shuffled in. A) Into the encounter deck in that
  player's own game area (the deck they face, built by the other team).
- **Q17. Drafted (56080) and Switching Sides (56158) move cards between areas.** A) The card keeps its home deck, so a
  defeated or discarded minion returns to the discard pile of its origin (as the FAQ says for Drafted) and an ally
  stolen by Switching Sides goes to its owner's discard pile, not the thief's.

## 2. Inventory by card id

Counts come from a text scan of `cw.json` (every face): 96 faces mention the competitive concepts. They split into the
Standard PvP set (10 faces, 2.1), the leader player cards (16, 2.1) and 70 others (2.2 to 2.5). Of the 70, 13 literally
say "In competitive mode", about 30 name the enemy team, and the rest only say "enemy leader", which cooperatively is
the villain and needs nothing special. The scan cannot tell a hard case from an easy one, so task 12 in section 4 pins
the list.

### 2.1 Competitive-only cards (cannot be seated cooperatively)

| Ids                | Cards                                                                                | Cooperative reading                                               |
| ------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 56125, 56203       | Righteous Cause (PvP)                                                                | not used (Standard set is used instead)                           |
| 56126, 56204       | Whatever It Takes (PvP)                                                              | same                                                              |
| 56127, 56205       | Targeted Strike (PvP; two copies in the set)                                         | same                                                              |
| 56128a/b, 56206a/b | Choosing Sides / Now It's Personal (PvP side scheme and its back)                    | same; cooperative play finds the leader's own side scheme (below) |
| 56129 to 56132     | Iron Man: The Futurist, Target Lock, High-Tech Suit, Suit Up                         | never in a deck                                                   |
| 56133 to 56136     | Captain Marvel: Provoked Response, You Started This, Alpha Flight Recruit, Raw Power | same                                                              |
| 56207 to 56210     | Captain America: No, You Move!, Fighting Dirty, Recruited by Cap, The People's Hero  | same                                                              |
| 56211 to 56214     | Spider-Woman: Double Agent, Spider-Blast, Hard to Hit, Secret Contact                | same                                                              |

Already in the codebase for these: `SpecificSet.kind: "competitive"` on player cards
(`packages/content/src/schema/cards/player-cards.ts`), `EncounterSet.competitiveOnly`
(`packages/content/src/schema/sets.ts`), the `competitive_card` deck problem
(`packages/engine/src/deck.ts`, whose message says "not available yet"), and `validateScenarioEncounterSets` refusing a
competitive-only set (`packages/content/src/schema/validation.ts`). `docs/phase7-wave2.md` section 6.3 is the data
mapping. What the emitted `cw` data must carry is task 8.

### 2.2 Literal "In competitive mode" clauses (13 faces), with the cooperative reading

| Id                                               | Competitive clause                                                                   | Cooperative reading                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 56063a, 56096a, 56121a, 56122a (registration 1A) | Setup: enemy team finds Choosing Sides, your team reveals it                         | Find the chosen leader's side scheme and reveal it (Stark Tower 56072, Alpha Flight Station 56104, Fearless Determination 56149, Self-propelled Glide 56179 for Iron Man, Captain Marvel, Captain America, Spider-Woman; the cooperative half is printed on the same card) |
| 56141a, 56172a, 56199a, 56200a (resistance 1A)   | the same                                                                             | the same                                                                                                                                                                                                                                                                   |
| 56080 Drafted                                    | enemy team attaches it to a minion engaged with them; the minion engages you         | discard from the encounter deck until a minion is discarded, reveal it, attach Drafted                                                                                                                                                                                     |
| 56158 Switching Sides                            | an enemy-team player may pay the ally's cost to put it into play under their control | discard an ally you control; with no ally leaving play the card gains surge. The card text misspells "enemy" as "enmy" in the cache; the pipeline should normalize it                                                                                                      |
| 56182 Spectacular!                               | also remove 2 threat from your leader's main scheme                                  | place 2 threat on the main scheme only                                                                                                                                                                                                                                     |
| 56183 Neighborhood Hero                          | move 2 threat from your leader's main scheme to this scheme                          | place 2 per-hero threat here                                                                                                                                                                                                                                               |
| 56194 Cloak                                      | also remove 2 threat from your leader's main scheme                                  | place 2 threat on a scheme only                                                                                                                                                                                                                                            |

### 2.3 Names "your leader" (the cooperative reading is that part does nothing, or the printed "Otherwise")

| Id           | Card                    | Clause                                                                                                                                 | Cooperative reading                                               |
| ------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 56087        | Venom                   | When Revealed: attacks your leader. Otherwise activates against you                                                                    | activates against you                                             |
| 56088        | Bullseye                | enemy team discards an attachment from your leader. Otherwise discard an upgrade you control                                           | discard an upgrade you control                                    |
| 56181        | Tangled Up              | Attach to your leader. Otherwise attach to your hero                                                                                   | attach to your hero (already data: `AttachmentHost leader yours`) |
| 56184        | Luke Cage               | When Revealed and Boost: stun your leader. Otherwise you are stunned                                                                   | you are stunned                                                   |
| 56185        | Jessica Jones           | the same with confused                                                                                                                 | you are confused                                                  |
| 56190        | Iron Fist               | When Revealed: attacks your leader. Otherwise activates against you. Boost: the enemy leader attacks your leader after this activation | activates against you; the boost does nothing                     |
| 56090        | Excessive Force         | Boost: the enemy leader attacks your leader (no boost card for that attack)                                                            | boost does nothing                                                |
| 56196        | Darkforce               | after attached leader schemes and places threat, remove that much from your leader's main scheme                                       | attach to the enemy leader, give tough; the removal does nothing  |
| 56126, 56204 | Whatever It Takes (PvP) | Alter-ego: the enemy leader attacks your leader                                                                                        | not used                                                          |

### 2.4 Names "the enemy team" or "your team" (a search, a find, a choice, or a count)

Cooperatively the enemy team is the players (Q1 decides who chooses; most of these are a search for one named card and
need no choice).

- Leaders: Iron Man 56059 (Setup) and 56061 (When Revealed) find an Iron Man attachment, "your team reveals it";
  Captain Marvel 56092 and 56094 find Energy Channel 56098; Captain America 56137 and 56139 find Cap's Shield 56143;
  Spider-Woman 56168 and 56170 find Finesse 56174. The stage II and IV faces (56060, 56062, 56093, 56095, 56138, 56140,
  56169, 56171) deal an encounter card to each player and have no team clause.
- Encounter cards: Stark Tower 56072 (When Defeated), Maria Hill 56083 (finds Life Model Decoy 56084 and attaches it),
  Life Model Decoy 56084 (Q2), Bring Them In 56107 and Heroes for Hire 56116 (find Unregistered Super and deal it
  facedown), Secret Avengers 56159 (top 5, a card, given to the enemy leader as a boost), Spider-Man 56180 (finds
  Tangled Up), Daredevil 56189 (exhausts a character you control), Resistance Fighter 56191 ("a minion of the enemy
  team's choice", otherwise surge), Colleen Wing 56112 and Shang-Chi 56113 (the enemy team chooses instead if you are
  Unregistered).
- Main scheme B sides (each on the `linked_card` of the A record): "more than 1 player on your team" gives hinder 2 per
  hero on all eight 1B stages (56063b, 56096b, 56121b, 56122b, 56141b, 56172b, 56199b, 56200b); 56096b and 56141b search
  for minions and deal one to each player on the team; 56123b and 56173b (2B) search for side schemes and deal them.
- PvP set: Targeted Strike 56127 and 56205, Choosing Sides 56128a and 56206a (not used cooperatively).
- Recruited by Cap 56209 ("a player on the enemy team", leader player card).

### 2.5 Names "the enemy leader" only (the villain cooperatively; no special handling)

Yellow Jacket 56073; Justice Like Lightning 56089; Dangerous Recruits 56091; Paladin's Pistol 56118; the New Avengers
and Secret Avengers minions 56150 to 56152, 56155, 56156 (When Defeated: given to the enemy leader as a boost card);
Neptune's Trident 56161, Horn of Proteus 56162, Imperius Rex! 56163; Protect the Innocent 56186; Street Defenders 56187
and 56192; Dagger 56195; Lightforce 56197; Cloak and Dagger 56198; 2B and 1B stages 56142b, 56200b, 56201b; Cap's Shield
56143 and Energy Channel 56098 (leaders as attackers) also belong with the leader cards. These read correctly with the
villain standing in for the enemy leader. Several carry an "otherwise" that covers the case the leader is absent
(Paladin's Pistol, Namor's attachments).

Typos found in the cache while doing this: "Attack to Paladin" (56118, noted already in `docs/phase7-wave2.md` 6.12),
"enmy" (56158), a stray `<b/>` after "Action" in 56209.

## 3. What the engine and state need

### 3.1 What exists today

| Need                                               | Exists                                                                                                                                                                                                                                                                              | Gap                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Several villains, each with its own encounter deck | `GameState.villains`, `VillainState.encounterDeckId`, `GameState.encounterDecks` (`state.ts`; Wrecking Crew)                                                                                                                                                                        | one active villain for the whole table (`activeVillainId`)                           |
| Separate game areas                                | `GameAreaState` (`state.ts`): players, its own `mainScheme`, `villainIds`, `activeVillainId`, side schemes (Kang)                                                                                                                                                                   | created only by a card ability, never at setup; one `firstPlayerId`, one round clock |
| A main scheme with stages                          | `MainSchemeState`, per area                                                                                                                                                                                                                                                         | no second deck at setup                                                              |
| "The enemy leader" / "your leader"                 | `AttachmentHost { kind: "leader"; of: "enemy" \| "yours" }` (`attachment-hosts.ts`: enemy is the villain, yours has no host)                                                                                                                                                        | host only; no target or player word, no predicate                                    |
| Per-player scaling                                 | `GameState.startingPlayerCount`, read at 24 places in 13 engine files (`query.ts`, `select.ts`, `keywords.ts`, `rules.ts`, `setup.ts`, `events.ts`, `pod.ts`, `resolve/defeat.ts`, `resolve/enter-play.ts`, `resolve-ability-cost.ts`, `campaign/result.ts`, `spec.ts`, `state.ts`) | one count for the table, not per team                                                |
| Who decides                                        | `DecisionAuthority = "player" \| "firstPlayerTargets" \| "firstPlayerOrders"` (`choices.ts`)                                                                                                                                                                                        | no "the enemy team" authority                                                        |
| A precedent for optional table scope               | `PodState` / `podOf` (`pod.ts`): absent in every ordinary game, defaults derived                                                                                                                                                                                                    | none for teams                                                                       |
| Competitive-only data                              | see 2.1                                                                                                                                                                                                                                                                             | not emitted for `cw` yet; no mode on setup                                           |
| Outcome                                            | `GameOutcome` (`state.ts`): one result for the table                                                                                                                                                                                                                                | no per-team result, no tie, no "both lose"                                           |
| Phases                                             | `GameStep` (`state.ts`): player, villain, with first-player passing                                                                                                                                                                                                                 | no active team                                                                       |

### 3.2 Two leaders, two main scheme decks, two encounter decks

A team's **game area** holds its enemy leader (a `VillainState` whose `encounterDeckId` is that area's deck), its main
scheme (a `MainSchemeState`), its encounter deck and discard pile, its side schemes and minions. The engine already has
every one of those pieces; none of them is created at setup for two sides. Setup must build two areas from two scenario
submissions, each with its own deck and main scheme deck (stage 1 on stage 2, p. 5). "The villain" and "the main scheme"
for any effect already resolve through the effect's game area (`attachment-hosts.ts` `theVillain`), so the areas that
exist for Kang are the right shape.

### 3.3 Team membership and the four words

Add team membership to players (derived when there is one team, stored when there are two, like `podOf`) and answer the
four words from it:

| Word             | Cooperative (one team)                                 | Competitive (two teams), asked by a card in team T's area |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| your team        | all players                                            | T's players                                               |
| the enemy team   | all players (p. 6)                                     | the other team's players                                  |
| the enemy leader | the villain                                            | the active villain of T's area                            |
| your leader      | nobody; effect skipped, "do as much as you can" (p. 6) | the active villain of the other team's area               |
| per-hero values  | `startingPlayerCount`                                  | the count of T's players only (p. 20)                     |

### 3.4 Who makes the choices the rules give to the enemy team

Add a decision authority "the enemy team". Cooperatively it resolves to the first player (Q1 A) so the command log looks
like any other first-player choice. Competitively it resolves to a seat of the **other** team, so the engine can park
the choice with `playerId` set to that seat and the netcode shows that seat the facing team's hidden zones (3.8).
Nothing else changes in how a choice is answered: it is still a `resolveChoice` from the addressed player.

### 3.5 Win conditions per team

Three triggers per team (1.7) and a rule of equal phases. This needs state the engine does not have: a pending end (who
has won or lost, in which phase, how many phases until it closes), a result per team (win, loss, tie, both lose) and a
tie-break computation (five measures, all derivable from state). `GameOutcome` should not be widened now: every reader
that switches on `result` would need a decision about a case that cannot occur. Build it in M5 (section 5).

### 3.6 Hidden information between teams

Facing team: must not see the encounter deck's contents or order, or the facedown encounter cards the enemy team deals
it (the dealing team knows them). Enemy team: sees the facing team's deck when it searches. Everything in play is
public. `PlayerState.dealtEncounter` and facedown instances already model a card only some can read; the viewer notion
exists client-side (PLAN.md Phase 4, "the viewer is the player the choice is addressed to, so a server should send those
faces to that player alone"). The authority must project state per seat; the engine's state itself stays whole.

### 3.7 Turn and priority authority

One authority, strict alternation. `GameStep` gains an active team; a command from a seat of the inactive team is
refused unless it answers a choice addressed to it (Q11). The hero-phase freedom inside a team is unchanged. The first
player token becomes per team. The existing `not_active_player` refusal is the nearest code to extend.

### 3.8 One state or two engines (compare `docs/epic-multiplayer-plan.md` section 2)

Epic Multiplayer is asynchronous: groups run at their own pace and share only two numbers, so it takes N independent
engines and a coordinator. Competitive mode is the opposite: phases strictly alternate, and the cards constantly reach
across (the leader attack changes the other area's leader in the middle of a resolving activation; Provoked Response
56133 and No, You Move! 56207 redirect an attack into it; Drafted and Switching Sides move cards; Neighborhood Hero
moves threat; "the enemy team searches" asks the other side mid-resolution). Splitting into two engines would turn each
of those into an asynchronous request between two states with one team waiting on the other's hidden information.

**Recommendation: one `GameState` with two game areas and one authority**, using `GameAreaState` as the unit and a team
as "the players of an area". The server projects a view per seat. It fits PLAN.md Phase 5's single authority and the
same async `EngineHost`; solo-versus-nobody is still just a one-team game; one log replays the whole game. The cost is a
team-scoped phase machine (M2) and a per-seat projection (M7), both of which the multiplayer phase needs for visibility
in cooperative play anyway.

## 4. Build now (wave 10 scaffolding)

Each task is one agent's work, one commit, independently testable. Numbers are what the tests assert. Paths follow the
existing layout; new cards live under `packages/cards/src/wave10/cw/` in per-module files (the project instructions on
splitting work). Order: 1, 2 and 3 first (in that order, one engine agent at a time), then 4 to 7 (one at a time), then
the card and content tasks (at most 3 agents at once), then the client tasks.

**1. Game mode on scenario setup, `competitive` refused.** Add `GameSetupConfig.gameMode?: "cooperative" |
"competitive"` (`packages/engine/src/setup.ts`), a new `EngineErrorCode` `mode_unavailable` (`errors.ts`) and the
player-readable message "Competitive mode is coming soon. Play this scenario cooperatively for now." `createGame` checks
it first, before any other setup validation, so the message never depends on what else is wrong. The mode is stored on
state only when it is not cooperative (so cooperative saves and replays are byte-identical, the `pod` convention). The
scenario builders in `@mc/cards` (`CoreScenarioOptions` and the Civil War options) take and pass it. Replace the
`competitive_card` deck message "…is not available yet" (`deck.ts`) with "…Competitive mode is coming soon."
_Saves later:_ the one switch to turn on; a message the UI already shows.
Tests (`packages/engine/src/game-mode.test.ts`, 7): cooperative given explicitly equals absent, deep-equal state (1);
`competitive` returns `mode_unavailable` with that exact message and no state (1); the same with an otherwise invalid
config still returns `mode_unavailable` (1); each of the four preconstructed Civil War scenarios built with
`gameMode: "competitive"` is refused the same way (4). The existing replay and save fixtures change in 0 places.

**2. Team ids and the derived single team.** `TeamId` brand in `ids.ts`; `TeamState { teamId, side: "registration" |
"resistance" | null, playerIds, areaId | null }`; `packages/engine/src/team.ts` with `teamsOf(state)`, `teamOf(state,
playerId)`, `playersOnTeam`, `teamSize`; `GameState.teams?` stays absent in every game today (like `pod`); `teamsOf`
then derives one team `"t1"` of every seat. A test-only builder `twoTeamState()` (1v1 and 2v2, hand-built, never read by
a production path except through these functions).
_Saves later:_ adding a second team is data; every later task is tested against a real two-team state from day one.
Tests (`team.test.ts`, 12): for 1, 2, 3 and 4 players `teamsOf` returns exactly 1 team holding every seat in seat order
(4); `teamOf` of every seat is `t1` (4, one per player count); `teamSize` equals `startingPlayerCount` including after a
seat sat out (2); in the 1v1 fixture `teamSize` is 1 for both teams, in the 2v2 fixture 2 for both (2). A save with and
without `teams` absent round-trips (the existing save tests, 0 changes).

**3. Route the per-hero count through `teamSize`.** First an audit table in the task's handoff note of the 24
`startingPlayerCount` reads in `packages/engine/src` (13 files, section 3.1): each is either "the table's count"
(campaign result, setup, the sat-out rule) or "the count for the team of the card's controller or area" (per-hero
scaling in `query.ts`, `select.ts`, `resolve/enter-play.ts`, `resolve-ability-cost.ts`, `keywords.ts`). Route the second
kind through `teamSize(state, teamOfContext)`; leave the first kind alone.
_Saves later:_ per-hero values scale by the facing team's size with no card change (p. 20). Tests
(`team-scaling.test.ts`, 6): every existing scaling test is unchanged (0 edits); in the 2v2 fixture a hit
point value of 12 per hero evaluates to 24 for a card in either team's area; in the 1v2 fixture (built by
hand, not offered to players) it is 12 in team one's area and 24 in team two's (2); `startingPlayerCount`
is still 3 in a three-seat cooperative game for the campaign result (1); a per-hero Hinder 2 on a main
scheme in the 1v1 fixture is 2 and in the 2v2 fixture 4 (2).

**4. Team-relative queries.** In `team.ts`: `enemyTeamOf(state, teamId)` (the other team; the **same** team when there
is one, p. 6), `enemyLeaderOf(state, teamId)` (the active villain of the team's area), `yourLeaderOf(state, teamId)`
(the active villain of the enemy team's area; **null** when there is one team). `attachment-hosts.ts` `case "leader"`
calls them instead of hard-coding "yours has no host".
_Saves later:_ the host code is already the competitive code.
Tests (`team-queries.test.ts`, 14): in cooperative play with 1, 2, 3 and 4 players `enemyTeamOf(t1)` is `t1` (4),
`yourLeaderOf` is null (4), `enemyLeaderOf` is the villain's instance (4); with Wrecking Crew's four villains it is the
active villain (1); in the 1v1 fixture each team's `enemyLeaderOf` is the leader in its own area and `yourLeaderOf` the
leader in the other (1). Tangled Up's host (56181) still falls through to the hero in cooperative play (existing test, 0
edits).

**5. Spec words and DSL builders.** In `spec.ts` and `packages/cards/src/dsl/`: `PlayerRef { kind: "team", of: "yours" |
"enemy" }` (each member, in player order, which also serves "a player on the enemy team") and `TargetRef { kind:
"leader", of: "yours" | "enemy" }`, with builders `yourTeam`, `enemyTeam`, `yourLeader`, `enemyLeader` (names follow the
existing `controllerOf` style). All four resolve through task 4. An effect aimed at no card or no player does nothing,
as the engine already treats an empty ref.
_Saves later:_ every script that is written for the leader cards and the "enemy team" cards is already final. Tests
(`leader-refs.test.ts`, 18): `enemyLeader` resolves to the villain at 1, 2, 3 and 4 players (4);
`yourLeader` resolves to nothing and an effect aimed at it changes no state (4); `yourTeam` and
`enemyTeam` resolve to every seat in seat order at 1, 2, 3 and 4 players (8); `ifAble { preferred:
               yourLeader, otherwise: <hero> }` takes the otherwise (1); in the 2v2 fixture `enemyTeam` from team one's
area resolves to team two's two seats and `yourLeader` to the leader in team two's area (1). The DSL
validator rejects a `leader` ref in a position that needs a player (`validate.test.ts`, 0 changes to
existing cases).

**6. `inCompetitiveMode` condition.** `Predicate { kind: "gameMode", is: "competitive" }` and the DSL word
`inCompetitiveMode()`, used as the condition of the "In competitive mode, X. Otherwise, Y." clauses (2.2) and of the 1A
Setup. It reads the stored mode (task 1) and is false when it is absent.
_Saves later:_ no card's competitive branch has to be touched when the mode turns on. Tests
(`competitive-predicate.test.ts`, 6): false in cooperative play at 1, 2, 3 and 4 players (4); true on a
state with `gameMode: "competitive"` set directly by the fixture (1); a `choose { if inCompetitiveMode,
               then A, else B }` takes B in cooperative play (1).

**7. "The enemy team" decision authority.** Add `"enemyTeam"` to `DecisionAuthority` (`choices.ts`) and
`enemyTeamDecider(state, context)`: in cooperative play the first player (Q1 A, changeable in one function if the owner
picks otherwise); with two teams a seat of the other team. The prompt line is "Choose as the enemy team would."
_Saves later:_ netcode can route and project on the authority value, with no card changes. Tests
(`enemy-team-authority.test.ts`, 10): a pending choice with this authority is addressed to the first
player at 1, 2, 3 and 4 players (4); after the first player token passes it is addressed to the new first
player (1); a `resolveChoice` from any other seat is refused with the existing wrong-player code (3, at
2, 3 and 4 players); a game that makes the choice replays deep-equal (1). In the 2v2 fixture the choice
is addressed to a seat of the other team (1), which makes the 10.

**8. Emit the competitive-only data and pin its shape.** `card-data-pipeline` emits `cw` as part of wave 10; this task
adds the tests that pin what the scaffolding depends on. In `packages/content/src/data/cw/`'s test: 4 leaders each with
4 stages (16 leader faces, `printedType: "leader"`); the 16 leader player cards (4 per leader) each with
`specificTo.kind === "competitive"` and the `encounterSetId` of its leader (16); the `standard_pvp` set with
`competitiveOnly: true` and quantities 1, 1, 2, 1 per printing, two printings (ids in 2.1); the eight 1A main schemes (4
registration, 4 resistance) and eight 2A; the four leader side schemes the cooperative Setup finds (56072, 56104, 56149,
56179).
_Saves later:_ the mode needs no data work.
Tests (`packages/content/src/data/cw.test.ts`, 41): leader faces 16 (1); leader player cards 16 with the competitive
marker (16) and their set ids (16); `standard_pvp` flagged and 5 cards per printing (2); 8 main scheme 1A, 8 2A (2);
the four cooperative side schemes present and in their leaders' sets (4).

**9. Exclusion proofs: nothing competitive can enter a cooperative game.** Tests only, plus whatever one-line fix a
failing test shows. For each of the 16 leader player cards: `validateDeck` reports `competitive_card` (16); a game
seated with such a deck is refused with `illegal_deck` and that problem (16, parameterized); the MarvelCDB importer
(`from-marvelcdb-json`) refuses a decklist that contains one (4, one per leader). `validateScenarioEncounterSets`
refuses a scenario that lists `standard_pvp` (1, existing) and `modularSetPool` naming it (1). The playable modular pool
(`PLAYABLE_ENCOUNTER_SETS`, `packages/cards/src/modular-pool.ts`) does not contain it (1), and `chooseModularSets` over
1,000 seeds never returns it (1). The random-deck generator (`packages/cards/src/testing/random-deck.ts`) over its 120
fixed seeds, solo and 2-player, never includes a leader basic card (1). The deck builder's card list for every identity
contains none of the 16 (1). `?unlock=all` (progression) does not change any of these (1).
_Saves later:_ turning the mode on is the only change that makes these tests fail, which is the point.
Tests: 43 as counted.

**10. Script the Standard PvP set.** One agent, `packages/cards/src/wave10/cw/standard-pvp/`. Righteous Cause (the enemy
leader schemes; an extra boost card when more than one player is on the team), Whatever It Takes (alter-ego and hero
faces), Targeted Strike (search the top 5; boost +1 per player on the team), Choosing Sides and Now It's Personal.
Written with tasks 4 to 7 and complete for both modes; run only on hand-built states because the mode refuses them.
_Saves later:_ the set is done; M6 only exercises it.
Tests (`standard-pvp.test.ts`, 12): Righteous Cause with a one-player team gives the enemy leader (Iron Man I, SCH 1) 1
boost card and with the 2v2 fixture 2 (2); Whatever It Takes alter-ego with no `yourLeader` does nothing and hero face
attacks you (2); Targeted Strike examines exactly 5 cards and deals 1 facedown (2), boost icons +1 at team size 1 and +2
at 2 (2); Choosing Sides caps an ATK 5 attack at 2 damage and a 1-damage attack at 1 (2); removing its last threat deals
1 card per hero at 1 and 2 players and flips to Now It's Personal (2).

**11. Script the leader player cards, one agent per leader (11a Iron Man 56129 to 56132, 11b Captain Marvel 56133 to
56136, 11c Captain America 56207 to 56210, 11d Spider-Woman 56211 to 56214).** Each card written against `yourLeader` /
`enemyLeader` / the leader's own attachments (Energy Channel, Cap's Shield, Finesse). In cooperative play, forced into a
hand by the test harness, a card does what it can and nothing more.
_Saves later:_ 16 cards ready; M4 only proves them against a real second leader. Tests (per leader 4 + 1, so 5 each, 20
in all): each card's script validates (4 per leader); and one reading test per leader of the cooperative
result: Double Agent removes exactly 2 threat from the main scheme and places 0 elsewhere; The Futurist,
Target Lock, Provoked Response, You Started This, Fighting Dirty, Spider-Blast change no state; Suit Up
and Raw Power and The People's Hero and Secret Contact spend the resource and trigger nothing; Hard to
Hit and High-Tech Suit and Alpha Flight Recruit cannot find a host where they require a leader and are
refused as plays (the harness checks the exact refusal code per card).

**12. Manifest of competitive-sensitive faces (drift guard).** `packages/cards/src/wave10/cw/competitive-manifest.ts`:
every face found by the scan of section 2 with its class (`competitiveOnly`, `competitiveClause`, `yourLeader`,
`enemyTeam`, `enemyLeaderOnly`) and the test that pins its cooperative reading. The test re-runs the scan over the
emitted card data and fails if the sets differ.
_Saves later:_ a new errata or print cannot add a competitive clause unseen (the drift process, PLAN.md Phase 6). Tests
(`competitive-manifest.test.ts`, 8): the scan finds 96 faces (1) = 10 PvP + 16 leader cards + 70 others
(3); the 13 literal "In competitive mode" faces each contain `inCompetitiveMode` in their script (13
assertions, 1 test); the 32 faces naming "your leader" each contain a `yourLeader` ref or sit in a
competitive-only set (1); every manifest entry names an existing test (1); no script outside the manifest
contains `yourLeader`, `enemyTeam` or `inCompetitiveMode` (1).

**13. Cooperative reading of the 70 other faces.** Not a scaffolding task of its own: they are ordinary wave 10 scripts
(per leader set and modular set, the project instructions on splitting work), and each carries one cooperative-reading
test using 2.2 to 2.5 as the expected value. This task is the checklist: 13 literal clauses (2.2), 9 "your leader"
alternates (2.3), the "enemy team" faces (2.4) and the rest (2.5), and the 70 reading tests live in the module of the
card they test.

**14. Guided-mode entry for the cooperative terms.** A glossary entry "Playing Civil War cooperatively" with the p. 6
bullets (the leader in play is the enemy leader and the villain; the enemy team is the players; the grim rule, in plain
words; "your leader" cannot be resolved and the card's alternate resolves; do as much as you can), tagged `introducedIn`
the Civil War box (`@mc/content` `GLOSSARY_ENTRIES`).
_Saves later:_ a player reading "the enemy team" on a card gets the answer in the box that introduces it.
Tests (`glossary` test, 4): the entry exists once (1); it is listed on the box's "New in this box" page (1); it has 5
bullets (1); its text names p. 6 as its source (1).

**15. The "Competitive mode coming soon" notice (client).** A disabled, labeled option, never hidden: (a) in the Civil
War scenario builder wherever the wave 10 builder lands (a row "Competitive mode — Coming soon", greyed, with the
one-line reason "Two teams face each other's leaders. Not available yet."); (b) a line on the box's "New in this box"
page (`packages/client/src/view/new-in-box-model.ts`, `BOXES`): "Competitive mode coming soon." The model is a pure view
model, as the rest of that file. The option list is data: `[{ id: "cooperative", enabled: true }, { id: "competitive",
enabled: false }]`, so enabling it later is flipping one field.
_Saves later:_ the entry points exist; M9 turns them on. Tests (`new-in-box-model.test.ts` and the builder's model test,
7): the option list has exactly 2 entries, with `competitive` disabled and labeled "Coming soon" (2);
selecting it leaves the mode `cooperative` (1); the builder's output never contains `gameMode:
               "competitive"` for any of its 4 preconstructed scenarios (1, parameterized over 4); the "New in this box"
page contains the line exactly once (1); the box has no page when it is locked, as other boxes (1). One
Playwright spec in `packages/client/e2e/` that opens the builder and sees the option disabled, run as the
local gate (the project instructions: e2e is a local gate).

Totals: 15 tasks (11 is four agents; 13 is spread over the wave's scripting), 208 asserted checks here plus the 70
reading tests of task 13.

## 5. Build in the multiplayer phase

Ordered, with dependencies. A "M" step is a small-task group; the doc for each is written when it starts.

| #   | Work                                                                                                                                                                                                                                                                                                                                                                                                                   | Depends on            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| M0  | Owner answers Q3 to Q17; the rulings are recorded as a table like the wave specs' section 4.1; a short FFG-rulings check for Q7 (the quick-reference sentence)                                                                                                                                                                                                                                                         | none                  |
| M1  | Two-team **setup**: `GameSetupConfig` takes two scenario submissions and builds two game areas (setup-time `createGameArea`), the leader and main scheme deck and encounter deck of each, the Standard PvP set in place of the Standard set, the 1A Setup hook, obligations into the right deck, the four basic cards set aside per team. Turns on `gameMode: "competitive"`; tests of task 9 are updated at this step | 2 to 7, 8, 10         |
| M2  | **Team-scoped phase machine**: `GameStep` gains the active team; the order of 1.4; a first player token per team; round end (Q3); lasting effects scoped to a team's phase; `not_active_player` and an inactive-team refusal (Q11)                                                                                                                                                                                     | M1                    |
| M3  | **Cross-area effects**: the leader-attacks-leader procedure (1.5, Q5, Q6), Provoked Response 56133 and No, You Move! 56207 redirects, minions and allies moving between areas (Drafted, Recruited by Cap, Switching Sides; Q17), threat moving between main schemes, leader attachments across areas, the real `yourLeader`. Plays the 16 leader cards and the PvP set for real                                        | M1, M2, 11, 10        |
| M4  | **`enemyTeam` routed to the other team's seat** and the choices that need the other team to see the facing team's deck (searches, finds, top 5)                                                                                                                                                                                                                                                                        | M2, task 7            |
| M5  | **Outcome**: per-team results, the three triggers, equal phases (Q7, Q8), the defeated-leader-stays-in-play window (Q10), tie and both-lose, the tie-break computation (Q9). Widens `GameOutcome` and `GameStep` for the first time                                                                                                                                                                                    | M2                    |
| M6  | **Choosing Sides reward flow**: earning two basic cards, Now It's Personal, each player choosing in turn (Q12)                                                                                                                                                                                                                                                                                                         | M3                    |
| M7  | **Per-seat state projection** on the authority: facedown dealt cards visible to the enemy team only, deck contents hidden from the facing team, a search shown to the searching seat; a replay of the log still reproduces the whole state on the server                                                                                                                                                               | Phase 5 authority; M4 |
| M8  | **Lobby and deck rules**: pick a side and a leader; a team cannot field an identity sharing a title with its own leader; modular sets of the side only; build and seal a scenario, trade; 1v1 and 2v2 (Q14); expert (Q13); a custom scenario made at random (p. 5); validate server-side                                                                                                                               | Phase 5 lobby; task 8 |
| M9  | **Client**: the builder's competitive option enabled; a table showing the active team's area and a small view of the other; the "your side is inactive" state; a tie-break panel; wording for Q1-style prompts; the Choosing Sides cards earned screen; the notice of task 15 removed                                                                                                                                  | M2 to M8              |
| M10 | **Netcode specifics**: commands from the inactive team refused except answers addressed to it; reconnect restores from the log with the seat's projection; a team member dropping; spectators out of scope (the same as cooperative play)                                                                                                                                                                              | Phase 5, M7           |
| M11 | **Rules QA**: one test per FAQ entry (1.8), per rule of 1.4 to 1.7, per Q answer; the Ruling Dec 17, 2025 (2) answer 3 on Cap's Shield; scenario replays of one full 1v1 and one full 2v2 game for each of the four leaders; random games for the log's replay property                                                                                                                                                | M1 to M8              |

**Hot-seat milestone (one device, two teams).** Possible after M1 to M6 and M11's first half, **without** M7, M10 and
the lobby: the existing local worker (`EngineHost`, PLAN.md Phase 4) is the authority. The cost is client work in M9
only: a "pass the device" screen between phases, because the table is otherwise visible to both teams; a viewer switch
so that the searching team's screen shows the facing team's deck while the facing team's does not; the same engine, log
and save. It does not need the multiplayer authority, so it can ship as soon as the engine is done, roughly 10 small
agent tasks (M1 to M6, the viewer switch, the pass screen, the builder row, the QA). It cannot hide information from a
player who looks at the screen, which is acceptable for two people sharing a table and is the same trade-off as the
physical game. It keeps the 1.5 hidden-information rule as a client rule (blank the facing team's deck), not an engine
one.

## 6. Risks and what must not be done now

- **Do not fork the cooperative path.** Cooperative play must run the same code with one team, a mode that is absent,
  and predicates that are false. No `if (gameMode === "competitive")` in the flow, no second phase loop, no second
  setup. `gameMode` is read only by `inCompetitiveMode` and by the refusal in `createGame`.
- **Do not hard-code "the players" where a card says "the enemy team"** or the villain where it says "the enemy leader";
  scripts use the words of task 5 so they stay right when a second team exists. Do not make `yourLeader` resolve to the
  villain cooperatively: the rulebook says it cannot be resolved (p. 6) and the "Otherwise" clauses depend on that.
- **Do not weaken rules accuracy to save work.** The Standard PvP set must not be offered cooperatively, and the
  cooperative builder must add the Standard set (p. 4). Modular sets from other boxes stay legal cooperatively and stay
  refused competitively (p. 5).
- **Do not widen `GameOutcome` or `GameStep` now.** Every reader would need a ruling on a case that cannot occur. Add
  the fields in M2 and M5 with the tests that use them.
- **Do not store derived teams.** `teams` is absent in cooperative games (saves and replays unchanged); a stored single
  team would change every existing fixture.
- **Do not treat `startingPlayerCount` as "my team's count" after task 3**, and do not add a second count for the table.
- **Do not add a per-team random stream** (the Epic plan needed one because groups diverge; a single state with a single
  log does not).
- **Do not let a cheat route enable the mode**: `?unlock=all` and the saved-game loader must not set `gameMode`
  (task 9); the refusal is in the engine, not only in the UI.
- **Do not put the facing team's deck contents into a view model or a log line that both seats can read.** The engine
  log is whole; anything a seat sees goes through M7. Until then the mode is unreachable, so no leak exists.
- **Rules risks to track:** the p. 20 quick reference and p. 17 disagree or are ambiguous in places (Q7); cards typo or
  omit words (2.5), so any rules answer is checked against the card image; the grim rule (Q1) is a table convention the
  engine cannot enforce, and the first-player choice favours a player who would rather not hurt themselves; a leader
  defeated but kept in play (Q10) is an exception to RRG "Villain Defeat" (p. 47) that must not leak into any
  cooperative defeat.
- **Cost risk:** the largest unknown is M3 (cross-area effects), because it touches interrupts and replacement effects
  across areas. Prove the shape early with the Provoked Response redirect and one leader-versus-leader attack on the
  two-team fixture of task 2, even before M1 is complete.
