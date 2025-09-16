import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon,
  Cloud,
  BarChart3,
  StickyNote,
  Loader2
} from 'lucide-react';
import DailyNoteEditor from '../../../components/notes/DailyNoteEditor';
import DailyWeatherWidget from './DailyWeatherWidget';
import DailyWatchStats from './DailyWatchStats';
import { getTimezone, formatDateWithTimezone } from '../../../utils/timezoneUtils';

const DailyView = ({ date, onDateChange }) => {
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('notes'); // 'notes', 'weather', 'stats'

  useEffect(() => {
    const initializeTimezone = async () => {
      const tz = await getTimezone();
      setTimezone(tz);
      setLoading(false);
    };
    initializeTimezone();
  }, []);

  const formatDateHeader = (dateStr) => {
    if (!dateStr || !timezone) return '';
    
    // Parse YYYY-MM-DD string correctly
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    
    return date.toLocaleDateString('en-US', { 
      timeZone: timezone,
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'notes', label: 'Daily Notes', icon: StickyNote },
    { id: 'weather', label: 'Weather', icon: Cloud },
    { id: 'stats', label: 'Watch Stats', icon: BarChart3 }
  ];

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Date Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center space-x-3">
          <CalendarIcon className="h-6 w-6" />
          <div>
            <h2 className="text-2xl font-bold">
              {formatDateHeader(date)}
            </h2>
            <p className="text-blue-100">
              Daily overview for {date}
            </p>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`
                  flex items-center space-x-2 px-6 py-4 text-sm font-medium transition-colors
                  ${activeSection === section.id
                    ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Section Content */}
      <div className="p-6">
        {activeSection === 'notes' && (
          <DailyNoteEditor
            date={date}
            onDateChange={onDateChange}
            className="border-0 shadow-none p-0"
          />
        )}

        {activeSection === 'weather' && (
          <DailyWeatherWidget 
            date={date}
            timezone={timezone}
          />
        )}

        {activeSection === 'stats' && (
          <DailyWatchStats 
            date={date}
            timezone={timezone}
          />
        )}
      </div>
    </div>
  );
};

export default DailyView;