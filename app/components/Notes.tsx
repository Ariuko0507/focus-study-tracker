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
  const [activeTab, setActiveTab] = useState<"all" | "important" | "good_to_know" | "note">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchNotes();
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
    if (!subject || !content) return;
    
    const { error } = await supabase
      .from('notes')
      .insert([{ subject, content, category, pinned: false }]);

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

  return (
    <div>
      <h3 className="text-2xl font-semibold mb-4">Study Notes</h3>

      <div className="space-y-3 mb-6">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "important" | "good_to_know" | "note")}
          className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-400"
        >
          <option value="important">Чухал</option>
          <option value="good_to_know">Мэдэж байхад зүгээр</option>
          <option value="note">Тэмдэглэл</option>
        </select>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Key points..."
          rows={4}
          className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={addNote}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
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
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab === "all" && `Бүгд (${notes.length})`}
            {tab === "important" &&
              `Чухал (${notes.filter(n => n.category === "important").length})`}
            {tab === "good_to_know" &&
              `Мэдэж байхад зүгээр (${notes.filter(n => n.category === "good_to_know").length})`}
            {tab === "note" &&
              `Тэмдэглэл (${notes.filter(n => n.category === "note").length})`}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Хайх..."
          className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {(() => {
        const filtered = notes
          .filter((n) => (activeTab === "all" ? true : n.category === activeTab))
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

        const renderNote = (n: Note) => (
          <div key={n.id} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">{n.subject}</h4>
                {n.category && (
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      n.category === "important"
                        ? "bg-red-100 text-red-700"
                        : n.category === "good_to_know"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {n.category === "important"
                      ? "Чухал"
                      : n.category === "good_to_know"
                      ? "Мэдэж байхад зүгээр"
                      : "Тэмдэглэл"}
                  </span>
                )}
              </div>
              <button
                onClick={() => togglePin(n)}
                className={`text-sm px-2 py-1 rounded ${
                  n.pinned ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-600"
                }`}
                title={n.pinned ? "Unpin" : "Pin"}
              >
                {n.pinned ? "📌 Pinned" : "📍 Pin"}
              </button>
              <span className="text-sm text-gray-500">
                {new Date(n.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">{n.content}</p>
          </div>
        );

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
