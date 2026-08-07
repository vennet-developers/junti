import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { DatePicker } from "@stackmyth/date-picker";
import { Input } from "@stackmyth/input";
import { Box, Container, Divider, Flex, Grid, Stack } from "@stackmyth/layout";
import { List, ListItem } from "@stackmyth/list-item";
import { Skeleton } from "@stackmyth/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@stackmyth/tabs";
import { Text } from "@stackmyth/text";
import { useState, useTransition } from "react";

import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { pageTitle } from "@/lib/page-title";
import { useCopy } from "@/components/copy-provider";
import type { Copy } from "@/config/copy";
import type { DirectoryQuery } from "@/domain/directory";
import type { DirectoryPage } from "@/lib/directory";
import { OverviewPanel } from "@/components/overview-panel";
import {
  CALENDAR_REPEAT_THRESHOLD,
  CALENDAR_SHARE_THRESHOLD,
  meetsGate,
} from "@/domain/calendar-gate";

/**
 * The funnel, as a page somebody can open.
 *
 * This is AC-4 of the analytics card: the two questions have to be answerable
 * "without engineering help", and with the events living in Postgres the only
 * honest reading of that is a screen with the numbers on it. Fixed queries
 * and one degree of freedom — the date range, because "cuánto dio ayer" and
 * "cuánto dio el mes" are the same fixed questions asked about different
 * days, not a reporting product.
 *
 * **Owner-only, and deliberately crude about it.** There is no admin role in
 * this product (see DECISIONS.md #56) and inventing one for a page of counts
 * would be the tail wagging the dog. The gate is the controller's own account
 * id, from an environment variable, and a 404 rather than a 403 for everybody
 * else — a page that says "forbidden" tells you it exists.
 *
 * Not in `ROUTES` on purpose, but no longer unlinked: the account menu shows
 * the owner — and only the owner — a plain anchor here. The menu flag is a
 * signpost; this loader's check remains the gate.
 */
