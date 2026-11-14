import { heroAction, thwartAScheme } from "@mc/cards";
import { definePackAbilities } from "../../../define.js";

export default definePackAbilities({
  // Test Rally: Hero Action (thwart): Remove 2 threat from a scheme.
  "x.tiny-pack.02.test-rally-action": heroAction({ label: "thwart" }, thwartAScheme(2)),
});
