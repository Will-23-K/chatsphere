import React, { useState } from 'react';

const MessageInput = ({ socket, disabled }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && socket) {
      // Send message to server
      socket.emit('send_message', {
        text: message.trim(),
        user: 'User' // We'll add proper usernames later
      });
      setMessage(''); // Clear input
    }
  };

  return (
    <form onSubmit={handleSubmit} className="message-input-form">
      <div className="input-group">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={disabled}
          maxLength={500}
        />
        <button 
          type="submit" 
          disabled={!message.trim() || disabled}
        >
          Send
        </button>
      </div>
    </form>
  );
};

export default MessageInput;