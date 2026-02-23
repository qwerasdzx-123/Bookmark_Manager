import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface BookmarkDBSchema extends DBSchema {
  bookmarks: {
    key: string;
    value: {
      id: string;
      title: string;
      url?: string;
      dateAdded?: number;
      dateGroupModified?: number;
      parentId?: string;
      status?: 'normal' | 'broken' | 'redirect';
      tags?: string[];
      notes?: string;
    };
    indexes: {
      'by-parentId': string;
      'by-url': string;
      'by-status': string;
      'by-tags': string;
    };
  };
  folders: {
    key: string;
    value: {
      id: string;
      title: string;
      dateAdded?: number;
      dateGroupModified?: number;
      parentId?: string;
      index?: number;
    };
    indexes: {
      'by-parentId': string;
    };
  };
  linkChecks: {
    key: string;
    value: {
      url: string;
      status: 'normal' | 'broken' | 'redirect' | 'timeout' | 'error';
      statusCode?: number;
      redirectUrl?: string;
      error?: string;
      checkTime: number;
    };
    indexes: {
      'by-status': string;
      'by-checkTime': number;
    };
  };
  backups: {
    key: string;
    value: {
      id: string;
      timestamp: number;
      size: number;
      bookmarkCount: number;
      data: any;
    };
    indexes: {
      'by-timestamp': number;
    };
  };
  sync: {
    key: string;
    value: {
      lastSyncTime: number;
      isOnline: boolean;
      pendingChanges: number;
      conflictCount: number;
    };
  };
  settings: {
    key: string;
    value: {
      autoBackup: boolean;
      backupInterval: number;
      theme: 'light' | 'dark' | 'auto';
      language: string;
    };
  };
}

class IndexedDBService {
  private db: IDBPDatabase<BookmarkDBSchema> | null = null;
  private readonly DB_NAME = 'BookmarkOrganizerDB';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<BookmarkDBSchema>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bookmarkStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
          bookmarkStore.createIndex('by-parentId', 'parentId');
          bookmarkStore.createIndex('by-url', 'url');
          bookmarkStore.createIndex('by-status', 'status');
          bookmarkStore.createIndex('by-tags', 'tags', { multiEntry: true });
        }

        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('by-parentId', 'parentId');
        }

        if (!db.objectStoreNames.contains('linkChecks')) {
          const linkCheckStore = db.createObjectStore('linkChecks', { keyPath: 'url' });
          linkCheckStore.createIndex('by-status', 'status');
          linkCheckStore.createIndex('by-checkTime', 'checkTime');
        }

        if (!db.objectStoreNames.contains('backups')) {
          const backupStore = db.createObjectStore('backups', { keyPath: 'id' });
          backupStore.createIndex('by-timestamp', 'timestamp');
        }

        if (!db.objectStoreNames.contains('sync')) {
          db.createObjectStore('sync', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      }
    });
  }

  async addBookmark(bookmark: any): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.add('bookmarks', bookmark);
  }

  async updateBookmark(bookmark: any): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('bookmarks', bookmark);
  }

  async deleteBookmark(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('bookmarks', id);
  }

  async getBookmark(id: string): Promise<any | undefined> {
    if (!this.db) await this.init();
    return await this.db!.get('bookmarks', id);
  }

  async getAllBookmarks(): Promise<any[]> {
    if (!this.db) await this.init();
    return await this.db!.getAll('bookmarks');
  }

  async getBookmarksByParentId(parentId: string): Promise<any[]> {
    if (!this.db) await this.init();
    return await this.db!.getAllFromIndex('bookmarks', 'by-parentId', parentId);
  }

  async addFolder(folder: any): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.add('folders', folder);
  }

  async updateFolder(folder: any): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('folders', folder);
  }

  async deleteFolder(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('folders', id);
  }

  async getAllFolders(): Promise<any[]> {
    if (!this.db) await this.init();
    return await this.db!.getAll('folders');
  }

  async saveLinkCheck(result: any): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('linkChecks', result);
  }

  async getLinkCheck(url: string): Promise<any | undefined> {
    if (!this.db) await this.init();
    return await this.db!.get('linkChecks', url);
  }

  async getAllLinkChecks(): Promise<any[]> {
    if (!this.db) await this.init();
    return await this.db!.getAll('linkChecks');
  }

  async getBrokenLinks(): Promise<any[]> {
    if (!this.db) await this.init();
    return await this.db!.getAllFromIndex('linkChecks', 'by-status', 'broken');
  }

  async saveBackup(backup: any): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.add('backups', backup);
  }

  async getBackup(id: string): Promise<any | undefined> {
    if (!this.db) await this.init();
    return await this.db!.get('backups', id);
  }

  async getAllBackups(): Promise<any[]> {
    if (!this.db) await this.init();
    return await this.db!.getAll('backups');
  }

  async deleteBackup(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('backups', id);
  }

  async saveSyncStatus(status: any): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('sync', { ...status, id: 'current' });
  }

  async getSyncStatus(): Promise<any | undefined> {
    if (!this.db) await this.init();
    return await this.db!.get('sync', 'current');
  }

  async saveSettings(settings: any): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('settings', { ...settings, id: 'user' });
  }

  async getSettings(): Promise<any | undefined> {
    if (!this.db) await this.init();
    return await this.db!.get('settings', 'user');
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(['bookmarks', 'folders', 'linkChecks', 'backups', 'sync', 'settings'], 'readwrite');
    await Promise.all([
      tx.objectStore('bookmarks').clear(),
      tx.objectStore('folders').clear(),
      tx.objectStore('linkChecks').clear(),
      tx.objectStore('backups').clear(),
      tx.objectStore('sync').clear(),
      tx.objectStore('settings').clear()
    ]);
  }
}

export const indexedDBService = new IndexedDBService();
