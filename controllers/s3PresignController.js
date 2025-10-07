const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
  region: "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});
const BUCKET = "uploads-photo";

const { getUserById } = require('../services/userService');

/**
 * Возвращает presigned URL для ключа в S3
 * key: путь к объекту в бакете, например "user-photos/1759511937987_731ulc2c3ti_undefined"
 * expiresInSec: время жизни ссылки в секундах (по умолчанию 3600)
 */
async function getPresignedUrl(key, expiresInSec = 3600) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

/**
 * Обработчик Express для получения presigned URL по id пользователя
 * req.params.id - идентификатор пользователя
 * req.db - ваш доступ к БД (адаптируйте под вашу инфраструктуру)
 */
async function avatarPresignHandler(req, res) {

  console.log("ggggg");

  try {
    const userId = req.params.id;

    console.log( userId );

    // const user = await req.db?.users?.findById?.(userId);
     const user = await getUserById(userId);

    console.log( user );

    const key = user?.userPhoto[user.userPhoto.length - 1];

    console.log( key );

    if (!key) {
      return res.status(404).json({ error: "no photo" });
    }

    const url = await getPresignedUrl(key);
    res.json({ url });


    // res.json({ url: 'https://cakeshop.com.ua/images/AcpSe7kFpmzMfgJUwhyXbNbja_gwkleunua5ZVM9jTQ/h:5000/bG9jYWw/6Ly8vY2FrZXNob3AuY29tLnVhL3B1YmxpY19odG1sL3N0b3JhZ2UvYXBwL3B1YmxpYy9pbWcvcHJvZHVjdC81NzEzXzEuanBn' });
  } catch (err) {
    console.error("Error generating presigned URL:", err);
    res.status(500).json({ error: "internal_error" });
  }
}

module.exports = {
  avatarPresignHandler,
  getPresignedUrl, // экспортируем если нужен отдельно
};
