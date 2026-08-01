# Costs

## Today

**USD 0 / month.**

| Service  | Plan  | What it does here                                                                                               | Cost |
| -------- | ----- | --------------------------------------------------------------------------------------------------------------- | ---- |
| Supabase | Free  | Managed Postgres, plus Auth for optional organizer sign-in. No Storage, no Realtime, no Edge Functions, no RLS. | $0   |
| Vercel   | Hobby | Hosting, serverless functions, HTTPS, the deploy pipeline.                                                      | $0   |
| GitHub   | Free  | Repository, GitHub Packages (the private UI library), Actions for the keep-alive cron.                          | $0   |

Nothing else is used. No Redis, no queue, no object storage, no error-tracking
SaaS, no analytics, no CDN beyond what Vercel includes. Every one of those was
considered and rejected — the reasoning is in [DECISIONS.md](./DECISIONS.md).

No email provider either, and the asterisk on that is in the next section: magic
links go out through Supabase's built-in mailer, which is rate-limited to the
point of being a demo feature.

---

## Supabase Free — the real limits

Commercial use **is** permitted on the free tier. The constraints that actually
bite are operational:

| Limit                         | Value        | What it means here                                                                                                                                           |
| ----------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Inactivity pause**          | ~7 days      | The big one. A paused project is unreachable until restored by hand. Handled by `/api/keep-alive` + a GitHub Actions cron — see README → "Keeping it alive". |
| **Database storage**          | 500 MB       | The only limit that images make real — see below. Text rows are negligible: ten thousand events with twenty participants each is a few MB.                   |
| **Backup retention**          | **Zero**     | There is no snapshot to restore from. `npm run db:export` is the only backup that exists, and running it is a manual act.                                    |
| **Projects per organization** | 2            | Relevant only if you want separate staging and production databases — that uses both slots.                                                                  |
| **Egress**                    | 5 GB/month   | Pages are text. Receipts are the only bytes that move, at ~150 KB each and only when an organizer opens one — thousands of views before this matters.        |
| **Built-in email**            | **2–3/hour** | Sharp. Every magic-link sign-in spends one. Google sign-in spends none, which is the practical answer; see below.                                            |
| **Monthly active users**      | 50,000       | Not a concern. Only organizers ever sign in, and only if they want a history.                                                                                |

### Receipts are the only thing that consumes storage

Proof-of-payment images are stored in Postgres rather than in a bucket, because
the free tier keeps no backups and `db:export` is the only copy that exists —
the full reasoning is in [DECISIONS.md](./DECISIONS.md) #45. That puts them
against the 500 MB database allowance instead of the 1 GB storage one.

Every upload is shrunk in the browser to 1400px and JPEG quality 0.8 before it
is sent, which lands at **100–200 KB**. The arithmetic:

| Receipts | Roughly                   |
| -------- | ------------------------- |
| 500      | 75 MB                     |
| 1,500    | 225 MB                    |
| 3,000    | 450 MB — effectively full |

**Treat 1,500 as the ceiling**, not 3,000: a database at 90% is a database with
no room for the data the app is actually for, and `pg_dump` grows with it.

Two ways past it, in order of effort:

1. **Delete approved receipts.** Once the organizer has approved one, the record
   that it _was_ approved is what matters; the photograph of somebody's banking
   app is a liability with no remaining purpose.
   `deleteEvidence()` in `src/lib/evidence-store.ts` exists for exactly this and
   is deliberately not wired to anything automatic.
2. **Move to Supabase Storage** — 1 GB free, ~6,600 receipts, and it stops
   competing with the rest of the data. `evidence-store.ts` is the only module
   that touches the bytes, so this is that file plus a script that copies rows.
   Budget for the backups: files in a bucket are outside `pg_dump` and need
   their own.

### Auth email goes through the app now, not through Supabase

**Superseding the section below, same day.** Custom SMTP fixed delivery and left
the message itself as Supabase's: English, their template, none of the frame
every other message here carries. The **Send Email Hook** replaces the sending
outright — Supabase calls `POST /api/auth/send-email`, the app renders with its
own React Email layout in the reader's language, and it goes out through the
same port as everything else. Free plan, no extra cost.

What deliberately stays with Supabase: issuing and expiring tokens, deciding
signup-versus-magic-link, creating the user, and rate limiting the public
endpoint. The alternative — `generateLink` with the service_role key — moved all
of that into this codebase along with an admin credential.

**Keep custom SMTP enabled anyway, and not as a fallback.** With the hook on,
Supabase never uses those SMTP credentials to send anything — but the setting is
what unlocks the email rate limit. Turn it off and Supabase forces
`rate_limit_email_sent` back to the built-in **2 per hour**, which it did on
2026-08-01: the log line reads `updating Email limiter from 30 to 2`, and email
sign-in was unusable within three attempts. The docs are explicit that the limit
"can only be changed with your own custom SMTP setup". The credentials are a
licence to raise the ceiling, not a delivery path.

