import React, { useState, useEffect } from 'react';
import { Link2, Play, Pause, RefreshCw, CheckCircle, XCircle, AlertCircle, Filter, Shield, ShieldOff, X, Trash, CheckSquare, Square } from 'lucide-react';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { linkCheckerService } from '../../services/linkChecker';
import ProgressBar from './ProgressBar';

const LinkCheckPanel: React.FC = () => {
  const {
    bookmarks,
    linkCheckResults,
    realtimeCheckResults,
    isCheckingLinks,
    isPaused,
    currentCheckingUrl,
    checkProgress,
    checkLinks,
    pauseCheckLinks,
    resumeCheckLinks,
    cancelCheckLinks,
    clearLinkCheckResults,
    removeLinkCheckResult
  } = useBookmarkStore();

  const [filter, setFilter] = useState<'all' | 'normal' | 'broken' | 'redirect' | 'error'>('all');
  const [lastCheckTime, setLastCheckTime] = useState<number | null>(null);
  const [strictMode, setStrictMode] = useState(false);

  useEffect(() => {
    const savedTime = localStorage.getItem('lastLinkCheckTime');
    if (savedTime) {
      setLastCheckTime(parseInt(savedTime));
    }
  }, []);

  // 添加一个 effect 来监听实时结果的更新
  useEffect(() => {
    if (isCheckingLinks && realtimeCheckResults.size > 0) {
      console.log('实时结果更新:', realtimeCheckResults.size, '个结果');
    }
  }, [realtimeCheckResults, isCheckingLinks]);

  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetUrl, setDeleteTargetUrl] = useState<string | null>(null);

  const handleToggleCheck = async () => {
    if (isCheckingLinks) {
      // 正在检测中，切换暂停/恢复
      if (isPaused) {
        resumeCheckLinks();
      } else {
        pauseCheckLinks();
      }
    } else {
      // 未检测，开始检测
      await checkLinks();
      setLastCheckTime(Date.now());
      localStorage.setItem('lastLinkCheckTime', Date.now().toString());
    }
  };

  const handleStartCheck = async () => {
    // 如果是暂停状态，先恢复
    if (isPaused) {
      resumeCheckLinks();
    }

    // 清空之前的检测结果
    clearLinkCheckResults();

    await checkLinks();
    setLastCheckTime(Date.now());
    localStorage.setItem('lastLinkCheckTime', Date.now().toString());
  };

  const toggleStrictMode = () => {
    const newMode = !strictMode;
    setStrictMode(newMode);
    linkCheckerService.setStrictMode(newMode);
  };

  const handleSelectResult = (url: string) => {
    const newSelection = new Set(selectedResults);
    if (newSelection.has(url)) {
      newSelection.delete(url);
    } else {
      newSelection.add(url);
    }
    setSelectedResults(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedResults.size === filteredResults.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(filteredResults.map(([url]) => url)));
    }
  };

  const handleDeleteResult = (url: string) => {
    setDeleteTargetUrl(url);
    setShowDeleteModal(true);
  };

  const handleBatchDelete = () => {
    setShowDeleteModal(true);
    setDeleteTargetUrl(null); // null表示批量删除
  };

  const handleDeleteConfirmed = async (moveToTrash: boolean) => {
    setShowDeleteModal(false);
    const urlsToDelete = deleteTargetUrl ? [deleteTargetUrl] : Array.from(selectedResults);

    for (const url of urlsToDelete) {
      if (moveToTrash) {
        // 移到回收站
        const { bookmarks } = useBookmarkStore.getState();
        const findBookmarkId = (nodes: any[]): string | null => {
          for (const node of nodes) {
            if (node.url === url) {
              return node.id;
            }
            if (node.children) {
              const found = findBookmarkId(node.children);
              if (found) return found;
            }
          }
          return null;
        };

        const bookmarkId = findBookmarkId(bookmarks);
        if (bookmarkId) {
          await useBookmarkStore.getState().moveToTrash(bookmarkId);
        }
      } else {
        // 彻底删除 - 先删除书签，再删除检测结果
        const { bookmarks } = useBookmarkStore.getState();
        const findBookmarkId = (nodes: any[]): string | null => {
          for (const node of nodes) {
            if (node.url === url) {
              return node.id;
            }
            if (node.children) {
              const found = findBookmarkId(node.children);
              if (found) return found;
            }
          }
          return null;
        };

        const bookmarkId = findBookmarkId(bookmarks);
        if (bookmarkId) {
          // 从浏览器中删除书签
          try {
            await chrome.bookmarks.remove(bookmarkId);
            console.log('已删除书签:', bookmarkId, url);
          } catch (error) {
            console.error('删除书签失败:', bookmarkId, error);
          }
        }
        
        // 从检测结果中删除
        removeLinkCheckResult(url);
      }
    }

    // 如果是批量删除，清空选择
    if (!deleteTargetUrl) {
      setSelectedResults(new Set());
    }
    
    // 重新加载书签以更新UI
    await useBookmarkStore.getState().loadBookmarks();
  };

  const allUrls = React.useMemo(() => {
    const urls: string[] = [];
    const collectUrls = (node: any) => {
      if (node.url) {
        urls.push(node.url);
      }
      node.children?.forEach(collectUrls);
    };
    bookmarks.forEach(collectUrls);
    return urls;
  }, [bookmarks]);

  const filteredResults = React.useMemo(() => {
    // 检测过程中使用实时结果，检测完成后使用最终结果
    const resultsMap = isCheckingLinks ? realtimeCheckResults : linkCheckResults;
    const results = Array.from(resultsMap.entries());

    if (filter === 'all') return results;
    if (filter === 'error') {
      return results.filter(([_, result]) => result.status === 'error' || result.status === 'timeout');
    }
    return results.filter(([_, result]) => result.status === filter);
  }, [linkCheckResults, realtimeCheckResults, filter, isCheckingLinks]);

  const stats = React.useMemo(() => {
    // 检测过程中使用实时结果统计，检测完成后使用最终结果统计
    const resultsMap = isCheckingLinks ? realtimeCheckResults : linkCheckResults;
    const results = Array.from(resultsMap.values());
    return {
      total: results.length,
      normal: results.filter(r => r.status === 'normal').length,
      broken: results.filter(r => r.status === 'broken').length,
      redirect: results.filter(r => r.status === 'redirect').length,
      error: results.filter(r => r.status === 'error').length,
      timeout: results.filter(r => r.status === 'timeout').length
    };
  }, [linkCheckResults, realtimeCheckResults, isCheckingLinks]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'normal':
        return <span className="status-badge status-normal">正常</span>;
      case 'broken':
        return <span className="status-badge status-broken">失效</span>;
      case 'redirect':
        return <span className="status-badge status-redirect">重定向</span>;
      case 'error':
        return <span className="status-badge status-error">错误</span>;
      case 'timeout':
        return <span className="status-badge status-timeout">超时</span>;
      default:
        return <span className="status-badge status-unknown">未知</span>;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      return `${Math.floor(hours / 24)} 天前`;
    } else if (hours > 0) {
      return `${hours} 小时前`;
    } else if (minutes > 0) {
      return `${minutes} 分钟前`;
    } else {
      return '刚刚';
    }
  };

  // 根据URL获取书签title
  const getBookmarkTitle = (url: string): string => {
    const findBookmark = (nodes: any[]): any => {
      for (const node of nodes) {
        if (node.url === url) {
          return node.title;
        }
        if (node.children) {
          const found = findBookmark(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const title = findBookmark(bookmarks);
    return title || '未命名';
  };

  // 根据URL获取书签路径
  const getBookmarkPath = (url: string): string => {
    const path: string[] = [];

    const findPath = (nodes: any[], targetUrl: string, currentPath: string[]): boolean => {
      for (const node of nodes) {
        if (node.url === targetUrl) {
          path.push(...currentPath);
          return true;
        }
        if (node.children && node.children.length > 0) {
          const newPath = [...currentPath, node.title || '未命名文件夹'];
          if (findPath(node.children, targetUrl, newPath)) {
            return true;
          }
        }
      }
      return false;
    };

    findPath(bookmarks, url, []);
    return path.length > 0 ? path.join(' > ') : '收藏夹根目录';
  };

  return (
    <div className="link-check-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Link2 className="w-5 h-5 mr-2" />
          联通性检测
        </div>
        <div className="panel-actions">
          {filteredResults.length > 0 && (
            <>
              <label className="select-all">
                <input
                  type="checkbox"
                  checked={selectedResults.size === filteredResults.length}
                  onChange={handleSelectAll}
                />
                <span className="ml-2">全选</span>
              </label>
              {selectedResults.size > 0 && (
                <button
                  className="btn btn-danger"
                  onClick={handleBatchDelete}
                >
                  <Trash className="w-4 h-4 mr-2" />
                  删除选中 ({selectedResults.size})
                </button>
              )}
            </>
          )}
          <button
            className={`btn ${strictMode ? 'btn-warning' : 'btn-secondary'} mr-2`}
            onClick={toggleStrictMode}
            title={strictMode ? '严格模式：更准确但较慢' : '标准模式：快速但可能不准确'}
            disabled={isCheckingLinks}
          >
            {strictMode ? (
              <>
                <Shield className="w-4 h-4 mr-2" />
                严格模式
              </>
            ) : (
              <>
                <ShieldOff className="w-4 h-4 mr-2" />
                标准模式
              </>
            )}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleToggleCheck}
          >
            {isCheckingLinks ? (
              <>
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    继续检测
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    暂停检测
                  </>
                )}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                开始检测
              </>
            )}
          </button>
          {isCheckingLinks && isPaused && (
            <button
              className="btn btn-danger"
              onClick={cancelCheckLinks}
              title="取消检测"
            >
              <X className="w-4 h-4 mr-2" />
              取消检测
            </button>
          )}
        </div>
      </div>

      {isCheckingLinks && (
        <div className="progress-section">
          <ProgressBar 
            progress={checkProgress.current}
            total={checkProgress.total}
            message={isPaused ? '检测已暂停' : '正在检测链接...'}
            showPercentage={true}
          />
          {currentCheckingUrl && (
            <div className="current-checking-url">
              <div className="url-label">当前检测:</div>
              <div className="url-value truncate">{currentCheckingUrl}</div>
            </div>
          )}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon">
            <Link2 className="w-6 h-6" />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">总链接数</div>
          </div>
        </div>
        <div className="stat-card stat-normal">
          <div className="stat-icon">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.normal}</div>
            <div className="stat-label">正常链接</div>
          </div>
        </div>
        <div className="stat-card stat-broken">
          <div className="stat-icon">
            <XCircle className="w-6 h-6" />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.broken}</div>
            <div className="stat-label">失效链接</div>
          </div>
        </div>
        <div className="stat-card stat-redirect">
          <div className="stat-icon">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.redirect}</div>
            <div className="stat-label">重定向链接</div>
          </div>
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-label">
          <Filter className="w-4 h-4 mr-2" />
          筛选结果
        </div>
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部 ({stats.total})
          </button>
          <button 
            className={`filter-btn ${filter === 'normal' ? 'active' : ''}`}
            onClick={() => setFilter('normal')}
          >
            正常 ({stats.normal})
          </button>
          <button 
            className={`filter-btn ${filter === 'broken' ? 'active' : ''}`}
            onClick={() => setFilter('broken')}
          >
            失效 ({stats.broken})
          </button>
          <button 
            className={`filter-btn ${filter === 'redirect' ? 'active' : ''}`}
            onClick={() => setFilter('redirect')}
          >
            重定向 ({stats.redirect})
          </button>
          <button 
            className={`filter-btn ${filter === 'error' ? 'active' : ''}`}
            onClick={() => setFilter('error')}
          >
            错误 ({stats.error + stats.timeout})
          </button>
        </div>
      </div>

      {lastCheckTime && (
        <div className="last-check-info">
          <span className="check-time-label">上次检测时间:</span>
          <span className="check-time-value">{formatTime(lastCheckTime)}</span>
        </div>
      )}

      <div className="results-list">
        {filteredResults.length === 0 ? (
          <div className="empty-results">
            <Link2 className="w-16 h-16 text-gray-400" />
            <p>暂无检测结果</p>
            <p className="empty-hint">点击"开始检测"按钮开始检测所有链接</p>
          </div>
        ) : (
          filteredResults.map(([url, result]) => (
            <div key={url} className={`result-item result-${result.status} ${selectedResults.has(url) ? 'selected' : ''}`}>
              <div className="result-checkbox">
                <input
                  type="checkbox"
                  checked={selectedResults.has(url)}
                  onChange={() => handleSelectResult(url)}
                />
              </div>
              <div className="result-icon">
                {result.status === 'normal' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {result.status === 'broken' && <XCircle className="w-5 h-5 text-red-500" />}
                {result.status === 'redirect' && <AlertCircle className="w-5 h-5 text-yellow-500" />}
                {result.status === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
                {result.status === 'timeout' && <AlertCircle className="w-5 h-5 text-orange-500" />}
              </div>
              <div className="result-content">
                <div className="result-title">{getBookmarkTitle(url)}</div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-url-link"
                  title="点击访问链接"
                >
                  {url}
                </a>
                <div className="result-path">
                  <span className="path-label">📁</span>
                  <span className="path-value">{getBookmarkPath(url)}</span>
                </div>
                <div className="result-meta">
                  {getStatusBadge(result.status)}
                  {result.statusCode && (
                    <span className="result-code">HTTP {result.statusCode}</span>
                  )}
                  {result.redirectUrl && (
                    <span className="result-redirect">→ {result.redirectUrl}</span>
                  )}
                  {result.error && (
                    <span className="result-error">{result.error}</span>
                  )}
                </div>
              </div>
              <div className="result-actions">
                <button
                  className="btn-delete-result"
                  onClick={() => handleDeleteResult(url)}
                  title="删除"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>
              <div className="result-time">
                {formatTime(result.checkTime)}
              </div>
            </div>
          ))
        )}
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">删除确认</h3>
            <p className="modal-desc">
              {deleteTargetUrl ? '确定要删除此链接吗？' : `确定要删除选中的 ${selectedResults.size} 个链接吗？`}
            </p>
            <div className="delete-options">
              <button
                className="delete-option btn-secondary"
                onClick={() => handleDeleteConfirmed(true)}
              >
                <Trash className="w-5 h-5 mb-2" />
                <span className="delete-option-label">移到回收站</span>
                <span className="delete-option-desc">可在回收站中恢复</span>
              </button>
              <button
                className="delete-option btn-danger"
                onClick={() => handleDeleteConfirmed(false)}
              >
                <X className="w-5 h-5 mb-2" />
                <span className="delete-option-label">彻底删除</span>
                <span className="delete-option-desc">无法恢复</span>
              </button>
            </div>
            <button
              className="btn btn-secondary mt-4"
              onClick={() => setShowDeleteModal(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkCheckPanel;
