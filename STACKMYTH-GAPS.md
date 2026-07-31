# Stackmyth — friction log

> **Status: the original sixteen are resolved. One new entry (#17) is open.**
>
> Fifteen gaps fixed across three releases, one entry withdrawn as intended
> behaviour (#3), and one found later while building against 0.22.0 (#17).
> This app consumes `@stackmyth/*` **0.22.0** and `@stackmyth/manifests`
> **0.2.0**, and every status below was verified against the installed
> artifacts, not the repo.
>
> | Release | Gaps fixed                                                                                                                                                                                                                                                    |
> | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | 0.20.0  | #4 (`loadingLabel`), #5 (`Select name`), #6 (`Alert live`), #12 (`DatePicker locale`), #15 (`reValidateMode`)                                                                                                                                                 |
> | 0.21.0  | #11 (`valueFormat="date"`)                                                                                                                                                                                                                                    |
> | 0.22.0  | #1 (css self-contained), #2+#16 (manifests populated + `require()` fixed), #7 (RSC-safe pure packages), #8 (`Container`/`Section` LayoutProps), #9 (state accent tokens), #10 (`<Form>` element), #13 (documented), #14 (Stack aliases + SelectValue devWarn) |
>
> Workarounds retired in this app as each release landed: the composed
> disabled-Button-plus-Spinner (#4), the Select hidden-input mirror (#5),
> thirty `*.vars.css` imports in the root layout (#1), the
> `<Container><Stack px>` wrapper on every page (#8), the
> `{({ handleSubmit }) => <form …>}` render-prop dance in all four forms
> (#10), and Notice's icon now uses `--sm-<state>-accent` (#9). Still
> standing by choice, not necessity: `Notice` itself (static notices are a
> different a11y animal than alerts even with `live` available) and the
> composed date field (#12's fix works, but the two-field wall-clock model
> is what the server stores).
>
> **One entry was wrong and has been withdrawn:** #3 said `Badge dot`
> silently discards its children. It does, but deliberately — a test asserts
> it, and the supported way to label a dot is `<Badge dot aria-label="…" />`.
> The entry is kept below with a correction rather than deleted, because a
> friction log that quietly edits out its mistakes is not worth reading.

Feedback from a consumer with **zero prior familiarity** with the stack, building
a real (small) app against it over one build. Written as it happened, not
cleaned up afterwards. Entries 1–16 are ordered roughly by how much time each
one cost; #17 was found later and is appended rather than slotted in, so the
numbering keeps meaning something.

Version under test: `@stackmyth/*` **0.19.1** (`icons`/`classnames`/`manifests`
`0.1.0`), React 19.2.4, Next.js 16.2.12 (App Router, Turbopack).

Every `// STACKMYTH-GAP:` comment in the codebase has an entry here.

---

## 1. Two stylesheets per package, and the failure is silent

> **Status: FIXED in 0.22.0.** Exactly option 1 below: every `<pkg>.css` now
> inlines its own `<pkg>.vars.css` at build time (`@use` in the scss source),
> so one import per package works. Verified in the installed artifacts:
> `layout.css` now defines the `--sm-space-*` scale it consumes. The separate
> `.vars.css` files still ship, and importing both is harmless — custom
> properties are idempotent. This app's root layout dropped its thirty
> `*.vars.css` imports; only `core.vars.css` (tokens-only package) and the
> font remain split.

**Cost: the single biggest time sink of the build.**

**What I was building.** The step-2 smoke page: a form, a list, badges, a
button, a modal.

**What happened.** I imported `@stackmyth/<pkg>/<pkg>.css` for each package —
the obvious thing, and the only thing the CLI docs mention (`add` "adds the
matching CSS imports", singular). The page rendered with correct colors,
correct borders, correct badge variants… and **every single gap, padding and
margin at zero**. Text ran edge to edge. `Stack gap="lg"` did nothing.
`px="4"` did nothing. The `Spinner size="sm"` rendered ~300px tall.

It looks exactly like _"I am using the layout API wrong"_, so that is what I
debugged first. The classes were all present and correct in the DOM
(`sm-stack--gap-lg sm-u-px-4`); `getComputedStyle` said `gap: normal`. The CSS
was in the served bundle. Only after diffing the rule against the token did I
find it:

```css
.sm-stack--gap-lg {
  gap: var(--sm-space-5);
} /* in layout.css       */
--sm-space-5: 20px; /* in layout.vars.css  ← not imported */
```

Every package ships **two** stylesheets and you need **both**. An undefined
custom property makes the whole declaration invalid at computed-value time, so
it fails to _nothing_ — no console warning, no visual error, no clue.

**What I did instead.** Imported all 20 `*.vars.css` files before all 20 `*.css`
files in `src/app/layout.tsx`, with a long comment so the next person doesn't
repeat it.

**What I would have wanted to exist**, in descending order of preference:

1. **One import per package.** Make `<pkg>.css` `@import` its own
   `<pkg>.vars.css`. There is no scenario where a consumer wants the rules
   without the variables, so the split buys nothing at the consumer boundary.
2. Failing that, **a single `@stackmyth/core/all.css`** (or per-package
   `<pkg>/index.css`) that pulls both halves.
3. Failing that, **a dev-mode assertion**: the packages already ship `devWarn`
   from `@stackmyth/core`. A mount-time check that
   `getComputedStyle(document.documentElement).getPropertyValue("--sm-space-5")`
   is non-empty, warning `"@stackmyth/layout: layout.vars.css is not imported"`,
   would have turned an hour into ten seconds.
4. At minimum, **say it in the README** in bold. The information exists only in
   the `manifests` package, as a `css: { tokens, styles }` pair — which I had
   actually read and not understood the significance of.

---

## 2. `@stackmyth/manifests` is stale and mostly empty — but it is what I was pointed at

> **Status: FIXED in `@stackmyth/manifests` 0.2.0.** All three problems:
> versions now track each package's real release; `props` is generated from
> the TypeScript sources via react-docgen-typescript (own-interface props
> only — Button reports its 14, not the ~250 inherited HTML attributes —
> with real types, defaults, enum values and JSDoc descriptions); and the
> `import`/`css` strings carry the full `@stackmyth/` scope. The zero-exports
> `require()` was its own bug — a `.js` CommonJS build inside a
> `"type": "module"` package parses as ESM — fixed by shipping `.cjs`.
> Verified from this app: `require("@stackmyth/manifests")` returns 13
> exports and `getManifest("button").props.Button` has 14 entries.

The brief specifically directed me to `@stackmyth/manifests` as the component
inventory. It is the natural first stop, and it is the least reliable source in
the package. Three separate problems:

**a. Version skew.** Installed packages are `0.19.1`; every manifest reports
`0.18.6`. Nothing indicates the manifest data is from a different release, so a
consumer trusting it is reading a previous version's API.

**b. `props` is empty for essentially every component.** This is the whole
reason to reach for a manifest:

```js
getManifest("button").props; // → {}
getManifest("badge").props; // → {}
getComponentProps("Button"); // → {}
```

The `PropEntry` type is beautifully specified — `type`, `default`, `required`,
`description`, `values`, `signature` — and then unpopulated. Same for
`description`, which is the placeholder string `"Badge component."` for all 489
components.

**c. The `import` field is malformed** — the scope is missing:

```js
getManifest("field").import;
// → "import { Field, FieldLabel, … } from '/field';"
//                                          ^ should be '@stackmyth/field'
```

Copy-pasting it produces a module-not-found. Same for `css.tokens` /
`css.styles`, which read `"/field/field.vars.css"` instead of
`"@stackmyth/field/field.vars.css"`.

**What I did instead.** Abandoned the manifests entirely after ~20 minutes and
read all 20 packages' `.d.ts` files directly, then wrote STACKMYTH-NOTES.md by
hand. The `.d.ts` files are genuinely excellent — rich JSDoc, real defaults,
`@example` blocks. **They are the best documentation in the stack and the
manifests are a worse view onto them.**

**What I would have wanted.** Either generate `props` from the `.d.ts` (the
information is right there, and `manifest.meta.json` exists in each package
suggesting a pipeline already), or drop `props`/`description` from the type
rather than shipping empty objects that read as "this component has no props".
An unpopulated field is worse than an absent one — I wrote code against `{}`
before realising it was a data bug, not a propless component.

The _structural_ data (`inventory.categories`, `compositionGraph`,
`canContain`, `getValidChildren`) is accurate and useful. That part earned its
keep for finding which package a component lives in.

---

## 3. `Badge dot` discards its children — WITHDRAWN, this is intended

**What I was building.** A "Pagó" / "Pendiente" indicator per person on the
roster. I wanted the little status dot _and_ the label:

```tsx
<Badge variant="info" dot>
  Pagó
</Badge>
```

**What happened.** Renders `<span class="sm-badge sm-badge--info sm-badge--dot"></span>`
— completely empty. The word "Pagó" is gone from the DOM. No warning.

`BadgeProps` extends `HTMLAttributes<HTMLSpanElement>`, so `children` is a
perfectly legal prop next to `dot`, and TypeScript is happy. The component just
drops it.

**What I did instead.** Dropped `dot` and used `variant` + `soft` to carry the
status distinction. Cost: minutes, not hours — but I only caught it because I
happened to be reading the a11y tree of the smoke page. On a real roster this
would have shipped as "the badges are mysteriously blank".

**What I would have wanted.** Either render the dot _as a prefix to_ the
children (which is what `dot` means in every other design system I have used),
or make the types express the exclusion — `dot` and `children` as a discriminated
union — so it fails at compile time instead of at runtime. Silently discarding
passed-in content is the worst of the three options.

---

## 4. `Button loading` hardcodes English — FIXED in 0.20.0

```html
<span class="sm-button__sr-only">Loading…</span>
```

**What I was building.** An entirely Spanish (es-CO) app. Every user-facing
string in this project lives in one `copy.ts` module, by design.

**What happened.** Every submit button in a pending state announces "Loading…"
in English to screen-reader users. There is no prop to change it. `ButtonProps`
has no `loadingLabel`, and the string is not read from a CSS custom property or
a context either, so there is no escape hatch at all.

The inconsistency is what makes it sting: **`Spinner` has exactly the right
API** — `label?: string` overriding the SR text. `Button` renders a spinner and
doesn't expose it.

**What I did instead.** Nothing available. The English string ships. For the
one place it mattered most I used `<Spinner label={…}>` next to a disabled
Button rather than `Button loading`.

**What I would have wanted.** `loadingLabel?: string` on `ButtonProps`,
defaulting to `"Loading…"`. Two lines. Alternatively a
`<StackmythProvider locale>` / strings-context for the handful of built-in
strings across the stack — but a prop would have been enough here.

---

## 5. `Select` cannot participate in native form submission — FIXED in 0.20.0

**What I was building.** The create-event form (event kind, cost mode) as a
plain `<form action={serverAction}>`, which is the idiomatic Next.js App Router
pattern and the one that degrades gracefully.

**What happened.** `SelectTrigger` renders `<button type="button" role="combobox">`
and `SelectContent` renders through a **portal to `document.body`**. There is no
hidden `<input>` anywhere:

```js
document.querySelectorAll("input[type=hidden]"); // → []
```

So the selected value is invisible to `FormData` — the field simply doesn't
appear in the submission. Because the portal moves the content out of the
`<form>` subtree, even a manual input inside `SelectContent` wouldn't help.

Notably **`RadioGroup` gets this right**: it renders real
`<input type="radio" name={name}>` elements and submits natively. So the stack
clearly knows the pattern; `Select` just doesn't do it.

**What I did instead.** First a wrapper that composed `Select` with a sibling
`<input type="hidden">`. Later, once the forms adopted `FormController`, the
hidden input disappeared: submission no longer goes through native `FormData`,
so the value only has to reach the form store, which `store.setValue(name, …)`
does directly. `src/components/select-field.tsx` is now ~20 lines with no
hidden field at all.

Worth stating plainly: **adopting `@stackmyth/form` is what made this gap
survivable.** A consumer who wants a Select in a plain server-action form,
without the form library, still has to hand-roll the mirror.

**What I would have wanted.** A `name` prop on `Select` that renders the hidden
input for you — exactly what Radix, React Aria and every headless select does.
`SelectProps` has `id` but not `name`, which reads like an oversight rather than
a decision.

---

## 6. `Alert` is an assertive live region unconditionally — FIXED in 0.20.0

**What I was building.** A static, always-present notice on the participant
page: "this event is closed" / "you're on the waitlist". Informational, not
urgent, rendered on load.

**What happened.** `Alert` always renders `role="alert"` +
`aria-live="assertive"` + `aria-atomic`. Confirmed in the a11y tree. Assertive
live regions **interrupt** a screen reader mid-sentence. For content that is
part of the page on arrival, that is the wrong behaviour — it is what
`role="status"` / `aria-live="polite"`, or no live region at all, is for.

**What I did instead.** Used `Alert` where the message really is a response to
an action, and a `Card surface="outlined"` with a `TriangleAlertIcon` for the
static notices. The visual result is fine; I just couldn't use the component
built for it.

**What I would have wanted.** `live?: "assertive" | "polite" | "off"` on
`AlertProps`, defaulting to the current behaviour so nothing breaks. A static
alert and a toast are genuinely different components in a11y terms and this one
only models the second.

---

## 7. Everything is `"use client"`, including pure presentation

> **Status: FIXED in 0.22.0** for every package where it is true to fix.
> Thirteen pure-presentation packages (aspect-ratio, button, empty-state,
> kbd, label, layout, mark, progress, scroll-area, skeleton, spinner, stat,
> timeline) ship directive-free — verified: installed `layout` and `button`
> bundles open with a plain import. Genuinely interactive packages (Card
> holds state, Text/Badge emit on the event bus) keep the boundary, which is
> the correct split rather than a limitation. A CI check now imports every
> directive-free bundle under `--conditions=react-server`, so the guarantee
> cannot silently regress.

All 20 installed packages begin their bundle with `"use client"` — verified
across every one. That includes `Text`, `Box`, `Card`, `Badge`, `Divider`,
`Stat`, `EmptyState`: components that render a `<div>` with a class name and
have no state, no effects and no event handlers.

**Impact here.** Not blocking — a Server Component can render a Client
Component, so my pages still server-render and the data still comes from the
server. But the entire visual layer of every page hydrates, on an app whose
users are on phones on Colombian mobile data. For a roster that is fundamentally
static HTML, that is all downside.

**What I did instead.** Accepted it. There is no opt-out.

**What I would have wanted.** Split the directive per module rather than
per-bundle, so that `Text`/`Box`/`Card`/`Badge`/`Stat`/`Divider` stay RSC-safe
and only the genuinely interactive components (`Select`, `Dialog`, `Switch`,
`RadioGroup`, `Combobox`) carry the boundary. This is the single highest-value
change on this list for anyone using the stack with the App Router.

---

## 8. `Container` and `Section` don't accept `LayoutProps`

> **Status: FIXED in 0.22.0.** `Container` and `Section` accept the full
> `LayoutProps` set; `size` keeps its meaning and explicit props layer on
> top. Every page in this app dropped the wrapper: `px`/`py` now live on
> `Container` and the inner `Stack` keeps only the job it always really had
> (`gap`).

Minor but repeatedly annoying. `Box`, `Flex`, `Stack`, `Grid` and `GridItem` all
accept the shared ~90-prop `LayoutProps` set. `Container` accepts only
`size: "1"|"2"|"3"|"4"` and `Section` only `size: "1"|"2"|"3"` — no `px`, no
`py`, no `maxWidth`.

Since `Container` is the outermost element of every page, and every page needs
horizontal padding on a 390px viewport, **every single page in this app is
`<Container><Stack px="4" py="6">`** — an extra element that exists purely to
hold padding the container should have taken.

**What I would have wanted.** `LayoutProps` on `Container` and `Section` too.
They are layout components; the asymmetry is surprising and there's no obvious
reason for it.

---

## 9. `--sm-<status>-text` is an on-fill color, and nothing says so

> **Status: FIXED in 0.22.0** — option 2, plus the documentation half of
> option 1. New `--sm-<state>-accent` tokens carry the state hue safely on
> the default surface (defined through the soft-text pair, so dark mode and
> custom themes inherit correct values), and the `-text` tokens are now
> explicitly documented as on-fill colors. Verified in the installed
> `core.vars.css`. `Notice`'s icon in this app now uses the accents. The
> `--sm-info-bg`/`--sm-info-on-bg` rename (option 1's naming) remains
> undone — that one is breaking and was never going to ride a minor.

**What I was building.** A static notice ("this event is closed", "10 spots
left") with a small tone-coloured icon on the normal page surface.

**What happened.** Two failures in a row, both from the same misunderstanding.

First I used `<Card tone="info">`. That sets a _saturated fill_
(`--sm-card-bg: var(--sm-info)`) plus a matching text color via
`--sm-card-text`. But `--sm-card-text` loses to any nested `<Text color="…">`,
so my perfectly ordinary `<Text color="muted">` body copy landed as grey on
saturated blue — unreadable. The card and the text component each did something
reasonable; together they produced a contrast failure.

So I dropped the fill and painted just the icon with
`color: var(--sm-info-text)` — the obvious token name for "the info color". The
icon vanished. `--sm-info-text` is `#fff` in the default theme, because it is
the color to use **on top of** the `--sm-info` fill, not an accent for the page
surface. White icon, white background, no error.

The naming gives no hint of this. `--sm-info` / `--sm-info-text` reads like
"the info color" / "the info text color", not "background" / "foreground for
that background". `--sm-info-soft` / `--sm-info-soft-text` are the same pairing
one shade down; there is no token in the set that means "the info hue, safe on
the default surface".

**What I did instead.** Neutral `Card surface="outlined"`, with the tone carried
entirely by the icon using **Text's own** semantic colors (`color="error"` /
`color="muted"`), which are defined against the page surface and therefore
safe. Cost: two wrong attempts and a screenshot diff to notice the second one,
because an invisible icon looks a lot like a layout bug.

**What I would have wanted:**

1. Name the pairs so the relationship is legible — `--sm-info-bg` /
   `--sm-info-on-bg` rather than `--sm-info` / `--sm-info-text`. The current
   names actively suggest the wrong usage.
2. Ship an on-surface accent per status (`--sm-info-accent`) for exactly this
   case: icons, borders and small emphasis on the default background. Every
   design system needs one and this set doesn't have it.
3. Make `tone` on Card set the text color in a way that composes with `Text`,
   or document that `Text color` must be omitted inside a toned Card. As it
   stands the two components silently disagree and the user finds out by
   looking.

---

## 10. No primitive for a `<form>` element

> **Status: FIXED in 0.22.0.** `@stackmyth/form` ships a `Form` component:
> a real `<form>` wired to the nearest `FormController` through context,
> submitting via the store and falling back to the controller's
> `onSubmit`/`onInvalid` exactly like `handleSubmit()` with no arguments.
> `noValidate` defaults to true (the resolver is the validator), and
> rendering it outside a controller throws at first render. All four forms
> in this app dropped the render-prop dance for `<Form onValid={submit}>`.

The one honest boundary of "build everything from Stackmyth" — and it is
narrower than I first wrote.

**`<form>`.** `@stackmyth/form` is a client-side form-state library (`useForm`,
resolvers, `FormField` render-props); its own tests and JSDoc write
`<form onSubmit={handleSubmit()}>`, so the raw element is what the stack
expects you to supply. `handleSubmit` returns a `FormEventHandler` that has to
be attached to something, and that something can only be a `<form>`.

**`<input type="hidden">` — no longer needed.** My first pass had seven of
them, all mirroring values out of components that could not submit natively.
Adopting `FormController` removed every one: submission goes through the form
store rather than native `FormData`, so a value only has to reach
`store.setValue()`. The app now has **zero** hidden inputs.

**What I would have wanted.** `<Box as="form">` working would be enough, but
`BoxProps` carries anchor and button attributes and not
`action`/`method`/`noValidate` — the one element type a form library needs is
the one `Box` cannot render. Failing that, a sentence in the README saying
`<form>` is expected to stay native, so consumers stop looking for a component
that was never intended to exist.

---

## 11. `DatePicker`'s hidden value is a UTC instant, which is lossy for a date — FIXED in 0.21.0

> **Status: FIXED in 0.21.0, which this app now consumes.** `de12d8db` in the
> Stackmyth repo adds exactly the opt-in this entry asked for:
> `valueFormat="date"` submits the local calendar day as `YYYY-MM-DD`, while
> the default stays `"iso"` — byte-for-byte what existing forms submit, which
> is what let it ship as a minor. Verified in the installed 0.21.0 artifact.
> This app's composed date field stays regardless: it
> pairs a date with a `TimePicker` and stores two wall-clock parts, which a
> date-only control does not model.

`DatePicker` and `TimePicker` both accept `name` and — unlike `Select`, gap #5 —
render their own hidden input, so they submit natively. Good. But the date one
submits `value.toISOString()`.

The `Calendar` inside builds **local midnight** for the day you tap. Converting
that to UTC is fine for a Colombian user (midnight −05:00 → 05:00Z, same day)
and wrong for anyone east of UTC: a user in Tokyo tapping 13 August submits
`2026-08-12T15:00:00Z`, and a server reading that instant in America/Bogota
gets **12 August**. The event silently moves a day for travellers.

**What I did instead.** Kept the wall-clock day: the field emits `YYYY-MM-DD`
built from `getFullYear/getMonth/getDate`, and the server joins it with the
`HH:mm` from `TimePicker` and resolves the real Bogota offset. `TimePicker`'s
own `name` is safe to use as-is, because it submits the raw `"HH:mm"` string
with no timezone to get wrong.

**What I would have wanted.** A date-only serialisation (`YYYY-MM-DD`) for a
date-only picker, or a `valueFormat` prop. `toISOString()` on a value that has
no time component is a category error — it invents a time and then reinterprets
the date through it.

---

## 12. `DatePicker`'s `locale` never reaches the `Calendar` inside it — FIXED in 0.20.0

**What I was building.** The event date field, in a Spanish (es-CO) app.

**What happened.** I passed `locale="es-CO"` to `DatePicker`, which has exactly
that prop. The trigger label localised correctly. The calendar that opens did
not: **"July 2026", "Su Mo Tu We Th Fr Sa"**, week starting Sunday.

The prop is documented as _"Locale for the formatted label"_ and is used in one
place — the `Intl.DateTimeFormat` for the trigger text. `Calendar` has its own
`locale` prop, defaulted to `"en-US"`, and `DatePicker` never forwards to it.
There is no `calendarProps`, no children, no other way through.

So a `DatePicker` in any non-English app shows an English calendar, and the prop
that looks like it should fix that only fixes half the component.

**What I did instead.** Dropped `DatePicker` and composed the same thing from
`Popover` + `Calendar` + `Button` — about 30 lines, and `Calendar` accepts
everything needed: `locale`, `weekStartsOn={1}` (Colombia starts on Monday),
`timezone`, `fromDate`. Composing from primitives is the documented escape
hatch, so this is a fine outcome; it just should not have been necessary.

**What I would have wanted.** `DatePicker` forwarding `locale` (and
`weekStartsOn`, `timezone`) to its `Calendar`, or accepting a
`calendarProps` passthrough. One line either way.

**Related, same family:** `TimePicker`'s internal ARIA labels are hardcoded
English — `"Hour"`, `"Minute"`, `"Period"`, `"Clear time"`, `"Select time"` —
with no props to override them, exactly like `Button loading` in gap #4.
`placeholder` is overridable; the labels a screen-reader user actually hears are
not.

---

## 13. `Button asChild` reports a hydration mismatch under `next dev`

> **Status: RESOLVED in 0.22.0** the way this entry itself asked —
> awareness, not API. The `asChild` prop's JSDoc now documents the warning
> as a dev-only HMR artifact and tells the reader not to rewrite working
> compositions to chase it. Verified in the installed `button.d.ts`.

Minor, and **not** a production problem — recorded because it cost time to
chase and the next person will hit it too.

After a hot reload, `next dev` logs a hydration mismatch for any
`<Button asChild>` subtree: the server renders the Slot-merged
`className="sm-button …"` and the client renders `className={null}`.

I initially assumed my `Box as="a"` child was to blame and swapped it for a
plain `<a>`. **That was wrong** — the warning appears for both. A production
build (`pnpm build && pnpm start`) renders the merged classes identically on
both sides, applies the styles, and logs nothing at all. So it is an HMR
artifact in `Slot`'s clone path, not a real mismatch.

**What I would have wanted.** Nothing in the API. Just awareness that this
warning is noise, because the obvious reading — "my composition is wrong" —
sends you rewriting perfectly good code.

---

## 14. Small things, no workaround needed

> **Status: FIXED in 0.22.0** for the two actionable items. `Stack` accepts
> `"column"`/`"row"` as aliases of its own vocabulary (responsive objects
> included) — verified in the installed types — and `SelectTrigger` warns in
> development when rendered without a `SelectValue` child, so the
> blank-trigger mistake announces itself. `@stackmyth/toast` remains
> uninstalled here by choice; the `datetime-local` note was praise.

- **`Stack direction` is `"vertical" | "horizontal"`, `Flex direction` is
  `"row" | "column"`.** Two sibling components, two vocabularies for the same
  axis. I typed `direction="column"` into a `Stack` on reflex more than once;
  TypeScript catches it, but it is a papercut on every use.
- **`Select` needs `SelectValue` for the trigger to show anything.** Reasonable
  in hindsight (it mirrors Radix), but `<SelectTrigger>Partido</SelectTrigger>`
  silently renders an empty trigger. The required-slot info is in the manifest
  (`slots.select.accepts`) but not in the types.
- **No `Toaster`/`toast` in the packages I installed**, though `@stackmyth/toast`
  exists in the registry with 1 export. I used inline `Alert`s instead — fine
  for this app, worth knowing before designing around toasts.
- **`Input type="datetime-local"` works and styles correctly**, including with a
  `prefix` icon. Verified at 390px. Genuinely nice; noting it because it is the
  kind of thing that is usually broken.

---

## 15. No `reValidateMode`, and `mode` cannot be changed at runtime — FIXED in 0.20.0

`FormController` takes one `mode`: `"onChange" | "onBlur" | "onSubmit"`. The
usual want is two — validate nothing until the first submit, then re-validate
per field so a corrected error clears as the user types. That is what
react-hook-form calls `reValidateMode`, and there is no equivalent here.

`"onSubmit"` gets the first half right and leaves the second broken in a way
users notice: after a failed submit the red messages sit there while you fix
the field, and only refresh when you press the button again.

The escape hatch does not exist either. `FormStore.mode` is
`private readonly` in the published types, so it cannot be swapped after the
first submission:

```ts
// form-store.d.ts
private readonly mode;
```

Mutating it through a cast would work at runtime and reach into a library
private, which is not worth a minor-version surprise.

**What would fix it:** a second optional prop, defaulting to the first.

```tsx
<FormController mode="onSubmit" reValidateMode="onChange" />
```

---

## 16. The published inventory is not discoverable from what is installed

> **Status: FIXED in `@stackmyth/manifests` 0.2.0** — option 1. The
> manifests package now IS the meta-package this entry asked for: every
> published package and component, with real prop data (see #2). The
> registry-probe mitigation in STACKMYTH-NOTES.md is retired for discovery,
> though it remains the honest way to check what exists at a version you
> have not installed.

This one is on me, but the shape of the library is what made it possible, and
it cost real work.

`STACKMYTH-NOTES.md` was built by reading the `.d.ts` files of the packages in
`node_modules`. That enumerates what is **installed**, not what **exists** — and
`package.json` was seeded with an initial guess. Ten packages were therefore
invisible for the whole build:

```
input-group  file-upload  checkbox  combobox  tabs  tooltip
toast        slider       pagination  breadcrumb  table  data-table
```

Two of them had already been worked around in code. The amount field used
`<Input prefix="$">` where `InputGroup` exists, and the receipt upload used a
bare `<input type="file">` under a comment asserting "the library has no file
field" — which was simply false. A gap log is worse than useless when it records
absences that are not real.

`@stackmyth/manifests` looks like it should be the answer and is not: it is
stale and mostly empty (gap #2), and `require()`ing it yields no exports at all.
There is no index package, no `@stackmyth/all`, and the registry cannot be
listed by scope over plain npm — the only reliable method turned out to be
guessing names and probing:

```bash
pnpm view @stackmyth/input-group version   # 0.19.1 — exists, was never installed
pnpm view @stackmyth/number-input version  # 404 — does not
```

**What would fix it:** any one of these, in order of usefulness.

1. A meta-package — `@stackmyth/all` or a populated `@stackmyth/manifests` —
   that lists every published package and its components.
2. A component index in the Storybook that maps component → package name, so
   somebody reading the docs learns which dependency to add.
3. Peer-dependency hints, so installing `@stackmyth/form` at least mentions the
   field-level packages that pair with it.

Until one exists, the discovery step has to start from the registry rather than
from `node_modules`.

---

## 17. `DropdownMenuItem` cannot become a link

> **Status: open at 0.22.0.** `DropdownMenuItemProps` extends
> `HTMLAttributes<HTMLDivElement>` with `disabled`, `inset`, `destructive` and
> `onSelect` — no `asChild`. Verified in the installed `dropdown-menu.d.ts`.

**What I was building.** The account menu behind the profile pill on
`/my-events`: my profile, language, appearance, sign out. Three of those four
are actions. One — "my profile" — is navigation.

**What happened.** `DropdownMenuItem` renders a `<div role="menuitem">` and
exposes no `asChild`, so there is no anchor to give an `href` to. The
asymmetry is inside the same package: **`DropdownMenuTrigger` has `asChild`**
(it is how the pill wraps a `Button`), and the item next to it does not.

The workarounds are both worse than a link:

1. `onSelect={() => router.push(…)}` — what this app does. Works, and loses
   everything an anchor gives for free: cmd/middle-click to open in a new tab,
   the destination in the status bar, "copy link address", and the browser's
   own handling if JavaScript has not loaded.
2. Nesting an `<a>` inside the item — two overlapping click targets for one
   action, and a `menuitem` whose accessible child is a `link`.

**What I would have wanted.** `asChild` on `DropdownMenuItem`, exactly as on
`DropdownMenuTrigger`. The Slot machinery is already in `@stackmyth/core` and
already used one component away.

**Not just this component.** Reading the manifests for the packages this app
touches, `asChild` exists on `Button` and `DropdownMenuTrigger` and nowhere
else — `ContextMenu`, `NavigationMenu`, `ListItem`, `Tabs` and `Command` all
render fixed elements too. Menus and navigation lists are _where links live_,
so this reads less like an oversight in one component than like a prop that
was added where it was first needed and never generalised.

---

## 18. `--sm-dialog-header-gap` is two measurements under one name

> **Status: open at 0.24.6.** `.sm-dialog-header` uses the token as its flex
> `gap`, and the bordered variants use the same token as `padding-bottom`.
> Verified in the installed `dialog.css`.

**What I was building.** The account drawer's header: an avatar beside a name
and an email, above a rule, with the panel body under it.

**What happened.** The header holds two rows, and there are two different
distances in it — the space _between_ the name and the email, and the space
_under_ the email before the rule. Both read from `--sm-dialog-header-gap`,
which is `0.375rem`. That is right for the first and much too small for the
second: with the panel's own padding at `1.25rem`, the header had 1.25rem of
air above the avatar and 0.375rem below the address, so the rule looked like
something the email was resting on rather than a boundary under a block.

Raising the token fixes the margin and breaks the pairing: name and email
drift apart to buy space that has nothing to do with them. So the app sets
`padding-block-end` on the header directly — reaching past the token to the
property it feeds, which is exactly what a token is supposed to prevent.

**What I would have wanted.** A second token, `--sm-dialog-header-padding-end`
(defaulting to `--sm-dialog-header-gap`, so nothing changes for anyone who
does not set it). The gap between a header's own lines and the gap between a
header and what follows it are not the same measurement and do not scale
together — a header with one line has the second distance and not the first.

**Where this pattern repeats.** Worth a sweep rather than a patch: any
component whose internal rhythm and outer separation share a token has the
same latent conflict. `--sm-dialog-content-gap` looks like the next one.

---

## What worked well, unprompted

Stating this because a gaps file that is only complaints is not honest feedback.

- **The `.d.ts` files are the best part of the stack.** Rich JSDoc on nearly
  every prop, real defaults, tables in comments (the `zIndex` token table),
  `@example` blocks. I built the entire app from them without reading a single
  page of prose documentation.
- **`LayoutProps` is unusually complete.** Responsive objects
  (`px={{ base: "4", md: "8" }}`) on ~90 props, semantic `background`/`border`
  tokens, and `colorScheme="dark"` to flip an entire subtree — I never once
  needed a raw style attribute for layout.
- **The token system is coherent.** 278 well-named custom properties, and a
  default palette that ships working light _and_ dark with zero configuration.
  This app has no theme file and no dark-mode code, and dark mode works.
- **The compound-component APIs** (`Card`, `Dialog`, `Field`, `List`, `Select`)
  are consistent with each other and with prevailing convention, so the second
  one costs nothing to learn.
- **`Field` wires accessibility correctly** — `id`, `aria-describedby`,
  `aria-invalid` propagate to the control and description without being asked.
  The a11y tree of the smoke page came out clean on the first try.
- **`Button asChild`** made `next/link` integration a non-event.
