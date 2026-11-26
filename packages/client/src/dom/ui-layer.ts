/**
 * The layer the Lit panels (`@mc/ui`) are drawn in: one element over the Phaser canvas, inside Phaser's own DOM
 * container (`dom: { createContainer: true }`, which sits exactly over the canvas), so a DOM element placed at a layout
 * `Rect` lands where Phaser would have drawn it: in `Scale.RESIZE` mode game coordinates are the canvas's CSS pixels.
 *
 * The layer carries the design tokens as CSS custom properties for the components to read (`@mc/ui`'s
 * `shared/theme.styles.ts`): every surface, accent and signal color once per channel (`--mc-text-*`, `--mc-fill-*`,
 * `--mc-line-*`), mapped through the current color scheme as `ui/color-scheme-phaser.ts` maps Phaser's, the three
 * fonts, and the small-type sizes the desktop bump draws larger (`ui/desktop-type.ts`). It follows the dark mode
 * toggle and the desktop breakpoint live.
 *
 * Nothing here draws a screen: a scene mounts its panel with `DomRegion` (`dom/dom-region.ts`).
 */
import type Phaser from "phaser";
import { accent, font, signal, status, surface, type Token } from "../tokens.js";
import { colorScheme, onColorSchemeChange, schemeColor, type ColorChannel } from "../view/color-scheme.js";
import { desktopTypeSize } from "../view/desktop-type.js";

/** The tokens the layer exposes, by the name a stylesheet reads (`--mc-fill-ink`, `--mc-text-paper`, ...). */
const COLORS: Readonly<Record<string, Token>> = {
  void: surface.void,
  ink: surface.ink,
  paper: surface.paper,
  parchment: surface.parchment,
  card: surface.card,
  red: accent.heroRed,
  "red-deep": accent.redDeep,
  cost: signal.cost,
  heal: signal.heal,
  caution: signal.caution,
  spent: signal.spent,
  "ink-on-hue": surface.inkOnHue,
  stunned: status.stunned,
  confused: status.confused,
  tough: status.tough,
};

const CHANNELS: readonly ColorChannel[] = ["text", "fill", "line"];

/** The small sizes that grow on desktop; a stylesheet writes `var(--mc-small-11)` where Phaser would ask for 11px. */
const SMALL_SIZES = [8, 9, 10, 11, 12] as const;

const css = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** Every custom property the layer sets, for a scheme and form factor. Plain data, so a test can read it. */
export function layerVariables(scheme: "light" | "dark", desktop: boolean): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [name, token] of Object.entries(COLORS))
    for (const channel of CHANNELS) out[`--mc-${channel}-${name}`] = css(schemeColor(token.hex, channel, scheme));
  out["--mc-font-display"] = `"${font.display}", sans-serif`;
  out["--mc-font-body"] = `"${font.body}", sans-serif`;
  out["--mc-font-mono"] = `"${font.mono}", monospace`;
  for (const size of SMALL_SIZES) out[`--mc-small-${size}`] = `${desktopTypeSize(size, desktop)}px`;
  return out;
}

let layer: HTMLElement | null = null;
let desktop = false;

function paint(): void {
  if (!layer) return;
  const scheme = colorScheme();
  layer.dataset.scheme = scheme;
  for (const [name, value] of Object.entries(layerVariables(scheme, desktop))) layer.style.setProperty(name, value);
}

/** The panel layer over `game`'s canvas, made on first use. */
export function uiLayer(game: Phaser.Game): HTMLElement {
  if (layer?.isConnected) return layer;
  const host = (game as unknown as { domContainer?: HTMLElement | null }).domContainer ?? document.body;
  layer = document.createElement("div");
  layer.id = "mc-ui";
  // Over the whole canvas and passing every press through, except on a panel (`DomRegion` turns its own back on).
  Object.assign(layer.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden" });
  host.append(layer);
  paint();
  return layer;
}

/** Called from `main.ts` alongside `setDesktopType`, so small text on the panels grows and shrinks with Phaser's. */
export function setUiLayerDesktop(value: boolean): void {
  if (desktop === value) return;
  desktop = value;
  paint();
}

onColorSchemeChange(() => paint());
