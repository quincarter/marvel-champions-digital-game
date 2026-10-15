# Villain phase redesign (2026-10-14)

Static mockups from the owner; there is no `.dc.html` canvas behind them, so `pnpm capture:screens` does not regenerate
this folder. They replace the full-screen villain phase overlay (D11, P09, L02) and answer issues #117, #128, #129 and
#138.

| Label | File                                                  | What it shows                                                                 |
| ----- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| D1    | `d1-interrupt-window-table-and-hand-in-view.png`      | Desktop: phase docked on the right, table and hand stay in view, interrupt    |
| D2    | `d2-encounter-card-revealed-counter-in-hand.png`      | Desktop: encounter card revealed, its counter in hand ringed and tagged       |
| D3    | `d3-phase-recap-held-open-start-player-phase.png`     | Desktop: recap held open until Start player phase                             |
| T1    | `t1-tablet-landscape-phase-takes-the-enemy-row.png`   | Tablet landscape: the phase takes the enemy row, hero and hand below          |
| T2    | `t2-tablet-portrait-villain-phase-as-a-pinned-tab.png` | Tablet portrait: villain phase as a pinned tab, hand and actions at the foot |
| T3    | `t3-tablet-recap.png`                                 | Tablet recap with a "what changed" column                                     |
| P1    | `p1-phone-interrupt-with-hand-tray.png`               | Phone: interrupt with the hand tray                                           |
| P2    | `p2-phone-encounter-reveal-hand-fanned.png`           | Phone: encounter reveal, hand fanned                                          |
| P3    | `p3-phone-peek-at-the-table.png`                      | Phone: peek at the table while the phase waits                                |
| P4    | `p4-phone-phase-recap.png`                            | Phone: phase recap                                                            |
| S1    | `s1-settings-villain-phase-pacing.png`                | Settings: villain phase pacing (auto-advance, hold, beat speed, docked table) |
| B1    | `b1-dock-widens-declare-a-defender.png`                | Desktop: the dock widens for a defend; attack, defender choices with damage ranges, the stack, Confirm |
| B2    | `b2-dock-widens-recap-as-a-story-strip.png`            | Desktop: the dock widens for the recap; table and hand stay in view                     |
| TB1   | `tb1-tablet-landscape-band-grows-for-a-defend.png`     | Tablet landscape: the band grows for a defend; compact hero row and hand below          |
| TB2   | `tb2-tablet-landscape-band-grows-for-the-recap.png`    | Tablet landscape: the band grows for the recap                                         |
| TB3   | `tb3-tablet-portrait-defend-in-the-villain-phase-tab.png` | Tablet portrait: defend inside the villain phase tab, Confirm at the thumb          |

B1–TB3 (2026-10-14, second batch) keep the table and hand in view for the defend and the recap. Each has an EXPAND
control (shown as NARROW ▸ / SHRINK ▴ once expanded) that falls back to the full-screen choice sheet and recap.

