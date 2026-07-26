import {
  profileApi,
  sessionsApi,
  syncApi,
  templatesApi,
  type ApiSessionEvent,
  type ApiTemplateSnapshot,
  type ApiUserProfile,
  type SyncInput,
  type SyncOutput,
} from "@/lib/api";
import {
  aggregateLegacyEvents,
  type LegacyCompletedEvent,
  type LegacyExtendedEvent,
  type LegacySkippedEvent,
  type SessionRecord,
  type TemplateSnapshot,
} from "@/lib/sessionHistory";
import {
  usePreferencesStore,
  useSessionHistoryStore,
  useSettingsStore,
  type Template,
  type Templates,
} from "@/store";

const PROFILE_SYNC_DEBOUNCE_MS = 300;

let writeThroughPaused = 0;
let templateIdByLabel = new Map<string, number>();
let syncedSessionClientIds = new Set<string>();
let profileSyncTimer: ReturnType<typeof setTimeout> | null = null;

function logSyncError(context: string, error: unknown): void {
  console.error(`[sync] ${context}`, error);
}

function pauseWriteThrough(): void {
  writeThroughPaused += 1;
}

function resumeWriteThrough(): void {
  writeThroughPaused = Math.max(0, writeThroughPaused - 1);
}

function isWriteThroughPaused(): boolean {
  return writeThroughPaused > 0;
}

function templatesEqual(left: Template, right: Template): boolean {
  return (
    left.focus === right.focus &&
    left.shortBreak === right.shortBreak &&
    left.longBreak === right.longBreak &&
    left.cycle === right.cycle
  );
}

function toApiTemplateSnapshot(
  snapshot: TemplateSnapshot | null,
): ApiTemplateSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    focus_minutes: snapshot.focusMinutes,
    break_minutes: snapshot.breakMinutes,
    long_break_minutes: snapshot.longBreakMinutes,
    cycle: snapshot.cycle,
  };
}

function fromApiTemplateSnapshot(
  snapshot: ApiTemplateSnapshot | null | undefined,
): TemplateSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    focusMinutes: snapshot.focus_minutes,
    breakMinutes: snapshot.break_minutes,
    longBreakMinutes: snapshot.long_break_minutes,
    cycle: snapshot.cycle,
  };
}

function sessionRecordToSyncInput(session: SessionRecord): NonNullable<
  SyncInput["sessions"]
>[number] {
  return {
    event_type: session.outcome,
    mode: session.mode,
    template_label: session.templateLabel,
    session_count: session.sessionCount,
    duration_seconds: session.durationSeconds,
    extension_count: session.extensionCount,
    minutes_extended: session.minutesExtended,
    planned_seconds: session.plannedSeconds,
    pause_count: session.pauseCount,
    paused_seconds: session.pausedSeconds,
    started_at:
      session.startedAt != null
        ? new Date(session.startedAt).toISOString()
        : null,
    template_snapshot: toApiTemplateSnapshot(session.templateSnapshot),
    client_id: session.id,
    occurred_at: new Date(session.timestamp).toISOString(),
  };
}

function buildLocalSnapshot(): SyncInput {
  const settings = useSettingsStore.getState();
  const preferences = usePreferencesStore.getState();
  const history = useSessionHistoryStore.getState();

  const templates: SyncInput["templates"] = {};
  for (const [label, template] of Object.entries(settings.templates)) {
    templates[label] = {
      focus: template.focus,
      short_break: template.shortBreak,
      long_break: template.longBreak,
      cycle: template.cycle,
    };
  }

  return {
    profile: {
      focus_minutes: settings.focusMinutes,
      break_minutes: settings.breakMinutes,
      long_break_minutes: settings.longBreakMinutes,
      cycle: settings.cycle,
      active_template_label: settings.templateLabel,
      theme: preferences.theme,
      sound_enabled: preferences.soundEnabled,
    },
    templates,
    sessions: history.sessions.map(sessionRecordToSyncInput),
  };
}

/** Unified terminal events carry extension_count (even when 0). */
function isUnifiedSessionEvent(session: ApiSessionEvent): boolean {
  return (
    session.event_type === "stopped" ||
    typeof session.extension_count === "number"
  );
}

