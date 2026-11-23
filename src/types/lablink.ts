export type Role = "STUDENT" | "FACULTY" | "LAB_ADMIN";
export type SlotState = "OPEN" | "BOOKED" | "MAINTENANCE";
export type BookingLifecycle =
  | "PENDING_FACULTY"
  | "APPROVED"
  | "REJECTED"
  | "CHECKED_OUT"
  | "RETURNED";

export interface EquipmentItem {
  id: string;
  name: string;
  department: string;
  labRoom: string;
  bayCode: string;
  specs: string;
  tags: string[];
  safetyPrereq: string;
  requiresApproval: boolean;
  maintenanceLock: boolean;
  utilizationPct: number;
  hourlySlots: Record<number, SlotState>;
}

export interface BookingRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  studentName: string;
  collaborators: string[];
  projectId: string;
  projectTitle: string;
  projectDeadline: string;
  slotLabel: string;
  startHour: number;
  endHour: number;
  status: BookingLifecycle;
  aiRationale?: string;
}

export interface StudentProject {
  id: string;
  title: string;
  category: "Capstone" | "Hackathon" | "Course Lab";
  deadline: string;
  abstract: string;
  collaborators: string[];
}

export interface AiRecommendation {
  optionTitle: string;
  targetEquipmentId: string;
  suggestedSlot: string;
  startHour: number;
  endHour: number;
  actionType: "SWITCH_LAB_UNIT" | "SHIFT_TIME_SLOT" | "SPLIT_SESSION";
  fairnessScore: number;
  reasoning: string;
}

export interface AiResolution {
  priorityWinner: string;
  fairnessSummary: string;
  recommendations: AiRecommendation[];
}