"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface TimerProps {
  onTaskComplete: () => void;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

export default function Timer({ onTaskComplete }: TimerProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [newSubject, setNewSubject] = useState("");
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showEditSubject, setShowEditSubject] = useState(false);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectColor, setEditSubjectColor] = useState("#6366f1");
  
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentMood, setCurrentMood] = useState<string>("😐");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  
  const [showMistakeModal, setShowMistakeModal] = useState(false);
  const [mistakeDescription, setMistakeDescription] = useState("");

  const writeTimerStorage = (next: {
    running: boolean;
    seconds: number;
    startedAt: number | null;
    subject: string;
    mood: string;
    taskId: string | null;
  }) => {
    try {
      localStorage.setItem("timer_running", next.running ? "1" : "0");
      if (next.startedAt === null) {
        localStorage.removeItem("timer_started_at");
      } else {
        localStorage.setItem("timer_started_at", String(next.startedAt));
      }
      localStorage.setItem("timer_seconds", String(next.seconds));
      localStorage.setItem("timer_subject", next.subject);
      localStorage.setItem("timer_mood", next.mood);
      if (next.taskId) {
        localStorage.setItem("timer_task_id", next.taskId);
      } else {
        localStorage.removeItem("timer_task_id");
      }
    } catch {
      // Ignore storage errors
    }
  };

  const clearTimerStorage = () => {
    try {
      localStorage.removeItem("timer_running");
      localStorage.removeItem("timer_started_at");
      localStorage.removeItem("timer_seconds");
      localStorage.removeItem("timer_subject");
      localStorage.removeItem("timer_mood");
      localStorage.removeItem("timer_task_id");
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    try {
      const storedRunning = localStorage.getItem("timer_running") === "1";
      const storedStartedAt = localStorage.getItem("timer_started_at");
      const storedSeconds = localStorage.getItem("timer_seconds");
      const storedSubject = localStorage.getItem("timer_subject");
      const storedMood = localStorage.getItem("timer_mood");
      const storedTaskId = localStorage.getItem("timer_task_id");

      if (storedSubject) setSelectedSubject(storedSubject);
      if (storedMood) setCurrentMood(storedMood);
      if (storedTaskId) setCurrentTaskId(storedTaskId);

      if (storedRunning && storedStartedAt) {
        startedAtRef.current = Number(storedStartedAt);
        setRunning(true);
        syncSeconds();
      } else if (storedSeconds) {
        setSeconds(Number(storedSeconds));
        setRunning(false);
        startedAtRef.current = null;
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const syncSeconds = () => {
    if (startedAtRef.current === null) return;
    const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
    setSeconds(elapsed < 0 ? 0 : elapsed);
  };

  useEffect(() => {
    let timer: number | undefined;
    if (running) {
      timer = window.setInterval(() => syncSeconds(), 1000);
    }
    return () => {
      if (timer !== undefined) clearInterval(timer);
    };
  }, [running]);

  useEffect(() => {
    const handleVisibility = () => {
      if (running) syncSeconds();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [running]);

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name');
    
    if (!error && data) {
      setSubjects(data);
      if (data.length > 0 && !selectedSubject) {
        setSelectedSubject(data[0].name);
      }
    }
  };

  const addSubject = async () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;

    const { error } = await supabase
      .from('subjects')
      .insert([{ name: trimmed, color: "#6366f1" }]);

    if (error) {
      if (error.code === '23505') {
        alert("This subject already exists!");
      } else {
        alert(`Error: ${error.message}`);
      }
    } else {
      await fetchSubjects();
      setSelectedSubject(trimmed);
      setNewSubject("");
      setShowAddSubject(false);
    }
  };

  const handleStart = async () => {
    if (!selectedSubject) return;

    startedAtRef.current = Date.now() - seconds * 1000;

    setRunning(true);
    writeTimerStorage({
      running: true,
      seconds,
      startedAt: startedAtRef.current,
      subject: selectedSubject,
      mood: currentMood,
      taskId: currentTaskId,
    });

    if (!currentTaskId) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ task: selectedSubject, mood: currentMood, duration: 0 }])
        .select()
        .single();

      if (!error && data?.id) {
        setCurrentTaskId(data.id);
        writeTimerStorage({
          running: true,
          seconds,
          startedAt: startedAtRef.current,
          subject: selectedSubject,
          mood: currentMood,
          taskId: data.id,
        });
      }
    }
  };

  const openEditSubject = () => {
    const current = subjects.find(s => s.name === selectedSubject);
    if (!current) return;
    setEditSubjectName(current.name);
    setEditSubjectColor(current.color || "#6366f1");
    setShowEditSubject(true);
  };

  const updateSubject = async () => {
    const trimmed = editSubjectName.trim();
    if (!trimmed) return;
    const current = subjects.find(s => s.name === selectedSubject);
    if (!current) return;

    const { error } = await supabase
      .from('subjects')
      .update({ name: trimmed, color: editSubjectColor })
      .eq('id', current.id);

    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }

    await fetchSubjects();
    setSelectedSubject(trimmed);
    setShowEditSubject(false);
  };

  const deleteSubject = async () => {
    const current = subjects.find(s => s.name === selectedSubject);
    if (!current) return;

    let taskCount = 0;
    const { count, error: countError } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('task', current.name);

    if (!countError && typeof count === 'number') {
      taskCount = count;
    }

    const confirmed = window.confirm(
      `Delete subject "${current.name}"? It has ${taskCount} task${taskCount === 1 ? "" : "s"}.`
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', current.id);

    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }

    const remaining = subjects.filter(s => s.id !== current.id);
    setSubjects(remaining);
    setSelectedSubject(remaining[0]?.name || "");
    setShowEditSubject(false);
  };

  const handlePause = () => {
    const elapsed = startedAtRef.current
      ? Math.floor((Date.now() - startedAtRef.current) / 1000)
      : seconds;
    const safeSeconds = elapsed < 0 ? 0 : elapsed;
    setSeconds(safeSeconds);
    setRunning(false);
    startedAtRef.current = null;
    writeTimerStorage({
      running: false,
      seconds: safeSeconds,
      startedAt: null,
      subject: selectedSubject,
      mood: currentMood,
      taskId: currentTaskId,
    });
  };

  const handleStop = async () => {
    setRunning(false);
    
    if (!selectedSubject || seconds === 0) {
      if (currentTaskId) {
        await supabase.from('tasks').delete().eq('id', currentTaskId);
      }
      setSeconds(0);
      setCurrentTaskId(null);
      startedAtRef.current = null;
      clearTimerStorage();
      return;
    }

    const finalDuration = seconds;

    if (currentTaskId) {
      const { error } = await supabase
        .from('tasks')
        .update({ duration: finalDuration, mood: currentMood })
        .eq('id', currentTaskId);
      
      if (error) {
        console.error('Error saving task:', error);
        alert(`Error: ${error.message}`);
      } else {
        onTaskComplete();
      }
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ task: selectedSubject, mood: currentMood, duration: finalDuration }])
        .select()
        .single();
      
      if (error) {
        console.error('Error saving task:', error);
        alert(`Error: ${error.message}`);
      } else {
        setCurrentTaskId(data.id);
        onTaskComplete();
      }
    }
    
    setSeconds(0);
    setCurrentMood("😐");
    setCurrentTaskId(null);
    startedAtRef.current = null;
    clearTimerStorage();
  };

  const handleMistakeLog = async () => {
    const trimmed = mistakeDescription.trim();
    if (!trimmed) {
      alert("Please describe the mistake");
      return;
    }

    let taskId = currentTaskId;
    if (!taskId) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ task: selectedSubject, mood: currentMood, duration: 0 }])
        .select()
        .single();

      if (error || !data?.id) {
        alert(`Error: ${error?.message ?? "Could not create task session"}`);
        return;
      }

      taskId = data.id;
      setCurrentTaskId(taskId);
    }

    const { error } = await supabase
      .from('mistakes')
      .insert([{
        task_id: taskId,
        subject: selectedSubject,
        mistake_description: trimmed,
        mistake_time: seconds,
      }]);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      alert("✅ Mistake logged!");
      window.dispatchEvent(new Event("mistake-updated"));
      setMistakeDescription("");
      setShowMistakeModal(false);
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const moods = ["🙂", "😐", "😵"];
  const currentColor = subjects.find(s => s.name === selectedSubject)?.color || '#6366f1';

  return (
    <div className="flex flex-col items-center">
      {/* Subject Selector */}
      <div className="w-full max-w-md mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Subject
        </label>
        <div className="flex gap-2">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            disabled={running}
            className="flex-1 p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none font-medium"
            style={{ borderColor: currentColor }}
          >
            {subjects.map(s => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddSubject(!showAddSubject)}
            disabled={running}
            className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
          >
            ➕
          </button>
          <button
            onClick={openEditSubject}
            disabled={running || !selectedSubject}
            className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
          >
            ✏️
          </button>
        </div>

        {/* Add Subject Form */}
        {showAddSubject && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border-2 border-indigo-200">
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="New subject name..."
              className="w-full p-2 border rounded-lg mb-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              onKeyPress={(e) => e.key === 'Enter' && addSubject()}
            />
            <div className="flex gap-2">
              <button
                onClick={addSubject}
                className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddSubject(false);
                  setNewSubject("");
                }}
                className="flex-1 px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showEditSubject && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={editSubjectName}
                onChange={(e) => setEditSubjectName(e.target.value)}
                placeholder="Subject name..."
                className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
              <input
                type="color"
                value={editSubjectColor}
                onChange={(e) => setEditSubjectColor(e.target.value)}
                className="w-12 h-10 p-1 border rounded-lg bg-white"
                aria-label="Subject color"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={updateSubject}
                className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                Save
              </button>
              <button
                onClick={deleteSubject}
                className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setShowEditSubject(false)}
                className="flex-1 px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subject Display */}
      <div 
        className="mb-4 px-6 py-3 rounded-full text-2xl font-bold text-white shadow-lg"
        style={{ backgroundColor: currentColor }}
      >
        {selectedSubject || "No subject selected"}
      </div>

      {/* Timer Display */}
      <div className="text-7xl font-bold mb-6 text-indigo-600">{formatTime(seconds)}</div>

      {/* Mood Selector */}
      <div className="flex gap-3 mb-6">
        {moods.map((mood) => (
          <button
            key={mood}
            onClick={() => setCurrentMood(mood)}
            className={`text-5xl p-4 rounded-xl transition ${
              currentMood === mood
                ? "bg-indigo-200 ring-4 ring-indigo-400 scale-110"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {mood}
          </button>
        ))}
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3 mb-4">
        {!running ? (
          <button
            onClick={handleStart}
            disabled={!selectedSubject}
            className="px-8 py-4 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▶ Start Timer
          </button>
        ) : (
          <>
            <button
              onClick={handlePause}
              className="px-6 py-4 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 shadow-lg transition"
            >
              ⏸ Pause
            </button>
            <button
              onClick={handleStop}
              className="px-6 py-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 shadow-lg transition"
            >
              ⏹ Stop & Save
            </button>
          </>
        )}
      </div>

      {/* Mistake Button */}
      {running && seconds > 0 && (
        <button
          onClick={() => setShowMistakeModal(true)}
          className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 flex items-center gap-2 shadow-md transition"
        >
          ⚠️ Log Mistake
        </button>
      )}

      {/* Mistake Modal - STAYS ON TOP */}
      {showMistakeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="text-2xl font-bold mb-4 text-orange-600">⚠️ Log Your Mistake</h3>
            <p className="text-sm text-gray-600 mb-4">
              Subject: <span className="font-bold">{selectedSubject}</span> | Time: <span className="font-bold text-orange-600">{formatTime(seconds)}</span>
            </p>
            <textarea
              value={mistakeDescription}
              onChange={(e) => setMistakeDescription(e.target.value)}
              placeholder="What went wrong? Be specific..."
              rows={5}
              className="w-full p-4 border-2 border-orange-300 rounded-xl focus:ring-2 focus:ring-orange-400 focus:outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleMistakeLog}
                className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-bold"
              >
                Save Mistake
              </button>
              <button
                onClick={() => {
                  setShowMistakeModal(false);
                  setMistakeDescription("");
                }}
                className="flex-1 px-6 py-3 bg-gray-200 rounded-xl hover:bg-gray-300 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
