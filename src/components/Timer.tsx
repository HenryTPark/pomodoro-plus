"use client";

import React, { useEffect, useRef, useState } from "react";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Play, Pause, StepForward, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store";
import TemplateLabels from "@/components/TemplateLabels";

const red = "#f44336";
const green = "#43a047";
const blue = "#6f74dd";

export default function Timer() {
  const {
    focusMinutes,
    breakMinutes,
    longBreakMinutes,
    cycle,
    count,
    setCount,
  } = useSettingsStore();

  const [isPaused, setIsPaused] = useState(true);
  const [mode, setMode] = useState<"focus" | "break" | "longBreak">("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMinutes * 60);

  const secondsLeftRef = useRef(secondsLeft);
  const isPausedRef = useRef(isPaused);
  const modeRef = useRef(mode);

  function playSound() {
    // Create a simple beep sound
    const audioContext = new (
      window.AudioContext || (window as any).webkitAudioContext
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
  }

  function tick() {
    secondsLeftRef.current--;
    setSecondsLeft(secondsLeftRef.current);
  }

  function switchMode() {
    let nextMode: "focus" | "break" | "longBreak";
    let nextSeconds: number;

    if (modeRef.current === "focus") {
      if (count === cycle) {
        nextMode = "longBreak";
        nextSeconds = longBreakMinutes * 60;
      } else {
        nextMode = "break";
        nextSeconds = breakMinutes * 60;
      }
    } else {
      nextMode = "focus";
      nextSeconds = focusMinutes * 60;

      if (modeRef.current === "longBreak") {
        setCount(1);
      } else {
        setCount(count + 1);
      }
    }

    setMode(nextMode);
    modeRef.current = nextMode;

    setSecondsLeft(nextSeconds);
    secondsLeftRef.current = nextSeconds;

    setPaused(true);
    isPausedRef.current = true;

    playSound();
  }

  function setPaused(value: boolean) {
    setIsPaused(value);
    isPausedRef.current = value;
  }

  useEffect(() => {
    const newSeconds =
      mode === "focus"
        ? focusMinutes * 60
        : mode === "break"
          ? breakMinutes * 60
          : longBreakMinutes * 60;

    secondsLeftRef.current = newSeconds;
    setSecondsLeft(newSeconds);
  }, [mode, focusMinutes, breakMinutes, longBreakMinutes]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPausedRef.current) {
        return;
      }

      if (secondsLeftRef.current === 0) {
        isPausedRef.current = true;
        setIsPaused(true);
        switchMode();
        return;
      }

      tick();
    }, 1000);

    return () => clearInterval(interval);
  });

  let totalSeconds: number;
  switch (mode) {
    case "focus":
      totalSeconds = focusMinutes * 60;
      break;
    case "break":
      totalSeconds = breakMinutes * 60;
      break;
    case "longBreak":
      totalSeconds = longBreakMinutes * 60;
      break;
  }

  const percentage = Math.round((secondsLeft / totalSeconds) * 100);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const progressBarStyle = buildStyles({
    rotation: 0.25,
    strokeLinecap: "butt",
    textSize: "24px",
    pathTransitionDuration: 0.5,
    pathColor: mode === "focus" ? red : mode === "break" ? green : blue,
    textColor: "#fff",
    trailColor: "rgba(255, 255, 255, .2)",
    backgroundColor: "#3e98c7",
  });

  function stop() {
    setPaused(true);

    secondsLeftRef.current = focusMinutes * 60;
    setSecondsLeft(secondsLeftRef.current);

    setMode("focus");
    modeRef.current = "focus";

    setCount(1);
  }

  function addTime(minutes: number) {
    secondsLeftRef.current += minutes * 60;
    setSecondsLeft(secondsLeftRef.current);
  }

  const modeLabel =
    mode === "focus" ? "Focus" : mode === "break" ? "Break" : "Long Break";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 py-10 px-6 text-slate-100">
      {/* Template Selector */}
      <div className="w-full max-w-3xl flex justify-center">
        <TemplateLabels />
      </div>

      {/* Session Info */}
      <div className="text-center">
        <p className="font-medium uppercase tracking-[0.24em] text-slate-400 text-2xl">
          {modeLabel} • Session {count} of {cycle}
        </p>
      </div>

      {/* Circular Progress Bar */}
      <div className="w-80 h-80">
        <CircularProgressbar
          value={percentage}
          text={`${minutes}:${seconds.toString().padStart(2, "0")}`}
          styles={progressBarStyle}
        />
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          size="3xl"
          onClick={() => addTime(1)}
          title="Add 1 minute"
          className="text-4xl font-semibold"
        >
          +1
        </Button>

        <Button variant="outline" size="3xl" onClick={stop} title="Stop timer">
          <Square className="size-10" />
        </Button>

        {isPaused ? (
          <Button
            size="3xl"
            onClick={() => setPaused(false)}
            title="Start timer"
            variant="outline"
          >
            <Play className="size-10" />
          </Button>
        ) : (
          <Button
            size="3xl"
            onClick={() => setPaused(true)}
            title="Pause timer"
            variant="outline"
          >
            <Pause className="size-10" />
          </Button>
        )}

        <Button
          variant="outline"
          size="3xl"
          onClick={() => {
            switchMode();
            setPaused(false);
          }}
          title="Skip to next session"
        >
          <StepForward className="size-10" />
        </Button>

        <Button
          variant="outline"
          size="3xl"
          onClick={() => addTime(5)}
          title="Add 5 minutes"
          className="text-4xl font-semibold"
        >
          +5
        </Button>
      </div>
    </div>
  );
}
