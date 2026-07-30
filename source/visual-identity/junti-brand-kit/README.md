# Junti · Brand kit v2

Identidad construida sobre **La chapa**: el nombre es el logo, dentro de una
chapa naranja de esquinas suaves girada -4 grados, con un punto final que
significa "ya esta". Modo claro por defecto; el modo oscuro usa la misma chapa.

## Contenido

### svg/ — vector puro, sin dependencia de fuentes
Los glifos estan convertidos a contornos, asi que estos archivos se ven
identicos en cualquier navegador, en Figma, en Illustrator y en imprenta.
No hay que instalar ninguna fuente ni convertir texto a curvas.

    junti-chapa-principal.svg      Logo principal: chapa naranja, letra tinta, punto crema
    junti-chapa-inversa.svg        Chapa tinta, letra crema, punto naranja
    junti-wordmark-tinta.svg       Sin chapa, letra tinta con punto naranja
    junti-wordmark-crema.svg       Sin chapa, letra crema con punto naranja
    junti-icono-app-naranja.svg    Icono / avatar / favicon sobre naranja
    junti-icono-app-tinta.svg      Icono sobre tinta
    junti-icono-app-papel.svg      Icono sobre papel crema
    junti-marca-j-tinta.svg        La j recortada sin baldosa, tinta
    junti-marca-j-crema.svg        La j recortada sin baldosa, crema

### png/ — 4x con fondo transparente
    junti-chapa-principal.png      1184 x 704
    junti-chapa-inversa.png        1184 x 704
    junti-wordmark-tinta.png        832 x 512
    junti-wordmark-crema.png        832 x 512
    junti-icono-app-naranja.png    1024 x 1024  (tambien sirve para App Store / Play Store)
    junti-icono-app-tinta.png      1024 x 1024
    junti-icono-app-papel.png      1024 x 1024
    junti-marca-j-tinta.png        1024 x 1024  (transparente, sin baldosa)

### webp/ — los mismos PNG, sin perder un pixel
Generados con `cwebp -lossless -exact`, asi que son identicos pixel a pixel al
PNG del que salen (verificado decodificando y comparando: 0 bytes distintos de
3.334.144). Pesan un 82% menos en conjunto: 329 KB de PNG contra 56 KB.

`-exact` importa: sin el, el encoder puede reescribir el RGB debajo de los
pixeles transparentes, y los bordes cambian de color al componer sobre otro
fondo.

    webp/*.webp                    equivalentes de png/
    webp/favicon/*.webp            equivalentes de favicon/

No reemplazan a los otros formatos, los acompanan. El logo en pantalla sigue
siendo SVG (vector, pesa menos y no depende de la fuente), el favicon sigue
siendo .ico y el apple-touch-icon sigue siendo PNG porque iOS no acepta WebP
ahi. El manifest de Android si pide WebP primero y cae a PNG.

### favicon/ — solo la j y el punto
    favicon.ico                    16 + 32 + 48, version naranja (la de siempre)
    favicon-tinta.ico              idem sobre tinta
    favicon-papel.ico              idem sobre papel
    junti-favicon-16/32/48.png     favicon PNG
    junti-favicon-180.png          apple-touch-icon (iOS)
    junti-favicon-192.png          Android / manifest
    junti-favicon-512.png          Android maskable / splash
    junti-favicon-{tinta,papel}-180/192/512.png   variantes de fondo

En HTML:

    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/junti-icono-app-naranja.svg">
    <link rel="apple-touch-icon" sizes="180x180" href="/junti-favicon-180.png">

### junti-tokens.css
Variables de color, tipografia y radios para modo claro y oscuro,
mas las clases .junti-chapa y .junti-estado.

## Geometria del logo
    Rotacion       -4 grados, nunca a la derecha
    Radio chapa    0,295 x alto de la chapa
    Radio baldosa  0,30 x el lado (77 sobre 256)
    Aire chapa     0,50 em a los lados, 0,25 arriba, 0,295 abajo
    Icono          recorte de la j y el punto: el asta sale por el borde superior

## Tipografia
Ambas gratuitas, licencia SIL Open Font License.

- Display / titulares: **Bricolage Grotesque** 700 y 800
  https://fonts.google.com/specimen/Bricolage+Grotesque
- Interfaz: **Instrument Sans** 400, 500 y 600
  https://fonts.google.com/specimen/Instrument+Sans

Carga por CDN:

    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">

El logo NO necesita la fuente: ya esta vectorizado.

## Reglas rapidas
- Una sola chapa por pantalla. Rotacion siempre -4 grados.
- El punto final nunca se quita ni se pone gris.
- En modo claro el boton primario es tinta (#09090B); el naranja se reserva
  para la marca. En modo oscuro el boton primario si es naranja.
- El verde significa una sola cosa: confirmado o pagado.
- Los estados son chapitas inclinadas -3 grados, fondo pastel, texto oscuro.
- Area de respeto alrededor del logo = el alto de la chapa.
- Escala: hasta 79 px la j recortada; de 80 px de ancho en adelante la chapa.

## Tono de voz
Tuteo, frases de menos de doce palabras, verbos de accion. Nunca culpar al
invitado ni presionar al organizador.

    Si:  Van 8 de 12. Faltan 3 por pagar.
    No:  8/12 asistentes confirmados - 3 pagos pendientes.

    Si:  Julian dijo tal vez.
    No:  Julian no ha confirmado su asistencia.

Usamos: parche, plan, junte, cuadrar, quien viene, ya pago, el link.
Evitamos: evento social, asistentes, RSVP, gestionar, usuarios, plataforma.
