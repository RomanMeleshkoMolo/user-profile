// Геокодинг города профиля → GeoJSON Point для гео-поиска «Кто рядом» (user-meets).
// Nominatim (OSM): без ключа, лимит ~1 req/s — хватает для событий регистрации
// и смены города. Ошибка/недоступность не блокирует сохранение локации.
// Тот же модуль продублирован в user-profile (сервисы в разных репо, как locationParser).

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIMEOUT_MS = 5000;

/**
 * @param {string} location — строка локации из профиля ("Харьков" или "Люботин, Харьковская область, Украина")
 * @returns {Promise<{type: 'Point', coordinates: [number, number]} | null>} [lng, lat] или null
 */
async function geocodeCity(location) {
  if (!location || typeof location !== 'string') return null;
  try {
    const params = new URLSearchParams({
      q: location,
      format: 'json',
      limit: '1',
      'accept-language': 'ru',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': 'Molo-Dating-App/1.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const results = await res.json();
    const hit = Array.isArray(results) ? results[0] : null;
    const lat = parseFloat(hit?.lat);
    const lon = parseFloat(hit?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { type: 'Point', coordinates: [lon, lat] };
  } catch (e) {
    console.warn('[geocode] failed for', JSON.stringify(location), '-', e.message);
    return null;
  }
}

module.exports = { geocodeCity };
