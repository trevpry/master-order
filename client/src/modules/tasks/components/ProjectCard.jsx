import React from 'react';

const ProjectCard = ({ 
  project, 
  onEdit, 
  onDelete, 
  onView,
  onToggleStatus,
  compact = false 
}) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'LOW':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'MEDIUM':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'URGENT':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  const completedTasks = project.tasks?.filter(task => task.status === 'completed').length || 0;
  const totalTasks = project.tasks?.length || 0;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-2">
            {project.icon && (
              <span className="text-lg mr-2">{project.icon}</span>
            )}
            <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'} truncate`}>
              {project.name}
            </h3>
          </div>
          {project.description && !compact && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2 ml-3">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
            {project.status.replace('_', ' ')}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(project.priority)}`}>
            {project.priority}
          </span>
        </div>
      </div>

      {/* Project Color Bar */}
      <div className="w-full h-1 bg-gray-200 rounded-full mb-3">
        <div 
          className="h-1 rounded-full transition-all duration-300"
          style={{ 
            width: `${completionPercentage}%`,
            backgroundColor: project.color || '#3B82F6'
          }}
        ></div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
        <div className="flex items-center space-x-4">
          <span>{completedTasks}/{totalTasks} tasks</span>
          <span>{completionPercentage}% complete</span>
          {project.TaskCategory && (
            <span className="flex items-center">
              {project.TaskCategory.icon && <span className="mr-1">{project.TaskCategory.icon}</span>}
              {project.TaskCategory.name}
            </span>
          )}
        </div>
        {project.dueDate && (
          <span className={`${new Date(project.dueDate) < new Date() ? 'text-red-600' : 'text-gray-600'}`}>
            Due: {formatDate(project.dueDate)}
          </span>
        )}
      </div>

      {!compact && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onView(project)}
              className="text-xs px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
            >
              View Tasks
            </button>
            {project.status === 'active' && (
              <button
                onClick={() => onToggleStatus(project.id, 'completed')}
                className="text-xs px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
              >
                Complete
              </button>
            )}
            {project.status === 'completed' && (
              <button
                onClick={() => onToggleStatus(project.id, 'active')}
                className="text-xs px-3 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded transition-colors"
              >
                Reopen
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(project)}
              className="text-xs px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(project.id)}
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

export default ProjectCard;
