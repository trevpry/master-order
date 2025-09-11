import React, { useState } from 'react';
import { 
  CheckIcon, 
  XMarkIcon, 
  TrashIcon, 
  PencilIcon,
  DocumentDuplicateIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';

const BulkOperations = ({ 
  selectedTasks = [], 
  allTasks = [],
  projects = [],
  categories = [],
  onBulkUpdate,
  onBulkDelete,
  onBulkDuplicate,
  onClearSelection
}) => {
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkUpdateData, setBulkUpdateData] = useState({
    status: '',
    priority: '',
    projectId: '',
    categoryId: '',
    dueDate: '',
    assignedTo: ''
  });

  const bulkActions = [
    { id: 'status', label: 'Update Status', icon: CheckIcon },
    { id: 'priority', label: 'Update Priority', icon: PencilIcon },
    { id: 'project', label: 'Move to Project', icon: ArchiveBoxIcon },
    { id: 'category', label: 'Change Category', icon: ArchiveBoxIcon },
    { id: 'duplicate', label: 'Duplicate Tasks', icon: DocumentDuplicateIcon },
    { id: 'delete', label: 'Delete Tasks', icon: TrashIcon }
  ];

  const handleBulkAction = (actionId) => {
    setBulkAction(actionId);
    
    if (actionId === 'delete') {
      handleBulkDelete();
    } else if (actionId === 'duplicate') {
      handleBulkDuplicate();
    } else {
      setShowBulkForm(true);
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedTasks.length} task(s)?`)) {
      onBulkDelete(selectedTasks.map(t => t.id));
      onClearSelection();
    }
  };

  const handleBulkDuplicate = () => {
    const tasksToCreate = selectedTasks.map(task => ({
      ...task,
      id: undefined, // Remove ID so new ones are generated
      title: `${task.title} (Copy)`,
      status: 'TODO',
      completedAt: null,
      createdAt: undefined,
      updatedAt: undefined
    }));
    
    onBulkDuplicate(tasksToCreate);
    onClearSelection();
  };

  const handleBulkUpdate = () => {
    const updateData = {};
    
    // Only include fields that have values
    Object.entries(bulkUpdateData).forEach(([key, value]) => {
      if (value && value !== '') {
        updateData[key] = value === 'null' ? null : value;
      }
    });

    if (Object.keys(updateData).length === 0) {
      alert('Please select at least one field to update');
      return;
    }

    onBulkUpdate(selectedTasks.map(t => t.id), updateData);
    setShowBulkForm(false);
    setBulkAction('');
    setBulkUpdateData({
      status: '',
      priority: '',
      projectId: '',
      categoryId: '',
      dueDate: '',
      assignedTo: ''
    });
    onClearSelection();
  };

  const getSelectedTasksSummary = () => {
    const statusCounts = selectedTasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    const priorityCounts = selectedTasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {});

    return { statusCounts, priorityCounts };
  };

  if (selectedTasks.length === 0) {
    return null;
  }

  const summary = getSelectedTasksSummary();

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-96">
        {!showBulkForm ? (
          <>
            {/* Selection Summary */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  {selectedTasks.length} task(s) selected
                </h3>
                <p className="text-xs text-gray-500">
                  {Object.entries(summary.statusCounts).map(([status, count]) => 
                    `${count} ${status.toLowerCase()}`
                  ).join(', ')}
                </p>
              </div>
              <button
                onClick={onClearSelection}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Bulk Actions */}
            <div className="grid grid-cols-2 gap-2">
              {bulkActions.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleBulkAction(action.id)}
                    className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors ${
                      action.id === 'delete'
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Bulk Update Form */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  Bulk Update {selectedTasks.length} task(s)
                </h3>
                <button
                  onClick={() => {
                    setShowBulkForm(false);
                    setBulkAction('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Status Update */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Status</label>
                  <select
                    value={bulkUpdateData.status}
                    onChange={(e) => setBulkUpdateData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Keep current</option>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">Review</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                {/* Priority Update */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Priority</label>
                  <select
                    value={bulkUpdateData.priority}
                    onChange={(e) => setBulkUpdateData(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Keep current</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                {/* Project Update */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Project</label>
                  <select
                    value={bulkUpdateData.projectId}
                    onChange={(e) => setBulkUpdateData(prev => ({ ...prev, projectId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Keep current</option>
                    <option value="null">No project</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Update */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Category</label>
                  <select
                    value={bulkUpdateData.categoryId}
                    onChange={(e) => setBulkUpdateData(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Keep current</option>
                    <option value="null">No category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date Update */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={bulkUpdateData.dueDate}
                    onChange={(e) => setBulkUpdateData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                {/* Assigned To Update */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Assigned To</label>
                  <input
                    type="text"
                    placeholder="Enter name or email"
                    value={bulkUpdateData.assignedTo}
                    onChange={(e) => setBulkUpdateData(prev => ({ ...prev, assignedTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowBulkForm(false);
                  setBulkAction('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Update Tasks
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkOperations;
