import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { placeArtSlot, type SlotParent } from "./art-slot.js";

type Fake = Phaser.GameObjects.GameObject;

function fake(name: string): Fake {
  const object = { name, active: true, parentContainer: null, destroy: () => (object.active = false) };
  return object as unknown as Fake;
}

class FakeParent implements SlotParent {
  readonly list: Phaser.GameObjects.GameObject[] = [];
  getIndex(child: Phaser.GameObjects.GameObject): number {
    return this.list.indexOf(child);
  }
  addAt(child: Phaser.GameObjects.GameObject, index: number): void {
    this.list.splice(index, 0, child);
  }
}

describe("placeArtSlot", () => {
  it("draws the scan at once when it is on hand, and asks for it again on each refresh while it is shown", () => {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const picture = fake("picture");
    let asked = 0;
    const fill = placeArtSlot(
      {
        request: () => {
          asked++;
          return "scan";
        },
        identity: () => "texture",
        draw: () => picture,
        sceneList: new FakeParent(),
      },
      objects,
      () => fake("stand-in"),
    );
    expect(objects).toEqual([picture]);
    expect(fill()).toBe(true);
    // Asked again, so the cache counts it as in use and never evicts it while it is on screen.
    expect(asked).toBe(2);
    expect(objects).toEqual([picture]);
    picture.destroy();
    fill();
    expect(asked).toBe(2);
  });

  it("puts a picture with no container where the stand-in was on the scene's list", () => {
    let onHand: string | null = null;
    const scene = new FakeParent();
    const moved: [Phaser.GameObjects.GameObject, number][] = [];
    const list = Object.assign(scene, {
      moveTo: (child: Phaser.GameObjects.GameObject, index: number) => moved.push([child, index]),
    });
    const before = fake("panel");
    const standIn = fake("stand-in");
    const picture = fake("picture");
    list.list.push(before, standIn, picture);
    const fill = placeArtSlot(
      {
        request: () => onHand,
        identity: () => "texture",
        draw: () => picture,
        sceneList: { getIndex: (c) => list.getIndex(c), moveTo: list.moveTo },
      },
      [],
      () => standIn,
    );
    onHand = "scan";
    expect(fill()).toBe(true);
    expect(moved).toEqual([[picture, 1]]);
  });

  it("swaps only the stand-in for the picture, in the same place, once the scan arrives", () => {
    let onHand: string | null = null;
    const container = new FakeParent();
    const before = fake("panel");
    const standIn = fake("stand-in");
    const after = fake("caption");
    (standIn as unknown as { parentContainer: unknown }).parentContainer = container;
    container.list.push(before, standIn, after);
    const objects: Phaser.GameObjects.GameObject[] = [before];
    const picture = fake("picture");
    const fill = placeArtSlot(
      { request: () => onHand, identity: () => "texture", draw: () => picture, sceneList: new FakeParent() },
      objects,
      () => standIn,
    );
    objects.push(after);

    expect(fill()).toBe(false);
    expect(standIn.active).toBe(true);

    onHand = "scan";
    expect(fill()).toBe(true);
    expect(standIn.active).toBe(false);
    expect(objects).toEqual([before, picture, after]);
    expect(container.list.indexOf(picture)).toBe(1);
    // Later batches leave it alone.
    expect(fill()).toBe(true);
    expect(objects.filter((object) => object === picture)).toHaveLength(1);
  });

  it("does nothing once the row that held the stand-in is gone", () => {
    let drawn = 0;
    const standIn = fake("stand-in");
    let onHand: string | null = null;
    const fill = placeArtSlot(
      {
        request: () => onHand,
        identity: () => "texture",
        draw: () => {
          drawn++;
          return fake("picture");
        },
        sceneList: new FakeParent(),
      },
      [],
      () => standIn,
    );
    standIn.destroy();
    onHand = "scan";
    expect(fill()).toBe(false);
    expect(drawn).toBe(0);
  });

  it("puts the stand-in back when a shown picture was evicted, and the picture again once it is back", () => {
    let onHand: string | null = "scan";
    const container = new FakeParent();
    const objects: Phaser.GameObjects.GameObject[] = [];
    const pictures: Phaser.GameObjects.GameObject[] = [];
    const standIns: Phaser.GameObjects.GameObject[] = [];
    const inContainer = (object: Phaser.GameObjects.GameObject): Phaser.GameObjects.GameObject => {
      (object as unknown as { parentContainer: unknown }).parentContainer = container;
      return object;
    };
    const fill = placeArtSlot(
      {
        request: () => onHand,
        identity: () => "texture",
        draw: () => {
          const picture = fake(`picture ${pictures.length}`);
          pictures.push(picture);
          return picture;
        },
        sceneList: new FakeParent(),
      },
      objects,
      () => {
        const standIn = fake("stand-in");
        standIns.push(standIn);
        return standIn;
      },
    );
    container.list.push(inContainer(pictures[0]!));

    onHand = null;
    expect(fill()).toBe(false);
    expect(pictures[0]!.active).toBe(false);
    expect(objects).toEqual([standIns[0]]);
    inContainer(standIns[0]!);

    onHand = "scan";
    expect(fill()).toBe(true);
    expect(objects).toEqual([pictures[1]]);
    expect(standIns[0]!.active).toBe(false);
  });

  it("draws the picture again when its scan was evicted and loaded again between two refreshes", () => {
    let texture = "first";
    const container = new FakeParent();
    const objects: Phaser.GameObjects.GameObject[] = [];
    const pictures: Phaser.GameObjects.GameObject[] = [];
    const fill = placeArtSlot(
      {
        request: () => "scan",
        identity: () => texture,
        draw: () => {
          const picture = fake(`picture ${pictures.length}`);
          (picture as unknown as { parentContainer: unknown }).parentContainer = container;
          pictures.push(picture);
          return picture;
        },
        sceneList: new FakeParent(),
      },
      objects,
      () => fake("stand-in"),
    );
    container.list.push(pictures[0]!);
    expect(fill()).toBe(true);
    expect(pictures).toHaveLength(1);

    // Same key, new texture: present, evicted and loaded again before this refresh.
    texture = "second";
    expect(fill()).toBe(true);
    expect(pictures).toHaveLength(2);
    expect(pictures[0]!.active).toBe(false);
    expect(objects).toEqual([pictures[1]]);
    expect(fill()).toBe(true);
    expect(pictures).toHaveLength(2);
  });
});
