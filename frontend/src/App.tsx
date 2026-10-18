import React, { useState, useEffect, useCallback } from 'react';
import { Employee, DeadlineStatus, DailyUpdate, GitHubIssueItem, Team } from '@shared/types';
import { api, getStoredToken, clearStoredToken, extractTokenFromUrl } from './api';
import { Header } from './components/Header';
import { DeadlineBanner } from './components/DeadlineBanner';
import { UpdateForm } from './components/UpdateForm';
import { AssignedIssues } from './components/AssignedIssues';
import { UpdateHistory } from './components/UpdateHistory';
import { TeamOverview } from './components/TeamOverview';
import { LoginView } from './components/LoginView';
import { AdminUserManagement } from './components/AdminUserManagement';

export function App() {
  const [user, setUser] = useState<Employee | null>(null);
  const [deadlineStatus, setDeadlineStatus] = useState<DeadlineStatus | null>(null);
  const [todayUpdate, setTodayUpdate] = useState<DailyUpdate | null>(null);
  const [issues, setIssues] = useState<GitHubIssueItem[]>([]);
  const [issuesNotice, setIssuesNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<DailyUpdate[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [activeTab, setActiveTab] = useState<'update' | 'history' | 'team' | 'admin'>('update');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [issuesLoading, setIssuesLoading] = useState<boolean>(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  // Trigger to insert issue into form
  const [insertTrigger, setInsertTrigger] = useState<{
    section: 'todaysTasks' | 'plansGoingForward';
    text: string;
  } | null>(null);

  // Check login state and initial load
  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Check if token in URL hash
      extractTokenFromUrl();
      const token = getStoredToken();

      // 2. Fetch deadline status
      const deadline = await api.getDeadlineStatus();
      setDeadlineStatus(deadline);

      // 3. Fetch teams
      try {
        const teamsRes = await api.getTeams();
        setTeams(teamsRes.teams || []);
      } catch (error) {
        console.warn('Failed to load teams:', error);
        setTeams([]);
      }

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      // 4. Fetch current user
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);

      // 5. Fetch today's update
      try {
        const updateRes = await api.getTodayUpdate();
        setTodayUpdate(updateRes.update);
        if (updateRes.deadlineStatus) {
          setDeadlineStatus(updateRes.deadlineStatus);
        }
      } catch (e) {
        console.warn('Failed to load today update:', e);
      }

      // 6. Fetch issues
      loadIssues();

      // 7. Fetch history
      try {
        const historyRes = await api.getUpdateHistory();
        setHistory(historyRes.updates || []);
      } catch (e) {
        console.warn('Failed to load history:', e);
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
      // Token might be invalid or expired
      if (err.message.includes('Unauthorized') || err.message.includes('401')) {
        clearStoredToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIssues = async () => {
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const res = await api.getAssignedIssues();
      setIssues(res.issues || []);
      setIssuesNotice(res.notice || null);
    } catch (err: any) {
      setIssuesError(err.message || 'Failed to load GitHub issues');
    } finally {
      setIssuesLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
    setTodayUpdate(null);
    setHistory([]);
    setIssues([]);
  };

  const handleSaveUpdate = async (payload: {
    todaysTasks: string[];
    suddenTasks: string[];
    blockers: string[];
    plansGoingForward: string[];
    submit: boolean;
  }) => {
    setActionLoading(true);
    try {
      const res = await api.saveTodayUpdate({
        date: deadlineStatus?.currentDate || new Date().toISOString().split('T')[0],
        ...payload,
      });

      // Update local state
      setTodayUpdate({
        employeeId: user?.id || '',
        date: deadlineStatus?.currentDate || '',
        todaysTasks: payload.todaysTasks,
        suddenTasks: payload.suddenTasks,
        blockers: payload.blockers,
        plansGoingForward: payload.plansGoingForward,
        status: payload.submit ? 'submitted' : 'draft',
      });

      // Refresh history
      const historyRes = await api.getUpdateHistory().catch(() => ({ updates: [] }));
      setHistory(historyRes.updates || []);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-adn-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Employee Daily Update System...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col font-sans">
      <Header
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {!user ? (
          <LoginView onSuccess={loadUserData} />
        ) : (
          <>
            {/* Deadline banner is prominently visible across views */}
            <DeadlineBanner
              status={deadlineStatus}
              onRefresh={loadUserData}
            />

            {/* Tab: Today's Update & Assigned GitHub Issues */}
            {activeTab === 'update' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Main Form: 8 cols on large screens */}
                <div className="lg:col-span-7 xl:col-span-8">
                  <UpdateForm
                    initialUpdate={todayUpdate}
                    deadlineStatus={deadlineStatus}
                    onSave={handleSaveUpdate}
                    loading={actionLoading}
                    insertedItemTrigger={insertTrigger}
                  />
                </div>

                {/* Assigned GitHub Issues Sidebar: 4 cols on large screens */}
                <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                  <AssignedIssues
                    issues={issues}
                    loading={issuesLoading}
                    error={issuesError}
                    notice={issuesNotice}
                    onRefresh={loadIssues}
                    isLocked={deadlineStatus?.isLocked}
                    onInsertToTasks={text =>
                      setInsertTrigger({ section: 'todaysTasks', text: `${text}` })
                    }
                    onInsertToPlans={text =>
                      setInsertTrigger({ section: 'plansGoingForward', text: `${text}` })
                    }
                  />
                </div>
              </div>
            )}

            {/* Tab: Past Updates History */}
            {activeTab === 'history' && (
              <div className="max-w-4xl mx-auto">
                <UpdateHistory updates={history} loading={false} />
              </div>
            )}

            {/* Tab: Team Summary */}
            {activeTab === 'team' && (
              <div className="max-w-6xl mx-auto">
                <TeamOverview teams={teams} userTeamId={user.teamId} />
              </div>
            )}

            {activeTab === 'admin' && user.role === 'admin' && (
              <AdminUserManagement />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200/80 bg-white py-4 mt-auto text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>ADN Semiconductor</strong> • Employee Daily Update System (EMS)
          </div>
          <div>
            Cutoff: 11:30 PM (Asia/Dhaka) • Dispatched via scheduled GitHub Actions SMTP
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
