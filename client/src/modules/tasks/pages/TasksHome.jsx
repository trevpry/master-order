import React from 'react';
import Button from '../../../shared/components/Button';

function TasksHome() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Tasks & Productivity</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Welcome to Eddie Tasks</h2>
          <p className="text-gray-600 mb-4">
            Manage your daily tasks, projects, and productivity goals. This module will include:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2 mb-6">
            <li>Task management with priorities and due dates</li>
            <li>Project organization and tracking</li>
            <li>Time tracking and productivity analytics</li>
            <li>Goal setting and achievement tracking</li>
            <li>Team collaboration features</li>
          </ul>
          <Button variant="primary" className="mr-4">
            Create New Task
          </Button>
          <Button variant="secondary">
            View All Projects
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Quick Actions</h3>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Add quick task</li>
              <li>• Start timer</li>
              <li>• Check today's agenda</li>
            </ul>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-2">Recent Projects</h3>
            <p className="text-green-700 text-sm">No projects yet - create your first project to get started!</p>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="font-semibold text-purple-800 mb-2">This Week</h3>
            <p className="text-purple-700 text-sm">0 tasks completed<br />0 hours logged</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TasksHome;
