import { create } from 'zustand';

export interface Template {
  focus: number;
  shortBreak: number;
  longBreak: number;
  cycle: number;
}

export interface Templates {
  [key: string]: Template;
}

interface SettingsState {
  // Timer settings
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  cycle: number;
  count: number;

  // Templates
  templates: Templates;
  templateLabel: string;

  // Actions
  setFocusMinutes: (minutes: number) => void;
  setBreakMinutes: (minutes: number) => void;
  setLongBreakMinutes: (minutes: number) => void;
  setCycle: (cycle: number) => void;
  setCount: (count: number) => void;

  changeTemplate: (template: Template) => void;
  setTemplates: (templates: Templates) => void;
  setTemplateLabel: (label: string) => void;
  
  addTemplate: (label: string, template: Template) => void;
  updateTemplate: (label: string, template: Template) => void;
  deleteTemplate: (label: string) => void;
}

const defaultTemplates: Templates = {
  Default: {
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    cycle: 4,
  },
  Test: {
    focus: 50,
    shortBreak: 10,
    longBreak: 30,
    cycle: 2,
  },
};

export const useSettingsStore = create<SettingsState>((set) => ({
  // Initial state
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cycle: 4,
  count: 1,
  templates: defaultTemplates,
  templateLabel: 'Default',

  // Actions
  setFocusMinutes: (minutes) => set({ focusMinutes: minutes }),
  setBreakMinutes: (minutes) => set({ breakMinutes: minutes }),
  setLongBreakMinutes: (minutes) => set({ longBreakMinutes: minutes }),
  setCycle: (cycle) => set({ cycle }),
  setCount: (count) => set({ count }),

  changeTemplate: (template) =>
    set({
      focusMinutes: template.focus,
      breakMinutes: template.shortBreak,
      longBreakMinutes: template.longBreak,
      cycle: template.cycle,
    }),

  setTemplates: (templates) => set({ templates }),
  setTemplateLabel: (label) => set({ templateLabel: label }),

  addTemplate: (label, template) =>
    set((state) => ({
      templates: {
        ...state.templates,
        [label]: template,
      },
    })),

  updateTemplate: (label, template) =>
    set((state) => ({
      templates: {
        ...state.templates,
        [label]: template,
      },
    })),

  deleteTemplate: (label) =>
    set((state) => {
      const newTemplates = { ...state.templates };
      delete newTemplates[label];
      return { templates: newTemplates };
    }),
}));
