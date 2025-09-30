import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { uploadFile } from '../../utils/fileUpload';
import './Chat.css';

const MessageInput = ({ 
  onSendMessage, 
  onTypingStart, 
  onTypingStop, 
  currentRoom, 
  disabled 
}) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((message.trim() || isUploading) && !disabled) {
      await onSendMessage({ 
        text: message.trim(), 
        roomName: currentRoom 
      });
      setMessage('');
      handleStopTyping();
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    
    if (e.target.value.trim() && !isTyping) {
      setIsTyping(true);
      onTypingStart(currentRoom);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      onTypingStop(currentRoom);
    }
  };

  const handleEmojiClick = (emojiData) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadResult = await uploadFile(file);
      
      if (uploadResult.success) {
        await onSendMessage({
          text: message.trim(),
          roomName: currentRoom,
          file: uploadResult.file
        });
        
        setMessage('');
        handleStopTyping();
      }
    } catch (error) {
      console.error('❌ File upload failed:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        onTypingStop(currentRoom);
      }
    };
  }, [isTyping, currentRoom, onTypingStop]);

  return (
    <form onSubmit={handleSubmit} className="message-input">
      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="upload-progress">
          <div 
            className="upload-progress-bar"
            style={{ width: `${uploadProgress}%` }}
          ></div>
          <span className="upload-text">Uploading... {uploadProgress}%</span>
        </div>
      )}

      <div className="input-container">
        <button
          type="button"
          className="emoji-picker-btn"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={disabled || isUploading}
        >
          😊
        </button>
        
        <button
          type="button"
          className="file-upload-btn"
          onClick={triggerFileInput}
          disabled={disabled || isUploading}
          title="Upload file"
        >
          📎
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*, .pdf, .txt, .doc, .docx"
          style={{ display: 'none' }}
        />
        
        <input
          type="text"
          value={message}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={`Message #${currentRoom}...`}
          disabled={disabled || isUploading}
          maxLength={500}
          className="message-input-field"
        />
        
        <button 
          type="submit" 
          disabled={(!message.trim() && !isUploading) || disabled}
          className="send-button"
        >
          {isUploading ? (
            <div className="upload-spinner"></div>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          )}
        </button>
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="emoji-picker-container" ref={emojiPickerRef}>
          <EmojiPicker 
            onEmojiClick={handleEmojiClick}
            searchDisabled={false}
            skinTonesDisabled={true}
            height={350}
            width={300}
          />
        </div>
      )}
    </form>
  );
};

export default MessageInput;
