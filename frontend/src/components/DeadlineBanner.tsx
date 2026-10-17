import React, { useState, useEffect } from 'react';
import { DeadlineStatus } from '@shared/types';
import { Clock, Lock, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';

interface DeadlineBannerProps {
  status: DeadlineStatus | null;
  onRefresh?: () => void;
}

export const DeadlineBanner: React.FC<DeadlineBannerProps> = ({ status, onRefresh }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(status?.remainingSeconds ?? 0);

  useEffect(() => {
    if (!status) return;
    setSecondsLeft(status.remainingSeconds);

    if (status.isLocked || status.remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onRefresh?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, onRefresh]);

  if (!status) {
    return (
      <div className="bg-slate-100 rounded-xl p-4 animate-pulse flex items-center justify-between">
        <div className="h-6 w-48 bg-slate-200 rounded"></div>
        <div className="h-6 w-32 bg-slate-200 rounded"></div>
      </div>
    );
  }

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const formattedCountdown = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  // Format date display (e.g. Saturday, October 18, 2026)
  const dateFormatted = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
  }).format(new Date(`${status.currentDate}T00:00:00`));

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all ${
        status.isLocked
          ? 'bg-gradient-to-r from-amber-50 via-rose-50 to-orange-50 border-amber-200'
          : secondsLeft < 3600
          ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'
          : 'bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 border-blue-200'
      }`}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Date & Status */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Today's Work Submission • {dateFormatted}</span>
          </div>

          <div className="flex items-center gap-3">
            {status.isLocked ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                <Lock className="w-3.5 h-3.5" />
                LOCKED (11:30 PM CUTOFF REACHED)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                SUBMISSIONS OPEN
              </span>
            )}

            <span className="text-sm font-medium text-slate-700">
              Deadline: <strong className="text-slate-900">{status.deadlineDisplay}</strong>
            </span>
          </div>
        </div>

        {/* Right: Countdown or Next Submission Date */}
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-slate-200/60 shadow-xs">
          {status.isLocked ? (
            <div className="text-right">
              <div className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                <Lock className="w-3 h-3 text-amber-600" />
                <span>Next Submission Opens:</span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {status.nextSubmissionDate} ({status.nextSubmissionDeadlineDisplay})
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100/70 text-blue-700">
                <Clock className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Time remaining:</div>
                <div className={`text-xl font-extrabold tracking-tight font-mono ${secondsLeft < 1800 ? 'text-amber-600 animate-pulse' : 'text-blue-900'}`}>
                  {formattedCountdown}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {status.isLocked && (
        <div className="mt-3 pt-3 border-t border-amber-200/60 flex items-center gap-2 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>
            Daily updates for {status.currentDate} are now locked for scheduled report generation and email dispatch. Any updates submitted after emails are sent will count towards {status.nextSubmissionDate}.
          </span>
        </div>
      )}
    </div>
  );
};
