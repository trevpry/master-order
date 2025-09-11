import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Edit3,
  Plus
} from 'lucide-react';

const Calendar = ({ 
  selectedDate, 
  onDateSelect, 
  highlightedDates = [], 
  className = '',
  showToday = true 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dailyNoteDates, setDailyNoteDates] = useState([]);

  useEffect(() => {
    fetchDailyNoteDates();
  }, [currentMonth]);

  const fetchDailyNoteDates = async () => {
    try {
      const month = currentMonth.getMonth() + 1;
      const year = currentMonth.getFullYear();
      
      const response = await fetch(`/api/notes/daily-dates?month=${month}&year=${year}`);
      if (response.ok) {
        const dates = await response.json();
        setDailyNoteDates(dates.data || []);
      }
    } catch (error) {
      console.error('Error fetching daily note dates:', error);
    }
  };

  const today = new Date();
  const selectedDateObj = selectedDate ? new Date(selectedDate) : null;

  // Get first day of the month and number of days
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

  const days = [];
  const currentDate = new Date(startDate);

  // Generate 42 days (6 weeks) for the calendar grid
  for (let i = 0; i < 42; i++) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const isToday = (date) => {
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    return selectedDateObj && date.toDateString() === selectedDateObj.toDateString();
  };

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const isHighlighted = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return highlightedDates.includes(dateStr);
  };

  const hasDailyNote = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return dailyNoteDates.some(d => d.date === dateStr);
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    if (onDateSelect) {
      onDateSelect(today.toISOString().split('T')[0]);
    }
  };

  const handleDateClick = (date) => {
    if (onDateSelect) {
      onDateSelect(date.toISOString().split('T')[0]);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          title="Previous month"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
        </div>
        
        <button
          onClick={() => navigateMonth(1)}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          title="Next month"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Quick Actions */}
      {showToday && (
        <div className="flex justify-center mb-4">
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            Today
          </button>
        </div>
      )}

      {/* Day Names Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const isCurrentMonthDate = isCurrentMonth(date);
          const isTodayDate = isToday(date);
          const isSelectedDate = isSelected(date);
          const isHighlightedDate = isHighlighted(date);
          const hasNote = hasDailyNote(date);

          return (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              className={`
                relative h-10 w-10 text-sm rounded-md transition-all duration-200
                ${isCurrentMonthDate 
                  ? 'text-gray-900 hover:bg-gray-100' 
                  : 'text-gray-300 hover:bg-gray-50'
                }
                ${isTodayDate 
                  ? 'bg-blue-100 text-blue-700 font-semibold border-2 border-blue-300' 
                  : ''
                }
                ${isSelectedDate && !isTodayDate
                  ? 'bg-blue-500 text-white font-semibold' 
                  : ''
                }
                ${isHighlightedDate && !isSelectedDate && !isTodayDate
                  ? 'bg-green-100 text-green-700' 
                  : ''
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
              `}
              title={`${date.toLocaleDateString()} ${hasNote ? '(Has daily note)' : ''}`}
            >
              {date.getDate()}
              
              {/* Daily Note Indicator */}
              {hasNote && (
                <div className="absolute bottom-0 right-0 transform translate-x-1 translate-y-1">
                  <div className="h-2 w-2 bg-green-500 rounded-full border border-white"></div>
                </div>
              )}
              
              {/* Today Indicator */}
              {isTodayDate && !hasNote && (
                <div className="absolute bottom-0 right-0 transform translate-x-1 translate-y-1">
                  <div className="h-2 w-2 bg-blue-500 rounded-full border border-white"></div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">Today</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">Has Daily Note</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
