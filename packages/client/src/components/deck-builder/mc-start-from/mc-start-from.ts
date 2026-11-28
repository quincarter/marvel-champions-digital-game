import { McStartFrom } from "./McStartFrom.js";

if (!customElements.get("mc-start-from")) {
  customElements.define("mc-start-from", McStartFrom);
}

export { McStartFrom };
