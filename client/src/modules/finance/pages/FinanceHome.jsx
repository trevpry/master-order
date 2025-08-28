import React from 'react';
import Button from '../../../shared/components/Button';

function FinanceHome() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Finance & Budgeting</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Welcome to Eddie Finance</h2>
          <p className="text-gray-600 mb-4">
            Manage your personal finances, budgets, and financial goals. This module will include:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2 mb-6">
            <li>Expense tracking and categorization</li>
            <li>Budget creation and monitoring</li>
            <li>Income and cash flow management</li>
            <li>Financial goal setting and tracking</li>
            <li>Investment portfolio monitoring</li>
            <li>Bill reminders and recurring transactions</li>
          </ul>
          <Button variant="primary" className="mr-4">
            Add Transaction
          </Button>
          <Button variant="secondary">
            View Budget Overview
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-emerald-50 rounded-lg p-4">
            <h3 className="font-semibold text-emerald-800 mb-2">Account Balance</h3>
            <ul className="text-emerald-700 text-sm space-y-1">
              <li>• Checking: Not connected</li>
              <li>• Savings: Not connected</li>
              <li>• Credit Cards: Not connected</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">This Month</h3>
            <p className="text-blue-700 text-sm">Income: $0<br />Expenses: $0<br />Net: $0</p>
          </div>
          
          <div className="bg-amber-50 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 mb-2">Budget Status</h3>
            <p className="text-amber-700 text-sm">No budgets created<br />Set up your first budget!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinanceHome;
