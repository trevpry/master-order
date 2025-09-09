import React from 'react';
import Button from '../../../../../../shared/components/Button';

const ErrorModal = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  error 
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className="error-details">
          <p><strong>Message:</strong> {message}</p>
          {error && (
            <p><strong>Error:</strong> {error}</p>
          )}
        </div>
        <div className="form-actions">
          <Button
            type="button"
            onClick={onClose}
            className="primary"
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
