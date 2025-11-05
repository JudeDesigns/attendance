import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from 'react-query';
import { schedulingAPI, employeeAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserGroupIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  DocumentTextIcon,
  FilterIcon,
  UserIcon,
  CalendarDaysIcon,
  ChatBubbleLeftEllipsisIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AdminLeaveManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterLeaveType, setFilterLeaveType] = useState('all');
  const [showInitializeModal, setShowInitializeModal] = useState(false);
  const [initializeYear, setInitializeYear] = useState(new Date().getFullYear());
  const [initializeMode, setInitializeMode] = useState('bulk'); // 'bulk' or 'individual'
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [manualAllocation, setManualAllocation] = useState('');
  const [carriedOverDays, setCarriedOverDays] = useState('');


  // Fetch employees
  const { data: employeesData } = useQuery('employees', () => employeeAPI.list());
  const employees = employeesData?.data?.results || [];

  // Fetch leave types
  const { data: leaveTypesData } = useQuery('leaveTypes', () => schedulingAPI.getLeaveTypes());
  const leaveTypes = leaveTypesData?.data?.results || [];

  // Fetch leave requests (admin view - all requests)
  const { data: leaveRequestsData, isLoading } = useQuery(
    ['admin-leave-requests', filterStatus, filterEmployee, filterLeaveType],
    () => schedulingAPI.getLeaveRequests({
      status: filterStatus !== 'all' ? filterStatus : undefined,
      employee: filterEmployee !== 'all' ? filterEmployee : undefined,
      leave_type: filterLeaveType !== 'all' ? filterLeaveType : undefined,
    }),
    {
      refetchInterval: 30000,
    }
  );

  const leaveRequests = leaveRequestsData?.data?.results || [];

  // Fetch leave balances for all employees
  const { data: leaveBalancesData } = useQuery('admin-leave-balances', () => 
    schedulingAPI.getLeaveBalances()
  );
  const leaveBalances = leaveBalancesData?.data?.results || [];

  // Mutations
  const approveRequestMutation = useMutation(
    ({ id, data }) => schedulingAPI.approveLeaveRequest(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-leave-requests']);
        queryClient.invalidateQueries(['admin-leave-balances']);
        toast.success('Leave request approved successfully');
        setShowApprovalModal(false);
        setSelectedRequest(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to approve request');
      },
    }
  );

  const rejectRequestMutation = useMutation(
    ({ id, reason }) => schedulingAPI.rejectLeaveRequest(id, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-leave-requests']);
        toast.success('Leave request rejected successfully');
        setShowRejectModal(false);
        setShowApprovalModal(false);
        setSelectedRequest(null);
        setRejectionReason('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to reject request');
      },
    }
  );

  // Initialize leave balances mutation (bulk)
  const initializeBalancesMutation = useMutation(
    (year) => schedulingAPI.initializeLeaveBalances(year),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries(['admin-leave-balances']);
        // Handle axios response structure - response.data contains the actual API response
        const data = response?.data || response;
        const createdCount = data?.created_count ?? 0;
        const year = data?.year ?? initializeYear;
        toast.success(`Successfully initialized ${createdCount} leave balances for ${year}`);
        resetModalState();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to initialize leave balances');
      },
    }
  );

  // Create or update individual leave balance mutation
  const createLeaveBalanceMutation = useMutation(
    (data) => schedulingAPI.createOrUpdateLeaveBalance(data),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries(['admin-leave-balances']);
        const data = response?.data || response;
        const employeeName = employees.find(emp => emp.id === selectedEmployee)?.user?.first_name || 'Employee';
        const leaveTypeName = leaveTypes.find(type => type.id === selectedLeaveType)?.display_name || 'Leave';
        const action = data?.created ? 'created' : 'updated';
        toast.success(`Successfully ${action} ${leaveTypeName} balance for ${employeeName}`);
        resetModalState();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message ||
                           error.response?.data?.error ||
                           'Failed to create/update leave balance';
        toast.error(errorMessage);
      },
    }
  );



  // Filter requests by tab
  const getFilteredRequests = () => {
    switch (activeTab) {
      case 'pending':
        return leaveRequests.filter(req => req.status === 'PENDING');
      case 'approved':
        return leaveRequests.filter(req => req.status === 'APPROVED');
      case 'rejected':
        return leaveRequests.filter(req => req.status === 'REJECTED');
      case 'all':
      default:
        return leaveRequests;
    }
  };

  const filteredRequests = getFilteredRequests();

  // Statistics
  const stats = {
    pending: leaveRequests.filter(req => req.status === 'PENDING').length,
    approved: leaveRequests.filter(req => req.status === 'APPROVED').length,
    rejected: leaveRequests.filter(req => req.status === 'REJECTED').length,
    total: leaveRequests.length,
  };

  const handleApprove = (request, approvalData) => {
    approveRequestMutation.mutate({ id: request.id, data: approvalData });
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    rejectRequestMutation.mutate({ id: selectedRequest.id, reason: rejectionReason });
  };

  const resetModalState = () => {
    setShowInitializeModal(false);
    setInitializeMode('bulk');
    setSelectedEmployee('');
    setSelectedLeaveType('');
    setManualAllocation('');
    setCarriedOverDays('');
  };

  const handleInitializeBalances = () => {
    if (!initializeYear || initializeYear < 2020 || initializeYear > 2030) {
      toast.error('Please enter a valid year (2020-2030)');
      return;
    }

    if (initializeMode === 'bulk') {
      initializeBalancesMutation.mutate(initializeYear);
    } else {
      // Individual mode validation
      if (!selectedEmployee) {
        toast.error('Please select an employee');
        return;
      }
      if (!selectedLeaveType) {
        toast.error('Please select a leave type');
        return;
      }
      if (!manualAllocation || parseFloat(manualAllocation) < 0) {
        toast.error('Please enter a valid allocation amount');
        return;
      }

      const balanceData = {
        employee: selectedEmployee,
        leave_type: selectedLeaveType,
        year: initializeYear,
        allocated_days: parseFloat(manualAllocation),
        carried_over_days: carriedOverDays ? parseFloat(carriedOverDays) : 0,
        used_days: 0,
        pending_days: 0
      };

      createLeaveBalanceMutation.mutate(balanceData);
    }
  };



  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'LOW':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold glass-text-primary">Leave Management</h1>
            <p className="glass-text-secondary">Review and approve employee leave requests</p>
          </div>
        </div>

        {/* Statistics */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center">
              <ClockIcon className="h-6 w-6 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-800">Pending</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Approved</p>
                <p className="text-2xl font-bold text-green-900">{stats.approved}</p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <XCircleIcon className="h-6 w-6 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">Rejected</p>
                <p className="text-2xl font-bold text-red-900">{stats.rejected}</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <DocumentTextIcon className="h-6 w-6 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">Total</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Employee</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.user.first_name} {employee.user.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Leave Type</label>
            <select
              value={filterLeaveType}
              onChange={(e) => setFilterLeaveType(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Types</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.display_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { key: 'pending', label: 'Pending Approval', count: stats.pending },
              { key: 'approved', label: 'Approved', count: stats.approved },
              { key: 'rejected', label: 'Rejected', count: stats.rejected },
              { key: 'all', label: 'All Requests', count: stats.total },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Requests List */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading leave requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No leave requests</h3>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === 'pending' ? 'No pending requests to review.' : 'No requests found for this filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredRequests.map((request) => (
                <div key={request.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                  {/* Header with Employee Info and Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-indigo-600" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{request.employee_name}</h3>
                        <p className="text-sm text-gray-500">Employee ID: {request.employee_id || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowApprovalModal(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 p-1 rounded-full hover:bg-indigo-50"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Leave Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                      <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">{request.leave_type_name || 'Leave Type'}</p>
                        <p className="text-xs text-blue-700">Type</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                      <ClockIcon className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">{request.days_requested || request.duration_days || 'N/A'} days</p>
                        <p className="text-xs text-green-700">Duration</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                      <CalendarIcon className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-purple-900">
                          {format(new Date(request.start_date), 'MMM d')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-purple-700">Dates</p>
                      </div>
                    </div>
                  </div>

                  {/* Reason Section */}
                  {request.reason && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border-l-4 border-gray-400">
                      <div className="flex items-start space-x-2">
                        <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Reason for Leave</p>
                          <p className="text-sm text-gray-700 mt-1">{request.reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons for Pending Requests */}
                  {request.status === 'PENDING' && (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleApprove(request, { approved_by: user.id })}
                        disabled={approveRequestMutation.isLoading}
                        className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center font-medium transition-colors"
                      >
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        Approve Request
                      </button>
                      <button
                        onClick={() => handleReject(request)}
                        disabled={rejectRequestMutation.isLoading}
                        className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center font-medium transition-colors"
                      >
                        <XCircleIcon className="h-5 w-5 mr-2" />
                        Reject Request
                      </button>
                    </div>
                  )}

                  {/* Action Button for Approved Requests */}
                  {request.status === 'APPROVED' && (
                    <div>
                      <button
                        onClick={() => handleReject(request)}
                        disabled={rejectRequestMutation.isLoading}
                        className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center font-medium transition-colors"
                      >
                        <XCircleIcon className="h-5 w-5 mr-2" />
                        Reject Approved Request
                      </button>
                    </div>
                  )}

                  {/* Approval/Rejection Info */}
                  {(request.approved_by_name || request.rejection_reason) && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">
                        {request.status === 'APPROVED' && (
                          <p>
                            <span className="font-medium text-green-700">Approved</span> by {request.approved_by_name}
                            {request.approved_at && ` on ${format(new Date(request.approved_at), 'MMM d, yyyy')}`}
                          </p>
                        )}
                        {request.status === 'REJECTED' && (
                          <>
                            <p className="font-medium text-red-700 mb-1">Request Rejected</p>
                            {request.rejection_reason && (
                              <p className="text-gray-700">
                                <span className="font-medium">Reason:</span> {request.rejection_reason}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Leave Balances Summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Employee Leave Balances</h2>
          <button
            onClick={() => setShowInitializeModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Initialize Balances
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                {leaveTypes.map((type) => (
                  <th key={type.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {type.display_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => {
                const employeeBalances = leaveBalances.filter(balance => balance.employee === employee.id);
                return (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {employee.user.first_name} {employee.user.last_name}
                      </div>
                      <div className="text-sm text-gray-500">{employee.department}</div>
                    </td>
                    {leaveTypes.map((type) => {
                      const balance = employeeBalances.find(b => b.leave_type === type.id);
                      return (
                        <td key={type.id} className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {balance ? `${balance.available_days}/${balance.allocated_days}` : '0/0'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {balance ? `Used: ${balance.used_days}` : 'No allocation'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Reject Leave Request</h3>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              {selectedRequest && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{selectedRequest.employee_name}</p>
                  <p className="text-sm text-gray-600">
                    {selectedRequest.leave_type_name} • {selectedRequest.days_requested || selectedRequest.duration_days} days
                  </p>
                  <p className="text-sm text-gray-600">
                    {format(new Date(selectedRequest.start_date), 'MMM d')} - {format(new Date(selectedRequest.end_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="rejection-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="rejection-reason"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Please provide a detailed reason for rejecting this leave request..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  disabled={!rejectionReason.trim() || rejectRequestMutation.isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {rejectRequestMutation.isLoading ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Initialize Balances Modal */}
      {showInitializeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Manage Leave Balances</h3>
                <button
                  onClick={resetModalState}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Mode Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Assignment Mode
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="bulk"
                      checked={initializeMode === 'bulk'}
                      onChange={(e) => setInitializeMode(e.target.value)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Bulk Initialize</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="individual"
                      checked={initializeMode === 'individual'}
                      onChange={(e) => setInitializeMode(e.target.value)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Individual Employee</span>
                  </label>
                </div>
              </div>

              {/* Year Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year
                </label>
                <input
                  type="number"
                  min="2020"
                  max="2030"
                  value={initializeYear}
                  onChange={(e) => setInitializeYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter year (e.g., 2025)"
                />
              </div>

              {initializeMode === 'bulk' ? (
                <div className="mb-6">
                  <p className="text-sm text-gray-600">
                    This will create leave balances for all active employees who don't have balances for the specified year.
                    Existing balances will not be modified.
                  </p>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> If a balance already exists for this employee and leave type,
                      only the allocated days and carried over days will be updated.
                      Used days and pending days will be preserved.
                    </p>
                  </div>
                </div>
              )}

              {initializeMode === 'individual' && (
                <div className="space-y-4 mb-6">
                  {/* Employee Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employee
                    </label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select an employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.user.first_name} {employee.user.last_name} ({employee.employee_id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Leave Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Leave Type
                    </label>
                    <select
                      value={selectedLeaveType}
                      onChange={(e) => setSelectedLeaveType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select leave type</option>
                      {leaveTypes.map((leaveType) => (
                        <option key={leaveType.id} value={leaveType.id}>
                          {leaveType.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Manual Allocation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allocated Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={manualAllocation}
                      onChange={(e) => setManualAllocation(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter days (e.g., 25)"
                    />
                  </div>

                  {/* Carried Over Days */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Carried Over Days (Optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={carriedOverDays}
                      onChange={(e) => setCarriedOverDays(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter carried over days (e.g., 5)"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={resetModalState}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInitializeBalances}
                  disabled={initializeBalancesMutation.isLoading || createLeaveBalanceMutation.isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(initializeBalancesMutation.isLoading || createLeaveBalanceMutation.isLoading)
                    ? (initializeMode === 'bulk' ? 'Initializing...' : 'Creating...')
                    : (initializeMode === 'bulk' ? 'Initialize Balances' : 'Create Balance')
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminLeaveManagement;