function mapUnifiedSession(session: ApiSessionEvent): SessionRecord | null {
  if (
    session.event_type !== "completed" &&
    session.event_type !== "skipped" &&
    session.event_type !== "stopped"
  ) {
    return null;
  }

  if (session.duration_seconds == null) {
    return null;
  }

  return {
    id: session.client_id,
    mode: session.mode,
    templateLabel: session.template_label,
    sessionCount: session.session_count,
    outcome: session.event_type,
    durationSeconds: session.duration_seconds,
    plannedSeconds: session.planned_seconds ?? 0,
    extensionCount: session.extension_count ?? 0,
    minutesExtended: session.minutes_extended ?? 0,
    pauseCount: session.pause_count ?? 0,
    pausedSeconds: session.paused_seconds ?? 0,
    startedAt:
      session.started_at != null
        ? new Date(session.started_at).getTime()
        : null,
    timestamp: new Date(session.occurred_at).getTime(),
    templateSnapshot: fromApiTemplateSnapshot(session.template_snapshot),
  };
}

function mapSessionsFromBackend(
  sessions: ApiSessionEvent[],
): Pick<ReturnType<typeof useSessionHistoryStore.getState>, "sessions"> {
  const unified: SessionRecord[] = [];
  const legacyCompleted: LegacyCompletedEvent[] = [];
  const legacySkipped: LegacySkippedEvent[] = [];
  const legacyExtended: LegacyExtendedEvent[] = [];

  for (const session of sessions) {
    if (isUnifiedSessionEvent(session)) {
      const mapped = mapUnifiedSession(session);
      if (mapped) {
        unified.push(mapped);
      }
      continue;
    }

    const base = {
      id: session.client_id,
      mode: session.mode,
      templateLabel: session.template_label,
      sessionCount: session.session_count,
      timestamp: new Date(session.occurred_at).getTime(),
    };

    if (session.event_type === "completed" && session.duration_seconds != null) {
      legacyCompleted.push({
        ...base,
        durationSeconds: session.duration_seconds,
      });
      continue;
    }

    if (session.event_type === "skipped" && session.duration_seconds != null) {
      legacySkipped.push({
        ...base,
        durationSeconds: session.duration_seconds,
      });
      continue;
    }

    if (session.event_type === "extended" && session.minutes_added != null) {
      legacyExtended.push({
        ...base,
        minutesAdded: session.minutes_added,
      });
    }
  }

  const aggregated = aggregateLegacyEvents({
    completed: legacyCompleted,
    skipped: legacySkipped,
    extended: legacyExtended,
  });

  return {
    sessions: [...unified, ...aggregated].sort(
      (left, right) => right.timestamp - left.timestamp,
    ),
  };
}

function hydrateFromSyncOutput(data: SyncOutput): void {
  pauseWriteThrough();
  try {
    const templates: Templates = {};
    const nextTemplateIds = new Map<string, number>();

    for (const template of data.templates) {
      templates[template.label] = {
        focus: template.focus,
        shortBreak: template.short_break,
        longBreak: template.long_break,
        cycle: template.cycle,
      };
      nextTemplateIds.set(template.label, template.id);
    }

    templateIdByLabel = nextTemplateIds;

    const profile = data.profile;
    useSettingsStore.setState({
      focusMinutes: profile.focus_minutes,
      breakMinutes: profile.break_minutes,
      longBreakMinutes: profile.long_break_minutes,
      cycle: profile.cycle,
      templateLabel: profile.active_template_label,
      templates,
    });

    usePreferencesStore.setState({
      theme: profile.theme,
      soundEnabled: profile.sound_enabled,
    });

    syncedSessionClientIds = new Set(data.sessions.map((session) => session.client_id));
    useSessionHistoryStore.setState(mapSessionsFromBackend(data.sessions));
  } finally {
    resumeWriteThrough();
  }
}

export async function performInitialSync(): Promise<void> {
  const snapshot = buildLocalSnapshot();
  const merged = await syncApi.push(snapshot);
  hydrateFromSyncOutput(merged);
}

function buildProfilePayload(): ApiUserProfile {
  const settings = useSettingsStore.getState();
  const preferences = usePreferencesStore.getState();

  return {
    focus_minutes: settings.focusMinutes,
    break_minutes: settings.breakMinutes,
    long_break_minutes: settings.longBreakMinutes,
    cycle: settings.cycle,
    active_template_label: settings.templateLabel,
    theme: preferences.theme,
    sound_enabled: preferences.soundEnabled,
  };
}

