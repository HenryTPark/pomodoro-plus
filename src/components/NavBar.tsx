"use client";

import React from "react";
import { History, Settings, Timer } from "lucide-react";
import { useUIStore } from "@/store";
import { Button } from "@/components/ui/button";

export default function NavBar() {
  const { view, setView, toggleView } = useUIStore();

  return (
    <nav className="border-b border-border bg-card/95 dark:shadow-xl dark:shadow-slate-950/20 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="flex h-[var(--nav-height)] items-center justify-between">
          <div className="shrink-0">
            <h1
              onClick={() => setView("timer")}
              className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-foreground cursor-pointer"
            >
              Pomodoro+
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="xl"
              onClick={() => toggleView("history")}
              title={view === "history" ? "Back to Timer" : "History"}
              className="cursor-pointer"
            >
              <div className="flex justify-around items-center">
                {view === "history" ? (
                  <Timer className="size-7" />
                ) : (
                  <History className="size-7" />
                )}
              </div>
            </Button>

            <Button
              variant="secondary"
              size="xl"
              onClick={() => toggleView("settings")}
              title={view === "settings" ? "Back to Timer" : "Settings"}
              className="cursor-pointer"
            >
              <div className="flex justify-around items-center">
                {view === "settings" ? (
                  <Timer className="size-7" />
                ) : (
                  <Settings className="size-7" />
                )}
              </div>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
