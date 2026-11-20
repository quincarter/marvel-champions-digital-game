# Instalar el juego en un iPhone o iPad

[README](../../README.md) · [Descargas](downloads.md) · [In English](ios-install.md)

_Texto traducido con IA. Si ves algo raro, avísanos._

El juego no está en la App Store. Cada versión trae una app para iPhone y iPad que instalas tú mismo, lo que Apple
llama **sideloading** (instalación lateral): una app gratuita la firma con tu propio Apple ID y el iPhone la ejecuta
como cualquier otra app. Es gratis, no necesita jailbreak y la primera vez lleva unos 15 minutos.

Si prefieres no hacerlo, el juego también funciona en Safari: abre la web del juego y añádela a tu pantalla de inicio
desde el menú Compartir.

## Antes de empezar

- **La descarga.** En la [última versión](https://github.com/quincarter/marvel-champions-digital-game/releases/latest),
  la app para iPhone y iPad es `MarvelChampions-<versión>-ES-iOS-unsigned.ipa` (cartas en inglés: `-EN-`). Ocupa
  unos 1,3 GB, así que usa wifi y deja unos 4 GB libres en el dispositivo mientras se instala.
- **Un Apple ID.** El tuyo de siempre sirve. Hay quien crea un segundo Apple ID gratuito solo para esto; cualquiera de
  los dos vale. Tu contraseña solo va a Apple, a través de la herramienta que elijas abajo.
- **iOS 16 o posterior** necesita activar el modo de desarrollador una vez (paso a paso abajo). iOS 15 no lo tiene.

### Qué permite un Apple ID gratuito

Apple limita las apps firmadas con un Apple ID gratuito:

- **Dejan de abrirse a los 7 días** si no las renuevas. Renovarlas es un toque (o se hace sola) y **conserva tus
  partidas**. Si una caduca, renuévala y volverá a abrirse tal como la dejaste. No borres la app: al borrarla se
  borran sus partidas.
- **Tres apps a la vez.** Como mucho puede haber tres apps instaladas así activas en un dispositivo, y SideStore o
  AltStore cuenta como una de las tres.

Una cuenta de desarrollador de pago quita los dos límites; mira [Con una cuenta de desarrollador de pago](#con-una-cuenta-de-desarrollador-de-pago).

## ¿Qué forma elijo?

| Forma                             | Qué necesitas                               | Renovar cada 7 días                                                                        |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [SideStore](#sidestore)           | Un ordenador una vez, para prepararlo       | En el propio iPhone, sin ordenador                                                         |
| [AltStore](#altstore)             | Un PC con Windows o un Mac en la misma wifi | Automático con el ordenador encendido, o un toque con él encendido                         |
| [Sideloadly](#sideloadly)         | Un PC con Windows o un Mac y un cable       | Volver a instalar desde el ordenador (o su renovación automática)                          |
| [Scarlet](#scarlet-sin-ordenador) | Solo el iPhone                              | No hace falta, pero puede dejar de funcionar un tiempo ([por qué](#scarlet-sin-ordenador)) |

**Para la mayoría: SideStore.** Tras prepararlo una vez en un ordenador, todo se hace en el iPhone. Si esa
preparación te da problemas, AltStore o Sideloadly son más sencillos, pero necesitan el ordenador cada semana.

**¿No tienes ordenador?** [Scarlet](#scarlet-sin-ordenador) instala el juego desde Safari en el iPhone, con una pega:
lee su apartado antes de elegirlo.

## Activa el modo de desarrollador (iOS 16 y posterior)

Hazlo justo después de instalar tu primera app de esta forma (SideStore, AltStore o el juego con Sideloadly). La
opción solo aparece cuando ya hay una en el dispositivo.

1. Abre **Ajustes → Privacidad y seguridad**, baja hasta el final y toca **Modo de desarrollador**.
2. Actívalo y toca **Reiniciar**.
3. Tras reiniciar, toca **Activar** cuando te lo pregunte e introduce tu código.

## Confía en las apps de tu Apple ID

La primera vez que abres una app firmada con tu Apple ID, iOS dice «Desarrollador no fiable». Una sola vez:

1. Abre **Ajustes → General → VPN y gestión de dispositivos**.
2. En **App de desarrollador**, toca el correo de tu Apple ID.
3. Toca **Confiar en «<tu correo>»** y luego **Confiar** otra vez.

## SideStore

SideStore instala y renueva apps en el propio iPhone. Prepararlo la primera vez necesita un ordenador; después, no.

### Preparación (una vez)

1. Sigue la guía de instalación de SideStore en [docs.sidestore.io](https://docs.sidestore.io), que te lleva paso a
   paso en Windows, macOS o Linux. Instala SideStore en tu iPhone con tu Apple ID, crea el «archivo de emparejamiento»
   que SideStore necesita y te hace instalar su app de VPN complementaria desde la App Store (SideStore la usa para
   hablar con el iPhone desde el propio iPhone; no envía nada fuera del dispositivo). La guía cambia de vez en cuando,
   así que sigue la suya y no una copia antigua.
2. [Activa el modo de desarrollador](#activa-el-modo-de-desarrollador-ios-16-y-posterior) y
   [confía en las apps de tu Apple ID](#confía-en-las-apps-de-tu-apple-id).
3. Abre SideStore e inicia sesión con el mismo Apple ID.

### Instalar el juego

1. En el iPhone, abre la [última versión](https://github.com/quincarter/marvel-champions-digital-game/releases/latest)
   en Safari y toca el archivo `-iOS-unsigned.ipa`. Safari lo guarda en **Archivos → Descargas**. Espera a que
   termine.
2. Activa la app de VPN de SideStore (si su guía te hace usar una).
3. En SideStore, abre **My Apps**, toca **+** arriba y elige el `.ipa` en Descargas.
4. Espera mientras SideStore lo firma y lo instala; con un archivo de este tamaño tarda unos minutos. El juego
   aparece en tu pantalla de inicio.
5. Después puedes borrar el `.ipa` de Archivos para liberar espacio.

### Cada 7 días

Abre SideStore, activa la app de VPN si la usas y toca **Refresh All** en **My Apps**. SideStore muestra cuántos días
le quedan a cada app. El propio SideStore también caduca: renuévalo antes de que se acabe, o necesitarás un ordenador
para prepararlo de nuevo.

## AltStore

AltStore instala las apps en el iPhone y AltServer, en tu ordenador, las firma. El ordenador las renueva en segundo
plano siempre que los dos estén en la misma wifi.

### Preparación (una vez)

1. En tu ordenador, instala AltServer desde [altstore.io](https://altstore.io) (AltStore Classic):
   - **Windows:** instala antes **iTunes** e **iCloud** desde la web de Apple (apple.com), _no_ las versiones de
     Microsoft Store, que AltServer no puede usar. Luego ejecuta el instalador de AltServer. AltServer vive en la
     bandeja del sistema (la flecha junto al reloj).
   - **Mac:** descarga AltServer, muévelo a Aplicaciones y ábrelo. Vive en la barra de menús. Dale el complemento de
     Mail si lo pide (macOS te guía).
2. Conecta el iPhone al ordenador con un cable, desbloquéalo y toca **Confiar** si lo pregunta. En Windows, abre
   iTunes, selecciona el iPhone y marca **Sincronizar con este iPhone por wifi**, luego **Aplicar**. (En un Mac, la
   misma casilla está en el Finder al seleccionar el iPhone.)
3. Haz clic en el icono de AltServer → **Install AltStore** → tu iPhone, e introduce tu Apple ID.
4. [Activa el modo de desarrollador](#activa-el-modo-de-desarrollador-ios-16-y-posterior) y
   [confía en las apps de tu Apple ID](#confía-en-las-apps-de-tu-apple-id).

### Instalar el juego

1. Descarga el `-iOS-unsigned.ipa` de la
   [última versión](https://github.com/quincarter/marvel-champions-digital-game/releases/latest), en el iPhone con
   Safari (va a Archivos → Descargas) o en el ordenador.
2. **Desde el iPhone:** con AltServer abierto en el ordenador y los dos en la misma wifi, abre AltStore, ve a
   **My Apps**, toca **+** y elige el `.ipa`.
   **Desde el ordenador:** mantén pulsada Mayúsculas (Windows) u Opción (Mac) al hacer clic en el icono de AltServer,
   elige **Sideload .ipa** → tu iPhone, y elige el `.ipa`.
3. Espera unos minutos mientras lo firma y lo instala.

### Cada 7 días

Deja AltServer abierto en el ordenador (se abre al encenderlo si se lo permites). Mientras el iPhone y el ordenador
estén en la misma wifi, AltStore renueva en segundo plano. Para hacerlo a mano, abre AltStore → **My Apps** →
**Refresh All**.

## Sideloadly

Sideloadly es una app de ordenador: conectas el iPhone, sueltas el `.ipa` en ella y lo instala. Es la más sencilla
para empezar, pero la renovación semanal se hace en el ordenador.

### Instalar el juego

1. En tu ordenador, instala Sideloadly desde [sideloadly.io](https://sideloadly.io). En Windows, instala antes
   **iTunes** e **iCloud** desde la web de Apple (apple.com), no las versiones de Microsoft Store.
2. Descarga el `-iOS-unsigned.ipa` de la
   [última versión](https://github.com/quincarter/marvel-champions-digital-game/releases/latest) en el ordenador.
3. Conecta el iPhone con un cable, desbloquéalo y toca **Confiar** si lo pregunta.
4. Abre Sideloadly. Tu iPhone aparece en **iDevice**. Arrastra el `.ipa` a la casilla IPA, escribe tu Apple ID y haz
   clic en **Start**. Introduce la contraseña de tu Apple ID cuando la pida (y el código que envía Apple, si usas
   verificación en dos pasos).
5. Cuando diga **Done**, [activa el modo de desarrollador](#activa-el-modo-de-desarrollador-ios-16-y-posterior) y
   [confía en las apps de tu Apple ID](#confía-en-las-apps-de-tu-apple-id), y abre el juego.

### Cada 7 días

Vuelve a instalarlo con el mismo `.ipa` y el mismo Apple ID: sustituye la app y conserva tus partidas. Sideloadly
también puede hacerlo por ti: activa su opción de renovación automática (en **Advanced options**) antes de hacer clic
en Start, y deja el ayudante de Sideloadly abierto en el ordenador, en la misma wifi que el iPhone.

## Scarlet (sin ordenador)

Scarlet instala apps solo con el iPhone: sin ordenador, sin Apple ID, sin renovar cada 7 días y sin el límite de tres
apps. La pega está en cómo lo hace. Scarlet firma todas las apps con un único certificado que comparten todos sus
usuarios, no con tu propio Apple ID, y Apple revoca los certificados así cuando los detecta. Cuando pasa, **Scarlet y
todas las apps que instaló dejan de abrirse a la vez**, el juego incluido, hasta que Scarlet publica una versión
firmada de nuevo. Puede tardar horas o unos días. Tus partidas siguen en el iPhone mientras esperas.

Scarlet no lo hace este proyecto. Si puedes usar un ordenador una vez, [SideStore](#sidestore) es más estable.

### Instalar Scarlet y el juego

1. En el iPhone, abre [usescarlet.com](https://usescarlet.com), la web propia de Scarlet, en Safari y toca
   **Install**. Otras webs con «Scarlet» en el nombre no son de Scarlet; no instales desde ellas, y desconfía de las
   que te piden compartir un enlace o «verificar que eres humano» antes.
2. Sigue sus pasos: iOS pide permitir un perfil, que luego instalas en **Ajustes → General → VPN y gestión de
   dispositivos**. Confía en el certificado de Scarlet en esa misma pantalla si iOS lo pide, y abre Scarlet.
3. En Safari, abre la [última versión](https://github.com/quincarter/marvel-champions-digital-game/releases/latest)
   y toca el archivo `-iOS-unsigned.ipa`. Safari lo guarda en **Archivos → Descargas**. Espera a que termine.
4. En Scarlet, elige su opción para instalar un IPA desde Archivos y escoge el `.ipa`. (O, en Archivos, mantén
   pulsado el `.ipa`, toca **Compartir** y elige Scarlet.) Los nombres de los botones cambian entre versiones de
   Scarlet.
5. Espera mientras se instala; el juego aparece en la pantalla de inicio. Confía en su certificado si iOS lo pide,
   como en el paso 2.

### Si el juego deja de abrirse

Cuando el juego y las demás apps de Scarlet dejan de abrirse a la vez, Apple ha revocado el certificado de Scarlet.

- **No borres el juego:** borrarlo borra sus partidas.
- Espera a la versión firmada de nuevo de Scarlet, vuelve a instalar Scarlet desde
  [usescarlet.com](https://usescarlet.com) y luego instala otra vez el mismo `.ipa` en Scarlet. Instalarlo encima del
  juego normalmente conserva tus partidas.

## Actualizar a una versión nueva

Cuando sale una versión nueva, la pantalla de título del juego lo avisa y enlaza la página de la versión. Descarga el
nuevo `-iOS-unsigned.ipa` e instálalo igual, **con la misma herramienta y el mismo Apple ID** (en Scarlet, basta
con instalarlo otra vez). Sustituye al anterior y conserva tus partidas. Instalar una versión nueva también reinicia
sus 7 días.

## Con una cuenta de desarrollador de pago

Una suscripción de pago al [Apple Developer Program](https://developer.apple.com/programs/) (99 USD al año) cambia los
límites:

- Las apps firmadas con ella duran **un año** en lugar de 7 días y no hay límite de tres apps. Puedes firmar el `.ipa`
  con tu cuenta en Sideloadly o AltStore exactamente como arriba (usan el Apple ID que les des), o con Xcode.
- La cuenta también podría publicar el juego en **TestFlight**, la app de pruebas de Apple, para que se instale desde
  un enlace sin sideloading. Para eso la cuenta tendría que ser la del propio juego y firmar cada versión; el juego aún
  no tiene una, así que de momento todo el mundo usa sideloading.

## Si algo sale mal

- **«No se puede instalar» o «No se ha podido verificar la integridad»:** el `.ipa` no terminó de descargarse.
  Bórralo y vuelve a descargarlo con wifi.
- **«Desarrollador no fiable»:** [confía en las apps de tu Apple ID](#confía-en-las-apps-de-tu-apple-id).
- **«Se requiere el modo de desarrollador»:** [actívalo](#activa-el-modo-de-desarrollador-ios-16-y-posterior).
- **El juego no abre al cabo de una semana:** ha caducado. Renuévalo (SideStore, AltStore) o vuelve a instalarlo
  (Sideloadly); tus partidas siguen ahí.
- **El juego y Scarlet dejan de abrirse a la vez:** se revocó el certificado de Scarlet; mira
  [Si el juego deja de abrirse](#si-el-juego-deja-de-abrirse).
- **«Número máximo de apps» o «límite de App ID»:** un Apple ID gratuito tiene tres apps activas y puede registrar
  diez apps nuevas por semana. Quita una app instalada así que ya no uses (en SideStore o AltStore, desde
  **My Apps**), o espera unos días.
- **¿Sigues atascado?** Pregunta en el [Discord de la comunidad](https://discord.gg/tCy5tqu46j) o
  [abre una incidencia](https://github.com/quincarter/marvel-champions-digital-game/issues/new/choose).
