import { McReaderNav } from "./McReaderNav.js";

if (!customElements.get("mc-reader-nav")) {
  customElements.define("mc-reader-nav", McReaderNav);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-reader-nav": McReaderNav;
  }
}

export { McReaderNav };
