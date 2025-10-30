// Storage utility for managing saved videos
class VideoStorage {
  constructor() {
    this.storageKey = 'virality_sense_videos';
  }

  // Get all saved videos
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.storageKey], (result) => {
        resolve(result[this.storageKey] || []);
      });
    });
  }

  // Save a new video
  async save(videoData) {
    const videos = await this.getAll();

    // Check if video already exists
    const existingIndex = videos.findIndex(v => v.url === videoData.url);

    if (existingIndex === -1) {
      // Add new video
      videos.unshift(videoData);
      await this.setAll(videos);
      return { success: true, message: 'Video saved!', action: 'added' };
    } else {
      // Video already exists
      return { success: false, message: 'Already saved!', action: 'exists' };
    }
  }

  // Remove a video by URL
  async remove(url) {
    const videos = await this.getAll();
    const filtered = videos.filter(v => v.url !== url);

    if (filtered.length < videos.length) {
      await this.setAll(filtered);
      return { success: true, message: 'Video removed!', action: 'removed' };
    }

    return { success: false, message: 'Video not found!', action: 'not_found' };
  }

  // Check if a video is already saved
  async isSaved(url) {
    const videos = await this.getAll();
    return videos.some(v => v.url === url);
  }

  // Set all videos (replace entire storage)
  async setAll(videos) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.storageKey]: videos }, () => {
        resolve();
      });
    });
  }

  // Clear all videos
  async clearAll() {
    return new Promise((resolve) => {
      chrome.storage.local.remove([this.storageKey], () => {
        resolve();
      });
    });
  }

  // Get videos by platform
  async getByPlatform(platform) {
    const videos = await this.getAll();
    return videos.filter(v => v.platform === platform);
  }

  // Export videos as JSON
  async exportJSON() {
    const videos = await this.getAll();
    return JSON.stringify(videos, null, 2);
  }

  // Export videos as CSV
  async exportCSV() {
    const videos = await this.getAll();
    if (videos.length === 0) return '';

    const headers = ['Platform', 'Title', 'Author', 'URL', 'Saved At', 'Views', 'Likes', 'Thumbnail'];
    const rows = videos.map(v => [
      v.platform,
      `"${v.title.replace(/"/g, '""')}"`,
      `"${v.author.replace(/"/g, '""')}"`,
      v.url,
      v.savedAt,
      v.metrics?.views || '',
      v.metrics?.likes || '',
      v.thumbnail || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

// Export for use in content scripts
const videoStorage = new VideoStorage();
