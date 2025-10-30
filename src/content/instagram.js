// Instagram content script for Virality Sense
(function() {
  'use strict';

  let currentReelUrl = null;
  let saveButton = null;
  let observer = null;
  let watchStartTime = null;
  let totalWatchTime = 0;

  // Initialize the script
  function init() {
    console.log('Virality Sense: Instagram script loaded');
    observeReels();
  }

  // Observe for Instagram Reels
  function observeReels() {
    // Check immediately
    checkAndInjectButton();

    // Watch for navigation and DOM changes
    observer = new MutationObserver(() => {
      checkAndInjectButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for URL changes
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        currentReelUrl = null;
        removeButton();
        setTimeout(checkAndInjectButton, 500);
      }
    }, 500);
  }

  // Check if we're on a Reel and inject button
  function checkAndInjectButton() {
    const url = window.location.href;

    // Check if we're on a Reel page
    const isReelPage = url.includes('/reel/') || url.includes('/reels/');

    if (isReelPage && url !== currentReelUrl) {
      currentReelUrl = url;
      watchStartTime = null;
      totalWatchTime = 0;
      setTimeout(injectButton, 1000);
      setTimeout(setupWatchTracking, 1500);
    } else if (!isReelPage && saveButton) {
      removeButton();
    }
  }

  // Inject the save button
  async function injectButton() {
    // Don't inject if button already exists
    if (saveButton && document.body.contains(saveButton)) return;

    // Find the video container
    const videoContainer = document.querySelector('article[role="presentation"] video')?.closest('div[style*="height"]') ||
                          document.querySelector('div[role="dialog"] video')?.parentElement ||
                          document.querySelector('video')?.closest('div[style*="height"]');

    if (!videoContainer) {
      console.log('Virality Sense: Instagram Reel container not found');
      return;
    }

    // Make sure container is positioned
    if (getComputedStyle(videoContainer).position === 'static') {
      videoContainer.style.position = 'relative';
    }

    // Create button
    saveButton = document.createElement('button');
    saveButton.className = 'vs-save-button';
    saveButton.innerHTML = '<span class="vs-save-button-icon"></span><span>Save</span>';

    // Check if video is already saved
    const isSaved = await videoStorage.isSaved(currentReelUrl);
    if (isSaved) {
      saveButton.classList.add('saved');
      saveButton.innerHTML = '<span class="vs-save-button-icon"></span><span>Saved</span>';
    }

    // Add click handler
    saveButton.addEventListener('click', handleSaveClick);

    // Inject button
    videoContainer.appendChild(saveButton);
    console.log('Virality Sense: Button injected on Instagram');
  }

  // Setup watch time tracking
  function setupWatchTracking() {
    const video = document.querySelector('video');
    if (!video) return;

    video.addEventListener('play', () => {
      watchStartTime = Date.now();
    });

    video.addEventListener('pause', () => {
      if (watchStartTime) {
        totalWatchTime += (Date.now() - watchStartTime) / 1000;
        watchStartTime = null;
      }
    });

    video.addEventListener('ended', () => {
      if (watchStartTime) {
        totalWatchTime += (Date.now() - watchStartTime) / 1000;
        watchStartTime = null;
      }
    });

    if (!video.paused) {
      watchStartTime = Date.now();
    }
  }

  // Get current watch duration
  function getWatchDuration() {
    let duration = totalWatchTime;
    if (watchStartTime) {
      duration += (Date.now() - watchStartTime) / 1000;
    }
    return Math.floor(duration);
  }

  // Handle save button click
  async function handleSaveClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const videoData = extractVideoData();
    if (!videoData) {
      showNotification('Could not extract video data');
      return;
    }

    console.log('Virality Sense: Saving Instagram reel:', videoData);
    const isSaved = await videoStorage.isSaved(currentReelUrl);

    if (isSaved) {
      // Remove video
      const result = await videoStorage.remove(currentReelUrl);
      if (result.success) {
        saveButton.classList.remove('saved');
        saveButton.innerHTML = '<span class="vs-save-button-icon"></span><span>Save</span>';
        showNotification('Reel removed!');
      }
    } else {
      // Save video
      const result = await videoStorage.save(videoData);
      if (result.success) {
        saveButton.classList.add('saved', 'animating');
        saveButton.innerHTML = '<span class="vs-save-button-icon"></span><span>Saved</span>';
        setTimeout(() => saveButton.classList.remove('animating'), 400);
        showNotification('Reel saved!');
      }
    }
  }

  // Extract video data from the page
  function extractVideoData() {
    const url = window.location.href;

    // Try to find the author/username
    const author = document.querySelector('article header a[role="link"]')?.textContent ||
                   document.querySelector('article header span a')?.textContent ||
                   document.querySelector('a[href*="/"]')?.textContent?.replace('@', '') ||
                   'Unknown';

    // Try to find caption/title (Instagram Reels use caption as description)
    const captionElement = document.querySelector('article h1') ||
                          document.querySelector('article span[dir="auto"]') ||
                          document.querySelector('[role="dialog"] h1') ||
                          document.querySelector('._a9zs span');

    const description = captionElement?.textContent?.trim() || '';
    const title = description.substring(0, 100) || 'Instagram Reel';

    // Get thumbnail from video poster or screenshot
    const video = document.querySelector('video');
    const thumbnail = video?.poster || '';

    // Get music/audio info
    const musicElement = document.querySelector('a[href*="/audio/"]') ||
                        document.querySelector('[href*="/original-audio/"]');
    const music = musicElement?.textContent || '';

    // Try to extract metrics
    const likesElement = document.querySelector('section button[aria-label*="like"]')?.querySelector('span') ||
                         document.querySelector('section span[aria-label*="like"]') ||
                         document.querySelector('a[href*="/liked_by/"] span');

    const viewsElement = document.querySelector('span:contains("views")') ||
                         document.querySelector('[aria-label*="views"]') ||
                         document.querySelector('span._ac2a');

    const commentsElement = document.querySelector('section button[aria-label*="comment"]')?.querySelector('span') ||
                           document.querySelector('a[href*="/comments/"] span');

    const sharesElement = document.querySelector('button[aria-label*="Share"]')?.querySelector('span');

    const metrics = {
      likes: likesElement ? videoDataExtractor.parseMetricNumber(likesElement.textContent) : null,
      views: viewsElement ? videoDataExtractor.parseMetricNumber(viewsElement.textContent) : null,
      comments: commentsElement ? videoDataExtractor.parseMetricNumber(commentsElement.textContent) : null,
      shares: sharesElement ? videoDataExtractor.parseMetricNumber(sharesElement.textContent) : null
    };

    return videoDataExtractor.createVideoData(
      'instagram',
      url,
      videoDataExtractor.truncate(videoDataExtractor.cleanText(title), 200),
      videoDataExtractor.cleanText(author),
      thumbnail,
      metrics,
      getWatchDuration(),
      videoDataExtractor.truncate(videoDataExtractor.cleanText(description), 500),
      videoDataExtractor.cleanText(music)
    );
  }

  // Remove button from DOM
  function removeButton() {
    if (saveButton && document.body.contains(saveButton)) {
      saveButton.remove();
      saveButton = null;
    }
  }

  // Show notification
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'vs-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // Start the script
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
