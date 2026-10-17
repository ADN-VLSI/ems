import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import {
  ArrowDownRight,
  ArrowRight,
  Award,
  BadgeCheck,
  Brain,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  FilePlus2,
  Fingerprint,
  GraduationCap,
  Handshake,
  Lightbulb,
  ListChecks,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquareText,
  Pencil,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Star,
  Sunrise,
  Timer,
  Trophy,
  TrendingUp,
  Trash2,
  Users,
  UserRound,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { auth, db, googleProvider, ADMIN_EMAIL } from "./firebase";
import {
  ensureEmployeeProfile,
  listenToAttendance,
  listenToConcerns,
  listenToEmployees,
  listenToLeaveRequests,
  listenToNotices,
  listenToProfile,
  clearMonthlyRecords,
  type MonthCleanupCounts,
} from "./data";
import { ConcernsPage, needsAdminReply } from "./Concerns";
import { DailyUpdatesPage, DailyUpdateSummary } from "./DailyUpdates";
import { PolicyPage } from "./Policies";
import {
  PaginationControls,
  SortControls,
  sortItems,
  usePagination,
  type SortDirection,
} from "./Pagination";
import { EMPLOYEE_BADGES, getEmployeeDisplayName } from "./types";
import type {
  ApprovalStatus,
  AttendanceRecord,
  AttendanceStatus,
  Concern,
  EmployeeBadgeId,
  EmployeeProfile,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  NoticePost,
  PortalSection,
  TrackRecord,
} from "./types";

type Notice = { kind: "success" | "error"; message: string };
type EmployeeProfileDetails = {
  displayName: string;
  nickname: string;
  officialEmail: string;
  githubId: string;
  trackRecords: TrackRecord[];
  phone: string;
};

const sectionTitles: Record<PortalSection, string> = {
  overview: "Overview",
  notices: "Notice board",
  leaves: "Leave management",
  attendance: "Attendance",
  "leave-policy": "Leave policy",
  "career-policy": "Career progression policy",
  concerns: "Concerns",
  daily: "Daily update",
  profile: "My profile",
  team: "Employee directory",
};

const employeeBadgeIcons: Record<EmployeeBadgeId, LucideIcon> = {
  "team-player": Users,
  "problem-solver": Brain,
  innovation: Lightbulb,
  mentorship: GraduationCap,
  "customer-impact": Handshake,
  excellence: Trophy,
  "attendance-champion": CalendarCheck2,
  "on-time-hero": Clock3,
  "perfect-attendance": BadgeCheck,
  "early-bird": Sunrise,
  "streak-master": Award,
  "break-return-pro": Coffee,
  dependability: ShieldCheck,
  "deadline-crusher": Timer,
  "consistency-star": Star,
  "extra-mile": Rocket,
};

const localToday = new Date();
const today = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, "0")}-${String(localToday.getDate()).padStart(2, "0")}`;

function friendlyError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

function isAuthError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === `auth/${code}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function attendanceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    present: "Present",
    late: "Late",
    absent: "Absent",
    leave: "Leave",
    "annual-leave": "Annual Leave",
    "sick-leave": "Sick Leave",
  };
  return labels[status] ?? status;
}

function OverviewClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const time = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Dhaka",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);
  const date = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Dhaka",
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="banner-datetime" aria-label="Current time and date">
      <time className="banner-clock" dateTime={now.toISOString()}>{time}</time>
      <time className="banner-date" dateTime={now.toISOString()}>{date}</time>
    </div>
  );
}

function formatTimestamp(value?: { toDate: () => Date }): string {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value.toDate());
}

function dayCount(start: string, end: string): number {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return 0;
  }
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function fiscalYearStartForDate(value: Date | string): number {
  const year =
    typeof value === "string" ? Number(value.slice(0, 4)) : value.getFullYear();
  const month =
    typeof value === "string" ? Number(value.slice(5, 7)) - 1 : value.getMonth();
  return month >= 6 ? year : year - 1;
}

function formatFiscalYear(startYear: number): string {
  return `FY ${startYear}–${startYear + 1}`;
}

function leaveTypeTone(type: string): string {
  if (type === "Annual leave") return "annual";
  if (type === "Sick leave") return "sick";
  return "other";
}

function daysInFiscalYear(request: LeaveRequest, startYear: number): number {
  const yearStart = `${startYear}-07-01`;
  const yearEnd = `${startYear + 1}-06-30`;
  const overlapStart = request.startDate > yearStart ? request.startDate : yearStart;
  const overlapEnd = request.endDate < yearEnd ? request.endDate : yearEnd;
  return overlapEnd < overlapStart ? 0 : dayCount(overlapStart, overlapEnd);
}

function availableFiscalYears(
  employees: EmployeeProfile[],
  requests: LeaveRequest[],
  currentYear: number,
): number[] {
  const years = new Set([currentYear - 1, currentYear, currentYear + 1]);
  employees.forEach((employee) => {
    Object.keys(employee.leaveBalances ?? {}).forEach((year) => {
      const startYear = Number(year);
      if (Number.isInteger(startYear)) years.add(startYear);
    });
  });
  requests.forEach((request) => {
    years.add(fiscalYearStartForDate(request.startDate));
    years.add(fiscalYearStartForDate(request.endDate));
  });
  return [...years].sort((a, b) => b - a);
}

function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Declined",
  };
  return (
    <span className={`status-pill status-${status}`}>
      <span className="status-dot" />
      {labels[status] ?? attendanceStatusLabel(status)}
    </span>
  );
}

