import type { User } from "./types";

/*
  Bulk roster import — specification implemented here.

  Columns (header row required, order-free, case-insensitive):
    roll_no*     letters, digits, hyphen; 4–16 chars; unique per institution
    full_name*   2–80 chars
    email*       valid address; unique per institution
    programme*   must match a programme the college runs
    semester*    integer 1–8
    division     optional, one letter A–H
  No phone, address, date of birth or caste fields: under DPDP we collect only what an LMS needs.

  Rules:
    • Validation is per row. Import is PARTIAL: valid rows go in, invalid rows are reported with a reason.
    • Duplicate inside the file (same roll_no or email as an earlier row) → later row rejected.
    • Roll number already on the roster → row is an UPDATE (name, programme, semester, division change).
    • Email already used by a different roll number → rejected (would merge two people).
    • Nothing is written until the admin reviews the preview and confirms.
    • New students are auto-enrolled in every course for their programme + semester.
*/

export const PROGRAMMES = ["B.Sc. Computer Science", "B.Com.", "B.A. Economics", "B.Sc. Microbiology"];

export type RowOutcome =
  | { line: number; kind: "create"; user: User }
  | { line: number; kind: "update"; user: User; changes: string[] }
  | { line: number; kind: "unchanged"; user: User }
  | { line: number; kind: "error"; raw: string; reasons: string[] };

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/^name$/, "full_name").replace(/^roll$|^rollno$|^roll_number$/, "roll_no");
const REQUIRED = ["roll_no", "full_name", "email", "programme", "semester"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function planImport(text: string, existing: User[]): { headerError?: string; rows: RowOutcome[] } {
  const all = parseCSV(text.replace(/^﻿/, "")).filter((r) => r.some((c) => c.trim() !== ""));
  if (!all.length) return { headerError: "The file is empty.", rows: [] };
  const header = all[0].map(norm);
  const missing = REQUIRED.filter((r) => !header.includes(r));
  if (missing.length) {
    return { headerError: `The header row is missing: ${missing.join(", ")}. The first line of the file must name the columns.`, rows: [] };
  }
  const idx = (k: string) => header.indexOf(k);
  const byRoll = new Map(existing.filter((u) => u.rollNo).map((u) => [u.rollNo!.toUpperCase(), u]));
  const byEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u]));
  const seenRoll = new Map<string, number>();
  const seenEmail = new Map<string, number>();
  const out: RowOutcome[] = [];

  all.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (k: string) => (idx(k) >= 0 ? (cells[idx(k)] ?? "").trim() : "");
    const roll = get("roll_no").toUpperCase();
    const name = get("full_name").replace(/\s+/g, " ");
    const email = get("email").toLowerCase();
    const programme = get("programme");
    const semRaw = get("semester");
    const division = get("division").toUpperCase();
    const reasons: string[] = [];

    if (cells.length !== header.length) reasons.push(`has ${cells.length} columns, header has ${header.length} (check for an unquoted comma)`);
    if (!roll) reasons.push("roll_no is empty");
    else if (!/^[A-Z0-9-]{4,16}$/.test(roll)) reasons.push(`roll_no "${roll}" must be 4–16 letters, digits or hyphens`);
    if (name.length < 2) reasons.push("full_name is empty");
    if (!email) reasons.push("email is empty");
    else if (!EMAIL.test(email)) reasons.push(`email "${email}" is not a valid address`);
    const prog = PROGRAMMES.find((p) => p.toLowerCase().replace(/\W/g, "") === programme.toLowerCase().replace(/\W/g, ""));
    if (!programme) reasons.push("programme is empty");
    else if (!prog) reasons.push(`programme "${programme}" is not one this college runs`);
    const sem = Number(semRaw);
    if (!Number.isInteger(sem) || sem < 1 || sem > 8) reasons.push(`semester "${semRaw}" must be a whole number from 1 to 8`);
    if (division && !/^[A-H]$/.test(division)) reasons.push(`division "${division}" must be one letter A–H`);

    if (roll && seenRoll.has(roll)) reasons.push(`roll_no ${roll} already appears on line ${seenRoll.get(roll)}`);
    if (email && seenEmail.has(email)) reasons.push(`email already appears on line ${seenEmail.get(email)}`);
    const owner = byEmail.get(email);
    if (owner && owner.rollNo?.toUpperCase() !== roll) reasons.push(`email belongs to ${owner.name}${owner.rollNo ? ` (${owner.rollNo})` : ""}`);

    if (roll && !seenRoll.has(roll)) seenRoll.set(roll, line);
    if (email && !seenEmail.has(email)) seenEmail.set(email, line);

    if (reasons.length) { out.push({ line, kind: "error", raw: cells.join(","), reasons }); return; }

    const prev = byRoll.get(roll);
    const user: User = { id: prev?.id ?? `s-${roll.toLowerCase()}`, role: "student", rollNo: roll, name, email, programme: prog!, semester: sem, division: division || undefined };
    if (!prev) { out.push({ line, kind: "create", user }); return; }
    const changes: string[] = [];
    if (prev.name !== name) changes.push(`name: ${prev.name} → ${name}`);
    if (prev.programme !== prog) changes.push(`programme: ${prev.programme} → ${prog}`);
    if (prev.semester !== sem) changes.push(`semester: ${prev.semester} → ${sem}`);
    if ((prev.division ?? "") !== (division || "")) changes.push(`division: ${prev.division ?? "—"} → ${division || "—"}`);
    out.push(changes.length ? { line, kind: "update", user, changes } : { line, kind: "unchanged", user });
  });
  return { rows: out };
}

export const SAMPLE_CSV = `roll_no,full_name,email,programme,semester,division
BCS23001,Ananya Naik,ananya.naik1@students.sahyadri.edu.in,B.Sc. Computer Science,5,A
BCS23002,Rohit Kamath,rohit.kamat2@students.sahyadri.edu.in,B.Sc. Computer Science,5,B
BEC24001,Kavya Salgaonkar,kavya.s@students.sahyadri.edu.in,B.A. Economics,3,A
BEC24002,Ishaan Bhandari,ishaan.b@students.sahyadri.edu.in,B.A. Economics,3,A
BMB24001,Zara Menezes,zara.menezes@students.sahyadri.edu.in,B.Sc. Microbiology,3,
BMB24002,Tejas Gaude,tejas.gaude@students,B.Sc. Microbiology,3,B
BEC24003,Kavya Salgaonkar,kavya.s@students.sahyadri.edu.in,B.A. Economics,3,A
BCM24009,"Naik, Aryan",aryan.naik@students.sahyadri.edu.in,B.Com.,9,C
BMB24003,Elton Colaco,elton.colaco@students.sahyadri.edu.in,B.Sc Microbiology,3,A
BCM24010,Shruti Harmalkar,shruti.h@students.sahyadri.edu.in,BBA,3,A`;
