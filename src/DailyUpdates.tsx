import { useEffect, useState, type FormEvent } from "react";
import { Plus, Search, Send, Trash2, X } from "lucide-react";
import {
  PaginationControls,
  SortControls,
  sortItems,
  usePagination,
  type SortDirection,
} from "./Pagination";
import {
  dailyUpdatesOpen,
  deleteDailyUpdate,
  dhakaDateParts,
  listenToDailyUpdateControl,
  listenToAllDailyUpdates,
  listenToOwnDailyUpdate,
  saveDailyUpdate,
  type DailyUpdateControl,
} from "./data";
import type { DailyUpdate, DailyUpdateFields } from "./types";

type Props = {
  isAdmin: boolean;
  userId: string;
  userEmail: string;
  userName: string;
  onNotice: (kind: "success" | "error", message: string) => void;
};

type FieldKey = keyof DailyUpdateFields;

const sections: { key: FieldKey; title: string; placeholder: string }[] = [
  { key: "todaysTasks", title: "Today's Tasks", placeholder: "What did you work on today?" },
  { key: "suddenTasks", title: "Sudden Tasks", placeholder: "Unplanned work that came up" },
  { key: "blockers", title: "Blockers", placeholder: "Anything slowing you down?" },
  { key: "plans", title: "Plans Going Forward", placeholder: "What comes next?" },
];

const MAX_ITEMS = 30;
const MAX_LENGTH = 500;

function errorText(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Please try again.";
}

function emptyDraft(): Record<FieldKey, string[]> {
  return { todaysTasks: [""], suddenTasks: [""], blockers: [""], plans: [""] };
}

function toDraft(update: DailyUpdate): Record<FieldKey, string[]> {
  const draft = emptyDraft();
  for (const { key } of sections) draft[key] = update[key].length ? [...update[key]] : [""];
  return draft;
}

function formatUpdateDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function cleanItems(items: string[]): string[] {
  return items.map((item) => item.trim()).filter(Boolean);
}

