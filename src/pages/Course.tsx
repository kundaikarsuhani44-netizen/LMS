import { useMemo, useState } from "react";
import { BookOpen, ClipboardList, Copy, FileText, Link2, NotebookText, Plus, Send, Users, CalendarCheck, Check, X, Lock } from "lucide-react";
import { useDB, useSession, mutate, uid, courseById, userById } from "../lib/store";
import { courseResult, attendancePercent } from "../lib/grading";
import { go, href } from "../lib/router";
import { fmtDateTime, relTime } from "../lib/utils";
import { Avatar, Badge, Button, Card, DataList, EmptyState, Field, Input, Notice, PageHeader, SectionTitle, Select, Tabs, Textarea, toast } from "../components/ui";
import { Posts } from "./Home";
import type { Course } from "../lib/types";

type Tab = "stream" | "classwork" | "people" | "grades" | "attendance";

export function CoursePage({ id, tab }: { id: string; tab: string }) {
  const db = useDB();
  const s = useSession();
  const course = courseById(db, id);
  if (!course) return <EmptyState icon={BookOpen} title="This course doesn't exist">It may have been archived. <a href="#courses" className="text-primary-text underline">Back to courses</a></EmptyState>;
  const teacher = userById(db, course.facultyId);
  const canTeach = s.role !== "student";
  const t = (["stream", "classwork", "people", "grades", "attendance"].includes(tab) ? tab : "stream") as Tab;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "stream", label: "Stream" },
    { id: "classwork", label: "Classwork" },
    { id: "people", label: "People", count: course.enrolled.length },
    { id: "grades", label: canTeach ? "Gradebook" : "My marks" },
    { id: "attendance", label: "Attendance" },
  ];

  return (
    <>
      <PageHeader eyebrow={<><a href="#courses" className="hover:underline">Courses</a> / {course.code}</>} title={course.title}>
        {teacher?.name} · {course.credits} credits · {course.room} · Semester {course.semester}
      </PageHeader>
      <Tabs label="Course sections" tabs={tabs} value={t} onChange={(x) => go({ name: "course", id, tab: x })} />
      <div role="tabpanel" aria-labelledby={`tab-${t}`}>
        {t === "stream" && <Stream course={course} canPost={canTeach} />}
        {t === "classwork" && <Classwork course={course} canEdit={canTeach} />}
        {t === "people" && <People course={course} showCode={canTeach} />}
        {t === "grades" && (canTeach ? <Gradebook course={course} /> : <MyMarks course={course} studentId={s.userId} />)}
        {t === "attendance" && (canTeach ? <AttendanceTaker course={course} /> : <MyAttendance course={course} studentId={s.userId} />)}
      </div>
    </>
  );
}

/* Stream ------------------------------------------------------------------ */

function Stream({ course, canPost }: { course: Course; canPost: boolean }) {
  const db = useDB();
  const s = useSession();
  const [body, setBody] = useState("");
  const posts = db.announcements.filter((a) => a.courseId === course.id).sort((a, b) => b.at - a.at);
  const upcoming = db.assignments.filter((a) => a.courseId === course.id && a.dueAt > Date.now()).sort((a, b) => a.dueAt - b.dueAt);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="grid min-w-0 content-start gap-4">
        {canPost && (
          <form
            className="grid gap-3 rounded-lg border border-border bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!body.trim()) return;
              mutate((d) => { d.announcements.push({ id: uid("an"), courseId: course.id, authorId: s.userId, body: body.trim(), at: Date.now() }); },
                { actorId: s.userId, action: "Announcement posted", detail: `${course.code}: ${body.trim().slice(0, 60)}` });
              setBody("");
              toast(`Posted to ${course.enrolled.length} students`);
            }}
          >
            <label htmlFor="announce" className="text-sm font-semibold">Announce something to your class</label>
            <Textarea id="announce" value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Tomorrow's lecture moves to Lab 2." className="min-h-20" />
            <div className="flex justify-end"><Button type="submit" icon={Send} disabled={!body.trim()}>Post</Button></div>
          </form>
        )}
        <Posts db={db} posts={posts} showCourse={false} />
      </div>
      <aside>
        <Card className="p-4">
          <h2 className="mb-3 text-base font-semibold">Coming up</h2>
          {upcoming.length ? (
            <ul className="grid gap-3 text-sm">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <p className="text-xs text-muted">Due {fmtDateTime(a.dueAt)}</p>
                  <a href={href({ name: "assignment", id: a.id })} className="font-medium text-primary-text hover:underline">{a.title}</a>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No work due soon.</p>}
        </Card>
      </aside>
    </div>
  );
}

