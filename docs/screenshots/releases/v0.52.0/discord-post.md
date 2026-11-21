# v0.52.0: Smash the Crash

**The Windows app opens again.** Once Windows updated WebView2 to version 158, v0.51.0 crashed on start with "Can't open this page" (STATUS_BREAKPOINT). v0.52.0 fixes it. Install it over v0.51.0 and your saves stay where they are.

## What's new

- **Windows start crash fixed**, with a safety net: if a background painter ever crashes the app, the next start skips it so you still reach the Title. If the page ever does crash, the app reloads it by itself, then tries a safe mode.
- **Install for Steam** no longer stops on PCs whose registry keeps the game's folder in quotes.
- **Your stats:** a new Overview with your favorite hero's art standing tall on wide screens, and a faded wallpaper behind every tab.
- **Records open their game:** fastest win, longest game, closest win, best turn and most cards drawn have View game.
- **Past games** has a search box (typo and accent friendly) and aspect chips on every hero.
- **Take your seats** has a Random button.
- **Smarter cards:** Multi-Gun, Explosive Arrow, Rocket Launcher and eight more offer only players with an engaged minion. Hunting Down Heroes and Maria Hill's Reassignment ask clearer questions.
- **iPhone and iPad:** tapping a text field no longer zooms the page in.
- **Tucked cards pay:** cards under Falcon's Resource Reserve show in the payment strip and can be spent.

## Links

Full report: https://champions-digital-game.com/releases/v0.52.0/
Downloads: https://champions-digital-game.com/#download

Thank you @bluefireF5ran for the play notes and reports behind most of this release (#911, #922), and Dreadheart for reporting the Windows crash and the Steam installer, with the crash files that found it, and GarethMagis for the iPhone zoom report.

---

# v0.52.0: Aplasta el fallo

**La app de Windows vuelve a abrir.** Cuando Windows actualizó WebView2 a la versión 158, v0.51.0 fallaba al iniciar con "Can't open this page" (STATUS_BREAKPOINT). v0.52.0 lo corrige. Instálala encima de v0.51.0 y tus partidas guardadas se quedan donde están.

## Novedades

- **Corregido el fallo al iniciar en Windows**, con una red de seguridad: si un proceso de pintado en segundo plano llega a tumbar la app, el siguiente inicio se lo salta para que llegues igual al Title. Si la página llega a fallar, la app la recarga sola y luego prueba un modo seguro.
- **Install for Steam** ya no se detiene en las PC cuyo registro guarda la carpeta del juego entre comillas.
- **Your stats:** un nuevo Overview con el arte de tu héroe favorito de cuerpo entero en pantallas anchas, y un tapiz difuminado detrás de cada pestaña.
- **Los récords abren su partida:** victoria más rápida, partida más larga, victoria más ajustada, mejor turno y más cartas robadas tienen View game.
- **Past games** tiene un cuadro de búsqueda (tolerante a errores y acentos) y etiquetas de aspecto en cada héroe.
- **Take your seats** tiene un botón Random.
- **Cartas que eligen mejor:** Multi-Gun, Explosive Arrow, Rocket Launcher y ocho más solo ofrecen a jugadores con un esbirro enfrentado. Hunting Down Heroes y Reassignment de Maria Hill hacen preguntas más claras.
- **iPhone y iPad:** tocar un campo de texto ya no acerca la página.
- **Las cartas guardadas debajo pagan:** las cartas debajo de Resource Reserve de Falcon aparecen en la tira de pago y se pueden gastar.

## Enlaces

Informe completo: https://champions-digital-game.com/releases/v0.52.0/index.es.html
Descargas: https://champions-digital-game.com/#download

Gracias a @bluefireF5ran por las notas de juego y los reportes detrás de casi toda esta versión (#911, #922), y a Dreadheart por reportar el fallo de Windows y el instalador de Steam, con los archivos del fallo que permitieron encontrarlo, y a GarethMagis por el reporte del zoom en iPhone.
