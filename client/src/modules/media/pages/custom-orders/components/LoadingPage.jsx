import React from 'react';

const LoadingPage = ({ 
  title = "Custom Orders", 
  message = "Loading custom orders..." 
}) => {
  return (
    <main>
      <h2>{title}</h2>
      <p>{message}</p>
    </main>
  );
};

export default LoadingPage;
