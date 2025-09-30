import React, { useEffect, useRef } from 'react';
import { isImageFile, getFileIcon, formatFileSize } from '../../utils/fileUpload';
import './Chat.css';

const MessageList = ({ messages, currentUser, typingUsers, onDeleteMessage, onAddEmojiReaction, currentRoom }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleDeleteMessage = async (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      await onDeleteMessage(messageId, currentRoom);
    }
  };

  const handleEmojiReaction = async (messageId, emoji) => {
    await onAddEmojiReaction(messageId, emoji, currentRoom);
  };

  const popularEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const renderFileMessage = (message) => {
    if (!message.file) return null;

    const { file } = message;
    
    if (isImageFile(file.mimetype)) {
      return (
        <div className="file-message image-message">
          <img 
            src={file.url} 
            alt={file.originalName}
            className="message-image"
            loading="lazy"
          />
          <div className="file-info">
            <span className="file-name">{file.originalName}</span>
            <span className="file-size">{formatFileSize(file.size)}</span>
          </div>
        </div>
      );
    } else {
      return (
        <div className="file-message document-message">
          <div className="file-icon">{getFileIcon(file.mimetype)}</div>
          <div className="file-details">
            <a 
              href={file.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="file-name"
            >
              {file.originalName}
            </a>
            <span className="file-size">{formatFileSize(file.size)}</span>
          </div>
          <a 
            href={file.url} 
            download={file.originalName}
            className="download-btn"
            title="Download file"
          >
            ⬇️
          </a>
        </div>
      );
    }
  };

  return (
    <div className="message-list">
      <div className="messages-container">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${
              message.messageType === 'system' || message.messageType === 'join' || message.messageType === 'leave'
                ? 'system-message' 
                : message.username === currentUser?.username 
                ? 'own-message' 
                : 'other-message'
            }`}
          >
            {(message.messageType === 'system' || message.messageType === 'join' || message.messageType === 'leave') ? (
              <div className="system-message-content">
                <span className="system-text">{message.text}</span>
                <span className="message-time">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            ) : (
              <>
                <div className="message-header">
                  <span className="message-username">
                    {message.username}
                    {message.username === currentUser?.username && ' (You)'}
                  </span>
                  <span className="message-time">
                    {formatTime(message.timestamp)}
                  </span>
                  {message.username === currentUser?.username && (
                    <button 
                      className="delete-message-btn"
                      onClick={() => handleDeleteMessage(message.id)}
                      title="Delete message"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                
                {/* File or Image Message */}
                {(message.messageType === 'file' || message.messageType === 'image') && renderFileMessage(message)}
                
                {/* Text Message */}
                {message.text && (
                  <div className="message-content">
                    {message.text}
                  </div>
                )}
                
                {/* Emoji Reactions */}
                {message.emojis && message.emojis.length > 0 && (
                  <div className="emoji-reactions">
                    {message.emojis.map((reaction, index) => (
                      <button
                        key={index}
                        className="emoji-reaction"
                        onClick={() => handleEmojiReaction(message.id, reaction.emoji)}
                        title={reaction.users.join(', ')}
                      >
                        <span className="emoji">{reaction.emoji}</span>
                        <span className="emoji-count">{reaction.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Quick Emoji Reactions */}
                <div className="quick-emoji-reactions">
                  {popularEmojis.map(emoji => (
                    <button
                      key={emoji}
                      className="quick-emoji"
                      onClick={() => handleEmojiReaction(message.id, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
        
        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-text">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;
