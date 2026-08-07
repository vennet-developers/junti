import type { ReactNode } from "react";

import { Card, CardContent } from "@stackmyth/card";
import {
  CalendarIcon,
  MailIcon,
  ShoppingCartIcon,
  UserIcon,
  UserPlusIcon,
  ZapIcon,
} from "@stackmyth/icons";
import { Box, Divider, Flex, Grid, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AreaChart, Donut, MiniBars, SegmentBar, Sparkline } from "@stackmyth/charts";
import { useCopy } from "@/components/copy-provider";
import { formatMoney } from "@/lib/format";
import type { Metric, OverviewReport } from "@/lib/overview";

/**
 * The Resumen tab: the state of the system, drawn to be read at a glance.
 *
 * The layout follows one rule — **the number first, the picture beside it**.
 * Every card leads with an icon chip in the brand's soft orange and a large
 * figure; sparklines and rings sit next to their number, never instead of it,
 * because a chart without its figure makes the reader estimate what the
 * database knows exactly.
 */

/** The brand-orange chip every card leads with. */
function IconChip({ children }: { children: ReactNode }) {
  return (
    <Flex
      align="center"
      justify="center"
      width="2.25rem"
      height="2.25rem"
      borderRadius="0.625rem"
      backgroundColor="var(--junti-naranja-suave)"
      color="var(--junti-naranja-suave-texto)"
      flexShrink={0}
    >
      {children}
    </Flex>
  );
}

/**
 * One headline: chip, total, and how the period moved.
 *
 * The delta renders only when there was a previous period to compare — "0%"
 * against silence is a verdict nobody measured, and `Metric.change` is null
 * precisely there.
 */
function HeadlineCard({
  icon,
  label,
  metric,
  inPeriod,
  intlLocale,
}: {
  icon: ReactNode;
  label: string;
  metric: Metric;
  inPeriod: (n: string) => string;
  intlLocale: string;
}) {
  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="3">
          <IconChip>{icon}</IconChip>
          <Stack gap="1">
            <Text as="span" variant="h3" weight="semibold" fontFamily="var(--junti-display)">
              {metric.total.toLocaleString(intlLocale)}
            </Text>
            <Text variant="small" color="muted">
              {label}
            </Text>
          </Stack>
          <Flex gap="2" align="baseline" wrap="wrap">
            <Text variant="small" weight="medium">
              {inPeriod(metric.window.toLocaleString(intlLocale))}
            </Text>
            {/* `Text` has no "success" color (STACKMYTH-GAPS #25 territory);
                a Box carries the token and Text inherits. */}
            {metric.change !== null ? (
              <Box
                as="span"
                color={
                  metric.change >= 0
                    ? "var(--junti-viene-fg, #15803d)"
                    : "var(--junti-error-fg, #b91c1c)"
                }
              >
                <Text as="span" variant="small" color="inherit">
                  {metric.change >= 0 ? "▲" : "▼"} {Math.abs(metric.change)}%
                </Text>
              </Box>
            ) : null}
          </Flex>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Chip + label + big number + trend beside it — the Attio-style trend card. */
function TrendCard({
  icon,
  label,
  value,
  caption,
  values,
  ariaLabel,
  variant = "sparkline",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  caption: string;
  values: readonly number[];
  ariaLabel: string;
  /* MiniBars when the buckets themselves matter (empty days as dots);
     sparkline when only the direction does. */
  variant?: "sparkline" | "minibars";
}) {
  const flat = values.every((v) => v === 0);

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="3">
          <IconChip>{icon}</IconChip>
          <Flex gap="4" align="end" justify="between" wrap="wrap">
            <Stack gap="1" minWidth="0">
              <Text variant="small" color="muted">
                {label}
              </Text>
              <Text as="span" variant="h4" weight="semibold" fontFamily="var(--junti-display)">
                {value}
              </Text>
              <Text variant="small" color="muted">
                {caption}
              </Text>
            </Stack>
            {/* A flat sparkline of zeros draws a floor-line that reads as
                data. Nothing is the honest picture of nothing. */}
            {flat ? null : (
              <Box width="7.5rem" height="2.25rem" flexShrink={0}>
                {variant === "minibars" ? (
                  <MiniBars values={values} ariaLabel={ariaLabel} />
                ) : (
                  <Sparkline values={values} ariaLabel={ariaLabel} />
                )}
              </Box>
            )}
          </Flex>
        </Stack>
      </CardContent>
    </Card>
  );
}

