import React from 'react';
import Button from '../../../../../shared/components/Button';
import EmptyState from './EmptyState';
import OrderCard from './OrderCard';
import PreviewLabel from './PreviewLabel';
import HelpText from './HelpText';
import FormSeparator from './FormSeparator';

const OrderListView = ({
  showCreateForm,
  setShowCreateForm,
  formData,
  setFormData,
  editingOrder,
  setEditingOrder,
  setMessage,
  selectedParentId,
  setSelectedParentId,
  customOrders,
  availableParents,
  availablePlaylists,
  availableBackgrounds,
  availableGalleries,
  backgroundsLoading,
  playlistsLoading,
  fetchAvailableParents,
  fetchAvailablePlaylists,
  fetchAvailableBackgrounds,
  onCreateOrder,
  onUpdateOrder,
  onViewOrder,
  onToggleActive,
  onEditOrder,
  onDeleteOrder
}) => {
  const handleCreateFormToggle = () => {
    setShowCreateForm(!showCreateForm);
    setFormData({ 
      name: '', 
      description: '', 
      icon: '', 
      playlistRatingKey: '', 
      customPlaylistId: '',
      backgroundImageId: '',
      backgroundGalleryId: ''
    });
    setEditingOrder(null);
    setMessage('');
    setSelectedParentId(null);
    if (!showCreateForm) {
      fetchAvailableParents(); // Load available parent orders when opening form
      fetchAvailablePlaylists(); // Load available playlists when opening form
      fetchAvailableBackgrounds(); // Load available backgrounds when opening form
    }
  };

  const handleCancelEdit = () => {
    setEditingOrder(null);
    setFormData({ name: '', description: '', icon: '', playlistRatingKey: '', customPlaylistId: '', backgroundImageId: '', backgroundGalleryId: '' });
    setMessage('');
  };

  const renderOrderForm = (isEditing = false) => (
    <div className="create-form">
      <h3>{isEditing ? 'Edit Custom Order' : 'Create New Custom Order'}</h3>
      <form onSubmit={isEditing ? onUpdateOrder : onCreateOrder}>
        <div className="form-group">
          <label htmlFor={isEditing ? 'editOrderName' : 'orderName'}>Order Name *</label>
          <input
            type="text"
            id={isEditing ? 'editOrderName' : 'orderName'}
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g., Marvel Movies & Shows"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor={isEditing ? 'editOrderDescription' : 'orderDescription'}>Description</label>
          <textarea
            id={isEditing ? 'editOrderDescription' : 'orderDescription'}
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Optional description of this custom order..."
            rows="3"
          />
        </div>
        
        {!isEditing && (
          <div className="form-group">
            <label htmlFor="parentOrder">Parent Order (Optional)</label>
            <select
              id="parentOrder"
              value={selectedParentId || ''}
              onChange={(e) => setSelectedParentId(e.target.value || null)}
            >
              <option value="">-- None (Top-level order) --</option>
              {availableParents.map(parent => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </select>
            <small className="form-help">
              If selected, this order will become a sub-order and won't be independently selectable by "Get Up Next"
            </small>
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor={isEditing ? 'editOrderIcon' : 'orderIcon'}>Icon (SVG)</label>
          <textarea
            id={isEditing ? 'editOrderIcon' : 'orderIcon'}
            value={formData.icon}
            onChange={(e) => setFormData({...formData, icon: e.target.value})}
            placeholder="Paste SVG icon code here (optional)..."
            rows="3"
          />
          {formData.icon && (
            <div className="icon-preview">
              <PreviewLabel />
              <div 
                className="custom-order-icon" 
                dangerouslySetInnerHTML={{__html: formData.icon}}
              />
            </div>
          )}
        </div>
        
        {/* Playlist Selection Section */}
        <div className="form-section">
          <h4>Music Playlist Integration (Optional)</h4>
          <HelpText>Link this custom order to a music playlist to enhance the storytelling experience.</HelpText>
          
          <div className="form-group">
            <label htmlFor={isEditing ? 'editPlexPlaylist' : 'plexPlaylist'}>Plex Playlist</label>
            <select
              id={isEditing ? 'editPlexPlaylist' : 'plexPlaylist'}
              value={formData.playlistRatingKey}
              onChange={(e) => {
                setFormData({
                  ...formData, 
                  playlistRatingKey: e.target.value,
                  customPlaylistId: '' // Clear custom playlist if Plex is selected
                });
              }}
              disabled={playlistsLoading}
            >
              <option value="">-- Select Plex Playlist --</option>
              {(availablePlaylists.plex || []).map(playlist => (
                <option key={playlist.ratingKey} value={playlist.ratingKey}>
                  {playlist.title} ({playlist.leafCount || 0} tracks)
                </option>
              ))}
            </select>
            {playlistsLoading && <small className="form-help">Loading playlists...</small>}
          </div>
          
          <FormSeparator />
          
          <div className="form-group">
            <label htmlFor={isEditing ? 'editCustomPlaylist' : 'customPlaylist'}>Custom Playlist</label>
            <select
              id={isEditing ? 'editCustomPlaylist' : 'customPlaylist'}
              value={formData.customPlaylistId}
              onChange={(e) => {
                setFormData({
                  ...formData, 
                  customPlaylistId: e.target.value,
                  playlistRatingKey: '' // Clear Plex playlist if custom is selected
                });
              }}
              disabled={playlistsLoading}
            >
              <option value="">-- Select Custom Playlist --</option>
              {(availablePlaylists.custom || []).map(playlist => (
                <option key={playlist.id} value={playlist.id.toString()}>
                  {playlist.title} ({playlist.trackCount || 0} tracks)
                </option>
              ))}
            </select>
          </div>
          
          {(formData.playlistRatingKey || formData.customPlaylistId) && (
            <div className="form-help">
              <strong>Note:</strong> The selected playlist will be associated with this custom order and can be used for enhanced media experiences.
            </div>
          )}
        </div>
        
        {/* Background Selection Section */}
        <div className="form-section">
          <h4>Background Image Integration (Optional)</h4>
          <HelpText>Link this custom order to a background image or gallery to enhance the visual experience.</HelpText>
          
          <div className="form-group">
            <label htmlFor={isEditing ? 'editBackgroundImage' : 'backgroundImage'}>Single Background Image</label>
            <select
              id={isEditing ? 'editBackgroundImage' : 'backgroundImage'}
              value={formData.backgroundImageId}
              onChange={(e) => {
                setFormData({
                  ...formData, 
                  backgroundImageId: e.target.value,
                  backgroundGalleryId: '' // Clear gallery if single image is selected
                });
              }}
              disabled={backgroundsLoading}
            >
              <option value="">-- Select Background Image --</option>
              {availableBackgrounds.map(bg => (
                <option key={bg.id} value={bg.id.toString()}>
                  {bg.originalName} ({bg.width}x{bg.height})
                </option>
              ))}
            </select>
            {backgroundsLoading && <small className="form-help">Loading backgrounds...</small>}
          </div>
          
          <FormSeparator />
          
          <div className="form-group">
            <label htmlFor={isEditing ? 'editBackgroundGallery' : 'backgroundGallery'}>Background Gallery</label>
            <select
              id={isEditing ? 'editBackgroundGallery' : 'backgroundGallery'}
              value={formData.backgroundGalleryId}
              onChange={(e) => {
                setFormData({
                  ...formData, 
                  backgroundGalleryId: e.target.value,
                  backgroundImageId: '' // Clear single image if gallery is selected
                });
              }}
              disabled={backgroundsLoading}
            >
              <option value="">-- Select Background Gallery --</option>
              {availableGalleries.map(gallery => (
                <option key={gallery.id} value={gallery.id.toString()}>
                  {gallery.name} ({gallery.images?.length || 0} images)
                </option>
              ))}
            </select>
          </div>
          
          {(formData.backgroundImageId || formData.backgroundGalleryId) && (
            <div className="form-help">
              <strong>Note:</strong> The selected background will be associated with this custom order and accessible via the Android API.
            </div>
          )}
        </div>
        
        <div className="form-actions">
          <Button type="submit" className="primary">
            {isEditing ? 'Update Order' : 'Create Order'}
          </Button>
          <Button 
            type="button" 
            onClick={isEditing ? handleCancelEdit : () => setShowCreateForm(false)}
            className="secondary"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      {/* Create New Order Button */}
      <div className="custom-orders-header">
        <Button onClick={handleCreateFormToggle}>
          {showCreateForm ? 'Cancel' : 'Create New Custom Order'}
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && renderOrderForm(false)}

      {/* Edit Form */}
      {editingOrder && renderOrderForm(true)}

      {/* Custom Orders List */}
      <div className="orders-list">
        {customOrders.length === 0 ? (
          <EmptyState title="No custom orders yet. Create your first custom order to get started!" />
        ) : (
          <div className="orders-grid">
            {customOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onViewOrder={onViewOrder}
                onToggleActive={onToggleActive}
                onEditOrder={onEditOrder}
                onDeleteOrder={onDeleteOrder}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default OrderListView;
