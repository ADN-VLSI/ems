import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, MessageSquareText, RotateCcw, Search, Send, Trash2 } from "lucide-react";
import {
  createConcern,
  deleteConcern,
  listenToConcernMessages,
  replyToConcern,
  setConcernStatus,
} from "./data";
import type { Concern, ConcernMessage } from "./types";
import { PaginationControls, usePagination } from "./Pagination";

type Props = {
  isAdmin: boolean;
  userId: string;
  userEmail: string;
  userName: string;
  concerns: Concern[];
  onNotice: (kind: "success" | "error", message: string) => void;
};

function formatDateTime(value?: { toDate: () => Date }): string {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(value.toDate());
}

function errorText(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Please try again.";
}

export function needsAdminReply(concern: Concern): boolean {
  return concern.status === "open" && concern.lastMessageBy === "employee";
}

function ConcernPill({ concern, isAdmin }: { concern: Concern; isAdmin: boolean }) {
  const resolved = concern.status === "resolved";
  const waiting = needsAdminReply(concern);
  const label = resolved
    ? "Resolved"
    : waiting
      ? isAdmin ? "Needs reply" : "Awaiting admin"
      : isAdmin ? "Awaiting employee" : "Admin replied";
  return (
    <span className={`status-pill ${resolved ? "status-approved" : "status-pending"}`}>
      <span className="status-dot" />
      {label}
    </span>
  );
}

