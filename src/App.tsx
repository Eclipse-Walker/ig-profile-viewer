import { useState, useEffect } from 'react'
import './App.css'

interface ProfileData {
  url: string
  username: string
  profilePicUrl: string
  platform: 'instagram' | 'tiktok'
}

interface TabInfo {
  url: string
  platform: 'instagram' | 'tiktok' | 'unknown'
}

function App() {
  const [loading, setLoading] = useState(false)
  const [currentTab, setCurrentTab] = useState<TabInfo | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customUrl, setCustomUrl] = useState('')

  // Get current tab info on component mount
  useEffect(() => {
    getCurrentTabInfo()
  }, [])

  const getCurrentTabInfo = async () => {
    try {
      const tabs = await new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tabs);
          }
        });
      });
      
      const tab = tabs[0];
      if (tab && tab.url) {
        const platform = detectPlatform(tab.url);
        setCurrentTab({ url: tab.url, platform });
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
      setError('Failed to get current tab information');
    }
  }

  const detectPlatform = (url: string): 'instagram' | 'tiktok' | 'unknown' => {
    if (url.includes('instagram.com')) return 'instagram'
    if (url.includes('tiktok.com')) return 'tiktok'
    return 'unknown'
  }

  const extractUsername = (url: string, platform: 'instagram' | 'tiktok'): string | null => {
    try {
      if (platform === 'instagram') {
        const regex = /(?<=instagram\.com\/)[A-Za-z0-9_.]+/
        const match = url.match(regex)
        return match ? match[0] : null
      } else if (platform === 'tiktok') {
        const regex = /(?<=tiktok\.com\/)@[a-zA-Z0-9.]*/
        const match = url.match(regex)
        return match ? match[0] : null
      }
    } catch (error) {
      console.error('Error extracting username:', error)
    }
    return null
  }

  // Instagram functions
  const getInstagramUserId = async (username: string): Promise<string> => {
    const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 105.0.0.11.118 (iPhone11,8; iOS 12_3_1; en_US; en-US; scale=2.00; 828x1792; 165586599)'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data.user.id
    } catch (error) {
      console.error('Error getting Instagram user ID:', error)
      throw new Error('Failed to get Instagram user ID')
    }
  }

  const getInstagramProfilePicUrl = async (userId: string): Promise<{url: string, username: string}> => {
    const url = `https://i.instagram.com/api/v1/users/${userId}/info/`
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 9; GM1903 Build/PKQ1.190110.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.143 Mobile Safari/537.36 Instagram 103.1.0.15.119 Android (28/9; 420dpi; 1080x2260; OnePlus; GM1903; OnePlus7; qcom; sv_SE; 164094539)'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return {
        url: data.user.hd_profile_pic_url_info.url,
        username: data.user.username
      }
    } catch (error) {
      console.error('Error getting Instagram profile picture:', error)
      throw new Error('Failed to get Instagram profile picture')
    }
  }

  // TikTok functions
  const getTikTokProfilePicUrl = async (username: string): Promise<string> => {
    const url = `https://www.tiktok.com/${username}`
    
    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const html = await response.text()
      const regex = /(?<=avatarLarger":").+?(?=","avatarMedium)/
      const match = html.match(regex)
      
      if (!match) {
        throw new Error('Could not find profile picture in TikTok response')
      }
      
      const profilePictureEncoded = match[0]
      const profilePictureUrl = decodeURIComponent(
        JSON.parse(`"${profilePictureEncoded}"`)
      )
      
      return profilePictureUrl
    } catch (error) {
      console.error('Error getting TikTok profile picture:', error)
      throw new Error('Failed to get TikTok profile picture')
    }
  }

  // Download function
  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      // Use chrome.downloads API
      await new Promise<void>((resolve, reject) => {
        chrome.downloads.download({
          url: imageUrl,
          filename: filename,
          saveAs: false,
        }, (_downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    } catch (error) {
      console.error('Error downloading image:', error)
      throw new Error('Failed to download image')
    }
  }

  const handleViewProfile = async (url?: string) => {
    const targetUrl = url || currentTab?.url
    if (!targetUrl || loading) {
      if (!targetUrl) setError('No URL available')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const platform = detectPlatform(targetUrl)
      if (platform === 'unknown') {
        throw new Error('Unsupported platform. Please use Instagram or TikTok URLs.')
      }

      const username = extractUsername(targetUrl, platform)
      if (!username) {
        throw new Error('Could not extract username from URL')
      }

      let profilePicUrl: string
      let actualUsername: string

      if (platform === 'instagram') {
        const userId = await getInstagramUserId(username)
        const result = await getInstagramProfilePicUrl(userId)
        profilePicUrl = result.url
        actualUsername = result.username
      } else if (platform === 'tiktok') {
        profilePicUrl = await getTikTokProfilePicUrl(username)
        actualUsername = username
      } else {
        throw new Error('Unsupported platform')
      }

      // Open the profile picture in a new tab
      chrome.tabs.create({ url: profilePicUrl })

      // Set profile data and success message
      setProfileData({
        url: targetUrl,
        username: actualUsername,
        profilePicUrl: profilePicUrl,
        platform: platform
      })
      setError(`✅ Profile picture opened in new tab!`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (url?: string) => {
    const targetUrl = url || currentTab?.url
    if (!targetUrl || loading) {
      if (!targetUrl) setError('No URL available')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const platform = detectPlatform(targetUrl)
      if (platform === 'unknown') {
        throw new Error('Unsupported platform. Please use Instagram or TikTok URLs.')
      }

      const username = extractUsername(targetUrl, platform)
      if (!username) {
        throw new Error('Could not extract username from URL')
      }

      let profilePicUrl: string
      let actualUsername: string

      if (platform === 'instagram') {
        const userId = await getInstagramUserId(username)
        const result = await getInstagramProfilePicUrl(userId)
        profilePicUrl = result.url
        actualUsername = result.username
      } else if (platform === 'tiktok') {
        profilePicUrl = await getTikTokProfilePicUrl(username)
        actualUsername = username.replace(/[^a-zA-Z0-9_-]/g, "")
      } else {
        throw new Error('Unsupported platform')
      }

      // Download the profile picture
      await downloadImage(profilePicUrl, `${actualUsername}.jpg`)

      // Set profile data and success message
      setProfileData({
        url: targetUrl,
        username: actualUsername,
        profilePicUrl: profilePicUrl,
        platform: platform
      })
      setError(`✅ Profile picture downloaded successfully!`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const openInNewTab = (url: string) => {
    chrome.tabs.create({ url })
  }

  const handleCustomUrl = () => {
    if (!customUrl.trim() || loading) {
      if (!customUrl.trim()) setError('Please enter a valid URL')
      return
    }
    const platform = detectPlatform(customUrl)
    if (platform === 'unknown') {
      setError('Please enter a valid Instagram or TikTok URL')
      return
    }
    handleViewProfile(customUrl)
  }

  return (
    <div className="app">
      <div className="header">
        <h1>🔍 IG Profile Viewer</h1>
        <p>View and download Instagram & TikTok profile pictures</p>
      </div>

      <div className="content">
        {/* Current tab section */}
        {currentTab && (
          <div className="current-tab">
            <h3>Current Tab</h3>
            <div className="tab-info">
              <span className={`platform-badge ${currentTab.platform}`}>
                {currentTab.platform.toUpperCase()}
              </span>
              <span className="url-display">
                {currentTab.url.length > 40 
                  ? `${currentTab.url.substring(0, 40)}...` 
                  : currentTab.url}
              </span>
            </div>
            {currentTab.platform !== 'unknown' && (
              <div className="button-group">
                <button 
                  onClick={() => handleViewProfile()} 
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Loading...' : '👁️ View Profile'}
                </button>
                <button 
                  onClick={() => handleDownload()} 
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  {loading ? 'Loading...' : '⬇️ Download'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Custom URL section */}
        <div className="custom-url">
          <h3>Or enter a URL</h3>
          <div className="input-group">
            <input
              type="url"
              placeholder="https://instagram.com/username or https://tiktok.com/@username"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="url-input"
            />
            <button 
              onClick={handleCustomUrl} 
              disabled={loading || !customUrl.trim()}
              className="btn btn-primary"
            >
              {loading ? '⏳' : '🔍'}
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className={`message ${error.includes('✅') ? 'success' : 'error'}`}>
            {error}
          </div>
        )}

        {/* Profile data display - Always show placeholder to prevent layout shift */}
        <div className="profile-result">
          <h3>Profile Picture</h3>
          {profileData ? (
            <div className="profile-card">
              <img 
                src={profileData.profilePicUrl} 
                alt={`${profileData.username}'s profile`}
                className="profile-image"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  // setError('Failed to load profile image')
                }}
              />
              <div className="profile-info">
                <p><strong>Username:</strong> {profileData.username}</p>
                <p><strong>Platform:</strong> {profileData.platform}</p>
                <div className="button-group">
                  <button 
                    onClick={() => openInNewTab(profileData.profilePicUrl)}
                    disabled={loading}
                    className="btn btn-outline"
                  >
                    🔗 Open in New Tab
                  </button>
                  <button 
                    onClick={() => handleDownload(profileData.url)}
                    disabled={loading}
                    className="btn btn-secondary"
                  >
                    ⬇️ Download
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="profile-placeholder">
              Profile picture will appear here after processing
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App