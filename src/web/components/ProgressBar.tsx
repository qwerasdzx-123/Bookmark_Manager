import React from 'react';

interface ProgressBarProps {
  progress: number;
  total: number;
  message?: string;
  showPercentage?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  total, 
  message,
  showPercentage = true 
}) => {
  const percentage = total > 0 ? (progress / total) * 100 : 0;
  const isComplete = progress >= total && total > 0;

  return (
    <div className="progress-container">
      {message && (
        <div className="progress-message">
          <span className="message-text">{message}</span>
          {showPercentage && (
            <span className="progress-percentage">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div className="progress-bar-wrapper">
        <div 
          className={`progress-bar ${isComplete ? 'complete' : ''}`}
          style={{ width: `${percentage}%` }}
        >
          {isComplete && (
            <span className="complete-icon">✓</span>
          )}
        </div>
      </div>
      <div className="progress-stats">
        <span className="stat-item">
          已完成: <strong>{progress}</strong>
        </span>
        <span className="stat-item">
          总计: <strong>{total}</strong>
        </span>
        <span className="stat-item">
          剩余: <strong>{Math.max(0, total - progress)}</strong>
        </span>
      </div>
    </div>
  );
};

export default ProgressBar;
