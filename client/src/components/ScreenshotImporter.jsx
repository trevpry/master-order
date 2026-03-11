import React, { useState, useRef } from 'react';
import { Camera, Upload, X, User, AlertCircle, Check } from 'lucide-react';
import { Button } from './ui/button';
import config from '../config';

const ScreenshotImporter = ({ onConnectionCreated, onClose }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setError('Please select image files only');
      return;
    }

    setError(null);
    const newFiles = imageFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      url: URL.createObjectURL(file),
      name: file.name
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id) => {
    setSelectedFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      // Cleanup object URL
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      return updated;
    });
  };

  const processScreenshots = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one screenshot');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // For now, create a simple form with basic OCR-like functionality
      // In a full implementation, this would use actual OCR services
      const mockExtractedData = {
        guyName: 'Profile from Screenshot',
        age: '',
        location: '',
        bio: 'Imported from screenshot',
        notes: `Screenshots imported: ${selectedFiles.map(f => f.name).join(', ')}`
      };

      setExtractedData(mockExtractedData);
    } catch (error) {
      console.error('Error processing screenshots:', error);
      setError('Failed to process screenshots. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!extractedData) return;

    try {
      setProcessing(true);

      const connectionData = {
        guyName: extractedData.guyName || 'Profile from Screenshot',
        age: extractedData.age || '',
        location: extractedData.location || '',
        bio: extractedData.bio || 'Imported from screenshot',
        notes: extractedData.notes || '',
        source: 'screenshot_import',
        userId: 1 // Default user ID
      };

      const response = await fetch(`${config.apiBaseUrl}/api/dating/connections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connectionData),
      });

      if (response.ok) {
        const newConnection = await response.json();
        onConnectionCreated(newConnection);
        
        // Cleanup
        selectedFiles.forEach(file => {
          if (file.url?.startsWith('blob:')) {
            URL.revokeObjectURL(file.url);
          }
        });
        
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create connection');
      }
    } catch (error) {
      console.error('Error creating connection:', error);
      setError('Failed to create connection. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Camera className="w-5 h-5 mr-2 text-blue-600" />
            Import Screenshots
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Screenshot Import Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Take clear screenshots of dating app profiles</li>
                  <li>Include profile photos and basic info</li>
                  <li>Multiple screenshots can be processed together</li>
                  <li>Currently supports manual data entry (OCR coming soon)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Screenshots
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Click to select screenshots or drag and drop
              </p>
              <p className="text-sm text-gray-500">
                Supports JPG, PNG, and other image formats
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected Files ({selectedFiles.length})
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center">
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-10 h-10 object-cover rounded mr-3"
                      />
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Extracted Data Preview */}
          {extractedData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    Ready to create connection:
                  </p>
                  <div className="text-sm text-green-700 space-y-1">
                    <p><strong>Name:</strong> {extractedData.guyName}</p>
                    <p><strong>Bio:</strong> {extractedData.bio}</p>
                    <p><strong>Notes:</strong> {extractedData.notes}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {!extractedData ? (
              <Button 
                onClick={processScreenshots}
                disabled={processing || selectedFiles.length === 0}
              >
                {processing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Process Screenshots
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={handleCreateConnection}
                disabled={processing}
              >
                {processing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  <>
                    <User className="w-4 h-4 mr-2" />
                    Create Connection
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenshotImporter;
