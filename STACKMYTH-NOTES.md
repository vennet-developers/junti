# Stackmyth — what is actually installed and how to use it

This file is the contract for the UI layer. It was written by reading the
installed packages, not from memory or documentation. **If a component is not in
this file, it does not exist for this project.**

Ground truth, in order of authority:

1. `node_modules/@stackmyth/<pkg>/dist/*.d.ts` — exact prop signatures.
2. `node_modules/@stackmyth/<pkg>/dist/*.css` — the class names and tokens.
3. `node_modules/@stackmyth/<pkg>/package.json` — the `exports` map.
4. `@stackmyth/manifests` — **stale, do not trust for props.** See
   STACKMYTH-GAPS.md.

Verified against: `@stackmyth/*` **0.19.1** (`icons` and `classnames` are on
`0.1.0`, `manifests` on `0.1.0`), React 19.2.4, Next.js 16.2.12.

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

## 2. CSS wiring — the part that will bite you

**Every package ships two stylesheets and you need both:**

| File | Contains |
|---|---|
| `<pkg>/<name>.vars.css` | the CSS custom properties (`--sm-space-5`, …) |
| `<pkg>/<name>.css` | the rules that consume them |

Importing only `<name>.css` produces a page where colors and borders look right
but **every gap, padding and margin silently collapses to zero** — because the
rules are written `gap: var(--sm-space-5)` and the variable is undefined. There
is no console warning. This cost real debugging time; see STACKMYTH-GAPS.md.

Required import order, all in `src/app/layout.tsx`:

```ts
import "@stackmyth/core/core.vars.css";   // 1. base tokens + reset + dark mode
import "@stackmyth/core/fonts/geist.css"; // 2. self-hosted font, sets --sm-font-family
import "@stackmyth/layout/layout.vars.css";  // 3. every package's *.vars.css
// … one per package …
import "@stackmyth/layout/layout.css";      // 4. every package's *.css
// … one per package …
```

Subpath exports that exist on every UI package:

```jsonc
"./*.css":        "./dist/*.css"
"./styles/*.css": "./dist/*.css"
```

`@stackmyth/core` additionally exposes `./themes/*.css` and `./fonts/*.css`.

## 3. Theming

`core.vars.css` defines a complete **neutral** palette on `:root` *and* a
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

**Every `@stackmyth/*` bundle begins with `"use client"`.** Verified across all
20 installed packages. Consequences:

- A Server Component **may** render them (Next.js inserts the boundary), so
  pages stay server-rendered and only the component subtree hydrates.
- Props crossing that boundary must be serializable. Server action references
  are fine; closures are not.
- Purely presentational primitives (`Text`, `Box`, `Card`) are client components
  too, which is more JS than strictly needed. Logged in STACKMYTH-GAPS.md.

---

## 6. Component reference — verified props only

Props below are copied from the `.d.ts`. `*` marks required.

### Layout — `@stackmyth/layout`

All of `Box`/`Flex`/`Stack`/`Grid`/`GridItem` accept the shared `LayoutProps`
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

| Component | Own props |
|---|---|
| `Box` | `as` (default `div`), `ref` + LayoutProps |
| `Flex` | `direction` `row\|column\|row-reverse\|column-reverse`, `align` `start\|center\|end\|baseline\|stretch`, `justify` `start\|center\|end\|between\|around`, `wrap` `nowrap\|wrap\|wrap-reverse`, `gap`, `as` |
| `Stack` | `direction` `vertical\|horizontal` (**not** `row`/`column`), `align`, `justify` (adds `evenly`), `gap`, `wrap`, `dividers`, `inline`, `as` |
| `Grid` | `columns` `"1".."12" \| "auto-fit" \| "auto-fill" \| string`, `rows`, `autoRows`, `minChildWidth`, `gap`, `columnGap`, `rowGap`, `align`, `justify`, `autoFlow` |
| `GridItem` | `colSpan` (`number \| "full"`), `rowSpan`, `colStart`, `colEnd`, `rowStart`, `rowEnd` |
| `Container` | `size` `"1" \| "2" \| "3" \| "4"` only. **No LayoutProps** — wrap it or use the child for padding. |
| `Section` | `size` `"1" \| "2" \| "3"`, `as`. **No LayoutProps.** |
| `Divider` | `orientation` `horizontal \| vertical` |
| `Center`, `Spacer` | LayoutProps |

Also exported: `useBreakpoint`, `useBreakpointMin`, `useMediaQuery`,
`BREAKPOINTS`, `getLayoutStyles`, `getLayoutClasses`.

```tsx
<Container size="1">
  <Stack gap="lg" py="6" px="4">
    <Flex gap="2" wrap="wrap" align="center">…</Flex>
  </Stack>
</Container>
```

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

## 7. Verified integration

`/stackmyth-smoke` renders one of each primitive above. Confirmed on a 390px
viewport with **zero console messages**: spacing, dark-mode tokens, portal
dialog, radio group, progress bar, and the a11y tree (labelled radios,
`progressbar`, `alert`, described textbox).
