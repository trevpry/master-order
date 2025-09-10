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
  onDeleteOrder
}) => {
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
        <Stat label="Total Items" value={order.items.length} />
        <Stat label="Completed" value={order.items.filter(item => item.isWatched).length} />
      </div>
      
      <div className="order-meta">
        <DateDisplay date={order.createdAt} label="Created" />
        {(order.plexPlaylist || order.customPlaylist) && (
          <PlaylistDisplay order={order} />
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
      </div>
    </div>
  );
};

export default OrderCard;
