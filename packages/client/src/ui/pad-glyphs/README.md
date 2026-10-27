# Controller button pictures

One SVG per button and family, drawn by `McInputGlyph` (`ui/input-glyph.ts`) through `view/pad-glyph-art.ts`. Files are
named by position, not label: `face-south` is the bottom face button (Xbox A, PlayStation ✕, Switch B), `lb` / `lt`
the left bumper and trigger (L1 / L2, L / ZL), `ls` / `rs` the stick presses, `view` / `menu` the left and right
system buttons, and `lstick` / `rstick` a stick being moved.

All three sets are from Figma Community and licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/):

- `xbox/`: "Xbox Controller Icons Free" by Alric Monteiro,
  https://www.figma.com/community/file/1271153059120916114/xbox-controller-icons-free
- `playstation/`: "PlayStation Controller Icons" by Antoine Plu,
  https://www.figma.com/community/file/968584708653901737/playstation-controller-icons
  (its Create and Options buttons are not here yet, so those draw as plain labels)
- `nintendo/`: "Switch Button Icons [Essential pack]" by Gioele Casazza (the Solid, Duo, dark set),
  https://www.figma.com/community/file/1311838981334678894/switch-button-icons-essential-pack

Changed from the originals: each icon is cut out of its sheet into its own SVG and trimmed to its bounds, layer names
are dropped, and each set's two neutral colors are replaced with the placeholders `BODY` (the button) and `CUT` (the
letter or mark cut into it), which `view/pad-glyph-art.ts` fills in with the game's palette. The colored Xbox A, B, X
and Y discs and the colored PlayStation face symbols keep their original colors.

The controllers are Microsoft's, Sony's and Nintendo's designs and trademarks.
