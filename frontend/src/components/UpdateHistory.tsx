import React, { useState } from 'react';
import { DailyUpdate } from '@shared/types';
import { Calendar, ChevronDown, ChevronUp, Lock, CheckCircle2, Clock } from 'lucide-react';

interface UpdateHistoryProps {
  updates: DailyUpdate[];
  loading: boolean;
  onSelectDate?: (date: string) => void;
}

export const UpdateHistory: React.FC<UpdateHistoryProps> = ({ updates, loading, onSelectDate }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Past Daily Updates</h3>
            <p className="text-xs text-slate-500">Your previous updates and emailed reports</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-500">{updates.length} updates logged</span>
      </div>

      {loading && (
        <div className="py-6 text-center text-xs text-slate-400">Loading history...</div>
      )}

      {!loading && updates.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-medium">No past updates found yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {updates.map(upd => {
          const isExpanded = expandedId === (upd.id || upd.date);
          const totalTasks =
            upd.todaysTasks.length + upd.suddenTasks.length + upd.blockers.length + upd.plansGoingForward.length;

          return (
            <div
              key={upd.id || upd.date}
              className="rounded-xl border border-slate-200 overflow-hidden transition-all bg-white hover:border-slate-300"
            >
              <div
                onClick={() => toggleExpand(upd.id || upd.date)}
                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70"
              >
                <div className="flex items-center gap-3">
                  <div className="font-mono text-xs font-bold text-slate-900">{upd.date}</div>

                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      upd.status === 'locked'
                        ? 'bg-amber-100 text-amber-800'
                        : upd.status === 'submitted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {upd.status === 'locked' ? (
                      <Lock className="w-2.5 h-2.5" />
                    ) : (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                    )}
                    {upd.status.toUpperCase()}
                  </span>

                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    {upd.todaysTasks.length} tasks • {upd.blockers.length} blockers
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button className="text-slate-400 p-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 bg-slate-50/60 border-t border-slate-100 space-y-3 text-xs">
                  <div>
                    <h5 className="font-bold text-blue-900 mb-1">Today's Tasks:</h5>
                    {upd.todaysTasks.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                        {upd.todaysTasks.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="italic text-slate-400">None</span>
                    )}
                  </div>

                  <div>
                    <h5 className="font-bold text-purple-900 mb-1">Sudden Tasks:</h5>
                    {upd.suddenTasks.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                        {upd.suddenTasks.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="italic text-slate-400">None</span>
                    )}
                  </div>

                  <div>
                    <h5 className="font-bold text-rose-900 mb-1">Blockers:</h5>
                    {upd.blockers.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-rose-700 font-medium">
                        {upd.blockers.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="italic text-slate-400">None</span>
                    )}
                  </div>

                  <div>
                    <h5 className="font-bold text-emerald-900 mb-1">Plans Going Forward:</h5>
                    {upd.plansGoingForward.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                        {upd.plansGoingForward.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="italic text-slate-400">None</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
