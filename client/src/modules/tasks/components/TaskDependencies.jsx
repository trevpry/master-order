import React, { useState } from 'react';
import { LinkIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

const TaskDependencies = ({ 
  task, 
  allTasks, 
  onAddDependency, 
  onRemoveDependency,
  readOnly = false
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // Get tasks that can be dependencies (excluding self and circular dependencies)
  const getAvailableTasks = () => {
    if (!task) return allTasks;
    
    return allTasks.filter(t => {
      // Exclude self
      if (t.id === task.id) return false;
      
      // Exclude if already a dependency
      if (task.dependencies?.some(dep => dep.dependsOnTaskId === t.id)) return false;
      
      // Exclude if this task is already a dependency of the candidate
      if (t.dependencies?.some(dep => dep.dependsOnTaskId === task.id)) return false;
      
      // Exclude completed tasks
      if (t.status === 'COMPLETED') return false;
      
      return true;
    });
  };

  const handleAddDependency = () => {
    if (selectedTaskId && onAddDependency) {
      onAddDependency(task.id, parseInt(selectedTaskId));
      setSelectedTaskId('');
      setShowAddForm(false);
    }
  };

  const getDependencyStatus = (dependency) => {
    const dependentTask = allTasks.find(t => t.id === dependency.dependsOnTaskId);
    if (!dependentTask) return 'unknown';
    
    switch (dependentTask.status) {
      case 'COMPLETED':
        return 'completed';
      case 'IN_PROGRESS':
        return 'in-progress';
      case 'TODO':
        return 'pending';
      default:
        return 'unknown';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDependentTask = (dependency) => {
    return allTasks.find(t => t.id === dependency.dependsOnTaskId);
  };

  const canTaskStart = () => {
    if (!task?.dependencies?.length) return true;
    
    return task.dependencies.every(dep => {
      const dependentTask = getDependentTask(dep);
      return dependentTask?.status === 'COMPLETED';
    });
  };

  return (
    <div className="space-y-4">
      {/* Dependencies Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">Dependencies</h4>
          {!readOnly && (
            <button
              onClick={() => setShowAddForm(true)}
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add Dependency</span>
            </button>
          )}
        </div>

        {task?.dependencies?.length > 0 ? (
          <div className="space-y-2">
            {task.dependencies.map((dependency) => {
              const dependentTask = getDependentTask(dependency);
              const status = getDependencyStatus(dependency);
              
              return (
                <div
                  key={dependency.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-center space-x-3">
                    <LinkIcon className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {dependentTask?.title || 'Unknown Task'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {dependency.type === 'BLOCKS' ? 'Blocks this task' : 'Must finish before this task can start'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                      {status.replace('-', ' ')}
                    </span>
                    
                    {!readOnly && (
                      <button
                        onClick={() => onRemoveDependency(dependency.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No dependencies</p>
        )}

        {/* Task Status Based on Dependencies */}
        {task?.dependencies?.length > 0 && (
          <div className={`mt-3 p-3 rounded-lg ${
            canTaskStart() 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <p className={`text-sm ${
              canTaskStart() ? 'text-green-700' : 'text-yellow-700'
            }`}>
              {canTaskStart() 
                ? '✅ All dependencies completed - task can proceed'
                : '⏳ Waiting for dependencies to complete'
              }
            </p>
          </div>
        )}
      </div>

      {/* Add Dependency Form */}
      {showAddForm && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h5 className="text-sm font-medium text-gray-700 mb-3">Add Dependency</h5>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                This task depends on:
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">Select a task...</option>
                {getAvailableTasks().map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status.toLowerCase().replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedTaskId('');
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDependency}
                disabled={!selectedTaskId}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Dependency
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tasks That Depend on This Task */}
      {task?.dependentTasks?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Tasks Waiting on This Task</h4>
          <div className="space-y-2">
            {task.dependentTasks.map((dependentTask) => (
              <div
                key={dependentTask.id}
                className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200"
              >
                <div className="flex items-center space-x-2">
                  <LinkIcon className="h-4 w-4 text-blue-500 transform rotate-180" />
                  <span className="text-sm text-gray-900">{dependentTask.title}</span>
                </div>
                <span className="text-xs text-blue-600">Waiting</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskDependencies;
