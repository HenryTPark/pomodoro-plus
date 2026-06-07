"use client";

import React from "react";
import { Settings, Timer } from "lucide-react";
import { useUIStore } from "@/store";
import { Button } from "@/components/ui/button";

export default function NavBar() {
  const { showSettings, toggleShowSettings } = useUIStore();

  return (
    <nav className="border-b border-slate-800 bg-slate-950/95 shadow-xl shadow-slate-950/20 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="flex h-20 items-center justify-between">
          <div className="shrink-0">
            <h1 className="text-5xl font-semibold tracking-tight text-slate-50 cursor-pointer">
              Pomodoro+
            </h1>
            {/* <p className="text-lg text-slate-400">Focus with a modern timer</p> */}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="4xl"
              onClick={toggleShowSettings}
              title={showSettings ? "Back to Timer" : "Settings"}
              className="cursor-pointer"
            >
              {/* <Settings className="size-8" />
              {showSettings ? "Timer" : "Settings"} */}

              <div className="flex justify-around items-center">
                {showSettings ? (
                  <>
                    {/* Timer */}
                    <Timer className="size-8" />
                  </>
                ) : (
                  <>
                    {/* Settings */}
                    <Settings className="size-8" />
                  </>
                )}
              </div>
            </Button>

            {/* //TODO: Login */}
            {/* <Button variant="outline" size="4xl" className="cursor-pointer">
              Login
            </Button> */}
          </div>
        </div>
      </div>
    </nav>
  );
}
