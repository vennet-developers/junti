# Stackmyth — what is actually installed and how to use it

This file is the contract for the UI layer. It was written by reading the
installed packages, not from memory or documentation.

> **Correction.** "Installed" was the wrong ground truth, and this file said the
> opposite of what it should have for most of the build: _if a component is not
> in this file, it does not exist for this project_. It does not follow. The
> registry publishes packages this project had simply never added, and two of
> them had already been worked around in code — `InputGroup` (the amount field)
> and `FileUpload` (the receipt upload, under a comment asserting no file field
> existed). **Before concluding that Stackmyth lacks something, probe the
> registry, not `node_modules`:**
>
> ```bash
> pnpm view @stackmyth/<guess> version   # a version means it exists
> ```
>
> See STACKMYTH-GAPS.md #16.

Ground truth, in order of authority:

1. `node_modules/@stackmyth/<pkg>/dist/*.d.ts` — exact prop signatures.
2. `node_modules/@stackmyth/<pkg>/dist/*.css` — the class names and tokens.
3. `node_modules/@stackmyth/<pkg>/package.json` — the `exports` map.
4. `@stackmyth/manifests` — **stale, do not trust for props.** See
   STACKMYTH-GAPS.md.

Verified against: `@stackmyth/*` **0.19.1** (`icons` and `classnames` are on
`0.1.0`, `manifests` on `0.1.0`), React 19.2.4, Next.js 16.2.12.

**29 packages installed.** UI: `core` `layout` `text` `button` `input`
`input-group` `textarea` `label` `field` `select` `radio-group` `switch`
`checkbox` `file-upload` `card` `badge` `alert` `dialog` `popover` `list-item`
`empty-state` `stat` `progress` `spinner` `skeleton` `calendar` `time-picker`.
Plus `form` (validation) and `icons`. `manifests` is a devDependency only.

**Published but not installed**, verified to exist at `0.19.1` — add them rather
than working around them: `combobox` `tabs` `tooltip` `toast` `slider`
`pagination` `breadcrumb` `table` `data-table`.

Probed and confirmed **not** to exist: `number-input`, `menu`, `drawer`,
`separator`, `form-field`, `upload`.

---

## 1. Installation and registry

Every `@stackmyth/*` package is published **privately to GitHub Packages**, not
npmjs. Installing requires an `.npmrc` scope mapping plus a token with
`read:packages`:

