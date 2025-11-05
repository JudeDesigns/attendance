import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';

// Styles
import './styles/glass-design.css';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClockIn from './pages/ClockIn';
import TimeTracking from './pages/TimeTracking';
import Schedule from './pages/Schedule';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeList from './pages/EmployeeList';
import Reports from './pages/Reports';
import AdminScheduling from './pages/AdminScheduling';
import AdminLeaveManagement from './pages/AdminLeaveManagement';
import WebhookManagement from './pages/WebhookManagement';
import LeaveManagement from './pages/LeaveManagement';
import EmployeeStatusDashboard from './pages/EmployeeStatusDashboard';
import EmployeeDetails from './pages/EmployeeDetails';
import LocationManagement from './pages/LocationManagement';

// EmployeeQRManagement removed - individual employee QR codes no longer supported
import NotificationManagement from './pages/NotificationManagement';
import NotificationSettings from './pages/NotificationSettings';


// Context
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
        <Router>
          <div className="App">
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
            
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />

              
              {/* Protected routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/clock-in" element={
                <ProtectedRoute>
                  <Layout>
                    <ClockIn />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/time-tracking" element={
                <ProtectedRoute>
                  <Layout>
                    <TimeTracking />
                  </Layout>
                </ProtectedRoute>
              } />
              
              {/* Regular user schedule */}
              <Route path="/schedule" element={
                <ProtectedRoute>
                  <Layout>
                    <Schedule />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Regular user leave management */}
              <Route path="/leave" element={
                <ProtectedRoute>
                  <Layout>
                    <LeaveManagement />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Admin routes */}
              <Route path="/admin" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/employees" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <EmployeeList />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/employee-status" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <EmployeeStatusDashboard />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/employee-details/:employeeId" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <EmployeeDetails />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/locations" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <LocationManagement />
                  </Layout>
                </ProtectedRoute>
              } />



              {/* Employee QR Management route removed - individual employee QR codes no longer supported */}

              <Route path="/notifications" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <NotificationManagement />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/notification-settings" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <NotificationSettings />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/reports" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Admin scheduling system */}
              <Route path="/admin/scheduling" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <AdminScheduling />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Admin leave management with approval workflow */}
              <Route path="/admin/leave" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <AdminLeaveManagement />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Webhook management */}
              <Route path="/webhooks" element={
                <ProtectedRoute requireAdmin={true}>
                  <Layout>
                    <WebhookManagement />
                  </Layout>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </Router>
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
