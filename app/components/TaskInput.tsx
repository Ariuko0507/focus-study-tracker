"use client";
import { useState } from "react";

interface TaskInputProps {
  setCurrentTask: (task: string) => void;
}

export default function TaskInput({ setCurrentTask }: TaskInputProps) {
  const [task, setTask] = useState("");

  const handleAdd = () => {
    if (!task.trim()) return;
    setCurrentTask(task);
    setTask("");
  };

  return (
    <div className="flex gap-2 mb-6">
      <input
        type="text"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="What are you studying?"
        className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-400"
      />
      <button
        onClick={handleAdd}
        className="px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        Set Task
      </button>
    </div>
  );
}