import React from 'react';

const TaskCard = ({ 
  task, 
  onEdit, 
  onDelete, 
  onToggleStatus, 
  onToggleCompletion,
  onStartTimer,
  showProject = true,
  compact = false 
}) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'todo':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'urgent':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getCardBackground = (priority, status) => {
    // If completed, use muted background
    if (status === 'completed') {
      return 'bg-gray-50 border-gray-200';
    }
    
    switch (priority) {
      case 'urgent':
        return 'bg-red-50 border-red-200';
      case 'high':
        return 'bg-orange-50 border-orange-200';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200';
      case 'low':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const formatDueDate = (dueDate) => {
    if (!dueDate) return null;
    
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)} days`, class: 'text-red-600' };
    } else if (diffDays === 0) {
      return { text: 'Due today', class: 'text-orange-600' };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', class: 'text-yellow-600' };
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days`, class: 'text-blue-600' };
    } else {
      return { text: date.toLocaleDateString(), class: 'text-gray-600' };
    }
  };

  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;

  return (
    <div className={`rounded-lg shadow-sm border hover:shadow-md transition-shadow ${compact ? 'p-3' : 'p-4'} ${
      getCardBackground(task.priority, task.status)
    } ${task.status === 'completed' ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          {/* Completion Checkbox */}
          <button
            onClick={() => onToggleCompletion && onToggleCompletion(task.id, task.status !== 'completed')}
            className={`flex-shrink-0 mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              task.status === 'completed'
                ? 'bg-green-500 border-green-500 text-white hover:bg-green-600'
                : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
            }`}
            title={task.status === 'completed' ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {task.status === 'completed' && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'} truncate ${
              task.status === 'completed' ? 'line-through text-gray-500' : ''
            }`}>
              {task.title}
            </h3>
            {task.description && !compact && (
              <p className={`text-sm text-gray-600 mt-1 line-clamp-2 ${
                task.status === 'completed' ? 'text-gray-400' : ''
              }`}>
                {task.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-3">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
            {task.status.replace('_', ' ')}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          {showProject && task.project && (
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: task.project.color || '#6B7280' }}></span>
              {task.project.name}
            </span>
          )}
          {task.category && (
            <span className="flex items-center">
              {task.category.icon && <span className="mr-1">{task.category.icon}</span>}
              {task.category.name}
            </span>
          )}
          {dueInfo && (
            <span className={dueInfo.class}>
              {dueInfo.text}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {task.estimatedMinutes && (
            <span className="text-xs text-gray-500">
              Est: {Math.round(task.estimatedMinutes / 60 * 10) / 10}h
            </span>
          )}
          {task.actualMinutes && (
            <span className="text-xs text-gray-500">
              Actual: {Math.round(task.actualMinutes / 60 * 10) / 10}h
            </span>
          )}
        </div>
      </div>

      {!compact && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            {task.status === 'todo' && (
              <button
                onClick={() => onToggleStatus(task.id, 'in_progress')}
                className="text-xs px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
              >
                Start
              </button>
            )}
            {task.status === 'in_progress' && (
              <button
                onClick={() => onToggleStatus(task.id, 'completed')}
                className="text-xs px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
              >
                Complete
              </button>
            )}
            {task.status === 'completed' && onToggleCompletion && (
              <button
                onClick={() => onToggleCompletion(task.id, false)}
                className="text-xs px-3 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded transition-colors"
              >
                Reopen
              </button>
            )}
            {task.status !== 'completed' && onStartTimer && (
              <button
                onClick={() => onStartTimer(task)}
                className="text-xs px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors"
              >
                ⏱️ Timer
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(task)}
              className="text-xs px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="text-xs px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCard;
