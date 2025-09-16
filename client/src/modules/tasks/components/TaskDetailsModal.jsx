import React, { useState, useEffect } from 'react';
import Button from '../../../shared/components/Button';
import { formatDateWithTimezone, formatDateTimeWithTimezone, getTimezone } from '../../../utils/timezoneUtils';

const TaskDetailsModal = ({ 
  task, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete,
  onToggleStatus,
  onToggleCompletion,
  onStartTimer 
}) => {
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    const initTimezone = async () => {
      const tz = await getTimezone();
      setTimezone(tz);
    };
    initTimezone();
  }, []);

  if (!isOpen || !task) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'todo': return 'text-gray-600 bg-gray-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'Not set';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Task Details</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white px-6 py-4 space-y-6">
            {/* Title and Status */}
            <div>
              <div className="flex items-start justify-between mb-3">
                <h3 className={`text-2xl font-bold text-gray-900 ${
                  task.status === 'completed' ? 'line-through text-gray-500' : ''
                }`}>
                  {task.title}
                </h3>
                <div className="flex items-center space-x-2 ml-4">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(task.status)}`}>
                    {task.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={`px-3 py-1 text-sm font-medium rounded border ${getPriorityColor(task.priority)}`}>
                    {task.priority.toUpperCase()}
                  </span>
                </div>
              </div>
              
              {task.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                  <p className="text-gray-600 leading-relaxed">{task.description}</p>
                </div>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Project</h4>
                  <p className="text-gray-900">
                    {task.project ? (
                      <span className="flex items-center">
                        <span 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: task.project.color || '#6B7280' }}
                        ></span>
                        {task.project.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">No project assigned</span>
                    )}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Category</h4>
                  <p className="text-gray-900">
                    {task.category ? (
                      <span className="flex items-center">
                        {task.category.icon && <span className="mr-2">{task.category.icon}</span>}
                        {task.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">No category assigned</span>
                    )}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Due Date</h4>
                  <p className={`${task.dueDate ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formatDate(task.dueDate)}
                  </p>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Estimated Time</h4>
                  <p className={`${task.estimatedMinutes ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formatDuration(task.estimatedMinutes)}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Actual Time</h4>
                  <p className={`${task.actualMinutes ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formatDuration(task.actualMinutes)}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Created</h4>
                  <p className="text-gray-900">
                    {formatDateTime(task.createdAt)}
                  </p>
                </div>

                {task.updatedAt && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Last Updated</h4>
                    <p className="text-gray-900">
                      {formatDateTime(task.updatedAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Time Entries (if any) */}
            {task.timeEntries && task.timeEntries.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Time Entries</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2">
                    {task.timeEntries.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          {formatDateTime(entry.startTime)}
                        </span>
                        <span className="text-gray-900 font-medium">
                          {formatDuration(entry.duration)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Status Actions */}
                {task.status === 'todo' && (
                  <Button
                    onClick={() => {
                      onToggleStatus(task.id, 'in_progress');
                      onClose();
                    }}
                    className="secondary"
                    size="small"
                  >
                    Start Task
                  </Button>
                )}
                {task.status === 'in_progress' && (
                  <Button
                    onClick={() => {
                      onToggleStatus(task.id, 'completed');
                      onClose();
                    }}
                    className="secondary"
                    size="small"
                  >
                    Complete Task
                  </Button>
                )}
                {task.status === 'completed' && onToggleCompletion && (
                  <Button
                    onClick={() => {
                      onToggleCompletion(task.id, false);
                      onClose();
                    }}
                    className="secondary"
                    size="small"
                  >
                    Reopen Task
                  </Button>
                )}

                {/* Timer Action */}
                {task.status !== 'completed' && onStartTimer && (
                  <Button
                    onClick={() => {
                      onStartTimer(task);
                      onClose();
                    }}
                    className="secondary"
                    size="small"
                  >
                    ⏱️ Start Timer
                  </Button>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => {
                    onEdit(task);
                    onClose();
                  }}
                  className="secondary"
                  size="small"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this task?')) {
                      onDelete(task.id);
                      onClose();
                    }
                  }}
                  className="danger"
                  size="small"
                >
                  Delete
                </Button>
                <Button
                  onClick={onClose}
                  className="primary"
                  size="small"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal;
