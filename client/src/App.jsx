import { useState } from 'react'
import './App.css'
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Shared Components
import Layout from './shared/components/Layout';
import Dashboard from './Dashboard';

// Media Module Components
import Settings from './modules/media/pages/settings/index';
import MediaHome from './modules/media/pages/index';
import CustomOrders from './modules/media/pages/custom-orders/index';
import WatchStats from './modules/media/pages/watch-stats/index';
import Stash from './modules/media/pages/Stash';
import Music from './modules/media/pages/music/index';

// Eddie Module Components (placeholders for now)
import TasksHome from './modules/tasks/pages/TasksHome';
import Notes from './pages/Notes';
import EddieSettings from './modules/eddie/pages/EddieSettings';
import Dating from './pages/Dating';

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
          <Route path="/media/music" element={<Music />} />
          <Route path="/media/books" element={<div><h1>Books</h1><p>Coming Soon</p></div>} />
          <Route path="/media/comics" element={<div><h1>Comics</h1><p>Coming Soon</p></div>} />
          <Route path="/media/settings" element={<Settings />} />
          
          {/* Legacy Media Routes (for backwards compatibility) */}
          <Route path="/custom-orders" element={<CustomOrders />} />
          <Route path="/custom-orders/:orderId" element={<CustomOrders />} />
          <Route path="/watch-stats" element={<WatchStats />} />
          <Route path="/stash" element={<Stash />} />
          <Route path="/music" element={<Music />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Eddie Life Management Module Routes */}
          <Route path="/tasks" element={<TasksHome />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/dating" element={<Dating />} />
          <Route path="/eddie-settings" element={<EddieSettings />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
