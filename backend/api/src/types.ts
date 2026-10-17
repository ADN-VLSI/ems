export interface Env {
  // Bindings
  DB: D1Database;

  // Variables
  APP_TIMEZONE?: string;
  FRONTEND_URL?: string;
  COMPANY_REPORT_TO?: string;
  COMPANY_REPORT_CC?: string;

  // Secrets
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  JWT_SECRET?: string;
  REPORT_API_KEY?: string;

  // GitHub App Secrets (for assigned issues & GitHub Projects)
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_INSTALLATION_ID?: string;
}

export interface UserSessionPayload {
  userId: string;
  githubId: string;
  githubUsername: string;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'admin';
  exp: number;
}
