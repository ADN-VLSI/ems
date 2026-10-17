import { Env } from './types';
import { GitHubIssueItem, GitHubProjectLink } from '../../../shared/types';

/**
 * Base64URL helper
 */
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts a PKCS#1 RSA private key to PKCS#8 if necessary
 */
function pemToPkcs8ArrayBuffer(pem: string): ArrayBuffer {
  const cleanPem = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const der = base64ToArrayBuffer(cleanPem);

  // If already PKCS#8, it usually starts with sequence containing algorithm identifier OID 1.2.840.113549.1.1.1
  if (pem.includes('BEGIN PRIVATE KEY')) {
    return der;
  }

  // Wrap PKCS#1 DER into PKCS#8
  // PKCS#8 Header for RSA: 30 82 <len> 02 01 00 30 0d 06 09 2a 86 48 86 f7 0d 01 01 01 05 00 04 82 <len> [PKCS#1]
  const pkcs1Bytes = new Uint8Array(der);
  const totalLen = pkcs1Bytes.length + 22;
  const pkcs8 = new Uint8Array(totalLen + 4);

  let offset = 0;
  pkcs8[offset++] = 0x30; // SEQUENCE
  pkcs8[offset++] = 0x82;
  pkcs8[offset++] = (totalLen >> 8) & 0xff;
  pkcs8[offset++] = totalLen & 0xff;

  // Version: 0
  pkcs8[offset++] = 0x02;
  pkcs8[offset++] = 0x01;
  pkcs8[offset++] = 0x00;

  // AlgorithmIdentifier: rsaEncryption (1.2.840.113549.1.1.1)
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  pkcs8.set(algId, offset);
  offset += algId.length;

  // OCTET STRING containing the PKCS#1 key
  pkcs8[offset++] = 0x04;
  pkcs8[offset++] = 0x82;
  pkcs8[offset++] = (pkcs1Bytes.length >> 8) & 0xff;
  pkcs8[offset++] = pkcs1Bytes.length & 0xff;

  pkcs8.set(pkcs1Bytes, offset);

  return pkcs8.buffer;
}

/**
 * Creates RS256 JWT for GitHub App authentication
 */
async function createGitHubAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 60, // 60 seconds clock skew tolerance
    exp: now + 600, // 10 minutes expiry (GitHub max)
    iss: appId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const keyBuffer = pemToPkcs8ArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(data));

  let binarySig = '';
  const bytes = new Uint8Array(signature);
  for (let i = 0; i < bytes.byteLength; i++) {
    binarySig += String.fromCharCode(bytes[i]);
  }
  const encodedSignature = btoa(binarySig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${data}.${encodedSignature}`;
}

/**
 * Fetches an installation access token using the GitHub App private key
 */
async function getInstallationAccessToken(env: Env): Promise<string> {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY || !env.GITHUB_APP_INSTALLATION_ID) {
    throw new Error('GitHub App credentials (APP_ID, PRIVATE_KEY, INSTALLATION_ID) are not configured.');
  }

  const jwt = await createGitHubAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);

  const response = await fetch(
    `https://api.github.com/app/installations/${env.GITHUB_APP_INSTALLATION_ID}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'EMS-Employee-Update-System',
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to obtain GitHub App installation token (${response.status}): ${errorBody}`);
  }

  const data: any = await response.json();
  return data.token;
}

/**
 * Retrieves GitHub issues assigned to the given employee's GitHub username,
 * along with linked GitHub Projects v2 boards and current project statuses.
 */
export async function fetchAssignedIssues(
  githubUsername: string,
  env: Env
): Promise<{ issues: GitHubIssueItem[]; rateLimitRemaining?: number; notice?: string }> {
  // If GitHub App credentials are not provided in environment, provide clean informative fallback
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY || !env.GITHUB_APP_INSTALLATION_ID) {
    return {
      issues: [
        {
          id: 'demo-issue-1',
          number: 101,
          title: 'Implement daily update submission deadline cutoff check',
          url: 'https://github.com/ADN-VLSI/ems/issues/101',
          state: 'OPEN',
          repository: 'ADN-VLSI/ems',
          repositoryUrl: 'https://github.com/ADN-VLSI/ems',
          labels: [{ name: 'backend', color: '1d76db' }, { name: 'deadline', color: 'd93f0b' }],
          projects: [
            {
              name: 'EMS Sprint Board',
              url: 'https://github.com/orgs/ADN-VLSI/projects/1',
              status: 'In Progress',
            },
          ],
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'demo-issue-2',
          number: 104,
          title: 'Design tabular daily report layout with team grouping',
          url: 'https://github.com/ADN-VLSI/ems/issues/104',
          state: 'OPEN',
          repository: 'ADN-VLSI/ems',
          repositoryUrl: 'https://github.com/ADN-VLSI/ems',
          labels: [{ name: 'reports', color: '0e8a16' }],
          projects: [
            {
              name: 'EMS Sprint Board',
              url: 'https://github.com/orgs/ADN-VLSI/projects/1',
              status: 'Review',
            },
            {
              name: 'Q4 Core Deliverables',
              url: 'https://github.com/orgs/ADN-VLSI/projects/2',
              status: 'Active',
            },
          ],
          updatedAt: new Date().toISOString(),
        },
      ],
      notice: 'Demo mode active: Configure GitHub App credentials in Cloudflare Worker secrets to load live issues.',
    };
  }

  const token = await getInstallationAccessToken(env);

  const query = `
    query GetAssignedIssues($searchQuery: String!) {
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
      search(query: $searchQuery, type: ISSUE, first: 25) {
        issueCount
        nodes {
          ... on Issue {
            id
            number
            title
            url
            state
            updatedAt
            repository {
              nameWithOwner
              url
            }
            labels(first: 10) {
              nodes {
                name
                color
              }
            }
            projectItems(first: 10) {
              nodes {
                project {
                  ... on ProjectV2 {
                    id
                    title
                    url
                  }
                }
                fieldValueByName(name: "Status") {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  // Search open issues assigned to user
  const searchQuery = `assignee:${githubUsername} is:open is:issue`;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'EMS-Employee-Update-System',
    },
    body: JSON.stringify({
      query,
      variables: { searchQuery },
    }),
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error('GitHub API rate limit reached. Please try again later.');
    }
    throw new Error(`GitHub GraphQL API error (${response.status}): ${response.statusText}`);
  }

  const result: any = await response.json();
  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors.map((e: any) => e.message).join(', '));
  }

  const rawIssues = result.data?.search?.nodes || [];
  const rateLimitRemaining = result.data?.rateLimit?.remaining;

  const issues: GitHubIssueItem[] = rawIssues.map((node: any) => {
    const projects: GitHubProjectLink[] = [];
    if (node.projectItems?.nodes) {
      for (const item of node.projectItems.nodes) {
        if (item.project) {
          projects.push({
            id: item.project.id,
            name: item.project.title,
            url: item.project.url,
            status: item.fieldValueByName?.name || 'Assigned',
          });
        }
      }
    }

    return {
      id: node.id,
      number: node.number,
      title: node.title,
      url: node.url,
      state: node.state,
      repository: node.repository?.nameWithOwner || '',
      repositoryUrl: node.repository?.url || '',
      labels: (node.labels?.nodes || []).map((l: any) => ({ name: l.name, color: l.color })),
      projects,
      updatedAt: node.updatedAt,
    };
  });

  return {
    issues,
    rateLimitRemaining,
  };
}
