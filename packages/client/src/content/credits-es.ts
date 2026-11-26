/**
 * The Art & Credits entries in Spanish (`content/credits.ts` is the English source), by entry id: where each piece
 * shows, who made it and its notice. Names, handles, quoted titles, product and box names, URLs, file names and licence
 * identifiers stay as written; the descriptive and legal wording is translated. `credits.test.ts` checks every entry
 * has its Spanish.
 */
export interface CreditTextEs {
  readonly shownIn: string;
  readonly credit: string;
  readonly notice: string;
}

export const CREDITS_ES: Readonly<Record<string, CreditTextEs>> = {
  game: {
    shownIn: "Todo el juego",
    credit:
      "Creado por Quin Carter, con código de Francisco Merchan Cordero. Código abierto bajo la GNU AGPL-3.0 (solo el código).",
    notice: "La AGPL cubre el código de este proyecto, no el material de Marvel ni de Fantasy Flight Games.",
  },
  watchers: {
    shownIn: "Solo agradecimientos",
    credit:
      "PermaKarma, Zack Burnley, dwballance y Joelstrd, y todas las personas que han informado de un error o han pedido una función.",
    notice: "Gracias.",
  },
  "controller-pictures": {
    shownIn: "Opciones ▸ Controles",
    credit:
      'Switch: "nintendo switch" de Sweet Farm, The Noun Project (CC BY 3.0). PlayStation: "Gaming Console Vector, Video Game Controller" de Uttam Das, Vecteezy (licencia gratuita, se exige atribución; solo uso editorial). Xbox: "Xbox One controller" de Akshay Kumar, ArtStation.',
    notice:
      "Los mandos son diseños y marcas comerciales de Microsoft, Sony y Nintendo; no se reclama ninguna propiedad.",
  },
  "controller-button-icons": {
    shownIn: "Indicaciones de los botones del mando",
    credit:
      'Xbox: "Xbox Controller Icons Free" de Alric Monteiro. PlayStation: "PlayStation Controller Icons" de Antoine Plu. Switch: "Switch Button Icons [Essential pack]" de Gioele Casazza. Todos de Figma Community, CC BY 4.0, con los colores adaptados al juego.',
    notice:
      "Los mandos son diseños y marcas comerciales de Microsoft, Sony y Nintendo; no se reclama ninguna propiedad, y los autores de los iconos no están afiliados a ellas.",
  },
  "original-game": {
    shownIn: "Cada regla, carta y escenario",
    credit:
      "Diseñado por Michael Boggs, Nate French y Caleb Grace. Publicado por Fantasy Flight Games (Asmodee) bajo licencia de Marvel. La Referencia de reglas, las preguntas frecuentes (FAQ) y las erratas son suyas.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "card-data": {
    shownIn: "Listas de mazos, importación de mazos y textos de aclaraciones de reglas",
    credit:
      "MarvelCDB (marvelcdb.com) para los datos de las cartas y la importación de mazos; Hall of Heroes (hallofheroeslcg.com) para las transcripciones de aclaraciones de reglas, las listas de palabras clave y las referencias de cartas. Son sitios de la comunidad, nunca la autoridad sobre las reglas.",
    notice: "El texto de las cartas es (c) Fantasy Flight Games y Marvel.",
  },
  "card-scans": {
    shownIn: "Cada cara de carta, la vista previa al pasar el cursor y la vista de Examinar",
    credit:
      "Imágenes de cartas de Hall of Heroes y MarvelCDB, descargadas por los scripts de contenido del proyecto, y escaneos propios del propietario del proyecto. Las cartas promocionales de Extras son escaneos de las cartas promocionales oficiales de FFG; esos escaneos y los de Shadowland los compartió u/Ok-Replacement-9793 en Reddit. El ilustrador de cada carta figura impreso en la propia carta; los artistas son ilustradores contratados por Fantasy Flight Games y Marvel.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "card-scans-balanced": {
    shownIn: "Las cartas de The Galaxy's Most Wanted que cambia una partida Equilibrada, en inglés y en español",
    credit:
      "Los escaneos editados de Collector, Grand Collection, Nebula's Ship, Interception Imminent, Take What Is Mine y Milano para la regla de la casa Equilibrada, hechos por bluefireF5ran (github.com/bluefireF5ran) a partir de las correcciones de Gideon's Gaming.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "card-scans-elektra-iron-fist": {
    shownIn: "Todas las cartas de los packs de héroe de Elektra e Iron Fist, en inglés y en español",
    credit:
      "Los escaneos en inglés y en español de los packs de héroe de Elektra e Iron Fist, aportados por bluefireF5ran (github.com/bluefireF5ran).",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "card-scans-es": {
    shownIn: "Cada cara de carta en la versión en español, siempre que exista un escaneo en español",
    credit:
      "Imágenes de cartas en español del proyecto mc-ocr de alaintxu (github.com/alaintxu/mc-ocr), descargadas por los scripts de contenido del proyecto. Las cartas sin escaneo en español muestran el escaneo en inglés.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "rulebook-trors": {
    shownIn: "Introducciones de escenarios e historias de campaña (donde las páginas de esa caja están integradas)",
    credit:
      "Las páginas de cómic impresas en el reglamento de campaña de The Rise of Red Skull (mc10_the_rise_of_red_skull_rules_web.pdf), renderizadas a partir del PDF oficial. Fantasy Flight Games / Marvel. Los artistas de las páginas aparecen acreditados en el propio reglamento.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "rulebook-gmw": {
    shownIn: "Introducciones de escenarios e historias de campaña (donde las páginas de esa caja están integradas)",
    credit:
      "Las páginas de cómic impresas en el reglamento de campaña de The Galaxy's Most Wanted (mc16_galaxys_most_wanted_rules_website-compressed.pdf), renderizadas a partir del PDF oficial. Fantasy Flight Games / Marvel. Los artistas de las páginas aparecen acreditados en el propio reglamento.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "rulebook-mts": {
    shownIn: "Introducciones de escenarios e historias de campaña (donde las páginas de esa caja están integradas)",
    credit:
      "Las páginas de cómic impresas en el reglamento de campaña de The Mad Titan's Shadow (mc21_the_mad_titans_shadow_rulebook-compressed.pdf), renderizadas a partir del PDF oficial. Fantasy Flight Games / Marvel. Los artistas de las páginas aparecen acreditados en el propio reglamento.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "rulebook-sm": {
    shownIn: "Introducciones de escenarios e historias de campaña (donde las páginas de esa caja están integradas)",
    credit:
      "Las páginas de cómic impresas en el reglamento de campaña de Sinister Motives (mc27_sinister_motives_rules_v5-compressed.pdf), renderizadas a partir del PDF oficial. Fantasy Flight Games / Marvel. Los artistas de las páginas aparecen acreditados en el propio reglamento.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "rulebook-mut_gen": {
    shownIn: "Introducciones de escenarios e historias de campaña (donde las páginas de esa caja están integradas)",
    credit:
      "Las páginas de cómic impresas en el reglamento de campaña de Mutant Genesis (mc32_mutant_genesis_rulebook_v5-compressed.pdf), renderizadas a partir del PDF oficial. Fantasy Flight Games / Marvel. Los artistas de las páginas aparecen acreditados en el propio reglamento.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "rulebook-next_evol": {
    shownIn: "Introducciones de escenarios e historias de campaña (donde las páginas de esa caja están integradas)",
    credit:
      "Las páginas de cómic impresas en el reglamento de campaña de NeXt Evolution (mc40_next_evolution_rulebook-web.pdf), renderizadas a partir del PDF oficial. Fantasy Flight Games / Marvel. Los artistas de las páginas aparecen acreditados en el propio reglamento.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "rulebook-aoa": {
    shownIn: "Introducciones de escenarios e historias de campaña (donde las páginas de esa caja están integradas)",
    credit:
      "Las páginas de cómic impresas en el reglamento de campaña de Age of Apocalypse (mc45_age_of_apocalypse_rulebook.pdf), renderizadas a partir del PDF oficial. Fantasy Flight Games / Marvel. Los artistas de las páginas aparecen acreditados en el propio reglamento.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "rulebook-aos": {
    shownIn: "Introducciones de escenarios e historias de campaña (donde las páginas de esa caja están integradas)",
    credit:
      "Las páginas de cómic impresas en el reglamento de campaña de Agents of S.H.I.E.L.D. (mc50_rulebook-web.pdf), renderizadas a partir del PDF oficial. Fantasy Flight Games / Marvel. Los artistas de las páginas aparecen acreditados en el propio reglamento.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "rulebook-fne": {
    shownIn: "Introducciones de escenarios e historias de campaña (donde las páginas de esa caja están integradas)",
    credit:
      "Las páginas de cómic impresas en el reglamento de campaña de Fear No Evil (mc60_rulebook-web.pdf), renderizadas a partir del PDF oficial. Fantasy Flight Games / Marvel. Los artistas de las páginas aparecen acreditados en el propio reglamento.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "hero-art": {
    shownIn: "Toma asiento (selección de héroe) e ilustraciones de Extras",
    credit:
      'Una imagen por cada identidad de héroe. Todavía no constan el artista ni la fuente original. La imagen de Elektra está firmada "END \'15", con color de Skipper, y la de Iron Fist está firmada por Fritz Casas; ambos nombres se han leído de las firmas y no están confirmados.',
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "villain-art": {
    shownIn:
      "Selección de escenario, Fin de la partida, introducciones de escenarios sueltos e ilustraciones de Extras",
    credit:
      "Imágenes de villano, de victoria y de derrota de cada escenario, y las ilustraciones de introducción. Todavía no constan el artista ni la fuente original.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "teamup-art": {
    shownIn: "El tablero, la primera vez que se activa un Team-Up",
    credit:
      "Una imagen de presentación y una insignia por cada pareja de Team-Up. Todavía no constan el artista ni la fuente original. La imagen de Iron Fist y Luke Cage no lleva firma; se desconoce su artista.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "pack-art": {
    shownIn: "Encabezados de la estantería de packs (cuando hay una portada)",
    credit: "Portadas de packs e imágenes promocionales. Todavía no constan el artista ni la fuente original.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "title-art": {
    shownIn: "La pantalla de Título (una al azar) e ilustraciones de Extras",
    credit:
      "Arte de caja, arte promocional y fondos de pantalla, entre ellos la caja del Core Set, la contraportada de Back to Basics, los X-Men de Mutant Genesis, Rise of Apocalypse y el equipo de Spider-Verse. Hercules es de Bruno Frenda (ArtStation); todavía no constan los artistas ni las fuentes de los demás.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "extras-art": {
    shownIn: "Extras, pestaña Ilustraciones (Psylocke y Angel, y las imágenes que se desbloquean jugando)",
    credit: "Imágenes siempre disponibles, como Psylocke y Angel. Todavía no constan el artista ni la fuente original.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "vazquez-gmw": {
    shownIn: "Lector de cómics de la campaña",
    credit:
      "Seis guiones gráficos de cómic de Guardians of the Galaxy hechos por un fan, obra de Joey Vazquez, dibujados para esta campaña.",
    notice: "Personajes (c) Marvel. Páginas (c) Joey Vazquez.",
  },
  "vazquez-mts": {
    shownIn: "Lector de cómics de la campaña",
    credit:
      "Seis guiones gráficos de cómic de Marvel Champions hechos por un fan, obra de Joey Vazquez, dibujados para esta campaña.",
    notice: "Personajes (c) Marvel. Páginas (c) Joey Vazquez.",
  },
  "vazquez-sm": {
    shownIn: "Lector de cómics de la campaña",
    credit:
      "Ocho guiones gráficos de cómic de Marvel Champions hechos por un fan, obra de Joey Vazquez, dibujados para esta campaña.",
    notice: "Personajes (c) Marvel. Páginas (c) Joey Vazquez.",
  },
  "campaign-covers": {
    shownIn: "Losetas de saga, portadas de campaña, paneles de historia y las páginas de MojoMania",
    credit:
      "Ilustraciones de portada y de imagen única de la historia para las cajas de campaña, incluidas las páginas de la emisión de MojoMania y de los X-Babies. Todavía no constan el artista ni la fuente original.",
    notice: "Marvel Champions pertenece a Fantasy Flight Games. Ilustraciones y personajes (c) Marvel.",
  },
  "fne-art-heist": {
    shownIn: "Cada apertura de número de Fear No Evil, construida a partir del escenario y su villano",
    credit:
      "El pack modular de cómics del propietario del proyecto (2026-10-20): adaptaciones editadas con IA de viñetas de cómic, además de fondos de escenario, inserciones de villanos y las páginas de Final Showdown generados con IA, hechos con una herramienta de imágenes por IA; no son viñetas exactas de los cómics. Art Museum Heist y The Getaway: a partir de viñetas de Black Cat (2019) #1 (Marvel Comics), guion de Jed MacKay, dibujo de Travel Foreman, Mike Dowling y Nao Fuji, portada de J. Scott Campbell. Protection Racket: en su mayoría a partir de viñetas de Daredevil (2019) #17 (Marvel Comics), guion de Chip Zdarsky, dibujo de Jorge Fornés, portada de Julian Totino Tedesco. The Raft Breakout: a partir de New Avengers (2004) #1-3 (Marvel Comics), guion de Brian Michael Bendis, lápices de David Finch, tintas de Danny Miki, Mark Morales, Allen Martinez y Victor Olazaba, color de Frank D'Armata. Stop the Presses!: a partir de Devil's Reign (2021-2022) (Marvel Comics), guion de Chip Zdarsky, dibujo y portadas de Marco Checchetto.",
    notice: "(c) Marvel. Se usa en este proyecto de fans; no se reclama ninguna propiedad.",
  },
  "fne-villain-outcomes": {
    shownIn:
      "Fin de la partida tras una partida de Fear No Evil, según el villano al que te hayas enfrentado; el traslado de Kingpin en Extras",
    credit:
      "Ocho imágenes de desenlace sin texto (Hammerhead, Bullseye, Purple Man, Typhoid Mary, Kingpin) aportadas por el propietario del proyecto y generadas con una herramienta de imágenes por IA. Desenlaces imaginados, no viñetas de cómic.",
    notice: "(c) Marvel. Se usa en este proyecto de fans; no se reclama ninguna propiedad.",
  },
  "shadowland-comic": {
    shownIn: "Historia de la campaña Shadowland (las secuelas se leen entre números) e ilustraciones de Extras",
    credit:
      "Seis páginas rotuladas de Shadowland (2010) #1-5 de Marvel, con el Daredevil poseído y la Mano (el propietario del proyecto, 2026-10-20), algunas del #5. Guion de Andy Diggle; lápices de Billy Tan. No consta de qué número procede cada página.",
    notice: "(c) Marvel. Se usa en este proyecto de fans; no se reclama ninguna propiedad.",
  },
  "shadowland-panels": {
    shownIn: "Portada de la campaña Shadowland, aperturas de número y loseta de escenario; ilustraciones de Extras",
    credit:
      "Cinco imágenes de viñetas del arte promocional de Marvel Champions: Shadowland (MC65), tomadas del pie de la página de Shadowland de Hall of Heroes (el propietario del proyecto, 2026-10-20). Todavía no consta el artista.",
    notice: "(c) Marvel. Se usa en este proyecto de fans; no se reclama ninguna propiedad.",
  },
  "avengers-11": {
    shownIn: "Extras ▸ Historias paralelas, desbloqueadas con el logro Worthy of a Second Date?",
    credit:
      "Marvel Comics, publicado el 12 de diciembre de 2018 (con fecha de portada de enero de 2019). Guion de Jason Aaron; lápices de Cory Smith, Ed McGuinness y Karl Kesel; portada de Ed McGuinness. Páginas 6, 11, 16 y 17. Los entintadores, el colorista y el rotulista no figuran en la entrada de la biblioteca del propietario del proyecto, así que todavía no constan.",
    notice: "(c) Marvel. Se usa en este proyecto de fans; no se reclama ninguna propiedad.",
  },
  soundtrack: {
    shownIn: "Temas del Título, de la partida, de los escenarios y de las campañas, y la gramola de Extras",
    credit:
      "Música instrumental original generada con Google Gemini a partir de indicaciones escritas para este proyecto (el propietario del proyecto, 2026-10-20): sin voces y sin basarse en ningún tema existente.",
    notice:
      "Música generada con IA mediante Google Gemini, sujeta a las condiciones de Google para el contenido generado; no se acredita a ningún compositor humano. Este proyecto no te concede ninguna licencia sobre ella.",
  },
  sfx: {
    shownIn: "Cartas jugadas, ataques, intervenciones, reposición de la mano, Extras y logros desbloqueados",
    credit:
      'Sonidos breves libres de derechos reunidos de varias bibliotecas de sonidos gratuitas en línea (el propietario del proyecto, 2026-10-20). El sonido de "Logro desbloqueado" es "Level Complete" de Universfield (Pixabay).',
    notice: "Sonidos libres de derechos, usados bajo la licencia propia de cada biblioteca.",
  },
  phaser: {
    shownIn: "Todas las pantallas",
    credit: "Phaser de Phaser Studio (MIT). phaser4-rex-plugins (rexUI) de Rex Rainbow (MIT).",
    notice: "Con licencia MIT.",
  },
  shells: {
    shownIn: "Las versiones de escritorio, móvil y web",
    credit: "Tauri (MIT o Apache-2.0), Capacitor de Ionic (MIT), Vite (MIT).",
    notice: "Código abierto bajo sus propias licencias.",
  },
  fonts: {
    shownIn: "Títulos, cuerpo de texto y números",
    credit:
      "Bangers de Vernon Adams, IBM Plex Mono de IBM y Public Sans del U.S. Web Design System, todas a través de Fontsource.",
    notice: "SIL Open Font License 1.1.",
  },
  "champions-icons": {
    shownIn: "Etiquetas de las cartas adjuntas en el tablero (coste para retirarlas)",
    credit:
      "Fuente de iconos Champions (dos versiones, ChampionsIcons y ChampionsIcons2), compartida por BluefireF5ran (comunidad); todavía no constan su origen ni su licencia.",
    notice: "No constan el origen ni la licencia.",
  },
};
