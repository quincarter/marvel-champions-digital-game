# Phase 7 wave 6 rules-QA pass

`rules-qa-engineer` passes over wave 6, one pass per pack or scenario group. Each pass reads the pack's scripts against
the printed text, RRG 1.8, FFG's rulings and errata, adds the 2-player and expert games the definition of done asks for
where they were missing, and pins what it finds (`it.fails`) rather than fixing engine or card code. The per-pass
write-ups:

| Pass                                                      | Scope                                                           | Result                                                                                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MojoMania](phase7-wave6-qa-mojo.md)                      | `mojo`: MaGog, Spiral, Mojo, six genre sets, Longshot, campaign | One engine bug pinned: a "take damage" cost (`damageSelf`) is paid when tough prevents the damage (RRG p. 14, Focused Rage FAQ #27); 2-player and expert games added for every game shape |
| [Cyclops and Phoenix](phase7-wave6-qa-cyclops-phoenix.md) | `cyclops`, `phoenix`: both hero packs, their nemesis sets       | No bug found; Peril (Fiery Rage), Marked overkill-taken and Temporary pinned new; Cyclops 2-player/expert and Phoenix Force / Dark Phoenix games added, none staged                       |

Rulings the user settled while the wave was scripted are in [phase7-wave6.md](phase7-wave6.md) §4.1 and
[phase7-wave6-handoff.md](phase7-wave6-handoff.md).
