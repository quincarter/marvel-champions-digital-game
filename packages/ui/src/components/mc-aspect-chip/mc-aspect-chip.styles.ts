import { css } from "lit";

/**
 * The aspect chip: the aspect's printed frame color with its name on it, a 1px ink border, a label-role word
 * (Public Sans 800, tracked, capitals). The fill and the word's ink come from the layer's `--mc-fill-<aspect>` and
 * `--mc-text-on-<aspect>` (the same stamp the Phaser chip draws); neither is remapped in dark mode.
 */
export const McAspectChipStyles = css`
  :host {
    display: inline-block;
    vertical-align: top;
  }
  .chip {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: var(--chip-height, 18px);
    padding: 0 7px;
    background: var(--chip-fill, var(--mc-fill-spent));
    color: var(--chip-ink, var(--mc-text-ink));
    border: 1px solid var(--mc-line-ink);
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--chip-size, 10px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    line-height: 1;
    user-select: none;
  }
  button.chip {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
`;
