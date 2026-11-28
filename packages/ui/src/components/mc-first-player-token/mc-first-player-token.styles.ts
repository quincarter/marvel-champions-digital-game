import { css } from "lit";

export const McFirstPlayerTokenStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    /* The seat under it is the control: the token takes no press. */
    pointer-events: none;
  }
  .token,
  .shadow {
    position: absolute;
    will-change: transform, opacity;
  }
  .token {
    inset: 0;
    display: grid;
    place-items: center;
  }
  .token img {
    width: 100%;
    height: 100%;
    display: block;
    user-select: none;
  }
  /* The ellipse on the table under the token: 80% of its width and 28% of its height, resting a third of its size lower. */
  .shadow {
    left: 10%;
    top: 72%;
    width: 80%;
    height: 28%;
    border-radius: 50%;
    background: var(--mc-token-shadow, rgb(0 0 0 / 35%));
  }
  .disc {
    width: calc(100% - 4px);
    height: calc(100% - 4px);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--mc-fill-red);
    border: 3px solid var(--mc-line-ink);
    color: var(--mc-text-paper);
    font-weight: 700;
    font-size: 34cqw;
  }
  :host {
    container-type: size;
  }
`;
