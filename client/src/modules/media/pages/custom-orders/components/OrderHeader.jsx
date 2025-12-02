import React from 'react';
import Button from '../../../../../shared/components/Button';

const OrderHeader = ({
  viewingOrderItems,
  onBackToOrderList,
  handleViewOrder,
  getAllNonReferenceItems,
  getUnwatchedNonReferenceItems,
  setShowMovieForm,
  setShowEpisodeForm, 
  setShowBookForm,
  setShowComicForm,
  setShowShortStoryForm,
  setShowWebVideoForm,
  setShowGameForm,
  setShowBulkImportModal,
  setShowCmroBulkImportModal,
  setMovieFormData,
  setEpisodeFormData,
  setBookFormData,
  setComicFormData,
  setShortStoryFormData,
  setWebVideoFormData,
  setGameSearchQuery,
  setBulkImportData,
  setCmroBulkImportData
}) => {
  return (
    <div className="order-items-header">
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
          <span className="stat-value">
            {viewingOrderItems?.items ? getAllNonReferenceItems(viewingOrderItems.items).length : 0}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Unwatched:</span>
          <span className="stat-value">
            {viewingOrderItems?.items ? getUnwatchedNonReferenceItems(viewingOrderItems.items).length : 0}
          </span>
        </div>
      </div>

      <div className="manage-items-actions">
        <Button
          onClick={() => {
            setShowMovieForm(true);
            setMovieFormData({ title: '', year: '' });
          }}
          className="primary"
        >
          Add Movie
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
            setBookFormData({ title: '', author: '', year: '', isbn: '', pageCount: '' });
          }}
          className="secondary"
        >
          Add Book
        </Button>
        <Button
          onClick={() => {
            setShowComicForm(true);
            setComicFormData({ series: '', year: '', issue: '', title: '' });
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
            setShowWebVideoForm(true);
            setWebVideoFormData({ title: '', url: '', description: '' });
          }}
          className="secondary"
        >
          Add Web Video
        </Button>
        <Button
          onClick={() => {
            setShowGameForm(true);
            setGameSearchQuery('');
          }}
          className="secondary"
        >
          🎮 Add Video Game
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
        <Button
          onClick={() => {
            setShowCmroBulkImportModal(true);
            setCmroBulkImportData('');
          }}
          className="secondary"
        >
          CMRO Bulk Import
        </Button>
      </div>
    </div>
  );
};

export default OrderHeader;
