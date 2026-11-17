import type { DB, User, Course, GradeComponent } from "./types";

const H = 3600_000;
const D = 24 * H;

const FIRST = ["Ananya", "Rohit", "Sneha", "Aditya", "Priya", "Kunal", "Shreya", "Vedant", "Riya", "Siddhesh", "Tanvi", "Omkar", "Pooja", "Nikhil", "Aisha", "Yash", "Divya", "Pranav", "Sana", "Gaurav", "Neha", "Joel", "Meghna", "Rahul", "Fatima", "Saish", "Leah", "Arjun"];
const LAST = ["Naik", "Kamat", "Shetye", "Gaonkar", "Fernandes", "Prabhu", "Desai", "Sawant", "D'Souza", "Parab", "Kerkar", "Borkar", "Pai", "Mesta", "Shaikh", "Chodankar", "Gawas", "Rodrigues", "Volvoikar", "Naik", "Sinai", "Dias", "Malik", "Kudchadkar", "Khan", "Velip", "Pereira", "Lotlikar"];

function scheme(prefix: string): GradeComponent[] {
  return [
    { id: `${prefix}-isa1`, name: "ISA 1 (online test)", kind: "internal", max: 10, source: "exam" },
    { id: `${prefix}-asg`, name: "Assignments", kind: "internal", max: 5, source: "assignments" },
    { id: `${prefix}-att`, name: "Attendance", kind: "internal", max: 5, source: "attendance" },
    { id: `${prefix}-isa2`, name: "ISA 2 (written)", kind: "internal", max: 20, source: "manual" },
    { id: `${prefix}-see`, name: "Semester-end exam", kind: "external", max: 60, source: "manual" },
  ];
}

