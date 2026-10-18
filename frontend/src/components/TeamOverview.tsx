import React, { useState } from 'react';
import { DailyUpdate, Team } from '@shared/types';
import { Users, Filter, Download, ExternalLink, ShieldCheck } from 'lucide-react';

interface TeamOverviewProps {
  teams: Team[];
  userTeamId?: string | null;
}

export const TeamOverview: React.FC<TeamOverviewProps> = ({ teams, userTeamId }) => {
  const [selectedTeam, setSelectedTeam] = useState<string>(userTeamId || 'all');

  // Sample/preview updates for the table view
  const sampleUpdates = [
    {
      name: 'Mohiuddin Reyad',
      githubUsername: 'reyad07',
      managerGithubUsername: 'reyad07',
      todaysTasks: [
        'Verified floorplan power density margins for 12nm test chip',
        'Reviewed timing constraints pull request #102',
      ],
      suddenTasks: ['Emergency DRC run for foundry DRC deck rev 1.4 update'],
      blockers: [],
      plansGoingForward: ['Run full tape-out sign-off check list with design team'],
    },
    {
      name: 'Farhan Efty',
      githubUsername: 'farhan-efty',
      managerGithubUsername: 'farhan-efty',
      todaysTasks: [
        'Finished RTL synthesis for arithmetic logic unit',
        'Closed 14 critical timing path violations in sub-block A',
      ],
      suddenTasks: ['Assisted junior engineer on clock tree synthesis skew debug'],
      blockers: ['Waiting on updated IO pad timing library from foundry partner'],
      plansGoingForward: ['Complete placement optimization and review IR drop analysis'],
    },
    {
      name: 'Foez Ahmed',
      githubUsername: 'foez-ahmed',
      managerGithubUsername: 'foez-ahmed',
      todaysTasks: [
        'Built automated daily update reporting pipeline with 11:30 PM cutoff',
        'Implemented GitHub App integration for Project tracking boards',
      ],
      suddenTasks: ['Resolved CORS preflight issue with Cloudflare Worker routing'],
      blockers: [],
      plansGoingForward: ['Monitor tonight\'s 11:35 PM scheduled GitHub Actions SMTP dispatch'],
    },
  ];

  const filteredUpdates =
    selectedTeam === 'all'
      ? sampleUpdates
      : sampleUpdates.filter(u => {
          const t = teams.find(team => team.id === selectedTeam);
          return t ? u.managerGithubUsername === t.managerGithubUsername : true;
        });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Team Updates Summary</h3>
            <p className="text-xs text-slate-500">Tabular combined report format</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedTeam}
            onChange={e => setSelectedTeam(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 outline-none focus:border-adn-500"
          >
            <option value="all">All Teams (Company-wide)</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>
                {t.managerName || t.managerGithubUsername || 'Manager'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Required Table View */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs text-slate-700 border-collapse">
          <thead>
            <tr className="bg-slate-100/90 text-slate-900 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <th className="py-3 px-3.5 border-r border-slate-200">Name</th>
              <th className="py-3 px-3.5 border-r border-slate-200">GitHub ID</th>
              <th className="py-3 px-3.5 border-r border-slate-200">Today's Tasks</th>
              <th className="py-3 px-3.5 border-r border-slate-200">Sudden Tasks</th>
              <th className="py-3 px-3.5 border-r border-slate-200">Blockers</th>
              <th className="py-3 px-3.5">Plans Going Forward</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredUpdates.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/60 align-top transition-colors">
                <td className="py-3 px-3.5 border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap">
                  <div>{item.name}</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    Reports to @{item.managerGithubUsername}
                  </div>
                </td>
                <td className="py-3 px-3.5 border-r border-slate-200 font-mono text-[11px] whitespace-nowrap">
                  <a
                    href={`https://github.com/${item.githubUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-adn-600 hover:underline inline-flex items-center gap-1"
                  >
                    @{item.githubUsername}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                </td>
                <td className="py-3 px-3.5 border-r border-slate-200">
                  <ul className="list-disc pl-3.5 space-y-1">
                    {item.todaysTasks.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </td>
                <td className="py-3 px-3.5 border-r border-slate-200">
                  {item.suddenTasks.length > 0 ? (
                    <ul className="list-disc pl-3.5 space-y-1">
                      {item.suddenTasks.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-400 italic">None</span>
                  )}
                </td>
                <td className="py-3 px-3.5 border-r border-slate-200">
                  {item.blockers.length > 0 ? (
                    <ul className="list-disc pl-3.5 space-y-1 text-rose-700 font-medium">
                      {item.blockers.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-400 italic">None</span>
                  )}
                </td>
                <td className="py-3 px-3.5">
                  <ul className="list-disc pl-3.5 space-y-1">
                    {item.plansGoingForward.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>
            Combined tabular report generated automatically at 11:35 PM and dispatched to team managers and leadership (foez.ahmed@adnsemicon.com, CC: mohiuddin.reyad, farhan.efty).
          </span>
        </div>
      </div>
    </div>
  );
};
