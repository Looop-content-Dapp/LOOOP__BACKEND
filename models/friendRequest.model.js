import { Schema, model } from "mongoose";

const friendRequestSchema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for sender and receiver
friendRequestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

// Prevent duplicate friend requests
friendRequestSchema.pre("save", async function (next) {
  if (this.isNew) {
    const existingRequest = await this.constructor.findOne({
      $or: [
        { senderId: this.senderId, receiverId: this.receiverId },
        { senderId: this.receiverId, receiverId: this.senderId },
      ],
    });
    if (existingRequest) {
      const err = new Error(
        "Friend request already exists between these users"
      );
      err.status = 400;
      return next(err);
    }
  }
  next();
});

export const FriendRequest = model("FriendRequest", friendRequestSchema);
