"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore, useTimerStore } from "@/store";

interface TemplateLabelsProps {
  compact?: boolean;
}

export default function TemplateLabels({ compact = false }: TemplateLabelsProps) {
  const {
    templates,
    templateLabel,
    changeTemplate,
    setTemplateLabel,
  } = useSettingsStore();
  const resetTimer = useTimerStore((state) => state.resetTimer);

  const handleChange = (templateName: string) => {
    const templateObject = templates[templateName];
    changeTemplate(templateObject);
    setTemplateLabel(templateName);
    resetTimer(templateObject.focus * 60, "focus");
  };

  return (
    <div className={`w-full max-w-full ${compact ? "py-0" : "py-2"}`}>
      <Select
        className="w-full"
        value={templateLabel}
        onValueChange={handleChange}
      >
        <SelectTrigger
          className={`w-full cursor-pointer ${compact ? "text-sm" : "p-4 text-xl"}`}
          size={compact ? "sm" : "lg"}
        >
          <SelectValue placeholder="Select a template" />
        </SelectTrigger>

        <SelectContent className="w-full p-3">
          {Object.keys(templates).map((templateName) => (
            <SelectItem
              className="text-lg"
              key={templateName}
              value={templateName}
            >
              {templateName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
