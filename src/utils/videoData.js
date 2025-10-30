// Utility functions for extracting video metadata
class VideoDataExtractor {
  // Create standardized video data object
  createVideoData(platform, url, title, author, thumbnail = '', metrics = {}, watchDuration = 0, description = '', music = '') {
    return {
      id: this.generateId(url),
      url: url,
      platform: platform,
      title: title,
      author: author,
      description: description,
      music: music,
      savedAt: new Date().toISOString(),
      thumbnail: thumbnail,
      watchDuration: watchDuration, // in seconds
      metrics: {
        views: metrics.views || null,
        likes: metrics.likes || null,
        dislikes: metrics.dislikes || null,
        comments: metrics.comments || null,
        reposts: metrics.reposts || null,
        shares: metrics.shares || null
      }
    };
  }

  // Format duration in seconds to readable string (e.g., "2m 30s")
  formatDuration(seconds) {
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

  // Generate unique ID from URL
  generateId(url) {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  // Extract number from text (e.g., "1.2M views" -> 1200000)
  parseMetricNumber(text) {
    if (!text) return null;

    const cleanText = text.replace(/[^0-9.KMB]/gi, '');
    const number = parseFloat(cleanText);

    if (isNaN(number)) return null;

    const multipliers = {
      'K': 1000,
      'M': 1000000,
      'B': 1000000000
    };

    const multiplier = text.match(/[KMB]/i);
    if (multiplier) {
      return Math.round(number * multipliers[multiplier[0].toUpperCase()]);
    }

    return Math.round(number);
  }

  // Clean text (remove extra whitespace, newlines, etc.)
  cleanText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
  }

  // Truncate text to max length
  truncate(text, maxLength = 200) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}

// Export for use in content scripts
const videoDataExtractor = new VideoDataExtractor();
