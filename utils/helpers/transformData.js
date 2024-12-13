export const transformTrackData = (data) => {
  return {
    _id: data._id || data.trackId || data.songId,
    artist: {
      _id: data.artist?._id || data.artistData?._id,
      name: data.artist?.name || data.artistData?.name,
      image: data.artist?.image || data.artistData?.profileImage
    },
    featuredArtists: (data.featuredArtists || []).map(artist => ({
      _id: artist._id,
      name: artist.name
    })),
    playbackInfo: {
      deviceType: data.deviceType || data.playbackInfo?.deviceType,
      quality: data.quality || data.playbackInfo?.quality,
      completionRate: data.completionRate || data.playbackInfo?.completionRate
    },
    release: {
      _id: data.release?._id || data.releaseData?._id,
      title: data.release?.title || data.releaseData?.title,
      type: data.release?.type || data.releaseData?.type,
      artwork: {
        high: data.release?.artwork?.high || data.releaseData?.artwork?.cover_image?.high,
        medium: data.release?.artwork?.medium || data.releaseData?.artwork?.cover_image?.medium,
        low: data.release?.artwork?.low || data.releaseData?.artwork?.cover_image?.low,
        thumbnail: data.release?.artwork?.thumbnail || data.releaseData?.artwork?.cover_image?.thumbnail
      },
      releaseDate: data.release?.releaseDate || data.releaseData?.dates?.release_date
    },
    track: {
      title: data.track?.title || data.trackDetails?.title || data.title,
      duration: data.track?.duration || data.trackDetails?.duration || data.duration,
      isExplicit: data.track?.isExplicit || data.trackDetails?.flags?.isExplicit || false,
      trackNumber: data.track?.trackNumber || data.trackDetails?.track_number
    }
  };
};

// module.exports ={
//   transformTrackData
// }
