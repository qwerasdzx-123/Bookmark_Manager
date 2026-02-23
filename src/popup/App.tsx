import React, { useState } from 'react';
import { Upload, Download, Link2, Trash2, Search, Moon, Sun } from 'lucide-react';
import { useBookmarkStore } from '@/store/bookmarkStore';
import { useTheme } from './components/ThemeProvider';
import BookmarkItem from './components/BookmarkItem';

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
    clearSelection,
    setError
  } = useBookmarkStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  React.useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

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
    setShowImportModal(false);
  };

  const handleExport = async (format: 'html' | 'json') => {
    await exportBookmarks(format);
  };

  const handleDeleteSelected = async () => {
    if (selectedBookmarks.size === 0) return;
    
    if (confirm(`确定要删除选中的 ${selectedBookmarks.size} 个书签吗？`)) {
      await deleteBookmarks(Array.from(selectedBookmarks));
    }
  };

  const filteredBookmarks = bookmarks.filter(bookmark => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return bookmark.title.toLowerCase().includes(query) || 
           (bookmark.url && bookmark.url.toLowerCase().includes(query));
  });

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h1 className="text-lg font-semibold">收藏夹整理助手</h1>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </header>

      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索书签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            <Upload className="w-4 h-4" />
            导入
          </button>
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm">
              <Download className="w-4 h-4" />
              导出
            </button>
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleExport('html')}
                className="block w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-sm"
              >
                导出为HTML
              </button>
              <button
                onClick={() => handleExport('json')}
                className="block w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-sm"
              >
                导出为JSON
              </button>
            </div>
          </div>
          <button
            onClick={() => checkLinks()}
            disabled={isCheckingLinks}
            className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm disabled:opacity-50"
          >
            <Link2 className="w-4 h-4" />
            {isCheckingLinks ? `检测中 (${checkProgress.current}/${checkProgress.total})` : '检测链接'}
          </button>
          {selectedBookmarks.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              删除选中 ({selectedBookmarks.size})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            关闭
          </button>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">导入收藏夹</h2>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                点击选择文件或拖拽文件到此处
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                支持选择多个文件，可按网站类型自动分类整理
              </p>
              <input
                type="file"
                accept=".html,.json"
                onChange={handleImport}
                className="hidden"
                id="file-input"
                multiple
              />
              <label
                htmlFor="file-input"
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer text-sm"
              >
                选择文件
              </label>
            </div>
            <button
              onClick={() => setShowImportModal(false)}
              className="mt-4 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-sm text-gray-500">加载中...</p>
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">暂无书签</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredBookmarks.map(bookmark => (
              <BookmarkItem key={bookmark.id} bookmark={bookmark} />
            ))}
          </div>
        )}
      </div>

      <footer className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 text-center">
        按住 Ctrl/Cmd 点击可多选
      </footer>
    </div>
  );
};

export default App;
