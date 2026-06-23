import { create } from "zustand";
import {
  ApiError,
  authApi,
  buildGoogleAuthUrl,
  type AuthUser,
} from "@/lib/api";

export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated";

const GOOGLE_OAUTH_STATE_KEY = "pomodoro-plus:google-oauth-state";

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  initialize: () => Promise<void>;
  loginWithGoogle: () => void;
  completeGoogleLogin: (code: string, state: string | null) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

function getDisplayName(user: AuthUser): string {
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || user.email;
}

function setAuthenticated(set: (partial: Partial<AuthState>) => void, user: AuthUser) {
  set({
    user,
    status: "authenticated",
    error: null,
  });
}

export function getAuthDisplayName(user: AuthUser | null): string | null {
  if (!user) {
    return null;
  }

  return getDisplayName(user);
}

function logAuthError(context: string, error: unknown): void {
  console.error(`[auth] ${context}`, error);
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  status: "idle",
  error: null,

  initialize: async () => {
    if (get().status === "loading") {
      return;
    }

    set({ status: "loading", error: null });

    try {
      const user = await authApi.getCurrentUser();
      setAuthenticated(set, user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        set({ user: null, status: "unauthenticated", error: null });
        return;
      }

      logAuthError("initialize failed", error);
      set({
        user: null,
        status: "unauthenticated",
        error: "Unable to check sign-in status.",
      });
    }
  },

  loginWithGoogle: () => {
    const state =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    sessionStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state);

    try {
      window.location.assign(buildGoogleAuthUrl(state));
    } catch (error) {
      logAuthError("loginWithGoogle failed", error);
      sessionStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
      set({
        error:
          error instanceof Error
            ? error.message
            : "Google sign-in is not configured.",
      });
    }
  },

  completeGoogleLogin: async (code, state) => {
    const expectedState = sessionStorage.getItem(GOOGLE_OAUTH_STATE_KEY);
    sessionStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);

    if (!state || !expectedState || state !== expectedState) {
      logAuthError("completeGoogleLogin state mismatch", {
        state,
        expectedState: expectedState ?? null,
      });
      set({
        user: null,
        status: "unauthenticated",
        error: "Google sign-in could not be verified. Please try again.",
      });
      return;
    }

    set({ status: "loading", error: null });

    try {
      const user = await authApi.loginWithGoogleCode(code);
      setAuthenticated(set, user);
    } catch (error) {
      logAuthError("completeGoogleLogin failed", error);
      set({
        user: null,
        status: "unauthenticated",
        error: "Google sign-in failed. Please try again.",
      });
      throw error;
    }
  },

  logout: async () => {
    set({ status: "loading", error: null });

    try {
      await authApi.logout();
    } catch (error) {
      logAuthError("logout failed", error);
      // Clear local auth either way so the UI reflects logged-out state.
    } finally {
      set({ user: null, status: "unauthenticated", error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
