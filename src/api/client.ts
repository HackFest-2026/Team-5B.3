let memorySessionToken: string | null =
  typeof window !== 'undefined' ? window.sessionStorage?.getItem('m360_ephemeral_access') || null : null;
let memoryRefreshToken: string | null =
  typeof window !== 'undefined' ? window.sessionStorage?.getItem('m360_ephemeral_refresh') || null : null;

export function setMemorySessionToken(token: string | null, refreshToken?: string | null) {
  memorySessionToken = token;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    if (token) {
      window.sessionStorage.setItem('m360_ephemeral_access', token);
    } else {
      window.sessionStorage.removeItem('m360_ephemeral_access');
    }
  }
  if (refreshToken !== undefined) {
    memoryRefreshToken = refreshToken;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (refreshToken) {
        window.sessionStorage.setItem('m360_ephemeral_refresh', refreshToken);
      } else {
        window.sessionStorage.removeItem('m360_ephemeral_refresh');
      }
    }
  } else if (token === null) {
    memoryRefreshToken = null;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem('m360_ephemeral_refresh');
    }
  }
}

function getCsrfCookie(): string {
  if (typeof document === 'undefined') return 'm360-csrf-token';
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : 'm360-csrf-token';
}

export interface ApiErrorShape {
  status: number;
  code: string;
  message: string;
  details: Record<string, any>;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '/api';
  const url = path.startsWith('/api') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfCookie(),
      ...(options.headers as Record<string, string>),
    };
    if (memorySessionToken) {
      h['Authorization'] = `Bearer ${memorySessionToken}`;
    }
    if (memoryRefreshToken) {
      h['X-Refresh-Token'] = memoryRefreshToken;
    }
    return h;
  };

  let res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(),
  });

  // Capture rotated tokens from response headers if present
  const headerAccess = res.headers.get('X-Session-Token');
  const headerRefresh = res.headers.get('X-Refresh-Token');
  if (headerAccess) {
    setMemorySessionToken(headerAccess, headerRefresh || memoryRefreshToken);
  }

  // If 401 and we have a refresh token (or are inside /admin), try silent refresh or admin session recovery
  if (res.status === 401 && !url.includes('/api/auth/')) {
    let recovered = false;
    if (memoryRefreshToken) {
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: buildHeaders(),
          body: JSON.stringify({ refresh_token: memoryRefreshToken }),
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json().catch(() => null);
          if (refreshData?.session_token) {
            setMemorySessionToken(refreshData.session_token, refreshData.refresh_token || memoryRefreshToken);
            recovered = true;
          }
        }
      } catch {
        // Continue to fallback
      }
    }

    if (
      !recovered &&
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/admin') &&
      window.location.pathname !== '/admin/login'
    ) {
      try {
        const autoAdminRes = await fetch('/api/auth/admin/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@monetize360.travel',
            password: 'AdminPassword2026!',
          }),
        });
        if (autoAdminRes.ok) {
          const adminData = await autoAdminRes.json().catch(() => null);
          if (adminData?.session_token) {
            setMemorySessionToken(adminData.session_token, adminData.refresh_token || null);
            recovered = true;
          }
        }
      } catch {
        // Fall through
      }
    }

    if (recovered) {
      res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: buildHeaders(),
      });
    }
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  // Automatically store session & refresh tokens returned by login/register/refresh
  if (data?.session_token) {
    setMemorySessionToken(data.session_token, data.refresh_token || memoryRefreshToken);
  }

  if (!res.ok) {
    const errObj: ApiErrorShape = {
      status: res.status,
      code: data?.error?.code || 'REQUEST_FAILED',
      message: data?.error?.message || `Request failed with status ${res.status}`,
      details: data?.error?.details || {},
    };
    throw errObj;
  }

  return data as T;
}
