"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Note {
  id: string;
  subject: string;
  content: string;
  category?: "important" | "good_to_know" | "note";
  pinned?: boolean;
  created_at: string;
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"important" | "good_to_know" | "note">("important");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<"important" | "good_to_know" | "note">("important");
  const [activeTab, setActiveTab] = useState<"all" | "important" | "good_to_know" | "note">("all");
  const [query, setQuery] = useState("");
  const [liveSeconds, setLiveSeconds] = useState<number | null>(null);
  const [liveSubject, setLiveSubject] = useState<string>("");

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    const syncLiveSession = () => {
      try {
        const running = localStorage.getItem("timer_running") === "1";
        const startedAt = localStorage.getItem("timer_started_at");
        const subjectStored = localStorage.getItem("timer_subject");

        if (running && startedAt) {
          const elapsed = Math.floor((Date.now() - Number(startedAt)) / 1000);
          setLiveSeconds(elapsed < 0 ? 0 : elapsed);
          setLiveSubject(subjectStored || "");
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

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });
    const normalized = (data || []).map((n) => ({
      ...n,
      pinned: Boolean(n.pinned),
    }));
    setNotes(normalized);
  };

  const addNote = async () => {
    const trimmedSubject = subject.trim();
    const trimmedContent = content.trim();
    if (!trimmedSubject || !trimmedContent) {
      alert("Гарчиг, агуулгаа бөглөнө үү.");
      return;
    }
    
    let { error } = await supabase
      .from('notes')
      .insert([{ subject: trimmedSubject, content: trimmedContent, category, pinned: false }]);

    if (error?.message?.toLowerCase().includes("category")) {
      const retry = await supabase
        .from('notes')
        .insert([{ subject: trimmedSubject, content: trimmedContent, pinned: false }]);
      error = retry.error;
      if (!error) {
        alert("Ангилалын багана байхгүй тул ангиллыг хадгалсангүй.");
      }
    }

    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }
    if (!error) {
      fetchNotes();
      setSubject("");
      setContent("");
      setCategory("important");
    }
  };

  const togglePin = async (note: Note) => {
    const nextPinned = !note.pinned;
    const { error } = await supabase
      .from('notes')
      .update({ pinned: nextPinned })
      .eq('id', note.id);

    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }

    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, pinned: nextPinned } : n))
    );
  };

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setEditSubject(n.subject);
    setEditContent(n.content);
    setEditCategory(n.category || "note");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSubject("");
    setEditContent("");
    setEditCategory("important");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmedSubject = editSubject.trim();
    const trimmedContent = editContent.trim();
    if (!trimmedSubject || !trimmedContent) {
      alert("Гарчиг, агуулгаа бөглөнө үү.");
      return;
    }

    let { error } = await supabase
      .from('notes')
      .update({ subject: trimmedSubject, content: trimmedContent, category: editCategory })
      .eq('id', editingId);

    if (error?.message?.toLowerCase().includes("category")) {
      const retry = await supabase
        .from('notes')
        .update({ subject: trimmedSubject, content: trimmedContent })
        .eq('id', editingId);
      error = retry.error;
      if (!error) {
        alert("Ангилалын багана байхгүй тул ангиллыг хадгалсангүй.");
      }
    }

    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }

    await fetchNotes();
    cancelEdit();
  };

  const deleteNote = async (n: Note) => {
    const confirmed = window.confirm(`"${n.subject}" тэмдэглэлийг устгах уу?`);
    if (!confirmed) return;
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', n.id);
    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }
    setNotes((prev) => prev.filter((x) => x.id !== n.id));
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  return (
    <div>
      <h3 className="text-2xl font-semibold mb-4 text-[#0b2b26]">Study Notes</h3>
      {liveSeconds !== null && (
          <div className="bg-white p-6 rounded-xl shadow border-2 border-emerald-200 mb-6">
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

      <div className="space-y-3 mb-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-[#0b2b26]">Гарчиг</div>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Та юу бичих вэ"
            className="w-full p-2 border rounded focus:ring-2 focus:outline-none bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-[#0b2b26]">Агуулга</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Та юу бичих вэ"
            rows={4}
            className="w-full p-2 border rounded focus:ring-2 focus:outline-none bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "important" | "good_to_know" | "note")}
          className="w-full p-2 border rounded focus:ring-2 focus:outline-none bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
        >
          <option value="important">Чухал</option>
          <option value="good_to_know">Мэдвэл дээр</option>
          <option value="note">Тэмдэглэл</option>
        </select>
        <button
          onClick={addNote}
          className="px-4 py-2 bg-[#163832] text-[#daf1de] rounded hover:bg-[#0b2b26]"
        >
          Save Note
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "important", "good_to_know", "note"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab
                ? "bg-[#163832] text-[#daf1de] shadow-md"
                : "bg-[#e3efe7] text-[#0b2b26] hover:bg-[#d3e5da]"
            }`}
          >
            {tab === "all" && `Бүгд (${notes.length})`}
            {tab === "important" &&`Чухал (${notes.filter(n => n.category === "important").length})`}
            {tab === "good_to_know" &&`Мэдвэл дээр (${notes.filter(n => n.category === "good_to_know").length})`}
            {tab === "note" &&`Тэмдэглэл (${notes.filter(n => n.category === "note").length})`}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Хайх..."
          className="w-full p-2 border rounded focus:ring-2 focus:outline-none bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
        />
      </div>

      {(() => {
        const filtered = notes
            
          .filter((n) => {
            if (!query.trim()) return true;
            const q = query.toLowerCase();
            return (
              n.subject.toLowerCase().includes(q) ||
              n.content.toLowerCase().includes(q)
            );
          });
        const pinnedNotes = filtered.filter((n) => n.pinned);
        const otherNotes = filtered.filter((n) => !n.pinned);

        const renderNote = (n: Note) => {
          const isEditing = editingId === n.id;
          return (
            <div key={n.id} className="p-4 bg-[#e7f3ea] rounded-lg border border-[#cfe3d6]">
              <div className="flex justify-between mb-2 gap-3">
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        className="w-full p-2 border rounded focus:ring-2 focus:outline-none bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
                        placeholder="Гарчиг"
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full p-2 border rounded focus:ring-2 focus:outline-none bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
                        placeholder="Агуулга"
                      />
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as "important" | "good_to_know" | "note")}
                        className="w-full p-2 border rounded focus:ring-2 focus:outline-none bg-[#e7f3ea] border-[#8eb69b] focus:ring-[#235347]"
                      >
                        <option value="important">Чухал</option>
                        <option value="good_to_know">Мэдвэл дээр</option>
                        <option value="note">Тэмдэглэл</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-[#0b2b26]">{n.subject}</h4>
                      {n.category && (
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            n.category === "important"
                              ? "bg-[#d9ebe0] text-[#163832]"
                              : n.category === "good_to_know"
                              ? "bg-[#e7f3ea] text-[#235347]"
                              : "bg-[#daf1de] text-[#0b2b26]"
                          }`}
                        >
                          {n.category === "important"
                            ? "Чухал"
                            : n.category === "good_to_know"
                            ? "Мэдвэл дээр"
                            : "Тэмдэглэл"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isEditing && (
                    <button
                      onClick={() => togglePin(n)}
                      className={`text-sm px-2 py-1 rounded ${
                        n.pinned ? "bg-[#e7f3ea] text-[#235347]" : "bg-gray-100 text-gray-600"
                      }`}
                      title={n.pinned ? "Unpin" : "Pin"}
                    >
                      {n.pinned ? "📌 Pinned" : "📍 Pin"}
                    </button>
                  )}
                  {isEditing ? (
                    <>
                      <button
                        onClick={saveEdit}
                        className="text-sm px-2 py-1 rounded bg-[#163832] text-[#daf1de] hover:bg-[#0b2b26]"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-sm px-2 py-1 rounded bg-[#cfe3d6] text-[#0b2b26] hover:bg-[#b9d3c3]"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(n)}
                        className="text-sm px-2 py-1 rounded bg-[#cfe3d6] text-[#0b2b26] hover:bg-[#b9d3c3]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteNote(n)}
                        className="text-sm px-2 py-1 rounded bg-[#235347] text-[#daf1de] hover:bg-[#0b2b26]"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  <span className="text-sm text-gray-500">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {!isEditing && (
                <p className="text-[#1e3a34] whitespace-pre-wrap">{n.content}</p>
              )}
            </div>
          );
        };

        if (filtered.length === 0) {
          return (
            <div className="p-6 rounded-xl bg-[#e7f3ea] border border-[#cfe3d6] text-[#0b2b26]">
              No notes yet.
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {pinnedNotes.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold mb-2">📌 Pinned</h4>
                <div className="space-y-3">
                  {pinnedNotes
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map(renderNote)}
                </div>
              </div>
            )}
            <div>
              {pinnedNotes.length > 0 && (
                <h4 className="text-lg font-semibold mb-2">All Notes</h4>
              )}
              <div className="space-y-3">
                {otherNotes
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map(renderNote)}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}





