import { BookmarkNode, DuplicateInfo, CategoryRule } from '../types';

interface ContentMatchResult {
  bookmark: BookmarkNode;
  folderId: string;
  matchReason: string;
  score: number;
}

class BookmarkOrganizerService {
  private contentCache = new Map<string, string>(); // 缓存书签内容

  findDuplicates(bookmarks: BookmarkNode[], options: { exactMatch: boolean; similarMatch: boolean }): DuplicateInfo[] {
    const urlMap = new Map<string, BookmarkNode[]>();
    const duplicates: DuplicateInfo[] = [];

    const collectUrls = (node: BookmarkNode): void => {
      if (node.url) {
        const normalizedUrl = this.normalizeUrl(node.url);
        if (!urlMap.has(normalizedUrl)) {
          urlMap.set(normalizedUrl, []);
        }
        urlMap.get(normalizedUrl)!.push(node);
      }
      node.children?.forEach(collectUrls);
    };

    bookmarks.forEach(collectUrls);

    urlMap.forEach((bookmarkList, url) => {
      if (bookmarkList.length > 1) {
        duplicates.push({
          url,
          bookmarks: bookmarkList,
          similarity: 1
        });
      }
    });

    if (options.similarMatch) {
      const similarDuplicates = this.findSimilarDuplicates(bookmarks);
      duplicates.push(...similarDuplicates);
    }

    return duplicates;
  }

  private findSimilarDuplicates(bookmarks: BookmarkNode[]): DuplicateInfo[] {
    const urlMap = new Map<string, BookmarkNode[]>();
    const duplicates: DuplicateInfo[] = [];

    const collectUrls = (node: BookmarkNode): void => {
      if (node.url) {
        const normalizedUrl = this.normalizeUrl(node.url);
        if (!urlMap.has(normalizedUrl)) {
          urlMap.set(normalizedUrl, []);
        }
        urlMap.get(normalizedUrl)!.push(node);
      }
      node.children?.forEach(collectUrls);
    };

    bookmarks.forEach(collectUrls);

    const urls = Array.from(urlMap.keys());
    
    for (let i = 0; i < urls.length; i++) {
      for (let j = i + 1; j < urls.length; j++) {
        const similarity = this.calculateUrlSimilarity(urls[i], urls[j]);
        if (similarity > 0.8) {
          const bookmarkList1 = urlMap.get(urls[i])!;
          const bookmarkList2 = urlMap.get(urls[j])!;
          duplicates.push({
            url: urls[i],
            bookmarks: [...bookmarkList1, ...bookmarkList2],
            similarity
          });
        }
      }
    }

    return duplicates;
  }

