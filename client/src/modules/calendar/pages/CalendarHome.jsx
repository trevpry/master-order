import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Calendar from '../../../components/notes/Calendar';
import DailyView from '../components/DailyView';
import { getTodayDateString } from '../../../utils/timezoneUtils';

const CalendarHome = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Initialize with today's date
  useEffect(() => {
    const initializeDate = async () => {
      const today = await getTodayDateString();
      setSelectedDate(today);
    };
    initializeDate();
  }, []);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="h-full bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <CalendarIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
          </div>
          <p className="text-gray-600">
            View your daily notes, weather, and watch statistics by date
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                
                <h2 className="text-lg font-semibold text-gray-900">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h2>
                
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Calendar Component */}
              <Calendar
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                currentMonth={currentMonth}
                showToday={true}
                className="border-0 shadow-none p-0"
              />
            </div>
          </div>

          {/* Daily View Panel */}
          <div className="lg:col-span-2">
            {selectedDate && (
              <DailyView 
                date={selectedDate}
                onDateChange={setSelectedDate}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarHome;