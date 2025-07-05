let tiktokProfile = "";

// Cache for user data to avoid repeated API calls
const userDataCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    title: "IG Profile Viewer",
    id: "parent",
  });
});

// Message handler for React popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, data } = request;
  
  switch (action) {
    case 'viewProfile':
      handleViewProfile(data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true; // Keep message channel open for async response
      
    case 'downloadProfile':
      handleDownloadProfile(data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true; // Keep message channel open for async response
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle profile viewing from popup
async function handleViewProfile(data) {
  const { url, platform, username } = data;
  
  try {
    if (platform === 'instagram') {
      // Get profile picture URL and open in new tab
      const extractedUsername = await getInstagramUser(url);
      const userId = await getInstagramUserId(extractedUsername);
      const profilePicUrl = await getInstagramFullHDPhoto(userId);
      
      // Open the profile picture in a new tab
      chrome.tabs.create({ url: profilePicUrl });
      
      return { profilePicUrl, username: extractedUsername, platform, success: true };
    } else if (platform === 'tiktok') {
      // Get profile picture URL and open in new tab
      const profilePicUrl = await getTiktokProfilePictureUrl(username);
      
      // Open the profile picture in a new tab
      chrome.tabs.create({ url: profilePicUrl });
      
      return { profilePicUrl, username, platform, success: true };
    }
  } catch (error) {
    console.error(`Error getting ${platform} profile:`, error);
    throw new Error(`Failed to get ${platform} profile: ${error.message}`);
  }
}

// Handle profile downloading from popup
async function handleDownloadProfile(data) {
  const { url, platform, username } = data;
  
  try {
    if (platform === 'instagram') {
      await oneClickSaveProfilePictureIG(url);
      return { success: true, message: 'Instagram profile picture downloaded successfully!' };
    } else if (platform === 'tiktok') {
      await oneClickSaveProfilePictureTiktok(url);
      return { success: true, message: 'TikTok profile picture downloaded successfully!' };
    }
  } catch (error) {
    console.error(`Error downloading ${platform} profile:`, error);
    throw new Error(`Failed to download ${platform} profile: ${error.message}`);
  }
}

function getCurrentTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (tabs.length === 0) {
        reject(new Error("No active tab found."));
      } else {
        resolve(tabs[0]);
      }
    });
  });
}

//MARK: OneClick
chrome.action.onClicked.addListener(() => {
  getCurrentTab()
    .then((tab) => {
      const url = tab.url;
      console.log(`download: ${url}`);
      if (url.includes("instagram.com")) {
        oneClickSaveProfilePictureIG(url);
      } else if (url.includes("tiktok.com")) {
        oneClickSaveProfilePictureTiktok(url);
      }
    })
    .catch((error) => {
      console.error("Error getting current tab:", error);
    });
});

//MARK: Context menu
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  switch (info.menuItemId) {
    case "parent":
      try {
        if (tab?.url) {
          const { url } = tab;
          console.log(JSON.stringify(url));
          if (url.includes("instagram.com")) {
            // Use the same flow as the original - open in new tab
            getInstagramUser(url)
              .then(getInstagramUserId)
              .then(openInstagramFullHDPhoto)
              .catch(error => console.error("Error opening Instagram profile:", error));
          } else if (url.includes("tiktok.com")) {
            getTiktokProfilePicture(url);
          }
        } else {
          console.error("Tab or URL is undefined");
        }
      } catch (error) {
        console.error("error:genericOnClick: ", error);
      }
      break;
    default:
      console.error("error:contextMenus-onClicked");
  }
});

//MARK: Instagram Functions
function oneClickSaveProfilePictureIG(url) {
  return getInstagramUser(url)
    .then(getInstagramUserId)
    .then(downloadInstagramFullHDPhoto)
    .catch(error => {
      console.error("Error saving Instagram profile picture:", error);
      throw error;
    });
}

function getInstagramUser(link) {
  return new Promise((resolve, reject) => {
    const regex = /(?<=instagram\.com\/)[A-Za-z0-9_.]+/;
    const match = link.match(regex);
    if (match) {
      resolve(match[0]);
    } else {
      reject(new Error("Could not extract Instagram username from URL"));
    }
  });
}

async function getInstagramUserId(username) {
  // Check cache first
  const cacheKey = `instagram_user_${username}`;
  const cached = userDataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.userId;
  }

  try {
    const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    await modifyHeaders(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 12_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 105.0.0.11.118 (iPhone11,8; iOS 12_3_1; en_US; en-US; scale=2.00; 828x1792; 165586599)"
    );

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const userId = data.data.user.id;
    
    // Cache the result
    userDataCache.set(cacheKey, {
      userId,
      timestamp: Date.now()
    });
    
    return userId;
  } catch (error) {
    console.error("Error getting Instagram user ID:", error);
    throw new Error("Failed to get Instagram user ID");
  }
}

