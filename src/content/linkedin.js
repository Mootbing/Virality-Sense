// LinkedIn content script for Virality Sense
(function() {
  'use strict';

  let currentVideoUrl = null;
  let saveButton = null;
  let observer = null;
  let watchStartTime = null;
  let totalWatchTime = 0;

  // Initialize the script
  function init() {
    console.log('Virality Sense: LinkedIn script loaded');
    observeVideos();
  }

  // Observe for LinkedIn videos/reels
  function observeVideos() {
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
        currentVideoUrl = null;
        removeButton();
        setTimeout(checkAndInjectButton, 500);
      }
    }, 500);
  }

  // Check if we're on a video/reel and inject button
  function checkAndInjectButton() {
    const url = window.location.href;

    // Check if we're on a post with video or in feed with video
    const hasVideo = document.querySelector('video[src*="linkedin"]') ||
                     document.querySelector('.feed-shared-video') ||
                     document.querySelector('[data-test-id*="video"]');

    // Focus on the active/visible video
    const videos = document.querySelectorAll('video');
    let activeVideo = null;

    // Find the video that's currently in view and playing or ready
    for (const video of videos) {
      const rect = video.getBoundingClientRect();
      const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;

      if (isInView && video.duration > 0) {
        activeVideo = video;
        break;
      }
    }

    if (hasVideo && activeVideo) {
      const videoUrl = getVideoIdentifier(activeVideo);
      if (videoUrl !== currentVideoUrl) {
        currentVideoUrl = videoUrl;
        watchStartTime = null;
        totalWatchTime = 0;
        setTimeout(() => injectButton(activeVideo), 1000);
        setTimeout(() => setupWatchTracking(activeVideo), 1500);
      }
    }
  }

  // Get a unique identifier for the video
  function getVideoIdentifier(videoElement) {
    // Try to get post URL
    const postLink = videoElement.closest('article')?.querySelector('a[href*="/feed/update/"]') ||
                     videoElement.closest('[data-urn]');

    if (postLink) {
      return postLink.href || window.location.href;
    }

    return window.location.href + '#' + (videoElement.src || Date.now());
  }

  // Inject the save button
  async function injectButton(videoElement) {
    // Don't inject if button already exists
    if (saveButton && document.body.contains(saveButton)) return;

    // Find the video container
    const videoContainer = videoElement.closest('.feed-shared-update-v2__content') ||
                          videoElement.closest('.feed-shared-video') ||
                          videoElement.closest('[data-test-id*="video"]') ||
                          videoElement.parentElement;

    if (!videoContainer) {
      console.log('Virality Sense: LinkedIn video container not found');
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
    console.log('Virality Sense: Button injected on LinkedIn');
  }

  // Setup watch time tracking
  function setupWatchTracking(videoElement) {
    const video = videoElement || document.querySelector('video');
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

    console.log('Virality Sense: Saving LinkedIn video:', videoData);
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
    const url = currentVideoUrl;

    // Find the post container
    const video = Array.from(document.querySelectorAll('video')).find(v => {
      const rect = v.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    });

    const postContainer = video?.closest('article') || video?.closest('[data-urn]') || video?.closest('.feed-shared-update-v2');

    // Get author
    const author = postContainer?.querySelector('.update-components-actor__name')?.textContent ||
                   postContainer?.querySelector('.feed-shared-actor__name')?.textContent ||
                   postContainer?.querySelector('[data-test-id="post-author"]')?.textContent ||
                   postContainer?.querySelector('.update-components-actor__title')?.textContent ||
                   'Unknown';

    // Get description/caption
    const captionElement = postContainer?.querySelector('.feed-shared-text') ||
                          postContainer?.querySelector('.update-components-text') ||
                          postContainer?.querySelector('[data-test-id="main-feed-activity-card__commentary"]') ||
                          postContainer?.querySelector('.break-words span[dir="ltr"]');

    const description = captionElement?.textContent?.trim() || '';
    const title = description.substring(0, 100) || 'LinkedIn Video';

    // Get thumbnail
    const thumbnail = video?.poster || '';

    // Music info (LinkedIn doesn't typically have music like TikTok/Instagram)
    const music = '';

    // Try to extract engagement metrics
    const reactionsElement = postContainer?.querySelector('.social-details-social-counts__reactions-count') ||
                            postContainer?.querySelector('.social-details-social-counts__count-value');

    const commentsElement = postContainer?.querySelector('.social-details-social-counts__comments') ||
                           postContainer?.querySelector('[data-test-id="social-actions__comments"]');

    const repostsElement = postContainer?.querySelector('.social-details-social-counts__item--reposts') ||
                          postContainer?.querySelector('[data-test-id="social-actions__reposts"]');

    const sharesElement = postContainer?.querySelector('.social-details-social-counts__item--shares');

    const metrics = {
      likes: reactionsElement ? videoDataExtractor.parseMetricNumber(reactionsElement.textContent) : null,
      comments: commentsElement ? videoDataExtractor.parseMetricNumber(commentsElement.textContent) : null,
      reposts: repostsElement ? videoDataExtractor.parseMetricNumber(repostsElement.textContent) : null,
      shares: sharesElement ? videoDataExtractor.parseMetricNumber(sharesElement.textContent) : null
    };

    return videoDataExtractor.createVideoData(
      'linkedin',
      url,
      videoDataExtractor.truncate(videoDataExtractor.cleanText(title), 200),
      videoDataExtractor.cleanText(author),
      thumbnail,
      metrics,
      getWatchDuration(),
      videoDataExtractor.truncate(videoDataExtractor.cleanText(description), 500),
      music
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
