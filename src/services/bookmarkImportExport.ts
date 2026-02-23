import { BookmarkNode, ImportOptions, ExportOptions } from '../types';

class BookmarkImportExportService {
  async exportToHTML(bookmarkTree: BookmarkNode[], options: ExportOptions = { format: 'html' }): Promise<string> {
    const now = new Date().toISOString();
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    const processNode = (node: BookmarkNode, indent: string = ''): void => {
      if (options.selectedFolders && node.id && !options.selectedFolders.includes(node.id)) {
        return;
      }

      if (options.includeBroken === false && node.status === 'broken') {
        return;
      }

      if (node.url) {
        const tags = node.tags ? ` TAGS="${node.tags.join(',')}"` : '';
        const notes = node.notes ? ` NOTE="${this.escapeHtml(node.notes)}"` : '';
        html += `${indent}    <DT><A HREF="${this.escapeHtml(node.url)}" ADD_DATE="${node.dateAdded || Date.now()}"${tags}${notes}>${this.escapeHtml(node.title)}</A>\n`;
      } else if (node.children) {
        html += `${indent}    <DT><H3 ADD_DATE="${node.dateAdded || Date.now()}" LAST_MODIFIED="${node.dateGroupModified || Date.now()}">${this.escapeHtml(node.title)}</H3>\n`;
        html += `${indent}    <DL><p>\n`;
        node.children.forEach(child => processNode(child, indent + '    '));
        html += `${indent}    </DL><p>\n`;
      }
    };

    bookmarkTree.forEach(node => processNode(node));
    html += `</DL><p>`;

    return html;
  }

