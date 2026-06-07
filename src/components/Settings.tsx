"use client";

import React from "react";
import { useUIStore, useSettingsStore } from "@/store";
import TemplateLabels from "@/components/TemplateLabels";
import TimeSlider from "@/components/TimeSlider";
import CycleSlider from "@/components/CycleSlider";
import AddModal from "@/components/AddModal";
import EditModal from "@/components/EditModal";
import DeleteModal from "@/components/DeleteModal";

export default function Settings() {
  const { setShowSettings } = useUIStore();
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
    <div className="space-y-2 pt-5 px-4 text-slate-100 sm:px-6 lg:px-8">
      {/* Template Selection */}
      <div className="mx-auto w-full sm:w-160 max-w-4xl rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
        <div className="space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-white">Templates</h2>
              <p className="text-xl text-slate-400">
                Choose or modify your focus presets.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <EditModal />
              <DeleteModal />
              <AddModal />
            </div>
          </div>
          <TemplateLabels />
        </div>
      </div>

      {/* Sliders */}
      <div className="mx-auto w-full sm:w-160 max-w-4xl space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold text-white">Timing</h2>
          <p className="text-xl text-slate-400">
            Adjust focus and break lengths for your current template.
          </p>
        </div>

        <TimeSlider
          label="Focus Minutes"
          value={focusMinutes}
          onChange={handleFocusChange}
        />

        <TimeSlider
          label="Short Break Minutes"
          value={breakMinutes}
          onChange={handleBreakChange}
        />

        <TimeSlider
          label="Long Break Minutes"
          value={longBreakMinutes}
          onChange={handleLongBreakChange}
        />

        <CycleSlider
          label="Focus Sessions per Cycle"
          value={cycle}
          onChange={handleCycleChange}
        />
      </div>
    </div>
  );
}
