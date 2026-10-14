import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { ADMIN_EMAIL, db } from "./firebase";
import type {
  AttendanceRecord,
  Concern,
  ConcernAuthorRole,
  ConcernMessage,
  ConcernStatus,
  DailyUpdate,
  DailyUpdateFields,
  EmployeeProfile,
  LeaveRequest,
  NoticePost,
} from "./types";

function asRecords<T>(snapshot: QuerySnapshot<DocumentData>): T[] {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
}

export async function ensureEmployeeProfile(
  uid: string,
  email: string,
  displayName: string,
): Promise<void> {
  if (email.toLowerCase() === ADMIN_EMAIL) return;

  const profileRef = doc(db, "users", uid);
  const existing = await getDoc(profileRef);
  if (existing.exists()) return;

  await setDoc(profileRef, {
    uid,
    email,
    displayName,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function listenToProfile(
  uid: string,
  next: (profile: EmployeeProfile | null) => void,
  fail: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "users", uid),
    (snapshot) =>
      next(
        snapshot.exists()
          ? ({ uid: snapshot.id, ...snapshot.data() } as EmployeeProfile)
          : null,
      ),
    fail,
  );
}

export function listenToEmployees(
  next: (employees: EmployeeProfile[]) => void,
  fail: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "users"), orderBy("createdAt", "desc")),
    (snapshot) => next(asRecords<EmployeeProfile>(snapshot)),
    fail,
  );
}

export function listenToLeaveRequests(
  uid: string,
  isAdmin: boolean,
  next: (requests: LeaveRequest[]) => void,
  fail: (error: Error) => void,
): Unsubscribe {
  const requests = collection(db, "leaveRequests");
  const requestQuery = isAdmin
    ? query(requests, orderBy("createdAt", "desc"))
    : query(
        requests,
        where("employeeId", "==", uid),
        orderBy("createdAt", "desc"),
      );

  return onSnapshot(
    requestQuery,
    (snapshot) => next(asRecords<LeaveRequest>(snapshot)),
    fail,
  );
}

export function listenToAttendance(
  uid: string,
  isAdmin: boolean,
  next: (records: AttendanceRecord[]) => void,
  fail: (error: Error) => void,
): Unsubscribe {
  const records = collection(db, "attendance");
  const recordQuery = isAdmin
    ? query(records, orderBy("date", "desc"))
    : query(records, where("employeeId", "==", uid), orderBy("date", "desc"));

  return onSnapshot(
    recordQuery,
    (snapshot) => next(asRecords<AttendanceRecord>(snapshot)),
    fail,
  );
}

export function dhakaDateParts(now = new Date()): { date: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export type DailyUpdateControl = {
  collectingDate: string;
  accepting: boolean;
  acceptingUntil: Date;
};

export function dailyUpdatesOpen(now = new Date(), control?: DailyUpdateControl): boolean {
  if (control) return control.accepting && now < control.acceptingUntil;
  return dhakaDateParts(now).hour < 21;
}

export function listenToDailyUpdateControl(
  next: (control: DailyUpdateControl | null) => void,
  fail: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "system", "dailyUpdates"),
    (snapshot) => {
      if (!snapshot.exists()) {
        next(null);
        return;
      }
      const data = snapshot.data();
      if (
        typeof data.collectingDate !== "string" ||
        typeof data.accepting !== "boolean" ||
        typeof data.acceptingUntil?.toDate !== "function"
      ) {
        fail(new Error("Daily update collection status is invalid."));
        return;
      }
      next({
        collectingDate: data.collectingDate,
        accepting: data.accepting,
        acceptingUntil: data.acceptingUntil.toDate(),
      });
    },
    fail,
  );
}

export function listenToOwnDailyUpdate(
  uid: string,
  next: (update: DailyUpdate | null) => void,
  fail: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "dailyUpdates", uid),
    (snapshot) =>
      next(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as DailyUpdate) : null),
    fail,
  );
}

export function listenToAllDailyUpdates(
  next: (updates: DailyUpdate[]) => void,
  fail: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, "dailyUpdates"),
    (snapshot) =>
      next(
        asRecords<DailyUpdate>(snapshot).sort((a, b) =>
          a.employeeName.localeCompare(b.employeeName),
        ),
      ),
    fail,
  );
}

export async function saveDailyUpdate(
  user: { uid: string; email: string; name: string },
  fields: DailyUpdateFields,
  date: string,
): Promise<void> {
  await setDoc(doc(db, "dailyUpdates", user.uid), {
    employeeId: user.uid,
    employeeEmail: user.email,
    employeeName: user.name,
    date,
    todaysTasks: fields.todaysTasks,
    suddenTasks: fields.suddenTasks,
    blockers: fields.blockers,
    plans: fields.plans,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDailyUpdate(uid: string): Promise<void> {
  await deleteDoc(doc(db, "dailyUpdates", uid));
}

export function listenToConcerns(
  uid: string,
  isAdmin: boolean,
  next: (concerns: Concern[]) => void,
  fail: (error: Error) => void,
): Unsubscribe {
  const concerns = collection(db, "concerns");
  const concernQuery = isAdmin
    ? concerns
    : query(concerns, where("employeeId", "==", uid));

  return onSnapshot(
    concernQuery,
    (snapshot) =>
      next(
        asRecords<Concern>(snapshot).sort(
          (a, b) => (b.updatedAt?.toMillis() ?? Date.now()) - (a.updatedAt?.toMillis() ?? Date.now()),
        ),
      ),
    fail,
  );
}

export function listenToConcernMessages(
  concernId: string,
  next: (messages: ConcernMessage[]) => void,
  fail: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "concerns", concernId, "messages"), orderBy("createdAt", "asc")),
    (snapshot) => next(asRecords<ConcernMessage>(snapshot)),
    fail,
  );
}

export async function createConcern(
  user: { uid: string; email: string; name: string },
  subject: string,
  body: string,
): Promise<void> {
  await addDoc(collection(db, "concerns"), {
    employeeId: user.uid,
    employeeEmail: user.email,
    employeeName: user.name,
    subject: subject.trim(),
    body: body.trim(),
    status: "open",
    lastMessageBy: "employee",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function replyToConcern(
  concernId: string,
  authorId: string,
  role: ConcernAuthorRole,
  text: string,
  status: ConcernStatus,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "concerns", concernId, "messages")), {
    authorId,
    authorRole: role,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "concerns", concernId), {
    status,
    lastMessageBy: role,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function setConcernStatus(
  concernId: string,
  status: ConcernStatus,
): Promise<void> {
  await updateDoc(doc(db, "concerns", concernId), {
    status,
    lastMessageBy: "admin",
    updatedAt: serverTimestamp(),
  });
}

export async function deleteConcern(concernId: string): Promise<void> {
  const messages = await getDocs(collection(db, "concerns", concernId, "messages"));
  const refs = [...messages.docs.map((item) => item.ref), doc(db, "concerns", concernId)];
  // Replies go first so a partial failure never leaves orphaned messages behind a missing concern.
  for (let index = 0; index < refs.length; index += 400) {
    const batch = writeBatch(db);
    refs.slice(index, index + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export function listenToNotices(
  next: (notices: NoticePost[]) => void,
  fail: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "notices"), orderBy("createdAt", "desc")),
    (snapshot) => next(asRecords<NoticePost>(snapshot)),
    fail,
  );
}
