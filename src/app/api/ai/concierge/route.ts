import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/security/rbac";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizeForPrompt } from "@/lib/security/sanitize";
import { getEquipmentList } from "@/lib/store";

const ConciergeSchema = z
  .object({
    prompt: z.string().min(3).max(400),
  })
  .strict();

export async function POST(req: NextRequest) {
  const actor = resolveActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized session" }, { status: 401 });
  }

  const rl = checkRateLimit(`concierge:${actor.id}`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const parsed = ConciergeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid concierge query" }, { status: 400 });
  }

  const cleanPrompt = sanitizeForPrompt(parsed.data.prompt);
  const catalog = getEquipmentList().filter((e) => !e.maintenanceLock);

  const hourMatch = cleanPrompt.match(/\b([9]|1[0-8])\s*(?::00|am|pm)?/i);
  let startHour = hourMatch ? Number(hourMatch[1]) : 11;
  if (/pm/i.test(cleanPrompt) && startHour < 9) startHour += 12;
  if (startHour < 9 || startHour > 18) startHour = 11;

  const durMatch = cleanPrompt.match(/\b([1-3])\s*(?:hr|hour)/i);
  const duration = durMatch ? Number(durMatch[1]) : 2;

  const tokens = cleanPrompt.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  let bestItem = catalog[0];
  let bestScore = -1;

  for (const item of catalog) {
    const hay = `${item.name} ${item.specs} ${item.department} ${item.tags.join(" ")}`.toLowerCase();
    const score = tokens.reduce((acc, tk) => acc + (hay.includes(tk) ? 2 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  if (bestItem && bestItem.hourlySlots[startHour] !== "OPEN") {
    const openHour = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18].find(
      (h) => bestItem.hourlySlots[h] === "OPEN"
    );
    if (openHour) startHour = openHour;
  }

  let rationale = `Matched ${bestItem?.name} (${bestItem?.labRoom}) for ${duration}h starting ${String(
    startHour
  ).padStart(2, "0")}:00 based on hardware capability and open slot availability.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && bestItem) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are LabLink's campus lab concierge. Write a 1-sentence technical recommendation explaining why "${bestItem.name}" (${bestItem.specs}) at ${String(startHour).padStart(2, "0")}:00 for ${duration}h fits this student request: <untrusted_request>${cleanPrompt}</untrusted_request>. Keep it under 28 words, plain text only.`,
                  },
                ],
              },
            ],
          }),
        }
      );
      if (geminiRes.ok) {
        const gJson = await geminiRes.json();
        const text = gJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) rationale = text;
      }
    } catch {
      // Keep deterministic rationale on timeout
    }
  }

  return NextResponse.json({
    recommendation: {
      equipmentId: bestItem?.id,
      equipmentName: bestItem?.name,
      startHour,
      duration,
      rationale,
    },
  });
}