const getFunnel = createServerFn({ method: "POST" })
  .validator(
    (data: { rango?: string; desde?: string; tipo?: string; q?: string; pagina?: string; estado?: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    const [
      { getOrganizer },
      { loadFunnel },
      { loadOverview },
      { resolveRange },
      { parseDirectoryParams },
      { loadDirectory },
    ] = await Promise.all([
      import("@/lib/organizer"),
      import("@/lib/funnel"),
      import("@/lib/overview"),
      import("@/domain/panel-range"),
      import("@/domain/directory"),
      import("@/lib/directory"),
    ]);

    const owner = process.env.ANALYTICS_OWNER_ID;
    const organizer = await getOrganizer();

    // Unset variable means nobody, not everybody. A missing secret must never
    // widen access.
    if (!owner || !organizer || organizer.id !== owner) throw notFound();

    // One resolver for the whole page, so both halves agree on what "the
    // period" is. Garbage in the URL resolves to the default view.
    const range = resolveRange(data, new Date());
    const directoryQuery = parseDirectoryParams(data);

    /*
      Sequential, not `Promise.all`. Both halves fan out internally, and running
      them together put roughly fourteen statements through a pool of five — see
      the note in `db/client.ts`, and the 500 that produced. This page is opened
      by one person and an extra second is invisible; a timeout is not.
    */
    const funnel = await loadFunnel(range);
    const overview = await loadOverview(range);
    const directory = await loadDirectory(range, directoryQuery);
    return { ...funnel, overview, directory, directoryQuery };
  });

/**
 * The directory alone, for interactions inside the Datos tab.
 *
 * Switching from Usuarios to Eventos through the page loader re-ran all
 * fourteen of the panel's queries to change a twenty-row list — Ivan timed
 * it at four seconds of nothing. This fn runs exactly one. The full reload
 * remains the right cost for the DATE chips, which change every number on
 * the page; it was never the right cost for a list.
 *
 * Re-checks the owner: it returns emails, and a server fn is a public
 * endpoint no matter which page calls it.
 */
const getDirectory = createServerFn({ method: "POST" })
  .validator(
    (data: { rango?: string; desde?: string; tipo?: string; q?: string; pagina?: string; estado?: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    const [{ getOrganizer }, { resolveRange }, { parseDirectoryParams }, { loadDirectory }] =
      await Promise.all([
        import("@/lib/organizer"),
        import("@/domain/panel-range"),
        import("@/domain/directory"),
        import("@/lib/directory"),
      ]);

    const owner = process.env.ANALYTICS_OWNER_ID;
    const organizer = await getOrganizer();
    if (!owner || !organizer || organizer.id !== owner) throw notFound();

    const range = resolveRange(data, new Date());
    const query = parseDirectoryParams(data);
    return { directory: await loadDirectory(range, query), query };
  });

export const Route = createFileRoute("/funnel")({
  /*
    Strings in, the same strings out, or undefined. Nothing here coerces or
    rewrites — the last date filter this app had put a number coercion in
    `validateSearch` and the router chased its own rewrite in a loop until the
    page froze. Interpretation happens exactly once, server-side, in
    `resolveRange`.
  */
  validateSearch: (
    search: Record<string, unknown>,
  ): { rango?: string; desde?: string; tipo?: string; q?: string; pagina?: string; estado?: string } => {
    const keep = (value: unknown) => (typeof value === "string" ? value : undefined);
    return {
      rango: keep(search.rango),
      desde: keep(search.desde),
      tipo: keep(search.tipo),
      q: keep(search.q),
      pagina: keep(search.pagina),
      estado: keep(search.estado),
    };
  },
  loaderDeps: ({ search }) => ({
    rango: search.rango,
    desde: search.desde,
    tipo: search.tipo,
    q: search.q,
    pagina: search.pagina,
    estado: search.estado,
  }),
  loader: ({ deps }) => getFunnel({ data: deps }),
  head: () => ({
    meta: [{ title: pageTitle("Funnel") }, { name: "robots", content: "noindex, nofollow" }],
  }),
  pendingComponent: FunnelPending,
  component: FunnelPage,
});

/**
 * The panel's own loading silhouette, replacing the generic three-block
 * `RoutePending` that resembled nothing on this page. Ivan's observation:
 * a skeleton that does not match what replaces it makes the swap read as a
 * SECOND load. This one traces the real layout — title, filter chips,
 * legend, tab bar, the four headline cards and the money row — so the data
 * lands into the shapes already on screen.
 */
function FunnelPending() {
  const pill = (width: string) => (
    <Skeleton width={width} height="2.09375rem" borderRadius="999px" />
  );

  return (
    <Container size="3" px="4" py="6">
      <Stack gap="6" aria-hidden="true">
        <Stack gap="2">
          <Skeleton width="8rem" height="34px" borderRadius="var(--sm-radius-md)" />
          <Skeleton width="24rem" height="16px" borderRadius="var(--sm-radius-sm)" />
        </Stack>

        <Stack gap="2">
          <Flex gap="2" wrap="wrap" align="center">
            {pill("8.5rem")}
            {pill("8rem")}
            {pill("4.5rem")}
            {pill("7.5rem")}
            {pill("10rem")}
            {pill("8.5rem")}
          </Flex>
          <Skeleton width="30rem" height="13px" borderRadius="var(--sm-radius-sm)" />
        </Stack>

        <Skeleton width="100%" height="56px" borderRadius="var(--sm-radius-lg)" animate="shimmer" />

        <Grid columns={{ base: "1", sm: "2", lg: "4" }} gap="3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              width="100%"
              height="150px"
              borderRadius="var(--sm-radius-lg)"
              animate="shimmer"
            />
          ))}
        </Grid>

        <Grid columns={{ base: "1", lg: "3" }} gap="3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} width="100%" height="140px" borderRadius="var(--sm-radius-lg)" />
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}

