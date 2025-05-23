import { Schema, model } from "mongoose";

const withdrawalSchema = new Schema({
  artistId: {
    type: Schema.Types.ObjectId,
    ref: 'artist',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  bankAccount: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export const Withdrawal = model('withdrawal', withdrawalSchema); 