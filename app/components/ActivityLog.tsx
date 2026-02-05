"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Activity {
  type: 'task' | 'mistake' | 'schedule' | 'note';
  id: string;
  subject: string;
  description: string;
  timestamp: string;
  duration?: number;
  mood?: string;
  is_fixed?: boolean;
}

export default function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'task' | 'mistake' | 'schedule' | 'note'>('all');

  useEffect(() => {
    fetchActivities();
  }, [filter]);

  useEffect(() => {
    const handleMistakeUpdated = () => {
      fetchActivities();
    };

    window.addEventListener("mistake-updated", handleMistakeUpdated);
    return () => {
      window.removeEventListener("mistake-updated", handleMistakeUpdated);
    };
  }, []);

  const fetchActivities = async () => {
    const allActivities: Activity[] = [];

    // Fetch tasks
    if (filter === 'all' || filter === 'task') {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (tasks) {
        tasks.forEach(t => {
          allActivities.push({
            type: 'task',
            id: t.id,
            subject: t.task,
            description: `Studied for ${formatDuration(t.duration)}`,
            timestamp: t.created_at,
            duration: t.duration,
            mood: t.mood,
          });
        });
      }
    }

    // Fetch mistakes
    if (filter === 'all' || filter === 'mistake') {
      const { data: mistakes } = await supabase
        .from('mistakes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (mistakes) {
        mistakes.forEach(m => {
          allActivities.push({
            type: 'mistake',
            id: m.id,
            subject: m.subject,
            description: m.mistake_description,
            timestamp: m.created_at,
            is_fixed: m.is_fixed,
          });
        });
      }
    }

    // Fetch schedules
    if (filter === 'all' || filter === 'schedule') {
      const { data: schedules } = await supabase
        .from('schedules')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (schedules) {
        schedules.forEach(s => {
          allActivities.push({
            type: 'schedule',
            id: s.id,
            subject: s.subject,
            description: `Deadline: ${new Date(s.deadline).toLocaleString()}`,
            timestamp: s.created_at,
          });
        });
      }
    }

    // Fetch notes
    if (filter === 'all' || filter === 'note') {
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (notes) {
        notes.forEach(n => {
          allActivities.push({
            type: 'note',
            id: n.id,
            subject: n.subject,
            description: n.content.substring(0, 100) + (n.content.length > 100 ? '...' : ''),
            timestamp: n.created_at,
          });
        });
      }
    }

    // Sort by timestamp
    allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    setActivities(allActivities);
    setLoading(false);
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task': return '📚';
      case 'mistake': return '⚠️';
      case 'schedule': return '📅';
      case 'note': return '📝';
      default: return '•';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'task': return 'bg-blue-50 border-blue-300';
      case 'mistake': return 'bg-orange-50 border-orange-300';
      case 'schedule': return 'bg-purple-50 border-purple-300';
      case 'note': return 'bg-green-50 border-green-300';
      default: return 'bg-gray-50 border-gray-300';
    }
  };

  if (loading) return <div className="text-center py-8">Loading activity...</div>;

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-bold">📊 Activity Log</h3>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'task', 'mistake', 'schedule', 'note'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === f
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? '🔍 All' : 
             f === 'task' ? '📚 Study' :
             f === 'mistake' ? '⚠️ Mistakes' :
             f === 'schedule' ? '📅 Deadlines' : '📝 Notes'}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>

        {/* Activities */}
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.id} className="relative flex gap-4">
              {/* Timeline Dot */}
              <div className="relative z-10 flex-shrink-0">
                <div className="w-16 h-16 bg-white border-4 border-indigo-600 rounded-full flex items-center justify-center text-2xl shadow-lg">
                  {getIcon(activity.type)}
                </div>
              </div>

              {/* Content */}
              <div className={`flex-1 p-4 rounded-xl border-2 ${getColor(activity.type)} shadow-md hover:shadow-lg transition`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-lg">{activity.subject}</h4>
                    <p className="text-gray-700">{activity.description}</p>
                  </div>
                  {activity.mood && (
                    <span className="text-3xl">{activity.mood}</span>
                  )}
                  {activity.is_fixed !== undefined && (
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      activity.is_fixed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {activity.is_fixed ? '✅ Fixed' : '⚠️ Unfixed'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(activity.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {activities.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No activity yet. Start studying! 📚
          </div>
        )}
      </div>
    </div>
  );
}
