# Marvel modular comic pack

38 PNG images: 30 scenario screens, 5 text-free environment screens, and 3 text-free villain inserts. The first five story sets are the latest delivered versions, including title-only opening headings and the corrected Raft corridor ending. The new finale is supplied as **The Final Showdown** with a generic displayed title; in Fear No Evil it serves the final Kingpin issue. Folder numbers are organizational identifiers, not a required play order.

## Campaign selection and Black Cat (updated)

This guidance reflects your supplied clarification. The referenced rulebook and application source were not independently inspected for this update.

The recommended **underling villain order**, independent of scenario choice, is:

1. Hammerhead
2. Bullseye
3. Electro
4. Your choice of Purple Man or Typhoid Mary

Apply that list only on a first playthrough when the player chooses **The next villain on the recommended list** at Briefing. Choosing **A random unrecorded villain** can give a different first villain. On a repeat playthrough, villains are random from the start, per your clarification. Kingpin is the final confrontation, outside this underling list. Do not infer villain selection from scenario folder numbers or depicted cameos.

**Black Cat is not an underling villain or a player hero in this box.** Card 60169 is a Kingpin encounter-set minion. Her museum/chase artwork may remain as an optional narrative cameo; it must never choose the scenario villain or imply her encounter card is currently in play. Her potential ally state belongs to her card effect, not to player-hero selection. Only show an ally conversion after the actual game state confirms it happened. The separate Core Set ally card is not an additional Fear No Evil underling.

For a minimal-disruption sequence: scenario setup -> incident -> selected-underling reveal -> escalation -> intervention. Keep any Black Cat cameo brief and let the active villain reveal establish who the players are facing. The existing Getaway variant gives Felicia several screens, so it remains a Black Cat-focused side story rather than a cameo-only version; use the neutral getaway plate when you want a brief cameo or none.

**Asset coverage:** Bullseye, Purple Man and Typhoid Mary have standalone reveal screens. Electro appears in the Raft story screens, which are location-specific. Hammerhead has no reveal asset yet. Kingpin has existing story appearances but no standalone portrait. Do not substitute Black Cat for a missing Hammerhead reveal or treat Electro as mandatory for the Raft.

## Start here

For modular tabletop-style play, use `environments/` as the neutral foundation. Add your own scenario caption, then conditionally insert a file from `villains/` when that character is actually present. End with your own mission-start screen or a compatible existing Suit Up screen. The environments are reusable scene plates, not complete replacement five-beat sequences.

The earlier `scenarios/01` through `05` sets remain story variants. They have **not** all been rewritten into villain-neutral versions. The filename tables below identify baked-in characters, prior-event assumptions and replacements. Do not load every original screen unconditionally.

Suggested beat order: environment/setup -> incident or stakes -> optional villain reveal -> escalation -> intervention/Suit Up. Insert one villain reveal, not all three. If multiple villains are present, choose the active threat for this beat; adding one insert per present villain may slow the sequence.

The text-free inserts show a villain presence, not a location, employer, victory, escape, capture or specific power use. They can be placed after beat 2/3 or just before intervention. No filename requires a fixed scenario/villain pairing.

## Villain inserts

| Filename                                   | Villain                         | Use and placement                                                                                                                                     |
| ------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `villains/villain-bullseye-reveal.png`     | Bullseye                        | Optional reveal after threat established (usually after beat 2 or 3), or just before Suit Up. Orange/black backdrop; no location or outcome.          |
| `villains/villain-purple-man-reveal.png`   | Purple Man / Zebediah Killgrave | Optional reveal after suspicious behavior or a threat beat, before intervention. His portrait does not prove mind control is active.                  |
| `villains/villain-typhoid-mary-reveal.png` | Typhoid Mary                    | Optional reveal after setup or escalation, before intervention. Civilian black-clothed appearance; no combat costume, face paint, or powers depicted. |

These are separate PNG screens containing two panels. They are not transparent cutouts. Use each as one screen or crop its panels in your game layout. Mary is shown in her civilian appearance from the supplied comic, not her more recognizable combat makeup. Purple Man is shown as a head/shoulder portrait; the image does not require him to be imprisoned.

A separate Kingpin portrait was attempted but rejected twice by the image tool with an unspecified safety flag. It is **not included**. Existing Kingpin images remain in the conditional story screens, particularly `scenarios/05-stop-the-presses/stop-the-presses-03.png`; that screen also depicts Butch and contains a fixed newspaper-suppression order.

## Environment screens

| Filename                                 | Scenario/environment                                                 | Suggested use                                          |
| ---------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| `environments/env-art-museum.png`        | Gallery wide view and missing-art detail.                            | Establish setting or reveal theft.                     |
| `environments/env-getaway.png`           | Red car speeding through park gate; occupants hidden.                | Establish moving target or transition into pursuit.    |
| `environments/env-protection-racket.png` | Empty bar, pool table and envelope on counter.                       | Establish local business or imply a collection demand. |
| `environments/env-raft-breakout.png`     | Open cells, smoke and emergency lighting in damaged prison corridor. | After breach or just before intervention.              |
| `environments/env-stop-the-presses.png`  | Empty newsroom and evidence-files/laptop detail.                     | Set newsroom stakes or protect-the-evidence objective. |

