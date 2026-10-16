import type { Timestamp } from "firebase/firestore";

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "annual-leave"
  | "sick-leave";
export type LeaveType = "Annual leave" | "Sick leave";

export interface LeaveBalance {
  annualDays: number;
  sickDays: number;
}

export interface TrackRecord {
  role: string;
  startDate: string;
  endDate: string;
}

export const EMPLOYEE_BADGES = [
  { id: "team-player", label: "Team Player", description: "Recognizes collaboration and support for teammates." },
  { id: "problem-solver", label: "Problem Solver", description: "Recognizes initiative in solving difficult challenges." },
  { id: "innovation", label: "Innovation", description: "Recognizes creative ideas and improvements." },
  { id: "mentorship", label: "Mentorship", description: "Recognizes guidance and support for colleagues." },
  { id: "customer-impact", label: "Customer Impact", description: "Recognizes meaningful impact for customers." },
  { id: "excellence", label: "Excellence", description: "Recognizes consistently excellent work." },

  // Attendance & Punctuality
  { id: "attendance-champion", label: "Attendance Champion", description: "Recognizes consistent daily attendance over a defined period." },
  { id: "on-time-hero", label: "On-Time Hero", description: "Recognizes consistently arriving on time and respecting work schedules." },
  { id: "perfect-attendance", label: "Perfect Attendance", description: "Recognizes completing a defined period without unplanned absences." },
  { id: "early-bird", label: "Early Bird", description: "Recognizes consistently arriving before the scheduled start time." },
  { id: "streak-master", label: "Streak Master", description: "Recognizes maintaining a sustained streak of regular attendance." },
  { id: "break-return-pro", label: "Break Return Pro", description: "Recognizes consistently returning from breaks on schedule." },

  // Reliability & Commitment
  { id: "dependability", label: "Dependability", description: "Recognizes being reliable, accountable, and ready to contribute." },
  { id: "deadline-crusher", label: "Deadline Crusher", description: "Recognizes consistently completing assigned work on time." },
  { id: "consistency-star", label: "Consistency Star", description: "Recognizes maintaining dependable performance over time." },
  { id: "extra-mile", label: "Going the Extra Mile", description: "Recognizes voluntary effort that meaningfully supports team goals." },
] as const;

export type EmployeeBadgeId = (typeof EMPLOYEE_BADGES)[number]["id"];

export interface EmployeeProfile {
  uid: string;
  email: string;
  photoURL?: string;
  officialEmail?: string;
  displayName: string;
  nickname?: string;
  status: ApprovalStatus;
  reportingManagerId?: string;
  githubId?: string;
  trackRecords?: TrackRecord[];
  phone?: string;
  leaveBalances?: Record<string, LeaveBalance>;
  badges?: EmployeeBadgeId[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function getEmployeeDisplayName(
  employee: Pick<EmployeeProfile, "displayName" | "nickname">,
): string {
  return employee.nickname?.trim() || employee.displayName;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeEmail: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  createdAt?: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: AttendanceStatus;
  note: string;
  recordedAt?: Timestamp;
  recordedBy: string;
}

export interface NoticePost {
  id: string;
  title: string;
  body: string;
  createdAt?: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export type ConcernStatus = "open" | "resolved";
export type ConcernAuthorRole = "employee" | "admin";

export interface Concern {
  id: string;
  employeeId: string;
  employeeEmail: string;
  employeeName: string;
  subject: string;
  body: string;
  status: ConcernStatus;
  lastMessageBy: ConcernAuthorRole;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ConcernMessage {
  id: string;
  authorId: string;
  authorRole: ConcernAuthorRole;
  text: string;
  createdAt?: Timestamp;
}

export interface DailyUpdate {
  id: string;
  employeeId: string;
  employeeEmail: string;
  employeeName: string;
  date: string;
  todaysTasks: string[];
  suddenTasks: string[];
  blockers: string[];
  plans: string[];
  updatedAt?: Timestamp;
}

export type DailyUpdateFields = Pick<
  DailyUpdate,
  "todaysTasks" | "suddenTasks" | "blockers" | "plans"
>;

export type PortalSection =
  | "overview"
  | "notices"
  | "daily"
  | "leaves"
  | "attendance"
  | "leave-policy"
  | "career-policy"
  | "concerns"
  | "profile"
  | "team";
