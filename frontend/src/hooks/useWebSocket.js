import { useEffect, useState } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';

const useWebSocket = (url, options = {}) => {
  const { socket, connectionStatus, messageHistory, sendMessage, addMessageListener } = useWebSocketContext();
  const [lastMessage, setLastMessage] = useState(null);

  useEffect(() => {
    if (options.onMessage) {
      console.log('useWebSocket: Adding message listener');
      const removeListener = addMessageListener((message) => {
        setLastMessage(message);
        options.onMessage(message);
      });

      return removeListener;
    }
  }, [options.onMessage, addMessageListener]);

  return {
    socket,
    lastMessage,
    connectionStatus,
    messageHistory,
    sendMessage,
    connect: () => {}, // No-op since connection is managed by context
    disconnect: () => {} // No-op since connection is managed by context
  };
};

export default useWebSocket;
