/**
 * Table Scroll Helper
 * Prevents the page from scrolling when scrolling horizontally within a table
 */

// Function to initialize table scroll helpers
export function initTableScrollHelpers() {
  // Find all table containers that need scroll handling
  const tableContainers = document.querySelectorAll('.glp-table-responsive');
  
  // For each table container, add event listeners
  tableContainers.forEach(container => {
    // Add mouseenter event to set a flag when mouse is over the table
    container.addEventListener('mouseenter', () => {
      container.dataset.isHovering = 'true';
    });
    
    // Add mouseleave event to remove the flag when mouse leaves the table
    container.addEventListener('mouseleave', () => {
      container.dataset.isHovering = 'false';
      document.body.classList.remove('table-scrolling');
    });
    
    // Add wheel event to prevent page scrolling when scrolling horizontally
    container.addEventListener('wheel', (e) => {
      if (container.dataset.isHovering === 'true') {
        // If the table can scroll horizontally
        if (container.scrollWidth > container.clientWidth) {
          // Add the table-scrolling class to prevent body scroll
          document.body.classList.add('table-scrolling');
          
          // If scrolling horizontally or trying to scroll horizontally
          if (Math.abs(e.deltaX) > 0 || (Math.abs(e.deltaY) > 0 && e.shiftKey)) {
            // Let the table scroll naturally
            return;
          }
          
          // For vertical scroll wheel events, convert to horizontal scrolling
          if (Math.abs(e.deltaY) > 0) {
            e.preventDefault();
            container.scrollLeft += e.deltaY;
          }
        }
      }
    });
    
    // Add touchmove event for mobile
    container.addEventListener('touchmove', () => {
      if (container.scrollWidth > container.clientWidth) {
        document.body.classList.add('table-scrolling');
      }
    });
    
    // Add touchend event for mobile
    container.addEventListener('touchend', () => {
      document.body.classList.remove('table-scrolling');
    });
  });
}

// Export a cleanup function to remove event listeners if needed
export function cleanupTableScrollHelpers() {
  document.body.classList.remove('table-scrolling');
}

export default { initTableScrollHelpers, cleanupTableScrollHelpers }; 