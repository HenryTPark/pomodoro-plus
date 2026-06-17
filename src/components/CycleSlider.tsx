"use client";

import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface CycleSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  onChange: (value: number) => void;
  compact?: boolean;
}

export default function CycleSlider({
  value,
  min = 1,
  max = 10,
  step = 1,
  label,
  onChange,
  compact = false,
}: CycleSliderProps) {
  return (
    <div className={`w-full ${compact ? "px-1 py-0.5" : "px-3 py-2"}`}>
      <div className="flex items-center justify-between gap-2">
        <Label
          className={`font-medium text-slate-400 ${compact ? "text-xs" : "text-base"}`}
        >
          {label}
        </Label>
        <span
          className={`min-w-fit font-semibold text-slate-400 ${compact ? "text-xs" : "text-base"}`}
        >
          {value}
        </span>
      </div>

      <Slider
        value={[value]}
        onValueChange={(val) => onChange(val[0])}
        min={min}
        max={max}
        step={step}
        className={compact ? "mt-1" : "mt-2"}
      />
    </div>
  );
}