  async exportToJSON(bookmarkTree: BookmarkNode[], options: ExportOptions = { format: 'json' }): Promise<string> {
    const filterTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
      return nodes
        .filter(node => {
          if (options.selectedFolders && node.id && !options.selectedFolders.includes(node.id)) {
            return false;
          }
          if (options.includeBroken === false && node.status === 'broken') {
            return false;
          }
          return true;
        })
        .map(node => ({
          ...node,
          children: node.children ? filterTree(node.children) : undefined
        }));
    };

    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      bookmarks: filterTree(bookmarkTree)
    };

    return JSON.stringify(data, null, 2);
  }

  async importFromHTML(htmlContent: string, options: ImportOptions): Promise<BookmarkNode[]> {
    console.log('=== 开始解析 HTML 书签文件 ===');
    console.log('原始 HTML 片段:', htmlContent.substring(0, 200) + '...');
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const bookmarks: BookmarkNode[] = [];

    // 调试：查看 body 的内容
    console.log('Body 的 HTML:', doc.body.innerHTML.substring(0, 500) + '...');
    console.log('Body 的子元素:', Array.from(doc.body.children).map(el => el.tagName));

    // 处理 DT 元素及其内容
    const processDT = (dtElement: Element, parentId?: string, depth: number = 0): BookmarkNode | null => {
      const indent = '  '.repeat(depth);
      console.log(`${indent}处理 DT 元素`);
      console.log(`${indent}  DT 元素的 HTML:`, dtElement.innerHTML);
      console.log(`${indent}  DT 元素的子元素:`, Array.from(dtElement.children).map(el => el.tagName));
      console.log(`${indent}  DT 元素的文本内容:`, dtElement.textContent?.trim());

      // 检查直接子元素，不要使用 querySelector，因为它会搜索整个子树
      const h3Element = Array.from(dtElement.children).find(el => el.tagName === 'H3');
      const aElement = Array.from(dtElement.children).find(el => el.tagName === 'A');

      console.log(`${indent}  H3 元素:`, h3Element ? `找到 (${(h3Element as HTMLElement).textContent?.trim()})` : '未找到');
      console.log(`${indent}  A 元素:`, aElement ? `找到 (${(aElement as HTMLElement).textContent?.trim()})` : '未找到');

      // 优先检查 H3（文件夹），因为文件夹的定义是 DT 包含 H3
      if (h3Element) {
        const folderTitle = (h3Element as HTMLElement).textContent?.trim();
        
        // 跳过空标题的文件夹
        if (!folderTitle) {
          console.warn(`${indent}跳过空标题的文件夹`);
          return null;
        }

        const folderId = this.generateId();
        const folder: BookmarkNode = {
          id: folderId,
          title: folderTitle,
          dateAdded: h3Element.getAttribute('ADD_DATE') ? parseInt(h3Element.getAttribute('ADD_DATE')!) : Date.now(),
          dateGroupModified: h3Element.getAttribute('LAST_MODIFIED') ? parseInt(h3Element.getAttribute('LAST_MODIFIED')!) : Date.now(),
          parentId,
          children: []
        };

        console.log(`${indent}  → 文件夹: ${folderTitle} (ID: ${folderId})`);

        // 在 DT 的子元素中查找 DL 元素（不是兄弟元素）
        const dlElement = Array.from(dtElement.children).find(el => el.tagName === 'DL');

        if (dlElement) {
          console.log(`${indent}    找到 DL 元素，子元素数量: ${dlElement.children.length}`);
          // 处理文件夹内的所有 DT 元素（避免使用 :scope 选择器，确保兼容性）
          const childDTs = Array.from(dlElement.children).filter(
            child => child.tagName === 'DT'
          ) as Element[];
          console.log(`${indent}    找到 ${childDTs.length} 个 DT 子元素`);
          
          const children: BookmarkNode[] = [];

          for (const childDT of childDTs) {
            const childNode = processDT(childDT, folderId, depth + 1);
            if (childNode) {
              children.push(childNode);
            }
          }

          // 保留文件夹结构，即使没有子项
          folder.children = children;
          console.log(`${indent}    文件夹 ${folderTitle} 包含 ${children.length} 个子项`);
          if (children.length === 0) {
            console.log(`${indent}    文件夹（可能为空）: ${folderTitle}`);
          }
          return folder;
        } else {
          // 没有子项的文件夹，保留（创建空文件夹）
          console.log(`${indent}    没有找到 DL 元素，创建空文件夹: ${folderTitle}`);
          folder.children = [];
          return folder;
        }
      }

      // 如果 DT 包含直接的 A 标签，这是一个书签
      if (aElement) {
        const bookmark: BookmarkNode = {
          id: this.generateId(),
          title: (aElement as HTMLElement).textContent?.trim() || '未命名书签',
          url: aElement.getAttribute('href') || '',
          dateAdded: aElement.getAttribute('ADD_DATE') ? parseInt(aElement.getAttribute('ADD_DATE')!) : Date.now(),
          parentId,
          tags: aElement.getAttribute('TAGS')?.split(',').filter(t => t.trim()) || [],
          notes: aElement.getAttribute('NOTE') || undefined
        };
        console.log(`${indent}  → 书签: ${bookmark.title} (${bookmark.url})`);
        return bookmark;
      }

      // 既不是书签也不是文件夹的 DT 元素，跳过
      console.log(`${indent}  → 跳过（既不是书签也不是文件夹）`);
      return null;
    };

    // 找到最外层的 DL 元素（书签根目录）
    // 在标准书签 HTML 文件中，最外层的 DL 是 <body> 下的第一个 DL
    const bodyDLs = Array.from(doc.body.querySelectorAll(':scope > DL'));
    console.log(`找到 ${bodyDLs.length} 个 body 下的 DL 元素`);
    
    if (bodyDLs.length === 0) {
      console.warn('未找到 body 下的 DL 元素，尝试查找所有 DL');
      const allDLs = doc.querySelectorAll('DL');
      if (allDLs.length > 0) {
        bodyDLs.push(allDLs[0] as Element);
      }
    }

    // 处理最外层的 DL
    for (const dl of bodyDLs) {
      const rootDTs = Array.from(dl.children).filter(
        child => child.tagName === 'DT'
      ) as Element[];
      console.log(`  处理 DL，包含 ${rootDTs.length} 个直接 DT 子元素`);
      
      for (const dt of rootDTs) {
        const node = processDT(dt);
        if (node) {
          bookmarks.push(node);
        }
      }
    }

    console.log(`导入完成: ${bookmarks.length} 个顶层节点`);
    console.log('=== HTML 解析完成 ===');
    return bookmarks;
  }

  /**
   * 测试 HTML 解析（用于调试）
   */
  debugParseHTML(htmlContent: string): void {
    console.log('=== 调试 HTML 解析 ===');
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // 找到所有 DL 元素
    const allDLs = doc.querySelectorAll('DL');
    console.log(`找到 ${allDLs.length} 个 DL 元素:`);
    
    for (let i = 0; i < allDLs.length; i++) {
      const dl = allDLs[i];
      const dts = dl.querySelectorAll(':scope > DT');
      console.log(`  DL ${i + 1}: 包含 ${dts.length} 个直接 DT 子元素`);
      
      for (let j = 0; j < dts.length; j++) {
        const dt = dts[j];
        const h3 = dt.querySelector('H3');
        const a = dt.querySelector('A');
        
        if (h3) {
          console.log(`    DT ${j + 1}: 📁 文件夹 "${h3.textContent?.trim()}"`);
        } else if (a) {
          console.log(`    DT ${j + 1}: 📄 书签 "${a.textContent?.trim()}" → ${a.getAttribute('href')}`);
        } else {
          console.log(`    DT ${j + 1}: ❓ 未知元素`);
        }
      }
    }
  }

  /**
   * 验证书签树的有效性
   */
  validateBookmarks(bookmarks: BookmarkNode[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const validateNode = (node: BookmarkNode, path: string = ''): void => {
      const currentPath = path ? `${path} > ${node.title}` : node.title;

      // 检查书签必须有 URL
      if (node.url && !node.url.startsWith('http')) {
        errors.push(`无效的书签URL: ${currentPath} (${node.url})`);
      }

      // 检查文件夹必须有标题
      if (!node.url && (!node.title || node.title.trim() === '')) {
        errors.push(`文件夹没有标题: ${path || '根目录'}`);
      }

      // 递归检查子节点
      if (node.children) {
        node.children.forEach(child => validateNode(child, currentPath));
      }
    };

    bookmarks.forEach(node => validateNode(node));

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 清理书签树中的无效节点
   */
  cleanBookmarks(bookmarks: BookmarkNode[]): BookmarkNode[] {
    const cleanNode = (node: BookmarkNode): BookmarkNode | null => {
      // 清理书签：必须有有效的 URL
      if (node.url) {
        if (!node.url.startsWith('http') && !node.url.startsWith('https') && !node.url.startsWith('ftp')) {
          console.warn(`跳过无效URL的书签: ${node.title} (${node.url})`);
          return null;
        }
        return node;
      }

      // 清理文件夹：必须有标题
      if (!node.title || node.title.trim() === '') {
        console.warn('跳过无标题的文件夹');
        return null;
      }

      // 递归清理子节点
      if (node.children && node.children.length > 0) {
        const cleanedChildren = node.children
          .map(child => cleanNode(child))
          .filter((child): child is BookmarkNode => child !== null);

        // 保留文件夹，即使子节点被清理后变空（只警告，不删除）
        if (cleanedChildren.length === 0) {
          console.warn(`文件夹清理后变空: ${node.title}（保留文件夹结构）`);
        }

        return {
          ...node,
          children: cleanedChildren
        };
      }

      // 没有子节点的文件夹，保留（可能是空的文件夹）
      console.log(`保留空文件夹: ${node.title}`);
      return node;
    };

    return bookmarks
      .map(node => cleanNode(node))
      .filter((node): node is BookmarkNode => node !== null);
  }

  /**
   * 查找并移除重复的书签（保留文件夹结构）
   */
  removeDuplicates(bookmarks: BookmarkNode[]): BookmarkNode[] {
    const seenUrls = new Set<string>();
    const seenTitles = new Map<string, BookmarkNode>();

    const processNode = (node: BookmarkNode, parentId?: string): BookmarkNode | null => {
      // 处理书签
      if (node.url) {
        // 检查 URL 重复
        if (seenUrls.has(node.url)) {
          console.warn(`跳过重复URL的书签: ${node.title} (${node.url})`);
          return null;
        }
        seenUrls.add(node.url);

        // 检查标题重复（在同一父文件夹下）
        const titleKey = parentId ? `${parentId}:${node.title}` : node.title;
        if (seenTitles.has(titleKey)) {
          console.warn(`跳过重复标题的书签: ${node.title} (在文件夹 ${parentId || '根目录'})`);
          return null;
        }
        seenTitles.set(titleKey, node);

        return node;
      }

      // 处理文件夹 - 保留所有文件夹，不删除
      if (node.children && node.children.length > 0) {
        const cleanedChildren = node.children
          .map(child => processNode(child, node.id))
          .filter((child): child is BookmarkNode => child !== null);

        // 保留文件夹，即使去重后变空
        if (cleanedChildren.length === 0) {
          console.warn(`文件夹去重后变空，但保留文件夹结构: ${node.title}`);
        }

        return {
          ...node,
          children: cleanedChildren
        };
      }

      // 空文件夹，保留
      return node;
    };

    return bookmarks
      .map(node => processNode(node))
      .filter((node): node is BookmarkNode => node !== null);
  }

  async importFromJSON(jsonContent: string, options: ImportOptions): Promise<BookmarkNode[]> {
    try {
      const data = JSON.parse(jsonContent);
      
      if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
        throw new Error('无效的JSON格式');
      }

      const addIds = (node: BookmarkNode, parentId?: string): BookmarkNode => {
        return {
          ...node,
          id: node.id || this.generateId(),
          parentId,
          children: node.children ? node.children.map(child => addIds(child, node.id)) : undefined
        };
      };

      return data.bookmarks.map(node => addIds(node));
    } catch (error) {
      throw new Error('JSON解析失败: ' + (error as Error).message);
    }
  }

  async exportBookmarks(bookmarkTree: BookmarkNode[], options: ExportOptions): Promise<Blob> {
    let content: string;
    let mimeType: string;
    let extension: string;

    if (options.format === 'html') {
      content = await this.exportToHTML(bookmarkTree, options);
      mimeType = 'text/html';
      extension = 'html';
    } else {
      content = await this.exportToJSON(bookmarkTree, options);
      mimeType = 'application/json';
      extension = 'json';
    }

    return new Blob([content], { type: mimeType });
  }

  async importBookmarks(file: File, options: ImportOptions): Promise<BookmarkNode[]> {
    const content = await file.text();
    
    if (options.format === 'html') {
      return await this.importFromHTML(content, options);
    } else {
      return await this.importFromJSON(content, options);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private generateId(): string {
    return `bk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async previewImport(file: File, options: ImportOptions): Promise<{ count: number; folders: number; bookmarks: number }> {
    const bookmarks = await this.importBookmarks(file, options);
    
    let folders = 0;
    let bookmarkItems = 0;

    const countItems = (node: BookmarkNode): void => {
      if (node.url) {
        bookmarkItems++;
      } else {
        folders++;
        node.children?.forEach(countItems);
      }
    };

    bookmarks.forEach(countItems);

    return {
      count: bookmarks.length,
      folders,
      bookmarks: bookmarkItems
    };
  }
}

export const bookmarkImportExportService = new BookmarkImportExportService();
