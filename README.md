# LabLink — GenAI Campus Laboratory Resource-Sharing & Fair Allocation Console

LabLink is a role-based university laboratory scheduling, hardware custody, and fair-allocation console built with Next.js (App Router), React, TypeScript, and the Google Gemini API. It eliminates double-booked lab benches, resource hoarding before capstone deadlines, and manual paper handover logs across CSE, Robotics, ECE, and Mechanical engineering laboratories.

## Key Features & Complete Implementation Breakdown

### 1. Zero-Login Sandbox Evaluator Switcher

To allow instant evaluation without credential friction, LabLink includes a top-level Sandbox Evaluator Mode bar that switches between three distinct institutional roles by issuing cryptographically signed HttpOnly RBAC session cookies (`POST /api/auth/session`):

**Student (Aarav Sharma — 24ETCS000001):** Hardware discovery, natural-language AI concierge booking, conflict resolution, and project workspace management.

**Faculty (Dr. Kavita Rao):** Mentor approval queue, AI hardware right-sizing pre-audits, and equipment check-out/check-in state transitions.

**Lab Admin (Prof. R. Menon):** Department utilization telemetry, calibration/maintenance locks, and physical handover ledger.

### 2. Student Workbench (24ETCS000001)

**Ask LabLink AI Concierge (`POST /api/ai/concierge`):**

Powered by `gemini-2.5-flash` with deterministic keyword/time-parsing fallback.

Parses natural-language student requests (e.g., "Need LiDAR scanner for 2 hours at 11:00 for campus rover SLAM" or "Need digital oscilloscope for 3 hours at 2pm").

Automatically extracts the target equipment, converts 12h/24h time expressions (09:00–18:00), parses duration (1 to 8 hours), flags the matched unit with an AI MATCH badge, pre-fills the booking drawer, and displays a 1-sentence technical & safety suitability summary.

**Interactive Hourly Schedule Matrix (09:00 – 19:00):**

Visual 10-hour timeline per lab station (Open in green, Booked in blue, Maint in grey, and Selected Window in high-contrast dark slate).

Clicking any Open hour sets the start window in the sticky right-hand inspection panel.

Clicking any Booked hour immediately invokes the Fair Allocation AI Conflict Resolver.

**Full Hardware Visual Inspection & Extended Multi-Hour Booking:**

Displays uncropped workbench photography (`public/images/`) for all 6 lab units alongside hardware specs, bay codes, utilization percentages, and mandatory safety clearance prerequisites.

Supports flexible booking durations from 1 Hour up to 8 Hours (Full Lab Day).

**Deadline & Equity Fair Allocation Engine (`POST /api/ai/resolve-conflict`):**

Evaluates competing reservations using project submission deadlines and each student's 30-Day Equity Quota (12.0h cap) tracked in the live campus telemetry header.

Generates ranked resolution paths (cross-lab hardware substitutions or shifted time slots) with match percentages and one-click routing to the faculty approval queue.

**Multi-Project Workspaces & Team Collaboration:**

Switch between Capstone, Hackathon, and Course Lab tracks or create new project workspaces on the fly.

Tag team members by university registration number (24ETCS000001, 24ETEC000019, etc.) directly onto reservation records.

### 3. Faculty Mentor Console (Dr. Kavita Rao)

**AI Pre-Audit & Hardware Right-Sizing (`POST /api/ai/faculty-audit`):**

One-click Gemini audit per pending or approved booking that evaluates project deadline urgency, safety prerequisites, and whether flagship hardware (e.g., 64GB AGX Orin) is right-sized or can be fulfilled by an Orin Nano.

**Enforced Custody & Approval State Machine (`PATCH /api/approvals/[id]`):**

Strict server-side lifecycle transitions:

`PENDING_FACULTY → APPROVED → CHECKED_OUT → RETURNED`

or

`PENDING_FACULTY → REJECTED`

### 4. Lab Admin Console (Prof. R. Menon)

**Department Utilization Telemetry:**

Live utilization analytics and active vs. locked bench counts across CSE, Robotics, ECE, and Mechanical departments.

**Calibration & Maintenance Locks (`PATCH /api/equipment`):**

Toggle maintenance locks on individual benches to immediately block bookings across the student timeline matrix and update the campus online station counter (6 / 6 Online).

**Physical Handover Ledger:**

Central check-out and return inspection log for all issued lab assets.

## Hardware Catalog & Visual Assets (`public/images/`)

| Equipment ID | Hardware Model | Department | Image Asset |
|---|---|---|---|
| `eq_jetson_agx` | NVIDIA Jetson AGX Orin 64GB Dev Kit | CSE | `images/eq_agx_orin.jpg` |
| `eq_jetson_nano` | NVIDIA Jetson Orin Nano Kit | CSE | `images/eq_orin_nano.jpg` |
| `eq_rplidar` | RPLIDAR S2E Laser Scanner + IMU | Robotics | `images/eq_rplidar.jpg` |
| `eq_oscilloscope` | Digital Oscilloscope MSO Series | ECE | `images/eq_oscilloscope.jpg` |
| `eq_fpga` | Xilinx Zynq FPGA Dev Board | ECE | `images/eq_fpga.jpg` |
| `eq_3dprinter` | High-Precision Academic 3D Printer | Mechanical | `images/eq_3d_printer.jpg` |

## Security & Engineering Architecture

**Signed HttpOnly RBAC Session Cookies:**

Role switches (`STUDENT`, `FACULTY`, `LAB_ADMIN`) are persisted in HttpOnly, SameSite=Lax cookies and verified server-side before allowing state mutations.

**Strict Schema Validation:**

All incoming JSON bodies are validated with strict Zod schemas (`z.object(...).strict()`).

**Prompt Injection Defense:**

User-supplied project titles and concierge queries are sanitized (`sanitizeForPrompt`) and isolated before being passed to `gemini-2.5-flash`.

**Sliding-Window Rate Limiting:**

Per-actor and per-IP rate limiting (`checkRateLimit`) protects AI inference endpoints from abuse.

**Atomic Slot Locking:**

Server-side overlap detection prevents race conditions and returns structured `409 Conflict` responses to trigger AI conflict mediation.

## Deployment & Configuration

### Environment Variables

Configure the following variable in `.env.local` (for local development) and in Vercel → Settings → Environment Variables (for production):

```env
GEMINI_API_KEY=your_google_gemini_api_key
