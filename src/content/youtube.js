// YouTube content script for Virality Sense
(function() {
  'use strict';

  let currentVideoUrl = null;
  let saveButton = null;
  let watchStartTime = null;
  let totalWatchTime = 0;

  // Initialize the script
  function init() {
    console.log('Virality Sense: YouTube script loaded');
    observeUrlChanges();
    checkAndInjectButton();
  }

  // Observe URL changes (YouTube is a SPA)
  function observeUrlChanges() {
    let lastUrl = location.href;

    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        currentVideoUrl = null;
        removeButton();
        setTimeout(checkAndInjectButton, 1000);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Check if we're on a video page and inject button
  function checkAndInjectButton() {
    const url = window.location.href;

    // Check if we're on a video page (regular video or Shorts)
    const isVideoPage = url.includes('/watch?v=');
    const isShortsPage = url.includes('/shorts/');

    if (isVideoPage || isShortsPage) {
      currentVideoUrl = url;
      watchStartTime = null;
      totalWatchTime = 0;
      setTimeout(injectButton, 500);
      setTimeout(setupWatchTracking, 1000);
    }
  }

  // Inject the save button
  async function injectButton() {
    // Don't inject if button already exists
    if (saveButton && document.body.contains(saveButton)) return;

    let videoContainer;

    // Find the video container based on page type
    if (window.location.href.includes('/shorts/')) {
      // YouTube Shorts
      videoContainer = document.querySelector('#shorts-player') ||
                       document.querySelector('ytd-reel-video-renderer[is-active]');
    } else {
      // Regular YouTube videos
      videoContainer = document.querySelector('#movie_player') ||
                       document.querySelector('.html5-video-player');
    }

    if (!videoContainer) {
      console.log('Virality Sense: Video container not found');
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
    const isSaved = await videoStorage.isSaved(currentVideoUrl);
    if (isSaved) {
      saveButton.classList.add('saved');
      saveButton.innerHTML = '<span class="vs-save-button-icon"></span><span>Saved</span>';
    }

    // Add click handler
    saveButton.addEventListener('click', handleSaveClick);

    // Inject button
    videoContainer.appendChild(saveButton);
    console.log('Virality Sense: Button injected');
  }

  // Setup watch time tracking
  function setupWatchTracking() {
    const video = document.querySelector('video');
    if (!video) return;

    video.addEventListener('play', () => {
      watchStartTime = Date.now();
      console.log('Virality Sense: Started tracking watch time');
    });

    video.addEventListener('pause', () => {
      if (watchStartTime) {
        totalWatchTime += (Date.now() - watchStartTime) / 1000;
        watchStartTime = null;
        console.log('Virality Sense: Watch time:', Math.floor(totalWatchTime), 'seconds');
      }
    });

    video.addEventListener('ended', () => {
      if (watchStartTime) {
        totalWatchTime += (Date.now() - watchStartTime) / 1000;
        watchStartTime = null;
      }
    });

    // If video is already playing when we inject
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

    console.log('Virality Sense: Saving video data:', videoData);
    const isSaved = await videoStorage.isSaved(currentVideoUrl);

    if (isSaved) {
      // Remove video
      const result = await videoStorage.remove(currentVideoUrl);
      if (result.success) {
        saveButton.classList.remove('saved');
        saveButton.innerHTML = '<span class="vs-save-button-icon"></span><span>Save</span>';
        showNotification('Video removed!');
      }
    } else {
      // Save video
      const result = await videoStorage.save(videoData);
      if (result.success) {
        saveButton.classList.add('saved', 'animating');
        saveButton.innerHTML = '<span class="vs-save-button-icon"></span><span>Saved</span>';
        setTimeout(() => saveButton.classList.remove('animating'), 400);
        showNotification('Video saved!');
      }
    }
  }

  // Extract video data from the page
  function extractVideoData() {
    const url = window.location.href;
    let title, author, thumbnail, metrics, description = '', music = '';

    if (url.includes('/shorts/')) {
      // YouTube Shorts
      title = document.querySelector('#shorts-player h2.title')?.textContent ||
              document.querySelector('ytd-reel-video-renderer[is-active] h2')?.textContent ||
              'YouTube Short';

      author = document.querySelector('#shorts-player #channel-name a')?.textContent ||
               document.querySelector('ytd-reel-video-renderer[is-active] #channel-name')?.textContent ||
               'Unknown';

      thumbnail = document.querySelector('ytd-reel-video-renderer[is-active] video')?.poster || '';

      // Get description from Shorts
      description = document.querySelector('#description-text')?.textContent ||
                    document.querySelector('ytd-reel-video-renderer[is-active] #description')?.textContent || '';

      // Get music from Shorts
      music = document.querySelector('ytd-reel-player-overlay-renderer #attribution a')?.textContent ||
              document.querySelector('#music-title')?.textContent || '';

      // Shorts metrics
      const likesText = document.querySelector('#like-button span')?.textContent;
      const dislikesText = document.querySelector('#dislike-button span')?.textContent;
      const commentsText = document.querySelector('#comments-button span')?.textContent;
      const sharesText = document.querySelector('#share-button span')?.textContent;

      metrics = {
        likes: videoDataExtractor.parseMetricNumber(likesText),
        dislikes: videoDataExtractor.parseMetricNumber(dislikesText),
        comments: videoDataExtractor.parseMetricNumber(commentsText),
        shares: videoDataExtractor.parseMetricNumber(sharesText)
      };

    } else {
      // Regular YouTube video
      title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent ||
              document.querySelector('yt-formatted-string.ytd-watch-metadata')?.textContent ||
              document.querySelector('#title h1')?.textContent ||
              document.title.replace(' - YouTube', '');

      author = document.querySelector('ytd-channel-name a')?.textContent ||
               document.querySelector('#owner-name a')?.textContent ||
               document.querySelector('#channel-name a')?.textContent ||
               'Unknown';

      // Get thumbnail
      const videoId = new URLSearchParams(new URL(url).search).get('v');
      thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : '';

      // Get description
      description = document.querySelector('#description yt-formatted-string')?.textContent ||
                    document.querySelector('#description-inline-expander yt-formatted-string')?.textContent ||
                    document.querySelector('ytd-text-inline-expander #plain-snippet-text')?.textContent || '';

      // Get music (if available in description or music section)
      const musicSection = document.querySelector('ytd-music-description-shelf-renderer');
      if (musicSection) {
        music = musicSection.querySelector('.content')?.textContent || '';
      }

      // Get views
      const viewsText = document.querySelector('ytd-video-view-count-renderer')?.textContent ||
                        document.querySelector('.view-count')?.textContent ||
                        document.querySelector('#info-text')?.textContent;

      // Get likes (YouTube removed dislike count)
      const likesText = document.querySelector('#top-level-buttons-computed button[aria-label*="like"]')?.getAttribute('aria-label') ||
                        document.querySelector('yt-formatted-string.ytd-toggle-button-renderer#text')?.getAttribute('aria-label') ||
                        document.querySelector('#segmented-like-button button')?.getAttribute('aria-label');

      // Get comments count
      const commentsText = document.querySelector('#count .count-text')?.textContent ||
                          document.querySelector('ytd-comments-header-renderer #count')?.textContent;

      metrics = {
        views: videoDataExtractor.parseMetricNumber(viewsText),
        likes: videoDataExtractor.parseMetricNumber(likesText),
        comments: videoDataExtractor.parseMetricNumber(commentsText),
        dislikes: null // YouTube removed public dislike counts
      };
    }

    return videoDataExtractor.createVideoData(
      'youtube',
      url,
      videoDataExtractor.cleanText(title),
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
