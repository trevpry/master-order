import React, { useState } from 'react';
import TaskCard from './TaskCard';

const KanbanBoard = ({ 
  tasks, 
  onTaskMove, 
  onEdit, 
  onDelete, 
  onStartTimer,
  onViewDetails,
  loading 
}) => {
  const [draggedTask, setDraggedTask] = useState(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState(null);

  const columns = [
    { id: 'TODO', title: 'To Do', color: 'bg-gray-50' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-50' },
    { id: 'REVIEW', title: 'Review', color: 'bg-yellow-50' },
    { id: 'COMPLETED', title: 'Completed', color: 'bg-green-50' }
  ];

  const getTasksByStatus = (status) => {
    return tasks.filter(task => task.status === status);
  };

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverColumn(columnId);
  };

  const handleDragLeave = (e) => {
    // Only clear if we're leaving the column entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDraggedOverColumn(null);
    }
  };

  const handleDrop = (e, columnId) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    
    if (draggedTask && draggedTask.status !== columnId) {
      onTaskMove(draggedTask.id, columnId);
    }
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDraggedOverColumn(null);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map(column => (
          <div key={column.id} className={`${column.color} rounded-lg p-4 min-h-96`}>
            <h3 className="font-semibold text-gray-900 mb-4">{column.title}</h3>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2 mb-4"></div>
                    <div className="h-8 bg-gray-300 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {columns.map(column => (
        <div 
          key={column.id} 
          className={`${column.color} rounded-lg p-4 min-h-96 ${
            draggedOverColumn === column.id ? 'ring-2 ring-blue-400 bg-blue-100' : ''
          } transition-all duration-200`}
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{column.title}</h3>
            <span className="bg-white text-gray-600 text-xs font-medium px-2 py-1 rounded-full">
              {getTasksByStatus(column.id).length}
            </span>
          </div>

          <div className="space-y-3 min-h-80">
            {getTasksByStatus(column.id).map((task, index) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, task)}
                onDragEnd={handleDragEnd}
                className={`cursor-move transition-all duration-200 ${
                  draggedTask?.id === task.id ? 'opacity-50 scale-95' : ''
                }`}
              >
                <TaskCard
                  task={task}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleStatus={() => {}} // Handled by drag & drop
                  onStartTimer={onStartTimer}
                  onViewDetails={onViewDetails}
                  compact={true}
                  showProject={true}
                />
              </div>
            ))}
            
            {getTasksByStatus(column.id).length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No tasks</p>
                <p className="text-xs">Drag tasks here</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KanbanBoard;