function modifyHeaders(headerStr) {
  return chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            {
              header: "User-Agent",
              operation: "set",
              value: headerStr,
            },
          ],
        },
        condition: {
          urlFilter: "https://i.instagram.com/api/v1/users/*",
          resourceTypes: ["main_frame", "script", "sub_frame"],
        },
      },
    ],
  });
}

async function getInstagramFullHDPhoto(instagram_user_id) {
  try {
    await modifyHeaders(
      "Mozilla/5.0 (Linux; Android 9; GM1903 Build/PKQ1.190110.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.143 Mobile Safari/537.36 Instagram 103.1.0.15.119 Android (28/9; 420dpi; 1080x2260; OnePlus; GM1903; OnePlus7; qcom; sv_SE; 164094539)"
    );
    
    const url = `https://i.instagram.com/api/v1/users/${instagram_user_id}/info/`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const profilePicUrl = data.user.hd_profile_pic_url_info.url;
    
    return profilePicUrl;
  } catch (error) {
    console.error("Error getting Instagram full HD photo:", error);
    throw error;
  }
}

function openInstagramFullHDPhoto(instagram_user_id) {
  return getInstagramFullHDPhoto(instagram_user_id)
    .then(url => {
      chrome.tabs.create({ url });
      return url;
    })
    .catch(error => {
      console.error("Error opening Instagram photo:", error);
      throw error;
    });
}

function downloadInstagramFullHDPhoto(instagram_user_id) {
  return new Promise((resolve, reject) => {
    modifyHeaders(
      "Mozilla/5.0 (Linux; Android 9; GM1903 Build/PKQ1.190110.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.143 Mobile Safari/537.36 Instagram 103.1.0.15.119 Android (28/9; 420dpi; 1080x2260; OnePlus; GM1903; OnePlus7; qcom; sv_SE; 164094539)"
    );
    let url = `https://i.instagram.com/api/v1/users/${instagram_user_id}/info/`;

    fetch(url)
      .then((res) => res.json())
      .then((out) => {
        let imageUrl = out.user.hd_profile_pic_url_info.url;

        chrome.downloads.download({
          url: imageUrl,
          filename: `${out.user.username}.jpg`,
          saveAs: false,
        });

        resolve(imageUrl);
      })
      .catch((error) => reject(error));
  });
}

//MARK: TikTok Functions
function getTiktokProfilePicture(url) {
  return getTiktokUsername(url)
    .then(getTiktokProfilePictureUrl)
    .then(openTiktokFullHDPhoto)
    .catch(error => {
      console.error("Error getting TikTok profile picture:", error);
      throw error;
    });
}

function oneClickSaveProfilePictureTiktok(url) {
  return getTiktokUsername(url)
    .then(getTiktokProfilePictureUrl)
    .then(downloadTiktokFullHDPhoto)
    .catch(error => {
      console.error("Error saving TikTok profile picture:", error);
      throw error;
    });
}

function getTiktokUsername(link) {
  return new Promise((resolve, reject) => {
    const regex = /(?<=tiktok\.com\/)@[a-zA-Z0-9.]*/;
    const match = link.match(regex);
    if (match) {
      const username = match[0];
      console.log("TikTok Username: " + username);
      tiktokProfile = username;
      resolve(username);
    } else {
      reject(new Error("Could not extract TikTok username from URL"));
    }
  });
}

async function getTiktokProfilePictureUrl(username) {
  // Check cache first
  const cacheKey = `tiktok_user_${username}`;
  const cached = userDataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.profilePicUrl;
  }

  try {
    const url = `https://www.tiktok.com/${username}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const regex = /(?<=avatarLarger":").+?(?=","avatarMedium)/;
    const match = html.match(regex);
    
    if (!match) {
      throw new Error("Could not find profile picture in TikTok response");
    }
    
    const profile_picture_encoded = match[0];
    const profile_picture_url = decodeURIComponent(
      JSON.parse(`"${profile_picture_encoded}"`)
    );
    
    // Cache the result
    userDataCache.set(cacheKey, {
      profilePicUrl: profile_picture_url,
      timestamp: Date.now()
    });
    
    console.log("TikTok profile picture URL:", profile_picture_url);
    return profile_picture_url;
  } catch (error) {
    console.error("Error getting TikTok profile picture URL:", error);
    throw error;
  }
}

function openTiktokFullHDPhoto(url) {
  return new Promise((resolve, reject) => {
    try {
      openTab(url);
      resolve(url);
    } catch (error) {
      reject(error);
    }
  });
}

function downloadTiktokFullHDPhoto(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
      })
      .then(() => {
        const filename = `${tiktokProfile.replace(/[^a-zA-Z0-9_-]/g, "")}.jpg`;
        chrome.downloads.download(
          {
            url: url,
            filename: filename,
            saveAs: false,
          },
          () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(url);
              tiktokProfile = "";
            }
          }
        );
      })
      .catch((error) => reject(error));
  });
}

function openTab(url) {
  chrome.tabs.create({ url: url });
}

// Clean up cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userDataCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      userDataCache.delete(key);
    }
  }
}, CACHE_DURATION);
