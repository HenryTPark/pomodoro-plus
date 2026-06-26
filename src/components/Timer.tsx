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

const timerContentWidth = "w-[min(70vw,40vh)] max-w-[45vh]";

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
    elapsedSeconds,
    setIsPaused,
    setMode,
    setSecondsLeft,
    setCount,
    setElapsedSeconds,
  } = useTimerStore();

  const soundEnabled = usePreferencesStore((state) => state.soundEnabled);
  const logCompleted = useSessionHistoryStore((state) => state.logCompleted);
  const logSkipped = useSessionHistoryStore((state) => state.logSkipped);
  const logExtended = useSessionHistoryStore((state) => state.logExtended);

  const secondsLeftRef = useRef(secondsLeft);
  const isPausedRef = useRef(isPaused);
  const modeRef = useRef(mode);
  const countRef = useRef(count);
  const elapsedRef = useRef(elapsedSeconds);

  secondsLeftRef.current = secondsLeft;
  isPausedRef.current = isPaused;
  modeRef.current = mode;
  countRef.current = count;
  elapsedRef.current = elapsedSeconds;

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
      setIsPaused(value);
      isPausedRef.current = value;
    },
    [setIsPaused],
  );

  const tick = useCallback(() => {
    secondsLeftRef.current--;
    setSecondsLeft(secondsLeftRef.current);

    elapsedRef.current++;
    setElapsedSeconds(elapsedRef.current);
  }, [setSecondsLeft, setElapsedSeconds]);

  const switchMode = useCallback(
    (reason: "completed" | "skipped" = "completed") => {
      const templateLabel = useSettingsStore.getState().templateLabel;
      const currentMode = modeRef.current;
      const currentCount = countRef.current;
      const logPayload = {
        mode: currentMode,
        templateLabel,
        sessionCount: currentCount,
        durationSeconds: elapsedRef.current,
      };

      if (reason === "completed") {
        logCompleted(logPayload);
      } else {
        logSkipped(logPayload);
      }

      elapsedRef.current = 0;
      setElapsedSeconds(0);

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
          countRef.current = 1;
        } else {
          const nextCount = currentCount + 1;
          setCount(nextCount);
          countRef.current = nextCount;
        }
      }

      setMode(nextMode);
      modeRef.current = nextMode;

      setSecondsLeft(nextSeconds);
      secondsLeftRef.current = nextSeconds;

      setPaused(true);
      playSound();
    },
    [
      breakMinutes,
      cycle,
      focusMinutes,
      logCompleted,
      logSkipped,
      longBreakMinutes,
      playSound,
      setCount,
      setElapsedSeconds,
      setMode,
      setPaused,
      setSecondsLeft,
    ],
  );

  const prevDurations = useRef({
    focusMinutes,
    breakMinutes,
    longBreakMinutes,
  });

  useEffect(() => {
    const durationsChanged =
      prevDurations.current.focusMinutes !== focusMinutes ||
      prevDurations.current.breakMinutes !== breakMinutes ||
      prevDurations.current.longBreakMinutes !== longBreakMinutes;

    prevDurations.current = {
      focusMinutes,
      breakMinutes,
      longBreakMinutes,
    };

    if (!durationsChanged) {
      return;
    }

    const newSeconds = getSecondsForMode(modeRef.current, {
      focusMinutes,
      breakMinutes,
      longBreakMinutes,
    });

    secondsLeftRef.current = newSeconds;
    setSecondsLeft(newSeconds);

    elapsedRef.current = 0;
    setElapsedSeconds(0);
  }, [focusMinutes, breakMinutes, longBreakMinutes, setSecondsLeft, setElapsedSeconds]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPausedRef.current) {
        return;
      }

      if (secondsLeftRef.current === 0) {
        switchMode("completed");
        return;
      }

      tick();
    }, 1000);

    return () => clearInterval(interval);
  }, [switchMode, tick]);

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
    setPaused(true);

    const resetSeconds = focusMinutes * 60;
    secondsLeftRef.current = resetSeconds;
    setSecondsLeft(resetSeconds);

    setMode("focus");
    modeRef.current = "focus";

    setCount(1);
    countRef.current = 1;

    elapsedRef.current = 0;
    setElapsedSeconds(0);
  }

  function addTime(minutesToAdd: number) {
    secondsLeftRef.current += minutesToAdd * 60;
    setSecondsLeft(secondsLeftRef.current);

    logExtended({
      mode: modeRef.current,
      templateLabel: useSettingsStore.getState().templateLabel,
      sessionCount: countRef.current,
      minutesAdded: minutesToAdd,
    });
  }

  const modeLabel =
    mode === "focus" ? "Focus" : mode === "break" ? "Break" : "Long Break";

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-5 px-4 py-4 text-foreground">
      <div className={timerContentWidth}>
        <TemplateLabels />
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

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="xl"
          onClick={() => addTime(1)}
          title="Add 1 minute"
          className="text-2xl font-semibold"
        >
          +1
        </Button>

        <Button variant="outline" size="xl" onClick={stop} title="Stop timer">
          <Square className="size-7" />
        </Button>

        {isPaused ? (
          <Button
            size="xl"
            onClick={() => setPaused(false)}
            title="Start timer"
            variant="outline"
          >
            <Play className="size-7" />
          </Button>
        ) : (
          <Button
            size="xl"
            onClick={() => setPaused(true)}
            title="Pause timer"
            variant="outline"
          >
            <Pause className="size-7" />
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
        >
          <StepForward className="size-7" />
        </Button>

        <Button
          variant="outline"
          size="xl"
          onClick={() => addTime(5)}
          title="Add 5 minutes"
          className="text-2xl font-semibold"
        >
          +5
        </Button>
      </div>
    </div>
  );
}
