import React from 'react';

const MessageList = ({ messages, currentSocketId }) => {
  return (
    <div className="message-list">
      <div className="messages-header">
        <h3>Messages ({messages.length})</h3>
      </div>
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`message ${message.socketId === currentSocketId ? 'own-message' : 'other-message'}`}
            >
              <div className="message-header">
                <span className="user">{message.user}</span>
                <span className="time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="message-text">{message.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MessageList;