const mongoose = require('mongoose');
const User = require('../models/userModel');
const Report = require('../models/reportModel');

function getReqUserId(req) {
  return (
    req.user?._id ||
    req.user?.id ||
    req.auth?.userId ||
    req.regUserId ||
    req.userId ||
    null
  );
}

const VALID_REASONS = ['fake', 'offensive', 'underage', 'scam', 'spam', 'abuse', 'other'];

/**
 * POST /profile/report — пожаловаться на пользователя
 * body: { reportedUserId, reason, subReason? }
 */
async function reportUser(req, res) {
  try {
    const userId = getReqUserId(req);
    const { reportedUserId, reason, subReason = null } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!reportedUserId || !mongoose.Types.ObjectId.isValid(String(reportedUserId))) {
      return res.status(400).json({ message: 'Invalid reportedUserId' });
    }
    if (!reason || !VALID_REASONS.includes(String(reason))) {
      return res.status(400).json({ message: 'Invalid reason' });
    }

    await Report.create({
      reporterId: userId,
      reportedUserId,
      reason: String(reason),
      subReason: subReason ? String(subReason).slice(0, 200) : null,
    });

    console.log(`[safety] Report: ${userId} → ${reportedUserId} (${reason})`);
    return res.status(201).json({ success: true });
  } catch (e) {
    console.error('[safety] reportUser error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * POST /profile/block — заблокировать пользователя
 * body: { userId }
 */
async function blockUser(req, res) {
  try {
    const userId = getReqUserId(req);
    const { userId: targetId } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!targetId || !mongoose.Types.ObjectId.isValid(String(targetId)) || String(targetId) === String(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    await User.findByIdAndUpdate(userId, { $addToSet: { blockedUsers: targetId } });
    console.log(`[safety] Block: ${userId} blocked ${targetId}`);
    return res.json({ success: true });
  } catch (e) {
    console.error('[safety] blockUser error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

/**
 * DELETE /profile/block/:userId — разблокировать
 */
async function unblockUser(req, res) {
  try {
    const userId = getReqUserId(req);
    const { userId: targetId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!targetId || !mongoose.Types.ObjectId.isValid(String(targetId))) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    await User.findByIdAndUpdate(userId, { $pull: { blockedUsers: targetId } });
    return res.json({ success: true });
  } catch (e) {
    console.error('[safety] unblockUser error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { reportUser, blockUser, unblockUser };
