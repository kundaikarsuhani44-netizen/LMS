import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, Clock, CloudUpload, Timer, Wifi, WifiOff, ShieldCheck } from "lucide-react";
import { useDB, useSession, mutate, uid, getDB, courseById, userById } from "../lib/store";
import { useNet, setSimulatedOffline, isOnline } from "../lib/net";
import { href } from "../lib/router";
import { cn, fmtDateTime, pad, relTime } from "../lib/utils";
import { Badge, Button, Card, DataList, EmptyState, Notice, PageHeader, SectionTitle } from "../components/ui";
import type { Attempt, Exam } from "../lib/types";

/*
  Exam engine — the "exam-grade reliability" premise.

  1. Server-side clock: when a student starts, the attempt stores deadlineAt.
     The countdown is always deadlineAt − now. Reloading, closing the tab or
     changing the device clock does not add time.
  2. Auto-save: every answer change is written to a device outbox immediately
     (survives a crash or reload), then synced to the server.
  3. Offline: while the connection is down, answers keep saving to the outbox.
     When it comes back, the outbox flushes and the reconnect is recorded.
  4. Auto-submit: at the deadline the last synced answers are submitted
     (in production by the server, here by whichever client sees it first).
*/

const OUTBOX = (attemptId: string) => `mandovi:outbox:${attemptId}`;
const readOutbox = (id: string): Attempt["answers"] | null => { try { return JSON.parse(localStorage.getItem(OUTBOX(id)) || "null"); } catch { return null; } };
const writeOutbox = (id: string, a: Attempt["answers"]) => { try { localStorage.setItem(OUTBOX(id), JSON.stringify(a)); } catch { /* memory only */ } };
const clearOutbox = (id: string) => { try { localStorage.removeItem(OUTBOX(id)); } catch { /* ignore */ } };

function scoreAttempt(exam: Exam, answers: Attempt["answers"]) {
  // MCQs are marked automatically; short answers get provisional half marks if answered, pending teacher review.
  return exam.questions.reduce((s, q) => {
    const a = answers[q.id];
    if (q.kind === "mcq") return s + (a === q.correct ? q.marks : 0);
    return s + (typeof a === "string" && a.trim().length > 15 ? q.marks / 2 : 0);
  }, 0);
}

export function ExamsPage() {
  const db = useDB();
  const s = useSession();
  const now = Date.now();
  const mine = s.role === "student" ? db.courses.filter((c) => c.enrolled.includes(s.userId)) : s.role === "faculty" ? db.courses.filter((c) => c.facultyId === s.userId) : db.courses;
  const ids = new Set(mine.map((c) => c.id));
  const exams = db.exams.filter((e) => ids.has(e.courseId)).sort((a, b) => a.opensAt - b.opensAt);
  return (
    <>
      <PageHeader eyebrow="Assessment" title="Exams">Online tests run with a server-side timer and save every answer as you go.</PageHeader>
      {!exams.length ? <EmptyState icon={Timer} title="No exams scheduled">Online ISAs and quizzes appear here once your teacher schedules them.</EmptyState> : (
        <DataList
          caption="Exams"
          rowKey={(e) => e.id}
          rows={exams}
          columns={[
            { key: "t", header: "Exam", primary: true, cell: (e) => <a className="font-semibold text-primary-text hover:underline" href={href({ name: "exam", id: e.id })}>{e.title}</a> },
            { key: "c", header: "Course", cell: (e) => courseById(db, e.courseId)?.code },
            { key: "d", header: "Duration", align: "right", cell: (e) => `${e.durationMin} min` },
            { key: "w", header: "Window", cell: (e) => `${fmtDateTime(e.opensAt)} – ${fmtDateTime(e.closesAt)}` },
            { key: "s", header: "Status", cell: (e) => {
              if (s.role !== "student") return <Badge>{db.attempts.filter((a) => a.examId === e.id && a.submittedAt).length} submitted</Badge>;
              const at = db.attempts.find((a) => a.examId === e.id && a.studentId === s.userId);
              if (at?.submittedAt) return <Badge tone="success">Submitted</Badge>;
              if (at) return <Badge tone="warning">In progress</Badge>;
              if (e.opensAt > now) return <Badge>Opens {relTime(e.opensAt)}</Badge>;
              if (e.closesAt < now) return <Badge tone="danger">Closed</Badge>;
              return <Badge tone="brand">Open now</Badge>;
            } },
          ]}
        />
      )}
    </>
  );
}

