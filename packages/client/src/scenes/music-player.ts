/**
 * The music player (#191), opened from the music button in the top bar (`scenes/music-button.ts`): what is playing,
 * Shuffle and Next, and the songs earned so far, each a tap away. What is earned and the shuffle order are
 * `view/music-player.ts`'s; the playing is the music controller's (`audio/music-controller.ts`).
 *
 * On a tablet or desktop it is a popover hanging from the music button, closed by the button, a tap outside, ✕ or Esc.
 * On a phone it fills the screen under the top bar, with Back at its top (and the music button and Esc still close it).
 *
 * While it is up, the screens under it take no input, and get it back when it closes, the same rule "Report an issue"
 * follows. The top bar's two chrome buttons stay live above it.
 */
import Phaser from "phaser";
import { accent, hit, ink, surface, typeRole, type TypeSpec } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText } from "../ui/widgets.js";
import { onTap } from "../ui/tap.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { shownMusicButton } from "../ui/music-slot.js";
import { ListScroll } from "../view/list-scroll.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import {
  PLAYER_FOOT_HEIGHT,
  PLAYER_ROW_HEIGHT,
  earnedSongsOf,
  lockedSongCount,
  playerPanelRect,
  type PlayerSong,
} from "../view/music-player.js";
import { extras } from "../progression/progression.js";
import { appSession } from "../session.js";
import { drawNowPlayingPanel } from "../ui/now-playing-panel.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { CHROME_SCENES, SCENES } from "./keys.js";

const BUTTON_TYPE: TypeSpec = { ...typeRole.label, size: 12 };

