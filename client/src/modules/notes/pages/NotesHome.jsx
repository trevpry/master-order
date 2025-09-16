import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon,
  BookOpen,
  FileText,
  Zap,
  Star,
  Folder,
  Tag,
  Search,
  Plus,
  Edit3,
  Settings,
  TrendingUp
} from 'lucide-react';
import Button from '../../../shared/components/Button';
import Calendar from '../../../components/notes/Calendar';
import DailyNoteEditor from '../../../components/notes/DailyNoteEditor';
import QuickCapture from '../../../components/notes/QuickCapture';
import NoteTemplateManager from '../../../components/notes/NoteTemplateManager';
import NotesList from '../../../components/notes/NotesList';
import NoteFolders from '../../../components/notes/NoteFolders';

function NotesHome() {
  const [activeView, setActiveView] = useState('overview'); // overview, daily, notes, templates
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState(null);
  const [recentNotes, setRecentNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadRecentNotes(),
        loadFolders(),
        loadTags()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/notes/stats');
      if (response.ok) {
        const result = await response.json();
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentNotes = async () => {
    try {
      const response = await fetch('/api/notes?limit=5');
      if (response.ok) {
        const result = await response.json();
        setRecentNotes(result.data || []);
      }
    } catch (error) {
      console.error('Error loading recent notes:', error);
    }
  };

  const loadNotes = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append('search', searchQuery);
      
      const response = await fetch(`/api/notes?${queryParams}`);
      if (response.ok) {
        const result = await response.json();
        setNotes(result.data || []);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const loadFolders = async () => {
    try {
      const response = await fetch('/api/notes/folders');
      if (response.ok) {
        const result = await response.json();
        setFolders(result.data || []);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const loadTags = async () => {
    try {
      const response = await fetch('/api/notes/tags');
      if (response.ok) {
        const result = await response.json();
        setTags(result.data || []);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setActiveView('daily');
  };

  const handleNoteCreated = () => {
    loadStats();
    loadRecentNotes();
    if (activeView === 'notes') {
      loadNotes();
    }
  };

  const handleNoteSelect = (note) => {
    setSelectedNote(note);
  };

  const handleViewChange = (view) => {
    setActiveView(view);
    if (view === 'notes') {
      loadNotes();
    }
  };

  const handleNoteDeleted = (noteId) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    setStats(prev => ({ ...prev, totalNotes: prev.totalNotes - 1 }));
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
    }
  };

  const handleNoteEdit = (note) => {
    // For now, just select the note. You can expand this to open an edit modal/form
    setSelectedNote(note);
    console.log('Edit note:', note);
  };

  const handleNoteFavorite = async (noteId) => {
    try {
      const response = await fetch(`/api/notes/${noteId}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        loadNotes(); // Refresh notes
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setActiveView('daily');
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button
          variant="primary"
          className="h-24 flex flex-col items-center justify-center space-y-2"
          onClick={goToToday}
        >
          <CalendarIcon className="h-8 w-8" />
          <span className="font-medium">Today's Note</span>
        </Button>
        
        <Button
          variant="secondary"
          className="h-24 flex flex-col items-center justify-center space-y-2"
          onClick={() => setActiveView('notes')}
        >
          <FileText className="h-8 w-8" />
          <span className="font-medium">All Notes</span>
        </Button>
        
        <Button
          variant="secondary"
          className="h-24 flex flex-col items-center justify-center space-y-2"
          onClick={() => setActiveView('templates')}
        >
          <Edit3 className="h-8 w-8" />
          <span className="font-medium">Templates</span>
        </Button>
        
        <Button
          variant="secondary"
          className="h-24 flex flex-col items-center justify-center space-y-2"
          onClick={() => setActiveView('daily')}
        >
          <Search className="h-8 w-8" />
          <span className="font-medium">Browse Calendar</span>
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Total Notes</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalNotes}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Daily Notes</p>
                <p className="text-2xl font-bold text-green-900">{stats.dailyNotesCount || 0}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-800">Folders</p>
                <p className="text-2xl font-bold text-purple-900">{stats.totalFolders}</p>
              </div>
              <Folder className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-800">Tags</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.totalTags}</p>
              </div>
              <Tag className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>
      )}

      {/* Quick Capture */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="h-5 w-5 mr-2 text-yellow-500" />
          Quick Capture
        </h3>
        <QuickCapture onNoteCreated={handleNoteCreated} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-blue-600" />
            Calendar
          </h3>
          <Calendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            showToday={true}
          />
        </div>

        {/* Recent Notes and Popular Tags */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Notes */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <BookOpen className="h-5 w-5 mr-2 text-green-600" />
                Recent Notes
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveView('notes')}
              >
                View All
              </Button>
            </div>
            
            {recentNotes.length > 0 ? (
              <div className="space-y-3">
                {recentNotes.slice(0, 5).map(note => (
                  <div
                    key={note.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedNote(note);
                      setActiveView('notes');
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 truncate">
                        {note.title}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {note.content && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {note.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                      </p>
                    )}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {note.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No notes created yet</p>
              </div>
            )}
          </div>

          {/* Popular Tags */}
          {tags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Tag className="h-5 w-5 mr-2 text-purple-600" />
                Popular Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 10).map(tag => (
                  <button
                    key={tag.id}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                    onClick={() => {
                      setSearchQuery(`tag:${tag.name}`);
                      setActiveView('notes');
                    }}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag.name} ({tag.count})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDailyView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Calendar Sidebar */}
      <div className="lg:col-span-1">
        <Calendar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          showToday={true}
        />
      </div>
      
      {/* Daily Note Editor */}
      <div className="lg:col-span-3">
        <DailyNoteEditor
          date={selectedDate}
          onDateChange={setSelectedDate}
          onSave={handleNoteCreated}
        />
      </div>
    </div>
  );

  const renderNotesView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Quick Capture */}
        <QuickCapture 
          onNoteCreated={handleNoteCreated}
          compact={true}
        />

        {/* Folders */}
        <NoteFolders 
          folders={folders}
          onFolderSelect={(folder) => {
            // Handle folder selection
            console.log('Folder selected:', folder);
          }}
        />
      </div>

      {/* Notes List */}
      <div className="lg:col-span-3">
        <NotesList
          notes={notes}
          selectedNote={selectedNote}
          onNoteSelect={handleNoteSelect}
          onNoteEdit={handleNoteEdit}
          onNoteDelete={handleNoteDeleted}
          onNoteFavorite={handleNoteFavorite}
          searchQuery={searchQuery}
          activeView={activeView}
        />
      </div>
    </div>
  );

  const renderTemplatesView = () => (
    <div className="max-w-4xl mx-auto">
      <NoteTemplateManager
        onTemplateSelect={(template) => {
          // Handle template selection - maybe create a new note with template
          console.log('Template selected:', template);
        }}
        showCreateButton={true}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-6 w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notes & Knowledge</h1>
            <p className="text-gray-600 mt-1">
              Capture thoughts, organize ideas, and build your knowledge base
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <QuickCapture 
              onNoteCreated={handleNoteCreated}
              compact={true}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'daily', label: 'Daily Notes', icon: CalendarIcon },
            { id: 'notes', label: 'All Notes', icon: FileText },
            { id: 'templates', label: 'Templates', icon: Edit3 }
          ].map(view => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                onClick={() => handleViewChange(view.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  activeView === view.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{view.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div>
          {activeView === 'overview' && renderOverview()}
          {activeView === 'daily' && renderDailyView()}
          {activeView === 'notes' && renderNotesView()}
          {activeView === 'templates' && renderTemplatesView()}
        </div>
      </div>
    </div>
  );
}

export default NotesHome;
