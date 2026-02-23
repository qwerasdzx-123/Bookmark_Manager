import React from 'react';
import { Folder, Link2, CheckCircle, XCircle, AlertCircle, RefreshCw, Trash2, GripVertical } from 'lucide-react';
import { Draggable } from 'react-beautiful-dnd';
import { useBookmarkStore } from '../../store/bookmarkStore';

interface DraggableBookmarkItemProps {
  bookmark: any;
  level?: number;
  index: number;
  parentId?: string;
}

const DraggableBookmarkItem: React.FC<DraggableBookmarkItemProps> = ({ bookmark, level = 0, index, parentId }) => {
  const { selectedBookmarks, selectBookmark, deselectBookmark, linkCheckResults, deleteBookmarks, moveBookmarks } = useBookmarkStore();
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
      case 'checking':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <Draggable
      draggableId={bookmark.id}
      index={index}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`bookmark-item ${isSelected ? 'selected' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={handleClick}
        >
          <div {...provided.dragHandleProps} className="drag-handle" title="拖动">
            <GripVertical className="w-4 h-4 text-gray-400 cursor-move flex-shrink-0 mr-2" />
          </div>
          {getStatusIcon()}
          {bookmark.url ? (
            <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0 mr-2" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0 mr-2" />
          )}
          <span className="flex-1 truncate text-sm">
            {bookmark.title || bookmark.url || '未命名'}
          </span>
          <button
            className="delete-btn"
            onClick={handleDelete}
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </Draggable>
  );
};

export default DraggableBookmarkItem;