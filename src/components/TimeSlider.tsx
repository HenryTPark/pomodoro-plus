"use client";

import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface TimeSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  onChange: (value: number) => void;
}

export default function TimeSlider({
  value,
  min = 1,
  max = 60,
  step = 1,
  label,
  onChange,
}: TimeSliderProps) {
  return (
    <div className="w-full px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <Label className="text-lg font-medium text-slate-400">{label}</Label>
        <span className="text-lg font-semibold text-slate-400 min-w-fit">
          {value} min
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(val) => onChange(val[0])}
        min={min}
        max={max}
        step={step}
        className="mt-2"
      />
    </div>
  );
}
