import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext();

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [messageHistory, setMessageHistory] = useState([]);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const isManualClose = useRef(false);
  const messageListeners = useRef(new Set());
  const pingIntervalRef = useRef(null);
  
  const maxReconnectAttempts = 5;
  const reconnectInterval = 3000;

  // Add message listener
  const addMessageListener = useCallback((listener) => {
    messageListeners.current.add(listener);
    return () => {
      messageListeners.current.delete(listener);
    };
  }, []);

  // Broadcast message to all listeners
  const broadcastMessage = useCallback((message) => {
    messageListeners.current.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in WebSocket message listener:', error);
      }
    });
  }, []);

  const connect = useCallback(() => {
    if (!token) return;

    // Close existing connection if any
    if (socket) {
      socket.close();
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const backendHost = process.env.REACT_APP_API_URL 
        ? process.env.REACT_APP_API_URL.replace(/^https?:\/\//, '').replace(/\/api\/v1\/?$/, '')
        : 'localhost:8000';
      const wsUrl = `${protocol}//${backendHost}/ws/notifications/?token=${token}`;

      console.log('WebSocketContext: Attempting connection to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocketContext: Connected');
        setConnectionStatus('Connected');
        setSocket(ws);
        reconnectAttempts.current = 0;
        isManualClose.current = false;
        
        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ping',
              timestamp: Date.now()
            }));
          }
        }, 30000); // Ping every 30 seconds
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setMessageHistory(prev => [...prev.slice(-99), message]); // Keep last 100 messages
          broadcastMessage(message);
        } catch (error) {
          console.error('WebSocketContext: Error parsing message:', error);
        }
      };
      
      ws.onclose = (event) => {
        console.log('WebSocketContext: Disconnected:', event.code, event.reason);
        setConnectionStatus('Disconnected');
        setSocket(null);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Only reconnect for unexpected closures
        const shouldReconnect = ![1000, 1001].includes(event.code) && 
                               reconnectAttempts.current < maxReconnectAttempts &&
                               !isManualClose.current;

        if (shouldReconnect) {
          reconnectAttempts.current += 1;
          console.log(`WebSocketContext: Attempting to reconnect... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          const backoffDelay = Math.min(reconnectInterval * Math.pow(2, reconnectAttempts.current - 1), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setConnectionStatus('Reconnecting');
            connect();
          }, backoffDelay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.log('WebSocketContext: Max reconnection attempts reached');
          setConnectionStatus('Failed');
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocketContext: Error:', error);
        setConnectionStatus('Error');
      };
      
    } catch (error) {
      console.error('WebSocketContext: Error creating connection:', error);
      setConnectionStatus('Error');
    }
  }, [token, broadcastMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (socket) {
      isManualClose.current = true;
      socket.close(1000, 'Manual disconnect');
    }
  }, [socket]);

  const sendMessage = useCallback((message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, [socket]);

  useEffect(() => {
    if (token) {
      console.log('WebSocketContext: Token available, connecting...');
      connect();
    } else {
      console.log('WebSocketContext: No token available');
    }

    return () => {
      console.log('WebSocketContext: Cleaning up connection');
      disconnect();
    };
  }, [token, connect, disconnect]);

  const value = {
    socket,
    connectionStatus,
    messageHistory,
    sendMessage,
    connect,
    disconnect,
    addMessageListener
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
