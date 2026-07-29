# Junti · Brand kit v2

Identidad construida sobre **La chapa**: el nombre es el logo, dentro de una
chapa naranja de esquinas suaves girada -4 grados, con un punto final que
significa "ya esta". Modo claro por defecto; el modo oscuro usa la misma chapa.

## Contenido

    logo/
      junti-chapa-principal.png   Logo principal (chapa naranja, punto crema) - fondo transparente
      junti-chapa-inversa.png     Chapa tinta con punto naranja - para fondos naranja o foto
      junti-wordmark-tinta.png    Wordmark sin chapa, para pies de pagina y terceros
      junti-wordmark-crema.png    Wordmark sobre tinta (modo oscuro)
      junti-icono-naranja.png     Icono de app 1024x1024 - monograma "j."
      junti-icono-tinta.png       Icono de app alternativo sobre tinta
    junti-tokens.css              Variables de color, tipografia y radios (claro + oscuro)
    README.md                     Este archivo

Los PNG estan a 4x. Para vectores editables, el logo se reconstruye en un
minuto con HTML/CSS o en Figma: es texto + un rectangulo redondeado rotado
(ver la clase .junti-chapa en junti-tokens.css y la seccion "Construccion"
del documento de marca).

## Tipografia

Ambas fuentes son gratuitas, licencia SIL Open Font License, y se pueden
empaquetar en la app sin costo.

- Display / logo: **Bricolage Grotesque** (700, 800)
  https://fonts.google.com/specimen/Bricolage+Grotesque
- Interfaz: **Instrument Sans** (400, 500, 600)
  https://fonts.google.com/specimen/Instrument+Sans

Carga por CDN:

    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">

Para autoalojarlas: descargar los .ttf desde los enlaces de arriba (boton
"Get font" > "Download all"), convertir a .woff2 y servirlas con @font-face.

## Reglas rapidas

- Una sola chapa por pantalla. Rotacion siempre -4 grados, nunca a la derecha.
- El punto final nunca se quita ni se pone gris.
- En modo claro el boton primario es tinta (#09090B); el naranja se reserva
  para la marca. En modo oscuro el boton primario si es naranja.
- El verde significa una sola cosa: confirmado o pagado.
- Los estados son chapitas inclinadas -3 grados, fondo pastel y texto oscuro.
- Area de respeto alrededor del logo = el alto de la chapa.

## Tono de voz

Tuteo, frases de menos de doce palabras, verbos de accion. Nunca culpar al
invitado ni presionar al organizador.

    Si:  Van 8 de 12. Faltan 3 por pagar.
    No:  8/12 asistentes confirmados - 3 pagos pendientes.

    Si:  Julian dijo tal vez.
    No:  Julian no ha confirmado su asistencia.

Usamos: parche, plan, junte, cuadrar, quien viene, ya pago, el link.
Evitamos: evento social, asistentes, RSVP, gestionar, usuarios, plataforma.
