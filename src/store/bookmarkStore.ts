import { create } from 'zustand';
import { BookmarkNode, LinkCheckResult, DuplicateInfo, BackupInfo, User, TrashItem } from '../types';
import { bookmarkImportExportService } from '../services/bookmarkImportExport';
import { linkCheckerService } from '../services/linkChecker';
import { bookmarkOrganizerService } from '../services/bookmarkOrganizer';
import { indexedDBService } from '../services/indexedDB';
import { cloudSyncService } from '../services/cloudSync';

interface HistoryRecord {
  id: string;
  type: 'linkcheck' | 'duplicate' | 'import' | 'export' | 'delete';
  timestamp: number;
  details: {
    total?: number;
    success?: number;
    failed?: number;
    format?: string;
    filename?: string;
    count?: number;
  };
}

interface BookmarkStore {
  bookmarks: BookmarkNode[];
  selectedBookmarks: Set<string>;
  linkCheckResults: Map<string, LinkCheckResult>;
  realtimeCheckResults: Map<string, LinkCheckResult>;
  duplicates: DuplicateInfo[];
  isCheckingLinks: boolean;
  isPaused: boolean;
  currentCheckingUrl: string | null;
  checkProgress: { current: number; total: number };
  isLoading: boolean;
  error: string | null;
  history: HistoryRecord[];
  // 撤销/重做相关
  undoStack: BookmarkNode[][];
  redoStack: BookmarkNode[][];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearHistory: () => void;

