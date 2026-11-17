import { AlertTriangle, ArrowRight, BookOpen, CalendarClock, CheckCircle2, ClipboardList, FileWarning, Megaphone, ShieldCheck, Timer, Upload, Users } from "lucide-react";
import { useDB, useSession, coursesFor, userById, courseById } from "../lib/store";
import { attendancePercent } from "../lib/grading";
import { href } from "../lib/router";
import { fmtDateTime, relTime } from "../lib/utils";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, buttonStyles, Notice } from "../components/ui";
import type { DB } from "../lib/types";

export function HomePage() {
  const s = useSession();
  if (s.role === "admin") return <AdminHome />;
  if (s.role === "faculty") return <FacultyHome />;
  return <StudentHome />;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function StudentHome() {
  const db = useDB();
  const s = useSession();
  const me = userById(db, s.userId)!;
  const courses = coursesFor(db, s);
  const ids = new Set(courses.map((c) => c.id));
  const now = Date.now();

  const todo = db.assignments
    .filter((a) => ids.has(a.courseId))
    .map((a) => ({ a, sub: db.submissions.find((x) => x.assignmentId === a.id && x.studentId === s.userId) }))
    .filter((x) => !x.sub && (x.a.dueAt > now || x.a.allowLate))
    .sort((x, y) => x.a.dueAt - y.a.dueAt);

  const exams = db.exams.filter((e) => ids.has(e.courseId) && e.closesAt > now && !db.attempts.some((t) => t.examId === e.id && t.studentId === s.userId && t.submittedAt));
  const lowAttendance = courses
    .map((c) => ({ c, a: attendancePercent(db, c.id, s.userId) }))
    .filter((x) => x.a && x.a.pct < db.settings.attendanceMin);
  const posts = db.announcements.filter((a) => ids.has(a.courseId)).sort((a, b) => b.at - a.at).slice(0, 4);
  const consented = db.consents.some((c) => c.userId === s.userId);

  return (
    <>
      <PageHeader eyebrow={`Semester ${me.semester} · ${me.programme}`} title={`${greeting()}, ${me.name.split(" ")[0]}`}>
        {todo.length ? `${todo.length} piece${todo.length > 1 ? "s" : ""} of work to hand in, ${exams.length} exam${exams.length === 1 ? "" : "s"} open or coming up.` : "Nothing due right now."}
      </PageHeader>

      {!consented && (
        <Notice tone="info" icon={ShieldCheck} title="Review how the college uses your data" className="mb-6">
          The college needs your consent under the DPDP Act before it stores your coursework. <a className="font-semibold text-primary-text underline" href="#privacy">Review and decide</a>
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-6">
          {exams.length > 0 && (
            <section>
              <SectionTitle>Exams</SectionTitle>
              <div className="grid gap-2">
                {exams.map((e) => {
                  const open = e.opensAt <= now;
                  const c = courseById(db, e.courseId)!;
                  return (
                    <a key={e.id} href={href({ name: "exam", id: e.id })} className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-text"><Timer size={20} aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{e.title}</span>
                        <span className="block text-sm text-muted">{c.code} · {e.durationMin} min · {open ? `closes ${relTime(e.closesAt)}` : `opens ${fmtDateTime(e.opensAt)}`}</span>
                      </span>
                      {open ? <Badge tone="success">Open now</Badge> : <Badge>Scheduled</Badge>}
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <SectionTitle>To hand in</SectionTitle>
            {todo.length ? (
              <ul className="grid gap-2">
                {todo.map(({ a }) => {
                  const c = courseById(db, a.courseId)!;
                  const overdue = a.dueAt < now;
                  const soon = !overdue && a.dueAt - now < 2 * 86400_000;
                  return (
                    <li key={a.id}>
                      <a href={href({ name: "assignment", id: a.id })} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
                        <ClipboardList size={20} className="shrink-0 text-muted" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{a.title}</span>
                          <span className="block text-sm text-muted">{c.code} · due {fmtDateTime(a.dueAt)}</span>
                        </span>
                        {overdue ? <Badge tone="danger">Late · still accepted</Badge> : soon ? <Badge tone="warning">Due {relTime(a.dueAt)}</Badge> : <Badge>Due {relTime(a.dueAt)}</Badge>}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={CheckCircle2} title="You're all caught up">New work from your teachers will appear here with its due date.</EmptyState>
            )}
          </section>

          <section>
            <SectionTitle>Latest from your classes</SectionTitle>
            <Posts db={db} posts={posts} />
          </section>
        </div>

        <aside className="grid content-start gap-6">
          {lowAttendance.length > 0 && (
            <Notice tone="warning" icon={AlertTriangle} title={`Attendance below ${db.settings.attendanceMin}%`}>
              {lowAttendance.map((x) => `${x.c.code}: ${Math.round(x.a!.pct)}%`).join(" · ")}. Below {db.settings.attendanceMin}% you may not be allowed to sit the semester-end exam. Speak to your teacher.
            </Notice>
          )}
          <section>
            <SectionTitle action={<a href="#courses" className={buttonStyles({ variant: "link", size: "sm" })}>All courses</a>}>My courses</SectionTitle>
            <ul className="grid gap-2">
              {courses.map((c) => {
                const a = attendancePercent(db, c.id, s.userId);
                return (
                  <li key={c.id}>
                    <a href={href({ name: "course", id: c.id, tab: "stream" })} className="block rounded-lg border border-border bg-surface px-4 py-3 hover:border-border-strong">
                      <span className="block font-mono text-xs text-muted">{c.code}</span>
                      <span className="block font-semibold">{c.title}</span>
                      {a && <span className="mt-1 block text-xs text-muted tnum">Attendance {Math.round(a.pct)}% ({a.present}/{a.total})</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

export function Posts({ db, posts, showCourse = true }: { db: DB; posts: DB["announcements"]; showCourse?: boolean }) {
  if (!posts.length) return <EmptyState icon={Megaphone} title="No announcements yet">Posts from your teachers will show up here.</EmptyState>;
  return (
    <ul className="grid gap-3">
      {posts.map((p) => {
        const author = userById(db, p.authorId);
        const c = courseById(db, p.courseId);
        return (
          <Card as="li" key={p.id} className="p-4">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-semibold">{author?.name}</span>
              {showCourse && c && <span className="text-muted">in {c.code}</span>}
              <span className="text-muted">· {relTime(p.at)}</span>
            </div>
            <p className="max-w-prose whitespace-pre-line">{p.body}</p>
          </Card>
        );
      })}
    </ul>
  );
}

function FacultyHome() {
  const db = useDB();
  const s = useSession();
  const me = userById(db, s.userId)!;
  const courses = coursesFor(db, s);
  const ids = new Set(courses.map((c) => c.id));
  const toGrade = db.submissions.filter((x) => x.status === "submitted" && ids.has(db.assignments.find((a) => a.id === x.assignmentId)?.courseId ?? ""));
  const byAssignment = new Map<string, number>();
  toGrade.forEach((x) => byAssignment.set(x.assignmentId, (byAssignment.get(x.assignmentId) ?? 0) + 1));
  const atRisk = courses.flatMap((c) => c.enrolled.map((sid) => ({ c, sid, a: attendancePercent(db, c.id, sid) })).filter((x) => x.a && x.a.pct < db.settings.attendanceMin));

  return (
    <>
      <PageHeader eyebrow="Faculty" title={`${greeting()}, ${me.name.replace(/^(Prof\.|Dr\.)\s*/, "").split(" ")[0]}`}>
        {toGrade.length} submission{toGrade.length === 1 ? "" : "s"} waiting for marks across {courses.length} course{courses.length === 1 ? "" : "s"}.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Waiting for marks</SectionTitle>
          {byAssignment.size ? (
            <ul className="grid gap-2">
              {[...byAssignment].map(([aid, n]) => {
                const a = db.assignments.find((x) => x.id === aid)!;
                const c = courseById(db, a.courseId)!;
                return (
                  <li key={aid}>
                    <a href={href({ name: "assignment", id: aid })} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{a.title}</span>
                        <span className="block text-sm text-muted">{c.code}</span>
                      </span>
                      <Badge tone="warning">{n} to grade</Badge>
                      <ArrowRight size={16} className="text-muted" aria-hidden />
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={CheckCircle2} title="Nothing waiting">Every submission has been marked and returned.</EmptyState>
          )}
        </section>
        <section>
          <SectionTitle>Attendance below {db.settings.attendanceMin}%</SectionTitle>
          {atRisk.length ? (
            <Card className="divide-y divide-border">
              {atRisk.slice(0, 8).map((x) => (
                <div key={x.c.id + x.sid} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate">{userById(db, x.sid)?.name} <span className="text-muted">· {x.c.code}</span></span>
                  <Badge tone="danger" icon={FileWarning}>{Math.round(x.a!.pct)}%</Badge>
                </div>
              ))}
            </Card>
          ) : (
            <EmptyState icon={Users} title="No one at risk">Every student is above the attendance requirement.</EmptyState>
          )}
        </section>
        <section className="lg:col-span-2">
          <SectionTitle>My courses</SectionTitle>
          <CourseGrid />
        </section>
      </div>
    </>
  );
}

export function CourseGrid() {
  const db = useDB();
  const s = useSession();
  const courses = coursesFor(db, s);
  if (!courses.length) return <EmptyState icon={BookOpen} title="No courses yet">Once the college office enrols you, your courses appear here.</EmptyState>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((c) => {
        const teacher = userById(db, c.facultyId);
        const due = db.assignments.filter((a) => a.courseId === c.id && a.dueAt > Date.now()).length;
        return (
          <li key={c.id}>
            <a href={href({ name: "course", id: c.id, tab: "stream" })} className="flex h-full flex-col rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
              <span className="font-mono text-xs text-muted">{c.code} · {c.credits} credits</span>
              <span className="mt-1 font-display text-lg font-semibold leading-snug">{c.title}</span>
              <span className="mt-1 text-sm text-muted">{teacher?.name} · {c.room}</span>
              <span className="mt-auto flex flex-wrap gap-2 pt-4">
                <Badge>{c.enrolled.length} students</Badge>
                {due > 0 && <Badge tone="brand" icon={CalendarClock}>{due} due</Badge>}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function AdminHome() {
  const db = useDB();
  const students = db.users.filter((u) => u.role === "student");
  const consented = new Set(db.consents.map((c) => c.userId));
  const openReq = db.requests.filter((r) => r.status === "open").length;
  const stats = [
    { label: "Students on roster", value: students.length, note: `${new Set(students.map((s) => s.programme)).size} programmes` },
    { label: "Active courses", value: db.courses.length, note: `${db.users.filter((u) => u.role === "faculty").length} faculty` },
    { label: "Consent recorded", value: `${Math.round((students.filter((s) => consented.has(s.id)).length / Math.max(1, students.length)) * 100)}%`, note: "DPDP notice v2025-06" },
    { label: "Open data requests", value: openReq, note: "Respond within 30 days" },
  ];
  return (
    <>
      <PageHeader eyebrow="Administration" title={db.settings.institution} />
      <dl className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} as="div" className="p-4">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 font-display text-2xl font-semibold tnum">{s.value}</dd>
            <dd className="text-xs text-muted">{s.note}</dd>
          </Card>
        ))}
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Start here</SectionTitle>
          <ul className="grid gap-2">
            {[
              { icon: Upload, title: "Import the semester roster", body: "Upload a CSV from the college office. Review every row before anything is saved.", to: "#roster" },
              { icon: ShieldCheck, title: "Check data residency and retention", body: `Data stored in ${db.settings.region}; records kept ${db.settings.retentionYears} years.`, to: "#privacy" },
              { icon: Users, title: "See who is enrolled where", body: "Students, faculty and the courses they belong to.", to: "#people" },
            ].map((x) => (
              <li key={x.title}>
                <a href={x.to} className="flex gap-4 rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
                  <x.icon size={20} className="mt-0.5 shrink-0 text-primary-text" aria-hidden />
                  <span><span className="block font-semibold">{x.title}</span><span className="block text-sm text-muted">{x.body}</span></span>
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <SectionTitle action={<a href="#audit" className={buttonStyles({ variant: "link", size: "sm" })}>Full log</a>}>Recent activity</SectionTitle>
          <Card className="divide-y divide-border">
            {db.audit.slice(0, 6).map((a) => (
              <div key={a.id} className="px-4 py-3 text-sm">
                <p><span className="font-semibold">{a.action}</span> <span className="text-muted">· {userById(db, a.actorId)?.name} · {relTime(a.at)}</span></p>
                <p className="text-muted">{a.detail}</p>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
