import { Env, UserSessionPayload } from './types';
import { Employee } from '../../../shared/types';

export const ADMIN_GITHUB_USERNAME = 'foez-ahmed';

/**
 * Base64URL encode/decode helpers using standard Web API
 */
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Signs a JWT using HMAC-SHA256 (Web Crypto API)
 */
export async function signJwt(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));

  let binarySig = '';
  const bytes = new Uint8Array(signature);
  for (let i = 0; i < bytes.byteLength; i++) {
    binarySig += String.fromCharCode(bytes[i]);
  }
  const encodedSignature = btoa(binarySig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${data}.${encodedSignature}`;
}

/**
 * Verifies a JWT using HMAC-SHA256 (Web Crypto API)
 */
export async function verifyJwt(token: string, secret: string): Promise<UserSessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode signature
    let base64Sig = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64Sig.length % 4) base64Sig += '=';
    const binarySig = atob(base64Sig);
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!isValid) return null;

    const payload: UserSessionPayload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch (err) {
    console.error('JWT verification error:', err);
    return null;
  }
}

/**
 * Extracts and verifies bearer token from request
 */
export async function authenticateRequest(request: Request, env: Env): Promise<UserSessionPayload | null> {
  const authHeader = request.headers.get('Authorization');
  if (!env.JWT_SECRET || !authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  const session = await verifyJwt(token, env.JWT_SECRET);
  if (!session) return null;

  const employee = await env.DB.prepare('SELECT approval_status FROM employees WHERE id = ?')
    .bind(session.userId)
    .first<{ approval_status: string }>();
  return employee?.approval_status === 'approved' ? session : null;
}

/**
 * Exchanges GitHub OAuth code for access token
 */
export async function exchangeGitHubCode(code: string, env: Env): Promise<string> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not configured on server.');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'EMS-Employee-Update-System',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data: any = await response.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  return data.access_token;
}

/**
 * Fetches user profile and verified email from GitHub API
 */
export async function fetchGitHubUser(accessToken: string): Promise<{
  id: string;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}> {
  // Fetch basic profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'EMS-Employee-Update-System',
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!userRes.ok) {
    throw new Error(`Failed to fetch GitHub profile: ${userRes.statusText}`);
  }

  const userData: any = await userRes.json();

  let email = userData.email;
  // If email is private/null in primary profile, fetch verified primary email
  if (!email) {
    try {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'EMS-Employee-Update-System',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (emailRes.ok) {
        const emails: any[] = await emailRes.json();
        const primary = emails.find(e => e.primary && e.verified) || emails.find(e => e.verified) || emails[0];
        if (primary) {
          email = primary.email;
        }
      }
    } catch {
      // fallback
    }
  }

  if (!email) {
    email = `${userData.login}@users.noreply.github.com`;
  }

  return {
    id: String(userData.id),
    login: userData.login,
    name: userData.name || userData.login,
    email,
    avatar_url: userData.avatar_url,
  };
}

/**
 * Finds or creates employee in Cloudflare D1
 */
export async function upsertEmployee(db: D1Database, githubUser: {
  id: string;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}): Promise<Employee> {
  // Query existing employee
  const existing = await db
    .prepare('SELECT e.*, t.manager_name as manager_name FROM employees e LEFT JOIN teams t ON e.team_id = t.id WHERE e.github_id = ?')
    .bind(githubUser.id)
    .first<any>();

  const now = new Date().toISOString();
  const normalizedLogin = githubUser.login.toLowerCase();
  const role: Employee['role'] =
    normalizedLogin === ADMIN_GITHUB_USERNAME
      ? 'admin'
      : existing?.role === 'manager' ||
          ['mohiuddin.reyad@adnsemicon.com', 'farhan.efty@adnsemicon.com'].includes(
            githubUser.email.toLowerCase()
          )
        ? 'manager'
        : 'employee';
  const approvalStatus: Employee['approvalStatus'] =
    normalizedLogin === ADMIN_GITHUB_USERNAME ? 'approved' : existing?.approval_status || 'pending';

  if (existing) {
    // Update existing profile details
    await db
      .prepare(
        'UPDATE employees SET github_username = ?, name = ?, email = ?, role = ?, approval_status = ?, avatar_url = ?, updated_at = ? WHERE id = ?'
      )
      .bind(githubUser.login, githubUser.name, githubUser.email, role, approvalStatus, githubUser.avatar_url, now, existing.id)
      .run();

    return {
      id: existing.id,
      githubId: existing.github_id,
      githubUsername: githubUser.login,
      name: githubUser.name,
      email: githubUser.email,
      officialEmail: existing.official_email || null,
      avatarUrl: githubUser.avatar_url,
      teamId: existing.team_id,
      managerName: existing.manager_name,
      role,
      approvalStatus,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  // Create new employee
  const employeeId = 'emp-' + crypto.randomUUID();
  const teamId = null;
  const managerName = null;

  await db
    .prepare(
      `INSERT INTO employees (id, github_id, github_username, name, email, avatar_url, team_id, role, approval_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      employeeId,
      githubUser.id,
      githubUser.login,
      githubUser.name,
      githubUser.email,
      githubUser.avatar_url,
      teamId,
      role,
      approvalStatus,
      now,
      now
    )
    .run();

  return {
    id: employeeId,
    githubId: githubUser.id,
    githubUsername: githubUser.login,
    name: githubUser.name,
    email: githubUser.email,
    officialEmail: null,
    avatarUrl: githubUser.avatar_url,
    teamId,
    managerName,
    role,
    approvalStatus,
    createdAt: now,
    updatedAt: now,
  };
}
