/**
 * Scroll helper functions for items list navigation
 */

/**
 * Scroll to the top of the items list
 */
export const scrollToTop = () => {
  const itemsList = document.querySelector('.items-list');
  if (itemsList) {
    itemsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

/**
 * Scroll to the bottom of the items list
 */
export const scrollToBottom = () => {
  const itemsList = document.querySelector('.items-list');
  if (itemsList) {
    const lastItem = itemsList.lastElementChild;
    if (lastItem) {
      lastItem.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }
};
