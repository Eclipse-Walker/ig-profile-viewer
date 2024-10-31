let tiktokProfile = "";

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    title: "IG Profile Viewer",
    id: "parent",
  });
});

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

//MARK:OneClick
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

//MARK:Context menu
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  switch (info.menuItemId) {
    case "parent":
      try {
        if (tab?.url) {
          const { url } = tab;
          console.log(JSON.stringify(url));
          if (url.includes("instagram.com")) {
            getInstagramProfilePicture(url);
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

//MARK:Instagram
function getInstagramProfilePicture(url) {
  getInstagramUser(url).then(getInstagramUserId).then(openInstagramFullHDPhoto);
}

function oneClickSaveProfilePictureIG(url) {
  getInstagramUser(url)
    .then(getInstagramUserId)
    .then(downloadInstagramFullHDPhoto);
}

function getInstagramUser(link) {
  return new Promise((resolve, reject) => {
    let regex = /(?<=instagram.com\/)[A-Za-z0-9_.]+/;
    let match = link.match(regex);
    if (match) {
      let username = match[0];
      resolve(username);
    }
  });
}

function getInstagramUserId(username) {
  return new Promise((resolve, reject) => {
    let url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    modifyHeaders(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 12_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 105.0.0.11.118 (iPhone11,8; iOS 12_3_1; en_US; en-US; scale=2.00; 828x1792; 165586599)"
    );

    fetch(url)
      .then((res) => res.json())
      .then((out) => resolve(out.data.user.id));
  });
}

function modifyHeaders(headerStr) {
  chrome.declarativeNetRequest.updateDynamicRules({
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

function openInstagramFullHDPhoto(instagram_user_id) {
  return new Promise((resolve, reject) => {
    modifyHeaders(
      "Mozilla/5.0 (Linux; Android 9; GM1903 Build/PKQ1.190110.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.143 Mobile Safari/537.36 Instagram 103.1.0.15.119 Android (28/9; 420dpi; 1080x2260; OnePlus; GM1903; OnePlus7; qcom; sv_SE; 164094539)"
    );
    let url = `https://i.instagram.com/api/v1/users/${instagram_user_id}/info/`;

    fetch(url)
      .then((res) => res.json())
      .then((out) => {
        let url = out.user.hd_profile_pic_url_info.url;
        chrome.tabs.create({ url });
        resolve(url);
      });
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
          saveAs: true,
        });

        resolve(imageUrl);
      })
      .catch((error) => reject(error));
  });
}

//MARK:Tiktok
function getTiktokProfilePicture(url) {
  getTiktokUsername(url)
    .then(getTiktokProfilePictureUrl)
    .then(openTiktokFullHDPhoto);
}

function oneClickSaveProfilePictureTiktok(url) {
  getTiktokUsername(url)
    .then(getTiktokProfilePictureUrl)
    .then(downloadTiktokFullHDPhoto);
}

function getTiktokUsername(link) {
  return new Promise((resolve, reject) => {
    let regex = /(?<=tiktok.com\/)@[a-zA-z0-9.]*/;
    let username = link.match(regex)[0];
    console.log("TikTok Username: " + username);
    tiktokProfile = username;
    resolve(username);
  });
}

function getTiktokProfilePictureUrl(username) {
  return new Promise((resolve, reject) => {
    let url = `https://www.tiktok.com/${username}`;
    fetch(url)
      .then((response) => {
        return response.text();
      })
      .then((html) => {
        let regex = /(?<=avatarLarger":").+?(?=","avatarMedium)/;
        let profile_picture_encoded = html.match(regex)[0];
        let profile_picture_url = decodeURIComponent(
          JSON.parse(`"${profile_picture_encoded}"`)
        );
        console.log(profile_picture_url);
        resolve(profile_picture_url);
      })
      .catch((err) => {
        console.log(err);
        reject(err);
      });
  });
}

function openTiktokFullHDPhoto(url) {
  return new Promise((resolve, reject) => {
    openTab(url);
    resolve(url);
  });
}

function downloadTiktokFullHDPhoto(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((out) => {
        chrome.downloads.download(
          {
            url: url,
            filename: `${tiktokProfile.replace(/[^a-zA-Z0-9_-]/g, "")}.jpg`,
            saveAs: true,
          },
          () => {
            resolve(url);
            tiktokProfile = "";
          }
        );
      })
      .catch((error) => reject(error));
  });
}

function openTab(url) {
  chrome.tabs.create({ url: url });
}
