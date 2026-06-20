"use client";

import { useUIStore } from "@/store";
import Timer from "@/components/Timer";
import Settings from "@/components/Settings";
import History from "@/components/History";

export default function Home() {
  const { view } = useUIStore();

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      {view === "settings" ? (
        <Settings />
      ) : view === "history" ? (
        <History />
      ) : (
        <Timer />
      )}
    </div>
  );
}
