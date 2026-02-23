try {
  chrome.runtime.onInstalled.addListener(() => {
    console.log('收藏夹整理助手已安装');
  });

  chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    console.log('书签已创建:', bookmark);
  });

  chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    console.log('书签已删除:', id);
  });

  chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    console.log('书签已更新:', id, changeInfo);
  });

  if (chrome.action) {
    chrome.action.onClicked.addListener((tab) => {
      chrome.runtime.openOptionsPage();
    });
  } else if (chrome.browserAction) {
    chrome.browserAction.onClicked.addListener((tab) => {
      chrome.runtime.openOptionsPage();
    });
  }
} catch (error) {
  console.error('Service Worker 初始化错误:', error);
}
