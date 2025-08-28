import React from 'react';
import Button from '../../../shared/components/Button';

function HealthHome() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Health & Wellness</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Welcome to Eddie Health</h2>
          <p className="text-gray-600 mb-4">
            Track your health metrics, wellness goals, and medical information. This module will include:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2 mb-6">
            <li>Health metrics tracking (weight, blood pressure, etc.)</li>
            <li>Exercise and fitness logging</li>
            <li>Nutrition and meal tracking</li>
            <li>Medication reminders and scheduling</li>
            <li>Medical appointment management</li>
            <li>Health goal setting and progress tracking</li>
          </ul>
          <Button variant="primary" className="mr-4">
            Log Health Data
          </Button>
          <Button variant="secondary">
            View Health Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">Vital Signs</h3>
            <ul className="text-red-700 text-sm space-y-1">
              <li>• Weight: Not tracked</li>
              <li>• Blood Pressure: Not tracked</li>
              <li>• Heart Rate: Not tracked</li>
            </ul>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4">
            <h3 className="font-semibold text-orange-800 mb-2">Fitness</h3>
            <p className="text-orange-700 text-sm">No workouts logged today<br />Start tracking your fitness journey!</p>
          </div>
          
          <div className="bg-teal-50 rounded-lg p-4">
            <h3 className="font-semibold text-teal-800 mb-2">Wellness Goals</h3>
            <p className="text-teal-700 text-sm">Set your health goals<br />Track your progress</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HealthHome;
