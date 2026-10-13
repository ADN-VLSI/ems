import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { ADMIN_EMAIL, db } from "./firebase";
import type {
  AttendanceRecord,
  EmployeeProfile,
  LeaveRequest,
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
