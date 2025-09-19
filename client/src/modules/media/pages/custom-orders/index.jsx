import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import config from '../../../../config';
import './CustomOrders.css';

// Modular component imports
import OrderHeader from './components/OrderHeader';
import EpisodeForm from './components/forms/EpisodeForm';
import BulkImportModal from './components/modals/BulkImportModal';
import MovieForm from './components/forms/MovieForm';
import ErrorModal from './components/modals/ErrorModal';
import MessageDisplay from './components/MessageDisplay';
import LoadingPage from './components/LoadingPage';
import LoadingIndicator from './components/LoadingIndicator';
import FormSeparator from './components/FormSeparator';
import HelpText from './components/HelpText';
import FilterToggle from './components/FilterToggle';
import EmptyState from './components/EmptyState';
import StatusIndicator from './components/StatusIndicator';
import Stat from './components/Stat';
import InlineIcon from './components/InlineIcon';
import SubOrdersBadge from './components/SubOrdersBadge';
import HierarchyIndicator from './components/HierarchyIndicator';
import DateDisplay from './components/DateDisplay';
import PlaylistDisplay from './components/PlaylistDisplay';
import DescriptionDisplay from './components/DescriptionDisplay';
import PreviewLabel from './components/PreviewLabel';
import TypeIndicator from './components/TypeIndicator';
import ReadingProgressDisplay from './components/ReadingProgressDisplay';
import MovieSearchResults from './components/MovieSearchResults';
import BookSearchResults from './components/BookSearchResults';
import ComicSearchResults from './components/ComicSearchResults';
import OrderCard from './components/OrderCard';
import OrderListView from './components/OrderListView';
import MovieFormModal from './components/modals/MovieFormModal';
import BookFormModal from './components/modals/BookFormModal';
import CmroBulkImportModal from './components/modals/CmroBulkImportModal';
import ComicFormModal from './components/modals/ComicFormModal';
import ShortStoryFormModal from './components/modals/ShortStoryFormModal';
import WebVideoFormModal from './components/modals/WebVideoFormModal';
import EpisodeFormModal from './components/modals/EpisodeFormModal';
import BulkImportFormModal from './components/modals/BulkImportFormModal';
import DetailedBookFormModal from './components/modals/DetailedBookFormModal';

// Utility imports
import {
  getFilteredItems,
  getAllNonReferenceItems,
  getUnwatchedNonReferenceItems,
  getItemArtworkUrl
} from './utils/itemUtils';
import { scrollToTop, scrollToBottom } from './utils/scrollUtils';

