/**
 * The download stats page's text (`site/landing/stats/index.html`), in every page language. File formats (apk, dmg,
 * AppImage) and platform names stay as they are in every language.
 */
import type { PageLanguage } from "../page-language.js";
import type { Catalog } from "../site-text.js";

const en = {
  "meta.title": "Download stats · Marvel Champions: Digital Edition",
  "bar.brand": "Digital Edition",
  "bar.play": "Play now",
  "bar.download": "Download",
  "head.kick": "Download stats",
  "head.title": "{total} downloads <span class='g'>and counting</span>",
  "head.range": "{since} → {latest} · {count} releases · {from} – {to}",
  "head.counted": "Counted {date}, and counted again twice a day.",
  "how.title": "How we count",
  "how.text":
    "Every number is GitHub's own download count for a release's installers. A download is a file fetched, not a person: one player who updates five times counts five times, and checksums are left out. Playing in the browser isn't counted here at all.",
  "lead.text":
    "Since {since} the game has been downloaded <b>{total} times</b> across four platforms, about {perDay} a day.",
  "tile.total": "Installers downloaded",
  "tile.total.note": "From {since} to {latest}, every platform and language.",
  "tile.android.note": "APKs.",
  "tile.windows.note": "Setup.exe and MSI installers.",
  "tile.mac.note": "Apple silicon and Intel.",
  "tile.linux.note": "AppImage, deb and rpm.",
  "tile.steam": "Steam scripts",
  "tile.steam.note": "Install for Steam runs since {since}.",
  "tile.average": "Per release",
  "tile.average.note": "Downloads on average, over {count} releases.",
  "share.title": "Where you play",
  "share.sub": "Share of {total} installer downloads",
  "releases.title": "Every release",
  "releases.sub": "Installer downloads per release, newest first",
  "releases.note":
    "A release keeps collecting downloads until the next one ships, so one that stayed the latest over a weekend counts more than one replaced the same afternoon.",
  "table.show": "Show the full table",
  "table.release": "Release",
  "table.date": "Date",
  "table.steam": "Steam script",
  "table.installers": "Installers",
  "table.total": "Total",
  "top.title": "The five biggest releases",
  "top.sub": "By installer downloads",
  "top.read": "Read about it",
  "more.title": "Two more ways in",
  "lang.kick": "Card language",
  "lang.text": "Since {since} every release ships an installer per card language. <b>{share}%</b> pick {language}.",
  "lang.split": "{count} in {language}",
  "steam.kick": "Steam Deck and Steam",
  "steam.title": "Install for Steam",
  "steam.text":
    "Runs of the script that adds the game to Steam since {since}: {linux} on Linux and Steam Deck, {windows} on Windows, {mac} on macOS.",
  "offline.title": "No numbers just now",
  "offline.text":
    "GitHub's download counts couldn't be read when this page was built. Every release and its downloads are on <a href=\"{url}\">GitHub</a>.",
  "cta.text": "Want to add one more?",
  "cta.download": "Get the game",
  "foot.counted": "Counted from GitHub on {date}. The page is updated twice a day when the numbers move.",
} as const;

export type StatsKey = keyof typeof en;

const es: Catalog<StatsKey> = {
  "meta.title": "Datos de descargas · Marvel Champions: Digital Edition",
  "bar.brand": "Digital Edition",
  "bar.play": "Jugar",
  "bar.download": "Descargar",
  "head.kick": "Datos de descargas",
  "head.title": "{total} descargas <span class='g'>y sumando</span>",
  "head.range": "{since} → {latest} · {count} versiones · {from} – {to}",
  "head.counted": "Contadas el {date}, y se vuelven a contar dos veces al día.",
  "how.title": "Cómo contamos",
  "how.text":
    "Cada número es el recuento de descargas de GitHub para los instaladores de una versión. Una descarga es un archivo descargado, no una persona: quien actualiza cinco veces cuenta cinco veces, y las sumas de comprobación no cuentan. Jugar en el navegador no se cuenta aquí.",
  "lead.text":
    "Desde {since} el juego se ha descargado <b>{total} veces</b> en cuatro plataformas, unas {perDay} al día.",
  "tile.total": "Instaladores descargados",
  "tile.total.note": "De {since} a {latest}, en todas las plataformas e idiomas.",
  "tile.android.note": "APK.",
  "tile.windows.note": "Instaladores Setup.exe y MSI.",
  "tile.mac.note": "Apple silicon e Intel.",
  "tile.linux.note": "AppImage, deb y rpm.",
  "tile.steam": "Scripts de Steam",
  "tile.steam.note": "Usos de Instalar para Steam desde {since}.",
  "tile.average": "Por versión",
  "tile.average.note": "Descargas de media, en {count} versiones.",
  "share.title": "Dónde juegas",
  "share.sub": "Reparto de {total} descargas de instaladores",
  "releases.title": "Cada versión",
  "releases.sub": "Descargas de instaladores por versión, de la más nueva a la más antigua",
  "releases.note":
    "Una versión sigue sumando descargas hasta que sale la siguiente, así que una que fue la última durante un fin de semana suma más que otra que se sustituyó la misma tarde.",
  "table.show": "Ver la tabla completa",
  "table.release": "Versión",
  "table.date": "Fecha",
  "table.steam": "Script de Steam",
  "table.installers": "Instaladores",
  "table.total": "Total",
  "top.title": "Las cinco versiones más descargadas",
  "top.sub": "Por descargas de instaladores",
  "top.read": "Leer más",
  "more.title": "Dos formas más de entrar",
  "lang.kick": "Idioma de las cartas",
  "lang.text":
    "Desde {since} cada versión trae un instalador por idioma de las cartas. <b>El {share}%</b> elige {language}.",
  "lang.split": "{count} en {language}",
  "steam.kick": "Steam Deck y Steam",
  "steam.title": "Instalar para Steam",
  "steam.text":
    "Usos del script que añade el juego a Steam desde {since}: {linux} en Linux y Steam Deck, {windows} en Windows y {mac} en macOS.",
  "offline.title": "Sin datos por ahora",
  "offline.text":
    'No se pudieron leer las descargas de GitHub al construir esta página. Todas las versiones y sus descargas están en <a href="{url}">GitHub</a>.',
  "cta.text": "¿Sumamos una más?",
  "cta.download": "Consigue el juego",
  "foot.counted": "Contadas en GitHub el {date}. La página se actualiza dos veces al día si cambian los números.",
};

export const STATS_TEXT: Readonly<Record<PageLanguage, Catalog<StatsKey>>> = { en, es };
