import React from 'react';
import {
  FileText, Link2, Layers, Trash2,
  ChevronLeft, ChevronRight, User
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: 'bookmarks' | 'linkcheck' | 'duplicates' | 'trash' | 'account';
  onTabChange: (tab: 'bookmarks' | 'linkcheck' | 'duplicates' | 'trash' | 'account') => void;
  stats: {
    total: number;
    selected: number;
    folders: number;
    links: number;
  };
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onToggle, 
  activeTab, 
  onTabChange,
  stats 
}) => {
  const tabs = [
    {
      id: 'bookmarks' as const,
      label: '书签管理',
      icon: <FileText className="w-5 h-5" />,
      count: stats.total
    },
    {
      id: 'linkcheck' as const,
      label: '联通性检测',
      icon: <Link2 className="w-5 h-5" />,
      count: stats.links
    },
    {
      id: 'duplicates' as const,
      label: '重复检测',
      icon: <Layers className="w-5 h-5" />,
      count: null
    },
    {
      id: 'trash' as const,
      label: '回收站',
      icon: <Trash2 className="w-5 h-5" />,
      count: null
    },
    {
      id: 'account' as const,
      label: '账户管理',
      icon: <User className="w-5 h-5" />,
      count: null
    }
  ];

  return (
    <>
      <button 
        className={`sidebar-toggle ${isOpen ? 'open' : 'closed'}`}
        onClick={onToggle}
        title={isOpen ? '收起侧边栏' : '展开侧边栏'}
      >
        {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <FileText className="w-6 h-6" />
            <span className="sidebar-title">收藏夹助手</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
              {tab.count !== null && (
                <span className="nav-count">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="stats-summary">
            <div className="stat-row">
              <span className="stat-label">总书签:</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">已选中:</span>
              <span className="stat-value">{stats.selected}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">文件夹:</span>
              <span className="stat-value">{stats.folders}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">链接:</span>
              <span className="stat-value">{stats.links}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
