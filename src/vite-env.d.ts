/// <reference types="vite/client" />

// Chrome Extension Types
declare global {
  interface Window {
    chrome: typeof chrome
  }
  
  namespace chrome {
    namespace tabs {
      interface Tab {
        id?: number
        url?: string
        title?: string
        active?: boolean
        pinned?: boolean
        audible?: boolean
        discarded?: boolean
        autoDiscardable?: boolean
        mutedInfo?: any
        favIconUrl?: string
        status?: string
        incognito?: boolean
        width?: number
        height?: number
        sessionId?: string
        windowId?: number
        groupId?: number
        index?: number
        highlighted?: boolean
        selected?: boolean
        pendingUrl?: string
        openerTabId?: number
      }
    }
  }
  
  const chrome: {
    runtime: {
      sendMessage: (message: any, callback?: (response: any) => void) => void
      lastError?: { message: string }
    }
    tabs: {
      query: (queryInfo: { active: boolean; currentWindow: boolean }, callback: (tabs: chrome.tabs.Tab[]) => void) => void
      create: (createProperties: { url: string }) => void
    }
    contextMenus: {
      create: (createProperties: any) => void
      onClicked: {
        addListener: (callback: (info: any, tab: any) => void) => void
      }
    }
    action: {
      onClicked: {
        addListener: (callback: (tab: any) => void) => void
      }
    }
    downloads: {
      download: (options: any, callback?: () => void) => void
    }
    declarativeNetRequest: {
      updateDynamicRules: (options: any) => void
    }
  }
}

export {}
