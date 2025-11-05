import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import Pagination from './Pagination';
import usePagination from '../hooks/usePagination';

const ResponsiveTable = ({
  data = [],
  columns = [],
  title = "Data Table",
  onRowClick = null,
  loading = false,
  emptyMessage = "No data available",
  mobileBreakpoint = 'md', // sm, md, lg, xl
  itemsPerPage = 10,
  showPagination = true
}) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Sort data first
  const sortedData = React.useMemo(() => {
    // Ensure data is always an array
    const safeData = Array.isArray(data) ? data : [];

    if (!sortColumn) return safeData;

    return [...safeData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortColumn, sortDirection]);

  // Pagination logic - use sorted data for pagination
  const {
    currentData,
    totalItems,
    totalPages,
    currentPage,
    goToPage,
    resetPagination
  } = usePagination(sortedData, itemsPerPage);

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const toggleRowExpansion = (rowIndex) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowIndex)) {
      newExpanded.delete(rowIndex);
    } else {
      newExpanded.add(rowIndex);
    }
    setExpandedRows(newExpanded);
  };

  // Update pagination when data or sorting changes
  React.useEffect(() => {
    resetPagination();
  }, [data, sortColumn, sortDirection, resetPagination]);

  // Get the data to display (sorted and paginated)
  const displayData = showPagination ? currentData : sortedData;

  const renderCellContent = (item, column) => {
    if (column.render) {
      return column.render(item[column.key], item);
    }
    return item[column.key];
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Ensure data is always an array for length check
  const safeDataForCheck = Array.isArray(data) ? data : [];

  if (safeDataForCheck.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {title && (
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
        </div>
      )}

      {/* Desktop Table */}
      <div className={`hidden ${mobileBreakpoint}:block overflow-x-auto`}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.title}</span>
                    {column.sortable && sortColumn === column.key && (
                      sortDirection === 'asc' ? (
                        <ChevronUpIcon className="h-4 w-4" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayData.map((item, index) => (
              <tr
                key={index}
                className={`${
                  onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                } transition-colors duration-150`}
                onClick={() => onRowClick && onRowClick(item)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {renderCellContent(item, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className={`${mobileBreakpoint}:hidden`}>
        <div className="divide-y divide-gray-200">
          {displayData.map((item, index) => {
            const isExpanded = expandedRows.has(index);
            const primaryColumn = columns.find(col => col.primary) || columns[0];
            const secondaryColumn = columns.find(col => col.secondary) || columns[1];
            const remainingColumns = columns.filter(col => !col.primary && !col.secondary);

            return (
              <div key={index} className="p-4">
                <div 
                  className={`flex items-center justify-between ${
                    onRowClick || remainingColumns.length > 0 ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => {
                    if (remainingColumns.length > 0) {
                      toggleRowExpansion(index);
                    }
                    if (onRowClick) {
                      onRowClick(item);
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    {primaryColumn && (
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {renderCellContent(item, primaryColumn)}
                      </p>
                    )}
                    {secondaryColumn && (
                      <p className="text-sm text-gray-500 truncate">
                        {renderCellContent(item, secondaryColumn)}
                      </p>
                    )}
                  </div>
                  
                  {remainingColumns.length > 0 && (
                    <div className="ml-2 flex-shrink-0">
                      {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && remainingColumns.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                      {remainingColumns.map((column) => (
                        <div key={column.key}>
                          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {column.title}
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {renderCellContent(item, column)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={goToPage}
          className="mt-4"
        />
      )}
    </div>
  );
};

export default ResponsiveTable;
