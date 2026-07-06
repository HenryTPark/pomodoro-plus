"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { usePreferencesStore, useSettingsStore } from "@/store";
import TemplateLabels from "@/components/TemplateLabels";
import TimeSlider from "@/components/TimeSlider";
import CycleSlider from "@/components/CycleSlider";
import AddModal from "@/components/AddModal";
import EditModal from "@/components/EditModal";
import DeleteModal from "@/components/DeleteModal";
import AuthControls from "@/components/AuthControls";

const cardClassName =
  "rounded-2xl border border-border bg-card/70 p-[clamp(0.875rem,2.2vh,1.5rem)] dark:shadow-2xl dark:shadow-slate-950/30 backdrop-blur-xl";

export default function Settings() {
  const {
    focusMinutes,
    breakMinutes,
    longBreakMinutes,
    cycle,
    templateLabel,
    updateTemplate,
    setFocusMinutes,
    setBreakMinutes,
    setLongBreakMinutes,
    setCycle,
  } = useSettingsStore();
  const { theme, soundEnabled, setTheme, toggleSoundEnabled } =
    usePreferencesStore();

  const handleFocusChange = (value: number) => {
    setFocusMinutes(value);
    const template = useSettingsStore.getState().templates[templateLabel];
    updateTemplate(templateLabel, {
      ...template,
      focus: value,
    });
  };

  const handleBreakChange = (value: number) => {
    setBreakMinutes(value);
    const template = useSettingsStore.getState().templates[templateLabel];
    updateTemplate(templateLabel, {
      ...template,
      shortBreak: value,
    });
  };

  const handleLongBreakChange = (value: number) => {
    setLongBreakMinutes(value);
    const template = useSettingsStore.getState().templates[templateLabel];
    updateTemplate(templateLabel, {
      ...template,
      longBreak: value,
    });
  };

  const handleCycleChange = (value: number) => {
    setCycle(value);
    const template = useSettingsStore.getState().templates[templateLabel];
    updateTemplate(templateLabel, {
      ...template,
      cycle: value,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-2 py-3 pb-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+2.5rem))] text-foreground sm:px-3">
      <div className="flex min-h-full w-full max-w-[min(100vw-1rem,72rem)] flex-col gap-[clamp(0.625rem,1.6vh,1.125rem)]">
        <section className={`${cardClassName} shrink-0`}>
          <div className="flex flex-col gap-[clamp(0.5rem,1.2vh,0.875rem)] sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-[clamp(1.25rem,3vh,1.75rem)] font-semibold text-foreground">
                Templates
              </h2>
              <p className="truncate text-[clamp(0.85rem,1.8vh,1.05rem)] text-muted-foreground">
                Choose or modify your focus presets.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <EditModal />
              <DeleteModal />
              <AddModal />
            </div>
          </div>
          <TemplateLabels compact />
        </section>

        <section className={`${cardClassName} flex shrink-0 flex-col`}>
          <div className="shrink-0 space-y-1">
            <h2 className="text-[clamp(1.25rem,3vh,1.75rem)] font-semibold text-foreground">
              Timing
            </h2>
            <p className="truncate text-[clamp(0.85rem,1.8vh,1.05rem)] text-muted-foreground">
              Adjust focus and break lengths for your current template.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-y-[clamp(0.5rem,1.5vh,1.25rem)]">
            <TimeSlider
              label="Focus Minutes"
              value={focusMinutes}
              onChange={handleFocusChange}
              compact
            />
            <TimeSlider
              label="Short Break Minutes"
              value={breakMinutes}
              onChange={handleBreakChange}
              compact
            />
            <TimeSlider
              label="Long Break Minutes"
              value={longBreakMinutes}
              onChange={handleLongBreakChange}
              compact
            />
            <CycleSlider
              label="Focus Sessions per Cycle"
              value={cycle}
              onChange={handleCycleChange}
              compact
            />
          </div>
        </section>

        <section className={`${cardClassName} shrink-0`}>
          <div className="space-y-1">
            <h2 className="text-[clamp(1.25rem,3vh,1.75rem)] font-semibold text-foreground">
              Account
            </h2>
            <p className="truncate text-[clamp(0.85rem,1.8vh,1.05rem)] text-muted-foreground">
              Sync your data when signed in.
            </p>
          </div>
          <div className="mt-[clamp(0.5rem,1.2vh,0.875rem)]">
            <AuthControls />
          </div>
        </section>

        <section className={`${cardClassName} shrink-0`}>
          <div className="grid gap-[clamp(0.5rem,1vh,0.75rem)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
            <div className="space-y-1">
              <h2 className="text-[clamp(1.25rem,3vh,1.75rem)] font-semibold text-foreground">
                Preferences
              </h2>
              <p className="truncate text-[clamp(0.85rem,1.8vh,1.05rem)] text-muted-foreground">
                Saved to this browser.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[clamp(0.8rem,1.6vh,0.95rem)] font-medium text-muted-foreground">
                  Theme
                </p>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-full cursor-pointer" size="sm">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-[clamp(0.8rem,1.6vh,0.95rem)] font-medium text-muted-foreground">
                  Session sound
                </p>
                <Button
                  variant={soundEnabled ? "default" : "outline"}
                  size="sm"
                  className="w-full cursor-pointer"
                  onClick={toggleSoundEnabled}
                >
                  {soundEnabled ? "Sound on" : "Sound off"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
