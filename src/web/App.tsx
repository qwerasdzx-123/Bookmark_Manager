import React, { useState, useEffect } from 'react';
import { 
  Upload, Download, Link2, Trash2, Search, Moon, Sun, 
  RefreshCw, History, Settings, Folder, FileText, 
  CheckCircle, XCircle, AlertCircle, Clock, BarChart3, 
  ChevronDown, ChevronRight, Grid, List, Undo, Redo, GripVertical
} from 'lucide-react';
import { useBookmarkStore } from '../store/bookmarkStore';
import { useTheme } from './components/ThemeProvider';
import ProgressBar from './components/ProgressBar';
import LinkCheckPanel from './components/LinkCheckPanel';
import DuplicatePanel from './components/DuplicatePanel';
import TrashPanel from './components/TrashPanel';
import UserAccountPanel from './components/UserAccountPanel';
import Sidebar from './components/Sidebar';

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const {
    bookmarks,
    selectedBookmarks,
    isCheckingLinks,
    checkProgress,
    isLoading,
    error,
    loadBookmarks,
    importBookmarks,
    importMultipleBookmarks,
    exportBookmarks,
    checkLinks,
    deleteBookmarks,
    cleanInvalidFolders,
    deleteFolder,
    moveBookmark,
    clearSelection,
    setError,
    undo,
    redo,
    canUndo,
    canRedo,
    organizeBookmarks
  } = useBookmarkStore();

  const [activeTab, setActiveTab] = useState<'bookmarks' | 'linkcheck' | 'duplicates' | 'trash' | 'account'>('bookmarks');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'tree'>('tree');

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 记录导入前的书签数量
    const { bookmarks: bookmarksBefore } = useBookmarkStore.getState();
    const folderIdsBefore = new Set<string>();
    const collectFolderIds = (nodes: any[]) => {
      for (const node of nodes) {
        if (!node.url) {
          folderIdsBefore.add(node.id);
          if (node.children) collectFolderIds(node.children);
        }
      }
    };
    collectFolderIds(bookmarksBefore);

    const fileList = Array.from(files);
    
    // 检查是否为批量导入
    if (fileList.length === 1) {
      // 单文件导入
      const file = fileList[0];
      const format = file.name.endsWith('.json') ? 'json' : 'html';
      await importBookmarks(file, format);
    } else {
      // 多文件导入，询问是否按类型分类
      const organizeByType = confirm(`检测到 ${fileList.length} 个文件。\n\n是否按网站类型自动分类整理？\n\n点击"确定"进行分类整理，点击"取消"保持原文件夹结构。`);
      await importMultipleBookmarks(fileList, organizeByType);
    }

    // 等待书签加载完成
    setTimeout(() => {
      const { bookmarks: bookmarksAfter } = useBookmarkStore.getState();
      
      // 找到新增的文件夹并展开
      const newFolderIds = new Set<string>();
      const collectNewFolderIds = (nodes: any[]) => {
        for (const node of nodes) {
          if (!node.url && !folderIdsBefore.has(node.id)) {
            newFolderIds.add(node.id);
            if (node.children) collectNewFolderIds(node.children);
          }
        }
      };
      collectNewFolderIds(bookmarksAfter);
      
      // 展开所有新增的文件夹
      setExpandedFolders(prev => new Set([...prev, ...newFolderIds]));
      
      console.log('自动展开导入的文件夹:', Array.from(newFolderIds));
    }, 500);

    setShowImportModal(false);
  };

  const handleExport = async (format: 'html' | 'json') => {
    await exportBookmarks(format);
    setShowExportModal(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedBookmarks.size === 0) return;
    
    if (confirm(`确定要删除选中的 ${selectedBookmarks.size} 个书签吗？`)) {
      await deleteBookmarks(Array.from(selectedBookmarks));
    }
  };

  const handleOrganizeBookmarks = async () => {
    if (confirm('确定要整理书签吗？这将按类别自动分类整理书签。')) {
      try {
        const result = await organizeBookmarks();
        alert(`整理完成！\n\n已整理 ${result.organizedCount} 个书签\n创建了 ${result.createdFolders.length} 个新文件夹\n移动了 ${result.movedBookmarks} 个书签`);
      } catch (error) {
        alert('整理书签失败：' + (error as Error).message);
      }
    }
  };

  const handleCleanInvalidFolders = async () => {
    if (confirm('确定要清理无效文件夹吗？这将删除空文件夹和未命名文件夹。')) {
      try {
        const count = await cleanInvalidFolders();
        if (count > 0) {
          alert(`清理完成！\n\n删除了 ${count} 个无效文件夹`);
        } else {
          alert('没有找到无效文件夹');
        }
      } catch (error) {
        alert('清理无效文件夹失败：' + (error as Error).message);
      }
    }
  };

  const handleDeleteFolder = async (folderId: string, folderTitle: string) => {
    if (confirm(`确定要删除文件夹"${folderTitle}"吗？该文件夹及其所有内容将被移到回收站。`)) {
      try {
        await deleteFolder(folderId);
      } catch (error) {
        alert('删除文件夹失败：' + (error as Error).message);
      }
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // 辅助函数：展开树状结构为扁平化数组
  const flattenBookmarks = (bookmarks: any[]): any[] => {
    const result: any[] = [];
    
    const traverse = (nodes: any[]) => {
      for (const node of nodes) {
        result.push(node);
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    
    traverse(bookmarks);
    return result;
  };

  // 过滤书签（包括子节点）
  const filteredBookmarks = (() => {
    const result: any[] = [];
    
    const traverse = (nodes: any[]) => {
      for (const node of nodes) {
        // 总是添加当前节点
        result.push(node);
        
        // 如果是文件夹且已展开，也添加其所有子项
        if (!node.url && expandedFolders.has(node.id) && node.children && node.children.length > 0) {
          const collectChildren = (children: any[]) => {
            for (const child of children) {
              result.push(child);
              if (child.children && child.children.length > 0) {
                collectChildren(child.children);
              }
            }
          };
          collectChildren(node.children);
        }
      }
    };
    
    traverse(bookmarks);
    
    // 应用搜索过滤
    if (!searchQuery) return result;
    const query = searchQuery.toLowerCase();
    return result.filter(bookmark => {
      return bookmark.title.toLowerCase().includes(query) || 
             (bookmark.url && bookmark.url.toLowerCase().includes(query));
    });
  })();

  // 统计信息
  const allBookmarks = flattenBookmarks(bookmarks);
  const stats = {
    total: allBookmarks.length,
    selected: selectedBookmarks.size,
    folders: allBookmarks.filter(b => !b.url).length,
    links: allBookmarks.filter(b => b.url).length
  };

  // 渲染书签树（支持文件夹展开/折叠）
  const renderBookmarkTree = (nodes: any[]) => {
    return nodes.map(node => {
      if (node.url) {
        // 书签项
        return (
          <BookmarkCard 
            key={node.id} 
            bookmark={node}
            isSelected={selectedBookmarks.has(node.id)}
          />
        );
      } else {
        // 文件夹
        const isExpanded = expandedFolders.has(node.id);
        return (
          <div key={node.id} className="bookmark-folder">
            <div 
              className={`folder-header ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.id);
              }}
            >
              <div className="folder-icon">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Folder className="w-4 h-4 ml-1" />
              </div>
              <h3 className="folder-title">{node.title || '未命名文件夹'}</h3>
              <span className="folder-count">({node.children?.length || 0})</span>
              <button
                className="folder-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(node.id, node.title || '未命名文件夹');
                }}
                title="删除文件夹"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            {isExpanded && node.children && node.children.length > 0 && (
              <div className="folder-content">
                {renderBookmarkTree(node.children)}
              </div>
            )}
          </div>
        );
      }
    });
  };

  return (
    <div className={`app-container ${theme}`}>
      <Sidebar 
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        stats={stats}
      />

      <main className={`main-content ${!sidebarOpen ? 'sidebar-closed' : ''}`}>
        <header className="app-header">
          <div className="header-left">
            <button 
              className="icon-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="切换侧边栏"
            >
              <Folder className="w-5 h-5" />
            </button>
            <h1 className="app-title">收藏夹整理助手</h1>
          </div>

          <div className="header-center">
            <div className="search-box">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="搜索书签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="header-right">
            <button 
              className="icon-button"
              onClick={toggleTheme}
              title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'bookmarks' && (
            <div className="bookmarks-panel">
              <div className="panel-header">
                <div className="panel-title">
                  <FileText className="w-5 h-5 mr-2" />
                  书签列表
                </div>
                <div className="panel-actions">
                  {filteredBookmarks.length > 0 && (
                    <>
                      <label className="select-all">
                        <input
                          type="checkbox"
                          checked={selectedBookmarks.size === filteredBookmarks.length}
                          onChange={() => {
                            const { selectMultipleBookmarks, clearSelection } = useBookmarkStore.getState();
                            if (selectedBookmarks.size === filteredBookmarks.length) {
                              clearSelection();
                            } else {
                              // 全选：收集所有展开的文件夹中的所有子项
                              const allIds: string[] = [];
                              const collectExpandedItems = (nodes: any[], expandedFolders: Set<string>) => {
                                for (const node of nodes) {
                                  // 总是添加当前节点
                                  allIds.push(node.id);
                                  
                                  // 如果是文件夹且已展开，也添加其所有子项
                                  if (!node.url && expandedFolders.has(node.id) && node.children && node.children.length > 0) {
                                    const collectChildren = (children: any[]) => {
                                      for (const child of children) {
                                        allIds.push(child.id);
                                        if (child.children && child.children.length > 0) {
                                          collectChildren(child.children);
                                        }
                                      }
                                    };
                                    collectChildren(node.children);
                                  }
                                }
                              };
                              
                              collectExpandedItems(filteredBookmarks, expandedFolders);
                              selectMultipleBookmarks(allIds);
                            }
                          }}
                        />
                        <span className="ml-2">全选</span>
                      </label>
                      {selectedBookmarks.size > 0 && (
                        <button
                          className="btn btn-danger"
                          onClick={handleDeleteSelected}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除 ({selectedBookmarks.size})
                        </button>
                      )}
                    </>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowImportModal(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    导入
                  </button>
                  <button 
                    className="btn btn-success"
                    onClick={() => setShowExportModal(true)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    导出
                  </button>
                  <button
                    className="btn btn-warning"
                    onClick={handleOrganizeBookmarks}
                    title="智能整理书签，自动分类和分组"
                  >
                    <Folder className="w-4 h-4 mr-2" />
                    整理书签
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleCleanInvalidFolders}
                    title="清理空文件夹和未命名文件夹"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    清理无效文件夹
                  </button>
                  <div className="view-mode-toggle">
                    <button 
                      className={`btn btn-secondary ${viewMode === 'tree' ? 'active' : ''}`}
                      onClick={() => setViewMode('tree')}
                      title="树状视图"
                    >
                      <Folder className="w-4 h-4" />
                    </button>
                    <button 
                      className={`btn btn-secondary ${viewMode === 'grid' ? 'active' : ''}`}
                      onClick={() => setViewMode('grid')}
                      title="图标视图"
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button 
                      className={`btn btn-secondary ${viewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setViewMode('list')}
                      title="列表视图"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => undo()}
                    disabled={!canUndo}
                    title="撤销"
                  >
                    <Undo className="w-4 h-4 mr-2" />
                    撤销
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => redo()}
                    disabled={!canRedo}
                    title="重做"
                  >
                    <Redo className="w-4 h-4 mr-2" />
                    重做
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-banner">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {error}
                  <button 
                    className="error-close"
                    onClick={() => setError(null)}
                  >
                    关闭
                  </button>
                </div>
              )}

              {isLoading ? (
                <div className="loading-state">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                  <p>加载中...</p>
                </div>
              ) : filteredBookmarks.length === 0 ? (
                <div className="empty-state">
                  <Folder className="w-16 h-16 text-gray-400" />
                  <p>暂无书签</p>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'bookmarks-grid' : 'bookmarks-list'}>
                  {viewMode === 'tree' ? (
                    // 树状视图 - 普通显示
                    renderBookmarkTree(bookmarks)
                  ) : (
                    // 网格或列表视图
                    filteredBookmarks.map(bookmark => (
                      <BookmarkCard 
                        key={bookmark.id} 
                        bookmark={bookmark}
                        isSelected={selectedBookmarks.has(bookmark.id)}
                        viewMode={viewMode}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'linkcheck' && (
            <LinkCheckPanel />
          )}

          {activeTab === 'duplicates' && (
            <DuplicatePanel />
          )}

          {activeTab === 'trash' && (
            <TrashPanel />
          )}

          {activeTab === 'account' && (
            <UserAccountPanel />
          )}
        </div>
      </main>

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">导入收藏夹</h2>
            <div className="upload-area">
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <p className="upload-text">点击选择文件或拖拽文件到此处</p>
              <p className="upload-hint">支持选择多个文件，可按网站类型自动分类整理</p>
              <input
                type="file"
                accept=".html,.json"
                onChange={handleImport}
                className="hidden"
                id="file-input"
                multiple
              />
              <label htmlFor="file-input" className="btn btn-primary">
                选择文件
              </label>
            </div>
            <button 
              className="btn btn-secondary mt-4"
              onClick={() => setShowImportModal(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">导出收藏夹</h2>
            <div className="export-options">
              <button 
                className="export-option"
                onClick={() => handleExport('html')}
              >
                <FileText className="w-8 h-8 mb-2" />
                <span className="export-label">HTML 格式</span>
                <span className="export-desc">浏览器兼容格式</span>
              </button>
              <button 
                className="export-option"
                onClick={() => handleExport('json')}
              >
                <FileText className="w-8 h-8 mb-2" />
                <span className="export-label">JSON 格式</span>
                <span className="export-desc">数据交换格式</span>
              </button>
            </div>
            <button 
              className="btn btn-secondary mt-4"
              onClick={() => setShowExportModal(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const BookmarkCard: React.FC<{ 
  bookmark: any; 
  isSelected: boolean;
  viewMode?: 'grid' | 'list' | 'tree';
}> = ({ bookmark, isSelected, viewMode = 'grid' }) => {
  const { selectedBookmarks, selectBookmark, deselectBookmark, linkCheckResults, deleteBookmarks } = useBookmarkStore();
  const linkCheck = linkCheckResults.get(bookmark.url || '');

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      if (isSelected) {
        deselectBookmark(bookmark.id);
      } else {
        selectBookmark(bookmark.id);
      }
    } else if (bookmark.url) {
      window.open(bookmark.url, '_blank');
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定要删除"${bookmark.title || bookmark.url}"吗？`)) {
      deleteBookmarks([bookmark.id]);
    }
  };

  const getStatusIcon = () => {
    if (!linkCheck) return null;
    
    switch (linkCheck.status) {
      case 'normal':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'broken':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'redirect':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div 
      className={`bookmark-card ${isSelected ? 'selected' : ''} ${viewMode === 'list' ? 'list-view' : ''}`}
      onClick={handleClick}
    >
      {viewMode === 'list' ? (
        // 列表视图
        <div className="bookmark-list-item">
          <div className="list-item-icon">
            {bookmark.url ? <Link2 className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
          </div>
          <div className="list-item-info">
            <h3 className="list-item-title">{bookmark.title || '未命名'}</h3>
            {bookmark.url && (
              <p className="list-item-url">{bookmark.url}</p>
            )}
          </div>
          {bookmark.children && bookmark.children.length > 0 && (
            <div className="list-item-children">
              <span className="children-count">{bookmark.children.length} 个子项</span>
            </div>
          )}
          <div className="list-item-actions">
            <button
              className="list-item-action-btn"
              onClick={handleDelete}
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="list-item-status">
            {getStatusIcon()}
          </div>
        </div>
      ) : (
        // 网格视图
        <div className="bookmark-header">
          <div className="bookmark-drag-handle">
            <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
          </div>
          <div className="bookmark-icon">
            {bookmark.url ? <Link2 className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
          </div>
          <div className="bookmark-info">
            <h3 className="bookmark-title">{bookmark.title || '未命名'}</h3>
            {bookmark.url && (
              <p className="bookmark-url">{bookmark.url}</p>
            )}
          </div>
          <div className="bookmark-actions">
            <button
              className="bookmark-action-btn"
              onClick={handleDelete}
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="bookmark-status">
            {getStatusIcon()}
          </div>
        </div>
      )}
      {viewMode === 'grid' && bookmark.children && bookmark.children.length > 0 && (
        <div className="bookmark-children">
          <span className="children-count">{bookmark.children.length} 个子项</span>
        </div>
      )}
    </div>
  );
};

export default App;