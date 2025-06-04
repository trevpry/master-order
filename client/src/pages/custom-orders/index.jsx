import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import './CustomOrders.css';

function CustomOrders() {  
  const [customOrders, setCustomOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewingOrderItems, setViewingOrderItems] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [episodeFormData, setEpisodeFormData] = useState({
    series: '',
    season: '',
    episode: ''
  });  const [episodeSearchLoading, setEpisodeSearchLoading] = useState(false);  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportData, setBulkImportData] = useState('');
  const [bulkImportLoading, setBulkImportLoading] = useState(false);  const [reselectingItem, setReselectingItem] = useState(null); // For tracking which item is being re-selected
  const [showBookForm, setShowBookForm] = useState(false);
  const [bookFormData, setBookFormData] = useState({
    title: '',
    author: '',
    year: '',
    isbn: ''
  });  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);
  const [showComicForm, setShowComicForm] = useState(false);
  const [comicFormData, setComicFormData] = useState({
    series: '',
    year: '',
    issue: ''
  });  const [comicSearchResults, setComicSearchResults] = useState([]);
  const [comicSearchLoading, setComicSearchLoading] = useState(false);
  const [showShortStoryForm, setShowShortStoryForm] = useState(false);
  const [shortStoryFormData, setShortStoryFormData] = useState({
    title: '',
    author: '',
    year: '',
    url: '',
    containedInBookId: '',
    coverUrl: ''
  });
  const [shortStorySearchResults, setShortStorySearchResults] = useState([]);  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: ''
  });

  // Fetch custom orders when component mounts
  useEffect(() => {
    fetchCustomOrders();
  }, []);

  const fetchCustomOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://127.0.0.1:3001/api/custom-orders');
      const orders = await response.json();
      setCustomOrders(orders);
    } catch (error) {
      console.error('Error fetching custom orders:', error);
      setMessage('Failed to load custom orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage('Order name is required');
      return;
    }

    try {      const response = await fetch('http://127.0.0.1:3001/api/custom-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          icon: formData.icon.trim()
        }),
      });

      if (response.ok) {
        setMessage('Custom order created successfully');
        setFormData({ name: '', description: '', icon: '' });
        setShowCreateForm(false);
        fetchCustomOrders(); // Refresh the list
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error creating custom order:', error);
      setMessage('Error creating custom order');
    }
  };

  const handleToggleActive = async (orderId, currentStatus) => {
    try {
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !currentStatus
        }),
      });

      if (response.ok) {
        setMessage(`Custom order ${!currentStatus ? 'activated' : 'deactivated'}`);
        fetchCustomOrders(); // Refresh the list
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error updating custom order:', error);
      setMessage('Error updating custom order');
    }
  };

  const handleDeleteOrder = async (orderId, orderName) => {
    if (!confirm(`Are you sure you want to delete "${orderName}"? This will also delete all items in this custom order.`)) {
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage('Custom order deleted successfully');
        fetchCustomOrders(); // Refresh the list
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting custom order:', error);
      setMessage('Error deleting custom order');
    }
  };
  const resetWatchedStatus = async (orderId, orderName) => {
    if (!confirm(`Are you sure you want to mark all items in "${orderName}" as unwatched?`)) {
      return;
    }

    try {
      // Get the order details first
      const orderResponse = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
      const orderData = await orderResponse.json();

      // Update each item to be unwatched
      for (const item of orderData.items) {
        await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isWatched: false
          }),
        });
      }

      setMessage('All items marked as unwatched');
      fetchCustomOrders(); // Refresh the list
    } catch (error) {
      console.error('Error resetting watched status:', error);
      setMessage('Error resetting watched status');
    }
  };

  const handleViewItems = (order) => {
    setViewingOrderItems(order);
    setMessage('');
  };

  const handleRemoveItem = async (orderId, itemId, itemTitle) => {
    if (!confirm(`Are you sure you want to remove "${itemTitle}" from this custom order?`)) {
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage('Item removed successfully');
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === orderId) {
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error removing item:', error);
      setMessage('Error removing item');
    }
  };
  const handleMarkAsWatched = async (orderId, itemId, itemTitle) => {
    try {
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isWatched: true
        }),
      });

      if (response.ok) {
        setMessage(`"${itemTitle}" marked as watched`);
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === orderId) {
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error marking item as watched:', error);
      setMessage('Error marking item as watched');
    }
  };

  const handleMarkAsUnwatched = async (orderId, itemId, itemTitle) => {
    try {
      const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isWatched: false
        }),
      });

      if (response.ok) {
        setMessage(`"${itemTitle}" marked as unwatched`);
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === orderId) {
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error marking item as unwatched:', error);
      setMessage('Error marking item as unwatched');    }
  };

  const handleReselectBook = (item) => {
    // Store the item being re-selected
    setReselectingItem(item);
    
    // Pre-fill the book form with current item data
    setBookFormData({
      title: item.bookTitle || item.title || '',
      author: item.bookAuthor || '',
      year: item.bookYear ? item.bookYear.toString() : '',
      isbn: item.bookIsbn || ''
    });
    
    // Show the book form
    setShowBookForm(true);
  };

  const handleSearchMedia = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      // This is a placeholder for Plex media search functionality
      // In a real implementation, you would need to create an endpoint that searches Plex
      const response = await fetch(`http://127.0.0.1:3001/api/search?query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);      } else {
        setSearchResults([]);
        setMessage('Media search functionality coming soon');
      }
    } catch (error) {
      console.error('Error searching media:', error);
      setSearchResults([]);
      setMessage('Media search functionality coming soon');    } finally {
      setSearchLoading(false);
    }
  };
  const handleAddMediaToOrder = async (orderId, mediaItem) => {
    try {
      const requestBody = {
        mediaType: mediaItem.mediaType || mediaItem.type,
        title: mediaItem.title
      };      // Add fields based on media type
      const mediaType = mediaItem.mediaType || mediaItem.type;
      if (mediaType === 'comic') {
        requestBody.comicSeries = mediaItem.comicSeries;
        requestBody.comicYear = mediaItem.comicYear;
        requestBody.comicIssue = mediaItem.comicIssue;      } else if (mediaType === 'book') {
        requestBody.bookTitle = mediaItem.bookTitle;
        requestBody.bookAuthor = mediaItem.bookAuthor;
        requestBody.bookYear = mediaItem.bookYear;
        requestBody.bookIsbn = mediaItem.bookIsbn;
        requestBody.bookPublisher = mediaItem.bookPublisher;
        requestBody.bookOpenLibraryId = mediaItem.bookOpenLibraryId;
        requestBody.bookCoverUrl = mediaItem.bookCoverUrl;
      } else if (mediaType === 'shortstory') {
        requestBody.storyTitle = mediaItem.storyTitle;
        requestBody.storyAuthor = mediaItem.storyAuthor;
        requestBody.storyYear = mediaItem.storyYear;
        requestBody.storyUrl = mediaItem.storyUrl;
        requestBody.storyContainedInBookId = mediaItem.storyContainedInBookId;
        requestBody.storyCoverUrl = mediaItem.storyCoverUrl;
      } else {
        // For Plex media (movies and TV episodes)
        requestBody.plexKey = mediaItem.ratingKey;
        requestBody.seasonNumber = mediaItem.parentIndex;
        requestBody.episodeNumber = mediaItem.index;
        requestBody.seriesTitle = mediaItem.grandparentTitle;
      }const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setMessage('Media added to custom order successfully');
        setShowSearchModal(false);
        setSearchQuery('');
        setSearchResults([]);
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === orderId) {
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
        return true;
      } else {
        const errorData = await response.json();
        if (response.status === 409) {
          // Handle duplicate item error
          setMessage(`Duplicate item: "${errorData.existingItem.title}" is already in this custom order`);
        } else {
          setMessage(`Error: ${errorData.error}`);
        }
        return false;
      }
    } catch (error) {
      console.error('Error adding media to custom order:', error);
      setMessage('Error adding media to custom order');
      return false;
    }
  };
  const handleSearchTVEpisode = async (e) => {
    e.preventDefault();
    
    // Validate all required fields are filled
    if (!episodeFormData.series.trim() || !episodeFormData.season || !episodeFormData.episode) {
      setMessage('Please fill in all episode fields');
      return;
    }    setEpisodeSearchLoading(true);
    try {
      // Search Plex TV library for episodes matching the series name
      const searchQuery = `${episodeFormData.series.trim()}`;
      const response = await fetch(`http://127.0.0.1:3001/api/search?query=${encodeURIComponent(searchQuery)}&type=tv`);
      
      if (response.ok) {
        const results = await response.json();
          // Filter for the specific episode with improved matching
        const targetEpisode = results.find(item => {
          if (item.type !== 'episode') return false;
          if (item.parentIndex !== parseInt(episodeFormData.season)) return false;
          if (item.index !== parseInt(episodeFormData.episode)) return false;
          
          // Improved series name matching - check for exact match or close match
          const seriesInput = episodeFormData.series.toLowerCase().trim();
          const seriesTitle = item.grandparentTitle.toLowerCase();
          
          return seriesTitle.includes(seriesInput) || seriesInput.includes(seriesTitle);
        });        if (targetEpisode) {
          // Add the episode directly
          const success = await handleAddMediaToOrder(viewingOrderItems.id, targetEpisode);
          // Only close the form and show success message if the add was successful
          if (success !== false) {
            setShowEpisodeForm(false);
            setEpisodeFormData({ series: '', season: '', episode: '' });
            // Don't set success message here since handleAddMediaToOrder handles messages
          }
        } else {
          // Check if any episodes were found for this series
          const seriesEpisodes = results.filter(item => 
            item.type === 'episode' && 
            item.grandparentTitle.toLowerCase().includes(episodeFormData.series.toLowerCase())
          );
          
          if (seriesEpisodes.length > 0) {
            setMessage(`Episode not found: ${episodeFormData.series} S${episodeFormData.season}E${episodeFormData.episode}. Found ${seriesEpisodes.length} other episodes for this series.`);
          } else {
            setMessage(`Series not found: "${episodeFormData.series}". Please check the series name and try again.`);
          }
        }
      } else {
        setMessage('Error searching for episode');
      }
    } catch (error) {
      console.error('Error searching for TV episode:', error);
      setMessage('Error searching for TV episode');
    } finally {
      setEpisodeSearchLoading(false);
    }
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();
    
    if (!bulkImportData.trim()) {
      setMessage('Please enter tab-delimited data to import');
      return;
    }

    setBulkImportLoading(true);
    
    try {
      // Parse tab-delimited data
      const lines = bulkImportData.trim().split('\n');
      const items = [];
      const errors = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines
        
        const columns = line.split('\t');
        
        // Validate required columns
        if (columns.length < 4) {
          errors.push(`Line ${i + 1}: Not enough columns (need 4: Series/Movie, Season/Episode, Title, Type)`);
          continue;
        }
        
        const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns.map(col => col.trim());
        
        if (!seriesOrMovie || !title || !rawMediaType) {
          errors.push(`Line ${i + 1}: Missing required data (Series/Movie, Title, or Type)`);
          continue;
        }
          // Normalize media types
        const mediaType = rawMediaType.toLowerCase() === 'tv series' ? 'episode' : rawMediaType.toLowerCase();
        
        // Initialize comic-specific fields
        let comicSeries = null;
        let comicYear = null;
        let comicIssue = null;
        
        // Initialize book-specific fields
        let bookAuthor = null;
        let bookYear = null;
        
        // Parse season and episode for TV episodes, comic details for comics, or book details for books
        let seasonNumber = null;
        let episodeNumber = null;
        
        if (mediaType === 'episode' && seasonEpisode) {
          // Try to parse various formats: "S1E1", "S01E01", "1x1", "1,1", "1 1"
          const seasonEpMatch = seasonEpisode.match(/(?:S?(\d+)(?:[xXeE]|,|\s)+(\d+))|(?:(\d+)\s*[\-\/]\s*(\d+))/i);
          if (seasonEpMatch) {
            seasonNumber = parseInt(seasonEpMatch[1] || seasonEpMatch[3]);
            episodeNumber = parseInt(seasonEpMatch[2] || seasonEpMatch[4]);
          } else {
            errors.push(`Line ${i + 1}: Invalid season/episode format. Use S1E1, S01E01, 1x1, 1,1, or 1-1`);
            continue;
          }        } else if (mediaType === 'comic') {
          // Parse comic format: "Series Name (Year) #Issue" or "Series Name #Issue"
          let comicMatch = seriesOrMovie.match(/^(.+?)\s*\((\d{4})\)\s*#(\d+)$/);
          if (comicMatch) {
            // Format with year
            comicSeries = comicMatch[1].trim();
            comicYear = parseInt(comicMatch[2]);
            comicIssue = parseInt(comicMatch[3]);
          } else {
            // Try format without year: "Series Name #Issue"
            comicMatch = seriesOrMovie.match(/^(.+?)\s*#(\d+)$/);
            if (comicMatch) {
              comicSeries = comicMatch[1].trim();
              comicYear = null;
              comicIssue = parseInt(comicMatch[2]);
            } else {
              errors.push(`Line ${i + 1}: Invalid comic format. Use "Series Name (Year) #Issue" or "Series Name #Issue" format (e.g., "The Amazing Spider-Man (2018) #1" or "The Amazing Spider-Man #1")`);
              continue;
            }
          }
        } else if (mediaType === 'book') {
          // Parse book format: "Author Name (Year)" in the season/episode field, or just "Author Name"
          if (seasonEpisode) {
            const bookMatch = seasonEpisode.match(/^(.+?)\s*(?:\((\d{4})\))?$/);
            if (bookMatch) {
              bookAuthor = bookMatch[1].trim();
              if (bookMatch[2]) {
                bookYear = parseInt(bookMatch[2]);
              }
            } else {
              bookAuthor = seasonEpisode.trim();
            }
          }
          // If no season/episode field, we'll try to extract author from the title later
        }
          items.push({
          seriesOrMovie,
          seasonNumber,
          episodeNumber,
          comicSeries,
          comicYear,
          comicIssue,
          bookAuthor,
          bookYear,
          title,
          mediaType: mediaType,
          lineNumber: i + 1
        });
      }
      
      if (errors.length > 0) {
        setMessage(`Import errors:\n${errors.join('\n')}`);
        setBulkImportLoading(false);
        return;
      }
      
      if (items.length === 0) {
        setMessage('No valid items found to import');
        setBulkImportLoading(false);
        return;
      }
      
      // Process each item
      let successCount = 0;
      let failCount = 0;
      const failedItems = [];
        for (const item of items) {
        try {
          let targetMedia = null;
          
          if (item.mediaType === 'comic') {
            // For comics, create the media object directly since we have all the info
            targetMedia = {
              title: item.title,
              type: 'comic',
              comicSeries: item.comicSeries,
              comicYear: item.comicYear,
              comicIssue: item.comicIssue
            };
          } else if (item.mediaType === 'book') {
            // For books, search OpenLibrary and use the first result
            try {
              let searchQuery = item.title;
              if (item.bookAuthor) {
                searchQuery += ` author:"${item.bookAuthor}"`;
              }
              if (item.bookYear) {
                searchQuery += ` first_publish_year:${item.bookYear}`;
              }
              
              const response = await fetch(`http://127.0.0.1:3001/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}&limit=1`);
              
              if (response.ok) {
                const results = await response.json();
                
                if (results && results.length > 0) {
                  const book = results[0];
                  targetMedia = {
                    title: book.title,
                    type: 'book',
                    bookTitle: book.title,
                    bookAuthor: book.authors && book.authors[0] ? book.authors[0] : (item.bookAuthor || 'Unknown Author'),
                    bookYear: book.firstPublishYear || item.bookYear || null,
                    bookIsbn: book.isbn || null,
                    bookPublisher: book.publishers && book.publishers[0] ? book.publishers[0] : null,
                    bookOpenLibraryId: book.id || null,
                    bookCoverUrl: book.coverUrl || null
                  };
                } else {
                  // If no results from OpenLibrary, create a basic book entry
                  targetMedia = {
                    title: item.title,
                    type: 'book',
                    bookTitle: item.title,
                    bookAuthor: item.bookAuthor || 'Unknown Author',
                    bookYear: item.bookYear || null,
                    bookIsbn: null,
                    bookPublisher: null,
                    bookOpenLibraryId: null,
                    bookCoverUrl: null
                  };
                }
              } else {
                // If OpenLibrary search fails, create a basic book entry
                targetMedia = {
                  title: item.title,
                  type: 'book',
                  bookTitle: item.title,
                  bookAuthor: item.bookAuthor || 'Unknown Author',
                  bookYear: item.bookYear || null,
                  bookIsbn: null,
                  bookPublisher: null,
                  bookOpenLibraryId: null,
                  bookCoverUrl: null
                };
              }
            } catch (bookError) {
              console.error('Book search error:', bookError);
              // Create a basic book entry if search fails
              targetMedia = {
                title: item.title,
                type: 'book',
                bookTitle: item.title,
                bookAuthor: item.bookAuthor || 'Unknown Author',
                bookYear: item.bookYear || null,
                bookIsbn: null,
                bookPublisher: null,
                bookOpenLibraryId: null,
                bookCoverUrl: null
              };
            }
          } else {
            // For movies and TV episodes, search Plex
            let searchQuery = item.seriesOrMovie;
            let searchUrl = `http://127.0.0.1:3001/api/search?query=${encodeURIComponent(searchQuery)}`;
            
            // For TV episodes, use the TV-specific search to get all episodes
            if (item.mediaType === 'episode') {
              searchUrl += '&type=tv';
            }
            
            const response = await fetch(searchUrl);
            
            if (response.ok) {
              const results = await response.json();
              
              if (item.mediaType === 'episode') {
                // Find specific episode
                targetMedia = results.find(result => 
                  result.type === 'episode' &&
                  result.parentIndex === item.seasonNumber &&
                  result.index === item.episodeNumber &&
                  (result.grandparentTitle.toLowerCase().includes(item.seriesOrMovie.toLowerCase()) ||
                   item.seriesOrMovie.toLowerCase().includes(result.grandparentTitle.toLowerCase()))
                );
              } else if (item.mediaType === 'movie') {
                // Find movie by title
                targetMedia = results.find(result => 
                  result.type === 'movie' &&
                  (result.title.toLowerCase().includes(item.title.toLowerCase()) ||
                   item.title.toLowerCase().includes(result.title.toLowerCase()))
                );
              }
            }
          }          if (targetMedia) {
            // Add to custom order
            const success = await handleAddMediaToOrder(viewingOrderItems.id, targetMedia);
            if (success) {
              successCount++;
            } else {
              failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (duplicate or error)`);
              failCount++;
            }
          } else {
            const notFoundMessage = item.mediaType === 'book' 
              ? `Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (could not process book)`
              : `Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (not found in Plex)`;
            failedItems.push(notFoundMessage);
            failCount++;
          }
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error processing item on line ${item.lineNumber}:`, error);
          failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (processing error)`);
          failCount++;
        }
      }
      
      // Show results
      let resultMessage = `Bulk import completed: ${successCount} items added successfully`;
      if (failCount > 0) {
        resultMessage += `, ${failCount} items failed`;
        if (failedItems.length > 0) {
          resultMessage += `:\n${failedItems.join('\n')}`;
        }
      }
      
      setMessage(resultMessage);
      
      if (successCount > 0) {
        // Clear the form and close modal
        setBulkImportData('');
        setShowBulkImportModal(false);
        
        // Refresh the order items
        fetchCustomOrders();
        if (viewingOrderItems) {
          const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      }
      
    } catch (error) {
      console.error('Error during bulk import:', error);
      setMessage('Error during bulk import process');
    } finally {
      setBulkImportLoading(false);
    }
  };

  const handleSearchBooks = async (e) => {
    e.preventDefault();
    
    if (!bookFormData.title.trim()) {
      setMessage('Please enter a book title to search');
      return;
    }

    setBookSearchLoading(true);
    setBookSearchResults([]);
    
    try {
      // Build search query
      let searchQuery = bookFormData.title.trim();
      if (bookFormData.author.trim()) {
        searchQuery += ` author:"${bookFormData.author.trim()}"`;
      }
      if (bookFormData.year) {
        searchQuery += ` first_publish_year:${bookFormData.year}`;
      }

      const response = await fetch(`http://127.0.0.1:3001/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}&limit=10`);
      
      if (response.ok) {
        const results = await response.json();
        setBookSearchResults(results);
        
        if (results.length === 0) {
          setMessage('No books found with those search criteria. Try a different title or author.');
        }
      } else {
        setMessage('Error searching for books. Please try again.');
        setBookSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching books:', error);
      setMessage('Error searching for books. Please try again.');
      setBookSearchResults([]);
    } finally {
      setBookSearchLoading(false);
    }
  };

  const handleSelectBook = async (selectedBook) => {
    try {
      if (reselectingItem) {
        // Update existing item with new book selection
        const updateData = {
          title: selectedBook.title,
          bookTitle: selectedBook.title,
          bookAuthor: selectedBook.authors && selectedBook.authors[0] ? selectedBook.authors[0] : 'Unknown Author',
          bookYear: selectedBook.firstPublishYear || null,
          bookIsbn: selectedBook.isbn || null,
          bookPublisher: selectedBook.publishers && selectedBook.publishers[0] ? selectedBook.publishers[0] : null,
          bookOpenLibraryId: selectedBook.id || null,
          bookCoverUrl: selectedBook.coverUrl || null
        };

        const response = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}/items/${reselectingItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (response.ok) {
          setMessage(`Book updated successfully: "${selectedBook.title}"`);
          setShowBookForm(false);
          setReselectingItem(null);
          setBookFormData({ title: '', author: '', year: '', isbn: '' });
          setBookSearchResults([]);
          
          // Refresh the order items
          fetchCustomOrders();
          if (viewingOrderItems) {
            const updatedOrder = await fetch(`http://127.0.0.1:3001/api/custom-orders/${viewingOrderItems.id}`);
            const updatedOrderData = await updatedOrder.json();
            setViewingOrderItems(updatedOrderData);
          }
        } else {
          const errorData = await response.json();
          setMessage(`Error updating book: ${errorData.error}`);
        }      } else {
        // Add new book to order (existing functionality)
        const bookMedia = {
          type: 'book',
          title: selectedBook.title,
          bookTitle: selectedBook.title,
          bookAuthor: selectedBook.authors && selectedBook.authors[0] ? selectedBook.authors[0] : 'Unknown Author',
          bookYear: selectedBook.firstPublishYear || null,
          bookIsbn: selectedBook.isbn || null,
          bookPublisher: selectedBook.publishers && selectedBook.publishers[0] ? selectedBook.publishers[0] : null,
          bookOpenLibraryId: selectedBook.id || null,
          bookCoverUrl: selectedBook.coverUrl || null
        };

        const success = await handleAddMediaToOrder(viewingOrderItems.id, bookMedia);
        if (success !== false) {
          setShowBookForm(false);
          setBookFormData({ title: '', author: '', year: '', isbn: '' });
          setBookSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Error selecting book:', error);
      setMessage('Error selecting book. Please try again.');
    }
  };

  const handleSearchComics = async (e) => {
    e.preventDefault();
    
    if (!comicFormData.series.trim()) {
      setMessage('Please enter a comic series name to search');
      return;
    }

    setComicSearchLoading(true);
    setComicSearchResults([]);
    
    try {
      // Build search query for ComicVine
      const searchQuery = comicFormData.series.trim();

      const response = await fetch(`http://127.0.0.1:3001/api/comicvine/search?query=${encodeURIComponent(searchQuery)}&limit=10`);
      
      if (response.ok) {
        const results = await response.json();
        setComicSearchResults(results);
        
        if (results.length === 0) {
          setMessage('No comic series found with that name. Try a different search term.');
        }
      } else {
        setMessage('Error searching for comics. Please try again.');
        setComicSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching comics:', error);
      setMessage('Error searching for comics. Please try again.');
      setComicSearchResults([]);
    } finally {
      setComicSearchLoading(false);
    }
  };
  const handleSelectComic = async (selectedSeries) => {
    try {
      // Validate required fields
      if (!comicFormData.issue) {
        setMessage('Please enter an issue number before adding the comic.');
        return;
      }

      // Create the comic string in the expected format
      // If year is provided: "Series Name (Year) #Issue"
      // If year is not provided: "Series Name #Issue"
      const comicString = comicFormData.year 
        ? `${selectedSeries.name} (${comicFormData.year}) #${comicFormData.issue}`
        : `${selectedSeries.name} #${comicFormData.issue}`;
      
      const comicMedia = {
        mediaType: 'comic',
        title: comicString,
        comicSeries: selectedSeries.name,
        comicYear: comicFormData.year ? parseInt(comicFormData.year) : null,
        comicIssue: comicFormData.issue
      };

      const success = await handleAddMediaToOrder(viewingOrderItems.id, comicMedia);
      if (success !== false) {
        setShowComicForm(false);
        setComicFormData({ series: '', year: '', issue: '' });
        setComicSearchResults([]);
      }    } catch (error) {
      console.error('Error selecting comic:', error);
      setMessage('Error selecting comic. Please try again.');
    }  };
  const handleSearchShortStoryBooks = async (e) => {
    e.preventDefault();
    
    if (!shortStoryFormData.title.trim()) {
      setMessage('Please enter a short story title');
      return;
    }

    setShortStorySearchResults([]);
    
    try {
      // For short stories, we search for books that could contain this story
      // If author is provided, use it in the search, otherwise just search by title
      let searchQuery = shortStoryFormData.author.trim() || shortStoryFormData.title.trim();
      if (shortStoryFormData.year) {
        searchQuery += ` first_publish_year:${shortStoryFormData.year}`;
      }

      const response = await fetch(`http://127.0.0.1:3001/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}&limit=20`);
      
      if (response.ok) {
        const results = await response.json();
        setShortStorySearchResults(results);
        
        if (results.length === 0) {
          setMessage('No books found. You can still add the short story without selecting a containing book.');
        }
      } else {
        setMessage('Error searching for books. You can still add the short story without selecting a containing book.');
        setShortStorySearchResults([]);
      }
    } catch (error) {
      console.error('Error searching books for short story:', error);
      setMessage('Error searching for books. You can still add the short story without selecting a containing book.');
      setShortStorySearchResults([]);
    }
  };
  const handleAddShortStory = async (containedInBook = null) => {
    try {
      // Validate required fields
      if (!shortStoryFormData.title.trim()) {
        setMessage('Please enter a short story title');
        return;
      }

      const shortStoryMedia = {
        mediaType: 'shortstory',
        title: shortStoryFormData.title.trim(),
        storyTitle: shortStoryFormData.title.trim(),
        storyAuthor: shortStoryFormData.author.trim() || null,
        storyYear: shortStoryFormData.year ? parseInt(shortStoryFormData.year) : null,
        storyUrl: shortStoryFormData.url.trim() || null,
        storyContainedInBookId: containedInBook ? containedInBook.id : null,
        storyCoverUrl: shortStoryFormData.coverUrl.trim() || null
      };

      const success = await handleAddMediaToOrder(viewingOrderItems.id, shortStoryMedia);
      if (success !== false) {
        setShowShortStoryForm(false);
        setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
        setShortStorySearchResults([]);
      }
    } catch (error) {
      console.error('Error adding short story:', error);
      setMessage('Error adding short story. Please try again.');
    }
  };

  if (loading) {
    return (
      <main>
        <h2>Custom Orders</h2>
        <p>Loading custom orders...</p>
      </main>
    );
  }
  return (
    <main>
      <h2>Custom Orders</h2>
      <p>Create and manage custom playlists of mixed media (movies, TV episodes, comics, etc.)</p>

      {/* Back button when viewing items */}
      {viewingOrderItems && (
        <div className="back-navigation">
          <Button
            onClick={() => setViewingOrderItems(null)}
            className="secondary"
          >
            ← Back to Custom Orders
          </Button>
        </div>
      )}

      {/* Item Management View */}
      {viewingOrderItems ? (
        <div className="order-items-view">          <div className="order-items-header">
            <div className="order-header-content">
              <div className="order-header-info">
                <h3>Managing Items: {viewingOrderItems.name}</h3>
                {viewingOrderItems.description && (
                  <p className="order-description">{viewingOrderItems.description}</p>
                )}
              </div>
              {viewingOrderItems.icon && (
                <div 
                  className="order-header-icon" 
                  dangerouslySetInnerHTML={{ __html: viewingOrderItems.icon }}
                />
              )}
            </div>
            <div className="order-stats">
              <div className="stat">
                <span className="stat-label">Total Items:</span>
                <span className="stat-value">{viewingOrderItems.items.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Unwatched:</span>
                <span className="stat-value">
                  {viewingOrderItems.items.filter(item => !item.isWatched).length}
                </span>
              </div>            </div>            <div className="manage-items-actions">
              <Button
                onClick={() => {
                  setShowSearchModal(true);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="primary"
              >
                Add Media
              </Button>
              <Button
                onClick={() => {
                  setShowEpisodeForm(true);
                  setEpisodeFormData({ series: '', season: '', episode: '' });
                }}
                className="secondary"
              >
                Add TV Episode
              </Button>
              <Button
                onClick={() => {
                  setShowBookForm(true);
                  setBookFormData({ title: '', author: '', year: '', isbn: '' });
                }}
                className="secondary"
              >
                Add Book
              </Button>              <Button
                onClick={() => {
                  setShowComicForm(true);
                  setComicFormData({ series: '', year: '', issue: '' });
                }}
                className="secondary"
              >
                Add Comic
              </Button>
              <Button
                onClick={() => {
                  setShowShortStoryForm(true);
                  setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
                }}
                className="secondary"
              >
                Add Short Story
              </Button>
              <Button
                onClick={() => {
                  setShowBulkImportModal(true);
                  setBulkImportData('');
                }}
                className="secondary"
              >
                Bulk Import
              </Button>
            </div>
          </div>          {viewingOrderItems.items.length === 0 ? (
            <div className="empty-state">
              <p>No items in this custom order yet.</p>
              <p>Add some movies, TV episodes, or comics to get started!</p>
            </div>
          ) : (
            <div className="items-list">
              {viewingOrderItems.items.map((item, index) => (                <div key={item.id} className={`item-card ${item.isWatched ? 'watched' : ''}`}>
                  <div className="item-info">
                    <div className="item-position">#{index + 1}</div>
                    <div className="item-details">
                      <h4>{item.title}</h4>
                      {item.seriesTitle && (
                        <p className="item-series">
                          {item.seriesTitle} - S{item.seasonNumber}E{item.episodeNumber}
                        </p>
                      )}
                      {item.comicSeries && (
                        <p className="item-series">
                          {item.comicSeries} ({item.comicYear}) #{item.comicIssue}
                        </p>
                      )}
                      <div className="item-meta">
                        <span className="item-type">{item.mediaType}</span>
                        <span className={`item-status ${item.isWatched ? 'watched' : 'unwatched'}`}>
                          {item.isWatched ? 'Watched' : 'Unwatched'}
                        </span>
                      </div>
                    </div>
                  </div>                  <div className="item-actions">
                    <Button
                      onClick={() => handleRemoveItem(viewingOrderItems.id, item.id, item.title)}
                      className="danger"
                      size="small"
                    >
                      Remove
                    </Button>
                    {item.mediaType === 'book' && (
                      <Button
                        onClick={() => handleReselectBook(item)}
                        className="secondary"
                        size="small"
                      >
                        Re-select Book
                      </Button>
                    )}
                    {!item.isWatched && (
                      <Button
                        onClick={() => handleMarkAsWatched(viewingOrderItems.id, item.id, item.title)}
                        className="primary"
                        size="small"
                      >
                        Mark as Watched
                      </Button>
                    )}
                    {item.isWatched && (
                      <Button
                        onClick={() => handleMarkAsUnwatched(viewingOrderItems.id, item.id, item.title)}
                        className="secondary"
                        size="small"
                      >
                        Mark as Unwatched
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Create New Order Button */}
          <div className="custom-orders-header">
            <Button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setFormData({ name: '', description: '' });
                setMessage('');
              }}
            >
              {showCreateForm ? 'Cancel' : 'Create New Custom Order'}
            </Button>
          </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="create-form">
          <h3>Create New Custom Order</h3>
          <form onSubmit={handleCreateOrder}>
            <div className="form-group">
              <label htmlFor="orderName">Order Name *</label>
              <input
                type="text"
                id="orderName"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Marvel Movies & Shows"
                required
              />            </div>
            <div className="form-group">
              <label htmlFor="orderDescription">Description</label>
              <textarea
                id="orderDescription"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Optional description of this custom order..."
                rows="3"
              />
            </div>
            <div className="form-group">
              <label htmlFor="orderIcon">Icon (SVG)</label>
              <textarea
                id="orderIcon"
                value={formData.icon}
                onChange={(e) => setFormData({...formData, icon: e.target.value})}
                placeholder="Paste SVG icon code here (optional)..."
                rows="3"
              />
              {formData.icon && (
                <div className="icon-preview">
                  <span>Preview: </span>
                  <div 
                    className="custom-order-icon" 
                    dangerouslySetInnerHTML={{__html: formData.icon}}
                  />
                </div>
              )}
            </div>
            <div className="form-actions">
              <Button type="submit">Create Order</Button>
              <Button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
                className="secondary"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Orders List */}
      <div className="custom-orders-list">
        {customOrders.length === 0 ? (
          <div className="empty-state">
            <p>No custom orders created yet.</p>
            <p>Create your first custom order to get started!</p>
          </div>
        ) : (
          <div className="orders-grid">            {customOrders.map(order => (
              <div key={order.id} className={`order-card ${!order.isActive ? 'inactive' : ''}`}>
                {/* SVG Icon Background */}
                {order.icon && (
                  <div 
                    className="order-card-background" 
                    dangerouslySetInnerHTML={{ __html: order.icon }}
                  />
                )}
                
                <div className="order-content">
                  <div className="order-header">
                    <h3 
                      className="clickable-title" 
                      onClick={() => handleViewItems(order)}
                      title="Click to manage items"
                    >
                      {order.name}
                    </h3>
                    <div className="order-status">
                      <span className={`status-badge ${order.isActive ? 'active' : 'inactive'}`}>
                        {order.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>                  
                  {order.description && (
                    <p className="order-description">{order.description}</p>
                  )}
                  
                  <div className="order-stats">
                    <div className="stat">
                      <span className="stat-label">Total Items:</span>
                      <span className="stat-value">{order.items.length}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Unwatched:</span>
                      <span className="stat-value">
                        {order.items.filter(item => !item.isWatched).length}
                      </span>
                    </div>
                  </div>

                  <div className="order-actions">
                    <Button
                      onClick={() => handleToggleActive(order.id, order.isActive)}
                      className={order.isActive ? 'secondary' : 'primary'}
                      size="small"
                    >
                      {order.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    
                    <Button
                      onClick={() => handleViewItems(order)}
                      className="primary"
                      size="small"
                    >
                      Manage Items
                    </Button>
                    
                    {order.items.length > 0 && (
                      <Button
                        onClick={() => resetWatchedStatus(order.id, order.name)}
                        className="secondary"
                        size="small"
                      >
                        Reset Watched
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => handleDeleteOrder(order.id, order.name)}
                      className="danger"
                      size="small"
                    >
                      Delete
                    </Button>
                  </div>

                  <div className="order-created">
                    Created: {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Media to Custom Order</h3>
              <Button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <div className="search-section">
              <div className="search-input-group">
                <input
                  type="text"
                  placeholder="Search for movies or TV episodes..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchMedia(e.target.value);
                  }}
                  className="search-input"
                />
                {searchLoading && <div className="search-loading">Searching...</div>}
              </div>
              
              <div className="search-results">
                {searchResults.length === 0 && searchQuery && !searchLoading && (
                  <div className="no-results">
                    <p>Media search functionality coming soon!</p>
                    <p>For now, you can manually add media using Plex keys through the API.</p>
                  </div>
                )}
                
                {searchResults.map(result => (
                  <div key={result.ratingKey} className="search-result-item">
                    <div className="result-info">
                      <h4>{result.title}</h4>
                      {result.grandparentTitle && (
                        <p>{result.grandparentTitle} - S{result.parentIndex}E{result.index}</p>
                      )}
                      <span className="result-type">{result.type}</span>
                    </div>
                    <Button
                      onClick={() => handleAddMediaToOrder(viewingOrderItems.id, result)}
                      className="primary"
                      size="small"
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
                <div className="manual-add-section">
                <p className="manual-add-note">
                  <strong>Note:</strong> Advanced users can manually add media by creating a Plex search endpoint. 
                  For now, items can be added programmatically through the API endpoints.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Episode Form Modal */}
      {showEpisodeForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add TV Episode</h3>
              <Button
                onClick={() => {
                  setShowEpisodeForm(false);
                  setEpisodeFormData({ series: '', season: '', episode: '' });
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <form onSubmit={handleSearchTVEpisode} className="episode-form">
              <div className="form-group">
                <label htmlFor="series">Series Name *</label>
                <input
                  type="text"
                  id="series"
                  value={episodeFormData.series}
                  onChange={(e) => setEpisodeFormData({
                    ...episodeFormData,
                    series: e.target.value
                  })}
                  placeholder="e.g., Breaking Bad"
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="season">Season Number *</label>
                  <input
                    type="number"
                    id="season"
                    min="1"
                    value={episodeFormData.season}
                    onChange={(e) => setEpisodeFormData({
                      ...episodeFormData,
                      season: e.target.value
                    })}
                    placeholder="1"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="episode">Episode Number *</label>
                  <input
                    type="number"
                    id="episode"
                    min="1"
                    value={episodeFormData.episode}
                    onChange={(e) => setEpisodeFormData({
                      ...episodeFormData,
                      episode: e.target.value
                    })}
                    placeholder="1"
                    required
                  />
                </div>
              </div>
              
              <div className="form-actions">
                <Button 
                  type="submit" 
                  disabled={episodeSearchLoading}
                  className="primary"
                >
                  {episodeSearchLoading ? 'Searching...' : 'Add Episode'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowEpisodeForm(false);
                    setEpisodeFormData({ series: '', season: '', episode: '' });
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Bulk Import Media</h3>
              <Button
                onClick={() => {
                  setShowBulkImportModal(false);
                  setBulkImportData('');
                  setMessage('');
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <form onSubmit={handleBulkImport} className="bulk-import-form">
              <div className="form-group">
                <label htmlFor="bulkData">Paste your tab-delimited data here *</label>
                <textarea
                  id="bulkData"
                  value={bulkImportData}
                  onChange={(e) => setBulkImportData(e.target.value)}
                  placeholder="Series/Movie&#9;Season/Episode&#9;Title&#9;Type"
                  rows="10"
                  required
                />
              </div>
              
              <div className="form-actions">
                <Button 
                  type="submit" 
                  disabled={bulkImportLoading}
                  className="primary"
                >
                  {bulkImportLoading ? 'Importing...' : 'Import Media'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowBulkImportModal(false);
                    setBulkImportData('');
                    setMessage('');
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
            
            <div className="bulk-import-note">
              <p><strong>Note:</strong> This feature is for advanced users. Please ensure your data is correctly formatted.</p>
              <p>Example format:</p>
              <pre>
                {`Breaking Bad\tS1E1\tPilot\tEpisode
The Godfather\t\tThe Godfather\tMovie`}
              </pre>
            </div>
          </div>
        </div>      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Bulk Import Media</h3>
              <Button
                onClick={() => {
                  setShowBulkImportModal(false);
                  setBulkImportData('');
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <form onSubmit={handleBulkImport} className="bulk-import-form">              <div className="bulk-import-instructions">
                <h4>Tab-Delimited Import Format</h4>
                <p>Paste tab-separated data with these 4 columns in order:</p>
                <ol>
                  <li><strong>Series/Movie/Comic/Book Name:</strong> The name of the TV series, movie, comic, or book (for comics use "Series Name (Year) #Issue" format)</li>
                  <li><strong>Season/Episode/Author:</strong> For episodes: S1E1, S01E01, 1x1, 1,1, or 1-1 format; For books: Author name (optionally with year: "Author Name (Year)"); Leave blank for movies and comics</li>
                  <li><strong>Title:</strong> The specific episode title, movie title, comic issue title, or book title</li>
                  <li><strong>Type:</strong> "episode" (or "TV Series") for TV episodes, "movie" for movies, "comic" for comics, "book" for books</li>
                </ol>
                
                <div className="example-data">
                  <strong>Example:</strong>
                  <pre>
Breaking Bad	S1E1	Pilot	episode
Breaking Bad	S01E02	Cat's in the Bag...	episode
The Avengers		The Avengers	movie
Game of Thrones	1x1	Winter Is Coming	episode
The Amazing Spider-Man (2018) #1		Amazing Spider-Man	comic
The High Republic Adventures (2022) #7		The Monster of Temple Peak Part 1	comic
The High Republic: Convergence	Zoraida Córdova (2022)	The High Republic: Convergence	book
Dune	Frank Herbert (1965)	Dune	book
                  </pre>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="bulkData">Tab-Delimited Data *</label>
                <textarea
                  id="bulkData"
                  value={bulkImportData}
                  onChange={(e) => setBulkImportData(e.target.value)}
                  placeholder="Paste your tab-delimited data here..."
                  rows="10"
                  className="bulk-import-textarea"
                  required
                />
              </div>
              
              <div className="form-actions">
                <Button 
                  type="submit" 
                  disabled={bulkImportLoading}
                  className="primary"
                >
                  {bulkImportLoading ? 'Importing...' : 'Import Items'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowBulkImportModal(false);
                    setBulkImportData('');
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>      )}

      {/* Book Search Modal */}
      {showBookForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{reselectingItem ? 'Re-select Book' : 'Add Book'}</h3>
              <Button
                onClick={() => {
                  setShowBookForm(false);
                  setReselectingItem(null);
                  setBookFormData({ title: '', author: '', year: '', isbn: '' });
                  setBookSearchResults([]);
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <form onSubmit={handleSearchBooks} className="book-search-form">
              <div className="form-group">
                <label htmlFor="bookTitle">Book Title *</label>
                <input
                  type="text"
                  id="bookTitle"
                  value={bookFormData.title}
                  onChange={(e) => setBookFormData({...bookFormData, title: e.target.value})}
                  placeholder="Enter book title..."
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="bookAuthor">Author</label>
                <input
                  type="text"
                  id="bookAuthor"
                  value={bookFormData.author}
                  onChange={(e) => setBookFormData({...bookFormData, author: e.target.value})}
                  placeholder="Enter author name (optional)..."
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="bookYear">Publication Year</label>
                <input
                  type="number"
                  id="bookYear"
                  value={bookFormData.year}
                  onChange={(e) => setBookFormData({...bookFormData, year: e.target.value})}
                  placeholder="e.g., 2020"
                  min="1000"
                  max="2030"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="bookIsbn">ISBN</label>
                <input
                  type="text"
                  id="bookIsbn"
                  value={bookFormData.isbn}
                  onChange={(e) => setBookFormData({...bookFormData, isbn: e.target.value})}
                  placeholder="Enter ISBN (optional)..."
                />
              </div>
              
              <div className="form-actions">
                <Button 
                  type="submit" 
                  disabled={bookSearchLoading}
                  className="primary"
                >
                  {bookSearchLoading ? 'Searching...' : 'Search Books'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowBookForm(false);
                    setReselectingItem(null);
                    setBookFormData({ title: '', author: '', year: '', isbn: '' });
                    setBookSearchResults([]);
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
            
            {/* Search Results */}
            {bookSearchResults.length > 0 && (
              <div className="book-search-results">
                <h4>Search Results</h4>
                <div className="book-results-list">
                  {bookSearchResults.map((book, index) => (
                    <div key={index} className="book-result-item">
                      <div className="book-info">
                        {book.coverUrl && (
                          <img 
                            src={book.coverUrl} 
                            alt={`Cover of ${book.title}`} 
                            className="book-cover-small"
                          />
                        )}
                        <div className="book-details">
                          <h5>{book.title}</h5>
                          <p className="book-author">
                            {book.authors && book.authors[0] ? book.authors[0] : 'Unknown Author'}
                          </p>
                          {book.firstPublishYear && (
                            <p className="book-year">Published: {book.firstPublishYear}</p>
                          )}
                          {book.publishers && book.publishers[0] && (
                            <p className="book-publisher">Publisher: {book.publishers[0]}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleSelectBook(book)}
                        className="primary"
                        size="small"
                      >
                        {reselectingItem ? 'Re-select This Book' : 'Add This Book'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comic Search Modal */}
      {showComicForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Comic</h3>
              <Button
                onClick={() => {
                  setShowComicForm(false);
                  setComicFormData({ series: '', year: '', issue: '' });
                  setComicSearchResults([]);
                }}
                className="secondary"
                size="small"
              >
                ✕
              </Button>
            </div>
            
            <form onSubmit={handleSearchComics} className="comic-search-form">
              <div className="form-group">
                <label htmlFor="comicSeries">Comic Series *</label>
                <input
                  type="text"
                  id="comicSeries"
                  value={comicFormData.series}
                  onChange={(e) => setComicFormData({...comicFormData, series: e.target.value})}
                  placeholder="Enter comic series name..."
                  required
                />
              </div>
                <div className="form-row">
                <div className="form-group">
                  <label htmlFor="comicYear">Year</label>
                  <input
                    type="number"
                    id="comicYear"
                    value={comicFormData.year}
                    onChange={(e) => setComicFormData({...comicFormData, year: e.target.value})}
                    placeholder="e.g., 2022 (optional)"
                    min="1930"
                    max="2030"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="comicIssue">Issue Number *</label>
                  <input
                    type="text"
                    id="comicIssue"
                    value={comicFormData.issue}
                    onChange={(e) => setComicFormData({...comicFormData, issue: e.target.value})}
                    placeholder="e.g., 1 or 1-2"
                    required
                  />
                </div>
              </div>
              
              <div className="form-actions">
                <Button 
                  type="submit" 
                  disabled={comicSearchLoading}
                  className="primary"
                >
                  {comicSearchLoading ? 'Searching...' : 'Search Comic Series'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowComicForm(false);
                    setComicFormData({ series: '', year: '', issue: '' });
                    setComicSearchResults([]);
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
            
            {/* Search Results */}
            {comicSearchResults.length > 0 && (
              <div className="comic-search-results">
                <h4>Select Comic Series</h4>                <p className="search-note">
                  Found {comicSearchResults.length} series. Select the correct one, then the comic will be added as "{comicFormData.series}{comicFormData.year ? ` (${comicFormData.year})` : ''} #{comicFormData.issue}".
                </p>
                <div className="comic-results-list">
                  {comicSearchResults.map((series, index) => (
                    <div key={index} className="comic-result-item">
                      <div className="comic-info">
                        <div className="comic-details">
                          <h5>{series.name}</h5>
                          <p className="comic-publisher">
                            Publisher: {series.publisher?.name || 'Unknown'}
                          </p>
                          {series.start_year && (
                            <p className="comic-year">Started: {series.start_year}</p>
                          )}
                          {series.issue_count && (
                            <p className="comic-issues">Issues: {series.issue_count}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleSelectComic(series)}
                        className="primary"
                        size="small"
                      >
                        Add This Comic
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>        </div>
      )}

      {/* Short Story Search Modal */}
      {showShortStoryForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Short Story</h3>
              <Button
                onClick={() => {
                  setShowShortStoryForm(false);
                  setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
                  setShortStorySearchResults([]);
                }}
                className="close-modal"
              >
                ×
              </Button>
            </div>
            
            <form onSubmit={handleSearchShortStoryBooks} className="shortstory-search-form">
              <div className="form-group">
                <label htmlFor="shortstory-title">Story Title *</label>
                <input
                  type="text"
                  id="shortstory-title"
                  value={shortStoryFormData.title}
                  onChange={(e) => setShortStoryFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter short story title"
                  required
                />
              </div>
                <div className="form-group">
                <label htmlFor="shortstory-author">Author (optional)</label>
                <input
                  type="text"
                  id="shortstory-author"
                  value={shortStoryFormData.author}
                  onChange={(e) => setShortStoryFormData(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Enter author name (optional)"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="shortstory-year">Year (optional)</label>
                <input
                  type="number"
                  id="shortstory-year"
                  value={shortStoryFormData.year}
                  onChange={(e) => setShortStoryFormData(prev => ({ ...prev, year: e.target.value }))}
                  placeholder="Publication year"
                  min="1000"
                  max={new Date().getFullYear() + 5}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="shortstory-url">Story URL (optional)</label>
                <input
                  type="url"
                  id="shortstory-url"
                  value={shortStoryFormData.url}
                  onChange={(e) => setShortStoryFormData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/story-link"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="shortstory-cover">Cover Image URL (optional)</label>
                <input
                  type="url"
                  id="shortstory-cover"
                  value={shortStoryFormData.coverUrl}
                  onChange={(e) => setShortStoryFormData(prev => ({ ...prev, coverUrl: e.target.value }))}
                  placeholder="https://example.com/cover.jpg"
                />
              </div>
              
              <div className="form-actions">
                <Button type="submit" className="primary">
                  Search for Books to Contain This Story
                </Button>
                <Button
                  type="button"
                  onClick={() => handleAddShortStory()}
                  className="secondary"
                >
                  Add Story Without Container Book
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowShortStoryForm(false);
                    setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
                    setShortStorySearchResults([]);
                  }}
                  className="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
            
            {/* Search Results */}
            {shortStorySearchResults.length > 0 && (
              <div className="shortstory-search-results">
                <h4>Select Container Book</h4>
                <p className="search-note">
                  Found {shortStorySearchResults.length} books by {shortStoryFormData.author}. Select which book contains the story "{shortStoryFormData.title}", or add the story without a container book.
                </p>
                <div className="book-results-list">
                  {shortStorySearchResults.map((book, index) => (
                    <div key={index} className="book-result-item">
                      <div className="book-info">
                        {book.cover_i && (
                          <img 
                            src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`}
                            alt={book.title}
                            className="book-cover"
                          />
                        )}
                        <div className="book-details">
                          <h5>{book.title}</h5>
                          <p className="book-author">
                            by {book.author_name ? book.author_name.join(', ') : 'Unknown Author'}
                          </p>
                          {book.first_publish_year && (
                            <p className="book-year">First published: {book.first_publish_year}</p>
                          )}
                          {book.isbn && book.isbn.length > 0 && (
                            <p className="book-isbn">ISBN: {book.isbn[0]}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleAddShortStory(book)}
                        className="primary"
                        size="small"
                      >
                        Story is in This Book
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="no-book-option">
                  <Button
                    onClick={() => handleAddShortStory()}
                    className="secondary"
                  >
                    None of These - Add Story Without Container Book
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {message && (
        <div className="message">
          <p>{message}</p>
        </div>
      )}
    </main>
  );
}

export default CustomOrders;

