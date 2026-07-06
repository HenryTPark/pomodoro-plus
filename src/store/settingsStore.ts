import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLocalStorage, persistOptions, STORAGE_KEYS } from '@/lib/storage';

export interface Template {
  focus: number;
  shortBreak: number;
  longBreak: number;
  cycle: number;
}

export interface Templates {
  [key: string]: Template;
}

export const MAX_TEMPLATES = 10;

interface SettingsState {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  cycle: number;
  templates: Templates;
  templateLabel: string;

  setFocusMinutes: (minutes: number) => void;
  setBreakMinutes: (minutes: number) => void;
  setLongBreakMinutes: (minutes: number) => void;
  setCycle: (cycle: number) => void;

  changeTemplate: (template: Template) => void;
  setTemplates: (templates: Templates) => void;
  setTemplateLabel: (label: string) => void;

  addTemplate: (label: string, template: Template) => void;
  updateTemplate: (label: string, template: Template) => void;
  deleteTemplate: (label: string) => void;
}

export const defaultTemplates: Templates = {
  Classic: {
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    cycle: 4,
  },
  'Deep Work': {
    focus: 52,
    shortBreak: 17,
    longBreak: 30,
    cycle: 2,
  },
  Ultradian: {
    focus: 90,
    shortBreak: 20,
    longBreak: 30,
    cycle: 2,
  },
  'Quick Sprints': {
    focus: 15,
    shortBreak: 3,
    longBreak: 10,
    cycle: 4,
  },
  Animedoro: {
    focus: 40,
    shortBreak: 20,
    longBreak: 30,
    cycle: 3,
  },
};

type PersistedSettings = Pick<
  SettingsState,
  | 'focusMinutes'
  | 'breakMinutes'
  | 'longBreakMinutes'
  | 'cycle'
  | 'templates'
  | 'templateLabel'
>;

function normalizeSettings(persisted: Partial<PersistedSettings>): PersistedSettings {
  const templates = {
    ...defaultTemplates,
    ...(persisted.templates ?? {}),
  };

  const templateLabel =
    persisted.templateLabel && templates[persisted.templateLabel]
      ? persisted.templateLabel
      : 'Classic';

  const activeTemplate = templates[templateLabel];

  return {
    focusMinutes: persisted.focusMinutes ?? activeTemplate.focus,
    breakMinutes: persisted.breakMinutes ?? activeTemplate.shortBreak,
    longBreakMinutes: persisted.longBreakMinutes ?? activeTemplate.longBreak,
    cycle: persisted.cycle ?? activeTemplate.cycle,
    templates,
    templateLabel,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      focusMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 15,
      cycle: 4,
      templates: defaultTemplates,
      templateLabel: 'Classic',

      setFocusMinutes: (minutes) => set({ focusMinutes: minutes }),
      setBreakMinutes: (minutes) => set({ breakMinutes: minutes }),
      setLongBreakMinutes: (minutes) => set({ longBreakMinutes: minutes }),
      setCycle: (cycle) => set({ cycle }),

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
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: createLocalStorage<PersistedSettings>(),
      partialize: (state) => ({
        focusMinutes: state.focusMinutes,
        breakMinutes: state.breakMinutes,
        longBreakMinutes: state.longBreakMinutes,
        cycle: state.cycle,
        templates: state.templates,
        templateLabel: state.templateLabel,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeSettings(persistedState as Partial<PersistedSettings>),
      }),
      ...persistOptions,
    },
  ),
);
