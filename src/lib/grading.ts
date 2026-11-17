import type { Course, DB, GradeComponent } from "./types";

/*
  Indian-university style computation (UGC CBCS, 10-point scale).
  Each course has a marking scheme: internal components (ISA, assignments, attendance)
  and an external semester-end exam, each with a printed maximum. Totals are out of 100.
  A student passes a course when the total ≥ passPercent AND the external ≥ passPercent of its max.
*/

export const GRADE_BANDS = [
  { min: 90, letter: "O", points: 10, label: "Outstanding" },
  { min: 80, letter: "A+", points: 9, label: "Excellent" },
  { min: 70, letter: "A", points: 8, label: "Very good" },
  { min: 60, letter: "B+", points: 7, label: "Good" },
  { min: 55, letter: "B", points: 6, label: "Above average" },
  { min: 50, letter: "C", points: 5, label: "Average" },
  { min: 40, letter: "P", points: 4, label: "Pass" },
  { min: 0, letter: "F", points: 0, label: "Fail" },
];

export function gradeFor(pct: number) {
  return GRADE_BANDS.find((b) => pct >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
}

export function attendancePercent(db: DB, courseId: string, studentId: string) {
  const sessions = db.attendance.filter((a) => a.courseId === courseId);
  if (!sessions.length) return null;
  const present = sessions.filter((s) => s.present.includes(studentId)).length;
  return { pct: (present / sessions.length) * 100, present, total: sessions.length };
}

/** Marks for one component, or null if not yet available. */
export function componentMarks(db: DB, course: Course, comp: GradeComponent, studentId: string): number | null {
  const key = `${course.id}:${studentId}:${comp.id}`;
  switch (comp.source) {
    case "manual":
      return key in db.marks ? db.marks[key] : null;
    case "attendance": {
      const a = attendancePercent(db, course.id, studentId);
      if (!a) return null;
      // Common college rule: full marks at ≥ 90%, scaled linearly below that, zero under 50%.
      const scaled = a.pct >= 90 ? 1 : a.pct < 50 ? 0 : (a.pct - 50) / 40;
      return round1(scaled * comp.max);
    }
    case "assignments": {
      const asgs = db.assignments.filter((x) => x.componentId === comp.id);
      const graded = asgs
        .map((a) => {
          const s = db.submissions.find((sub) => sub.assignmentId === a.id && sub.studentId === studentId);
          if (s?.status === "returned" && s.score != null) return s.score / a.points;
          if (a.dueAt < Date.now() && !s) return 0; // missing after the due date counts as zero
          return null;
        })
        .filter((v): v is number => v != null);
      if (!graded.length) return null;
      return round1((graded.reduce((x, y) => x + y, 0) / graded.length) * comp.max);
    }
    case "exam": {
      const exam = db.exams.find((e) => e.componentId === comp.id);
      if (!exam) return null;
      const att = db.attempts.find((a) => a.examId === exam.id && a.studentId === studentId && a.submittedAt);
      if (!att || att.score == null) return null;
      const total = exam.questions.reduce((s, q) => s + q.marks, 0);
      return round1((att.score / total) * comp.max);
    }
  }
}

export interface CourseResult {
  parts: { comp: GradeComponent; marks: number | null }[];
  internal: number;
  internalMax: number;
  external: number | null;
  externalMax: number;
  total: number | null;
  grade: ReturnType<typeof gradeFor> | null;
  complete: boolean;
  passed: boolean | null;
}

export function courseResult(db: DB, course: Course, studentId: string): CourseResult {
  const parts = course.scheme.map((comp) => ({ comp, marks: componentMarks(db, course, comp, studentId) }));
  const int = parts.filter((p) => p.comp.kind === "internal");
  const ext = parts.filter((p) => p.comp.kind === "external");
  const internal = round1(int.reduce((s, p) => s + (p.marks ?? 0), 0));
  const internalMax = int.reduce((s, p) => s + p.comp.max, 0);
  const externalMax = ext.reduce((s, p) => s + p.comp.max, 0);
  const extDone = ext.every((p) => p.marks != null);
  const external = extDone ? round1(ext.reduce((s, p) => s + (p.marks ?? 0), 0)) : null;
  const complete = parts.every((p) => p.marks != null);
  const max = internalMax + externalMax;
  const total = complete ? round1(((internal + (external ?? 0)) / max) * 100) : null;
  const pass = db.settings.passPercent;
  const passed = total == null || external == null ? null : total >= pass && (external / externalMax) * 100 >= pass;
  const grade = total == null ? null : passed ? gradeFor(total) : gradeFor(0);
  return { parts, internal, internalMax, external, externalMax, total, grade, complete, passed };
}

/** SGPA over courses that have a final grade. */
export function sgpa(db: DB, studentId: string) {
  const rows = db.courses
    .filter((c) => c.enrolled.includes(studentId))
    .map((c) => ({ c, r: courseResult(db, c, studentId) }))
    .filter((x) => x.r.grade);
  const credits = rows.reduce((s, x) => s + x.c.credits, 0);
  if (!credits) return null;
  return round2(rows.reduce((s, x) => s + x.c.credits * x.r.grade!.points, 0) / credits);
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;
