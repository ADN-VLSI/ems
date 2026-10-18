import React, { useCallback, useEffect, useState } from 'react';
import { Employee } from '@shared/types';
import { api } from '../api';
import { AlertCircle, Check, Loader2, Shield, Users } from 'lucide-react';

export const AdminUserManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getAdminEmployees();
      setEmployees(result.employees);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const updateEmployee = (id: string, changes: Partial<Employee>) => {
    setEmployees(current =>
      current.map(employee => (employee.id === id ? { ...employee, ...changes } : employee))
    );
    setNotice(null);
  };

  const saveEmployee = async (employee: Employee) => {
    setSavingId(employee.id);
    setError(null);
    setNotice(null);
    try {
      const result = await api.updateAdminEmployee(employee);
      setEmployees(current =>
        current.map(item => (item.id === employee.id ? result.employee : item))
      );
      setNotice(`Saved ${result.employee.name}'s profile.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee profile.');
    } finally {
      setSavingId(null);
    }
  };

  const approveEmployee = async (employee: Employee) => {
    setSavingId(employee.id);
    setError(null);
    setNotice(null);
    try {
      await api.approveAdminEmployee(employee.id);
      setEmployees(current =>
        current.map(item =>
          item.id === employee.id ? { ...item, approvalStatus: 'approved' } : item
        )
      );
      setNotice(`Approved ${employee.name}'s account.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve employee account.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-adn-50 text-adn-700">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Manage User Profiles</h2>
          <p className="text-xs text-slate-500">Approve new accounts and set official email, reporting manager, display name, and role.</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mx-5 mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {notice}
        </div>
      )}

      {loading ? (
        <div className="p-8 flex justify-center items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading profiles...
        </div>
      ) : employees.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No employee profiles found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Personal email (fallback)</th>
                <th className="px-4 py-3 font-semibold">Official email</th>
                <th className="px-4 py-3 font-semibold">Manager</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Access</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map(employee => {
                const isAdmin = employee.role === 'admin';
                return (
                  <tr key={employee.id} className="align-top">
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Name for ${employee.githubUsername}`}
                        value={employee.name}
                        onChange={event => updateEmployee(employee.id, { name: event.target.value })}
                        className="w-40 rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-adn-500 focus:outline-none"
                      />
                      <div className="mt-1 text-[11px] text-slate-500">@{employee.githubUsername}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{employee.email}</td>
                    <td className="px-4 py-3">
                      <input
                        type="email"
                        aria-label={`Official email for ${employee.githubUsername}`}
                        placeholder="Uses personal email if blank"
                        value={employee.officialEmail || ''}
                        onChange={event =>
                          updateEmployee(employee.id, { officialEmail: event.target.value || null })
                        }
                        className="w-56 rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-adn-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Manager for ${employee.githubUsername}`}
                        value={employee.managerGithubUsername || ''}
                        onChange={event =>
                          updateEmployee(employee.id, {
                            managerGithubUsername: event.target.value || null,
                          })
                        }
                        className="w-40 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-adn-500 focus:outline-none"
                      >
                        <option value="">No manager</option>
                        {employees.filter(manager => manager.role === 'manager' && manager.id !== employee.id).map(manager => (
                          <option key={manager.id} value={manager.githubUsername}>
                            {manager.name} (@{manager.githubUsername})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isAdmin && <Shield className="w-3.5 h-3.5 text-amber-600" />}
                        <select
                          aria-label={`Role for ${employee.githubUsername}`}
                          value={employee.role}
                          disabled={isAdmin}
                          onChange={event =>
                            updateEmployee(employee.id, {
                              role: event.target.value as Employee['role'],
                            })
                          }
                          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value="employee">Employee</option>
                          <option value="manager">Manager</option>
                          {isAdmin && <option value="admin">Admin</option>}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 font-semibold ${
                        employee.approvalStatus === 'pending'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {employee.approvalStatus === 'pending' ? 'Pending' : 'Approved'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-2">
                        <button
                          type="button"
                          disabled={savingId !== null}
                          onClick={() => saveEmployee(employee)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-adn-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-adn-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingId === employee.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Save
                        </button>
                        {employee.approvalStatus === 'pending' && (
                          <button
                            type="button"
                            disabled={savingId !== null}
                            onClick={() => approveEmployee(employee)}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-5 py-3 border-t border-slate-100 text-[11px] text-slate-500">
        Selecting a manager automatically creates or assigns that manager's team. Daily team reports go to the manager's official email when set, otherwise to the personal email.
      </div>
    </section>
  );
};
