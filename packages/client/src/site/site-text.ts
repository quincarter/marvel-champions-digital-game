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
  "dl.steam": "Steam script",
  "dl.steamTitle": "Play it from Steam",
  "dl.steamWhat":
    "The Steam script installs the game, adds it to your Steam library with its art, and keeps it updated. Steam has to be closed while it runs; the script offers to close it.",
  "steam.how.windows":
    "Double-click the <code>.cmd</code> file. Windows may stop it first because it came from the internet: choose <b>More info</b>, then <b>Run anyway</b>. Nothing else needs changing, not even PowerShell's settings.",
  "steam.how.mac":
    "A script you download isn't allowed to run until you give it execute permission. In Terminal, run:<code class='cmd'>chmod +x ~/Downloads/{file}</code><code class='cmd'>~/Downloads/{file}</code>Or run it without that step:<code class='cmd'>bash ~/Downloads/{file}</code>",
  "steam.how.linux":
    "On a Steam Deck, switch to Desktop Mode first. A script you download isn't allowed to run until you give it execute permission. In a terminal (Konsole on the Steam Deck), run:<code class='cmd'>chmod +x ~/Downloads/{file}</code><code class='cmd'>~/Downloads/{file}</code>Or run it without that step:<code class='cmd'>bash ~/Downloads/{file}</code>",
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
  "file.ios-ipa": "iPhone and iPad (.ipa)",
  "ios.how": "Install it with SideStore: see the steps",
  "ios.title": "Install on iPhone or iPad",
  "ios.intro":
    "The game isn't on the App Store. You install the app yourself with a free tool and your own Apple ID, no jailbreak: about 15 minutes the first time. The download is about 1.3 GB, so use Wi-Fi.",
  "ios.download": "Download the app (.ipa)",
  "ios.guide": "Full guide, with AltStore, Sideloadly and Scarlet",
  "ios.step1":
    "Set up <b>SideStore</b> once, with a computer: follow <a href='{sidestore}' rel='noopener'>SideStore's install guide</a>. It puts SideStore on your iPhone with your Apple ID.",
  "ios.step2": "On iOS 16 or later, turn on <b>Settings → Privacy &amp; Security → Developer Mode</b> and restart.",
  "ios.step3":
    "Trust your Apple ID's apps: <b>Settings → General → VPN &amp; Device Management</b>, tap your email, then <b>Trust</b>.",
  "ios.step4": "On the iPhone, tap the download button above. Safari saves the <code>.ipa</code> to Files → Downloads.",
  "ios.step5":
    "In SideStore, open <b>My Apps</b>, tap <b>+</b> and pick the <code>.ipa</code>. A few minutes later the game is on your Home Screen.",
  "ios.limits":
    "<b>Every 7 days</b>, open SideStore and tap <b>Refresh All</b>: apps signed with a free Apple ID stop opening after a week, and refreshing keeps your saves. A free Apple ID runs three sideloaded apps at a time, SideStore included.",
  "ios.update":
    "A new version? Install its <code>.ipa</code> the same way, with the same Apple ID: your saves carry over.",
  "ios.noComputer":
    "<b>No computer?</b> <a href='{scarlet}' rel='noopener'>Scarlet</a> installs the <code>.ipa</code> from Safari alone, with no 7-day refresh. The catch: it signs apps with one certificate all its users share, and when Apple revokes it, the game stops opening until Scarlet puts out a new one (your saves stay). <a href='{guide}' rel='noopener'>Scarlet's steps</a>",
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
  "dl.steam": "Script de Steam",
  "dl.steamTitle": "Juega desde Steam",
  "dl.steamWhat":
    "El script de Steam instala el juego, lo añade a tu biblioteca de Steam con sus ilustraciones y lo mantiene actualizado. Steam tiene que estar cerrado mientras se ejecuta; el script se ofrece a cerrarlo.",
  "steam.how.windows":
    "Haz doble clic en el archivo <code>.cmd</code>. Puede que Windows lo detenga antes porque viene de internet: elige <b>Más información</b> y luego <b>Ejecutar de todas formas</b>. No hace falta cambiar nada más, ni siquiera la configuración de PowerShell.",
  "steam.how.mac":
    "Un script descargado no puede ejecutarse hasta que le das permiso de ejecución. En Terminal, ejecuta:<code class='cmd'>chmod +x ~/Downloads/{file}</code><code class='cmd'>~/Downloads/{file}</code>O ejecútalo sin ese paso:<code class='cmd'>bash ~/Downloads/{file}</code>",
  "steam.how.linux":
    "En una Steam Deck, cambia antes al modo escritorio. Un script descargado no puede ejecutarse hasta que le das permiso de ejecución. En una terminal (Konsole en la Steam Deck), ejecuta:<code class='cmd'>chmod +x ~/Downloads/{file}</code><code class='cmd'>~/Downloads/{file}</code>O ejecútalo sin ese paso:<code class='cmd'>bash ~/Downloads/{file}</code>",
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
  "file.ios-ipa": "iPhone y iPad (.ipa)",
  "ios.how": "Instálalo con SideStore: mira los pasos",
  "ios.title": "Instalar en iPhone o iPad",
  "ios.intro":
    "El juego no está en la App Store. Instalas la app tú mismo con una herramienta gratuita y tu propio Apple ID, sin jailbreak: unos 15 minutos la primera vez. La descarga ocupa unos 1,3 GB, así que usa wifi.",
  "ios.download": "Descargar la app (.ipa)",
  "ios.guide": "Guía completa, con AltStore, Sideloadly y Scarlet",
  "ios.step1":
    'Prepara <b>SideStore</b> una vez, con un ordenador: sigue <a href="{sidestore}" rel="noopener">la guía de instalación de SideStore</a>. Pone SideStore en tu iPhone con tu Apple ID.',
  "ios.step2":
    "En iOS 16 o posterior, activa <b>Ajustes → Privacidad y seguridad → Modo de desarrollador</b> y reinicia.",
  "ios.step3":
    "Confía en las apps de tu Apple ID: <b>Ajustes → General → VPN y gestión de dispositivos</b>, toca tu correo y luego <b>Confiar</b>.",
  "ios.step4":
    "En el iPhone, toca el botón de descarga de arriba. Safari guarda el <code>.ipa</code> en Archivos → Descargas.",
  "ios.step5":
    "En SideStore, abre <b>My Apps</b>, toca <b>+</b> y elige el <code>.ipa</code>. Unos minutos después el juego está en tu pantalla de inicio.",
  "ios.limits":
    "<b>Cada 7 días</b>, abre SideStore y toca <b>Refresh All</b>: las apps firmadas con un Apple ID gratuito dejan de abrirse a la semana, y renovarlas conserva tus partidas. Un Apple ID gratuito tiene tres apps instaladas así a la vez, SideStore incluida.",
  "ios.update": "¿Versión nueva? Instala su <code>.ipa</code> igual, con el mismo Apple ID: tus partidas se conservan.",
  "ios.noComputer":
    '<b>¿Sin ordenador?</b> <a href="{scarlet}" rel="noopener">Scarlet</a> instala el <code>.ipa</code> solo con Safari, sin renovar cada 7 días. La pega: firma las apps con un único certificado que comparten todos sus usuarios, y cuando Apple lo revoca, el juego deja de abrirse hasta que Scarlet saca uno nuevo (tus partidas se conservan). <a href="{guide}" rel="noopener">Los pasos de Scarlet</a>',
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
