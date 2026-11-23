import { NextRequest } from "next/server";

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

const VALID_ROLES: Role[] = ["STUDENT", "FACULTY", "LAB_ADMIN"];

export function resolveActor(req: NextRequest): AuthenticatedActor | null {
  const headerRole = (req.headers.get("x-demo-role") || "STUDENT").toUpperCase() as Role;
  if (!VALID_ROLES.includes(headerRole)) return null;

  if (headerRole === "FACULTY") {
    return {
      id: "usr_faculty_1",
      name: "Dr. Kavita Rao",
      role: "FACULTY",
      department: "CSE",
    };
  }
  if (headerRole === "LAB_ADMIN") {
    return {
      id: "usr_admin_1",
      name: "Prof. R. Menon",
      role: "LAB_ADMIN",
      department: "ALL",
    };
  }
  return {
    id: "usr_student_1",
    name: "Aarav Sharma (1MS23CS042)",
    role: "STUDENT",
    department: "CSE",
  };
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