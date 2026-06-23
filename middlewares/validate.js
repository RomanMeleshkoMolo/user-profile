const Joi = require('joi');

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map(d => d.message).join('; ');
      return res.status(400).json({ message: messages });
    }
    next();
  };
}

const schemas = {
  updateProfile: Joi.object({
    name: Joi.string().min(1).max(100),
    age: Joi.number().integer().min(18).max(100),
    about: Joi.string().max(1000).allow(''),
    work: Joi.string().max(200).allow(''),
    education: Joi.string().max(50),
    zodiac: Joi.string().max(30),
    relationship: Joi.string().max(30),
    children: Joi.string().max(30),
    smoking: Joi.string().max(30),
    alcohol: Joi.string().max(30),
    languages: Joi.array().items(Joi.string().max(30)).max(10),
    pets: Joi.array().items(Joi.string().max(30)).max(10),
    interests: Joi.array().items(Joi.string().max(50)).max(20),
    lookingFor: Joi.object(),
    gender: Joi.object(),
    wishUser: Joi.string().max(20),
    userSex: Joi.string().max(30),
    userLocation: Joi.string().max(255),
    forceIncognito: Joi.boolean(),
    questionAnswers: Joi.object().pattern(Joi.string().max(50), Joi.string().max(200)),
  }).unknown(false),

  addPhoto: Joi.object({
    photos: Joi.array().items(Joi.object({
      key: Joi.string().max(500).required(),
      filename: Joi.string().max(255),
      mimeType: Joi.string().max(50),
      size: Joi.number().max(50 * 1024 * 1024),
    })).max(10).required(),
  }),
};

module.exports = { validate, schemas };
