import React from 'react';

const ConnectionStatus = ({ isConnected, socketId, onTestConnection }) => {
  return (
    <div className="connection-status">
      <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
        <div className="status-dot"></div>
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
      
      {isConnected && (
        <div className="connection-info">
          <p>Socket ID: <code>{socketId}</code></p>
          <button 
            onClick={onTestConnection}
            className="test-btn"
          >
            Test Connection
          </button>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;