export function getCorsHeaders(env: { FRONTEND_URL?: string }, request?: Request): HeadersInit {
  const requestOrigin = request?.headers.get('Origin') || '';
  // Allow configured FRONTEND_URL, localhost, or any github.io domain for GitHub Pages
  let allowOrigin = '*';
  if (requestOrigin) {
    if (
      requestOrigin.endsWith('.github.io') ||
      requestOrigin.startsWith('http://localhost') ||
      requestOrigin.startsWith('http://127.0.0.1') ||
      (env.FRONTEND_URL && requestOrigin.startsWith(env.FRONTEND_URL))
    ) {
      allowOrigin = requestOrigin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

export function jsonResponse(data: any, status = 200, env?: { FRONTEND_URL?: string }, request?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...getCorsHeaders(env || {}, request),
    },
  });
}

export function errorResponse(
  message: string,
  status = 400,
  details?: any,
  env?: { FRONTEND_URL?: string },
  request?: Request
): Response {
  return jsonResponse(
    {
      success: false,
      error: message,
      details,
    },
    status,
    env,
    request
  );
}

/**
 * Validates request payload size against free-tier constraints (128 KB max for update payload)
 */
export function checkPayloadLimit(bodyText: string, maxBytes = 131072): boolean {
  return new TextEncoder().encode(bodyText).length <= maxBytes;
}