function CustomOrders() {  
  const [customOrders, setCustomOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);  const [editingItem, setEditingItem] = useState(null);
  const [viewingOrderItems, setViewingOrderItems] = useState(null);
  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [episodeFormData, setEpisodeFormData] = useState({
    series: '',
    season: '',
    episode: ''
  });  const [episodeSearchLoading, setEpisodeSearchLoading] = useState(false);  const [showMovieForm, setShowMovieForm] = useState(false);
  const [movieFormData, setMovieFormData] = useState({
    title: '',
    year: ''
  });
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [movieSearchLoading, setMovieSearchLoading] = useState(false);  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportData, setBulkImportData] = useState('');
  const [bulkImportLoading, setBulkImportLoading] = useState(false);

  const [showCmroBulkImportModal, setShowCmroBulkImportModal] = useState(false);
  const [cmroBulkImportData, setCmroBulkImportData] = useState('');
  const [cmroBulkImportLoading, setCmroBulkImportLoading] = useState(false);

  // Error modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState({ title: '', message: '', error: null });

  const [reselectingItem, setReselectingItem] = useState(null); // For tracking which item is being re-selected
  const [showBookForm, setShowBookForm] = useState(false);
  const [bookFormData, setBookFormData] = useState({
    title: '',
    author: '',
    year: '',
    isbn: '',
    pageCount: ''
  });  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);
  const [showComicForm, setShowComicForm] = useState(false);  const [comicFormData, setComicFormData] = useState({
    series: '',
    year: '',
    issue: '',
    title: ''
  });  const [comicSearchResults, setComicSearchResults] = useState([]);
  const [comicSearchLoading, setComicSearchLoading] = useState(false);
  
  // State for tracking expanded comic details
  const [expandedItems, setExpandedItems] = useState(new Set());
  
  const [showShortStoryForm, setShowShortStoryForm] = useState(false);
  const [shortStoryFormData, setShortStoryFormData] = useState({
    title: '',
    author: '',
    year: '',
    url: '',
    containedInBookId: '',
    coverUrl: ''
  });  const [shortStorySearchResults, setShortStorySearchResults] = useState([]);
  
  // Web Video Form state
  const [showWebVideoForm, setShowWebVideoForm] = useState(false);
  const [webVideoFormData, setWebVideoFormData] = useState({
    title: '',
    url: '',
    description: ''
  });
  
  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState(null);
  
  // Parent/hierarchy state
  const [availableParents, setAvailableParents] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Watched items filter state
  const [showWatchedItems, setShowWatchedItems] = useState(true);
  
  // Available playlists for linking
  const [availablePlaylists, setAvailablePlaylists] = useState({ plex: [], custom: [] });
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  
  // Available backgrounds and galleries for linking
  const [availableBackgrounds, setAvailableBackgrounds] = useState([]);
  const [availableGalleries, setAvailableGalleries] = useState([]);
  const [backgroundsLoading, setBackgroundsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    playlistRatingKey: '',
    customPlaylistId: '',
    backgroundImageId: '',
    backgroundGalleryId: ''
  });
  // Function to toggle expanded state for an item
  const toggleItemExpanded = (itemId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Helper functions to parse and format comic metadata
  const parseComicCharacters = (charactersJson) => {
    if (!charactersJson) return [];
    try {
      return typeof charactersJson === 'string' ? JSON.parse(charactersJson) : charactersJson;
    } catch (e) {
      console.warn('Failed to parse comic characters:', e);
      return [];
    }
  };

  const parseComicCreators = (creatorsJson) => {
    if (!creatorsJson) return [];
    try {
      const parsed = typeof creatorsJson === 'string' ? JSON.parse(creatorsJson) : creatorsJson;
      
      // Handle both the old format (object with role keys) and new format (array of objects)
      if (Array.isArray(parsed)) {
        return parsed; // New format: [{"name": "Nick Spencer", "role": "writer"}, ...]
      } else if (typeof parsed === 'object') {
        // Old format: {"writer": ["Nick Spencer"], "penciler": ["Ryan Ottley"], ...}
        const creators = [];
        Object.entries(parsed).forEach(([role, names]) => {
          if (Array.isArray(names)) {
            names.forEach(name => creators.push({ name, role }));
          }
        });
        return creators;
      }
      return [];
    } catch (e) {
      console.warn('Failed to parse comic creators:', e);
      return [];
    }
  };

  const formatCreatorsDisplay = (creatorsData) => {
    const creators = parseComicCreators(creatorsData);
    if (creators.length === 0) return '';
    
    return creators.map(creator => `${creator.name} (${creator.role})`).join(', ');
  };

  const formatCharactersDisplay = (charactersData) => {
    const characters = parseComicCharacters(charactersData);
    if (characters.length === 0) return '';
    
    return characters.map(char => char.name || char).join(', ');
  };

  // Fetch custom orders when component mounts
  useEffect(() => {
    fetchCustomOrders();
    
    // Check URL parameters to restore viewing state
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdParam = urlParams.get('order');
    if (orderIdParam) {
      const orderId = parseInt(orderIdParam);
      if (!isNaN(orderId)) {
        // Load the specific order after custom orders are fetched
        setTimeout(() => {
          handleViewOrder(orderId);
        }, 100);
      }
    }
  }, []);

  const fetchCustomOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders`);
      const orders = await response.json();
      setCustomOrders(orders);
    } catch (error) {
      console.error('Error fetching custom orders:', error);
      setMessage('Failed to load custom orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableParents = async (excludeId = null) => {
    try {
      const url = excludeId 
        ? `${config.apiBaseUrl}/api/custom-orders/available-parents/${excludeId}`
        : `${config.apiBaseUrl}/api/custom-orders/available-parents`;
      const response = await fetch(url);
      const parents = await response.json();
      setAvailableParents(parents);
    } catch (error) {
      console.error('Error fetching available parent orders:', error);
      setMessage('Failed to load available parent orders');
    }
  };

  const fetchAvailablePlaylists = async () => {
    try {
      setPlaylistsLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/api/playlists/available`);
      if (response.ok) {
        const data = await response.json();
        // Transform API response to match expected structure
        setAvailablePlaylists({
          plex: data.plexPlaylists || [],
          custom: data.customPlaylists || []
        });
      } else {
        console.error('Failed to fetch available playlists');
        setAvailablePlaylists({ plex: [], custom: [] });
      }
    } catch (error) {
      console.error('Error fetching available playlists:', error);
      setAvailablePlaylists({ plex: [], custom: [] });
    } finally {
      setPlaylistsLoading(false);
    }
  };

  const fetchAvailableBackgrounds = async () => {
    try {
      setBackgroundsLoading(true);
      
      // Fetch background images
      const backgroundsResponse = await fetch(`${config.apiBaseUrl}/api/backgrounds`);
      const backgroundsData = backgroundsResponse.ok ? await backgroundsResponse.json() : { backgrounds: [] };
      
      // Fetch background galleries
      const galleriesResponse = await fetch(`${config.apiBaseUrl}/api/background-galleries`);
      const galleriesData = galleriesResponse.ok ? await galleriesResponse.json() : { galleries: [] };
      
      setAvailableBackgrounds(backgroundsData.backgrounds || []);
      setAvailableGalleries(galleriesData.galleries || []);
    } catch (error) {
      console.error('Error fetching available backgrounds:', error);
      setAvailableBackgrounds([]);
      setAvailableGalleries([]);
    } finally {
      setBackgroundsLoading(false);
    }
  };

  // Helper function to handle viewing an order and updating URL
  const handleViewOrder = async (orderIdOrOrder) => {
    let order;
    let orderId;
    
    if (typeof orderIdOrOrder === 'number') {
      orderId = orderIdOrOrder;
    } else {
      orderId = orderIdOrOrder.id;
    }
    
    // Always fetch the order from the API to ensure we have the latest data with items
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}`);
      if (response.ok) {
        order = await response.json();
      } else {
        console.error('Failed to fetch order:', orderId);
        return;
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      return;
    }
    
    // Set the viewing state
    setViewingOrderItems(order);
    
    // Update URL with order parameter
    const url = new URL(window.location);
    url.searchParams.set('order', order.id);
    window.history.pushState({}, '', url);
  };

  // Helper function to go back to order list and clear URL
  const handleBackToOrderList = () => {
    setViewingOrderItems(null);
    
    // Clear order parameter from URL
    const url = new URL(window.location);
    url.searchParams.delete('order');
    window.history.pushState({}, '', url);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage('Order name is required');
      return;
    }

    try {
      const requestBody = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        icon: formData.icon.trim(),
        parentOrderId: selectedParentId
      };

      // Add playlist fields if selected
      if (formData.playlistRatingKey) {
        requestBody.playlistRatingKey = formData.playlistRatingKey;
      }
      if (formData.customPlaylistId) {
        requestBody.customPlaylistId = parseInt(formData.customPlaylistId);
      }
      
      // Add background fields if selected
      if (formData.backgroundImageId) {
        requestBody.backgroundImageId = parseInt(formData.backgroundImageId);
      }
      if (formData.backgroundGalleryId) {
        requestBody.backgroundGalleryId = parseInt(formData.backgroundGalleryId);
      }

      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setMessage('Custom order created successfully');
        setFormData({ name: '', description: '', icon: '', playlistRatingKey: '', customPlaylistId: '' });
        setSelectedParentId(null);
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
      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}`, {
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
      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}`, {
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

  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setFormData({
      name: order.name,
      description: order.description || '',
      icon: order.icon || '',
      playlistRatingKey: order.playlistRatingKey || '',
      customPlaylistId: order.customPlaylistId ? order.customPlaylistId.toString() : '',
      backgroundImageId: order.backgroundImageId ? order.backgroundImageId.toString() : '',
      backgroundGalleryId: order.backgroundGalleryId ? order.backgroundGalleryId.toString() : ''
    });
    setMessage('');
    
    // Load playlists and backgrounds when starting to edit
    if (!availablePlaylists.plex.length && !availablePlaylists.custom.length) {
      fetchAvailablePlaylists();
    }
    if (!availableBackgrounds.length && !availableGalleries.length) {
      fetchAvailableBackgrounds();
    }
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage('Order name is required');
      return;
    }

    try {
      const requestBody = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        icon: formData.icon.trim()
      };

      // Add playlist fields if selected
      if (formData.playlistRatingKey) {
        requestBody.playlistRatingKey = formData.playlistRatingKey;
      }
      if (formData.customPlaylistId) {
        requestBody.customPlaylistId = parseInt(formData.customPlaylistId);
      }
      
      // Add background fields if selected
      if (formData.backgroundImageId) {
        requestBody.backgroundImageId = parseInt(formData.backgroundImageId);
      }
      if (formData.backgroundGalleryId) {
        requestBody.backgroundGalleryId = parseInt(formData.backgroundGalleryId);
      }

      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setMessage('Custom order updated successfully');
        setFormData({ name: '', description: '', icon: '', playlistRatingKey: '', customPlaylistId: '' });
        setEditingOrder(null);
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === editingOrder.id) {
          const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${editingOrder.id}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }    } catch (error) {
      console.error('Error updating custom order:', error);
      setMessage('Error updating custom order');
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    
    // Set appropriate form data based on item type
    switch (item.mediaType) {
      case 'episode':
        setEpisodeFormData({
          series: item.series || '',
          season: item.season || '',
          episode: item.episode || ''
        });
        setShowEpisodeForm(true);
        break;
      case 'book':
        setBookFormData({
          title: item.bookTitle || item.title || '',
          author: item.bookAuthor || '',
          year: item.bookYear || '',
          isbn: item.bookIsbn || '',
          pageCount: item.bookPageCount || ''
        });
        setShowBookForm(true);
        break;      case 'comic':
        setComicFormData({
          series: item.comicSeries || '',
          year: item.comicYear || '',
          issue: item.comicIssue || '',
          title: item.customTitle || ''
        });
        setShowComicForm(true);
        break;      case 'shortstory':
        setShortStoryFormData({
          title: item.storyTitle || '',
          author: item.storyAuthor || '',
          year: item.storyYear || '',
          url: item.storyUrl || '',
          containedInBookId: item.storyContainedInBookId || '',
          coverUrl: item.storyCoverUrl || ''
        });
        setShowShortStoryForm(true);
        break;
      case 'webvideo':
        setWebVideoFormData({
          title: item.title || '',
          url: item.url || '',
          description: item.description || ''
        });
        setShowWebVideoForm(true);
        break;
      default:
        // For movies or other types, we might need a different approach
        setMessage(`Editing ${item.mediaType} items is not yet supported`);
    }
  };

  const handleUpdateItem = async (updatedItemData) => {
    if (!editingItem || !viewingOrderItems) return;

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}/items/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedItemData),
      });

      if (response.ok) {
        setMessage('Item updated successfully');
        setEditingItem(null);
          // Close the appropriate form
        setShowEpisodeForm(false);
        setShowBookForm(false);
        setShowComicForm(false);
        setShowShortStoryForm(false);
        setShowWebVideoForm(false);
          // Reset form data
        setEpisodeFormData({ series: '', season: '', episode: '' });
        setBookFormData({ title: '', author: '', year: '', isbn: '', pageCount: '' });
        setComicFormData({ series: '', year: '', issue: '', title: '' });
        setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
        setWebVideoFormData({ title: '', url: '', description: '' });
        
        // Refresh the order items
        const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}`);
        const updatedOrderData = await updatedOrder.json();
        setViewingOrderItems(updatedOrderData);
        
      } else {
        const errorData = await response.json();
        setMessage(`Error updating item: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      setMessage('Error updating item');
    }
  };

  const resetWatchedStatus = async (orderId, orderName) => {
    if (!confirm(`Are you sure you want to mark all items in "${orderName}" as unwatched?`)) {
      return;
    }

    try {
      // Get the order details first
      const orderResponse = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}`);
      const orderData = await orderResponse.json();

      // Update each item to be unwatched
      for (const item of orderData.items) {
        await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}/items/${item.id}`, {
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
      // Check if this is a short story before deletion
      const itemToRemove = viewingOrderItems?.items?.find(item => item.id === itemId);
      let containingBookId = null;
      
      if (itemToRemove && itemToRemove.mediaType === 'shortstory' && itemToRemove.storyContainedInBookId) {
        containingBookId = itemToRemove.storyContainedInBookId;
      }

      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage('Item removed successfully');
        
        // If this was a short story from a book, check if we need to remove the containing book
        if (containingBookId) {
          // Get the updated order data to check remaining short stories
          const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}`);
          const updatedOrderData = await updatedOrder.json();
          
          // Check if there are any other short stories from the same book
          const remainingStoriesFromBook = updatedOrderData.items.filter(item => 
            item.mediaType === 'shortstory' && 
            item.storyContainedInBookId === containingBookId
          );
          
          // If no other short stories from this book remain, remove the book
          if (remainingStoriesFromBook.length === 0) {
            const containingBook = updatedOrderData.items.find(item => 
              item.id === containingBookId && item.mediaType === 'book'
            );
            
            if (containingBook) {
              const bookRemoveResponse = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}/items/${containingBookId}`, {
                method: 'DELETE',
              });
              
              if (bookRemoveResponse.ok) {
                setMessage(`Item and containing book "${containingBook.bookTitle || containingBook.title}" removed successfully`);
              } else {
                setMessage('Item removed successfully, but failed to remove empty containing book');
              }
            }
          }
        }
        
        fetchCustomOrders(); // Refresh the list
        
        // Update the viewing order if it's currently being viewed
        if (viewingOrderItems && viewingOrderItems.id === orderId) {
          const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}`);
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
      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}/items/${itemId}`, {
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
          const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}`);
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
      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}/items/${itemId}`, {
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
          const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}`);
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
    setReselectingItem(item);
    
    setBookFormData({
      title: item.bookTitle || item.title || '',
      author: item.bookAuthor || '',
      year: item.bookYear ? item.bookYear.toString() : '',
      isbn: item.bookIsbn || ''
    });
    
    setShowBookForm(true);
  };
  const handleReselectComic = (item) => {
    setReselectingItem(item);
      setComicFormData({
      series: item.comicSeries || '',
      year: item.comicYear ? item.comicYear.toString() : '',
      issue: item.comicIssue || '',
      title: item.customTitle || ''
    });
    
    setShowComicForm(true);
  };
  const handleCollectedIn = (item) => {
    setReselectingItem(item);
    
    // Pre-populate search with story author if available
    setBookFormData({
      title: '',
      author: item.storyAuthor || '',
      year: item.storyYear ? item.storyYear.toString() : '',
      isbn: ''
    });
    
    setShowBookForm(true);
  };

  // Navigate to home page with selected item
  const handleNavigateToHome = async (item) => {
    console.log('🏠 Navigate to Home - Original item:', item);
    
    if (!item.plexKey && item.mediaType === 'episode') {
      console.warn('🏠 No plexKey available for episode, using basic data');
      // Fallback to basic data if no plexKey
      const basicData = {
        id: item.id,
        type: 'episode',
        title: item.title,
        seriesTitle: item.seriesTitle,
        season: item.seasonNumber,
        episode: item.episodeNumber,
        orderType: 'CUSTOM_ORDER',
        customOrderId: viewingOrderItems?.id,
        customOrderName: viewingOrderItems?.name,
      };
      localStorage.setItem('masterOrder_selectedMedia', JSON.stringify(basicData));
      window.location.href = '/';
      return;
    }
    
    if (item.plexKey && (item.mediaType === 'episode' || item.mediaType === 'movie')) {
      try {
        console.log(`🏠 Fetching full Plex data for ${item.mediaType} with plexKey: ${item.plexKey}`);
        
        // Fetch full episode/movie data from Plex using the plexKey
        const response = await fetch(`${config.apiBaseUrl}/api/plex-media/${item.plexKey}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch Plex data: ${response.status}`);
        }
        
        const plexData = await response.json();
        console.log('🏠 Received Plex data:', plexData);
        
        // Transform the Plex data to the format expected by the home page
        const selectedMediaData = {
          ...plexData,
          // Override with custom order specific data
          orderType: 'CUSTOM_ORDER',
          customOrderId: viewingOrderItems?.id,
          customOrderName: viewingOrderItems?.name,
          customOrderItemId: item.id,
          isWatched: item.isWatched,
          dateWatched: item.dateWatched,
          totalWatchTime: item.totalWatchTime,
          
          // Ensure we have the correct type
          type: item.mediaType === 'episode' ? 'episode' : item.mediaType,
          
          // For episodes, ensure we have season/episode data
          ...(item.mediaType === 'episode' && {
            currentSeason: plexData.season || item.seasonNumber,
            currentEpisode: plexData.episode || item.episodeNumber,
            nextEpisodeTitle: plexData.title || item.title,
            episodeRatingKey: item.plexKey
          })
        };
        
        console.log('🏠 Final transformed data:', selectedMediaData);
        
        // Store in localStorage
        localStorage.setItem('masterOrder_selectedMedia', JSON.stringify(selectedMediaData));
        
        console.log('🏠 Navigate to Home - Plex data saved to localStorage');
        
        // Navigate to home page
        window.location.href = '/';
        
      } catch (error) {
        console.error('🏠 Error fetching Plex data:', error);
        
        // Fallback to basic data if Plex fetch fails
        const fallbackData = {
          id: item.id,
          type: item.mediaType === 'episode' ? 'episode' : item.mediaType,
          title: item.title,
          ...(item.mediaType === 'episode' && {
            seriesTitle: item.seriesTitle,
            season: item.seasonNumber,
            episode: item.episodeNumber,
            currentSeason: item.seasonNumber,
            currentEpisode: item.episodeNumber,
            nextEpisodeTitle: item.title,
          }),
          ...(item.mediaType === 'movie' && {
            year: item.movieYear,
          }),
          orderType: 'CUSTOM_ORDER',
          customOrderId: viewingOrderItems?.id,
          customOrderName: viewingOrderItems?.name,
          plexKey: item.plexKey
        };
        
        localStorage.setItem('masterOrder_selectedMedia', JSON.stringify(fallbackData));
        window.location.href = '/';
      }
      return;
    }
    
    // For non-Plex items (books, comics, short stories, web videos)
    const selectedMediaData = {
      id: item.id,
      type: item.mediaType,
      title: item.title,
      
      // Artwork and caching fields
      localArtworkPath: item.localArtworkPath,
      artworkLastCached: item.artworkLastCached,
      
      // Book fields
      ...(item.mediaType === 'book' && {
        author: item.bookAuthor,
        year: item.bookYear,
        isbn: item.isbn,
        pageCount: item.pageCount,
        bookCoverUrl: item.bookCoverUrl,
        bookOpenLibraryId: item.bookOpenLibraryId,
        bookDescription: item.bookDescription,
        containedStories: item.containedStories
      }),
      
      // Comic fields
      ...(item.mediaType === 'comic' && {
        comicSeries: item.comicSeries,
        comicIssue: item.comicIssue,
        comicYear: item.comicYear,
        comicPublisher: item.comicPublisher,
        customTitle: item.customTitle,
        comicIssueName: item.comicIssueName,
        comicDescription: item.comicDescription,
        comicCoverDate: item.comicCoverDate,
        comicStoreDate: item.comicStoreDate,
        comicCreators: parseComicCreators(item.comicCreators), // Parse JSON to array for OrderItemsView
        comicCharacters: parseComicCharacters(item.comicCharacters), // Parse JSON to array for OrderItemsView
        comicStoryArcs: item.comicStoryArcs,
        comicVineDetailsJson: item.comicVineDetailsJson,
        comicDetails: item.comicVineDetailsJson ? (() => {
          try {
            return JSON.parse(item.comicVineDetailsJson);
          } catch (e) {
            return null;
          }
        })() : null
      }),
      
      // Short story fields
      ...(item.mediaType === 'shortstory' && {
        storyTitle: item.storyTitle,
        storyAuthor: item.storyAuthor,
        storyYear: item.storyYear,
        storyUrl: item.storyUrl,
        storyCoverUrl: item.storyCoverUrl,
        containedInBookId: item.containedInBookId,
        containedInBookDetails: item.containedInBookDetails
      }),
      
      // Web video fields
      ...(item.mediaType === 'webvideo' && {
        webVideoUrl: item.webVideoUrl,
        webVideoDescription: item.webVideoDescription,
        webTitle: item.title
      }),
      
      // Common fields for all media types
      orderType: 'CUSTOM_ORDER',
      customOrderId: viewingOrderItems?.id,
      customOrderName: viewingOrderItems?.name,
      isWatched: item.isWatched,
      dateWatched: item.dateWatched,
      totalWatchTime: item.totalWatchTime,
      
      // Additional metadata that might be needed
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };

    console.log('🏠 Navigate to Home - Non-Plex item data:', selectedMediaData);
    
    // Store in localStorage so the home page can pick it up
    localStorage.setItem('masterOrder_selectedMedia', JSON.stringify(selectedMediaData));
    
    console.log('🏠 Navigate to Home - Data saved to localStorage');
    
    // Navigate to home page
    window.location.href = '/';
  };

  // Drag and Drop handlers
  const handleDragStart = (e, item, index) => {
    setDraggedItem({ item, index });
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem({ index });
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverItem(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.index === dropIndex) {
      setDraggedItem(null);
      setDragOverItem(null);
      setIsDragging(false);
      return;
    }    try {
      // Get filtered items (same filter as in render)
      const filteredItems = getFilteredItems(viewingOrderItems?.items || [], showWatchedItems);

      // Reorder the items array
      const newItems = [...filteredItems];
      const draggedItemData = newItems[draggedItem.index];
      
      // Remove dragged item and insert at new position
      newItems.splice(draggedItem.index, 1);
      newItems.splice(dropIndex, 0, draggedItemData);

      // Update sortOrder for all affected items
      const updatePromises = newItems.map((item, index) => {
        const newSortOrder = index + 1;
        return fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}/items/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sortOrder: newSortOrder
          }),
        });
      });

      await Promise.all(updatePromises);

      // Refresh the order data
      const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}`);
      const updatedOrderData = await updatedOrder.json();
      setViewingOrderItems(updatedOrderData);
      
      setMessage('Items reordered successfully');
    } catch (error) {
      console.error('Error reordering items:', error);
      setMessage('Error reordering items');
    }

    // Reset drag state
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragging(false);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragging(false);
  };

  const handleSearchMedia = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/search?query=${encodeURIComponent(query)}`);
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
  };  const handleAddMediaToOrder = async (orderId, mediaItem, skipUIUpdate = false) => {
    try {
      const requestBody = {
        mediaType: mediaItem.mediaType || mediaItem.type,
        title: (mediaItem.title && mediaItem.title !== 'undefined') ? mediaItem.title : ''
      };      // Add fields based on media type
      const mediaType = mediaItem.mediaType || mediaItem.type;      if (mediaType === 'comic') {
        requestBody.comicSeries = mediaItem.comicSeries;
        requestBody.comicYear = mediaItem.comicYear;
        requestBody.comicIssue = mediaItem.comicIssue;
        requestBody.comicPublisher = mediaItem.comicPublisher;
        requestBody.customTitle = mediaItem.customTitle;
        requestBody.comicVineId = mediaItem.comicVineId;
        requestBody.comicVineDetailsJson = mediaItem.comicVineDetailsJson;
      } else if (mediaType === 'book') {
        requestBody.bookTitle = mediaItem.bookTitle;
        requestBody.bookAuthor = mediaItem.bookAuthor;
        requestBody.bookYear = mediaItem.bookYear;
        requestBody.bookIsbn = mediaItem.bookIsbn;
        requestBody.bookPublisher = mediaItem.bookPublisher;
        requestBody.bookOpenLibraryId = mediaItem.bookOpenLibraryId;
        requestBody.bookCoverUrl = mediaItem.bookCoverUrl;
        requestBody.bookPageCount = mediaItem.bookPageCount;      } else if (mediaType === 'shortstory') {
        requestBody.storyTitle = mediaItem.storyTitle;
        requestBody.storyAuthor = mediaItem.storyAuthor;
        requestBody.storyYear = mediaItem.storyYear;
        requestBody.storyUrl = mediaItem.storyUrl;
        requestBody.storyContainedInBookId = mediaItem.storyContainedInBookId;
        requestBody.storyCoverUrl = mediaItem.storyCoverUrl;
      } else if (mediaType === 'webvideo' || mediaType === 'web') {
        // Normalize 'web' to 'webvideo'
        requestBody.mediaType = 'webvideo';
        requestBody.webTitle = mediaItem.webTitle;
        requestBody.webUrl = mediaItem.webUrl;
        requestBody.webDescription = mediaItem.webDescription;
      } else if (mediaType === 'game') {
        requestBody.gameTitle = mediaItem.gameTitle;
        requestBody.gameId = mediaItem.gameId;
        // Include artwork URL for games
        if (mediaItem.originalArtworkUrl) {
          requestBody.originalArtworkUrl = mediaItem.originalArtworkUrl;
        }
        // Include webvideo URL for games
        if (mediaItem.webvideoUrl) {
          requestBody.webUrl = mediaItem.webvideoUrl;
        }
      } else if (mediaType === 'episode') {
        // Handle episodes (both Plex and non-Plex)
        if (mediaItem.ratingKey) {
          // Plex episode
          requestBody.plexKey = mediaItem.ratingKey;
          requestBody.seasonNumber = mediaItem.parentIndex;
          requestBody.episodeNumber = mediaItem.index;
          requestBody.seriesTitle = mediaItem.grandparentTitle;
        } else {
          // Non-Plex episode (like from CMRO import)
          requestBody.seriesTitle = mediaItem.seriesTitle;
          requestBody.seasonNumber = mediaItem.seasonNumber;
          requestBody.episodeNumber = mediaItem.episodeNumber;
        }
      } else {
        requestBody.plexKey = mediaItem.ratingKey;
        requestBody.seasonNumber = mediaItem.parentIndex;
        requestBody.episodeNumber = mediaItem.index;
        requestBody.seriesTitle = mediaItem.grandparentTitle;
      }

      // Debug the final request body before sending
      console.log(`🔍 Final requestBody being sent for ${mediaItem.mediaType}:`, JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });      if (response.ok) {
        // Only update UI if not skipping updates (for individual adds, not bulk imports)
        if (!skipUIUpdate) {
          setMessage('Media added to custom order successfully');
          fetchCustomOrders(); // Refresh the list
          
          // Update the viewing order if it's currently being viewed
          if (viewingOrderItems && viewingOrderItems.id === orderId) {
            const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${orderId}`);
            const updatedOrderData = await updatedOrder.json();
            setViewingOrderItems(updatedOrderData);
          }
        }
        return true;
      } else {
        const errorData = await response.json();
        if (!skipUIUpdate) {
          if (response.status === 409) {
            setMessage(`Duplicate item: "${errorData.existingItem.title}" is already in this custom order`);
          } else {
            setMessage(`Error: ${errorData.error}`);
          }
        }
        return false;
      }
    } catch (error) {
      console.error('Error adding media to custom order:', error);
      if (!skipUIUpdate) {
        setMessage('Error adding media to custom order');
      }
      return false;
    }
  };const handleSearchTVEpisode = async (e) => {
    e.preventDefault();
    
    // Validate all required fields are filled
    if (!episodeFormData.series.trim() || !episodeFormData.season || !episodeFormData.episode) {
      setMessage('Please fill in all episode fields');
      return;
    }

    setEpisodeSearchLoading(true);
    try {
      // If we're editing an item, update it directly without searching
      if (editingItem) {
        const updatedItemData = {
          series: episodeFormData.series.trim(),
          season: parseInt(episodeFormData.season),
          episode: parseInt(episodeFormData.episode)
        };
        await handleUpdateItem(updatedItemData);
        return;
      }

      // Search Plex TV library for episodes matching the series name
      const searchQuery = `${episodeFormData.series.trim()}`;
      const response = await fetch(`${config.apiBaseUrl}/api/search?query=${encodeURIComponent(searchQuery)}&type=tv`);
      
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
        });

        if (targetEpisode) {
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

  const handleSearchMovies = async (e) => {
    e.preventDefault();
    
    // Validate required fields are filled
    if (!movieFormData.title.trim()) {
      setMessage('Please enter a movie title');
      return;
    }

    setMovieSearchLoading(true);
    try {
      // If we're editing an item, update it directly without searching
      if (editingItem) {
        const updatedItemData = {
          title: movieFormData.title.trim(),
          year: movieFormData.year ? parseInt(movieFormData.year) : null
        };
        await handleUpdateItem(updatedItemData);
        return;
      }

      // Search Plex movie library
      let searchUrl = `${config.apiBaseUrl}/api/search?query=${encodeURIComponent(movieFormData.title.trim())}`;
      
      // Add year parameter if provided
      if (movieFormData.year && movieFormData.year.trim()) {
        searchUrl += `&year=${movieFormData.year.trim()}`;
      }
      
      const response = await fetch(searchUrl);
      
      if (response.ok) {
        const results = await response.json();
        
        // Filter for movies and find the best match
        const movieCandidates = results.filter(item => 
          item.type === 'movie' &&
          (item.title.toLowerCase().includes(movieFormData.title.toLowerCase()) ||
           movieFormData.title.toLowerCase().includes(item.title.toLowerCase()))
        );
        
        if (movieCandidates.length > 0) {
          setMovieSearchResults(movieCandidates);
          
          // If only one result or exact year match, can auto-select
          if (movieCandidates.length === 1) {
            const success = await handleAddMediaToOrder(viewingOrderItems.id, movieCandidates[0]);
            if (success !== false) {
              setShowMovieForm(false);
              setMovieFormData({ title: '', year: '' });
              setMovieSearchResults([]);
            }
          } else {
            // Multiple results found, let user choose
            setMessage(`Found ${movieCandidates.length} movies matching "${movieFormData.title}". Please select one below.`);
          }
        } else {
          setMessage(`Movie not found: "${movieFormData.title}". Please check the title and try again.`);
          setMovieSearchResults([]);
        }
      } else {
        setMessage('Error searching for movie');
        setMovieSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching for movie:', error);
      setMessage('Error searching for movie');
      setMovieSearchResults([]);
    } finally {
      setMovieSearchLoading(false);
    }
  };

  const handleSelectMovie = async (selectedMovie) => {
    try {
      const success = await handleAddMediaToOrder(viewingOrderItems.id, selectedMovie);
      if (success !== false) {
        setShowMovieForm(false);
        setMovieFormData({ title: '', year: '' });
        setMovieSearchResults([]);
      }
    } catch (error) {
      console.error('Error selecting movie:', error);
      setMessage('Error adding movie to order');
    }
  };

  // Helper function to batch ComicVine searches for optimization
  const batchComicVineSearch = async (comics) => {
    try {
      console.log(`🚀 Batching ComicVine search for ${comics.length} comics`);
      
      const response = await fetch(`${config.apiBaseUrl}/api/comicvine/bulk-search-with-issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comics }),
      });

      if (!response.ok) {
        throw new Error(`Bulk ComicVine search failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Bulk ComicVine search completed:`, result.summary);
      
      // Return a map for easy lookup
      const resultMap = new Map();
      result.results.forEach((item, index) => {
        if (item.success && item.results.length > 0) {
          // Use the best match (first result)
          resultMap.set(index, item.results[0]);
        }
      });
      
      return resultMap;
    } catch (error) {
      console.error('Error in bulk ComicVine search:', error);
      return new Map(); // Return empty map on error
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
        
        const columns = line.split('\t');        // Validate required columns (support 4-6 column formats for web videos)
        if (columns.length < 4) {
          errors.push(`Line ${i + 1}: Not enough columns (need 4-6: Series/Movie, Season/Episode, Title, Type, [Year], [URL for web videos])`);
          continue;
        }
        
        const [seriesOrMovie, seasonEpisode, title, rawMediaType, yearColumn, urlColumn] = columns.map(col => col.trim());
          if (!seriesOrMovie || !title || !rawMediaType) {
          errors.push(`Line ${i + 1}: Missing required data (Series/Movie, Title, or Type)`);
          continue;
        }        // Normalize media types
        let mediaType = rawMediaType.toLowerCase();
        if (mediaType === 'tv series') {
          mediaType = 'episode';
        } else if (mediaType === 'short story') {
          mediaType = 'shortstory';
        } else if (mediaType === 'film') {
          mediaType = 'movie';
        } else if (mediaType === 'web') {
          mediaType = 'webvideo';
        } else if (mediaType === 'video game') {
          mediaType = 'game';
        }
        
        // Initialize comic-specific fields
        let comicSeries = null;
        let comicYear = null;
        let comicIssue = null;
          // Initialize book-specific fields
        let bookAuthor = null;
        let bookYear = null;
        
        // Parse year from the optional 5th column
        let mediaYear = null;
        if (yearColumn && yearColumn.trim()) {
          const parsedYear = parseInt(yearColumn.trim());
          if (!isNaN(parsedYear) && parsedYear > 1800 && parsedYear <= new Date().getFullYear() + 10) {
            mediaYear = parsedYear;
          }
        }
        
        // Parse season and episode for TV episodes, comic details for comics, or book details for books
        let seasonNumber = null;
        let episodeNumber = null;
        
        if (mediaType === 'episode' && seasonEpisode) {
          // Try to parse various formats: "S1E1", "S01E01", "1x1", "1,1", or "1-1"
          const seasonEpMatch = seasonEpisode.match(/(?:S?(\d+)(?:[xXeE]|,|\s)+(\d+))|(?:(\d+)\s*[\-\/]\s*(\d+))/i);
          if (seasonEpMatch) {
            seasonNumber = parseInt(seasonEpMatch[1] || seasonEpMatch[3]);
            episodeNumber = parseInt(seasonEpMatch[2] || seasonEpMatch[4]);
          } else {
            errors.push(`Line ${i + 1}: Invalid season/episode format. Use S1E1, S01E01, 1x1, 1,1, or 1-1`);
            continue;
          }
        } else if (mediaType === 'comic') {
          // Check if using new format: separate columns for series, issue, and title
          if (seasonEpisode && seasonEpisode.toLowerCase().includes('issue')) {
            // New format: Column 1 = Series, Column 2 = Issue, Column 3 = Title
            comicSeries = seriesOrMovie;
            
            // Clean the series name according to new rules:
            // - If parentheses contain a 4-digit year, keep it
            // - If parentheses contain anything else (like "Vol. 1"), remove the entire parentheses portion
            const parenthesesMatch = comicSeries.match(/^(.+?)\s*\((.+?)\)(.*)$/);
            if (parenthesesMatch) {
              const beforeParens = parenthesesMatch[1].trim();
              const parenthesesContent = parenthesesMatch[2].trim();
              const afterParens = parenthesesMatch[3].trim();
              
              // Check if parentheses content is a 4-digit year
              const yearMatch = parenthesesContent.match(/^\d{4}$/);
              if (yearMatch) {
                // Keep the year
                comicYear = parseInt(parenthesesContent);
                comicSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
              } else {
                // Remove the entire parentheses portion
                comicSeries = beforeParens + (afterParens ? ' ' + afterParens : '');
                comicYear = null;
              }
            } else {
              comicYear = null;
            }
            
            // Parse issue number from seasonEpisode column (e.g., "Issue #07", "#07", "07")
            const issueMatch = seasonEpisode.match(/(?:issue\s*)?#?(\d+)/i);
            if (issueMatch) {
              comicIssue = parseInt(issueMatch[1]);
            } else {
              errors.push(`Line ${i + 1}: Invalid issue format. Use "Issue #07", "#07", or "07" format`);
              continue;
            }
          } else {
            // Legacy format: Parse comic format from first column: "Series Name (Year) #Issue" or "Series Name #Issue"
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
                errors.push(`Line ${i + 1}: Invalid comic format. Use new format: "Series Name\\tIssue #07\\tComic Title\\tComic" or legacy format: "Series Name (Year) #Issue\\t\\tTitle\\tComic"`);
                continue;
              }
            }
          }} else if (mediaType === 'book') {
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
        } else if (mediaType === 'shortstory') {
          // Parse short story format: "Author Name (Year)" in the season/episode field, or just "Author Name"
          if (seasonEpisode) {
            const bookMatch = seasonEpisode.match(/^(.+?)\s*(?:\((\d{4})\))?$/);
            if (bookMatch) {
              bookAuthor = bookMatch[1].trim();
              if (bookMatch[2]) {
                bookYear = parseInt(bookMatch[2]);
              }
            } else {
              bookAuthor = seasonEpisode.trim();
            }          }
          // If no season/episode field, we'll try to extract author from the title later
        } else if (mediaType === 'web') {
          // For web videos, the URL should be in the 6th column
          if (!urlColumn || !urlColumn.trim()) {
            errors.push(`Line ${i + 1}: Web videos require a URL in the 6th column`);
            continue;
          }
          // Validate URL format
          if (!urlColumn.match(/^https?:\/\/.+/)) {
            errors.push(`Line ${i + 1}: Invalid URL format for web video. URLs must start with http:// or https://`);
            continue;
          }
        }          items.push({
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
          lineNumber: i + 1,
          year: mediaYear, // Add the optional year from the 5th column
          url: urlColumn // Add the optional URL from the 6th column for web videos
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
      const failedItems = [];        for (const item of items) {
        try {
          let targetMedia = null;          if (item.mediaType === 'comic') {
            // For comics with new format, search ComicVine to find the correct issue
            console.log(`Searching for comic: ${item.comicSeries} #${item.comicIssue} - ${item.title}`);
              try {              // Normalize title characters to handle smart quotes and other encoding issues
                const normalizeTitle = (title) => {
                  return title
                    .replace(/’/g, "'") // Convert right smart apostrophe (U+2019) to regular apostrophe (U+0027)
                    .replace(/‘/g, "'") // Convert left smart apostrophe (U+2018) to regular apostrophe (U+0027)
                    .replace(/”/g, '"') // Convert right smart quote (U+201D) to regular quote (U+0022)
                    .replace(/“/g, '"') // Convert left smart quote (U+201C) to regular quote (U+0022)
                    .replace(/[，﹐﹑]/g, ',') // Convert full-width, small, and ideographic commas to standard comma
                    .replace(/–/g, '-') // Convert en-dash (U+2013) to regular dash
                    .replace(/—/g, '-'); // Convert em-dash (U+2014) to regular dash
                };
              
              const normalizedTitle = normalizeTitle(item.title);
              console.log(`Original title: "${item.title}"`);
              console.log(`Normalized title: "${normalizedTitle}"`);
              
              // Search using only the cleaned series name (don't include issue title in the series search)
              // This is more accurate since ComicVine series search should only use the series name
              console.log(`Series search query: "${item.comicSeries}" for issue #${item.comicIssue}`);
                // Use the ComicVine search with issue filtering to find the correct series
              const response = await fetch(`${config.apiBaseUrl}/api/comicvine/search-with-issues?query=${encodeURIComponent(item.comicSeries)}&issueNumber=${encodeURIComponent(item.comicIssue)}&issueTitle=${encodeURIComponent(normalizedTitle)}`);
              
              // Add 10 second pause between ComicVine searches to avoid rate limiting
              console.log('⏳ Pausing 10 seconds to avoid ComicVine rate limiting...');
              await new Promise(resolve => setTimeout(resolve, 10000));
              
              if (response.ok) {
                const searchResults = await response.json();
                console.log(`Found ${searchResults.length} comic series with issue #${item.comicIssue}`);
                console.log('Raw ComicVine search results:', JSON.stringify(searchResults, null, 2));
                  // Find the best match based on issue title or just use the first result if title search fails
                let selectedSeries = null;
                if (searchResults.length > 0) {
                  // Backend now handles title matching and sorting, so first result is the best match
                  selectedSeries = searchResults[0];
                  console.log(`✓ Using backend-sorted best match: "${selectedSeries.series.name}" with issue title: "${selectedSeries.issueName}"`);
                    // Create enhanced comic data with ComicVine information
                  targetMedia = {
                    title: normalizedTitle,
                    type: 'comic',
                    comicSeries: selectedSeries.series.name, // Use ComicVine series name
                    comicYear: item.comicYear || selectedSeries.series.start_year,
                    comicIssue: item.comicIssue,
                    comicPublisher: selectedSeries.series.publisher?.name || null,
                    comicVineId: selectedSeries.series.api_detail_url,
                    // Store comprehensive ComicVine data if available
                    comicVineDetailsJson: JSON.stringify(selectedSeries.comprehensiveData || selectedSeries)
                  };
                  
                  console.log(`✓ Enhanced comic data with ComicVine info: ${selectedSeries.series.name} (${targetMedia.comicYear}) #${item.comicIssue}`);
                  console.log(`🔍 Complete targetMedia object:`, JSON.stringify(targetMedia, null, 2));                } else {
                  console.log(`No ComicVine results found, using original data`);
                  // Fallback to original data if no ComicVine results
                  targetMedia = {
                    title: normalizedTitle,
                    type: 'comic',
                    comicSeries: item.comicSeries,
                    comicYear: item.comicYear,
                    comicIssue: item.comicIssue
                  };
                }
              } else {
                console.log(`ComicVine search failed, using original data`);
                // Fallback to original data if search fails
                targetMedia = {
                  title: normalizedTitle,
                  type: 'comic',
                  comicSeries: item.comicSeries,
                  comicYear: item.comicYear,
                  comicIssue: item.comicIssue
                };
              }
            } catch (searchError) {
              console.log(`ComicVine search error: ${searchError.message}, using original data`);
              // Fallback to original data if search encounters an error
              targetMedia = {
                title: item.title,
                type: 'comic',
                comicSeries: item.comicSeries,
                comicYear: item.comicYear,
                comicIssue: item.comicIssue
              };
            }
          } else if (item.mediaType === 'book') {
            // For books, search OpenLibrary with custom order name prepended, then fallback without it
            try {
              let searchQuery, results = null;
              
              // First try with custom order name prepended if we have an order name
              if (viewingOrderItems && viewingOrderItems.name) {
                searchQuery = `${viewingOrderItems.name} ${item.title}`;
                if (item.bookAuthor) {
                  searchQuery += ` author:"${item.bookAuthor}"`;
                }
                if (item.bookYear) {
                  searchQuery += ` first_publish_year:${item.bookYear}`;
                }
                
                console.log(`Searching OpenLibrary with order name: "${searchQuery}"`);
                let response = await fetch(`${config.apiBaseUrl}/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}&limit=10`);
                
                if (response.ok) {
                  results = await response.json();
                }
              }
              
              // If no results found with custom order name, try without it
              if (!results || results.length === 0) {
                if (viewingOrderItems && viewingOrderItems.name) {
                  console.log('No results with order name, trying without order name...');
                }
                
                searchQuery = item.title;
                if (item.bookAuthor) {
                  searchQuery += ` author:"${item.bookAuthor}"`;
                }
                if (item.bookYear) {
                  searchQuery += ` first_publish_year:${item.bookYear}`;
                }
                
                console.log(`Fallback search: "${searchQuery}"`);
                const response = await fetch(`${config.apiBaseUrl}/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}&limit=10`);
                
                if (response.ok) {
                  results = await response.json();
                }
              }
              
              if (results && results.length > 0) {
                // Prioritize books with cover images
                let book = results.find(result => result.coverUrl && result.coverUrl.trim() !== '');
                
                // If no book with cover found, use the first result
                if (!book) {
                  book = results[0];
                  console.log(`No books with covers found, using first result: "${book.title}"`);
                } else {
                  console.log(`Selected book with cover: "${book.title}" by ${book.authors?.[0] || 'Unknown'}`);
                }
                
                console.log(`Found book: "${book.title}" by ${book.authors?.[0] || 'Unknown'}${book.coverUrl ? ' (with cover)' : ' (no cover)'}`);
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
                console.log('No OpenLibrary results found, creating basic book entry');
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

          } else if (item.mediaType === 'shortstory') {
            // For short stories, create the media object directly since we have all the info
            targetMedia = {
              title: item.title,
              type: 'shortstory',
              storyTitle: item.title,
              storyAuthor: item.bookAuthor,
              storyYear: item.bookYear,
              storyUrl: item.url || null,
              storyContainedInBookId: null,
              storyCoverUrl: null
            };} else if (item.mediaType === 'webvideo') {
            // For web videos, create the media object directly with the provided URL
            targetMedia = {
              title: item.title,
              type: 'webvideo',
              webTitle: item.title,
              webUrl: item.url,
              webDescription: null
            };
          } else if (item.mediaType === 'game') {
            // For video games, search RAWG API to find and import the game
            console.log(`Searching RAWG for game: ${item.title}`);
            
            try {
              const rawgResponse = await fetch(`${config.apiBaseUrl}/api/rawg/search?query=${encodeURIComponent(item.title)}`);
              
              if (rawgResponse.ok) {
                const rawgResponseData = await rawgResponse.json();
                const rawgResults = rawgResponseData.data || [];
                console.log(`Found ${rawgResults.length} RAWG results for "${item.title}"`);
                
                if (rawgResults.length > 0) {
                  // Use the first (best) match from RAWG
                  const selectedGame = rawgResults[0];
                  console.log(`✓ Using RAWG match: "${selectedGame.name}" (ID: ${selectedGame.id})`);
                  
                  // Import the game from RAWG to get full metadata
                  const importResponse = await fetch(`${config.apiBaseUrl}/api/rawg/import/${selectedGame.id}`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      webvideoUrl: item.url || null // Include webvideo URL if provided
                    })
                  });
                  
                  if (importResponse.ok) {
                    const importResponseData = await importResponse.json();
                    const importedGame = importResponseData.data;
                    console.log(`✓ Game imported from RAWG with full metadata`);
                    
                    // Create targetMedia using the imported game data
                    targetMedia = {
                      title: importedGame.title,
                      type: 'game',
                      gameTitle: importedGame.title,
                      gameId: importedGame.id,
                      webvideoUrl: item.url || null,
                      originalArtworkUrl: importedGame.coverUrl || importedGame.originalArtworkUrl || null
                    };
                  } else {
                    console.log(`Failed to import game from RAWG, using basic data`);
                    // Fallback to basic game data if import fails
                    targetMedia = {
                      title: item.title,
                      type: 'game',
                      gameTitle: item.title,
                      gameId: null,
                      webvideoUrl: item.url || null
                    };
                  }
                } else {
                  console.log(`No RAWG results found for "${item.title}", using basic data`);
                  // No RAWG results found, use basic game data
                  targetMedia = {
                    title: item.title,
                    type: 'game',
                    gameTitle: item.title,
                    gameId: null,
                    webvideoUrl: item.url || null
                  };
                }
              } else {
                console.log(`RAWG search failed, using basic data`);
                // RAWG search failed, use basic game data
                targetMedia = {
                  title: item.title,
                  type: 'game',
                  gameTitle: item.title,
                  gameId: null,
                  webvideoUrl: item.url || null
                };
              }
              
              // Add delay to avoid overwhelming RAWG API
              console.log('⏳ Pausing 2 seconds to avoid RAWG rate limiting...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              
            } catch (error) {
              console.error('Error searching RAWG:', error);
              // Fallback to basic game data on error
              targetMedia = {
                title: item.title,
                type: 'game',
                gameTitle: item.title,
                gameId: null,
                webvideoUrl: item.url || null
              };
            }
          } else {
            // For movies and TV episodes, search Plex
            let searchQuery = item.seriesOrMovie;
            let searchUrl = `${config.apiBaseUrl}/api/search?query=${encodeURIComponent(searchQuery)}`;
            
            // Add year parameter if available
            if (item.year) {
              searchUrl += `&year=${item.year}`;
            }
            
            // For TV episodes, use the TV-specific search to get all episodes
            if (item.mediaType === 'episode') {
              searchUrl += '&type=tv';
            }
            
            const response = await fetch(searchUrl);
            
            if (response.ok) {
              const results = await response.json();
                if (item.mediaType === 'episode') {
                // Helper function to calculate series name matching score
                const calculateSeriesMatchScore = (searchTitle, resultTitle) => {
                  if (!searchTitle || !resultTitle) return 0;
                  
                  const originalSearchLower = searchTitle.toLowerCase().trim();
                  const originalResultLower = resultTitle.toLowerCase().trim();
                  
                  // Exact match without any normalization (highest priority)
                  if (originalSearchLower === originalResultLower) {
                    return 1.0;
                  }
                  
                  // Normalize titles by removing common variations
                  const normalize = (title) => {
                    return title.toLowerCase()
                      .replace(/\s*\((\d{4})\)\s*/g, ' ') // Remove years like (2005)
                      .replace(/\s*\(uk\)\s*/gi, ' ') // Remove (UK)
                      .replace(/\s*\(us\)\s*/gi, ' ') // Remove (US)
                      .replace(/\s*\(american\)\s*/gi, ' ') // Remove (American)
                      .replace(/\s*\(british\)\s*/gi, ' ') // Remove (British)
                      .replace(/\s*\(original\)\s*/gi, ' ') // Remove (Original)
                      .replace(/\s*\(reboot\)\s*/gi, ' ') // Remove (Reboot)
                      .replace(/\s*\(remake\)\s*/gi, ' ') // Remove (Remake)
                      .replace(/\s+/g, ' ') // Normalize spaces
                      .trim();
                  };
                  
                  const normalizedSearch = normalize(searchTitle);
                  const normalizedResult = normalize(resultTitle);
                  
                  // Exact match after normalization (second highest priority)
                  if (normalizedSearch === normalizedResult) {
                    // Give a slight penalty based on how much normalization was needed
                    const originalLength = originalResultLower.length;
                    const normalizedLength = normalizedResult.length;
                    const normalizationPenalty = (originalLength - normalizedLength) / originalLength * 0.1;
                    return 0.95 - normalizationPenalty; // Score between 0.85-0.95
                  }
                  
                  // Partial match where normalized search is contained in normalized result
                  if (normalizedResult.includes(normalizedSearch)) {
                    // Score higher for shorter result titles (prefer "Doctor Who" over "Doctor Who (2005)")
                    const lengthPenalty = (originalResultLower.length - originalSearchLower.length) / Math.max(originalResultLower.length, 1);
                    return 0.8 - (lengthPenalty * 0.2); // Score between 0.6-0.8
                  }
                  
                  // Partial match where normalized result is contained in normalized search
                  if (normalizedSearch.includes(normalizedResult)) {
                    return 0.6;
                  }
                  
                  // Bidirectional partial match (fallback)
                  if (originalResultLower.includes(originalSearchLower) || originalSearchLower.includes(originalResultLower)) {
                    const lengthPenalty = Math.abs(originalResultLower.length - originalSearchLower.length) / Math.max(originalResultLower.length, originalSearchLower.length);
                    return 0.4 - (lengthPenalty * 0.2); // Score between 0.2-0.4
                  }
                  
                  return 0;
                };
                
                // Find all matching episodes for the season/episode combination
                const episodeCandidates = results.filter(result => 
                  result.type === 'episode' &&
                  result.parentIndex === item.seasonNumber &&
                  result.index === item.episodeNumber &&
                  (!item.year || !result.year || result.year === item.year)
                );
                
                // Score each candidate and pick the best match
                if (episodeCandidates.length > 0) {
                  const scoredCandidates = episodeCandidates.map(candidate => ({
                    ...candidate,
                    matchScore: calculateSeriesMatchScore(item.seriesOrMovie, candidate.grandparentTitle)
                  })).filter(candidate => candidate.matchScore > 0);
                  
                  // Sort by match score (descending) and pick the best
                  scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);
                  
                  if (scoredCandidates.length > 0) {
                    const bestMatch = scoredCandidates[0];
                    console.log(`TV Series matching: "${item.seriesOrMovie}" -> "${bestMatch.grandparentTitle}" (score: ${bestMatch.matchScore.toFixed(3)})`);
                    console.log(`Preserving imported title "${item.title}" instead of Plex title "${bestMatch.title}"`);
                    
                    // Use Plex metadata but preserve the imported title
                    targetMedia = {
                      ...bestMatch,
                      title: item.title  // Override with imported title
                    };
                  }
                } else {
                  // Fallback: look for any episode that matches the series name
                  const allEpisodes = results.filter(result => result.type === 'episode');
                  const scoredEpisodes = allEpisodes.map(episode => ({
                    ...episode,
                    matchScore: calculateSeriesMatchScore(item.seriesOrMovie, episode.grandparentTitle)
                  })).filter(episode => episode.matchScore > 0);
                  
                  scoredEpisodes.sort((a, b) => b.matchScore - a.matchScore);
                  
                  if (scoredEpisodes.length > 0) {
                    console.log(`TV Series fallback match: "${item.seriesOrMovie}" -> "${scoredEpisodes[0].grandparentTitle}" (score: ${scoredEpisodes[0].matchScore.toFixed(3)})`);
                    console.log(`Note: Specific S${item.seasonNumber}E${item.episodeNumber} not found, but series exists`);
                  }
                }
              } else if (item.mediaType === 'movie') {
                // Find movie by title and optionally by year
                let movieCandidates = results.filter(result => 
                  result.type === 'movie' &&
                  (result.title.toLowerCase().includes(item.title.toLowerCase()) ||
                   item.title.toLowerCase().includes(result.title.toLowerCase()))
                );
                
                // If year is specified, prefer movies with matching year
                if (item.year && movieCandidates.length > 1) {
                  const exactYearMatch = movieCandidates.find(movie => movie.year === item.year);
                  if (exactYearMatch) {
                    console.log(`Preserving imported movie title "${item.title}" instead of Plex title "${exactYearMatch.title}"`);
                    targetMedia = {
                      ...exactYearMatch,
                      title: item.title  // Override with imported title
                    };
                  } else {
                    // If no exact year match, use the first candidate but preserve title
                    console.log(`Preserving imported movie title "${item.title}" instead of Plex title "${movieCandidates[0].title}"`);
                    targetMedia = {
                      ...movieCandidates[0],
                      title: item.title  // Override with imported title
                    };
                  }
                } else if (movieCandidates.length > 0) {
                  console.log(`Preserving imported movie title "${item.title}" instead of Plex title "${movieCandidates[0].title}"`);
                  targetMedia = {
                    ...movieCandidates[0],
                    title: item.title  // Override with imported title
                  };
                }
              }
            }
          }          if (targetMedia) {
            // Add to custom order with UI updates skipped during bulk import
            const success = await handleAddMediaToOrder(viewingOrderItems.id, targetMedia, true);
            if (success) {
              successCount++;
            } else {
              failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (duplicate or error)`);
              failCount++;
            }
          } else if (item.mediaType === 'movie' || item.mediaType === 'episode') {
            // For movies and episodes not found in Plex, create a minimal media object
            // and let the server handle adding items that don't exist in Plex yet
            const notInPlexMedia = {
              title: item.title,
              type: item.mediaType,
              mediaType: item.mediaType
            };
            
            // Add episode-specific fields
            if (item.mediaType === 'episode') {
              notInPlexMedia.seriesTitle = item.seriesOrMovie;
              notInPlexMedia.seasonNumber = item.seasonNumber;
              notInPlexMedia.episodeNumber = item.episodeNumber;
            }
            
            // Add year if available (for movies)
            if (item.year) {
              notInPlexMedia.bookYear = item.year; // Using bookYear as the year field
            }
            
            const success = await handleAddMediaToOrder(viewingOrderItems.id, notInPlexMedia, true);
            if (success) {
              successCount++;
            } else {
              failedItems.push(`Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (duplicate or error)`);
              failCount++;
            }
          } else {
            const notFoundMessage = item.mediaType === 'book' 
              ? `Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (could not process book)`
              : `Line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title} (unknown media type)`;
            failedItems.push(notFoundMessage);
            failCount++;
          }
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error processing item on line ${item.lineNumber}:`, error);
          
          // Stop import on error and show error modal
          setErrorDetails({
            title: 'Bulk Import Error',
            message: `Error processing item on line ${item.lineNumber}: ${item.seriesOrMovie} - ${item.title}`,
            error: error.message || 'Unknown error occurred'
          });
          setShowErrorModal(true);
          setBulkImportLoading(false);
          return;
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
          const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}`);
          const updatedOrderData = await updatedOrder.json();
          setViewingOrderItems(updatedOrderData);
        }
      }
      
    } catch (error) {
      console.error('Error during bulk import:', error);
      
      // Show error modal for unexpected errors
      setErrorDetails({
        title: 'Bulk Import System Error',
        message: 'An unexpected error occurred during the bulk import process.',
        error: error.message || 'Unknown system error'
      });
      setShowErrorModal(true);
    } finally {
      setBulkImportLoading(false);
    }
  };

  const handleCmroBulkImport = async (e) => {
    e.preventDefault();
    
    if (!cmroBulkImportData.trim()) {
      setMessage('Please enter CMRO data to import');
      return;
    }

    setCmroBulkImportLoading(true);
    
    try {
      // Parse CMRO format data
      const entries = [];
      const lines = cmroBulkImportData.trim().split('\n');
      
      let currentEntry = null;
      let isProcessing = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) continue;
        
        // Check for new CMRO format: "1,89301/1974 Fantastic Four (1961) #142-Fantastic Four (1961) #142"
        // Pattern where series info and full title are typically identical
        const newCmroPattern = /^([\d,]+)\/(\d{4})\s+(.+)$/;
        const newCmroMatch = line.match(newCmroPattern);
        if (newCmroMatch) {
          // Parse the entry number (remove commas and convert to integer)
          const entryNumberString = newCmroMatch[1].replace(/,/g, '');
          const entryNumber = parseInt(entryNumberString);
          const entryYear = parseInt(newCmroMatch[2]);
          const remainder = newCmroMatch[3];
          
          // Find the middle dash by looking for identical parts
          let firstPart, secondPart;
          const dashIndex = remainder.indexOf('-');
          if (dashIndex !== -1) {
            // Try splitting at various dash positions to find identical parts
            for (let i = dashIndex; i < remainder.length; i++) {
              if (remainder[i] === '-') {
                const potential1 = remainder.substring(0, i).trim();
                const potential2 = remainder.substring(i + 1).trim();
                
                if (potential1 === potential2) {
                  firstPart = potential1;
                  secondPart = potential2;
                  break;
                }
              }
            }
            
            // If no identical parts found, use the first dash
            if (!firstPart) {
              firstPart = remainder.substring(0, dashIndex).trim();
              secondPart = remainder.substring(dashIndex + 1).trim();
            }
          } else {
            // No dash found, use the whole remainder
            firstPart = remainder.trim();
            secondPart = remainder.trim();
          }
          
          // For the series info, use the first part
          const seriesInfo = firstPart;
          const fullTitle = `${firstPart}-${secondPart}`;
          
          // Parse series info: "Tales to Astonish (1958) #29 [A Story]"
          const seriesMatch = seriesInfo.match(/^(.+?)\s*\((\d{4})\)\s*#(\d+).*$/);
          if (seriesMatch) {
            const seriesName = seriesMatch[1].trim();
            const seriesYear = parseInt(seriesMatch[2]);
            const issueNumber = seriesMatch[3];
            const issueTitle = seriesInfo; // Use the full series info as the issue title
            
            // Create entry for new CMRO format
            const entry = {
              number: entryNumber,
              title: issueTitle,
              source: null,
              year: entryYear,
              seriesName: seriesName,
              seriesYear: seriesYear,
              issueNumber: issueNumber,
              issueTitle: issueTitle,
              writer: null,
              director: null,
              productionNumber: null,
              releasedDate: null,
              pages: null,
              publisher: null,
              publishedDate: null,
              synopsis: null
            };
            
            entries.push(entry);
            console.log(`Parsed new CMRO format: ${entry.title} (${seriesName} #${issueNumber})`);
            continue;
          }
        }
        
        // Look for original entry number pattern (e.g., "41: Shield of the Jedi")
        const entryMatch = line.match(/^(\d+):\s*(.+)$/);
        if (entryMatch) {
          // Save previous entry if exists
          if (currentEntry) {
            entries.push(currentEntry);
          }
          
          // Start new entry
          currentEntry = {
            number: parseInt(entryMatch[1]),
            title: entryMatch[2].trim(),
            source: null,
            year: null,
            writer: null,
            director: null,
            productionNumber: null,
            releasedDate: null,
            pages: null,
            publisher: null,
            publishedDate: null,
            synopsis: null
          };
          isProcessing = true;
          continue;
        }
        
        if (isProcessing && currentEntry) {
          // Look for TV series with episode info (e.g., "Buffy the Vampire Slayer (S4E01)")
          const episodeMatch = line.match(/^(.+?)\s*\(S(\d+)E(\d+)\)$/);
          if (episodeMatch && !currentEntry.source) {
            currentEntry.source = line; // Store the full series line with episode info
            continue;
          }
          
          // Look for "from" line (e.g., "from The High Republic: Tales of Light and Life")
          if (line.startsWith('from ')) {
            currentEntry.source = line.substring(5).trim();
            continue;
          }
          
          // Look for year pattern (e.g., "349y BBY", "232y BBY")
          const yearMatch = line.match(/^(\d+)y\s+(BBY|ABY)$/);
          if (yearMatch) {
            currentEntry.year = `${yearMatch[1]}y ${yearMatch[2]}`;
            continue;
          }
          
          // Look for published date (e.g., "Published: September 5, 2023")
          if (line.startsWith('Published: ')) {
            currentEntry.publishedDate = line.substring(11).trim();
            continue;
          }
          
          // Look for publisher (e.g., "Published by: Disney-Lucasfilm Press")
          if (line.startsWith('Published by: ')) {
            currentEntry.publisher = line.substring(14).trim();
            continue;
          }
          
          // Look for writer (e.g., "Writer: George Mann")
          if (line.startsWith('Writer: ')) {
            currentEntry.writer = line.substring(8).trim();
            continue;
          }
          
          // Look for director (e.g., "Director: Joss Whedon")
          if (line.startsWith('Director: ')) {
            currentEntry.director = line.substring(10).trim();
            continue;
          }
          
          // Look for production number (e.g., "Production Number: 401")
          if (line.startsWith('Production Number: ')) {
            currentEntry.productionNumber = line.substring(19).trim();
            continue;
          }
          
          // Look for released date (e.g., "Released: October 5, 1999")
          if (line.startsWith('Released: ')) {
            currentEntry.releasedDate = line.substring(10).trim();
            continue;
          }
          
          // Look for pages (e.g., "Pages: 5")
          if (line.startsWith('Pages: ')) {
            currentEntry.pages = parseInt(line.substring(7).trim());
            continue;
          }
          
          // Skip certain lines
          if (line === 'Synopsis Unavailable.' || 
              line === 'View Listing Details' ||
              line === 'Flashback Issue' ||
              line.includes('Artist:') ||
              line.trim() === '') {
            continue;
          }
          
          // Everything else is likely synopsis
          if (!currentEntry.synopsis && 
              !line.match(/^\d+:/) && 
              line !== currentEntry.title) {
            currentEntry.synopsis = line;
          }
        }
      }
      
      // Add the last entry
      if (currentEntry) {
        entries.push(currentEntry);
      }
      
      console.log('Parsed CMRO entries:', entries);
      
      if (entries.length === 0) {
        setMessage('No valid CMRO entries found to import');
        setCmroBulkImportLoading(false);
        return;
      }
      
      // Process each entry and add to custom order
      let successCount = 0;
      let failCount = 0;
      const failedItems = [];
      
      for (const entry of entries) {
        try {
          // Check if this is a new CMRO format entry (has seriesName, seriesYear, issueNumber)
          if (entry.seriesName && entry.seriesYear && entry.issueNumber) {
            // New CMRO format - already parsed as comic
            console.log(`Processing new CMRO format comic: ${entry.seriesName} (${entry.seriesYear}) #${entry.issueNumber}`);
            
            try {
              // Use ComicVine search to find the correct series and issue
              console.log(`Searching ComicVine for series: "${entry.seriesName}" issue #${entry.issueNumber}`);
              const response = await fetch(`${config.apiBaseUrl}/api/comicvine/search-with-issues?query=${encodeURIComponent(entry.seriesName)}&issueNumber=${encodeURIComponent(entry.issueNumber)}&issueTitle=${encodeURIComponent(entry.issueTitle || '')}`);
              
              if (response.ok) {
                const searchResults = await response.json();
                console.log(`Found ${searchResults.length} comic series with issue #${entry.issueNumber}`);
                
                let selectedSeries = null;
                if (searchResults.length > 0) {
                  // Look for series with matching year first
                  selectedSeries = searchResults.find(series => series.series.start_year === entry.seriesYear) || searchResults[0];
                  console.log(`✓ Using ComicVine match: "${selectedSeries.series.name}" with issue: "${selectedSeries.issueName}"`);
                  
                  // Create enhanced comic data with ComicVine information
                  const requestData = {
                    mediaType: 'comic',
                    title: entry.title,
                    comicSeries: selectedSeries.series.name,
                    comicYear: entry.seriesYear,
                    comicIssue: entry.issueNumber,
                    comicPublisher: selectedSeries.series.publisher?.name || null,
                    customTitle: null,
                    comicVineId: selectedSeries.series.api_detail_url || null,
                    // Store complete ComicVine data including series and issue details
                    comicVineDetailsJson: JSON.stringify({
                      series: selectedSeries.series,
                      issue: selectedSeries.issue || null,
                      volume: selectedSeries.series,
                      search_results: searchResults
                    })
                  };
                  
                  console.log(`✓ Using backend-sorted best match for "${entry.title}"`);
                  const success = await handleAddMediaToOrder(viewingOrderItems.id, requestData, true);
                  if (success) {
                    successCount++;
                    console.log(`✅ Successfully added: ${entry.title}`);
                  } else {
                    failCount++;
                    failedItems.push(`${entry.title}: Failed to add item`);
                    console.log(`❌ Failed to add: ${entry.title}`);
                  }
                  continue;
                } else {
                  console.log(`No ComicVine results found for: ${entry.seriesName} #${entry.issueNumber}`);
                  // Fall through to create without ComicVine data
                }
              } else {
                console.log(`ComicVine search failed for: ${entry.seriesName} #${entry.issueNumber}`);
                // Fall through to create without ComicVine data
              }
            } catch (error) {
              console.log(`ComicVine search error for: ${entry.seriesName} #${entry.issueNumber}`, error);
              // Fall through to create without ComicVine data
            }
            
            // Create comic without ComicVine data if search failed
            const requestData = {
              mediaType: 'comic',
              title: entry.title,
              comicSeries: entry.seriesName,
              comicYear: entry.seriesYear,
              comicIssue: entry.issueNumber,
              comicPublisher: null,
              customTitle: null,
              comicVineId: null,
              comicVineDetailsJson: null
            };
            
            console.log(`Creating comic without ComicVine data: ${entry.title}`);
            const success = await handleAddMediaToOrder(viewingOrderItems.id, requestData, true);
            if (success) {
              successCount++;
              console.log(`✅ Successfully added: ${entry.title}`);
            } else {
              failCount++;
              failedItems.push(`${entry.title}: Failed to add item`);
              console.log(`❌ Failed to add: ${entry.title}`);
            }
            continue;
          }
          
          // Original CMRO format processing...
          // First check if it's a TV episode based on source pattern (e.g., "Buffy the Vampire Slayer (S4E01)")
          let episodeMatch = null;
          if (entry.source) {
            episodeMatch = entry.source.match(/^(.+?)\s*\(S(\d+)E(\d+)\)$/);
          }
          
          let mediaType = 'shortstory'; // Default to short story
          let requestData = {};
          
          if (episodeMatch) {
            // TV Episode detected
            const seriesName = episodeMatch[1].trim();
            const seasonNumber = parseInt(episodeMatch[2]);
            const episodeNumber = parseInt(episodeMatch[3]);
            
            mediaType = 'episode';
            requestData = {
              mediaType: 'episode',
              title: entry.title,
              seriesTitle: seriesName,
              seasonNumber: seasonNumber,
              episodeNumber: episodeNumber,
              year: entry.releasedDate ? new Date(entry.releasedDate).getFullYear() : 
                    (entry.publishedDate ? new Date(entry.publishedDate).getFullYear() : null)
            };
          } else if (entry.title.match(/#\s*\d+/)) {
            // Comic detected: title contains '#' followed by a number (e.g., "Amazing Spider-Man #1", "Star Wars #23")
            console.log(`Comic detected based on title pattern: ${entry.title}`);
            
            // Extract series name and issue number from title
            const comicMatch = entry.title.match(/^(.+?)\s*#\s*(\d+)(.*)$/);
            if (comicMatch) {
              const seriesName = comicMatch[1].trim();
              const issueNumber = comicMatch[2];
              const issueTitle = comicMatch[3].trim();
              
              console.log(`Extracted: Series="${seriesName}", Issue=#${issueNumber}, IssueTitle="${issueTitle}"`);
              
              try {
                // Use ComicVine search to find the correct series and issue
                console.log(`Searching ComicVine for series: "${seriesName}" issue #${issueNumber}`);
                const response = await fetch(`${config.apiBaseUrl}/api/comicvine/search-with-issues?query=${encodeURIComponent(seriesName)}&issueNumber=${encodeURIComponent(issueNumber)}&issueTitle=${encodeURIComponent(issueTitle)}`);
                
                if (response.ok) {
                  const searchResults = await response.json();
                  console.log(`Found ${searchResults.length} comic series with issue #${issueNumber}`);
                  
                  let selectedSeries = null;
                  if (searchResults.length > 0) {
                    // Backend handles title matching and sorting, so first result is the best match
                    selectedSeries = searchResults[0];
                    console.log(`✓ Using ComicVine match: "${selectedSeries.series.name}" with issue: "${selectedSeries.issueName}"`);
                    
                    // Create enhanced comic data with ComicVine information
                    mediaType = 'comic';
                    requestData = {
                      mediaType: 'comic',
                      title: entry.title,
                      comicSeries: selectedSeries.series.name, // Use ComicVine series name
                      comicYear: entry.publishedDate ? new Date(entry.publishedDate).getFullYear() : selectedSeries.series.start_year,
                      comicIssue: issueNumber,
                      comicPublisher: selectedSeries.series.publisher?.name || null,
                      comicVineId: selectedSeries.series.api_detail_url,
                      // Store comprehensive ComicVine data for metadata extraction
                      comicVineDetailsJson: JSON.stringify({
                        series: selectedSeries.series,
                        issue: selectedSeries.issue || null,
                        volume: selectedSeries.series,
                        search_results: searchResults,
                        comprehensiveData: selectedSeries.comprehensiveData || selectedSeries
                      })
                    };
                    
                    console.log(`✓ Enhanced comic data with ComicVine info: ${selectedSeries.series.name} (${requestData.comicYear}) #${issueNumber}`);
                  } else {
                    console.log(`No ComicVine results found, using extracted data`);
                    // Fallback to extracted data if no ComicVine results
                    mediaType = 'comic';
                    requestData = {
                      mediaType: 'comic',
                      title: entry.title,
                      comicSeries: seriesName,
                      comicYear: entry.publishedDate ? new Date(entry.publishedDate).getFullYear() : null,
                      comicIssue: issueNumber
                    };
                  }
                } else {
                  console.log(`ComicVine search failed, using extracted data`);
                  // Fallback to extracted data if search fails
                  mediaType = 'comic';
                  requestData = {
                    mediaType: 'comic',
                    title: entry.title,
                    comicSeries: seriesName,
                    comicYear: entry.publishedDate ? new Date(entry.publishedDate).getFullYear() : null,
                    comicIssue: issueNumber
                  };
                }
              } catch (searchError) {
                console.log(`ComicVine search error: ${searchError.message}, using extracted data`);
                // Fallback to extracted data if search encounters an error
                mediaType = 'comic';
                requestData = {
                  mediaType: 'comic',
                  title: entry.title,
                  comicSeries: seriesName,
                  comicYear: entry.publishedDate ? new Date(entry.publishedDate).getFullYear() : null,
                  comicIssue: issueNumber
                };
              }
            } else {
              // If we can't parse the comic format, treat as book
              console.log(`Could not parse comic format from: ${entry.title}`);
              mediaType = 'book';
              requestData = {
                mediaType: 'book',
                title: entry.title,
                bookTitle: entry.title,
                bookAuthor: entry.writer || 'Unknown',
                bookYear: entry.publishedDate ? new Date(entry.publishedDate).getFullYear() : null,
                bookIsbn: null,
                bookPublisher: entry.publisher || 'Unknown',
                bookOpenLibraryId: null,
                bookCoverUrl: null
              };
            }
          } else if (entry.source) {
            // If from a magazine or anthology, treat as short story
            if (entry.source.includes('Star Wars Insider') || 
                entry.source.includes('Tales of') ||
                entry.source.includes('Stories of')) {
              mediaType = 'shortstory';
              requestData = {
                mediaType: 'shortstory',
                title: entry.title,
                storyTitle: entry.title,
                storyAuthor: entry.writer || 'Unknown',
                storyYear: entry.publishedDate ? new Date(entry.publishedDate).getFullYear() : null,
                storyUrl: null,
                storyContainedInBookId: null,
                storyCoverUrl: null
              };
            } else {
              // Standalone book or comic
              mediaType = 'book';
              requestData = {
                mediaType: 'book',
                title: entry.title,
                bookTitle: entry.title,
                bookAuthor: entry.writer || 'Unknown',
                bookYear: entry.publishedDate ? new Date(entry.publishedDate).getFullYear() : null,
                bookIsbn: null,
                bookPublisher: entry.publisher || 'Unknown',
                bookOpenLibraryId: null,
                bookCoverUrl: null
              };
            }
          } else {
            // No source, likely a standalone book
            mediaType = 'book';
            requestData = {
              mediaType: 'book',
              title: entry.title,
              bookTitle: entry.title,
              bookAuthor: entry.writer || 'Unknown',
              bookYear: entry.publishedDate ? new Date(entry.publishedDate).getFullYear() : null,
              bookIsbn: null,
              bookPublisher: entry.publisher || 'Unknown',
              bookOpenLibraryId: null,
              bookCoverUrl: null
            };
          }
          
          console.log(`Adding ${mediaType}: ${entry.title}`);
          
          // Use the same method as regular bulk import
          const success = await handleAddMediaToOrder(viewingOrderItems.id, requestData, true);
          if (success) {
            successCount++;
            console.log(`✅ Successfully added: ${entry.title}`);
          } else {
            failCount++;
            failedItems.push(`${entry.title}: Failed to add item`);
            console.log(`❌ Failed to add: ${entry.title}`);
          }
          
        } catch (error) {
          console.error(`Error adding ${entry.title}:`, error);
          
          // Stop import on error and show error modal
          setErrorDetails({
            title: 'CMRO Import Error',
            message: `Error processing entry: ${entry.title}`,
            error: error.message || 'Unknown error occurred'
          });
          setShowErrorModal(true);
          setCmroBulkImportLoading(false);
          return;
        }
      }
      
      // Show results
      let resultMessage = `CMRO import completed: ${successCount} items added successfully`;
      if (failCount > 0) {
        resultMessage += `, ${failCount} failed`;
        if (failedItems.length > 0) {
          resultMessage += `\nFailed items:\n${failedItems.join('\n')}`;
        }
      }
      
      setMessage(resultMessage);
      setShowCmroBulkImportModal(false);
      setCmroBulkImportData('');
      
      // Refresh the order items
      fetchCustomOrders();
      if (viewingOrderItems) {
        const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}`);
        const updatedOrderData = await updatedOrder.json();
        setViewingOrderItems(updatedOrderData);
      }
      
    } catch (error) {
      console.error('Error during CMRO import:', error);
      
      // Show error modal for unexpected errors
      setErrorDetails({
        title: 'CMRO Import System Error',
        message: 'An unexpected error occurred during the CMRO import process.',
        error: error.message || 'Unknown system error'
      });
      setShowErrorModal(true);
    } finally {
      setCmroBulkImportLoading(false);
    }
  };

  const handleSearchBooks = async (e) => {
    e.preventDefault();
    
    if (!bookFormData.title.trim()) {
      setMessage('Please enter a book title to search');
      return;
    }

    // If we're editing an item, update it directly without searching
    if (editingItem) {
      const updatedItemData = {
        ...editingItem, // Keep existing data
        bookTitle: bookFormData.title.trim(),
        bookAuthor: bookFormData.author.trim(),
        bookYear: bookFormData.year ? parseInt(bookFormData.year) : null,
        bookIsbn: bookFormData.isbn.trim(),
        bookPageCount: bookFormData.pageCount ? parseInt(bookFormData.pageCount) : null
      };
      await handleUpdateItem(updatedItemData);
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

      const response = await fetch(`${config.apiBaseUrl}/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}&limit=10`);
      
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
  };  const handleSelectBook = async (selectedBook) => {
    try {
      // Handle both editing and reselecting cases
      const targetItem = editingItem || reselectingItem;
      
      if (targetItem) {
        // Check if this is a short story being linked to a book
        if (targetItem.mediaType === 'shortstory') {
          // Check if this book already exists in the order
          const existingBook = viewingOrderItems?.items?.find(item => 
            item.mediaType === 'book' && 
            item.bookOpenLibraryId === selectedBook.id
          );

          let bookId;
            if (existingBook) {
            // Use the existing book
            bookId = existingBook.id;
          } else {            // Create a new reference book (not added to collection order)
            // First, fetch detailed book information to get page count
            let pageCount = null;
            if (selectedBook.id) {
              try {
                const bookDetailsResponse = await fetch(`${config.apiBaseUrl}/api/openlibrary/book/${encodeURIComponent(selectedBook.id)}`);
                if (bookDetailsResponse.ok) {
                  const bookDetails = await bookDetailsResponse.json();
                  pageCount = bookDetails.pageCount || null;
                  console.log(`Fetched page count for reference book ${selectedBook.title}: ${pageCount} pages`);
                }
              } catch (error) {
                console.warn(`Failed to fetch page count for reference book ${selectedBook.title}:`, error.message);
              }
            }

            const bookData = {
              title: selectedBook.title,
              bookTitle: selectedBook.title,
              bookAuthor: selectedBook.authors && selectedBook.authors[0] ? selectedBook.authors[0] : 'Unknown Author',
              bookYear: selectedBook.firstPublishYear || null,
              bookIsbn: selectedBook.isbn || null,
              bookPublisher: selectedBook.publishers && selectedBook.publishers[0] ? selectedBook.publishers[0] : null,
              bookOpenLibraryId: selectedBook.id || null,
              bookCoverUrl: selectedBook.coverUrl || null,
              bookPageCount: pageCount,
              customOrderId: viewingOrderItems.id // Provide order context for schema compliance
            };

            const bookResponse = await fetch(`${config.apiBaseUrl}/api/books/reference`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(bookData),
            });

            if (bookResponse.ok) {
              const createdBook = await bookResponse.json();
              bookId = createdBook.id;
            } else {
              const errorData = await bookResponse.json();
              setMessage(`Error creating reference book: ${errorData.error}`);
              return;
            }
          }
          
          // Now update the short story to reference this book (either existing or newly created)
          const storyUpdateData = {
            storyContainedInBookId: bookId,
            storyCoverUrl: selectedBook.coverUrl || null
          };

          const storyResponse = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}/items/${targetItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(storyUpdateData),
          });

          if (storyResponse.ok) {
            setMessage(`Short story "${targetItem.storyTitle || targetItem.title}" is now linked to the book "${selectedBook.title}"`);
            setShowBookForm(false);
            setReselectingItem(null);
            setEditingItem(null);
            setBookFormData({ title: '', author: '', year: '', isbn: '', pageCount: '' });
            setBookSearchResults([]);
            
            // Refresh the order items
            fetchCustomOrders();
            if (viewingOrderItems) {
              const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}`);
              const updatedOrderData = await updatedOrder.json();
              setViewingOrderItems(updatedOrderData);
            }
          } else {
            const errorData = await storyResponse.json();
            setMessage(`Error linking story to book: ${errorData.error}`);
          }
        } else {
          // Regular book re-selection/editing for book items
          // First, fetch detailed book information to get page count
          let pageCount = null;
          if (selectedBook.id) {
            try {
              const bookDetailsResponse = await fetch(`${config.apiBaseUrl}/api/openlibrary/book/${encodeURIComponent(selectedBook.id)}`);
              if (bookDetailsResponse.ok) {
                const bookDetails = await bookDetailsResponse.json();
                pageCount = bookDetails.pageCount || null;
                console.log(`Fetched page count for ${selectedBook.title}: ${pageCount} pages`);
              }
            } catch (error) {
              console.warn(`Failed to fetch page count for ${selectedBook.title}:`, error.message);
            }
          }

          const updateData = {
            title: selectedBook.title,
            bookTitle: selectedBook.title,
            bookAuthor: selectedBook.authors && selectedBook.authors[0] ? selectedBook.authors[0] : 'Unknown Author',
            bookYear: selectedBook.firstPublishYear || null,
            bookIsbn: selectedBook.isbn || null,
            bookPublisher: selectedBook.publishers && selectedBook.publishers[0] ? selectedBook.publishers[0] : null,
            bookOpenLibraryId: selectedBook.id || null,
            bookCoverUrl: selectedBook.coverUrl || null,
            bookPageCount: pageCount
          };

          const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}/items/${targetItem.id}`, {
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
            setEditingItem(null);
            setBookFormData({ title: '', author: '', year: '', isbn: '', pageCount: '' });
            setBookSearchResults([]);
            
            // Refresh the order items
            fetchCustomOrders();
            if (viewingOrderItems) {
              const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}`);
              const updatedOrderData = await updatedOrder.json();
              setViewingOrderItems(updatedOrderData);
            }
          } else {
            const errorData = await response.json();
            setMessage(`Error updating book: ${errorData.error}`);
          }
        }
      } else {
        // Add new book to order (existing functionality)
        // First, fetch detailed book information to get page count
        let pageCount = null;
        if (selectedBook.id) {
          try {
            const bookDetailsResponse = await fetch(`${config.apiBaseUrl}/api/openlibrary/book/${encodeURIComponent(selectedBook.id)}`);
            if (bookDetailsResponse.ok) {
              const bookDetails = await bookDetailsResponse.json();
              pageCount = bookDetails.pageCount || null;
              console.log(`Fetched page count for new book ${selectedBook.title}: ${pageCount} pages`);
            }
          } catch (error) {
            console.warn(`Failed to fetch page count for ${selectedBook.title}:`, error.message);
          }
        }

        const bookMedia = {
          type: 'book',
          title: selectedBook.title,
          bookTitle: selectedBook.title,
          bookAuthor: selectedBook.authors && selectedBook.authors[0] ? selectedBook.authors[0] : 'Unknown Author',
          bookYear: selectedBook.firstPublishYear || null,
          bookIsbn: selectedBook.isbn || null,
          bookPublisher: selectedBook.publishers && selectedBook.publishers[0] ? selectedBook.publishers[0] : null,
          bookOpenLibraryId: selectedBook.id || null,
          bookCoverUrl: selectedBook.coverUrl || null,
          bookPageCount: pageCount
        };

        const success = await handleAddMediaToOrder(viewingOrderItems.id, bookMedia);
        if (success !== false) {
          setShowBookForm(false);
          setBookFormData({ title: '', author: '', year: '', isbn: '', pageCount: '' });
          setBookSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Error selecting book:', error);
      setMessage('Error selecting book. Please try again.');
    }
  };const handleSearchComics = async (e) => {
    e.preventDefault();
    
    if (!comicFormData.series.trim()) {
      setMessage('Please enter a comic series name to search');
      return;
    }
    
    if (!comicFormData.issue.trim()) {
      setMessage('Please enter an issue number to search');
      return;
    }    // If we're editing an item, update it directly without searching
    if (editingItem) {
      const updatedItemData = {
        comicSeries: comicFormData.series.trim(),
        comicYear: comicFormData.year ? parseInt(comicFormData.year) : null,
        comicIssue: comicFormData.issue.trim(),
        customTitle: comicFormData.title.trim() || null
      };
      await handleUpdateItem(updatedItemData);
      return;
    }

    setComicSearchLoading(true);
    setComicSearchResults([]);
    
    try {
      // Build search query for ComicVine with issue filtering
      const searchQuery = comicFormData.series.trim();
      const issueNumber = comicFormData.issue.trim();

      const response = await fetch(`${config.apiBaseUrl}/api/comicvine/search-with-issues?query=${encodeURIComponent(searchQuery)}&issueNumber=${encodeURIComponent(issueNumber)}`);
      
      if (response.ok) {
        const results = await response.json();
        setComicSearchResults(results);
        
        if (results.length === 0) {
          setMessage(`No comic series found with issue #${issueNumber}. Try a different series name or issue number.`);
        } else {
          setMessage(`Found ${results.length} series that have issue #${issueNumber}`);
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
  };const handleSelectComic = async (selectedSeries) => {
    try {
      console.log('handleSelectComic called with:', selectedSeries);
      console.log('selectedSeries.coverUrl:', selectedSeries.coverUrl);
      
      // Validate required fields
      if (!comicFormData.issue) {
        setMessage('Please enter an issue number before adding the comic.');
        return;
      }

      // Create the comic string in the expected format
      // Use the series start year from ComicVine if no year is provided
      const seriesYear = comicFormData.year || selectedSeries.series.start_year;
      const comicString = seriesYear 
        ? `${selectedSeries.series.name} (${seriesYear}) #${comicFormData.issue}`
        : `${selectedSeries.series.name} #${comicFormData.issue}`;
        if (reselectingItem) {        // Update existing item with new comic selection
        const updateData = {
          title: comicString,
          comicSeries: selectedSeries.series.name,
          comicYear: seriesYear ? parseInt(seriesYear) : null,
          comicIssue: comicFormData.issue,
          comicPublisher: selectedSeries.series.publisher?.name || null,
          customTitle: comicFormData.title.trim() || null,
          comicVineId: selectedSeries.series.api_detail_url || null,
          // Store comprehensive ComicVine data if available
          comicVineDetailsJson: JSON.stringify(selectedSeries.comprehensiveData || selectedSeries),
          comicCoverUrl: selectedSeries.coverUrl || null // Include the specific cover URL from the selected series
        };

        console.log('Sending updateData to backend:', updateData);
        console.log('coverUrl being sent:', updateData.comicCoverUrl);

        const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}/items/${reselectingItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (response.ok) {
          setMessage(`Comic updated successfully: "${comicString}"`);          setShowComicForm(false);
          setReselectingItem(null);
          setComicFormData({ series: '', year: '', issue: '', title: '' });
          setComicSearchResults([]);
          
          // Give the server a moment to process artwork caching
          setTimeout(async () => {
            // Refresh the order items
            fetchCustomOrders();
            if (viewingOrderItems) {
              const updatedOrder = await fetch(`${config.apiBaseUrl}/api/custom-orders/${viewingOrderItems.id}`);
              const updatedOrderData = await updatedOrder.json();
              setViewingOrderItems(updatedOrderData);
            }
          }, 1000); // 1 second delay to allow artwork processing
        } else {
          const errorData = await response.json();
          setMessage(`Error updating comic: ${errorData.error}`);
        }      } else {        // Add new comic to order (existing functionality)
        const comicMedia = {
          mediaType: 'comic',
          title: comicString,
          comicSeries: selectedSeries.series.name,
          comicYear: seriesYear ? parseInt(seriesYear) : null,
          comicIssue: comicFormData.issue,
          comicPublisher: selectedSeries.series.publisher?.name || null,
          customTitle: comicFormData.title.trim() || null,
          comicVineId: selectedSeries.series.api_detail_url || null,
          // Store comprehensive ComicVine data if available
          comicVineDetailsJson: JSON.stringify(selectedSeries.comprehensiveData || selectedSeries)
        };const success = await handleAddMediaToOrder(viewingOrderItems.id, comicMedia);
        if (success !== false) {
          setShowComicForm(false);
          setComicFormData({ series: '', year: '', issue: '', title: '' });
          setComicSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Error selecting comic:', error);
      setMessage('Error selecting comic. Please try again.');
    }
  };  const handleSearchShortStoryBooks = async (e) => {
    e.preventDefault();
    
    if (!shortStoryFormData.title.trim()) {
      setMessage('Please enter a short story title');
      return;
    }

    // If we're editing an item, handle it differently
    if (editingItem) {
      // For short stories being edited, just update the item directly
      await handleAddShortStory();
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

      const response = await fetch(`${config.apiBaseUrl}/api/openlibrary/search?query=${encodeURIComponent(searchQuery)}&limit=20`);
      
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

      // If we're editing an item, update it
      if (editingItem) {
        const updatedItemData = {
          title: shortStoryFormData.title.trim(),
          storyTitle: shortStoryFormData.title.trim(),
          storyAuthor: shortStoryFormData.author.trim() || null,
          storyYear: shortStoryFormData.year ? parseInt(shortStoryFormData.year) : null,
          storyUrl: shortStoryFormData.url.trim() || null,
          storyContainedInBookId: containedInBook ? containedInBook.id : null,
          storyCoverUrl: shortStoryFormData.coverUrl.trim() || null
        };
        await handleUpdateItem(updatedItemData);
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
      }    } catch (error) {
      console.error('Error adding short story:', error);
      setMessage('Error adding short story. Please try again.');
    }
  };

  const handleAddWebVideo = async () => {
    try {
      // Validate required fields
      if (!webVideoFormData.title.trim()) {
        setMessage('Please enter a web video title');
        return;
      }
      
      if (!webVideoFormData.url.trim()) {
        setMessage('Please enter a web video URL');
        return;
      }

      // If we're editing an item, update it
      if (editingItem) {
        const updatedItemData = {
          title: webVideoFormData.title.trim(),
          webTitle: webVideoFormData.title.trim(),
          webUrl: webVideoFormData.url.trim(),
          webDescription: webVideoFormData.description.trim() || null
        };
        await handleUpdateItem(updatedItemData);
        return;
      }

      const webVideoMedia = {
        mediaType: 'webvideo',
        title: webVideoFormData.title.trim(),
        webTitle: webVideoFormData.title.trim(),
        webUrl: webVideoFormData.url.trim(),
        webDescription: webVideoFormData.description.trim() || null
      };

      const success = await handleAddMediaToOrder(viewingOrderItems.id, webVideoMedia);
      if (success !== false) {
        setShowWebVideoForm(false);
        setWebVideoFormData({ title: '', url: '', description: '' });
      }
    } catch (error) {
      console.error('Error adding web video:', error);
      setMessage('Error adding web video. Please try again.');
    }
  };

  if (loading) {
    return <LoadingPage />;
  }
  return (
    <main>
      <h2>Custom Orders</h2>
      <p>Create and manage custom playlists of mixed media (movies, TV episodes, comics, etc.)</p>

      {/* Back button when viewing items */}
      {viewingOrderItems && (
        <div className="back-navigation">
          <Button
            onClick={() => handleBackToOrderList()}
            className="secondary"
          >
            ← Back to Custom Orders
          </Button>
        </div>
      )}

      {/* Item Management View */}
      {viewingOrderItems ? (
        <div className="order-items-view">
          <OrderHeader
            viewingOrderItems={viewingOrderItems}
            onBackToOrderList={() => setViewingOrderItems(null)}
            handleViewOrder={handleViewOrder}
            getAllNonReferenceItems={getAllNonReferenceItems}
            getUnwatchedNonReferenceItems={getUnwatchedNonReferenceItems}
            setShowMovieForm={setShowMovieForm}
            setShowEpisodeForm={setShowEpisodeForm}
            setShowBookForm={setShowBookForm}
            setShowComicForm={setShowComicForm}
            setShowShortStoryForm={setShowShortStoryForm}
            setShowWebVideoForm={setShowWebVideoForm}
            setShowBulkImportModal={setShowBulkImportModal}
            setShowCmroBulkImportModal={setShowCmroBulkImportModal}
            setMovieFormData={setMovieFormData}
            setEpisodeFormData={setEpisodeFormData}
            setBookFormData={setBookFormData}
            setComicFormData={setComicFormData}
            setShortStoryFormData={setShortStoryFormData}
            setWebVideoFormData={setWebVideoFormData}
            setBulkImportData={setBulkImportData}
            setCmroBulkImportData={setCmroBulkImportData}
          />
          
          {/* Filter Controls */}
          <FilterToggle 
            checked={showWatchedItems}
            onChange={(e) => setShowWatchedItems(e.target.checked)}
          />
          {!viewingOrderItems?.items || viewingOrderItems.items.length === 0 ? (
            <EmptyState 
              title="No items in this custom order yet."
              subtitle="Add some movies, TV episodes, or comics to get started!"
            />
          ) : getFilteredItems(viewingOrderItems?.items || [], showWatchedItems).length === 0 ? (
            <EmptyState 
              title="No items match the current filter."
              subtitle={showWatchedItems ? 'All items are hidden.' : 'All unwatched items are hidden. Toggle "Show Watched Items" to see watched items.'}
            />
          ) : (
            <>
              {/* Scroll Navigation Buttons - only show when there are more than 5 items */}
              {getFilteredItems(viewingOrderItems?.items || [], showWatchedItems).length > 5 && (
                <div className="scroll-navigation">
                  <Button
                    onClick={scrollToBottom}
                    className="secondary"
                    size="small"
                  >
                    ↓ Scroll to Bottom
                  </Button>
                </div>
              )}
                <div className="items-list">
              {getFilteredItems(viewingOrderItems?.items || [], showWatchedItems).map((item, index) => (
                <div 
                  key={item.id} 
                  className={`item-card ${item.isWatched ? 'watched' : ''} ${
                    isDragging && draggedItem?.id === item.id ? 'dragging' : ''
                  } ${
                    dragOverItem?.id === item.id ? 'drag-over' : ''
                  }`}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, item, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="drag-handle" title="Drag to reorder">
                    ⋮⋮
                  </div>
                  <div className="item-position">#{index + 1}</div>
                  <div className="item-thumbnail" onClick={() => toggleItemExpanded(item.id)} style={{ cursor: 'pointer' }}>
                    {getItemArtworkUrl(item) ? (
                      <img 
                        src={getItemArtworkUrl(item)} 
                        alt={`${item.title} artwork`}
                        className="thumbnail-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="thumbnail-fallback" 
                      style={{ display: getItemArtworkUrl(item) ? 'none' : 'flex' }}
                    >
                      {item.mediaType === 'suborder' ? '📁' :
                       item.mediaType === 'tv' ? '📺' : 
                       item.mediaType === 'movie' ? '🎬' :
                       item.mediaType === 'comic' ? '📚' :
                       item.mediaType === 'book' ? '📖' :
                       item.mediaType === 'shortstory' ? '📖' : 
                       item.mediaType === 'webvideo' ? '🎬' : 
                       item.mediaType === 'game' ? '🎮' : '📄'}
                    </div>
                    {/* Expand/Collapse indicator */}
                    <div className="expand-indicator">
                      {expandedItems.has(item.id) ? '▼' : '▶'}
                    </div>
                  </div>                  <div className="item-info">
                    <div className="item-details">
                      <h4>
                        {item.mediaType === 'suborder' ? (
                          <span className="sub-order-title">
                            📁 {item.title}
                            {item.referencedCustomOrder && (
                              <span className="sub-order-stats">
                                ({item.referencedCustomOrder.items?.filter(i => !i.isWatched).length || 0} unwatched)
                              </span>
                            )}
                          </span>
                        ) : item.mediaType === 'comic' && item.customTitle ? (
                          // Comic with custom title - check for Komga URL
                          item.komgaUrl ? (
                            <a 
                              href={item.komgaUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="komga-link"
                              title="Open in Komga"
                            >
                              {item.customTitle}
                            </a>
                          ) : (
                            item.customTitle
                          )
                        ) : item.mediaType === 'comic' ? (
                          // Comic with regular title - check for Komga URL
                          item.komgaUrl ? (
                            <a 
                              href={item.komgaUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="komga-link"
                              title="Open in Komga"
                            >
                              {item.title}
                            </a>
                          ) : (
                            item.title
                          )
                        ) : item.mediaType === 'book' ? (
                          // Book - link to unified Books page
                          item.bookId ? (
                            <Link 
                              to={`/media/books?id=${item.bookId}`}
                              className="book-link"
                              title="View full book details"
                            >
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )
                        ) : (
                          item.title
                        )}
                      </h4>
                      {item.mediaType === 'suborder' && item.referencedCustomOrder && (
                        <p className="item-series">
                          Sub-order • {item.referencedCustomOrder.items?.length || 0} items
                          {item.referencedCustomOrder.description && (
                            <span> • {item.referencedCustomOrder.description}</span>
                          )}
                        </p>
                      )}
                      {item.seriesTitle && item.mediaType !== 'suborder' && (
                        <p className="item-series">
                          {item.seriesTitle} - S{item.seasonNumber}E{item.episodeNumber}
                        </p>
                      )}
                      {item.comicSeries && (
                        <div className="comic-info-section">
                          <p className="item-series">
                            {item.comicSeries} ({item.comicYear}) #{item.comicIssue}
                          </p>
                          
                          {/* Enhanced ComicVine Data Display - Only show when expanded */}
                          {expandedItems.has(item.id) && (item.comicIssueName || item.comicDescription || item.comicCreators || item.comicCharacters || item.comicStoryArcs || item.comicCoverDate || item.comicPublisher) && (
                            <div className="comic-vine-details expanded">
                              {item.comicPublisher && (
                                <p className="comic-publisher">
                                  <strong>Publisher:</strong> {item.comicPublisher}
                                </p>
                              )}
                              
                              {item.comicIssueName && (
                                <p className="comic-issue-name">
                                  <strong>Issue:</strong> {item.comicIssueName}
                                </p>
                              )}
                              
                              {item.comicDescription && (
                                <p className="comic-description">
                                  <strong>Description:</strong> {item.comicDescription}
                                </p>
                              )}
                              
                              {item.comicCoverDate && (
                                <p className="comic-dates">
                                  <strong>Cover Date:</strong> {new Date(item.comicCoverDate).toLocaleDateString()}
                                  {item.comicStoreDate && item.comicStoreDate !== item.comicCoverDate && (
                                    <span> | <strong>Store Date:</strong> {new Date(item.comicStoreDate).toLocaleDateString()}</span>
                                  )}
                                </p>
                              )}
                              
                              {item.comicCreators && (
                                <p className="comic-creators">
                                  <strong>Creative Team:</strong> {formatCreatorsDisplay(item.comicCreators)}
                                </p>
                              )}
                              
                              {item.comicCharacters && (
                                <p className="comic-characters">
                                  <strong>Characters:</strong> {formatCharactersDisplay(item.comicCharacters)}
                                </p>
                              )}
                              
                              {item.comicStoryArcs && (
                                <p className="comic-story-arcs">
                                  <strong>Story Arcs:</strong> {item.comicStoryArcs}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {(item.mediaType === 'book' || item.mediaType === 'shortstory') && (
                        <p className="item-series">
                          {item.bookAuthor && `${item.bookAuthor}`}
                          {item.bookYear && ` (${item.bookYear})`}
                        </p>
                      )}
                      {item.mediaType === 'webvideo' && (
                        <p className="item-series">
                          {item.webUrl && <a href={item.webUrl} target="_blank" rel="noopener noreferrer">🔗 Open Video</a>}
                        </p>
                      )}
                      {item.mediaType === 'game' && (
                        <p className="item-series">
                          {item.webUrl && <a href={item.webUrl} target="_blank" rel="noopener noreferrer">🔗 Open Video</a>}
                        </p>
                      )}
                      <div className="item-meta">
                        <span className="item-type">
                          {item.mediaType === 'suborder' ? 'sub-order' : item.mediaType}
                        </span>
                        <span className={`item-status ${item.isWatched ? 'watched' : 'unwatched'}`}>
                          {item.isWatched ? 'Watched' : 'Unwatched'}
                        </span>
                      </div>

                      {/* Reading Progress Display */}
                      {(item.mediaType === 'book' || item.mediaType === 'comic' || item.mediaType === 'shortstory') && 
                       (item.unifiedProgress?.percentageComplete > 0 || item.bookCurrentPage || item.bookPercentRead) && (
                        <div className="reading-progress">
                          <div className="progress-bar-container">
                            <div 
                              className="progress-bar-fill" 
                              style={{ 
                                width: `${item.unifiedProgress?.percentageComplete || item.bookPercentRead || 0}%`,
                                backgroundColor: (item.unifiedProgress?.percentageComplete || item.bookPercentRead || 0) >= 100 ? '#28a745' : '#007bff'
                              }}
                            />
                          </div>
                          <div className="progress-text">
                            <ReadingProgressDisplay item={item} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>                <div className="item-actions">
                    {item.mediaType === 'suborder' ? (
                      <>
                        <Button
                          onClick={() => handleViewOrder(item.referencedCustomOrder)}
                          className="primary"
                          size="small"
                        >
                          View Sub-order
                        </Button>
                        <Button
                          onClick={() => handleRemoveItem(viewingOrderItems.id, item.id, item.title)}
                          className="danger"
                          size="small"
                        >
                          Remove from List
                        </Button>
                        {!item.isWatched && (
                          <Button
                            onClick={() => handleMarkAsWatched(viewingOrderItems.id, item.id, item.title)}
                            className="secondary"
                            size="small"
                          >
                            Mark All as Watched
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
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleEditItem(item)}
                          className="secondary"
                          size="small"
                        >
                          Edit Item
                        </Button>
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
                        {item.mediaType === 'comic' && (
                          <Button
                            onClick={() => handleReselectComic(item)}
                            className="secondary"
                            size="small"
                          >
                            Re-select Comic
                          </Button>
                        )}
                        {item.mediaType === 'shortstory' && (
                          <Button
                            onClick={() => handleCollectedIn(item)}
                            className="secondary"
                            size="small"
                          >
                            Collected In...
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
                        <Button
                          onClick={() => handleNavigateToHome(item)}
                          className="primary"
                          size="small"
                          title="Navigate to home page and select this item"
                        >
                          Go to Home
                        </Button>
                      </>
                    )}
                  </div>
                </div>              ))}
            </div>
              {/* Scroll to Top button at bottom - only show when there are more than 5 items */}
            {getFilteredItems(viewingOrderItems?.items || [], showWatchedItems).length > 5 && (
              <div className="scroll-navigation-bottom">
                <Button
                  onClick={scrollToTop}
                  className="secondary"
                  size="small"
                >
                  ↑ Scroll to Top
                </Button>
              </div>
            )}
            </>
          )}
        </div>
      ) : (
        <OrderListView
          showCreateForm={showCreateForm}
          setShowCreateForm={setShowCreateForm}
          formData={formData}
          setFormData={setFormData}
          editingOrder={editingOrder}
          setEditingOrder={setEditingOrder}
          setMessage={setMessage}
          selectedParentId={selectedParentId}
          setSelectedParentId={setSelectedParentId}
          customOrders={customOrders}
          availableParents={availableParents}
          availablePlaylists={availablePlaylists}
          availableBackgrounds={availableBackgrounds}
          availableGalleries={availableGalleries}
          backgroundsLoading={backgroundsLoading}
          playlistsLoading={playlistsLoading}
          fetchAvailableParents={fetchAvailableParents}
          fetchAvailablePlaylists={fetchAvailablePlaylists}
          fetchAvailableBackgrounds={fetchAvailableBackgrounds}
          onCreateOrder={handleCreateOrder}
          onUpdateOrder={handleUpdateOrder}
          onViewOrder={handleViewOrder}
          onToggleActive={handleToggleActive}
          onEditOrder={handleEditOrder}
          onDeleteOrder={handleDeleteOrder}
        />
      )}

      {/* Movie Form Modal */}
      <MovieFormModal
        show={showMovieForm}
        editingItem={editingItem}
        movieFormData={movieFormData}
        setMovieFormData={setMovieFormData}
        movieSearchLoading={movieSearchLoading}
        movieSearchResults={movieSearchResults}
        onSubmit={handleSearchMovies}
        onSelectMovie={handleSelectMovie}
        onClose={() => {
          setShowMovieForm(false);
          setMovieFormData({ title: '', year: '' });
          setMovieSearchResults([]);
          setEditingItem(null);
        }}
      />

      {/* Episode Form Modal */}
      <EpisodeFormModal
        show={showEpisodeForm}
        editingItem={editingItem}
        episodeFormData={episodeFormData}
        setEpisodeFormData={setEpisodeFormData}
        episodeSearchLoading={episodeSearchLoading}
        onClose={() => {
          setShowEpisodeForm(false);
          setEditingItem(null);
        }}
        onSubmit={handleSearchTVEpisode}
      />      {/* Bulk Import Modal */}
      <BulkImportFormModal
        show={showBulkImportModal}
        bulkImportData={bulkImportData}
        setBulkImportData={setBulkImportData}
        bulkImportLoading={bulkImportLoading}
        onClose={() => {
          setShowBulkImportModal(false);
          setBulkImportData('');
        }}
        onSubmit={handleBulkImport}
      />

      {/* CMRO Bulk Import Modal */}
      <CmroBulkImportModal
        isOpen={showCmroBulkImportModal}
        importData={cmroBulkImportData}
        setImportData={setCmroBulkImportData}
        isLoading={cmroBulkImportLoading}
        onSubmit={handleCmroBulkImport}
        onClose={() => {
          setShowCmroBulkImportModal(false);
          setCmroBulkImportData('');
        }}
      />

      {/* Book Search Modal */}
      <DetailedBookFormModal
        show={showBookForm}
        editingItem={editingItem}
        reselectingItem={reselectingItem}
        bookFormData={bookFormData}
        setBookFormData={setBookFormData}
        bookSearchResults={bookSearchResults}
        bookSearchLoading={bookSearchLoading}
        viewingOrderItems={viewingOrderItems}
        setMessage={setMessage}
        onClose={() => {
          setShowBookForm(false);
          setReselectingItem(null);
          setEditingItem(null);
          setBookSearchResults([]);
        }}
        onSubmit={handleSearchBooks}
        onSelectBook={handleSelectBook}
        onAddMediaToOrder={handleAddMediaToOrder}
      />

      {/* Comic Search Modal */}
      <ComicFormModal
        show={showComicForm}
        editingItem={editingItem}
        reselectingItem={reselectingItem}
        comicFormData={comicFormData}
        setComicFormData={setComicFormData}
        comicSearchResults={comicSearchResults}
        comicSearchLoading={comicSearchLoading}
        onClose={() => {
          setShowComicForm(false);
          setReselectingItem(null);
          setEditingItem(null);
          setComicSearchResults([]);
        }}
        onSubmit={handleSearchComics}
        onSelectComic={handleSelectComic}
      />

      {/* Short Story Search Modal */}
      <ShortStoryFormModal
        show={showShortStoryForm}
        editingItem={editingItem}
        shortStoryFormData={shortStoryFormData}
        setShortStoryFormData={setShortStoryFormData}
        shortStorySearchResults={shortStorySearchResults}
        onClose={() => {
          setShowShortStoryForm(false);
          setEditingItem(null);
          setShortStorySearchResults([]);
        }}
        onSubmit={handleSearchShortStoryBooks}
        onAddShortStory={handleAddShortStory}
      />

      {/* Web Video Form Modal */}
      <WebVideoFormModal
        show={showWebVideoForm}
        editingItem={editingItem}
        webVideoFormData={webVideoFormData}
        setWebVideoFormData={setWebVideoFormData}
        onClose={() => {
          setShowWebVideoForm(false);
          setEditingItem(null);
        }}
        onSubmit={handleAddWebVideo}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={errorDetails.title}
        message={errorDetails.message}
        error={errorDetails.error}
      />

      <MessageDisplay message={message} />
    </main>
  );
}

export default CustomOrders;

