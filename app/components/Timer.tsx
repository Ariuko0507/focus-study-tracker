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

interface GoalItem {
  id: string;
  subject: string;
  title: string;
  totalSeconds: number;
  remainingSeconds: number;
  createdAt: number;
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
  const [goalHours, setGoalHours] = useState<string>("");
  const [goalMinutes, setGoalMinutes] = useState<string>("");
  const [goalSecondsInput, setGoalSecondsInput] = useState<string>("");
  const [goalSeconds, setGoalSeconds] = useState<number | null>(null);
  const [goalTitle, setGoalTitle] = useState<string>("");
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalTitle, setEditGoalTitle] = useState<string>("");
  const [editGoalHours, setEditGoalHours] = useState<string>("");
  const [editGoalMinutes, setEditGoalMinutes] = useState<string>("");
  const [editGoalSeconds, setEditGoalSeconds] = useState<string>("");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const goalReachedRef = useRef(false);
  
  const [showMistakeModal, setShowMistakeModal] = useState(false);
  const [mistakeDescription, setMistakeDescription] = useState("");
  const [showStopMoodModal, setShowStopMoodModal] = useState(false);
  const [stopSeconds, setStopSeconds] = useState(0);

  const writeTimerStorage = (next: {
    running: boolean;
    seconds: number;
    startedAt: number | null;
    subject: string;
    mood: string;
    goalSeconds: number | null;
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
      if (next.goalSeconds !== null) {
        localStorage.setItem("timer_goal_seconds", String(next.goalSeconds));
      } else {
        localStorage.removeItem("timer_goal_seconds");
      }
      if (next.taskId) {
        localStorage.setItem("timer_task_id", next.taskId);
      } else {
        localStorage.removeItem("timer_task_id");
      }
    } catch {
      // Ignore storage errors
    }
  };

  const clearTimerStorage = (keepGoal = false) => {
    try {
      localStorage.removeItem("timer_running");
      localStorage.removeItem("timer_started_at");
      localStorage.removeItem("timer_seconds");
      localStorage.removeItem("timer_subject");
      localStorage.removeItem("timer_mood");
      if (!keepGoal) {
        localStorage.removeItem("timer_goal_seconds");
      }
      localStorage.removeItem("timer_task_id");
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const readGoalsMap = () => {
    try {
      const raw = localStorage.getItem("timer_goals_by_subject");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record<string, GoalItem[]>;
      return {};
    } catch {
      return {};
    }
  };

  const writeGoalsMap = (next: Record<string, GoalItem[]>) => {
    try {
      localStorage.setItem("timer_goals_by_subject", JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  };

  const readActiveGoalMap = () => {
    try {
      const raw = localStorage.getItem("timer_active_goal_by_subject");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
      return {};
    } catch {
      return {};
    }
  };

  const writeActiveGoalMap = (next: Record<string, string>) => {
    try {
      localStorage.setItem("timer_active_goal_by_subject", JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    try {
      const storedRunning = localStorage.getItem("timer_running") === "1";
      const storedStartedAt = localStorage.getItem("timer_started_at");
      const storedSeconds = localStorage.getItem("timer_seconds");
      const storedSubject = localStorage.getItem("timer_subject");
      const storedMood = localStorage.getItem("timer_mood");
      const storedGoalSeconds = localStorage.getItem("timer_goal_seconds");
      const storedTaskId = localStorage.getItem("timer_task_id");

      if (storedSubject) {
        setSelectedSubject(storedSubject);
      }
      if (storedMood) setCurrentMood(storedMood);
      if (storedGoalSeconds) {
        const gs = Number(storedGoalSeconds);
        if (!Number.isNaN(gs)) {
          setGoalSeconds(gs);
          const h = Math.floor(gs / 3600);
          const m = Math.floor((gs % 3600) / 60);
          const s = Math.floor(gs % 60);
          setGoalHours(h > 0 ? String(h) : "");
          setGoalMinutes(m > 0 ? String(m) : "");
          setGoalSecondsInput(s > 0 ? String(s) : "");
        }
      }
      if (storedTaskId) setCurrentTaskId(storedTaskId);

      if (storedRunning) {
        if (storedStartedAt) {
          startedAtRef.current = Number(storedStartedAt);
        } else if (storedSeconds) {
          const inferred = Date.now() - Number(storedSeconds) * 1000;
          startedAtRef.current = inferred;
          localStorage.setItem("timer_started_at", String(inferred));
        }
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

  const readGoalMap = () => {
    try {
      const raw = localStorage.getItem("timer_goal_by_subject");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record<string, number>;
      return {};
    } catch {
      return {};
    }
  };

  const writeGoalMap = (next: Record<string, number>) => {
    try {
      localStorage.setItem("timer_goal_by_subject", JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    if (!selectedSubject) return;
    const goalsMap = readGoalsMap();
    const list = goalsMap[selectedSubject] || [];
    setGoals(list);
    setActiveGoalId(null);
    setGoalSeconds(null);
    const activeMap = readActiveGoalMap();
    if (activeMap[selectedSubject]) {
      delete activeMap[selectedSubject];
      writeActiveGoalMap(activeMap);
    }
    setGoalHours("");
    setGoalMinutes("");
    setGoalSecondsInput("");
    setGoalTitle("");
    goalReachedRef.current = false;
  }, [selectedSubject]);

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
    if (!running || goalSeconds === null) {
      goalReachedRef.current = false;
      return;
    }
    if (!goalReachedRef.current && seconds >= goalSeconds) {
      goalReachedRef.current = true;
      handleStop();
    }
  }, [running, seconds, goalSeconds]);

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

  useEffect(() => {
    const handleGoalSelected = (event: Event) => {
      const detail = (event as CustomEvent<{ subject: string; goalId: string }>).detail;
      if (!detail || detail.subject !== selectedSubject) return;
      const goalsMap = readGoalsMap();
      const list = goalsMap[selectedSubject] || [];
      const active = list.find((g) => g.id === detail.goalId);
      if (active) {
        setActiveGoalId(active.id);
        setGoalSeconds(active.remainingSeconds);
        const activeMap = readActiveGoalMap();
        activeMap[selectedSubject] = active.id;
        writeActiveGoalMap(activeMap);
      }
    };

    const handleGoalsUpdated = () => {
      if (!selectedSubject) return;
      const goalsMap = readGoalsMap();
      const list = goalsMap[selectedSubject] || [];
      setGoals(list);
      const activeMap = readActiveGoalMap();
      const preferredId = activeMap[selectedSubject];
      const active = list.find((g) => g.id === preferredId);
      setActiveGoalId(active ? active.id : null);
      setGoalSeconds(active ? active.remainingSeconds : null);
    };

    window.addEventListener("goal-selected", handleGoalSelected);
    window.addEventListener("goals-updated", handleGoalsUpdated);
    return () => {
      window.removeEventListener("goal-selected", handleGoalSelected);
      window.removeEventListener("goals-updated", handleGoalsUpdated);
    };
  }, [selectedSubject]);

  const selectGoal = (goalId: string) => {
    if (!selectedSubject) return;
    if (activeGoalId === goalId) {
      setActiveGoalId(null);
      setGoalSeconds(null);
      const activeMap = readActiveGoalMap();
      delete activeMap[selectedSubject];
      writeActiveGoalMap(activeMap);
      return;
    }
    const active = goals.find((g) => g.id === goalId);
    if (!active) return;
    setActiveGoalId(active.id);
    setGoalSeconds(active.remainingSeconds);
    const activeMap = readActiveGoalMap();
    activeMap[selectedSubject] = active.id;
    writeActiveGoalMap(activeMap);
  };

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

    if (goalSeconds === null && (goalHours.trim() || goalMinutes.trim() || goalSecondsInput.trim())) {
      const h = Number(goalHours.trim() || "0");
      const m = Number(goalMinutes.trim() || "0");
      const s = Number(goalSecondsInput.trim() || "0");
      const total = Math.floor(h * 3600 + m * 60 + s);
      if (Number.isFinite(total) && total > 0) {
        setGoalSeconds(total);
      }
    }

    const activeGoalForStorage = activeGoalId ? goals.find((g) => g.id === activeGoalId) : null;
    startedAtRef.current = Date.now() - seconds * 1000;

    setRunning(true);
    writeTimerStorage({
      running: true,
      seconds,
      startedAt: startedAtRef.current,
      subject: selectedSubject,
      mood: currentMood,
      goalSeconds: activeGoalForStorage ? activeGoalForStorage.remainingSeconds : goalSeconds,
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
        const activeGoalAfterInsert = activeGoalId ? goals.find((g) => g.id === activeGoalId) : null;
        writeTimerStorage({
          running: true,
          seconds,
          startedAt: startedAtRef.current,
          subject: selectedSubject,
          mood: currentMood,
          goalSeconds: activeGoalAfterInsert ? activeGoalAfterInsert.remainingSeconds : goalSeconds,
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
    const map = readGoalMap();
    const stored = map[current.name];
    if (typeof stored === "number" && !Number.isNaN(stored) && stored > 0) {
      setEditGoalMinutes(String(Math.max(1, Math.floor(stored / 60))));
    } else {
      setEditGoalMinutes("");
    }
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
    const map = readGoalMap();
    const raw = editGoalMinutes.trim();
    if (raw) {
      const m = Number(editGoalMinutes.trim());
      const total = Math.floor(m * 60);
      if (Number.isFinite(total) && total > 0) {
        map[trimmed] = total;
      }
    } else {
      delete map[trimmed];
    }
    if (trimmed !== selectedSubject) {
      delete map[selectedSubject];
    }
    writeGoalMap(map);
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
      goalSeconds,
      taskId: currentTaskId,
    });
  };

  const finalizeStop = async (finalMood: string, finalDuration: number) => {
    if (!selectedSubject || finalDuration === 0) {
      if (currentTaskId) {
        await supabase.from('tasks').delete().eq('id', currentTaskId);
      }
      setSeconds(0);
      setCurrentTaskId(null);
      startedAtRef.current = null;
      clearTimerStorage(true);
      return;
    }

    if (currentTaskId) {
      const { error } = await supabase
        .from('tasks')
        .update({ duration: finalDuration, mood: finalMood })
        .eq('id', currentTaskId);
      
      if (error) {
        console.error('Error saving task:', error);
        alert(`Error: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ task: selectedSubject, mood: finalMood, duration: finalDuration }])
        .select()
        .single();
      
      if (error) {
        console.error('Error saving task:', error);
        alert(`Error: ${error.message}`);
        return;
      }
      setCurrentTaskId(data.id);
    }

    onTaskComplete();
    setSeconds(0);
    setCurrentMood("😐");
    if (goals.length > 0 && activeGoalId) {
      const updated = goals.map((g) =>
        g.id === activeGoalId
          ? { ...g, remainingSeconds: Math.max(g.remainingSeconds - finalDuration, 0) }
          : g
      );
      setGoals(updated);
      const goalsMap = readGoalsMap();
      goalsMap[selectedSubject] = updated;
      writeGoalsMap(goalsMap);
      const active = updated.find((g) => g.id === activeGoalId);
      setGoalSeconds(active ? active.remainingSeconds : null);
      if (!active || active.remainingSeconds === 0) {
        setActiveGoalId(null);
        const activeMap = readActiveGoalMap();
        delete activeMap[selectedSubject];
        writeActiveGoalMap(activeMap);
      }
      window.dispatchEvent(new Event("goals-updated"));
    }
    setCurrentTaskId(null);
    startedAtRef.current = null;
    clearTimerStorage(true);
    setShowStopMoodModal(false);
  };

  const handleStop = () => {
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
      goalSeconds,
      taskId: currentTaskId,
    });

    if (!selectedSubject || safeSeconds === 0) {
      void finalizeStop(currentMood, safeSeconds);
      return;
    }

    setStopSeconds(safeSeconds);
    setShowStopMoodModal(true);
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

  const moods = ["😊", "😐", "😔", "😫", "😴"];
  const currentColor = subjects.find(s => s.name === selectedSubject)?.color || '#6366f1';
  const remainingSeconds = goalSeconds !== null ? Math.max(goalSeconds - seconds, 0) : null;
  const goalsForSubject = goals
    .filter((g) => g.subject === selectedSubject && g.remainingSeconds > 0)
    .sort((a, b) => {
      if (activeGoalId === a.id && activeGoalId !== b.id) return -1;
      if (activeGoalId === b.id && activeGoalId !== a.id) return 1;
      return b.createdAt - a.createdAt;
    });

  const startEditGoal = (goal: GoalItem) => {
    setEditingGoalId(goal.id);
    setEditGoalTitle(goal.title);
    const h = Math.floor(goal.totalSeconds / 3600);
    const m = Math.floor((goal.totalSeconds % 3600) / 60);
    const s = Math.floor(goal.totalSeconds % 60);
    setEditGoalHours(h > 0 ? String(h) : "");
    setEditGoalMinutes(m > 0 ? String(m) : "");
    setEditGoalSeconds(s > 0 ? String(s) : "");
  };

  const saveEditGoal = () => {
    if (!editingGoalId) return;
    const h = Number(editGoalHours.trim() || "0");
    const m = Number(editGoalMinutes.trim() || "0");
    const s = Number(editGoalSeconds.trim() || "0");
    const total = Math.floor(h * 3600 + m * 60 + s);
    if (!Number.isFinite(total) || total <= 0) {
      alert("Goal time must be a positive duration.");
      return;
    }
    const title = editGoalTitle.trim() || selectedSubject || "Goal";
    const updated = goals.map((g) => {
      if (g.id !== editingGoalId) return g;
      const nextRemaining = Math.min(g.remainingSeconds, total);
      return {
        ...g,
        title,
        totalSeconds: total,
        remainingSeconds: nextRemaining,
      };
    });
    setGoals(updated);
    const goalsMap = readGoalsMap();
    goalsMap[selectedSubject] = updated;
    writeGoalsMap(goalsMap);
    window.dispatchEvent(new Event("goals-updated"));
    setEditingGoalId(null);
    setEditGoalTitle("");
    setEditGoalHours("");
    setEditGoalMinutes("");
    setEditGoalSeconds("");
  };

  const deleteGoal = (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    setGoals(updated);
    const goalsMap = readGoalsMap();
    goalsMap[selectedSubject] = updated;
    writeGoalsMap(goalsMap);
    window.dispatchEvent(new Event("goals-updated"));
    if (activeGoalId === id) {
      const nextActive = updated[updated.length - 1];
      setActiveGoalId(nextActive ? nextActive.id : null);
      setGoalSeconds(nextActive ? nextActive.remainingSeconds : null);
      const activeMap = readActiveGoalMap();
      if (nextActive) {
        activeMap[selectedSubject] = nextActive.id;
      } else {
        delete activeMap[selectedSubject];
      }
      writeActiveGoalMap(activeMap);
    }
  };

  const applyGoal = () => {
    const hasInput = goalHours.trim() || goalMinutes.trim() || goalSecondsInput.trim();
    if (!hasInput) {
      setGoalSeconds(null);
      setGoalHours("");
      setGoalMinutes("");
      setGoalSecondsInput("");
      setGoalTitle("");
      return;
    }
    const h = Number(goalHours.trim() || "0");
    const m = Number(goalMinutes.trim() || "0");
    const s = Number(goalSecondsInput.trim() || "0");
    const total = Math.floor(h * 3600 + m * 60 + s);
    if (!Number.isFinite(total) || total <= 0) {
      alert("Goal time must be a positive duration.");
      return;
    }

    const title = goalTitle.trim() || selectedSubject || "Goal";
    const id = `${Date.now()}`;
    const nextGoal: GoalItem = {
      id,
      subject: selectedSubject,
      title,
      totalSeconds: total,
      remainingSeconds: total,
      createdAt: Date.now(),
    };

    const nextGoals = [...goals, nextGoal];
    setGoals(nextGoals);
    setActiveGoalId(id);
    setGoalSeconds(total);

    const goalsMap = readGoalsMap();
    goalsMap[selectedSubject] = nextGoals;
    writeGoalsMap(goalsMap);
    const activeMap = readActiveGoalMap();
    activeMap[selectedSubject] = id;
    writeActiveGoalMap(activeMap);
    window.dispatchEvent(new Event("goals-updated"));

    setGoalHours("");
    setGoalMinutes("");
    setGoalSecondsInput("");
    setGoalTitle("");
  };

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
            className="flex-1 p-3 border-2 rounded-lg focus:ring-2 focus:outline-none font-medium bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
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
                className="flex-1 px-3 py-2 bg-gray-200 text-[#0b2b26] rounded-lg hover:bg-gray-300 text-sm font-medium"
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
                className="flex-1 px-3 py-2 bg-gray-200 text-[#0b2b26] rounded-lg hover:bg-gray-300 text-sm font-medium"
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

      {/* Control Buttons */}
      <div className="flex flex-col items-center gap-3 mb-4 w-full">
        <div className="flex gap-3">
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
      </div>

      {/* Mistake Button */}
      {running && seconds > 0 && (
        <button
          onClick={() => setShowMistakeModal(true)}
          className="mt-4 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 flex items-center gap-2 shadow-md transition"
        >
          ⚠️ Log Mistake
        </button>
      )}

      {/* Goal Input */}
      <div className="w-full max-w-md mt-4 bg-white p-4 rounded-xl shadow border-2 border-indigo-100">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: currentColor }} />
          <div className="text-sm font-semibold text-[#0b2b26]">
            {selectedSubject || "No subject selected"}
          </div>
        </div>
        <input
          type="text"
          value={goalTitle}
          onChange={(e) => setGoalTitle(e.target.value)}
          placeholder="Goal title..."
          className="w-full p-2 border rounded-lg mb-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={goalHours}
            onChange={(e) => setGoalHours(e.target.value)}
            placeholder="hh"
            className="w-1/3 p-3 border-2 rounded-lg focus:ring-2 focus:outline-none bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={goalMinutes}
            onChange={(e) => setGoalMinutes(e.target.value)}
            placeholder="mm"
            className="w-1/3 p-3 border-2 rounded-lg focus:ring-2 focus:outline-none bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={goalSecondsInput}
            onChange={(e) => setGoalSecondsInput(e.target.value)}
            placeholder="ss"
            className="w-1/3 p-3 border-2 rounded-lg focus:ring-2 focus:outline-none bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
          />
          <button
            onClick={applyGoal}
            className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            Set
          </button>
          <button
            onClick={() => {
              setGoalHours("");
              setGoalMinutes("");
              setGoalSecondsInput("");
              setGoalSeconds(null);
              if (selectedSubject) {
                const map = readGoalMap();
                delete map[selectedSubject];
                writeGoalMap(map);
              }
            }}
            className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Goal Summary */}
      {goalsForSubject.length > 0 && (
        <div className="w-full max-w-md mt-3 space-y-2">
          {goalsForSubject.map((g) => {
            const isActive = activeGoalId === g.id;
            const displayRemaining = isActive
              ? Math.max(g.remainingSeconds - (running ? seconds : 0), 0)
              : g.remainingSeconds;
            const isEditing = editingGoalId === g.id;
              return (
                <div
                  key={g.id}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                    isActive
                      ? "border-emerald-400 bg-gradient-to-br from-emerald-50 to-white"
                      : "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white hover:border-emerald-300"
                  }`}
                >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editGoalTitle}
                      onChange={(e) => setEditGoalTitle(e.target.value)}
                      className="w-full p-2 border rounded-lg mb-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                      placeholder="Goal title..."
                    />
                    <div className="flex gap-2 mb-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editGoalHours}
                        onChange={(e) => setEditGoalHours(e.target.value)}
                        placeholder="hh"
                        className="w-1/3 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editGoalMinutes}
                        onChange={(e) => setEditGoalMinutes(e.target.value)}
                        placeholder="mm"
                        className="w-1/3 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editGoalSeconds}
                        onChange={(e) => setEditGoalSeconds(e.target.value)}
                        placeholder="ss"
                        className="w-1/3 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEditGoal}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingGoalId(null)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: currentColor }} />
                        {g.title}
                      </span>
                    </div>
                    <div className="text-base font-semibold text-[#0b2b26] mt-1">
                      Remaining: <span className="text-indigo-700">{formatTime(displayRemaining)}</span>
                      {isActive && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">
                          Active
                        </span>
                      )}
                      {displayRemaining === 0 && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-green-500 text-white">
                          Completed
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => selectGoal(g.id)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          isActive
                            ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            : "bg-emerald-500 text-white hover:bg-emerald-600"
                        }`}
                      >
                        {isActive ? "Unselect" : "Select"}
                      </button>
                      {g.remainingSeconds > 0 && (
                        <button
                          onClick={() => startEditGoal(g)}
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          className="px-3 py-1 bg-[#cfe3d6] text-[#0b2b26] rounded-lg hover:bg-[#b9d3c3] text-sm font-medium"
                        >
                          Edit
                        </button>
                      )}
                      {g.remainingSeconds > 0 && (
                        <button
                          onClick={() => deleteGoal(g.id)}
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
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
                className="flex-1 px-6 py-3 bg-gray-200 text-[#0b2b26] rounded-xl hover:bg-gray-300 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Stop Mood Modal */}
      {showStopMoodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="text-2xl font-bold mb-4 text-indigo-600">Save Session Mood</h3>
            <p className="text-sm text-gray-600 mb-4">
              Subject: <span className="font-bold">{selectedSubject}</span> | Time:{" "}
              <span className="font-bold text-indigo-600">{formatTime(stopSeconds)}</span>
            </p>
            <div className="grid grid-cols-5 gap-3 mb-6">
              {moods.map((mood) => (
                <button
                  key={mood}
                  onClick={() => setCurrentMood(mood)}
                  className={`text-4xl p-3 rounded-xl transition ${
                    currentMood === mood
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
                onClick={() => finalizeStop(currentMood, stopSeconds)}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold"
              >
                Save Session
              </button>
              <button
                onClick={() => setShowStopMoodModal(false)}
                className="flex-1 px-6 py-3 bg-[#cfe3d6] text-[#0b2b26] rounded-xl hover:bg-[#b9d3c3] font-bold"
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









