import { API_URL } from '@/lib/config';

export type ApiErrorBody = {
  code?: string;
  message?: string;
  details?: unknown;
  error?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  userMessage: string;
  details?: unknown;

  constructor(params: { status: number; code?: string; userMessage: string; details?: unknown }) {
    super(params.userMessage);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.details = params.details;
  }
}

type ApiRequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: HeadersInit;
  token?: string | null;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15000;

export async function apiRequest<TResponse = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<TResponse | null> {
  const { body, headers, token, timeoutMs, ...requestInit } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(path), {
      ...requestInit,
      body: serializeBody(body),
      headers: buildHeaders({ body, headers, token }),
      signal: controller.signal,
    });
    const parsed = await parseResponse(response);

    if (!response.ok) {
      const errorBody = toApiErrorBody(parsed);
      throw new ApiError({
        status: response.status,
        code: errorBody.code,
        userMessage: errorBody.message ?? errorBody.error ?? 'Something went wrong. Please try again.',
        details: errorBody.details ?? parsed,
      });
    }

    return parsed as TResponse | null;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError({
        status: 0,
        code: 'request_timeout',
        userMessage: 'The request timed out. Please check your connection and try again.',
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
  }
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${normalizedPath}`;
}

function buildHeaders(options: ApiRequestOptions) {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  return headers;
}

function serializeBody(body: unknown) {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (body instanceof FormData || typeof body === 'string' || body instanceof Blob) {
    return body;
  }

  return JSON.stringify(body);
}

async function parseResponse(response: Response) {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
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
