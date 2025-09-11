import React from 'react';

const DashboardStats = ({ stats, loading, error }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-red-600">Error loading stats: {error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      title: 'Total Tasks',
      value: stats.tasks.total,
      subtitle: `${stats.tasks.completed} completed`,
      color: 'blue',
      icon: '📋'
    },
    {
      title: 'In Progress',
      value: stats.tasks.inProgress,
      subtitle: 'Active tasks',
      color: 'yellow',
      icon: '⏳'
    },
    {
      title: 'Due Today',
      value: stats.tasks.today,
      subtitle: 'Tasks due today',
      color: 'orange',
      icon: '📅'
    },
    {
      title: 'Overdue',
      value: stats.tasks.overdue,
      subtitle: 'Past due date',
      color: 'red',
      icon: '⚠️'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200',
      yellow: 'bg-yellow-50 border-yellow-200',
      orange: 'bg-orange-50 border-orange-200',
      red: 'bg-red-50 border-red-200',
      green: 'bg-green-50 border-green-200'
    };
    return colors[color] || colors.blue;
  };

  const getTextColorClasses = (color) => {
    const colors = {
      blue: 'text-blue-700',
      yellow: 'text-yellow-700',
      orange: 'text-orange-700',
      red: 'text-red-700',
      green: 'text-green-700'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <div
          key={index}
          className={`rounded-lg shadow-sm border p-4 ${getColorClasses(stat.color)}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className={`text-2xl font-bold ${getTextColorClasses(stat.color)}`}>
                {stat.value}
              </p>
              <p className="text-xs text-gray-500">{stat.subtitle}</p>
            </div>
            <div className="text-2xl">{stat.icon}</div>
          </div>
        </div>
      ))}

      {/* Additional stats row */}
      <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Projects</p>
              <p className="text-xl font-bold text-green-700">{stats.projects.active}</p>
              <p className="text-xs text-gray-500">{stats.projects.completed} completed</p>
            </div>
            <div className="text-xl">🗂️</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Week</p>
              <p className="text-xl font-bold text-purple-700">
                {Math.round(stats.timeTracking.thisWeekHours * 10) / 10}h
              </p>
              <p className="text-xs text-gray-500">Time tracked</p>
            </div>
            <div className="text-xl">⏱️</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Entries</p>
              <p className="text-xl font-bold text-indigo-700">{stats.timeTracking.todayEntries}</p>
              <p className="text-xs text-gray-500">Time entries</p>
            </div>
            <div className="text-xl">📊</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