function DepthRow({
  label,
  help,
  value,
  detail,
}: {
  label: string;
  help: string;
  value: string;
  detail?: string;
}) {
  return (
    <Flex gap="3" align="start" justify="between" wrap="wrap">
      <Stack gap="1" minWidth="0">
        <Text variant="small" weight="semibold">
          {label}
        </Text>
        <Text variant="small" color="muted">
          {help}
        </Text>
      </Stack>
      <Stack gap="1" align="end" flexShrink={0}>
        <Text weight="semibold">{value}</Text>
        {detail ? (
          <Text variant="small" color="muted">
            {detail}
          </Text>
        ) : null}
      </Stack>
    </Flex>
  );
}

export function OverviewPanel({ overview }: { overview: OverviewReport }) {
  const { copy } = useCopy();
  const p = copy.panel;

  const { depth, money, emails, projection } = overview;
  const paidShare = depth.paidEventPercent;

  const pct = (value: number | null) => (value === null ? p.noData : `${value}%`);
  const cop = (minor: number) => formatMoney(minor, "COP", copy.intlLocale);

  return (
    <Stack gap="5" pt="4">
      {/* ── Los cuatro conteos ─────────────────────────────────────────── */}
      <Grid columns={{ base: "1", sm: "2", lg: "4" }} gap="3">
        <HeadlineCard
          icon={<UserIcon size={18} aria-hidden="true" />}
          label={p.headlines.accounts}
          inPeriod={p.inPeriod}
          intlLocale={copy.intlLocale}
          metric={overview.accounts}
        />
        <HeadlineCard
          icon={<CalendarIcon size={18} aria-hidden="true" />}
          label={p.headlines.events}
          inPeriod={p.inPeriod}
          intlLocale={copy.intlLocale}
          metric={overview.events}
        />
        <HeadlineCard
          icon={<UserPlusIcon size={18} aria-hidden="true" />}
          label={p.headlines.groups}
          inPeriod={p.inPeriod}
          intlLocale={copy.intlLocale}
          metric={overview.groups}
        />
        <HeadlineCard
          icon={<MailIcon size={18} aria-hidden="true" />}
          label={p.headlines.emails}
          inPeriod={p.inPeriod}
          intlLocale={copy.intlLocale}
          metric={emails.sent}
        />
      </Grid>

      {/* ── La plata y el pulso ────────────────────────────────────────── */}
      <Grid columns={{ base: "1", lg: "3" }} gap="3">
        {/*
          The number monetization waits on: how much money the product
          coordinates without touching. A platform coordinating serious money
          has something to charge a fee against; one coordinating pizza
          budgets does not, and this card is where that becomes visible.
        */}
        <Card surface="outlined">
          <CardContent>
            <Stack gap="3">
              <IconChip>
                <ShoppingCartIcon size={18} aria-hidden="true" />
              </IconChip>
              <Stack gap="1">
                <Text variant="small" color="muted">
                  {p.money.label}
                </Text>
                <Text as="span" variant="h4" weight="semibold" fontFamily="var(--junti-display)">
                  {cop(money.trackedMinor)}
                </Text>
                <Text variant="small" color="muted">
                  {p.money.breakdown(cop(money.confirmedMinor), cop(money.windowConfirmedMinor))}
                </Text>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <TrendCard
          icon={<ZapIcon size={18} aria-hidden="true" />}
          label={p.activity.label}
          value={overview.rsvps.window.toLocaleString(copy.intlLocale)}
          caption={p.activity.caption(overview.days)}
          values={overview.weeklyRsvps.map((week) => week.value)}
          ariaLabel={p.activity.aria}
          variant="minibars"
        />

        {/*
          The paid-events ring: the share of events that charge money, which
          is what says whether the payment features earn their upkeep — and
          what a take-rate would ever apply to.
        */}
        <Card surface="outlined">
          <CardContent>
            <Flex gap="4" align="center">
              <Donut share={(paidShare ?? 0) / 100} ariaLabel={p.paidRing.aria(paidShare ?? 0)}>
                {pct(paidShare)}
              </Donut>
              <Stack gap="1" minWidth="0">
                <Text variant="small" weight="semibold">
                  {p.paidRing.label}
                </Text>
                <Text variant="small" color="muted">
                  {p.paidRing.help}
                </Text>
              </Stack>
            </Flex>
          </CardContent>
        </Card>
      </Grid>

      {/* ── Cómo se mueve: cuatro tendencias, curvas suaves ────────────── */}
      <Grid columns={{ base: "1", md: "2" }} gap="3">
        {(
          [
            [p.trends.accounts, overview.weeklyAccounts, overview.accounts.window],
            [p.trends.events, overview.weeklyEvents, overview.events.window],
            [p.trends.rsvps, overview.weeklyRsvps, overview.rsvps.window],
            [p.trends.emails, emails.weekly, emails.sent.window],
          ] as const
        ).map(([title, points, windowTotal]) => (
          <Card key={title} surface="outlined">
            <CardContent>
              <Stack gap="2">
                <Flex gap="3" align="baseline" justify="between">
                  <Text variant="small" color="muted">
                    {title}
                  </Text>
                  <Text as="span" weight="semibold">
                    {windowTotal.toLocaleString(copy.intlLocale)}
                  </Text>
                </Flex>
                {points.every((p) => p.value === 0) ? (
                  <Text variant="small" color="muted">
                    {p.noDataYet}
                  </Text>
                ) : (
                  <AreaChart points={points} ariaLabel={p.trends.aria(title)} />
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Grid>

      {/* ── Respuestas por tipo: el pastel honesto, en los colores que el
             roster ya usa — «van» TIENE un color en este producto. ────────── */}
      {overview.attendance.going +
        overview.attendance.maybe +
        overview.attendance.notGoing +
        overview.attendance.waitlisted >
      0 ? (
        <Card surface="outlined">
          <CardContent>
            <Stack gap="3">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                {p.attendance.heading}
              </Text>
              {/* Each part carries its own semantic token — "van" HAS a color
                  in this product — through the prop the library grew for
                  exactly this. The scoped CSS that remapped the categorical
                  slots died with it. */}
              <SegmentBar
                ariaLabel={p.attendance.heading}
                parts={[
                  { label: p.attendance.going, value: overview.attendance.going, token: "--junti-viene-fill" },
                  { label: p.attendance.maybe, value: overview.attendance.maybe, token: "--junti-talvez-fill" },
                  { label: p.attendance.notGoing, value: overview.attendance.notGoing, token: "--junti-noviene-fg" },
                  { label: p.attendance.waitlisted, value: overview.attendance.waitlisted, token: "--junti-espera-fill" },
                ]}
              />
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Proyección ─────────────────────────────────────────────────── */}
      <Card surface="outlined">
        <CardContent>
          <Stack gap="4">
            <Stack gap="1">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                {p.projection.heading}
              </Text>
              <Text variant="small" color="muted">
                {p.projection.help}
              </Text>
            </Stack>

            <Grid columns={{ base: "1", sm: "3" }} gap="3">
              {/*
                When the pace is not yet measurable the fallback is the datum
                that IS known — what the trailing window actually produced —
                because a dash answers nothing and the reader came for a
                number. The ≈ only appears on real extrapolations.
              */}
              {(
                [
                  [p.projection.accounts, projection.accountsNext30, overview.accounts.window],
                  [p.projection.events, projection.eventsNext30, overview.events.window],
                  [p.projection.rsvps, projection.rsvpsNext30, overview.rsvps.window],
                ] as const
              ).map(([label, value, windowActual]) => (
                <Stack key={label} gap="1">
                  <Text as="span" variant="h4" weight="semibold" fontFamily="var(--junti-display)">
                    {value === null
                      ? windowActual.toLocaleString(copy.intlLocale)
                      : `≈ ${value.toLocaleString(copy.intlLocale)}`}
                  </Text>
                  <Text variant="small" color="muted">
                    {value === null ? p.projection.fallback(label) : label}
                  </Text>
                </Stack>
              ))}
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Si esto sirve o no ─────────────────────────────────────────── */}
      <Card surface="outlined">
        <CardContent>
          <Stack gap="4">
            <Stack gap="1">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                {p.depth.heading}
              </Text>
              <Text variant="small" color="muted">
                {p.depth.help}
              </Text>
            </Stack>

            <Divider />

            <Stack gap="4">
              <DepthRow
                label={p.depth.repeatOrganizers}
                help={p.depth.repeatOrganizersHelp}
                value={pct(depth.repeatOrganizerPercent)}
                detail={p.depth.of(depth.repeatOrganizers, depth.organizers)}
              />
              <DepthRow
                label={p.depth.repeatParticipants}
                help={p.depth.repeatParticipantsHelp}
                value={pct(depth.repeatParticipantPercent)}
                detail={p.depth.of(depth.repeatParticipants, depth.participants)}
              />
              <DepthRow
                label={p.depth.typicalSize}
                help={p.depth.typicalSizeHelp}
                value={
                  depth.averageAttendance === null
                    ? p.noData
                    : p.depth.people(depth.averageAttendance)
                }
              />
              <DepthRow
                label={p.depth.firstAnswer}
                help={p.depth.firstAnswerHelp}
                value={
                  depth.medianHoursToFirstRsvp === null
                    ? p.noData
                    : depth.medianHoursToFirstRsvp < 1
                      ? p.depth.lessThanHour
                      : p.depth.hours(depth.medianHoursToFirstRsvp)
                }
              />
              <DepthRow
                label={p.depth.undelivered}
                help={p.depth.undeliveredHelp}
                value={String(emails.failed + emails.suppressed)}
                detail={
                  emails.failed + emails.suppressed > 0
                    ? p.depth.undeliveredDetail(emails.failed, emails.suppressed)
                    : undefined
                }
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
