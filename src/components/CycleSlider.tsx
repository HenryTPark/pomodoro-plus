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
}

export default function CycleSlider({
  value,
  min = 1,
  max = 10,
  step = 1,
  label,
  onChange,
}: CycleSliderProps) {
  return (
    <div className="w-full px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <Label className="text-lg font-medium text-slate-400">{label}</Label>
        <span className="text-lg font-semibold text-slate-400 min-w-fit">
          {value}
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
