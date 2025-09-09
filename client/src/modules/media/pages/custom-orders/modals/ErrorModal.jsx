import React from 'react';
import Button from '../../../../../shared/components/Button';

const ErrorModal = ({
  isOpen,
  onClose,
  errorDetails
}) => {
  if (!isOpen || !errorDetails) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h2 className="text-xl font-bold text-red-600 mb-2">
            {errorDetails.title || 'Error'}
          </h2>
          
          <div className="space-y-2">
            {errorDetails.message && (
              <div>
                <span className="font-medium">Message:</span>
                <p className="text-gray-700">{errorDetails.message}</p>
              </div>
            )}
            
            {errorDetails.error && (
              <div>
                <span className="font-medium">Error:</span>
                <p className="text-gray-700 break-words">{errorDetails.error}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button
            onClick={onClose}
            className="px-6"
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
