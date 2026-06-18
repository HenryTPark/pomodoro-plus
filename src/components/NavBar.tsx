"use client";

import React from "react";
import { Settings, Timer } from "lucide-react";
import { useUIStore } from "@/store";
import { Button } from "@/components/ui/button";

export default function NavBar() {
  const { showSettings, toggleShowSettings, setShowSettings } = useUIStore();

  return (
    <nav className="border-b border-slate-800 bg-slate-950/95 shadow-xl shadow-slate-950/20 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="flex min-h-[9vh] items-center justify-between">
          <div className="shrink-0">
            <h1
              onClick={() => setShowSettings(false)}
              className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-slate-50 cursor-pointer"
            >
              Pomodoro+
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="xl"
              onClick={toggleShowSettings}
              title={showSettings ? "Back to Timer" : "Settings"}
              className="cursor-pointer"
            >
              <div className="flex justify-around items-center">
                {showSettings ? (
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
