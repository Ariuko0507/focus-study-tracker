"use client";

import { useEffect, useState } from "react";
import Timer from "./components/Timer";
import MoodDashboard from "./components/MoodDashboard";
import Schedule from "./components/Schedule";
import Notes from "./components/Notes";
import ActivityLog from "./components/ActivityLog";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [activeTab, setActiveTab] = useState("timer");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showGlobalMood, setShowGlobalMood] = useState(false);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [pendingSubject, setPendingSubject] = useState("");
  const [pendingMood, setPendingMood] = useState("😐");
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const handleTaskComplete = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    const checkFinish = () => {
      const running = localStorage.getItem("timer_running") === "1";
      if (!running) return;
      const startedAtRaw = localStorage.getItem("timer_started_at");
      const goalSecondsRaw = localStorage.getItem("timer_goal_seconds");
      if (!startedAtRaw || !goalSecondsRaw) return;
      const startedAt = Number(startedAtRaw);
      const goalSeconds = Number(goalSecondsRaw);
      if (!Number.isFinite(startedAt) || !Number.isFinite(goalSeconds) || goalSeconds <= 0) return;

      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      if (elapsed < goalSeconds) return;

      if (localStorage.getItem("timer_needs_mood") === "1") return;
      localStorage.setItem("timer_needs_mood", "1");

      setPendingDuration(elapsed);
      setPendingSubject(localStorage.getItem("timer_subject") || "");
      setPendingMood(localStorage.getItem("timer_mood") || "😐");
      setPendingTaskId(localStorage.getItem("timer_task_id"));
      setShowGlobalMood(true);
    };

    checkFinish();
    const interval = window.setInterval(checkFinish, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const finalizeGlobalSave = async () => {
    if (!pendingSubject || pendingDuration === 0) {
      setShowGlobalMood(false);
      localStorage.removeItem("timer_needs_mood");
      return;
    }
    if (pendingTaskId) {
      await supabase
        .from("tasks")
        .update({ duration: pendingDuration, mood: pendingMood })
        .eq("id", pendingTaskId);
    } else {
      await supabase
        .from("tasks")
        .insert([{ task: pendingSubject, mood: pendingMood, duration: pendingDuration }]);
    }

    try {
      const rawGoals = localStorage.getItem("timer_goals_by_subject");
      const rawActive = localStorage.getItem("timer_active_goal_by_subject");
      const goalsMap = rawGoals ? JSON.parse(rawGoals) : {};
      const activeMap = rawActive ? JSON.parse(rawActive) : {};
      const list = Array.isArray(goalsMap[pendingSubject]) ? goalsMap[pendingSubject] : [];
      const activeId = activeMap?.[pendingSubject];
      const updated = list.map((g: any) =>
        g.id === activeId
          ? { ...g, remainingSeconds: Math.max((g.remainingSeconds ?? 0) - pendingDuration, 0) }
          : g
      );
      goalsMap[pendingSubject] = updated;
      localStorage.setItem("timer_goals_by_subject", JSON.stringify(goalsMap));
      window.dispatchEvent(new Event("goals-updated"));
    } catch {
      // Ignore goals update errors
    }

    localStorage.setItem("timer_running", "0");
    localStorage.removeItem("timer_started_at");
    localStorage.setItem("timer_seconds", "0");
    localStorage.removeItem("timer_task_id");
    localStorage.removeItem("timer_goal_seconds");
    localStorage.removeItem("timer_needs_mood");

    setShowGlobalMood(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-8 text-indigo-900">      🎓 Student Focus Tracker       </h1>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-6 bg-white rounded-xl p-3 shadow-lg">
          {["timer", "dashboard", "schedule", "notes", "activity"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[120px] py-3 px-4 rounded-lg font-bold transition ${
                activeTab === tab
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab === "timer" && "⏱ Timer"}
              {tab === "dashboard" && "📊 Dashboard"}
              {tab === "schedule" && "📅 Schedule"}
              {tab === "notes" && "📝 Notes"}
              {tab === "activity" && "📊 Activity"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {activeTab === "timer" && <Timer onTaskComplete={handleTaskComplete} />}
          {activeTab === "dashboard" && <MoodDashboard key={refreshKey} />}
          {activeTab === "schedule" && <Schedule />}
          {activeTab === "notes" && <Notes />}
          {activeTab === "activity" && <ActivityLog key={refreshKey} />}
        </div>
      </div>
      {showGlobalMood && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="text-2xl font-bold mb-4 text-indigo-600">Save Session Mood</h3>
            <p className="text-sm text-gray-600 mb-4">
              Subject: <span className="font-bold">{pendingSubject || "—"}</span> | Time:{" "}
              <span className="font-bold text-indigo-600">
                {Math.floor(pendingDuration / 3600)
                  .toString()
                  .padStart(2, "0")}
                :
                {Math.floor((pendingDuration % 3600) / 60)
                  .toString()
                  .padStart(2, "0")}
                :
                {Math.floor(pendingDuration % 60)
                  .toString()
                  .padStart(2, "0")}
              </span>
            </p>
            <div className="grid grid-cols-5 gap-3 mb-6">
              {["😊", "😐", "😔", "😫", "😴"].map((mood) => (
                <button
                  key={mood}
                  onClick={() => setPendingMood(mood)}
                  className={`text-4xl p-3 rounded-xl transition ${
                    pendingMood === mood
                      ? "bg-indigo-200 ring-4 ring-indigo-400 scale-110"
                      : "bg-[#cfe3d6] text-[#0b2b26] hover:bg-[#b9d3c3]"
                  }`}
                >
                  {mood}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={finalizeGlobalSave}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold"
              >
                Save Session
              </button>
              <button
                onClick={() => {
                  setShowGlobalMood(false);
                  localStorage.removeItem("timer_needs_mood");
                }}
                className="flex-1 px-6 py-3 bg-[#cfe3d6] text-[#0b2b26] rounded-xl hover:bg-[#b9d3c3] font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