  private normalizeUrl(url: string): string {
    try {
      const normalized = new URL(url);
      normalized.hash = '';
      return normalized.toString().toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private calculateUrlSimilarity(url1: string, url2: string): number {
    const normalized1 = this.normalizeUrl(url1);
    const normalized2 = this.normalizeUrl(url2);

    if (normalized1 === normalized2) return 1;

    const tokens1 = normalized1.split(/[\/\?&#=]+/).filter(t => t.length > 2);
    const tokens2 = normalized2.split(/[\/\?&#=]+/).filter(t => t.length > 2);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const intersection = tokens1.filter(t => tokens2.includes(t));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.length / union.size;
  }

  categorizeBookmarks(bookmarks: BookmarkNode[], rules: CategoryRule[]): Map<string, BookmarkNode[]> {
    const categorized = new Map<string, BookmarkNode[]>();

    const categorizeNode = (node: BookmarkNode): void => {
      if (!node.url) {
        node.children?.forEach(categorizeNode);
        return;
      }

      for (const rule of rules) {
        if (this.matchesRule(node, rule)) {
          if (!categorized.has(rule.targetFolder)) {
            categorized.set(rule.targetFolder, []);
          }
          categorized.get(rule.targetFolder)!.push(node);
          break;
        }
      }

      node.children?.forEach(categorizeNode);
    };

    bookmarks.forEach(categorizeNode);

    return categorized;
  }

  private matchesRule(bookmark: BookmarkNode, rule: CategoryRule): boolean {
    const { title, url } = bookmark;
    const { keywords, urlPatterns } = rule;

    if (keywords.length > 0) {
      const titleLower = title.toLowerCase();
      const urlLower = (url || '').toLowerCase();
      const matchesKeyword = keywords.some(keyword => 
        titleLower.includes(keyword.toLowerCase()) || 
        urlLower.includes(keyword.toLowerCase())
      );
      if (matchesKeyword) return true;
    }

    if (urlPatterns && urlPatterns.length > 0 && url) {
      const matchesPattern = urlPatterns.some(pattern => {
        try {
          const regex = new RegExp(pattern);
          return regex.test(url);
        } catch {
          return false;
        }
      });
      if (matchesPattern) return true;
    }

    return false;
  }

  autoCategorize(bookmarks: BookmarkNode[]): Map<string, BookmarkNode[]> {
    const defaultRules: CategoryRule[] = [
      {
        id: 'search',
        name: '搜索引擎',
        keywords: ['百度', 'baidu', 'bing', 'bing.com', '搜狗', 'sogou', 'sogou.com', '360搜索', 'so.com', 'search', '搜索引擎', 'searchengine', 'duckduckgo', 'duckduckgo.com', '必应', 'google', '谷歌', '谷歌翻译'],
        urlPatterns: ['^https?://(www\\.)?google\\.com', '^https?://(www\\.)?translate\\.google\\.com', '^https?://(www\\.)?baidu\\.com', '^https?://(www\\.)?bing\\.com', '^https?://(www\\.)?sogou\\.com', '^https?://(www\\.)?so\\.com', '^https?://(www\\.)?duckduckgo\\.com'],
        targetFolder: '搜索引擎'
      },
      {
        id: 'email',
        name: '邮箱',
        keywords: ['邮箱', 'email', 'mail', 'qq邮箱', '163邮箱', 'gmail', 'gmail.com', 'outlook', 'outlook.com', 'hotmail', 'hotmail.com', 'live.com', 'mail.qq.com', '163.com', '126.com', 'foxmail', 'foxmail.com', 'yahoo', 'yahoo.com', 'mail.ru', 'protonmail', 'protonmail.com'],
        urlPatterns: ['^https?://(www\\.)?mail\\.google\\.com', '^https?://(www\\.)?mail\\.qq\\.com', '^https?://(www\\.)?163\\.com', '^https?://(www\\.)?126\\.com', '^https?://(www\\.)?outlook\\.com', '^https?://(www\\.)?hotmail\\.com', '^https?://(www\\.)?live\\.com', '^https?://(www\\.)?gmail\\.com', '^https?://(www\\.)?foxmail\\.com', '^https?://(www\\.)?yahoo\\.com', '^https?://(www\\.)?mail\\.ru', '^https?://(www\\.)?protonmail\\.com', '.*\\.mail\\..*', '.*email\\..*'],
        targetFolder: '邮箱'
      },
      {
        id: 'social',
        name: '社交媒体',
        keywords: ['微博', '微信', 'qq', 'qzone', 'facebook', 'twitter', 'twitter.com', 'x.com', 'instagram', 'instagram.com', 'linkedin', 'linkedin.com', 'tiktok', 'douyin', 'douyin.com', '快手', 'kuaishou', 'telegram', 'telegram.org', 'discord', 'discord.com', '知乎', 'zhihu.com', '豆瓣', 'douban.com', '贴吧', 'tieba.baidu.com', '掘金', 'juejin.cn', 'v2ex', 'v2ex.com', 'csdn', 'csdn.net', 'segmentfault', 'segmentfault.com', '小红书', 'xiaohongshu', 'pinterest'],
        urlPatterns: ['.*\\.(weibo|qq|facebook|twitter|x|instagram|linkedin|tiktok|douyin|kuaishou|telegram|discord|zhihu|douban|xiaohongshu|pinterest)\\..*', '.*\\.(v2ex|csdn|segmentfault|juejin)\\..*'],
        targetFolder: '社交媒体'
      },
      {
        id: 'news',
        name: '新闻资讯',
        keywords: ['新闻', 'news', '资讯', '头条', '日报', 'sina', '163', 'sohu', 'ifeng', 'people', 'thepaper', 'guancha', 'zaobao', 'cctv', 'xinhua', 'xinhuanet', 'bbc', 'cnn', 'reuters', 'ap'],
        urlPatterns: ['.*\\.(sina|163|sohu|ifeng|people|thepaper|guancha|zaobao)\\..*', '.*\\.(cctv|xinhua|bbc|cnn|reuters)\\..*'],
        targetFolder: '新闻资讯'
      },
      {
        id: 'tech',
        name: '技术开发',
        keywords: ['github', 'github.com', 'gitlab', 'gitee', 'gitee.com', 'stackoverflow', 'stackoverflow.com', 'developer', 'code', 'programming', 'dev', '技术', '开发', '编程', '码', 'api', 'docker', 'kubernetes', 'linux', 'ubuntu', 'python', 'javascript', 'java', 'go', 'rust', 'typescript', 'react', 'vue', 'angular', 'node', 'npm', 'yarn', 'webpack', 'vite', 'css', 'html', 'sql', 'database', 'bug', 'issue', 'pr', 'repo', 'repository', 'algorithm', '算法', 'frontend', 'backend', '全栈', 'fullstack', '框架', 'framework', '库', 'library', 'npmjs', 'yarnpkg', 'pypi'],
        urlPatterns: ['^https?://(www\\.)?github\\.com', '^https?://(www\\.)?gitlab\\.com', '^https?://(www\\.)?gitee\\.com', '^https?://(www\\.)?stackoverflow\\.com', '^https?://(www\\.)?npmjs\\.com', '^https?://(www\\.)?yarnpkg\\.com', '^https?://(www\\.)?pypi\\.org', '^https?://(www\\.)?docker\\.com', '^https?://(www\\.)?kubernetes\\.io'],
        targetFolder: '技术开发'
      },
      {
        id: 'shopping',
        name: '购物',
        keywords: ['淘宝', 'taobao', '天猫', 'tmall', 'tmall.com', '京东', 'jd.com', '拼多多', 'pinduoduo', 'amazon', 'amazon.cn', 'amazon.com', 'ebay', '购物', 'shop', 'mall', '商城', 'buy', 'pay', 'price', '订单', 'cart', '优惠', 'coupon', '折扣', '促销', '秒杀', '团购', '特卖'],
        urlPatterns: ['.*\\.(taobao|tmall|jd|pinduoduo|amazon|ebay)\\..*', '.*\\.(shop|mall|buy|pay|cart|order)\\..*'],
        targetFolder: '购物'
      },
      {
        id: 'video',
        name: '视频',
        keywords: ['bilibili', 'bilibili.com', 'youtube', 'youtube.com', 'youku', 'youku.com', 'iqiyi', 'iqiyi.com', 'tencent', 'tencent.com', '腾讯视频', 'mgtv', '芒果tv', 'mgtv.com', '优酷', 'youku', 'douyin', 'douyin.com', '快手', 'kuaishou.com', '抖音', 'tiktok', '视频', 'video', 'movie', 'film', '电影', '电视剧', '综艺', '纪录片', '动漫', '动画', '剧集', '番剧', '播放器', 'player', '观看', '看', '直播', 'live', 'stream'],
        urlPatterns: ['.*\\.(bilibili|youtube|youku|iqiyi|mgtv|douyin|kuaishou)\\..*', '.*\\.(video|movie|film)\\..*', '.*\\.(qq\\.com|tencent)\\..*'],
        targetFolder: '视频'
      },
      {
        id: 'music',
        name: '音乐',
        keywords: ['music', 'music.163.com', 'spotify', 'spotify.com', 'netease', 'netease.com', 'qqmusic', 'qq.com', 'kugou', 'kugou.com', 'kuwo', 'kuwo.com', '酷狗', '千千音乐', '酷我', 'kuwo', '酷狗音乐', '酷狗音乐官网', '5sing', '5sing.kugou.com', '咪咕', 'migu', 'migu.cn', '虾米', 'xiami.com', '喜马拉雅', 'ximalaya', 'ximalaya.com', 'fm', '电台', '播客', 'podcast', 'song', '音乐', 'music', '专辑', 'album', '歌手', 'artist', '播放', 'play', '听', '听歌', '下载', 'download', 'mv', '演唱会', 'concert', 'livehouse', '现场', '现场演出'],
        urlPatterns: ['.*\\.(music|spotify|netease|qqmusic|kugou|kuwo|kuwo\\.com|5sing|migu|ximalaya)\\..*', '.*\\.(song|album|artist|mv|concert)\\..*'],
        targetFolder: '音乐'
      },
      {
        id: 'work',
        name: '工作',
        keywords: ['work', '工作', 'office', 'office.com', '文档', 'document', 'doc', 'docs', 'wps', 'wps.cn', '飞书', 'feishu', 'feishu.cn', '钉钉', 'dingtalk', 'dingtalk.com', '企业微信', 'work.weixin', '腾讯文档', 'docs.qq.com', '石墨', 'shimo.im', '石墨文档', '语雀', 'yuque', 'yuque.com', 'notion', 'notion.so', '飞书文档', '云文档', '云笔记', 'note', 'onenote', 'evernote', '印象笔记', '有道云笔记', 'youdao', 'calendar', '日历', '日程', 'schedule', '腾讯日历', '腾讯会议', 'meeting', '会议', 'zoom', 'zoom.us', 'teams', 'teams.microsoft.com', '钉钉会议', '飞书会议', 'teambition', '协同', 'collaboration', '协作', 'team', '团队', '群组', 'group', '项目管理', 'project', '任务', 'task', '日程管理', '办公', 'productivity', '效率'],
        urlPatterns: ['.*\\.(office|docs|wps|feishu|dingtalk|work\\.weixin|docs\\.qq|notion|evernote|onenote|youdao|teambition)\\..*', '.*\\.(calendar|meeting|zoom|teams|productivity)\\..*'],
        targetFolder: '工作'
      },
      {
        id: 'education',
        name: '教育',
        keywords: ['edu', 'education', 'course', '课程', '学习', 'learn', '教程', 'tutorial', 'mooc', '慕课', 'coursera', 'coursera.org', 'udemy', 'udemy.com', '学堂', '学堂在线', '网易课堂', 'icourse163', 'xuetangx', '学堂在线xuetangx', '中国大学mooc', 'icourse163.org', '学堂', 'school', '学校', '大学', 'college', '考试', 'exam', '考研', 'kaoyan', '考公', 'kaogong', '题库', 'question', 'practice', '练习', '培训', 'training', '教学', 'teaching', '讲师', 'teacher', '教授', 'professor', '课件', 'courseware', '资料', 'material', '论文', 'paper', '文献', 'literature', '期刊', 'journal', 'magazine', '期刊杂志', '研究', 'research', '学位', 'degree', '论文发表', '毕业论文', 'thesis', '毕设', 'project', '作业', 'homework', '考试', 'test', 'quiz'],
        urlPatterns: ['.*\\.(edu|mooc|course|udemy|coursera|学堂|school|university|college|kaoyan|exam)\\..*', '.*\\.(cnki|wanfang|vip)\\..*'],
        targetFolder: '教育'
      },
      {
        id: 'finance',
        name: '金融财经',
        keywords: ['股票', 'stock', '股市', '基金', 'fund', '理财', 'finance', 'bank', '银行', '证券', 'securities', '期货', 'futures', '外汇', 'forex', '黄金', 'gold', '保险', 'insurance', '信用卡', 'credit', 'loan', '贷款', '借钱', '借钱', '还款', '还款', '支付宝', 'alipay', '支付宝理财', '余额宝', '余额宝', '财富', '财付通', 'tenpay', '微信支付', '财付通', '蚂蚁财富', 'ant', '蚂蚁集团', '蚂蚁', '京东金融', 'jd.jr', '度小满', '度小满有钱花', '有钱花', '借呗', '花呗', '京东白条', '白条', '招联', '招商', '民生', '工商', '建设', '银行', 'card', '卡', '卡债', '负债', '投资', 'invest', '收益', 'profit', '利率', 'rate', '利息', '利息收入', '利息支出', '央行', 'pbc', '央行', '美联储', 'fed', '汇率', 'exchange', 'cny', 'rmb', '美元', 'usd', '欧元', 'eur', '日元', 'jpy', '英镑', 'gbp', '比特币', 'btc', 'ethereum', 'eth', '币', '币圈', '加密货币', 'cryptocurrency', '区块链', 'blockchain', 'nft'],
        urlPatterns: ['.*\\.(stock|fund|finance|bank|invest|alipay|tenpay|jd.jr|度小满|有钱花|借呗|花呗|白条)\\..*', '.*\\.(ant|蚂蚁)\\..*', '.*\\.(btc|eth|usdt|cny|rmb)\\..*'],
        targetFolder: '金融财经'
      },
      {
        id: 'tool',
        name: '工具',
        keywords: ['tool', '工具', 'toolbox', '工具箱', 'converter', '转换', 'translate', '翻译', 'deepl', '百度翻译', 'fanyi', '有道', 'youdao', 'calculator', '计算器', 'calc', 'json', 'xml', 'yaml', 'regex', '正则', 'encode', 'decode', '编码', '解码', 'base64', 'hash', 'md5', 'sha', 'generator', '生成器', 'compress', '压缩', 'zip', 'rar', '7z', 'pdf工具', 'pdf', 'ocr', '识别', 'scan', '扫描', 'test', '测试', 'benchmark', 'speed', 'ping', 'traceroute', 'whois', 'dns', 'ip', 'lookup', '查询', '格式化', 'format', '在线工具', '在线转换', '颜色', 'color', '截图', 'screenshot', '录屏', 'screenrecorder', '下载', 'download'],
        urlPatterns: ['.*\\.(tool|convert|translate|calc|json|xml|yaml|regex|encode|decode|base64|hash|md5|sha|generator|compress|zip|rar|ocr|scan|benchmark)\\..*', '.*\\.(online|converter|formatter)\\..*'],
        targetFolder: '工具'
      },
      {
        id: 'game',
        name: '游戏',
        keywords: ['steam', 'steampowered', 'epic', 'epicgames', 'uplay', 'uplay.com', 'origin', 'ea', 'ea.com', 'ubisoft', 'ubisoft.com', 'blizzard', '暴雪', '暴雪娱乐', 'battle.net', 'playstation', 'ps', 'psn', 'playstation.network', 'xbox', 'xbox.com', 'nintendo', '任天堂', 'switch', '3ds', 'wii', 'wiiu', '主机', '单机', '联机', '多人', 'multiplayer', '网游', '手游', '端游', '页游', 'mod', '模组', '游戏攻略', '游戏下载', '安装包', 'installer', 'patch', '补丁', 'dlc', '键鼠', '键盘', '手柄', 'controller', '外设', '配置', 'config', '帧数', 'fps', '帧率', '画质', '4k', '2k', '1080p', '720p', '游戏王', '游民星空', '3dmgame', '3dmgame.com', '游侠网', '游侠', 'gog', 'good', 'old', 'retro', '怀旧', '游戏模拟器', 'game模拟器', 'emulator', 'rom', 'iso', 'mod下载', 'game mod', 'gamepatch', 'gamedlc'],
        urlPatterns: ['^https?://(www\\.)?store\\.steampowered\\.com', '^https?://(www\\.)?steam\\.community\\.com', '^https?://(www\\.)?epicgames\\.com', '^https?://(www\\.)?uplay\\.ubi\\.com', '^https?://(www\\.)?origin\\.com', '^https?://(www\\.)?ea\\.com', '^https?://(www\\.)?ubisoft\\.com', '^https?://(www\\.)?battle\\.net', '^https?://(www\\.)?playstation\\.com', '^https?://(www\\.)?xbox\\.com', '^https?://(www\\.)?nintendo\\.com', '^https?://(www\\.)?3dmgame\\.com', '^https?://(www\\.)?gog\\.com'],
        targetFolder: '游戏'
      },
      {
        id: 'reading',
        name: '阅读',
        keywords: ['book', '书籍', 'book', 'novel', '小说', 'story', '故事', 'fiction', '非虚构', '纪实', '文学', 'literature', '阅读', 'read', 'kindle', 'kindle.amazon.cn', '微信读书', 'weread', 'weread.com', '得到', 'dedao', 'zhihu', '专栏', 'article', '文章', 'paper', '论文', 'essay', '随笔', '博客', 'blog', 'post', '帖子', 'magazine', '杂志', 'journal', '期刊', 'reader', '阅读器', 'zlibrary', 'zlib', '1lib', '1lib.sk', 'libgen', 'genlib', 'genlib.is', '豆瓣读书', 'douban', '豆瓣阅读', '起点', '起点中文网', 'qidian', '晋江', 'jjwxc', '纵横', 'zongheng', '17k', '17k.com', '飞卢', 'feilu.com', '小说阅读', 'read.qq.com', '读书', '电子书', 'ebook', 'epub', 'mobi', 'txt', 'pdf', 'txt'],
        urlPatterns: ['.*\\.(book|novel|kindle|weread|zhihu|douban|qidian|jjwxc|zongheng|17k|feilu)\\..*', '.*\\.(zlib|1lib|libgen|genlib)\\..*', '.*\\.(epub|mobi|pdf|txt)\\..*'],
        targetFolder: '阅读'
      },
      {
        id: 'design',
        name: '设计',
        keywords: ['design', '设计', 'ui', 'ux', '界面', '界面设计', '用户界面', '交互', '交互设计', 'figma', 'figma.com', 'sketch', 'sketch.com', 'adobe', 'adobe.com', 'ps', 'photoshop', 'illustrator', 'ai', 'art', 'artstation', 'artstation.com', 'dribbble', 'dribbble.com', 'behance', 'behance.net', 'zcool', '站酷', '站酷网', 'uicn', 'ui.cn', 'ui中国', 'ui\\..*\\.cn', 'huaban', '花瓣网', '花瓣网.com', '素材', 'material', '资源', 'resource', 'icon', '图标', 'font', '字体', 'font\\.', 'template', '模板', 'mockup', '原型', '样机', 'wireframe', '线框图', '设计灵感', 'inspiration', 'gallery', '画廊', 'showcase', '作品集', 'portfol', '作品', '作品集', 'behance', 'dribbble', '站酷', 'ui/ux', 'user', 'experience', 'usercentered', '以用户为中心', '用户体验', 'userinterface', 'user interface'],
        urlPatterns: ['.*\\.(figma|sketch|adobe|ps|ai|dribbble|behance|zcool|huaban|uicn)\\..*', '.*\\.(design|ux|ui|art|icon|font|template)\\..*'],
        targetFolder: '设计'
      },
      {
        id: 'ai',
        name: 'AI人工智能',
        keywords: ['ai', '人工智能', 'artificial', 'intelligence', 'gpt', 'chatgpt', 'openai', 'claude', 'gemini', 'gemini.google.com', '文心一言', 'ernie', '通义千问', 'kimi', 'moonshot', 'kimi.moonshot.cn', '智谱', 'chatglm', 'deepseek', '深度求索', '字节跳动', '豆包', 'doubao', 'doubao.com', 'coze', 'coze.com', 'cursor', 'cursor.sh', 'midjourney', 'midjourney.com', 'stable', 'diffusion', 'diffusion.ai', 'leonardo', 'leonardo.ai', 'flux', 'flux.ai', 'runway', 'runwayml', 'runway.ml', 'perplexity', 'perplexity.ai', 'copilot', 'copilot.microsoft.com', 'github.copilot', 'claude', 'claude.anthropic', 'huggingface', 'huggingface.co', 'modelscope', '魔搭', 'modelscope.cn', 'firecrawl', 'firecrawl.dev', 'a16z', 'a16z.in', 'mcp', 'model context protocol', '模型上下文协议', 'llm', 'large language model', '大语言模型', '机器人', 'robot', 'bot', 'agent', '智能体', '助手', 'assistant', '工具', 'tool', '开发', 'dev', 'developer', '编程', 'code', 'programming', 'prompt', '提示词', '提示工程', 'prompt engineering', 'rag', '检索增强生成', 'retrieval augmented generation', 'agent', 'agents', '多智能体', 'autonomous', '自主', 'workflows', '工作流', 'workflow', 'automation', '自动化', 'automation', 'auto', 'automate'],
        urlPatterns: ['.*\\.(chatgpt|claude|gemini|ernie|kimi|moonshot|perplexity|coze|cursor|midjourney|diffusion|leonardo|runway|flux|a16z|modelscope|firecrawl|huggingface)\\..*', '.*\\.(copilot|claude|openai|anthropic|google)\\..*'],
        targetFolder: 'AI人工智能'
      },
      {
        id: 'devops',
        name: '运维开发',
        keywords: ['devops', '运维', 'server', '服务器', 'linux', 'ubuntu', 'centos', 'debian', 'debian.org', 'windows', 'server', 'mac', 'macos', 'macos.com', 'docker', 'kubernetes', 'k8s', 'k8s.io', 'k8s.cn', 'nginx', 'apache', 'redis', 'mysql', 'postgresql', 'postgres', 'database', 'db', '部署', 'deploy', 'ci', 'cd', 'ci/cd', 'jenkins', 'gitlab', 'gitlab.com', 'github', 'github.com', 'actions', 'workflow', '工作流', 'pipeline', '管道', '容器', 'container', 'vm', 'virtual', 'virtual..', 'virtualbox', 'vmware', 'cloud', '云', 'cloud.baidu.com', 'aliyun', 'aliyun.com', 'tencent', 'tencent.com', '腾讯云', '华为云', 'aws', 'azure', 'gcp', 'oss', 'cdn', '对象存储', '负载均衡', 'load-?balance', '弹性伸缩', 'scaling', '监控', 'monitor', '告警', 'alert', '日志', 'log', 'elk', 'elastic', 'grafana', 'prometheus', 'ansible', 'saltstack', 'puppet', 'chef', 'terraform', 'infrastructure', '基础设施', '架构', 'architecture', '高可用', 'ha', '高可用架构', '分布式', 'distributed', '集群', 'cluster', '微服务', 'microservice', 'service', 'mesh', 'service-?mesh', 'istio', 'nginx', 'apache', 'redis', 'mysql', 'postgresql', 'git', 'gitlab', 'github', 'jenkins', 'docker', 'k8s', 'linux', 'windows', 'mac', 'shell', 'bash', 'powershell', 'command', 'cli', 'terminal', 'ssh', 'ssh.com', '远程', '连接', 'connection', 'vnc', 'rdp', 'teamviewer', 'teamviewer.com', '向日葵', '花生壳', 'frp', '内网穿透', '端口映射', 'port-?mapping', 'ddns', '动态dns', '域名', 'domain', '解析', 'resolve', 'dns', 'ip', '地址', 'addr', '局域网', 'lan', '广域网', 'wan', '外网', '公网', 'vpn', '代理', 'proxy', '节点', 'node', 'pod', '容器化', '容器', 'vm', '虚拟机', '虚拟化', '云服务', '云平台', '平台', '架构', '架构设计', '部署', '监控', '告警', '备份', 'backup', '容灾', 'dr', '灾难恢复', 'sla', 'sla服务等级协议', '99\\.999%'],
        urlPatterns: ['.*\\.(devops|docker|k8s|jenkins|gitlab|ansible|terraform|cloud|aliyun|tencent|aws|azure|gcp|ssh|vnc|teamviewer)\\..*', '.*\\.(vm|virtualbox|cloud|oss|cdn|ssh)\\..*'],
        targetFolder: '运维开发'
      },
      {
        id: 'life',
        name: '生活',
        keywords: ['life', '生活', 'living', 'daily', '日常', '美食', 'food', '美食', '食谱', 'recipe', 'cook', '烹饪', '菜谱', '下厨房', '下厨房.com', '食谱', 'recipe.com', '食谱大全', '美食杰', '美食杰.com', '下厨房', '下厨房.com', '下厨房美食杰', '美团', 'meituan', 'meituan.com', '大众点评', 'dianping', 'dianping.com', '大众点评网', '饿了么', 'eleme', 'eleme.meituan.com', '美团外卖', '外卖', '配送', 'delivery', '快递', 'express', '顺丰', 'sf', 'sf.com', '申通', 'sto', 'sto.cn', '圆通', 'yt', 'yt.com', '中通', 'zto', 'zto.com', '韵达', 'yunda', 'yunda.com', '德邦', 'deppon', 'deppon.com', '京东', 'jd', 'jd.com', '淘宝', 'taobao', '拼多多', 'pinduoduo', '购物', 'shop', 'mall', '商城', '超市', 'supermarket', '超市', '出行', 'travel', '携程', 'ctrip', 'ctrip.com', '去哪儿', 'qunar', 'qunar.com', '飞猪', 'fliggy', 'fliggy.com', '同程', 'ly.com', '途牛', 'tuniu.com', '马蜂窝', 'mafengwo.com', '高德', 'amap', 'amap.com', '百度地图', 'map.baidu.com', '滴滴', 'didi', 'didi.com', '快的', 'kuaidi', 'kuaidi.com', '高德打车', 'amap.cn', '导航', 'nav', 'navi', '导航犬', 'navigu', '导航犬..*', '酒店', 'hotel', '民宿', 'homestay', 'airbnb', 'airbnb.com', '小猪民宿', 'xiaozhu', 'xiaozhu.com', '途家', 'tujia', 'tujia.com', '爱彼迎', 'abbbin', 'abbbin.com', '美团民宿', 'meituan.meituan.com', '同城', '58', '58.com', '赶集网', 'ganji.com', '租房', 'rent', '链家', 'lianjia', 'lianjia.com', '安居客', 'anjuke', 'anjuke.com', '自如', 'ziroom', 'ziroom.com', '贝壳', 'beike.com', '房产', 'real', 'estate', '房子', '房源', '装修', 'decoration', 'decoration.com', '好好住', 'haohaozhu', '小红书', 'xiaohongshu', 'xiaohongshu.com', '什么值得买', 'smzdm', 'smzdm.com', '值得买', '值得买.com', '京东', 'jd', 'jd.com', '拼多多', 'pinduoduo', '淘宝', 'taobao', '购物', 'shop', 'mall', '优惠', 'coupon', '折扣', '促销', '秒杀', '团购', '特卖', '京东优惠券', '京东优惠券券', '优惠券', '红包', 'redpacket', '红包', '积分', 'points', '会员', 'vip', '会员卡', '会员价', '折扣卡', '折扣券', '满减', '满', '满减', '满额', '满额满减', '折扣券', '满减券', '优惠卷', '满减券', '省钱', '省钱攻略', '好价', '好价推荐', '值买', '物美价廉', '性价比', 'cp', '高性价比', '值得买', '好价网', '什么值得买', '值得买.com', '京东优惠', '京东优惠', '京东折扣', '拼多多', '多多', '拼多多优惠', '多多返利', '多多进宝', '多多果园', '多多果园.(com|cn)', '多多果园大额优惠券', '拼多多百亿补贴', '拼多多百亿补贴.(com|cn)', '拼多多.(com|cn)', '京东.(com|cn)'],
        urlPatterns: ['.*\\.(ctrip|qunar|fliggy|tuniu|abbbin|xiaozhu|haohaozhu|smzdm|jd|taobao|pinduoduo)\\..*', '.*\\.(hotel|airbnb|rent|ziroom|anjuke|beike|lianjia|58)\\..*', '.*\\.(dianping|meituan|eleme|didi|kuaidi|amap)\\..*'],
        targetFolder: '生活'
      },
      {
        id: 'security',
        name: '安全',
        keywords: ['security', '安全', 'safe', 'hacker', '黑客', 'cracker', 'pentest', 'penetration', '渗透', '测试', 'vulnerability', '漏洞', 'vuln', '0day', '零日', 'cve', 'exploit', '漏洞利用', 'exploitation', 'payload', 'code', '代码', 'shellcode', '免杀', 'bypass', '绕过', 'waf', '防火墙', 'firewall', 'ids', 'ips', 'ips', 'ips-?ids', 'ddos', 'ddos', 'dos', '攻击', 'attack', 'defense', '防御', 'protect', '保护', 'guard', 'guard-?360', '360', '安全大脑', 'ti.360.cn', '360安全', '腾讯御安全', '御安全', '腾讯电脑管家', '电脑管家', '金山毒霸', '火绒', '火绒安全', '火绒杀毒', '卡巴斯基', 'kaspersky', '诺顿', 'norton', '迈克菲', 'mcafee', '趋势', 'trend', 'av', '杀毒软件', '杀软', '杀毒', '杀毒软件下载', '杀毒软件哪个好', '杀毒软件免费', '免费杀毒', '免费杀毒软件', '杀毒软件推荐', '杀毒软件排行', '杀毒软件排名', '杀毒软件下载', '杀毒软件免费版', '杀毒软件大全', '杀毒软件', '杀软', '毒霸', '病毒', 'virus', 'malware', '木马', 'trojan', 'backdoor', '后门', 'rootkit', 'keylogger', '间谍', 'spyware', 'ransomware', '勒索', '勒索软件', '勒索病毒', 'ransomware-?(decrypt|decryptor|解密', '解密软件', '解密工具', '解密软件推荐', '解密软件哪个好', '解密软件免费', '免费解密软件', 'ctf', 'ctfhub', 'buu', 'buuoj', 'vulnhub', 'vulnhub.org', '漏洞库', 'vuln\\?db', '漏洞数据库', '安全脉搏', 'secpulse.com', 'freebuf', 'freebuf.com', '安全牛', 'aqniu.com', '华盟网', '77169', '77169.net', 't00ls', 't00ls.net', '红日安全', 'redqueen', '红日安全靶场', '红日安全靶场集合', 'vulnstack', 'vulnstack.qiyuanxuetang.net', 'vulfocus.pro\\?', 'hack', 'hack', '黑客', 'hacker-?one', 'hackinthebox', '黑客盒子', '盒子安全', '盒子安全平台', '盒子安全论坛', '盒子安全社区', '盒子安全知识库', '漏洞盒子', '漏洞盒子-?db', '漏洞盒子数据库', '安全盒子', '盒子安全-?wiki', '知识库', '文库', 'wiki', '知识库-?wiki', '知识库-?wiki\\?\\?\\/|/\\?/wiki', 'wiki-?db|wiki-?wiki-?\\?\\/|/\\?/wiki\\?\\?\\?\\/[^/]+/wiki-?wiki\\?\\?\\?\\/[^/]+/wiki/[^/]+/\\?', 'wiki-?wiki', '知识文库', '资料文库', '文库', '文库-?\\?', '知识库-?\\?', '漏洞库', '漏洞数据库', '漏洞库管理系统', '漏洞管理', 'vuln', '漏洞扫描', 'scan', '扫描', '端口', 'port', 'ip', 'host', 'host', '域名', 'domain', 'subdomain', '子域名', '子域名解析', '域名解析', 'dns', '解析', 'resolve', 'whois', '反向', 'trace', 'traceroute', '路由', '路由追踪', 'ping', '网络', 'network', '网络安全', 'cyber', '信息泄露', '数据泄露', '隐私保护', 'data-?breach', 'haveibeenpwned', 'mozilla', 'monitor', 'leak', 'dehashed', 'snusbase', 'osint', '开源情报', '情报', '情报分析', '威胁情报', '威胁', 'threat', '情报', '恶意软件', 'malware', '病毒', 'virus', '木马', 'trojan', '后门', 'backdoor', 'rootkit', 'keylogger', '提权', '权限提升', 'privilege', 'escalation', '横向移动', '横向', '渗透', 'exploit', '0day', '零日', '利用', '利用代码', 'payload', '利用工具', '自动化', '自动化工具', '框架', '库', '库文件', '源代码', '源码', '代码', 'open-?source', '开源', '免费', '免费资源', '免费', '免费下载', '免费工具', '免费工具箱', '在线工具', '工具', '工具大全', '工具合集', '工具集', '导航', '导航网站', '资源导航', '导航网', '资源导航网站', '导航网站大全', '导航网站大全', '导航', 'nav', '导航犬', '导航-?dog', '导航猫', '导航-?cat', '导航狗', '导航猫-?\\.', '好价网', '好价推荐', '好价', '性价比', '值得买', '什么值得买', '值得买.com', '京东优惠', '京东优惠券', '京东折扣', '拼多多优惠', '多多返利', '拼多多百亿补贴', '拼多多优惠券'],
        urlPatterns: ['.*\\.(360|qihoo|kaspersky|norton|mcafee|trend|av|antivirus|malware|vuln|hub|vulnstack|vulfocus|ctfhub|buuoj|wgpsec|t00ls|hackinthebox|box-?security)\\..*', '.*\\.(freebuf|aqniu|77169|t00ls|redqueen|0-?zone)\\..*', '.*\\.(dehashed|snusbase|haveibeenpwned|osint|0-?zone)\\..*'],
        targetFolder: '安全'
      },
      {
        id: 'other',
        name: '其他',
        keywords: ['other', '其他', '杂项', 'misc', 'test', 'demo', 'example', 'sample', '实验', '测试', '示例', '演示', '样板', '模板', 'template', 'example', 'sample', 'demo', 'test'],
        urlPatterns: [],
        targetFolder: '其他'
      }
    ];

    return this.categorizeBookmarks(bookmarks, defaultRules);
  }

  mergeBookmarks(source: BookmarkNode[], target: BookmarkNode[], strategy: 'replace' | 'merge' | 'skip'): BookmarkNode[] {
    if (strategy === 'replace') {
      return [...source];
    }

    if (strategy === 'skip') {
      return [...target];
    }

    const targetMap = new Map<string, BookmarkNode>();

    const addToMap = (node: BookmarkNode): void => {
      if (node.url) {
        const normalizedUrl = this.normalizeUrl(node.url);
        targetMap.set(normalizedUrl, node);
      }
      node.children?.forEach(addToMap);
    };

    target.forEach(addToMap);

    const merged: BookmarkNode[] = [];
    const processed = new Set<string>();

    const processSource = (node: BookmarkNode): void => {
      if (node.url) {
        const normalizedUrl = this.normalizeUrl(node.url);
        if (!processed.has(normalizedUrl)) {
          if (!targetMap.has(normalizedUrl)) {
            merged.push(node);
          }
          processed.add(normalizedUrl);
        }
      }
      node.children?.forEach(processSource);
    };

    source.forEach(processSource);
    merged.push(...target);

    return merged;
  }

  organizeByFolder(bookmarks: BookmarkNode[]): Map<string, BookmarkNode[]> {
    const folderMap = new Map<string, BookmarkNode[]>();

    const processNode = (node: BookmarkNode, folderPath: string = '根目录'): void => {
      if (node.url) {
        if (!folderMap.has(folderPath)) {
          folderMap.set(folderPath, []);
        }
        folderMap.get(folderPath)!.push(node);
      } else if (node.children) {
        const newFolderPath = `${folderPath}/${node.title}`;
        node.children.forEach(child => processNode(child, newFolderPath));
      }
    };

    bookmarks.forEach(node => processNode(node));

    return folderMap;
  }

  searchBookmarks(bookmarks: BookmarkNode[], query: string, options: { searchTitle: boolean; searchUrl: boolean; searchTags: boolean }): BookmarkNode[] {
    const results: BookmarkNode[] = [];
    const lowerQuery = query.toLowerCase();

    const searchNode = (node: BookmarkNode): void => {
      let matches = false;

      if (options.searchTitle && node.title.toLowerCase().includes(lowerQuery)) {
        matches = true;
      }

      if (!matches && options.searchUrl && node.url && node.url.toLowerCase().includes(lowerQuery)) {
        matches = true;
      }

      if (!matches && options.searchTags && node.tags && node.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        matches = true;
      }

      if (matches) {
        results.push(node);
      }

      node.children?.forEach(searchNode);
    };

    bookmarks.forEach(searchNode);

    return results;
  }

  /**
   * 智能分类书签 - 基于标题、URL和内容
   */
  async smartCategorize(bookmarks: BookmarkNode[]): Promise<Map<string, BookmarkNode[]>> {
    // 先使用现有规则进行初步分类
    const categorized = this.autoCategorize(bookmarks);
    
    // 对于未分类的书签，尝试通过 URL 和内容进一步分类
    const uncategorized: BookmarkNode[] = [];
    
    const collectUncategorized = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        if (node.url && !this.isInAnyCategory(node, categorized)) {
          uncategorized.push(node);
        }
        if (node.children && node.children.length > 0) {
          collectUncategorized(node.children);
        }
      };
    };
    
    collectUncategorized(bookmarks);
    
    // 对未分类的书签进行深度分析
    for (const bookmark of uncategorized) {
      const category = await this.analyzeBookmark(bookmark);
      if (category) {
        if (!categorized.has(category)) {
          categorized.set(category, []);
        }
        categorized.get(category)!.push(bookmark);
      }
    }

    return categorized;
  }

  /**
   * 分析单个书签，返回最佳匹配的分类
   * 基于网站的实际内容和介绍进行智能分类
   */
  private async analyzeBookmark(bookmark: BookmarkNode): Promise<string | null> {
    const { title, url } = bookmark;
    const textToAnalyze = `${title} ${url || ''}`;
    
    // 分析 URL 域名 - 这是最准确的分类依据
    if (url) {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      
      // 域名到分类的精确映射
      const domainCategoryMap: Record<string, string> = {
        // 社交媒体
        'bilibili.com': '视频',
        'youtube.com': '视频',
        'weibo.com': '社交媒体',
        'weibo.cn': '社交媒体',
        'qq.com': '社交媒体',
        'zhihu.com': '社交媒体',
        'douban.com': '社交媒体',
        'tieba.baidu.com': '社交媒体',
        't.sina.com.cn': '社交媒体',
        'x.com': '社交媒体',
        'twitter.com': '社交媒体',
        'facebook.com': '社交媒体',
        'instagram.com': '社交媒体',
        'linkedin.com': '社交媒体',
        'tiktok.com': '社交媒体',
        'douyin.com': '视频',
        'kuaishou.com': '视频',
        'telegram.org': '社交媒体',
        'discord.com': '社交媒体',
        
        // 技术开发
        'github.com': '技术开发',
        'gitlab.com': '技术开发',
        'gitee.com': '技术开发',
        'stackoverflow.com': '技术开发',
        'csdn.net': '技术开发',
        'juejin.cn': '技术开发',
        'segmentfault.com': '技术开发',
        'v2ex.com': '技术开发',
        'npmjs.com': '技术开发',
        'yarnpkg.com': '技术开发',
        'pypi.org': '技术开发',
        'maven.org': '技术开发',
        'maven.apache.org': '技术开发',
        'docker.com': '技术开发',
        'kubernetes.io': '技术开发',
        'redis.io': '技术开发',
        'nginx.org': '技术开发',
        'nodejs.org': '技术开发',
        'developer.mozilla.org': '技术开发',
        'w3.org': '技术开发',
        'w3schools.com': '技术开发',
        'caniuse.com': '技术开发',
        'css-tricks.com': '技术开发',
        'dev.to': '技术开发',
        'codepen.io': '技术开发',
        'jsfiddle.net': '技术开发',
        
        // 新闻资讯
        'sina.com.cn': '新闻资讯',
        'sohu.com': '新闻资讯',
        'ifeng.com': '新闻资讯',
        'people.com.cn': '新闻资讯',
        'xinhuanet.com': '新闻资讯',
        'cctv.com': '新闻资讯',
        'thepaper.cn': '新闻资讯',
        'guancha.cn': '新闻资讯',
        'zaobao.com': '新闻资讯',
        'bbc.com': '新闻资讯',
        'cnn.com': '新闻资讯',
        'reuters.com': '新闻资讯',
        'nytimes.com': '新闻资讯',
        
        // 购物
        'taobao.com': '购物',
        'tmall.com': '购物',
        'jd.com': '购物',
        'pinduoduo.com': '购物',
        'amazon.com': '购物',
        'amazon.cn': '购物',
        'ebay.com': '购物',
        'smzdm.com': '购物',
        
        // 搜索引擎
        'baidu.com': '搜索引擎',
        'google.com': '搜索引擎',
        'bing.com': '搜索引擎',
        'sogou.com': '搜索引擎',
        '360.cn': '搜索引擎',
        'so.com': '搜索引擎',
        
        // 邮箱
        'mail.qq.com': '邮箱',
        '163.com': '邮箱',
        '126.com': '邮箱',
        'outlook.com': '邮箱',
        'hotmail.com': '邮箱',
        'gmail.com': '邮箱',
        'live.com': '邮箱',
        
        // AI人工智能
        'chatgpt.com': 'AI人工智能',
        'openai.com': 'AI人工智能',
        'claude.ai': 'AI人工智能',
        'gemini.google.com': 'AI人工智能',
        'kimi.moonshot.cn': 'AI人工智能',
        'perplexity.ai': 'AI人工智能',
        'midjourney.com': 'AI人工智能',
        'cursor.sh': 'AI人工智能',
        'huggingface.co': 'AI人工智能',
        'modelscope.cn': 'AI人工智能',
        
        // 设计
        'figma.com': '设计',
        'sketch.com': '设计',
        'dribbble.com': '设计',
        'behance.net': '设计',
        'zcool.com': '设计',
        'huaban.com': '设计',
        
        // 音乐
        'music.163.com': '音乐',
        'y.qq.com': '音乐',
        'kugou.com': '音乐',
        'kuwo.cn': '音乐',
        'spotify.com': '音乐',
        
        // 工作/办公
        'feishu.cn': '工作',
        'dingtalk.com': '工作',
        'docs.qq.com': '工作',
        'notion.so': '工作',
        'yuque.com': '工作',
        'shimo.im': '工作',
        
        // 教育
        'icourse163.org': '教育',
        'xuetangx.com': '教育',
        'coursera.org': '教育',
        'udemy.com': '教育',
        
        // 金融财经
        'xueqiu.com': '金融财经',
        'eastmoney.com': '金融财经',
        'stockstar.com': '金融财经',
        'jrj.com.cn': '金融财经',
        
        // 阅读相关
        'weread.qq.com': '阅读',
        'qidian.com': '阅读',
        'jjwxc.net': '阅读',
        
        // 安全
        'freebuf.com': '安全',
        'aqniu.com': '安全',
        't00ls.net': '安全'
      };
      
      // 检查精确域名匹配
      if (domainCategoryMap[domain]) {
        return domainCategoryMap[domain];
      }
      
      // 检查域名部分匹配
      for (const [domainPattern, category] of Object.entries(domainCategoryMap)) {
        if (domain.includes(domainPattern) || domainPattern.includes(domain)) {
          return category;
        }
      }
    }
    
    // 分析标题 - 基于实际内容的关键词匹配
    const titleLower = title.toLowerCase();
    
    // 定义更精确的标题关键词映射
    const titleKeywords: Record<string, { keywords: string[], category: string }> = {
      '技术开发': {
        keywords: ['开发', '编程', '代码', 'github', 'gitlab', 'stack overflow', 'csdn', '掘金', 'segmentfault', 'v2ex', 'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'vue', 'react', 'angular', 'node', 'npm', 'docker', 'kubernetes', 'api', '接口', '文档', 'doc', 'developer', '程序员', '码', '算法', 'algorithm', '数据结构', 'database', '数据库', 'sql', 'nosql'],
        category: '技术开发'
      },
      '视频': {
        keywords: ['bilibili', 'youtube', 'youku', 'iqiyi', '腾讯视频', '芒果tv', '优酷', 'douyin', 'kuaishou', '抖音', 'tiktok', '视频', 'video', '电影', 'movie', '电视剧', '综艺', '纪录片', '动漫', '动画', '剧集', '番剧', '播放器', 'player', '观看', '看', '直播', 'live', 'stream'],
        category: '视频'
      },
      '音乐': {
        keywords: ['music', '网易云音乐', 'qq音乐', 'kugou', 'kuwo', '酷狗', '千千音乐', '酷我', '虾米', '喜马拉雅', 'ximalaya', 'fm', '电台', '播客', 'podcast', 'song', '音乐', 'album', '专辑', 'artist', '歌手', '播放', 'play', '听', '听歌', '下载', 'download', 'mv', '演唱会', 'concert', 'livehouse', '现场', '现场演出'],
        category: '音乐'
      },
      '购物': {
        keywords: ['淘宝', 'taobao', '天猫', 'tmall', '京东', 'jd', '拼多多', 'pinduoduo', 'amazon', '亚马逊', '购物', 'shop', 'mall', '商城', 'buy', 'pay', 'price', '订单', 'cart', '优惠', 'coupon', '折扣', '促销', '秒杀', '团购', '特卖', '京东优惠券', '红包', '积分', '省钱', '好价', '值得买', 'smzdm'],
        category: '购物'
      },
      '新闻资讯': {
        keywords: ['新闻', 'news', '资讯', '头条', '日报', 'sina', '163', 'sohu', 'ifeng', 'people', 'thepaper', 'guancha', 'zaobao', 'cctv', 'xinhua', 'xinhuanet', 'bbc', 'cnn', 'reuters', 'ap', '报道', 'article', '时事', '时政'],
        category: '新闻资讯'
      },
      '社交媒体': {
        keywords: ['微博', '微信', 'qq', 'qzone', 'facebook', 'twitter', 'x.com', 'instagram', 'linkedin', 'tiktok', 'douyin', '快手', 'kuaishou', 'telegram', 'discord', 'bilibili', '知乎', 'zhihu', '豆瓣', 'douban', '贴吧', 'tieba', '掘金', 'juejin', 'v2ex', 'csdn', 'segmentfault', '社交', 'social', '社区', 'community'],
        category: '社交媒体'
      },
      '工具': {
        keywords: ['tool', '工具', 'toolbox', '工具箱', 'converter', '转换', 'translate', '翻译', 'fanyi', '百度翻译', 'deepl', '有道', 'youdao', 'calculator', '计算器', 'calc', 'json', 'xml', 'yaml', 'regex', '正则', 'encode', 'decode', '编码', '解码', 'base64', 'hash', 'md5', 'sha', '加密', 'encrypt', '解密', 'decrypt', 'crack', '破解', 'generator', '生成器', 'compress', '压缩', 'zip', 'rar', '7z', 'pdf', '编辑', 'edit', 'converter', '格式化', 'format', 'ocr', '识别', 'scan', '扫描', 'test', 'benchmark', 'speed', 'ping', 'traceroute', 'whois', 'dns', 'ip', 'lookup', '查询', 'search', 'searchengine', '搜索引擎', 'google', 'baidu', 'bing', 'sogou', '360', '杀毒', 'virus', 'malware', '安全', 'security', 'proxy', 'vpn'],
        category: '工具'
      },
      '工作': {
        keywords: ['work', '工作', 'office', 'office.com', '文档', 'document', 'doc', 'docs', 'docs.com', 'wps', 'wps.cn', '飞书', 'feishu', 'feishu.cn', '钉钉', 'dingtalk', 'dingtalk.com', '企业微信', 'work.weixin', '腾讯文档', 'docs.qq.com', '石墨', 'shimo.im', '石墨文档', '语雀', 'yuque', 'yuque.com', 'notion', 'notion.so', '飞书文档', '云文档', '云笔记', 'note', 'onenote', 'evernote', '印象笔记', '有道云笔记', '有道', 'youdao', 'youdao.cn', '邮箱', 'email', 'mail', 'qq.com', 'outlook', '163', '126.com', 'gmail', 'gmail.com', 'outlook.com', 'calendar', '日历', '日程', 'schedule', '腾讯日历', '腾讯会议', 'meeting', '会议', 'zoom', 'zoom.us', 'teams', 'teams.microsoft.com', '钉钉会议', '飞书会议', 'teambition', '协同', 'collaboration', '协作', 'team', '团队', '群组', 'group'],
        category: '工作'
      },
      '教育': {
        keywords: ['edu', 'education', 'course', '课程', '学习', 'learn', '教程', 'tutorial', 'mooc', '慕课', 'coursera', 'coursera.org', 'udemy', 'udemy.com', '学堂', '学堂在线', '网易课堂', 'icourse163', 'xuetangx', '学堂在线xuetangx', '中国大学mooc', 'icourse163.org', 'school', '学校', 'university', '大学', 'college', '考试', 'exam', '考研', 'kaoyan', '考公', 'kaogong', '题库', 'question', 'practice', '练习', '培训', 'training', '教学', 'teaching', '讲师', 'teacher', '教授', 'professor', '课件', 'courseware', '资料', 'material', '论文', 'paper', '文献', 'literature', '期刊', 'journal', '杂志', 'research', '研究', '学位', 'degree', '毕业论文', 'thesis', '毕设', 'project', '作业', 'homework'],
        category: '教育'
      },
      '阅读': {
        keywords: ['book', '书籍', 'novel', '小说', 'story', '故事', 'fiction', '非虚构', '纪实', '文学', 'literature', '阅读', 'read', 'kindle', 'kindle.amazon.cn', '微信读书', 'weread', 'weread.com', '得到', 'dedao', '专栏', 'article', '文章', 'paper', '论文', 'essay', '随笔', '博客', 'blog', 'post', '帖子', 'magazine', '杂志', 'journal', '期刊', 'reader', '阅读器', 'zlibrary', 'zlib', '1lib', '1lib.sk', 'libgen', 'genlib', 'genlib.is', '豆瓣读书', 'douban', '豆瓣阅读', '起点', '起点中文网', 'qidian', '晋江', 'jjwxc', '纵横', 'zongheng', '17k', '17k.com', '飞卢', 'feilu.com', '小说阅读', 'read.qq.com', '读书', '电子书', 'ebook', 'epub', 'mobi', 'txt', 'pdf'],
        category: '阅读'
      },
      '设计': {
        keywords: ['design', '设计', 'ui', 'ux', '界面', '界面设计', '用户界面', '交互', '交互设计', 'figma', 'figma.com', 'sketch', 'sketch.com', 'adobe', 'adobe.com', 'ps', 'photoshop', 'illustrator', 'ai', 'art', 'artstation', 'artstation.com', 'dribbble', 'dribbble.com', 'behance', 'behance.net', 'zcool', '站酷', '站酷网', 'uicn', 'ui.cn', 'ui中国', 'huaban', '花瓣网', '素材', 'material', '资源', 'resource', 'icon', '图标', 'font', '字体', 'template', '模板', 'mockup', '原型', '样机', 'wireframe', '线框图', '设计灵感', 'inspiration', 'gallery', '画廊', 'showcase', '作品集', 'portfol', '作品'],
        category: '设计'
      },
      '金融财经': {
        keywords: ['股票', 'stock', '股市', '基金', 'fund', '理财', 'finance', 'bank', '银行', '证券', 'securities', '期货', 'futures', '外汇', 'forex', '黄金', 'gold', '保险', 'insurance', '信用卡', 'credit', 'loan', '贷款', '借钱', '支付宝', 'alipay', '余额宝', '财富', '财付通', 'tenpay', '微信支付', '蚂蚁财富', 'ant', '蚂蚁集团', '京东金融', 'jd.jr', '度小满', '有钱花', '借呗', '花呗', '京东白条', '白条', '招联', '招商', '民生', '工商', '建设', '银行', 'card', '卡', '卡债', '负债', '投资', 'invest', '收益', 'profit', '利率', 'rate', '利息', '央行', 'pbc', '美联储', 'fed', '汇率', 'exchange', 'cny', 'rmb', '美元', 'usd', '欧元', 'eur', '日元', 'jpy', '英镑', 'gbp', '比特币', 'btc', 'ethereum', 'eth', '币', '币圈', '加密货币', 'cryptocurrency', '区块链', 'blockchain', 'nft'],
        category: '金融财经'
      },
      '游戏': {
        keywords: ['game', '游戏', 'play', '玩', 'steam', 'steampowered', 'epic', 'epicgames', 'uplay', 'uplay.com', 'origin', 'ea', 'ea.com', 'ubisoft', 'ubisoft.com', 'blizzard', '暴雪', '暴雪娱乐', 'battle.net', 'playstation', 'ps', 'psn', 'playstation.network', 'xbox', 'xbox.com', 'nintendo', '任天堂', 'switch', '3ds', 'wii', 'wiiu', 'pc', '主机', '单机', '联机', '多人', 'multiplayer', 'online', '网游', '网络游戏', '手游', '手机游戏', '手游', '端游', '页游', '网页游戏', 'flash', 'unity', 'unreal', 'engine', '引擎', 'mod', '模组', '攻略', 'guide', 'wiki', '百科', '下载', 'download', '安装包', 'installer', 'patch', '补丁', 'dlc', '键鼠', '键盘', '手柄', 'controller', '外设', '硬件', 'hardware', '显卡', 'gpu', 'nvidia', 'amd', 'intel', 'cpu', '主板', '内存', 'ram', 'ssd', '硬盘', '配置', 'config', '跑分', 'benchmark', '帧数', 'fps', '帧率', '画质', '质量', '分辨率', 'resolution', '4k', '2k', '1080p', '720p', '游戏王', '游民星空', '3dmgame', '游侠网', '游侠', 'gog', 'good', 'old', 'retro', '怀旧', '模拟器', 'emulator', 'rom', 'iso'],
        category: '游戏'
      },
      '生活': {
        keywords: ['life', '生活', 'living', 'daily', '日常', '美食', 'food', '美食', '食谱', 'recipe', 'cook', '烹饪', '菜谱', '下厨房', '食谱大全', '美食杰', '美团', 'meituan', '大众点评', 'dianping', '饿了么', 'eleme', '外卖', '配送', 'delivery', '快递', 'express', '顺丰', 'sf', '申通', 'sto', '圆通', 'yt', '中通', 'zto', '韵达', 'yunda', '德邦', 'deppon', '出行', 'travel', '携程', 'ctrip', '去哪儿', 'qunar', '飞猪', 'fliggy', '同程', '途牛', 'tuniu', '马蜂窝', 'mafengwo', '高德', 'amap', '百度地图', 'map.baidu.com', '滴滴', 'didi', '快的', 'kuaidi', '高德打车', '导航', 'nav', 'navi', '酒店', 'hotel', '民宿', 'homestay', 'airbnb', 'airbnb.com', '小猪民宿', 'xiaozhu', '途家', 'tujia', '爱彼迎', 'abbbin', '美团民宿', '同城', '58', '租房', 'rent', '链家', 'lianjia', '安居客', 'anjuke', '自如', 'ziroom', '贝壳', 'beike.com', '房产', 'real', 'estate', '房子', '房源', '装修', 'decoration', '好好住', 'haohaozhu', '小红书', 'xiaohongshu', '什么值得买', 'smzdm', '值得买', '京东', 'jd', '拼多多', 'pinduoduo', '淘宝', 'taobao', '购物', 'shop', 'mall', '优惠', 'coupon', '折扣', '促销', '秒杀', '团购', '特卖', '京东优惠券', '优惠券', '红包', '红包', '积分', 'points', '会员', 'vip', '会员卡', '会员价', '折扣卡', '折扣券', '满减', '满', '满减', '满额', '满额满减', '折扣券', '满减券', '优惠卷', '满减券', '省钱', '省钱攻略', '好价', '好价推荐', '值买', '物美价廉', '性价比', 'cp', '高性价比', '值得买', '好价网', '什么值得买', '值得买.com', '京东优惠', '京东优惠', '京东折扣', '拼多多', '多多', '拼多多优惠', '多多返利', '多多进宝', '多多果园', '多多果园.com', '多多果园大额优惠券', '拼多多百亿补贴'],
        category: '生活'
      },
      '安全': {
        keywords: ['security', '安全', 'safe', 'hacker', '黑客', 'cracker', 'pentest', 'penetration', '渗透', '测试', 'vulnerability', '漏洞', 'vuln', '0day', '零日', 'cve', 'exploit', '漏洞利用', 'exploitation', 'payload', 'code', '代码', 'shellcode', '免杀', 'bypass', '绕过', 'waf', '防火墙', 'firewall', 'ids', 'ips', 'ddos', 'ddos', 'dos', '攻击', 'attack', 'defense', '防御', 'protect', '保护', 'guard', 'guard-?360', '360', '安全大脑', 'ti.360.cn', '360安全', '腾讯御安全', '御安全', '腾讯电脑管家', '电脑管家', '金山毒霸', '火绒', '火绒安全', '火绒杀毒', '卡巴斯基', 'kaspersky', '诺顿', 'norton', '迈克菲', 'mcafee', '趋势', 'trend', 'av', '杀毒软件', '杀软', '杀毒', '杀毒软件下载', '杀毒软件哪个好', '杀毒软件免费', '免费杀毒', '免费杀毒软件', '杀毒软件推荐', '杀毒软件排行', '杀毒软件排名', '杀毒软件下载', '杀毒软件免费版', '杀毒软件大全', '杀毒软件', '杀软', '毒霸', '病毒', 'virus', 'malware', '木马', 'trojan', 'backdoor', '后门', 'rootkit', 'keylogger', '间谍', 'spyware', 'ransomware', '勒索', '勒索软件', '勒索病毒', 'ransomware-?(decrypt|decryptor|解密', '解密软件', '解密工具', '解密软件推荐', '解密软件哪个好', '解密软件免费', '免费解密软件', 'ctf', 'ctfhub', 'buu', 'buuoj', 'vulnhub', 'vulnhub.org', '漏洞库', 'vuln\\?db', '漏洞数据库', '安全脉搏', 'secpulse.com', 'freebuf', 'freebuf.com', '安全牛', 'aqniu.com', '华盟网', '77169', '77169.net', 't00ls', 't00ls.net', '红日安全', 'redqueen', '红日安全靶场', '红日安全靶场集合', 'vulnstack', 'vulnstack.qiyuanxuetang.net', 'vulfocus.pro\\?', 'hack', 'hack', '黑客', 'hacker-?one', 'hackinthebox', '黑客盒子', '盒子安全', '盒子安全平台', '盒子安全论坛', '盒子安全社区', '盒子安全知识库', '漏洞盒子', '漏洞盒子-?db', '漏洞盒子数据库', '安全盒子', '盒子安全-?wiki', '知识库', '文库', 'wiki', '知识库-?wiki', '知识库-?wiki\\?\\?\\/|/\\?/wiki', 'wiki-?db|wiki-?wiki-?\\?\\/|/\\?/wiki\\?\\?\\?\\/[^/]+/wiki-?wiki\\?\\?\\?\\/[^/]+/wiki/[^/]+/\\?', 'wiki-?wiki', '知识文库', '资料文库', '文库', '文库-?\\?', '知识库-?\\?', '漏洞库', '漏洞数据库', '漏洞库管理系统', '漏洞管理', 'vuln', '漏洞扫描', 'scan', '扫描', '端口', 'port', 'ip', 'host', 'host', '域名', 'domain', 'subdomain', '子域名', '子域名解析', '域名解析', 'dns', '解析', 'resolve', 'whois', '反向', 'trace', 'traceroute', '路由', '路由追踪', 'ping', '网络', 'network', '网络安全', 'cyber', '信息泄露', '数据泄露', '隐私保护', 'data-?breach', 'haveibeenpwned'],
        category: '安全'
      }
    };
    
    // 遍历所有分类，查找匹配的关键词
    for (const [categoryName, { keywords, category }] of Object.entries(titleKeywords)) {
      for (const keyword of keywords) {
        if (titleLower.includes(keyword.toLowerCase())) {
          return category;
        }
      }
    }
    
    // 如果以上方法都无法分类，尝试获取网页内容进行进一步分析
    if (url) {
      const content = await this.getBookmarkContent(url);
      if (content) {
        const contentLower = content.toLowerCase();
        
        // 基于网页内容的关键词匹配
        for (const [categoryName, { keywords, category }] of Object.entries(titleKeywords)) {
          for (const keyword of keywords) {
            if (contentLower.includes(keyword.toLowerCase())) {
              return category;
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * 获取书签网页内容
   */
  async getBookmarkContent(url: string): Promise<string> {
    // 检查缓存
    if (this.contentCache.has(url)) {
      return this.contentCache.get(url)!;
    }

    try {
      // 使用 Fetch API 获取网页内容
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      });
      
      const html = await response.text();
      
      // 提取主要内容（移除脚本、样式等）
      const cleanContent = html
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 5000); // 限制长度
      
      this.contentCache.set(url, cleanContent);
      return cleanContent;
    } catch (error) {
      console.warn('获取书签内容失败:', url, error);
      return '';
    }
  }

  /**
   * 检查书签是否已经在某个分类中
   */
  private isInAnyCategory(bookmark: BookmarkNode, categorized: Map<string, BookmarkNode[]>): boolean {
    const url = bookmark.url;
    
    for (const [folderName, bookmarks] of categorized) {
      if (bookmarks.some(b => b.url === url)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 查找最相似的文件夹
   */
  findMostSimilarFolder(bookmark: BookmarkNode, existingFolders: Map<string, string>): { folderId: string; folderName: string; score: number } | null {
    const { title, url } = bookmark;
    let bestMatch: { folderId: string; folderName: string; score: number } | null = null;
    let maxScore = 0;

    for (const [folderId, folderName] of existingFolders.entries()) {
      let score = 0;
      
      // 检查标题相似度
      const titleLower = title.toLowerCase();
      const folderNameLower = folderName.toLowerCase();
      if (folderNameLower.includes(titleLower) || titleLower.includes(folderNameLower)) {
        score += 0.5;
      }
      
      // 检查 URL 相似度
      if (url) {
        const urlLower = url.toLowerCase();
        if (folderNameLower.includes(url.replace(/https?:\/\/|\\./g, ''))) {
          score += 0.3;
        }
      }
      
      if (score > maxScore && score > 0.3) {
        maxScore = score;
        bestMatch = { folderId, folderName, score };
      }
    }

    return bestMatch;
  }

  /**
   * 整理书签 - 将书签移动到合适的文件夹
   */
  async organizeBookmarks(bookmarks: BookmarkNode[]): Promise<{
    organized: Map<string, string[]>;
    createdFolders: string[];
    movedBookmarks: string[];
  }> {
    const existingFolders = await this.getExistingFolders();
    const categorized = await this.smartCategorize(bookmarks);
    
    const organized: Map<string, string[]> = new Map();
    const createdFolders: string[] = [];
    const movedBookmarks: string[] = [];

    for (const [folderName, bookmarkList] of categorized.entries()) {
      const folderId = existingFolders.get(folderName);
      
      if (folderId) {
        // 文件夹已存在，将书签添加到该文件夹
        organized.set(folderName, [...(organized.get(folderId) || []), ...bookmarkList.map(b => b.id)]);
        bookmarkList.forEach(b => movedBookmarks.push(b.id));
      } else {
        // 文件夹不存在，需要创建
        console.log(`创建文件夹: ${folderName}`);
        const newFolder = await chrome.bookmarks.create({
          parentId: '1', // 创建在书签栏下
          title: folderName
        });
        
        organized.set(folderName, bookmarkList.map(b => b.id));
        createdFolders.push(newFolder.id);
        bookmarkList.forEach(b => movedBookmarks.push(b.id));
        
        // 更新现有文件夹映射
        existingFolders.set(folderName, newFolder.id);
      }
    }

    return { organized, createdFolders, movedBookmarks };
  }

  /**
   * 获取现有的文件夹列表
   */
  async getExistingFolders(): Promise<Map<string, string>> {
    const allBookmarks = await chrome.bookmarks.getTree();
    const folders = new Map<string, string>();

    const traverse = (nodes: any[]) => {
      for (const node of nodes) {
        if (!node.url && node.title && node.title.trim() !== '') {
          folders.set(node.title, node.id);
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      };
    };

    traverse(allBookmarks);
    return folders;
  }

  /**
   * 计算两个书签之间的相似度（0-1之间）
   */
  private calculateBookmarkSimilarity(bookmark1: BookmarkNode, bookmark2: BookmarkNode): number {
    let score = 0;
    let maxScore = 0;

    // 1. 标题相似度（权重：0.4）
    maxScore += 0.4;
    const title1Lower = bookmark1.title.toLowerCase();
    const title2Lower = bookmark2.title.toLowerCase();
    
    if (title1Lower === title2Lower) {
      score += 0.4;
    } else {
      // 计算标题的 Jaccard 相似度
      const words1 = new Set(title1Lower.split(/[\s\-_]+/));
      const words2 = new Set(title2Lower.split(/[\s\-_]+/));
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      if (union.size > 0) {
        score += (intersection.size / union.size) * 0.4;
      }
    }

    // 2. URL 域名相似度（权重：0.3）
    maxScore += 0.3;
    if (bookmark1.url && bookmark2.url) {
      try {
        const domain1 = new URL(bookmark1.url).hostname.replace('www.', '');
        const domain2 = new URL(bookmark2.url).hostname.replace('www.', '');
        if (domain1 === domain2) {
          score += 0.3;
        } else {
          // 计算域名路径相似度
          const path1 = new URL(bookmark1.url).pathname;
          const path2 = new URL(bookmark2.url).pathname;
          if (path1 === path2) {
            score += 0.15;
          }
        }
      } catch {
        // URL 解析失败，忽略
      }
    }

    // 3. 关键词相似度（权重：0.2）
    maxScore += 0.2;
    const commonKeywords = ['教程', '学习', '开发', '编程', '工具', '资源', '文档', '指南', '攻略', '教程', 'tutorial', 'guide', 'learn', 'dev', 'tool'];
    const keywords1 = commonKeywords.filter(k => title1Lower.includes(k));
    const keywords2 = commonKeywords.filter(k => title2Lower.includes(k));
    if (keywords1.length > 0 && keywords2.length > 0) {
      const common = keywords1.filter(k => keywords2.includes(k));
      if (common.length > 0) {
        score += 0.2;
      }
    }

    // 4. 内容相似度（权重：0.1）
    maxScore += 0.1;
    if (bookmark1.url && bookmark2.url && this.contentCache.has(bookmark1.url) && this.contentCache.has(bookmark2.url)) {
      const content1 = this.contentCache.get(bookmark1.url)!;
      const content2 = this.contentCache.get(bookmark2.url)!;
      const contentWords1 = new Set(content1.split(/\s+/));
      const contentWords2 = new Set(content2.split(/\s+/));
      const intersection = new Set([...contentWords1].filter(x => contentWords2.has(x)));
      const union = new Set([...contentWords1, ...contentWords2]);
      if (union.size > 0) {
        score += (intersection.size / union.size) * 0.1;
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * 基于相似度将未分类的书签分组
   */
  private async similarityBasedGrouping(uncategorizedBookmarks: BookmarkNode[]): Promise<Map<string, BookmarkNode[]>> {
    if (uncategorizedBookmarks.length === 0) {
      return new Map();
    }

    const groups: Map<string, BookmarkNode[]> = new Map();
    const processed = new Set<string>();
    const SIMILARITY_THRESHOLD = 0.5; // 相似度阈值

    for (let i = 0; i < uncategorizedBookmarks.length; i++) {
      const bookmark1 = uncategorizedBookmarks[i];
      if (processed.has(bookmark1.id)) continue;

      // 创建新组
      const groupTitle = this.generateGroupName(bookmark1);
      groups.set(groupTitle, [bookmark1]);
      processed.add(bookmark1.id);

      // 查找相似的书签
      for (let j = i + 1; j < uncategorizedBookmarks.length; j++) {
        const bookmark2 = uncategorizedBookmarks[j];
        if (processed.has(bookmark2.id)) continue;

        const similarity = this.calculateBookmarkSimilarity(bookmark1, bookmark2);
        if (similarity >= SIMILARITY_THRESHOLD) {
          groups.get(groupTitle)!.push(bookmark2);
          processed.add(bookmark2.id);
        }
      }
    }

    return groups;
  }

  /**
   * 根据书签生成分组名称
   */
  private generateGroupName(bookmark: BookmarkNode): string {
    const { title, url } = bookmark;
    let groupName = '未分类';

    // 从 URL 提取域名
    if (url) {
      try {
        const domain = new URL(url).hostname.replace('www.', '').split('.')[0];
        if (domain && domain.length > 2) {
          groupName = domain.charAt(0).toUpperCase() + domain.slice(1);
        }
      } catch {
        // URL 解析失败，忽略
      }
    }

    // 从标题提取关键词
    const titleLower = title.toLowerCase();
    const keywordPatterns = [
      { pattern: /教程|学习|learn|tutorial/i, name: '教程学习' },
      { pattern: /开发|编程|code|programming|dev/i, name: '开发编程' },
      { pattern: /工具|tool|utility/i, name: '工具资源' },
      { pattern: /文档|doc|document|manual/i, name: '文档资料' },
      { pattern: /指南|攻略|guide|walkthrough/i, name: '指南攻略' },
      { pattern: /资源|resource|material/i, name: '资源素材' },
      { pattern: /博客|blog|文章|article/i, name: '博客文章' },
      { pattern: /视频|video|movie|film/i, name: '视频媒体' },
      { pattern: /音乐|music|audio|song/i, name: '音乐音频' },
      { pattern: /图片|image|photo|picture/i, name: '图片素材' },
      { pattern: /游戏|game|play/i, name: '游戏娱乐' },
      { pattern: /购物|shop|buy|price/i, name: '购物优惠' },
      { pattern: /新闻|news|资讯|info/i, name: '新闻资讯' },
      { pattern: /社交|social|chat|im/i, name: '社交网络' },
      { pattern: /工作|work|office|job/i, name: '工作办公' }
    ];

    for (const { pattern, name } of keywordPatterns) {
      if (pattern.test(titleLower)) {
        groupName = name;
        break;
      }
    }

    return groupName;
  }

  /**
   * 增强的智能书签整理功能 - 只整理根目录下的书签
   */
  async enhancedOrganizeBookmarks(bookmarks: BookmarkNode[]): Promise<{
    organizedCount: number;
    createdFolders: string[];
    movedBookmarks: number;
    newGroupedFolders: string[];
  }> {
    console.log('=== 开始智能整理根目录书签 ===');
    
    // 1. 获取现有文件夹
    const existingFolders = await this.getExistingFolders();
    console.log('现有文件夹:', existingFolders.size, '个');

    // 2. 只收集根目录下的书签（直接在书签栏下的书签，不在任何文件夹中）
    const rootBookmarks: BookmarkNode[] = [];
    for (const node of bookmarks) {
      if (node.url) {
        // 这是根目录下的书签（直接的书签）
        rootBookmarks.push(node);
      }
      // 跳过文件夹，不处理文件夹中的书签
    }
    console.log('根目录书签（待整理）:', rootBookmarks.length, '个');

    if (rootBookmarks.length === 0) {
      console.log('没有需要整理的根目录书签');
      return {
        organizedCount: 0,
        createdFolders: [],
        movedBookmarks: 0,
        newGroupedFolders: []
      };
    }

    // 3. 使用智能分类规则对根目录书签进行分类
    const categorized = await this.smartCategorize(rootBookmarks);
    console.log('初步分类完成:', categorized.size, '个分类');

    // 4. 找出未分类的书签（没有被分类规则匹配到的书签）
    const categorizedUrls = new Set<string>();
    for (const [folderName, bookmarkList] of categorized) {
      bookmarkList.forEach(b => {
        if (b.url) categorizedUrls.add(b.url);
      });
    }

    const uncategorizedBookmarks = rootBookmarks.filter(b => b.url && !categorizedUrls.has(b.url));
    console.log('未分类书签:', uncategorizedBookmarks.length, '个');

    // 5. 对未分类的书签进行相似度分组
    const similarityGroups = await this.similarityBasedGrouping(uncategorizedBookmarks);
    console.log('相似度分组完成:', similarityGroups.size, '个新组');

    // 6. 执行整理操作
    const createdFolders: string[] = [];
    const movedBookmarks: string[] = [];
    const newGroupedFolders: string[] = [];

    // 6.1 处理初步分类的结果
    for (const [folderName, bookmarkList] of categorized) {
      if (bookmarkList.length === 0) continue;
      
      const folderId = existingFolders.get(folderName);
      
      if (folderId) {
        // 文件夹已存在，将书签移动到该文件夹
        console.log(`移动 ${bookmarkList.length} 个书签到现有文件夹: ${folderName}`);
        for (const bookmark of bookmarkList) {
          try {
            await chrome.bookmarks.move(bookmark.id, { parentId: folderId });
            movedBookmarks.push(bookmark.id);
          } catch (error) {
            console.warn('移动书签失败:', bookmark.id, error);
          }
        }
      } else {
        // 文件夹不存在，创建新文件夹
        console.log(`创建新文件夹: ${folderName} (${bookmarkList.length} 个书签)`);
        const newFolder = await chrome.bookmarks.create({
          parentId: '1', // 创建在书签栏下
          title: folderName
        });
        createdFolders.push(newFolder.id);
        
        // 将书签移动到新文件夹
        for (const bookmark of bookmarkList) {
          try {
            await chrome.bookmarks.move(bookmark.id, { parentId: newFolder.id });
            movedBookmarks.push(bookmark.id);
          } catch (error) {
            console.warn('移动书签失败:', bookmark.id, error);
          }
        }
      }
    }

    // 6.2 处理相似度分组的结果
    for (const [groupName, bookmarkList] of similarityGroups) {
      if (bookmarkList.length === 0) continue;
      
      // 检查是否已存在相同名称的文件夹
      const existingFolderId = existingFolders.get(groupName);
      
      if (existingFolderId) {
        // 文件夹已存在，将书签移动到该文件夹
        console.log(`移动 ${bookmarkList.length} 个相似书签到现有文件夹: ${groupName}`);
        for (const bookmark of bookmarkList) {
          try {
            await chrome.bookmarks.move(bookmark.id, { parentId: existingFolderId });
            movedBookmarks.push(bookmark.id);
          } catch (error) {
            console.warn('移动书签失败:', bookmark.id, error);
          }
        }
      } else {
        // 创建新文件夹用于存放相似书签
        console.log(`创建相似度分组文件夹: ${groupName} (${bookmarkList.length} 个书签)`);
        const newFolder = await chrome.bookmarks.create({
          parentId: '1', // 创建在书签栏下
          title: groupName
        });
        newGroupedFolders.push(newFolder.id);
        createdFolders.push(newFolder.id);
        
        // 将书签移动到新文件夹
        for (const bookmark of bookmarkList) {
          try {
            await chrome.bookmarks.move(bookmark.id, { parentId: newFolder.id });
            movedBookmarks.push(bookmark.id);
          } catch (error) {
            console.warn('移动书签失败:', bookmark.id, error);
          }
        }
      }
    }

    console.log('=== 智能整理书签完成 ===');
    console.log('整理的书签总数:', movedBookmarks.length);
    console.log('创建的文件夹总数:', createdFolders.length);
    console.log('新创建的分组文件夹:', newGroupedFolders.length);

    return {
      organizedCount: movedBookmarks.length,
      createdFolders,
      movedBookmarks: movedBookmarks.length,
      newGroupedFolders
    };
  }
}

export const bookmarkOrganizerService = new BookmarkOrganizerService();
