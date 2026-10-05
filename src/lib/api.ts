import { API_URL } from './config';
import {
  clearSessionToken,
  getSessionToken,
  setSessionToken,
} from './sessionStorage';

export type SafeUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  [key: string]: unknown;
};

export type AuthErrorCode =
  | 'invalid'
  | 'email_unverified'
  | 'rate_limited'
  | 'network_error'
  | 'request_timeout'
  | 'unexpected_server_error'
  | 'invalid_response'
  | 'token_storage_failed'
  | string;

type ApiErrorBody = {
  code?: string;
  error?: string;
  message?: string;
  details?: unknown;
};

type ApiRequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
};

type LoginResponse = {
  token?: string;
  accessToken?: string;
  sessionToken?: string;
  bearerToken?: string;
  user?: SafeUser;
  viewer?: SafeUser;
  data?: LoginResponse;
  session?: LoginResponse;
};

export class ApiError extends Error {
  status: number;
  code: AuthErrorCode;
  userMessage: string;
  details?: unknown;

  constructor(params: {
    status: number;
    code: AuthErrorCode;
    userMessage: string;
    details?: unknown;
  }) {
    super(params.userMessage);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.details = params.details;
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

export async function login(
  email: string,
  password: string,
  deviceName?: string,
  platform?: string
) {
  const parsed = await apiRequest<LoginResponse>('/api/mobile/auth/login', {
    method: 'POST',
    body: {
      email,
      password,
      ...(deviceName ? { deviceName } : {}),
      ...(platform ? { platform } : {}),
    },
  });

  const token = extractToken(parsed);
  const user = extractUser(parsed);

  if (!token || !user) {
    throw new ApiError({
      status: 0,
      code: 'invalid_response',
      userMessage: 'Vera returned an unexpected login response. Please try again.',
      details: parsed,
    });
  }

  const stored = await setSessionToken(token);
  if (!stored) {
    throw new ApiError({
      status: 0,
      code: 'token_storage_failed',
      userMessage: 'Unable to save your secure mobile session on this device.',
    });
  }

  return user;
}

export async function getCurrentUser() {
  const token = await getStoredToken();
  if (!token) {
    return null;
  }

  const parsed = await apiRequest<LoginResponse>('/api/mobile/auth/me', {
    method: 'GET',
    token,
  });

  const user = extractUser(parsed);
  if (!user) {
    throw new ApiError({
      status: 0,
      code: 'invalid_response',
      userMessage: 'Vera returned an unexpected session response.',
      details: parsed,
    });
  }

  return user;
}

export async function logout() {
  const token = await getStoredToken();

  try {
    if (token) {
      await apiRequest('/api/mobile/auth/logout', {
        method: 'POST',
        token,
      });
    }
  } finally {
    await removeStoredToken();
  }
}

export async function logoutAll() {
  const token = await getStoredToken();

  try {
    if (token) {
      await apiRequest('/api/mobile/auth/logout-all', {
        method: 'POST',
        token,
      });
    }
  } finally {
    await removeStoredToken();
  }
}

export async function getStoredToken() {
  return getSessionToken();
}

export async function removeStoredToken() {
  await clearSessionToken();
}

export async function apiRequest<TResponse = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<TResponse | null> {
  const { body, token, timeoutMs, signal, ...requestInit } = options;
  signal?.throwIfAborted();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const response = await fetch(buildApiUrl(path), {
      ...requestInit,
      body: serializeBody(body),
      headers: buildHeaders(token),
      signal: controller.signal,
    });
    const parsed = await parseResponse(response);

    if (!response.ok) {
      if (response.status === 401 && token && await getStoredToken() === token) await removeStoredToken();
      throw buildResponseError(response.status, parsed);
    }

    return parsed as TResponse | null;
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError({
        status: 0,
        code: 'request_timeout',
        userMessage: 'The request timed out. Please try again.',
      });
    }

    throw new ApiError({
      status: 0,
      code: 'network_error',
      userMessage: 'Unable to reach Vera. Please check your connection and try again.',
      details: error,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

function buildApiUrl(path: string) {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildHeaders(token?: string | null) {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

function serializeBody(body: unknown) {
  if (body === undefined || body === null) {
    return undefined;
  }

  return JSON.stringify(body);
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    if (response.ok) throw new ApiError({ status: response.status, code: "invalid_response", userMessage: "Vera returned an unexpected response." });
    return { message: text };
  }

  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) throw new ApiError({ status: response.status, code: "invalid_response", userMessage: "Vera returned invalid JSON." });
    return { message: text };
  }
}

function buildResponseError(status: number, parsed: unknown) {
  const body = toApiErrorBody(parsed);
  const serverCode = body.code ?? body.error;
  const code = mapErrorCode(status, serverCode);

  return new ApiError({
    status,
    code,
    userMessage: body.message ?? userMessageForError(code),
    details: body.details ?? parsed,
  });
}

function mapErrorCode(status: number, serverCode?: string): AuthErrorCode {
  if (serverCode === 'email_unverified') return 'email_unverified';
  if (serverCode === 'rate_limited') return 'rate_limited';
  if (status === 401) return 'invalid';
  if (status === 403) return serverCode ?? 'forbidden';
  if (status === 429) return 'rate_limited';
  if (serverCode) return serverCode;
  return 'unexpected_server_error';
}

function userMessageForError(code: AuthErrorCode) {
  switch (code) {
    case 'invalid':
      return 'Your session is invalid or your sign-in details were not accepted.';
    case 'email_unverified':
      return 'Please verify your email address before signing in.';
    case 'rate_limited':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'network_error':
      return 'Unable to reach Vera. Please check your connection and try again.';
    default:
      return 'Vera could not complete the request. Please try again.';
  }
}

function toApiErrorBody(value: unknown): ApiErrorBody {
  if (value && typeof value === 'object') {
    return value as ApiErrorBody;
  }

  if (typeof value === 'string') {
    return { message: value };
  }

  return {};
}

function extractToken(response: LoginResponse | null) {
  return (
    response?.token ??
    response?.accessToken ??
    response?.sessionToken ??
    response?.bearerToken ??
    response?.data?.token ??
    response?.data?.accessToken ??
    response?.data?.sessionToken ??
    response?.data?.bearerToken ??
    response?.session?.token ??
    response?.session?.accessToken ??
    response?.session?.sessionToken ??
    response?.session?.bearerToken ??
    null
  );
}

function extractUser(response: LoginResponse | null): SafeUser | null {
  return (
    response?.user ??
    response?.viewer ??
    response?.data?.user ??
    response?.data?.viewer ??
    response?.session?.user ??
    response?.session?.viewer ??
    null
  );
}
