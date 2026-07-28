import { BRAND_NAME, BRAND_TAGLINE } from "../brand";

/**
 * Every user-facing string, in Spanish (es-CO).
 *
 * This file is the shape: `Copy` is inferred from it, and every other language
 * has to satisfy that type, so a missing or misspelled key fails the build
 * instead of rendering `undefined` to someone.
 *
 * Deliberately NOT `as const`. Widening the literals to `string` is what lets
 * `en.ts` be checked against this without every value having to be the same
 * Spanish text.
 *
 * Functions are used wherever a string needs interpolation, so callers never
 * build sentences by concatenation — word order is not the same in every
 * language, and a sentence assembled from fragments can only be correct in the
 * one it was written for.
 */
export const es = {
  localeName: "Español",
  /** For `Intl` — formatting conventions, not just language. */
  intlLocale: "es-CO",

  brand: {
    name: BRAND_NAME,
    tagline: BRAND_TAGLINE,
  },

  common: {
    save: "Guardar",
    cancel: "Cancelar",
    close: "Cerrar",
    delete: "Eliminar",
    add: "Agregar",
    edit: "Editar",
    copy: "Copiar",
    copied: "¡Copiado!",
    loading: "Cargando…",
    back: "Volver",
    unknownError: "Algo salió mal. Intenta de nuevo.",
    required: "Este campo es obligatorio",
    optional: "opcional",
    language: "Idioma",
    changeLanguage: "Cambiar idioma",
  },

  home: {
    title: `${BRAND_NAME} — organiza sin perseguir a nadie`,
    heading: BRAND_NAME,
    subheading: BRAND_TAGLINE,
    pitch:
      "Crea el evento, comparte el link por WhatsApp y mira en tiempo real quién viene y quién ya te pagó. Sin cuentas, sin contraseñas.",
    cta: "Crear un evento",
    howItWorksTitle: "Cómo funciona",
    steps: [
      "Creas el evento y eliges si tiene costo.",
      "Compartes el link de invitados por WhatsApp.",
      "Cada quien confirma si viene, si no viene o si tal vez.",
      "Tú marcas quién ya pagó desde tu link de organizador.",
    ],
    disclaimer:
      "Esta app no mueve plata. Solo lleva la cuenta de quién pagó — los pagos los recibes tú, por fuera.",
  },

  createEvent: {
    title: "Crear evento",
    attributionSignedIn: (name: string) => `Se guardará en tu cuenta, ${name}.`,
    attributionSignedInHelp: "Podrás editarlo después y duplicarlo cuando se repita.",
    attributionAnonTitle: "¿Entras primero?",
    attributionAnonHelp:
      "Sin cuenta el evento funciona igual, pero no vas a poder editarlo después ni recuperar el link si lo pierdes.",
    attributionContinueAnon: "Sigo sin cuenta",
    draftKept: "Guardamos lo que llevas escrito.",
    heading: "Nuevo evento",
    subheading: "Solo toma un minuto. No necesitas crear una cuenta.",
    fields: {
      title: "¿Qué van a hacer?",
      titlePlaceholder: "Fútbol de los jueves",
      titleHelp: "Así lo verán tus invitados.",
      kind: "Tipo de evento",
      startsAt: "¿Cuándo?",
      startsAtHelp: (zone: string) => `Hora de ${zone}.`,
      startsAtDatePlaceholder: "Elige el día",
      startsAtTimePlaceholder: "Hora",
      startsAtDateLabel: "Día",
      startsAtTimeLabel: "Hora",
      timeZone: "Zona horaria",
      timeZoneHelp:
        "La hora del evento se muestra siempre en esta zona, para todos. Nadie tiene que hacer cuentas.",
      location: "¿Dónde?",
      locationPlaceholder: "Cancha La 90, Medellín",
      capacity: "Cupo máximo",
      capacityPlaceholder: "10",
      capacityHelp:
        "Déjalo vacío si no hay límite. Al llenarse, los demás entran en lista de espera.",
      notes: "Notas",
      notesPlaceholder: "Llevar camiseta blanca y guayos.",
      costMode: "¿Tiene costo?",
      costAmount: "Monto",
      costAmountHelpTotal: "Se reparte en partes iguales entre quienes confirmen que vienen.",
      costAmountHelpPerPerson: "Cada persona que confirme paga este monto.",
      currency: "Moneda",
    },
    costModes: {
      none: "Sin costo",
      total: "Costo total a repartir",
      per_person: "Un monto por persona",
    },
    submit: "Crear evento",
    submitting: "Creando…",
  },

  eventCreated: {
    heading: "¡Listo! Tu evento está creado",
    subheading: "Guarda estos dos links. Son la única forma de volver a entrar.",
    participantLinkLabel: "Link para invitados",
    participantLinkHelp:
      "Este es el que compartes. Deja confirmar asistencia y ver quién debe cuánto.",
    organizerLinkLabel: "Tu link de organizador",
    organizerLinkHelp:
      "Guárdalo bien y no lo compartas. Con él marcas pagos, agregas gente y cierras el evento.",
    warning:
      "No hay cuentas ni recuperación de acceso. Si pierdes el link de organizador, pierdes el control del evento. Guárdalo en tus notas o mándatelo por WhatsApp.",
    shareWhatsApp: "Compartir por WhatsApp",
    goToManage: "Ir a mi panel de organizador",
  },

  event: {
    closedBadge: "Cerrado",
    closedNotice: "Este evento está cerrado. Ya no se puede confirmar ni cambiar asistencia.",
    notFoundTitle: "No encontramos este evento",
    notFoundBody: "El link puede estar incompleto o el evento pudo haber sido eliminado.",
    noLocation: "Sin lugar definido",
    whenLabel: "Cuándo",
    inZone: (place: string) => `hora de ${place}`,
    eventLocalTime: (when: string, place: string) => `En ${place}: ${when}`,
    whereLabel: "Dónde",
    notesLabel: "Notas",
    capacityLabel: "Cupo",
    capacityUnlimited: "Sin límite",
    capacityValue: (taken: number, total: number) => `${taken} de ${total}`,
    spotsLeft: (n: number) => (n === 1 ? "Queda 1 cupo" : `Quedan ${n} cupos`),
    full: "Cupo lleno",
  },

  roster: {
    heading: "Quién viene",
    inTitle: "Vienen",
    outTitle: "No vienen",
    maybeTitle: "Tal vez",
    waitlistedTitle: "Lista de espera",
    empty: "Todavía nadie ha confirmado. Sé el primero.",
    emptyGroup: "Nadie por aquí.",
    countIn: (n: number) => (n === 1 ? "1 persona" : `${n} personas`),
    pendingPolicyTitle: "Falta un requisito",
    pendingPolicyHelp:
      "Dijeron que vienen, pero todavía no cumplen lo que pide el evento. No cuentan como confirmados.",
    waitingOn: (labels: string) => `Falta: ${labels}`,
    inReview: (labels: string) => `En revisión: ${labels}`,
  },

  attendance: {
    in: "Voy",
    out: "No voy",
    maybe: "Tal vez",
    waitlisted: "En espera",
  },

  rsvp: {
    heading: "Confirma tu asistencia",
    headingEditing: "Cambia tu respuesta",
    nameLabel: "Tu nombre",
    namePlaceholder: "Cómo te dicen tus amigos",
    nameHelp: "Entre 1 y 40 caracteres. Úsalo igual cada vez para no aparecer dos veces.",
    attendanceLabel: "¿Vienes?",
    submit: "Confirmar",
    submitEditing: "Actualizar mi respuesta",
    submitting: "Enviando…",
    yourRsvp: (name: string) => `Estás registrado como ${name}.`,
    changeMine: "Cambiar mi respuesta",
    waitlistedNotice:
      "El cupo está lleno, así que quedaste en lista de espera. Si alguien cancela, el organizador te avisa y te sube.",
    willBeWaitlisted:
      "El cupo está lleno. Si eliges «Voy», quedas en lista de espera y el organizador te sube si alguien cancela.",
    duplicateName:
      "Ya hay alguien con ese nombre en este evento. Usa otro (por ejemplo, agrega tu apellido).",
    closed: "El evento está cerrado y ya no acepta cambios.",
    oneTapHeading: "Apúntate de una",
    oneTapSubmit: (name: string) => `Voy — apúntame como ${name}`,
    oneTapSubmitting: "Apuntándote…",
    oneTapHelp: "Un toque y quedas en la lista. Después puedes cambiar tu respuesta.",
    oneTapNameTaken:
      "Ya hay alguien con tu nombre en este evento. Ajústalo y te apuntamos igual de rápido.",
    signedInAs: (name: string) => `Estás como ${name}.`,
    useAnotherName: "Prefiero escribir otro nombre",
  },

  policies: {
    sectionTitle: "Requisitos para quedar confirmado",
    sectionHelp:
      "Quien diga que viene pero no los cumpla aparece aparte, como pendiente. Tú decides cuáles pones.",
    suggestedForKind: "Sugeridos para este tipo de evento",
    add: "Agregar requisito",
    remove: "Quitar",
    labelField: "¿Cómo se llama?",
    labelHelp: "Esto es lo que van a leer tus invitados.",
    descriptionField: "Instrucciones",
    descriptionHelp: "Opcional. Por ejemplo, a qué cuenta transferir.",
    none: "Este evento no pide nada extra para confirmar.",
    otherAvailable: "Otros requisitos disponibles",
    labelOverrideHelp: "Déjalo vacío para usar el nombre de siempre.",
    descriptionOverrideHelp: "Déjalo vacío para usar las instrucciones de siempre.",
    unsupported:
      "Esta versión del app no sabe cómo pedir este requisito. No bloquea a nadie; avísale a quien administra el catálogo.",
    handlerHelp: {
      file_upload_reviewed: "Suben una foto y tú la apruebas.",
      self_acknowledged: "Marcan una casilla. Queda cumplido de una vez, sin que revises nada.",
    } as Record<string, string>,
    status: {
      missing: "Pendiente",
      submitted: "En revisión",
      approved: "Cumplido",
      rejected: "Rechazado",
    },
    yourStatusHeading: "Lo que falta para tu confirmación",
    allDone: "Cumpliste todo. Ya estás confirmado.",
    blockedNotice: (labels: string) =>
      `Estás en la lista, pero todavía no confirmado: falta ${labels}.`,
    acknowledgeSubmit: "Confirmo que lo leí",
    acknowledged: "Ya lo confirmaste.",
    uploadLabel: "Foto del comprobante",
    uploadHelp: "JPG, PNG o WebP. La reducimos en tu teléfono antes de subirla.",
    uploadChoose: "Elegir foto",
    uploadChange: "Cambiar foto",
    uploadSubmit: "Enviar comprobante",
    uploadSubmitting: "Enviando…",
    uploadPreparing: "Preparando la imagen…",
    noteLabel: "Nota",
    noteHelp: "Opcional. Por ejemplo, el número de la transferencia.",
    notePlaceholder: "Transferencia 4471",
    submittedNotice: "Enviado. El organizador lo revisa y te confirma.",
    rejectedNotice: (reason: string) => `El organizador no lo aceptó: ${reason}`,
    rejectedNoticeNoReason: "El organizador no lo aceptó. Vuelve a enviarlo.",
    resubmit: "Enviar otro",
    onlyOrganizerSeesEvidence: "Solo el organizador ve esta foto. No aparece en la lista pública.",
  },

  review: {
    heading: "Por revisar",
    empty: "No hay nada pendiente de revisar.",
    pendingCount: (n: number) => (n === 1 ? "1 por revisar" : `${n} por revisar`),
    viewEvidence: "Ver comprobante",
    approve: "Aprobar",
    reject: "Rechazar",
    reasonLabel: "¿Por qué?",
    reasonPlaceholder: "La foto no se ve, no coincide el monto…",
    reasonHelp: "Se lo mostramos a la persona para que lo vuelva a enviar.",
    submittedBy: (name: string, when: string) => `${name} · enviado ${when}`,
    approvedNotice: "Aprobado.",
    rejectedNotice: "Rechazado. La persona ya puede volver a enviarlo.",
    noEvidence: "Sin foto adjunta.",
  },

  money: {
    heading: "Cuentas",
    owesLabel: "Debe",
    collectedLabel: "Recaudado",
    outstandingLabel: "Pendiente",
    totalLabel: "Total del evento",
    perPersonLabel: "Por persona",
    paid: "Pagó",
    pending: "Pendiente",
    waived: "Exonerado",
    noCost: "Este evento no tiene costo.",
    splitAmong: (n: number) =>
      n === 1 ? "Repartido entre 1 persona" : `Repartido entre ${n} personas`,
    nobodyIn: "Nadie ha confirmado todavía, así que aún no hay nada que repartir.",
    progressLabel: (collected: string, total: string) => `${collected} de ${total}`,
  },

  manage: {
    title: "Panel de organizador",
    heading: "Panel de organizador",
    subheading: "Solo tú ves esta pantalla. No compartas este link.",
    participantsSection: "Participantes",
    addParticipant: "Agregar a alguien",
    addParticipantHelp: "Para el amigo que nunca abre los links.",
    addParticipantSubmit: "Agregar",
    removeParticipant: "Quitar",
    removeConfirmTitle: "¿Quitar a esta persona?",
    removeConfirmBody: (name: string) =>
      `Se elimina a ${name} del evento junto con su registro de pago. Esto no se puede deshacer.`,
    removeConfirmAction: "Sí, quitar",
    markPaid: "Marcar como pagado",
    markPending: "Marcar como pendiente",
    markWaived: "Exonerar",
    paymentMethodLabel: "Método",
    paymentMethodPlaceholder: "nequi, efectivo, transferencia",
    promote: "Subir al evento",
    promoteHelp: "Confírmale tú mismo. No subimos a nadie automáticamente.",
    slotOpenedTitle: "Se liberó un cupo",
    slotOpenedBody: (n: number) =>
      n === 1
        ? "Hay 1 cupo libre y alguien esperando. Súbelo tú para que se entere."
        : `Hay ${n} cupos libres y gente esperando. Súbelos tú para que se enteren.`,
    closeEvent: "Cerrar evento",
    closeEventHelp: "Congela las confirmaciones. Puedes reabrirlo después.",
    reopenEvent: "Reabrir evento",
    editEvent: "Editar evento",
    editNeedsAccount: "Para editar los datos hace falta una cuenta",
    editNeedsAccountHelp:
      "Este evento se creó sin cuenta, así que sus datos quedan fijos. Todo lo demás —pagos, gente, lista de espera, cerrarlo— sigue funcionando desde este link.",
    editNotYours:
      "Este evento está a nombre de otra cuenta, así que solo esa puede cambiar sus datos.",
    editEventSaved: "Cambios guardados.",
    shareSection: "Links",
    splitWarningTitle: "Ojo con las cuentas",
    splitWarningBody: (name: string, confirmed: string, current: string) =>
      `${name} ya pagó ${confirmed}, pero con el reparto actual le corresponden ${current}. Ajústalo con esa persona por fuera — la app no toca esa cifra sola.`,
    noParticipants: "Nadie se ha registrado todavía.",
    noParticipantsHelp: "Comparte el link de invitados para que empiecen a confirmar.",
  },

  share: {
    whatsAppMessage: (title: string, when: string, url: string) =>
      `¡Parcero! ${title} — ${when}. Confirma si vienes acá: ${url}`,
    copyParticipantLink: "Copiar link de invitados",
    copyOrganizerLink: "Copiar mi link de organizador",
  },

  auth: {
    signInTitle: "Entrar",
    signInHeading: "Entra para ver tus eventos",
    signInSubheading:
      "Solo los organizadores necesitan cuenta. Quien recibe el link no tiene que entrar a nada.",
    google: "Continuar con Google",
    emailLabel: "Tu correo",
    emailPlaceholder: "tu@correo.com",
    emailSubmit: "Enviarme un link",
    emailSending: "Enviando…",
    emailSent: (email: string) =>
      `Te mandamos un link a ${email}. Ábrelo desde este mismo dispositivo para entrar.`,
    emailInvalid: "Escribe un correo válido.",
    signOut: "Salir",
    failed: "No pudimos completar el ingreso. Intenta de nuevo.",
    myEventsTitle: "Mis eventos",
    myEventsHeading: "Mis eventos",
    myEventsEmpty: "Todavía no has creado ningún evento.",
    myEventsEmptyHelp: "Cuando crees uno, aparecerá acá con su historial.",
    myEventsLink: "Mis eventos",
    share: "Compartir",
    duplicate: "Duplicar",
    duplicateAndEdit: "Duplicar y editar",
    duplicating: "Duplicando…",
    duplicatedNotice: "Listo, lo duplicamos para la próxima semana.",
    duplicateExists: "Ya tienes un evento igual esa semana. Revisa la lista antes de crear otro.",
    duplicateFailed: "No pudimos duplicarlo. Intenta de nuevo.",
    nextWeekHint: (when: string) => `Quedaría el ${when}.`,
    createdOn: (date: string) => `Creado el ${date}`,
    manage: "Administrar",
    attendingCount: (n: number) => (n === 1 ? "1 confirmado" : `${n} confirmados`),
    signInToJoin: "Entra y te apuntas con un toque",
  },

  profile: {
    title: "Mi perfil",
    heading: "Mi perfil",
    subheading: "Cómo quieres ver el app. Solo aplica a lo tuyo.",
    link: "Mi perfil",
    languageLabel: "Idioma",
    languageAuto: "El de mi navegador",
    timeZoneLabel: "Zona horaria",
    timeZoneAuto: "La de mi dispositivo",
    timeZoneHelp:
      "Las horas de los eventos se te muestran en esta zona. Cuando el evento es en otra, verás también la hora del lugar.",
    autoHelp: (detected: string) => `Ahora mismo detectamos: ${detected}.`,
    save: "Guardar",
    saving: "Guardando…",
    saved: "Listo, guardado.",
    storedNotice: "Queda guardado en tu cuenta, así te sigue a cualquier dispositivo.",
  },

  errorBoundary: {
    title: "Algo se rompió",
    body: "No pudimos cargar esta pantalla. Puede ser una falla temporal de conexión con la base de datos.",
    retry: "Intentar de nuevo",
    home: "Ir al inicio",
  },

  errors: {
    titleRequired: "Ponle un nombre al evento.",
    titleTooLong: "El nombre es muy largo (máximo 120 caracteres).",
    startsAtRequired: "Elige el día.",
    startsAtTimeRequired: "Elige la hora.",
    startsAtInvalid: "Esa fecha no es válida.",
    capacityInvalid: "El cupo debe ser un número mayor que cero.",
    costRequired: "Escribe el monto.",
    costInvalid: "El monto debe ser un número mayor o igual a cero.",
    nameRequired: "Escribe tu nombre.",
    nameTooLong: "Máximo 40 caracteres.",
    attendanceInvalid: "Elige si vienes, no vienes o tal vez.",
    notFound: "No encontramos eso.",
    forbidden: "Este link no tiene permiso para hacer eso.",
    rateLimited: "Vas muy rápido. Espera un momento y vuelve a intentar.",
    eventClosed: "El evento está cerrado.",
    timeZoneInvalid: "Esa zona horaria no existe.",
    policyLabelTooLong: "Máximo 60 caracteres.",
    policyTooMany: (max: number) => `Máximo ${max} requisitos por evento.`,
    evidenceRequired: "Adjunta la foto del comprobante.",
    evidenceTooLarge: (maxKb: number) =>
      `La imagen pesa demasiado (máximo ${maxKb} KB después de reducirla).`,
    evidenceWrongType: "Solo aceptamos imágenes JPG, PNG o WebP.",
    evidenceUnreadable: "No pudimos leer esa imagen. Intenta con otra foto.",
    signInRequired: "Entra a tu cuenta para hacer eso.",
  },
};

export type Copy = typeof es;
