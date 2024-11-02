const generateCoverImage = (songCount) => {
  // Default cover images for empty playlists
  if (songCount === 0) {
    return "https://i.pinimg.com/564x/2c/23/17/2c2317fb606f8dad772f8b2a63dc1b07.jpg";
  }

  // Generate a gradient-based cover for non-empty playlists
  const gradients = [
    "linear-gradient(45deg, #FF0000, #FF8C00)", // Red-Orange
    "linear-gradient(45deg, #4B0082, #9400D3)", // Purple
    "linear-gradient(45deg, #006400, #98FB98)", // Green
    "linear-gradient(45deg, #00008B, #87CEEB)", // Blue
    "linear-gradient(45deg, #8B4513, #DEB887)", // Brown
  ];

  const randomGradient =
    gradients[Math.floor(Math.random() * gradients.length)];
  return randomGradient;
};

module.exports = generateCoverImage;
