const express = require("express");
const {
  getAllPosts,
  getPost,
  getAllPostByArtist,
  createPost,
  likePost,
  commentOnPost,
  getAllComments,
  getAllLikes,
  getCommentForPost,
  getAllPostsByCommunity,
  getUpcomingEvents,
  getActiveAnnouncements,
} = require("../controller/post.controller");
const postRouter = express.Router();

postRouter.get("/", getAllPosts);
postRouter.get("/getallcomments", getAllComments);
postRouter.get("/getalllikes", getAllLikes);
postRouter.get("/getcommentforpost/:postId", getCommentForPost);
postRouter.get("/:id", getPost);
postRouter.get("/getpostbyartist/:artistId", getAllPostByArtist);
postRouter.get("/community/:communityId", getAllPostsByCommunity);

// New routes for events and announcements
postRouter.get("/events/upcoming", getUpcomingEvents);
postRouter.get("/announcements/active", getActiveAnnouncements);

// Post creation and interaction routes
postRouter.post("/createpost", createPost);
postRouter.post("/likepost", likePost);
postRouter.post("/commentonpost", commentOnPost);

module.exports = postRouter;
