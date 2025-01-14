import { Schema, model } from "mongoose";

const queueSchema = new Schema({
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

export const Queue = model("tracks", queueSchema);
