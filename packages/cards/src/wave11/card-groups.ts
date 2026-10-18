/**
 * Every wave 11 hero-pack card (`jj` 61001a to 61040, `luke_cage` 62001a to 62037) belongs to exactly one scripting
 * module. `CARD_GROUPS` (module path to card ids) is checked against the emitted data, against the modules on disk and
 * against each module's header list, so a card cannot be left out, listed twice or filed under the wrong pack
 * unnoticed.
 *
 * Grouping: docs/phase7-wave11-hero-packs.md H8.4; each reprint is filed under its own aspect module. `fne` (Fear No
 * Evil) joins with its own scaffold task: its groups are added to this file, `modules.ts` and the guards' pack lists.
 */
export const CARD_GROUPS: Readonly<Record<string, readonly string[]>> = {
  "jj/jessica-jones/identity": ["61001a", "61002"],
  "jj/jessica-jones/events": ["61004", "61005", "61006", "61007"],
  "jj/jessica-jones/support-upgrades-allies": ["61003", "61008", "61009", "61010", "61011", "61012", "61013", "61014"],
  "jj/jessica-jones/obligation-nemesis": ["61030", "61031", "61032", "61033a", "61033b", "61033c"],
  "jj/justice": ["61015", "61016", "61017", "61018", "61019", "61020", "61021", "61022", "61023", "61024", "61036"],
  "jj/other-aspects": ["61034", "61035", "61037", "61038", "61039", "61040"],
  "jj/basic": ["61025", "61026", "61027", "61028", "61029"],
  "luke_cage/luke-cage/identity": ["62001a"],
  "luke_cage/luke-cage/events": ["62003", "62004", "62005", "62006"],
  "luke_cage/luke-cage/support-upgrades-allies": ["62002", "62007", "62008", "62009", "62010", "62011"],
  "luke_cage/luke-cage/obligation-nemesis": ["62028", "62029", "62030", "62031", "62032", "62033"],
  "luke_cage/leadership": ["62012", "62013", "62014", "62015", "62016", "62017", "62018", "62019"],
  "luke_cage/other-aspects-basic": [
    "62020",
    "62021",
    "62022",
    "62023",
    "62024",
    "62025",
    "62026",
    "62027",
    "62034",
    "62035",
    "62036",
    "62037",
  ],
};
