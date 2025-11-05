import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from 'react-query';
import { webhookAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  PlayIcon,
  PauseIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  GlobeAltIcon,
  CogIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const WebhookManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('endpoints');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);

  // Fetch webhook endpoints
  const { data: endpointsData, isLoading: endpointsLoading } = useQuery(
    'webhook-endpoints',
    () => webhookAPI.getEndpoints(),
    {
      refetchInterval: 30000,
    }
  );

  const endpoints = endpointsData?.data?.results || [];

  // Fetch webhook statistics
  const { data: statsData } = useQuery(
    'webhook-stats',
    () => webhookAPI.getStats(),
    {
      refetchInterval: 60000,
    }
  );

  const stats = statsData?.data || {};

  // Fetch webhook deliveries
  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery(
    'webhook-deliveries',
    () => webhookAPI.getDeliveries(),
    {
      enabled: activeTab === 'deliveries',
      refetchInterval: 30000,
    }
  );

  const deliveries = deliveriesData?.data?.results || [];

  // Fetch webhook events
  const { data: eventsData, isLoading: eventsLoading } = useQuery(
    'webhook-events',
    () => webhookAPI.getEvents(),
    {
      enabled: activeTab === 'events',
      refetchInterval: 30000,
    }
  );

  const events = eventsData?.data?.results || [];

  // Mutations
  const createEndpointMutation = useMutation(webhookAPI.createEndpoint, {
    onSuccess: () => {
      queryClient.invalidateQueries(['webhook-endpoints']);
      queryClient.invalidateQueries(['webhook-stats']);
      toast.success('Webhook endpoint created successfully');
      setShowCreateForm(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create endpoint');
    },
  });

  const updateEndpointMutation = useMutation(
    ({ id, data }) => webhookAPI.updateEndpoint(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['webhook-endpoints']);
        toast.success('Webhook endpoint updated successfully');
        setSelectedEndpoint(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update endpoint');
      },
    }
  );

  const deleteEndpointMutation = useMutation(webhookAPI.deleteEndpoint, {
    onSuccess: () => {
      queryClient.invalidateQueries(['webhook-endpoints']);
      queryClient.invalidateQueries(['webhook-stats']);
      toast.success('Webhook endpoint deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete endpoint');
    },
  });

  const testEndpointMutation = useMutation(
    ({ id, data }) => webhookAPI.testEndpoint(id, data),
    {
      onSuccess: (response) => {
        if (response.data.success) {
          toast.success('Test webhook sent successfully');
        } else {
          toast.error(`Test failed: ${response.data.error}`);
        }
        setShowTestModal(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to send test webhook');
      },
    }
  );

  const toggleEndpointMutation = useMutation(
    ({ id, is_active }) => webhookAPI.updateEndpoint(id, { is_active }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['webhook-endpoints']);
        toast.success('Endpoint status updated');
      },
      onError: (error) => {
        toast.error('Failed to update endpoint status');
      },
    }
  );

  const handleCreateEndpoint = (endpointData) => {
    createEndpointMutation.mutate(endpointData);
  };

  const handleUpdateEndpoint = (id, endpointData) => {
    updateEndpointMutation.mutate({ id, data: endpointData });
  };

  const handleDeleteEndpoint = (id) => {
    if (window.confirm('Are you sure you want to delete this webhook endpoint?')) {
      deleteEndpointMutation.mutate(id);
    }
  };

  const handleTestEndpoint = (endpoint, testData) => {
    testEndpointMutation.mutate({ id: endpoint.id, data: testData });
  };

  const handleToggleEndpoint = (endpoint) => {
    toggleEndpointMutation.mutate({
      id: endpoint.id,
      is_active: !endpoint.is_active,
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDeliveryStatusColor = (status) => {
    switch (status) {
      case 'SUCCESS':
        return 'text-green-600';
      case 'FAILED':
        return 'text-red-600';
      case 'PENDING':
        return 'text-yellow-600';
      case 'RETRYING':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const renderEndpoints = () => (
    <div className="space-y-6">
      {/* Create Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Webhook Endpoints</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Endpoint
        </button>
      </div>

      {/* Endpoints List */}
      {endpointsLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading endpoints...</p>
        </div>
      ) : endpoints.length === 0 ? (
        <div className="text-center py-8">
          <GlobeAltIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No webhook endpoints</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new webhook endpoint.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {endpoints.map((endpoint) => (
            <div key={endpoint.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900">{endpoint.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(endpoint.status)}`}>
                      {endpoint.status}
                    </span>
                    {endpoint.is_active ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{endpoint.url}</p>
                  {endpoint.description && (
                    <p className="text-sm text-gray-500 mt-2">{endpoint.description}</p>
                  )}
                  
                  {/* Event Types */}
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-1">
                      {endpoint.event_types.slice(0, 3).map((eventType) => (
                        <span key={eventType} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          {eventType}
                        </span>
                      ))}
                      {endpoint.event_types.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          +{endpoint.event_types.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Success Rate:</span>
                      <span className="ml-1 font-medium">{endpoint.success_rate?.toFixed(1) || 0}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Deliveries:</span>
                      <span className="ml-1 font-medium">{endpoint.total_deliveries || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Last Triggered:</span>
                      <span className="ml-1 font-medium">
                        {endpoint.last_triggered ? format(new Date(endpoint.last_triggered), 'MMM d, HH:mm') : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedEndpoint(endpoint);
                      setShowTestModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                    title="Test Endpoint"
                  >
                    <PlayIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleToggleEndpoint(endpoint)}
                    className={`${endpoint.is_active ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}`}
                    title={endpoint.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {endpoint.is_active ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => setSelectedEndpoint(endpoint)}
                    className="text-indigo-600 hover:text-indigo-800"
                    title="Edit"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteEndpoint(endpoint.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDeliveries = () => (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Recent Deliveries</h2>
      
      {deliveriesLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading deliveries...</p>
        </div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-8">
          <DocumentDuplicateIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No deliveries</h3>
          <p className="mt-1 text-sm text-gray-500">Webhook deliveries will appear here.</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {deliveries.map((delivery) => (
              <li key={delivery.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`font-medium ${getDeliveryStatusColor(delivery.status)}`}>
                        {delivery.status}
                      </span>
                      <span className="text-sm text-gray-500">{delivery.event_type}</span>
                      <span className="text-sm text-gray-500">→</span>
                      <span className="text-sm text-gray-900">{delivery.endpoint_name}</span>
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Attempt {delivery.attempt_count}</span>
                      <span>{format(new Date(delivery.created_at), 'MMM d, HH:mm:ss')}</span>
                      {delivery.http_status && (
                        <span className={`font-medium ${delivery.http_status >= 200 && delivery.http_status < 300 ? 'text-green-600' : 'text-red-600'}`}>
                          HTTP {delivery.http_status}
                        </span>
                      )}
                    </div>
                    {delivery.error_message && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                        {delivery.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {delivery.status === 'FAILED' && delivery.attempt_count < 3 && (
                      <button
                        onClick={() => {/* Implement retry */}}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderEvents = () => (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Recent Events</h2>
      
      {eventsLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8">
          <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No events</h3>
          <p className="mt-1 text-sm text-gray-500">Webhook events will appear here.</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {events.map((event) => (
              <li key={event.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">{event.event_type}</span>
                      <span className="text-sm text-gray-500">{event.resource_type}</span>
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <span>{format(new Date(event.created_at), 'MMM d, HH:mm:ss')}</span>
                      <span>{event.endpoints_notified} endpoints notified</span>
                      <span className="text-green-600">{event.successful_deliveries} successful</span>
                      {event.failed_deliveries > 0 && (
                        <span className="text-red-600">{event.failed_deliveries} failed</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold glass-text-primary">Webhook Management</h1>
            <p className="glass-text-secondary">Configure and monitor webhook endpoints</p>
          </div>
        </div>

        {/* Statistics */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center">
              <GlobeAltIcon className="h-6 w-6 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">Total Endpoints</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total_endpoints || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Active</p>
                <p className="text-2xl font-bold text-green-900">{stats.active_endpoints || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center">
              <ChartBarIcon className="h-6 w-6 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-800">Success Rate</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.success_rate || 0}%</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <DocumentDuplicateIcon className="h-6 w-6 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-800">Total Deliveries</p>
                <p className="text-2xl font-bold text-purple-900">{stats.total_deliveries || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { key: 'endpoints', label: 'Endpoints', count: stats.total_endpoints },
              { key: 'deliveries', label: 'Deliveries', count: stats.total_deliveries },
              { key: 'events', label: 'Events', count: stats.recent_events?.length },
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
                {tab.count !== undefined && (
                  <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                    {tab.count || 0}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'endpoints' && renderEndpoints()}
          {activeTab === 'deliveries' && renderDeliveries()}
          {activeTab === 'events' && renderEvents()}
        </div>
      </div>
    </div>
  );
};

export default WebhookManagement;
