# Answering a data subject request

The privacy notice at `/privacy` promises to answer **consultas within 10
business days** and **reclamos within 15**, as Ley 1581 de 2012 requires. This
is how, so the promise does not depend on remembering.

Requests arrive at **hello@vennet.dev**. There is no self-serve export and none
is required for v1.

---

## Before anything: prove they are who they say

The only identifier this app holds for a person is their email address. So the
check is: **does the request come from the address it is about?**

If it does not — somebody asking about a different address than the one they are
writing from — reply asking them to write from that address, and do nothing
else. Handing somebody else's data to a convincing email is the failure this
step exists to prevent, and it is not recoverable.

Requests about a **phone number** or a **name** still resolve through the
account, so the same rule applies.

---

## Where a person's data actually is

Run these with the address in question. Everything below assumes
`:email` is the address they wrote from.

```sql
-- The account itself
select id, email, created_at, last_sign_in_at from auth.users where email = :email;

-- Their profile: name and, only if they consented, phone
select * from user_profiles where user_id = :user_id;

-- What they agreed to and when, including revocations
select purpose, channel, granted, policy_version, created_at
from consent_events where user_id = :user_id order by created_at;

-- Their preferences
select * from user_preferences where user_id = :user_id;

-- Every event they answered, and what they answered
select e.title, p.display_name, p.attendance, p.created_at
from participants p join events e on e.id = p.event_id
where p.user_id = :user_id;

-- Events they organize
select title, starts_at from events where organizer_id = :user_id;

-- Invitations sent to them. Keyed by account since groups shipped: an
-- invitation names a user id, not an address.
select e.title, i.sent_at, (i.participant_id is not null) as answered
from invitations i join events e on e.id = i.event_id where i.user_id = :user_id;

-- Groups they are in, and groups they own. Both are personal data: the first
-- says who they agreed to hear from, the second is a list of other people.
select g.name, gm.status, gm.created_at
from group_members gm join groups g on g.id = gm.group_id
where gm.user_id = :user_id;

select id, name, created_at from groups where owner_id = :user_id;

-- Whether they are on the suppression list
select * from email_suppressions where email = :email;

-- Receipts they uploaded that still exist (approved ones are already deleted)
select ps.status, ps.created_at, (pe.submission_id is not null) as image_kept
from policy_submissions ps
left join policy_evidence pe on pe.submission_id = ps.id
join participants p on p.id = ps.participant_id
where p.user_id = :user_id;
```

---

## Acceso — what we hold

Answer with the above, in prose. No format is prescribed; a readable email
listing each category and its contents satisfies it.

## Rectificación — correct it

- **Name**: `update user_profiles set full_name = …` and the same value into
  `auth.users.raw_user_meta_data.full_name`, so the header and the roster agree.
  They can also do this themselves from the profile.
- **Phone**: they can change or remove it from their profile. If they ask you to,
  `update user_profiles set phone = null` and write a revocation into
  `consent_events` — see below.
- **Display name on one event**: that is theirs to edit from the event itself.

## Revocación — withdraw consent

Self-serve from the profile, and it clears the column rather than flagging it.
If done by hand, both halves are required:

```sql
update user_profiles set phone = null, updated_at = now() where user_id = :user_id;

insert into consent_events (id, user_id, purpose, channel, granted, policy_version)
values (gen_random_uuid(), :user_id, 'organizer_whatsapp', 'whatsapp', false, :policy_version);
```

Never delete the original grant. The ledger is append-only because the question
it answers is "what did they agree to, and when" — a revocation is a second
fact, not an edit to the first.

## Supresión — delete

**What can go entirely**: the account, the profile, preferences, their
invitations, their group memberships, and any receipt image still stored.

**What cannot, and why to say so plainly**: their participation in events with
money attached. Removing a participant re-splits the cost across everybody else
and rewrites what other people owe — the record is as much theirs as it is the
requester's. Ley 1581 does not require deletion where the data is needed to
honour an obligation between the parties.

The defensible middle, and what to do:

```sql
-- 0. Their name where it was copied into somebody else's inbox.
--
-- FIRST, and that ordering is the whole point: an organizer's notification
-- reads "Ana Torres: Voy", so Ana's name sits in `payload` on a row addressed
-- to somebody else. It is a copy of the roster name — which step 1 is about to
-- overwrite — so running this afterwards would look for a name that no longer
-- exists and leave this table as the one place the old one survived.
update notifications set payload = payload - 'name'
where payload->>'name' in (
  select display_name from participants where user_id = :user_id);

-- 1. Anonymise the roster entry rather than removing it
update participants set display_name = 'Participante retirado', avatar_url = null
where user_id = :user_id;

-- 2. Remove everything that is only about them
delete from user_profiles where user_id = :user_id;
delete from user_preferences where user_id = :user_id;
delete from invitations where user_id = :user_id;

-- Their memberships. Groups they OWN are a judgement call: deleting one
-- removes other people's memberships too, which is the opposite of what a
-- deletion request is for. Ask them whether to delete or hand the group over.
delete from group_members where user_id = :user_id;
delete from policy_evidence where submission_id in (
  select ps.id from policy_submissions ps
  join participants p on p.id = ps.participant_id where p.user_id = :user_id);

-- Their own inbox. Nobody else reads it and nothing depends on it.
-- (Their name in OTHER people's inboxes is step 0, above.)
delete from notifications where user_id = :user_id;

-- 3. The account
-- Supabase dashboard → Authentication → Users → delete, or the admin API.

-- 4. Keep the consent ledger.
-- It is the evidence that the deletion was requested and honoured. Deleting it
-- destroys the proof that everything above was lawful.
```

Tell them exactly this: what was deleted, what was anonymised, and why the
event history stays.

## Reclamo — a complaint rather than a request

Same identity check, 15 business days. If it is about something this runbook
cannot resolve, say so within the window rather than letting the clock run out;
an answer that says "we are looking at it, here is when you will hear" is inside
the law and silence is not.

---

## Notes

- **The retention job already deletes some of this on its own**: unanswered
  invitations after 180 days, rejected receipt images after 90, approved receipt
  images the moment they are approved, and read notifications after 90. Unread
  notifications are never swept — nobody has seen them yet, and deleting one
  would be the app deciding on the reader's behalf that it did not matter. See
  `src/lib/retention.ts`.
- **Bounces and complaints** write to `email_suppressions` automatically, so a
  person who marked a message as spam is already not being written to.
- **An invitation can no longer reach somebody who never agreed to hear from
  the organizer.** Since groups shipped, an invitation names an account that
  joined that organizer's group, and the address is read from `auth.users` at
  send time rather than stored. The old question — what basis we had to hold an
  address a third party typed in — no longer has a subject.
- **`email_suppressions` is still keyed by address, and must stay that way.**
  It is the one protection that has to keep working for somebody who deleted
  their account, and an id stops meaning anything at that point.