export function makeSeed(now = Date.now()): DB {
  const today = new Date(now);
  const day = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, 23, 59);
    return d.getTime();
  };

  const students: User[] = FIRST.map((f, i) => ({
    id: `s${i + 1}`,
    name: `${f} ${LAST[i]}`,
    email: `${f.toLowerCase()}.${LAST[i].toLowerCase().replace(/[^a-z]/g, "")}${i + 1}@students.sahyadri.edu.in`,
    role: "student",
    rollNo: `${i < 14 ? "BCS" : "BCM"}23${String(i + 1).padStart(3, "0")}`,
    programme: i < 14 ? "B.Sc. Computer Science" : "B.Com.",
    semester: 5,
    division: i % 2 ? "B" : "A",
  }));

  const faculty: User[] = [
    { id: "f1", name: "Prof. Rohan Kamat", email: "rohan.kamat@sahyadri.edu.in", role: "faculty" },
    { id: "f2", name: "Dr. Leena Pereira", email: "leena.pereira@sahyadri.edu.in", role: "faculty" },
    { id: "f3", name: "Prof. Sameer Usgaonkar", email: "sameer.u@sahyadri.edu.in", role: "faculty" },
  ];
  const admin: User = { id: "a1", name: "Meera Desai", email: "registrar@sahyadri.edu.in", role: "admin" };

  const cs = students.filter((s) => s.programme === "B.Sc. Computer Science").map((s) => s.id);
  const com = students.filter((s) => s.programme === "B.Com.").map((s) => s.id);

  const courses: Course[] = [
    { id: "c1", code: "CSC-501", title: "Database Management Systems", credits: 4, programme: "B.Sc. Computer Science", semester: 5, facultyId: "f1", joinCode: "DBMS5K", room: "Lab 2", scheme: scheme("c1"), enrolled: [...cs] },
    { id: "c2", code: "CSC-503", title: "Computer Networks", credits: 4, programme: "B.Sc. Computer Science", semester: 5, facultyId: "f3", joinCode: "NET5Q8", room: "Room 204", scheme: scheme("c2"), enrolled: [...cs] },
    { id: "c3", code: "COM-502", title: "Indian Economy", credits: 3, programme: "B.Com.", semester: 5, facultyId: "f2", joinCode: "ECO5M2", room: "Room 110", scheme: scheme("c3"), enrolled: [...com] },
    { id: "c4", code: "GEC-505", title: "Environmental Studies", credits: 2, programme: "All programmes", semester: 5, facultyId: "f2", joinCode: "EVS5T1", room: "Seminar Hall", scheme: scheme("c4"), enrolled: [...cs, ...com] },
  ];

  const db: DB = {
    version: 1,
    seededAt: now,
    settings: {
      institution: "Sahyadri College of Arts & Science",
      shortName: "Sahyadri",
      brandHue: 172,
      region: "India · Mumbai (ap-south-1)",
      retentionYears: 7,
      passPercent: 40,
      attendanceMin: 75,
    },
    users: [...students, ...faculty, admin],
    courses,
    announcements: [
      { id: "an1", courseId: "c1", authorId: "f1", body: "ISA 1 is online on Friday, 11:00–11:30. It runs in Mandovi exam mode: answers save as you go, so a WiFi drop will not lose your work. Bring your phone charged.", at: now - 5 * H },
      { id: "an2", courseId: "c1", authorId: "f1", body: "Slides for Unit 3 (Normalisation) are up under Classwork. Practical batch B moves to Lab 3 this week.", at: now - 2 * D },
      { id: "an3", courseId: "c3", authorId: "f2", body: "Reading for Thursday: Economic Survey 2024–25, chapter 4 (Prices and Inflation). We will discuss it in class.", at: now - 1 * D },
      { id: "an4", courseId: "c4", authorId: "f2", body: "Field visit to the Salim Ali Bird Sanctuary on the 28th. Consent forms are with the class representatives.", at: now - 3 * D },
      { id: "an5", courseId: "c2", authorId: "f3", body: "Packet Tracer lab files are uploaded. Submit Lab 4 by Monday night.", at: now - 8 * H },
    ],
    materials: [
      { id: "m1", courseId: "c1", topic: "Unit 3 · Normalisation", title: "Unit 3 slides – 1NF to BCNF", kind: "pdf", detail: "unit3-normalisation.pdf · 2.1 MB", at: now - 2 * D },
      { id: "m2", courseId: "c1", topic: "Unit 3 · Normalisation", title: "Worked examples: functional dependencies", kind: "note", detail: "Six solved problems from previous university papers.", at: now - 2 * D },
      { id: "m3", courseId: "c1", topic: "Unit 2 · SQL", title: "PostgreSQL practice sandbox", kind: "link", detail: "Online SQL editor for lab practice", at: now - 9 * D },
      { id: "m4", courseId: "c3", topic: "Module 2 · Inflation", title: "Economic Survey 2024–25, Ch. 4", kind: "pdf", detail: "economic-survey-ch4.pdf · 3.4 MB", at: now - 1 * D },
      { id: "m5", courseId: "c2", topic: "Lab", title: "Packet Tracer lab files (Labs 1–4)", kind: "pdf", detail: "labs-1-4.zip · 840 KB", at: now - 8 * H },
      { id: "m6", courseId: "c4", topic: "Unit 1 · Ecosystems", title: "Western Ghats biodiversity notes", kind: "note", detail: "Class notes, with references to the Gadgil report.", at: now - 6 * D },
    ],
    assignments: [
      { id: "as1", courseId: "c1", topic: "Unit 3 · Normalisation", title: "Normalise the library schema to 3NF", instructions: "Take the single-table library schema from Lab 5. List all functional dependencies, then decompose it to 3NF. Show each step and explain why the decomposition is lossless.", dueAt: day(2), points: 20, componentId: "c1-asg", allowLate: true, createdAt: now - 4 * D },
      { id: "as2", courseId: "c1", topic: "Unit 2 · SQL", title: "SQL lab: joins and aggregates", instructions: "Write queries 1–10 from the lab sheet against the college database. Paste each query and its output.", dueAt: now - 3 * D, points: 10, componentId: "c1-asg", allowLate: false, createdAt: now - 12 * D },
      { id: "as3", courseId: "c2", topic: "Lab", title: "Lab 4: subnetting a campus network", instructions: "Design a subnet plan for a college with 6 departments and a hostel. Submit the Packet Tracer file and a one-page addressing table.", dueAt: day(4), points: 10, componentId: "c2-asg", allowLate: true, createdAt: now - 1 * D },
      { id: "as4", courseId: "c3", topic: "Module 2 · Inflation", title: "Short essay: food inflation in Goa", instructions: "In 600–800 words, explain two drivers of food inflation in Goa since 2022. Cite at least two sources.", dueAt: now - 1 * D, points: 15, componentId: "c3-asg", allowLate: true, createdAt: now - 7 * D },
      { id: "as5", courseId: "c4", topic: "Unit 1 · Ecosystems", title: "Field journal: Khandepar river walk", instructions: "Record five observations from the river walk with photos and your notes on each.", dueAt: day(9), points: 10, componentId: "c4-asg", allowLate: true, createdAt: now - 2 * D },
    ],
    submissions: [],
    exams: [
      {
        id: "e1", courseId: "c1", title: "ISA 1 · Relational model and SQL", durationMin: 20, opensAt: now - 2 * H, closesAt: now + 2 * D, componentId: "c1-isa1",
        instructions: "10 marks · 20 minutes from when you start. Your answers save automatically after every change. If your connection drops, keep working; answers sync when you are back online. The clock keeps running on the server, so do not close the exam to 'pause' it.",
        questions: [
          { id: "q1", kind: "mcq", prompt: "Which normal form removes partial dependencies on a composite key?", options: ["1NF", "2NF", "3NF", "BCNF"], correct: 1, marks: 2 },
          { id: "q2", kind: "mcq", prompt: "A LEFT JOIN between students and submissions returns…", options: ["Only students who submitted", "All submissions, matched or not", "All students, with NULLs where there is no submission", "The Cartesian product"], correct: 2, marks: 2 },
          { id: "q3", kind: "mcq", prompt: "Which SQL clause filters groups after aggregation?", options: ["WHERE", "HAVING", "GROUP BY", "ORDER BY"], correct: 1, marks: 2 },
          { id: "q4", kind: "short", prompt: "In two or three sentences, explain why a primary key cannot be NULL.", marks: 4 },
        ],
      },
      {
        id: "e2", courseId: "c3", title: "ISA 1 · National income and inflation", durationMin: 25, opensAt: day(3) - 13 * H, closesAt: day(3) - 10 * H, componentId: "c3-isa1",
        instructions: "10 marks · 25 minutes. Answers save automatically.",
        questions: [
          { id: "q1", kind: "mcq", prompt: "CPI inflation in India is published by…", options: ["RBI", "NSO (MoSPI)", "NITI Aayog", "Ministry of Finance"], correct: 1, marks: 5 },
          { id: "q2", kind: "short", prompt: "Distinguish GDP at market prices from GVA at basic prices.", marks: 5 },
        ],
      },
    ],
    attempts: [],
    marks: {},
    attendance: [],
    audit: [
      { id: "au0", at: now - 10 * D, actorId: "a1", action: "Roster imported", detail: "28 students imported from sem5-roster.csv (0 rejected)" },
    ],
    consents: [],
    requests: [],
  };

  // Past submissions & grades so faculty and student views start realistic.
  let n = 0;
  for (const sid of cs) {
    n++;
    if (n % 7 === 0) continue; // a few students never submitted
    const late = n % 5 === 0;
    db.submissions.push({
      id: `sub-as2-${sid}`, assignmentId: "as2", studentId: sid,
      text: "Queries 1–10 attached with outputs.", files: ["sql-lab.sql"],
      submittedAt: (db.assignments[1].dueAt) + (late ? 5 * H : -20 * H),
      status: "returned", score: 5 + ((n * 3) % 6), feedback: n % 2 ? "Good use of GROUP BY. Query 8 misses the HAVING filter." : "Correct and tidy.", versions: 1,
    });
  }
  for (const sid of com.slice(0, 9)) {
    db.submissions.push({ id: `sub-as4-${sid}`, assignmentId: "as4", studentId: sid, text: "Essay attached.", files: ["food-inflation-essay.pdf"], submittedAt: now - 30 * H, status: "submitted", versions: 1 });
  }

  // Attendance: 14 past sessions per course, with a few chronic absentees.
  for (const c of courses) {
    for (let k = 14; k >= 1; k--) {
      const d = new Date(now - k * 2 * D);
      const date = d.toISOString().slice(0, 10);
      const present = c.enrolled.filter((sid, idx) => {
        const chronic = idx === 3 || idx === 9;
        return chronic ? (k + idx) % 3 === 0 : (k * 7 + idx) % 11 !== 0;
      });
      db.attendance.push({ id: `at-${c.id}-${k}`, courseId: c.id, date, slot: "Lecture", present });
    }
  }

  // Manually entered ISA 2 marks for some students.
  for (const c of courses) {
    c.enrolled.forEach((sid, idx) => {
      if (idx % 4 !== 3) db.marks[`${c.id}:${sid}:${c.id}-isa2`] = 8 + ((idx * 5 + c.credits) % 12);
    });
  }

  db.consents.push({ userId: "s2", version: "2025-06", at: now - 40 * D });
  return db;
}
