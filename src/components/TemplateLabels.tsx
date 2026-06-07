"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/store";

export default function TemplateLabels() {
  const {
    templates,
    templateLabel,
    changeTemplate,
    setTemplateLabel,
    setCount,
  } = useSettingsStore();

  const handleChange = (templateName: string) => {
    const templateObject = templates[templateName];
    changeTemplate(templateObject);
    setCount(1);
    setTemplateLabel(templateName);
  };

  return (
    <div className="w-3/5 max-w-3xl h-full py-2">
      <Select
        className="w-full"
        value={templateLabel}
        onValueChange={handleChange}
      >
        <SelectTrigger className="text-2xl w-full p-5" size="lg">
          <SelectValue placeholder="Select a template" />
        </SelectTrigger>

        <SelectContent className="w-full p-5">
          {Object.keys(templates).map((templateName) => (
            <SelectItem
              className="text-2xl"
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