  loadBookmarks: () => Promise<void>;
  importBookmarks: (file: File, format: 'html' | 'json') => Promise<void>;
  importMultipleBookmarks: (files: File[], organizeByType: boolean) => Promise<void>;
  exportBookmarks: (format: 'html' | 'json', selectedFolders?: string[]) => Promise<void>;
  checkLinks: (bookmarks?: BookmarkNode[]) => Promise<void>;
  cancelCheckLinks: () => void;
  clearLinkCheckResults: () => void;
  removeLinkCheckResult: (url: string) => void;
  pauseCheckLinks: () => void;
  resumeCheckLinks: () => void;
  findDuplicates: (options: { exactMatch: boolean; similarMatch: boolean }) => void;
  selectBookmark: (id: string) => void;
  selectMultipleBookmarks: (ids: string[]) => void;
  deselectBookmark: (id: string) => void;
  clearSelection: () => void;
  deleteBookmarks: (ids: string[]) => Promise<void>;
  moveBookmarks: (ids: string[], targetFolderId: string) => Promise<void>;
  updateBookmark: (id: string, updates: Partial<BookmarkNode>) => Promise<void>;
  createFolder: (parentId: string, title: string) => Promise<void>;
  moveBookmark: (bookmarkId: string, targetFolderId: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  cleanInvalidFolders: () => Promise<number>;
  searchBookmarks: (query: string) => BookmarkNode[];
  setError: (error: string | null) => void;
  addHistoryRecord: (record: Omit<HistoryRecord, 'id'>) => void;
  
  // 书签整理功能
  organizeBookmarks: (strategy?: 'smart' | 'simple') => Promise<{
    organizedCount: number;
    createdFolders: string[];
    movedBookmarks: number;
  }>;
  // 云同步相关
  cloudUser: User | null;
  isLoggedIn: () => boolean;
  cloudLogin: (email: string, password: string) => Promise<void>;
  cloudRegister: (email: string, username: string, password: string) => Promise<void>;
  cloudLogout: () => Promise<void>;
  cloudUpdateUsername: (newUsername: string) => Promise<void>;
  cloudUpdatePassword: (newPassword: string) => Promise<void>;
  cloudDeleteAccount: () => Promise<void>;
  syncBookmarks: () => Promise<void>;
}

const addHistory = (record: Omit<HistoryRecord, 'id'>) => {
  const history = JSON.parse(localStorage.getItem('operationHistory') || '[]');
  const newRecord: HistoryRecord = {
    ...record,
    id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  history.unshift(newRecord);
  localStorage.setItem('operationHistory', JSON.stringify(history.slice(0, 100)));
  return newRecord;
};

// 辅助函数：展开树状结构为扁平化数组
const flattenBookmarks = (bookmarks: BookmarkNode[]): BookmarkNode[] => {
  const result: BookmarkNode[] = [];
  
  const traverse = (nodes: BookmarkNode[]) => {
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

export const useBookmarkStore = create<BookmarkStore>((set, get) => ({
  bookmarks: [],
  selectedBookmarks: new Set(),
  linkCheckResults: new Map(),
  realtimeCheckResults: new Map(),
  duplicates: [],
  isCheckingLinks: false,
  isPaused: false,
  currentCheckingUrl: null,
  checkProgress: { current: 0, total: 0 },
  isLoading: false,
  error: null,
  history: [],
  cloudUser: cloudSyncService.getCurrentUser(),
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  trashItems: [],

  loadBookmarks: async () => {
    set({ isLoading: true, error: null });
    console.log('=== 开始加载书签 ===');
    
    try {
      // 1. 从浏览器API获取书签
      console.log('1. 从浏览器API获取书签');
      const chromeBookmarksTree = await chrome.bookmarks.getTree();
      console.log('   浏览器书签树:', chromeBookmarksTree);
      
      // 2. 获取链接检查结果
      console.log('2. 获取链接检查结果');
      const linkChecks = await indexedDBService.getAllLinkChecks();
      console.log('   链接检查结果数量:', linkChecks.length);
      
      const linkCheckMap = new Map<string, LinkCheckResult>();
      linkChecks.forEach(check => {
        linkCheckMap.set(check.url, check);
      });

      // 3. 获取历史记录
      const history = JSON.parse(localStorage.getItem('operationHistory') || '[]');
      set({ history });

      // 4. 处理浏览器书签树
      console.log('3. 处理浏览器书签树');
      const processNode = (node: any): BookmarkNode => {
        const bookmark: BookmarkNode = {
          id: node.id,
          title: node.title,
          url: node.url,
          dateAdded: node.dateAdded,
          dateGroupModified: node.dateGroupModified,
          index: node.index,
          parentId: node.parentId,
          status: linkCheckMap.get(node.url || '')?.status,
          tags: node.tags,
          notes: node.notes
        };

        if (node.children && node.children.length > 0) {
          bookmark.children = node.children.map(processNode);
        }

        return bookmark;
      };

      // 5. 处理浏览器书签
      const processedBrowserBookmarks = chromeBookmarksTree.map(processNode);
      console.log('   处理后的浏览器书签:', processedBrowserBookmarks);
      console.log('   书签树详细结构:');
      const printTree = (nodes: any[], depth: number = 0): void => {
        const indent = '  '.repeat(depth);
        for (const node of nodes) {
          console.log(`${indent}- ID: ${node.id}, Title: "${node.title}", URL: ${node.url || 'N/A'}, Children: ${node.children?.length || 0}`);
          if (node.children && node.children.length > 0) {
            printTree(node.children, depth + 1);
          }
        }
      };
      printTree(processedBrowserBookmarks);
      
      // 6. 只显示书签栏的内容，不显示根节点和其他书签
      // Chrome 的根文件夹：0=其他书签, 1=书签栏, 2=移动设备, 3=菜单栏（注意：ID 是数字类型）
      
      // 辅助函数：在整个树中查找节点
      const findNodeInTree = (nodes: BookmarkNode[], targetId: string | number): BookmarkNode | null => {
        for (const node of nodes) {
          if (node.id == targetId) {
            return node;
          }
          if (node.children && node.children.length > 0) {
            const found = findNodeInTree(node.children, targetId);
            if (found) return found;
          }
        }
        return null;
      };
      
      const bookmarksBar = findNodeInTree(processedBrowserBookmarks, '1');
      console.log('   查找书签栏 (ID=1):', bookmarksBar);
      
      let displayBookmarks: BookmarkNode[] = [];
      if (bookmarksBar && bookmarksBar.children) {
        // 返回书签栏的子节点，不包括书签栏本身
        displayBookmarks = bookmarksBar.children;
        console.log('   书签栏包含', displayBookmarks.length, '个子项');
      } else {
        console.warn('   未找到书签栏或书签栏为空');
        console.warn('   bookmarksBar 存在:', !!bookmarksBar);
        console.warn('   bookmarksBar.children 存在:', !!(bookmarksBar?.children));
        console.warn('   bookmarksBar.children 长度:', bookmarksBar?.children?.length);
      }
      
      console.log('   最终书签数据:', displayBookmarks);
      console.log('   扁平化后数量:', flattenBookmarks(displayBookmarks).length);

      // 加载回收站数据
      const trashData = localStorage.getItem('trashItems');
      const trashItems = trashData ? JSON.parse(trashData) : [];

      set({
        bookmarks: displayBookmarks,
        linkCheckResults: linkCheckMap,
        trashItems: trashItems,
        isLoading: false
      });

      console.log('=== 书签加载完成 ===');
      console.log('   回收站项目:', trashItems.length);
    } catch (error) {
      console.error('❌ 加载书签失败:', error);
      set({
        error: (error as Error).message,
        isLoading: false
      });
    }
  },

  importBookmarks: async (file: File, format: 'html' | 'json') => {
    set({ isLoading: true, error: null });
    console.log('=== 开始导入书签 ===');
    console.log('   文件:', file.name);
    console.log('   格式:', format);
    
    try {
      let importedBookmarks = await bookmarkImportExportService.importBookmarks(file, {
        format,
        mergeStrategy: 'merge'
      });
      
      console.log('   导入的书签数量:', importedBookmarks.length);
      
      // 打印书签树结构
      const printTree = (nodes: BookmarkNode[], depth: number = 0): void => {
        const indent = '  '.repeat(depth);
        for (const node of nodes) {
          if (node.url) {
            console.log(`${indent}📄 ${node.title} (${node.url})`);
          } else {
            console.log(`${indent}📁 ${node.title} (${node.children?.length || 0} 个子项)`);
            if (node.children && node.children.length > 0) {
              printTree(node.children, depth + 1);
            }
          }
        }
      };
      console.log('   导入的书签树结构:');
      printTree(importedBookmarks);

      // 验证书签数据
      console.log('=== 验证书签数据 ===');
      const validation = bookmarkImportExportService.validateBookmarks(importedBookmarks);
      if (!validation.valid) {
        console.warn('验证发现问题:', validation.errors);
        validation.errors.forEach(err => console.warn('  -', err));
      }

      // 清理无效的书签和文件夹
      console.log('=== 清理无效的书签和文件夹 ===');
      const beforeCleanCount = flattenBookmarks(importedBookmarks).length;
      importedBookmarks = bookmarkImportExportService.cleanBookmarks(importedBookmarks);
      const afterCleanCount = flattenBookmarks(importedBookmarks).length;
      console.log(`   清理前: ${beforeCleanCount} 个节点`);
      console.log(`   清理后: ${afterCleanCount} 个节点`);
      console.log(`   移除了 ${beforeCleanCount - afterCleanCount} 个无效节点`);

      // 移除重复的书签
      console.log('=== 移除重复的书签 ===');
      const beforeDupCount = flattenBookmarks(importedBookmarks).length;
      importedBookmarks = bookmarkImportExportService.removeDuplicates(importedBookmarks);
      const afterDupCount = flattenBookmarks(importedBookmarks).length;
      console.log(`   去重前: ${beforeDupCount} 个节点`);
      console.log(`   去重后: ${afterDupCount} 个节点`);
      console.log(`   移除了 ${beforeDupCount - afterDupCount} 个重复节点`);

      if (importedBookmarks.length === 0) {
        console.warn('导入后没有有效的书签');
        set({ 
          error: '导入的文件中没有有效的书签',
          isLoading: false 
        });
        return;
      }

      // 递归创建书签到浏览器（直接在书签栏根目录创建）
      const createBookmarkNode = async (node: BookmarkNode, parentId: string, depth: number = 0): Promise<void> => {
        const indent = '  '.repeat(depth);
        console.log(`${indent}createBookmarkNode: node.title=${node.title}, node.url=${node.url}, parentId=${parentId}`);
        
        if (node.url) {
          // 创建书签
          const result = await chrome.bookmarks.create({
            parentId,
            title: node.title || '未命名',
            url: node.url
          });
          console.log(`${indent}  ✓ 创建书签: ${node.title} → ${result.id} (parentId: ${parentId})`);
        } else {
          // 这是一个文件夹
          if (node.title && node.title.trim() !== '') {
            const folder = await chrome.bookmarks.create({
              parentId,
              title: node.title
            });
            console.log(`${indent}  ✓ 创建文件夹: ${node.title} → ${folder.id} (parentId: ${parentId})`);
            
            // 如果有子节点，递归创建
            if (node.children && node.children.length > 0) {
              console.log(`${indent}    文件夹包含 ${node.children.length} 个子项`);
              for (const child of node.children) {
                await createBookmarkNode(child, folder.id, depth + 1);
              }
            } else {
              console.log(`${indent}    文件夹为空`);
            }
          } else {
            // 如果文件夹没有标题，直接将子节点添加到父文件夹
            if (node.children && node.children.length > 0) {
              console.log(`${indent}  ! 跳过无标题文件夹，直接添加 ${node.children.length} 个子节点到父文件夹 ${parentId}`);
              for (const child of node.children) {
                await createBookmarkNode(child, parentId, depth + 1);
              }
            } else {
              console.log(`${indent}  ! 跳过无标题且为空的文件夹`);
            }
          }
        }
      };

      // 遍历导入的书签并创建（直接在书签栏根目录创建）
      for (const bookmark of importedBookmarks) {
        await createBookmarkNode(bookmark, '1'); // '1' 是书签栏的 ID
      }

      addHistory({
        type: 'import',
        timestamp: Date.now(),
        details: {
          filename: file.name,
          format,
          count: importedBookmarks.length
        }
      });

      console.log('   重新加载书签');
      await get().loadBookmarks();
      set({ isLoading: false });
      
      console.log('=== 书签导入完成 ===');
    } catch (error) {
      console.error('❌ 导入书签失败:', error);
      set({ 
        error: (error as Error).message, 
        isLoading: false 
      });
    }
  },

  importMultipleBookmarks: async (files: File[], organizeByType: boolean) => {
    set({ isLoading: true, error: null });
    console.log('=== 开始批量导入书签 ===');
    console.log('   文件数量:', files.length);
    console.log('   按类型整理:', organizeByType);
    
    try {
      let allImportedBookmarks: BookmarkNode[] = [];

      // 导入所有文件
      for (const file of files) {
        const format = file.name.endsWith('.json') ? 'json' : 'html';
        console.log(`   导入文件: ${file.name} (${format})`);
        
        let importedBookmarks = await bookmarkImportExportService.importBookmarks(file, {
          format,
          mergeStrategy: 'merge'
        });
        
        allImportedBookmarks = [...allImportedBookmarks, ...importedBookmarks];
        console.log(`   导入 ${importedBookmarks.length} 个书签`);
      }

      console.log('   总共导入:', allImportedBookmarks.length, '个书签');

      // 验证书签数据
      console.log('=== 验证书签数据 ===');
      const validation = bookmarkImportExportService.validateBookmarks(allImportedBookmarks);
      if (!validation.valid) {
        console.warn('验证发现问题:', validation.errors);
        validation.errors.forEach(err => console.warn('  -', err));
      }

      // 清理无效的书签和文件夹
      console.log('=== 清理无效的书签和文件夹 ===');
      const beforeCleanCount = flattenBookmarks(allImportedBookmarks).length;
      allImportedBookmarks = bookmarkImportExportService.cleanBookmarks(allImportedBookmarks);
      const afterCleanCount = flattenBookmarks(allImportedBookmarks).length;
      console.log(`   清理前: ${beforeCleanCount} 个节点`);
      console.log(`   清理后: ${afterCleanCount} 个节点`);
      console.log(`   移除了 ${beforeCleanCount - afterCleanCount} 个无效节点`);

      // 移除重复的书签
      console.log('=== 移除重复的书签 ===');
      const beforeDupCount = flattenBookmarks(allImportedBookmarks).length;
      allImportedBookmarks = bookmarkImportExportService.removeDuplicates(allImportedBookmarks);
      const afterDupCount = flattenBookmarks(allImportedBookmarks).length;
      console.log(`   去重前: ${beforeDupCount} 个节点`);
      console.log(`   去重后: ${afterDupCount} 个节点`);
      console.log(`   移除了 ${beforeDupCount - afterDupCount} 个重复节点`);

      if (allImportedBookmarks.length === 0) {
        console.warn('导入后没有有效的书签');
        set({ 
          error: '导入的文件中没有有效的书签',
          isLoading: false 
        });
        return;
      }

      // 扁平化所有书签
      const flatBookmarks = flattenBookmarks(allImportedBookmarks);

      if (organizeByType) {
        // 按类型自动分类
        console.log('   开始按类型分类...');
        const categorized = bookmarkOrganizerService.autoCategorize(allImportedBookmarks);
        
        // 创建分类文件夹（直接在书签栏创建）
        const categoryFolderMap = new Map<string, string>();
        
        for (const [categoryName, bookmarks] of categorized) {
          const categoryFolder = await chrome.bookmarks.create({
            parentId: '1', // 直接在书签栏创建
            title: categoryName
          });
          categoryFolderMap.set(categoryName, categoryFolder.id);
          console.log(`   创建分类文件夹: ${categoryName} (${bookmarks.length} 个书签)`);
          
          // 创建书签
          for (const bookmark of bookmarks) {
            if (bookmark.url) {
              await chrome.bookmarks.create({
                parentId: categoryFolder.id,
                title: bookmark.title,
                url: bookmark.url
              });
            }
          }
        }

        // 处理未分类的书签
        const categorizedUrls = new Set();
        categorized.forEach((bookmarks) => {
          bookmarks.forEach(b => {
            if (b.url) categorizedUrls.add(b.url);
          });
        });

        const uncategorized = flatBookmarks.filter(b => b.url && !categorizedUrls.has(b.url));
        if (uncategorized.length > 0) {
          const uncategorizedFolder = await chrome.bookmarks.create({
            parentId: '1', // 直接在书签栏创建
            title: '未分类'
          });
          console.log(`   未分类书签: ${uncategorized.length} 个`);
          
          for (const bookmark of uncategorized) {
            await chrome.bookmarks.create({
              parentId: uncategorizedFolder.id,
              title: bookmark.title,
              url: bookmark.url
            });
          }
        }

        // 保留原始文件夹结构（如果有）
        for (const bookmark of allImportedBookmarks) {
          if (!bookmark.url && bookmark.children && bookmark.children.length > 0) {
            // 创建原始文件夹结构
            const createOriginalFolder = async (node: BookmarkNode, parentId: string): Promise<void> => {
              // 只有当文件夹有标题时才创建文件夹
              if (node.title && node.title.trim() !== '') {
                const folder = await chrome.bookmarks.create({
                  parentId,
                  title: `[原始] ${node.title}`
                });
                
                for (const child of node.children || []) {
                  if (child.url) {
                    await chrome.bookmarks.create({
                      parentId: folder.id,
                      title: child.title || '未命名',
                      url: child.url
                    });
                  } else if (child.children && child.children.length > 0) {
                    await createOriginalFolder(child, folder.id);
                  }
                }
              } else {
                // 如果文件夹没有标题，直接将子节点添加到父文件夹
                for (const child of node.children || []) {
                  if (child.url) {
                    await chrome.bookmarks.create({
                      parentId: parentId,
                      title: child.title || '未命名',
                      url: child.url
                    });
                  } else if (child.children && child.children.length > 0) {
                    await createOriginalFolder(child, parentId);
                  }
                }
              }
            };
            
            await createOriginalFolder(bookmark, '1'); // 直接在书签栏创建
          }
        }

      } else {
        // 不分类，直接导入
        const createBookmarkNode = async (node: BookmarkNode, parentId: string): Promise<void> => {
          if (node.url) {
            await chrome.bookmarks.create({
              parentId,
              title: node.title || '未命名',
              url: node.url
            });
          } else if (node.children && node.children.length > 0) {
            // 只有当文件夹有标题时才创建文件夹
            if (node.title && node.title.trim() !== '') {
              const folder = await chrome.bookmarks.create({
                parentId,
                title: node.title
              });
              for (const child of node.children) {
                await createBookmarkNode(child, folder.id);
              }
            } else {
              // 如果文件夹没有标题，直接将子节点添加到父文件夹
              for (const child of node.children) {
                await createBookmarkNode(child, parentId);
              }
            }
          }
        };

        for (const bookmark of allImportedBookmarks) {
          await createBookmarkNode(bookmark, '1'); // 直接在书签栏创建
        }
      }

      addHistory({
        type: 'import',
        timestamp: Date.now(),
        details: {
          filename: `${files.length} 个文件`,
          format: 'mixed',
          count: flatBookmarks.length
        }
      });

      console.log('   重新加载书签');
      await get().loadBookmarks();
      set({ isLoading: false });
      
      console.log('=== 批量导入完成 ===');
    } catch (error) {
      console.error('❌ 批量导入失败:', error);
      set({ 
        error: (error as Error).message, 
        isLoading: false 
      });
    }
  },

  exportBookmarks: async (format: 'html' | 'json', selectedFolders?: string[]) => {
    try {
      const { bookmarks } = get();
      console.log('=== 开始导出书签 ===');
      console.log('   格式:', format);
      console.log('   书签数量:', bookmarks.length);
      
      const blob = await bookmarkImportExportService.exportBookmarks(bookmarks, {
        format,
        selectedFolders
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmarks.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      addHistory({
        type: 'export',
        timestamp: Date.now(),
        details: {
          format,
          count: bookmarks.length
        }
      });
      
      console.log('=== 书签导出完成 ===');
    } catch (error) {
      console.error('❌ 导出书签失败:', error);
      set({ error: (error as Error).message });
    }
  },

  checkLinks: async (bookmarks?: BookmarkNode[]) => {
    const { bookmarks: currentBookmarks } = get();
    const bookmarksToCheck = bookmarks || currentBookmarks;
    console.log('=== 开始检查链接 ===');
    console.log('   检查的书签数量:', flattenBookmarks(bookmarksToCheck).length);

    set({
      isCheckingLinks: true,
      isPaused: false,
      currentCheckingUrl: null,
      checkProgress: { current: 0, total: 0 },
      error: null,
      realtimeCheckResults: new Map() // 清空实时结果
    });

    try {
      const results = await linkCheckerService.checkAllUrls(bookmarksToCheck, (current, total, result, currentUrl) => {
        set({
          checkProgress: { current, total },
          currentCheckingUrl: currentUrl
        });

        const linkCheckResults = get().linkCheckResults;
        const realtimeCheckResults = get().realtimeCheckResults;

        // 同时更新最终结果和实时结果
        linkCheckResults.set(result.url, result);
        realtimeCheckResults.set(result.url, result);

        set({ linkCheckResults, realtimeCheckResults });
      });

      // 保存所有结果到 IndexedDB
      for (const result of results) {
        await indexedDBService.saveLinkCheck(result);
      }

      const normal = results.filter(r => r.status === 'normal').length;
      const failed = results.filter(r => r.status === 'broken' || r.status === 'error').length;

      addHistory({
        type: 'linkcheck',
        timestamp: Date.now(),
        details: {
          total: results.length,
          success: normal,
          failed
        }
      });

      // 检测完成后，将实时结果同步到最终结果
      const finalResults = new Map<string, any>();
      for (const result of results) {
        finalResults.set(result.url, result);
      }

      set({
        linkCheckResults: finalResults,
        realtimeCheckResults: finalResults,
        isCheckingLinks: false,
        currentCheckingUrl: null
      });

      // 重新加载书签以更新状态，但不覆盖检测结果
      const allBookmarks = await chrome.bookmarks.getTree();
      const processNode = (node: any): BookmarkNode => {
        const bookmark: BookmarkNode = {
          id: node.id,
          title: node.title,
          url: node.url,
          dateAdded: node.dateAdded,
          dateGroupModified: node.dateGroupModified,
          index: node.index,
          parentId: node.parentId,
          status: finalResults.get(node.url || '')?.status
        };

        if (node.children && node.children.length > 0) {
          bookmark.children = node.children.map(processNode);
        }

        return bookmark;
      };

      const processedBookmarks = allBookmarks.map(processNode);
      const findNodeInTree = (nodes: BookmarkNode[], targetId: string | number): BookmarkNode | null => {
        for (const node of nodes) {
          if (node.id == targetId) {
            return node;
          }
          if (node.children && node.children.length > 0) {
            const found = findNodeInTree(node.children, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      const bookmarksBar = findNodeInTree(processedBookmarks, '1');
      const displayBookmarks: BookmarkNode[] = [];
      if (bookmarksBar && bookmarksBar.children) {
        displayBookmarks.push(...bookmarksBar.children);
      }

      set({ bookmarks: displayBookmarks });

      console.log('=== 链接检查完成 ===');
      console.log('   结果:', { total: results.length, success: normal, failed });
    } catch (error) {
      console.error('❌ 检查链接失败:', error);
      set({ 
        error: (error as Error).message,
        isCheckingLinks: false
      });
    }
  },

  cancelCheckLinks: () => {
    console.log('=== 取消链接检测 ===');
    linkCheckerService.cancel();
    set({
      isCheckingLinks: false,
      isPaused: false,
      currentCheckingUrl: null
    });
  },

  clearLinkCheckResults: () => {
    console.log('=== 清空链接检测结果 ===');
    set({ linkCheckResults: new Map() });
  },

  removeLinkCheckResult: (url: string, deleteBookmark?: boolean) => {
    console.log('=== 删除链接检测结果 ===', url, deleteBookmark);
    const { linkCheckResults } = get();
    const newResults = new Map(linkCheckResults);
    newResults.delete(url);
    set({ linkCheckResults: newResults });

    // 如果需要删除书签
    if (deleteBookmark) {
      const { bookmarks } = get();
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
        chrome.bookmarks.remove(bookmarkId).catch(err => {
          console.error('删除书签失败:', err);
        });
      }
    }
  },

  findDuplicates: (options: { exactMatch: boolean; similarMatch: boolean }) => {
    const { bookmarks } = get();
    console.log('=== 开始查找重复 ===');
    console.log('   选项:', options);
    
    const duplicates = bookmarkOrganizerService.findDuplicates(bookmarks, options);
    set({ duplicates });

    addHistory({
      type: 'duplicate',
      timestamp: Date.now(),
      details: {
        count: duplicates.length
      }
    });
    
    console.log('=== 查找重复完成 ===');
    console.log('   重复数量:', duplicates.length);
  },

  selectBookmark: (id: string) => {
    const { selectedBookmarks } = get();
    const newSelection = new Set(selectedBookmarks);
    newSelection.add(id);
    set({ selectedBookmarks: newSelection });
  },

  selectMultipleBookmarks: (ids: string[]) => {
    const { selectedBookmarks } = get();
    const newSelection = new Set(selectedBookmarks);
    ids.forEach(id => newSelection.add(id));
    set({ selectedBookmarks: newSelection });
  },

  deselectBookmark: (id: string) => {
    const { selectedBookmarks } = get();
    const newSelection = new Set(selectedBookmarks);
    newSelection.delete(id);
    set({ selectedBookmarks: newSelection });
  },

  clearSelection: () => {
    set({ selectedBookmarks: new Set() });
  },

  deleteBookmarks: async (ids: string[]) => {
    try {
      console.log('=== 开始删除书签（移到回收站）===');
      console.log('   删除数量:', ids.length);
      console.log('   删除的ID列表:', ids);

      // 保存当前状态到历史栈
      const currentBookmarks = get().bookmarks;
      const stateCopy = JSON.parse(JSON.stringify(currentBookmarks));
      const { undoStack } = get();
      set({
        undoStack: [...undoStack, stateCopy].slice(0, 50),
        redoStack: [],
        canUndo: true,
        canRedo: false
      });

      // 将所有书签移到回收站
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const id of ids) {
        try {
          console.log(`   处理项目 ${successCount + failCount + 1}/${ids.length}: ID=${id}`);
          await get().moveToTrash(id);
          successCount++;
          console.log(`   ✓ 成功删除项目: ${id}`);
        } catch (error) {
          failCount++;
          const errorMsg = `删除失败 (ID: ${id}): ${(error as Error).message}`;
          console.error(`   ✗ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      addHistory({
        type: 'delete',
        timestamp: Date.now(),
        details: {
          count: successCount,
          failed: failCount
        }
      });

      get().clearSelection();

      console.log('=== 删除书签完成 ===');
      console.log(`   成功: ${successCount}, 失败: ${failCount}`);
      
      if (failCount > 0) {
        console.error('   失败详情:', errors);
      }
    } catch (error) {
      console.error('❌ 删除书签失败:', error);
      set({ error: (error as Error).message });
    }
  },

  moveBookmarks: async (ids: string[], targetFolderId: string) => {
    try {
      console.log('=== 开始移动书签 ===');
      console.log('   移动数量:', ids.length);
      console.log('   目标文件夹:', targetFolderId);
      
      for (const id of ids) {
        await chrome.bookmarks.move(id, { parentId: targetFolderId });
      }
      await get().loadBookmarks();
      get().clearSelection();
      
      console.log('=== 移动书签完成 ===');
    } catch (error) {
      console.error('❌ 移动书签失败:', error);
      set({ error: (error as Error).message });
    }
  },

  updateBookmark: async (id: string, updates: Partial<BookmarkNode>) => {
    try {
      console.log('=== 开始更新书签 ===');
      console.log('   ID:', id);
      console.log('   更新:', updates);
      
      await chrome.bookmarks.update(id, {
        title: updates.title,
        url: updates.url
      });
      await get().loadBookmarks();
      
      console.log('=== 更新书签完成 ===');
    } catch (error) {
      console.error('❌ 更新书签失败:', error);
      set({ error: (error as Error).message });
    }
  },

  createFolder: async (parentId: string, title: string) => {
    try {
      console.log('=== 开始创建文件夹 ===');
      console.log('   父文件夹:', parentId);
      console.log('   标题:', title);
      
      await chrome.bookmarks.create({
        parentId,
        title
      });
      await get().loadBookmarks();
      
      console.log('=== 创建文件夹完成 ===');
    } catch (error) {
      console.error('❌ 创建文件夹失败:', error);
      set({ error: (error as Error).message });
    }
  },

  moveBookmark: async (bookmarkId: string, targetFolderId: string) => {
    try {
      console.log('=== 开始移动书签 ===');
      console.log('   书签ID:', bookmarkId);
      console.log('   目标文件夹ID:', targetFolderId);
      
      // 如果目标是 ROOT 拖放区域，移动到书签栏根目录
      let actualTargetId = targetFolderId;
      if (targetFolderId === 'ROOT') {
        console.log('   目标是 ROOT 区域，移动到书签栏');
        actualTargetId = '1'; // 书签栏的 ID
      }
      
      // 检查目标文件夹是否为系统保留文件夹（移动设备和菜单栏）
      const systemFolderIds = ['2', '3']; // 2=移动设备, 3=菜单栏
      if (systemFolderIds.includes(actualTargetId)) {
        console.warn('目标文件夹是系统保留文件夹，无法移动');
        set({ error: '无法移动到系统保留文件夹（移动设备、菜单栏）' });
        return;
      }
      
      // 检查是否尝试将文件夹移动到其子文件夹中（会导致循环）
      try {
        const bookmark = await chrome.bookmarks.get(bookmarkId);
        if (bookmark && bookmark[0]) {
          const targetFolder = await chrome.bookmarks.get(actualTargetId);
          if (targetFolder && targetFolder[0] && targetFolder[0].parentId === bookmarkId) {
            console.warn('无法将文件夹移动到其子文件夹中');
            set({ error: '无法将文件夹移动到其子文件夹中' });
            return;
          }
        }
      } catch (e) {
        console.log('检查循环引用时出错:', e);
        // 继续执行移动操作
      }
      
      console.log('   实际目标ID:', actualTargetId);
      await chrome.bookmarks.move(bookmarkId, { parentId: actualTargetId });
      await get().loadBookmarks();
      
      console.log('=== 移动书签完成 ===');
    } catch (error) {
      console.error('❌ 移动书签失败:', error);
      set({ error: `移动书签失败: ${(error as Error).message}` });
    }
  },

  searchBookmarks: (query: string) => {
    const { bookmarks } = get();
    return bookmarkOrganizerService.searchBookmarks(bookmarks, query, {
      searchTitle: true,
      searchUrl: true,
      searchTags: true
    });
  },

  // 识别无效文件夹
  identifyInvalidFolders: (bookmarks: BookmarkNode[]): string[] => {
    const invalidFolderIds: string[] = [];
    
    const traverse = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        if (!node.url) {
          // 检查是否为文件夹
          const isEmpty = !node.children || node.children.length === 0;
          const isUnnamed = !node.title || node.title.trim() === '' || node.title === '未命名文件夹';
          
          if (isEmpty || isUnnamed) {
            invalidFolderIds.push(node.id);
          }
          
          if (node.children) {
            traverse(node.children);
          }
        }
      }
    };
    
    traverse(bookmarks);
    return invalidFolderIds;
  },

  // 清理无效文件夹
  cleanInvalidFolders: async () => {
    console.log('=== 开始清理无效文件夹 ===');
    set({ isLoading: true, error: null });
    
    try {
      const { bookmarks } = get();
      const invalidFolderIds = get().identifyInvalidFolders(bookmarks);
      
      console.log('   识别到的无效文件夹数量:', invalidFolderIds.length);
      console.log('   无效文件夹ID:', invalidFolderIds);
      
      if (invalidFolderIds.length > 0) {
        // 从浏览器书签中删除
        for (const id of invalidFolderIds) {
          try {
            // 使用 removeTree 确保能够删除非空文件夹
            await chrome.bookmarks.removeTree(id);
            // 不需要手动删除 IndexedDB 记录，因为 removeTree 已经删除了整个文件夹树
          } catch (error) {
            console.warn('删除文件夹失败:', id, error);
          }
        }
        
        addHistory({
          type: 'delete',
          timestamp: Date.now(),
          details: {
            count: invalidFolderIds.length
          }
        });
        
        await get().loadBookmarks();
      }
      
      console.log('=== 清理无效文件夹完成 ===');
      set({ isLoading: false });
      return invalidFolderIds.length;
    } catch (error) {
      console.error('❌ 清理无效文件夹失败:', error);
      set({ 
        error: (error as Error).message, 
        isLoading: false 
      });
      return 0;
    }
  },

  // 删除文件夹
  deleteFolder: async (folderId: string) => {
    console.log('=== 开始删除文件夹 ===');
    console.log('   文件夹ID:', folderId);
    
    try {
      // 保存当前状态到历史栈
      const currentBookmarks = get().bookmarks;
      const stateCopy = JSON.parse(JSON.stringify(currentBookmarks));
      const { undoStack } = get();
      set({
        undoStack: [...undoStack, stateCopy].slice(0, 50),
        redoStack: [],
        canUndo: true,
        canRedo: false
      });

      // 将文件夹移到回收站
      await get().moveToTrash(folderId);

      addHistory({
        type: 'delete',
        timestamp: Date.now(),
        details: {
          count: 1
        }
      });

      console.log('=== 删除文件夹完成 ===');
    } catch (error) {
      console.error('❌ 删除文件夹失败:', error);
      set({ error: (error as Error).message });
    }
  },

  setError: (error: string | null) => {
    set({ error });
  },

  addHistoryRecord: (record: Omit<HistoryRecord, 'id'>) => {
    const newRecord = addHistory(record);
    const history = get().history;
    set({ history: [newRecord, ...history] });
  },

  pauseCheckLinks: () => {
    console.log('=== 暂停检查链接 ===');
    linkCheckerService.pause();
    set({ isPaused: true });
  },

  resumeCheckLinks: () => {
    console.log('=== 恢复检查链接 ===');
    linkCheckerService.resume();
    set({ isPaused: false });
  },

  isLoggedIn: () => {
    return cloudSyncService.isLoggedIn();
  },

  cloudLogin: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = await cloudSyncService.login(email, password);
      set({ cloudUser: user, isLoading: false });
      console.log('=== 用户登录成功 ===', user);
    } catch (error) {
      console.error('❌ 登录失败:', error);
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  cloudRegister: async (email: string, username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = await cloudSyncService.register(email, username, password);
      set({ cloudUser: user, isLoading: false });
      console.log('=== 用户注册成功 ===', user);
    } catch (error) {
      console.error('❌ 注册失败:', error);
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  cloudLogout: async () => {
    set({ isLoading: true, error: null });
    try {
      await cloudSyncService.logout();
      set({ cloudUser: null, isLoading: false });
      console.log('=== 用户已登出 ===');
    } catch (error) {
      console.error('❌ 登出失败:', error);
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  syncBookmarks: async () => {
    set({ isLoading: true, error: null });
    console.log('=== 开始同步书签 ===');
    
    try {
      const { bookmarks } = get();
      const syncedBookmarks = await cloudSyncService.syncBookmarks(bookmarks);
      
      // 更新本地书签
      // 注意：这里需要将云端书签写入浏览器书签系统
      // 简化实现：重新加载书签
      await get().loadBookmarks();
      
      set({ isLoading: false });
      console.log('=== 书签同步完成 ===');
    } catch (error) {
      console.error('❌ 同步失败:', error);
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  undo: async () => {
    const { bookmarks, undoStack, redoStack } = get();
    if (undoStack.length === 0) return;

    const currentState = JSON.parse(JSON.stringify(bookmarks));
    const previousState = undoStack[undoStack.length - 1];

    // 先恢复 store 中的状态
    set({
      bookmarks: previousState,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, currentState],
      canUndo: undoStack.length > 1,
      canRedo: true
    });

    // 将恢复的状态同步到浏览器书签
    try {
      // 获取书签栏ID
      const chromeBookmarks = await chrome.bookmarks.getTree();
      const findBookmarksBar = (nodes: any[]): string | null => {
        for (const node of nodes) {
          if (node.id === '1') return '1';
          if (node.children) {
            const found = findBookmarksBar(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      const bookmarksBarId = findBookmarksBar(chromeBookmarks) || '1';

      // 删除书签栏下的所有内容
      const bookmarksBar = await chrome.bookmarks.getChildren(bookmarksBarId);
      for (const node of bookmarksBar) {
        await chrome.bookmarks.removeTree(node.id);
      }

      // 递归恢复书签树
      const restoreBookmarks = async (nodes: BookmarkNode[], parentId: string): Promise<void> => {
        for (const node of nodes) {
          if (node.url) {
            // 创建书签
            await chrome.bookmarks.create({
              parentId,
              title: node.title || '未命名',
              url: node.url
            });
          } else {
            // 创建文件夹
            const folder = await chrome.bookmarks.create({
              parentId,
              title: node.title || '未命名文件夹'
            });
            if (node.children && node.children.length > 0) {
              await restoreBookmarks(node.children, folder.id);
            }
          }
        }
      };

      await restoreBookmarks(previousState, bookmarksBarId);
      console.log('=== 撤销操作完成，浏览器书签已恢复 ===');
    } catch (error) {
      console.error('❌ 撤销操作失败:', error);
      set({ error: (error as Error).message });
    }
  },

  redo: async () => {
    const { bookmarks, undoStack, redoStack } = get();
    if (redoStack.length === 0) return;

    const currentState = JSON.parse(JSON.stringify(bookmarks));
    const nextState = redoStack[redoStack.length - 1];

    // 先恢复 store 中的状态
    set({
      bookmarks: nextState,
      undoStack: [...undoStack, currentState],
      redoStack: redoStack.slice(0, -1),
      canUndo: true,
      canRedo: redoStack.length > 1
    });

    // 将恢复的状态同步到浏览器书签
    try {
      // 获取书签栏ID
      const chromeBookmarks = await chrome.bookmarks.getTree();
      const findBookmarksBar = (nodes: any[]): string | null => {
        for (const node of nodes) {
          if (node.id === '1') return '1';
          if (node.children) {
            const found = findBookmarksBar(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      const bookmarksBarId = findBookmarksBar(chromeBookmarks) || '1';

      // 删除书签栏下的所有内容
      const bookmarksBar = await chrome.bookmarks.getChildren(bookmarksBarId);
      for (const node of bookmarksBar) {
        await chrome.bookmarks.removeTree(node.id);
      }

      // 递归恢复书签树
      const restoreBookmarks = async (nodes: BookmarkNode[], parentId: string): Promise<void> => {
        for (const node of nodes) {
          if (node.url) {
            // 创建书签
            await chrome.bookmarks.create({
              parentId,
              title: node.title || '未命名',
              url: node.url
            });
          } else {
            // 创建文件夹
            const folder = await chrome.bookmarks.create({
              parentId,
              title: node.title || '未命名文件夹'
            });
            if (node.children && node.children.length > 0) {
              await restoreBookmarks(node.children, folder.id);
            }
          }
        }
      };

      await restoreBookmarks(nextState, bookmarksBarId);
      console.log('=== 重做操作完成，浏览器书签已恢复 ===');
    } catch (error) {
      console.error('❌ 重做操作失败:', error);
      set({ error: (error as Error).message });
    }
  },

  clearHistory: () => {
    set({ undoStack: [], redoStack: [], canUndo: false, canRedo: false });
    console.log('=== 清空历史 ===');
  },

  cloudUpdateUsername: async (newUsername: string) => {
    set({ isLoading: true, error: null });
    try {
      const updatedUser = await cloudSyncService.updateUsername(newUsername);
      set({ cloudUser: updatedUser, isLoading: false });
      console.log('=== 用户名修改成功 ===', updatedUser);
    } catch (error) {
      console.error('❌ 修改用户名失败:', error);
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  cloudUpdatePassword: async (newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      await cloudSyncService.updatePassword(newPassword);
      set({ isLoading: false });
      console.log('=== 密码修改成功 ===');
    } catch (error) {
      console.error('❌ 修改密码失败:', error);
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  cloudDeleteAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      await cloudSyncService.deleteAccount();
      set({ cloudUser: null, isLoading: false });
      console.log('=== 账户删除成功 ===');
    } catch (error) {
      console.error('❌ 删除账户失败:', error);
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  moveToTrash: async (bookmarkId: string) => {
    const { bookmarks, trashItems } = get();

    console.log('=== moveToTrash 开始 ===');
    console.log('   目标ID:', bookmarkId);
    console.log('   当前 bookmarks 数量:', bookmarks.length);

    // 列出所有可用的 ID
    const getAllIds = (nodes: BookmarkNode[], prefix = ''): string[] => {
      const ids: string[] = [];
      for (const node of nodes) {
        const nodeInfo = node.url ? `书签: ${node.title} (${node.url})` : `文件夹: ${node.title}`;
        console.log(`     ${prefix}${nodeInfo} - ID: ${node.id}`);
        ids.push(node.id);
        if (node.children && node.children.length > 0) {
          ids.push(...getAllIds(node.children, prefix + '  '));
        }
      }
      return ids;
    };
    
    const allAvailableIds = getAllIds(bookmarks);
    console.log('   所有可用的ID:', allAvailableIds);
    console.log('   目标ID是否在列表中:', allAvailableIds.includes(bookmarkId));

    // 查找书签或文件夹
    const findBookmark = (nodes: BookmarkNode[], path: string[] = []): { node: BookmarkNode | null; path: string[] } => {
      for (const node of nodes) {
        if (node.id === bookmarkId) {
          return { node, path: [...path, node.title || '未命名'] };
        }
        if (node.children && node.children.length > 0) {
          const found = findBookmark(node.children, [...path, node.title || '未命名']);
          if (found.node) return found;
        }
      }
      return { node: null, path: [] };
    };

    const { node: bookmark, path } = findBookmark(bookmarks);
    if (!bookmark) {
      console.error('❌ 未找到书签或文件夹:', bookmarkId);
      console.error('当前书签树结构:', bookmarks);
      throw new Error(`未找到书签或文件夹 (ID: ${bookmarkId})`);
    }

    console.log('=== 找到书签/文件夹 ===');
    console.log('   标题:', bookmark.title);
    console.log('   类型:', bookmark.url ? '书签' : '文件夹');
    console.log('   路径:', path.join(' > '));
    console.log('   是否有URL:', !!bookmark.url);

    // 创建回收站项目，保存原始位置信息
    const trashItem: TrashItem = {
      id: `trash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bookmark: bookmark,
      deletedAt: Date.now(),
      originalParentId: bookmark.parentId,
      originalIndex: bookmark.index
    };

    // 先保存到回收站
    const newTrashItems = [trashItem, ...trashItems];
    localStorage.setItem('trashItems', JSON.stringify(newTrashItems));
    set({ trashItems: newTrashItems });

    // 然后从浏览器书签中删除
    try {
      // 检查是否是文件夹（没有 url 的是文件夹）
      if (!bookmark.url) {
        // 是文件夹，使用 removeTree 递归删除整个文件夹树
        console.log('   开始删除文件夹 (removeTree)...');
        await chrome.bookmarks.removeTree(bookmarkId);
        console.log('   ✓ 文件夹已移到回收站');
      } else {
        // 是书签，使用 remove 删除
        console.log('   开始删除书签 (remove)...');
        await chrome.bookmarks.remove(bookmarkId);
        console.log('   ✓ 书签已移到回收站');
      }
      
      // 重新加载书签（不需要手动删除 IndexedDB 记录，因为 removeTree 已经删除了整个文件夹树）
      console.log('   重新加载书签...');
      await get().loadBookmarks();
      console.log('   ✓ 书签重新加载完成');
    } catch (error) {
      console.error('删除书签失败:', error);
      // 如果删除失败，从回收站移除
      const revertTrashItems = trashItems;
      localStorage.setItem('trashItems', JSON.stringify(revertTrashItems));
      set({ trashItems: revertTrashItems });
      throw error;
    }
  },

  restoreFromTrash: async (trashId: string) => {
    console.log('=== 开始恢复书签 ===');
    console.log('   回收站项目ID:', trashId);
    
    const { trashItems } = get();
    const trashItem = trashItems.find(item => item.id === trashId);

    if (!trashItem) {
      console.error('❌ 未找到回收站项目:', trashId);
      throw new Error('未找到回收站项目');
    }

    console.log('   回收站项目:', JSON.stringify(trashItem, null, 2));

    // 恢复书签或文件夹到原位置
    const { bookmark, originalParentId, originalIndex } = trashItem;
    const parentId = originalParentId || '1'; // 默认添加到书签栏

    console.log('   目标父文件夹ID:', parentId);
    console.log('   原始索引:', originalIndex);
    console.log('   书签标题:', bookmark.title);
    console.log('   书签URL:', bookmark.url);
    console.log('   是否有子节点:', !!(bookmark.children && bookmark.children.length > 0));

    try {
      if (bookmark.url) {
        // 恢复书签到原位置
        console.log('   尝试创建书签到原位置...');
        
        // 使用 create 创建书签，Chrome 会自动处理索引
        const createdBookmark = await chrome.bookmarks.create({
          parentId,
          index: originalIndex,
          title: bookmark.title || '未命名',
          url: bookmark.url
        });
        console.log('   ✓ 书签创建成功:', createdBookmark.id, '索引:', createdBookmark.index);
      } else {
        // 恢复文件夹（如果有子节点）
        console.log('   尝试创建文件夹到原位置...');
        
        const createdFolder = await chrome.bookmarks.create({
          parentId,
          index: originalIndex,
          title: bookmark.title || '未命名文件夹'
        });
        console.log('   ✓ 文件夹创建成功:', createdFolder.id, '索引:', createdFolder.index);
        
        // 递归恢复子节点
        if (bookmark.children && bookmark.children.length > 0) {
          console.log('   开始恢复子节点，数量:', bookmark.children.length);
          
          const restoreChildren = async (children: any[], parentFolderId: string) => {
            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              console.log(`   处理子节点 ${i + 1}/${children.length}:`, child.title || '未命名');
              
              if (child.url) {
                // 创建子书签
                const createdChild = await chrome.bookmarks.create({
                  parentId: parentFolderId,
                  index: child.index || i,
                  title: child.title || '未命名',
                  url: child.url
                });
                console.log(`   ✓ 子书签创建成功:`, createdChild.id, '索引:', createdChild.index);
              } else if (child.children) {
                // 创建子文件夹
                const subFolder = await chrome.bookmarks.create({
                  parentId: parentFolderId,
                  index: child.index || i,
                  title: child.title || '未命名文件夹'
                });
                console.log(`   ✓ 子文件夹创建成功:`, subFolder.id, '索引:', subFolder.index);
                // 递归恢复子文件夹的内容
                await restoreChildren(child.children, subFolder.id);
              }
            }
          };
          
          await restoreChildren(bookmark.children, createdFolder.id);
          console.log('   ✓ 所有子节点恢复完成');
        }
      }

      // 从回收站移除
      const newTrashItems = trashItems.filter(item => item.id !== trashId);
      localStorage.setItem('trashItems', JSON.stringify(newTrashItems));
      set({ trashItems: newTrashItems });
      console.log('   ✓ 已从回收站移除');

      console.log('=== 书签恢复完成 ===', bookmark.title);

      // 重新加载书签
      console.log('   重新加载书签...');
      await get().loadBookmarks();
      console.log('   ✓ 书签重新加载完成');
    } catch (error) {
      console.error('❌ 恢复书签失败:');
      console.error('   错误消息:', (error as Error).message);
      console.error('   错误堆栈:', (error as Error).stack);
      throw error;
    }
  },

  deleteFromTrash: async (trashId: string) => {
    const { trashItems } = get();
    const trashItem = trashItems.find(item => item.id === trashId);

    if (!trashItem) {
      throw new Error('未找到回收站项目');
    }

    // 从回收站永久删除
    const newTrashItems = trashItems.filter(item => item.id !== trashId);
    localStorage.setItem('trashItems', JSON.stringify(newTrashItems));
    set({ trashItems: newTrashItems });

    console.log('=== 回收站项目已永久删除 ===', trashItem.bookmark.title);
  },

  clearTrash: async () => {
    localStorage.removeItem('trashItems');
    set({ trashItems: [] });
    console.log('=== 回收站已清空 ===');
  },

  findOrCreateFolder: async (folderName: string): Promise<string> => {
    const { bookmarks } = get();
    
    // 遍历书签树查找文件夹
    const findFolderId = (nodes: BookmarkNode[]): string | null => {
      for (const node of nodes) {
        if (!node.url && node.title === folderName) {
          return node.id;
        }
        if (node.children && node.children.length > 0) {
          const found = findFolderId(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const existingFolderId = findFolderId(bookmarks);
    
    if (existingFolderId) {
      return existingFolderId;
    }
    
    // 创建新文件夹
    const newFolder = await chrome.bookmarks.create({
      parentId: '1', // 在书签栏下创建
      title: folderName
    });
    
    console.log(`创建新文件夹: ${folderName} (ID: ${newFolder.id})`);
    return newFolder.id;
  },

  organizeBookmarks: async (strategy: 'smart' | 'simple' = 'smart') => {
    set({ isLoading: true, error: null });
    console.log('=== 开始整理书签 ===');
    console.log('   策略:', strategy);
    
    try {
      const { bookmarks, undoStack } = get();
      
      // 保存当前状态到撤销栈
      const stateCopy = JSON.parse(JSON.stringify(bookmarks));
      set({
        undoStack: [...undoStack, stateCopy].slice(0, 50),
        redoStack: [],
        canUndo: true,
        canRedo: false
      });
      
      if (strategy === 'smart') {
        // 智能整理：使用增强的智能分析和分类
        console.log('使用智能整理策略');
        const result = await bookmarkOrganizerService.enhancedOrganizeBookmarks(bookmarks);
        
        console.log(`   整理完成: 创建了 ${result.createdFolders.length} 个新文件夹`);
        console.log(`   移动了 ${result.movedBookmarks} 个书签`);
        console.log(`   新创建的分组文件夹: ${result.newGroupedFolders.length} 个`);
        
        addHistory({
          type: 'organize',
          timestamp: Date.now(),
          details: {
            strategy,
            createdFolders: result.createdFolders.length,
            movedBookmarks: result.movedBookmarks,
            newGroupedFolders: result.newGroupedFolders.length
          }
        });
        
        // 重新加载书签以反映更改
        await get().loadBookmarks();
        
        set({
          isLoading: false,
          error: null
        });
        
        return result;
      } else {
        // 简单整理：按文件夹分组
        console.log('使用简单整理策略');
        
        const organized = await bookmarkOrganizerService.organizeByFolder(bookmarks);
        let createdFolders = 0;
        let movedBookmarks = 0;
        
        // 遍历所有分组
        for (const [folderName, bookmarkIds] of organized.entries()) {
          // 查找或创建文件夹
          const store = get();
          let folderId: string;
          
          // 查找是否已存在该文件夹
          const findFolderId = (nodes: BookmarkNode[]): string | null => {
            for (const node of nodes) {
              if (!node.url && node.title === folderName) {
                return node.id;
              }
              if (node.children && node.children.length > 0) {
                const found = findFolderId(node.children);
                if (found) return found;
              }
            }
            return null;
          };
          
          const existingFolderId = findFolderId(store.bookmarks);
          
          if (existingFolderId) {
            folderId = existingFolderId;
          } else {
            // 创建新文件夹
            const newFolder = await chrome.bookmarks.create({
              parentId: '1',
              title: folderName
            });
            folderId = newFolder.id;
            createdFolders++;
          }
          
          // 移动书签到文件夹
          for (const bookmarkId of bookmarkIds) {
            try {
              await chrome.bookmarks.move(bookmarkId, { parentId: folderId });
              movedBookmarks++;
            } catch (e) {
              console.error('移动书签失败:', bookmarkId, e);
            }
          }
        }
        
        addHistory({
          type: 'organize',
          timestamp: Date.now(),
          details: {
            strategy,
            folders: Object.keys(organized).length,
            createdFolders,
            movedBookmarks
          }
        });
        
        set({
          isLoading: false,
          error: null
        });
        
        return { organizedCount: Object.keys(organized).length, createdFolders, movedBookmarks };
      }
    } catch (error) {
      console.error('❌ 整理书签失败:', error);
      set({
        error: (error as Error).message,
        isLoading: false
      });
      throw error;
    }
  }
}));
