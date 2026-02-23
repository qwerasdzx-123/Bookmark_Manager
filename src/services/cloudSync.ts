import { User, SyncData, BookmarkNode } from '../types';

class CloudSyncService {
  private readonly STORAGE_KEY_USER = 'bookmark_user';
  private readonly STORAGE_KEY_SYNC_DATA = 'bookmark_sync_data';
  private readonly API_BASE = '/api'; // 可以替换为实际的云服务API

  // 检查用户是否已登录
  isLoggedIn(): boolean {
    const user = this.getCurrentUser();
    return user !== null;
  }

  // 获取当前用户
  getCurrentUser(): User | null {
    try {
      const userData = localStorage.getItem(this.STORAGE_KEY_USER);
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }

  // 用户注册
  async register(email: string, username: string, password: string): Promise<User> {
    // 模拟API调用
    const user: User = {
      id: `user_${Date.now()}`,
      email,
      username,
      createdAt: Date.now(),
      lastSyncTime: 0,
      syncEnabled: true
    };

    // 保存到本地存储
    localStorage.setItem(this.STORAGE_KEY_USER, JSON.stringify(user));
    
    return user;
  }

  // 用户登录
  async login(email: string, password: string): Promise<User> {
    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('请输入有效的邮箱地址');
    }

    // 密码长度验证
    if (password.length < 6) {
      throw new Error('密码长度至少为6位');
    }

    // 检查是否已注册
    const existingUser = this.getCurrentUser();
    if (existingUser && existingUser.email === email) {
      // 验证密码（简单模拟）
      if (password.length < 6) {
        throw new Error('密码错误');
      }
      return existingUser;
    }

    // 模拟登录（实际应用中应该调用后端API验证）
    const user: User = {
      id: `user_${Date.now()}`,
      email,
      username: email.split('@')[0],
      createdAt: Date.now(),
      lastSyncTime: 0,
      syncEnabled: true
    };

    localStorage.setItem(this.STORAGE_KEY_USER, JSON.stringify(user));

    return user;
  }

  // 用户登出
  async logout(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY_USER);
    localStorage.removeItem(this.STORAGE_KEY_SYNC_DATA);
  }

  // 上传书签到云端
  async uploadBookmarks(bookmarks: BookmarkNode[]): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    const syncData: SyncData = {
      userId: user.id,
      bookmarks,
      timestamp: Date.now(),
      version: '1.0.0'
    };

    // 保存到本地存储（模拟云端存储）
    localStorage.setItem(this.STORAGE_KEY_SYNC_DATA, JSON.stringify(syncData));

    // 更新用户最后同步时间
    user.lastSyncTime = Date.now();
    localStorage.setItem(this.STORAGE_KEY_USER, JSON.stringify(user));

    // 实际应用中，这里应该调用云服务API
    // await fetch(`${this.API_BASE}/bookmarks/upload`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(syncData)
    // });
  }

  // 从云端下载书签
  async downloadBookmarks(): Promise<BookmarkNode[]> {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    // 从本地存储获取（模拟云端数据）
    const syncDataStr = localStorage.getItem(this.STORAGE_KEY_SYNC_DATA);
    if (!syncDataStr) {
      return [];
    }

    const syncData: SyncData = JSON.parse(syncDataStr);
    
    // 实际应用中，这里应该调用云服务API
    // const response = await fetch(`${this.API_BASE}/bookmarks/${user.id}`);
    // const syncData = await response.json();

    return syncData.bookmarks;
  }

  // 同步书签（上传+下载合并）
  async syncBookmarks(localBookmarks: BookmarkNode[]): Promise<BookmarkNode[]> {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    // 1. 上传本地书签
    await this.uploadBookmarks(localBookmarks);

    // 2. 下载云端书签
    const cloudBookmarks = await this.downloadBookmarks();

    // 3. 合并策略：以云端数据为准
    // 实际应用中可以实现更复杂的合并策略
    return cloudBookmarks;
  }

  // 启用/禁用同步
  setSyncEnabled(enabled: boolean): void {
    const user = this.getCurrentUser();
    if (user) {
      user.syncEnabled = enabled;
      localStorage.setItem(this.STORAGE_KEY_USER, JSON.stringify(user));
    }
  }

  // 获取同步状态
  getSyncStatus(): { enabled: boolean; lastSyncTime: number } {
    const user = this.getCurrentUser();
    return {
      enabled: user?.syncEnabled || false,
      lastSyncTime: user?.lastSyncTime || 0
    };
  }

  // 检查是否有云端更新
  async checkForUpdates(): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) {
      return false;
    }

    const syncDataStr = localStorage.getItem(this.STORAGE_KEY_SYNC_DATA);
    if (!syncDataStr) {
      return false;
    }

    const syncData: SyncData = JSON.parse(syncDataStr);
    return syncData.timestamp > user.lastSyncTime;
  }

  // 修改用户名
  async updateUsername(newUsername: string): Promise<User> {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    const updatedUser: User = {
      ...user,
      username: newUsername
    };

    localStorage.setItem(this.STORAGE_KEY_USER, JSON.stringify(updatedUser));

    return updatedUser;
  }

  // 修改密码
  async updatePassword(newPassword: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    // 实际应用中，这里应该调用后端API验证旧密码并设置新密码
    // 目前只是模拟成功
    console.log('密码已更新');
  }

  // 删除账户
  async deleteAccount(): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    // 删除用户数据
    localStorage.removeItem(this.STORAGE_KEY_USER);
    localStorage.removeItem(this.STORAGE_KEY_SYNC_DATA);

    // 实际应用中，这里还应该调用后端API删除云端数据
    console.log('账户已删除');
  }
}

export const cloudSyncService = new CloudSyncService();