import { useState } from "react";
import { ClipboardList, Paperclip, RotateCcw, Undo2, X, Upload } from "lucide-react";
import { useDB, useSession, mutate, uid, courseById, userById } from "../lib/store";
import { href } from "../lib/router";
import { fmtDateTime, relTime } from "../lib/utils";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Textarea, toast } from "../components/ui";
import { SubmissionBadge } from "./Course";
import type { Assignment, Submission } from "../lib/types";

const MAX_MB = 20;

export function AssignmentPage({ id }: { id: string }) {
  const db = useDB();
  const s = useSession();
  const a = db.assignments.find((x) => x.id === id);
  if (!a) return <EmptyState icon={ClipboardList} title="This assignment was removed">Your teacher may have replaced it. <a className="text-primary-text underline" href="#courses">Back to courses</a></EmptyState>;
  const c = courseById(db, a.courseId)!;
  return (
    <>
      <PageHeader eyebrow={<><a href={href({ name: "course", id: c.id, tab: "classwork" })} className="hover:underline">{c.code} · Classwork</a></>} title={a.title}>
        Due {fmtDateTime(a.dueAt)} ({relTime(a.dueAt)}) · {a.points} marks{a.allowLate ? " · late work accepted" : " · no late submissions"}
      </PageHeader>
      {s.role === "student" ? <StudentView a={a} studentId={s.userId} /> : <GradingView a={a} />}
    </>
  );
}

