const queueSchema = new mongoose.Schema({
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: true
    },
    trackId: {
      type: Schema.Types.ObjectId,
      ref: 'tracks',
      required: true
    },
    position: {
      type: Number,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    playedAt: Date
  });

  queueSchema.index({ title: "text" });

const Queue = mongoose.model("tracks", queueSchema);

module.exports = Queue;
