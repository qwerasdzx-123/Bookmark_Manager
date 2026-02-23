export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  dateGroupModified?: number;
  index?: number;
  parentId?: string;
  children?: BookmarkNode[];
  status?: 'normal' | 'broken' | 'redirect' | 'checking' | 'timeout' | 'error';
  tags?: string[];
  notes?: string;
  statusCode?: number;
  error?: string;
  redirectUrl?: string;
  visitCount?: number;
  lastVisitTime?: number;
  folderExpanded?: boolean;
  metadata?: Record<string, any>;
}

export interface BookmarkFolder extends BookmarkNode {
  children: BookmarkNode[];
}

export interface ImportOptions {
  format: 'html' | 'json';
  mergeStrategy: 'replace' | 'merge' | 'skip';
  folderStructure?: boolean;
}

export interface ExportOptions {
  format: 'html' | 'json';
  includeBroken?: boolean;
  selectedFolders?: string[];
}

export interface LinkCheckResult {
  url: string;
  status: 'normal' | 'broken' | 'redirect' | 'timeout' | 'error';
  statusCode?: number;
  redirectUrl?: string;
  error?: string;
  checkTime: number;
}

export interface DuplicateInfo {
  url: string;
  bookmarks: BookmarkNode[];
  similarity: number;
}

export interface CategoryRule {
  id: string;
  name: string;
  keywords: string[];
  urlPatterns?: string[];
  targetFolder: string;
}

export interface SyncStatus {
  lastSyncTime: number;
  isOnline: boolean;
  pendingChanges: number;
  conflictCount: number;
}

export interface BackupInfo {
  id: string;
  timestamp: number;
  size: number;
  bookmarkCount: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  createdAt: number;
  lastSyncTime: number;
  syncEnabled: boolean;
}

export interface SyncData {
  userId: string;
  bookmarks: BookmarkNode[];
  timestamp: number;
  version: string;
}

export interface TrashItem {
  id: string;
  bookmark: BookmarkNode;
  deletedAt: number;
  originalParentId?: string;
}
