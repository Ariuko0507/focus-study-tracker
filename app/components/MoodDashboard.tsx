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

export default function MoodDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"today" | "all">("today");
  const [allTimeGroup, setAllTimeGroup] = useState<"week" | "month" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day + 6) % 7;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - diff);
    const yearStart = new Date(monday.getFullYear(), 0, 1);
    const days = Math.floor((monday.getTime() - yearStart.getTime()) / 86400000);
    const week = Math.floor((days + 1 + ((yearStart.getDay() + 6) % 7)) / 7) + 1;
    return `${monday.getFullYear()}-W${String(week).padStart(2, "0")}`;
  });
  const [liveSeconds, setLiveSeconds] = useState<number | null>(null);
  const [liveSubject, setLiveSubject] = useState<string>("");
  const [liveMood, setLiveMood] = useState<string>("");

  useEffect(() => {
    fetchTasks();
  }, [timeFilter]);

  useEffect(() => {
    fetchAllTasks();
  }, []);

  useEffect(() => {
    const syncLiveSession = () => {
      try {
        const running = localStorage.getItem("timer_running") === "1";
        const startedAt = localStorage.getItem("timer_started_at");
        const subject = localStorage.getItem("timer_subject");
        const mood = localStorage.getItem("timer_mood");

        if (running && startedAt) {
          const elapsed = Math.floor((Date.now() - Number(startedAt)) / 1000);
          setLiveSeconds(elapsed < 0 ? 0 : elapsed);
          setLiveSubject(subject || "");
          setLiveMood(mood || "");
        } else {
          setLiveSeconds(null);
          setLiveSubject("");
          setLiveMood("");
        }
      } catch {
        setLiveSeconds(null);
        setLiveSubject("");
        setLiveMood("");
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
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      query = query.gte('created_at', since.toISOString());
    } else if (timeFilter === "week") {
      const now = new Date();
      const day = now.getDay();
      const diff = (day + 6) % 7; // days since Monday
      const monday = new Date(now);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(now.getDate() - diff);
      const nextMonday = new Date(monday);
      nextMonday.setDate(monday.getDate() + 7);
      query = query.gte('created_at', monday.toISOString()).lt('created_at', nextMonday.toISOString());
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

  if (loading) return <div className="text-center py-8">Loading...</div>;

  if (!tasks.length) {
    return (
      <div className="space-y-8">
        <p className="text-gray-400 text-center py-8">No data yet. Start tracking!</p>

        {liveSeconds !== null && (
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold">🟢 Live Session</h3>
              <span className="text-3xl">{liveMood || "😐"}</span>
            </div>
            <div className="text-sm text-gray-600 mb-2">
              {liveSubject || "No subject selected"}
            </div>
            <div className="text-3xl font-bold text-indigo-900">
              {formatDuration(liveSeconds)}
            </div>
          </div>
        )}
        
        {/* Mistake Tracker бүр харагдана */}
        <div className="border-t-4 border-orange-300 pt-8">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
            ⚠️ Mistake Tracker
          </h2>
          <MistakeTracker />
        </div>
      </div>
    );
  }

  // Mood stats
  const moodStats = tasks.reduce((acc: Record<string, number>, t) => {
    acc[t.mood] = (acc[t.mood] || 0) + t.duration;
    return acc;
  }, {});

  const totalSeconds = Object.values(moodStats).reduce((a: number, b: number) => a + b, 0);

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

  const weeklyTotalSeconds = last7Days.reduce((sum, d) => {
    const key = d.toISOString().slice(0, 10);
    return sum + (byDay[key] || 0);
  }, 0);

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

  const getRolling24HoursTotal = () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return allTasks.reduce((sum, t) => {
      const dt = new Date(t.created_at);
      return dt >= since ? sum + t.duration : sum;
    }, 0);
  };

  const getCurrentWeekTotal = () => {
    const { monday, nextMonday } = getWeekRange(new Date());
    return allTasks.reduce((sum, t) => {
      const dt = new Date(t.created_at);
      return dt >= monday && dt < nextMonday ? sum + t.duration : sum;
    }, 0);
  };

  const getCurrentMonthTotal = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return allTasks.reduce((sum, t) => {
      const dt = new Date(t.created_at);
      return dt >= start && dt < end ? sum + t.duration : sum;
    }, 0);
  };

  const getCurrentYearTotal = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
    return allTasks.reduce((sum, t) => {
      const dt = new Date(t.created_at);
      return dt >= start && dt < end ? sum + t.duration : sum;
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
  const subjectStats = tasks.reduce((acc: Record<string, number>, t) => {
    acc[t.task] = (acc[t.task] || 0) + t.duration;
    return acc;
  }, {});

  const topSubjects = Object.entries(subjectStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

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

  const getMondayStart = (d: Date) => {
    const day = d.getDay();
    const diff = (day + 6) % 7;
    const monday = new Date(d);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(d.getDate() - diff);
    return monday;
  };

  const getAllTimeTrend = () => {
    const source = allTasks;
    const buckets: Record<string, number> = {};

    source.forEach((t) => {
      const d = new Date(t.created_at);
      let key = "";
      if (allTimeGroup === "day") {
        d.setHours(0, 0, 0, 0);
        key = d.toISOString().slice(0, 10);
      } else if (allTimeGroup === "week") {
        const monday = getMondayStart(d);
        key = monday.toISOString().slice(0, 10);
      } else if (allTimeGroup === "month") {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        key = `${y}-${m}`;
      } else {
        key = String(d.getFullYear());
      }
      buckets[key] = (buckets[key] || 0) + t.duration;
    });

    const keys = Object.keys(buckets).sort();
    const limit =
      allTimeGroup === "day" ? 30 : allTimeGroup === "week" ? 26 : allTimeGroup === "month" ? 24 : 10;
    const sliced = keys.slice(-limit);
    return sliced.map((key) => ({ key, seconds: buckets[key] || 0 }));
  };

  const trendData =
    timeFilter === "all"
      ? getAllTimeTrend().map((x) => ({ key: x.key, seconds: x.seconds, label: x.key }))
      : last7Days.map((d) => ({
          key: d.toISOString().slice(0, 10),
          seconds: byDay[d.toISOString().slice(0, 10)] || 0,
          label: d.toLocaleDateString("en-US", { weekday: "short" }),
        }));
  const trendMax = Math.max(...trendData.map((x) => x.seconds), 1);

  return (
    <div className="space-y-8">
      {liveSeconds !== null && (
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">🟢 Live Session</h3>
            <span className="text-3xl">{liveMood || "😐"}</span>
          </div>
          <div className="text-sm text-gray-600 mb-2">
            {liveSubject || "No subject selected"}
          </div>
          <div className="text-3xl font-bold text-indigo-900">
            {formatDuration(liveSeconds)}
          </div>
        </div>
      )}
      {/* Time Filter */}
      <div className="flex gap-2 justify-center">
        {(["today", "week", "all"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setTimeFilter(filter)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              timeFilter === filter
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {filter === "today"
              ? "Today"
              : filter === "week"
              ? "This Week"
              : "All Time"}
          </button>
        ))}
      </div>

      {timeFilter === "all" && (
        <div className="flex flex-wrap gap-2 justify-center">
          {(["day", "week", "month", "year"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setAllTimeGroup(g)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                allTimeGroup === g
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {g === "day" ? "Day" : g === "week" ? "Week" : g === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow">
          <div className="text-blue-600 text-sm font-medium mb-1">
            {timeFilter === "today"
              ? "Total Study Time"
              : timeFilter === "week"
              ? "This Week Total"
              : allTimeGroup === "day"
              ? "Total Study Time (24h)"
              : allTimeGroup === "week"
              ? "This Week Total"
              : allTimeGroup === "month"
              ? "This Month Total"
              : "This Year Total"}
          </div>
          <div className="text-3xl font-bold text-blue-900">
            {timeFilter === "today"
              ? formatTime(totalSeconds)
              : timeFilter === "week"
              ? formatTime(totalSeconds)
              : allTimeGroup === "day"
              ? formatTime(getRolling24HoursTotal())
              : allTimeGroup === "week"
              ? formatTime(getCurrentWeekTotal())
              : allTimeGroup === "month"
              ? formatTime(getCurrentMonthTotal())
              : formatTime(getCurrentYearTotal())}
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow">
          <div className="text-green-600 text-sm font-medium mb-1">Total Sessions</div>
          <div className="text-3xl font-bold text-green-900">{tasks.length}</div>
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
              {timeFilter === "all"
                ? allTimeGroup === "day"
                  ? "Last 24 Hours Total"
                  : allTimeGroup === "week"
                  ? "This Week Total"
                  : allTimeGroup === "month"
                  ? "This Month Total"
                  : "This Year Total"
                : "This Week Total"}
            </div>
            <div className="text-3xl font-bold text-indigo-700">
              {timeFilter === "all"
                ? allTimeGroup === "day"
                  ? formatTime(getRolling24HoursTotal())
                  : allTimeGroup === "week"
                  ? formatTime(getCurrentWeekTotal())
                  : allTimeGroup === "month"
                  ? formatTime(getCurrentMonthTotal())
                  : formatTime(getCurrentYearTotal())
                : formatTime(getCurrentWeekTotal())}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {timeFilter === "all"
                ? allTimeGroup === "day"
                  ? "Rolling 24 hours"
                  : allTimeGroup === "week"
                  ? "Monday to Sunday"
                  : allTimeGroup === "month"
                  ? "This calendar month"
                  : "This calendar year"
                : "Monday to Sunday"}
            </div>
          </div>
        )}
      </div>

      {/* 7-Day Activity Bar */}
      {timeFilter !== "today" && (
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-2xl font-semibold mb-4">
            {timeFilter === "all" ? "📈 All Time Trend" : "📈 Last 7 Days Activity"}
          </h3>
          <div className="space-y-3">
            {trendData.map((item) => {
              const pct = (item.seconds / trendMax) * 100;
              return (
                <div key={item.key} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-500">{item.label}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 bg-indigo-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-24 text-right text-xs text-gray-600">
                    {formatTime(item.seconds)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Top Subjects */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="text-2xl font-semibold mb-6">📚 Top Subjects</h3>
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
                    <span className="font-medium">{subject}</span>
                    <span className="text-gray-600">{formatDuration(seconds)}</span>
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

      {/* Recent Sessions Timeline */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h4 className="text-xl font-semibold mb-4">📝 Recent Sessions</h4>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
          {tasks.slice(0, 10).map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              <div className="text-3xl">{t.mood}</div>
              <div className="flex-1">
                <div className="font-medium">{t.task}</div>
                <div className="text-sm text-gray-500">
                  {new Date(t.created_at).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-indigo-600">{formatDuration(t.duration)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mood Analysis - Horizontal Bar Chart */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          😊 Mood Analysis
        </h3>
        <div className="space-y-4">
          {Object.entries(moodStats)
            .sort(([, a], [, b]) => b - a)
            .map(([mood, seconds]) => {
              const percentage = (seconds / totalSeconds) * 100;
              return (
                <div key={mood}>
                  <div className="flex justify-between mb-2">
                    <span className="text-2xl">{mood}</span>
                    <div className="text-right">
                      <div className="font-bold">{formatDuration(seconds)}</div>
                      <div className="text-sm text-gray-500">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="relative w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                    <div
                      className={`h-8 rounded-full transition-all duration-500 flex items-center justify-end pr-3 text-white font-medium ${
                        mood === "🙂"
                          ? "bg-gradient-to-r from-green-400 to-green-600"
                          : mood === "😐"
                          ? "bg-gradient-to-r from-yellow-400 to-yellow-600"
                          : "bg-gradient-to-r from-red-400 to-red-600"
                      }`}
                      style={{ width: `${percentage}%` }}
                    >
                      {percentage > 20 && `${percentage.toFixed(0)}%`}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Pie Chart - Mood Distribution */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="text-2xl font-semibold mb-6">🥧 Mood Distribution</h3>
        <div className="flex items-center justify-center">
          <div className="relative w-64 h-64">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {Object.entries(moodStats)
                .sort(([, a], [, b]) => b - a)
                .reduce(
                  (acc, [mood, seconds], index) => {
                    const percentage = (seconds / totalSeconds) * 100;
                    const angle = (percentage / 100) * 360;
                    const startAngle = acc.currentAngle;
                    const endAngle = startAngle + angle;

                    const x1 = 50 + 40 * Math.cos((Math.PI * startAngle) / 180);
                    const y1 = 50 + 40 * Math.sin((Math.PI * startAngle) / 180);
                    const x2 = 50 + 40 * Math.cos((Math.PI * endAngle) / 180);
                    const y2 = 50 + 40 * Math.sin((Math.PI * endAngle) / 180);

                    const largeArc = angle > 180 ? 1 : 0;

                    const color =
                      mood === "🙂"
                        ? "#10b981"
                        : mood === "😐"
                        ? "#f59e0b"
                        : "#ef4444";

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
                <div className="text-4xl font-bold">{tasks.length}</div>
                <div className="text-sm text-gray-500">sessions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 mt-6">
          {Object.entries(moodStats)
            .sort(([, a], [, b]) => b - a)
            .map(([mood, seconds]) => {
              const percentage = (seconds / totalSeconds) * 100;
              const color =
                mood === "🙂" ? "bg-green-500" : mood === "😐" ? "bg-yellow-500" : "bg-red-500";
              return (
                <div key={mood} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${color}`}></div>
                  <span className="text-lg">{mood}</span>
                  <span className="text-sm text-gray-500">({percentage.toFixed(0)}%)</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Mistake Tracker Section */}
      <div className="border-t-4 border-orange-300 pt-8">
        <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
          ⚠️ Mistake Tracker
        </h2>
        <MistakeTracker />
      </div>
    </div>
  );
}
