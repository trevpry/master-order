import React from 'react';

const MessageDisplay = ({ message }) => {
  if (!message) return null;

  return (
    <div className="message">
      <p>{message}</p>
    </div>
  );
};

export default MessageDisplay;
