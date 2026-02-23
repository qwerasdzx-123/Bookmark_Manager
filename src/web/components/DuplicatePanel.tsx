import React, { useState, useEffect } from 'react';
import { Copy, Trash2, Search, Layers, AlertTriangle, CheckCircle } from 'lucide-react';
import { useBookmarkStore } from '../../store/bookmarkStore';
import ProgressBar from './ProgressBar';

interface DuplicateInfo {
  url: string;
  bookmarks: any[];
  similarity: number;
}

const DuplicatePanel: React.FC = () => {
  const { bookmarks, findDuplicates, deleteBookmarks } = useBookmarkStore();
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'exact' | 'similar'>('all');

  const handleScan = async () => {
    setIsScanning(true);
    
    // 先重新加载书签数据，确保获取最新数据
    const { loadBookmarks } = useBookmarkStore.getState();
    await loadBookmarks();
    
    // 获取最新的书签数据
    const { bookmarks: latestBookmarks } = useBookmarkStore.getState();
    
    if (!latestBookmarks || latestBookmarks.length === 0) {
      setDuplicates([]);
      setIsScanning(false);
      return;
    }
    
    setScanProgress({ current: 0, total: latestBookmarks.length });

    const total = latestBookmarks.length;
    let current = 0;

    const processNode = (node: any) => {
      current++;
      setScanProgress({ current, total });
      if (node.children) {
        node.children.forEach(processNode);
      }
    };

    latestBookmarks.forEach(processNode);

    await new Promise(resolve => setTimeout(resolve, 300));

    findDuplicates({ exactMatch: true, similarMatch: true });
    
    const duplicateResults: DuplicateInfo[] = [];
    const urlMap = new Map<string, any[]>();

    const collectDuplicates = (node: any) => {
      if (node.url) {
        const normalizedUrl = normalizeUrl(node.url);
        if (!urlMap.has(normalizedUrl)) {
          urlMap.set(normalizedUrl, []);
        }
        urlMap.get(normalizedUrl)!.push(node);
      }
      node.children?.forEach(collectDuplicates);
    };

    latestBookmarks.forEach(collectDuplicates);

    urlMap.forEach((bookmarkList, url) => {
      if (bookmarkList.length > 1) {
        duplicateResults.push({
          url,
          bookmarks: bookmarkList,
          similarity: 1
        });
      }
    });

    setDuplicates(duplicateResults);
    setIsScanning(false);
  };

  const normalizeUrl = (url: string): string => {
    try {
      const normalized = new URL(url);
      normalized.hash = '';
      normalized.search = '';
      return normalized.toString().toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  };

  const getBookmarkPath = (bookmark: any): string => {
    const path: string[] = [];
    
    const findPath = (nodes: any[], targetId: string, currentPath: string[]): boolean => {
      for (const node of nodes) {
        // 如果找到了目标书签，返回路径
        if (node.id === targetId) {
          path.push(...currentPath);
          return true;
        }
        
        // 如果是文件夹，递归查找子节点
        if (node.children && node.children.length > 0) {
          const newPath = [...currentPath, node.title || '未命名文件夹'];
          if (findPath(node.children, targetId, newPath)) {
            return true;
          }
        }
      }
      return false;
    };

    // 从根节点开始查找
    if (findPath(bookmarks, bookmark.id, [])) {
      return path.length > 0 ? path.join(' > ') : '收藏夹根目录';
    }
    
    return '收藏夹根目录';
  };

  const handleSelectDuplicate = (url: string) => {
    const newSelection = new Set(selectedDuplicates);
    if (newSelection.has(url)) {
      newSelection.delete(url);
    } else {
      newSelection.add(url);
    }
    setSelectedDuplicates(newSelection);
  };

  const handleDeleteSingle = async (url: string, bookmarkId: string) => {
    if (confirm(`确定要删除这个书签吗？`)) {
      setIsScanning(true);
      await deleteBookmarks([bookmarkId]);
      // 等待书签数据更新完成后再重新扫描
      await new Promise(resolve => setTimeout(resolve, 300));
      await handleScan();
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedDuplicates.size === 0) return;

    const idsToDelete: string[] = [];
    duplicates.forEach(duplicate => {
      if (selectedDuplicates.has(duplicate.url)) {
        const keepFirst = duplicate.bookmarks[0];
        const toDelete = duplicate.bookmarks.slice(1);
        toDelete.forEach(bookmark => {
          if (!idsToDelete.includes(bookmark.id)) {
            idsToDelete.push(bookmark.id);
          }
        });
      }
    });

    if (confirm(`确定要删除选中的 ${idsToDelete.length} 个重复书签吗？`)) {
      setIsScanning(true);
      await deleteBookmarks(idsToDelete);
      setSelectedDuplicates(new Set());
      // 等待书签数据更新完成后再重新扫描
      await new Promise(resolve => setTimeout(resolve, 300));
      await handleScan();
    }
  };

  const filteredDuplicates = React.useMemo(() => {
    if (filter === 'all') return duplicates;
    return duplicates.filter(d => {
      if (filter === 'exact') return d.similarity === 1;
      if (filter === 'similar') return d.similarity < 1;
      return true;
    });
  }, [duplicates, filter]);

  const stats = React.useMemo(() => {
    const totalDuplicates = duplicates.length;
    const totalBookmarks = duplicates.reduce((sum, d) => sum + d.bookmarks.length, 0);
    const canRemove = totalBookmarks - totalDuplicates;
    
    return {
      totalDuplicates,
      totalBookmarks,
      canRemove
    };
  }, [duplicates]);

  const formatSimilarity = (similarity: number) => {
    if (similarity === 1) return '完全相同';
    return `相似度 ${(similarity * 100).toFixed(0)}%`;
  };

  return (
    <div className="duplicate-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Layers className="w-5 h-5 mr-2" />
          重复检测
        </div>
        <div className="panel-actions">
          <button 
            className="btn btn-primary"
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? '扫描中...' : '开始扫描'}
          </button>
          {selectedDuplicates.size > 0 && (
            <button 
              className="btn btn-danger"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              删除选中 ({selectedDuplicates.size})
            </button>
          )}
        </div>
      </div>

      {isScanning && (
        <div className="progress-section">
          <ProgressBar 
            progress={scanProgress.current}
            total={scanProgress.total}
            message="正在扫描重复书签..."
            showPercentage={true}
          />
        </div>
      )}

      {!isScanning && duplicates.length > 0 && (
        <>
          <div className="stats-grid">
            <div className="stat-card stat-total">
              <div className="stat-icon">
                <Layers className="w-6 h-6" />
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats.totalDuplicates}</div>
                <div className="stat-label">重复组</div>
              </div>
            </div>
            <div className="stat-card stat-bookmarks">
              <div className="stat-icon">
                <Copy className="w-6 h-6" />
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats.totalBookmarks}</div>
                <div className="stat-label">涉及书签</div>
              </div>
            </div>
            <div className="stat-card stat-removable">
              <div className="stat-icon">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats.canRemove}</div>
                <div className="stat-label">可删除</div>
              </div>
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-label">
              <Search className="w-4 h-4 mr-2" />
              筛选结果
            </div>
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                全部 ({stats.totalDuplicates})
              </button>
              <button 
                className={`filter-btn ${filter === 'exact' ? 'active' : ''}`}
                onClick={() => setFilter('exact')}
              >
                完全相同
              </button>
              <button 
                className={`filter-btn ${filter === 'similar' ? 'active' : ''}`}
                onClick={() => setFilter('similar')}
              >
                相似
              </button>
            </div>
          </div>
        </>
      )}

      {!isScanning && duplicates.length === 0 && (
        <div className="empty-state">
          <CheckCircle className="w-16 h-16 text-gray-400" />
          <p>暂无重复书签</p>
          <p className="empty-hint">点击"开始扫描"按钮检测重复书签</p>
        </div>
      )}

      {!isScanning && filteredDuplicates.length > 0 && (
        <div className="duplicates-list">
          {filteredDuplicates.map((duplicate, index) => (
            <div 
              key={duplicate.url}
              className={`duplicate-card ${selectedDuplicates.has(duplicate.url) ? 'selected' : ''}`}
            >
              <div className="duplicate-header">
                <div className="duplicate-url">{duplicate.url}</div>
                <div className="duplicate-meta">
                  <span className="duplicate-count">{duplicate.bookmarks.length} 个重复</span>
                  <span className="duplicate-similarity">{formatSimilarity(duplicate.similarity)}</span>
                </div>
                <button 
                  className="duplicate-select"
                  onClick={() => handleSelectDuplicate(duplicate.url)}
                >
                  {selectedDuplicates.has(duplicate.url) ? '取消选择' : '选择删除'}
                </button>
              </div>
              <div className="duplicate-bookmarks">
                {duplicate.bookmarks.map((bookmark, idx) => (
                  <div key={bookmark.id} className={`bookmark-item ${idx === 0 ? 'keep' : 'delete'}`}>
                    {idx === 0 && (
                      <div className="keep-badge">
                        <CheckCircle className="w-4 h-4" />
                        保留
                      </div>
                    )}
                    <div className="bookmark-details">
                      <div className="bookmark-title">{bookmark.title || '未命名'}</div>
                      <div className="bookmark-location">
                        位置: {getBookmarkPath(bookmark)}
                      </div>
                    </div>
                    <button 
                      className="delete-single-btn"
                      onClick={() => handleDeleteSingle(duplicate.url, bookmark.id)}
                      title="删除此书签"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DuplicatePanel;
