"use client";

import { useUIStore } from "@/store";
import Timer from "@/components/Timer";
import Settings from "@/components/Settings";

export default function Home() {
  const { showSettings } = useUIStore();

  return (
    <div className="w-full h-full">
      {showSettings ? <Settings /> : <Timer />}
    </div>
  );
}