```ini
@stackmyth:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

This is a hard prerequisite for a fresh clone. It is documented in README.md
under "Prerequisites".

## 2. CSS wiring

**One import per package.** Since 0.22.0 each `<name>.css` inlines the custom
properties it consumes, so a single import per package is all you need:

```ts
import "@stackmyth/core/core.vars.css"; // 1. base tokens + reset + dark mode
import "@stackmyth/core/fonts/geist.css"; // 2. self-hosted font, sets --sm-font-family
import "@stackmyth/layout/layout.css"; // 3. one per package, any order
// … one per package …
```

`core` stays separate because it is a tokens-only package — it ships
`core.vars.css` with the 278 global properties and no rules file of its own,
so it must come first.

**History worth knowing** (it explains the shape of older code and of
STACKMYTH-GAPS.md #1): before 0.22.0 every package shipped its rules and its
tokens as two files and you needed both. Importing only `<name>.css` produced
a page where colors and borders looked right but **every gap, padding and
margin silently collapsed to zero**, with no console warning — the rules are
written `gap: var(--sm-space-5)` and an undefined custom property invalidates
the whole declaration. The `<name>.vars.css` files still ship and still work;
importing both is harmless, just redundant.

Subpath exports that exist on every UI package:

```jsonc
"./*.css":        "./dist/*.css"
"./styles/*.css": "./dist/*.css"
```

`@stackmyth/core` additionally exposes `./themes/*.css` and `./fonts/*.css`.

## 3. Theming

`core.vars.css` defines a complete **neutral** palette on `:root` _and_ a
`@media (prefers-color-scheme: dark)` block. Light and dark therefore both work
with **no theme file and no network requests**.

Optional themes live at `@stackmyth/core/themes/<name>.css` —
`corporate`, `graphite`, `monochrome`, `cursor`, `anthropic`, `perplexity`,
`amplemarket`. They activate via attributes on `<html>`:

- `data-theme="corporate"` — selects the palette
- `data-mode="dark"` / `data-mode="light"` — pins the mode (otherwise follows OS)

Each theme file `@import`s a Google Fonts URL. This project uses **no theme
file** (see DECISIONS.md) and the self-hosted `fonts/geist.css` instead, so the
app makes zero third-party requests.

Self-hosted fonts available under `@stackmyth/core/fonts/`: `geist`, `inter`,
`dmsans`, `ibmplexsans`, `ibmplexserif`, `jetbrainsmono`, `lato`,
`googlesanscode`, `all`.

## 4. Design tokens

278 custom properties in `core.vars.css`. Use these exclusively — no literal hex
colors, no arbitrary spacing, no one-off font sizes.

**Spacing** (from `layout.vars.css`): `--sm-space-0` … `--sm-space-9`
(`0, 4, 8, 12, 16, 20, 24, 32, 48, 64` px). Layout components take these as the
string scale `"0"`–`"9"`; `Stack`/`Flex` `gap` additionally accepts the semantic
aliases `"none" | "xs" | "sm" | "md" | "lg" | "xl"`.

**Surfaces / text / borders**
`--sm-bg-surface`, `--sm-bg-surface-raised`, `--sm-text-primary`,
`--sm-text-secondary`, `--sm-text-inverse`, `--sm-border-default`,
`--sm-border-subtle`, `--sm-border-focus`, `--sm-border-interactive`.

**Semantic status** — each has a base, `-text`, `-soft` and `-soft-text` variant:
`--sm-primary`, `--sm-secondary`, `--sm-accent`, `--sm-success`, `--sm-warning`,
`--sm-error`, `--sm-info`.

**Type scale** `--sm-font-size-xs|sm|md|lg|xl` = 12/13/14/15/16px.
**Line height** `--sm-leading-tight|snug|normal|relaxed`.
**Tracking** `--sm-tracking-tight|snug|normal|wide|wider`.
**Radius** `--sm-radius-sm|md|lg`.
**Shadow** `--sm-shadow-sm|md|lg|overlay|interactive`.
**Z-index** `--sm-z-base|sticky|dropdown|popover|modal-backdrop|modal|tooltip|toast`.
**Easing** `--sm-ease-out-strong`, `--sm-ease-in-out-strong`, …

## 5. Server vs client components

**Since 0.22.0 the split is real.** Packages whose components are pure
presentation ship without a `"use client"` directive, so a Server Component
renders them with no hydration at all:

```
aspect-ratio  button  empty-state  kbd     label     layout   mark
progress      scroll-area  skeleton  spinner  stat    timeline
```

Everything else keeps the directive because it genuinely needs it — `Card`
holds state, `Text` and `Badge` emit on the event bus, `Select`/`Dialog`/
`Popover` are interactive by definition. Consequences either way:

- A Server Component **may** render any of them; Next.js inserts the boundary
  for the ones that carry the directive.
- Props crossing that boundary must be serializable. Server action references
  are fine; closures are not.
- Verify rather than assume: `head -1 node_modules/@stackmyth/<pkg>/dist/index.mjs`.
  The library guards this with a CI check that imports every directive-free
  bundle under `--conditions=react-server`.

---

## 6. Component reference — verified props only

Props below are copied from the `.d.ts`. `*` marks required.

### Layout — `@stackmyth/layout`

All of `Box`/`Flex`/`Stack`/`Grid`/`GridItem`/`Container`/`Section` accept the shared `LayoutProps`
set (~90 props): `p px py pt pr pb pl`, `m mx my mt mr mb ml` (scale `"0"`–`"9"`,
`mx` also `"auto"`), `width height minWidth minHeight maxWidth maxHeight`,
`background` (`surface | raised | overlay | none | black`), `border`
(`true | "top" | "bottom" | "left" | "right"`), `borderRadius`, `display`,
`position top right bottom left inset`, `zIndex` (token names or number),
`overflow`, `flexGrow flexBasis flexShrink order alignSelf justifySelf`,
`textAlign`, `colorScheme` (`"light" | "dark"` — flips tokens for a subtree),
`whiteSpace`, `wordBreak`, `boxShadow`, `opacity`, `transition`, `transform`,
`animation`, and more.

Any of them accept a **responsive object** `{ base, sm, md, lg, xl }`
(min-width 640/768/1024/1280).

| Component          | Own props                                                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Box`              | `as` (default `div`), `ref` + LayoutProps                                                                                                                                                                  |
| `Flex`             | `direction` `row\|column\|row-reverse\|column-reverse`, `align` `start\|center\|end\|baseline\|stretch`, `justify` `start\|center\|end\|between\|around`, `wrap` `nowrap\|wrap\|wrap-reverse`, `gap`, `as` |
| `Stack`            | `direction` `vertical\|horizontal` (**not** `row`/`column`), `align`, `justify` (adds `evenly`), `gap`, `wrap`, `dividers`, `inline`, `as`                                                                 |
| `Grid`             | `columns` `"1".."12" \| "auto-fit" \| "auto-fill" \| string`, `rows`, `autoRows`, `minChildWidth`, `gap`, `columnGap`, `rowGap`, `align`, `justify`, `autoFlow`                                            |
| `GridItem`         | `colSpan` (`number \| "full"`), `rowSpan`, `colStart`, `colEnd`, `rowStart`, `rowEnd`                                                                                                                      |
| `Container`        | `size` `"1" \| "2" \| "3" \| "4"` (max-width 448/688/880/1136px) + LayoutProps                                                                                                                             |
| `Section`          | `size` `"1" \| "2" \| "3"`, `as` + LayoutProps                                                                                                                                                             |
| `Divider`          | `orientation` `horizontal \| vertical`                                                                                                                                                                     |
| `Center`, `Spacer` | LayoutProps                                                                                                                                                                                                |

Also exported: `useBreakpoint`, `useBreakpointMin`, `useMediaQuery`,
`BREAKPOINTS`, `getLayoutStyles`, `getLayoutClasses`.

```tsx
<Container size="1" px="4" py="6">
  <Stack gap="lg">
    <Flex gap="2" wrap="wrap" align="center">
      …
    </Flex>
  </Stack>
</Container>
```

`Stack` also accepts `direction="column"`/`"row"` as aliases of its own
`"vertical"`/`"horizontal"`, so the Flex vocabulary typed on reflex works.

### Typography — `@stackmyth/text`

`Text`: `variant` `h1..h6 | p | lead | large | small | link` (also picks the
element), `as`, `color` `default | muted | error | primary`, `weight`
`normal | medium | semibold | bold`, `align`, `italic`, `strike`, `href`,
`target`, `rel`, `maxWidth`, `whiteSpace`, `textTransform`, `textDecoration`,
`fontSize`, `lineHeight`, `letterSpacing`, `fontFamily`, `htmlColor`.

```tsx
<Text variant="h1">Título</Text>
<Text variant="small" color="muted">Ayuda</Text>
```

### Button — `@stackmyth/button`

`variant` `primary | secondary | outline | ghost | link | destructive | info | success | warning`
· `size` `xs | sm | md | lg | xl` · `shape` `rect | square | circle` ·
`iconOnly` · `soft` · `loading` · `fullWidth` · `justify` `start|center|end` ·
`asChild` · plus all `<button>` attributes.

`asChild` renders the styles onto the single child — the way to style a
`next/link`:

```tsx
<Button asChild fullWidth size="lg">
  <Link href="/new">Crear un evento</Link>
</Button>
```

⚠️ `loading` injects a **hardcoded English** "Loading…" for screen readers with
no prop to override it. See STACKMYTH-GAPS.md.

### Forms

**`Field`** (`@stackmyth/field`) — `Field` (`orientation`, `invalid`,
`disabled`), `FieldLabel` (extends `LabelProps`, takes `htmlFor`),
`FieldDescription`, `FieldError`, `FieldGroup`. Also exports `useField()`.
`Field` wires `id`/`aria-describedby`/`aria-invalid` to its descendants.

**`Input`** (`@stackmyth/input`) — `size` `xs..xl`, `status`
`default | error | success | warning`, `fullWidth`, `prefix`, `suffix`
(ReactNode), `revealable`, `showSteppers`, `onNumericValueChange`, `textAlign`,
`mode` `default | tags` (+ `tagsValue`, `onTagsChange`, `separators`, `maxTags`,
`unique`, `renderChip`), plus all `<input>` attributes except `size`/`prefix`.

**`Textarea`** — `size`, `status`, `fullWidth`, `resize`
`none | both | horizontal | vertical`, `autoResize`.

**`Label`** — `disabled` + `<label>` attributes.

**`Select`** (`@stackmyth/select`) — compound and **controlled by value, not by
`<option>`**:

```tsx
<Select value={kind} onValueChange={setKind} id="kind">
  <SelectTrigger fullWidth size="lg">
    <SelectValue placeholder="Elige uno" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="match">Partido</SelectItem>
  </SelectContent>
</Select>
```

`Select`: `value`, `defaultValue`, `onValueChange`, `open`, `onOpenChange`,
`disabled`, `id`, `items` (`{label, value}[]` shorthand instead of children).
`SelectTrigger`: `size`, `status` `default|error`, `fullWidth`.
`SelectContent`: `container` (portal target). `SelectItem`: `value*`, `disabled`.
Also `SelectGroup`, `SelectLabel`, `SelectSeparator`, `SelectEmpty`.

⚠️ `SelectContent` renders through a **portal** and there is no hidden native
input, so a `Select` does **not** participate in native form submission. See
STACKMYTH-GAPS.md.

**`RadioGroup`** (`@stackmyth/radio-group`) — `RadioGroup` (`value`,
`defaultValue`, `onValueChange`, `name`, `orientation`, `disabled`) +
`RadioGroupItem` (`value*`, `size` `sm|md|lg`, `status`). `RadioGroupItem`
renders a real `<input type="radio">`, so it **does** submit natively when
`name` is set.

**`Switch`** — `size` `sm|md|lg`, `onCheckedChange`, + `<input>` attributes.

### Display

**`Badge`** (`@stackmyth/badge`) — `variant`
`default | secondary | outline | ghost | info | success | warning | error`,
`size` `sm|md|lg`, `soft`, `dot`, `pulse`, `interactive`, `removable`,
`onRemove`. `BadgeButton` adds `pressed`.

⚠️ `dot` **discards children** — `<Badge dot>Pagó</Badge>` renders empty. See
STACKMYTH-GAPS.md.

**`Card`** (`@stackmyth/card`) — `Card` (`surface`
`solid | outlined | elevated | ghost | glass`, `tone`
`brand | inverse | success | warning | error | info`, `radius` `sm..2xl`,
`orientation`, `interactive`, `maxWidth`, `padding`, `asChild`) with
`CardHeader`, `CardTitle`, `CardDescription`, `CardEyebrow`, `CardAction`
(`floating`), `CardContent` (`overMedia`), `CardFooter` (`surface="contrast"`),
`CardMedia`, `CardOverlay`, `CardDecoration`, `CardMeta`, `CardMetaItem`
(`icon`), `CardGrid` (`columns`, `gap`, `autoRows`) + `CardGrid.Item`.

**`List`** (`@stackmyth/list-item`) — `List` (`as` `ul|ol|dl|div`,
`orientation`, `divided`) with `ListItem` (`size` `sm|md|lg`, `interactive`,
`active`, `disabled`), `ListItemIcon`, `ListItemContent`, `ListItemTitle`,
`ListItemLabel`, `ListItemDescription`, `ListItemValue`, `ListItemAction`.

**`Stat`** (`@stackmyth/stat`) — `label*`, `value*`, `delta`
(`{value, format: "percent"|"absolute"|"raw", label}`). Both `label` and `value`
are `ReactNode`, so formatted currency goes straight in.

**`EmptyState`** (`@stackmyth/empty-state`) — `icon`, `title*`, `description`,
`action` (all ReactNode).

### Feedback

**`Alert`** (`@stackmyth/alert`) — `Alert` (`variant`
`default | destructive | success | warning | info`, `soft`) with `AlertTitle`,
`AlertDescription`, `AlertAction`, `AlertClose`. Renders `role="alert"`.

⚠️ `role="alert"` + `aria-live="assertive"` is applied unconditionally, so a
statically-rendered Alert interrupts screen readers on page load. See
STACKMYTH-GAPS.md.

**`Progress`** (`@stackmyth/progress`) — `value`, `max`, `variant`
`default | segmented | indeterminate`, `segments`, `color`, `showLabel`
`false | "above" | "floating"`, `aria-label`. Also `ProgressInfo`,
`ProgressSteps`/`ProgressStep`, `ProgressBreadcrumb`, `CircularProgress`,
`ProgressDots`.

**`Spinner`** — `size` `xs..xl`, `speed` `slow | normal | fast`, `label`
(overrides the SR text — unlike `Button loading`).

### Overlay

**`Dialog`** (`@stackmyth/dialog`) — `Dialog` (`open`, `defaultOpen`,
`onOpenChange`, `alert`), `DialogTrigger` (`asChild`), `DialogContent`
(`placement` `center|top|right|bottom|left`, `size` `sm|md|lg|xl|full`, `width`,
`height`, `inset`, `overlayBlur`, `container`), `DialogHeader` (`bordered`),
`DialogTitle`, `DialogDescription`, `DialogBody`, `DialogFooter` (`bordered`),
`DialogClose` (`asChild`). Portals to `document.body`; verified working at
390px.

### Icons — `@stackmyth/icons`

`IconProps`: `size` (number | string), `color`, `strokeWidth` + SVG props.
74 system icons, including the ones used here: `CopyIcon`, `CheckIcon`,
`CalendarIcon`, `ClockIcon`, `MapPinIcon`, `UserIcon`, `UserPlusIcon`,
`TrashIcon`, `PlusIcon`, `XIcon`, `AlertCircleIcon`, `CheckCircleIcon`,
`InfoIcon`, `TriangleAlertIcon`, `LockIcon`, `SendIcon`, `ArrowLeftIcon`.
Also ~88 country flags in `@stackmyth/flags` (not installed).

### Utility — `@stackmyth/core`

`cva`, `VariantProps`, `Slot`, `isSafeHref`, `devWarn`, `useIsMobile`,
`useOutsideClick`, `useKeyboardShortcut`, `storage`, `ActionProvider`.

---

### Forms — `@stackmyth/form`

The validation layer, used by all four data-entry forms. It does **not** submit
anything; it validates and holds state, and you decide what to do with the
result. That makes it compatible with server actions.

- `FormController` — `resolver`, `defaultValues`, `mode`
  (`"onChange" | "onBlur" | "onSubmit"`), `reValidateMode`, `onSubmit`,
  `onInvalid`. Children may be a render prop receiving
  `{ register, handleSubmit, formId }`; `handleSubmit(onValid?, onInvalid?)`
  returns a `FormEventHandler`, which you only need for a hand-rolled `<form>`.
- `Form` — the `<form>` element itself (0.22.0). Renders inside a
  `FormController` and submits through the store, falling back to the
  controller's `onSubmit`/`onInvalid`; `noValidate` defaults to true because
  the resolver is the validator. All four forms here use
  `<Form onValid={submit}>` instead of the render-prop shape.
- `FormField` — `name`, `label`, `description`, `rules`, plus a render prop
  giving `{ fieldProps, error, errors, isDirty, isTouched }`. `fieldProps`
  carries `id`, `name`, `onChange`, `onBlur`, `aria-invalid`,
  `aria-describedby` — spread it straight onto a Stackmyth `Input`/`Textarea`.
- `createZodResolver(schema)` — exported from the package root as well as
  `@stackmyth/form/resolvers/zod`. Structural typing, so Zod 3 or 4.
- `useFormContext()` → `{ formId, store }`. **This is the hook for controls
  that are not plain inputs.** `store.register(name)` (idempotent, safe during
  render) and `store.setValue(name, value)` are how `Select`, `RadioGroup` and
  the calendar get their values into the form.
- `useFieldErrors(name)` → `string[]`, for rendering a message next to a
  control that has no `FormField` wrapper.

⚠️ `store` reads an `<input type="number">` as a **number**, not a string. A
schema shared with the server (where `FormData` yields strings) must accept
both. See DECISIONS.md #29.

### Date and time — `@stackmyth/calendar`, `@stackmyth/time-picker`

`Calendar`: `mode` `single|range|multiple`, `selected`, `onSelect`, `locale`,
`weekStartsOn` (0–6), `timezone`, `fromDate`, `toDate`, `showOutsideDays`,
`markedDates`, `showMonthYearDropdown`, `numberOfMonths`, `disabled`.

`TimePicker`: `name` (renders its own hidden input — it _does_ submit
natively), `value`, `onValueChange`, `hourCycle` `12h|24h`, `minuteStep`,
`withSeconds`, `size`, `clearable`, `placeholder`. Its internal ARIA labels are
hardcoded English — see STACKMYTH-GAPS.md #12.

⚠️ **`DatePicker` is installed by neither this app nor this file's advice.** Its
`locale` only formats the trigger label — the `Calendar` inside stays `en-US` —
and its hidden value is `toISOString()`, which shifts the calendar day for
users east of Bogota. Compose `Popover` + `Calendar` instead; see
`src/components/date-time-field.tsx` and gaps #11 and #12.

### Feedback — `@stackmyth/skeleton`

`Skeleton`: `height`, `width`, `borderRadius` (all CSS strings) + div attributes.
Animates via `sm-skeleton-pulse`. Used by `src/components/roster-skeleton.tsx`,
which both `loading.tsx` files render.

---

## 7. Coverage audit — what is and isn't Stackmyth

Run against the whole of `src/`:

| Check                                     | Result                                                          |
| ----------------------------------------- | --------------------------------------------------------------- |
| Visible UI rendered by a raw HTML element | **none**                                                        |
| Hand-written CSS classes used in JSX      | **none**                                                        |
| Selectors in `globals.css`                | `html`, `body`, `:focus-visible`, `prefers-reduced-motion` only |
| Competing UI libraries installed          | none                                                            |

Reproduce it:

```bash
# Visible raw HTML in JSX — expect no output.
grep -rnE '<(div|span|p|a|ul|ol|li|table|section|h[1-6]|button|select|option|textarea|img|hr|label)\b' \
  --include='*.tsx' src/ | grep -v layout.tsx

# Hand-rolled classes — expect no output.
grep -rnE 'className="[^{]' --include='*.tsx' src/
```

### The irreducible remainder

**One element type**, in four places: `<form onSubmit={handleSubmit(...)}>`.

`@stackmyth/form`'s `handleSubmit` returns a `FormEventHandler<HTMLFormElement>`,
which can only be attached to a `<form>`. Stackmyth deliberately does not wrap
it — the library's own tests and JSDoc write the element by hand — so this is
what the stack expects you to supply, not a workaround. `<Box as="form">` is not
an option either: `BoxProps` carries anchor and button attributes but not
`action`/`method`/`noValidate`. Logged as gap #10.

Plus `<html>` / `<body>` in `layout.tsx`, which the framework requires.

**There are no hidden inputs.** An earlier pass had seven, mirroring values out
of `Select` and the date field so they would appear in `FormData`. Adopting
`FormController` deleted all of them: submission goes through the form store, so
a value only has to reach `store.setValue()`. The organizer's per-row buttons
call their server actions with bound arguments for the same reason.

Everything else — every button, badge, card, field, list row, stat, divider,
progress bar, dialog, calendar, time picker, popover, empty state, skeleton,
icon and piece of text — is a Stackmyth component.

---

## 8. Verified integration

`/stackmyth-smoke` renders one of each primitive above. Confirmed on a 390px
viewport with **zero console messages**: spacing, dark-mode tokens, portal
dialog, radio group, progress bar, and the a11y tree (labelled radios,
`progressbar`, `alert`, described textbox).
