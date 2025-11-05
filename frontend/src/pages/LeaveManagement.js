import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  PlusIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon as ExclamationIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { schedulingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ResponsiveTable from '../components/ResponsiveTable';
import MobileForm from '../components/MobileForm';
import { PrimaryButton, SecondaryButton } from '../components/TouchButton';
import toast from 'react-hot-toast';

const LeaveManagement = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  // State management
  const [activeTab, setActiveTab] = useState('my-requests');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  // Fetch leave types
  const { data: leaveTypesData } = useQuery(
    'leaveTypes',
    () => schedulingAPI.getLeaveTypes(),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
  const leaveTypes = leaveTypesData?.data?.results || [];

  // Fetch leave balances
  const { data: leaveBalancesData } = useQuery(
    'leaveBalances',
    () => schedulingAPI.getMyLeaveBalances(),
    {
      enabled: !!user?.employee_profile?.id,
    }
  );

  // Extract leave balances from API response structure
  // The my_balances endpoint returns data directly as an array, not wrapped in data.results
  const leaveBalances = leaveBalancesData?.data || leaveBalancesData || [];

  // Fetch leave requests
  const { data: leaveRequestsData, isLoading: requestsLoading } = useQuery(
    ['leaveRequests', activeTab, filterStatus],
    () => {
      if (activeTab === 'my-requests') {
        return schedulingAPI.getMyLeaveRequests(filterStatus !== 'all' ? { status: filterStatus } : {});
      } else if (activeTab === 'pending-approvals' && isAdmin) {
        return schedulingAPI.getPendingLeaveApprovals();
      }
      return { data: { results: [] } };
    },
    {
      enabled: !!user?.employee_profile?.id,
    }
  );

  // Extract leave requests from API response structure
  const leaveRequests = leaveRequestsData?.data?.results || leaveRequestsData?.results || [];

  // Create leave request mutation
  const createRequestMutation = useMutation(
    (data) => schedulingAPI.createLeaveRequest(data),
    {
      onSuccess: (response) => {
        // Invalidate all related queries to ensure UI updates
        queryClient.invalidateQueries(['leaveRequests', activeTab, filterStatus]);
        queryClient.invalidateQueries('leaveRequests');
        queryClient.invalidateQueries('leaveBalances');
        queryClient.invalidateQueries('leaveBalancesData');

        setShowRequestForm(false);

        // More informative success message
        const requestData = response?.data || response;
        toast.success(
          `Leave request submitted successfully! Your request is now ${requestData?.status || 'pending approval'}.`,
          { duration: 4000 }
        );
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.detail ||
                           error.response?.data?.message ||
                           error.response?.data?.error ||
                           'Failed to submit leave request';
        toast.error(errorMessage, { duration: 5000 });
      },
    }
  );

  // Approve leave request mutation
  const approveMutation = useMutation(
    (id) => schedulingAPI.approveLeaveRequest(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('leaveRequests');
        toast.success('Leave request approved');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to approve leave request');
      },
    }
  );

  // Reject leave request mutation
  const rejectMutation = useMutation(
    ({ id, reason }) => schedulingAPI.rejectLeaveRequest(id, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('leaveRequests');
        toast.success('Leave request rejected');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to reject leave request');
      },
    }
  );

  // Cancel leave request mutation
  const cancelMutation = useMutation(
    (id) => schedulingAPI.cancelLeaveRequest(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('leaveRequests');
        queryClient.invalidateQueries('leaveBalances');
        toast.success('Leave request cancelled');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to cancel leave request');
      },
    }
  );

  // Form fields for leave request
  const leaveRequestFields = [
    {
      name: 'leave_type',
      label: 'Leave Type',
      type: 'select',
      required: true,
      options: leaveTypes.map(type => ({
        value: type.id,
        label: type.display_name
      })),
      defaultValue: leaveTypes.length > 0 ? leaveTypes[0].id : ''
    },
    {
      name: 'start_date',
      label: 'Start Date',
      type: 'date',
      required: true,
      min: new Date().toISOString().split('T')[0]
    },
    {
      name: 'end_date',
      label: 'End Date',
      type: 'date',
      required: true,
      min: new Date().toISOString().split('T')[0]
    },
    {
      name: 'reason',
      label: 'Reason',
      type: 'textarea',
      required: true,
      rows: 3,
      placeholder: 'Please provide a reason for your leave request...'
    },
    {
      name: 'notes',
      label: 'Additional Notes',
      type: 'textarea',
      rows: 2,
      placeholder: 'Any additional information...'
    },
    {
      name: 'emergency_contact',
      label: 'Emergency Contact',
      type: 'text',
      placeholder: 'Contact person during leave'
    },
    {
      name: 'emergency_phone',
      label: 'Emergency Phone',
      type: 'tel',
      placeholder: 'Emergency contact phone number'
    }
  ];

  // Table columns for leave requests
  const requestColumns = [
    {
      key: 'leave_type_name',
      title: 'Leave Type',
      primary: true,
      sortable: true
    },
    {
      key: 'start_date',
      title: 'Start Date',
      secondary: true,
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString()
    },
    {
      key: 'end_date',
      title: 'End Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString()
    },
    {
      key: 'days_requested',
      title: 'Days',
      sortable: true
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'APPROVED' ? 'bg-green-100 text-green-800' :
          value === 'REJECTED' ? 'bg-red-100 text-red-800' :
          value === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value === 'APPROVED' && <CheckCircleIcon className="w-3 h-3 mr-1" />}
          {value === 'REJECTED' && <XCircleIcon className="w-3 h-3 mr-1" />}
          {value === 'PENDING' && <ClockIcon className="w-3 h-3 mr-1" />}
          {value}
        </span>
      )
    },
    {
      key: 'submitted_at',
      title: 'Submitted',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString()
    }
  ];

  // Add employee name column for admin view
  if (activeTab === 'pending-approvals') {
    requestColumns.splice(1, 0, {
      key: 'employee_name',
      title: 'Employee',
      sortable: true
    });
  }

  const handleSubmitRequest = (formData) => {
    // Check if user has leave balances configured
    if (!Array.isArray(leaveBalances) || leaveBalances.length === 0) {
      toast.error(
        'You do not have leave balances configured yet. Please contact your administrator to set up your leave balances before submitting requests.',
        { duration: 6000 }
      );
      return;
    }

    // Check if the selected leave type has a balance
    const selectedLeaveType = leaveTypes.find(type => type.id === parseInt(formData.leave_type));
    const hasBalanceForType = leaveBalances.some(balance =>
      balance.leave_type_name === selectedLeaveType?.display_name ||
      balance.leave_type === parseInt(formData.leave_type)
    );

    if (!hasBalanceForType) {
      toast.error(
        `You do not have a leave balance configured for ${selectedLeaveType?.display_name || 'this leave type'}. Please contact your administrator.`,
        { duration: 6000 }
      );
      return;
    }

    // Don't send employee field - it will be set automatically by the backend
    createRequestMutation.mutate(formData);
  };

  const handleApprove = (request) => {
    if (window.confirm(`Approve leave request for ${request.employee_name}?`)) {
      approveMutation.mutate(request.id);
    }
  };

  const handleReject = (request) => {
    const reason = window.prompt('Please provide a reason for rejection:');
    if (reason !== null) {
      rejectMutation.mutate({ id: request.id, reason });
    }
  };

  const handleCancel = (request) => {
    if (window.confirm('Are you sure you want to cancel this leave request?')) {
      cancelMutation.mutate(request.id);
    }
  };

  const handleRowClick = (request) => {
    setSelectedRequest(request);
  };

  const tabs = [
    { id: 'my-requests', name: 'My Requests', icon: DocumentTextIcon },
    { id: 'balances', name: 'Leave Balances', icon: CalendarIcon },
    ...(isAdmin ? [{ id: 'pending-approvals', name: 'Pending Approvals', icon: ExclamationIcon }] : [])
  ];

  const statusFilters = [
    { value: 'all', label: 'All Requests' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold glass-text-primary">Leave Management</h1>
            <p className="mt-1 text-sm glass-text-secondary">
              Manage your leave requests and view balances
            </p>
          </div>

          {activeTab === 'my-requests' && (
            <div className="mt-4 sm:mt-0">
              <PrimaryButton
                onClick={() => {
                  if (!Array.isArray(leaveBalances) || leaveBalances.length === 0) {
                    toast.error(
                      'You do not have leave balances configured yet. Please contact your administrator to set up your leave balances before submitting requests.',
                      { duration: 6000 }
                    );
                    return;
                  }
                  setShowRequestForm(true);
                }}
                icon={<PlusIcon />}
                size="medium"
              >
                New Request
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Warning Banner for Missing Leave Balances */}
      {(!Array.isArray(leaveBalances) || leaveBalances.length === 0) && (
        <div className="glass-card glass-fade-in p-4 border-l-4 border-orange-500 bg-orange-50 bg-opacity-80">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationIcon className="h-5 w-5 text-orange-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-orange-800">
                Leave Balances Not Configured
              </h3>
              <p className="mt-1 text-sm text-orange-700">
                You do not have leave balances set up yet. Please contact your administrator to configure your leave balances before submitting leave requests.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'balances' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.isArray(leaveBalances) && leaveBalances.map((balance) => (
            <div key={balance.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {balance.leave_type_name}
                </h3>
                <CalendarIcon className="w-6 h-6 text-gray-400" />
              </div>
              
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Available:</span>
                  <span className="font-medium text-green-600">
                    {balance.available_days} days
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Used:</span>
                  <span className="font-medium">{balance.used_days} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pending:</span>
                  <span className="font-medium text-yellow-600">
                    {balance.pending_days} days
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Allocated:</span>
                  <span className="font-medium">{balance.total_allocated} days</span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Usage</span>
                  <span>
                    {Math.round((balance.used_days / balance.total_allocated) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min((balance.used_days / balance.total_allocated) * 100, 100)}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}

          {(!Array.isArray(leaveBalances) || leaveBalances.length === 0) && (
            <div className="glass-empty-state">
              <CalendarIcon className="mx-auto h-12 w-12 text-blue-500" />
              <h3 className="mt-2 text-sm font-medium glass-text-primary">No leave balances configured</h3>
              <p className="mt-1 text-sm glass-text-secondary">
                Your leave balances will appear here once they are configured by your administrator.
              </p>
              <p className="mt-2 text-xs glass-text-muted">
                💡 <strong>Note:</strong> You cannot submit leave requests until your leave balances are set up.
              </p>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'my-requests' || activeTab === 'pending-approvals') && (
        <div className="space-y-4">
          {/* Filters */}
          {activeTab === 'my-requests' && (
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setFilterStatus(filter.value)}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    filterStatus === filter.value
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}

          {/* Requests Table */}
          <ResponsiveTable
            data={leaveRequests}
            columns={requestColumns}
            title={activeTab === 'my-requests' ? 'My Leave Requests' : 'Pending Approvals'}
            loading={requestsLoading}
            onRowClick={handleRowClick}
            emptyMessage="No leave requests found"
          />
        </div>
      )}

      {/* Leave Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <MobileForm
              title="New Leave Request"
              fields={leaveRequestFields}
              onSubmit={handleSubmitRequest}
              onCancel={() => setShowRequestForm(false)}
              submitText="Submit Request"
              isLoading={createRequestMutation.isLoading}
              initialData={{
                leave_type: leaveTypes.length > 0 ? leaveTypes[0].id : ''
              }}
            />
          </div>
        </div>
      )}

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Leave Request Details</h3>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Employee</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedRequest.employee_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Leave Type</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedRequest.leave_type_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedRequest.start_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedRequest.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Days Requested</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedRequest.days_requested}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <p className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedRequest.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      selectedRequest.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      selectedRequest.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedRequest.status}
                    </span>
                  </p>
                </div>
              </div>
              
              {selectedRequest.reason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedRequest.reason}</p>
                </div>
              )}
              
              {selectedRequest.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedRequest.notes}</p>
                </div>
              )}
              
              {selectedRequest.rejection_reason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rejection Reason</label>
                  <p className="mt-1 text-sm text-red-600">{selectedRequest.rejection_reason}</p>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                {activeTab === 'pending-approvals' && selectedRequest.status === 'PENDING' && (
                  <>
                    <PrimaryButton
                      onClick={() => handleApprove(selectedRequest)}
                      loading={approveMutation.isLoading}
                      size="medium"
                    >
                      Approve
                    </PrimaryButton>
                    <SecondaryButton
                      onClick={() => handleReject(selectedRequest)}
                      loading={rejectMutation.isLoading}
                      size="medium"
                    >
                      Reject
                    </SecondaryButton>
                  </>
                )}

                {/* Allow rejecting approved requests for admins */}
                {activeTab === 'pending-approvals' && selectedRequest.status === 'APPROVED' && (
                  <SecondaryButton
                    onClick={() => handleReject(selectedRequest)}
                    loading={rejectMutation.isLoading}
                    size="medium"
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    Reject Approved Request
                  </SecondaryButton>
                )}
                
                {selectedRequest.can_be_cancelled && (
                  <SecondaryButton
                    onClick={() => handleCancel(selectedRequest)}
                    loading={cancelMutation.isLoading}
                    size="medium"
                  >
                    Cancel Request
                  </SecondaryButton>
                )}
                
                <SecondaryButton
                  onClick={() => setSelectedRequest(null)}
                  size="medium"
                >
                  Close
                </SecondaryButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;
