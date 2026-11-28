import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { ThemeStyles } from "@mc/ui";
import { raiseBriefing, type BriefingStepDetail } from "../briefing.types.js";
import "../mc-briefing-call-head/mc-briefing-call-head.js";
import "../mc-briefing-call-prompt/mc-briefing-call-prompt.js";
import "../mc-briefing-modular/mc-briefing-modular.js";
import "../mc-briefing-options/mc-briefing-options.js";
import "../mc-briefing-role-build/mc-briefing-role-build.js";
import "../mc-briefing-role-confirm/mc-briefing-role-confirm.js";
import "../mc-briefing-role-tiles/mc-briefing-role-tiles.js";
import "../mc-briefing-scheme-pick/mc-briefing-scheme-pick.js";
import type { McBriefingRoleBuild } from "../mc-briefing-role-build/McBriefingRoleBuild.js";
import { McBriefingCallStyles } from "./mc-briefing-call.styles.js";
import type { CallModel } from "./mc-briefing-call.types.js";

/**
 * # Briefing call
 * "Your call": the question the engine asked while composing the issue, as the Briefing shows it. It opens with the head (the
 * heading, why Open waits, the seat header) and, for a plain pick, the prompt, then switches on the kind of question: role-building,
 * the side-scheme pick, the modular-set pick, the role tiles (and their confirm step), or a plain list of options. A call answers
 * with `answer`; what is legal is the engine offer, never decided here. Its own progress (the role chosen, role-building filter and
 * card, the options picked) is the progress of the element that owns it and starts again with every new question (`key`).
 *
 * @element mc-briefing-call
 * @prop call - `CallModel`.
 * @fires mc-briefing - `{ type: "answer", picked }` and `inspect`.
 */
export class McBriefingCall extends LitElement {
  static override styles = [ThemeStyles, McBriefingCallStyles];

  static override properties: PropertyDeclarations = {
    call: { attribute: false },
    role: { state: true },
    ownsScroll: { type: Boolean, reflect: true, attribute: "owns-scroll" },
  };

  declare call: CallModel | null;
  /** The role whose confirm step is open. */
  declare role: string | null;
  declare ownsScroll: boolean;

  constructor() {
    super();
    this.call = null;
    this.role = null;
    this.ownsScroll = false;
    this.addEventListener("mc-briefing-step", (event) => this.#step(event.detail, event));
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("call")) {
      const before = changed.get("call") as CallModel | null | undefined;
      if (before?.key !== this.call?.key) this.role = null;
      this.ownsScroll = this.call?.ownsScroll ?? false;
    }
  }

  /** A card chosen in the Inspect sheet ("Take this card"): role-building opens its confirm step. */
  takeFromInspect(optionId: string): void {
    this.renderRoot.querySelector<McBriefingRoleBuild>("mc-briefing-role-build")?.take(optionId);
  }

  #step(detail: BriefingStepDetail, event: Event): void {
    if (this.call?.body.kind !== "role") return;
    if (detail.type === "role") this.role = detail.id;
    else if (detail.type === "back") this.role = null;
    else if (detail.type === "confirm" && this.role !== null) raiseBriefing(this, { type: "answer", picked: [this.role] });
    else return;
    event.stopPropagation();
  }

  override render() {
    const call = this.call;
    if (!call) return nothing;
    const { body } = call;
    return keyed(
      call.key,
      html`<mc-briefing-call-head .model=${call.head}></mc-briefing-call-head>
        ${call.prompt ? html`<mc-briefing-call-prompt .model=${call.prompt}></mc-briefing-call-prompt>` : nothing}
        ${
          body.kind === "roleBuild"
            ? html`<mc-briefing-role-build .model=${body.model}></mc-briefing-role-build>`
            : body.kind === "sideScheme"
              ? html`<mc-briefing-scheme-pick .model=${body.model}></mc-briefing-scheme-pick>`
              : body.kind === "modular"
                ? html`<mc-briefing-modular .view=${body.view}></mc-briefing-modular>`
                : body.kind === "role"
                  ? this.role !== null && body.confirms.has(this.role)
                    ? html`<mc-briefing-role-confirm .model=${body.confirms.get(this.role)}></mc-briefing-role-confirm>`
                    : html`<mc-briefing-role-tiles .model=${body.tiles}></mc-briefing-role-tiles>`
                  : html`<mc-briefing-options .model=${body.model}></mc-briefing-options>`
        }`,
    );
  }
}
