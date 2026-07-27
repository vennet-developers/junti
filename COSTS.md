# Costs

## Today

**USD 0 / month.**

| Service  | Plan  | What it does here                                                                      | Cost |
| -------- | ----- | -------------------------------------------------------------------------------------- | ---- |
| Supabase | Free  | Managed Postgres. Nothing else — no Auth, no Storage, no Realtime, no Edge Functions.  | $0   |
| Vercel   | Hobby | Hosting, serverless functions, HTTPS, the deploy pipeline.                             | $0   |
| GitHub   | Free  | Repository, GitHub Packages (the private UI library), Actions for the keep-alive cron. | $0   |

Nothing else is used. No Redis, no queue, no object storage, no email provider,
no error-tracking SaaS, no analytics, no CDN beyond what Vercel includes. Every
one of those was considered and rejected — the reasoning is in
[DECISIONS.md](./DECISIONS.md).

---

## Supabase Free — the real limits

Commercial use **is** permitted on the free tier. The constraints that actually
bite are operational:

| Limit                         | Value      | What it means here                                                                                                                                           |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Inactivity pause**          | ~7 days    | The big one. A paused project is unreachable until restored by hand. Handled by `/api/keep-alive` + a GitHub Actions cron — see README → "Keeping it alive". |
| **Database storage**          | 500 MB     | Not a concern. This app stores short text rows. Ten thousand events with twenty participants each is on the order of a few MB.                               |
| **Backup retention**          | **Zero**   | There is no snapshot to restore from. `npm run db:export` is the only backup that exists, and running it is a manual act.                                    |
| **Projects per organization** | 2          | Relevant only if you want separate staging and production databases — that uses both slots.                                                                  |
| **Egress**                    | 5 GB/month | Not a concern for text-only pages with no images.                                                                                                            |

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
4. **Next.js Image Optimization.** Off on purpose — there are no images here
   worth optimizing, and it consumes a metered quota.
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
