import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, FileSpreadsheet, RefreshCw, ScrollText, Search, Upload, UserPlus, Database, Clock, ShieldCheck, FileText, Check } from "lucide-react";
import { useDB, useSession, mutate, userById } from "../lib/store";
import { planImport, SAMPLE_CSV, PROGRAMMES, type RowOutcome } from "../lib/roster";
import { courseResult, sgpa } from "../lib/grading";
import { fmtDate, fmtDateTime, relTime } from "../lib/utils";
import { Badge, Button, Card, DataList, EmptyState, Field, Input, Notice, PageHeader, SectionTitle, Select, Textarea, toast, Meter } from "../components/ui";
import { CourseGrid } from "./Home";
import type { DataRequest } from "../lib/types";

/* Courses ---------------------------------------------------------------- */

export function CoursesPage() {
  const s = useSession();
  return (
    <>
      <PageHeader eyebrow={s.role === "admin" ? "All courses" : "Semester 5 · 2025–26"} title="Courses" />
      <CourseGrid />
    </>
  );
}

/* Results (student) ------------------------------------------------------- */

export function ResultsPage() {
  const db = useDB();
  const s = useSession();
  const courses = db.courses.filter((c) => c.enrolled.includes(s.userId));
  const g = sgpa(db, s.userId);
  const rows = courses.map((c) => ({ c, r: courseResult(db, c, s.userId) }));
  return (
    <>
      <PageHeader eyebrow="Semester 5" title="Results">Internal marks update as your teachers grade. Final grades appear after the semester-end exam.</PageHeader>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card as="div" className="p-5">
          <p className="eyebrow">SGPA</p>
          <p className="font-display text-2xl font-semibold tnum">{g ?? "—"}</p>
          <p className="text-sm text-muted">{g == null ? "Calculated once final grades are published." : "Credit-weighted, 10-point scale"}</p>
        </Card>
        <Card as="div" className="p-5">
          <p className="eyebrow">Credits this semester</p>
          <p className="font-display text-2xl font-semibold tnum">{courses.reduce((x, c) => x + c.credits, 0)}</p>
          <p className="text-sm text-muted">{courses.length} courses</p>
        </Card>
      </div>
      <DataList
        caption="Course results"
        rowKey={(x) => x.c.id}
        rows={rows}
        columns={[
          { key: "c", header: "Course", primary: true, cell: (x) => <a className="text-primary-text hover:underline" href={`#course-${x.c.id}-grades`}>{x.c.code} · {x.c.title}</a> },
          { key: "cr", header: "Credits", align: "right", cell: (x) => x.c.credits },
          { key: "i", header: "Internal", align: "right", cell: (x) => `${x.r.internal} / ${x.r.internalMax}` },
          { key: "p", header: "Progress", cell: (x) => <div className="w-24 md:w-32"><Meter value={x.r.internal} max={x.r.internalMax} label={`Internal marks in ${x.c.code}`} /></div>, hideOnCard: true },
          { key: "e", header: "External", align: "right", cell: (x) => (x.r.external == null ? <span className="text-muted">Pending</span> : `${x.r.external} / ${x.r.externalMax}`) },
          { key: "g", header: "Grade", align: "right", cell: (x) => (x.r.grade ? <Badge tone={x.r.passed ? "success" : "danger"}>{x.r.grade.letter}</Badge> : <span className="text-muted">—</span>) },
        ]}
      />
    </>
  );
}

/* Roster import ---------------------------------------------------------- */

