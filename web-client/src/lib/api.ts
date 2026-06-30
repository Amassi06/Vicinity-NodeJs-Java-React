export type AuthUser = {
  sub: string;
  email: string;
  role: string;
};

let accessToken = sessionStorage.getItem('vicinity_access') ?? '';

export function getAccessToken(): string {
  return accessToken;
}

export function setTokens(access: string, refresh?: string): void {
  accessToken = access;
  sessionStorage.setItem('vicinity_access', access);
  if (refresh !== undefined) {
    sessionStorage.setItem('vicinity_refresh', refresh);
  }
}

export function logout(): void {
  accessToken = '';
  sessionStorage.removeItem('vicinity_access');
  sessionStorage.removeItem('vicinity_refresh');
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init?.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`/api${path}`, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(`Réponse invalide (${res.status})`);
  }
if (!res.ok) {
  if (
    typeof data === 'object' &&
    data !== null &&
    'issues' in data &&
    Array.isArray((data as { issues: unknown }).issues)
  ) {
    const issues = (data as { issues: Array<{ path?: string[]; message?: string }> }).issues;

    const msg = issues
      .map((issue) => `${issue.path?.join('.') || 'champ'} : ${issue.message}`)
      .join(', ');

    throw new Error(msg);
  }

  const msg =
    typeof data === 'object' && data !== null && 'error' in data
      ? String((data as { error: string }).error)
      : `${res.status} ${res.statusText}`;

  throw new Error(msg);
}
  return data as T;
}

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName?: string;
    role: string;
    mfaEnabled?: boolean;
  };
};

export async function authPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
if (!res.ok) {
  const msg =
    typeof data === 'object' && data !== null
      ? JSON.stringify(data)
      : `${res.status} ${res.statusText}`;

  throw new Error(msg);
}
  return data as T;
}