function useDailyWindow(onNotice: Props["onNotice"]): { open: boolean; date: string } {
  const [dailyWindow, setWindow] = useState(() => ({
    open: dailyUpdatesOpen(),
    date: dhakaDateParts().date,
  }));
  useEffect(() => {
    let control: DailyUpdateControl | null = null;
    let receivedControl = false;
    let failed = false;
    const refresh = () =>
      setWindow({
        open: failed
          ? false
          : receivedControl
            ? control
              ? dailyUpdatesOpen(new Date(), control)
              : dailyUpdatesOpen()
            : false,
        date: control?.collectingDate ?? dhakaDateParts().date,
      });
    const timer = window.setInterval(refresh, 15000);
    const unsubscribe = listenToDailyUpdateControl(
      (nextControl) => {
        control = nextControl;
        receivedControl = true;
        refresh();
      },
      (error) => {
        receivedControl = true;
        failed = true;
        control = null;
        setWindow({ open: false, date: dhakaDateParts().date });
        onNotice("error", `Could not load daily update status. ${errorText(error)}`);
      },
    );
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [onNotice]);
  return dailyWindow;
}

function BulletList({ items, compact = false }: { items: string[]; compact?: boolean }) {
  if (!items.length) return <p className="panel-note">None</p>;
  const list = (
    <ul className="bullet-view">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
  return compact ? (
    <details className="bullet-view-details">
      <summary>{items.length} item{items.length === 1 ? "" : "s"}</summary>
      {list}
    </details>
  ) : list;
}

export function DailyUpdatesPage(props: Props) {
  return props.isAdmin ? <AdminView {...props} /> : <EmployeeForm {...props} />;
}

export function DailyUpdateSummary({
  userId,
  onOpen,
}: {
  userId: string;
  onOpen: () => void;
}) {
  const [update, setUpdate] = useState<DailyUpdate | null>(null);

  useEffect(
    () => listenToOwnDailyUpdate(userId, setUpdate, () => setUpdate(null)),
    [userId],
  );

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Your daily update</h2>
          <p>
            {update
              ? "Read-only summary of what you submitted for this reporting day."
              : "You haven't submitted an update for this reporting day yet."}
          </p>
        </div>
        <button type="button" className="button button-secondary" onClick={onOpen}>
          {update ? "Edit" : "Write update"}
        </button>
      </div>
      {update && (
        <div className="daily-summary">
          {sections.map(({ key, title }) => (
            <div key={key}>
              <strong>{title}</strong>
              <BulletList items={update[key]} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EmployeeForm({ userId, userEmail, userName, onNotice }: Props) {
  const dailyWindow = useDailyWindow(onNotice);
  const [draft, setDraft] = useState<Record<FieldKey, string[]>>(emptyDraft);
  const [saved, setSaved] = useState<DailyUpdate | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let first = true;
    return listenToOwnDailyUpdate(
      userId,
      (update) => {
        setSaved(update);
        // Only seed the form on first load so live edits are never overwritten.
        if (first) {
          first = false;
          if (update) setDraft(toDraft(update));
          setLoaded(true);
        }
      },
      (error) => onNotice("error", `Could not load your update. ${errorText(error)}`),
    );
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  function setItem(key: FieldKey, index: number, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: current[key].map((item, i) => (i === index ? value : item)),
    }));
  }

  function addItem(key: FieldKey) {
    setDraft((current) =>
      current[key].length >= MAX_ITEMS ? current : { ...current, [key]: [...current[key], ""] },
    );
  }

  function removeItem(key: FieldKey, index: number) {
    setDraft((current) => {
      const next = current[key].filter((_, i) => i !== index);
      return { ...current, [key]: next.length ? next : [""] };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!dailyWindow.open) {
      onNotice("error", "Daily updates closed at 11:30 PM.");
      return;
    }
    const fields: DailyUpdateFields = {
      todaysTasks: cleanItems(draft.todaysTasks),
      suddenTasks: cleanItems(draft.suddenTasks),
      blockers: cleanItems(draft.blockers),
      plans: cleanItems(draft.plans),
    };
    if (!Object.values(fields).some((items) => items.length)) {
      onNotice("error", "Add at least one bullet point before submitting.");
      return;
    }
    setBusy(true);
    try {
      await saveDailyUpdate({ uid: userId, email: userEmail, name: userName }, fields, dailyWindow.date);
      setDraft(toDraft({ ...(saved as DailyUpdate), ...fields }));
      onNotice("success", "Your daily update was saved. You can edit it until 11:30 PM.");
    } catch (error) {
      onNotice("error", `Could not save your update. ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (busy || !saved) return;
    setBusy(true);
    try {
      await deleteDailyUpdate(userId);
      setDraft(emptyDraft());
      onNotice("success", "Your daily update was removed.");
    } catch (error) {
      onNotice("error", `Could not remove your update. ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!dailyWindow.open) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Daily update</h2>
            <p>
              Submissions pause at 11:30 PM while the updates are emailed. The form reopens for the
              next reporting day after the email is sent.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Daily update · {dailyWindow.date}</h2>
          <p>
            Write each item as a bullet point. You can submit and edit until 11:30 PM (Dhaka time).
            The next reporting day opens after the previous update email is sent.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="daily-form">
        {sections.map(({ key, title, placeholder }) => (
          <div className="daily-section" key={key}>
            <h3>{title}</h3>
            {draft[key].map((item, index) => (
              <div className="bullet-row" key={index}>
                <span aria-hidden="true">•</span>
                <input
                  value={item}
                  maxLength={MAX_LENGTH}
                  placeholder={placeholder}
                  aria-label={`${title} bullet ${index + 1}`}
                  disabled={!loaded}
                  onChange={(event) => setItem(key, index, event.target.value)}
                />
                <button
                  type="button"
                  className="button button-ghost"
                  aria-label={`Remove ${title} bullet ${index + 1}`}
                  onClick={() => removeItem(key, index)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button button-secondary"
              disabled={draft[key].length >= MAX_ITEMS}
              onClick={() => addItem(key)}
            >
              <Plus size={16} /> Add bullet
            </button>
          </div>
        ))}
        <div className="form-foot">
          <span>
            {saved?.updatedAt
              ? `Last saved ${saved.updatedAt.toDate().toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}`
              : "Not submitted yet"}
          </span>
          <div className="form-actions">
            {saved && (
              <button type="button" className="button button-danger" disabled={busy} onClick={discard}>
                <Trash2 size={16} /> Remove
              </button>
            )}
            <button className="button button-primary" disabled={busy || !loaded}>
              <Send size={16} /> {saved ? "Update" : "Submit"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function AdminView({ onNotice }: Props) {
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "employee">("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(
    () =>
      listenToAllDailyUpdates(setUpdates, (error) =>
        onNotice("error", `Could not load daily updates. ${errorText(error)}`),
      ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const filteredUpdates = updates.filter((update) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      `${update.employeeName} ${update.employeeEmail} ${update.date}`.toLowerCase().includes(term);
    return matchesSearch && (!dateFilter || update.date === dateFilter);
  });
  const sortedUpdates = sortItems(
    filteredUpdates,
    (update) => sortBy === "date" ? update.date : update.employeeName,
    sortDirection,
  );
  const pagination = usePagination(
    sortedUpdates,
    `${search}:${dateFilter}:${sortBy}:${sortDirection}`,
  );

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Daily updates</h2>
          <p>
            Collected until 11:30 PM, then emailed to info@adnsemicon.com and cleared automatically.
          </p>
        </div>
      </div>
      {updates.length === 0 && <p className="panel-note">No updates submitted yet.</p>}
      {updates.length > 0 && (
        <>
          <div className="repeat-list-toolbar">
            <label className="search-field">
              <Search size={16} />
              <input
                type="search"
                value={search}
                placeholder="Search employee updates"
                aria-label="Search daily updates by employee"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="attendance-date-filter">
              Date
              <input
                type="date"
                aria-label="Filter daily updates by date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              />
            </label>
            <SortControls
              value={sortBy}
              options={[
                { value: "date", label: "Date" },
                { value: "employee", label: "Employee" },
              ]}
              direction={sortDirection}
              onChange={(value) => setSortBy(value as typeof sortBy)}
              onToggleDirection={() =>
                setSortDirection((direction) => direction === "asc" ? "desc" : "asc")
              }
            />
            <span>{filteredUpdates.length} employee updates</span>
          </div>
          {filteredUpdates.length ? (
            <>
              <div className="table-wrap">
                <table className="daily-updates-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Name</th>
                      <th>Email</th>
                      {sections.map(({ title }) => <th key={title}>{title}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.items.map((update) => (
                      <tr key={update.id}>
                        <td>{formatUpdateDate(update.date)}</td>
                        <td>{update.employeeName}</td>
                        <td>{update.employeeEmail}</td>
                        {sections.map(({ key }) => (
                          <td key={key}><BulletList items={update[key]} compact /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...pagination} />
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-icon"><Search size={20} /></span>
              <strong>No matching updates</strong>
              <span>Try a different search.</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
