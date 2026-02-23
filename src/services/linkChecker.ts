import { LinkCheckResult, BookmarkNode } from '../types';

class LinkCheckerService {
  private readonly CHECK_TIMEOUT = 5000; // 减少超时时间到5秒
  private readonly MAX_CONCURRENT = 3; // 减少并发数，避免过多请求
  private readonly BATCH_DELAY = 200; // 增加批次间延迟
  private isPaused = false;
  private pauseResolver: (() => void) | null = null;
  private currentCheckingUrl: string | null = null;
  private isChecking = false; // 添加检测状态标志
  private strictMode = false; // 严格模式：更准确的检测但更慢
  private isCancelled = false; // 取消标志

  // 取消检测
  cancel(): void {
    this.isCancelled = true;
    this.isPaused = false;
    this.isChecking = false;
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }

  // 重置取消标志
  resetCancel(): void {
    this.isCancelled = false;
  }

  // 检查是否被取消
  isCheckCancelled(): boolean {
    return this.isCancelled;
  }

  // 设置严格模式
  setStrictMode(enabled: boolean): void {
    this.strictMode = enabled;
  }

  // 获取严格模式状态
  getStrictMode(): boolean {
    return this.strictMode;
  }

  // 暂停检测
  pause(): void {
    this.isPaused = true;
  }

  // 恢复检测
  resume(): void {
    this.isPaused = false;
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }

  // 检查是否暂停，并等待恢复
  private async checkPause(): Promise<void> {
    if (!this.isPaused) return;
    
    return new Promise<void>((resolve) => {
      this.pauseResolver = resolve;
    });
  }

  // 获取当前正在检测的URL
  getCurrentCheckingUrl(): string | null {
    return this.currentCheckingUrl;
  }

  // 简化的URL检测方法
  async checkUrl(url: string): Promise<LinkCheckResult> {
    // 验证URL
    if (!url || !url.startsWith('http')) {
      return {
        url,
        status: 'error',
        error: '无效的URL',
        checkTime: Date.now()
      };
    }

    // 检查是否暂停
    await this.checkPause();

    // 设置当前检测URL
    this.currentCheckingUrl = url;

    try {
      // 使用Promise.race实现超时
      const result = await Promise.race([
        this.performCheck(url),
        this.createTimeoutPromise(url)
      ]);
      
      return result;
    } catch (error) {
      // 捕获所有错误，确保不会卡住
      console.error(`检测URL失败: ${url}`, error);
      return {
        url,
        status: 'error',
        error: (error as Error).message || '检测失败',
        checkTime: Date.now()
      };
    } finally {
      // 清理当前检测URL
      if (this.currentCheckingUrl === url) {
        this.currentCheckingUrl = null;
      }
    }
  }

