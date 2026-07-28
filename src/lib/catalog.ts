import "server-only";

import { asc, eq } from "drizzle-orm";

import type { Locale } from "@/config/copy";
import { db } from "@/db/client";
import { eventTypePolicies, eventTypes, policyDefinitions } from "@/db/schema";
import { isKnownHandler } from "@/domain/policy-handlers";

import { pickLabel, pickOptionalLabel } from "./labels";

/**
 * Reads the two catalogues.
 *
 * These are the tables that make the platform extensible without a deploy: a
 * new kind of event, a new policy, or a new association between them is an
 * INSERT. Everything here returns rows already resolved into the reader's
 * language, so no page has to know that labels are stored as `jsonb`.
 *
 * Retired rows (`is_active = false`) are excluded from everything that feeds a
 * picker. They are never excluded from anything that renders an *existing*
 * event — retiring a policy must not blank out the requirement on events that
 * already carry it, which is also why both foreign keys are `restrict`.
 */

export interface EventTypeOption {
  id: string;
  slug: string;
  label: string;
}

export interface PolicyOption {
  /** `policy_definitions.id`, which is what an event stores. */
  id: string;
  slug: string;
  handler: string;
  label: string;
  description: string | null;
  /** Pre-added on the create form rather than merely offered. */
  isDefault: boolean;
  /**
   * False when this deploy has no implementation for `handler`.
   *
   * Kept in the list rather than filtered out, so an administrator who added a
   * catalogue row ahead of the code sees why it does not work instead of
   * wondering where it went.
   */
  isSupported: boolean;
}

/** The kinds of event on offer, in catalogue order. */
export async function loadEventTypes(locale: Locale): Promise<EventTypeOption[]> {
  const rows = await db
    .select({
      id: eventTypes.id,
      slug: eventTypes.slug,
      labels: eventTypes.labels,
    })
    .from(eventTypes)
    .where(eq(eventTypes.isActive, true))
    .orderBy(asc(eventTypes.position), asc(eventTypes.slug));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    label: pickLabel(row.labels, locale, row.slug),
  }));
}

/**
 * What each kind of event offers, keyed by event type id.
 *
 * Loaded for every type at once rather than per type, because the create form
 * lets the organizer change the kind after they have started and re-fetching
 * on each change would put a round trip between a tap and the list updating.
 * The whole catalogue is a handful of rows.
 */
export async function loadPolicyOptionsByEventType(
  locale: Locale,
): Promise<Record<string, PolicyOption[]>> {
  const rows = await db
    .select({
      eventTypeId: eventTypePolicies.eventTypeId,
      position: eventTypePolicies.position,
      isDefault: eventTypePolicies.isDefault,
      id: policyDefinitions.id,
      slug: policyDefinitions.slug,
      handler: policyDefinitions.handler,
      labels: policyDefinitions.labels,
      descriptions: policyDefinitions.descriptions,
    })
    .from(eventTypePolicies)
    .innerJoin(policyDefinitions, eq(policyDefinitions.id, eventTypePolicies.policyDefinitionId))
    .innerJoin(eventTypes, eq(eventTypes.id, eventTypePolicies.eventTypeId))
    .where(eq(policyDefinitions.isActive, true))
    .orderBy(asc(eventTypePolicies.eventTypeId), asc(eventTypePolicies.position));

  const grouped: Record<string, PolicyOption[]> = {};

  for (const row of rows) {
    (grouped[row.eventTypeId] ??= []).push({
      id: row.id,
      slug: row.slug,
      handler: row.handler,
      label: pickLabel(row.labels, locale, row.slug),
      description: pickOptionalLabel(row.descriptions, locale),
      isDefault: row.isDefault,
      isSupported: isKnownHandler(row.handler),
    });
  }

  return grouped;
}

/**
 * Every active policy, regardless of which types offer it.
 *
 * The association decides what is *suggested*; an organizer is not confined to
 * it. Somebody running an "other" event who wants proof of payment should be
 * able to add it.
 */
export async function loadAllPolicyOptions(locale: Locale): Promise<PolicyOption[]> {
  const rows = await db
    .select({
      id: policyDefinitions.id,
      slug: policyDefinitions.slug,
      handler: policyDefinitions.handler,
      labels: policyDefinitions.labels,
      descriptions: policyDefinitions.descriptions,
    })
    .from(policyDefinitions)
    .where(eq(policyDefinitions.isActive, true))
    .orderBy(asc(policyDefinitions.position), asc(policyDefinitions.slug));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    handler: row.handler,
    label: pickLabel(row.labels, locale, row.slug),
    description: pickOptionalLabel(row.descriptions, locale),
    isDefault: false,
    isSupported: isKnownHandler(row.handler),
  }));
}
