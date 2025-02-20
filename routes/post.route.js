import { Router } from "express";
import {
  getAllPosts,
  getPost,
  getAllPostByArtist,
  getAllPostsByCommunity,
  createPost,
  updatePost,
  deletePost,
  likePost,
  commentOnPost,
  getPostComments,
  getEventAttendees,
  toggleEventAttendance,
  getUpcomingEvents,
  getActiveAnnouncements,
  getCommentReplies
} from "../controller/post.controller.js";

const postRouter = Router();

// General post routes
postRouter.get("/", getAllPosts);
postRouter.get("/:id", getPost);
postRouter.post("/createPost", createPost);
postRouter.put("/:id", updatePost);
postRouter.delete("/:id", deletePost);

// Artist and community specific routes
postRouter.get("/artist/:artistId", getAllPostByArtist);
postRouter.get("/community/:communityId", getAllPostsByCommunity);

// Interaction routes
postRouter.post("/like", likePost);
postRouter.post("/comment", commentOnPost);
postRouter.get("/:postId/comments", getPostComments);
postRouter.get("/comments/:commentId/replies", getCommentReplies);

// Event specific routes
postRouter.get("/events/upcoming", getUpcomingEvents);
postRouter.get("/:postId/attendees", getEventAttendees);
postRouter.post("/events/attend", toggleEventAttendance);

// Announcement routes
postRouter.get("/announcements/active", getActiveAnnouncements);

export default postRouter;
