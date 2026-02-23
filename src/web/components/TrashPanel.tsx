import React, { useState } from 'react';
import { Trash2, RefreshCw, RotateCcw, X, Folder, FileText, AlertCircle } from 'lucide-react';
import { useBookmarkStore } from '../../store/bookmarkStore';

const TrashPanel: React.FC = () => {
  const { trashItems, moveToTrash, restoreFromTrash, deleteFromTrash, clearTrash, isLoading } = useBookmarkStore();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const handleSelectItem = (id: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === trashItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(trashItems.map(item => item.id)));
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreFromTrash(id);
    } catch (error) {
      console.error('恢复失败:', error);
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedItems.size === 0) return;

    if (confirm(`确定要恢复选中的 ${selectedItems.size} 个项目吗？`)) {
      for (const id of selectedItems) {
        try {
          await restoreFromTrash(id);
        } catch (error) {
          console.error('恢复失败:', id, error);
        }
      }
      setSelectedItems(new Set());
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要永久删除此项目吗？此操作不可恢复！')) {
      try {
        await deleteFromTrash(id);
      } catch (error) {
        console.error('删除失败:', error);
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;

    if (confirm(`确定要永久删除选中的 ${selectedItems.size} 个项目吗？此操作不可恢复！`)) {
      for (const id of selectedItems) {
        try {
          await deleteFromTrash(id);
        } catch (error) {
          console.error('删除失败:', id, error);
        }
      }
      setSelectedItems(new Set());
    }
  };

  const handleClearTrash = async () => {
    if (trashItems.length === 0) return;

    if (confirm(`确定要清空回收站吗？这将永久删除 ${trashItems.length} 个项目，此操作不可恢复！`)) {
      try {
        await clearTrash();
      } catch (error) {
        console.error('清空回收站失败:', error);
      }
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="trash-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Trash2 className="w-5 h-5 mr-2" />
          回收站
        </div>
        <div className="panel-actions">
          <label className="select-all">
            <input
              type="checkbox"
              checked={selectedItems.size === trashItems.length && trashItems.length > 0}
              onChange={handleSelectAll}
              disabled={trashItems.length === 0}
            />
            <span className="ml-2">全选</span>
          </label>
          {selectedItems.size > 0 && (
            <>
              <button
                className="btn btn-success"
                onClick={handleRestoreSelected}
                disabled={isLoading}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                恢复选中 ({selectedItems.size})
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteSelected}
                disabled={isLoading}
              >
                <X className="w-4 h-4 mr-2" />
                永久删除 ({selectedItems.size})
              </button>
            </>
          )}
          {trashItems.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={handleClearTrash}
              disabled={isLoading}
              title="清空回收站"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清空
            </button>
          )}
        </div>
      </div>

      <div className="trash-content">
        <div className="trash-stats">
          <div className="stat-item">
            <Folder className="w-4 h-4 mr-2 text-yellow-500" />
            <span className="stat-label">文件夹:</span>
            <span className="stat-value">
              {trashItems.filter(item => !item.bookmark.url).length}
            </span>
          </div>
          <div className="stat-item">
            <FileText className="w-4 h-4 mr-2 text-blue-500" />
            <span className="stat-label">书签:</span>
            <span className="stat-value">
              {trashItems.filter(item => item.bookmark.url).length}
            </span>
          </div>
          <div className="stat-item">
            <AlertCircle className="w-4 h-4 mr-2 text-gray-500" />
            <span className="stat-label">总计:</span>
            <span className="stat-value">{trashItems.length}</span>
          </div>
        </div>

        {trashItems.length === 0 ? (
          <div className="empty-trash">
            <Trash2 className="w-16 h-16 text-gray-400" />
            <p>回收站为空</p>
            <p className="empty-hint">删除的书签会保存在这里，可以随时恢复</p>
          </div>
        ) : (
          <div className="trash-list">
            {trashItems.map((trashItem) => (
              <div
                key={trashItem.id}
                className={`trash-item ${selectedItems.has(trashItem.id) ? 'selected' : ''}`}
              >
                <div className="trash-item-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(trashItem.id)}
                    onChange={() => handleSelectItem(trashItem.id)}
                  />
                </div>
                <div className="trash-item-content">
                  <div className="trash-item-header">
                    <div className="trash-item-icon">
                      {trashItem.bookmark.url ? (
                        <FileText className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Folder className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                    <div className="trash-item-info">
                      <h4 className="trash-item-title">
                        {trashItem.bookmark.title || '未命名'}
                      </h4>
                      {trashItem.bookmark.url && (
                        <p className="trash-item-url">{trashItem.bookmark.url}</p>
                      )}
                    </div>
                    <div className="trash-item-time">
                      {formatTime(trashItem.deletedAt)}
                    </div>
                  </div>
                </div>
                <div className="trash-item-actions">
                  <button
                    className="btn-icon btn-restore"
                    onClick={() => handleRestore(trashItem.id)}
                    title="恢复"
                    disabled={isLoading}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    className="btn-icon btn-delete"
                    onClick={() => handleDelete(trashItem.id)}
                    title="永久删除"
                    disabled={isLoading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrashPanel;