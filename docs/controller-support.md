# Controller support: audit and plan

Status: building (owner answers 2026-10-24). Branch `feature/controller-support`. Follows issue #206, whose first part
(spatial navigation and ring alignment) landed in #207; parts 2 to 6 never did.

## Owner decisions (2026-10-24)

1. **Steam Deck / Steam Input: take what Steam sends.** Steam presents a virtual Xbox pad and its own "Use Nintendo
   layout" option already swaps buttons, so the game never swaps on top of it.
2. **Everywhere else: a "Use Nintendo Switch layout" setting.** On a Nintendo-family pad, buttons act by their printed
   label (A on the right confirms, B at the bottom backs out), as on a Switch. Defaults on; ignored for Xbox and
   PlayStation pads and under Steam.
3. **Remapping is a follow-on.** This pass stores bindings as data and draws the controllers read-only.
4. **Keyboard shortcuts land in this pass.**
5. **Glyphs on the board** for the keyboard and the controller, wherever a shortcut applies, only when a keyboard or
   pad is in use (never for touch). While the mouse is moving the glyphs collapse; when it stops they expand again
   (animated). A setting turns glyphs off altogether, in the keyboard and controller settings.

## What exists today

- `view/gamepad.ts` maps the Web Gamepad "standard" layout to the same intents the keyboard produces. D-pad moves
  focus spatially, A activates, B backs out, Y inspects, X toggles guide focus, LB / RB page a list.
- `scenes/board/input.ts#bindGamepad` listens on Phaser's gamepad plugin (turned on in `main.ts`). It is bound by the
  shared `FocusRoute` (57 screens), the Board, the choice sheet, Inspect and the setup deal, so the pad already reaches
  every screen that has a focus route.

## What is missing

- **No analog stick and no hold-to-repeat.** The left stick does nothing; holding the D-pad moves once.
- **No detection.** `Gamepad.id` is never read, so nothing knows Xbox from PlayStation from Switch, and there is no
  "controller connected" notice.
- **No glyphs.** Hints are hard-coded text: "Press G (or X on a gamepad)" (`board/guide-mount.ts`,
  `board/tip-mount.ts`), "Cancel · Esc" (`board/targeting-panel.ts`).
- **Board shortcuts are keyboard-only:** T (Team-Up), E (Evidence), Z (Undo), 1 to 3 (answer a small choice bar). No
  pad button reaches End turn, Undo or Pause directly (B with nothing selected opens Pause).
- **Keyboard-only listeners** on the Team-Up splash, the achievement toast (Esc), and the arrow paging in the scenario
  intro, side-story reader, extras viewer and campaign opener.
- **Text fields** (save/sync codes, deck import, deck names, report issue) have no pad path.
- **Pads without the "standard" mapping** are ignored.
- **Desktop app on Linux / Steam Deck is unverified.** Windows Tauri runs WebView2 (Chromium, Gamepad API works).
  Linux Tauri runs WebKitGTK, whose Gamepad API depends on how it was built (libmanette). Inferred, not yet checked
  on a Deck.
- **No Controls screen** and no remapping.

## Proposed button map

Positional names (Xbox letters; PlayStation and Switch glyphs are drawn at the same positions).

| Button                 | Everywhere                                                         | On the board                                                              |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| D-pad / left stick     | Move focus (stick: deadzone, then repeat; D-pad repeats when held) | same                                                                      |
| A (bottom)             | Confirm / press                                                    | Play or use the focused card                                              |
| B (right)              | Back / cancel                                                      | Cancel the current mode; with nothing open, Pause                         |
| Y (top)                | Inspect the focused card                                           | same                                                                      |
| X (left)               | Guide focus toggle (unchanged)                                     | same                                                                      |
| LB / RB                | Previous / next page or tab                                        | Jump between zones: hand, your play area, villain and schemes, action bar |
| LT                     |                                                                    | Undo                                                                      |
| RT                     |                                                                    | End turn (through the existing "You can still…" confirm)                  |
| Menu / Start / +       | Pause                                                              | Pause                                                                     |
| View / Select / −      |                                                                    | Game log; on a decision popup, Peek at table                              |
| Right stick            | Scroll the list or row under focus (hand, log, lists)              | same                                                                      |
| R3 (right stick press) |                                                                    | Expand / Collapse a decision popup                                        |
| L3                     | unbound (available to remap)                                       |                                                                           |

