import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSignedSessionToken,
  resolveActor,
  SESSION_COOKIE_NAME,
} from "@/lib/security/rbac";

const LoginSchema = z
  .object({
    role: z.enum(["STUDENT", "FACULTY", "LAB_ADMIN"]),
  })
  .strict();

export async function GET(req: NextRequest) {
  const actor = resolveActor(req);
  return NextResponse.json(
    { authenticated: Boolean(actor), actor },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role selection" }, { status: 400 });
  }

  const token = createSignedSessionToken(parsed.data.role);
  const res = NextResponse.json(
    { authenticated: true, role: parsed.data.role },
    { status: 200 }
  );

  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });

  return res;
}