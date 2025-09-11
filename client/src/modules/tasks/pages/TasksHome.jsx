import React, { useState } from 'react';
import Button from '../../../shared/components/Button';
import DashboardStats from '../components/DashboardStats';
import TaskCard from '../components/TaskCard';
import ProjectCard from '../components/ProjectCard';
import TimerWidget from '../components/TimerWidget';
import TaskForm from '../components/TaskForm';
import ProjectForm from '../components/ProjectForm';
import KanbanBoard from '../components/KanbanBoard';
import TaskSearchAndFilter from '../components/TaskSearchAndFilter';
import TaskAnalytics from '../components/TaskAnalytics';
import BulkOperations from '../components/BulkOperations';
import { useDashboardStats, useTasks, useProjects, useCategories, useTimeTracking } from '../hooks/useTasks';

function TasksHome() {
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, tasks, projects, kanban, analytics
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [taskFilters, setTaskFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTasks, setSelectedTasks] = useState([]);

  // Hooks
  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { tasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks, createTask, updateTask, deleteTask } = useTasks(taskFilters);
  const { projects, loading: projectsLoading, createProject, updateProject, deleteProject } = useProjects();
  const { categories } = useCategories();
  const { activeEntry, startTimer, stopTimer, fetchActiveEntry } = useTimeTracking();

  // Task handlers
  const handleCreateTask = async (taskData) => {
    try {
      await createTask(taskData);
      setShowTaskForm(false);
      refetchStats();
      refetchTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleUpdateTask = async (taskData) => {
    try {
      await updateTask(editingTask.id, taskData);
      setEditingTask(null);
      setShowTaskForm(false);
      refetchStats();
      refetchTasks();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(taskId);
        refetchStats();
        refetchTasks();
      } catch (error) {
        console.error('Failed to delete task:', error);
      }
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleToggleTaskStatus = async (taskId, newStatus) => {
    try {
      await updateTask(taskId, { status: newStatus });
      refetchStats();
      refetchTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handleStartTimer = async (task) => {
    try {
      await startTimer({
        description: `Working on: ${task.title}`,
        taskId: task.id,
        projectId: task.projectId
      });
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handleStopTimer = async (entryId) => {
    try {
      await stopTimer(entryId);
      refetchStats();
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  };

  // Project handlers
  const handleCreateProject = async (projectData) => {
    try {
      await createProject(projectData);
      setShowProjectForm(false);
      refetchStats();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleUpdateProject = async (projectData) => {
    try {
      await updateProject(editingProject.id, projectData);
      setEditingProject(null);
      setShowProjectForm(false);
      refetchStats();
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(projectId);
        refetchStats();
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setShowProjectForm(true);
  };

  const handleToggleProjectStatus = async (projectId, newStatus) => {
    try {
      await updateProject(projectId, { status: newStatus });
      refetchStats();
    } catch (error) {
      console.error('Failed to update project status:', error);
    }
  };

  // Filter handlers
  const handleTaskFilter = (filters) => {
    setTaskFilters(filters);
  };

  const handleTaskSearch = (searchTerm) => {
    setSearchTerm(searchTerm);
    // Add search term to filters
    setTaskFilters(prev => ({ ...prev, search: searchTerm }));
  };

  // Selection handlers
  const handleTaskSelect = (task, isSelected) => {
    if (isSelected) {
      setSelectedTasks(prev => [...prev, task]);
    } else {
      setSelectedTasks(prev => prev.filter(t => t.id !== task.id));
    }
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedTasks(tasks);
    } else {
      setSelectedTasks([]);
    }
  };

  const handleClearSelection = () => {
    setSelectedTasks([]);
  };

  // Bulk operation handlers
  const handleBulkUpdate = async (taskIds, updateData) => {
    try {
      await Promise.all(taskIds.map(id => updateTask(id, updateData)));
      refetchStats();
      refetchTasks();
    } catch (error) {
      console.error('Failed to bulk update tasks:', error);
    }
  };

  const handleBulkDelete = async (taskIds) => {
    try {
      await Promise.all(taskIds.map(id => deleteTask(id)));
      refetchStats();
      refetchTasks();
    } catch (error) {
      console.error('Failed to bulk delete tasks:', error);
    }
  };

  const handleBulkDuplicate = async (tasksToCreate) => {
    try {
      await Promise.all(tasksToCreate.map(task => createTask(task)));
      refetchStats();
      refetchTasks();
    } catch (error) {
      console.error('Failed to bulk duplicate tasks:', error);
    }
  };

  // Kanban handlers
  const handleTaskMove = async (taskId, newStatus) => {
    try {
      await updateTask(taskId, { status: newStatus });
      refetchStats();
      refetchTasks();
    } catch (error) {
      console.error('Failed to move task:', error);
    }
  };

  const getDueSoonTasks = () => {
    return tasks.filter(task => {
      if (!task.dueDate || task.status === 'completed') return false;
      const dueDate = new Date(task.dueDate);
      const now = new Date();
      const diffTime = dueDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 3 && diffDays >= 0;
    });
  };

  const getOverdueTasks = () => {
    return tasks.filter(task => {
      if (!task.dueDate || task.status === 'completed') return false;
      return new Date(task.dueDate) < new Date();
    });
  };

  if (showTaskForm) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <TaskForm
            task={editingTask}
            onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
            onCancel={() => {
              setShowTaskForm(false);
              setEditingTask(null);
            }}
            projects={projects}
            categories={categories}
          />
        </div>
      </div>
    );
  }

  if (showProjectForm) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <ProjectForm
            project={editingProject}
            onSubmit={editingProject ? handleUpdateProject : handleCreateProject}
            onCancel={() => {
              setShowProjectForm(false);
              setEditingProject(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Tasks & Productivity</h1>
          <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === 'dashboard' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('tasks')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === 'tasks' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Tasks
              </button>
              <button
                onClick={() => setCurrentView('projects')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === 'projects' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Projects
              </button>
              <button
                onClick={() => setCurrentView('kanban')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === 'kanban' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Kanban
              </button>
              <button
                onClick={() => setCurrentView('analytics')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === 'analytics' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Analytics
              </button>
            </div>
            <Button 
              onClick={() => setShowTaskForm(true)}
              className="primary"
            >
              + New Task
            </Button>
          </div>
        </div>

        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <>
            <DashboardStats 
              stats={stats} 
              loading={statsLoading} 
              error={statsError} 
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Timer and Quick Actions */}
              <div className="space-y-6">
                <TimerWidget
                  activeEntry={activeEntry}
                  onStart={startTimer}
                  onStop={handleStopTimer}
                  tasks={tasks}
                  projects={projects}
                />

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowTaskForm(true)}
                      className="w-full text-left px-3 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors"
                    >
                      ➕ Create New Task
                    </button>
                    <button
                      onClick={() => setCurrentView('projects')}
                      className="w-full text-left px-3 py-2 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded transition-colors"
                    >
                      📁 View All Projects
                    </button>
                    <button
                      onClick={() => {
                        setCurrentView('tasks');
                        handleTaskFilter({ status: 'todo' });
                      }}
                      className="w-full text-left px-3 py-2 text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 rounded transition-colors"
                    >
                      📋 View To-Do Tasks
                    </button>
                  </div>
                </div>
              </div>

              {/* Middle Column - Due Soon Tasks */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Due Soon</h3>
                <div className="space-y-3">
                  {getDueSoonTasks().slice(0, 5).map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteTask}
                      onToggleStatus={handleToggleTaskStatus}
                      onStartTimer={handleStartTimer}
                      compact={true}
                    />
                  ))}
                  {getDueSoonTasks().length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No tasks due soon</p>
                      <p className="text-sm">Great job staying on top of things! 🎉</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Overdue and Recent Projects */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Overdue Tasks</h3>
                <div className="space-y-3 mb-6">
                  {getOverdueTasks().slice(0, 3).map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteTask}
                      onToggleStatus={handleToggleTaskStatus}
                      onStartTimer={handleStartTimer}
                      compact={true}
                    />
                  ))}
                  {getOverdueTasks().length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      <p>No overdue tasks! ✅</p>
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Projects</h3>
                <div className="space-y-3">
                  {projects.filter(p => p.status === 'active').slice(0, 3).map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onEdit={handleEditProject}
                      onDelete={handleDeleteProject}
                      onView={() => setCurrentView('projects')}
                      onToggleStatus={handleToggleProjectStatus}
                      compact={true}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tasks View */}
        {currentView === 'tasks' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">All Tasks</h2>
              <div className="flex items-center space-x-4">
                <TaskSearchAndFilter
                  onFilter={handleTaskFilter}
                  onSearch={handleTaskSearch}
                  projects={projects}
                  categories={categories}
                />
                <Button 
                  onClick={() => setShowTaskForm(true)}
                  className="primary"
                >
                  + New Task
                </Button>
              </div>
            </div>

            {tasksLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/2 mb-4"></div>
                      <div className="h-2 bg-gray-300 rounded mb-4"></div>
                      <div className="h-8 bg-gray-300 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                    onToggleStatus={handleToggleTaskStatus}
                    onStartTimer={handleStartTimer}
                    showProject={true}
                  />
                ))}
                {tasks.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-gray-500 text-lg">No tasks found</p>
                    <Button 
                      onClick={() => setShowTaskForm(true)}
                      className="primary mt-4"
                    >
                      Create Your First Task
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Projects View */}
        {currentView === 'projects' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">All Projects</h2>
              <Button 
                onClick={() => setShowProjectForm(true)}
                className="primary"
              >
                + New Project
              </Button>
            </div>

            {projectsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/2 mb-4"></div>
                      <div className="h-2 bg-gray-300 rounded mb-4"></div>
                      <div className="h-8 bg-gray-300 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={handleEditProject}
                    onDelete={handleDeleteProject}
                    onView={() => {}}
                    onToggleStatus={handleToggleProjectStatus}
                  />
                ))}
                {projects.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-gray-500 text-lg">No projects found</p>
                    <Button 
                      onClick={() => setShowProjectForm(true)}
                      className="primary mt-4"
                    >
                      Create Your First Project
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Kanban View */}
        {currentView === 'kanban' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Kanban Board</h2>
            </div>

            <KanbanBoard
              tasks={tasks}
              onTaskMove={handleTaskMove}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              onStartTimer={handleStartTimer}
              loading={tasksLoading}
            />
          </div>
        )}

        {/* Analytics View */}
        {currentView === 'analytics' && (
          <TaskAnalytics
            tasks={tasks}
            timeEntries={[]} // We'll need to fetch this data
            projects={projects}
            dateRange="month"
          />
        )}

        {/* Bulk Operations */}
        <BulkOperations
          selectedTasks={selectedTasks}
          allTasks={tasks}
          projects={projects}
          categories={categories}
          onBulkUpdate={handleBulkUpdate}
          onBulkDelete={handleBulkDelete}
          onBulkDuplicate={handleBulkDuplicate}
          onClearSelection={handleClearSelection}
        />
      </div>
    </div>
  );
}

export default TasksHome;