No lead villain, hero, fixed dialogue, issue number or page marker is baked into the five environment images. Tiny abstract marks may remain on in-world document/computer props; they carry no named story facts. The getaway car remains red; reuse the same vehicle palette if combining with other chase screens.

## Finale / Kingpin setting

The finale supplies a generic criminal headquarters: exterior -> security -> records -> lockdown -> office-door cliffhanger. It contains no named villain or hero. For Fear No Evil, use it for the final Kingpin issue. Its generic artwork does not change the campaign villain assignment. The title is **The Final Showdown**, not a new tabletop scenario name. The office/lobby shots use warm amber and purple lighting; the exterior is night. Treat these as comic lighting choices, not an exact continuous-time simulation.

| Filename                                    | Beat                  | Content                                                  |
| ------------------------------------------- | --------------------- | -------------------------------------------------------- |
| `scenarios/06-final-showdown/finale-01.png` | Setup / beat 1        | Headquarters exterior and standalone lead.               |
| `scenarios/06-final-showdown/finale-02.png` | Defenses / beat 2     | Watched lobby, generic guards and security camera.       |
| `scenarios/06-final-showdown/finale-03.png` | Stakes / beat 3       | Office desk and incriminating records.                   |
| `scenarios/06-final-showdown/finale-04.png` | Escalation / beat 4   | Alarm, monitor and security shutter.                     |
| `scenarios/06-final-showdown/finale-05.png` | Intervention / beat 5 | Closed office doors; unnamed mastermind beyond; Suit Up. |

For the sixth environment, use the headquarters/office/hallway imagery in this finale sequence. These five screens have baked-in generic mission captions; they are not text-free scene plates. An optional Kingpin reveal or an actually-present minion cameo fits between `finale-04.png` and `finale-05.png`; do not reuse an underling reveal here solely because it is available.

## Existing story screens: every filename and condition

Visible supporting characters do not automatically have to be the selected villain or player hero. Decide whether your mode permits cameos. In strict mode, use the neutral replacement whenever an unselected named character appears.

### 01-art-museum-heist

| Filename                                                | What it shows                                        | Condition / replacement advice                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `scenarios/01-art-museum-heist/art-museum-heist-01.png` | Museum gala arrival and crowd.                       | Optional Felicia thief cameo only; she is not a selectable underling or player hero. Use env-art-museum.png to omit her. |
| `scenarios/01-art-museum-heist/art-museum-heist-02.png` | Crew works beside the target painting.               | Generic criminal crew; no lead-villain name in narration.                                                                |
| `scenarios/01-art-museum-heist/art-museum-heist-03.png` | Empty frame, equipment case and missing artwork.     | Neutral theft reveal; generated adaptation rather than exact comic panels.                                               |
| `scenarios/01-art-museum-heist/art-museum-heist-04.png` | Security chief receives the missing-painting report. | Local security character, no lead villain required.                                                                      |
| `scenarios/01-art-museum-heist/art-museum-heist-05.png` | Red getaway car and scenario-start prompt.           | Driver identity hidden; usable with any lead villain.                                                                    |

### 02-the-getaway

| Filename                                  | What it shows                                        | Condition / replacement advice                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `scenarios/02-the-getaway/getaway-01.png` | Red car interior with Felicia, Boris and Bruno.      | Black Cat crew visible; narration explicitly assumes museum job just happened. Use with that continuity, or substitute env-getaway.png. |
| `scenarios/02-the-getaway/getaway-02.png` | Car enters park; masked rivals board its roof.       | Black Cat and rival thieves visible. Use only if these supporting factions are allowed.                                                 |
| `scenarios/02-the-getaway/getaway-03.png` | Black Cat fights rooftop pursuers; Boris inset.      | Black Cat-specific action and reference to stolen painting; not a generic villain reveal.                                               |
| `scenarios/02-the-getaway/getaway-04.png` | Security chief on scooter catches the car.           | Black Cat and museum-theft continuity. Substitute environment if avoiding this storyline.                                               |
| `scenarios/02-the-getaway/getaway-05.png` | Car and motorcycle approach an obstruction; Suit Up. | No named face shown. Motorcycle helmet differs from earlier scooter artwork; best as generic interception opportunity.                  |

### 03-protection-racket

