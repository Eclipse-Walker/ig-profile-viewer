// User-Agent strings required by Instagram's private API for each endpoint.
const IG_UA_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 12_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 105.0.0.11.118 (iPhone11,8; iOS 12_3_1; en_US; en-US; scale=2.00; 828x1792; 165586599)";
const IG_UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 9; GM1903 Build/PKQ1.190110.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.143 Mobile Safari/537.36 Instagram 103.1.0.15.119 Android (28/9; 420dpi; 1080x2260; OnePlus; GM1903; OnePlus7; qcom; sv_SE; 164094539)";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    title: "IG Profile Viewer",
    id: "parent",
  });
});

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found.");
  return tab;
}

// Routes a tab URL to the matching platform handler.
async function handleProfilePicture(url, { download }) {
  if (url.includes("instagram.com")) {
    await handleInstagram(url, { download });
  } else if (url.includes("tiktok.com")) {
    await handleTiktok(url, { download });
  }
}

//MARK:OneClick
chrome.action.onClicked.addListener(async () => {
  try {
    const tab = await getCurrentTab();
    console.log(`download: ${tab.url}`);
    await handleProfilePicture(tab.url, { download: true });
  } catch (error) {
    console.error("error:onClicked:", error);
  }
});

//MARK:Context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "parent") {
    console.error("error:contextMenus-onClicked");
    return;
  }
  try {
    if (!tab?.url) {
      console.error("Tab or URL is undefined");
      return;
    }
    await handleProfilePicture(tab.url, { download: false });
  } catch (error) {
    console.error("error:genericOnClick:", error);
  }
});

// Applies a dynamic User-Agent override. Returns a promise so callers can
// await it and guarantee the rule is active before the request fires.
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
            { header: "User-Agent", operation: "set", value: headerStr },
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

//MARK:Instagram
async function handleInstagram(url, { download }) {
  const username = parseInstagramUsername(url);
  const profile = await getInstagramWebProfile(username);
  const imageUrl = await resolveInstagramImageUrl(profile);

  if (!imageUrl) {
    console.error("[IG] could not resolve image url; profile:", JSON.stringify(profile));
    throw new Error("Could not resolve Instagram profile picture URL");
  }

  if (download) {
    chrome.downloads.download({
      url: imageUrl,
      filename: `${profile.username || username}.jpg`,
      saveAs: false,
    });
  } else {
    chrome.tabs.create({ url: imageUrl });
  }
}

function parseInstagramUsername(link) {
  const match = link.match(/(?<=instagram\.com\/)[A-Za-z0-9_.]+/);
  if (!match) throw new Error(`Could not parse Instagram username from: ${link}`);
  return match[0];
}

// Fetches the public web profile. This endpoint is reliable (it rides the
// browser's logged-in instagram.com cookies) and already carries the profile
// picture URLs as a guaranteed fallback.
async function getInstagramWebProfile(username) {
  modifyHeaders(IG_UA_IPHONE);
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IG web_profile_info failed: ${res.status}`);
  const out = await res.json();
  const user = out?.data?.user;
  if (!user?.id) throw new Error("IG web_profile_info missing user id");
  return user;
}

// Prefers the full-resolution image from the private mobile /info/ endpoint,
// but falls back to the URLs already present in the web profile when /info/
// is unavailable (e.g. private accounts or API changes).
async function resolveInstagramImageUrl(profile) {
  try {
    const info = await getInstagramUserInfo(profile.id);
    const hd = info?.hd_profile_pic_url_info?.url;
    if (hd) return hd;
  } catch (error) {
    console.warn("[IG] /info/ lookup failed, falling back to web profile:", error);
  }
  return profile.profile_pic_url_hd || profile.profile_pic_url;
}

async function getInstagramUserInfo(userId) {
  modifyHeaders(IG_UA_ANDROID);
  const url = `https://i.instagram.com/api/v1/users/${userId}/info/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IG user info failed: ${res.status}`);
  const out = await res.json();
  return out.user;
}

//MARK:Tiktok
async function handleTiktok(url, { download }) {
  const username = parseTiktokUsername(url);
  const pictureUrl = await getTiktokProfilePictureUrl(username);

  if (download) {
    chrome.downloads.download({
      url: pictureUrl,
      filename: `${username.replace(/[^a-zA-Z0-9_-]/g, "")}.jpg`,
      saveAs: false,
    });
  } else {
    chrome.tabs.create({ url: pictureUrl });
  }
}

function parseTiktokUsername(link) {
  const match = link.match(/(?<=tiktok\.com\/)@[a-zA-Z0-9.]*/);
  if (!match) throw new Error(`Could not parse TikTok username from: ${link}`);
  console.log("TikTok Username: " + match[0]);
  return match[0];
}

async function getTiktokProfilePictureUrl(username) {
  const res = await fetch(`https://www.tiktok.com/${username}`);
  if (!res.ok) throw new Error(`TikTok page fetch failed: ${res.status}`);
  const html = await res.text();

  const match = html.match(/(?<=avatarLarger":").+?(?=","avatarMedium)/);
  if (!match) throw new Error("Could not find TikTok avatar in page HTML");

  const pictureUrl = decodeURIComponent(JSON.parse(`"${match[0]}"`));
  console.log(pictureUrl);
  return pictureUrl;
}
