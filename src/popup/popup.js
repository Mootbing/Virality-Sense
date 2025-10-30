// Popup script for Virality Sense

// Storage class
class VideoStorage {
  constructor() {
    this.storageKey = 'virality_sense_videos';
  }

  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.storageKey], (result) => {
        resolve(result[this.storageKey] || []);
      });
    });
  }

  async remove(url) {
    const videos = await this.getAll();
    const filtered = videos.filter(v => v.url !== url);
    await this.setAll(filtered);
    return { success: true };
  }

  async setAll(videos) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.storageKey]: videos }, resolve);
    });
  }

  async clearAll() {
    return new Promise((resolve) => {
      chrome.storage.local.remove([this.storageKey], resolve);
    });
  }

  async exportJSON() {
    const videos = await this.getAll();
    return JSON.stringify(videos, null, 2);
  }

  async exportCSV() {
    const videos = await this.getAll();
    if (videos.length === 0) return '';

    const headers = ['Platform', 'Title', 'Author', 'Description', 'Music', 'URL', 'Saved At', 'Watch Duration (s)', 'Views', 'Likes', 'Dislikes', 'Comments', 'Reposts', 'Shares', 'Thumbnail'];
    const rows = videos.map(v => [
      v.platform,
      `"${(v.title || '').replace(/"/g, '""')}"`,
      `"${(v.author || '').replace(/"/g, '""')}"`,
      `"${(v.description || '').replace(/"/g, '""')}"`,
      `"${(v.music || '').replace(/"/g, '""')}"`,
      v.url,
      v.savedAt,
      v.watchDuration || 0,
      v.metrics?.views || '',
      v.metrics?.likes || '',
      v.metrics?.dislikes || '',
      v.metrics?.comments || '',
      v.metrics?.reposts || '',
      v.metrics?.shares || '',
      v.thumbnail || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

(async function() {
  'use strict';

  // Initialize storage
  const storage = new VideoStorage();

  let allVideos = [];
  let filteredVideos = [];

  // DOM elements
  const elements = {
    totalCount: document.getElementById('total-count'),
    youtubeCount: document.getElementById('youtube-count'),
    instagramCount: document.getElementById('instagram-count'),
    linkedinCount: document.getElementById('linkedin-count'),
    searchInput: document.getElementById('search-input'),
    platformFilter: document.getElementById('platform-filter'),
    videosList: document.getElementById('videos-list'),
    emptyState: document.getElementById('empty-state'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    clearAllBtn: document.getElementById('clear-all-btn')
  };

  // Initialize
  async function init() {
    await loadVideos();
    setupEventListeners();
  }

  // Load videos from storage
  async function loadVideos() {
    allVideos = await storage.getAll();
    console.log('Loaded videos:', allVideos);
    applyFilters();
    updateStats();
    renderVideos();
  }

  // Setup event listeners
  function setupEventListeners() {
    elements.searchInput.addEventListener('input', handleSearch);
    elements.platformFilter.addEventListener('change', applyFilters);
    elements.exportJsonBtn.addEventListener('click', handleExportJson);
    elements.exportCsvBtn.addEventListener('click', handleExportCsv);
    elements.clearAllBtn.addEventListener('click', handleClearAll);
  }

  // Handle search
  function handleSearch(e) {
    applyFilters();
  }

  // Apply filters
  function applyFilters() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const platform = elements.platformFilter.value;

    filteredVideos = allVideos.filter(video => {
      // Platform filter
      if (platform !== 'all' && video.platform !== platform) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const matchesTitle = video.title.toLowerCase().includes(searchTerm);
        const matchesAuthor = video.author.toLowerCase().includes(searchTerm);
        return matchesTitle || matchesAuthor;
      }

      return true;
    });

    renderVideos();
  }

  // Update statistics
  function updateStats() {
    const youtube = allVideos.filter(v => v.platform === 'youtube').length;
    const instagram = allVideos.filter(v => v.platform === 'instagram').length;
    const linkedin = allVideos.filter(v => v.platform === 'linkedin').length;

    elements.totalCount.textContent = allVideos.length;
    elements.youtubeCount.textContent = youtube;
    elements.instagramCount.textContent = instagram;
    elements.linkedinCount.textContent = linkedin;
  }

  // Render videos
  function renderVideos() {
    console.log('Rendering videos:', filteredVideos);
    if (filteredVideos.length === 0) {
      elements.videosList.innerHTML = '';
      elements.emptyState.style.display = 'flex';
      return;
    }

    elements.emptyState.style.display = 'none';

    elements.videosList.innerHTML = filteredVideos.map(video => `
      <div class="video-card" data-url="${escapeHtml(video.url)}">
        <div class="video-header">
          <span class="platform-badge ${video.platform}">${video.platform}</span>
          <span class="video-date">${formatDate(video.savedAt)}</span>
        </div>
        <div class="video-content">
          <div class="video-title">${escapeHtml(video.title)}</div>
          <div class="video-author">${escapeHtml(video.author)}</div>
          ${video.description ? `<div class="video-description">${escapeHtml(truncateText(video.description, 150))}</div>` : ''}
          ${video.music ? `<div class="video-music">🎵 ${escapeHtml(video.music)}</div>` : ''}
          ${renderMetrics(video.metrics, video.watchDuration)}
          <div class="video-actions">
            <button class="video-btn primary open-btn">Open Video</button>
            <button class="video-btn copy-btn">Copy URL</button>
            <button class="video-btn danger remove-btn">Remove</button>
          </div>
        </div>
      </div>
    `).join('');

    // Add event listeners to video cards using event delegation
    document.querySelectorAll('.video-card').forEach(card => {
      const url = card.dataset.url;

      const openBtn = card.querySelector('.open-btn');
      const copyBtn = card.querySelector('.copy-btn');
      const removeBtn = card.querySelector('.remove-btn');

      if (openBtn) {
        openBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openVideo(url);
        });
      }

      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          copyUrl(url);
        });
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          removeVideo(url);
        });
      }
    });
  }

  // Render metrics
  function renderMetrics(metrics, watchDuration) {
    const items = [];

    // Add watch duration first if available
    if (watchDuration && watchDuration > 0) {
      items.push(`<span class="metric">⏱ Watched ${formatDuration(watchDuration)}</span>`);
    }

    if (metrics && metrics.views !== null && metrics.views !== undefined) {
      items.push(`<span class="metric">👁 ${formatNumber(metrics.views)} views</span>`);
    }

    if (metrics && metrics.likes !== null && metrics.likes !== undefined) {
      items.push(`<span class="metric">❤ ${formatNumber(metrics.likes)} likes</span>`);
    }

    if (metrics && metrics.dislikes !== null && metrics.dislikes !== undefined) {
      items.push(`<span class="metric">👎 ${formatNumber(metrics.dislikes)} dislikes</span>`);
    }

    if (metrics && metrics.comments !== null && metrics.comments !== undefined) {
      items.push(`<span class="metric">💬 ${formatNumber(metrics.comments)} comments</span>`);
    }

    if (metrics && metrics.reposts !== null && metrics.reposts !== undefined) {
      items.push(`<span class="metric">🔄 ${formatNumber(metrics.reposts)} reposts</span>`);
    }

    if (metrics && metrics.shares !== null && metrics.shares !== undefined) {
      items.push(`<span class="metric">📤 ${formatNumber(metrics.shares)} shares</span>`);
    }

    if (items.length === 0) return '';

    return `<div class="video-metrics">${items.join('')}</div>`;
  }

  // Open video in new tab
  function openVideo(url) {
    chrome.tabs.create({ url });
  }

  // Copy URL to clipboard
  async function copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      showToast('URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy URL:', err);
      showToast('Failed to copy URL');
    }
  }

  // Remove video
  async function removeVideo(url) {
    try {
      console.log('Removing video:', url);

      // Remove from storage
      await storage.remove(url);
      console.log('Video removed from storage');

      // Reload videos
      allVideos = await storage.getAll();
      console.log('Videos reloaded:', allVideos.length);

      // Reapply filters
      applyFilters();

      // Update stats
      updateStats();

      showToast('Video removed!');
    } catch (error) {
      console.error('Error removing video:', error);
      showToast('Failed to remove video');
    }
  }

  // Handle export JSON
  async function handleExportJson() {
    const json = await storage.exportJSON();
    downloadFile('virality-sense-export.json', json, 'application/json');
    showToast('Exported as JSON!');
  }

  // Handle export CSV
  async function handleExportCsv() {
    const csv = await storage.exportCSV();
    if (!csv) {
      showToast('No videos to export');
      return;
    }
    downloadFile('virality-sense-export.csv', csv, 'text/csv');
    showToast('Exported as CSV!');
  }

  // Handle clear all
  async function handleClearAll() {
    try {
      console.log('Clear all clicked');
      const userConfirmed = confirm('Are you sure you want to clear all saved videos? This cannot be undone.');

      if (userConfirmed) {
        console.log('User confirmed, clearing storage...');
        await storage.clearAll();
        console.log('Storage cleared');

        // Reload videos
        allVideos = [];
        filteredVideos = [];

        updateStats();
        renderVideos();

        showToast('All videos cleared!');
      }
    } catch (error) {
      console.error('Error clearing videos:', error);
      showToast('Failed to clear videos');
    }
  }

  // Download file
  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Format date
  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }

  // Format number
  function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  // Format duration in seconds to readable string
  function formatDuration(seconds) {
    if (!seconds || seconds < 1) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Truncate text for display
  function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Show toast notification
  function showToast(message) {
    // Create simple toast (you could enhance this)
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 10000;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
  }

  // Start the app
  init();
})();
