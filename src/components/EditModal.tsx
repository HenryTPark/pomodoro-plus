"use client";

import React, { useState } from "react";
import { Edit2 } from "lucide-react";
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
import { useSettingsStore } from "@/store";

export default function EditModal() {
  const {
    templateLabel,
    templates,
    updateTemplate,
    changeTemplate,
    setTemplateLabel,
  } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && templateLabel === "Default") {
      alert("You cannot edit the Default Template");
      return;
    }
    setNewName("");
    setOpen(isOpen);
  };

  function handleEdit() {
    if (!newName.trim()) {
      alert("Please enter a template name.");
      return;
    }

    if (templates.hasOwnProperty(newName) && newName !== templateLabel) {
      alert(`${newName} Template is already in use.`);
      return;
    }

    const currentTemplate = templates[templateLabel];

    // Delete old name and add new name if different
    if (newName !== templateLabel) {
      useSettingsStore.setState((state) => {
        const newTemplates = { ...state.templates };
        delete newTemplates[templateLabel];
        newTemplates[newName] = currentTemplate;
        return { templates: newTemplates };
      });

      changeTemplate(currentTemplate);
      setTemplateLabel(newName);
    }

    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Edit template"
          className="cursor-pointer"
        >
          <Edit2 className="size-8" />
        </Button>
      </DialogTrigger>

      <DialogContent className="w-110">
        <DialogHeader>
          <DialogTitle className="text-3xl font-semibold">
            Edit Template
          </DialogTitle>
          <DialogDescription className="text-xl">
            Change the name of your template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label
              htmlFor="new-template-name"
              className="text-2xl font-semibold"
            >
              New Template Name
            </Label>
            <Input
              id="new-template-name"
              className="text-2xl md:text-2xl font-semibold placeholder:text-2xl h-12"
              placeholder={templateLabel}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
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
            onClick={handleEdit}
            size="2xl"
            className="cursor-pointer hover:bg-stone-100"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
