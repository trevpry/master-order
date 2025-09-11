import React, { useState, useEffect } from 'react';
import { 
  Calendar,
  Clock,
  Sun,
  Moon,
  CloudRain,
  Smile,
  Target,
  CheckCircle2,
  Heart,
  Save,
  Edit3,
  Plus,
  X,
  RotateCcw
} from 'lucide-react';
import Button from '../../shared/components/Button';

const DailyNoteEditor = ({ 
  date, 
  onDateChange, 
  onSave, 
  className = '',
  readOnly = false 
}) => {
  const [dailyNote, setDailyNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    content: '',
    mood: '',
    weather: '',
    goals: [],
    habits: [],
    gratitude: []
  });
  
  // Form input states
  const [newGoal, setNewGoal] = useState('');
  const [newHabit, setNewHabit] = useState('');
  const [newGratitude, setNewGratitude] = useState('');

  useEffect(() => {
    if (date) {
      loadDailyNote();
    }
  }, [date]);

  const loadDailyNote = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notes/daily/${date}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data;
        
        setDailyNote(data);
        setFormData({
          content: data?.note?.content || '',
          mood: data?.mood || '',
          weather: data?.weather || '',
          goals: data?.goals || [],
          habits: data?.habits || [],
          gratitude: data?.gratitude || []
        });
      } else {
        // Note doesn't exist yet, set defaults
        setDailyNote(null);
        setFormData({
          content: '',
          mood: '',
          weather: '',
          goals: [],
          habits: [],
          gratitude: []
        });
      }
    } catch (error) {
      console.error('Error loading daily note:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // First, save or update the note content
      if (dailyNote?.note) {
        // Update existing note
        const noteResponse = await fetch(`/api/notes/${dailyNote.note.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: formData.content,
            title: dailyNote.note.title
          })
        });
        
        if (!noteResponse.ok) {
          throw new Error('Failed to update note');
        }
      }

      // Update daily note metadata
      const dailyResponse = await fetch(`/api/notes/daily/${date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: formData.mood,
          weather: formData.weather,
          goals: formData.goals,
          habits: formData.habits,
          gratitude: formData.gratitude
        })
      });

      if (!dailyResponse.ok) {
        throw new Error('Failed to update daily note');
      }

      // Reload the note to get updated data
      await loadDailyNote();
      setIsEditing(false);

      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving daily note:', error);
      alert('Error saving daily note: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const addGoal = () => {
    if (newGoal.trim()) {
      setFormData(prev => ({
        ...prev,
        goals: [...prev.goals, { text: newGoal.trim(), completed: false }]
      }));
      setNewGoal('');
    }
  };

  const toggleGoal = (index) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.map((goal, i) => 
        i === index ? { ...goal, completed: !goal.completed } : goal
      )
    }));
  };

  const removeGoal = (index) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index)
    }));
  };

  const addHabit = () => {
    if (newHabit.trim()) {
      setFormData(prev => ({
        ...prev,
        habits: [...prev.habits, { text: newHabit.trim(), completed: false }]
      }));
      setNewHabit('');
    }
  };

  const toggleHabit = (index) => {
    setFormData(prev => ({
      ...prev,
      habits: prev.habits.map((habit, i) => 
        i === index ? { ...habit, completed: !habit.completed } : habit
      )
    }));
  };

  const removeHabit = (index) => {
    setFormData(prev => ({
      ...prev,
      habits: prev.habits.filter((_, i) => i !== index)
    }));
  };

  const addGratitude = () => {
    if (newGratitude.trim()) {
      setFormData(prev => ({
        ...prev,
        gratitude: [...prev.gratitude, newGratitude.trim()]
      }));
      setNewGratitude('');
    }
  };

  const removeGratitude = (index) => {
    setFormData(prev => ({
      ...prev,
      gratitude: prev.gratitude.filter((_, i) => i !== index)
    }));
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const moodOptions = [
    { value: 'great', label: '😄 Great', color: 'text-green-600' },
    { value: 'good', label: '😊 Good', color: 'text-blue-600' },
    { value: 'okay', label: '😐 Okay', color: 'text-yellow-600' },
    { value: 'low', label: '😔 Low', color: 'text-orange-600' },
    { value: 'bad', label: '😞 Bad', color: 'text-red-600' }
  ];

  const weatherOptions = [
    { value: 'sunny', label: '☀️ Sunny' },
    { value: 'cloudy', label: '☁️ Cloudy' },
    { value: 'rainy', label: '🌧️ Rainy' },
    { value: 'snowy', label: '❄️ Snowy' },
    { value: 'windy', label: '💨 Windy' }
  ];

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Calendar className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Daily Note
            </h2>
            <p className="text-sm text-gray-600">
              {formatDate(date)}
            </p>
          </div>
        </div>
        
        {!readOnly && (
          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    loadDailyNote(); // Reset changes
                  }}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Mood and Weather */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Smile className="h-4 w-4 inline mr-1" />
            Mood
          </label>
          {isEditing ? (
            <select
              value={formData.mood}
              onChange={(e) => setFormData(prev => ({ ...prev, mood: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select mood...</option>
              {moodOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-lg">
              {formData.mood ? 
                moodOptions.find(m => m.value === formData.mood)?.label || formData.mood :
                <span className="text-gray-400">Not set</span>
              }
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <CloudRain className="h-4 w-4 inline mr-1" />
            Weather
          </label>
          {isEditing ? (
            <select
              value={formData.weather}
              onChange={(e) => setFormData(prev => ({ ...prev, weather: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select weather...</option>
              {weatherOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-lg">
              {formData.weather ? 
                weatherOptions.find(w => w.value === formData.weather)?.label || formData.weather :
                <span className="text-gray-400">Not set</span>
              }
            </div>
          )}
        </div>
      </div>

      {/* Goals Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <Target className="h-5 w-5 mr-2 text-blue-600" />
          Goals for Today
        </h3>
        
        {isEditing && (
          <div className="flex mb-3">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addGoal()}
              placeholder="Add a goal..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={addGoal}
              className="rounded-l-none"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {formData.goals.map((goal, index) => (
            <div key={index} className="flex items-center space-x-2">
              <button
                onClick={() => isEditing && toggleGoal(index)}
                className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                  goal.completed 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : 'border-gray-300 hover:border-green-400'
                }`}
                disabled={!isEditing}
              >
                {goal.completed && <CheckCircle2 className="h-3 w-3" />}
              </button>
              <span className={`flex-1 ${goal.completed ? 'line-through text-gray-500' : ''}`}>
                {goal.text}
              </span>
              {isEditing && (
                <button
                  onClick={() => removeGoal(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {formData.goals.length === 0 && (
            <p className="text-gray-400 italic">No goals set for today</p>
          )}
        </div>
      </div>

      {/* Habits Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <RotateCcw className="h-5 w-5 mr-2 text-green-600" />
          Habits
        </h3>
        
        {isEditing && (
          <div className="flex mb-3">
            <input
              type="text"
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addHabit()}
              placeholder="Add a habit..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={addHabit}
              className="rounded-l-none"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {formData.habits.map((habit, index) => (
            <div key={index} className="flex items-center space-x-2">
              <button
                onClick={() => isEditing && toggleHabit(index)}
                className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                  habit.completed 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : 'border-gray-300 hover:border-green-400'
                }`}
                disabled={!isEditing}
              >
                {habit.completed && <CheckCircle2 className="h-3 w-3" />}
              </button>
              <span className={`flex-1 ${habit.completed ? 'line-through text-gray-500' : ''}`}>
                {habit.text}
              </span>
              {isEditing && (
                <button
                  onClick={() => removeHabit(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {formData.habits.length === 0 && (
            <p className="text-gray-400 italic">No habits tracked</p>
          )}
        </div>
      </div>

      {/* Gratitude Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <Heart className="h-5 w-5 mr-2 text-red-600" />
          Gratitude
        </h3>
        
        {isEditing && (
          <div className="flex mb-3">
            <input
              type="text"
              value={newGratitude}
              onChange={(e) => setNewGratitude(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addGratitude()}
              placeholder="What are you grateful for?"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={addGratitude}
              className="rounded-l-none"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {formData.gratitude.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              <span className="text-red-500">•</span>
              <span className="flex-1">{item}</span>
              {isEditing && (
                <button
                  onClick={() => removeGratitude(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {formData.gratitude.length === 0 && (
            <p className="text-gray-400 italic">No gratitude entries</p>
          )}
        </div>
      </div>

      {/* Note Content */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <Edit3 className="h-5 w-5 mr-2 text-purple-600" />
          Notes & Reflections
        </h3>
        
        {isEditing ? (
          <textarea
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Write your thoughts, reflections, and notes for the day..."
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        ) : (
          <div className="min-h-64 p-4 bg-gray-50 rounded-md">
            {formData.content ? (
              <div className="whitespace-pre-wrap">{formData.content}</div>
            ) : (
              <p className="text-gray-400 italic">No notes for this day</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyNoteEditor;
