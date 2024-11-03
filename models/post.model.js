const mongoose = require("mongoose");

// Event Schema for event type posts
const EventSchema = new mongoose.Schema({
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  venue: String,
  ticketLink: String,
  price: {
    type: Number,
    default: 0
  },
  isVirtual: {
    type: Boolean,
    default: false
  },
  maxAttendees: Number,
  eventType: {
    type: String,
    enum: ['concert', 'meetup', 'exhibition', 'workshop', 'other'],
    default: 'other'
  }
});

// Announcement Schema for announcement type posts
const AnnouncementSchema = new mongoose.Schema({
  importance: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  expiryDate: Date,
  isPinned: {
    type: Boolean,
    default: false
  },
  targetAudience: {
    type: String,
    enum: ['all', 'subscribers', 'members'],
    default: 'all'
  }
});

const MediaSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['image', 'video', 'audio', 'gif']
  },
  url: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  duration: Number,
  mimeType: String,
  size: Number,
  width: Number,
  height: Number,
});

const PostSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: function() {
        return this.postType === 'event' || this.postType === 'announcement';
      },
      trim: true
    },
    postType: {
      type: String,
      required: true,
      enum: ['regular', 'event', 'announcement'],
      default: 'regular'
    },
    type: {
      type: String,
      required: true,
      enum: ['single', 'multiple', 'album'],
      default: 'single'
    },
    media: [MediaSchema],
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "artist",
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "community"
    },
    eventDetails: {
      type: EventSchema,
      required: function() {
        return this.postType === 'event';
      }
    },
    announcementDetails: {
      type: AnnouncementSchema,
      required: function() {
        return this.postType === 'announcement';
      }
    },
    tags: [{ type: String }],
    category: {
      type: String,
      required: true,
      enum: ['artwork', 'music', 'photography', 'design', 'other']
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public'
    },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    genre: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual populate for comments and likes
PostSchema.virtual('comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'postId'
});

PostSchema.virtual('likes', {
    ref: 'Like',
    localField: '_id',
    foreignField: 'postId'
});

// Pre-save middleware to validate dates for events
PostSchema.pre('save', function(next) {
  if (this.postType === 'event' && this.eventDetails) {
    if (this.eventDetails.startDate > this.eventDetails.endDate) {
      next(new Error('Event end date must be after start date'));
    }
    if (this.eventDetails.startDate < new Date()) {
      next(new Error('Event start date must be in the future'));
    }
  }
  next();
});

const Post = mongoose.model("posts", PostSchema);

module.exports = Post;