Raise the limit itself in Authentication → Rate Limits. 30/hour is the floor
Supabase sets on enabling custom SMTP and it is too low for a WhatsApp group
arriving at once; the sending is Resend's 3,000/month, not Supabase's, so there
is nothing to save by leaving it small.

Two constraints worth remembering. The hook has a **five-second budget for the
whole invocation**, retries included, so that route must stay small. And the
hook URL has to be live **before** the hook is enabled — pointing it at a
deployment that lacks the route breaks email sign-in completely.

### The email limit is no longer a future problem — it is the current one

**As of 2026-08-01, custom SMTP is required, not advisable.** Two things
changed. Answering an event now requires an account, so email sign-in went from
a fallback for the occasional organizer to the only way in for anyone without a
Google account. And the built-in service does not merely throttle: it **refuses
to deliver to any address that is not a member of the Supabase organization**,
silently, after answering `200`. A sign-up from `someone@hotmail.com` produces
a `mail.send` log line and no email.

Everything needed is already here — `RESEND_API_KEY` and `EMAIL_FROM` are set
for the app's own message port. What is missing is telling **Supabase Auth**
about them, which is a separate setting: Authentication → Emails → SMTP
Settings, or one `PATCH` to `/v1/projects/<ref>/config/auth`. Resend's SMTP host
is `smtp.resend.com:465`, user `resend`, password the same API key.

Two things to get right while doing it. Custom SMTP starts at **30 messages per
hour** — raise it on the Rate Limits page. And **disable link tracking** on the
provider: it rewrites URLs, and a rewritten confirmation link does not verify.

The section below is what this looked like while it was still hypothetical.

### The email limit is the one that will surprise you

Supabase's built-in SMTP is explicitly labelled for testing: roughly **2–3
messages per hour, project-wide**. Four organizers requesting a magic link in
the same hour is enough for the fourth to be told, truthfully, that the email
was sent — and for it never to arrive.

It has not been raised, for two reasons. Google sign-in is the primary route and
sends no email at all, and the alternative is a custom SMTP provider, which is
the first thing on this page that plausibly costs money later. Resend and
Brevo's free tiers are generous enough today (3,000/month and 300/day
respectively), but both want a verified sending domain, which is a domain
purchase if you do not already own one.

Configure custom SMTP the day email sign-in stops being a fallback and becomes
how people actually get in.

---

## Vercel Hobby — the licensing limit

This one is a legal term, not a technical quota, and it is the most likely way
this setup stops being free:

> **Vercel Hobby is for non-commercial, personal use only.**

The moment this app charges anyone, takes a fee or a cut, carries ads, or is
operated by or on behalf of a business, it needs **Vercel Pro at ~USD 20/month
per member**. Organizing your own football game and splitting the field rental
is personal use. Running it as a service for other groups is not.

### No overage billing — this is deliberate

Hobby has **no** pay-as-you-go overage. Exceeding a quota **pauses the
deployment** rather than generating a surprise invoice.

That is the desired behaviour under a zero-cost constraint: the worst case is
downtime, not a bill. **Do not enable spend management, a payment method, or
anything else that would convert a pause into a charge.**

---

## What would break the zero-cost constraint

In rough order of likelihood:

1. **Commercial use of any kind** → Vercel Pro, ~$20/month. The single most
   likely trigger.
2. **Adding a service.** Email or SMS notifications, error tracking, analytics,
   a hosted rate-limit counter, image hosting — every one of these has a free
   tier that eventually stops being free, and several need a credit card up
   front.
3. **Turning on Vercel Analytics or Speed Insights.** Both are off on purpose.
4. **Next.js Image Optimization.** Off on purpose. The only images are receipts
   and avatars: receipts are already shrunk in the browser and served by a
   plain route, and avatars come straight from Google. Turning it on would
   consume a metered quota to re-optimize things that need none.
5. **Edge middleware.** Not used; the app stays on Node runtime defaults.
6. **Real traffic.** If this ever outgrows "a group of friends", the Supabase
   free tier's connection budget goes first. That is a good problem and a
   different app.

## What to do if it grows

Ranked by cost-effectiveness, not by ambition:

1. **Supabase Pro — $25/month.** Buys daily backups and no inactivity pause.
   This is the first upgrade worth making, because it removes the two genuinely
   dangerous properties of the current setup.
2. **Vercel Pro — $20/month.** Only when the licensing terms require it.
3. Everything else can wait.
