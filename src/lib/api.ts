const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

function getCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice("csrftoken=".length));
}

let csrfBootstrapPromise: Promise<void> | null = null;

async function ensureCsrfCookie(): Promise<void> {
  if (getCsrfToken()) {
    return;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = fetch(`${API_BASE_URL}/api/health/`, {
      credentials: "include",
    }).then(() => undefined);
  }

  await csrfBootstrapPromise;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (
    options.body !== undefined &&
    options.body !== null &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    await ensureCsrfCookie();
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body as T;
}

export interface AuthUser {
  pk: number;
  email: string;
  first_name: string;
  last_name: string;
}

export function getGoogleOAuthCallbackUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CALLBACK_URL ??
    `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/auth/callback/google`
  );
}

export function getGoogleClientId(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
}

export function buildGoogleAuthUrl(state: string): string {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleOAuthCallbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export const authApi = {
  getCurrentUser: () => apiRequest<AuthUser>("/api/auth/user/"),

  loginWithGoogleCode: (code: string) =>
    apiRequest<AuthUser>("/api/auth/google/", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  logout: () =>
    apiRequest<{ detail: string }>("/api/auth/logout/", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};

export type ApiTheme = "light" | "dark" | "system";
export type ApiTimerMode = "focus" | "break" | "longBreak";
export type ApiSessionEventType =
  | "completed"
  | "skipped"
  | "extended"
  | "stopped";

export interface ApiUserProfile {
  focus_minutes: number;
  break_minutes: number;
  long_break_minutes: number;
  cycle: number;
  active_template_label: string;
  theme: ApiTheme;
  sound_enabled: boolean;
}

export interface ApiTemplate {
  id: number;
  label: string;
  focus: number;
  short_break: number;
  long_break: number;
  cycle: number;
  is_builtin: boolean;
}

/** Point-in-time template config; optional on older payloads. */
export interface ApiTemplateSnapshot {
  focus_minutes: number;
  break_minutes: number;
  long_break_minutes: number;
  cycle: number;
}

export interface ApiSessionEvent {
  id: number;
  event_type: ApiSessionEventType;
  mode: ApiTimerMode;
  template_label: string;
  session_count: number;
  duration_seconds: number | null;
  minutes_added: number | null;
  /** Present on unified terminal events; omitted on legacy rows. */
  extension_count?: number;
  minutes_extended?: number;
  planned_seconds?: number | null;
  pause_count?: number;
  paused_seconds?: number;
  started_at?: string | null;
  template_snapshot?: ApiTemplateSnapshot | null;
  client_id: string;
  occurred_at: string;
}

export interface SyncTemplateInput {
  focus: number;
  short_break: number;
  long_break: number;
  cycle: number;
}

export interface SyncProfileInput {
  focus_minutes?: number;
  break_minutes?: number;
  long_break_minutes?: number;
  cycle?: number;
  active_template_label?: string;
  theme?: ApiTheme;
  sound_enabled?: boolean;
}

export interface SyncSessionInput {
  event_type: ApiSessionEventType;
  mode: ApiTimerMode;
  template_label: string;
  session_count: number;
  duration_seconds?: number | null;
  minutes_added?: number | null;
  extension_count?: number;
  minutes_extended?: number;
  planned_seconds?: number | null;
  pause_count?: number;
  paused_seconds?: number;
  started_at?: string | null;
  template_snapshot?: ApiTemplateSnapshot | null;
  client_id: string;
  occurred_at: string;
}

export interface SyncInput {
  profile?: SyncProfileInput;
  templates?: Record<string, SyncTemplateInput>;
  sessions?: SyncSessionInput[];
}

export interface SyncOutput {
  profile: ApiUserProfile;
  templates: ApiTemplate[];
  sessions: ApiSessionEvent[];
}

export type CreateTemplateInput = Pick<
  ApiTemplate,
  "label" | "focus" | "short_break" | "long_break" | "cycle"
>;

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export const profileApi = {
  get: () => apiRequest<ApiUserProfile>("/api/profile/"),

  update: (profile: ApiUserProfile) =>
    apiRequest<ApiUserProfile>("/api/profile/", {
      method: "PUT",
      body: JSON.stringify(profile),
    }),
};

export const templatesApi = {
  list: () => apiRequest<ApiTemplate[]>("/api/templates/"),

  create: (template: CreateTemplateInput) =>
    apiRequest<ApiTemplate>("/api/templates/", {
      method: "POST",
      body: JSON.stringify(template),
    }),

  update: (id: number, template: UpdateTemplateInput) =>
    apiRequest<ApiTemplate>(`/api/templates/${id}/`, {
      method: "PUT",
      body: JSON.stringify(template),
    }),

  delete: (id: number) =>
    apiRequest<void>(`/api/templates/${id}/`, {
      method: "DELETE",
    }),
};

export const sessionsApi = {
  create: (session: SyncSessionInput) =>
    apiRequest<ApiSessionEvent>("/api/sessions/", {
      method: "POST",
      body: JSON.stringify(session),
    }),
};

export const syncApi = {
  push: (snapshot: SyncInput) =>
    apiRequest<SyncOutput>("/api/sync/", {
      method: "POST",
      body: JSON.stringify(snapshot),
    }),
};
