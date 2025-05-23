import { Artist } from '../models/artist.model.js';
// import { ApiError } from '../utils/ApiError.js';

export const isValidArtist = async (req, res, next) => {
  try {
    const artistId = req.user?.id;

    if (!artistId) {
      return res.status(401).json({ message:'Unauthorized - Artist authentication required' });
      // throw new ApiError(401, 'Unauthorized - Artist authentication required');
    }

    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
      // throw new ApiError(404, 'Artist not found');
    }

    // Attach artist to request object
    req.artist = artist;
    next();
  } catch (error) {
    next(error);
  }
}; 