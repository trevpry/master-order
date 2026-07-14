import React from 'react';
import Button from '../../../../../shared/components/Button';
import InlineIcon from './InlineIcon';
import HierarchyIndicator from './HierarchyIndicator';
import SubOrdersBadge from './SubOrdersBadge';
import DescriptionDisplay from './DescriptionDisplay';
import StatusIndicator from './StatusIndicator';
import Stat from './Stat';
import DateDisplay from './DateDisplay';
import PlaylistDisplay from './PlaylistDisplay';

const OrderCard = ({ 
  order, 
  onViewOrder,
  onToggleActive,
  onEditOrder,
  onDeleteOrder,
  onLinkListSync
}) => {
  // Calculate stats including sub-order items
  const calculateStats = () => {
    let totalItems = 0;
    let completedItems = 0;

    (order.items || []).forEach(item => {
      if (item.mediaType === 'suborder' && item.referencedCustomOrder) {
        // Count items from the referenced sub-order
        const subOrderItems = (item.referencedCustomOrder.items || []).filter(subItem => {
          // Exclude reference books
          if (subItem.mediaType === 'book' && subItem.containedStories && subItem.containedStories.length > 0) {
            return false;
          }
          return true;
        });
        totalItems += subOrderItems.length;
        completedItems += subOrderItems.filter(subItem => subItem.isWatched).length;
      } else {
        // Regular item
        // Exclude reference books
        if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
          return;
        }
        totalItems += 1;
        if (item.isWatched) {
          completedItems += 1;
        }
      }
    });

    return { totalItems, completedItems };
  };

  const { totalItems, completedItems } = calculateStats();
  
  return (
    <div className={`order-card ${order.isActive ? 'active' : 'inactive'}`}>
      <div className="order-header">
        <div className="order-title-section">
          <div className="title-with-icon">
            <h3 
              className="clickable-title"
              onClick={() => onViewOrder(order)}
            >
              <InlineIcon icon={order.icon} />
              <HierarchyIndicator parentOrderName={order.parentOrder?.name} />
              {order.name}
              <SubOrdersBadge count={order.subOrders?.length} />
            </h3>
          </div>
          <DescriptionDisplay description={order.description} />
        </div>
        <StatusIndicator isActive={order.isActive} />
      </div>

      <div className="order-stats">
        <Stat label="Total Items" value={totalItems} />
        <Stat label="Completed" value={completedItems} />
      </div>
      
      <div className="order-meta">
        <DateDisplay date={order.createdAt} label="Created" />
        {(order.plexPlaylist || order.customPlaylist) && (
          <PlaylistDisplay order={order} />
        )}
        {order.listScrapeConfig && (
          <span className="list-linked-badge" title={`Linked to: ${order.listScrapeConfig.name || order.listScrapeConfig.url}`}>
            🔗 {order.listScrapeConfig.name || 'List Linked'} {order.listScrapeConfig.isActive ? '' : '(paused)'}
          </span>
        )}
      </div>

      <div className="order-actions">
        <Button
          onClick={() => onToggleActive(order.id, order.isActive)}
          className="secondary"
          size="small"
        >
          {order.isActive ? 'Deactivate' : 'Activate'}
        </Button>
        <Button
          onClick={() => onViewOrder(order)}
          className="primary"
          size="small"
        >
          View Items
        </Button>
        <Button
          onClick={() => onEditOrder(order)}
          className="secondary"
          size="small"
        >
          Edit
        </Button>
        <Button
          onClick={() => onDeleteOrder(order.id)}
          className="danger"
          size="small"
        >
          Delete
        </Button>
        {onLinkListSync && (
          <Button
            onClick={() => onLinkListSync(order.id, order.name)}
            className="secondary"
            size="small"
          >
            {order.listScrapeConfig ? '🔗 Edit Link' : '🔗 Link List'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
