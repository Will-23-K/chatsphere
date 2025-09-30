import { useEffect, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';

export const useSocket = (token) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Show browser notification
  const showNotification = useCallback((title, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    console.log('🔌 Connecting to socket with token...');
    socketRef.current = io('http://localhost:5000', {
      auth: { token }
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);
      setSocketId(socket.id);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
      setSocketId(null);
    });

    socket.on('initial_data', (data) => {
      console.log('📦 Received initial data:', data);
      setRooms(data.rooms);
      setCurrentRoom(data.currentRoom);
      setMessages(data.messages);
      setOnlineUsers(data.onlineUsers);
    });

    socket.on('room_joined', (data) => {
      console.log('🚪 Room joined:', data.roomName);
      setCurrentRoom(data.roomName);
      setMessages(data.messages);
      setOnlineUsers(data.onlineUsers);
      setTypingUsers([]);
    });

    socket.on('room_created', (newRoom) => {
      console.log('🏠 New room created:', newRoom);
      setRooms(prev => {
        const exists = prev.find(room => room.name === newRoom.name);
        return exists ? prev : [...prev, newRoom];
      });
    });

    socket.on('receive_message', (message) => {
      console.log('📨 Received message:', message);
      setMessages(prev => [...prev, message]);
    });

    socket.on('message_deleted', (data) => {
      console.log('🗑️ Message deleted:', data.messageId);
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    });

    socket.on('message_updated', (data) => {
      console.log('🔄 Message updated:', data.messageId);
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId ? { ...msg, emojis: data.emojis } : msg
      ));
    });

    socket.on('user_joined_room', (data) => {
      console.log('👋 User joined room:', data.username);
      setOnlineUsers(data.onlineUsers);
    });

    socket.on('user_left_room', (data) => {
      console.log('👋 User left room:', data.username);
      setOnlineUsers(data.onlineUsers);
    });

    socket.on('user_typing', (data) => {
      setTypingUsers(prev => {
        if (data.isTyping) {
          return [...prev.filter(user => user !== data.username), data.username];
        } else {
          return prev.filter(user => user !== data.username);
        }
      });
    });

    socket.on('new_message_notification', (data) => {
      // Only show notification if app is not focused
      if (document.visibilityState === 'hidden') {
        showNotification(
          `New message in #${data.roomName}`,
          {
            body: `${data.username}: ${data.message}`,
            tag: 'chat-message'
          }
        );
      }
      
      setNotifications(prev => [...prev, {
        id: Date.now(),
        username: data.username,
        roomName: data.roomName,
        message: data.message,
        timestamp: data.timestamp
      }]);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token, showNotification]);

  const createRoom = useCallback((roomData) => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      socketRef.current.emit('create_room', roomData, resolve);
    });
  }, []);

  const joinRoom = useCallback((roomName) => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      socketRef.current.emit('join_room', roomName, resolve);
    });
  }, []);

  const sendMessage = useCallback((data) => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      socketRef.current.emit('send_message', data, resolve);
    });
  }, []);

  const deleteMessage = useCallback((messageId, roomName) => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      socketRef.current.emit('delete_message', { messageId, roomName }, resolve);
    });
  }, []);

  const addEmojiReaction = useCallback((messageId, emoji, roomName) => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      socketRef.current.emit('add_emoji_reaction', { messageId, emoji, roomName }, resolve);
    });
  }, []);

  const startTyping = useCallback((roomName) => {
    if (socketRef.current) {
      socketRef.current.emit('typing_start', roomName);
    }
  }, []);

  const stopTyping = useCallback((roomName) => {
    if (socketRef.current) {
      socketRef.current.emit('typing_stop', roomName);
    }
  }, []);

  const getRooms = useCallback(() => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve([]);
        return;
      }
      socketRef.current.emit('get_rooms', resolve);
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    socketId,
    rooms,
    currentRoom,
    messages,
    onlineUsers,
    typingUsers,
    notifications,
    createRoom,
    joinRoom,
    sendMessage,
    deleteMessage,
    addEmojiReaction,
    startTyping,
    stopTyping,
    getRooms,
    clearNotifications,
    showNotification
  };
};