/**
 * The period every number on the page is filtered to.
 *
 * Plain anchors and a native GET form — deliberately no router `Link`, no
 * client-side navigation. The previous attempt at a date filter here froze
 * the page in a router rewrite loop, and an owner dashboard reloading whole
 * is a cost of nothing. The chips are the presets Ivan asked for; the date
 * input is "desde una fecha a hoy".
 */
function RangeFilter({
  range,
  copy,
}: {
  range: { preset: string; fromISO: string; toISO: string };
  copy: Copy;
}) {
  const p = copy.panel.range;
  const chips = [
    { href: "/funnel", label: p.last30, preset: "30d" },
    { href: "/funnel?rango=7d", label: p.lastWeek, preset: "7d" },
    { href: "/funnel?rango=ayer", label: p.yesterday, preset: "ayer" },
    { href: "/funnel?rango=24h", label: p.last24h, preset: "24h" },
  ];

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(copy.intlLocale, {
      day: "numeric",
      month: "short",
      timeZone: "America/Bogota",
    });

  /*
    Local getters, never toISOString: the calendar hands over local midnight,
    and converting through UTC would submit the previous day for anyone east
    of Bogota. Same reasoning as DateTimeField's toDateInputValue.
  */
  const asParam = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  return (
    <Stack gap="2">
      <Flex gap="2" wrap="wrap" align="center">
        {chips.map((chip) => (
          <Button
            key={chip.preset}
            asChild
            size="sm"
            shape="pill"
            variant={range.preset === chip.preset ? "primary" : "outline"}
          >
            <a href={chip.href}>{chip.label}</a>
          </Button>
        ))}

        {/* The library's own picker, not the browser's — the one control in
            this row that ignored the design system, and Ivan noticed.
            Choosing a day IS the action: it navigates like the chips do,
            full reload, because a date change moves every number on the
            page. */}
        <DatePicker
          /* `sm`, plain: since 0.26.3 every sized control constructs its
             height from the same core tokens, so the trigger measures
             exactly like the chips beside it with no clamp. The wrapper
             that pinned it dies with the scale bug. */
          size="sm"
          value={range.preset === "custom" ? new Date(range.fromISO) : null}
          onValueChange={(date) => {
            if (date) window.location.assign(`/funnel?desde=${asParam(date)}`);
          }}
          locale={copy.intlLocale}
          formatOptions={{ day: "numeric", month: "short", year: "numeric" }}
          placeholder={p.fromDate}
          aria-label={p.fromDateAria}
          weekStartsOn={1}
          toDate={new Date()}
          showOutsideDays
          clearable={false}
        />
      </Flex>

      <Text variant="small" color="muted">
        {p.note(day(range.fromISO), day(range.toISO))}
      </Text>
    </Stack>
  );
}

/**
 * The Datos tab: one page of twenty rows, searched and filtered server-side.
 *
 * Interactive, unlike the date chips above it, and the split is deliberate:
 * a date change moves every number on the page, so a full reload is its
 * honest price — but flipping Usuarios to Eventos only needs one query, and
 * paying fourteen of them plus a reload made every click a four-second
 * pause. Interactions here call `getDirectory` and swap local state; the
 * URL is kept in step through `history.replaceState`, with no router
 * involvement, so a deep link still opens exactly this view. Pagination
 * stays server-side: the DOM only ever holds one page, which is the entire
 * point the feature was asked for with ("no saturar la carga de elementos
 * en el DOM").
 */
