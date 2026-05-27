import { useState } from 'react'
import './App.css'
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Shared Components
import Layout from './shared/components/Layout';
import Dashboard from './Dashboard';
import GlobalMusicPlayer from './components/GlobalMusicPlayer';
import StashClipOverlay from './components/overlays/StashClipOverlay';

// Custom Hooks
import { useStashClipOverlay } from './hooks/useStashClipOverlay';

// Media Module Components
import Settings from './modules/media/pages/settings/index';
import MediaHome from './modules/media/pages/index';
import CustomOrders from './modules/media/pages/custom-orders/index';
import WatchStats from './modules/media/pages/watch-stats/index';
import Stash from './modules/media/pages/Stash';
import PerformerDetail from './modules/media/pages/stash/PerformerDetail';
import TagsPage from './modules/media/pages/stash/TagsPage';
import TagDetail from './modules/media/pages/stash/TagDetail';
import ClipTaggingFlowPage from './modules/media/pages/stash/ClipTaggingFlowPage';
import ScenesPage from './modules/media/pages/stash/ScenesPage';
import SceneDetail from './modules/media/pages/stash/SceneDetail';
import GroupsPage from './modules/media/pages/stash/GroupsPage';
import GroupDetail from './modules/media/pages/stash/GroupDetail';
import StudiosPage from './modules/media/pages/stash/StudiosPage';
import StudioDetail from './modules/media/pages/stash/StudioDetail';
import ClipsPage from './modules/media/pages/stash/ClipsPage';
import ClipDetail from './modules/media/pages/stash/ClipDetail';
import DuplicateScenesPage from './modules/media/pages/stash/DuplicateScenesPage';
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
import ChatHome from './modules/chat/pages/ChatHome';
import WikiHome from './modules/wiki/pages/WikiHome';
import Dating from './pages/Dating';
import ConnectionDetail from './pages/ConnectionDetail';
import DateDetail from './pages/DateDetail';
import EncounterDetail from './pages/EncounterDetail';
import HistoryPlusHome from './modules/history-plus/pages/HistoryPlusHome';
import Timeline from './modules/history-plus/pages/Timeline';
import Videos from './modules/history-plus/pages/Videos';
import Channels from './modules/history-plus/pages/Channels';
import Categories from './modules/history-plus/pages/Categories';
import Courses from './modules/history-plus/pages/Courses';
import CourseDetails from './modules/history-plus/pages/CourseDetails';

function App() {
  // WebSocket hook for Stash clip overlay notifications
  const { clipData, isOverlayVisible, closeOverlay } = useStashClipOverlay();
  
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
          <Route path="/media/stash/tags" element={<TagsPage />} />
          <Route path="/media/stash/tags/:id" element={<TagDetail />} />
          <Route path="/media/stash/clip-tagging-flow" element={<ClipTaggingFlowPage />} />
          <Route path="/media/stash/scenes" element={<ScenesPage />} />
          <Route path="/media/stash/scenes/:id" element={<SceneDetail />} />
          <Route path="/media/stash/groups" element={<GroupsPage />} />
          <Route path="/media/stash/groups/:id" element={<GroupDetail />} />
          <Route path="/media/stash/studios" element={<StudiosPage />} />
          <Route path="/media/stash/studios/:id" element={<StudioDetail />} />
          <Route path="/media/stash/clips" element={<ClipsPage />} />
          <Route path="/media/stash/clips/:id" element={<ClipDetail />} />
          <Route path="/media/stash/duplicates" element={<DuplicateScenesPage />} />
          <Route path="/media/stash/performer/:id" element={<PerformerDetail />} />
          <Route path="/media/stash/performers/:id" element={<PerformerDetail />} />
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
          <Route path="/stash/tags" element={<TagsPage />} />
          <Route path="/stash/tags/:id" element={<TagDetail />} />
          <Route path="/stash/scenes" element={<ScenesPage />} />
          <Route path="/stash/scenes/:id" element={<SceneDetail />} />
          <Route path="/stash/groups" element={<GroupsPage />} />
          <Route path="/stash/groups/:id" element={<GroupDetail />} />
          <Route path="/stash/studios" element={<StudiosPage />} />
          <Route path="/stash/studios/:id" element={<StudioDetail />} />
          <Route path="/stash/clips" element={<ClipsPage />} />
          <Route path="/stash/clips/:id" element={<ClipDetail />} />
          <Route path="/stash/duplicates" element={<DuplicateScenesPage />} />
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
          <Route path="/dating/connections/:id" element={<ConnectionDetail />} />
          <Route path="/dating/dates/:id" element={<DateDetail />} />
          <Route path="/dating/encounters/:id" element={<EncounterDetail />} />
          <Route path="/history-plus" element={<HistoryPlusHome />} />
          <Route path="/history-plus/timeline" element={<Timeline />} />
          <Route path="/history-plus/videos" element={<Videos />} />
          <Route path="/history-plus/channels" element={<Channels />} />
          <Route path="/history-plus/categories" element={<Categories />} />
          <Route path="/history-plus/courses" element={<Courses />} />
          <Route path="/history-plus/courses/:id" element={<CourseDetails />} />
          <Route path="/chat" element={<ChatHome />} />
          <Route path="/wiki" element={<WikiHome />} />
          <Route path="/eddie-settings" element={<EddieSettings />} />
        </Routes>
      </Layout>
      
      {/* Global Music Player - always available */}
      <GlobalMusicPlayer />
      
      {/* Stash Clip Overlay - shows when Android app requests a clip */}
      {isOverlayVisible && clipData && (
        <StashClipOverlay
          clipData={clipData}
          onClose={closeOverlay}
        />
      )}
    </Router>
  )
}

export default App
