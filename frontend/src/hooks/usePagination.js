import { useState, useMemo } from 'react';

/**
 * Custom hook for handling pagination logic
 * @param {Array} data - The data array to paginate
 * @param {number} itemsPerPage - Number of items per page (default: 10)
 * @param {number} initialPage - Initial page number (default: 1)
 * @returns {Object} Pagination state and controls
 */
const usePagination = (data = [], itemsPerPage = 10, initialPage = 1) => {
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Calculate pagination values
  const paginationData = useMemo(() => {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = data.slice(startIndex, endIndex);

    return {
      currentData,
      totalItems,
      totalPages,
      currentPage,
      itemsPerPage,
      startIndex,
      endIndex: Math.min(endIndex, totalItems),
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };
  }, [data, itemsPerPage, currentPage]);

  // Navigation functions
  const goToPage = (page) => {
    const pageNumber = Math.max(1, Math.min(page, paginationData.totalPages));
    setCurrentPage(pageNumber);
  };

  const goToNextPage = () => {
    if (paginationData.hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (paginationData.hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const goToFirstPage = () => {
    setCurrentPage(1);
  };

  const goToLastPage = () => {
    setCurrentPage(paginationData.totalPages);
  };

  // Reset to first page when data changes
  const resetPagination = () => {
    setCurrentPage(1);
  };

  return {
    ...paginationData,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    resetPagination,
  };
};

export default usePagination;