function DirectoryPanel({
  initialDirectory,
  initialQuery,
  search,
  copy,
}: {
  initialDirectory: DirectoryPage;
  initialQuery: DirectoryQuery;
  search: { rango?: string; desde?: string };
  copy: Copy;
}) {
  const d = copy.panel.directory;
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState({ directory: initialDirectory, query: initialQuery });
  const { query } = view;
  const directory = view.directory;

  /** The whole next state as URL params; what is omitted resets. */
  const paramsOf = (over: { tipo?: string; q?: string; pagina?: number; estado?: string }) => {
    const params = new URLSearchParams();
    if (search.rango) params.set("rango", search.rango);
    if (search.desde) params.set("desde", search.desde);
    params.set("tipo", over.tipo ?? query.kind);
    const q = over.q ?? query.q;
    if (q) params.set("q", q);
    const estado = over.estado ?? (over.tipo ? "todos" : query.filter);
    if (estado !== "todos") params.set("estado", estado);
    if ((over.pagina ?? 1) > 1) params.set("pagina", String(over.pagina));
    return params;
  };

  function show(over: { tipo?: string; q?: string; pagina?: number; estado?: string }) {
    const params = paramsOf(over);

    startTransition(async () => {
      const result = await getDirectory({ data: Object.fromEntries(params.entries()) });
      setView({ directory: result.directory, query: result.query });
      /*
        NO history.replaceState here, and its absence is the fix for "se
        recarga todo": the router watches the URL, and rewriting it fired the
        whole page loader — fourteen queries — behind every one-query flip.
        Deep links still work inbound; the price is that the address bar
        stops narrating clicks, which nobody asked it to do.
      */
    });
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleDateString(copy.intlLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "America/Bogota",
    });

  return (
    <Stack gap="5" pt="4">
      <Flex gap="2" wrap="wrap" align="center">
        {(["usuarios", "eventos", "grupos"] as const).map((kind) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            shape="pill"
            variant={query.kind === kind ? "primary" : "outline"}
            disabled={pending}
            /* A kind switch resets search, filter and page: they describe
               the list being left, not the one being opened. */
            onClick={() => show({ tipo: kind, q: "", estado: "todos" })}
          >
            {d.kinds[kind]}
          </Button>
        ))}
      </Flex>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const box = new FormData(event.currentTarget).get("q");
          show({ q: typeof box === "string" ? box : "" });
        }}
      >
        <Flex gap="2" align="center" wrap="wrap">
          <Box width={{ base: "100%", sm: "18rem" }}>
            <Input
              /* Uncontrolled, re-keyed per list so a leftover search does not
                 travel from Usuarios into Eventos as ghost text. */
              key={query.kind}
              type="search"
              name="q"
              size="sm"
              fullWidth
              placeholder={d.searchPlaceholder[query.kind]}
              aria-label={d.searchPlaceholder[query.kind]}
              defaultValue={query.q}
              maxLength={80}
            />
          </Box>
          <Button type="submit" size="sm" shape="pill" variant="secondary" disabled={pending}>
            {d.searchSubmit}
          </Button>
          {query.q !== "" ? (
            <Button
              type="button"
              size="sm"
              shape="pill"
              variant="ghost"
              disabled={pending}
              onClick={() => show({ q: "" })}
            >
              {d.clearSearch}
            </Button>
          ) : null}
        </Flex>
      </form>

      {query.kind === "eventos" ? (
        <Flex gap="2" wrap="wrap" align="center">
          {(["todos", "con_costo", "gratis", "cancelados"] as const).map((estado) => (
            <Button
              key={estado}
              type="button"
              size="sm"
              shape="pill"
              variant={query.filter === estado ? "primary" : "outline"}
              disabled={pending}
              onClick={() => show({ estado })}
            >
              {d.filters[estado]}
            </Button>
          ))}
        </Flex>
      ) : null}

      <Card surface="outlined">
        <CardContent>
          <Stack gap="3" aria-busy={pending}>
            {/* While the one query flies, rows-shaped skeletons — the same
                two-line-left, date-right silhouette the data will paint —
                so the swap lands in place instead of reflowing. */}
            {pending ? (
              <DirectoryRowsSkeleton />
            ) : (
              <>
            <Flex gap="3" align="center" justify="between" wrap="wrap">
              <Text variant="small" color="muted">
                {d.results(directory.total)}
              </Text>
              <Text variant="small" color="muted">
                {d.pageOf(directory.page, directory.pages)}
              </Text>
            </Flex>

            {directory.rows.length === 0 ? (
              <Text variant="small" color="muted">
                {d.empty}
              </Text>
            ) : (
              <List as="ul" divided>
                {directory.rows.map((row) => (
                  <ListItem key={row.id}>
                    <Flex gap="3" align="start" justify="between" wrap="wrap" width="100%">
                      <Stack gap="1" minWidth="0">
                        <Text weight="medium">{row.name}</Text>
                        {row.detail ? (
                          <Text variant="small" color="muted">
                            {row.detail}
                          </Text>
                        ) : null}
                        <Text variant="small" color="muted">
                          {"events" in row.meta && "rsvps" in row.meta
                            ? d.userMeta(row.meta.events, row.meta.rsvps)
                            : "attending" in row.meta
                              ? d.eventMeta(row.meta.attending)
                              : d.groupMeta(row.meta.members, row.meta.events)}
                        </Text>
                      </Stack>
                      <Stack gap="1" align="end" flexShrink={0}>
                        <Text variant="small" color="muted">
                          {d.created(when(row.createdAtISO))}
                        </Text>
                        {"cancelled" in row.meta ? (
                          <Flex gap="2" align="center">
                            <Badge
                              variant={row.meta.costMode === "none" ? "outline" : "success"}
                              size="sm"
                              soft
                            >
                              {row.meta.costMode === "none" ? d.eventFree : d.eventPaid}
                            </Badge>
                            {row.meta.cancelled ? (
                              <Badge variant="error" size="sm" soft>
                                {d.eventCancelled}
                              </Badge>
                            ) : null}
                          </Flex>
                        ) : null}
                      </Stack>
                    </Flex>
                  </ListItem>
                ))}
              </List>
            )}

            {directory.pages > 1 ? (
              <Flex gap="2" align="center" justify="end">
                {directory.page > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => show({ pagina: directory.page - 1 })}
                  >
                    {d.previous}
                  </Button>
                ) : null}
                {directory.page < directory.pages ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => show({ pagina: directory.page + 1 })}
                  >
                    {d.next}
                  </Button>
                ) : null}
              </Flex>
            ) : null}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

