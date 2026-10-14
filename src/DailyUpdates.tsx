import { useEffect, useState, type FormEvent } from "react";
import { Plus, Send, Trash2, X } from "lucide-react";
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

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <p className="panel-note">None</p>;
  return (
    <ul className="bullet-view">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
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
      onNotice("error", "Daily updates closed at 9:00 PM.");
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
      onNotice("success", "Your daily update was saved. You can edit it until 9:00 PM.");
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
              Submissions pause at 9:00 PM while the updates are emailed. The form reopens for the
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
            Write each item as a bullet point. You can submit and edit until 9:00 PM (Dhaka time).
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

  useEffect(
    () =>
      listenToAllDailyUpdates(setUpdates, (error) =>
        onNotice("error", `Could not load daily updates. ${errorText(error)}`),
      ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Daily updates</h2>
          <p>
            Collected until 9:00 PM, then emailed to info@adnsemicon.com and cleared automatically.
          </p>
        </div>
      </div>
      {updates.length === 0 && <p className="panel-note">No updates submitted yet.</p>}
      {updates.map((update) => (
        <article className="daily-section" key={update.id}>
          <h3>
            {update.employeeName} <small>{update.employeeEmail}</small>
          </h3>
          {sections.map(({ key, title }) => (
            <div key={key}>
              <strong>{title}</strong>
              <BulletList items={update[key]} />
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
