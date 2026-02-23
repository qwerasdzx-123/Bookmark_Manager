import React from 'react';
import { Clock, Trash2, Filter, Download, Calendar, BarChart3, RefreshCw } from 'lucide-react';
import { useBookmarkStore } from '../../store/bookmarkStore';

const HistoryPanel: React.FC = () => {
  const { history } = useBookmarkStore();
  const [filter, setFilter] = React.useState<'all' | 'linkcheck' | 'duplicate' | 'import' | 'export' | 'delete'>('all');
  const [sortBy, setSortBy] = React.useState<'timestamp' | 'type'>('timestamp');

  const handleClearHistory = () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      localStorage.removeItem('operationHistory');
      window.location.reload();
    }
  };

  const handleExportHistory = () => {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredHistory = React.useMemo(() => {
    let filtered = history;
    if (filter !== 'all') {
      filtered = filtered.filter(record => record.type === filter);
    }
    
    if (sortBy === 'timestamp') {
      filtered = [...filtered].sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortBy === 'type') {
      filtered = [...filtered].sort((a, b) => a.type.localeCompare(b.type));
    }
    
    return filtered;
  }, [history, filter, sortBy]);

  const stats = React.useMemo(() => {
    return {
      total: history.length,
      linkcheck: history.filter(h => h.type === 'linkcheck').length,
      duplicate: history.filter(h => h.type === 'duplicate').length,
      import: history.filter(h => h.type === 'import').length,
      export: history.filter(h => h.type === 'export').length,
      delete: history.filter(h => h.type === 'delete').length
    };
  }, [history]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    const timeStr = date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (days > 0) {
      return `${timeStr} (${days} 天前)`;
    } else if (hours > 0) {
      return `${timeStr} (${hours} 小时前)`;
    } else if (minutes > 0) {
      return `${timeStr} (${minutes} 分钟前)`;
    } else {
      return `${timeStr} (刚刚)`;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, { label: string; icon: any; color: string }> = {
      linkcheck: { label: '联通性检测', icon: <RefreshCw className="w-4 h-4" />, color: 'blue' },
      duplicate: { label: '重复检测', icon: <Filter className="w-4 h-4" />, color: 'purple' },
      import: { label: '导入操作', icon: <Download className="w-4 h-4" />, color: 'green' },
      export: { label: '导出操作', icon: <Download className="w-4 h-4" />, color: 'orange' },
      delete: { label: '删除操作', icon: <Trash2 className="w-4 h-4" />, color: 'red' }
    };
    return labels[type] || { label: type, icon: <Clock className="w-4 h-4" />, color: 'gray' };
  };

  const getDetailsContent = (record: any) => {
    const { details } = record;
    
    switch (record.type) {
      case 'linkcheck':
        return (
          <div className="history-details">
            <div className="detail-item">
              <span className="detail-label">检测链接:</span>
              <span className="detail-value">{details.total || 0}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">正常:</span>
              <span className="detail-value text-green-500">{details.success || 0}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">失效:</span>
              <span className="detail-value text-red-500">{details.failed || 0}</span>
            </div>
          </div>
        );
      case 'duplicate':
        return (
          <div className="history-details">
            <div className="detail-item">
              <span className="detail-label">发现重复:</span>
              <span className="detail-value">{details.count || 0}</span>
            </div>
          </div>
        );
      case 'import':
        return (
          <div className="history-details">
            <div className="detail-item">
              <span className="detail-label">文件名:</span>
              <span className="detail-value">{details.filename || '未知'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">格式:</span>
              <span className="detail-value">{details.format || '未知'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">导入数量:</span>
              <span className="detail-value">{details.count || 0}</span>
            </div>
          </div>
        );
      case 'export':
        return (
          <div className="history-details">
            <div className="detail-item">
              <span className="detail-label">格式:</span>
              <span className="detail-value">{details.format || '未知'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">导出数量:</span>
              <span className="detail-value">{details.count || 0}</span>
            </div>
          </div>
        );
      case 'delete':
        return (
          <div className="history-details">
            <div className="detail-item">
              <span className="detail-label">删除数量:</span>
              <span className="detail-value">{details.count || 0}</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="history-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Clock className="w-5 h-5 mr-2" />
          操作历史
        </div>
        <div className="panel-actions">
          <button 
            className="btn btn-secondary"
            onClick={handleExportHistory}
            title="导出历史记录"
          >
            <Download className="w-4 h-4 mr-2" />
            导出
          </button>
          <button 
            className="btn btn-danger"
            onClick={handleClearHistory}
            title="清空历史记录"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            清空
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">总记录</div>
          </div>
        </div>
        <div className="stat-card stat-linkcheck">
          <div className="stat-icon">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.linkcheck}</div>
            <div className="stat-label">链接检测</div>
          </div>
        </div>
        <div className="stat-card stat-duplicate">
          <div className="stat-icon">
            <Filter className="w-6 h-6" />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.duplicate}</div>
            <div className="stat-label">重复检测</div>
          </div>
        </div>
        <div className="stat-card stat-import">
          <div className="stat-icon">
            <Download className="w-6 h-6" />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.import + stats.export}</div>
            <div className="stat-label">导入导出</div>
          </div>
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-label">
          <Filter className="w-4 h-4 mr-2" />
          筛选类型
        </div>
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部 ({stats.total})
          </button>
          <button 
            className={`filter-btn ${filter === 'linkcheck' ? 'active' : ''}`}
            onClick={() => setFilter('linkcheck')}
          >
            链接检测 ({stats.linkcheck})
          </button>
          <button 
            className={`filter-btn ${filter === 'duplicate' ? 'active' : ''}`}
            onClick={() => setFilter('duplicate')}
          >
            重复检测 ({stats.duplicate})
          </button>
          <button 
            className={`filter-btn ${filter === 'import' ? 'active' : ''}`}
            onClick={() => setFilter('import')}
          >
            导入 ({stats.import})
          </button>
          <button 
            className={`filter-btn ${filter === 'export' ? 'active' : ''}`}
            onClick={() => setFilter('export')}
          >
            导出 ({stats.export})
          </button>
          <button 
            className={`filter-btn ${filter === 'delete' ? 'active' : ''}`}
            onClick={() => setFilter('delete')}
          >
            删除 ({stats.delete})
          </button>
        </div>
      </div>

      <div className="sort-section">
        <div className="sort-label">排序方式:</div>
        <div className="sort-buttons">
          <button 
            className={`sort-btn ${sortBy === 'timestamp' ? 'active' : ''}`}
            onClick={() => setSortBy('timestamp')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            时间
          </button>
          <button 
            className={`sort-btn ${sortBy === 'type' ? 'active' : ''}`}
            onClick={() => setSortBy('type')}
          >
            <Filter className="w-4 h-4 mr-2" />
            类型
          </button>
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="empty-state">
          <Clock className="w-16 h-16 text-gray-400" />
          <p>暂无操作历史</p>
          <p className="empty-hint">您的操作记录将显示在这里</p>
        </div>
      ) : (
        <div className="history-list">
          {filteredHistory.map(record => {
            const typeInfo = getTypeLabel(record.type);
            return (
              <div key={record.id} className={`history-card history-${typeInfo.color}`}>
                <div className="history-header">
                  <div className="history-type">
                    {typeInfo.icon}
                    <span className="type-label">{typeInfo.label}</span>
                  </div>
                  <div className="history-time">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatTime(record.timestamp)}
                  </div>
                </div>
                {getDetailsContent(record)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
