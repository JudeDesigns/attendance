import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  showInfo = true,
  className = ''
}) => {
  // Don't render if there's only one page or no items
  if (totalPages <= 1 || totalItems === 0) {
    return null;
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, current page range, and last page
      if (currentPage <= 4) {
        // Near the beginning
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Near the end
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <div className={`glass-card p-4 ${className}`}>
      <div className="flex items-center justify-between">
        {/* Info text */}
        {showInfo && (
          <div className="flex-1 flex justify-between sm:hidden">
            <span className="text-sm glass-text-secondary">
              Page {currentPage} of {totalPages}
            </span>
          </div>
        )}
        
        {showInfo && (
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm glass-text-secondary">
                Showing <span className="font-medium glass-text-primary">{startItem}</span> to{' '}
                <span className="font-medium glass-text-primary">{endItem}</span> of{' '}
                <span className="font-medium glass-text-primary">{totalItems}</span> results
              </p>
            </div>
          </div>
        )}

        {/* Pagination controls */}
        <div className="flex-1 flex justify-center sm:justify-end">
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            {/* Previous button */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center px-2 py-2 rounded-l-md border text-sm font-medium transition-all duration-200 ${
                currentPage === 1
                  ? 'glass-button-disabled cursor-not-allowed'
                  : 'glass-button-secondary hover:glass-button-secondary-hover'
              }`}
            >
              <span className="sr-only">Previous</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Page numbers */}
            {pageNumbers.map((page, index) => (
              <React.Fragment key={index}>
                {page === '...' ? (
                  <span className="relative inline-flex items-center px-4 py-2 border glass-button-secondary text-sm font-medium">
                    ...
                  </span>
                ) : (
                  <button
                    onClick={() => handlePageChange(page)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-all duration-200 ${
                      page === currentPage
                        ? 'glass-button-primary z-10'
                        : 'glass-button-secondary hover:glass-button-secondary-hover'
                    }`}
                  >
                    {page}
                  </button>
                )}
              </React.Fragment>
            ))}

            {/* Next button */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border text-sm font-medium transition-all duration-200 ${
                currentPage === totalPages
                  ? 'glass-button-disabled cursor-not-allowed'
                  : 'glass-button-secondary hover:glass-button-secondary-hover'
              }`}
            >
              <span className="sr-only">Next</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