export function RosterPage() {
  const db = useDB();
  const s = useSession();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<ReturnType<typeof planImport> | null>(null);
  const [filter, setFilter] = useState<"all" | RowOutcome["kind"]>("all");
  const [done, setDone] = useState<null | { created: number; updated: number; rejected: number; enrolments: number }>(null);

  const students = db.users.filter((u) => u.role === "student");
  const counts = useMemo(() => {
    const c = { create: 0, update: 0, unchanged: 0, error: 0 };
    plan?.rows.forEach((r) => c[r.kind]++);
    return c;
  }, [plan]);

  const analyse = (csv: string, name: string) => {
    setText(csv); setFileName(name); setDone(null);
    setPlan(planImport(csv, students));
    setFilter("all");
  };

  const commit = () => {
    if (!plan) return;
    let enrolments = 0;
    mutate((d) => {
      for (const r of plan.rows) {
        if (r.kind === "create") d.users.push(r.user);
        if (r.kind === "update") { const i = d.users.findIndex((u) => u.id === r.user.id); if (i >= 0) d.users[i] = { ...d.users[i], ...r.user }; }
        if (r.kind === "create" || r.kind === "update") {
          for (const c of d.courses) {
            const matches = (c.programme === r.user.programme || c.programme === "All programmes") && c.semester === r.user.semester;
            if (matches && !c.enrolled.includes(r.user.id)) { c.enrolled.push(r.user.id); enrolments++; }
          }
        }
      }
    }, { actorId: s.userId, action: "Roster imported", detail: `${fileName || "pasted CSV"}: ${counts.create} added, ${counts.update} updated, ${counts.error} rejected` });
    setDone({ created: counts.create, updated: counts.update, rejected: counts.error, enrolments });
    toast(`Imported ${counts.create + counts.update} students`);
  };

  const errorReport = () => plan!.rows.filter((r): r is Extract<RowOutcome, { kind: "error" }> => r.kind === "error").map((r) => `Line ${r.line}: ${r.reasons.join("; ")}\n  ${r.raw}`).join("\n");

  const shown = plan?.rows.filter((r) => filter === "all" || r.kind === filter) ?? [];

  return (
    <>
      <PageHeader eyebrow="Administration" title="Roster import">Add or update a whole semester from one CSV. Nothing is saved until you review the preview.</PageHeader>

      {done ? (
        <Card className="grid gap-4 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={24} className="mt-0.5 text-success" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold">Import complete</h2>
              <p className="text-muted">{done.created} students added, {done.updated} updated, {done.enrolments} course enrolments created.</p>
              {done.rejected > 0 && <p className="text-warning">{done.rejected} rows were not imported. Fix them in the spreadsheet and import the file again; rows already imported will show as unchanged.</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {done.rejected > 0 && <Button variant="secondary" icon={Copy} onClick={() => navigator.clipboard?.writeText(errorReport()).then(() => toast("Error report copied"), () => toast("Copy blocked", "danger"))}>Copy error report</Button>}
            <Button variant="secondary" icon={RefreshCw} onClick={() => { setPlan(null); setText(""); setDone(null); }}>Import another file</Button>
          </div>
        </Card>
      ) : !plan ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="grid gap-4 p-5">
            <label htmlFor="csv-file" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border-strong px-6 py-10 text-center hover:bg-surface-2">
              <Upload size={28} className="text-muted" aria-hidden />
              <span className="font-semibold">Choose a CSV file</span>
              <span className="text-sm text-muted">Export from Excel or Google Sheets as "CSV UTF-8"</span>
            </label>
            <input id="csv-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) analyse(await f.text(), f.name); e.target.value = ""; }} />
            <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" />or paste it<span className="h-px flex-1 bg-border" /></div>
            <Field label="CSV text" htmlFor="csv-text">
              <Textarea id="csv-text" className="min-h-40 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="roll_no,full_name,email,programme,semester,division" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button icon={Search} disabled={!text.trim()} onClick={() => analyse(text, "pasted CSV")}>Check rows</Button>
              <Button variant="secondary" icon={FileSpreadsheet} onClick={() => analyse(SAMPLE_CSV, "sample-with-errors.csv")}>Try a sample file</Button>
            </div>
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="mb-3 text-base font-semibold">File format</h2>
            <table className="w-full">
              <tbody className="[&_td]:py-1 [&_td:first-child]:pr-3 [&_td:first-child]:font-mono [&_td:first-child]:text-xs">
                <tr><td>roll_no</td><td>Required. Unique. e.g. BCS23001</td></tr>
                <tr><td>full_name</td><td>Required</td></tr>
                <tr><td>email</td><td>Required. Unique</td></tr>
                <tr><td>programme</td><td>Required. One of the list below</td></tr>
                <tr><td>semester</td><td>Required. 1–8</td></tr>
                <tr><td>division</td><td>Optional. A–H</td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-muted">Programmes: {PROGRAMMES.join(", ")}.</p>
            <p className="mt-3 text-muted">A roll number already on the roster updates that student. Rows with problems are skipped and listed; the rest still import.</p>
            <p className="mt-3 text-muted">We don't ask for phone numbers, addresses or dates of birth. An LMS doesn't need them (DPDP data minimisation).</p>
          </Card>
        </div>
      ) : plan.headerError ? (
        <Notice tone="danger" icon={AlertCircle} title="We couldn't read this file">
          {plan.headerError}
          <div className="mt-3"><Button size="sm" variant="secondary" onClick={() => setPlan(null)}>Choose another file</Button></div>
        </Notice>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted"><FileText size={14} className="mr-1 inline" aria-hidden />{fileName} · {plan.rows.length} rows checked</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setPlan(null)}>Cancel</Button>
              <Button icon={UserPlus} disabled={!counts.create && !counts.update} onClick={commit}>
                Import {counts.create + counts.update} student{counts.create + counts.update === 1 ? "" : "s"}{counts.error ? `, skip ${counts.error}` : ""}
              </Button>
            </div>
          </div>
          <div role="group" aria-label="Filter rows" className="flex flex-wrap gap-2">
            {([["all", "All", plan.rows.length], ["create", "New", counts.create], ["update", "Updates", counts.update], ["unchanged", "Unchanged", counts.unchanged], ["error", "Problems", counts.error]] as const).map(([k, label, n]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded-md border px-3 py-1.5 text-sm font-medium ${filter === k ? "border-primary bg-primary-soft text-primary-text" : "border-border bg-surface text-muted hover:text-fg"}`}>
                {label} <span className="tnum">{n}</span>
              </button>
            ))}
          </div>
          <ul className="grid gap-2">
            {shown.map((r) => (
              <li key={r.line} className={`rounded-lg border bg-surface px-4 py-3 ${r.kind === "error" ? "border-danger/40" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-xs text-muted">Line {r.line}</span>
                  {r.kind === "error" ? <Badge tone="danger" icon={AlertCircle}>Will be skipped</Badge> : r.kind === "create" ? <Badge tone="success">New</Badge> : r.kind === "update" ? <Badge tone="brand">Update</Badge> : <Badge>Unchanged</Badge>}
                  {r.kind !== "error" && <span className="font-medium">{r.user.name}</span>}
                  {r.kind !== "error" && <span className="text-sm text-muted">{r.user.rollNo} · {r.user.programme} · Sem {r.user.semester}</span>}
                </div>
                {r.kind === "error" && (
                  <>
                    <p className="mt-1 break-all font-mono text-xs text-muted">{r.raw}</p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-danger">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
                  </>
                )}
                {r.kind === "update" && <p className="mt-1 text-sm text-muted">{r.changes.join(" · ")}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/* People ------------------------------------------------------------------ */

export function PeoplePage() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("student");
  const people = db.users.filter((u) => u.role === role && (`${u.name} ${u.email} ${u.rollNo ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageHeader eyebrow="Administration" title="People">{db.users.filter((u) => u.role === "student").length} students · {db.users.filter((u) => u.role === "faculty").length} faculty</PageHeader>
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <Field label="Search" htmlFor="people-q"><Input id="people-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or roll number" /></Field>
        <Field label="Role" htmlFor="people-role">
          <Select id="people-role" value={role} onChange={(e) => setRole(e.target.value)}><option value="student">Students</option><option value="faculty">Faculty</option><option value="admin">Admins</option></Select>
        </Field>
      </div>
      <DataList
        caption="People"
        rowKey={(u) => u.id}
        rows={people}
        empty={<EmptyState icon={Search} title={`No one matches "${q}"`}>Check the spelling, or search by roll number.</EmptyState>}
        columns={[
          { key: "n", header: "Name", primary: true, cell: (u) => u.name },
          { key: "r", header: role === "student" ? "Roll no." : "Email", cell: (u) => <span className="font-mono text-xs">{role === "student" ? u.rollNo : u.email}</span> },
          ...(role === "student" ? [
            { key: "p", header: "Programme", cell: (u: typeof people[number]) => `${u.programme} · Sem ${u.semester}${u.division ? ` · Div ${u.division}` : ""}` },
            { key: "c", header: "Consent", cell: (u: typeof people[number]) => (db.consents.some((c) => c.userId === u.id) ? <Badge tone="success">Given</Badge> : <Badge>Pending</Badge>) },
          ] : []),
          { key: "k", header: "Courses", align: "right" as const, cell: (u) => db.courses.filter((c) => c.enrolled.includes(u.id) || c.facultyId === u.id).length },
        ]}
      />
    </>
  );
}

/* Data & privacy (DPDP) --------------------------------------------------- */

const NOTICE_VERSION = "2025-06";

export function PrivacyPage() {
  const s = useSession();
  return s.role === "admin" ? <PrivacyAdmin /> : <PrivacyStudent />;
}

const DATA_HELD = [
  ["Identity", "Name, roll number, college email, programme, semester, division", "Enrolment and timetabling"],
  ["Coursework", "Submissions, files, exam answers, marks and feedback", "Teaching and assessment"],
  ["Attendance", "Present/absent for each lecture", "University attendance rules"],
  ["Activity", "Sign-ins and changes to marks (audit log)", "Security and fairness"],
];

function PrivacyStudent() {
  const db = useDB();
  const s = useSession();
  const consent = db.consents.find((c) => c.userId === s.userId);
  const mine = db.requests.filter((r) => r.userId === s.userId);
  const [kind, setKind] = useState<DataRequest["kind"]>("access");
  const [note, setNote] = useState("");
  return (
    <>
      <PageHeader eyebrow="Your rights under the DPDP Act, 2023" title="My data" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-6">
          <section>
            <SectionTitle>What {db.settings.shortName} holds about you</SectionTitle>
            <DataList caption="Data held" rowKey={(r) => r[0]} rows={DATA_HELD} columns={[
              { key: "a", header: "Category", primary: true, cell: (r) => r[0] },
              { key: "b", header: "What", cell: (r) => <span className="text-left">{r[1]}</span> },
              { key: "c", header: "Why", cell: (r) => r[2] },
            ]} />
            <p className="mt-3 text-sm text-muted">Stored in {db.settings.region}. Kept for {db.settings.retentionYears} years after you graduate, as the university requires for mark records, then deleted. Never sold or used for advertising.</p>
          </section>
          <section>
            <SectionTitle>Make a request</SectionTitle>
            <Card className="p-5">
              <form className="grid gap-4" onSubmit={(e) => {
                e.preventDefault();
                mutate((d) => d.requests.push({ id: `rq${Date.now()}`, userId: s.userId, kind, at: Date.now(), status: "open", note: note.trim() }),
                  { actorId: s.userId, action: "Data request filed", detail: `${kind}${note ? `: ${note.slice(0, 50)}` : ""}` });
                setNote("");
                toast("Request sent. The college must reply within 30 days.");
              }}>
                <Field label="I want to" htmlFor="rq-kind">
                  <Select id="rq-kind" value={kind} onChange={(e) => setKind(e.target.value as DataRequest["kind"])}>
                    <option value="access">Get a copy of my data</option>
                    <option value="correction">Correct something that's wrong</option>
                    <option value="erasure">Delete data the college no longer needs</option>
                  </Select>
                </Field>
                <Field label="Details (optional)" htmlFor="rq-note"><Textarea id="rq-note" className="min-h-20" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                <div><Button type="submit">Send request</Button></div>
              </form>
            </Card>
            {mine.length > 0 && (
              <ul className="mt-3 grid gap-2 text-sm">
                {mine.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2"><span className="capitalize">{r.kind} · {fmtDate(r.at)}</span><Badge tone={r.status === "open" ? "warning" : "success"}>{r.status === "open" ? "In progress" : "Done"}</Badge></li>)}
              </ul>
            )}
          </section>
        </div>
        <Card className="grid content-start gap-3 p-5">
          <h2 className="text-base font-semibold">Consent</h2>
          {consent ? (
            <>
              <Notice tone="success" icon={Check} title="You gave consent">On {fmtDate(consent.at)} to notice version {consent.version}.</Notice>
              <p className="text-sm text-muted">You can withdraw consent. The college will still keep mark records it is legally required to keep, but optional processing stops.</p>
              <Button variant="secondary" onClick={() => mutate((d) => { d.consents = d.consents.filter((c) => c.userId !== s.userId); }, { actorId: s.userId, action: "Consent withdrawn", detail: `Notice ${consent.version}` })}>Withdraw consent</Button>
            </>
          ) : (
            <>
              <p className="text-sm">{db.settings.institution} uses the data on this page to run your courses. It is stored in India and kept only as long as the university requires.</p>
              <Button onClick={() => { mutate((d) => d.consents.push({ userId: s.userId, version: NOTICE_VERSION, at: Date.now() }), { actorId: s.userId, action: "Consent given", detail: `Notice ${NOTICE_VERSION}` }); toast("Consent recorded"); }}>I agree</Button>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function PrivacyAdmin() {
  const db = useDB();
  const s = useSession();
  const students = db.users.filter((u) => u.role === "student");
  const consented = students.filter((u) => db.consents.some((c) => c.userId === u.id)).length;
  const open = db.requests.filter((r) => r.status === "open");
  const [years, setYears] = useState(String(db.settings.retentionYears));
  return (
    <>
      <PageHeader eyebrow="Administration" title="Data & privacy">How this college meets the Digital Personal Data Protection Act, 2023.</PageHeader>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Card as="div" className="p-5"><Database size={20} className="mb-2 text-primary-text" aria-hidden /><p className="eyebrow">Data residency</p><p className="font-semibold">{db.settings.region}</p><p className="text-sm text-muted">Database, files and backups. No copy leaves India.</p></Card>
        <Card as="div" className="p-5"><ShieldCheck size={20} className="mb-2 text-primary-text" aria-hidden /><p className="eyebrow">Consent</p><p className="font-semibold tnum">{consented} of {students.length} students</p><div className="mt-2"><Meter value={consented} max={students.length} label="Consent coverage" /></div></Card>
        <Card as="div" className="p-5"><Clock size={20} className="mb-2 text-primary-text" aria-hidden /><p className="eyebrow">Retention</p><p className="font-semibold">{db.settings.retentionYears} years after graduation</p><p className="text-sm text-muted">Then records are deleted automatically.</p></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Open requests from students</SectionTitle>
          {open.length ? (
            <ul className="grid gap-2">
              {open.map((r) => {
                const u = userById(db, r.userId)!;
                const daysLeft = 30 - Math.floor((Date.now() - r.at) / 86400_000);
                return (
                  <Card as="li" key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1"><p className="font-medium capitalize">{r.kind} · {u.name}</p><p className="text-sm text-muted">{r.note || "No details"} · filed {relTime(r.at)}</p></div>
                    <Badge tone={daysLeft < 7 ? "danger" : "warning"}>{daysLeft} days left</Badge>
                    <Button size="sm" variant="secondary" onClick={() => mutate((d) => { d.requests.find((x) => x.id === r.id)!.status = "closed"; }, { actorId: s.userId, action: "Data request closed", detail: `${r.kind} for ${u.rollNo}` })}>Mark done</Button>
                  </Card>
                );
              })}
            </ul>
          ) : <EmptyState icon={CheckCircle2} title="No open requests">When a student asks for a copy, correction or deletion of their data, it appears here with a 30-day clock.</EmptyState>}
        </section>
        <section>
          <SectionTitle>Retention policy</SectionTitle>
          <Card className="p-5">
            <form className="grid gap-4" onSubmit={(e) => {
              e.preventDefault();
              const y = Number(years);
              if (!Number.isInteger(y) || y < 1 || y > 50) return toast("Enter a whole number of years from 1 to 50", "danger");
              mutate((d) => { d.settings.retentionYears = y; }, { actorId: s.userId, action: "Retention changed", detail: `${db.settings.retentionYears} → ${y} years` });
              toast("Retention policy updated");
            }}>
              <Field label="Keep student records for (years after graduation)" htmlFor="ret-years" hint="Check your university's ordinance; many require mark records for at least 5 years.">
                <Input id="ret-years" type="number" min={1} max={50} value={years} onChange={(e) => setYears(e.target.value)} className="w-28" />
              </Field>
              <div><Button type="submit">Save policy</Button></div>
            </form>
          </Card>
        </section>
      </div>
    </>
  );
}

/* Audit log -------------------------------------------------------------- */

export function AuditPage() {
  const db = useDB();
  const [q, setQ] = useState("");
  const rows = db.audit.filter((a) => `${a.action} ${a.detail} ${userById(db, a.actorId)?.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader eyebrow="Administration" title="Audit log">Every change to marks, rosters, consent and settings. Entries can't be edited or deleted.</PageHeader>
      <div className="mb-4 max-w-md"><Field label="Search the log" htmlFor="audit-q"><Input id="audit-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. BCS23004, Grade changed" /></Field></div>
      <DataList
        caption="Audit log"
        rowKey={(a) => a.id}
        rows={rows}
        empty={<EmptyState icon={ScrollText} title="No matching entries">Try a roll number or an action like "Mark entered".</EmptyState>}
        columns={[
          { key: "w", header: "When", cell: (a) => <span className="whitespace-nowrap tnum">{fmtDateTime(a.at)}</span> },
          { key: "a", header: "Action", primary: true, cell: (a) => a.action },
          { key: "b", header: "By", cell: (a) => userById(db, a.actorId)?.name ?? a.actorId },
          { key: "d", header: "Detail", cell: (a) => <span className="text-muted">{a.detail}</span> },
        ]}
      />
    </>
  );
}

/* Branding --------------------------------------------------------------- */

const HUES = [
  { h: 172, name: "Mandovi teal" },
  { h: 255, name: "Monsoon indigo" },
  { h: 145, name: "Paddy green" },
  { h: 25, name: "Kokum red" },
  { h: 300, name: "Jamun purple" },
  { h: 220, name: "Arabian blue" },
];

export function BrandPage() {
  const db = useDB();
  const s = useSession();
  const [name, setName] = useState(db.settings.institution);
  const [short, setShort] = useState(db.settings.shortName);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Branding">Your college's name and colour across every screen. Text contrast stays above WCAG AA whichever colour you choose.</PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <form className="grid gap-4" onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 3 || !short.trim()) return toast("Both names are needed", "danger");
            mutate((d) => { d.settings.institution = name.trim(); d.settings.shortName = short.trim(); }, { actorId: s.userId, action: "Branding changed", detail: `Name: ${name.trim()}` });
            toast("Saved");
          }}>
            <Field label="Institution name" htmlFor="b-name"><Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Short name" htmlFor="b-short" hint="Shown next to the logo."><Input id="b-short" value={short} onChange={(e) => setShort(e.target.value)} /></Field>
            <div><Button type="submit">Save names</Button></div>
          </form>
        </Card>
        <Card className="p-5">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">Brand colour</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {HUES.map((x) => {
                const on = db.settings.brandHue === x.h;
                return (
                  <label key={x.h} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${on ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2"}`}>
                    <input type="radio" name="hue" id={`hue-${x.h}`} className="sr-only" checked={on} onChange={() => mutate((d) => { d.settings.brandHue = x.h; }, { actorId: s.userId, action: "Brand colour changed", detail: x.name })} />
                    <span aria-hidden className="h-5 w-5 shrink-0 rounded-sm" style={{ background: `oklch(0.45 0.09 ${x.h})` }} />
                    <span className="min-w-0 truncate">{x.name}</span>
                    {on && <Check size={14} className="ml-auto shrink-0" aria-label="selected" />}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-5 grid gap-2 rounded-md border border-border p-4">
            <p className="eyebrow">Preview</p>
            <div className="flex flex-wrap gap-2"><Button size="sm">Primary action</Button><Button size="sm" variant="secondary">Secondary</Button><Badge tone="brand">Badge</Badge></div>
            <a href="#brand" className="text-sm font-medium text-primary-text underline">A link in body text</a>
          </div>
        </Card>
      </div>
    </>
  );
}