/**
 * Rows-shaped placeholders for the directory while its one query flies.
 *
 * Traced from the real row — name over detail over meta on the left, the
 * created date on the right — because a skeleton that does not match what
 * replaces it is worse than a spinner: the reflow it causes is the "se
 * recarga todo" feeling with extra steps.
 */
function DirectoryRowsSkeleton() {
  return (
    <Stack gap="3" aria-hidden="true">
      <Flex gap="3" align="center" justify="between">
        <Skeleton width="7rem" height="14px" borderRadius="var(--sm-radius-sm)" />
        <Skeleton width="6rem" height="14px" borderRadius="var(--sm-radius-sm)" />
      </Flex>
      {Array.from({ length: 6 }, (_, index) => (
        <Flex key={index} gap="3" align="start" justify="between" pt="2">
          <Stack gap="2" width="60%">
            <Skeleton width="45%" height="16px" borderRadius="var(--sm-radius-sm)" animate="shimmer" />
            <Skeleton width="70%" height="12px" borderRadius="var(--sm-radius-sm)" />
          </Stack>
          <Skeleton width="8rem" height="12px" borderRadius="var(--sm-radius-sm)" />
        </Flex>
      ))}
    </Stack>
  );
}

/**
 * One step, with how many of the step above it survived to here.
 *
 * The percentage is against the FIRST step rather than the previous one. Step
 * to step reads better when every step is healthy and hides the shape when one
 * is not: three consecutive 80% steps sound fine and mean half the people are
 * gone.
 */
