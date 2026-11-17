export type Role = "student" | "faculty" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  rollNo?: string;
  programme?: string;
  semester?: number;
  division?: string;
}

/** Where a gradebook component's marks come from. */
export type ComponentSource = "manual" | "assignments" | "exam" | "attendance";

export interface GradeComponent {
  id: string;
  name: string;
  kind: "internal" | "external";
  /** Marks the component is out of, as printed on the mark sheet. */
  max: number;
  source: ComponentSource;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  credits: number;
  programme: string;
  semester: number;
  facultyId: string;
  joinCode: string;
  room: string;
  scheme: GradeComponent[];
  enrolled: string[];
}

export interface Announcement {
  id: string;
  courseId: string;
  authorId: string;
  body: string;
  at: number;
}

export interface Material {
  id: string;
  courseId: string;
  topic: string;
  title: string;
  kind: "pdf" | "link" | "note";
  detail: string;
  at: number;
}

export interface Assignment {
  id: string;
  courseId: string;
  topic: string;
  title: string;
  instructions: string;
  dueAt: number;
  points: number;
  componentId?: string;
  allowLate: boolean;
  createdAt: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  text: string;
  files: string[];
  submittedAt: number;
  status: "submitted" | "returned";
  score?: number;
  feedback?: string;
  versions: number;
}

export interface Question {
  id: string;
  kind: "mcq" | "short";
  prompt: string;
  options?: string[];
  correct?: number;
  marks: number;
}

export interface Exam {
  id: string;
  courseId: string;
  title: string;
  durationMin: number;
  opensAt: number;
  closesAt: number;
  componentId?: string;
  instructions: string;
  questions: Question[];
}

export interface Attempt {
  id: string;
  examId: string;
  studentId: string;
  startedAt: number;
  /** Fixed when the attempt starts. The timer is computed from this, never from a client countdown. */
  deadlineAt: number;
  answers: Record<string, string | number>;
  lastSyncedAt: number;
  submittedAt?: number;
  autoSubmitted?: boolean;
  score?: number;
  reconnects: number;
}

export interface AttendanceSession {
  id: string;
  courseId: string;
  date: string; // YYYY-MM-DD
  slot: string;
  present: string[];
}

export interface AuditEntry {
  id: string;
  at: number;
  actorId: string;
  action: string;
  detail: string;
}

export interface Consent {
  userId: string;
  version: string;
  at: number;
}

export interface DataRequest {
  id: string;
  userId: string;
  kind: "access" | "correction" | "erasure";
  at: number;
  status: "open" | "closed";
  note: string;
}

export interface Settings {
  institution: string;
  shortName: string;
  brandHue: number;
  region: string;
  retentionYears: number;
  passPercent: number;
  attendanceMin: number;
}

export interface DB {
  version: number;
  seededAt: number;
  settings: Settings;
  users: User[];
  courses: Course[];
  announcements: Announcement[];
  materials: Material[];
  assignments: Assignment[];
  submissions: Submission[];
  exams: Exam[];
  attempts: Attempt[];
  marks: Record<string, number>; // `${courseId}:${studentId}:${componentId}`
  attendance: AttendanceSession[];
  audit: AuditEntry[];
  consents: Consent[];
  requests: DataRequest[];
}
