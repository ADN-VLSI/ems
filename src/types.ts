import type { Timestamp } from "firebase/firestore";

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type AttendanceStatus = "present" | "late" | "absent" | "leave";
export type LeaveType = "Annual leave" | "Sick leave";

export interface LeaveBalance {
  annualDays: number;
  sickDays: number;
}

export interface EmployeeProfile {
  uid: string;
  email: string;
  displayName: string;
  status: ApprovalStatus;
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

export type PortalSection = "overview" | "leaves" | "attendance" | "team";
