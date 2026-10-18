import React from 'react';
import { Employee } from '@shared/types';
import { LogOut, Users, Shield, Cpu, Github, ExternalLink } from 'lucide-react';

interface HeaderProps {
  user: Employee | null;
  activeTab: 'update' | 'history' | 'team' | 'admin';
  setActiveTab: (tab: 'update' | 'history' | 'team' | 'admin') => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, activeTab, setActiveTab, onLogout }) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Company branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-adn-600 to-adn-800 flex items-center justify-center text-white shadow-md shadow-adn-600/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight">ADN Semiconductor</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 tracking-wide uppercase">
                  EMS
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Employee Daily Update Portal</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          {user && (
            <nav className="hidden md:flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
              <button
                onClick={() => setActiveTab('update')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'update'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                Today's Update
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'history'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                Past Updates
              </button>
              <button
                onClick={() => setActiveTab('team')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'team'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                Team Summary
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'admin'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  Manage Users
                </button>
              )}
            </nav>
          )}

          {/* User Profile / Logout */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-xs font-bold text-slate-800">{user.name}</span>
                    {user.role !== 'employee' && (
                      <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-1 rounded">
                        {user.role === 'admin' ? 'Admin' : 'Manager'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[11px] text-slate-500">
                    <Github className="w-3 h-3 text-slate-400" />
                    <span>@{user.githubUsername}</span>
                    {user.managerName && (
                      <>
                        <span>•</span>
                        <span className="text-slate-600 font-medium">Manager: {user.managerName}</span>
                      </>
                    )}
                  </div>
                </div>

                <img
                  src={user.avatarUrl || `https://github.com/${user.githubUsername}.png`}
                  alt={user.name}
                  className="w-9 h-9 rounded-full ring-2 ring-slate-200 object-cover shadow-xs"
                />

                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <a
                href="https://github.com/ADN-VLSI/ems"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                <Github className="w-4 h-4" />
                <span className="hidden sm:inline">GitHub Repository</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}
          </div>
        </div>

        {/* Mobile Nav Tabs */}
        {user && (
          <div className="flex md:hidden overflow-x-auto py-2 border-t border-slate-100 space-x-1">
            <button
              onClick={() => setActiveTab('update')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeTab === 'update' ? 'bg-adn-600 text-white' : 'text-slate-600 bg-slate-100'
              }`}
            >
              Today's Update
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeTab === 'history' ? 'bg-adn-600 text-white' : 'text-slate-600 bg-slate-100'
              }`}
            >
              Past Updates
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeTab === 'team' ? 'bg-adn-600 text-white' : 'text-slate-600 bg-slate-100'
              }`}
            >
              Team Summary
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  activeTab === 'admin' ? 'bg-adn-600 text-white' : 'text-slate-600 bg-slate-100'
                }`}
              >
                Manage Users
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
