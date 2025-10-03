import { useState } from 'react'
import './App.css'
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Shared Components
import Layout from './shared/components/Layout';
import Dashboard from './Dashboard';
import GlobalMusicPlayer from './components/GlobalMusicPlayer';

// Media Module Components
import Settings from './modules/media/pages/settings/index';
import MediaHome from './modules/media/pages/index';
import CustomOrders from './modules/media/pages/custom-orders/index';
import WatchStats from './modules/media/pages/watch-stats/index';
import Stash from './modules/media/pages/Stash';
import PerformerDetail from './modules/media/pages/stash/PerformerDetail';
import Music from './modules/media/pages/music/index';
import Backgrounds from './modules/media/pages/backgrounds/index';
import Books from './pages/Books'; // Unified Books component
import VideoGames from './pages/VideoGames'; // Video Games component

// Eddie Module Components (placeholders for now)
import TasksHome from './modules/tasks/pages/TasksHome';
import Notes from './modules/notes/pages/NotesHome';
import CalendarHome from './modules/calendar/pages/CalendarHome';
import Locations from './modules/locations/pages/Locations';
import EddieSettings from './modules/eddie/pages/EddieSettings';
import Dating from './pages/Dating';
import HistoryPlusHome from './modules/history-plus/pages/HistoryPlusHome';
import Timeline from './modules/history-plus/pages/Timeline';
import Videos from './modules/history-plus/pages/Videos';
import Channels from './modules/history-plus/pages/Channels';
import Categories from './modules/history-plus/pages/Categories';
import Courses from './modules/history-plus/pages/Courses';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Main Dashboard */}
          <Route path="/" element={<Dashboard />} />
          
          {/* Media Module Routes */}
          <Route path="/media" element={<MediaHome />} />
          <Route path="/media/up-next" element={<MediaHome />} />
          <Route path="/media/custom-orders" element={<CustomOrders />} />
          <Route path="/media/custom-orders/:orderId" element={<CustomOrders />} />
          <Route path="/media/watch-stats" element={<WatchStats />} />
          <Route path="/media/stash" element={<Stash />} />
          <Route path="/media/stash/performer/:id" element={<PerformerDetail />} />
          <Route path="/media/music" element={<Music />} />
          <Route path="/media/backgrounds" element={<Backgrounds />} />
          <Route path="/media/books" element={<Books />} />
          <Route path="/media/games" element={<VideoGames />} />
          <Route path="/media/comics" element={<div><h1>Comics</h1><p>Coming Soon</p></div>} />
          <Route path="/media/settings" element={<Settings />} />
          
          {/* Legacy Media Routes (for backwards compatibility) */}
          <Route path="/custom-orders" element={<CustomOrders />} />
          <Route path="/custom-orders/:orderId" element={<CustomOrders />} />
          <Route path="/watch-stats" element={<WatchStats />} />
          <Route path="/stash" element={<Stash />} />
          <Route path="/stash/performer/:id" element={<PerformerDetail />} />
          <Route path="/music" element={<Music />} />
          <Route path="/backgrounds" element={<Backgrounds />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Eddie Life Management Module Routes */}
          <Route path="/tasks" element={<TasksHome />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/calendar" element={<CalendarHome />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/dating" element={<Dating />} />
          <Route path="/history-plus" element={<HistoryPlusHome />} />
          <Route path="/history-plus/timeline" element={<Timeline />} />
          <Route path="/history-plus/videos" element={<Videos />} />
          <Route path="/history-plus/channels" element={<Channels />} />
          <Route path="/history-plus/categories" element={<Categories />} />
          <Route path="/history-plus/courses" element={<Courses />} />
          <Route path="/eddie-settings" element={<EddieSettings />} />
        </Routes>
      </Layout>
      
      {/* Global Music Player - always available */}
      <GlobalMusicPlayer />
    </Router>
  )
}

export default App
