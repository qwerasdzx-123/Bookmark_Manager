import React from 'react';
import { Folder, Link2, CheckCircle, XCircle, AlertCircle, RefreshCw, Trash2, GripVertical } from 'lucide-react';
import { useBookmarkStore } from '../../store/bookmarkStore';

interface BookmarkItemProps {
  bookmark: any;
  level?: number;
}

const BookmarkItem: React.FC<BookmarkItemProps> = ({ bookmark, level = 0 }) => {
  const { selectedBookmarks, selectBookmark, deselectBookmark, linkCheckResults, deleteBookmarks } = useBookmarkStore();
  const isSelected = selectedBookmarks.has(bookmark.id);
  const linkCheck = linkCheckResults.get(bookmark.url || '');

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      if (isSelected) {
        deselectBookmark(bookmark.id);
      } else {
        selectBookmark(bookmark.id);
      }
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
      case 'checking':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  if (bookmark.url) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={handleClick}
      >
        <GripVertical className="w-4 h-4 text-gray-400 cursor-move flex-shrink-0" />
        {getStatusIcon()}
        <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="flex-1 truncate text-sm">{bookmark.title || bookmark.url}</span>
        <button
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
          onClick={handleDelete}
          title="删除"
        >
          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        <GripVertical className="w-4 h-4 text-gray-400 cursor-move flex-shrink-0" />
        <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
        <span className="flex-1 truncate text-sm">{bookmark.title}</span>
        <button
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
          onClick={handleDelete}
          title="删除"
        >
          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
        </button>
      </div>
      {bookmark.children && bookmark.children.map((child: any) => (
        <BookmarkItem key={child.id} bookmark={child} level={level + 1} />
      ))}
    </div>
  );
};

export default BookmarkItem;
