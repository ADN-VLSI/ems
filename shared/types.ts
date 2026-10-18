/**
 * Shared types for Employee Daily Update System (EMS)
 */

export interface Employee {
  id: string;
  githubId: string;
  githubUsername: string;
  name: string;
  email: string;
  officialEmail?: string | null;
  avatarUrl?: string;
  teamId?: string | null;
  managerName?: string | null;
  managerGithubUsername?: string | null;
  role: 'employee' | 'manager' | 'admin';
  approvalStatus?: 'pending' | 'approved';
  createdAt?: string;
  updatedAt?: string;
}

export interface Team {
  id: string;
  managerName?: string | null;
  managerEmail?: string | null;
  managerGithubUsername?: string | null;
  createdAt?: string;
}

export interface UpdateSections {
  todaysTasks: string[];
  suddenTasks: string[];
  blockers: string[];
  plansGoingForward: string[];
}

export type UpdateStatus = 'draft' | 'submitted' | 'locked';

export interface DailyUpdate extends UpdateSections {
  id?: string;
  employeeId: string;
  employeeName?: string;
  employeeGithubUsername?: string;
  teamId?: string | null;
  date: string; // YYYY-MM-DD in designated timezone
  status: UpdateStatus;
  submittedAt?: string | null;
  lockedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeadlineStatus {
  currentTimeIso: string;
  timezone: string; // e.g. "Asia/Dhaka"
  currentDate: string; // YYYY-MM-DD
  deadlineIso: string; // YYYY-MM-DD 23:30:00 ISO
  deadlineDisplay: string; // e.g. "11:30 PM Asia/Dhaka"
  isLocked: boolean;
  remainingSeconds: number;
  nextSubmissionDate: string; // YYYY-MM-DD
  nextSubmissionDeadlineDisplay: string;
}

export interface GitHubProjectLink {
  id?: string;
  name: string;
  url: string;
  status?: string; // e.g. "In Progress", "Todo", "Done"
}

export interface GitHubIssueItem {
  id: string;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  repository: string; // "org/repo"
  repositoryUrl: string;
  labels: { name: string; color?: string }[];
  projects: GitHubProjectLink[];
  updatedAt: string;
}

export interface ReportDeliveryRecord {
  id: string;
  date: string;
  reportType: 'employee_individual' | 'team_manager' | 'company_wide';
  recipientEmail: string;
  status: 'pending' | 'sent' | 'failed';
  messageId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export interface PreparedEmail {
  id: string;
  type: 'employee_individual' | 'team_manager' | 'company_wide';
  to: string;
  cc?: string[];
  subject: string;
  htmlContent: string;
  textContent: string;
  recipientName: string;
  date: string;
}

export interface DailyReportBatch {
  date: string;
  timezone: string;
  alreadySentCount: number;
  emailsToSend: PreparedEmail[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  quotaWarning?: string;
}
