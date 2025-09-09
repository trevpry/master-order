import React from 'react';

const FormSeparator = ({ text = "OR" }) => {
  return (
    <div className="form-group">
      <span className="form-separator">{text}</span>
    </div>
  );
};

export default FormSeparator;