export function ExamPage({ id }: { id: string }) {
  const db = useDB();
  const s = useSession();
  const exam = db.exams.find((e) => e.id === id);
  if (!exam) return <EmptyState icon={Timer} title="This exam isn't available">It may have been rescheduled. <a className="text-primary-text underline" href="#exams">See all exams</a></EmptyState>;
  if (s.role !== "student") return <ExamMonitor exam={exam} />;
  const attempt = db.attempts.find((a) => a.examId === id && a.studentId === s.userId);
  if (attempt?.submittedAt) return <ExamDone exam={exam} attempt={attempt} />;
  if (attempt) return <ExamRunner exam={exam} attempt={attempt} />;
  return <ExamLobby exam={exam} studentId={s.userId} />;
}

function ExamLobby({ exam, studentId }: { exam: Exam; studentId: string }) {
  const db = useDB();
  const c = courseById(db, exam.courseId)!;
  const now = Date.now();
  const total = exam.questions.reduce((x, q) => x + q.marks, 0);
  const open = exam.opensAt <= now && exam.closesAt > now;
  const start = () => {
    const t = Date.now();
    // Never run past the window's close, even if started late.
    const deadlineAt = Math.min(t + exam.durationMin * 60_000, exam.closesAt);
    mutate((d) => d.attempts.push({ id: uid("at"), examId: exam.id, studentId, startedAt: t, deadlineAt, answers: {}, lastSyncedAt: t, reconnects: 0 }),
      { actorId: studentId, action: "Exam started", detail: `${c.code} · ${exam.title}` });
  };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={`${c.code} · ${c.title}`} title={exam.title} />
      <Card className="grid gap-5 p-6">
        <dl className="grid grid-cols-3 gap-4 text-center">
          <div><dt className="text-sm text-muted">Questions</dt><dd className="font-display text-2xl font-semibold tnum">{exam.questions.length}</dd></div>
          <div><dt className="text-sm text-muted">Marks</dt><dd className="font-display text-2xl font-semibold tnum">{total}</dd></div>
          <div><dt className="text-sm text-muted">Time</dt><dd className="font-display text-2xl font-semibold tnum">{exam.durationMin}m</dd></div>
        </dl>
        <p className="max-w-prose">{exam.instructions}</p>
        <ul className="grid gap-2 text-sm">
          <li className="flex gap-2"><CloudUpload size={18} className="shrink-0 text-primary-text" aria-hidden />Every answer saves within a second. You never need a Save button.</li>
          <li className="flex gap-2"><WifiOff size={18} className="shrink-0 text-primary-text" aria-hidden />If WiFi drops, keep answering. Your answers stay on this phone and upload when you reconnect.</li>
          <li className="flex gap-2"><Clock size={18} className="shrink-0 text-primary-text" aria-hidden />The clock runs on the college server. Closing the page doesn't pause it.</li>
        </ul>
        {open ? (
          <Button size="lg" onClick={start}>Start exam · {exam.durationMin} minutes</Button>
        ) : exam.opensAt > now ? (
          <Notice icon={Clock} title={`Opens ${fmtDateTime(exam.opensAt)}`}>Come back then. The Start button appears here when the window opens.</Notice>
        ) : (
          <Notice tone="danger" icon={AlertTriangle} title="This exam has closed">It closed {relTime(exam.closesAt)}. If you missed it for a genuine reason, ask your teacher about a re-test.</Notice>
        )}
      </Card>
    </div>
  );
}

type SyncState = "saved" | "saving" | "queued";

