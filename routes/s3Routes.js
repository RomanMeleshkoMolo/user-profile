const express = require("express");
const router = express.Router();
const { avatarPresignHandler } = require("../controllers/s3PresignController");

// GET /api/user/:id/avatar
// Возвращает { url: "<presigned-url>" }
router.get("/api/user/:id/avatar", avatarPresignHandler);

module.exports = router;
