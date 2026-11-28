import { css } from "lit";

/**
 * The seats are four equal columns; each Team-Up pair is a row of the same four columns. A pair's bracket spans the columns
 * from one partner to the other (`data-from` .. `data-to`, 1 based), its two legs stand in the middle of the first and last
 * of them (`--leg`, half a column of the span) and rise to the seats above through the rows before it (`--rise`). The pill
 * sits on the bracket's middle line.
 */
export const McSeatsTableStyles = css`
  :host {
    display: block;
    min-width: 0;
    --row: 22px;
    --gap: 6px;
  }
  .seats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--gap);
    min-height: 115px;
  }
  :host([compact]) .seats {
    min-height: 64px;
  }
  .pairs {
    display: block;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pair {
    position: relative;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: var(--gap);
    height: var(--row);
    --rise: 0px;
  }
  .pair:nth-child(2) {
    --rise: var(--row);
  }
  .pair:nth-child(3) {
    --rise: calc(var(--row) * 2);
  }
  .pair[data-span="2"] {
    --leg: 25%;
  }
  .pair[data-span="3"] {
    --leg: 16.667%;
  }
  .pair[data-span="4"] {
    --leg: 12.5%;
  }
  .pair[data-span="2"][data-from="1"] {
    grid-template-areas: "span span . .";
  }
  .pair[data-span="2"][data-from="2"] {
    grid-template-areas: ". span span .";
  }
  .pair[data-span="2"][data-from="3"] {
    grid-template-areas: ". . span span";
  }
  .pair[data-span="3"][data-from="1"] {
    grid-template-areas: "span span span .";
  }
  .pair[data-span="3"][data-from="2"] {
    grid-template-areas: ". span span span";
  }
  .pair[data-span="4"] {
    grid-template-areas: "span span span span";
  }
  /* The bracket: two legs and the line across, drawn as the borders of one box inside the pair's own columns. */
  .pair::before {
    content: "";
    grid-area: span;
    box-sizing: border-box;
    margin: calc(var(--rise) * -1) var(--leg) 0;
    height: calc(50% + var(--rise));
    border: 2px solid var(--mc-line-red);
    border-top: 0;
  }
  .pill {
    grid-area: span;
    justify-self: center;
    align-self: center;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    max-width: 100%;
    height: calc(var(--row) - 2px);
    padding: 0 8px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    border: 2px solid var(--mc-line-red);
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .badge {
    flex: none;
    width: calc(var(--row) - 6px);
    height: calc(var(--row) - 6px);
    margin-left: -6px;
  }
  .words {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
