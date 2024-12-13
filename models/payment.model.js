// models/post.model.js

import { Schema, SchemaTypes, model } from "mongoose";

const TransactionsSchema = new Schema({
  transactionId: {
    // https://paystack.com/docs/changelog/api/#june-2022
    type: SchemaTypes.BigInt,
    // If we are pre-creating transaction references, "required" should be false here,
    // as we don't yet have transaction data on initialization, 
    // we only get it on verification API calls/webhook-events.
    // Although we can always call "verify" endpoint immediately after intialization,
    // but before creating the "TransactionSchema" document, that way, we have all needed data.
    required: true
  },
  referenceId: { type: String, unique: true, required: true },
  user: { type: SchemaTypes.ObjectId, ref: 'users', required: true },
  email: { type: String, required: true },
  amount: { type: String, required: true },
  processedBy: {
    type: String,
    enum: ['PSTK', 'FLTW'],
    required: true
  },
  status: {
    type: String,
    required: true,
    validate: {
      validator: function (value) {
        switch (this.processedBy) {
          case "PSTK":
            // Possible Paystack transaction status.
            return ['success', 'reversed', 'processing', 'queued', 'pending', 'ongoing', 'failed', 'abandoned'].includes(value);

          case "FLTW":
            // Possible Flutterwave transaction status.
            return ['success', 'reversed', 'pending', 'failed'].includes(value);

          default:
            break;
        }
        return false;
      }
    }
  },
  rawTransactionData: {
    type: SchemaTypes.Map,
    of: SchemaTypes.Mixed,
    // If we are pre-creating transaction references,
    // "required" should be false here, as we don't yet have transaction data.
    required: true
  },
  description: {
    type: String,
  },
  transactionDate: { type: SchemaTypes.Date, required: true }
},
  { timestamps: true }
);

// const PostSchema = new mongoose.Schema(
//   {
//     content: {
//       type: String,
//       required: true,
//       trim: true
//     },
//     title: {
//       type: String,
//       required: function () {
//         return this.postType === 'event' || this.postType === 'announcement';
//       },
//       trim: true
//     },
//     postType: {
//       type: String,
//       required: true,
//       enum: ['regular', 'event', 'announcement'],
//       default: 'regular'
//     },
//     type: {
//       type: String,
//       required: true,
//       enum: ['single', 'multiple', 'album'],
//       default: 'single'
//     },
//     media: [MediaSchema],
//     artistId: {
//       type: mongoose.Schema.Types.ObjectId,
//       required: true,
//       ref: "artist",
//     },
//     communityId: {
//       type: mongoose.Schema.Types.ObjectId,
//       required: true,
//       ref: "community"
//     },
//     eventDetails: {
//       type: EventSchema,
//       required: function () {
//         return this.postType === 'event';
//       }
//     },
//     announcementDetails: {
//       type: AnnouncementSchema,
//       required: function () {
//         return this.postType === 'announcement';
//       }
//     },
//     tags: [{ type: String }],
//     category: {
//       type: String,
//       required: true,
//       enum: ['artwork', 'music', 'photography', 'design', 'other']
//     },
//     visibility: {
//       type: String,
//       enum: ['public', 'private', 'unlisted'],
//       default: 'public'
//     },
//     likeCount: { type: Number, default: 0 },
//     commentCount: { type: Number, default: 0 },
//     shareCount: { type: Number, default: 0 },
//     status: {
//       type: String,
//       enum: ['draft', 'published', 'archived'],
//       default: 'published'
//     },
//     genre: { type: String },
//   },
//   {
//     timestamps: true,
//     toJSON: { virtuals: true },
//     toObject: { virtuals: true }
//   }
// );

// // Virtuals
// PostSchema.virtual('comments', {
//   ref: 'Comment',
//   localField: '_id',
//   foreignField: 'postId'
// });

// PostSchema.virtual('likes', {
//   ref: 'Like',
//   localField: '_id',
//   foreignField: 'postId'
// });

// // Middleware
// PostSchema.pre('save', function (next) {
//   // Validate event dates
//   if (this.postType === 'event' && this.eventDetails) {
//     if (this.eventDetails.startDate > this.eventDetails.endDate) {
//       next(new Error('Event end date must be after start date'));
//     }
//     if (this.eventDetails.startDate < new Date()) {
//       next(new Error('Event start date must be in the future'));
//     }

//     // Check if event is fully booked
//     if (this.eventDetails.maxAttendees &&
//       this.eventDetails.attendees &&
//       this.eventDetails.attendees.length >= this.eventDetails.maxAttendees) {
//       this.eventDetails.isFullyBooked = true;
//     }
//   }
//   next();
// });

export const Transactions = model("transactions", TransactionsSchema);