export class MusicPlayerOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  readonly #scroll = new ListScroll();
  /** The input this panel turned off, to turn back on when it closes (see `scenes/report-issue.ts`). */
  #disabled: { readonly scene: Phaser.Scene; readonly pointer: boolean; readonly keyboard: boolean }[] = [];
  #unsubscribe: (() => void) | null = null;
  #alive = false;

  constructor() {
    super(SCENES.musicPlayer);
  }

  create(): void {
    this.#alive = true;
    this.#disabled = this.scene.manager
      .getScenes(true)
      .filter((scene) => scene !== this && !CHROME_SCENES.has(scene.scene.key) && scene.input)
      .map((scene) => ({ scene, pointer: scene.input.enabled, keyboard: scene.input.keyboard?.enabled === true }))
      .filter(({ pointer, keyboard }) => pointer || keyboard);
    for (const { scene, pointer, keyboard } of this.#disabled) {
      if (pointer) scene.input.enabled = false;
      if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = false;
    }
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#close(),
      onPage: (direction) => this.#list?.scrollByPage(direction),
    });
    const offTrack = appSession().music?.onTrackStart(() => this.#redrawSoon());
    const offPause = appSession().music?.onPauseChange(() => this.#redrawSoon());
    this.#unsubscribe = () => {
      offTrack?.();
      offPause?.();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#destroyWidgets();
      for (const { scene, pointer, keyboard } of this.#disabled) {
        if (!scene.sys.isActive()) continue;
        if (pointer) scene.input.enabled = true;
        if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = true;
      }
      this.#disabled = [];
    });
    this.#draw();
  }

  #close(): void {
    this.scene.stop();
  }

  #redrawSoon(): void {
    if (!this.#alive) return;
    this.time.delayedCall(0, () => this.#draw());
  }

  #destroyWidgets(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#list?.destroy();
    this.#list = null;
  }

  #play(song: PlayerSong): void {
    const music = appSession().music;
    if (!music || music.nowPlaying()?.key === song.track.key) return;
    music.playTrack(song.track);
    this.#draw();
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const formFactor = formFactorFor(width, height);
    const phone = formFactor === "phone" || formFactor === "phoneLandscape";
    const icon = shownMusicButton() ?? { x: width - 104, y: 5, width: 44, height: 34 };
    const current = extras();
    const songs = earnedSongsOf(current);
    const locked = lockedSongCount(current);
    const panel = playerPanelRect(icon, { width, height }, phone, songs.length);
    const playing = appSession().music?.nowPlaying() ?? null;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    // A tap outside the popover closes it; on a phone the panel is all there is below the bar. A tap, not any release:
    // a swipe of the song list that lifts outside the panel leaves it open.
    const outside = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    onTap(
      outside,
      (pointer) => {
        const inside =
          pointer.x >= panel.x &&
          pointer.x <= panel.x + panel.width &&
          pointer.y >= panel.y &&
          pointer.y <= panel.y + panel.height;
        if (!inside) this.#close();
      },
      "music-player-outside",
    );

    const g = this.add.graphics();
    if (!phone) g.fillStyle(surface.void.hex, 0.28).fillRect(panel.x + 6, panel.y + 6, panel.width, panel.height);
    g.fillStyle(surface.paper.hex, 1).fillRect(panel.x, panel.y, panel.width, panel.height);
    if (!phone)
      g.lineStyle(3, surface.ink.hex, 1).strokeRect(panel.x + 1.5, panel.y + 1.5, panel.width - 3, panel.height - 3);
    // The caret up to the music button the popover hangs from: paper with an ink edge, so it reads on the table's
    // ink bar and on Title's paper alike.
    if (!phone) {
      const cx = icon.x + icon.width / 2;
      g.fillStyle(surface.paper.hex, 1).fillTriangle(cx - 10, panel.y + 3, cx + 10, panel.y + 3, cx, panel.y - 8);
      g.lineStyle(3, surface.ink.hex, 1)
        .lineBetween(cx - 10, panel.y + 1.5, cx, panel.y - 8)
        .lineBetween(cx, panel.y - 8, cx + 10, panel.y + 1.5);
    }

    const pad = phone ? 16 : 14;
    const inner = { x: panel.x + pad, width: panel.width - pad * 2 };
    let y = panel.y + (phone ? 6 : 4);

    // Header: Back (phone) or ✕, the title and the earned count.
    const headHeight = 44;
    const closeWidth = phone ? 92 : hit.target;
    const closeRect: Rect = phone
      ? { x: inner.x, y: y + (headHeight - 36) / 2, width: closeWidth, height: 36 }
      : { x: inner.x + inner.width - 36, y: y + (headHeight - 36) / 2, width: 36, height: 36 };
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: phone ? "◂ BACK" : "✕",
        type: BUTTON_TYPE,
        rect: closeRect,
        onClick: () => this.#close(),
      }),
    );
    stops.set("close", { rect: closeRect, activate: () => this.#close() });
    order.push("close");
    const titleX = phone ? closeRect.x + closeRect.width + 12 : inner.x;
    this.add
      .text(titleX, y + headHeight / 2, "Music", textStyle(typeRole.sectionHeader, surface.ink.hex))
      .setOrigin(0, 0.5);
    const total = songs.length + locked;
    this.add
      .text(
        phone ? inner.x + inner.width : closeRect.x - 10,
        y + headHeight / 2,
        `${songs.length} of ${total} earned`,
        textStyle(typeRole.label, surface.ink.hex, ink.secondary),
      )
      .setOrigin(1, 0.5);
    y += headHeight;

    // Now playing, Shuffle and Next.
    const head = drawNowPlayingPanel(this, {
      x: inner.x,
      y,
      width: inner.width,
      expanded: false,
      songs,
      onChange: () => this.#draw(),
    });
    this.#buttons.push(...head.buttons);
    for (const stop of head.stops) {
      stops.set(stop.id, { rect: stop.rect, activate: stop.activate });
      order.push(stop.id);
    }
    y += head.height + 8;

    // The songs.
    const listRect: Rect = {
      x: inner.x,
      y,
      width: inner.width,
      height: Math.max(PLAYER_ROW_HEIGHT, panel.y + panel.height - PLAYER_FOOT_HEIGHT - y),
    };
    let list: McVirtualList;
    list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: PLAYER_ROW_HEIGHT,
      count: songs.length,
      scroll: this.#scroll,
      background: false,
      renderRow: (index, rect) => this.#songRow(songs[index]!, rect, playing?.key ?? null),
      onRowActivate: (index) => this.#play(songs[index]!),
    });
    this.#list = list;
    songs.forEach((song, index) => {
      const id = `song:${song.id}`;
      order.push(id);
      stops.set(id, {
        rect: () => list.rectFor(index),
        activate: () => this.#play(song),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });
    if (songs.length === 0) {
      this.add
        .text(
          listRect.x,
          listRect.y + 8,
          "No songs earned yet.",
          textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        )
        .setFontSize(13);
    }

    const foot = this.add
      .text(
        inner.x,
        panel.y + panel.height - PLAYER_FOOT_HEIGHT / 2,
        locked > 0 ? `${locked} more to earn: play, beat and lose to villains.` : "Every song earned.",
        textStyle(typeRole.body, surface.ink.hex, ink.meta),
      )
      .setOrigin(0, 0.5)
      .setFontSize(11);
    fitText(foot, inner.width, 11);

    this.#route?.set(order, stops);

    // Headless click-through hook only: the player's controls where they are drawn now, for the e2e specs.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcMusicPlayerDebug?: unknown }).__mcMusicPlayerDebug = {
        stopRect: (id: string): Rect | null => {
          const stop = stops.get(id);
          if (!stop) return null;
          return typeof stop.rect === "function" ? stop.rect() : stop.rect;
        },
        volumeRect: (): Rect | null => {
          const zone = this.children.getByName("music-volume") as Phaser.GameObjects.Zone | null;
          return zone ? { x: zone.x, y: zone.y, width: zone.width, height: zone.height } : null;
        },
        listRect: (): Rect => listRect,
        paused: (): boolean => appSession().music?.paused() ?? false,
        volume: (): number => appSession().settings.musicVolume,
      };
    }
  }

  #songRow(song: PlayerSong, rect: Rect, playingKey: string | null): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const isPlaying = song.track.key === playingKey;
    const row: Rect = { x: rect.x, y: rect.y + 3, width: rect.width - 10, height: rect.height - 6 };
    const g = this.add.graphics();
    g.fillStyle(isPlaying ? surface.ink.hex : surface.parchment.hex, 1).fillRect(row.x, row.y, row.width, row.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(row.x + 1, row.y + 1, row.width - 2, row.height - 2);
    objects.push(g);

    const fg = isPlaying ? surface.paper.hex : surface.ink.hex;
    const disc = row.height - 14;
    const cx = row.x + 7 + disc / 2;
    const cy = row.y + row.height / 2;
    const circle = this.add.graphics();
    circle.fillStyle(accent.heroRed.hex, 1).fillCircle(cx, cy, disc / 2);
    objects.push(circle);
    objects.push(
      this.add
        .text(cx + (isPlaying ? 0 : 1), cy, isPlaying ? "♪" : "▶", textStyle(typeRole.rowTitle, surface.paper.hex))
        .setFontSize(isPlaying ? 15 : 12)
        .setOrigin(0.5),
    );
    const textX = row.x + 14 + disc;
    const textWidth = row.x + row.width - 10 - textX;
    const title = this.add.text(textX, row.y + 6, song.title, textStyle(typeRole.rowTitle, fg)).setFontSize(13);
    fitText(title, textWidth, 13);
    const detail = this.add
      .text(
        textX,
        row.y + row.height - 18,
        isPlaying ? `Now playing · ${song.where}` : song.where,
        textStyle(typeRole.body, fg, ink.secondary),
      )
      .setFontSize(10);
    fitText(detail, textWidth, 10);
    objects.push(title, detail);
    return { objects };
  }
}
