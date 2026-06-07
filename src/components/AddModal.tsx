"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TimeSlider from "@/components/TimeSlider";
import CycleSlider from "@/components/CycleSlider";
import { useSettingsStore } from "@/store";

export default function AddModal() {
  const { templates, addTemplate, changeTemplate, setTemplateLabel } =
    useSettingsStore();
  const [open, setOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newFocusMinutes, setNewFocusMinutes] = useState(25);
  const [newBreakMinutes, setNewBreakMinutes] = useState(5);
  const [newLongBreakMinutes, setNewLongBreakMinutes] = useState(15);
  const [newCycle, setNewCycle] = useState(4);

  function handleAdd() {
    if (Object.keys(templates).length >= 5) {
      alert("You can only have 5 templates in total.");
      return;
    }

    if (!newName.trim()) {
      alert("Please enter a template name.");
      return;
    }

    if (templates.hasOwnProperty(newName)) {
      alert(`${newName} Template is already in use.`);
      return;
    }

    const newTemplate = {
      focus: newFocusMinutes,
      shortBreak: newBreakMinutes,
      longBreak: newLongBreakMinutes,
      cycle: newCycle,
    };

    addTemplate(newName, newTemplate);
    changeTemplate(newTemplate);
    setTemplateLabel(newName);

    // Reset form
    setNewName("");
    setNewFocusMinutes(25);
    setNewBreakMinutes(5);
    setNewLongBreakMinutes(15);
    setNewCycle(4);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Add new template"
          className="cursor-pointer"
        >
          <Plus className="size-8" />
        </Button>
      </DialogTrigger>

      <DialogContent className="w-110">
        <DialogHeader>
          <DialogTitle className="text-3xl font-semibold">
            Add New Template
          </DialogTitle>
          <DialogDescription className="text-xl">
            Create a custom Pomodoro template with your preferred timing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <TimeSlider
            label="Focus Minutes"
            value={newFocusMinutes}
            onChange={setNewFocusMinutes}
          />

          <TimeSlider
            label="Short Break Minutes"
            value={newBreakMinutes}
            onChange={setNewBreakMinutes}
          />

          <TimeSlider
            label="Long Break Minutes"
            value={newLongBreakMinutes}
            onChange={setNewLongBreakMinutes}
          />

          <CycleSlider
            label="Focus Sessions per Cycle"
            value={newCycle}
            onChange={setNewCycle}
          />

          <div className="space-y-2">
            <Label htmlFor="template-name" className="text-2xl font-semibold">
              Template Name
            </Label>
            <Input
              id="template-name"
              placeholder="e.g. Intense Focus"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-2xl md:text-2xl font-semibold placeholder:text-2xl h-12"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            size="2xl"
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            className="cursor-pointer hover:bg-stone-100"
            size="2xl"
          >
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
