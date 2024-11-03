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
  getReplyForAComment,
} = require("../controller/post.controller");
const postRouter = express.Router();

postRouter.get("/", getAllPosts);
postRouter.get("/getallcomments", getAllComments);
postRouter.get("/getalllikes", getAllLikes);

postRouter.get("/getcommentforpost/:postId", getCommentForPost);
// postRouter.get("/getreplyforacomment", getReplyForAComment);
postRouter.get("/:id", getPost);

postRouter.get("/getpostbyartist/:artistId", getAllPostByArtist);
postRouter.post("/createpost", createPost);
postRouter.post("/likepost", likePost);
postRouter.post("/commentonpost", commentOnPost);

// router.delete("/:id", deleteUsergetAllUsers);

module.exports = postRouter;
