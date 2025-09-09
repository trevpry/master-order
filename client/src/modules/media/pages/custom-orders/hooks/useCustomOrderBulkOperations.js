import { useState } from 'react';

export const useCustomOrderBulkOperations = () => {
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkImportProgress, setBulkImportProgress] = useState(null);

  // Bulk Import Handlers
  const handleBulkImportMovies = async (setMessage) => {
    if (!confirm('This will add a large number of movies to the current order. Continue?')) {
      return;
    }

    setIsBulkImporting(true);
    setBulkImportProgress({ current: 0, total: 0, status: 'Starting bulk import...' });

    try {
      const response = await fetch('/api/custom-orders/bulk-import/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: null // Will be handled by backend
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start bulk import');
      }

      const result = await response.json();
      setMessage(`Bulk import started: ${result.message}`);
      
      // Poll for progress
      pollBulkImportProgress(result.jobId, setMessage);
    } catch (error) {
      console.error('Error starting bulk import:', error);
      setMessage('Error starting bulk import');
      setIsBulkImporting(false);
      setBulkImportProgress(null);
    }
  };

  const handleBulkImportEpisodes = async (setMessage) => {
    if (!confirm('This will add a large number of episodes to the current order. Continue?')) {
      return;
    }

    setIsBulkImporting(true);
    setBulkImportProgress({ current: 0, total: 0, status: 'Starting bulk import...' });

    try {
      const response = await fetch('/api/custom-orders/bulk-import/episodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: null // Will be handled by backend
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start bulk import');
      }

      const result = await response.json();
      setMessage(`Bulk import started: ${result.message}`);
      
      // Poll for progress
      pollBulkImportProgress(result.jobId, setMessage);
    } catch (error) {
      console.error('Error starting bulk import:', error);
      setMessage('Error starting bulk import');
      setIsBulkImporting(false);
      setBulkImportProgress(null);
    }
  };

  const handleBulkImportBooks = async (setMessage) => {
    if (!confirm('This will add books from your library to the current order. Continue?')) {
      return;
    }

    setIsBulkImporting(true);
    setBulkImportProgress({ current: 0, total: 0, status: 'Starting book import...' });

    try {
      const response = await fetch('/api/custom-orders/bulk-import/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: null // Will be handled by backend
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start bulk import');
      }

      const result = await response.json();
      setMessage(`Book import started: ${result.message}`);
      
      // Poll for progress
      pollBulkImportProgress(result.jobId, setMessage);
    } catch (error) {
      console.error('Error starting book import:', error);
      setMessage('Error starting book import');
      setIsBulkImporting(false);
      setBulkImportProgress(null);
    }
  };

  const handleBulkImportComics = async (setMessage) => {
    if (!confirm('This will add comics from your library to the current order. Continue?')) {
      return;
    }

    setIsBulkImporting(true);
    setBulkImportProgress({ current: 0, total: 0, status: 'Starting comic import...' });

    try {
      const response = await fetch('/api/custom-orders/bulk-import/comics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: null // Will be handled by backend
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start bulk import');
      }

      const result = await response.json();
      setMessage(`Comic import started: ${result.message}`);
      
      // Poll for progress
      pollBulkImportProgress(result.jobId, setMessage);
    } catch (error) {
      console.error('Error starting comic import:', error);
      setMessage('Error starting comic import');
      setIsBulkImporting(false);
      setBulkImportProgress(null);
    }
  };

  const pollBulkImportProgress = async (jobId, setMessage) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/custom-orders/bulk-import/status/${jobId}`);
        if (!response.ok) {
          throw new Error('Failed to get import status');
        }

        const status = await response.json();
        setBulkImportProgress(status);

        if (status.completed) {
          clearInterval(pollInterval);
          setIsBulkImporting(false);
          setBulkImportProgress(null);
          setMessage(`Bulk import completed: ${status.message}`);
        } else if (status.error) {
          clearInterval(pollInterval);
          setIsBulkImporting(false);
          setBulkImportProgress(null);
          setMessage(`Bulk import failed: ${status.error}`);
        }
      } catch (error) {
        console.error('Error polling import status:', error);
        clearInterval(pollInterval);
        setIsBulkImporting(false);
        setBulkImportProgress(null);
        setMessage('Error checking import status');
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleDeleteAllItems = async (orderId, setMessage, refreshOrderItems) => {
    if (!confirm('Are you sure you want to delete ALL items from this order? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/custom-orders/${orderId}/items`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete all items');
      }

      setMessage('All items deleted successfully!');
      await refreshOrderItems();
    } catch (error) {
      console.error('Error deleting all items:', error);
      setMessage('Error deleting all items');
    }
  };

  const handleRemoveWatched = async (orderId, setMessage, refreshOrderItems) => {
    if (!confirm('Are you sure you want to remove all watched items from this order?')) {
      return;
    }

    try {
      const response = await fetch(`/api/custom-orders/${orderId}/remove-watched`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove watched items');
      }

      const result = await response.json();
      setMessage(`Removed ${result.removedCount} watched items successfully!`);
      await refreshOrderItems();
    } catch (error) {
      console.error('Error removing watched items:', error);
      setMessage('Error removing watched items');
    }
  };

  const handleRemoveRead = async (orderId, setMessage, refreshOrderItems) => {
    if (!confirm('Are you sure you want to remove all read items from this order?')) {
      return;
    }

    try {
      const response = await fetch(`/api/custom-orders/${orderId}/remove-read`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove read items');
      }

      const result = await response.json();
      setMessage(`Removed ${result.removedCount} read items successfully!`);
      await refreshOrderItems();
    } catch (error) {
      console.error('Error removing read items:', error);
      setMessage('Error removing read items');
    }
  };

  return {
    // State
    isBulkImporting,
    bulkImportProgress,

    // Bulk import handlers
    handleBulkImportMovies,
    handleBulkImportEpisodes,
    handleBulkImportBooks,
    handleBulkImportComics,

    // Bulk operation handlers
    handleDeleteAllItems,
    handleRemoveWatched,
    handleRemoveRead
  };
};

export default useCustomOrderBulkOperations;
