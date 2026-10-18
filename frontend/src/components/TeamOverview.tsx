import React from 'react';
import { Team, TeamMemberUpdate } from '@shared/types';
import { Users } from 'lucide-react';

interface TeamOverviewProps {
  team: Team | null;
  date: string;
  members: TeamMemberUpdate[];
  error: string | null;
}

export const TeamOverview: React.FC<TeamOverviewProps> = ({ team, date, members, error }) => {
  const renderItems = (items: string[], emptyLabel = 'None') =>
    items.length > 0 ? (
      <ul className="list-disc pl-3.5 space-y-1">
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    ) : (
      <span className="text-slate-400 italic">{emptyLabel}</span>
    );

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">My Team's Updates</h2>
          <p className="text-xs text-slate-500">
            {team?.managerName || 'Team'} · {date}
          </p>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : !team ? (
        <p className="py-5 text-center text-sm text-slate-500">
          No team is assigned to your manager account.
        </p>
      ) : members.length === 0 ? (
        <p className="py-5 text-center text-sm text-slate-500">
          No approved employees are assigned to your team.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[850px] text-left text-xs text-slate-700">
            <thead>
              <tr className="bg-slate-100/90 text-slate-900 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 border-r border-slate-200">Employee</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Today's Tasks</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Sudden Tasks</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Blockers</th>
                <th className="py-3 px-3.5">Plans Going Forward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {members.map(member => (
                <tr key={member.employeeId} className="align-top">
                  <td className="py-3 px-3.5 border-r border-slate-200 font-semibold text-slate-900 whitespace-nowrap">
                    <div>{member.employeeName}</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      @{member.githubUsername}
                    </div>
                  </td>
                  {member.status === null ? (
                    <td colSpan={4} className="py-3 px-3.5 text-slate-500 italic">
                      No update saved for this date.
                    </td>
                  ) : (
                    <>
                      <td className="py-3 px-3.5 border-r border-slate-200">{renderItems(member.todaysTasks)}</td>
                      <td className="py-3 px-3.5 border-r border-slate-200">{renderItems(member.suddenTasks)}</td>
                      <td className="py-3 px-3.5 border-r border-slate-200 text-rose-700">{renderItems(member.blockers)}</td>
                      <td className="py-3 px-3.5">{renderItems(member.plansGoingForward)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
