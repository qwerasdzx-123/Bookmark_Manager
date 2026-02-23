# 书签管理器

一个强大的浏览器书签管理插件，帮助你智能整理和分类书签。

## 功能特性

- 🤖 **智能分类** - 自动根据网站类型将书签分类到相应文件夹
- 🔍 **重复检测** - 识别和删除重复的书签
- 🔗 **链接检查** - 检测书签是否失效
- ☁️ **云端同步** - 支持书签云端备份和同步
- 🎨 **拖拽整理** - 直观的拖拽界面整理书签
- 📱 **响应式设计** - 支持 popup 和 web 两种界面

## 智能分类支持

自动将书签分类到以下文件夹：

- 搜索引擎 (Google, 百度, Bing, etc.)
- 邮箱 (Gmail, Outlook, 163邮箱, etc.)
- 社交媒体 (微博, 知乎, GitHub, etc.)
- 新闻资讯
- 技术开发
- 购物
- 视频 (B站, YouTube, etc.)
- 音乐
- 工作
- 教育
- 金融财经
- 工具
- 游戏
- 阅读
- 设计
- AI人工智能
- 运维开发
- 生活
- 安全

## 安装方法

### 从源码安装

1. 克隆仓库：
```bash
git clone https://github.com/qwerasdzx-123/Bookmark_Managerz.git
cd Bookmark_Managerz
```

2. 安装依赖：
```bash
npm install
```

3. 构建项目：
```bash
npm run build
```

4. 在 Chrome 浏览器中：
   - 打开 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `dist` 文件夹

### 开发模式

```bash
npm run dev
```

## 使用方法

1. **自动分类**
   - 点击"整理"按钮，自动将根目录的书签分类到相应文件夹
   - 基于域名、标题和内容智能匹配

2. **拖拽整理**
   - 在 web 界面中可以拖拽书签到不同文件夹
   - 支持批量选择和移动

3. **查找重复**
   - 自动检测重复的书签 URL
   - 提供合并或删除选项

4. **链接检查**
   - 检测失效的书签链接
   - 标记 404、超时等状态

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **数据库**: IndexedDB (通过 Dexie.js)
- **拖拽**: React Beautiful DnD
- **状态管理**: Zustand
- **图标**: Lucide React

## 项目结构

```
src/
├── background/          # 后台脚本
├── content/             # 内容脚本
├── popup/               # 弹窗界面
├── web/                 # Web 管理界面
├── services/            # 业务逻辑
│   ├── bookmarkImportExport.ts
│   ├── bookmarkOrganizer.ts
│   ├── cloudSync.ts
│   ├── indexedDB.ts
│   └── linkChecker.ts
├── store/               # 状态管理
├── types/               # 类型定义
└── web/                 # Web 界面组件
```

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 代码检查
npm run lint

# 类型检查
npm run typecheck
```

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 更新日志

### v1.0.0
- 初始版本发布
- 支持智能书签分类
- 支持重复检测和链接检查
- 支持云端同步