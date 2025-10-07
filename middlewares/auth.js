// middleware/auth.js
// const jwt = require('jsonwebtoken');
//
// /**
//  * auth({ optional = false } = {})
//  * optional=false => токен обязателен (401 если нет)
//  * optional=true  => если токена нет -> req.user = null, если есть -> валидируем
//  */
// function auth({ optional = false } = {}) {
//   return function (req, res, next) {
//
//     console.log("auth token");
//
//     const auth = req.headers.authorization || '';
//     const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
//
//     if (!token) {
//       if (optional) {
//         req.user = null;
//         console.log('[auth] No token provided. optional=true -> proceeding with req.user=null');
//         return next();
//       }
//       console.warn('[auth] No token provided. Access denied (required token).');
//       return res.status(401).json({ message: 'Unauthorized' });
//     }
//
//     try {
//       const payload = jwt.verify(token, process.env.JWT_SECRET);
//
//       // Базовая валидация payload
//       const hasSub = payload && (typeof payload.sub === 'string' || typeof payload.sub === 'number');
//       const hasScope = payload && typeof payload.scope === 'string';
//       if (!hasSub) {
//         return res.status(401).json({ message: 'Invalid token: missing user id' });
//       }
//       if (!hasScope) {
//         return res.status(401).json({ message: 'Invalid token: missing scope' });
//       }
//
//       // Пример: ожидаем, что обычный токен имеет такой scope
//       // При необходимости адаптируй под свои требования
//       req.user = {
//         id: payload.sub,
//         scope: payload.scope,
//         // дополнительные поля по мере необходимости
//       };
//
//       console.log('[auth] req.user set:', req.user);
//       return next();
//     } catch (e) {
//       console.error('[auth] Token verification failed:', e.message);
//       return res.status(401).json({ message: 'Invalid token' });
//     }
//   };
// }
//
// // module.exports = {
// //   auth,
// // };
//
// module.exports = { auth };











//--------------------------------------------------------------

// server/middlewares/auth.js
const jwt = require('jsonwebtoken');

function auth({ optional = false } = {}) {
  return function (req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      if (optional) {
        req.user = null;
        return next();
      }
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const hasSub = payload && (typeof payload.sub === 'string' || typeof payload.sub === 'number');
      if (!hasSub) {
        return res.status(401).json({ message: 'Invalid token: missing user id' });
      }

      req.user = {
        id: payload.sub,   // user id
        scope: payload.scope || 'user',
      };

      return next();
    } catch (e) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}

module.exports = { auth };

