import { CORE_CARDS } from "@mc/content";
import { CORE_ABILITIES } from "./index.js";
import { PENDING } from "./pending.js";
import { abilityRefIds } from "../ability-refs.js";

const ALL_REFS = CORE_CARDS.flatMap(abilityRefIds);
const registered = new Set(Object.keys(CORE_ABILITIES));

describe("Core Set ability coverage", () => {
  it("has 233 ability references, each id unique", () => {
    expect(ALL_REFS).toHaveLength(233);
    expect(new Set(ALL_REFS).size).toBe(ALL_REFS.length);
  });

  it("every ability reference has a registry entry (except the explicit PENDING list)", () => {
    const missing = ALL_REFS.filter((id) => !registered.has(id) && !PENDING.includes(id));
    expect(missing, `unscripted ability refs (script them or list them in PENDING):\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("PENDING only lists real refs that are still unscripted", () => {
    const stale = PENDING.filter((id) => !ALL_REFS.includes(id) || registered.has(id));
    expect(stale, `remove these from PENDING:\n${stale.join("\n")}`).toEqual([]);
  });

  it("every registry key names a real ability reference", () => {
    const unknown = [...registered].filter((id) => !ALL_REFS.includes(id));
    expect(unknown, `registry entries with no matching card ref:\n${unknown.join("\n")}`).toEqual([]);
  });
});