/* Classwork --------------------------------------------------------------- */

function Classwork({ course, canEdit }: { course: Course; canEdit: boolean }) {
  const db = useDB();
  const s = useSession();
  const [creating, setCreating] = useState<null | "assignment" | "material">(null);
  const materials = db.materials.filter((m) => m.courseId === course.id);
  const assignments = db.assignments.filter((a) => a.courseId === course.id);
  const topics = [...new Set([...assignments.map((a) => a.topic), ...materials.map((m) => m.topic)])].sort().reverse();

  return (
    <div className="grid gap-6">
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button icon={Plus} onClick={() => setCreating("assignment")}>Assignment</Button>
          <Button variant="secondary" icon={Plus} onClick={() => setCreating("material")}>Material</Button>
        </div>
      )}
      {creating && <CreateWork course={course} kind={creating} topics={topics} onDone={() => setCreating(null)} />}
      {!topics.length && <EmptyState icon={NotebookText} title="No classwork yet">{canEdit ? "Add an assignment or upload slides, and students will see them here, grouped by topic." : "Your teacher hasn't posted any material yet. It will appear here, grouped by topic."}</EmptyState>}
      {topics.map((topic) => (
        <section key={topic}>
          <h2 className="mb-2 border-b border-border pb-2 text-lg font-semibold">{topic}</h2>
          <ul className="grid gap-1">
            {assignments.filter((a) => a.topic === topic).map((a) => {
              const sub = db.submissions.find((x) => x.assignmentId === a.id && x.studentId === s.userId);
              const turnedIn = db.submissions.filter((x) => x.assignmentId === a.id).length;
              return (
                <li key={a.id}>
                  <a href={href({ name: "assignment", id: a.id })} className="flex items-center gap-3 rounded-md px-2 py-3 hover:bg-surface-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text"><ClipboardList size={18} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{a.title}</span>
                      <span className="block text-sm text-muted">Due {fmtDateTime(a.dueAt)} · {a.points} marks</span>
                    </span>
                    {canEdit ? <Badge>{turnedIn}/{course.enrolled.length} handed in</Badge> : <SubmissionBadge sub={sub} dueAt={a.dueAt} />}
                  </a>
                </li>
              );
            })}
            {materials.filter((m) => m.topic === topic).map((m) => {
              const Icon = m.kind === "pdf" ? FileText : m.kind === "link" ? Link2 : NotebookText;
              return (
                <li key={m.id} className="flex items-center gap-3 rounded-md px-2 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"><Icon size={18} aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{m.title}</span>
                    <span className="block text-sm text-muted">{m.detail} · posted {relTime(m.at)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function SubmissionBadge({ sub, dueAt }: { sub?: { status: string; submittedAt: number; score?: number }; dueAt: number }) {
  if (sub?.status === "returned") return <Badge tone="success">Returned · {sub.score}</Badge>;
  if (sub) return <Badge tone={sub.submittedAt > dueAt ? "warning" : "brand"}>{sub.submittedAt > dueAt ? "Handed in late" : "Handed in"}</Badge>;
  if (dueAt < Date.now()) return <Badge tone="danger">Missing</Badge>;
  return <Badge>Assigned</Badge>;
}

function CreateWork({ course, kind, topics, onDone }: { course: Course; kind: "assignment" | "material"; topics: string[]; onDone: () => void }) {
  const s = useSession();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState(topics[0] ?? "General");
  const [body, setBody] = useState("");
  const [due, setDue] = useState(() => new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10));
  const [points, setPoints] = useState("10");
  const [late, setLate] = useState(true);
  const [error, setError] = useState("");
  const asgComp = course.scheme.find((c) => c.source === "assignments");

  return (
    <Card className="p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim().length < 3) return setError("Give it a title of at least 3 characters so students can find it.");
          if (kind === "assignment") {
            const dueAt = new Date(`${due}T23:59`).getTime();
            mutate((d) => d.assignments.push({ id: uid("as"), courseId: course.id, topic, title: title.trim(), instructions: body.trim(), dueAt, points: Math.max(1, Number(points) || 10), componentId: asgComp?.id, allowLate: late, createdAt: Date.now() }),
              { actorId: s.userId, action: "Assignment created", detail: `${course.code}: ${title.trim()}` });
            toast("Assignment posted. Students can see it now.");
          } else {
            mutate((d) => d.materials.push({ id: uid("m"), courseId: course.id, topic, title: title.trim(), kind: "note", detail: body.trim() || "Note", at: Date.now() }),
              { actorId: s.userId, action: "Material posted", detail: `${course.code}: ${title.trim()}` });
            toast("Material posted");
          }
          onDone();
        }}
      >
        <h2 className="text-lg font-semibold">New {kind}</h2>
        <Field label="Title" htmlFor="cw-title" error={error}>
          <Input id="cw-title" value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }} aria-invalid={!!error} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Topic" htmlFor="cw-topic" hint="Groups items on the Classwork page.">
            <Input id="cw-topic" list="cw-topics" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <datalist id="cw-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
          </Field>
          {kind === "assignment" && (
            <Field label="Due date" htmlFor="cw-due" hint="Due at 11:59 pm on this day.">
              <Input id="cw-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          )}
        </div>
        <Field label={kind === "assignment" ? "Instructions" : "Description"} htmlFor="cw-body">
          <Textarea id="cw-body" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {kind === "assignment" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marks" htmlFor="cw-points" hint={asgComp ? `Counts toward "${asgComp.name}" (${asgComp.max} internal marks).` : undefined}>
              <Input id="cw-points" type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 self-center text-sm">
              <input id="cw-late" type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              Accept late work (marked as late)
            </label>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
          <Button type="submit">Post {kind}</Button>
        </div>
      </form>
    </Card>
  );
}

/* People ------------------------------------------------------------------ */

function People({ course, showCode }: { course: Course; showCode: boolean }) {
  const db = useDB();
  const teacher = userById(db, course.facultyId)!;
  const students = course.enrolled.map((id) => userById(db, id)!).filter(Boolean).sort((a, b) => (a.rollNo ?? "").localeCompare(b.rollNo ?? ""));
  return (
    <div className="grid gap-6">
      {showCode && (
        <Notice icon={Users} title={`Join code: ${course.joinCode}`}>
          Students added by roster import are enrolled automatically. Give this code only to someone who is missing.
          <Button size="sm" variant="secondary" icon={Copy} className="ml-2 mt-2 sm:mt-0" onClick={() => { navigator.clipboard?.writeText(course.joinCode).then(() => toast("Join code copied"), () => toast("Copy blocked. Select the code instead.", "info")); }}>Copy</Button>
        </Notice>
      )}
      <section>
        <SectionTitle>Teacher</SectionTitle>
        <div className="flex items-center gap-3"><Avatar name={teacher.name} /><span className="font-medium">{teacher.name}</span></div>
      </section>
      <section>
        <SectionTitle>Students <span className="text-muted tnum">· {students.length}</span></SectionTitle>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {students.map((u) => (
            <li key={u.id} className="flex items-center gap-3 border-b border-border py-2.5">
              <Avatar name={u.name} size={28} />
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              <span className="font-mono text-xs text-muted">{u.rollNo}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* Gradebook (faculty) ----------------------------------------------------- */

function Gradebook({ course }: { course: Course }) {
  const db = useDB();
  const s = useSession();
  const students = course.enrolled.map((id) => userById(db, id)!).sort((a, b) => (a.rollNo ?? "").localeCompare(b.rollNo ?? ""));
  const results = useMemo(() => new Map(students.map((u) => [u.id, courseResult(db, course, u.id)])), [db, course, students]);
  const intMax = course.scheme.filter((c) => c.kind === "internal").reduce((x, c) => x + c.max, 0);
  const extMax = course.scheme.filter((c) => c.kind === "external").reduce((x, c) => x + c.max, 0);

  const setMark = (sid: string, compId: string, raw: string, max: number) => {
    const key = `${course.id}:${sid}:${compId}`;
    const prev = db.marks[key];
    if (raw.trim() === "") {
      if (prev == null) return;
      mutate((d) => { delete d.marks[key]; }, { actorId: s.userId, action: "Mark cleared", detail: `${course.code} · ${userById(db, sid)?.rollNo} · ${compId}: ${prev} → blank` });
      return;
    }
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0 || v > max) { toast(`Enter a number from 0 to ${max}`, "danger"); return; }
    if (v === prev) return;
    mutate((d) => { d.marks[key] = v; }, { actorId: s.userId, action: "Mark entered", detail: `${course.code} · ${userById(db, sid)?.rollNo} · ${course.scheme.find((c) => c.id === compId)?.name}: ${prev ?? "blank"} → ${v}` });
  };

  const copyCSV = () => {
    const head = ["roll_no", "name", ...course.scheme.map((c) => `${c.name} (/${c.max})`), `internal (/${intMax})`, `external (/${extMax})`, "total (/100)", "grade"];
    const lines = students.map((u) => {
      const r = results.get(u.id)!;
      return [u.rollNo, u.name, ...r.parts.map((p) => p.marks ?? ""), r.internal, r.external ?? "", r.total ?? "", r.grade?.letter ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [head.join(","), ...lines].join("\n");
    navigator.clipboard?.writeText(csv).then(() => toast("Mark sheet copied as CSV. Paste it into a spreadsheet."), () => toast("Your browser blocked copying", "danger"));
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm text-muted">
          <p>Internal {intMax} + external {extMax} = 100. Pass: {db.settings.passPercent}% overall and {db.settings.passPercent}% in the external exam.</p>
          <p>Blue columns are filled in automatically from online tests, assignments and attendance. Every change is written to the audit log.</p>
        </div>
        <Button variant="secondary" icon={Copy} onClick={copyCSV}>Copy mark sheet (CSV)</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Gradebook for {course.code}</caption>
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left align-bottom">
              <th scope="col" className="sticky left-0 z-[1] bg-surface-2 px-3 py-2 font-semibold">Student</th>
              {course.scheme.map((c) => (
                <th key={c.id} scope="col" className="px-2 py-2 text-right text-xs font-semibold">
                  <span className={c.source === "manual" ? "text-fg" : "text-primary-text"}>{c.name}</span>
                  <span className="block font-normal text-muted">/{c.max} · {c.kind}{c.source !== "manual" ? " · auto" : ""}</span>
                </th>
              ))}
              <th scope="col" className="px-2 py-2 text-right text-xs font-semibold">Total<span className="block font-normal text-muted">/100</span></th>
              <th scope="col" className="px-3 py-2 text-xs font-semibold">Grade</th>
            </tr>
          </thead>
          <tbody>
            {students.map((u) => {
              const r = results.get(u.id)!;
              return (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <th scope="row" className="sticky left-0 z-[1] bg-surface px-3 py-1.5 text-left font-normal">
                    <span className="block font-medium">{u.name}</span>
                    <span className="font-mono text-xs text-muted">{u.rollNo}</span>
                  </th>
                  {r.parts.map((p) => (
                    <td key={p.comp.id} className="px-2 py-1.5 text-right tnum">
                      {p.comp.source === "manual" ? (
                        <input
                          aria-label={`${p.comp.name} for ${u.name}, out of ${p.comp.max}`}
                          defaultValue={p.marks ?? ""}
                          key={`${p.marks}`}
                          inputMode="decimal"
                          onBlur={(e) => setMark(u.id, p.comp.id, e.target.value, p.comp.max)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          placeholder="—"
                          className="h-8 w-16 rounded-sm border border-border bg-surface px-2 text-right tnum hover:border-border-strong"
                        />
                      ) : (
                        <span className={p.marks == null ? "text-muted" : "text-primary-text"}>{p.marks ?? "—"}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-semibold tnum">{r.total ?? <span className="font-normal text-muted">pending</span>}</td>
                  <td className="px-3 py-1.5">
                    {r.grade ? <Badge tone={r.passed ? "success" : "danger"}>{r.grade.letter}{!r.passed && " · fail"}</Badge> : <span className="text-xs text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* My marks (student) ------------------------------------------------------ */

function MyMarks({ course, studentId }: { course: Course; studentId: string }) {
  const db = useDB();
  const r = courseResult(db, course, studentId);
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
      <DataList
        caption={`Marks in ${course.code}`}
        rowKey={(p) => p.comp.id}
        rows={r.parts}
        columns={[
          { key: "c", header: "Component", primary: true, cell: (p) => p.comp.name },
          { key: "k", header: "Type", cell: (p) => (p.comp.kind === "internal" ? "Internal" : "External") },
          { key: "m", header: "Marks", align: "right", cell: (p) => (p.marks == null ? <span className="text-muted">Not yet</span> : <span className="tnum">{p.marks} / {p.comp.max}</span>) },
        ]}
      />
      <Card className="p-5">
        <p className="eyebrow">Internal so far</p>
        <p className="font-display text-2xl font-semibold tnum">{r.internal} <span className="text-base font-normal text-muted">/ {r.internalMax}</span></p>
        <div className="my-4 border-t border-border" />
        {r.total != null ? (
          <>
            <p className="eyebrow">Final</p>
            <p className="font-display text-2xl font-semibold tnum">{r.total}/100 · {r.grade?.letter}</p>
            <p className="text-sm text-muted">{r.grade?.label} · {r.grade?.points} grade points</p>
          </>
        ) : (
          <p className="text-sm text-muted">Your final grade appears once the semester-end exam is marked.</p>
        )}
      </Card>
    </div>
  );
}

/* Attendance -------------------------------------------------------------- */

function AttendanceTaker({ course }: { course: Course }) {
  const db = useDB();
  const s = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const existing = db.attendance.find((a) => a.courseId === course.id && a.date === today);
  const [present, setPresent] = useState<Set<string>>(() => new Set(existing?.present ?? course.enrolled));
  const [taking, setTaking] = useState(false);
  const students = course.enrolled.map((id) => userById(db, id)!).sort((a, b) => (a.rollNo ?? "").localeCompare(b.rollNo ?? ""));
  const sessions = db.attendance.filter((a) => a.courseId === course.id).length;

  const save = () => {
    mutate((d) => {
      const i = d.attendance.findIndex((a) => a.courseId === course.id && a.date === today);
      const rec = { id: existing?.id ?? uid("at"), courseId: course.id, date: today, slot: "Lecture", present: [...present] };
      if (i >= 0) d.attendance[i] = rec; else d.attendance.push(rec);
    }, { actorId: s.userId, action: existing ? "Attendance corrected" : "Attendance taken", detail: `${course.code} ${today}: ${present.size}/${course.enrolled.length} present` });
    setTaking(false);
    toast(`Saved: ${present.size} of ${course.enrolled.length} present`);
  };

  if (taking) {
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Tap a name to mark absent. Everyone starts as present.</p>
          <p className="font-semibold tnum">{present.size} / {course.enrolled.length} present</p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((u) => {
            const on = present.has(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPresent((p) => { const n = new Set(p); if (on) n.delete(u.id); else n.add(u.id); return n; })}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left ${on ? "border-border bg-surface" : "border-danger/50 bg-danger-soft"}`}
                >
                  {on ? <Check size={18} className="text-success" aria-hidden /> : <X size={18} className="text-danger" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{u.name}</span>
                  <span className="text-xs font-semibold">{on ? "Present" : "Absent"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setTaking(false)}>Cancel</Button><Button onClick={save}>Save attendance</Button></div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{sessions} sessions recorded. Students below {db.settings.attendanceMin}% are flagged.</p>
        <Button icon={CalendarCheck} onClick={() => setTaking(true)}>{existing ? "Correct today's attendance" : "Take today's attendance"}</Button>
      </div>
      <DataList
        caption={`Attendance in ${course.code}`}
        rowKey={(u) => u.id}
        rows={students}
        columns={[
          { key: "n", header: "Student", primary: true, cell: (u) => <span>{u.name} <span className="font-mono text-xs font-normal text-muted">{u.rollNo}</span></span> },
          { key: "p", header: "Present", align: "right", cell: (u) => { const a = attendancePercent(db, course.id, u.id); return a ? `${a.present}/${a.total}` : "—"; } },
          { key: "pct", header: "Attendance", align: "right", cell: (u) => { const a = attendancePercent(db, course.id, u.id); if (!a) return "—"; const low = a.pct < db.settings.attendanceMin; return low ? <Badge tone="danger">{Math.round(a.pct)}% · below {db.settings.attendanceMin}</Badge> : <span className="tnum">{Math.round(a.pct)}%</span>; } },
        ]}
      />
    </div>
  );
}

function MyAttendance({ course, studentId }: { course: Course; studentId: string }) {
  const db = useDB();
  const a = attendancePercent(db, course.id, studentId);
  const sessions = db.attendance.filter((x) => x.courseId === course.id).sort((x, y) => y.date.localeCompare(x.date));
  if (!a) return <EmptyState icon={CalendarCheck} title="No attendance recorded yet">Your teacher's records will appear here after the first lecture.</EmptyState>;
  const low = a.pct < db.settings.attendanceMin;
  const needed = Math.max(0, Math.ceil((db.settings.attendanceMin / 100 * a.total - a.present) / (1 - db.settings.attendanceMin / 100)));
  return (
    <div className="grid gap-4">
      <Notice tone={low ? "warning" : "success"} icon={low ? Lock : Check} title={`${Math.round(a.pct)}% attendance · ${a.present} of ${a.total} lectures`}>
        {low ? `You need ${db.settings.attendanceMin}% to sit the semester-end exam. Attend the next ${needed} lectures in a row to get back above it.` : `You're above the ${db.settings.attendanceMin}% requirement.`}
      </Notice>
      <ul className="flex flex-wrap gap-1.5" aria-label="Lecture by lecture">
        {sessions.map((x) => {
          const p = x.present.includes(studentId);
          return (
            <li key={x.id} className={`rounded-sm px-2 py-1 text-xs font-medium tnum ${p ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
              {new Date(x.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {p ? "P" : "A"}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">P = present, A = absent.</p>
    </div>
  );
}
