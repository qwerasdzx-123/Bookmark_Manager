import React from 'react';
import { ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { DragDropContext, DropResult, Droppable, Draggable } from 'react-beautiful-dnd';
import DraggableBookmarkItem from './DraggableBookmarkItem';
import { useBookmarkStore } from '../../store/bookmarkStore';

interface DraggableBookmarkTreeProps {
  bookmarks: any[];
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  onMoveBookmark: (draggedId: string, targetId: string, index?: number) => void;
}

const DraggableBookmarkTree: React.FC<DraggableBookmarkTreeProps> = ({
  bookmarks,
  expandedFolders,
  onToggleFolder,
  onMoveBookmark
}) => {
  const renderBookmarkNode = (node: any, level: number = 0, parentId?: string, siblingIndex: number = 0) => {
    if (node.url) {
      // 书签项 - 可拖拽
      return (
        <DraggableBookmarkItem
          key={node.id}
          bookmark={node}
          level={level}
          index={siblingIndex}
          parentId={parentId}
        />
      );
    } else if (node.children && node.children.length > 0) {
      // 文件夹 - 可拖拽且可放置
      const isExpanded = expandedFolders.has(node.id);

      return (
        <Droppable
          key={node.id}
          droppableId={node.id}
          type="FOLDER"
        >
          {(provided, snapshot) => (
            <div 
              className="bookmark-folder" 
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              <div
                className={`folder-header ${isExpanded ? 'expanded' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFolder(node.id);
                }}
              >
                <div className="folder-icon">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Folder className="w-4 h-4 ml-1" />
                </div>
                <h3 className="folder-title">{node.title || '未命名文件夹'}</h3>
                <span className="folder-count">({node.children?.length || 0})</span>
              </div>

              {isExpanded && node.children && node.children.length > 0 && (
                <div className="folder-content">
                  {node.children.map((child: any, index: number) => (
                    renderBookmarkNode(child, level + 1, node.id, index)
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </div>
          )}
        </Droppable>
      );
    }

    return null;
  };

  return (
    <DragDropContext onDragEnd={(result: DropResult) => {
      console.log('=== 拖拽事件触发 ===');
      console.log('   拖拽结果:', result);
      
      if (!result.destination) {
        console.log('   没有目标位置，取消拖拽');
        return;
      }

      const { draggableId, source, destination } = result;
      
      console.log('   拖拽ID:', draggableId);
      console.log('   源位置:', source);
      console.log('   目标位置:', destination);
      
      // 处理拖拽到不同的位置
      if (source.droppableId !== destination.droppableId || source.index !== destination.index) {
        console.log('   执行移动操作');
        onMoveBookmark(draggableId, destination.droppableId, destination.index);
      } else {
        console.log('   位置未改变，不执行操作');
      }
    }}>
      <Droppable droppableId="ROOT" type="ROOT">
        {(provided, snapshot) => (
          <div 
            className="bookmarks-tree" 
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {bookmarks.map((node: any, index: number) => renderBookmarkNode(node, 0, undefined, index))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default DraggableBookmarkTree;