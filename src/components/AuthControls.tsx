"use client";

import React from "react";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthDisplayName, useAuthStore } from "@/store/authStore";

interface AuthControlsProps {
  compact?: boolean;
}

const compactButtonClass = "h-11 px-4";

export default function AuthControls({ compact = false }: AuthControlsProps) {
  const { user, status, loginWithGoogle, logout } = useAuthStore();

  const isLoading = status === "idle" || status === "loading";
  const displayName = getAuthDisplayName(user);

  if (compact) {
    if (isLoading) {
      return (
        <Button
          variant="secondary"
          size="xl"
          disabled
          className={`${compactButtonClass} cursor-default`}
        >
          <span className="text-sm">…</span>
        </Button>
      );
    }

    if (user) {
      return (
        <Button
          variant="secondary"
          size="xl"
          onClick={() => void logout()}
          title={`Sign out (${displayName})`}
          className={`${compactButtonClass} cursor-pointer`}
        >
          <LogOut className="size-7" />
        </Button>
      );
    }

    return (
      <Button
        variant="secondary"
        size="xl"
        onClick={() => loginWithGoogle()}
        title="Sign in with Google"
        className={`${compactButtonClass} cursor-pointer`}
      >
        <LogIn className="size-7" />
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      {user ? (
        <div className="space-y-2">
          <p className="truncate text-[clamp(0.85rem,1.8vh,1.05rem)] text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">{displayName}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full cursor-pointer sm:w-auto"
            onClick={() => void logout()}
            disabled={isLoading}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[clamp(0.85rem,1.8vh,1.05rem)] text-muted-foreground">
            Sign in to sync templates, preferences, and history across devices.
          </p>
          <Button
            variant="default"
            size="sm"
            className="w-full cursor-pointer sm:w-auto"
            onClick={() => loginWithGoogle()}
            disabled={isLoading}
          >
            <LogIn className="size-4" />
            Sign in with Google
          </Button>
        </div>
      )}
    </div>
  );
}
