import React, { useState } from 'react';
import Button from '../../../../../../shared/components/Button';

const SubOrderFormModal = ({
  show,
  currentOrderId,
  customOrders,
  onClose,
  onSelectOrder
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!show) return null;

  const availableOrders = (customOrders || []).filter(
    (order) => order.id !== currentOrderId
  );

  const filteredOrders = searchQuery.trim()
    ? availableOrders.filter((order) =>
        order.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableOrders;

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Add Order as Entry</h3>
          <Button onClick={handleClose} className="close-modal">
            ×
          </Button>
        </div>

        <div className="form-group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            autoFocus
          />
        </div>

        <div className="search-results" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {filteredOrders.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', padding: '1rem' }}>
              {availableOrders.length === 0
                ? 'No other orders available.'
                : 'No orders match your search.'}
            </p>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="search-result-item"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #333' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {order.icon && (
                    <span dangerouslySetInnerHTML={{ __html: order.icon }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 500 }}>{order.name}</div>
                    {order.description && (
                      <div style={{ fontSize: '0.85em', color: '#888' }}>{order.description}</div>
                    )}
                  </div>
                </div>
                <Button
                  className="primary"
                  size="small"
                  onClick={() => {
                    onSelectOrder(order);
                    handleClose();
                  }}
                >
                  Add
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SubOrderFormModal;
