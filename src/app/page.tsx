"use client";

import { useUIStore } from "@/store";
import Timer from "@/components/Timer";
import Settings from "@/components/Settings";

export default function Home() {
  const { showSettings } = useUIStore();

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      {showSettings ? <Settings /> : <Timer />}
    </div>
  );
}
