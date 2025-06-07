import { useState } from 'react'
import Button from './components/Button'
import './App.css'
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Settings from './pages/settings/index';
import Home from './pages/index';
import CustomOrders from './pages/custom-orders/index';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/custom-orders" element={<CustomOrders />} />
          <Route path="/custom-orders/:orderId" element={<CustomOrders />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
