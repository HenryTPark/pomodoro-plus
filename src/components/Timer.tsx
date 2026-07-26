"use client";

import { useCallback, useEffect, useRef } from "react";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Play, Pause, StepForward, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSecondsForMode,
  usePreferencesStore,
  useSessionHistoryStore,
  useSettingsStore,
  useTimerStore,
  type TimerMode,
} from "@/store";
import TemplateLabels from "@/components/TemplateLabels";
import TagPicker from "@/components/TagPicker";

const timerContentWidth =
  "max-sm:w-[min(80vw,30dvh)] sm:w-[min(70vw,40vh)] sm:max-w-[45vh]";
const timerButtonClass = "cursor-pointer max-[360px]:h-9 max-[360px]:px-3";

export default function Timer() {
  const {
    focusMinutes,
    breakMinutes,
    longBreakMinutes,
    cycle,
  } = useSettingsStore();

  const {
    isPaused,
    mode,
    secondsLeft,
    count,
    setIsPaused,
    setMode,
    setSecondsLeft,
    setCount,
    setStartedAt,
    setPauseCount,
    setExtensionCount,
    setMinutesExtended,
    setLastActiveAt,
    recordTick,
    resetSegmentTracking,
    resetTimer,
  } = useTimerStore();

  const soundEnabled = usePreferencesStore((state) => state.soundEnabled);
  const logSession = useSessionHistoryStore((state) => state.logSession);

  // Track prior durations so we only reset the segment when settings change.
  const prevDurationsRef = useRef({
    focusMinutes,
    breakMinutes,
    longBreakMinutes,
  });

  const logCurrentSegment = useCallback(
    (outcome: "completed" | "skipped" | "stopped") => {
      const timer = useTimerStore.getState();
      const durationSeconds = timer.elapsedSeconds;
      const extensionCount = timer.extensionCount;

      if (durationSeconds === 0 && extensionCount === 0) {
        return;
      }

      const endedAt = Date.now();
      const pausedSeconds =
        timer.startedAt === null
          ? 0
          : Math.max(
              0,
              Math.round((endedAt - timer.startedAt) / 1000) - durationSeconds,
            );

      const settings = useSettingsStore.getState();
      logSession({
        mode: timer.mode,
        templateLabel: settings.templateLabel,
        tag: settings.activeTag,
        sessionCount: timer.count,
        outcome,
        durationSeconds,
        plannedSeconds: timer.plannedSeconds,
        extensionCount,
        minutesExtended: timer.minutesExtended,
        pauseCount: timer.pauseCount,
        pausedSeconds,
        startedAt: timer.startedAt,
        templateSnapshot: {
          focusMinutes: settings.focusMinutes,
          breakMinutes: settings.breakMinutes,
          longBreakMinutes: settings.longBreakMinutes,
          cycle: settings.cycle,
        },
      });
    },
    [logSession],
  );

  const playSound = useCallback(() => {
    if (!soundEnabled) {
      return;
    }

    const audioContext = new (
      window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.5,
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }, [soundEnabled]);

  const setPaused = useCallback(
    (value: boolean) => {
      const now = Date.now();
      const timer = useTimerStore.getState();

      if (!value) {
        if (timer.startedAt === null) {
          setStartedAt(now);
        }
      } else if (!timer.isPaused && timer.startedAt !== null) {
        setPauseCount(timer.pauseCount + 1);
        setLastActiveAt(now);
      }

      setIsPaused(value);
    },
    [setIsPaused, setLastActiveAt, setPauseCount, setStartedAt],
  );

  const switchMode = useCallback(
    (reason: "completed" | "skipped" = "completed") => {
      const timer = useTimerStore.getState();
      const currentMode = timer.mode;
      const currentCount = timer.count;

      logCurrentSegment(reason);

      let nextMode: TimerMode;
      let nextSeconds: number;

      if (currentMode === "focus") {
        if (currentCount === cycle) {
          nextMode = "longBreak";
          nextSeconds = longBreakMinutes * 60;
        } else {
          nextMode = "break";
          nextSeconds = breakMinutes * 60;
        }
      } else {
        nextMode = "focus";
        nextSeconds = focusMinutes * 60;

        if (currentMode === "longBreak") {
          setCount(1);
        } else {
          setCount(currentCount + 1);
        }
      }

      resetSegmentTracking(nextSeconds);
      setMode(nextMode);
      setSecondsLeft(nextSeconds);
      setIsPaused(true);
      playSound();
    },
    [
      breakMinutes,
      cycle,
      focusMinutes,
      logCurrentSegment,
      longBreakMinutes,
      playSound,
      resetSegmentTracking,
      setCount,
      setIsPaused,
      setMode,
      setSecondsLeft,
    ],
  );

  useEffect(() => {
    const durationsChanged =
      prevDurationsRef.current.focusMinutes !== focusMinutes ||
      prevDurationsRef.current.breakMinutes !== breakMinutes ||
      prevDurationsRef.current.longBreakMinutes !== longBreakMinutes;

    prevDurationsRef.current = {
      focusMinutes,
      breakMinutes,
      longBreakMinutes,
    };

    if (!durationsChanged) {
      return;
    }

    const newSeconds = getSecondsForMode(useTimerStore.getState().mode, {
      focusMinutes,
      breakMinutes,
      longBreakMinutes,
    });

    setSecondsLeft(newSeconds);
    resetSegmentTracking(newSeconds);
  }, [
    focusMinutes,
    breakMinutes,
    longBreakMinutes,
    resetSegmentTracking,
    setSecondsLeft,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const timer = useTimerStore.getState();
      if (timer.isPaused) {
        return;
      }

      if (timer.secondsLeft === 0) {
        switchMode("completed");
        return;
      }

      recordTick();
    }, 1000);

    return () => clearInterval(interval);
  }, [switchMode, recordTick]);

  const totalSeconds = getSecondsForMode(mode, {
    focusMinutes,
    breakMinutes,
    longBreakMinutes,
  });

  const percentage = Math.round((secondsLeft / totalSeconds) * 100);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const progressBarStyle = buildStyles({
    rotation: 0.25,
    strokeLinecap: "butt",
    textSize: "24px",
    pathTransitionDuration: 0.5,
    pathColor:
      mode === "focus"
        ? "var(--timer-focus)"
        : mode === "break"
          ? "var(--timer-break)"
          : "var(--timer-long-break)",
    textColor: "var(--foreground)",
    trailColor: "var(--timer-track)",
    backgroundColor: "#3e98c7",
  });

  function stop() {
    logCurrentSegment("stopped");
    resetTimer(focusMinutes * 60, "focus");
  }

  function addTime(minutesToAdd: number) {
    const timer = useTimerStore.getState();
    setSecondsLeft(timer.secondsLeft + minutesToAdd * 60);
    setExtensionCount(timer.extensionCount + 1);
    setMinutesExtended(timer.minutesExtended + minutesToAdd);
    setLastActiveAt(Date.now());
  }

  const modeLabel =
    mode === "focus" ? "Focus" : mode === "break" ? "Break" : "Long Break";

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-5 max-sm:gap-3 px-4 max-[360px]:px-2 py-4 text-foreground">
      <div className={timerContentWidth}>
        <TemplateLabels />
        <TagPicker />
      </div>

      <div className="text-center">
        <p className="whitespace-nowrap font-medium uppercase tracking-[0.24em] max-sm:tracking-[0.12em] text-muted-foreground text-[clamp(1rem,2vw,1.25rem)]">
          {modeLabel} • Session {count} of {cycle}
        </p>
      </div>

      <div className={`aspect-square w-full ${timerContentWidth}`}>
        <CircularProgressbar
          value={percentage}
          text={`${minutes}:${seconds.toString().padStart(2, "0")}`}
          styles={progressBarStyle}
        />
      </div>

      <div className="flex flex-nowrap items-center justify-center gap-2 max-[360px]:gap-1">
        <Button
          variant="outline"
          size="xl"
          onClick={() => addTime(1)}
          title="Add 1 minute"
          className={`${timerButtonClass} text-2xl font-semibold max-[360px]:text-xl`}
        >
          +1
        </Button>

        <Button
          variant="outline"
          size="xl"
          onClick={stop}
          title="Stop timer"
          className={timerButtonClass}
        >
          <Square className="size-7 max-[360px]:size-6" />
        </Button>

        {isPaused ? (
          <Button
            size="xl"
            onClick={() => setPaused(false)}
            title="Start timer"
            variant="outline"
            className={timerButtonClass}
          >
            <Play className="size-7 max-[360px]:size-6" />
          </Button>
        ) : (
          <Button
            size="xl"
            onClick={() => setPaused(true)}
            title="Pause timer"
            variant="outline"
            className={timerButtonClass}
          >
            <Pause className="size-7 max-[360px]:size-6" />
          </Button>
        )}

        <Button
          variant="outline"
          size="xl"
          onClick={() => {
            switchMode("skipped");
            setPaused(false);
          }}
          title="Skip to next session"
          className={timerButtonClass}
        >
          <StepForward className="size-7 max-[360px]:size-6" />
        </Button>

        <Button
          variant="outline"
          size="xl"
          onClick={() => addTime(5)}
          title="Add 5 minutes"
          className={`${timerButtonClass} text-2xl font-semibold max-[360px]:text-xl`}
        >
          +5
        </Button>
      </div>
    </div>
  );
}
