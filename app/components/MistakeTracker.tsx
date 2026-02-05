"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Mistake {
  id: string;
  subject: string;
  mistake_description: string;
  mistake_time: number;
  is_fixed: boolean;
  fixed_at: string | null;
  created_at: string;
  task_id: string | null;
  session?: {
    id: string;
    task: string;
    mood: string;
    duration: number;
    created_at: string;
  } | null;
}

export default function MistakeTracker() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "fixed" | "unfixed">("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  useEffect(() => {
    fetchMistakes();
  }, [filter]);

  const fetchMistakes = async () => {
    let query = supabase
      .from('mistakes')
      .select('*, session:task_id (id, task, mood, duration, created_at)')
      .order('created_at', { ascending: false });

    if (filter === "fixed") {
      query = query.eq('is_fixed', true);
    } else if (filter === "unfixed") {
      query = query.eq('is_fixed', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching mistakes:', error);
    } else {
      const normalized = (data || []).map((m) => ({
        ...m,
        session: m.session
          ? { ...m.session, duration: Number(m.session.duration) || 0 }
          : null,
      }));
      setMistakes(normalized);
    }
    setLoading(false);
  };

  const toggleFixed = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('mistakes')
      .update({
        is_fixed: !currentStatus,
        fixed_at: !currentStatus ? new Date().toISOString() : null,
      })
      .eq('id', id);

    if (!error) {
      window.dispatchEvent(new Event("mistake-updated"));
      fetchMistakes();
    }
  };

  const deleteMistake = async (id: string) => {
    if (!confirm("Delete this mistake?")) return;
    
    const { error } = await supabase
      .from('mistakes')
      .delete()
      .eq('id', id);

    if (!error) {
      window.dispatchEvent(new Event("mistake-updated"));
      fetchMistakes();
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  if (loading) return <div className="text-center py-8">Loading mistakes...</div>;

  const filteredMistakes = mistakes
    .filter((m) =>
      filter === "all" ? true : filter === "fixed" ? m.is_fixed : !m.is_fixed
    )
    .filter((m) => (subjectFilter === "all" ? true : m.subject === subjectFilter));

  // Statistics (global, not affected by filters)
  const totalMistakes = mistakes.length;
  const fixedMistakes = mistakes.filter(m => m.is_fixed).length;
  const unfixedMistakes = totalMistakes - fixedMistakes;
  const fixRate = totalMistakes > 0 ? (fixedMistakes / totalMistakes) * 100 : 0;

  // Subject breakdown
  const mistakesBySubject = filteredMistakes.reduce((acc: Record<string, number>, m) => {
    acc[m.subject] = (acc[m.subject] || 0) + 1;
    return acc;
  }, {});

  const subjectOptions = Array.from(
    new Set(mistakes.map((m) => m.subject))
  ).sort();

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl shadow">
          <div className="text-orange-600 text-sm font-medium mb-1">Total Mistakes</div>
          <div className="text-4xl font-bold text-orange-900">{totalMistakes}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow">
          <div className="text-green-600 text-sm font-medium mb-1">Fixed ✅</div>
          <div className="text-4xl font-bold text-green-900">{fixedMistakes}</div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl shadow">
          <div className="text-red-600 text-sm font-medium mb-1">Unfixed ⚠️</div>
          <div className="text-4xl font-bold text-red-900">{unfixedMistakes}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow">
          <div className="text-blue-600 text-sm font-medium mb-1">Fix Rate</div>
          <div className="text-4xl font-bold text-blue-900">{fixRate.toFixed(0)}%</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-2 justify-center">
        {(["all", "unfixed", "fixed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-3 rounded-lg font-medium transition ${
              filter === f
                ? "bg-orange-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "🔍 All Mistakes" : f === "fixed" ? "✅ Fixed" : "⚠️ Need to Fix"}
          </button>
        ))}
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-white text-gray-700"
        >
          <option value="all">All Subjects</option>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Mistakes by Subject Chart */}
      {Object.keys(mistakesBySubject).length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            📚 Mistakes by Subject
          </h3>
          <div className="space-y-4">
            {Object.entries(mistakesBySubject)
              .sort(([, a], [, b]) => b - a)
              .map(([subject, count]) => {
                const maxCount = Math.max(...Object.values(mistakesBySubject));
                const percentage = (count / maxCount) * 100;
                return (
                  <div key={subject}>
                    <div className="flex justify-between mb-2">
                      <span className="font-semibold text-lg">{subject}</span>
                      <span className="text-orange-600 font-bold text-lg">{count} mistake{count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-orange-400 to-orange-600 h-4 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Mistakes List */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          ⚠️ Mistake Log
        </h3>
        
        {filteredMistakes.length === 0 ? (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-12 rounded-xl text-center">
            <div className="text-6xl mb-4">🎯</div>
            <p className="text-gray-500 text-lg font-medium">
              {filter === "all" 
                ? "No mistakes logged yet. Keep learning!" 
                : filter === "fixed"
                ? "No fixed mistakes yet."
                : "No unfixed mistakes. Great job! 🎉"}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {filteredMistakes.map((m) => (
              <div
                key={m.id}
                className={`p-5 rounded-xl border-2 transition shadow-md hover:shadow-lg ${
                  m.is_fixed
                    ? "bg-green-50 border-green-300"
                    : "bg-orange-50 border-orange-300"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Subject & Time */}
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="text-2xl font-bold text-gray-800">{m.subject}</span>
                      <span className="px-3 py-1 bg-gray-200 rounded-full text-sm font-medium text-gray-600">
                        ⏱ at {formatTime(m.mistake_time)}
                      </span>
                      {m.is_fixed && (
                        <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-bold">
                          ✅ FIXED
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-gray-700 text-base mb-3 leading-relaxed">
                      {m.mistake_description}
                    </p>

                    {/* Timestamps */}
                    <div className="flex flex-col gap-1 text-xs text-gray-500">
                      <div>
                        📅 Logged: {new Date(m.created_at).toLocaleString()}
                      </div>
                      {m.session && (
                        <div className="text-indigo-600 font-medium">
                          📘 Session: {m.session.task} • {formatTime(m.session.duration)} • {m.session.mood}
                        </div>
                      )}
                      {m.is_fixed && m.fixed_at && (
                        <div className="text-green-600 font-medium">
                          ✓ Fixed: {new Date(m.fixed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toggleFixed(m.id, m.is_fixed)}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition shadow hover:shadow-md ${
                        m.is_fixed
                          ? "bg-gray-300 text-gray-700 hover:bg-gray-400"
                          : "bg-green-500 text-white hover:bg-green-600"
                      }`}
                    >
                      {m.is_fixed ? "↩️ Mark Unfixed" : "✅ Mark Fixed"}
                    </button>
                    <button
                      onClick={() => deleteMistake(m.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition shadow hover:shadow-md"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Insight */}
      {totalMistakes > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-indigo-200">
          <h4 className="text-xl font-bold text-indigo-900 mb-3">💡 Learning Insight</h4>
          <p className="text-gray-700 leading-relaxed">
            {fixRate === 100 
              ? "🎉 Amazing! You've fixed all your mistakes. Keep up the excellent work!"
              : fixRate >= 70
              ? `🌟 Great progress! You've fixed ${fixRate.toFixed(0)}% of your mistakes. Keep going!`
              : fixRate >= 40
              ? `📈 You're making progress! ${unfixedMistakes} mistake${unfixedMistakes > 1 ? 's' : ''} still need${unfixedMistakes === 1 ? 's' : ''} attention.`
              : `💪 Time to review! Focus on fixing those ${unfixedMistakes} mistake${unfixedMistakes > 1 ? 's' : ''}.`
            }
          </p>
        </div>
      )}
    </div>
  );
}
