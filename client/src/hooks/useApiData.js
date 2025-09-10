/**
 * Custom Hook for API Data Fetching with Caching
 * Provides consistent API state management across components
 */

import { useState, useEffect, useRef } from 'react';

const useApiData = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  
  const cache = useRef(new Map());
  const abortController = useRef(null);

  const {
    enabled = true,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus = false,
    retry = 3,
    retryDelay = 1000
  } = options;

  const fetchData = async (retryCount = 0) => {
    if (!enabled || !url) return;

    // Check cache first
    const cached = cache.current.get(url);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      setData(cached.data);
      setLastFetch(cached.timestamp);
      return;
    }

    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    abortController.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        signal: abortController.current.signal,
        ...options.fetchOptions
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Handle different response formats
      const extractedData = result.success !== undefined 
        ? (result.data || result.backgrounds || result.galleries || result)
        : result;

      // Cache the result
      cache.current.set(url, {
        data: extractedData,
        timestamp: Date.now()
      });

      setData(extractedData);
      setLastFetch(Date.now());
    } catch (err) {
      if (err.name === 'AbortError') return;

      console.error('API fetch error:', err);
      
      // Retry logic
      if (retryCount < retry) {
        setTimeout(() => {
          fetchData(retryCount + 1);
        }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
        return;
      }

      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount and dependency changes
  useEffect(() => {
    fetchData();
    
    // Cleanup on unmount
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [url, enabled]);

  // Refetch on window focus (optional)
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      if (Date.now() - lastFetch > cacheTime) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, lastFetch, cacheTime]);

  const refetch = () => fetchData();
  const invalidate = () => cache.current.delete(url);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate,
    lastFetch: new Date(lastFetch)
  };
};

export default useApiData;
