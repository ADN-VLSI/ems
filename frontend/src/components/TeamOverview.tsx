import React, { useMemo, useState } from 'react';
import { Team, TeamMemberUpdate } from '@shared/types';
import { Users } from 'lucide-react';

interface TeamOverviewProps {
  team: Team | null;
  date: string;
  members: TeamMemberUpdate[];
  error: string | null;
}

export const TeamOverview: React.FC<TeamOverviewProps> = ({ team, date, members, error }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'updated' | 'missing' | 'draft' | 'submitted' | 'locked'
  >('all');
  const [sortBy, setSortBy] = useState<'employeeName' | 'githubUsername' | 'status'>('employeeName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members
      .filter(member => {
        const matchesSearch =
          !query ||
          [
            member.employeeName,
            member.githubUsername,
            ...member.todaysTasks,
            ...member.suddenTasks,
            ...member.blockers,
            ...member.plansGoingForward,
          ].some(value => value.toLowerCase().includes(query));
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'updated' && member.status !== null) ||
          (statusFilter === 'missing' && member.status === null) ||
          member.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((left, right) => {
        const leftValue = sortBy === 'status' ? left.status || 'No update' : left[sortBy];
        const rightValue = sortBy === 'status' ? right.status || 'No update' : right[sortBy];
        const comparison = leftValue.localeCompare(rightValue, undefined, { sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [members, search, statusFilter, sortBy, sortDirection]);

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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
              Search team updates
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Employee or update text"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
              Update status
              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-800"
              >
                <option value="all">All statuses</option>
                <option value="updated">Has update</option>
                <option value="missing">No update</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="locked">Locked</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
              Sort by
              <select
                value={sortBy}
                onChange={event => setSortBy(event.target.value as typeof sortBy)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-800"
              >
                <option value="employeeName">Employee name</option>
                <option value="githubUsername">GitHub username</option>
                <option value="status">Update status</option>
              </select>
            </label>
            <div className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
              Sort order
              <button
                type="button"
                onClick={() => setSortDirection(current => current === 'asc' ? 'desc' : 'asc')}
                aria-label="Toggle sort order"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left text-xs font-normal text-slate-800 hover:bg-slate-100"
              >
                {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              </button>
            </div>
          </div>
          <p aria-live="polite" className="text-[11px] text-slate-500">
            Showing {filteredMembers.length} of {members.length} team members
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[920px] text-left text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-100/90 text-slate-900 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 border-r border-slate-200">Employee</th>
                  <th className="py-3 px-3.5 border-r border-slate-200">Update Status</th>
                  <th className="py-3 px-3.5 border-r border-slate-200">Today's Tasks</th>
                  <th className="py-3 px-3.5 border-r border-slate-200">Sudden Tasks</th>
                  <th className="py-3 px-3.5 border-r border-slate-200">Blockers</th>
                  <th className="py-3 px-3.5">Plans Going Forward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3.5 py-8 text-center text-slate-500">
                      No team members match these filters.
                    </td>
                  </tr>
                ) : filteredMembers.map(member => (
                  <tr key={member.employeeId} className="align-top">
                    <td className="py-3 px-3.5 border-r border-slate-200 font-semibold text-slate-900 whitespace-nowrap">
                      <div>{member.employeeName}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        @{member.githubUsername}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 border-r border-slate-200">
                      {member.status === null ? 'No update' : member.status}
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
        </div>
      )}
    </section>
  );
};
