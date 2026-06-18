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
    <div className={`w-full ${compact ? "px-1.5 py-[clamp(0.25rem,0.8vh,0.625rem)]" : "px-3 py-2"}`}>
      <div className="flex items-center justify-between gap-2">
        <Label
          className={`font-medium text-muted-foreground ${compact ? "text-[clamp(0.85rem,1.7vh,1.05rem)]" : "text-base"}`}
        >
          {label}
        </Label>
        <span
          className={`min-w-fit font-semibold text-muted-foreground ${compact ? "text-[clamp(0.85rem,1.7vh,1.05rem)]" : "text-base"}`}
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
        className={compact ? "mt-[clamp(0.375rem,1vh,0.75rem)]" : "mt-2"}
      />
    </div>
  );
}
