import { creatorsOf } from "./creators.js";

describe("creatorsOf", () => {
  it("names a creator once across handle and team credits", () => {
    expect(
      creatorsOf([
        "Neptune",
        "Neptune (Typhon00)",
        "DesignHacker",
        "DesignHacker & BlueHG (nemesis set)",
        "Gideon's Gaming",
        "bluefire",
        "Bluefire",
      ]),
    ).toEqual(["bluefire", "BlueHG", "DesignHacker", "Gideon's Gaming", "Neptune"]);
  });

  it("keeps a name that only contains a joining word", () => {
    expect(creatorsOf(["Andy Sandy"])).toEqual(["Andy Sandy"]);
  });
});
