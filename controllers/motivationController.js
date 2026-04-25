const phrases = require('../data/motivationalPhrases.json');

const getTodayDate = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

exports.getDailyPhrase = (req, res) => {
  try {
    const userId   = req.user?.id || req.user?._id || req.query.userId || '';
    const dayIndex = Math.floor(Date.now() / 1000 / 86400);
    const hexStr   = String(userId).replace(/[^0-9a-f]/gi, '0').slice(-6) || '000000';
    const seed     = parseInt(hexStr, 16) || 0;
    const index    = (seed + dayIndex) % phrases.length;
    const phrase   = phrases[index];

    return res.json({ date: getTodayDate(), phrase: phrase.text, category: phrase.category });
  } catch (e) {
    console.error('[motivation] getDailyPhrase error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
