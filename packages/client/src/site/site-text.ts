/**
 * Text both site pages share (the download panel, the language toggle, the footer), in every page language. English is
 * the full catalog; every other language must give every key too, since a page is read top to bottom in one language.
 * The Spanish is AI translated, and the pages say so while Spanish is on, as the release pages do.
 *
 * A message may carry `<b>`, `<a>` and `<code>`: the pages set it as HTML, and it only ever comes from these catalogs.
 */
import type { PageLanguage } from "./page-language.js";
import type { DownloadId } from "./downloads.js";

export type Catalog<K extends string> = Readonly<Record<K, string>>;

const sharedEn = {
  "lang.label": "Language",
  "lang.aiNote": "",
  "dl.kick": "Download",
  "dl.title": "Get the app",
  "dl.loading": "Looking up the latest release…",
  "dl.version": "Version {version}, published {date}",
  "dl.offline": 'GitHub didn\'t answer just now. Every installer is on the <a href="{url}">latest release page</a>.',
  "dl.forDevice": "Download for {device}",
  "dl.other": "Other devices",
  "dl.allFiles": "Every file and checksum on GitHub",
  "dl.iosNote":
    "There's no iPhone or iPad app yet. The game plays in Safari, and you can add it to your Home Screen from the Share menu.",
  "dl.otherNote": "We couldn't tell your device. Pick an installer below, or play in your browser.",
  "dl.cardLanguage": "Cards in {language}",
  "dl.steamNote": "Adds the game to your Steam library and keeps it updated.",
  "dl.play": "Play in your browser",
  "device.windows": "Windows",
  "device.mac": "macOS",
  "device.macArm": "Apple silicon Macs",
  "device.macIntel": "Intel Macs",
  "device.linux": "Linux and Steam Deck",
  "device.android": "Android",
  "device.ios": "iPhone and iPad",
  "device.other": "your device",
  "file.windows-setup": "Windows installer (.exe)",
  "file.windows-msi": "Windows, all users (.msi)",
  "file.mac-arm": "macOS, Apple silicon (.dmg)",
  "file.mac-intel": "macOS, Intel (.dmg)",
  "file.linux-appimage": "Linux AppImage",
  "file.linux-deb": "Linux, Debian and Ubuntu (.deb)",
  "file.linux-rpm": "Linux, Fedora and Bazzite (.rpm)",
  "file.android-apk": "Android (.apk)",
  "file.steam-windows": "Install for Steam, Windows",
  "file.steam-mac": "Install for Steam, macOS",
  "file.steam-linux": "Install for Steam, Linux and Steam Deck",
  "foot.fan":
    "Marvel Champions: Digital Edition is a fan-made, non-commercial project. Marvel Champions, its card text, artwork and characters belong to Fantasy Flight Games and Marvel.",
  "foot.source": "Source on GitHub",
  "foot.report": "Report a problem",
} as const;

export type SharedKey = keyof typeof sharedEn;

const sharedEs: Catalog<SharedKey> = {
  "lang.label": "Idioma",
  "lang.aiNote": "Texto traducido con IA. Si ves algo raro, avísanos.",
  "dl.kick": "Descarga",
  "dl.title": "Consigue la app",
  "dl.loading": "Buscando la última versión…",
  "dl.version": "Versión {version}, publicada el {date}",
  "dl.offline":
    'GitHub no respondió ahora mismo. Todos los instaladores están en la <a href="{url}">página de la última versión</a>.',
  "dl.forDevice": "Descargar para {device}",
  "dl.other": "Otros dispositivos",
  "dl.allFiles": "Todos los archivos y sumas de comprobación en GitHub",
  "dl.iosNote":
    "Todavía no hay app para iPhone ni iPad. El juego funciona en Safari, y puedes añadirlo a tu pantalla de inicio desde el menú Compartir.",
  "dl.otherNote": "No pudimos detectar tu dispositivo. Elige un instalador abajo o juega en el navegador.",
  "dl.cardLanguage": "Cartas en {language}",
  "dl.steamNote": "Añade el juego a tu biblioteca de Steam y lo mantiene actualizado.",
  "dl.play": "Jugar en el navegador",
  "device.windows": "Windows",
  "device.mac": "macOS",
  "device.macArm": "Mac con Apple silicon",
  "device.macIntel": "Mac con Intel",
  "device.linux": "Linux y Steam Deck",
  "device.android": "Android",
  "device.ios": "iPhone y iPad",
  "device.other": "tu dispositivo",
  "file.windows-setup": "Instalador de Windows (.exe)",
  "file.windows-msi": "Windows, todos los usuarios (.msi)",
  "file.mac-arm": "macOS, Apple silicon (.dmg)",
  "file.mac-intel": "macOS, Intel (.dmg)",
  "file.linux-appimage": "Linux AppImage",
  "file.linux-deb": "Linux, Debian y Ubuntu (.deb)",
  "file.linux-rpm": "Linux, Fedora y Bazzite (.rpm)",
  "file.android-apk": "Android (.apk)",
  "file.steam-windows": "Instalar para Steam, Windows",
  "file.steam-mac": "Instalar para Steam, macOS",
  "file.steam-linux": "Instalar para Steam, Linux y Steam Deck",
  "foot.fan":
    "Marvel Champions: Digital Edition es un proyecto hecho por fans y sin ánimo de lucro. Marvel Champions, el texto de sus cartas, sus ilustraciones y sus personajes pertenecen a Fantasy Flight Games y Marvel.",
  "foot.source": "Código en GitHub",
  "foot.report": "Informar de un problema",
};

export const SHARED_TEXT: Readonly<Record<PageLanguage, Catalog<SharedKey>>> = { en: sharedEn, es: sharedEs };

export const fileKey = (id: DownloadId): SharedKey => `file.${id}`;

/** `text` with each `{name}` filled from `params`. */
export function fill(text: string, params: Readonly<Record<string, string | number>> = {}): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
}