Keyboard additions on the board (existing T, E, Z, 1 to 3 kept): **A** Attack, **H** Thwart, **R** Recover,
**F** Change form, **Shift+Enter** End turn, **[ / ]** previous / next zone, **L** game log.

## Detection and glyph families

Read `Gamepad.id` (vendor and product ids) when a pad connects:

| Family                            | Matched by                                                             | Face glyphs                           |
| --------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| Xbox                              | Microsoft 045e, "xinput", "xbox", Steam virtual pad 28de               | A B X Y, LB RB LT RT, View, Menu      |
| PlayStation                       | Sony 054c, "dualshock", "dualsense"                                    | ✕ ○ □ △, L1 R1 L2 R2, Create, Options |
| Nintendo                          | Nintendo 057e, "pro controller", "joy-con"                             | B A Y X by position, L R ZL ZR, −, +  |
| Handheld (Steam Deck and similar) | Valve 28de / Deck product ids; Steam Input presents a virtual Xbox pad | Xbox glyphs on a handheld diagram     |

Expected for the owner's pads (inferred, to confirm with them): the 8BitDo Ultimate in Switch mode reports as a
Nintendo Pro Controller, and the Ultimate 2 in X-input mode as an Xbox 360 pad. Settings gets **Controller buttons:
Auto / Xbox / PlayStation / Nintendo** for when detection is wrong, plus the confirm/back swap.

All glyphs and controller outlines are drawn by us in Phaser (shapes and letters), no manufacturer artwork.

## Controls screen and remapping

- A **Controls** section in Settings (and Pause), with a drawn controller for the active family (Xbox, PlayStation,
  Switch, handheld). Each button on the drawing is labeled with what it does; a row list beside it is the focusable
  version.
- **Bindings are data from day one:** a table of intent per button index, saved with the settings. The default table is
  the map above.
- **Remapping (PR 2 unless the owner says otherwise):** focus a row, press A, then press the new button; conflicts swap
  the two bindings; "Reset to defaults". Keyboard keys rebind the same way.
- **Back buttons on handhelds** (Deck L4/L5/R4/R5, ROG Ally / Legion Go paddles): browsers do not report them, Steam
  Input or the handheld's own software maps them onto ordinary buttons. If a browser does report extra buttons (index
  16 and up), they show on the Controls screen as "Extra 1, 2…" and can be bound like any other. The Controls screen
  notes that back buttons are set in Steam Input.

## On-screen hints

- Hints follow the last input: pad glyphs after a button press, key caps after a key press, nothing after touch or
  mouse.
- Buttons with a shortcut show its glyph (End turn [RT], Undo [LT], Cancel [B]), and each screen gets a small legend
  strip (A Select · B Back · Y Inspect). The hard-coded "Press G (or X on a gamepad)" and "Cancel · Esc" become glyph
  hints.
- A one-time toast when a pad connects: "🎮 Xbox controller connected · Controls in Settings".

## Platforms

- Web (Chromium, Firefox, Safari): Gamepad API, standard mapping.
- Windows desktop (Tauri, WebView2): same as Chromium.
- Steam Deck / Linux desktop (Tauri, WebKitGTK): verify the Gamepad API first. If WebKitGTK does not expose pads, add
  a small Rust-side bridge (the `gilrs` crate) that forwards button and axis events to the page through a Tauri event,
  feeding the same intent layer.
- Android (Capacitor, Chromium WebView): Gamepad API; Bluetooth pads.
- Text fields: a pad cannot type. On a Deck in Game Mode the Steam keyboard (Steam + X) works; the field shows that
  hint when the last input was a pad.

## Build order (one PR, pushed piece by piece)

1. Input layer: family detection, held-button repeat, left stick with deadzone and repeat, right-stick scroll, pads
   without standard mapping logged and ignored. Unit tests with real `Gamepad.id` strings.
2. Bindings as data, the new board buttons (LB/RB zones, LT Undo, RT End turn, Menu Pause, View log / Peek, R3
   Expand), and pad routes for the keyboard-only screens.
3. Glyph set (four families) and the settings override, last-input tracking, glyph hints and the connect toast.
4. Controls screen with the drawn controllers (read-only, or with remapping per question 2).
5. Keyboard shortcuts on the board.
6. Linux/Deck check, and the `gilrs` bridge if needed.

Testing: unit tests for detection, repeat and the binding table; e2e specs that stub `navigator.getGamepads()` to press
buttons and move sticks; a real-pad check on the owner's two 8BitDo controllers.
