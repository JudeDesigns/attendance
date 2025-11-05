import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  MinusCircleIcon
} from '@heroicons/react/24/outline';
import { employeeAPI } from '../services/api';
import EmployeeForm from '../components/EmployeeForm';
import ResponsiveTable from '../components/ResponsiveTable';
import TouchButton from '../components/TouchButton';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';

const EmployeeList = () => {
  const queryClient = useQueryClient();
  
  // State management
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch employees
  const { data: employeesData, isLoading, error } = useQuery(
    'employees', 
    () => employeeAPI.list(),
    {
      refetchOnWindowFocus: false,
    }
  );

  // Fetch roles for filtering
  const { data: rolesData } = useQuery('roles', () => employeeAPI.getRoles());

  // Delete mutation (hard delete)
  const deleteMutation = useMutation(employeeAPI.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('employees');
    },
  });

  // Terminate mutation (soft delete)
  const terminateMutation = useMutation(employeeAPI.terminate, {
    onSuccess: () => {
      queryClient.invalidateQueries('employees');
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation(
    ({ id, action }) => {
      return action === 'activate' 
        ? employeeAPI.activate(id) 
        : employeeAPI.deactivate(id);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('employees');
      },
    }
  );

  // Filter employees based on search and filters
  const filteredEmployees = (employeesData?.data?.results || employeesData?.results || [])?.filter(employee => {
    const matchesSearch =
      employee.user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || employee.employment_status === statusFilter;
    const matchesRole = roleFilter === 'ALL' || employee.role?.name === roleFilter || employee.role_name === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  }) || [];

  // Pagination for filtered employees
  const {
    currentData: paginatedEmployees,
    totalItems: totalEmployees,
    totalPages: employeePages,
    currentPage: employeePage,
    goToPage: goToEmployeePage
  } = usePagination(filteredEmployees, 10);

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = async (employee) => {
    const employeeName = `${employee.user.first_name} ${employee.user.last_name}`;

    // Show options dialog
    const action = window.confirm(
      `Choose how to remove ${employeeName}:\n\n` +
      `Click "OK" for PERMANENT DELETION (completely removes employee and user account)\n` +
      `Click "Cancel" then use "Terminate" button for soft deletion (keeps records but marks as terminated)`
    );

    if (action) {
      // Confirm permanent deletion
      const confirmPermanent = window.confirm(
        `⚠️ PERMANENT DELETION WARNING ⚠️\n\n` +
        `This will PERMANENTLY DELETE:\n` +
        `• Employee: ${employeeName}\n` +
        `• User account: ${employee.user.username}\n` +
        `• All associated data\n\n` +
        `This action CANNOT be undone!\n\n` +
        `Are you absolutely sure you want to PERMANENTLY DELETE this employee?`
      );

      if (confirmPermanent) {
        try {
          await deleteMutation.mutateAsync(employee.id);
          alert(`Employee ${employeeName} has been permanently deleted.`);
        } catch (error) {
          alert('Failed to delete employee: ' + error.message);
        }
      }
    }
  };

  const handleTerminate = async (employee) => {
    const employeeName = `${employee.user.first_name} ${employee.user.last_name}`;

    if (window.confirm(
      `Terminate ${employeeName}?\n\n` +
      `This will:\n` +
      `• Set employment status to TERMINATED\n` +
      `• Deactivate user account\n` +
      `• Keep all records for historical purposes\n\n` +
      `This action can be reversed by reactivating the employee.`
    )) {
      try {
        await terminateMutation.mutateAsync(employee.id);
        alert(`Employee ${employeeName} has been terminated.`);
      } catch (error) {
        alert('Failed to terminate employee: ' + error.message);
      }
    }
  };

  const handleToggleStatus = async (employee) => {
    const action = employee.employment_status === 'ACTIVE' ? 'deactivate' : 'activate';
    const actionText = action === 'activate' ? 'activate' : 'deactivate';
    
    if (window.confirm(`Are you sure you want to ${actionText} ${employee.user.first_name} ${employee.user.last_name}?`)) {
      try {
        await toggleStatusMutation.mutateAsync({ id: employee.id, action });
      } catch (error) {
        alert(`Failed to ${actionText} employee: ` + error.message);
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingEmployee(null);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'ACTIVE': { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon, text: 'Active' },
      'INACTIVE': { color: 'bg-gray-100 text-gray-800', icon: XCircleIcon, text: 'Inactive' },
      'TERMINATED': { color: 'bg-red-100 text-red-800', icon: XCircleIcon, text: 'Terminated' },
      'ON_LEAVE': { color: 'bg-yellow-100 text-yellow-800', icon: UserIcon, text: 'On Leave' },
    };
    
    const config = statusConfig[status] || statusConfig['INACTIVE'];
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-status-error p-4">
        <div className="glass-text-primary">
          Error loading employees: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold glass-text-primary">Employee Management</h1>
            <p className="mt-2 text-sm glass-text-secondary">
              Manage employee accounts, roles, and status
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => setShowForm(true)}
              className="uber-button-primary inline-flex items-center"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Employee
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FunnelIcon className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="TERMINATED">Terminated</option>
                  <option value="ON_LEAVE">On Leave</option>
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ALL">All Roles</option>
                  {(rolesData?.data?.results || rolesData?.results || [])?.map(role => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {paginatedEmployees.length} of {filteredEmployees.length} employees
        {filteredEmployees.length !== (employeesData?.results?.length || 0) &&
          ` (filtered from ${employeesData?.results?.length || 0} total)`
        }
      </div>

      {/* Employee Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {paginatedEmployees.length === 0 ? (
            <li className="px-6 py-12 text-center">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No employees found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== 'ALL' || roleFilter !== 'ALL' 
                  ? 'Try adjusting your search or filters.'
                  : 'Get started by adding a new employee.'
                }
              </p>
            </li>
          ) : (
            paginatedEmployees.map((employee) => (
              <li key={employee.id}>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <UserIcon className="h-6 w-6 text-gray-600" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.user.first_name} {employee.user.last_name}
                        </div>
                        <div className="ml-2">
                          {getStatusBadge(employee.employment_status)}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {employee.user.email} • {employee.employee_id} • {employee.role?.name || employee.role_name}
                      </div>
                      {employee.job_title && (
                        <div className="text-sm text-gray-500">
                          {employee.job_title}
                          {employee.department && ` • ${employee.department}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleStatus(employee)}
                      className={`inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full ${
                        employee.employment_status === 'ACTIVE'
                          ? 'text-red-700 bg-red-100 hover:bg-red-200'
                          : 'text-green-700 bg-green-100 hover:bg-green-200'
                      }`}
                      disabled={toggleStatusMutation.isLoading}
                    >
                      {employee.employment_status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleEdit(employee)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit Employee"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleTerminate(employee)}
                      className="text-orange-600 hover:text-orange-900"
                      disabled={terminateMutation.isLoading}
                      title="Terminate Employee (Soft Delete - Keeps Records)"
                    >
                      <MinusCircleIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(employee)}
                      className="text-red-600 hover:text-red-900"
                      disabled={deleteMutation.isLoading}
                      title="Permanently Delete Employee (Hard Delete - Removes All Data)"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Pagination for employees */}
      {filteredEmployees.length > 10 && (
        <Pagination
          currentPage={employeePage}
          totalPages={employeePages}
          totalItems={totalEmployees}
          itemsPerPage={10}
          onPageChange={goToEmployeePage}
          className="mt-4"
        />
      )}

      {/* Employee Form Modal */}
      {showForm && (
        <EmployeeForm
          employee={editingEmployee}
          onClose={handleFormClose}
          onSuccess={() => {
            queryClient.invalidateQueries('employees');
            handleFormClose();
          }}
        />
      )}
    </div>
  );
};

export default EmployeeList;
