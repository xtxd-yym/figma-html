// 添加消息监听器
chrome.runtime.onMessage.addListener((request: { inject: boolean }, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  let isResponseAsync = false;

  if (request.inject) {
      isResponseAsync = true;
      chrome.tabs.query({ currentWindow: true, active: true }, (tabs: chrome.tabs.Tab[]) => {
          if (chrome.runtime.lastError) {
              console.error('查询标签页出错:', chrome.runtime.lastError);
              sendResponse({ done: false, error: chrome.runtime.lastError.message });
              return;
          }
          const activeTab = tabs[0];
          if (activeTab && activeTab.id) {
              // 使用 chrome.scripting.executeScript 替代 chrome.tabs.executeScript
              // @ts-ignore
              chrome.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  files: ["js/inject.js"]
              })
              // @ts-ignore
             .then((args: chrome.scripting.InjectionResult[]) => {
                  sendResponse({ done: true, args });
              })
             .catch((error: Error) => {
                  console.error('注入脚本出错:', error);
                  sendResponse({ done: false, error: error.message });
              });
          } else {
              sendResponse({ done: false, error: '未找到活动标签页' });
          }
      });
  }

  return isResponseAsync;
});