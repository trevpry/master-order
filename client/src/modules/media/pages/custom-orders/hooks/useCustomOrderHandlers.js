import { useState } from 'react';

export const useCustomOrderHandlers = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Order Management Handlers
  const handleViewOrder = async (orderIdOrOrder) => {
    try {
      let orderId;
      let orderData = null;

      // Check if we received an ID or a full order object
      if (typeof orderIdOrOrder === 'object' && orderIdOrOrder.id) {
        orderId = orderIdOrOrder.id;
        orderData = orderIdOrOrder;
      } else {
        orderId = orderIdOrOrder;
      }

      // If we don't have the full order data, fetch it
      if (!orderData) {
        const response = await fetch(`/api/custom-orders/${orderId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        orderData = await response.json();
      }

      if (!orderData || !orderData.id) {
        console.error('No order data found');
        return;
      }

      // Navigate to the Up Next page with the order parameter
      window.location.href = `/?order=${orderId}`;
    } catch (error) {
      console.error('Error viewing order:', error);
    }
  };

  const handleBackToOrderList = () => {
    // Implementation will be passed from parent or handled via state
  };

  const handleCreateOrder = async (e, formData, setMessage, fetchOrders, setShowCreateForm, setFormData) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage('Please enter an order name');
      return;
    }

    try {
      const response = await fetch('/api/custom-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          icon: formData.icon.trim(),
          isActive: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      setMessage('Order created successfully!');
      await fetchOrders();
      setShowCreateForm(false);
      setFormData({ name: '', description: '', icon: '' });
    } catch (error) {
      console.error('Error creating order:', error);
      setMessage(`Error creating order: ${error.message}`);
    }
  };

  const handleToggleActive = async (orderId, currentStatus, setMessage, fetchOrders) => {
    try {
      const response = await fetch(`/api/custom-orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !currentStatus
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order status');
      }

      setMessage(`Order ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
      await fetchOrders();
    } catch (error) {
      console.error('Error toggling order status:', error);
      setMessage('Error updating order status');
    }
  };

  const handleDeleteOrder = async (orderId, orderName, setMessage, fetchOrders) => {
    if (!confirm(`Are you sure you want to delete the order "${orderName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/custom-orders/${orderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete order');
      }

      setMessage('Order deleted successfully!');
      await fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      setMessage('Error deleting order');
    }
  };

  const handleEditOrder = (order, setEditingOrder, setFormData) => {
    setEditingOrder(order);
    setFormData({
      name: order.name,
      description: order.description || '',
      icon: order.icon || ''
    });
  };

  const handleUpdateOrder = async (e, editingOrder, formData, setMessage, fetchOrders, setEditingOrder, setFormData) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage('Please enter an order name');
      return;
    }

    try {
      const response = await fetch(`/api/custom-orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          icon: formData.icon.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update order');
      }

      setMessage('Order updated successfully!');
      await fetchOrders();
      setEditingOrder(null);
      setFormData({ name: '', description: '', icon: '' });
    } catch (error) {
      console.error('Error updating order:', error);
      setMessage(`Error updating order: ${error.message}`);
    }
  };

  // Item Management Handlers
  const handleEditItem = (item, setEditingItem, setters) => {
    setEditingItem(item);
    
    // Set form data based on media type
    switch (item.mediaType) {
      case 'episode':
        setters.setEpisodeFormData({
          series: item.showTitle || '',
          season: item.seasonNumber || '',
          episode: item.episodeNumber || ''
        });
        setters.setShowEpisodeForm(true);
        break;
      case 'movie':
        setters.setMovieFormData({
          title: item.title || '',
          year: item.year || ''
        });
        setters.setShowMovieForm(true);
        break;
      case 'book':
        setters.setBookFormData({
          title: item.bookTitle || item.title || '',
          author: item.bookAuthor || '',
          year: item.bookYear || item.year || '',
          isbn: item.bookIsbn || '',
          pageCount: item.bookPageCount || ''
        });
        setters.setShowBookForm(true);
        break;
      case 'comic':
        setters.setComicFormData({
          series: item.comicSeries || '',
          year: item.comicYear || item.year || '',
          issue: item.comicIssue || '',
          title: item.comicTitle || ''
        });
        setters.setShowComicForm(true);
        break;
      case 'shortstory':
        setters.setShortStoryFormData({
          title: item.title || '',
          author: item.storyAuthor || '',
          year: item.storyYear || item.year || '',
          url: item.storyUrl || '',
          containedInBookId: item.storyContainedInBookId || '',
          coverUrl: item.storyCoverUrl || ''
        });
        setters.setShowShortStoryForm(true);
        break;
      case 'webvideo':
        setters.setWebVideoFormData({
          title: item.title || '',
          url: item.webVideoUrl || '',
          description: item.webVideoDescription || ''
        });
        setters.setShowWebVideoForm(true);
        break;
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, item, index) => {
    setIsDragging(true);
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e) => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e, dropIndex, viewingOrderItems, setMessage, refreshOrderItems) => {
    e.preventDefault();
    setIsDragging(false);
    setDragOverIndex(null);

    if (!draggedItem || !viewingOrderItems) return;

    const draggedIndex = viewingOrderItems.items.findIndex(item => item.id === draggedItem.id);
    
    if (draggedIndex === dropIndex) {
      setDraggedItem(null);
      return;
    }

    try {
      const response = await fetch(`/api/custom-orders/${viewingOrderItems.id}/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromIndex: draggedIndex,
          toIndex: dropIndex
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder items');
      }

      await refreshOrderItems();
      setMessage('Items reordered successfully!');
    } catch (error) {
      console.error('Error reordering items:', error);
      setMessage('Error reordering items');
    }

    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  return {
    // State
    isDragging,
    draggedItem,
    dragOverItem,
    dragOverIndex,

    // Order handlers
    handleViewOrder,
    handleBackToOrderList,
    handleCreateOrder,
    handleToggleActive,
    handleDeleteOrder,
    handleEditOrder,
    handleUpdateOrder,

    // Item handlers
    handleEditItem,

    // Drag and drop handlers
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  };
};

export default useCustomOrderHandlers;