| Filename                                                  | What it shows                                                  | Condition / replacement advice                                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `scenarios/03-protection-racket/protection-racket-01.png` | Neighborhood shops and produce merchant.                       | Neutral setting and stakes.                                                                                                         |
| `scenarios/03-protection-racket/protection-racket-02.png` | Blue-suited enforcer demands a weekly cut at bar.              | Source character Joseph is visible, but dialogue makes him an unnamed enforcer; acceptable as support rather than selected villain. |
| `scenarios/03-protection-racket/protection-racket-03.png` | Older local pushes back; enforcer threatens continued payment. | Both are source gang figures reinterpreted in this adaptation. No major villain named; not a literal comic retelling.               |
| `scenarios/03-protection-racket/protection-racket-04.png` | Resident tells Matt about frightened neighbors.                | Matt is a local ally/contact, not necessarily the selected player hero.                                                             |
| `scenarios/03-protection-racket/protection-racket-05.png` | Enforcers prepare another collection; Matt reacts; Suit Up.    | Matt as local ally, generic enforcers. Does not assume another scenario was played.                                                 |

### 04-the-raft-breakout

| Filename                                              | What it shows                                            | Condition / replacement advice                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `scenarios/04-the-raft-breakout/raft-breakout-01.png` | Island prison and helicopter approach.                   | Neutral prison setup.                                                                                                                  |
| `scenarios/04-the-raft-breakout/raft-breakout-02.png` | Electrical strike breaches prison defenses.              | Electrical sabotage is fixed by caption, but culprit unnamed. Use if electrical breach fits, regardless of lead villain.               |
| `scenarios/04-the-raft-breakout/raft-breakout-03.png` | Electro and electrically breached cell doors.            | Electro is explicitly named and pictured. Show only if he is present as villain, minion or cameo; otherwise use env-raft-breakout.png. |
| `scenarios/04-the-raft-breakout/raft-breakout-04.png` | Electro faces a crowd of released inmates.               | Electro plus inmate roster cameos. For strict selected-villain-only visuals replace with env-raft-breakout.png and chosen reveal.      |
| `scenarios/04-the-raft-breakout/raft-breakout-05.png` | Breached interior cell block; guards need help; Suit Up. | UPDATED interior ending, not the old helicopter duplicate. Neutral environment; no named characters.                                   |

### 05-stop-the-presses

| Filename                                                | What it shows                                   | Condition / replacement advice                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `scenarios/05-stop-the-presses/stop-the-presses-01.png` | Fisk at City Hall press conference.             | Both are visible. Use only when Fisk and Mary are allowed in the story, or use env-stop-the-presses.png with generic setup caption.  |
| `scenarios/05-stop-the-presses/stop-the-presses-02.png` | Reporters prepare an expose and review files.   | Caption explicitly links heists and protection rackets. For standalone play use env-stop-the-presses.png with your own neutral text. |
| `scenarios/05-stop-the-presses/stop-the-presses-03.png` | Fisk orders Butch to suppress the story.        | Fisk explicitly controls suppression. Conditional on Kingpin being involved; do not use universally.                                 |
| `scenarios/05-stop-the-presses/stop-the-presses-04.png` | Warning reaches newsroom as three men approach. | Neutral threat, no named villain. Generated newsroom insert, not an original comic event.                                            |
| `scenarios/05-stop-the-presses/stop-the-presses-05.png` | Daredevil heads toward danger; Suit Up.         | Use if Daredevil is permitted as hero or supporting ally. Otherwise use env-stop-the-presses.png with generic call to action.        |

## Conditional loading examples

These are placement suggestions, not fixed recommendations for which villain belongs to a scenario.

| Situation                                           | Optional insert                   | Suggested bridge caption (your overlay)              |
| --------------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| A known threat appears after any scenario setup     | `villain-bullseye-reveal.png`     | "Bullseye has entered the picture."                  |
| People behave strangely or a controller is revealed | `villain-purple-man-reveal.png`   | "Purple Man is involved. Trust no easy assumptions." |
| An enforcer or unexpected participant is revealed   | `villain-typhoid-mary-reveal.png` | "Mary is here. Whatever happens next, stay alert."   |

For The Getaway, do not imply a museum robbery happened unless that continuity is enabled. For Stop the Presses, use "evidence exposing a criminal operation" rather than naming prior heists/rackets in standalone mode. For The Raft, show the generic breached corridor unless Electro is present or permitted as a cameo.

The JSON manifest repeats the filename mappings, visible characters, usage conditions, placement suggestions, source notes and image dimensions so you can use it while building your own loader. It is reference data, not executable game logic.

## Sources and production notes

All images are AI-edited/generated adaptations made with the built-in image tool. They are not exact extracted comic panels. Source-derived artwork may change details; newly invented newsroom, headquarters and environment scenes are documented as adaptations rather than events claimed to appear in the original comics. Full original comic files are not included.

Source image order counts covers and recap pages. It is not printed-page numbering. Some New Avengers archive images are double-page spreads. See `source-notes/` for earlier per-scenario source mapping and `generation-record.json` for the final new-asset prompts.

All assets were visually reviewed in their generation previews, checked for readability/character context, and their actual sizes are recorded in `asset-manifest.json`. The standard screen size is approximately 16:9; load with contain/letterboxing to avoid stretching.

## Revision note

Version 2 updates guidance and machine-readable campaign conditions only. The 38 image files are unchanged. Older source notes preserve production history; this README and manifest supersede any conflicting role or campaign-order suggestions in those notes.