function ExamRunner({ exam, attempt }: { exam: Exam; attempt: Attempt }) {
  const { online, simulated } = useNet();
  const [answers, setAnswers] = useState<Attempt["answers"]>(() => ({ ...attempt.answers, ...(readOutbox(attempt.id) ?? {}) }));
  const [sync, setSync] = useState<SyncState>(() => (readOutbox(attempt.id) ? "queued" : "saved"));
  const [lastSaved, setLastSaved] = useState(attempt.lastSyncedAt);
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  const wasOnline = useRef(online);
  const timer = useRef<number>();

  const remaining = Math.max(0, attempt.deadlineAt - now);
  const answered = exam.questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "").length;

  const flush = useCallback((ans: Attempt["answers"], reconnect = false) => {
    if (!isOnline()) { setSync("queued"); return; }
    setSync("saving");
    window.setTimeout(() => {
      if (!isOnline()) { setSync("queued"); return; }
      const t = Date.now();
      mutate((d) => {
        const a = d.attempts.find((x) => x.id === attempt.id);
        if (!a || a.submittedAt) return;
        a.answers = ans; a.lastSyncedAt = t;
        if (reconnect) a.reconnects += 1;
      });
      clearOutbox(attempt.id);
      setLastSaved(t);
      setSync("saved");
    }, 350); // simulated network round trip
  }, [attempt.id]);

  const submit = useCallback((auto: boolean) => {
    const final = { ...answers, ...(readOutbox(attempt.id) ?? {}) };
    const fresh = getDB();
    const a = fresh.attempts.find((x) => x.id === attempt.id);
    if (!a || a.submittedAt) return;
    mutate((d) => {
      const x = d.attempts.find((y) => y.id === attempt.id)!;
      // When offline at the deadline, the server keeps the last synced answers.
      x.answers = auto && !isOnline() ? x.answers : final;
      x.submittedAt = Math.min(Date.now(), x.deadlineAt);
      x.autoSubmitted = auto;
      x.score = scoreAttempt(exam, x.answers);
    }, { actorId: attempt.studentId, action: auto ? "Exam auto-submitted at time limit" : "Exam submitted", detail: `${exam.title} · ${answered}/${exam.questions.length} answered` });
    clearOutbox(attempt.id);
  }, [answers, attempt.id, attempt.studentId, exam, answered]);

  // Tick the clock.
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  // Auto-submit at the deadline.
  useEffect(() => { if (remaining <= 0) submit(true); }, [remaining, submit]);
  // Reconnect: flush the outbox.
  useEffect(() => {
    if (online && !wasOnline.current) { const box = readOutbox(attempt.id); if (box) flush(box, true); }
    wasOnline.current = online;
  }, [online, attempt.id, flush]);
  // Leave the simulated drop off when the student leaves the page.
  useEffect(() => () => setSimulatedOffline(false), []);

  const answer = (qid: string, v: string | number) => {
    const next = { ...answers, [qid]: v };
    setAnswers(next);
    writeOutbox(attempt.id, next); // instant, local, survives reload
    setSync(isOnline() ? "saving" : "queued");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flush(next), 600);
  };

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const urgent = remaining < 2 * 60_000;
  const c = courseById(getDB(), exam.courseId)!;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Sticky exam status bar */}
      <div className="sticky z-10 -mx-4 mb-6 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur lg:mx-0 lg:rounded-lg lg:border" style={{ top: "calc(env(safe-area-inset-top, 0px) + 57px)" }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{exam.title}</p>
            <p className="text-xs text-muted">{c.code} · {answered} of {exam.questions.length} answered</p>
          </div>
          <SyncPill state={sync} online={online} lastSaved={lastSaved} />
          <div role="timer" aria-live={urgent ? "assertive" : "off"} aria-label={`${mins} minutes ${secs} seconds left`} className={cn("rounded-md px-3 py-1.5 font-mono text-lg font-medium tnum", urgent ? "bg-danger-soft text-danger" : "bg-surface-2")}>
            {pad(mins)}:{pad(secs)}
          </div>
        </div>
      </div>

      {!online && (
        <Notice tone="warning" icon={WifiOff} title="You're offline. Keep going." className="mb-4">
          Your answers are saved on this device and will upload as soon as the connection is back. The timer keeps running.
        </Notice>
      )}

      <ol className="grid gap-4">
        {exam.questions.map((q, i) => (
          <Card as="li" key={q.id} className="p-5">
            <fieldset>
              <legend className="mb-3 flex w-full items-baseline justify-between gap-3">
                <span className="font-semibold"><span className="mr-2 text-muted tnum">Q{i + 1}.</span>{q.prompt}</span>
                <span className="shrink-0 text-xs text-muted">{q.marks} marks</span>
              </legend>
              {q.kind === "mcq" ? (
                <div className="grid gap-2">
                  {q.options!.map((o, k) => {
                    const checked = answers[q.id] === k;
                    return (
                      <label key={k} className={cn("flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5", checked ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2")}>
                        <input type="radio" id={`${q.id}-${k}`} name={q.id} checked={checked} onChange={() => answer(q.id, k)} className="h-4 w-4 accent-[var(--primary)]" />
                        <span>{o}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  id={`${q.id}-text`}
                  aria-label={`Answer to question ${i + 1}`}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => answer(q.id, e.target.value)}
                  className="min-h-32 w-full rounded-md border border-border-strong bg-surface px-3 py-2 leading-relaxed"
                  placeholder="Type your answer"
                />
              )}
            </fieldset>
          </Card>
        ))}
      </ol>

      <Card className="mt-6 grid gap-4 p-5">
        {confirming ? (
          <>
            <p className="font-semibold">Submit now? You can't change answers after this.</p>
            {answered < exam.questions.length && <p className="text-sm text-warning">{exam.questions.length - answered} question{exam.questions.length - answered > 1 ? "s are" : " is"} unanswered.</p>}
            {!online && <p className="text-sm text-warning">You're offline. Submitting needs a connection. Wait for it to come back; your time is still running.</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => submit(false)} disabled={!online}>Yes, submit</Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Keep working</Button>
            </div>
          </>
        ) : (
          <Button size="lg" onClick={() => setConfirming(true)}>Finish and submit</Button>
        )}
      </Card>

      {/* Demo control, clearly separated from the exam UI */}
      <div className="mt-8 rounded-lg border border-dashed border-border-strong p-4">
        <p className="eyebrow mb-2">Demo control</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" icon={simulated ? Wifi : WifiOff} onClick={() => setSimulatedOffline(!simulated)}>
            {simulated ? "Restore WiFi" : "Simulate WiFi drop"}
          </Button>
          <p className="text-sm text-muted">Drop the connection, answer a question, reload the page, then restore. Nothing is lost.</p>
        </div>
      </div>
    </div>
  );
}

function SyncPill({ state, online, lastSaved }: { state: SyncState; online: boolean; lastSaved: number }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 5000); return () => clearInterval(t); }, []);
  if (!online || state === "queued")
    return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning" aria-live="polite"><CloudOff size={14} aria-hidden />Saved on this device</span>;
  if (state === "saving")
    return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted" aria-live="polite"><CloudUpload size={14} aria-hidden />Saving…</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success" aria-live="polite"><CheckCircle2 size={14} aria-hidden />All answers saved · {relTime(lastSaved)}</span>;
}

function ExamDone({ exam, attempt }: { exam: Exam; attempt: Attempt }) {
  const total = exam.questions.reduce((x, q) => x + q.marks, 0);
  const hasShort = exam.questions.some((q) => q.kind === "short");
  return (
    <div className="mx-auto max-w-xl">
      <Card className="grid justify-items-center gap-3 p-8 text-center">
        <CheckCircle2 size={40} className="text-success" aria-hidden />
        <h1 className="text-2xl font-semibold">{attempt.autoSubmitted ? "Time's up. Your exam was submitted." : "Exam submitted"}</h1>
        <p className="text-muted">{exam.title} · received {fmtDateTime(attempt.submittedAt!)}</p>
        <p className="font-display text-xl font-semibold tnum">{attempt.score} / {total}{hasShort ? " (provisional)" : ""}</p>
        {hasShort && <p className="max-w-sm text-sm text-muted">Multiple-choice answers are marked. Your teacher will mark the written answers and confirm the final score.</p>}
        {attempt.reconnects > 0 && <Badge tone="brand" icon={ShieldCheck}>Recovered from {attempt.reconnects} connection drop{attempt.reconnects > 1 ? "s" : ""} with no lost answers</Badge>}
        <a href="#exams" className="mt-2 text-sm font-semibold text-primary-text underline">Back to exams</a>
      </Card>
    </div>
  );
}

function ExamMonitor({ exam }: { exam: Exam }) {
  const db = useDB();
  const c = courseById(db, exam.courseId)!;
  const total = exam.questions.reduce((x, q) => x + q.marks, 0);
  const rows = c.enrolled.map((sid) => ({ u: userById(db, sid)!, a: db.attempts.find((x) => x.examId === exam.id && x.studentId === sid) }));
  return (
    <>
      <PageHeader eyebrow={<a href="#exams" className="hover:underline">Exams</a>} title={exam.title}>{c.code} · {exam.durationMin} min · {fmtDateTime(exam.opensAt)} – {fmtDateTime(exam.closesAt)}</PageHeader>
      <SectionTitle>Live status</SectionTitle>
      <DataList
        caption="Student attempts"
        rowKey={(r) => r.u.id}
        rows={rows}
        columns={[
          { key: "n", header: "Student", primary: true, cell: (r) => <span>{r.u.name} <span className="font-mono text-xs font-normal text-muted">{r.u.rollNo}</span></span> },
          { key: "s", header: "Status", cell: (r) => (r.a?.submittedAt ? <Badge tone="success">{r.a.autoSubmitted ? "Auto-submitted" : "Submitted"}</Badge> : r.a ? <Badge tone="warning">Writing</Badge> : <Badge>Not started</Badge>) },
          { key: "sync", header: "Last saved", cell: (r) => (r.a ? relTime(r.a.lastSyncedAt) : "—") },
          { key: "rc", header: "Reconnects", align: "right", cell: (r) => r.a?.reconnects ?? "—" },
          { key: "sc", header: "Score", align: "right", cell: (r) => (r.a?.score != null ? `${r.a.score}/${total}` : "—") },
        ]}
      />
    </>
  );
}