function Initials({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return <span className="avatar">{initials || "AD"}</span>;
}

function EmployeeAvatar({
  name,
  photoURL,
}: {
  name: string;
  photoURL?: string;
}) {
  const [failedPhotoURL, setFailedPhotoURL] = useState<string | null>(null);
  return photoURL && photoURL !== failedPhotoURL ? (
    <img
      className="avatar avatar-photo"
      src={photoURL}
      alt=""
      onError={() => setFailedPhotoURL(photoURL)}
    />
  ) : (
    <Initials name={name} />
  );
}

function Button({
  children,
  variant = "primary",
  type = "button",
  disabled = false,
  onClick,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      className={`button button-${variant} ${className}`}
      type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SignInScreen({
  busy,
  error,
  onSignIn,
}: {
  busy: boolean;
  error: string;
  onSignIn: () => void;
}) {
  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="brand-mark brand-mark-large">
          <Fingerprint size={28} strokeWidth={1.8} />
        </div>
        <div className="brand-copy">
          <span className="brand-name">ADN</span>
          <span className="brand-caption">SEMICONDUCTORS</span>
        </div>
        <div className="login-brand-copy">
          <div className="eyebrow eyebrow-light">PEOPLE FIRST. BUILT TOGETHER.</div>
          <h1>A better workday starts here.</h1>
          <p>
            Your one place for time off, attendance, and everything that keeps
            our team moving.
          </p>
        </div>
        <div className="login-footnote">
          <ShieldCheck size={17} />
          Secure access for ADN team members
        </div>
        <div className="brand-decoration brand-decoration-one" />
        <div className="brand-decoration brand-decoration-two" />
      </section>

      <section className="login-content">
        <div className="login-card">
          <div className="mobile-brand">
            <span className="brand-mark">
              <Fingerprint size={22} />
            </span>
            <span className="brand-name">ADN</span>
          </div>
          <span className="eyebrow">EMPLOYEE PORTAL</span>
          <h2>Welcome to your workspace</h2>
          <p className="login-description">
            Sign in with your Google account to get started.
          </p>
          {error && <div className="form-error">{error}</div>}
          <Button className="google-button" disabled={busy} onClick={onSignIn}>
            <GoogleGlyph />
            {busy ? "Connecting…" : "Continue with Google"}
            {!busy && <ArrowRight size={17} />}
          </Button>
          <div className="login-divider">
            <span>YOUR ACCOUNT, YOUR ACCESS</span>
          </div>
          <ul className="login-benefits">
            <li>
              <span className="benefit-icon"><CalendarDays size={16} /></span>
              Apply for leave and follow its progress
            </li>
            <li>
              <span className="benefit-icon"><Clock3 size={16} /></span>
              View attendance recorded by your admin
            </li>
          </ul>
          <p className="approval-note">
            New here? Your account will be ready after admin approval.
          </p>
        </div>
        <div className="login-legal">
          By continuing, you agree to use this portal for ADN work purposes.
        </div>
      </section>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" className="google-glyph" viewBox="0 0 48 48">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18Z"
      />
      <path
        fill="#EA4335"
        d="M24 11.8c3 0 5.7 1 7.8 3l5.8-5.8C34.1 5.7 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z"
      />
    </svg>
  );
}

function PendingAccess({
  status,
  user,
  onSignOut,
}: {
  status: ApprovalStatus;
  user: User;
  onSignOut: () => void;
}) {
  const rejected = status === "rejected";
  return (
    <main className="access-shell">
      <div className="access-card">
        <div className={`access-icon ${rejected ? "access-icon-rejected" : ""}`}>
          {rejected ? <XCircle size={27} /> : <Clock3 size={27} />}
        </div>
        <span className="eyebrow">ADN EMPLOYEE PORTAL</span>
        <h1>{rejected ? "Access was not approved" : "You’re on the list"}</h1>
        <p>
          {rejected
            ? "Your account was not approved for this portal. Please contact your administrator if you think this is a mistake."
            : "Your Google account is registered. An administrator needs to approve your access before you can use employee features."}
        </p>
        <div className="account-chip">
          <Initials name={user.displayName || user.email || "ADN"} />
          <span>{user.email}</span>
          <StatusPill status={status} />
        </div>
        <Button variant="secondary" onClick={onSignOut}>
          <LogOut size={16} />
          Sign out
        </Button>
        <div className="access-admin">Questions? Contact adn.semicon@gmail.com</div>
      </div>
    </main>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState("");
  const [section, setSection] = useState<PortalSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [boardNotices, setBoardNotices] = useState<NoticePost[]>([]);
  const [concerns, setConcerns] = useState<Concern[]>([]);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const currentEmployeeName = profile
    ? getEmployeeDisplayName(profile)
    : user?.displayName || user?.email?.split("@")[0] || "Employee";

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setError("");
      setAuthLoading(true);
      setUser(currentUser);
      setProfile(null);
      if (currentUser?.email) {
        try {
          await ensureEmployeeProfile(
            currentUser.uid,
            currentUser.email,
            currentUser.displayName || currentUser.email.split("@")[0],
            currentUser.photoURL,
          );
        } catch (profileError) {
          setError(
            `We could not sync your employee profile. ${friendlyError(profileError)}`,
          );
        }
      }
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || isAdmin) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    return listenToProfile(
      user.uid,
      (nextProfile) => {
        setProfile(nextProfile);
        setProfileLoading(false);
      },
      (listenError) => {
        setError(`Could not load your employee profile. ${friendlyError(listenError)}`);
        setProfileLoading(false);
      },
    );
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || (!isAdmin && profile?.status !== "approved")) {
      setEmployees([]);
      setLeaveRequests([]);
      setAttendance([]);
      setBoardNotices([]);
      setConcerns([]);
      return;
    }

    const fail = (listenError: Error) =>
      setError(`Could not load portal data. ${friendlyError(listenError)}`);
    const stopLeaves = listenToLeaveRequests(
      user.uid,
      Boolean(isAdmin),
      setLeaveRequests,
      fail,
    );
    const stopAttendance = listenToAttendance(
      user.uid,
      Boolean(isAdmin),
      setAttendance,
      fail,
    );
    const stopNotices = listenToNotices(setBoardNotices, fail);
    const stopConcerns = listenToConcerns(
      user.uid,
      Boolean(isAdmin),
      setConcerns,
      fail,
    );
    const stopEmployees = listenToEmployees(Boolean(isAdmin), setEmployees, fail);

    return () => {
      stopLeaves();
      stopAttendance();
      stopNotices();
      stopConcerns();
      stopEmployees();
    };
  }, [user, isAdmin, profile?.status]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const approvedEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "approved"),
    [employees],
  );
  const pendingEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "pending"),
    [employees],
  );
  const pendingLeaves = useMemo(
    () => leaveRequests.filter((request) => request.status === "pending"),
    [leaveRequests],
  );
  async function handleSignIn() {
    setSignInBusy(true);
    setError("");
    googleProvider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (signInError) {
      if (isAuthError(signInError, "popup-blocked")) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          setError(
            isAuthError(redirectError, "unauthorized-domain")
              ? "Google sign-in is not enabled for this site. Open the portal on localhost or add this domain in Firebase Console under Authentication → Settings → Authorized domains."
              : `Popup sign-in was blocked, and redirect sign-in failed. ${friendlyError(redirectError)}`,
          );
        }
      } else if (isAuthError(signInError, "unauthorized-domain")) {
        setError(
          "Google sign-in is not enabled for this site. Open the portal on localhost or add this domain in Firebase Console under Authentication → Settings → Authorized domains.",
        );
      } else {
        setError(friendlyError(signInError));
      }
    } finally {
      setSignInBusy(false);
    }
  }

  async function updateEmployeeRow(
    employee: EmployeeProfile,
    fiscalYearStart: number,
    managerId: string,
    annualInput: string,
    sickInput: string,
  ) {
    const reportingManagerId = managerId.trim();
    const annualText = annualInput.trim();
    const sickText = sickInput.trim();
    const hasAnnual = annualText !== "";
    const hasSick = sickText !== "";
    if (hasAnnual !== hasSick) {
      setNotice({ kind: "error", message: "Enter both annual and sick leave balances, or leave both blank." });
      return;
    }

    const annualDays = Number(annualText);
    const sickDays = Number(sickText);
    if (
      hasAnnual &&
      (!Number.isInteger(annualDays) ||
        !Number.isInteger(sickDays) ||
        annualDays < 0 ||
        sickDays < 0)
    ) {
      setNotice({ kind: "error", message: "Leave balances must be non-negative whole numbers." });
      return;
    }
    if (
      reportingManagerId &&
      (reportingManagerId === employee.uid ||
        !employees.some(
          (candidate) => candidate.uid === reportingManagerId && candidate.status === "approved",
        ))
    ) {
      setNotice({ kind: "error", message: "Choose another approved employee as the reporting manager." });
      return;
    }

    const currentBalance = employee.leaveBalances?.[String(fiscalYearStart)];
    const managerChanged = reportingManagerId !== (employee.reportingManagerId ?? "");
    const balancesChanged =
      hasAnnual &&
      (annualDays !== currentBalance?.annualDays || sickDays !== currentBalance?.sickDays);
    if (!managerChanged && !balancesChanged) {
      setNotice({ kind: "error", message: "Change a reporting manager or leave balance before saving." });
      return;
    }

    try {
      const updates = {
        updatedAt: serverTimestamp(),
        ...(managerChanged ? { reportingManagerId } : {}),
        ...(balancesChanged
          ? {
              leaveBalances: {
                ...employee.leaveBalances,
                [String(fiscalYearStart)]: { annualDays, sickDays },
              },
            }
          : {}),
      };
      await updateDoc(doc(db, "users", employee.uid), updates);
      const manager = employees.find((candidate) => candidate.uid === reportingManagerId);
      const managerName = manager ? getEmployeeDisplayName(manager) : "";
      setNotice({
        kind: "success",
        message: `Saved ${getEmployeeDisplayName(employee)}'s row${
          balancesChanged ? `, including ${formatFiscalYear(fiscalYearStart)} leave balances` : ""
        }${managerChanged ? reportingManagerId ? ` and reporting manager ${managerName}` : " and removed the reporting manager" : ""}.`,
      });
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      setSection("overview");
      setNotice(null);
    } catch (signOutError) {
      setError(`Could not sign out. ${friendlyError(signOutError)}`);
    }
  }

  async function changeApproval(
    employee: EmployeeProfile,
    status: Exclude<ApprovalStatus, "pending">,
  ) {
    try {
      await updateDoc(doc(db, "users", employee.uid), {
        status,
        updatedAt: serverTimestamp(),
      });
      setNotice({
        kind: "success",
        message: `${getEmployeeDisplayName(employee)} ${status === "approved" ? "approved" : "declined"}.`,
      });
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
    }
  }

  async function updateEmployeeBadge(
    employee: EmployeeProfile,
    badgeId: EmployeeBadgeId,
    action: "award" | "remove",
  ) {
    if (!isAdmin || !user?.email) {
      setNotice({ kind: "error", message: "Only the administrator can manage employee badges." });
      return;
    }

    const badge = EMPLOYEE_BADGES.find((item) => item.id === badgeId);
    if (!badge) {
      setNotice({ kind: "error", message: "Choose a valid employee badge." });
      return;
    }

    try {
      await updateDoc(doc(db, "users", employee.uid), {
        badges: action === "award" ? arrayUnion(badgeId) : arrayRemove(badgeId),
        updatedAt: serverTimestamp(),
      });
      setNotice({
        kind: "success",
        message: action === "award"
          ? `Awarded ${badge.label} to ${getEmployeeDisplayName(employee)}.`
          : `Removed ${badge.label} from ${getEmployeeDisplayName(employee)}.`,
      });
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
    }
  }

  async function updateEmployeeDetails(
    employee: EmployeeProfile,
    details: EmployeeProfileDetails,
  ) {
    const values = {
      displayName: details.displayName.trim(),
      nickname: details.nickname.trim(),
      officialEmail: details.officialEmail.trim(),
      githubId: details.githubId.trim(),
      trackRecords: details.trackRecords.map((record) => ({
        role: record.role.trim(),
        startDate: record.startDate,
        endDate: record.endDate,
      })),
      phone: details.phone.trim(),
    };
    if (
      !values.displayName ||
      values.trackRecords.some(
        (record) =>
          !record.role ||
          !record.startDate ||
          (record.endDate && record.endDate < record.startDate),
      )
    ) {
      setNotice({
        kind: "error",
        message: "Enter an employee name and complete each track record with valid dates.",
      });
      return;
    }

    try {
      await updateDoc(doc(db, "users", employee.uid), {
        ...values,
        updatedAt: serverTimestamp(),
      });
      setNotice({ kind: "success", message: `Updated ${values.nickname || values.displayName}'s profile.` });
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
    }
  }

  async function deleteEmployee(employee: EmployeeProfile) {
    if (
      !window.confirm(
        `Delete ${getEmployeeDisplayName(employee)}'s profile and all associated leave and attendance records? Their Google sign-in account will not be deleted.`,
      )
    ) {
      return;
    }

    try {
      const [leaveSnapshot, attendanceSnapshot] = await Promise.all([
        getDocs(
          query(
            collection(db, "leaveRequests"),
            where("employeeId", "==", employee.uid),
          ),
        ),
        getDocs(
          query(
            collection(db, "attendance"),
            where("employeeId", "==", employee.uid),
          ),
        ),
      ]);
      const references = [
        ...leaveSnapshot.docs.map((item) => item.ref),
        ...attendanceSnapshot.docs.map((item) => item.ref),
        doc(db, "users", employee.uid),
      ];

      for (let index = 0; index < references.length; index += 450) {
        const batch = writeBatch(db);
        references
          .slice(index, index + 450)
          .forEach((reference) => batch.delete(reference));
        await batch.commit();
      }

      setNotice({
        kind: "success",
        message: `Deleted ${getEmployeeDisplayName(employee)}'s profile and associated records.`,
      });
    } catch (actionError) {
      setNotice({
        kind: "error",
        message: `Could not completely delete ${getEmployeeDisplayName(employee)}. Some associated records may already have been deleted. ${friendlyError(actionError)}`,
      });
    }
  }

  async function deleteMonthlyRecords(month: string): Promise<MonthCleanupCounts> {
    if (!isAdmin) throw new Error("Only the administrator can delete monthly records.");
    return clearMonthlyRecords(month);
  }

  async function saveBoardNotice(
    noticeId: string | null,
    title: string,
    body: string,
  ): Promise<boolean> {
    if (!user?.email || !isAdmin) {
      setNotice({ kind: "error", message: "Only the administrator can publish notices." });
      return false;
    }
    const values = { title: title.trim(), body: body.trim() };
    if (values.title.length < 3 || values.title.length > 120 || !values.body || values.body.length > 4000) {
      setNotice({
        kind: "error",
        message: "Use a title of 3–120 characters and message of 1–4000 characters.",
      });
      return false;
    }

    try {
      if (noticeId) {
        await updateDoc(doc(db, "notices", noticeId), {
          ...values,
          updatedAt: serverTimestamp(),
          updatedBy: user.email,
        });
        setNotice({ kind: "success", message: "Notice updated." });
        return true;
      } else {
        await addDoc(collection(db, "notices"), {
          ...values,
          createdAt: serverTimestamp(),
          createdBy: user.email,
        });
        setNotice({ kind: "success", message: "Notice published." });
        return true;
      }
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
      return false;
    }
  }

  async function deleteBoardNotice(boardNotice: NoticePost) {
    if (!window.confirm(`Delete the notice “${boardNotice.title}”?`)) return;
    try {
      await deleteDoc(doc(db, "notices", boardNotice.id));
      setNotice({ kind: "success", message: "Notice deleted." });
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
    }
  }

  async function reviewLeave(
    request: LeaveRequest,
    status: Exclude<LeaveStatus, "pending">,
  ) {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "leaveRequests", request.id), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: user?.email,
      });
      batch.set(doc(db, "leaveNotifications", `${request.id}_${status}`), {
        requestId: request.id,
        employeeId: request.employeeId,
        event: status,
        employeeEmail: request.employeeEmail,
        employeeName: request.employeeName,
        type: request.type,
        startDate: request.startDate,
        endDate: request.endDate,
        reason: request.reason,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      setNotice({
        kind: "success",
        message: `Leave request ${status === "approved" ? "approved" : "declined"}.`,
      });
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
    }
  }

  async function deleteLeaveRequest(request: LeaveRequest) {
    if (!window.confirm(`Delete ${request.employeeName}'s leave request?`)) return;
    try {
      await deleteDoc(doc(db, "leaveRequests", request.id));
      setNotice({ kind: "success", message: "Leave request deleted." });
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
    }
  }

  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const type = String(form.get("type") ?? "");
    const startDate = String(form.get("startDate") ?? "");
    const endDate = String(form.get("endDate") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    if (
      (type !== "Annual leave" && type !== "Sick leave") ||
      !startDate ||
      !endDate ||
      !reason
    ) {
      setNotice({ kind: "error", message: "Complete every field before submitting." });
      return;
    }
    if (endDate < startDate) {
      setNotice({ kind: "error", message: "The end date must be on or after the start date." });
      return;
    }
    if (type === "Annual leave" && startDate < today) {
      setNotice({ kind: "error", message: "Annual leave cannot start in the past." });
      return;
    }
    if (type === "Sick leave" && (startDate > today || endDate > today)) {
      setNotice({ kind: "error", message: "Sick leave can only be requested for today or a past absence." });
      return;
    }

    try {
      const leaveRequest = doc(collection(db, "leaveRequests"));
      const batch = writeBatch(db);
      batch.set(leaveRequest, {
        employeeId: user.uid,
        employeeEmail: user.email,
        employeeName: getEmployeeDisplayName(profile),
        type,
        startDate,
        endDate,
        reason,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, "leaveNotifications", `${leaveRequest.id}_submitted`), {
        requestId: leaveRequest.id,
        employeeId: user.uid,
        event: "submitted",
        employeeEmail: user.email,
        employeeName: getEmployeeDisplayName(profile),
        type,
        startDate,
        endDate,
        reason,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      formElement.reset();
      setNotice({ kind: "success", message: "Your leave request has been submitted." });
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
    }
  }

  async function recordAttendance(
    employee: EmployeeProfile,
    date: string,
    status: AttendanceStatus,
    note: string,
  ): Promise<boolean> {
    if (!user) return false;
    if (!date || date > today) {
      setNotice({ kind: "error", message: "Choose a valid attendance date no later than today." });
      return false;
    }

    try {
      if (!approvedEmployees.some((item) => item.uid === employee.uid)) {
        setNotice({ kind: "error", message: "This employee is no longer approved for attendance." });
        return false;
      }
      const recordId = `${employee.uid}_${date}`;
      const existing = attendance.find((record) => record.id === recordId);
      const savedNote = note.trim() || existing?.note || "";
      await setDoc(doc(db, "attendance", recordId), {
        employeeId: employee.uid,
        employeeName: getEmployeeDisplayName(employee),
        date,
        status,
        note: savedNote,
        recordedAt: serverTimestamp(),
        recordedBy: user.email,
      });
      setAttendance((current) => [
        {
          id: recordId,
          employeeId: employee.uid,
          employeeName: getEmployeeDisplayName(employee),
          date,
          status,
          note: savedNote,
          recordedBy: user.email || "",
        },
        ...current.filter((record) => record.id !== recordId),
      ]);
      setNotice({
        kind: "success",
        message: `${getEmployeeDisplayName(employee)} marked ${attendanceStatusLabel(status)} for ${formatDate(date)}.`,
      });
      return true;
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
      return false;
    }
  }

  async function deleteAttendanceRecord(record: AttendanceRecord) {
    if (
      !window.confirm(
        `Delete ${record.employeeName}'s attendance record for ${formatDate(record.date)}?`,
      )
    ) {
      return;
    }
    try {
      await deleteDoc(doc(db, "attendance", record.id));
      setNotice({ kind: "success", message: "Attendance record deleted." });
    } catch (actionError) {
      setNotice({ kind: "error", message: friendlyError(actionError) });
    }
  }

  if (authLoading) {
    return (
      <main className="loading-shell">
        <div className="loader-mark"><Fingerprint size={27} /></div>
        <span>Opening your workspace…</span>
      </main>
    );
  }

  if (!user) {
    return <SignInScreen busy={signInBusy} error={error} onSignIn={handleSignIn} />;
  }

  if (!isAdmin) {
    if (profileLoading || !profile) {
      return (
        <main className="loading-shell">
          <div className="loader-mark"><Fingerprint size={27} /></div>
          <span>{error || "Preparing your employee profile…"}</span>
          {error && <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>}
        </main>
      );
    }
    if (profile.status !== "approved") {
      return (
        <PendingAccess
          status={profile.status}
          user={user}
          onSignOut={handleSignOut}
        />
      );
    }
  }

  const activeSection = isAdmin && section === "team"
    ? "team"
    : isAdmin && section === "profile"
      ? "overview"
      : section;

  return (
    <div className="portal-shell">
      {mobileNavOpen && (
        <button
          aria-label="Close navigation"
          className="mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Fingerprint size={22} /></div>
          <div className="brand-copy">
            <span className="brand-name">ADN</span>
            <span className="brand-caption">PEOPLE PORTAL</span>
          </div>
          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav className="main-nav" aria-label="Main navigation">
          <NavButton
            icon={<LayoutDashboard size={18} />}
            active={activeSection === "overview"}
            onClick={() => { setSection("overview"); setMobileNavOpen(false); }}
          >
            Overview
          </NavButton>
          <NavButton
            icon={<Megaphone size={18} />}
            active={activeSection === "notices"}
            onClick={() => { setSection("notices"); setMobileNavOpen(false); }}
          >
            Notice board
          </NavButton>
          <NavButton
            icon={<CalendarDays size={18} />}
            active={activeSection === "leaves"}
            onClick={() => { setSection("leaves"); setMobileNavOpen(false); }}
          >
            Leave requests
            {isAdmin && pendingLeaves.length > 0 && (
              <span className="nav-count">{pendingLeaves.length}</span>
            )}
          </NavButton>
          <NavButton
            icon={<CalendarCheck2 size={18} />}
            active={activeSection === "attendance"}
            onClick={() => { setSection("attendance"); setMobileNavOpen(false); }}
          >
            Attendance
          </NavButton>
          <NavButton
            icon={<ListChecks size={18} />}
            active={activeSection === "daily"}
            onClick={() => { setSection("daily"); setMobileNavOpen(false); }}
          >
            Daily update
          </NavButton>
          <NavButton
            icon={<MessageSquareText size={18} />}
            active={activeSection === "concerns"}
            onClick={() => { setSection("concerns"); setMobileNavOpen(false); }}
          >
            Concerns
            {isAdmin && concerns.some(needsAdminReply) && (
              <span className="nav-count">{concerns.filter(needsAdminReply).length}</span>
            )}
          </NavButton>
          {!isAdmin && (
            <NavButton
              icon={<UserRound size={18} />}
              active={activeSection === "profile"}
              onClick={() => { setSection("profile"); setMobileNavOpen(false); }}
            >
              My profile
            </NavButton>
          )}
          {!isAdmin && (
            <NavButton
              icon={<Users size={18} />}
              active={activeSection === "team"}
              onClick={() => { setSection("team"); setMobileNavOpen(false); }}
            >
              Employee directory
            </NavButton>
          )}
          {!isAdmin && <span className="nav-label">POLICIES</span>}
          {!isAdmin && (
            <>
              <NavButton
                icon={<BookOpen size={18} />}
                active={activeSection === "leave-policy"}
                onClick={() => { setSection("leave-policy"); setMobileNavOpen(false); }}
              >
                Leave policy
              </NavButton>
              <NavButton
                icon={<TrendingUp size={18} />}
                active={activeSection === "career-policy"}
                onClick={() => { setSection("career-policy"); setMobileNavOpen(false); }}
              >
                Career progression
              </NavButton>
            </>
          )}
          {isAdmin && (
            <NavButton
              icon={<Users size={18} />}
              active={activeSection === "team"}
              onClick={() => { setSection("team"); setMobileNavOpen(false); }}
            >
              Employees
              {pendingEmployees.length > 0 && (
                <span className="nav-count">{pendingEmployees.length}</span>
              )}
            </NavButton>
          )}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>ADN</span>
            <span className="crumb-divider">/</span>
            <strong>{sectionTitles[activeSection]}</strong>
          </div>
          <div className="topbar-account">
            {user.photoURL ? (
              <img className="avatar avatar-photo" src={user.photoURL} alt="" />
            ) : (
              <Initials name={currentEmployeeName} />
            )}
            <span className="topbar-account-copy">
              <strong>{currentEmployeeName || "ADN team member"}</strong>
              <small>{isAdmin ? "Admin" : "Team member"}</small>
            </span>
            <button className="icon-button" aria-label="Sign out" onClick={handleSignOut}>
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{isAdmin ? "ADMIN CONSOLE" : "YOUR WORKSPACE"}</span>
              <h1>{sectionTitles[activeSection]}</h1>
              <p>
                {activeSection === "overview"
                  ? isAdmin
                    ? "A clear view of your people operations."
                    : `Good to see you, ${currentEmployeeName.split(" ")[0]}. Here’s your work at a glance.`
                  : activeSection === "leaves"
                    ? isAdmin
                      ? "Review employee requests and keep your team moving."
                      : "Plan time away and keep track of your requests."
                    : activeSection === "attendance"
                      ? isAdmin
                        ? "Record daily attendance for your approved team."
                        : "Your attendance is recorded by the ADN administrator."
                        : activeSection === "daily"
                          ? isAdmin
                            ? "Updates submitted by employees today."
                            : "Share today's tasks, blockers and plans."
                        : activeSection === "concerns"
                          ? isAdmin
                            ? "Private one-to-one conversations with employees."
                            : "Raise a concern privately with the administrator."
                        : activeSection === "notices"
                          ? isAdmin
                            ? "Publish updates for the whole team."
                            : "Read announcements from the ADN administrator."
                          : activeSection === "leave-policy"
                            ? "Review the rules and guidance for annual and sick leave."
                            : activeSection === "career-policy"
                              ? "Review engineering levels, responsibilities, and progression criteria."
                          : activeSection === "profile"
                            ? "Review your personal employee details."
                            : "Manage access and keep your employee list up to date."}
              </p>
            </div>
            {activeSection === "leaves" && !isAdmin && (
              <a className="button button-primary heading-action" href="#leave-form">
                <Plus size={17} /> New leave request
              </a>
            )}
          </div>

          {error && (
            <div className="notice notice-error" role="alert">
              <XCircle size={17} /> {error}
              <button className="icon-button" aria-label="Dismiss" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div
              className={`notice ${notice.kind === "success" ? "notice-success" : "notice-error"}`}
              role="status"
            >
              {notice.kind === "success" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
              {notice.message}
              <button className="icon-button" aria-label="Dismiss" onClick={() => setNotice(null)}>
                <X size={16} />
              </button>
            </div>
          )}

          {activeSection === "overview" && (
            <Overview
              isAdmin={Boolean(isAdmin)}
              user={user}
              profile={profile}
              employees={approvedEmployees}
              pendingEmployees={pendingEmployees}
              requests={leaveRequests}
              pendingLeaves={pendingLeaves}
              attendance={attendance}
              boardNotices={boardNotices}
              onSaveNotice={saveBoardNotice}
              onDeleteNotice={deleteBoardNotice}
              onApprove={changeApproval}
              onReview={reviewLeave}
              onOpenDaily={() => setSection("daily")}
              onOpenLeaves={() => setSection("leaves")}
              onOpenAttendance={() => setSection("attendance")}
              onOpenTeam={() => setSection("team")}
            />
          )}
          {activeSection === "notices" && (
            <NoticeBoard
              isAdmin={Boolean(isAdmin)}
              boardNotices={boardNotices}
              onSaveNotice={saveBoardNotice}
              onDeleteNotice={deleteBoardNotice}
            />
          )}
          {activeSection === "leave-policy" && !isAdmin && (
            <PolicyPage policyId="leave-policy" />
          )}
          {activeSection === "career-policy" && !isAdmin && (
            <PolicyPage policyId="career-policy" />
          )}
          {activeSection === "profile" && !isAdmin && profile && (
            <EmployeeDetailsPanel
              profile={profile}
              employees={approvedEmployees}
              isOwnProfile
            />
          )}
          {activeSection === "leaves" && (
            <LeavesPage
              isAdmin={Boolean(isAdmin)}
              user={user}
              profile={profile}
              employees={approvedEmployees}
              requests={leaveRequests}
              onSubmit={submitLeave}
              onReview={reviewLeave}
              onDeleteRequest={deleteLeaveRequest}
            />
          )}
          {activeSection === "attendance" && (
            <AttendancePage
              isAdmin={Boolean(isAdmin)}
              user={user}
              profile={profile}
              employees={approvedEmployees}
              records={attendance}
              leaveRequests={leaveRequests}
              onSetStatus={recordAttendance}
              onDeleteRecord={deleteAttendanceRecord}
            />
          )}
          {activeSection === "daily" && (
            <DailyUpdatesPage
              isAdmin={Boolean(isAdmin)}
              userId={user.uid}
              userEmail={user.email ?? ""}
              userName={currentEmployeeName}
              onNotice={(kind, message) => setNotice({ kind, message })}
            />
          )}
          {activeSection === "concerns" && (
            <ConcernsPage
              isAdmin={Boolean(isAdmin)}
              userId={user.uid}
              userEmail={user.email ?? ""}
              userName={currentEmployeeName}
              concerns={concerns}
              onNotice={(kind, message) => setNotice({ kind, message })}
            />
          )}
          {activeSection === "team" && isAdmin && (
            <TeamPage
              employees={employees}
              attendance={attendance}
              leaveRequests={leaveRequests}
              onApprove={changeApproval}
              onSaveEmployeeRow={updateEmployeeRow}
              onSaveEmployeeDetails={updateEmployeeDetails}
              onAwardBadge={(employee, badgeId) =>
                updateEmployeeBadge(employee, badgeId, "award")
              }
              onRemoveBadge={(employee, badgeId) =>
                updateEmployeeBadge(employee, badgeId, "remove")
              }
              onDeleteEmployee={deleteEmployee}
              onDeleteMonthlyRecords={deleteMonthlyRecords}
              onNotice={(kind, message) => setNotice({ kind, message })}
            />
          )}
          {activeSection === "team" && !isAdmin && (
            <EmployeeDirectoryPage
              employees={approvedEmployees}
              managerId={user.uid}
            />
          )}
        </div>
        <footer className="page-footer">
          <span>ADN Semiconductors · Employee portal</span>
        </footer>
      </main>
    </div>
  );
}

function NavButton({
  children,
  icon,
  active,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`nav-button ${active ? "nav-button-active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function NoticeBoard({
  isAdmin,
  boardNotices,
  onSaveNotice,
  onDeleteNotice,
}: {
  isAdmin: boolean;
  boardNotices: NoticePost[];
  onSaveNotice: (noticeId: string | null, title: string, body: string) => Promise<boolean>;
  onDeleteNotice: (notice: NoticePost) => void;
}) {
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [noticeSearch, setNoticeSearch] = useState("");
  const filteredNotices = useMemo(() => {
    const term = noticeSearch.trim().toLowerCase();
    return boardNotices.filter(
      (post) => !term || `${post.title} ${post.body}`.toLowerCase().includes(term),
    );
  }, [boardNotices, noticeSearch]);
  const noticePagination = usePagination(filteredNotices, noticeSearch);

  async function submitNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onSaveNotice(editingNoticeId, noticeTitle, noticeBody)) {
      setNoticeTitle("");
      setNoticeBody("");
      setEditingNoticeId(null);
    }
  }

  return (
    <section className="panel notice-board">
      <PanelHeading
        title="Notice board"
        subtitle={isAdmin ? "Share updates with the whole team." : "Updates from the ADN administrator."}
      />
      {isAdmin && (
        <form className="form-grid notice-editor" onSubmit={submitNotice}>
          <label className="field field-full">
            Notice title
            <input
              required
              minLength={3}
              maxLength={120}
              value={noticeTitle}
              onChange={(event) => setNoticeTitle(event.target.value)}
            />
          </label>
          <label className="field field-full">
            Message
            <textarea
              required
              maxLength={4000}
              rows={3}
              value={noticeBody}
              onChange={(event) => setNoticeBody(event.target.value)}
            />
          </label>
          <div className="notice-editor-actions field-full">
            <Button type="submit">
              {editingNoticeId ? "Save changes" : "Publish notice"}
            </Button>
            {editingNoticeId && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingNoticeId(null);
                  setNoticeTitle("");
                  setNoticeBody("");
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
      {boardNotices.length > 0 && (
        <div className="repeat-list-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input
              type="search"
              value={noticeSearch}
              placeholder="Search notices"
              aria-label="Search notices"
              onChange={(event) => setNoticeSearch(event.target.value)}
            />
          </label>
          <span>{filteredNotices.length} notice{filteredNotices.length === 1 ? "" : "s"}</span>
        </div>
      )}
      {filteredNotices.length ? (
        <>
          <div className="notice-board-list">
            {noticePagination.items.map((post) => (
              <article className="notice-board-item" key={post.id}>
                <div className="notice-board-heading">
                  <div>
                    <h3>{post.title}</h3>
                    <small>{formatTimestamp(post.updatedAt ?? post.createdAt)} · {post.createdBy}</small>
                  </div>
                  {isAdmin && (
                    <div className="decision-actions">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingNoticeId(post.id);
                          setNoticeTitle(post.title);
                          setNoticeBody(post.body);
                        }}
                      >
                        <Pencil size={15} /> Edit
                      </Button>
                      <Button variant="secondary" onClick={() => onDeleteNotice(post)}>
                        <Trash2 size={15} /> Delete
                      </Button>
                    </div>
                  )}
                </div>
                <p>{post.body}</p>
              </article>
            ))}
          </div>
          <PaginationControls {...noticePagination} />
        </>
      ) : boardNotices.length ? (
        <EmptyState icon={<Search size={20} />} title="No matching notices" text="Try a different search." />
      ) : (
        <EmptyState
          icon={<FilePlus2 size={20} />}
          title="No notices yet"
          text={isAdmin ? "Publish a notice to share it with employees." : "Admin announcements will appear here."}
        />
      )}
    </section>
  );
}

function Overview({
  isAdmin,
  user,
  profile,
  employees,
  pendingEmployees,
  requests,
  pendingLeaves,
  attendance,
  boardNotices,
  onSaveNotice,
  onDeleteNotice,
  onApprove,
  onReview,
  onOpenDaily,
  onOpenLeaves,
  onOpenAttendance,
  onOpenTeam,
}: {
  isAdmin: boolean;
  user: User;
  profile: EmployeeProfile | null;
  employees: EmployeeProfile[];
  pendingEmployees: EmployeeProfile[];
  requests: LeaveRequest[];
  pendingLeaves: LeaveRequest[];
  attendance: AttendanceRecord[];
  boardNotices: NoticePost[];
  onSaveNotice: (noticeId: string | null, title: string, body: string) => Promise<boolean>;
  onDeleteNotice: (notice: NoticePost) => void;
  onApprove: (employee: EmployeeProfile, status: Exclude<ApprovalStatus, "pending">) => void;
  onReview: (request: LeaveRequest, status: Exclude<LeaveStatus, "pending">) => void;
  onOpenDaily: () => void;
  onOpenLeaves: () => void;
  onOpenAttendance: () => void;
  onOpenTeam: () => void;
}) {
  const todayAttendance = attendance.filter((record) => record.date === today);
  const todayAttendanceRecord = attendance.find((record) => record.date === today);
  const presentToday = attendance.filter(
    (record) => record.date === today && ["present", "late"].includes(record.status),
  ).length;
  const currentFiscalYear = fiscalYearStartForDate(today);
  const currentFiscalYearStartDate = `${currentFiscalYear}-07-01`;
  const currentFiscalYearEndDate = `${currentFiscalYear + 1}-06-30`;
  const currentLeaveBalance = profile?.leaveBalances?.[String(currentFiscalYear)];
  const unnotifiedAbsences = attendance
    .filter(
      (record) =>
        record.employeeId === user.uid &&
        record.status === "absent" &&
        record.date >= currentFiscalYearStartDate &&
        record.date <= currentFiscalYearEndDate,
    )
    .filter(
      (record) =>
        !requests.some(
          (request) =>
            request.employeeId === user.uid &&
            request.startDate <= record.date &&
            request.endDate >= record.date,
        ),
    )
    .sort((first, second) => second.date.localeCompare(first.date));
  const leaveSummary = (type: LeaveType, balance: number | undefined) => {
    const taken = requests.reduce(
      (total, request) =>
        request.type === type && request.status === "approved"
          ? total + daysInFiscalYear(request, currentFiscalYear)
          : total,
      0,
    );
    const reserved = requests.reduce(
      (total, request) =>
        request.type === type &&
        (request.status === "pending" || request.status === "approved")
          ? total + daysInFiscalYear(request, currentFiscalYear)
          : total,
      0,
    );
    return {
      taken,
      available: balance === undefined ? undefined : Math.max(0, balance - reserved),
      pending: Math.max(0, reserved - taken),
    };
  };
  const firstName = profile ? getEmployeeDisplayName(profile).split(" ")[0] : user.displayName?.split(" ")[0] || "there";
  return (
    <div className={`overview-dashboard ${isAdmin ? "overview-dashboard-admin" : "overview-dashboard-employee"}`}>
      <section className={`welcome-banner overview-hero ${isAdmin ? "welcome-admin" : ""}`}>
        <div className="welcome-copy">
          <span className="welcome-kicker">{isAdmin ? "PEOPLE OPERATIONS" : "YOUR ADN WORKSPACE"}</span>
          <h2>{isAdmin ? "Your team, at a glance." : `Welcome back, ${firstName}.`}</h2>
          <p>
            {isAdmin
              ? "A clear snapshot of your team, requests, and today's attendance."
              : "Your leave, attendance, and daily update—together in one place."}
          </p>
          <div className="overview-hero-actions">
            {isAdmin ? (
              <>
                <button className="banner-link" onClick={onOpenTeam}>
                  Review employee accounts <ArrowRight size={15} />
                </button>
                <button className="banner-link" onClick={onOpenLeaves}>
                  Review leave requests <ArrowRight size={15} />
                </button>
              </>
            ) : (
              <button className="banner-link" onClick={onOpenDaily}>
                Open daily update <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
        {!isAdmin && profile?.badges?.length ? (
          <div className="overview-banner-badges" aria-label="Your recognition badges">
            <span>Your badges</span>
            <EmployeeBadgeList badges={profile.badges} />
          </div>
        ) : null}
        <div className="welcome-art" aria-hidden="true">
          <svg viewBox="0 0 1200 280" preserveAspectRatio="xMaxYMid slice" focusable="false">
            <defs>
              <linearGradient id="overview-panorama-hill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#83c2c0" stopOpacity=".4" />
                <stop offset="100%" stopColor="#0d3048" stopOpacity=".78" />
              </linearGradient>
              <radialGradient id="overview-panorama-horizon">
                <stop offset="0%" stopColor="#8edbd0" stopOpacity=".32" />
                <stop offset="100%" stopColor="#8edbd0" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle className="panorama-horizon-glow" cx="918" cy="96" r="116" />
            <g className="panorama-cloud panorama-cloud-one">
              <ellipse cx="704" cy="74" rx="31" ry="8" />
              <ellipse cx="720" cy="68" rx="19" ry="11" />
              <ellipse cx="738" cy="74" rx="27" ry="7" />
            </g>
            <g className="panorama-cloud panorama-cloud-two">
              <ellipse cx="1010" cy="55" rx="27" ry="7" />
              <ellipse cx="1024" cy="49" rx="17" ry="10" />
              <ellipse cx="1043" cy="55" rx="24" ry="6" />
            </g>
            <path className="panorama-hill panorama-hill-far" d="M360 244C470 191 508 151 598 185S735 194 815 130 941 132 1200 61V280H360Z" />
            <path className="panorama-hill panorama-hill-near" d="M415 280C520 218 596 230 672 188S816 210 893 158 1059 176 1200 105V280Z" />
            <g className="panorama-wind">
              <path d="M500 98h72M620 116h52M684 76h68" />
            </g>
            <g className="panorama-city">
              <path className="panorama-buildings" d="M785 208V142L808 130V208ZM815 208V109H856V208ZM864 208V151L887 139V208ZM897 208V93H935V208ZM943 208V124L970 109V208ZM981 208V76H1022V208ZM1031 208V133L1063 119V208ZM1073 208V96H1111V208ZM1121 208V147L1150 132V208Z" />
              <g className="panorama-windows">
                <rect x="790" y="151" width="5" height="7" rx="1" />
                <rect x="799" y="146" width="5" height="7" rx="1" />
                <rect x="790" y="169" width="5" height="7" rx="1" />
                <rect x="799" y="164" width="5" height="7" rx="1" />
                <rect x="790" y="187" width="5" height="7" rx="1" />
                <rect x="799" y="182" width="5" height="7" rx="1" />
                <rect x="822" y="120" width="6" height="7" rx="1" />
                <rect x="839" y="120" width="6" height="7" rx="1" />
                <rect x="822" y="138" width="6" height="7" rx="1" />
                <rect x="839" y="138" width="6" height="7" rx="1" />
                <rect x="822" y="156" width="6" height="7" rx="1" />
                <rect x="839" y="156" width="6" height="7" rx="1" />
                <rect x="822" y="174" width="6" height="7" rx="1" />
                <rect x="839" y="174" width="6" height="7" rx="1" />
                <rect x="870" y="160" width="5" height="7" rx="1" />
                <rect x="879" y="155" width="5" height="7" rx="1" />
                <rect x="870" y="178" width="5" height="7" rx="1" />
                <rect x="879" y="173" width="5" height="7" rx="1" />
                <rect x="904" y="105" width="6" height="7" rx="1" />
                <rect x="920" y="105" width="6" height="7" rx="1" />
                <rect x="904" y="123" width="6" height="7" rx="1" />
                <rect x="920" y="123" width="6" height="7" rx="1" />
                <rect x="904" y="141" width="6" height="7" rx="1" />
                <rect x="920" y="141" width="6" height="7" rx="1" />
                <rect x="904" y="159" width="6" height="7" rx="1" />
                <rect x="920" y="159" width="6" height="7" rx="1" />
                <rect x="904" y="177" width="6" height="7" rx="1" />
                <rect x="920" y="177" width="6" height="7" rx="1" />
                <rect x="950" y="137" width="5" height="7" rx="1" />
                <rect x="960" y="131" width="5" height="7" rx="1" />
                <rect x="950" y="155" width="5" height="7" rx="1" />
                <rect x="960" y="149" width="5" height="7" rx="1" />
                <rect x="950" y="173" width="5" height="7" rx="1" />
                <rect x="960" y="167" width="5" height="7" rx="1" />
                <rect x="989" y="89" width="6" height="7" rx="1" />
                <rect x="1005" y="89" width="6" height="7" rx="1" />
                <rect x="989" y="107" width="6" height="7" rx="1" />
                <rect x="1005" y="107" width="6" height="7" rx="1" />
                <rect x="989" y="125" width="6" height="7" rx="1" />
                <rect x="1005" y="125" width="6" height="7" rx="1" />
                <rect x="989" y="143" width="6" height="7" rx="1" />
                <rect x="1005" y="143" width="6" height="7" rx="1" />
                <rect x="989" y="161" width="6" height="7" rx="1" />
                <rect x="1005" y="161" width="6" height="7" rx="1" />
                <rect x="1038" y="147" width="6" height="7" rx="1" />
                <rect x="1051" y="142" width="6" height="7" rx="1" />
                <rect x="1038" y="165" width="6" height="7" rx="1" />
                <rect x="1051" y="160" width="6" height="7" rx="1" />
                <rect x="1079" y="108" width="6" height="7" rx="1" />
                <rect x="1096" y="108" width="6" height="7" rx="1" />
                <rect x="1079" y="126" width="6" height="7" rx="1" />
                <rect x="1096" y="126" width="6" height="7" rx="1" />
                <rect x="1079" y="144" width="6" height="7" rx="1" />
                <rect x="1096" y="144" width="6" height="7" rx="1" />
                <rect x="1079" y="162" width="6" height="7" rx="1" />
                <rect x="1096" y="162" width="6" height="7" rx="1" />
                <rect x="1127" y="157" width="5" height="7" rx="1" />
                <rect x="1139" y="151" width="5" height="7" rx="1" />
                <rect x="1127" y="175" width="5" height="7" rx="1" />
                <rect x="1139" y="169" width="5" height="7" rx="1" />
              </g>
            </g>
            <g className="panorama-tree" transform="translate(610 0)">
              <path d="M0 250V172m-1 34-20-18m20 8 17-24" />
              <g className="panorama-canopy">
                <circle cx="-1" cy="154" r="23" />
                <circle cx="-19" cy="164" r="16" />
                <circle cx="15" cy="166" r="17" />
              </g>
            </g>
            <g className="panorama-tree panorama-tree-small" transform="translate(750 28)">
              <path d="M0 222V177m0 21-12-12m12 4 11-15" />
              <g className="panorama-canopy">
                <circle cx="0" cy="166" r="13" />
                <circle cx="-11" cy="171" r="9" />
                <circle cx="11" cy="173" r="9" />
              </g>
            </g>
          </svg>
        </div>
        <OverviewClock />
      </section>

      {isAdmin && (
        <section className="panel dashboard-recognition">
          <PanelHeading
            title="Recognition badges"
            subtitle="Celebrating the contributions recognized across your team."
          />
          {employees.some((employee) => employee.badges?.length) ? (
            <ul className="dashboard-recognition-list">
              {employees
                .filter((employee) => employee.badges?.length)
                .sort((first, second) =>
                  getEmployeeDisplayName(first).localeCompare(getEmployeeDisplayName(second)),
                )
                .map((employee) => (
                  <li key={employee.uid}>
                    <Initials name={getEmployeeDisplayName(employee)} />
                    <div>
                      <strong>{getEmployeeDisplayName(employee)}</strong>
                      <EmployeeBadgeList badges={employee.badges ?? []} />
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Award size={20} />}
              title="No badges awarded yet"
              text="Award a recognition badge from an employee profile in the team directory."
            />
          )}
        </section>
      )}

      {!isAdmin && profile?.status === "approved" && (
        <>
          <DailyUpdateSummary userId={user.uid} onOpen={onOpenDaily} />
          <NoticeBoard
            isAdmin={false}
            boardNotices={boardNotices}
            onSaveNotice={onSaveNotice}
            onDeleteNotice={onDeleteNotice}
          />
        </>
      )}

      {isAdmin ? (
        <>
          <div className="stat-grid">
            <StatCard
              icon={<Users size={18} />}
              label="Approved employees"
              value={employees.length}
              hint="Active team accounts"
              tone="blue"
              onClick={onOpenTeam}
            />
            <StatCard
              icon={<Clock3 size={18} />}
              label="Needs approval"
              value={pendingEmployees.length}
              hint="Waiting for approval"
              tone="amber"
              onClick={onOpenTeam}
            />
            <StatCard
              icon={<FilePlus2 size={18} />}
              label="Leave requests"
              value={pendingLeaves.length}
              hint="Waiting for review"
              tone="violet"
              onClick={onOpenLeaves}
            />
            <StatCard
              icon={<CalendarCheck2 size={18} />}
              label="Attendance counted today"
              value={todayAttendance.length}
              hint={`${presentToday} present or marked late · ${employees.length} approved employees`}
              tone="green"
              onClick={onOpenAttendance}
            />
          </div>
          <div className="dashboard-grid dashboard-grid-admin">
            <section className="panel">
              <PanelHeading
                title="Leave requests"
                subtitle={pendingLeaves.length
                  ? `${pendingLeaves.length} request${pendingLeaves.length === 1 ? "" : "s"} waiting for review.`
                  : "No requests waiting for review."}
                actionLabel="View all"
                onAction={onOpenLeaves}
              />
              <div className="compact-list">
                {pendingLeaves.slice(0, 4).map((request) => (
                  <div className="compact-row" key={request.id}>
                    <Initials name={request.employeeName} />
                    <div className="compact-main">
                      <strong>{request.employeeName}</strong>
                      <span>{request.type} · {formatDate(request.startDate)} – {formatDate(request.endDate)}</span>
                      <span className="compact-reason">{request.reason || "—"}</span>
                    </div>
                    <div className="row-actions">
                      <button
                        className="mini-action mini-action-approve"
                        aria-label={`Approve ${request.employeeName}'s leave`}
                        onClick={() => onReview(request, "approved")}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        className="mini-action mini-action-decline"
                        aria-label={`Decline ${request.employeeName}'s leave`}
                        onClick={() => onReview(request, "rejected")}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                {pendingLeaves.length === 0 && (
                  <EmptyState
                    icon={<CheckCircle2 size={20} />}
                    title="All caught up"
                    text="New leave requests will appear here."
                  />
                )}
              </div>
            </section>
            <section className="panel attention-panel">
              <PanelHeading
                title="Approval queue"
                subtitle={`${pendingEmployees.length} account${pendingEmployees.length === 1 ? "" : "s"} awaiting review.`}
                actionLabel="View team"
                onAction={onOpenTeam}
              />
              {pendingEmployees.length ? (
                <div className="approval-list">
                  {pendingEmployees.slice(0, 4).map((employee) => (
                    <div className="approval-item" key={employee.uid}>
                      <Initials name={getEmployeeDisplayName(employee)} />
                      <div className="approval-copy">
                        <strong>{getEmployeeDisplayName(employee)}</strong>
                        <span>{employee.email}</span>
                      </div>
                      <button
                        className="approve-text"
                        onClick={() => onApprove(employee, "approved")}
                      >
                        Approve <ArrowRight size={14} />
                      </button>
                    </div>
                  ))}
                  {pendingEmployees.length > 4 && (
                    <p className="overview-more-count">
                      Showing 4 of {pendingEmployees.length} accounts awaiting approval.
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={<ShieldCheck size={20} />}
                  title="No approvals pending"
                  text="New registrations will wait here for your review."
                />
              )}
              <div className="panel-note">
                <ShieldCheck size={15} />
                Only you can approve employee accounts.
              </div>
            </section>
          </div>
        </>
      ) : (
        <>
          <section className="panel leave-overview-panel">
            <PanelHeading
              title="Your leave and attendance"
              subtitle={`${formatFiscalYear(currentFiscalYear)} · Leave days taken are approved requests.`}
              actionLabel="Request leave"
              onAction={onOpenLeaves}
            />
            <div className="leave-overview-grid">
              {([
                {
                  type: "Annual leave" as const,
                  balance: currentLeaveBalance?.annualDays,
                  tone: "annual",
                },
                {
                  type: "Sick leave" as const,
                  balance: currentLeaveBalance?.sickDays,
                  tone: "sick",
                },
              ]).map(({ type, balance, tone }) => {
                const summary = leaveSummary(type, balance);
                return (
                  <article className={`leave-overview-card leave-overview-${tone}`} key={type}>
                    <strong>{type}</strong>
                    <div className="leave-overview-figures">
                      <span>
                        <b>{summary.taken}</b>
                        <small>days taken</small>
                      </span>
                      <span>
                        <b>{summary.available ?? "—"}</b>
                        <small>days available</small>
                      </span>
                    </div>
                    <small>
                      {summary.available === undefined
                        ? "Balance not set"
                        : summary.pending
                          ? `${summary.pending} days reserved by pending requests`
                          : "Based on approved and pending requests"}
                    </small>
                  </article>
                );
              })}
              <article
                className={`leave-overview-card leave-overview-attendance ${todayAttendanceRecord ? "leave-overview-attendance-counted" : ""}`}
              >
                <strong>Today’s attendance</strong>
                <div className="leave-overview-attendance-status">
                  <span className={`attendance-indicator ${todayAttendanceRecord ? "attendance-indicator-counted" : ""}`} />
                  <b>{todayAttendanceRecord ? "Counted" : "Not counted"}</b>
                </div>
                <small>
                  {todayAttendanceRecord
                    ? `Recorded as ${attendanceStatusLabel(todayAttendanceRecord.status)}.`
                    : "Your administrator has not recorded it yet."}
                </small>
              </article>
              <article
                className={`leave-overview-card leave-overview-absence ${unnotifiedAbsences.length ? "leave-overview-absence-alert" : ""}`}
              >
                <strong>Unnotified absences</strong>
                <div className="leave-overview-attendance-status">
                  <b>{unnotifiedAbsences.length}</b>
                  <small>this fiscal year</small>
                </div>
                <small>
                  {unnotifiedAbsences.length
                    ? `Most recent: ${formatDate(unnotifiedAbsences[0].date)} · no leave request on file.`
                    : "No unnotified absences this fiscal year."}
                </small>
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function EmployeeDetailsPanel({
  profile,
  employees,
  isOwnProfile = false,
}: {
  profile: EmployeeProfile;
  employees: EmployeeProfile[];
  isOwnProfile?: boolean;
}) {
  const manager = employees.find(
    (employee) => employee.uid === profile.reportingManagerId,
  );
  const sortedTrackRecords = [...(profile.trackRecords ?? [])].sort((first, second) =>
    second.startDate.localeCompare(first.startDate),
  );
  const details = [
    { label: "Full name", value: profile.displayName },
    { label: "Nickname", value: profile.nickname },
    { label: "Current designation", value: getCurrentDesignation(profile) },
    { label: "Email", value: profile.email },
    { label: "Official email", value: profile.officialEmail },
    { label: "Phone number", value: profile.phone },
    { label: "GitHub ID", value: profile.githubId },
    {
      label: isOwnProfile ? "Your manager" : "Reporting to",
      value: manager ? getEmployeeDisplayName(manager) : undefined,
    },
  ];

  return (
    <section className="panel employee-details-panel">
      <div className="panel-heading panel-heading-search">
        <div>
          <h2>{isOwnProfile ? "Your details" : "Employee profile"}</h2>
          <p>{isOwnProfile ? "Your employee profile information." : "Employee profile information."}</p>
        </div>
      </div>
      <dl className="employee-detail-grid">
        {details.map(({ label, value }) => (
          <div className="employee-detail" key={label}>
            <dt>{label}</dt>
            <dd>{value || "Not provided"}</dd>
          </div>
        ))}
      </dl>
      <div className="employee-badges">
        <h3>Recognition badges</h3>
        <EmployeeBadgeList badges={profile.badges ?? []} emptyText="No badges have been awarded yet." />
      </div>
      <div className="employee-track-records">
        <h3>Track records</h3>
        {sortedTrackRecords.length ? (
          <ul>
            {sortedTrackRecords.map((record, index) => (
              <li key={`${record.role}-${record.startDate}-${index}`}>
                <strong>{record.role}</strong>
                <span>
                  {formatDate(record.startDate)} –{" "}
                  {record.endDate ? formatDate(record.endDate) : "Present"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No track records added.</p>
        )}
      </div>
    </section>
  );
}

function EmployeeBadgeList({
  badges,
  emptyText = "No badges yet",
}: {
  badges: EmployeeBadgeId[];
  emptyText?: string;
}) {
  const knownBadges = EMPLOYEE_BADGES.filter((badge) => badges.includes(badge.id));
  if (!knownBadges.length) return <p className="employee-badges-empty">{emptyText}</p>;

  return (
    <ul className="employee-badge-list">
      {knownBadges.map((badge) => {
        const BadgeIcon = employeeBadgeIcons[badge.id];
        return (
          <li key={badge.id}>
            <span
              className={`employee-badge employee-badge-${badge.id}`}
              role="img"
              tabIndex={0}
              aria-label={`${badge.label}: ${badge.description}`}
              aria-describedby={`employee-badge-tooltip-${badge.id}`}
            >
              <BadgeIcon size={19} strokeWidth={2.1} aria-hidden="true" />
              <span
                className="employee-badge-tooltip"
                id={`employee-badge-tooltip-${badge.id}`}
                role="tooltip"
              >
                <strong>{badge.label}</strong>
                <span>{badge.description}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function getCurrentDesignation(
  employee: Pick<EmployeeProfile, "trackRecords">,
): string | undefined {
  return employee.trackRecords?.find((record) => !record.endDate)?.role.trim() || undefined;
}

function EmployeeDirectoryPage({
  employees,
  managerId,
}: {
  employees: EmployeeProfile[];
  managerId: string;
}) {
  const [search, setSearch] = useState("");
  const searchTerm = search.trim().toLowerCase();
  const directReports = employees
    .filter((employee) => employee.reportingManagerId === managerId)
    .sort((first, second) =>
      getEmployeeDisplayName(first).localeCompare(getEmployeeDisplayName(second)),
    );
  const visibleEmployees = employees
    .filter((employee) => {
      const manager = employees.find(
        (candidate) => candidate.uid === employee.reportingManagerId,
      );
      return `${getEmployeeDisplayName(employee)} ${employee.displayName} ${employee.email} ${employee.officialEmail ?? ""} ${employee.githubId ?? ""} ${employee.phone ?? ""} ${manager ? getEmployeeDisplayName(manager) : ""}`
        .toLowerCase()
        .includes(searchTerm);
    })
    .sort((first, second) =>
      getEmployeeDisplayName(first).localeCompare(getEmployeeDisplayName(second)),
    );

  return (
    <div className="content-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>People you manage</h2>
            <p>Employees assigned to you as their reporting manager.</p>
          </div>
          <span className="direct-report-count">
            {directReports.length} {directReports.length === 1 ? "person" : "people"}
          </span>
        </div>
        {directReports.length ? (
          <ul className="direct-report-list">
            {directReports.map((employee) => (
              <li key={employee.uid}>
                <div className="person-cell">
                  <Initials name={getEmployeeDisplayName(employee)} />
                  <span>
                    <strong>{getEmployeeDisplayName(employee)}</strong>
                    <small>{employee.officialEmail || employee.email}</small>
                  </span>
                </div>
                <span className="direct-report-designation">
                  {getCurrentDesignation(employee) || "Designation not provided"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="direct-report-empty">
            No employees are currently assigned to you.
          </p>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading panel-heading-search">
          <div>
            <h2>Employee directory</h2>
            <p>Browse approved employees and their directory details.</p>
          </div>
          <label className="search-field">
            <Search size={16} />
            <input
              type="search"
              value={search}
              placeholder="Search employees"
              aria-label="Search employee directory"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {visibleEmployees.length ? (
          <div className="table-wrap">
            <table className="team-table">
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>GITHUB ID</th>
                  <th>PHONE</th>
                  <th>CURRENT DESIGNATION</th>
                  <th>REPORTING TO</th>
                  <th>RECOGNITION</th>
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => {
                  const manager = employees.find(
                    (candidate) => candidate.uid === employee.reportingManagerId,
                  );
                  return (
                    <tr key={employee.uid}>
                      <td>
                        <div className="person-cell">
                          <Initials name={getEmployeeDisplayName(employee)} />
                          <span>
                            <strong>{getEmployeeDisplayName(employee)}</strong>
                            <small>{employee.officialEmail || employee.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>{employee.githubId || "Not provided"}</td>
                      <td>{employee.phone || "Not provided"}</td>
                      <td>{getCurrentDesignation(employee) || "Not provided"}</td>
                      <td>{manager ? getEmployeeDisplayName(manager) : "Not assigned"}</td>
                      <td><EmployeeBadgeList badges={employee.badges ?? []} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Users size={20} />}
            title={employees.length ? "No matching employees" : "No directory entries"}
            text={employees.length
              ? "Try another name, email, GitHub ID, phone number, or manager."
              : "Approved employees will appear here."}
          />
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: string;
  onClick?: () => void;
}) {
  const contents = (
    <>
      <div className={`stat-icon stat-icon-${tone}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">{hint}</div>
      {onClick && <ArrowDownRight className="stat-arrow" size={17} />}
    </>
  );
  return onClick ? (
    <button className="stat-card stat-card-clickable" onClick={onClick}>{contents}</button>
  ) : (
    <div className="stat-card">{contents}</div>
  );
}

function PanelHeading({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {actionLabel && onAction && (
        <button className="text-link" onClick={onAction}>
          {actionLabel} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function LeavesPage({
  isAdmin,
  user,
  profile,
  employees,
  requests,
  onSubmit,
  onReview,
  onDeleteRequest,
}: {
  isAdmin: boolean;
  user: User;
  profile: EmployeeProfile | null;
  employees: EmployeeProfile[];
  requests: LeaveRequest[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReview: (request: LeaveRequest, status: Exclude<LeaveStatus, "pending">) => void;
  onDeleteRequest: (request: LeaveRequest) => void;
}) {
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingTypeFilter, setPendingTypeFilter] = useState<"all" | LeaveType>("all");
  const [pendingSort, setPendingSort] = useState<"submitted" | "employee" | "startDate" | "days">("submitted");
  const [pendingSortDirection, setPendingSortDirection] = useState<SortDirection>("desc");
  const [employeeSummarySearch, setEmployeeSummarySearch] = useState("");
  const [employeeSummarySort, setEmployeeSummarySort] = useState<"employee" | "annual" | "sick">("employee");
  const [employeeSummarySortDirection, setEmployeeSummarySortDirection] = useState<SortDirection>("asc");
  const waiting = requests.filter((request) => request.status === "pending").length;
  const currentFiscalYear = fiscalYearStartForDate(new Date());
  const [fiscalYearStart, setFiscalYearStart] = useState(currentFiscalYear);
  const fiscalYears = useMemo(
    () => availableFiscalYears(employees, requests, currentFiscalYear),
    [currentFiscalYear, employees, requests],
  );
  const approvedRequests = requests.filter((request) => request.status === "approved");
  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests],
  );
  const filteredPendingRequests = useMemo(() => {
    const term = pendingSearch.trim().toLowerCase();
    return pendingRequests.filter(
      (request) =>
        !term ||
        `${request.employeeName} ${request.employeeEmail} ${request.type} ${request.reason}`.toLowerCase().includes(term),
    ).filter((request) => pendingTypeFilter === "all" || request.type === pendingTypeFilter);
  }, [pendingRequests, pendingSearch, pendingTypeFilter]);
  const filteredEmployeeSummaries = useMemo(() => {
    const term = employeeSummarySearch.trim().toLowerCase();
    return employees.filter(
      (employee) =>
        !term ||
        `${getEmployeeDisplayName(employee)} ${employee.displayName} ${employee.email}`.toLowerCase().includes(term),
    );
  }, [employeeSummarySearch, employees]);
  const approvedDays = (type: LeaveType, employeeId?: string) =>
    approvedRequests.reduce(
      (total, request) =>
        request.type === type &&
        (!employeeId || request.employeeId === employeeId)
          ? total + daysInFiscalYear(request, fiscalYearStart)
          : total,
      0,
    );
  const sortedPendingRequests = useMemo(
    () =>
      sortItems(
        filteredPendingRequests,
        (request) => {
          if (pendingSort === "employee") return request.employeeName;
          if (pendingSort === "startDate") return request.startDate;
          if (pendingSort === "days") return dayCount(request.startDate, request.endDate);
          return request.createdAt?.toDate().getTime();
        },
        pendingSortDirection,
      ),
    [filteredPendingRequests, pendingSort, pendingSortDirection],
  );
  const pendingPagination = usePagination(
    sortedPendingRequests,
    `${pendingSearch}:${pendingTypeFilter}:${pendingSort}:${pendingSortDirection}`,
  );
  const sortedEmployeeSummaries = useMemo(
    () =>
      sortItems(
        filteredEmployeeSummaries,
        (employee) =>
          employeeSummarySort === "annual"
            ? approvedDays("Annual leave", employee.uid)
            : employeeSummarySort === "sick"
              ? approvedDays("Sick leave", employee.uid)
              : getEmployeeDisplayName(employee),
        employeeSummarySortDirection,
      ),
    [filteredEmployeeSummaries, employeeSummarySort, employeeSummarySortDirection, approvedRequests, fiscalYearStart],
  );
  const employeeSummaryPagination = usePagination(
    sortedEmployeeSummaries,
    `${employeeSummarySearch}:${employeeSummarySort}:${employeeSummarySortDirection}`,
  );
  const reservedDays = (type: LeaveType) =>
    requests.reduce(
      (total, request) =>
        request.type === type &&
        (request.status === "pending" || request.status === "approved")
          ? total + daysInFiscalYear(request, fiscalYearStart)
          : total,
      0,
    );
  const selectedBalance = profile?.leaveBalances?.[String(fiscalYearStart)];
  const [leaveType, setLeaveType] = useState<LeaveType | "">("");
  const [startDate, setStartDate] = useState("");
  return (
    <div className="content-stack">
      {isAdmin ? (
        <>
          <section className="panel">
            <PanelHeading
              title="Requests to review"
              subtitle={waiting ? `${waiting} request${waiting === 1 ? "" : "s"} need your decision.` : "Everything has been reviewed."}
            />
            {pendingRequests.length ? (
              <>
                <div className="repeat-list-toolbar">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      type="search"
                      value={pendingSearch}
                      placeholder="Search pending requests"
                      aria-label="Search pending leave requests"
                      onChange={(event) => setPendingSearch(event.target.value)}
                    />
                  </label>
                  <label className="filter-select">
                    <span className="sr-only">Filter pending requests by leave type</span>
                    <select
                      aria-label="Filter pending requests by leave type"
                      value={pendingTypeFilter}
                      onChange={(event) => setPendingTypeFilter(event.target.value as "all" | LeaveType)}
                    >
                      <option value="all">All leave types</option>
                      <option value="Annual leave">Annual leave</option>
                      <option value="Sick leave">Sick leave</option>
                    </select>
                  </label>
                  <SortControls
                    value={pendingSort}
                    options={[
                      { value: "submitted", label: "Submitted date" },
                      { value: "employee", label: "Employee" },
                      { value: "startDate", label: "Leave start date" },
                      { value: "days", label: "Duration" },
                    ]}
                    direction={pendingSortDirection}
                    onChange={(value) => setPendingSort(value as typeof pendingSort)}
                    onToggleDirection={() =>
                      setPendingSortDirection((direction) => direction === "asc" ? "desc" : "asc")
                    }
                  />
                  <span>{filteredPendingRequests.length} awaiting review</span>
                </div>
                {filteredPendingRequests.length ? (
                  <>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>EMPLOYEE</th>
                            <th>LEAVE TYPE</th>
                            <th>DATES</th>
                            <th>DAYS</th>
                            <th>REASON</th>
                            <th className="align-right">DECISION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingPagination.items.map((request) => (
                            <tr key={request.id}>
                              <td>
                                <div className="person-cell">
                                  <Initials name={request.employeeName} />
                                  <span><strong>{request.employeeName}</strong><small>{request.employeeEmail}</small></span>
                                </div>
                              </td>
                              <td><span className={`leave-type leave-type-${leaveTypeTone(request.type)}`}>{request.type}</span></td>
                              <td>{formatDate(request.startDate)}<small className="cell-subline">to {formatDate(request.endDate)}</small></td>
                              <td>{dayCount(request.startDate, request.endDate)}</td>
                              <td className="reason-cell">{request.reason}</td>
                              <td className="align-right">
                                <div className="decision-actions">
                                  <Button variant="secondary" onClick={() => onReview(request, "rejected")}>Decline</Button>
                                  <Button onClick={() => onReview(request, "approved")}><Check size={15} /> Approve</Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <PaginationControls {...pendingPagination} />
                  </>
                ) : (
                  <EmptyState icon={<Search size={20} />} title="No matching requests" text="Try a different search." />
                )}
              </>
            ) : (
              <EmptyState icon={<CheckCircle2 size={20} />} title="No pending requests" text="New employee requests will show up here." />
            )}
          </section>
          <section className="panel">
            <PanelHeading title="All requests" subtitle="A record of leave decisions across the team." />
            <LeaveTable
              requests={requests}
              showEmployee
              onDelete={onDeleteRequest}
            />
          </section>
          <section className="panel">
            <div className="panel-heading panel-heading-search">
              <div>
                <h2>Leave days by fiscal year</h2>
                <p>Approved days are counted from July 1 through June 30.</p>
              </div>
              <label className="filter-select">
                <span className="sr-only">Select fiscal year</span>
                <select
                  aria-label="Select fiscal year for leave totals"
                  value={fiscalYearStart}
                  onChange={(event) => setFiscalYearStart(Number(event.target.value))}
                >
                  {fiscalYears.map((year) => (
                    <option value={year} key={year}>{formatFiscalYear(year)}</option>
                  ))}
                </select>
              </label>
            </div>
            {employees.length ? (
              <>
                <div className="repeat-list-toolbar">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      type="search"
                      value={employeeSummarySearch}
                      placeholder="Search employees"
                      aria-label="Search leave summaries by employee"
                      onChange={(event) => setEmployeeSummarySearch(event.target.value)}
                    />
                  </label>
                  <SortControls
                    value={employeeSummarySort}
                    options={[
                      { value: "employee", label: "Employee" },
                      { value: "annual", label: "Annual leave days" },
                      { value: "sick", label: "Sick leave days" },
                    ]}
                    direction={employeeSummarySortDirection}
                    onChange={(value) => setEmployeeSummarySort(value as typeof employeeSummarySort)}
                    onToggleDirection={() =>
                      setEmployeeSummarySortDirection((direction) => direction === "asc" ? "desc" : "asc")
                    }
                  />
                  <span>{filteredEmployeeSummaries.length} employees</span>
                </div>
                {filteredEmployeeSummaries.length ? (
                  <>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>EMPLOYEE</th><th>ANNUAL LEAVE DAYS</th><th>SICK LEAVE DAYS</th></tr>
                        </thead>
                        <tbody>
                          {employeeSummaryPagination.items.map((employee) => (
                            <tr key={employee.uid}>
                              <td>
                                <div className="person-cell">
                                  <Initials name={getEmployeeDisplayName(employee)} />
                                  <span><strong>{getEmployeeDisplayName(employee)}</strong></span>
                                </div>
                              </td>
                              <td>{approvedDays("Annual leave", employee.uid)}</td>
                              <td>{approvedDays("Sick leave", employee.uid)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <PaginationControls {...employeeSummaryPagination} />
                  </>
                ) : (
                  <EmptyState icon={<Search size={20} />} title="No matching employees" text="Try a different search." />
                )}
              </>
            ) : (
              <EmptyState icon={<Users size={20} />} title="No approved employees" text="Leave totals will appear here." />
            )}
          </section>
        </>
      ) : (
        <>
          <section className="panel">
            <div className="panel-heading panel-heading-search">
              <div>
                <h2>Leave balances · {formatFiscalYear(fiscalYearStart)}</h2>
                <p>Pending and approved requests reduce your available balance. Declined requests do not.</p>
              </div>
              <label className="filter-select">
                <span className="sr-only">Select fiscal year</span>
                <select
                  aria-label="Select fiscal year for leave balance"
                  value={fiscalYearStart}
                  onChange={(event) => setFiscalYearStart(Number(event.target.value))}
                >
                  {fiscalYears.map((year) => (
                    <option value={year} key={year}>{formatFiscalYear(year)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="leave-balance-grid">
              {([
                { type: "Annual leave" as const, days: selectedBalance?.annualDays },
                { type: "Sick leave" as const, days: selectedBalance?.sickDays },
              ]).map(({ type, days }) => {
                const reserved = reservedDays(type);
                const available = days === undefined ? undefined : Math.max(0, days - reserved);
                return (
                <div
                  className={`leave-balance-card leave-balance-${type === "Annual leave" ? "annual" : "sick"}`}
                  key={type}
                >
                  <strong>{type}</strong>
                  <span>{available === undefined ? "Not set" : `${available} days available`}</span>
                  <small>{reserved} days used or pending this fiscal year</small>
                </div>
                );
              })}
            </div>
          </section>
          <div className="leave-layout">
            <section className="panel leave-form-panel" id="leave-form">
              <PanelHeading
                title="Request time off"
                subtitle="Annual leave may be requested in advance. Request sick leave on the day of absence or later."
              />
              <form className="form-grid" onSubmit={onSubmit}>
                <label className="field field-full">
                  Leave type
                  <select
                    name="type"
                    required
                    value={leaveType}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLeaveType(
                        value === "Annual leave" || value === "Sick leave"
                          ? value
                          : "",
                      );
                    }}
                  >
                    <option value="" disabled>Select a leave type</option>
                    <option value="Annual leave">Annual leave</option>
                    <option value="Sick leave">Sick leave</option>
                  </select>
                </label>
                <label className="field">
                  Start date
                  <input
                    name="startDate"
                    type="date"
                    required
                    min={leaveType === "Sick leave" ? undefined : today}
                    max={leaveType === "Sick leave" ? today : undefined}
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </label>
                <label className="field">
                  End date
                  <input
                    name="endDate"
                    type="date"
                    required
                    min={startDate || (leaveType === "Sick leave" ? undefined : today)}
                    max={leaveType === "Sick leave" ? today : undefined}
                  />
                </label>
                <label className="field field-full">
                  Reason
                  <textarea
                    name="reason"
                    required
                    minLength={3}
                    maxLength={1000}
                    placeholder="Share any helpful context for your manager…"
                    rows={4}
                  />
                </label>
                <div className="form-foot field-full">
                  <span>Submitted by {profile ? getEmployeeDisplayName(profile) : user.displayName || user.email}</span>
                  <Button type="submit"><FilePlus2 size={16} /> Submit request</Button>
                </div>
              </form>
            </section>
            <section className="panel leave-history-panel">
              <PanelHeading title="Your requests" subtitle="Follow the status of your time off." />
              <LeaveTable requests={requests} showEmployee={false} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function LeaveTable({
  requests,
  showEmployee,
  onDelete,
}: {
  requests: LeaveRequest[];
  showEmployee: boolean;
  onDelete?: (request: LeaveRequest) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | LeaveType>("all");
  const [sortBy, setSortBy] = useState<"startDate" | "submitted" | "employee" | "days" | "type" | "status">("submitted");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesType = typeFilter === "all" || request.type === typeFilter;
      const matchesSearch =
        !term ||
        `${request.employeeName} ${request.employeeEmail} ${request.type} ${request.reason} ${request.startDate} ${request.endDate}`.toLowerCase().includes(term);
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [requests, search, statusFilter, typeFilter]);
  const sortedRequests = useMemo(
    () =>
      sortItems(
        filteredRequests,
        (request) => {
          if (sortBy === "startDate") return request.startDate;
          if (sortBy === "employee") return request.employeeName;
          if (sortBy === "days") return dayCount(request.startDate, request.endDate);
          if (sortBy === "type") return request.type;
          if (sortBy === "status") return request.status;
          return request.createdAt?.toDate().getTime();
        },
        sortDirection,
      ),
    [filteredRequests, sortBy, sortDirection],
  );
  const pagination = usePagination(
    sortedRequests,
    `${search}:${statusFilter}:${typeFilter}:${sortBy}:${sortDirection}`,
  );

  if (!requests.length) {
    return (
      <EmptyState
        icon={<CalendarDays size={20} />}
        title="No leave requests yet"
        text="Your requests will appear here."
      />
    );
  }
  return (
    <>
      <div className="repeat-list-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            type="search"
            value={search}
            placeholder="Search leave requests"
            aria-label="Search leave requests"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="filter-select">
          <span className="sr-only">Filter requests by status</span>
          <select
            aria-label="Filter leave requests by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as LeaveStatus | "all")}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Declined</option>
          </select>
        </label>
        <label className="filter-select">
          <span className="sr-only">Filter leave requests by type</span>
          <select
            aria-label="Filter leave requests by type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as "all" | LeaveType)}
          >
            <option value="all">All leave types</option>
            <option value="Annual leave">Annual leave</option>
            <option value="Sick leave">Sick leave</option>
          </select>
        </label>
        <SortControls
          value={sortBy}
          options={[
            { value: "submitted", label: "Submitted date" },
            { value: "startDate", label: "Leave start date" },
            { value: "employee", label: "Employee" },
            { value: "days", label: "Duration" },
            { value: "type", label: "Leave type" },
            { value: "status", label: "Status" },
          ]}
          direction={sortDirection}
          onChange={(value) => setSortBy(value as typeof sortBy)}
          onToggleDirection={() =>
            setSortDirection((direction) => direction === "asc" ? "desc" : "asc")
          }
        />
        <span>{filteredRequests.length} request{filteredRequests.length === 1 ? "" : "s"}</span>
      </div>
      {filteredRequests.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {showEmployee && <th>EMPLOYEE</th>}
                  <th>LEAVE TYPE</th>
                  <th>DATES</th>
                  <th>DAYS</th>
                  <th>REASON</th>
                  <th>SUBMITTED</th>
                  <th>STATUS</th>
                  {onDelete && <th className="align-right">ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {pagination.items.map((request) => (
                  <tr key={request.id}>
                    {showEmployee && (
                      <td>
                        <div className="person-cell">
                          <Initials name={request.employeeName} />
                          <span><strong>{request.employeeName}</strong><small>{request.employeeEmail}</small></span>
                        </div>
                      </td>
                    )}
                    <td><span className={`leave-type leave-type-${leaveTypeTone(request.type)}`}>{request.type}</span></td>
                    <td>{formatDate(request.startDate)}<small className="cell-subline">to {formatDate(request.endDate)}</small></td>
                    <td>{dayCount(request.startDate, request.endDate)}</td>
                    <td className="reason-cell" title={request.reason}>{request.reason || "—"}</td>
                    <td>{formatTimestamp(request.createdAt)}</td>
                    <td><StatusPill status={request.status} /></td>
                    {onDelete && (
                      <td className="align-right">
                        <div className="decision-actions">
                          <Button variant="secondary" onClick={() => onDelete(request)}>
                            <Trash2 size={15} /> Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls {...pagination} />
        </>
      ) : (
        <EmptyState icon={<Search size={20} />} title="No matching requests" text="Try a different search or status." />
      )}
    </>
  );
}

function AttendancePage({
  isAdmin,
  user,
  profile,
  employees,
  records,
  leaveRequests,
  onSetStatus,
  onDeleteRecord,
}: {
  isAdmin: boolean;
  user: User;
  profile: EmployeeProfile | null;
  employees: EmployeeProfile[];
  records: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  onSetStatus: (
    employee: EmployeeProfile,
    date: string,
    status: AttendanceStatus,
    note: string,
  ) => Promise<boolean>;
  onDeleteRecord: (record: AttendanceRecord) => void;
}) {
  const [search, setSearch] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [recordStatusFilter, setRecordStatusFilter] = useState<AttendanceStatus | "all">("all");
  const [recordFromDate, setRecordFromDate] = useState("");
  const [recordToDate, setRecordToDate] = useState("");
  const [recordSort, setRecordSort] = useState<"date" | "employee" | "status">("date");
  const [recordSortDirection, setRecordSortDirection] = useState<SortDirection>("desc");
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [notesByEmployee, setNotesByEmployee] = useState<Record<string, string>>({});
  const [savingEmployeeIds, setSavingEmployeeIds] = useState<Set<string>>(() => new Set());
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const [openStatusMenuSide, setOpenStatusMenuSide] = useState<"left" | "right">("right");
  const attendanceForDate = useMemo(
    () =>
      new Map(
        records
          .filter((record) => record.date === attendanceDate)
          .map((record) => [record.employeeId, record]),
      ),
    [attendanceDate, records],
  );
  const approvedLeavesByEmployee = useMemo(() => {
    const leavesByEmployee = new Map<string, LeaveRequest[]>();
    leaveRequests.forEach((request) => {
      if (request.status !== "approved") return;
      const requests = leavesByEmployee.get(request.employeeId) ?? [];
      requests.push(request);
      leavesByEmployee.set(request.employeeId, requests);
    });
    leavesByEmployee.forEach((requests) =>
      requests.sort((left, right) => left.startDate.localeCompare(right.startDate)),
    );
    return leavesByEmployee;
  }, [leaveRequests]);
  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSearch =
        !term ||
        record.employeeName.toLowerCase().includes(term) ||
        record.date.includes(term) ||
        record.status.includes(term) ||
        attendanceStatusLabel(record.status).toLowerCase().includes(term);
      const matchesStatus = recordStatusFilter === "all" || record.status === recordStatusFilter;
      const matchesFromDate = !recordFromDate || record.date >= recordFromDate;
      const matchesToDate = !recordToDate || record.date <= recordToDate;
      return matchesSearch && matchesStatus && matchesFromDate && matchesToDate;
    });
  }, [records, search, recordStatusFilter, recordFromDate, recordToDate]);
  const sortedRecords = useMemo(
    () =>
      sortItems(
        filteredRecords,
        (record) =>
          recordSort === "employee"
            ? record.employeeName
            : recordSort === "status"
              ? record.status
              : record.date,
        recordSortDirection,
      ),
    [filteredRecords, recordSort, recordSortDirection],
  );
  const filteredEmployees = useMemo(() => {
    const term = rosterSearch.trim().toLowerCase();
    return employees.filter(
      (employee) =>
        !term || `${getEmployeeDisplayName(employee)} ${employee.displayName} ${employee.email}`.toLowerCase().includes(term),
    );
  }, [employees, rosterSearch]);
  const recordPagination = usePagination(
    sortedRecords,
    `${search}:${recordStatusFilter}:${recordFromDate}:${recordToDate}:${recordSort}:${recordSortDirection}`,
    20,
  );
  async function chooseAttendanceStatus(
    employee: EmployeeProfile,
    status: AttendanceStatus,
  ) {
    if (savingEmployeeIds.has(employee.uid)) return;
    setOpenStatusMenuId(null);
    setSavingEmployeeIds((current) => new Set(current).add(employee.uid));
    try {
      await onSetStatus(
        employee,
        attendanceDate,
        status,
        notesByEmployee[employee.uid] ?? attendanceForDate.get(employee.uid)?.note ?? "",
      );
    } finally {
      setSavingEmployeeIds((current) => {
        const next = new Set(current);
        next.delete(employee.uid);
        return next;
      });
    }
  }
  function openStatusMenu(employeeId: string, element: HTMLElement) {
    const bounds = element.getBoundingClientRect();
    const hasRoomOnRight = window.innerWidth - bounds.right >= 280;
    setOpenStatusMenuSide(hasRoomOnRight || bounds.left < 280 ? "right" : "left");
    setOpenStatusMenuId(employeeId);
  }

  return (
    <div className="content-stack">
      <section className="panel attendance-banner">
        <div className="attendance-banner-icon"><ShieldCheck size={21} /></div>
        <div>
          <strong>{isAdmin ? "Admin-maintained attendance" : "Attendance is recorded by your administrator"}</strong>
          <p>
            {isAdmin
              ? "Employees can view their records, but only an administrator can create or change entries."
              : "Attendance entries are read-only for employees. Contact the administrator if a record needs correction."}
          </p>
        </div>
        <span className="attendance-admin-badge"><ShieldCheck size={14} /> ADMIN ONLY</span>
      </section>
      {!isAdmin && (
        <section className="panel employee-attendance-panel">
          <PanelHeading
            title="Your attendance history"
            subtitle="A day-by-day view of your attendance over the past 12 months. Recorded attendance is shown even on weekends; days without a recorded status stay gray."
          />
          <div className="employee-attendance-list">
            <EmployeeAttendanceHeatmap
              employee={{
                uid: user.uid,
                displayName: profile ? getEmployeeDisplayName(profile) : user.displayName || user.email?.split("@")[0] || "Employee",
                nickname: profile?.nickname,
                email: user.email || "",
              }}
              attendance={records}
              leaveRequests={leaveRequests}
            />
          </div>
        </section>
      )}
      {isAdmin && (
        <section className="panel">
          <PanelHeading title="Record attendance" subtitle="Choose a date, then click an employee’s status to save it immediately." />
          {employees.length ? (
            <div className="attendance-roster-form">
              <div className="attendance-roster-controls">
                <label className="field">
                  Date
                  <input
                    type="date"
                    value={attendanceDate}
                    max={today}
                    onChange={(event) => {
                      setAttendanceDate(event.target.value);
                      setNotesByEmployee({});
                      setOpenStatusMenuId(null);
                    }}
                  />
                </label>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    type="search"
                    value={rosterSearch}
                    placeholder="Find an employee"
                    aria-label="Search attendance roster"
                    onChange={(event) => setRosterSearch(event.target.value)}
                  />
                </label>
                <span>{filteredEmployees.length} employees</span>
              </div>
              {filteredEmployees.length ? (
                <div className="attendance-roster-grid" role="list" aria-label="Employee attendance roster">
                  {filteredEmployees.map((employee) => {
                    const existing = attendanceForDate.get(employee.uid);
                    const status = existing?.status;
                    const isSaving = savingEmployeeIds.has(employee.uid);
                    const isOpen = openStatusMenuId === employee.uid;
                    const approvedLeaves = approvedLeavesByEmployee.get(employee.uid) ?? [];
                    const leaveForDate = approvedLeaves.find(
                      (request) =>
                        request.startDate <= attendanceDate &&
                        request.endDate >= attendanceDate &&
                        (request.type === "Annual leave" || request.type === "Sick leave"),
                    );
                    const leaveStatus = leaveForDate
                      ? leaveForDate.type === "Annual leave"
                        ? "annual-leave"
                        : "sick-leave"
                      : null;
                    const displayStatus = status === "leave"
                      ? leaveStatus ?? status
                      : status;
                    const upcomingAnnualLeave = approvedLeaves.find(
                      (request) =>
                        request.type === "Annual leave" && request.endDate >= today,
                    );
                    return (
                      <div
                        className={`attendance-roster-person${isOpen ? ` attendance-roster-person-open attendance-roster-person-menu-${openStatusMenuSide}` : ""}`}
                        key={employee.uid}
                        role="listitem"
                        onMouseEnter={(event) => openStatusMenu(employee.uid, event.currentTarget)}
                        onMouseLeave={() => setOpenStatusMenuId(null)}
                        onFocus={(event) => openStatusMenu(employee.uid, event.currentTarget)}
                        onBlur={(event) => {
                          if (
                            !isSaving &&
                            !event.currentTarget.contains(event.relatedTarget)
                          ) {
                            setOpenStatusMenuId(null);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className={`attendance-roster-avatar-button attendance-roster-status-${displayStatus ?? "unmarked"}`}
                          aria-label={`${getEmployeeDisplayName(employee)}: ${attendanceStatusLabel(displayStatus ?? "Not marked")}. Choose attendance status`}
                          title={`${getEmployeeDisplayName(employee)} · ${attendanceStatusLabel(displayStatus ?? "Not marked")}`}
                          aria-expanded={isOpen}
                          aria-controls={`attendance-quick-status-${employee.uid}`}
                          onClick={() =>
                            setOpenStatusMenuId((current) =>
                              current === employee.uid ? null : employee.uid,
                            )
                          }
                        >
                          <EmployeeAvatar
                            name={getEmployeeDisplayName(employee)}
                            photoURL={employee.photoURL}
                          />
                        </button>
                        <div
                          className="attendance-roster-quick-status"
                          id={`attendance-quick-status-${employee.uid}`}
                          role="group"
                          aria-label={`Attendance status for ${getEmployeeDisplayName(employee)}`}
                        >
                          <div className="attendance-roster-hover-heading">
                            <strong>{getEmployeeDisplayName(employee)}</strong>
                            <div className="attendance-roster-hover-status">
                              {isSaving ? (
                                <span className="attendance-roster-saving">Saving…</span>
                              ) : displayStatus ? (
                                <StatusPill status={displayStatus} />
                              ) : (
                                <>
                                  <span className="attendance-roster-unmarked">Not marked</span>
                                  {leaveStatus && <StatusPill status={leaveStatus} />}
                                </>
                              )}
                            </div>
                          </div>
                          {upcomingAnnualLeave && (
                            <div className="attendance-roster-leave-booking attendance-roster-leave-booking-active">
                              <span>Annual leave booked</span>
                              <strong>
                                {formatDate(upcomingAnnualLeave.startDate)}
                                {upcomingAnnualLeave.startDate === upcomingAnnualLeave.endDate
                                  ? ""
                                  : ` – ${formatDate(upcomingAnnualLeave.endDate)}`}
                              </strong>
                            </div>
                          )}
                          <div className="attendance-roster-status-options">
                            {([
                              ["present", "Present"],
                              ["late", "Late"],
                              ["absent", "Absent"],
                              ["annual-leave", "Annual Leave"],
                              ["sick-leave", "Sick Leave"],
                            ] as const).map(([value, label]) => (
                              <button
                                type="button"
                                className={`attendance-quick-status attendance-quick-status-${value}`}
                                key={value}
                                aria-disabled={isSaving}
                                aria-pressed={
                                  status === value || (status === "leave" && leaveStatus === value)
                                }
                                onClick={() => void chooseAttendanceStatus(employee, value)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <input
                            className="attendance-roster-note"
                            maxLength={240}
                            value={notesByEmployee[employee.uid] ?? existing?.note ?? ""}
                            onChange={(event) =>
                              setNotesByEmployee((current) => ({
                                ...current,
                                [employee.uid]: event.target.value,
                              }))
                            }
                            placeholder="Add a note…"
                            aria-label={`Optional attendance note for ${getEmployeeDisplayName(employee)}; click a status to save`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={<Search size={20} />} title="No matching employees" text="Try a different search." />
              )}
            </div>
          ) : (
            <EmptyState icon={<Users size={20} />} title="No approved employees yet" text="Approve employee accounts before recording attendance." />
          )}
        </section>
      )}
      <section className="panel">
        <div className="panel-heading panel-heading-search">
          <div>
            <h2>{isAdmin ? "Attendance records" : "Your attendance"}</h2>
            <p>{isAdmin ? "Recent records for your team." : `Attendance history for ${profile ? getEmployeeDisplayName(profile) : user.displayName || "your account"}.`}</p>
          </div>
          {isAdmin && (
            <label className="search-field">
              <Search size={16} />
              <input
                type="search"
                placeholder="Search records"
                aria-label="Search attendance records"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          )}
        </div>
        {records.length > 0 && (
          <div className="repeat-list-toolbar attendance-record-filters">
            <label className="filter-select">
              <span className="sr-only">Filter attendance records by status</span>
              <select
                aria-label="Filter attendance records by status"
                value={recordStatusFilter}
                onChange={(event) => setRecordStatusFilter(event.target.value as AttendanceStatus | "all")}
              >
                <option value="all">All statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="leave">Leave</option>
                <option value="annual-leave">Annual Leave</option>
                <option value="sick-leave">Sick Leave</option>
              </select>
            </label>
            <label className="attendance-date-filter">
              From
              <input
                type="date"
                aria-label="Attendance records from date"
                value={recordFromDate}
                onChange={(event) => setRecordFromDate(event.target.value)}
              />
            </label>
            <label className="attendance-date-filter">
              To
              <input
                type="date"
                aria-label="Attendance records to date"
                value={recordToDate}
                onChange={(event) => setRecordToDate(event.target.value)}
              />
            </label>
            <SortControls
              value={recordSort}
              options={[
                { value: "date", label: "Date" },
                ...(isAdmin ? [{ value: "employee", label: "Employee" }] : []),
                { value: "status", label: "Status" },
              ]}
              direction={recordSortDirection}
              onChange={(value) => setRecordSort(value as typeof recordSort)}
              onToggleDirection={() =>
                setRecordSortDirection((direction) => direction === "asc" ? "desc" : "asc")
              }
            />
            <span>{filteredRecords.length} of {records.length} records</span>
          </div>
        )}
        {filteredRecords.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {isAdmin && <th>EMPLOYEE</th>}
                    <th>DATE</th>
                    <th>STATUS</th>
                    <th>NOTE</th>
                    {isAdmin && <th>RECORDED BY</th>}
                    {isAdmin && <th className="align-right">ACTIONS</th>}
                  </tr>
                </thead>
                <tbody>
                  {recordPagination.items.map((record) => (
                    <tr key={record.id}>
                      {isAdmin && (
                        <td>
                          <div className="person-cell">
                            <Initials name={record.employeeName} />
                            <span><strong>{record.employeeName}</strong></span>
                          </div>
                        </td>
                      )}
                      <td>{formatDate(record.date)}</td>
                      <td><StatusPill status={record.status} /></td>
                      <td className="reason-cell">{record.note || "—"}</td>
                      {isAdmin && <td>{record.recordedBy}</td>}
                      {isAdmin && (
                        <td className="align-right">
                          <div className="decision-actions">
                            <Button variant="secondary" onClick={() => onDeleteRecord(record)}>
                              <Trash2 size={15} /> Delete
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls {...recordPagination} />
          </>
        ) : (
          <EmptyState
            icon={<CalendarCheck2 size={20} />}
            title={filteredRecords.length === 0 && records.length ? "No matching attendance records" : isAdmin ? "No attendance records" : "Nothing recorded yet"}
            text={records.length ? "Try a different search." : isAdmin ? "Add a record above to get started." : "Your administrator records attendance for the team."}
          />
        )}
      </section>
    </div>
  );
}

function TeamPage({
  employees,
  attendance,
  leaveRequests,
  onApprove,
  onSaveEmployeeRow,
  onSaveEmployeeDetails,
  onAwardBadge,
  onRemoveBadge,
  onDeleteEmployee,
  onDeleteMonthlyRecords,
  onNotice,
}: {
  employees: EmployeeProfile[];
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  onApprove: (employee: EmployeeProfile, status: Exclude<ApprovalStatus, "pending">) => void;
  onSaveEmployeeRow: (
    employee: EmployeeProfile,
    fiscalYearStart: number,
    managerId: string,
    annualDays: string,
    sickDays: string,
  ) => Promise<void>;
  onSaveEmployeeDetails: (
    employee: EmployeeProfile,
    details: EmployeeProfileDetails,
  ) => Promise<void>;
  onAwardBadge: (employee: EmployeeProfile, badgeId: EmployeeBadgeId) => Promise<void>;
  onRemoveBadge: (employee: EmployeeProfile, badgeId: EmployeeBadgeId) => Promise<void>;
  onDeleteEmployee: (employee: EmployeeProfile) => void;
  onDeleteMonthlyRecords: (month: string) => Promise<MonthCleanupCounts>;
  onNotice: (kind: "success" | "error", message: string) => void;
}) {
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [profileEmployeeId, setProfileEmployeeId] = useState<string | null>(null);
  const [cleanupMonth, setCleanupMonth] = useState(
    `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, "0")}`,
  );
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const currentFiscalYear = fiscalYearStartForDate(new Date());
  const [fiscalYearStart, setFiscalYearStart] = useState(currentFiscalYear);
  const fiscalYears = useMemo(
    () => availableFiscalYears(employees, [], currentFiscalYear),
    [currentFiscalYear, employees],
  );
  const visibleEmployees = employees.filter((employee) => {
    const term = employeeSearch.trim().toLowerCase();
    const matchesSearch =
      !term ||
      `${getEmployeeDisplayName(employee)} ${employee.displayName} ${employee.email}`.toLowerCase().includes(term);
    const matchesManager =
      !managerFilter ||
      (managerFilter === "unassigned"
        ? !employee.reportingManagerId
        : employee.reportingManagerId === managerFilter);
    return matchesSearch && matchesManager;
  });
  const reportingManagers = Array.from(
    new Set(employees.map((employee) => employee.reportingManagerId).filter(Boolean)),
  )
    .map((managerId) => employees.find((employee) => employee.uid === managerId))
    .filter((manager): manager is EmployeeProfile => Boolean(manager))
    .sort((first, second) => getEmployeeDisplayName(first).localeCompare(getEmployeeDisplayName(second)));
  const sortedVisibleEmployees = useMemo(
    () =>
      sortItems(
        visibleEmployees,
        getEmployeeDisplayName,
        "asc",
      ),
    [visibleEmployees],
  );
  const employeePagination = usePagination(
    sortedVisibleEmployees,
    `${managerFilter}:${employeeSearch}`,
  );
  const selectedEmployee = employees.find(
    (employee) => employee.uid === profileEmployeeId,
  );

  async function cleanSelectedMonth() {
    if (cleanupBusy || !/^\d{4}-(0[1-9]|1[0-2])$/.test(cleanupMonth)) {
      onNotice("error", "Choose a valid month before deleting records.");
      return;
    }
    const monthLabel = new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
    }).format(new Date(`${cleanupMonth}-01T00:00:00`));
    if (
      !window.confirm(
        `Permanently delete attendance and daily updates dated ${monthLabel}, leave requests overlapping ${monthLabel}, concerns opened in ${monthLabel} (including all replies), and notices published in ${monthLabel}? Employee profiles and leave balances will be kept. This cannot be undone.`,
      )
    ) {
      return;
    }

    setCleanupBusy(true);
    try {
      const counts = await onDeleteMonthlyRecords(cleanupMonth);
      onNotice(
        "success",
        `Deleted ${counts.attendance} attendance records, ${counts.leaveRequests} leave requests, ${counts.dailyUpdates} daily updates, ${counts.concerns} concerns and ${counts.concernReplies} replies, and ${counts.notices} notices for ${monthLabel}. Employee profiles and leave balances were kept.`,
      );
    } catch (actionError) {
      onNotice(
        "error",
        `Could not complete the monthly cleanup. Some records may already have been deleted. ${friendlyError(actionError)}`,
      );
    } finally {
      setCleanupBusy(false);
    }
  }

  return (
    <div className="content-stack">
      <div className="stat-grid team-stats">
        <StatCard icon={<Users size={18} />} label="All accounts" value={employees.length} hint="Registered" tone="blue" />
        <StatCard icon={<CheckCircle2 size={18} />} label="Approved" value={employees.filter((employee) => employee.status === "approved").length} hint="Active access" tone="green" />
        <StatCard icon={<Clock3 size={18} />} label="Pending" value={employees.filter((employee) => employee.status === "pending").length} hint="Needs your review" tone="amber" />
        <StatCard icon={<XCircle size={18} />} label="Declined" value={employees.filter((employee) => employee.status === "rejected").length} hint="Not approved" tone="violet" />
      </div>
      <section className="panel">
        <div className="panel-heading panel-heading-search">
          <div>
            <h2>Employee accounts</h2>
            <p>Manage employee access and fiscal-year leave balances.</p>
          </div>
          <div className="team-filters">
            <label className="search-field">
              <Search size={16} />
              <input
                type="search"
                value={employeeSearch}
                placeholder="Search employees"
                aria-label="Search employee accounts"
                onChange={(event) => setEmployeeSearch(event.target.value)}
              />
            </label>
            <label className="filter-select">
              <span className="sr-only">Select fiscal year for leave balances</span>
              <select
                aria-label="Select fiscal year for leave balances"
                value={fiscalYearStart}
                onChange={(event) => setFiscalYearStart(Number(event.target.value))}
              >
                {fiscalYears.map((year) => (
                  <option value={year} key={year}>{formatFiscalYear(year)}</option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span className="sr-only">Filter employees by reporting manager</span>
              <select
                aria-label="Filter employees by reporting manager"
                value={managerFilter}
                onChange={(event) => setManagerFilter(event.target.value)}
              >
                <option value="">All managers</option>
                <option value="unassigned">No manager assigned</option>
                {reportingManagers.map((manager) => (
                  <option value={manager.uid} key={manager.uid}>
                    {getEmployeeDisplayName(manager)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {visibleEmployees.length ? (
          <>
            <div className="table-wrap">
              <table className="team-table">
                <thead>
                  <tr><th>EMPLOYEE</th><th>REPORTING TO</th><th>ACCESS</th><th>LEAVE BALANCES</th><th className="align-right">ACTIONS</th></tr>
                </thead>
                <tbody>
                  {employeePagination.items.map((employee) => (
                    <EmployeeAccountRow
                      key={`${employee.uid}-${fiscalYearStart}`}
                      employee={employee}
                      employees={employees}
                      fiscalYearStart={fiscalYearStart}
                      onSave={onSaveEmployeeRow}
                      onApprove={onApprove}
                      onOpenProfile={() => setProfileEmployeeId(employee.uid)}
                      onDelete={() => onDeleteEmployee(employee)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls {...employeePagination} />
          </>
        ) : (
          <EmptyState
            icon={<Users size={20} />}
            title={employees.length ? "No matching employees" : "No employee accounts"}
            text={employees.length ? "Try another name, email, or access filter." : "New Google sign-ins will appear here for approval."}
          />
        )}
      </section>
      {selectedEmployee && (
        <>
          <EmployeeProfileDetailsPanel
            key={selectedEmployee.uid}
            employee={selectedEmployee}
            onSave={onSaveEmployeeDetails}
            onAwardBadge={onAwardBadge}
            onRemoveBadge={onRemoveBadge}
            onClose={() => setProfileEmployeeId(null)}
          />
          <section className="panel employee-attendance-panel">
            <PanelHeading
              title="Attendance history"
              subtitle="A day-by-day view over the past 12 months. Recorded attendance is shown even on weekends; days without a recorded status stay gray."
            />
            <div className="employee-attendance-list">
              <EmployeeAttendanceHeatmap
                employee={selectedEmployee}
                attendance={attendance.filter((record) => record.employeeId === selectedEmployee.uid)}
                leaveRequests={leaveRequests.filter((request) => request.employeeId === selectedEmployee.uid)}
              />
            </div>
          </section>
        </>
      )}
      <section className="panel">
        <PanelHeading
          title="Monthly record cleanup"
          subtitle="Permanently remove business records for a selected month while keeping employee profiles and leave balances."
        />
        <div className="monthly-cleanup-controls">
          <label className="field">
            <span>Month to clear</span>
            <input
              type="month"
              value={cleanupMonth}
              onChange={(event) => setCleanupMonth(event.target.value)}
              disabled={cleanupBusy}
            />
          </label>
          <Button
            variant="danger"
            disabled={cleanupBusy}
            onClick={cleanSelectedMonth}
          >
            <Trash2 size={15} />
            {cleanupBusy ? "Deleting records..." : "Delete records for month"}
          </Button>
        </div>
        <p className="panel-note">
          Includes attendance and daily updates dated in the month, leave requests that overlap it,
          concerns opened in the month and all their replies, and notices published in the month.
        </p>
      </section>
      <section className="admin-note">
        <ShieldCheck size={18} />
        <p><strong>Admin-only controls.</strong> Only the ADN administrator can change employee access or manually set annual and sick balances for each fiscal year.</p>
      </section>
    </div>
  );
}

function EmployeeAttendanceHeatmap({
  employee,
  attendance,
  leaveRequests,
}: {
  employee: Pick<EmployeeProfile, "uid" | "displayName" | "nickname" | "email">;
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
}) {
  const { weeks, statusByDate } = useMemo(() => {
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(todayDate);
    startDate.setDate(startDate.getDate() - 364);
    startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

    const weeks = Array.from({ length: 53 }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + weekIndex * 7 + dayIndex);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      }),
    );
    const statusByDate: Record<string, "present" | "late" | "absent" | "annual-leave" | "sick-leave" | "leave"> = {};
    attendance.forEach((record) => {
      if (record.date <= today) statusByDate[record.date] = record.status;
    });
    leaveRequests.forEach((request) => {
      if (request.status !== "approved") return;
      const status = request.type === "Annual leave"
        ? "annual-leave"
        : request.type === "Sick leave"
          ? "sick-leave"
          : null;
      if (!status) return;
      const from = request.startDate > weeks[0][0] ? request.startDate : weeks[0][0];
      const to = request.endDate < today ? request.endDate : today;
      for (let date = new Date(`${from}T00:00:00`); ; date.setDate(date.getDate() + 1)) {
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        if (dateKey > to) break;
        statusByDate[dateKey] = status;
      }
    });

    return { weeks, statusByDate };
  }, [attendance, leaveRequests]);

  const monthLabels = weeks.map((week, index) => {
    const weekStart = new Date(`${week[0]}T00:00:00`);
    const previousWeekMonth = index > 0
      ? new Date(`${weeks[index - 1][0]}T00:00:00`).getMonth()
      : -1;
    return weekStart.getMonth() !== previousWeekMonth
      ? new Intl.DateTimeFormat("en", { month: "short" }).format(weekStart)
      : "";
  });
  const statusLabels: Record<string, string> = {
    present: "Present",
    late: "Late",
    absent: "Absent",
    "annual-leave": "Annual Leave",
    "sick-leave": "Sick Leave",
    leave: "Leave",
  };

  return (
    <article className="employee-attendance">
      <div className="employee-attendance-heading">
        <div className="employee-attendance-person">
          <Initials name={getEmployeeDisplayName(employee)} />
          <span><strong>{getEmployeeDisplayName(employee)}</strong><small>{employee.email}</small></span>
        </div>
      </div>
      <div className="employee-heatmap-scroll">
        <div className="employee-heatmap">
          <div className="employee-heatmap-months" aria-hidden="true">
            <span />
            <div className="employee-heatmap-month-labels">
              {monthLabels.map((month, index) => <span key={index}>{month}</span>)}
            </div>
          </div>
          <div className="employee-heatmap-days">
            <div className="employee-heatmap-weekday-labels" aria-hidden="true">
              <span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /><span />
            </div>
            <div className="employee-heatmap-weeks">
              {weeks.map((week, weekIndex) => (
                <div className="employee-heatmap-week" key={weekIndex}>
                  {week.map((date) => {
                    const weekday = new Date(`${date}T00:00:00`).getDay();
                    const status = statusByDate[date];
                    const isWeekend = weekday === 5 || weekday === 6;
                    const tone = status ?? (isWeekend ? "weekend" : "empty");
                    const label = status
                      ? statusLabels[status]
                      : isWeekend
                        ? "Weekend"
                        : "No attendance recorded";
                    return (
                      <span
                        className={`employee-heatmap-cell employee-heatmap-${tone}`}
                        key={date}
                        title={`${formatDate(date)} · ${label}`}
                        aria-label={`${formatDate(date)}: ${label}`}
                        role="img"
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="employee-heatmap-legend" aria-label="Attendance status legend">
        {([
          ["present", "Present"],
          ["late", "Late"],
          ["absent", "Absent"],
          ["annual-leave", "Annual Leave"],
          ["sick-leave", "Sick Leave"],
          ["empty", "Weekend / public holiday / no record"],
        ] as const).map(([tone, label]) => (
          <span key={tone}>
            <i className={`employee-heatmap-cell employee-heatmap-${tone}`} />
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}

function EmployeeAccountRow({
  employee,
  employees,
  fiscalYearStart,
  onSave,
  onApprove,
  onOpenProfile,
  onDelete,
}: {
  employee: EmployeeProfile;
  employees: EmployeeProfile[];
  fiscalYearStart: number;
  onSave: (
    employee: EmployeeProfile,
    fiscalYearStart: number,
    managerId: string,
    annualDays: string,
    sickDays: string,
  ) => Promise<void>;
  onApprove: (employee: EmployeeProfile, status: Exclude<ApprovalStatus, "pending">) => void;
  onOpenProfile: () => void;
  onDelete: () => void;
}) {
  const currentBalance = employee.leaveBalances?.[String(fiscalYearStart)];
  const [managerId, setManagerId] = useState(employee.reportingManagerId ?? "");
  const [annualDays, setAnnualDays] = useState(currentBalance?.annualDays.toString() ?? "");
  const [sickDays, setSickDays] = useState(currentBalance?.sickDays.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const currentManager = employees.find((candidate) => candidate.uid === managerId);
  const approvedManagers = employees
    .filter((candidate) => candidate.status === "approved" && candidate.uid !== employee.uid)
    .sort((first, second) =>
      getEmployeeDisplayName(first).localeCompare(getEmployeeDisplayName(second)),
    );

  useEffect(() => {
    setManagerId(employee.reportingManagerId ?? "");
    setAnnualDays(currentBalance?.annualDays.toString() ?? "");
    setSickDays(currentBalance?.sickDays.toString() ?? "");
  }, [employee.reportingManagerId, employee.leaveBalances, fiscalYearStart]);

  async function saveRow() {
    setSaving(true);
    try {
      await onSave(employee, fiscalYearStart, managerId, annualDays, sickDays);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>
        <div className="person-cell">
          <Initials name={getEmployeeDisplayName(employee)} />
          <span><strong>{getEmployeeDisplayName(employee)}</strong><small>{employee.email}</small></span>
        </div>
      </td>
      <td>
        <div className="reporting-manager-editor">
          <select
            aria-label={`Reporting manager for ${getEmployeeDisplayName(employee)}`}
            value={managerId}
            disabled={saving}
            onChange={(event) => setManagerId(event.target.value)}
          >
            <option value="">No manager assigned</option>
            {currentManager &&
              currentManager.uid !== employee.uid &&
              currentManager.status !== "approved" && (
                <option value={currentManager.uid} disabled>
                  {getEmployeeDisplayName(currentManager)} (not approved)
                </option>
              )}
            {approvedManagers.map((manager) => (
              <option key={manager.uid} value={manager.uid}>
                {getEmployeeDisplayName(manager)}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td><StatusPill status={employee.status} /></td>
      <td>
        <div className="leave-balance-editor">
          <label>
            <span>Annual</span>
            <input
              aria-label={`Annual leave days for ${getEmployeeDisplayName(employee)} in ${formatFiscalYear(fiscalYearStart)}`}
              type="number"
              min="0"
              step="1"
              value={annualDays}
              disabled={saving}
              onChange={(event) => setAnnualDays(event.target.value)}
            />
          </label>
          <label>
            <span>Sick</span>
            <input
              aria-label={`Sick leave days for ${getEmployeeDisplayName(employee)} in ${formatFiscalYear(fiscalYearStart)}`}
              type="number"
              min="0"
              step="1"
              value={sickDays}
              disabled={saving}
              onChange={(event) => setSickDays(event.target.value)}
            />
          </label>
        </div>
      </td>
      <td className="align-right">
        <div className="decision-actions">
          <Button type="button" variant="secondary" disabled={saving} onClick={saveRow}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {employee.status === "pending" && (
            <>
              <Button variant="secondary" onClick={() => onApprove(employee, "rejected")}>Decline</Button>
              <Button onClick={() => onApprove(employee, "approved")}><Check size={15} /> Approve</Button>
            </>
          )}
          {employee.status === "rejected" && (
            <Button variant="secondary" onClick={() => onApprove(employee, "approved")}>Approve access</Button>
          )}
          <Button variant="secondary" onClick={onOpenProfile}>
            <Users size={15} /> View profile
          </Button>
          <Button variant="secondary" onClick={onDelete}>
            <Trash2 size={15} /> Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

function EmployeeProfileDetailsPanel({
  employee,
  onSave,
  onAwardBadge,
  onRemoveBadge,
  onClose,
}: {
  employee: EmployeeProfile;
  onSave: (
    employee: EmployeeProfile,
    details: EmployeeProfileDetails,
  ) => Promise<void>;
  onAwardBadge: (employee: EmployeeProfile, badgeId: EmployeeBadgeId) => Promise<void>;
  onRemoveBadge: (employee: EmployeeProfile, badgeId: EmployeeBadgeId) => Promise<void>;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(employee.displayName);
  const [nickname, setNickname] = useState(employee.nickname ?? "");
  const [officialEmail, setOfficialEmail] = useState(employee.officialEmail ?? "");
  const [githubId, setGithubId] = useState(employee.githubId ?? "");
  const [trackRecords, setTrackRecords] = useState<TrackRecord[]>(
    employee.trackRecords ?? [],
  );
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState<EmployeeBadgeId | "">("");
  const [badgeBusy, setBadgeBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(employee, { displayName, nickname, officialEmail, githubId, trackRecords, phone });
    } finally {
      setSaving(false);
    }
  }

  async function awardBadge() {
    if (!selectedBadgeId || badgeBusy) return;
    setBadgeBusy(true);
    try {
      await onAwardBadge(employee, selectedBadgeId);
      setSelectedBadgeId("");
    } finally {
      setBadgeBusy(false);
    }
  }

  async function removeBadge(badgeId: EmployeeBadgeId) {
    if (badgeBusy) return;
    setBadgeBusy(true);
    try {
      await onRemoveBadge(employee, badgeId);
    } finally {
      setBadgeBusy(false);
    }
  }

  const awardedBadgeIds = employee.badges ?? [];
  const availableBadges = EMPLOYEE_BADGES.filter(
    (badge) => !awardedBadgeIds.includes(badge.id),
  );

  return (
    <section className="panel">
      <div className="panel-heading panel-heading-search">
        <div>
          <h2>Employee profile</h2>
          <p>{employee.email} · <StatusPill status={employee.status} /></p>
        </div>
        <Button variant="secondary" onClick={onClose}>Close profile</Button>
      </div>
      <form className="form-grid employee-profile-form" onSubmit={submit}>
        <label className="field">
          Display name
          <input
            required
            maxLength={120}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label className="field">
          Nickname
          <input
            maxLength={120}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Name they go by"
          />
        </label>
        <label className="field">
          Email
          <input value={employee.email} disabled />
        </label>
        <label className="field">
          Official email
          <input
            type="email"
            maxLength={254}
            value={officialEmail}
            onChange={(event) => setOfficialEmail(event.target.value)}
            placeholder="name@company.com"
          />
        </label>
        <label className="field">
          GitHub ID
          <input
            maxLength={39}
            autoComplete="off"
            value={githubId}
            onChange={(event) => setGithubId(event.target.value)}
            placeholder="GitHub username"
          />
        </label>
        <label className="field">
          Phone number
          <input
            type="tel"
            maxLength={50}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <div className="track-records field-full">
          <div className="track-records-heading">
            <div>
              <h3>Track records</h3>
              <p>Add roles and dates; leave the end date blank for a current role.</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setTrackRecords((records) => [
                  ...records,
                  { role: "", startDate: "", endDate: "" },
                ])
              }
            >
              <Plus size={15} /> Add record
            </Button>
          </div>
          {trackRecords.length ? (
            <div className="track-record-list">
              {trackRecords.map((record, index) => (
                <div className="track-record-row" key={index}>
                  <label className="field">
                    Role
                    <input
                      required
                      maxLength={120}
                      value={record.role}
                      onChange={(event) =>
                        setTrackRecords((records) =>
                          records.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, role: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Trainee Engineer"
                    />
                  </label>
                  <label className="field">
                    From
                    <input
                      required
                      type="date"
                      value={record.startDate}
                      onChange={(event) =>
                        setTrackRecords((records) =>
                          records.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, startDate: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    To
                    <input
                      type="date"
                      min={record.startDate || undefined}
                      value={record.endDate}
                      onChange={(event) =>
                        setTrackRecords((records) =>
                          records.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, endDate: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    className="icon-button track-record-remove"
                    type="button"
                    aria-label={`Remove ${record.role || "track"} record`}
                    onClick={() =>
                      setTrackRecords((records) =>
                        records.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="track-record-empty">No track records added.</p>
          )}
        </div>
        <div className="form-foot field-full">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
      <div className="employee-badge-manager">
        <div>
          <h3>Recognition badges</h3>
          <p>Assign a badge to recognize this employee’s contribution. Badges are visible to the team.</p>
        </div>
        <div className="employee-badge-manager-controls">
          <label className="field">
            <span>Choose a badge</span>
            <select
              value={selectedBadgeId}
              disabled={badgeBusy || !availableBadges.length}
              onChange={(event) => {
                const badge = EMPLOYEE_BADGES.find((item) => item.id === event.target.value);
                setSelectedBadgeId(badge?.id ?? "");
              }}
            >
              <option value="">
                {availableBadges.length ? "Select a badge" : "All badges awarded"}
              </option>
              {availableBadges.map((badge) => (
                <option value={badge.id} key={badge.id}>{badge.label}</option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            disabled={!selectedBadgeId || badgeBusy}
            onClick={awardBadge}
          >
            <Award size={15} /> {badgeBusy ? "Saving…" : "Award badge"}
          </Button>
        </div>
        {awardedBadgeIds.length ? (
          <ul className="employee-badge-admin-list">
            {EMPLOYEE_BADGES.filter((badge) => awardedBadgeIds.includes(badge.id)).map((badge) => (
              <li key={badge.id}>
                <span className={`employee-badge employee-badge-label employee-badge-${badge.id}`}>
                  <Award size={15} aria-hidden="true" />
                  {badge.label}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={badgeBusy}
                  onClick={() => removeBadge(badge.id)}
                >
                  <X size={14} /> Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="employee-badges-empty">No badges have been awarded yet.</p>
        )}
      </div>
    </section>
  );
}

export default App;
