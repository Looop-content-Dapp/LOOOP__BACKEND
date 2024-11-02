// utils/helpers/coverImageGenerator.js

/**
 * Generates a color value from a string (similar to how Spotify generates consistent colors for the same playlist)
 * @param {string} str - Input string to generate color from
 * @returns {string} - Hex color code
 */
const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }

    const rgb = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 255;
      rgb[i] = value;
    }

    // Ensure colors are vibrant enough
    const minBrightness = 70;
    rgb.forEach((value, index) => {
      if (value < minBrightness) {
        rgb[index] = minBrightness + Math.floor(Math.random() * (255 - minBrightness));
      }
    });

    return `#${rgb.map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
  };

  /**
   * Adjusts a color to create a gradient pair
   * @param {string} color - Base color in hex format
   * @returns {string} - Modified color for gradient
   */
  const createGradientColor = (color) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Modify the color components to create a complementary gradient color
    const newR = (r + 50) % 256;
    const newG = (g + 30) % 256;
    const newB = (b + 70) % 256;

    return `#${[newR, newG, newB].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
  };

  /**
   * Generates an SVG with a Spotify-like gradient background
   * @param {string} title - Playlist title
   * @param {number} trackCount - Number of tracks in playlist
   * @returns {string} - Data URL of the generated SVG
   */
  const generateCoverImage = (title, trackCount = 0) => {
    // Generate base color from playlist title for consistency
    const baseColor = stringToColor(title || 'My Playlist');
    const gradientColor = createGradientColor(baseColor);

    // Create SVG with gradient background
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${baseColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${gradientColor};stop-opacity:1" />
          </linearGradient>
          <filter id="noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" result="noise"/>
            <feColorMatrix type="saturate" values="0.1" in="noise" result="colorNoise"/>
            <feBlend in="SourceGraphic" in2="colorNoise" mode="overlay" result="result"/>
          </filter>
        </defs>
        <rect width="300" height="300" fill="url(#grad)" filter="url(#noise)"/>
        ${trackCount > 0 ? `
          <text x="20" y="280" fill="rgba(255,255,255,0.8)" font-family="Arial" font-size="14">
            ${trackCount} ${trackCount === 1 ? 'track' : 'tracks'}
          </text>
        ` : ''}
      </svg>
    `;

    // Convert SVG to data URL
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    return dataUrl;
  };

  module.exports = {
    generateCoverImage
  };
