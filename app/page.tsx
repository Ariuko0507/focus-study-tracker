"use client";

import { useState } from "react";
import Timer from "./components/Timer";
import MoodDashboard from "./components/MoodDashboard";
import Schedule from "./components/Schedule";
import Notes from "./components/Notes";
import ActivityLog from "./components/ActivityLog";

export default function Home() {
  const [activeTab, setActiveTab] = useState("timer");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTaskComplete = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-8 text-indigo-900">
          🎓 Student Focus Tracker
        </h1>

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
    </main>
  );
}