function StudentView({ a, studentId }: { a: Assignment; studentId: string }) {
  const db = useDB();
  const sub = db.submissions.find((x) => x.assignmentId === a.id && x.studentId === studentId);
  const [text, setText] = useState(sub?.text ?? "");
  const [files, setFiles] = useState<string[]>(sub?.files ?? []);
  const [fileError, setFileError] = useState("");
  const [editing, setEditing] = useState(!sub);
  const closed = a.dueAt < Date.now() && !a.allowLate;
  const late = a.dueAt < Date.now();

  const submit = () => {
    if (!text.trim() && !files.length) return toast("Add a file or write an answer before handing in", "danger");
    mutate((d) => {
      const i = d.submissions.findIndex((x) => x.assignmentId === a.id && x.studentId === studentId);
      const rec: Submission = { id: sub?.id ?? uid("sub"), assignmentId: a.id, studentId, text: text.trim(), files, submittedAt: Date.now(), status: "submitted", versions: (sub?.versions ?? 0) + 1 };
      if (i >= 0) d.submissions[i] = rec; else d.submissions.push(rec);
    }, { actorId: studentId, action: sub ? "Resubmitted" : "Handed in", detail: `${a.title}${late ? " (late)" : ""}` });
    setEditing(false);
    toast(late ? "Handed in. It's marked late, and your teacher can see when you submitted." : "Handed in. Your teacher has been notified.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-5">
        <h2 className="mb-2 text-base font-semibold">Instructions</h2>
        <p className="max-w-prose whitespace-pre-line">{a.instructions || "No extra instructions."}</p>
      </Card>
      <Card className="grid content-start gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Your work</h2>
          <SubmissionBadge sub={sub} dueAt={a.dueAt} />
        </div>

        {sub?.status === "returned" && (
          <Notice tone="success" title={`${sub.score} / ${a.points} marks`}>{sub.feedback || "No written feedback."}</Notice>
        )}

        {closed && !sub ? (
          <Notice tone="danger" title="Submissions are closed">This assignment didn't accept late work. If you had a medical or family reason, speak to your teacher; they can reopen it for you.</Notice>
        ) : editing ? (
          <>
            {late && <Notice tone="warning" title="This will be marked late">It was due {relTime(a.dueAt)}. You can still hand it in.</Notice>}
            <Field label="Answer or note to your teacher" htmlFor="sub-text">
              <Textarea id="sub-text" value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <div className="grid gap-2">
              <label htmlFor="sub-file" className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-strong px-3 py-3 text-sm font-medium hover:bg-surface-2">
                <Upload size={16} aria-hidden /> Attach a file (PDF, image, doc · up to {MAX_MB} MB)
              </label>
              <input
                id="sub-file"
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (f.size > MAX_MB * 1024 * 1024) { setFileError(`"${f.name}" is ${(f.size / 1048576).toFixed(1)} MB. The limit is ${MAX_MB} MB. Try compressing it or exporting as PDF.`); return; }
                  setFileError("");
                  setFiles((xs) => [...xs, f.name]);
                }}
              />
              {fileError && <p role="alert" className="text-sm text-danger">{fileError}</p>}
              {files.map((f) => (
                <div key={f} className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
                  <Paperclip size={14} aria-hidden /><span className="min-w-0 flex-1 truncate">{f}</span>
                  <button type="button" aria-label={`Remove ${f}`} onClick={() => setFiles((xs) => xs.filter((x) => x !== f))} className="rounded-sm p-1 hover:bg-surface"><X size={14} aria-hidden /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={submit}>{sub ? "Hand in again" : "Hand in"}</Button>
              {sub && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
            </div>
          </>
        ) : sub ? (
          <>
            <p className="text-sm text-muted">Handed in {fmtDateTime(sub.submittedAt)}{sub.versions > 1 ? ` · version ${sub.versions}` : ""}</p>
            {sub.text && <p className="whitespace-pre-line text-sm">{sub.text}</p>}
            {sub.files.map((f) => <p key={f} className="flex items-center gap-2 text-sm"><Paperclip size={14} aria-hidden />{f}</p>)}
            {(!closed || sub.status === "returned") && (
              <Button variant="secondary" icon={sub.status === "returned" ? RotateCcw : Undo2} onClick={() => setEditing(true)}>
                {sub.status === "returned" ? "Resubmit" : "Unsubmit and edit"}
              </Button>
            )}
          </>
        ) : null}
      </Card>
    </div>
  );
}

function GradingView({ a }: { a: Assignment }) {
  const db = useDB();
  const s = useSession();
  const c = courseById(db, a.courseId)!;
  const roster = c.enrolled.map((id) => userById(db, id)!).sort((x, y) => (x.rollNo ?? "").localeCompare(y.rollNo ?? ""));
  const subFor = (sid: string) => db.submissions.find((x) => x.assignmentId === a.id && x.studentId === sid);
  const order = (sid: string) => { const x = subFor(sid); return x?.status === "submitted" ? 0 : x ? 1 : 2; };
  const sorted = [...roster].sort((x, y) => order(x.id) - order(y.id));
  const [openId, setOpenId] = useState<string | null>(sorted.find((u) => subFor(u.id)?.status === "submitted")?.id ?? null);
  const counts = { submitted: 0, returned: 0, missing: 0 };
  roster.forEach((u) => { const x = subFor(u.id); if (!x) counts.missing++; else counts[x.status]++; });

  return (
    <div className="grid gap-4">
      <dl className="flex flex-wrap gap-6 text-sm">
        <div><dt className="text-muted">To mark</dt><dd className="font-display text-xl font-semibold tnum">{counts.submitted}</dd></div>
        <div><dt className="text-muted">Returned</dt><dd className="font-display text-xl font-semibold tnum">{counts.returned}</dd></div>
        <div><dt className="text-muted">Not handed in</dt><dd className="font-display text-xl font-semibold tnum">{counts.missing}</dd></div>
      </dl>
      <ul className="grid gap-2">
        {sorted.map((u) => {
          const sub = subFor(u.id);
          const open = openId === u.id && sub;
          return (
            <li key={u.id} className="rounded-lg border border-border bg-surface">
              <button type="button" aria-expanded={!!open} disabled={!sub} onClick={() => setOpenId(open ? null : u.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{u.name}</span>
                  <span className="block text-xs text-muted">{u.rollNo}{sub ? ` · ${fmtDateTime(sub.submittedAt)}` : ""}</span>
                </span>
                <SubmissionBadge sub={sub} dueAt={a.dueAt} />
                {sub && sub.submittedAt > a.dueAt && sub.status === "returned" && <Badge tone="warning">late</Badge>}
              </button>
              {open && <GradeForm a={a} sub={sub} actorId={s.userId} onDone={() => setOpenId(sorted.find((x) => x.id !== u.id && subFor(x.id)?.status === "submitted")?.id ?? null)} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GradeForm({ a, sub, actorId, onDone }: { a: Assignment; sub: Submission; actorId: string; onDone: () => void }) {
  const db = useDB();
  const [score, setScore] = useState(sub.score != null ? String(sub.score) : "");
  const [feedback, setFeedback] = useState(sub.feedback ?? "");
  const [err, setErr] = useState("");
  const student = userById(db, sub.studentId)!;
  return (
    <form
      className="grid gap-4 border-t border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const v = Number(score);
        if (score === "" || !Number.isFinite(v) || v < 0 || v > a.points) return setErr(`Enter marks from 0 to ${a.points}.`);
        mutate((d) => {
          const x = d.submissions.find((y) => y.id === sub.id)!;
          x.score = v; x.feedback = feedback.trim(); x.status = "returned";
        }, { actorId, action: sub.status === "returned" ? "Grade changed" : "Work returned", detail: `${a.title} · ${student.rollNo}: ${sub.score ?? "—"} → ${v}/${a.points}` });
        toast(`Returned to ${student.name.split(" ")[0]}`);
        onDone();
      }}
    >
      <div className="rounded-md bg-surface-2 p-3 text-sm">
        {sub.text && <p className="whitespace-pre-line">{sub.text}</p>}
        {sub.files.map((f) => <p key={f} className="mt-1 flex items-center gap-2"><Paperclip size={14} aria-hidden />{f}</p>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <Field label={`Marks / ${a.points}`} htmlFor={`score-${sub.id}`} error={err}>
          <Input id={`score-${sub.id}`} inputMode="decimal" value={score} aria-invalid={!!err} onChange={(e) => { setScore(e.target.value); setErr(""); }} />
        </Field>
        <Field label="Feedback" htmlFor={`fb-${sub.id}`} hint="The student sees this with their marks.">
          <Textarea id={`fb-${sub.id}`} className="min-h-20" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end"><Button type="submit">Return to student</Button></div>
    </form>
  );
}
