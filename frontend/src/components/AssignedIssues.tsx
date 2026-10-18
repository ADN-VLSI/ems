import React from 'react';
import { GitHubIssueItem } from '@shared/types';
import {
  ExternalLink,
  Kanban,
  AlertCircle,
  Tag,
  PlusCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

const ASSIGNED_ISSUES_URL =
  'https://github.com/issues/assigned?q=is%3Aissue+state%3Aopen+archived%3Afalse+assignee%3A%40me+sort%3Aupdated-desc+org%3AADN-VLSI';

interface AssignedIssuesProps {
  issues: GitHubIssueItem[];
  loading: boolean;
  error?: string | null;
  notice?: string | null;
  onRefresh: () => void;
  onInsertToTasks?: (text: string) => void;
  onInsertToPlans?: (text: string) => void;
  isLocked?: boolean;
}

export const AssignedIssues: React.FC<AssignedIssuesProps> = ({
  issues,
  loading,
  error,
  notice,
  onRefresh,
  onInsertToTasks,
  onInsertToPlans,
  isLocked,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-900 text-white">
            <Kanban className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Assigned GitHub Issues</h3>
            <p className="text-xs text-slate-500">Open issues assigned to your GitHub account</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <a
            href={ASSIGNED_ISSUES_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-adn-700 hover:bg-adn-50"
          >
            View on GitHub
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh Issues"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notice banner */}
      {notice && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && issues.length === 0 && (
        <div className="space-y-3 py-4">
          <div className="h-16 bg-slate-100 rounded-xl animate-pulse"></div>
          <div className="h-16 bg-slate-100 rounded-xl animate-pulse"></div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !notice && issues.length === 0 && (
        <div className="text-center py-8 text-slate-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-xs font-medium">Open GitHub to browse your assigned issues.</p>
          <a
            href={ASSIGNED_ISSUES_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-adn-700 hover:underline"
          >
            View assigned issues
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Issues list */}
      <div className="space-y-3">
        {issues.map(issue => (
          <div
            key={issue.id}
            className="group rounded-xl border border-slate-200/90 p-3.5 hover:border-slate-300 hover:shadow-xs transition-all bg-slate-50/40"
          >
            {/* Top row: Repo & Issue # + Link */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <a
                  href={issue.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-adn-600 hover:underline truncate max-w-[150px]"
                >
                  {issue.repository}
                </a>
                <span>#</span>
                <span className="font-semibold text-slate-700">{issue.number}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    issue.state === 'OPEN'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {issue.state}
                </span>
              </div>

              <a
                href={issue.url}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-adn-600 transition-colors"
                title="View on GitHub"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Title */}
            <h4 className="text-xs font-semibold text-slate-900 mt-1.5 leading-snug">
              <a
                href={issue.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-adn-600 hover:underline"
              >
                {issue.title}
              </a>
            </h4>

            {/* Labels */}
            {issue.labels && issue.labels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-2">
                {issue.labels.map((lbl, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                    style={{
                      backgroundColor: lbl.color ? `#${lbl.color}20` : '#f1f5f9',
                      color: lbl.color ? `#${lbl.color}` : '#475569',
                      border: `1px solid ${lbl.color ? `#${lbl.color}40` : '#e2e8f0'}`,
                    }}
                  >
                    <Tag className="w-2.5 h-2.5 opacity-70" />
                    {lbl.name}
                  </span>
                ))}
              </div>
            )}

            {/* Connected GitHub Projects */}
            {issue.projects && issue.projects.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Tracking Boards ({issue.projects.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {issue.projects.map((proj, idx) => (
                    <a
                      key={idx}
                      href={proj.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-700 hover:border-adn-400 transition-colors"
                    >
                      <Kanban className="w-3 h-3 text-adn-600" />
                      <span className="font-medium truncate max-w-[120px]">{proj.name}</span>
                      {proj.status && (
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-1 rounded font-semibold">
                          {proj.status}
                        </span>
                      )}
                      <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Quick 1-click insert buttons into update form */}
            {!isLocked && (onInsertToTasks || onInsertToPlans) && (
              <div className="mt-3 pt-2 border-t border-dashed border-slate-200 flex items-center justify-end gap-1.5">
                {onInsertToTasks && (
                  <button
                    type="button"
                    onClick={() =>
                      onInsertToTasks(`[#${issue.number}] ${issue.title} (${issue.repository})`)
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>+ Today's Task</span>
                  </button>
                )}
                {onInsertToPlans && (
                  <button
                    type="button"
                    onClick={() =>
                      onInsertToPlans(`[#${issue.number}] ${issue.title} (${issue.repository})`)
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>+ Plan</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
