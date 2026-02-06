"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import MistakeTracker from "./MistakeTracker";

interface Task {
  id: string;
  task: string;
  mood: string;
  duration: number;
  created_at: string;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

interface GoalItem {
  id: string;
  subject: string;
  title: string;
  totalSeconds: number;
  remainingSeconds: number;
  createdAt: number;
}

export default function MoodDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"today" | "week">("today");
  const [allTimeGroup] = useState<"week">("week");
  
  const [liveSeconds, setLiveSeconds] = useState<number | null>(null);
  const [liveSubject, setLiveSubject] = useState<string>("");
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [activeGoals, setActiveGoals] = useState<Record<string, string>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    fetchTasks();
  }, [timeFilter]);

  useEffect(() => {
    fetchAllTasks();
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    const loadGoals = () => {
      try {
        const rawGoals = localStorage.getItem("timer_goals_by_subject");
        const parsedGoals = rawGoals ? JSON.parse(rawGoals) : {};
        const flattened: GoalItem[] = [];
        if (parsedGoals && typeof parsedGoals === "object") {
          Object.entries(parsedGoals as Record<string, unknown>).forEach(([subject, value]) => {
            if (Array.isArray(value)) {
              value.forEach((item) => {
                if (item && typeof item === "object") {
                  const candidate = item as GoalItem;
                  flattened.push({ ...candidate, subject: candidate.subject || subject });
                }
              });
              } else if (value && typeof value === "object") {
                const candidate = value as GoalItem;
                flattened.push({ ...candidate, subject: candidate.subject || subject });
              }
          });
        }
        setGoals(flattened);
      } catch {
        setGoals([]);
      }
      try {
        const rawActive = localStorage.getItem("timer_active_goal_by_subject");
        const parsedActive = rawActive ? JSON.parse(rawActive) : {};
        setActiveGoals(parsedActive || {});
      } catch {
        setActiveGoals({});
      }
    };

    loadGoals();
    const handler = () => loadGoals();
    window.addEventListener("goals-updated", handler);
    return () => window.removeEventListener("goals-updated", handler);
  }, []);

  useEffect(() => {
    const syncLiveSession = () => {
      try {
        const running = localStorage.getItem("timer_running") === "1";
        const startedAt = localStorage.getItem("timer_started_at");
        const subject = localStorage.getItem("timer_subject");

        if (running && startedAt) {
          const elapsed = Math.floor((Date.now() - Number(startedAt)) / 1000);
          setLiveSeconds(elapsed < 0 ? 0 : elapsed);
          setLiveSubject(subject || "");
        } else {
          setLiveSeconds(null);
          setLiveSubject("");
        }
      } catch {
        setLiveSeconds(null);
        setLiveSubject("");
      }
    };

    syncLiveSession();
    const interval = window.setInterval(syncLiveSession, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

    // Time filter
    if (timeFilter === "today") {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      query = query.gte('created_at', start.toISOString());
    } else if (timeFilter === "week") {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', start.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tasks:', error);
    } else {
      const normalized = (data || []).map((t) => ({
        ...t,
        duration: Number(t.duration) || 0,
      }));
      setTasks(normalized);
    }
    setLoading(false);
  };

  const fetchAllTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all tasks:', error);
    } else {
      const normalized = (data || []).map((t) => ({
        ...t,
        duration: Number(t.duration) || 0,
      }));
      setAllTasks(normalized);
    }
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  const subjectColor = (subject: string) => {
    const found = subjects.find((s) => s.name === subject);
    return found?.color || "#64748b";
  };

  const displayGoalRemaining = (g: GoalItem) => {
    if (liveSeconds === null) return g.remainingSeconds;
    const activeId = activeGoals[g.subject];
    if (liveSubject === g.subject && activeId === g.id) {
      return Math.max(g.remainingSeconds - liveSeconds, 0);
    }
    return g.remainingSeconds;
  };

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .order("name");
    if (!error && data) {
      setSubjects(data as Subject[]);
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  const renderGoalsSection = () => (
    <div className="bg-white p-6 rounded-xl shadow">
      <h3 className="text-2xl font-semibold mb-6 text-[#0b2b26]">🎯 Goals</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-emerald-700 font-semibold mb-3">Doing</div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {[...doingGoals]
              .sort((a, b) => {
                const aActive = activeGoals[a.subject] === a.id ? 1 : 0;
                const bActive = activeGoals[b.subject] === b.id ? 1 : 0;
                if (aActive !== bActive) return bActive - aActive;
                return b.createdAt - a.createdAt;
              })
              .map((g) => {
              const isActive = activeGoals[g.subject] === g.id;
              const remaining = displayGoalRemaining(g);
              return (
                <div
                  key={g.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    isActive ? "border-emerald-400 bg-white" : "border-emerald-200 bg-emerald-100/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subjectColor(g.subject) }} />
                    <div className="text-sm">
                      <div className="font-medium text-[#0b2b26]">{g.title}</div>
                      <div className="text-xs text-[#1e3a34]">{g.subject}</div>
                      <div className="text-xs text-emerald-700">
                        Remaining {formatTime(remaining)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!doingGoals.length && <div className="text-sm text-emerald-700">No active goals</div>}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-slate-700 font-semibold mb-3">Completed</div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {[...completedGoals]
              .sort((a, b) => {
                const aActive = activeGoals[a.subject] === a.id ? 1 : 0;
                const bActive = activeGoals[b.subject] === b.id ? 1 : 0;
                if (aActive !== bActive) return bActive - aActive;
                return b.createdAt - a.createdAt;
              })
              .map((g) => {
              const isActive = activeGoals[g.subject] === g.id;
              return (
                <div
                  key={g.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    isActive ? "border-slate-400 bg-white" : "border-slate-200 bg-slate-100/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subjectColor(g.subject) }} />
                    <div className="text-sm">
                      <div className="font-medium text-[#0b2b26]">{g.title}</div>
                      <div className="text-xs text-[#1e3a34]">{g.subject}</div>
                      <div className="text-xs text-slate-600">Total {formatTime(g.totalSeconds)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!completedGoals.length && <div className="text-sm text-slate-600">No completed goals</div>}
          </div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-rose-700 font-semibold mb-3">Expired</div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {[...expiredGoals]
              .sort((a, b) => {
                const aActive = activeGoals[a.subject] === a.id ? 1 : 0;
                const bActive = activeGoals[b.subject] === b.id ? 1 : 0;
                if (aActive !== bActive) return bActive - aActive;
                return b.createdAt - a.createdAt;
              })
              .map((g) => {
              const isActive = activeGoals[g.subject] === g.id;
              const remaining = displayGoalRemaining(g);
              return (
                <div
                  key={g.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    isActive ? "border-rose-400 bg-white" : "border-rose-200 bg-rose-100/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subjectColor(g.subject) }} />
                    <div className="text-sm">
                      <div className="font-medium text-[#0b2b26]">{g.title}</div>
                      <div className="text-xs text-[#1e3a34]">{g.subject}</div>
                      <div className="text-xs text-rose-700">
                        Remaining {formatTime(remaining)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!expiredGoals.length && <div className="text-sm text-rose-700">No expired goals</div>}
          </div>
        </div>
      </div>
    </div>
  );

  if (!tasks.length) {
    return (
      <div className="space-y-8">
        <p className="text-gray-400 text-center py-8">No data yet. Start tracking!</p>

        {liveSeconds !== null && (
            <div className="bg-white p-6 rounded-xl shadow border-2 border-emerald-200">
              <div className="flex items-center justify-between mb-2 text-emerald-900">
              <h3 className="text-xl font-semibold">🟢 Live Session</h3>
              
            </div>
            <div className="text-sm text-gray-600 mb-2">
              {liveSubject || "No subject selected"}
            </div>
              <div className="text-3xl font-bold text-emerald-900">
                {formatDuration(liveSeconds)}
              </div>
            </div>
        )}

        {renderGoalsSection()}
        
        {/* Mistake Tracker бүр харагдана */}
        <div className="border-t-4 border-orange-300 pt-8">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-2 text-[#0b2b26]">
          ⚠️ Mistake Tracker
        </h2>
          <MistakeTracker timeFilter={timeFilter} />
        </div>
      </div>
    );
  }

  const filterAllTimeTasks = () => {
    if (timeFilter === "week") {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return allTasks.filter((t) => new Date(t.created_at) >= start);
    }
    return allTasks;
  };

  const displayTasks = timeFilter === "week" ? filterAllTimeTasks() : tasks;
  const totalDurationSeconds = tasks.reduce((sum, t) => sum + t.duration, 0);
  const totalSelectedSeconds = displayTasks.reduce((sum, t) => sum + t.duration, 0);
  const allTimeLabel = timeFilter === "week" ? "Last 7 Days Total" : "Last 24 Hours Total";
  const allTimeSubLabel = timeFilter === "week" ? "Last 7 days" : "Last 24 hours";

  const periodLabel = timeFilter === "today" ? "Сүүлийн 24 цагийн" : "Сүүлийн 7 хоногийн";

  const normalizeMood = (mood: string) => {
    const trimmed = (mood || "").trim();
    if (!trimmed) return "";
    const map: Record<string, string> = {
      "🙂": "😊",
      "😐": "😐",
      "😵": "😫",
      "😔": "😔",
      "😫": "😫",
      "😴": "😴",
      // legacy mojibake
      "ðŸ™‚": "😊",
      "ðŸ˜": "😐",
      "ðŸ˜µ": "😫",
    };
    return map[trimmed] || trimmed;
  };

  // Mood stats (count-based) - ignore in-progress sessions
  const moodStats = displayTasks.reduce((acc: Record<string, number>, t) => {
    if (!t.duration || t.duration <= 0) return acc;
    const moodKey = normalizeMood(t.mood || "");
    if (!moodKey) return acc;
    acc[moodKey] = (acc[moodKey] || 0) + 1;
    return acc;
  }, {});

  const totalMoodCount = Object.values(moodStats).reduce((a: number, b: number) => a + b, 0);

  const moodColors: Record<string, string> = {
    "😊": "#10b981",
    "😐": "#f59e0b",
    "😔": "#3b82f6",
    "😫": "#f97316",
    "😴": "#8b5cf6",
  };

  // Analytics (based on all tasks)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const byDay = allTasks.reduce((acc: Record<string, number>, t) => {
    const d = new Date(t.created_at);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    acc[key] = (acc[key] || 0) + t.duration;
    return acc;
  }, {});

  const getWeekRange = (base: Date) => {
    const day = base.getDay();
    const diff = (day + 6) % 7;
    const monday = new Date(base);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(base.getDate() - diff);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return { monday, nextMonday };
  };

  const getCurrentWeekTotal = () => {
    const { monday, nextMonday } = getWeekRange(new Date());
    return allTasks.reduce((sum, t) => {
      const dt = new Date(t.created_at);
      return dt >= monday && dt < nextMonday ? sum + t.duration : sum;
    }, 0);
  };


  const activityDays = new Set(
    allTasks
      .filter((t) => t.duration > 0)
      .map((t) => {
        const d = new Date(t.created_at);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().slice(0, 10);
      })
  );

  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activityDays.has(key)) {
      streak += 1;
    } else {
      break;
    }
  }

  // Subject stats
  const subjectStats = displayTasks.reduce((acc: Record<string, number>, t) => {
    acc[t.task] = (acc[t.task] || 0) + t.duration;
    return acc;
  }, {});

  const topSubjects = Object.entries(subjectStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topMoodEntry = Object.entries(moodStats).sort(([, a], [, b]) => b - a)[0];
  const topMood = topMoodEntry ? topMoodEntry[0] : "—";
  const avgSeconds = displayTasks.length ? Math.floor(totalSelectedSeconds / displayTasks.length) : 0;
  const topSubject = topSubjects[0]?.[0] ?? "—";

  const getAllTimeTrend = (source: Task[]) => {
    const buckets: Record<string, number> = {};

    source.forEach((t) => {
      const d = new Date(t.created_at);
      let key = "";
      if (allTimeGroup === "week" || allTimeGroup === "month") {
        d.setHours(0, 0, 0, 0);
        key = d.toISOString().slice(0, 10);
      } else {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        key = `${y}-${m}`;
      }
      buckets[key] = (buckets[key] || 0) + t.duration;
    });

    const keys = Object.keys(buckets).sort();
    const limit = allTimeGroup === "week" ? 7 : allTimeGroup === "month" ? 31 : 12;
    const sliced = keys.slice(-limit);
    return sliced.map((key) => ({ key, seconds: buckets[key] || 0 }));
  };

  const trendData =
    timeFilter === "week"
      ? getAllTimeTrend(displayTasks).map((x) => ({
          key: x.key,
          seconds: x.seconds,
          label: new Date(x.key).toLocaleDateString("en-US", { weekday: "short" }),
        }))
      : last7Days.map((d) => ({
          key: d.toISOString().slice(0, 10),
          seconds: byDay[d.toISOString().slice(0, 10)] || 0,
          label: d.toLocaleDateString("en-US", { weekday: "short" }),
        }));
  const trendMax = Math.max(...trendData.map((x) => x.seconds), 1);
  const nowMs = Date.now();
  const completedGoals = goals.filter((g) => g.remainingSeconds <= 0);
  const expiredGoals = goals.filter(
    (g) => g.remainingSeconds > 0 && nowMs > g.createdAt + 24 * 60 * 60 * 1000
  );
  const doingGoals = goals.filter(
    (g) => g.remainingSeconds > 0 && !(nowMs > g.createdAt + 24 * 60 * 60 * 1000)
  );

  return (
    <div className="space-y-8">
      {liveSeconds !== null && (
        <div className="bg-white p-6 rounded-xl shadow border-2 border-emerald-200">
          <div className="flex items-center justify-between mb-2 text-emerald-900">
            <h3 className="text-xl font-semibold">🟢 Live Session</h3>
            
          </div>
          <div className="text-sm text-gray-600 mb-2">
            {liveSubject || "No subject selected"}
          </div>
          <div className="text-3xl font-bold text-emerald-900">
            {formatDuration(liveSeconds)}
          </div>
        </div>
      )}
      {/* Time Filter */}
      <div className="flex gap-2 justify-center">
        {(["today", "week"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setTimeFilter(filter)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              timeFilter === filter
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {filter === "today" ? "Today" : "Week"}
          </button>
        ))}
      </div>
      {timeFilter === "week" && (
        <div className="flex justify-center">
          <div className="text-sm text-gray-500">Last 7 days</div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow">
          <div className="text-blue-600 text-sm font-medium mb-1">{periodLabel} нийт хугацаа</div>
          <div className="text-3xl font-bold text-blue-900">
            {timeFilter === "today" ? formatTime(totalDurationSeconds) : formatTime(totalSelectedSeconds)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow">
          <div className="text-green-600 text-sm font-medium mb-1">{periodLabel} сешн</div>
          <div className="text-3xl font-bold text-green-900">{displayTasks.length}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow">
          <div className="text-purple-600 text-sm font-medium mb-1">{periodLabel} top mood</div>
          <div className="text-3xl font-bold text-purple-900">{topMood}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl shadow">
          <div className="text-amber-700 text-sm font-medium mb-1">{periodLabel} дундаж сешн</div>
          <div className="text-3xl font-bold text-amber-900">{formatTime(avgSeconds)}</div>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-rose-100 p-6 rounded-xl shadow">
          <div className="text-rose-700 text-sm font-medium mb-1">{periodLabel} top subject</div>
          <div className="text-2xl font-bold text-rose-900 truncate">{topSubject}</div>
        </div>
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-xl shadow">
          <div className="text-slate-600 text-sm font-medium mb-2">{periodLabel} mood count</div>
          <div className="flex flex-wrap gap-3 text-2xl font-bold text-slate-900">
            {Object.entries(moodStats)
              .sort(([, a], [, b]) => b - a)
              .map(([mood, count]) => (
                <span key={mood}>
                  {mood} {count}
                </span>
              ))}
            {!Object.keys(moodStats).length && <span>—</span>}
          </div>
        </div>
      </div>

      {/* Analytics Highlights */}
      <div className={`grid gap-4 ${timeFilter === "today" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="text-sm text-gray-500 mb-1">Study Streak</div>
          <div className="text-3xl font-bold text-orange-600">{streak} day{streak === 1 ? "" : "s"}</div>
          <div className="text-xs text-gray-400 mt-1">Consecutive days studied</div>
        </div>
        {timeFilter !== "today" && (
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="text-sm text-gray-500 mb-1">
              {allTimeLabel}
            </div>
            <div className="text-3xl font-bold text-indigo-700">
              {formatTime(totalSelectedSeconds)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {allTimeSubLabel}
            </div>
          </div>
        )}
      </div>

      {/* 7-Day Activity Bar */}

      {/* Top Subjects */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="text-2xl font-semibold mb-6 text-[#0b2b26]">📚 Top Subjects</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
          {topSubjects.map(([subject, seconds], index) => {
            const maxDuration = topSubjects[0][1];
            const percentage = (seconds / maxDuration) * 100;
            return (
              <div key={subject} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-[#0b2b26]">{subject}</span>
                    <span className="text-[#1e3a34]">{formatDuration(seconds)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Goals */}
      {renderGoalsSection()}

      {/* Pie Chart - Mood Distribution */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="text-2xl font-semibold mb-6 text-[#0b2b26]">🥧 Mood Distribution</h3>
        <div className="flex items-center justify-center">
          <div className="relative w-64 h-64">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {Object.entries(moodStats)
                .sort(([, a], [, b]) => b - a)
                .reduce(
                  (acc, [mood, count], index) => {
                    const percentage = (count / totalMoodCount) * 100;
                    const angle = (percentage / 100) * 360;
                    const startAngle = acc.currentAngle;
                    const endAngle = startAngle + angle;

                    const x1 = 50 + 40 * Math.cos((Math.PI * startAngle) / 180);
                    const y1 = 50 + 40 * Math.sin((Math.PI * startAngle) / 180);
                    const x2 = 50 + 40 * Math.cos((Math.PI * endAngle) / 180);
                    const y2 = 50 + 40 * Math.sin((Math.PI * endAngle) / 180);

                    const largeArc = angle > 180 ? 1 : 0;

                    const color = moodColors[mood] ?? "#94a3b8";

                    acc.elements.push(
                      <path
                        key={mood}
                        d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                        fill={color}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    );

                    acc.currentAngle = endAngle;
                    return acc;
                  },
                  { elements: [] as React.ReactNode[], currentAngle: 0 }
                ).elements}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold">{displayTasks.length}</div>
                <div className="text-sm text-gray-500">sessions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 mt-6">
              {Object.entries(moodStats)
                .sort(([, a], [, b]) => b - a)
                .map(([mood, count]) => {
                  const percentage = (count / totalMoodCount) * 100;
                  const color = moodColors[mood] ?? "#94a3b8";
                  return (
                    <div key={mood} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: color }}></div>
                      <span className="text-lg">{mood}</span>
                      <span className="text-sm text-gray-500">({percentage.toFixed(0)}%)</span>
                    </div>
                  );
                })}
        </div>
      </div>

      {/* Mistake Tracker Section */}
      <div className="border-t-4 border-orange-300 pt-8">
        <h2 className="text-3xl font-bold mb-6 flex items-center gap-2 text-[#0b2b26]">
          ⚠️ Mistake Tracker
        </h2>
        <MistakeTracker timeFilter={timeFilter} />
      </div>
    </div>
  );
}



















