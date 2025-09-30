import React, { useState } from 'react';
import './Chat.css';

const RoomSidebar = ({ 
  rooms, 
  currentRoom, 
  onlineUsers, 
  onJoinRoom, 
  onCreateRoom,
  user,
  notifications 
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      const result = await onCreateRoom({
        name: newRoomName.trim(),
        description: newRoomDescription.trim()
      });
      if (result.success) {
        setNewRoomName('');
        setNewRoomDescription('');
        setShowCreateModal(false);
        setIsMobileOpen(false);
      }
    }
  };

  const unreadCount = notifications.filter(n => n.roomName === currentRoom).length;

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="mobile-menu-btn" onClick={() => setIsMobileOpen(!isMobileOpen)}>
        ☰
      </div>

      <div className={`room-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h2>💬 ChatSphere</h2>
          <button 
            className="create-room-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + Create
          </button>
        </div>

        <div className="rooms-list">
          <div className="rooms-section">
            <h3>Rooms ({rooms.length})</h3>
            {rooms.map(room => (
              <div
                key={room.name}
                className={`room-item ${currentRoom === room.name ? 'active' : ''}`}
                onClick={() => {
                  onJoinRoom(room.name);
                  setIsMobileOpen(false);
                }}
              >
                <div className="room-info">
                  <span className="room-name"># {room.name}</span>
                  {room.description && (
                    <span className="room-description">{room.description}</span>
                  )}
                  <span className="room-stats">
                    {room.userCount} online
                  </span>
                </div>
                {room.isDefault && <span className="default-badge">Default</span>}
                {notifications.filter(n => n.roomName === room.name).length > 0 && (
                  <span className="notification-badge">
                    {notifications.filter(n => n.roomName === room.name).length}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="online-users">
          <h3>Online in {currentRoom} ({onlineUsers.length})</h3>
          <div className="users-list">
            {onlineUsers.map(username => (
              <div key={username} className="user-item">
                <div className="user-avatar">
                  {username.charAt(0).toUpperCase()}
                </div>
                <span className="username">
                  {username}
                  {username === user?.username && ' (You)'}
                </span>
                <div className="online-indicator"></div>
              </div>
            ))}
          </div>
        </div>

        <div className="user-profile">
          <div className="user-avatar large">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <span className="username">{user?.username}</span>
            <span className="user-status">Online</span>
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create New Room</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="modal-form">
              <div className="input-group">
                <label>Room Name *</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Enter room name..."
                  maxLength={20}
                  autoFocus
                  required
                />
                <small>2-20 characters, lowercase</small>
              </div>
              <div className="input-group">
                <label>Description (Optional)</label>
                <textarea
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                  placeholder="Enter room description..."
                  maxLength={100}
                  rows={3}
                />
                <small>Max 100 characters</small>
              </div>
              <div className="modal-actions">
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                  disabled={!newRoomName.trim() || newRoomName.trim().length < 2}
                >
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="mobile-overlay"
          onClick={() => setIsMobileOpen(false)}
        ></div>
      )}
    </>
  );
};

export default RoomSidebar;