function Step({ name, count, first }: { name: string; count: number; first: number }) {
  const share = first === 0 ? 0 : Math.round((count / first) * 100);

  return (
    <Flex gap="3" align="center" justify="between">
      <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
        {name}
      </Text>
      <Flex gap="3" align="center">
        <Text weight="semibold">{count}</Text>
        <Box minWidth="3.5rem">
          <Badge variant={share >= 50 ? "success" : share >= 20 ? "warning" : "outline"} size="sm" soft>
            {share}%
          </Badge>
        </Box>
      </Flex>
    </Flex>
  );
}

function Funnel({ title, help, steps }: { title: string; help: string; steps: { name: string; count: number }[] }) {
  const first = steps[0]?.count ?? 0;

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="4">
          <Stack gap="1">
            <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
              {title}
            </Text>
            <Text variant="small" color="muted">
              {help}
            </Text>
          </Stack>

          <Stack gap="3">
            {steps.map((s) => (
              <Step key={s.name} name={s.name} count={s.count} first={first} />
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * One half of the calendar gate, with the verdict already reached.
 *
 * The badge says *met* or *not met* rather than showing a number beside a
 * threshold somebody has to remember. That is the entire reason this is not
 * just another {@link Step}: a funnel step is a measurement, and this is a
 * decision waiting to be read six weeks after it was designed.
 *
 * "Sin datos" is its own state and deliberately not a failure. A null
 * percentage means the denominator is empty — nobody has visited — which is a
 * different statement from "people saw it and did not want it", and letting a
 * quiet fortnight close the gate would be the wrong call made silently.
 */
function GateRow({
  label,
  detail,
  percent,
  threshold,
}: {
  label: string;
  detail: string;
  percent: number | null;
  threshold: number;
}) {
  const met = meetsGate(percent, threshold);

  return (
    <Flex gap="3" align="start" justify="between" wrap="wrap">
      <Stack gap="0" minWidth="0">
        <Text variant="small" weight="medium">
          {label}
        </Text>
        <Text variant="small" color="muted">
          {detail}
        </Text>
      </Stack>

      <Flex gap="3" align="center">
        <Text weight="semibold">{percent === null ? "—" : `${percent}%`}</Text>
        <Box minWidth="6.5rem">
          <Badge
            variant={met === null ? "outline" : met ? "success" : "warning"}
            size="sm"
            soft
          >
            {met === null ? "Sin datos" : met ? `≥ ${threshold}%` : `< ${threshold}%`}
          </Badge>
        </Box>
      </Flex>
    </Flex>
  );
}

function FunnelPage() {
  const report = Route.useLoaderData();
  const search = Route.useSearch();
  const { copy } = useCopy();
  const p = copy.panel;

  /*
    Land on Datos when the URL carries directory state: the anchors reload
    the whole page, and coming back to Resumen after every search would make
    the tab unusable. Tab choice itself stays client-side — it costs nothing
    and needs no URL.
  */
  const defaultTab =
    search.tipo || search.q || search.pagina || search.estado ? "datos" : "resumen";

  // The hourly limit is what "unusual" is measured against, so the badge turns
  // colour relative to the live setting rather than a number baked in here.
  const peakLimit = report.limits.find((l) => l.name === "invitesPerHour")?.value ?? 100;

  return (
    <Container size="3" px="4" py="6">
      <Stack gap="6">
        <Stack gap="2">
          <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
            {p.title}
          </Text>
          {/* Access mechanics (owner id, the 404) live in the code comments
              above, where an operator looks — not on a screen whose reader
              already got in. */}
          <Text color="muted">{p.subtitle}</Text>
        </Stack>

        <RangeFilter range={report.overview.range} copy={copy} />

        {/*
          Tres pestañas, una pregunta cada una: cuánto hay y si se mueve
          (Resumen), dónde se cae la gente (Embudos), y qué está pasando
          ahora mismo (Operación). Una versión anterior las descartó mientras
          se perseguía un cuelgue del SSR que resultó ser de la librería de
          gráficas, no de Tabs; con las barras en SVG propio no queda nada que
          pueda colgarse, y tres preguntas apiladas eran una página de scroll
          sin jerarquía.

          «Resumen» por defecto: es lo que se abre cuando no se viene buscando
          nada en particular.
        */}
        <Tabs defaultValue={defaultTab} size="xl">
          <TabsList fullWidth>
            <TabsTrigger value="resumen">{p.tabs.overview}</TabsTrigger>
            <TabsTrigger value="datos">{p.tabs.directory}</TabsTrigger>
            <TabsTrigger value="embudos">{p.tabs.funnels}</TabsTrigger>
            <TabsTrigger value="operacion">{p.tabs.operations}</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            <OverviewPanel overview={report.overview} />
          </TabsContent>

          <TabsContent value="datos">
            <DirectoryPanel
              initialDirectory={report.directory}
              initialQuery={report.directoryQuery}
              search={{ rango: search.rango, desde: search.desde }}
              copy={copy}
            />
          </TabsContent>

          <TabsContent value="embudos">
        <Stack gap="5" pt="4">
          <Text variant="small" color="muted">
            {p.funnels.help}
          </Text>

        <Funnel title={p.funnels.participants} help={p.funnels.participantsHelp} steps={report.participant} />

        <Funnel title={p.funnels.organizers} help={p.funnels.organizersHelp} steps={report.organizer} />

        <Funnel title={p.funnels.groups} help={p.funnels.groupsHelp} steps={report.groups} />

        {/*
          The Google Calendar gate, read rather than computed by whoever opens
          this. The card refuses to start until these two numbers clear their
          thresholds, and the thresholds were written down before any data
          existed precisely so they could not be adjusted afterwards to justify
          a decision already made.
        */}
        <Card surface="outlined">
          <CardContent>
            <Stack gap="4">
              <Stack gap="1">
                <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                  {p.calendarGate.heading}
                </Text>
                <Text variant="small" color="muted">
                  {p.calendarGate.help}
                </Text>
              </Stack>

              <Stack gap="3">
                <GateRow
                  label={p.calendarGate.downloads}
                  detail={p.calendarGate.downloadsDetail(report.calendar.downloads, report.calendar.viewers)}
                  percent={report.calendar.sharePercent}
                  threshold={CALENDAR_SHARE_THRESHOLD}
                />
                <GateRow
                  label={p.calendarGate.repeats}
                  detail={
                    report.calendar.knownDownloaders === 0
                      ? p.calendarGate.repeatsNobody
                      : p.calendarGate.repeatsDetail(
                          report.calendar.repeatDownloaders,
                          report.calendar.knownDownloaders,
                        )
                  }
                  percent={report.calendar.repeatPercent}
                  threshold={CALENDAR_REPEAT_THRESHOLD}
                />
              </Stack>

              {report.calendar.cancellations > 0 ? (
                <Text variant="small" color="muted">
                  {p.calendarGate.cancellations(report.calendar.cancellations)}
                </Text>
              ) : null}

              <Text variant="small" color="muted">
                {p.calendarGate.anonymousNote}
              </Text>
            </Stack>
          </CardContent>
        </Card>

        </Stack>
          </TabsContent>

          <TabsContent value="operacion">
        <Stack gap="5" pt="4">
        {/* AC-7 of the send-limits card. */}
        <Card surface="outlined">
          <CardContent>
            <Stack gap="4">
              <Stack gap="1">
                <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                  {p.operations.sendsHeading}
                </Text>
                <Text variant="small" color="muted">
                  {p.operations.sendsHelp}
                </Text>
              </Stack>

              {report.sends.length === 0 ? (
                <Text variant="small" color="muted">
                  {p.operations.sendsEmpty}
                </Text>
              ) : (
                <Stack gap="2">
                  {report.sends.map((row) => (
                    <Flex key={row.key} gap="3" align="center" justify="between">
                      <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
                        {row.key}
                      </Text>
                      <Flex gap="3" align="center">
                        <Text variant="small" color="muted">
                          {p.operations.sendsDay(Number(row.day))}
                        </Text>
                        <Badge
                          variant={row.peakHour >= peakLimit ? "error" : row.peakHour >= peakLimit / 2 ? "warning" : "outline"}
                          size="sm"
                          soft
                        >
                          {p.operations.sendsPeak(row.peakHour)}
                        </Badge>
                      </Flex>
                    </Flex>
                  ))}
                </Stack>
              )}

              <Divider />

              <Stack gap="1">
                <Text variant="small" weight="semibold">
                  {p.operations.limitsHeading}
                </Text>
                <Text variant="small" color="muted">
                  {p.operations.limitsHelp}
                </Text>
              </Stack>

              <Stack gap="2">
                {report.limits.map((limit) => (
                  <Flex key={limit.name} gap="3" align="center" justify="between">
                    <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
                      {limit.name}
                    </Text>
                    <Flex gap="2" align="center">
                      <Text weight="semibold">{limit.value}</Text>
                      <Badge variant={limit.isDefault ? "outline" : "warning"} size="sm" soft>
                        {limit.isDefault ? p.operations.limitDefault : p.operations.limitAdjusted}
                      </Badge>
                    </Flex>
                  </Flex>
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* The half of the email card that was never about volume: `notify()`
            swallows failures on purpose, so before the outbox a send that did
            not happen was invisible everywhere. This is where it is visible. */}
        <Card surface="outlined">
          <CardContent>
            <Stack gap="4">
              <Stack gap="1">
                <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                  {p.operations.mailHeading}
                </Text>
                <Text variant="small" color="muted">
                  {p.operations.mailHelp}
                </Text>
              </Stack>

              <Flex gap="4" align="center">
                <Flex gap="2" align="center">
                  <Text weight="semibold">{report.outbox.pending}</Text>
                  <Text variant="small" color="muted">
                    {p.operations.mailPending}
                  </Text>
                </Flex>
                <Flex gap="2" align="center">
                  <Text weight="semibold">{report.outbox.failed}</Text>
                  <Badge variant={report.outbox.failed > 0 ? "error" : "outline"} size="sm" soft>
                    {p.operations.mailFailed}
                  </Badge>
                </Flex>
              </Flex>

              {report.outbox.recentErrors.length > 0 ? (
                <Stack gap="2">
                  <Divider />
                  {report.outbox.recentErrors.map((row, index) => (
                    <Stack key={index} gap="1">
                      <Flex gap="2" align="center" justify="between">
                        <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
                          {row.template}
                        </Text>
                        <Text variant="small" color="muted">
                          {p.operations.mailAttempts(row.attempts)}
                        </Text>
                      </Flex>
                      <Text variant="small" color="error">
                        {row.error}
                      </Text>
                    </Stack>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        <Card surface="outlined">
          <CardContent>
            <Stack gap="3">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                {p.operations.recentHeading}
              </Text>
              <Divider />
              <Stack gap="2">
                {report.recent.length === 0 ? (
                  <Text variant="small" color="muted">
                    {p.operations.recentEmpty}
                  </Text>
                ) : (
                  report.recent.map((row, index) => (
                    <Flex key={index} gap="3" align="center" justify="between">
                      <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
                        {row.name}
                      </Text>
                      <Flex gap="2" align="center">
                        <Badge variant="outline" size="sm">
                          {row.source}
                        </Badge>
                        <Text variant="small" color="muted">
                          {new Date(row.at).toISOString().slice(0, 16).replace("T", " ")}
                        </Text>
                      </Flex>
                    </Flex>
                  ))
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        </Stack>
          </TabsContent>
        </Tabs>
      </Stack>
    </Container>
  );
}
