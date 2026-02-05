"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ScheduleItem {
  id: string;
  subject: string;
  deadline: string;
  completed: boolean;
  reminder_enabled?: boolean;
}

export default function Schedule() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [subject, setSubject] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"doing" | "completed" | "overdue">("doing");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editDeadline, setEditDeadline] = useState("");

  useEffect(() => {
    fetchSchedules();
    // Set default deadline to tomorrow at noon
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    const formatted = tomorrow.toISOString().slice(0, 16);
    setDeadline(formatted);
  }, []);

  const fetchSchedules = async () => {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order('deadline', { ascending: true });
    
    if (error) {
      console.error('Error fetching schedules:', error);
    } else {
      const normalized = (data || []).map((s) => ({
        ...s,
        reminder_enabled: Boolean(s.reminder_enabled),
      }));
      setSchedules(normalized);
    }
    setLoading(false);
  };

  const addSchedule = async () => {
    // Validation
    const trimmedSubject = subject.trim();
    
    console.log("Subject:", trimmedSubject);
    console.log("Deadline:", deadline);
    
    if (!trimmedSubject) {
      alert("⚠️ Please enter a subject/task name!");
      return;
    }
    
    if (!deadline) {
      alert("⚠️ Please select a deadline!");
      return;
    }
    
    // Convert to ISO format for database
    const deadlineISO = new Date(deadline).toISOString();
    
    console.log("Inserting:", { subject: trimmedSubject, deadline: deadlineISO });
    
    const { data, error } = await supabase
      .from('schedules')
      .insert([{ 
        subject: trimmedSubject, 
        deadline: deadlineISO 
      }])
      .select();

    if (error) {
      console.error('Error adding schedule:', error);
      alert(`❌ Error: ${error.message}`);
    } else {
      console.log("✅ Schedule added:", data);
      await fetchSchedules();
      setSubject("");
      // Reset to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      setDeadline(tomorrow.toISOString().slice(0, 16));
    }
  };

  const toggleComplete = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from('schedules')
      .update({ completed: !completed })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating schedule:', error);
    } else {
      fetchSchedules();
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm("Delete this deadline?")) return;
    
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting schedule:', error);
    } else {
      fetchSchedules();
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading schedules...</div>;
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const getStatus = (s: ScheduleItem) => {
    if (s.completed) return "completed";
    const deadlineDate = new Date(s.deadline);
    if (deadlineDate < startOfDay) return "overdue";
    return "doing";
  };

  const filteredSchedules = schedules.filter(s => getStatus(s) === activeTab);

  const toLocalInputValue = (iso: string) => {
    const d = new Date(iso);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - tzOffset);
    return local.toISOString().slice(0, 16);
  };

  const startEdit = (s: ScheduleItem) => {
    setEditingId(s.id);
    setEditSubject(s.subject);
    setEditDeadline(toLocalInputValue(s.deadline));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSubject("");
    setEditDeadline("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editSubject.trim();
    if (!trimmed || !editDeadline) return;

    const deadlineISO = new Date(editDeadline).toISOString();
    const { error } = await supabase
      .from('schedules')
      .update({ subject: trimmed, deadline: deadlineISO })
      .eq('id', editingId);

    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }

    setSchedules((prev) =>
      prev.map((s) =>
        s.id === editingId ? { ...s, subject: trimmed, deadline: deadlineISO } : s
      )
    );
    cancelEdit();
  };

  const toggleReminder = async (s: ScheduleItem) => {
    const nextValue = !s.reminder_enabled;
    const { error } = await supabase
      .from('schedules')
      .update({ reminder_enabled: nextValue })
      .eq('id', s.id);

    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }

    setSchedules((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, reminder_enabled: nextValue } : x))
    );
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-semibold mb-4">📅 Deadlines & Schedule</h3>

      {/* Add Schedule Form */}
      <div className="bg-white p-6 rounded-xl shadow space-y-4">
        <h4 className="font-semibold text-lg text-gray-700">Add New Deadline</h4>
        
        <div className="space-y-3">
          {/* Subject Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject/Task *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Math Homework, Physics Lab Report"
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addSchedule();
                }
              }}
            />
          </div>

          {/* Deadline Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deadline *
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          {/* Add Button */}
          <button
            onClick={addSchedule}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition shadow-sm hover:shadow-md"
          >
            ➕ Add Deadline
          </button>
        </div>
      </div>

      {/* Status Tabs (Styled Like Summary Boxes) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab("doing")}
          className={`text-left bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow transition border-2 ${
            activeTab === "doing" ? "border-blue-400" : "border-transparent"
          }`}
        >
          <div className="text-blue-600 text-sm font-medium mb-1">🔥 Doing</div>
          <div className="text-3xl font-bold text-blue-900">
            {schedules.filter(s => getStatus(s) === "doing").length}
          </div>
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`text-left bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow transition border-2 ${
            activeTab === "completed" ? "border-green-400" : "border-transparent"
          }`}
        >
          <div className="text-green-600 text-sm font-medium mb-1">✅ Completed</div>
          <div className="text-3xl font-bold text-green-900">
            {schedules.filter(s => s.completed).length}
          </div>
        </button>
        <button
          onClick={() => setActiveTab("overdue")}
          className={`text-left bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl shadow transition border-2 ${
            activeTab === "overdue" ? "border-red-400" : "border-transparent"
          }`}
        >
          <div className="text-red-600 text-sm font-medium mb-1">⚠️ Overdue</div>
          <div className="text-3xl font-bold text-red-900">
            {schedules.filter(s => getStatus(s) === "overdue").length}
          </div>
        </button>
      </div>

      {/* Schedules List */}
      {filteredSchedules.length === 0 ? (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-12 rounded-xl text-center">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-gray-500 text-lg">No items in this tab.</p>
          <p className="text-gray-400 text-sm mt-2">Try a different tab or add a new deadline.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSchedules.map((s) => {
            const deadlineDate = new Date(s.deadline);
            const isOverdue = deadlineDate < startOfDay && !s.completed;
            const msLeft = deadlineDate.getTime() - now.getTime();
            const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
            const daysLeft = Math.floor(hoursLeft / 24);
            const isEditing = editingId === s.id;
            
            return (
              <div
                key={s.id}
                className={`p-5 rounded-xl border-2 transition shadow-sm hover:shadow-md ${
                  s.completed
                    ? "bg-green-50 border-green-300"
                    : isOverdue
                    ? "bg-red-50 border-red-400 shadow-red-100"
                    : hoursLeft < 24
                    ? "bg-yellow-50 border-yellow-400 shadow-yellow-100"
                    : "bg-white border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={s.completed}
                      onChange={() => toggleComplete(s.id, s.completed)}
                      className="w-6 h-6 mt-1 cursor-pointer accent-indigo-600"
                    />
                    
                    {/* Content */}
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2 mb-2">
                          <input
                            type="text"
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400"
                          />
                          <input
                            type="datetime-local"
                            value={editDeadline}
                            onChange={(e) => setEditDeadline(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400"
                          />
                        </div>
                      ) : (
                        <h4 className={`font-bold text-xl mb-2 ${s.completed ? "line-through text-gray-500" : "text-gray-800"}`}>
                          {s.subject}
                        </h4>
                      )}
                      
                      <div className="flex flex-col gap-2 text-sm">
                        {/* Deadline Date */}
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>📅</span>
                          <span>
                            {deadlineDate.toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                          <span>⏰</span>
                          <span>
                            {deadlineDate.toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        
                        {/* Time Left Badge */}
                        {!s.completed && (
                          <div>
                            {isOverdue ? (
                              <span className="inline-block px-3 py-1 bg-red-600 text-white rounded-full font-semibold text-xs">
                                ⚠️ OVERDUE!
                              </span>
                            ) : hoursLeft < 24 ? (
                              <span className="inline-block px-3 py-1 bg-yellow-600 text-white rounded-full font-semibold text-xs">
                                ⏰ {hoursLeft}h left
                              </span>
                            ) : daysLeft < 7 ? (
                              <span className="inline-block px-3 py-1 bg-blue-600 text-white rounded-full font-semibold text-xs">
                                📆 {daysLeft}d {hoursLeft % 24}h left
                              </span>
                            ) : (
                              <span className="inline-block px-3 py-1 bg-green-600 text-white rounded-full font-semibold text-xs">
                                ✓ {daysLeft} days left
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toggleReminder(s)}
                      className={`px-3 py-2 rounded-lg font-medium transition ${
                        s.reminder_enabled ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {s.reminder_enabled ? "🔔 Reminder On" : "🔕 Reminder Off"}
                    </button>
                    {isEditing ? (
                      <>
                        <button
                          onClick={saveEdit}
                          className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
                        >
                          💾 Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                        >
                          ✖ Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(s)}
                        className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition font-medium"
                      >
                        ✏️ Edit
                      </button>
                    )}
                    <button
                      onClick={() => deleteSchedule(s.id)}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Statistics removed */}
    </div>
  );
}
