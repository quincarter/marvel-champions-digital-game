/**
 * The channel between the live-room worker and the Discord presence worker (issue #876): the live-room worker posts its
 * status (watch link, watcher count) down it, and the presence worker words "Watch live" and "N watching" from that.
 * Main only creates the channel and hands one end to each worker. The two workers start independently (presence once
 * Discord answers, live once the setting is on), so whichever asks first makes the channel and the other end waits here
 * until the second asks. Messages sent before the far end listens queue on the port. Desktop app only: nowhere else has
 * a presence worker, so nowhere else makes a channel.
 */
import { detectPlatform } from "./platform.js";

let channel: MessageChannel | null = null;
const taken = { live: false, presence: false };

function ensure(): MessageChannel | null {
  if (detectPlatform() !== "tauri") return null;
  channel ??= new MessageChannel();
  return channel;
}

/** The live-room worker's end, once; undefined where there is no Discord presence. */
export function takeLiveEnd(): MessagePort | undefined {
  const made = ensure();
  if (!made || taken.live) return undefined;
  taken.live = true;
  return made.port1;
}

/** The presence worker's end, once; undefined where there is no Discord presence. */
export function takePresenceEnd(): MessagePort | undefined {
  const made = ensure();
  if (!made || taken.presence) return undefined;
  taken.presence = true;
  return made.port2;
}
