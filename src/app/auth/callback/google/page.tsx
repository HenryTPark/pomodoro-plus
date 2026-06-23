"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const completeGoogleLogin = useAuthStore((state) => state.completeGoogleLogin);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    const oauthError = searchParams.get("error");
    if (oauthError) {
      router.replace("/");
      return;
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      router.replace("/");
      return;
    }

    void completeGoogleLogin(code, state)
      .then(() => {
        router.replace("/");
      })
      .catch(() => {
        router.replace("/");
      });
  }, [completeGoogleLogin, router, searchParams]);

  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground">
      Completing Google sign-in…
    </div>
  );
}