export function ConcernsPage({
  isAdmin,
  userId,
  userEmail,
  userName,
  concerns,
  onNotice,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ConcernMessage[]>([]);
  const [reply, setReply] = useState("");
  const threadEnd = useRef<HTMLDivElement>(null);

  const selected = concerns.find((item) => item.id === selectedId) ?? null;
  const visible = concerns.filter((item) => {
    const matchesFilter = filter === "all" || item.status === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      `${item.subject} ${item.employeeName} ${item.employeeEmail} ${item.body}`.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });
  const pagination = usePagination(visible, `${filter}:${search}`);

  useEffect(() => {
    setMessages([]);
    setReply("");
    if (!selectedId) return;
    return listenToConcernMessages(selectedId, setMessages, (error) =>
      onNotice("error", `Could not load replies. ${errorText(error)}`),
    );
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, selectedId]);

  async function submitConcern(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (subject.trim().length < 3 || body.trim().length < 3) {
      onNotice("error", "Please add a subject and a short description.");
      return;
    }
    setBusy(true);
    try {
      await createConcern(
        { uid: userId, email: userEmail, name: userName },
        subject,
        body,
      );
      setSubject("");
      setBody("");
      onNotice("success", "Your concern was sent privately to the administrator.");
    } catch (error) {
      onNotice("error", `Could not send your concern. ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    if (!selected || busy || !reply.trim()) return;
    setBusy(true);
    try {
      await replyToConcern(
        selected.id,
        userId,
        isAdmin ? "admin" : "employee",
        reply,
        // An employee reply reopens a resolved concern; an admin reply keeps its state.
        isAdmin ? selected.status : "open",
      );
      setReply("");
    } catch (error) {
      onNotice("error", `Could not send your reply. ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await setConcernStatus(
        selected.id,
        selected.status === "open" ? "resolved" : "open",
      );
    } catch (error) {
      onNotice("error", `Could not update the concern. ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeConcern() {
    if (!selected || busy) return;
    if (!window.confirm(`Delete "${selected.subject}" and all its replies? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteConcern(selected.id);
      setSelectedId(null);
      onNotice("success", "Concern deleted.");
    } catch (error) {
      onNotice("error", `Could not delete the concern. ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="concerns-layout">
      <div className="concerns-side">
        {!isAdmin && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Raise a concern</h2>
                <p>Only you and the administrator can see this conversation.</p>
              </div>
            </div>
            <form className="form-grid" onSubmit={submitConcern}>
              <label className="field field-full">
                Subject
                <input
                  value={subject}
                  maxLength={120}
                  placeholder="Briefly, what is this about?"
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
              <label className="field field-full">
                Details
                <textarea
                  rows={4}
                  value={body}
                  maxLength={2000}
                  placeholder="Describe your concern"
                  onChange={(event) => setBody(event.target.value)}
                />
              </label>
              <div className="form-foot field-full">
                <button className="button button-primary" type="submit" disabled={busy}>
                  <Send size={16} /> Send to admin
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{isAdmin ? "Employee concerns" : "My concerns"}</h2>
              <p>{concerns.length} total</p>
            </div>
          </div>
          <div className="repeat-list-toolbar">
            <label className="search-field">
              <Search size={16} />
              <input
                type="search"
                value={search}
                placeholder="Search concerns"
                aria-label="Search concerns"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {isAdmin && (
              <select
                className="concern-filter"
                aria-label="Filter concerns"
                value={filter}
                onChange={(event) => setFilter(event.target.value as typeof filter)}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            )}
            <span>{visible.length} of {concerns.length} concerns</span>
          </div>
          {visible.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><MessageSquareText size={20} /></span>
              <strong>{concerns.length ? "No matching concerns" : "No concerns"}</strong>
              <span>
                {concerns.length
                  ? "Try a different search or status."
                  : isAdmin
                    ? "Nothing to review right now."
                    : "Concerns you raise will appear here."}
              </span>
            </div>
          ) : (
            <>
              <ul className="concern-list">
                {pagination.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`concern-item ${item.id === selectedId ? "concern-item-active" : ""}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className="concern-item-main">
                        <strong>{item.subject}</strong>
                        <small>
                          {isAdmin ? `${item.employeeName} · ` : ""}
                          {formatDateTime(item.updatedAt)}
                        </small>
                      </span>
                      <ConcernPill concern={item} isAdmin={isAdmin} />
                    </button>
                  </li>
                ))}
              </ul>
              <PaginationControls {...pagination} />
            </>
          )}
        </section>
      </div>

      <section className="panel concern-thread">
        {!selected ? (
          <div className="empty-state">
            <span className="empty-icon"><MessageSquareText size={20} /></span>
            <strong>Select a concern</strong>
            <span>Choose a concern to read and reply to the conversation.</span>
          </div>
        ) : (
          <>
            <div className="panel-heading">
              <div>
                <h2>{selected.subject}</h2>
                <p>
                  {isAdmin ? `${selected.employeeName} (${selected.employeeEmail})` : "Private with the administrator"}
                </p>
              </div>
              {isAdmin && (
                <div className="concern-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy}
                    onClick={toggleStatus}
                  >
                    {selected.status === "open" ? (
                      <><CheckCircle2 size={16} /> Mark resolved</>
                    ) : (
                      <><RotateCcw size={16} /> Reopen</>
                    )}
                  </button>
                  <button
                    type="button"
                    className="button button-danger"
                    disabled={busy}
                    onClick={removeConcern}
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              )}
            </div>
            <div className="thread-messages">
              <div className={`thread-bubble ${isAdmin ? "bubble-them" : "bubble-me"}`}>
                <p>{selected.body}</p>
                <small>
                  {isAdmin ? selected.employeeName : "You"} · {formatDateTime(selected.createdAt)}
                </small>
              </div>
              {messages.map((message) => {
                const mine = (message.authorRole === "admin") === isAdmin;
                return (
                  <div key={message.id} className={`thread-bubble ${mine ? "bubble-me" : "bubble-them"}`}>
                    <p>{message.text}</p>
                    <small>
                      {mine ? "You" : message.authorRole === "admin" ? "Administrator" : selected.employeeName}
                      {" · "}
                      {formatDateTime(message.createdAt)}
                    </small>
                  </div>
                );
              })}
              <div ref={threadEnd} />
            </div>
            <form className="thread-reply" onSubmit={submitReply}>
              <textarea
                rows={2}
                value={reply}
                maxLength={2000}
                aria-label="Reply"
                placeholder={
                  selected.status === "resolved" && !isAdmin
                    ? "Reply to reopen this concern"
                    : "Write a reply"
                }
                onChange={(event) => setReply(event.target.value)}
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={busy || !reply.trim()}
              >
                <Send size={16} /> Reply
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
