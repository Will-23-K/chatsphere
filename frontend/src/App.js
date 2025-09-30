import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { useSocket } from './hooks/useSocket';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import RoomSidebar from './components/chat/RoomSidebar';
import MessageList from './components/chat/MessageList';
import MessageInput from './components/chat/MessageInput';
import './App.css';

// Notification Component
const NotificationToast = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  return (
    <div className="notification">
      <div className="notification-header">
        <span className="notification-title">
          New message in #{notification.roomName}
        </span>
        <button 
          className="notification-close"
          onClick={() => onClose(notification.id)}
        >
          ×
        </button>
      </div>
      <div className="notification-body">
        <strong>{notification.username}:</strong> {notification.message}
      </div>
    </div>
  );
};

// Auth Wrapper Component
const AuthWrapper = () => {
  const { login, register, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  if (isLogin) {
    return (
      <Login 
        onLogin={login}
        switchToRegister={() => setIsLogin(false)}
        loading={loading}
      />
    );
  }

  return (
    <Register 
      onRegister={register}
      switchToLogin={() => setIsLogin(true)}
      loading={loading}
    />
  );
};

// Main Chat Component
const ChatInterface = () => {
  const { user, logout } = useAuth();
  const { 
    isConnected,
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
    clearNotifications
  } = useSocket(user?.token);

  const [visibleNotifications, setVisibleNotifications] = useState([]);

  // Handle new notifications
  useEffect(() => {
    if (notifications.length > 0) {
      const newNotifications = notifications.slice(visibleNotifications.length);
      setVisibleNotifications(prev => [...prev, ...newNotifications]);
    }
  }, [notifications, visibleNotifications.length]);

  const handleNotificationClose = (notificationId) => {
    setVisibleNotifications(prev => 
      prev.filter(notification => notification.id !== notificationId)
    );
    clearNotifications();
  };

  if (!isConnected) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <h2>Connecting to ChatSphere...</h2>
        <p>Please wait while we establish a secure connection</p>
      </div>
    );
  }

  return (
    <>
      {/* Notification Toasts */}
      <div className="notification-container">
        {visibleNotifications.map(notification => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onClose={handleNotificationClose}
          />
        ))}
      </div>

      <div className="chat-container">
        <RoomSidebar
          rooms={rooms}
          currentRoom={currentRoom}
          onlineUsers={onlineUsers}
          onJoinRoom={joinRoom}
          onCreateRoom={createRoom}
          user={user}
          notifications={notifications}
        />
        
        <div className="chat-main">
          <header className="chat-header">
            <div className="chat-header-info">
              <h1># {currentRoom}</h1>
              <span className="online-count">
                {onlineUsers.length} user{onlineUsers.length !== 1 ? 's' : ''} online
                {notifications.length > 0 && (
                  <span className="unread-indicator">
                    • {notifications.length} new
                  </span>
                )}
              </span>
            </div>
            <div className="chat-header-actions">
              <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </span>
              <button onClick={logout} className="logout-btn">
                Logout
              </button>
            </div>
          </header>

          <MessageList
            messages={messages}
            currentUser={user}
            typingUsers={typingUsers}
            onDeleteMessage={deleteMessage}
            onAddEmojiReaction={addEmojiReaction}
            currentRoom={currentRoom}
          />

          <MessageInput
            onSendMessage={sendMessage}
            onTypingStart={startTyping}
            onTypingStop={stopTyping}
            currentRoom={currentRoom}
            disabled={!isConnected}
          />
        </div>
      </div>
    </>
  );
};

// Main App Component
const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <h2>Loading ChatSphere...</h2>
      </div>
    );
  }

  if (!user) {
    return <AuthWrapper />;
  }

  return <ChatInterface />;
};

// Root App Component
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