function scheduleProfileSync(): void {
  if (isWriteThroughPaused()) {
    return;
  }

  if (profileSyncTimer) {
    clearTimeout(profileSyncTimer);
  }

  profileSyncTimer = setTimeout(() => {
    profileSyncTimer = null;
    void profileApi.update(buildProfilePayload()).catch((error) => {
      logSyncError("profile update failed", error);
    });
  }, PROFILE_SYNC_DEBOUNCE_MS);
}

async function syncTemplateChanges(
  previous: Templates,
  current: Templates,
): Promise<void> {
  const previousLabels = new Set(Object.keys(previous));
  const currentLabels = new Set(Object.keys(current));

  for (const label of previousLabels) {
    if (currentLabels.has(label)) {
      continue;
    }

    const templateId = templateIdByLabel.get(label);
    if (!templateId) {
      continue;
    }

    try {
      await templatesApi.delete(templateId);
      templateIdByLabel.delete(label);
    } catch (error) {
      logSyncError(`delete template "${label}" failed`, error);
    }
  }

  for (const label of currentLabels) {
    const template = current[label];
    const previousTemplate = previous[label];

    if (!previousTemplate) {
      try {
        const created = await templatesApi.create({
          label,
          focus: template.focus,
          short_break: template.shortBreak,
          long_break: template.longBreak,
          cycle: template.cycle,
        });
        templateIdByLabel.set(label, created.id);
      } catch (error) {
        logSyncError(`create template "${label}" failed`, error);
      }
      continue;
    }

    if (templatesEqual(previousTemplate, template)) {
      continue;
    }

    const templateId = templateIdByLabel.get(label);
    if (!templateId) {
      continue;
    }

    try {
      await templatesApi.update(templateId, {
        focus: template.focus,
        short_break: template.shortBreak,
        long_break: template.longBreak,
        cycle: template.cycle,
      });
    } catch (error) {
      logSyncError(`update template "${label}" failed`, error);
    }
  }
}

function postSessionEvent(session: SessionRecord): void {
  const payload = sessionRecordToSyncInput(session);

  void sessionsApi.create(payload).catch((error) => {
    logSyncError(`create ${session.outcome} session failed`, error);
    syncedSessionClientIds.delete(session.id);
  });
}

function syncNewSessions(
  current: SessionRecord[],
  previous: SessionRecord[],
): void {
  if (isWriteThroughPaused()) {
    return;
  }

  const previousIds = new Set(previous.map((session) => session.id));

  for (const session of current) {
    if (previousIds.has(session.id) || syncedSessionClientIds.has(session.id)) {
      continue;
    }

    syncedSessionClientIds.add(session.id);
    postSessionEvent(session);
  }
}

function profileFieldsChanged(
  state: ReturnType<typeof useSettingsStore.getState>,
  previous: ReturnType<typeof useSettingsStore.getState>,
): boolean {
  return (
    state.focusMinutes !== previous.focusMinutes ||
    state.breakMinutes !== previous.breakMinutes ||
    state.longBreakMinutes !== previous.longBreakMinutes ||
    state.cycle !== previous.cycle ||
    state.templateLabel !== previous.templateLabel
  );
}

export function setupWriteThrough(): () => void {
  const unsubscribeSettings = useSettingsStore.subscribe((state, previous) => {
    if (state.templates !== previous.templates) {
      void syncTemplateChanges(previous.templates, state.templates);
    }

    if (profileFieldsChanged(state, previous)) {
      scheduleProfileSync();
    }
  });

  const unsubscribePreferences = usePreferencesStore.subscribe(
    (state, previous) => {
      if (
        state.theme !== previous.theme ||
        state.soundEnabled !== previous.soundEnabled
      ) {
        scheduleProfileSync();
      }
    },
  );

  const unsubscribeHistory = useSessionHistoryStore.subscribe(
    (state, previous) => {
      syncNewSessions(state.sessions, previous.sessions);
    },
  );

  return () => {
    unsubscribeSettings();
    unsubscribePreferences();
    unsubscribeHistory();

    if (profileSyncTimer) {
      clearTimeout(profileSyncTimer);
      profileSyncTimer = null;
    }
  };
}

export function teardownSync(): void {
  templateIdByLabel = new Map();
  syncedSessionClientIds = new Set();

  if (profileSyncTimer) {
    clearTimeout(profileSyncTimer);
    profileSyncTimer = null;
  }
}

export async function bootstrapSync(): Promise<() => void> {
  await performInitialSync();
  return setupWriteThrough();
}
