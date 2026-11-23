import { NextRequest } from "next/server";
import crypto from "crypto";

export type Role = "STUDENT" | "FACULTY" | "LAB_ADMIN";
export type BookingLifecycle =
  | "PENDING_FACULTY"
  | "APPROVED"
  | "REJECTED"
  | "CHECKED_OUT"
  | "RETURNED";

export interface AuthenticatedActor {
  id: string;
  name: string;
  role: Role;
  department: string;
}

const SESSION_SECRET = process.env.SESSION_SECRET || "lablink-campus-dev-secret-key-2026";
export const SESSION_COOKIE_NAME = "lablink_session";

const DEMO_ACCOUNTS: Record<Role, AuthenticatedActor> = {
  STUDENT: {
    id: "usr_student_1",
    name: "Aarav Sharma (1MS23CS042)",
    role: "STUDENT",
    department: "CSE",
  },
  FACULTY: {
    id: "usr_faculty_1",
    name: "Dr. Kavita Rao",
    role: "FACULTY",
    department: "CSE",
  },
  LAB_ADMIN: {
    id: "usr_admin_1",
    name: "Prof. R. Menon",
    role: "LAB_ADMIN",
    department: "ALL",
  },
};

export function createSignedSessionToken(role: Role): string {
  const actor = DEMO_ACCOUNTS[role];
  const payload = Buffer.from(JSON.stringify(actor)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token?: string): AuthenticatedActor | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthenticatedActor;
    return DEMO_ACCOUNTS[parsed.role] ? parsed : null;
  } catch {
    return null;
  }
}

export function resolveActor(req: NextRequest): AuthenticatedActor | null {
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verified = verifySessionToken(cookieToken);
  if (verified) return verified;

  if (process.env.NODE_ENV === "test") {
    const testRole = req.headers.get("x-demo-role")?.toUpperCase() as Role | undefined;
    if (testRole && DEMO_ACCOUNTS[testRole]) {
      return DEMO_ACCOUNTS[testRole];
    }
  }

  return null;
}

const ALLOWED_TRANSITIONS: Record<BookingLifecycle, BookingLifecycle[]> = {
  PENDING_FACULTY: ["APPROVED", "REJECTED"],
  APPROVED: ["CHECKED_OUT", "REJECTED"],
  REJECTED: [],
  CHECKED_OUT: ["RETURNED"],
  RETURNED: [],
};

export function canTransitionLifecycle(
  current: BookingLifecycle,
  next: BookingLifecycle
): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}