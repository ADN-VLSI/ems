import type { Timestamp } from "firebase/firestore";

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type AttendanceStatus = "present" | "late" | "absent" | "leave";
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

export interface EmployeeProfile {
  uid: string;
  email: string;
  displayName: string;
  status: ApprovalStatus;
  githubId?: string;
  trackRecords?: TrackRecord[];
  phone?: string;
  leaveBalances?: Record<string, LeaveBalance>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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

export type PortalSection =
  | "overview"
  | "leaves"
  | "attendance"
  | "concerns"
  | "profile"
  | "team";
