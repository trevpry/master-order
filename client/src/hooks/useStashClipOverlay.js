/**
 * Custom hook for handling Stash clip overlay notifications via WebSocket
 * Listens for stashClipRequested events from Android API
 */

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import config from '../config';

export function useStashClipOverlay() {
  const [clipData, setClipData] = useState(null);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server
    const socket = io(config.apiBaseUrl);

    socket.on('connect', () => {
      console.log('🔌 Connected to WebSocket server for Stash clip notifications');
    });

    socket.on('stashClipRequested', (data) => {
      console.log('📱 Received Stash clip request from Android app:', data);
      
      // Set clip data and show overlay
      setClipData(data);
      setIsOverlayVisible(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from WebSocket server');
    });

    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    // Cleanup on unmount
    return () => {
      console.log('🔌 Cleaning up WebSocket connection');
      socket.disconnect();
    };
  }, []);

  const closeOverlay = () => {
    setIsOverlayVisible(false);
    // Clear clip data after animation completes
    setTimeout(() => setClipData(null), 300);
  };

  return {
    clipData,
    isOverlayVisible,
    closeOverlay
  };
}
