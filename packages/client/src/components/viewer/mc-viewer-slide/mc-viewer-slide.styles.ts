import { css } from "lit";

export const McViewerSlideStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    color: var(--mc-text-paper);
  }
  .frame {
    position: relative;
    flex: 1 1 0;
    min-height: 40px;
  }
  mc-picture-tile {
    position: absolute;
    inset: 0;
  }
  .none {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    text-align: center;
    font-size: 13px;
    opacity: 0.6;
  }
  .arrow {
    position: absolute;
    top: 50%;
    width: 44px;
    height: 44px;
    margin-top: -22px;
    --mc-button-size: 18px;
  }
  .prev {
    left: 0;
  }
  .next {
    right: 0;
  }
  .caption {
    flex: none;
    height: 28px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
`;
