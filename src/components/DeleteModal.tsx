"use client";

import React, { useState } from "react";
import { Trash2 } from "lucide-react";
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
import { useSettingsStore } from "@/store";

export default function DeleteModal() {
  const {
    templateLabel,
    templates,
    deleteTemplate,
    changeTemplate,
    setTemplateLabel,
  } = useSettingsStore();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && templateLabel === "Default") {
      alert("You cannot delete the Default Template");
      return;
    }
    setOpen(isOpen);
  };

  function handleDelete() {
    deleteTemplate(templateLabel);

    // Switch to Default template
    const defaultTemplate = templates["Default"];
    changeTemplate(defaultTemplate);
    setTemplateLabel("Default");

    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Delete template"
          className="cursor-pointer"
        >
          <Trash2 className="size-8" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-3xl font-semibold">
            Delete Template
          </DialogTitle>
          <DialogDescription className="text-xl">
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-xl">
            Are you sure you want to delete the{" "}
            <span className="font-semibold text-destructive">
              {templateLabel}
            </span>{" "}
            template?
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="2xl"
            onClick={() => setOpen(false)}
            className="cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            size="2xl"
            onClick={handleDelete}
            className="cursor-pointer"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
