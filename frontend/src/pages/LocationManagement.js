import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from 'react-query';
import { locationAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { generateQRCode } from '../utils/helpers';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  QrCodeIcon,
  PrinterIcon,
  MapPinIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const LocationManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrModalLocation, setQrModalLocation] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [showBulkPrint, setShowBulkPrint] = useState(false);
  const printRef = useRef();

  // Fetch locations
  const { data: locationsData, isLoading } = useQuery(
    'locations',
    () => locationAPI.list(),
    {
      refetchInterval: 30000,
    }
  );

  const locations = locationsData?.data?.results || locationsData?.results || [];

  // Mutations
  const createLocationMutation = useMutation(locationAPI.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('locations');
      toast.success('Location created successfully');
      setShowCreateForm(false);
    },
    onError: (error) => {
      console.error('Location creation error:', error);
      console.error('Error response:', error.response?.data);

      // Show detailed validation errors
      if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === 'object' && !errorData.message) {
          // Handle field validation errors
          const fieldErrors = Object.entries(errorData)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join('; ');
          toast.error(`Validation errors: ${fieldErrors}`);
        } else {
          toast.error(errorData.message || errorData.detail || 'Failed to create location');
        }
      } else {
        toast.error('Failed to create location');
      }
    },
  });

  const updateLocationMutation = useMutation(
    ({ id, data }) => locationAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('locations');
        toast.success('Location updated successfully');
        setSelectedLocation(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update location');
      },
    }
  );

  const deleteLocationMutation = useMutation(locationAPI.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('locations');
      toast.success('Location deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete location');
    },
  });

  const handleCreateLocation = (locationData) => {
    console.log('Creating location with data:', locationData);
    createLocationMutation.mutate(locationData);
  };

  const handleUpdateLocation = (id, locationData) => {
    updateLocationMutation.mutate({ id, data: locationData });
  };

  const handleDeleteLocation = (id) => {
    if (window.confirm('Are you sure you want to delete this location?')) {
      deleteLocationMutation.mutate(id);
    }
  };

  const handleShowQR = async (location) => {
    try {
      const qrPayload = location.qr_code_payload || location.qr_code;
      const qrDataUrl = await generateQRCode(qrPayload);
      if (qrDataUrl) {
        setQrCodeDataUrl(qrDataUrl);
        setQrModalLocation(location);  // Use separate state for QR modal
        setShowQRModal(true);
      } else {
        toast.error('Failed to generate QR code');
      }
    } catch (error) {
      toast.error('Error generating QR code');
    }
  };

  const handlePrintQR = () => {
    if (printRef.current) {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${qrModalLocation?.name}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .qr-container { border: 2px solid #000; padding: 20px; margin: 20px auto; width: 300px; }
              .qr-code { width: 200px; height: 200px; margin: 10px auto; }
              .location-info { margin: 10px 0; }
              .location-name { font-size: 18px; font-weight: bold; }
              .qr-payload { font-size: 12px; color: #666; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="location-info">
                <div class="location-name">${qrModalLocation?.name}</div>
                <div class="qr-payload">QR Code: ${qrModalLocation?.qr_code_payload}</div>
              </div>
              <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code" />
              <div style="margin-top: 10px; font-size: 12px;">
                Scan this QR code to clock in/out at this location
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadQR = () => {
    if (qrCodeDataUrl && qrModalLocation) {
      const link = document.createElement('a');
      link.download = `qr-code-${qrModalLocation.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = qrCodeDataUrl;
      link.click();
    }
  };

  const handleBulkPrint = () => {
    const printWindow = window.open('', '_blank');
    let htmlContent = `
      <html>
        <head>
          <title>All Location QR Codes</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .qr-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .qr-item { border: 2px solid #000; padding: 15px; text-align: center; page-break-inside: avoid; }
            .qr-code { width: 150px; height: 150px; margin: 10px auto; }
            .location-name { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
            .qr-payload { font-size: 10px; color: #666; margin-bottom: 10px; }
            @media print { 
              body { margin: 0; }
              .qr-grid { grid-template-columns: repeat(2, 1fr); }
            }
          </style>
        </head>
        <body>
          <h1 style="text-align: center; margin-bottom: 30px;">Location QR Codes</h1>
          <div class="qr-grid">
    `;

    // Generate QR codes for all locations
    Promise.all(
      locations.map(async (location) => {
        const qrPayload = location.qr_code_payload || location.qr_code;
        const qrDataUrl = await generateQRCode(qrPayload);
        return { location, qrDataUrl };
      })
    ).then((results) => {
      results.forEach(({ location, qrDataUrl }) => {
        htmlContent += `
          <div class="qr-item">
            <div class="location-name">${location.name}</div>
            <div class="qr-payload">QR: ${location.qr_code_payload}</div>
            <img src="${qrDataUrl}" alt="QR Code" class="qr-code" />
            <div style="font-size: 10px; margin-top: 5px;">
              Scan to clock in/out
            </div>
          </div>
        `;
      });

      htmlContent += `
          </div>
        </body>
      </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    });

    setShowBulkPrint(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold glass-text-primary">Location Management</h1>
            <p className="glass-text-secondary">Manage work locations and their QR codes</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowBulkPrint(true)}
              className="uber-button-secondary flex items-center"
            >
              <PrinterIcon className="h-5 w-5 mr-2" />
              Print All QR Codes
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Location
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <MapPinIcon className="h-6 w-6 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">Total Locations</p>
                <p className="text-2xl font-bold text-blue-900">{locations.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Active Locations</p>
                <p className="text-2xl font-bold text-green-900">
                  {locations.filter(loc => loc.is_active).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center">
              <QrCodeIcon className="h-6 w-6 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-800">QR Codes Generated</p>
                <p className="text-2xl font-bold text-yellow-900">{locations.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Locations List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Locations</h2>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading locations...</p>
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-8">
            <MapPinIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No locations</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new location.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {locations.map((location) => (
              <div key={location.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">{location.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        location.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {location.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {location.description && (
                      <p className="text-sm text-gray-600 mt-1">{location.description}</p>
                    )}

                    {location.address && (
                      <p className="text-sm text-gray-500 mt-1">{location.address}</p>
                    )}

                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>QR Code: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{location.qr_code_payload || location.qr_code}</code></span>
                      {location.latitude && location.longitude && (
                        <span>GPS: {location.latitude}, {location.longitude}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleShowQR(location)}
                      className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                      title="View QR Code"
                    >
                      <QrCodeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setSelectedLocation(location)}
                      className="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-indigo-50"
                      title="Edit Location"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(location.id)}
                      className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                      title="Delete Location"
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

      {/* QR Code Modal */}
      {showQRModal && qrModalLocation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                QR Code - {qrModalLocation.name}
              </h3>

              <div className="mb-4">
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code"
                  className="mx-auto border border-gray-200 rounded"
                  style={{ width: '200px', height: '200px' }}
                />
              </div>

              <div className="text-sm text-gray-600 mb-4">
                <p>QR Code: <code className="bg-gray-100 px-2 py-1 rounded">{qrModalLocation.qr_code_payload || qrModalLocation.qr_code}</code></p>
                <p className="mt-1">Scan this code to clock in/out at this location</p>
              </div>

              <div className="flex justify-center space-x-3">
                <button
                  onClick={handlePrintQR}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                >
                  <PrinterIcon className="h-4 w-4 mr-2" />
                  Print
                </button>
                <button
                  onClick={handleDownloadQR}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  Download
                </button>
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setQrModalLocation(null);
                  }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Print Confirmation Modal */}
      {showBulkPrint && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Print All QR Codes
              </h3>

              <p className="text-sm text-gray-600 mb-4">
                This will generate and print QR codes for all {locations.length} locations.
                The QR codes will be arranged in a printable grid format.
              </p>

              <div className="flex justify-center space-x-3">
                <button
                  onClick={handleBulkPrint}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center"
                >
                  <PrinterIcon className="h-4 w-4 mr-2" />
                  Print All
                </button>
                <button
                  onClick={() => setShowBulkPrint(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Location Forms */}
      {(showCreateForm || selectedLocation) && (
        <LocationForm
          location={selectedLocation}
          onSubmit={selectedLocation ?
            (data) => handleUpdateLocation(selectedLocation.id, data) :
            handleCreateLocation
          }
          onCancel={() => {
            setShowCreateForm(false);
            setSelectedLocation(null);
          }}
          isLoading={createLocationMutation.isLoading || updateLocationMutation.isLoading}
        />
      )}
    </div>
  );
};

// Location Form Component
const LocationForm = ({ location, onSubmit, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    description: location?.description || '',
    address: location?.address || '',
    latitude: location?.latitude || '',
    longitude: location?.longitude || '',
    qr_code_payload: location?.qr_code_payload || location?.qr_code || '',
    radius_meters: location?.radius_meters || 100,
    is_active: location?.is_active !== undefined ? location.is_active : true,
    requires_gps_verification: location?.requires_gps_verification || false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Generate QR code payload if not provided
    if (!formData.qr_code_payload) {
      const payload = formData.name
        .toUpperCase()
        .replace(/\s+/g, '-')
        .replace(/[^A-Z0-9-]/g, '') + '-' + Date.now().toString().slice(-6);
      formData.qr_code_payload = payload;
    }

    // Sanitize data types before sending
    const sanitizedData = {
      ...formData,
      // Ensure numeric fields are numbers
      radius_meters: parseInt(formData.radius_meters) || 100,
      // Ensure decimal fields are properly formatted (max 8 decimal places)
      latitude: formData.latitude ? parseFloat(parseFloat(formData.latitude).toFixed(8)) : null,
      longitude: formData.longitude ? parseFloat(parseFloat(formData.longitude).toFixed(8)) : null,
      // Ensure boolean fields are booleans
      is_active: Boolean(formData.is_active),
      requires_gps_verification: Boolean(formData.requires_gps_verification),
    };

    console.log('Sanitized form data:', sanitizedData);
    onSubmit(sanitizedData);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let processedValue = value;

    // Convert numeric fields to numbers
    if (type === 'number' && value !== '') {
      processedValue = parseFloat(value);
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : processedValue
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-6">
            {location ? 'Edit Location' : 'Create New Location'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Main Office"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Code Payload
                </label>
                <input
                  type="text"
                  name="qr_code_payload"
                  value={formData.qr_code_payload}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Auto-generated if empty"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Unique identifier for QR code scanning
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional description of the location"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Physical address of the location"
              />
            </div>

            {/* GPS Coordinates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude
                </label>
                <input
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  step="0.00000001"
                  min="-90"
                  max="90"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 40.12345678"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Range: -90 to +90, max 8 decimal places
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude
                </label>
                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  step="0.00000001"
                  min="-180"
                  max="180"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., -73.12345678"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Range: -180 to +180, max 8 decimal places
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GPS Verification Radius (meters)
              </label>
              <input
                type="number"
                name="radius_meters"
                value={formData.radius_meters}
                onChange={handleChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Allowed distance from GPS coordinates for clock-in/out
              </p>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Active Location
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="requires_gps_verification"
                  checked={formData.requires_gps_verification}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Require GPS Verification
                </label>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onCancel}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : (location ? 'Update Location' : 'Create Location')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LocationManagement;
