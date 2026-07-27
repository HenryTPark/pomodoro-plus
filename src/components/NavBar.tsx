"use client";

import React from "react";
import { History, Settings, Sparkles, Timer } from "lucide-react";
import { useUIStore } from "@/store";
import { Button } from "@/components/ui/button";
import AuthControls from "@/components/AuthControls";

const navButtonClass = "h-11 px-4 cursor-pointer";

export default function NavBar() {
  const { view, setView } = useUIStore();

  return (
    <nav className="border-b border-border bg-card/95 dark:shadow-xl dark:shadow-slate-950/20 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-3 sm:px-8 lg:px-10">
        <div className="flex h-[var(--nav-height)] items-center justify-between">
          <div className="shrink-0">
            <h1
              onClick={() => setView("timer")}
              className="text-xl sm:text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-foreground cursor-pointer"
            >
              Pomodoro+
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant={view === "timer" ? "default" : "secondary"}
              size="xl"
              onClick={() => setView("timer")}
              title="Timer"
              className={navButtonClass}
            >
              <div className="flex justify-around items-center">
                <Timer className="size-7" />
              </div>
            </Button>

            <Button
              variant={view === "history" ? "default" : "secondary"}
              size="xl"
              onClick={() => setView("history")}
              title="History"
              className={navButtonClass}
            >
              <div className="flex justify-around items-center">
                <History className="size-7" />
              </div>
            </Button>

            <Button
              variant={view === "insights" ? "default" : "secondary"}
              size="xl"
              onClick={() => setView("insights")}
              title="Insights"
              className={navButtonClass}
            >
              <div className="flex justify-around items-center">
                <Sparkles className="size-7" />
              </div>
            </Button>

            <Button
              variant={view === "settings" ? "default" : "secondary"}
              size="xl"
              onClick={() => setView("settings")}
              title="Settings"
              className={navButtonClass}
            >
              <div className="flex justify-around items-center">
                <Settings className="size-7" />
              </div>
            </Button>

            <AuthControls compact />
          </div>
        </div>
      </div>
    </nav>
  );
}
