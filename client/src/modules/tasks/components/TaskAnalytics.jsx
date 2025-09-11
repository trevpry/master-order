import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

const TaskAnalytics = ({ 
  tasks = [], 
  timeEntries = [], 
  projects = [],
  dateRange = 'week' // week, month, quarter, year
}) => {
  const [analytics, setAnalytics] = useState(null);
  const [selectedView, setSelectedView] = useState('overview');

  useEffect(() => {
    calculateAnalytics();
  }, [tasks, timeEntries, dateRange]);

  const calculateAnalytics = () => {
    const now = new Date();
    const filterDate = getFilterDate(now, dateRange);
    
    // Filter data based on date range
    const filteredTasks = tasks.filter(task => 
      new Date(task.createdAt) >= filterDate
    );
    
    const filteredTimeEntries = timeEntries.filter(entry => 
      new Date(entry.startTime) >= filterDate
    );

    // Basic task metrics
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter(t => t.status === 'COMPLETED').length;
    const inProgressTasks = filteredTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const overdueTasks = filteredTasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED'
    ).length;

    // Time tracking metrics
    const totalTimeMinutes = filteredTimeEntries.reduce((sum, entry) => 
      sum + (entry.minutes || 0), 0
    );
    const avgTimePerTask = totalTasks > 0 ? totalTimeMinutes / totalTasks : 0;

    // Productivity metrics
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const overdueRate = totalTasks > 0 ? (overdueTasks / totalTasks) * 100 : 0;

    // Priority distribution
    const priorityStats = {
      urgent: filteredTasks.filter(t => t.priority === 'URGENT').length,
      high: filteredTasks.filter(t => t.priority === 'HIGH').length,
      medium: filteredTasks.filter(t => t.priority === 'MEDIUM').length,
      low: filteredTasks.filter(t => t.priority === 'LOW').length
    };

    // Project distribution
    const projectStats = projects.map(project => {
      const projectTasks = filteredTasks.filter(t => t.projectId === project.id);
      const projectTime = filteredTimeEntries
        .filter(e => e.projectId === project.id)
        .reduce((sum, entry) => sum + (entry.minutes || 0), 0);
      
      return {
        id: project.id,
        name: project.name,
        taskCount: projectTasks.length,
        completedTasks: projectTasks.filter(t => t.status === 'COMPLETED').length,
        timeSpent: projectTime,
        completionRate: projectTasks.length > 0 ? 
          (projectTasks.filter(t => t.status === 'COMPLETED').length / projectTasks.length) * 100 : 0
      };
    }).filter(p => p.taskCount > 0);

    // Daily/weekly trends
    const trends = calculateTrends(filteredTasks, dateRange);

    setAnalytics({
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      totalTimeMinutes,
      avgTimePerTask,
      completionRate,
      overdueRate,
      priorityStats,
      projectStats,
      trends
    });
  };

  const getFilterDate = (now, range) => {
    switch (range) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'quarter':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  };

  const calculateTrends = (tasks, range) => {
    // Simple trend calculation - compare current period with previous period
    const now = new Date();
    const currentPeriod = getFilterDate(now, range);
    const previousPeriod = new Date(currentPeriod.getTime() - (now.getTime() - currentPeriod.getTime()));

    const currentTasks = tasks.filter(t => new Date(t.createdAt) >= currentPeriod);
    const previousTasks = tasks.filter(t => 
      new Date(t.createdAt) >= previousPeriod && new Date(t.createdAt) < currentPeriod
    );

    const currentCompleted = currentTasks.filter(t => t.status === 'COMPLETED').length;
    const previousCompleted = previousTasks.filter(t => t.status === 'COMPLETED').length;

    return {
      tasksCreated: {
        current: currentTasks.length,
        previous: previousTasks.length,
        change: currentTasks.length - previousTasks.length
      },
      tasksCompleted: {
        current: currentCompleted,
        previous: previousCompleted,
        change: currentCompleted - previousCompleted
      }
    };
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatPercentage = (value) => {
    return `${Math.round(value)}%`;
  };

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Task Analytics</h2>
        <div className="flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
            <option value="quarter">Past Quarter</option>
            <option value="year">Past Year</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Tasks</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalTasks}</p>
              {analytics.trends.tasksCreated.change !== 0 && (
                <div className="flex items-center mt-1">
                  {analytics.trends.tasksCreated.change > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-xs ml-1 ${
                    analytics.trends.tasksCreated.change > 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {Math.abs(analytics.trends.tasksCreated.change)} vs last period
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.completedTasks}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatPercentage(analytics.completionRate)} completion rate
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-orange-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Time Spent</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatTime(analytics.totalTimeMinutes)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Avg: {formatTime(analytics.avgTimePerTask)}/task
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overdueTasks}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatPercentage(analytics.overdueRate)} of total
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
          <div className="space-y-3">
            {Object.entries(analytics.priorityStats).map(([priority, count]) => {
              const percentage = analytics.totalTasks > 0 ? (count / analytics.totalTasks) * 100 : 0;
              const colors = {
                urgent: 'bg-red-500',
                high: 'bg-orange-500',
                medium: 'bg-yellow-500',
                low: 'bg-green-500'
              };
              
              return (
                <div key={priority}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize text-gray-700">{priority}</span>
                    <span className="text-gray-900 font-medium">{count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className={`h-2 rounded-full ${colors[priority]}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Project Performance */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Performance</h3>
          <div className="space-y-4">
            {analytics.projectStats.slice(0, 5).map(project => (
              <div key={project.id} className="border-b border-gray-100 pb-3 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{project.name}</span>
                  <span className="text-xs text-gray-500">{project.taskCount} tasks</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>{project.completedTasks} completed</span>
                  <span>{formatTime(project.timeSpent)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className="h-1.5 rounded-full bg-blue-500"
                    style={{ width: `${project.completionRate}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskAnalytics;
