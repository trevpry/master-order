import React, { useState, useEffect } from 'react';

const TimerWidget = ({ 
  activeEntry, 
  onStart, 
  onStop, 
  tasks = [], 
  projects = [] 
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [showStartForm, setShowStartForm] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    taskId: '',
    projectId: ''
  });

  useEffect(() => {
    let interval = null;
    
    if (activeEntry && activeEntry.startTime) {
      interval = setInterval(() => {
        const start = new Date(activeEntry.startTime);
        const now = new Date();
        const diff = Math.floor((now - start) / 1000);
        setElapsed(diff);
      }, 1000);
    } else {
      setElapsed(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeEntry]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    try {
      await onStart(formData);
      setShowStartForm(false);
      setFormData({ description: '', taskId: '', projectId: '' });
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handleStop = async () => {
    try {
      await onStop(activeEntry.id);
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  };

  if (activeEntry) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <div className="text-lg font-mono font-bold text-gray-900">
                {formatTime(elapsed)}
              </div>
              <div className="text-sm text-gray-600">
                {activeEntry.description || 'Timer running'}
              </div>
              {activeEntry.task && (
                <div className="text-xs text-gray-500">
                  Task: {activeEntry.task.title}
                </div>
              )}
              {activeEntry.project && (
                <div className="text-xs text-gray-500">
                  Project: {activeEntry.project.name}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleStop}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Stop
          </button>
        </div>
      </div>
    );
  }

  if (showStartForm) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Start Time Tracking</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What are you working on?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task (optional)
            </label>
            <select
              value={formData.taskId}
              onChange={(e) => setFormData({ ...formData, taskId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a task...</option>
              {tasks.filter(task => task.status !== 'completed').map(task => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project (optional)
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a project...</option>
              {projects.filter(project => project.status === 'ACTIVE').map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleStart}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Start Timer
            </button>
            <button
              onClick={() => setShowStartForm(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="text-center">
        <div className="text-3xl font-mono font-bold text-gray-400 mb-2">
          0:00
        </div>
        <button
          onClick={() => setShowStartForm(true)}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Start Timer
        </button>
      </div>
    </div>
  );
};

export default TimerWidget;
