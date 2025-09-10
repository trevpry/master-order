import React from 'react';

const MusicBreadcrumb = ({ breadcrumbs }) => {
  return (
    <div className="breadcrumb-nav">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="breadcrumb-separator">›</span>}
          <button
            className={`breadcrumb-item ${index === breadcrumbs.length - 1 ? 'current' : ''}`}
            onClick={crumb.onClick}
            disabled={index === breadcrumbs.length - 1}
          >
            {crumb.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export default MusicBreadcrumb;
