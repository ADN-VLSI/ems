import { DeadlineStatus, Employee, GitHubIssueItem, DailyUpdate, Team } from '@shared/types';
import { getDeadlineStatus } from '@shared/validation';

const TOKEN_KEY = 'ems_auth_token';

// Determine API Base URL
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:8787' : '/api');

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Extract token from URL hash on redirect
export function extractTokenFromUrl(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;

  const match = hash.match(/token=([^&]+)/);
  if (match) {
    const token = decodeURIComponent(match[1]);
    setStoredToken(token);
    // Clean hash from URL without page reload
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return token;
  }
  return null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.error || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  } catch (err: any) {
    // If backend is not running or unreachable, give clear actionable notice
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error(
        `Unable to reach backend at ${API_BASE_URL}. Ensure Cloudflare Worker is running (npm run dev:worker).`
      );
    }
    throw err;
  }
}

export const api = {
  async getDeadlineStatus(): Promise<DeadlineStatus> {
    try {
      return await request<DeadlineStatus>('/api/deadline-status');
    } catch {
      // Client-side fallback computation if offline
      return getDeadlineStatus(new Date(), 'Asia/Dhaka');
    }
  },

  async getGitHubAuthUrl(): Promise<{ url: string }> {
    return request<{ url: string }>('/api/auth/github/url');
  },

  async devLogin(username: string, name: string, email: string): Promise<{ token: string; employee: Employee }> {
    const data = await request<{ token: string; employee: Employee }>('/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ username, name, email }),
    });
    setStoredToken(data.token);
    return data;
  },

  async getCurrentUser(): Promise<Employee> {
    return request<Employee>('/api/auth/me');
  },

  async getAssignedIssues(): Promise<{ issues: GitHubIssueItem[]; rateLimitRemaining?: number; notice?: string }> {
    return request<{ issues: GitHubIssueItem[]; rateLimitRemaining?: number; notice?: string }>('/api/github/issues');
  },

  async getTodayUpdate(date?: string): Promise<{ exists: boolean; date: string; deadlineStatus: DeadlineStatus; update: DailyUpdate | null }> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<{ exists: boolean; date: string; deadlineStatus: DeadlineStatus; update: DailyUpdate | null }>(`/api/updates/today${query}`);
  },

  async saveTodayUpdate(payload: {
    date: string;
    todaysTasks: string[];
    suddenTasks: string[];
    blockers: string[];
    plansGoingForward: string[];
  }): Promise<{ success: boolean; message: string; updateId: string; status: string; deadlineStatus: DeadlineStatus }> {
    return request('/api/updates/today', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getUpdateHistory(limit = 15): Promise<{ updates: DailyUpdate[] }> {
    return request<{ updates: DailyUpdate[] }>(`/api/updates/history?limit=${limit}`);
  },

  async getTeams(): Promise<{ teams: Team[] }> {
    return request<{ teams: Team[] }>('/api/teams');
  },

  async updateEmployeeTeam(teamId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/employees/team', {
      method: 'PUT',
      body: JSON.stringify({ teamId }),
    });
  },
  async getAdminEmployees(): Promise<{ employees: Employee[] }> {
    return request<{ employees: Employee[] }>('/api/admin/employees');
  },

  async approveAdminEmployee(employeeId: string): Promise<{ success: boolean; approvalStatus: 'approved' }> {
    return request<{ success: boolean; approvalStatus: 'approved' }>(
      `/api/admin/employees/${encodeURIComponent(employeeId)}/approve`,
      { method: 'POST' }
    );
  },

  async updateAdminEmployee(
    employee: Pick<Employee, 'id' | 'name' | 'officialEmail' | 'managerGithubUsername' | 'role'>
  ): Promise<{ success: boolean; employee: Employee }> {
    return request<{ success: boolean; employee: Employee }>(
      `/api/admin/employees/${encodeURIComponent(employee.id)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          name: employee.name,
          officialEmail: employee.officialEmail || null,
          managerGithubUsername: employee.managerGithubUsername || null,
          role: employee.role,
        }),
      }
    );
  },
};