  // 创建超时Promise
  private createTimeoutPromise(url: string): Promise<LinkCheckResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('检测超时'));
      }, this.CHECK_TIMEOUT);
    });
  }

  // 执行检测
  private async performCheck(url: string): Promise<LinkCheckResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.CHECK_TIMEOUT - 500);

    try {
      // 优先使用HEAD请求，更快
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit'
      });

      clearTimeout(timeoutId);

      return this.processResponse(url, response);
    } catch (error) {
      clearTimeout(timeoutId);

      // 如果是超时错误
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          url,
          status: 'timeout',
          error: '请求超时',
          checkTime: Date.now()
        };
      }

      // 如果是CORS错误，尝试no-cors模式
      const errorMessage = (error as Error).message || '';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS')) {
        return this.performCheckWithNoCors(url);
      }

      // 其他错误
      return {
        url,
        status: 'error',
        error: errorMessage || '网络错误',
        checkTime: Date.now()
      };
    }
  }

  // 处理响应
  private processResponse(url: string, response: Response): LinkCheckResult {
    const result: LinkCheckResult = {
      url,
      status: 'normal',
      checkTime: Date.now()
    };

    if (response.ok) {
      result.status = 'normal';
    } else if (response.redirected) {
      // 检查重定向类型
      result.status = 'redirect';
      result.redirectUrl = response.url;
      result.statusCode = response.status;

      // 301和308是永久重定向，可以认为是正常的
      if (response.status === 301 || response.status === 308) {
        result.status = 'normal';
        result.redirectUrl = response.url;
      }
      // 302、303、307是临时重定向，需要验证
      else if (response.status === 302 || response.status === 303 || response.status === 307) {
        result.status = 'redirect';
        result.redirectUrl = response.url;
        result.error = '临时重定向，请验证目标链接';
      }
      // 其他重定向类型
      else {
        result.status = 'redirect';
        result.redirectUrl = response.url;
      }
    } else if (response.status >= 300 && response.status < 400) {
      result.status = 'redirect';
      const location = response.headers.get('Location');
      if (location) {
        result.redirectUrl = location;
      }
      result.statusCode = response.status;
    } else if (response.status >= 400 && response.status < 500) {
      // 404是链接失效
      if (response.status === 404) {
        result.status = 'broken';
      }
      // 403 Forbidden - 访问被拒绝，但网站是存在的
      else if (response.status === 403) {
        result.status = 'error';
        result.statusCode = response.status;
        result.error = '访问被拒绝 (403)，网站可能存在但需要登录或权限';
      }
      // 429 Too Many Requests - 请求过于频繁，但网站是存在的
      else if (response.status === 429) {
        result.status = 'error';
        result.statusCode = response.status;
        result.error = '请求过于频繁 (429)，网站可能存在但被限流';
      }
      // 401 Unauthorized - 未授权，但网站是存在的
      else if (response.status === 401) {
        result.status = 'error';
        result.statusCode = response.status;
        result.error = '未授权访问 (401)，网站可能存在但需要登录';
      }
      // 410 Gone - 资源已永久删除
      else if (response.status === 410) {
        result.status = 'broken';
        result.statusCode = response.status;
        result.error = '资源已永久删除 (410)';
      }
      // 其他4xx错误
      else {
        result.status = 'error';
        result.statusCode = response.status;
        result.error = `客户端错误: HTTP ${response.status}`;
      }
    } else if (response.status >= 500) {
      // 5xx错误是服务器错误，链接可能正常但服务器有问题
      result.status = 'error';
      result.statusCode = response.status;
      result.error = `服务器错误: HTTP ${response.status}`;
    } else {
      result.status = 'error';
      result.statusCode = response.status;
      result.error = `HTTP ${response.status}`;
    }

    return result;
  }

  // 使用no-cors模式的备选检测
  private async performCheckWithNoCors(url: string): Promise<LinkCheckResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.CHECK_TIMEOUT - 500);

    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit'
      });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      clearTimeout(timeoutId);

      // 如果响应时间过短（< 30ms），可能是快速失败，标记为不确定
      if (responseTime < 30) {
        return {
          url,
          status: 'error',
          error: '响应过快，可能无效',
          checkTime: Date.now()
        };
      }

      // 如果响应时间过长（> 4.5秒），可能是超时
      if (responseTime > 4500) {
        return {
          url,
          status: 'timeout',
          error: `响应超时 (${responseTime}ms)`,
          checkTime: Date.now()
        };
      }

      // 在严格模式下，进行更详细的验证
      if (this.strictMode) {
        // no-cors 模式下，如果请求成功，但无法获取详细信息
        // 标记为需要验证，而不是错误
        return {
          url,
          status: 'error',
          error: '无法准确验证（CORS限制），但网站可能正常，请手动检查',
          checkTime: Date.now()
        };
      }

      // 普通模式下，假设成功（能够连接到服务器）
      return {
        url,
        status: 'normal',
        error: 'CORS限制，无法获取详细信息，但网站可能正常',
        checkTime: Date.now()
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          url,
          status: 'timeout',
          error: '请求超时',
          checkTime: Date.now()
        };
      }

      // 检查错误类型
      const errorMessage = (error as Error).message || '无法访问';
      
      // 网络错误
      if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
        return {
          url,
          status: 'error',
          error: '网络连接失败，可能无法访问',
          checkTime: Date.now()
        };
      }

      return {
        url,
        status: 'error',
        error: `访问失败: ${errorMessage}`,
        checkTime: Date.now()
      };
    }
  }

  async checkAllUrls(bookmarks: BookmarkNode[], onProgress?: (current: number, total: number, result: LinkCheckResult, currentUrl?: string) => void): Promise<LinkCheckResult[]> {
    // 防止重复检测
    if (this.isChecking) {
      console.log('检测正在进行中，请稍候...');
      return [];
    }
    
    this.isChecking = true;
    
    // 收集所有URL
    const urls: string[] = [];
    const collectUrls = (node: BookmarkNode): void => {
      if (node.url && node.url.startsWith('http')) {
        urls.push(node.url);
      }
      node.children?.forEach(collectUrls);
    };

    bookmarks.forEach(collectUrls);
    
    console.log(`开始检测 ${urls.length} 个URL`);

    // 立即通知总数
    if (onProgress) {
      onProgress(0, urls.length, { url: '', status: 'normal', checkTime: Date.now() }, null);
    }

    const results: LinkCheckResult[] = [];
    let completed = 0;

    try {
      // 逐个检测，确保进度实时更新
      for (let i = 0; i < urls.length; i++) {
        // 检查是否被取消
        if (this.isCancelled) {
          console.log('检测已被取消');
          break;
        }

        // 检查是否暂停
        if (this.isPaused) {
          await this.checkPause();
        }

        const url = urls[i];
        console.log(`检测进度: ${i + 1}/${urls.length} - ${url}`);

        try {
          const result = await this.checkUrl(url);
          results.push(result);
          completed++;

          // 实时更新进度
          if (onProgress) {
            onProgress(completed, urls.length, result, this.getCurrentCheckingUrl());
          }
        } catch (error) {
          // 单个URL检测失败，记录错误但继续检测下一个
          console.error(`检测URL失败: ${url}`, error);
          const errorResult: LinkCheckResult = {
            url,
            status: 'error',
            error: (error as Error).message || '检测失败',
            checkTime: Date.now()
          };
          results.push(errorResult);
          completed++;

          if (onProgress) {
            onProgress(completed, urls.length, errorResult, null);
          }
        }

        // 添加延迟，避免请求过于频繁
        if (i < urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
        }
      }
    } finally {
      this.isChecking = false;
      this.currentCheckingUrl = null;
      // 重置取消标志
      this.isCancelled = false;
    }

    console.log(`检测完成，共检测 ${results.length} 个URL`);
    return results;
  }

  async checkUrls(urls: string[], onProgress?: (current: number, total: number, result: LinkCheckResult) => void): Promise<LinkCheckResult[]> {
    const results: LinkCheckResult[] = [];
    let completed = 0;

    for (const url of urls) {
      try {
        const result = await this.checkUrl(url);
        results.push(result);
        completed++;
        
        if (onProgress) {
          onProgress(completed, urls.length, result);
        }
        
        // 添加延迟
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
      } catch (error) {
        console.error(`检测URL失败: ${url}`, error);
        const errorResult: LinkCheckResult = {
          url,
          status: 'error',
          error: (error as Error).message || '检测失败',
          checkTime: Date.now()
        };
        results.push(errorResult);
        completed++;
        
        if (onProgress) {
          onProgress(completed, urls.length, errorResult);
        }
      }
    }

    return results;
  }

  normalizeUrl(url: string): string {
    try {
      const normalized = new URL(url);
      normalized.hash = '';
      normalized.search = '';
      return normalized.toString();
    } catch {
      return url;
    }
  }

  areUrlsSimilar(url1: string, url2: string): boolean {
    const normalized1 = this.normalizeUrl(url1);
    const normalized2 = this.normalizeUrl(url2);
    return normalized1 === normalized2;
  }
}

export const linkCheckerService = new LinkCheckerService();