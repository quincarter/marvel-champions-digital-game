import { css, unsafeCSS } from "lit";

/** One bracket row's depth. Pairs are at most six (four seats), so the depths are written out. */
const depths = [1, 2, 3, 4, 5, 6]
  .map(
    (row) => `
  .bracket[data-row="${row}"] {
    height: ${row * 30}px;
  }
  .strip[data-rows="${row}"] {
    min-height: ${row * 30 + 18}px;
  }`,
  )
  .join("");

export const McSeatPairsStyles = css`
  :host {
    display: block;
  }
  .strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: var(--mc-seats-gap, 12px);
    padding-bottom: 18px;
    box-sizing: border-box;
  }
  .bracket {
    --span: 2;
    position: relative;
    grid-row: 1;
    align-self: start;
    pointer-events: none;
  }
  .bracket[data-span="3"] {
    --span: 3;
  }
  .bracket[data-span="4"] {
    --span: 4;
  }
  .bracket[data-from="1"] {
    grid-column-start: 1;
  }
  .bracket[data-from="2"] {
    grid-column-start: 2;
  }
  .bracket[data-from="3"] {
    grid-column-start: 3;
  }
  .bracket[data-span="2"] {
    grid-column-end: span 2;
  }
  .bracket[data-span="3"] {
    grid-column-end: span 3;
  }
  .bracket[data-span="4"] {
    grid-column-end: span 4;
  }
  /* From the centre of the first card down, across, and up to the centre of the last. */
  .bracket::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc((100% - (var(--span) - 1) * var(--mc-seats-gap, 12px)) / (var(--span) * 2));
    right: calc((100% - (var(--span) - 1) * var(--mc-seats-gap, 12px)) / (var(--span) * 2));
    border: 2px solid var(--mc-line-red);
    border-top: 0;
  }
  .pill {
    position: absolute;
    left: 50%;
    bottom: 0;
    transform: translate(-50%, 50%);
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 90%;
    height: 26px;
    padding: 0 8px;
    box-sizing: border-box;
    color: var(--mc-text-paper);
    background: var(--mc-fill-ink);
    border: 2px solid var(--mc-line-red);
  }
  .badge {
    flex: none;
    width: 20px;
    height: 20px;
    margin-left: -6px;
  }
  .label {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  ${unsafeCSS(depths)}
`;
