# Mandovi LMS

**The exam-ready learning platform for Indian colleges, with student data kept in India.**

A learning management system for a ~2,000-student college, built from the *Dempo Learn LMS Takeover Brief*.
Every feature traces back to one of the brief's four reasons a college would pay instead of using Google Classroom:

| Premise | What Mandovi does | Where |
|---|---|---|
| 1. Exam-grade reliability | Server-anchored timer (`deadlineAt`), auto-save after every answer, offline outbox that survives reload, reconnect sync, auto-submit at time limit, live faculty monitor | `src/pages/Exam.tsx` |
| 2. Data residency & DPDP | Consent capture with notice version, "what we hold" table, access/correction/erasure requests with 30-day clock, retention policy, immutable audit log, data-minimised roster (no phone/DOB) | `src/pages/Admin.tsx` (Privacy, Audit), `src/lib/store.ts` |
| 3. Real academic gradebook | Internal/external split, ISA + assignments + attendance + semester-end components, UGC 10-point grades (O…F), pass rule on total *and* external, SGPA, CSV mark sheet | `src/lib/grading.ts`, `src/pages/Course.tsx` |
| 4. Ownership | Institution name and brand colour set by the admin; one hue token re-themes the whole app at WCAG AA | `src/index.css`, Branding page |

## The eight core LMS jobs

| Job | Status | Evidence |
|---|---|---|
| Roster & enrolment | Working, better than Classroom | CSV import with per-row validation, preview, partial import, auto-enrolment (`src/lib/roster.ts`) |
| Content delivery | Working | Stream + Classwork grouped by topic |
| Assignment lifecycle | Working | Due dates, late flag, closed-to-late option, unsubmit/resubmit, return with marks + feedback |
| Assessment & grading | Better than Classroom | Weighted Indian-university gradebook, audit-logged mark changes |
| Communication | Partial | Course announcements, due-soon reminders on home; no email/SMS yet |
| Roles & permissions | Partial | Student / faculty / admin views and route guards; enforced client-side only in this prototype |
| Records & reporting | Working | Attendance with 75% rule, results/SGPA, audit log, CSV export |
| Integrity & accessibility | Partial | Keyboard tabs, skip link, labelled controls, AA contrast, 360px layouts; no plagiarism check |

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # production build in dist/
npm run build:single   # one self-contained HTML file in dist-single/
```

Use the **Demo · view as** switcher to move between Student, Faculty and Admin. **Reset demo data** restores the seed.
To see exam resilience: Student → Exams → ISA 1 → Start → *Simulate WiFi drop* → answer → reload → *Restore WiFi*.

## Known limits (honest list)

- **No backend yet.** Data lives in the browser's `localStorage` behind one seam (`mutate()` in `src/lib/store.ts`). The production plan is a Postgres API hosted in an Indian region; the server must own the exam clock and permissions.
- Authentication is a demo role switcher, not real sign-in.
- File uploads record the file name only.
- Short exam answers get provisional marks until a teacher reviews them.

## Design rationale

- **Who it's for:** students aged 18–24 on phones over patchy campus WiFi, and faculty marking for hours at a desk.
- **Palette:** a deep river teal (the Mandovi, Goa) instead of default SaaS blue. Every colour derives from one `--brand-h` hue in OKLCH with fixed lightness, so any brand colour a college picks keeps body text ≥ 4.5:1. Semantic colours (success/warning/danger) always come with text or an icon; colour never carries meaning alone.
- **Type:** Bricolage Grotesque for headings (some character, used sparingly), Instrument Sans at 15px for long reading sessions, JetBrains Mono for roll numbers, codes and the exam timer.
- **Density:** 8px rhythm, cards only for things you act on, tables become cards below 768px.
- **Microcopy:** every empty state and error says what happened and what to do next (e.g. the exam's offline banner: "You're offline. Keep going.").
- **Deliberately left alone:** no gamification, no chat, no video conferencing, no AI tutor. Google gives those away, and none of them serve the four premises.

## Structure

```
src/
  index.css            design tokens (Tailwind v4 @theme), light + dark
  components/ui.tsx    Button, Badge, Card, Field, Tabs, DataList… (class-variance-authority)
  components/Shell.tsx app shell, navigation, demo role switcher
  lib/                 types, seed data, store, grading, roster import, router
  pages/               Home, Course, Assignment, Exam, Admin (results, roster, people, privacy, audit, branding)
```
