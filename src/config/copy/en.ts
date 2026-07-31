import { BRAND_NAME, BRAND_TAGLINE } from "../brand";
import type { Copy } from "./es";

/**
 * Every user-facing string, in English.
 *
 * Typed as `Copy`, so this file cannot drift from `es.ts`: a missing key, a
 * renamed one, or a function taking the wrong arguments is a build error.
 *
 * Translated rather than transliterated. Spanish here is informal and Colombian
 * — "¡Parcero!", "no perseguir a nadie" — and the English is written to land
 * the same way for someone organizing five-a-side with friends, not to mirror
 * the Spanish sentence structure.
 */
export const en: Copy = {
  localeName: "English",
  intlLocale: "en-US",

  brand: {
    name: BRAND_NAME,
    tagline: BRAND_TAGLINE,
  },

  common: {
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    add: "Add",
    edit: "Edit",
    copy: "Copy",
    options: "Options",
    copied: "Copied!",
    loading: "Loading…",
    back: "Back",
    unknownError: "Something went wrong. Try again.",
    required: "This field is required",
    optional: "optional",
    language: "Language",
    changeLanguage: "Change language",
    noMatches: "No matches",
  },

  /** Labels for the breadcrumb trail and the header's account control. */
  nav: {
    breadcrumbLabel: "Where you are",
    home: "Home",
    newEvent: "New event",
    manage: "Organize",
    evidence: "Receipt",
    event: "Event",
    signIn: "Sign in",
    guestMenuLabel: "Sign in and preferences",
  },

  home: {
    title: `${BRAND_NAME} — organize without chasing anyone`,
    heading: BRAND_NAME,
    subheading: BRAND_TAGLINE,
    pitch:
      "Create the event, share the link on WhatsApp, and watch in real time who is coming and who has already paid you. No accounts, no passwords.",
    cta: "Create an event",
    howItWorksTitle: "How it works",
    steps: [
      "You create the event and decide whether it costs anything.",
      "You share the guest link on WhatsApp.",
      "Everyone says whether they are in, out, or maybe.",
      "You tick off who has paid, from your organizer link.",
    ],
    disclaimer:
      "This app never moves money. It only keeps track of who paid — you collect the payments yourself, outside of it.",
  },

  createEvent: {
    title: "Create event",
    attributionAnonTitle: "Sign in first?",
    attributionAnonHelp:
      "Without an account the event works the same, but you will not be able to edit it later or recover the link if you lose it.",
    attributionContinueAnon: "Carry on without an account",
    draftKept: "We kept what you had typed.",
    heading: "New event",
    subheading: "Takes a minute. You do not need an account.",
    fields: {
      title: "What are you doing?",
      titlePlaceholder: "Thursday football",
      titleHelp: "This is what your guests will see.",
      kind: "Kind of event",
      startsAt: "When?",
      startsAtHelp: (zone: string) => `${zone} time.`,
      startsAtDatePlaceholder: "Pick a day",
      startsAtTimePlaceholder: "Time",
      startsAtDateLabel: "Day",
      startsAtTimeLabel: "Time",
      timeZone: "Time zone",
      timeZoneHelp:
        "The event time always shows in this zone, for everyone. Nobody has to do the maths.",
      location: "Where?",
      locationPlaceholder: "La 90 pitch, Medellín",
      capacity: "Maximum spots",
      capacityPlaceholder: "10",
      capacityHelp: "Leave it empty for no limit. Once it fills up, the rest join the waitlist.",
      notes: "Notes",
      notesPlaceholder: "Bring a white shirt and boots.",
      costMode: "Does it cost anything?",
      costAmount: "Amount",
      costAmountHelpTotal: "Split evenly between everyone who says they are coming.",
      costAmountHelpPerPerson: "Everyone who confirms pays this much.",
      currency: "Currency",
    },
    costModes: {
      none: "Free",
      total: "One total to split",
      per_person: "A fixed amount each",
    },
    submit: "Create event",
    submitting: "Creating…",
  },

  eventCreated: {
    heading: "Done! Your event is live",
    subheading: "Save both links. They are the only way back in.",
    participantLinkLabel: "Guest link",
    participantLinkHelp:
      "This is the one you share. They say if they are coming and see who owes what.",
    organizerLinkLabel: "Your organizer link",
    organizerLinkHelp:
      "Keep it safe and do not share it. It is how you mark payments, add people and close the event.",
    warning:
      "There are no accounts and no way to recover access. Lose the organizer link and you lose control of the event. Save it in your notes or send it to yourself on WhatsApp.",
    shareWhatsApp: "Share on WhatsApp",
    goToManage: "Go to my organizer panel",
  },

  event: {
    closedBadge: "Closed",
    closedNotice: "This event is closed. Nobody can say they are coming or change their answer.",
    notFoundTitle: "We could not find this event",
    notFoundBody: "The link may be incomplete, or the event may have been deleted.",
    noLocation: "No place set",
    whenLabel: "When",
    inZone: (place: string) => `${place} time`,
    eventLocalTime: (when: string, place: string) => `In ${place}: ${when}`,
    whereLabel: "Where",
    notesLabel: "Notes",
    capacityLabel: "Spots",
    capacityUnlimited: "No limit",
    capacityValue: (taken: number, total: number) => `${taken} of ${total}`,
    spotsLeft: (n: number) => (n === 1 ? "1 spot left" : `${n} spots left`),
    full: "Full",
  },

  roster: {
    heading: "Who is coming",
    inTitle: "Coming",
    outTitle: "Not coming",
    maybeTitle: "Maybe",
    waitlistedTitle: "Waitlist",
    empty: "Nobody has answered yet. Be the first.",
    emptyGroup: "Nobody here.",
    countIn: (n: number) => (n === 1 ? "1 person" : `${n} people`),
    pendingPolicyTitle: "Something still missing",
    pendingPolicyHelp:
      "They said they are coming, but have not met what the event asks for yet. They do not count as confirmed.",
    waitingOn: (labels: string) => `Waiting on: ${labels}`,
    inReview: (labels: string) => `Under review: ${labels}`,
  },

  attendance: {
    in: "In",
    out: "Out",
    maybe: "Maybe",
    waitlisted: "Waitlisted",
  },

  rsvp: {
    heading: "Let them know you are coming",
    headingEditing: "Change your answer",
    nameLabel: "Your name",
    namePlaceholder: "What your friends call you",
    nameHelp: "1 to 40 characters. Use the same one every time so you do not show up twice.",
    attendanceLabel: "Are you coming?",
    submit: "Confirm",
    submitEditing: "Update my answer",
    submitting: "Sending…",
    yourRsvp: (name: string) => `You are on the list as ${name}.`,
    changeMine: "Change my answer",
    saved: "Done — you are on the list.",
    savedEditing: "Your answer is updated.",
    waitlistedNotice:
      "The event is full, so you are on the waitlist. If someone drops out, the organizer will move you up and let you know.",
    willBeWaitlisted:
      "The event is full. If you choose “In”, you join the waitlist and the organizer moves you up if someone drops out.",
    duplicateName:
      "Someone with that name is already on this event. Use another one — add your surname, for instance.",
    closed: "The event is closed and no longer accepts changes.",
    oneTapHeading: "Join in one tap",
    oneTapSubmit: (name: string) => `I'm in — add me as ${name}`,
    oneTapSubmitting: "Adding you…",
    oneTapHelp: "One tap and you are on the list. You can change your answer afterwards.",
    oneTapNameTaken:
      "Someone on this event already has your name. Adjust it and we will add you just as fast.",
    signedInAs: (name: string) => `You are signed in as ${name}.`,
    useAnotherName: "I'd rather type a different name",
  },

  policies: {
    sectionTitle: "What it takes to be confirmed",
    sectionHelp:
      "Anyone who says they are coming but has not met these shows up separately, as pending. You decide which ones apply.",
    suggestedForKind: "Suggested for this kind of event",
    add: "Add a requirement",
    remove: "Remove",
    labelField: "What is it called?",
    labelHelp: "This is what your guests will read.",
    descriptionField: "Instructions",
    descriptionHelp: "Optional. Which account to transfer to, for example.",
    none: "This event asks for nothing extra to confirm.",
    otherAvailable: "Other requirements available",
    labelOverrideHelp: "Leave it empty to use the usual name.",
    descriptionOverrideHelp: "Leave it empty to use the usual instructions.",
    unsupported:
      "This version of the app does not know how to ask for this requirement. It blocks nobody; tell whoever administers the catalogue.",
    handlerHelp: {
      file_upload_reviewed: "They upload a photo and you approve it.",
      self_acknowledged: "They tick a box. Met immediately, with nothing for you to review.",
    } as Record<string, string>,
    status: {
      missing: "Pending",
      submitted: "Under review",
      approved: "Met",
      rejected: "Rejected",
    },
    yourStatusHeading: "What is left before you are confirmed",
    allDone: "All done. You are confirmed.",
    blockedNotice: (labels: string) =>
      `You are on the list, but not confirmed yet: ${labels} still missing.`,
    acknowledgeSubmit: "I confirm I have read it",
    acknowledged: "You have confirmed this.",
    uploadLabel: "Photo of the receipt",
    uploadHelp: "JPG, PNG or WebP. We shrink it on your phone before uploading.",
    uploadChoose: "Choose a photo",
    uploadChange: "Change photo",
    uploadSubmit: "Send receipt",
    uploadSubmitting: "Sending…",
    uploadPreparing: "Preparing the image…",
    noteLabel: "Note",
    noteHelp: "Optional. The transfer reference, for instance.",
    notePlaceholder: "Transfer 4471",
    submittedNotice: "Sent. The organizer will review it and confirm you.",
    rejectedNotice: (reason: string) => `The organizer did not accept it: ${reason}`,
    rejectedNoticeNoReason: "The organizer did not accept it. Send it again.",
    resubmit: "Send another",
    onlyOrganizerSeesEvidence:
      "Only the organizer sees this photo. It never appears on the public list.",
  },

  review: {
    heading: "To review",
    empty: "Nothing waiting to be reviewed.",
    pendingCount: (n: number) => (n === 1 ? "1 to review" : `${n} to review`),
    viewEvidence: "View receipt",
    approve: "Approve",
    reject: "Reject",
    reasonLabel: "Why?",
    reasonPlaceholder: "Photo is unreadable, amount does not match…",
    reasonHelp: "We show this to them so they can send it again.",
    submittedBy: (name: string, when: string) => `${name} · sent ${when}`,
    approvedNotice: "Approved.",
    rejectedNotice: "Rejected. They can send it again now.",
    noEvidence: "No photo attached.",
  },

  money: {
    heading: "The money",
    owesLabel: "Owes",
    collectedLabel: "Collected",
    outstandingLabel: "Still owed",
    totalLabel: "Event total",
    perPersonLabel: "Each",
    /** The same fact beside a price, where the label has to share the line. */
    perPersonShort: "each",
    paid: "Paid",
    pending: "Owes",
    waived: "No charge",
    noCost: "This event is free.",
    /** The same fact as `noCost`, at the size of a label on a card. */
    free: "Free",
    splitAmong: (n: number) => (n === 1 ? "Split between 1 person" : `Split between ${n} people`),
    nobodyIn: "Nobody has confirmed yet, so there is nothing to split.",
    progressLabel: (collected: string, total: string) => `${collected} of ${total}`,
  },

  manage: {
    title: "Organizer panel",
    heading: "Organizer panel",
    subheading: "Only you see this screen. Do not share this link.",
    participantsSection: "Participants",
    addParticipant: "Add someone",
    addParticipantHelp: "For the friend who never opens links.",
    addParticipantSubmit: "Add",
    removeParticipant: "Remove",
    removeConfirmTitle: "Remove this person?",
    removeConfirmBody: (name: string) =>
      `${name} is removed from the event along with their payment record. This cannot be undone.`,
    removeConfirmAction: "Yes, remove",
    markPaid: "Mark as paid",
    markPending: "Mark as owing",
    markWaived: "Do not charge",
    paymentMethodLabel: "Method",
    paymentMethodPlaceholder: "cash, transfer, card",
    promote: "Move up to the event",
    promoteHelp: "Confirm them yourself. We never move anyone up automatically.",
    slotOpenedTitle: "A spot opened up",
    slotOpenedBody: (n: number) =>
      n === 1
        ? "There is 1 free spot and someone waiting. Move them up so they find out."
        : `There are ${n} free spots and people waiting. Move them up so they find out.`,
    closeEvent: "Close event",
    closeEventHelp: "Freezes the answers. You can reopen it later.",
    reopenEvent: "Reopen event",
    editEvent: "Edit event",
    editNeedsAccount: "Editing the details needs an account",
    editNeedsAccountHelp:
      "This event was created without one, so its details are fixed. Everything else — payments, people, the waitlist, closing it — still works from this link.",
    editNotYours: "This event belongs to another account, so only that one can change its details.",
    editEventSaved: "Changes saved.",
    addParticipantSaved: "Added to the list.",
    shareSection: "Links",
    splitWarningTitle: "Careful with the numbers",
    splitWarningBody: (name: string, confirmed: string, current: string) =>
      `${name} already paid ${confirmed}, but the current split puts them at ${current}. Sort it out with them directly — the app will not change that figure on its own.`,
    noParticipants: "Nobody has signed up yet.",
    noParticipantsHelp: "Share the guest link so people can start answering.",
  },

  share: {
    /*
      The default invitation, as a template. The placeholders are English in
      both languages on purpose: they are not prose but slots, inserted by
      buttons labelled in the writer's own language, and keeping the token
      fixed lets a template survive its author switching the interface.
    */
    defaultMessage: "Hey! {title} — {when}. Let me know if you are coming: {link}",
    copyParticipantLink: "Copy guest link",
    copyOrganizerLink: "Copy my organizer link",
  },

  footer: {
    /*
      The legal line Vennet's brand manual prescribes for the site and app
      footer, on a single line — one string, because the mark above it carries
      the link, so the sentence never has to be split to host one.
    */
    legal: (year: number) =>
      `© ${year} Vennet SAS. ${BRAND_NAME} is a Vennet product. All rights reserved.`,
    /** Accessible name for the link wrapping the mark. */
    vennetLabel: "Vennet",
  },

  /** What goes out by email. Each template, beside its subject. */
  emails: {
    pendingApproval: {
      subject: (name: string) => `${name} sent a receipt`,
      preview: (name: string) => `${name} is waiting on your go-ahead.`,
      heading: "You have a receipt to review",
      body: (name: string, event: string) =>
        `${name} uploaded their receipt for ${event}. Until you approve it, they do not count as confirmed.`,
      alsoWaiting: (n: number) =>
        `That makes ${n} waiting. You can approve them all at once from the queue.`,
      cta: "Open the queue",
    },
  },

  approvals: {
    link: "Approvals",
    title: "Pending approvals",
    heading: "Pending approvals",
    subheading: "Receipts waiting on you, across every event of yours.",
    emptyTitle: "Nothing to review",
    emptyHelp: "When somebody sends a receipt, it shows up here.",
    selectAll: "Select all",
    clearSelection: "Clear selection",
    approveSelected: (n: number) => (n === 1 ? "Approve 1" : `Approve ${n}`),
    approving: "Approving…",
    approvedNotice: (n: number) =>
      n === 1 ? "You approved 1 receipt." : `You approved ${n} receipts.`,
    nothingLeft: "Those were already resolved.",
    openEvent: "Open the event",
    seeReceipt: "See receipt",
    noReceipt: "No image",
    waitingSince: (when: string) => `Since ${when}`,
    rejectHint: "Rejecting one? That happens inside the event, with the reason.",
  },

  messages: {
    link: "Messages",
    title: "Guest messages",
    heading: "Guest messages",
    subheading: "What yours receive when you share an event.",
    invitationLabel: "WhatsApp invitation",
    invitationHelp:
      "WhatsApp opens with this already written. You can change it before sending, and whatever you save here is used for every event you share.",
    insertLabel: "Insert",
    placeholderTitle: "Title",
    placeholderWhen: "Date and time",
    placeholderLink: "Link",
    previewLabel: "How it looks",
    restore: "Back to the default message",
    saved: "Message saved.",
    /* Only used by somebody who has no events yet, so the preview still
       shows the shape of a real message. */
    sampleTitle: "Thursday football",
    sampleWhen: "Thu, 7 Aug, 8:00 pm (Bogotá)",
    usingDefault: "You are using the default message.",
    errorEmpty: "Write the message, or go back to the one the app ships.",
    errorMissingLink: "The link is missing: without it nobody can reply. Put it wherever you like.",
    errorTooLong: (max: number) => `${max} characters maximum.`,
  },

  auth: {
    signInTitle: "Sign in",
    signInHeading: "Sign in to see your events",
    signInSubheading:
      "Only organizers need an account. Whoever gets the link does not have to sign in to anything.",
    google: "Continue with Google",
    emailLabel: "Your email",
    emailPlaceholder: "you@email.com",
    emailSubmit: "Email me a link",
    emailSending: "Sending…",
    emailSent: (email: string) =>
      `We sent a link to ${email}. Open it on this same device to sign in.`,
    emailInvalid: "Enter a valid email address.",
    signOut: "Sign out",
    failed: "We could not complete the sign-in. Try again.",
    myEventsTitle: "My events",
    myEventsHeading: "My events",
    myEventsEmpty: "You have not created any events yet.",
    myEventsEmptyHelp: "Once you create one, it shows up here with its history.",
    myEventsLink: "My events",
    share: "Share",
    duplicate: "Duplicate",
    duplicateAndEdit: "Duplicate and edit",
    duplicating: "Duplicating…",
    duplicatedNotice: "Done — duplicated for next week.",
    duplicateExists:
      "You already have the same event that week. Check the list before creating another.",
    duplicateFailed: "We could not duplicate it. Try again.",
    nextWeekHint: (when: string) => `It would land on ${when}.`,
    createdOn: (date: string) => `Created on ${date}`,
    manage: "Manage",
    attendingCount: (n: number) => (n === 1 ? "1 confirmed" : `${n} confirmed`),
    signInToJoin: "Sign in and join in one tap",
    searchPlaceholder: "Search events…",
    searchLabel: "Search your events",
    tabUpcoming: "Upcoming",
    tabPast: "Past",
    tabAll: "All",
    /*
      Singular, for the badge on one card. The tabs above count several events
      and are plural for that reason; one event is not "Past events".
    */
    statusUpcoming: "Upcoming",
    statusPast: "Past",
    /** When the event has no catalogue type: the band still has to say something. */
    eventFallbackLabel: "Event",
    newEventShort: "New",
    noMatches: (term: string) => `No event matches “${term}”.`,
    noUpcoming: "You have no upcoming events.",
    noUpcomingHelp: "Create one, or look at the ones already done.",
    noPast: "You have not run any events yet.",
    noPastHelp: "Once one is over it stays here.",
    moreParticipants: (n: number) => `+${n}`,
    participantsLabel: "Who is coming",
    nobodyYet: "Nobody yet",
    cardActionsLabel: (title: string) => `Options for ${title}`,
    menuLabel: "My account",
  },

  appearance: {
    label: "Appearance",
    light: "Light",
    dark: "Dark",
    system: "Match my system",
  },

  profile: {
    title: "My profile",
    heading: "My profile",
    subheading: "How you want to see the app. It only affects your own view.",
    link: "My profile",
    languageLabel: "Language",
    languageAuto: "Whatever my browser uses",
    timeZoneLabel: "Time zone",
    timeZoneAuto: "Whatever my device uses",
    timeZoneHelp:
      "Event times are shown to you in this zone. When an event is somewhere else, you also see the local time there.",
    autoHelp: (detected: string) => `Right now we detect: ${detected}.`,
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    storedNotice: "Kept on your account, so it follows you to any device.",
  },

  errorBoundary: {
    title: "Something broke",
    body: "We could not load this screen. It may be a temporary problem reaching the database.",
    retry: "Try again",
    home: "Go home",
  },

  errors: {
    titleRequired: "Give the event a name.",
    titleTooLong: "That name is too long (120 characters max).",
    startsAtRequired: "Pick a day.",
    startsAtTimeRequired: "Pick a time.",
    startsAtInvalid: "That date is not valid.",
    capacityInvalid: "Spots must be a number greater than zero.",
    costRequired: "Enter the amount.",
    costInvalid: "The amount must be zero or more.",
    nameRequired: "Enter your name.",
    nameTooLong: "40 characters max.",
    attendanceInvalid: "Choose whether you are in, out, or maybe.",
    notFound: "We could not find that.",
    forbidden: "This link is not allowed to do that.",
    rateLimited: "Too fast. Wait a moment and try again.",
    eventClosed: "The event is closed.",
    timeZoneInvalid: "That time zone does not exist.",
    policyLabelTooLong: "60 characters max.",
    policyTooMany: (max: number) => `${max} requirements per event, maximum.`,
    evidenceRequired: "Attach a photo of the receipt.",
    evidenceTooLarge: (maxKb: number) =>
      `That image is too heavy (${maxKb} KB max after shrinking).`,
    evidenceWrongType: "We only accept JPG, PNG or WebP images.",
    evidenceUnreadable: "We could not read that image. Try a different photo.",
    signInRequired: "Sign in to do that.",
  },
};
