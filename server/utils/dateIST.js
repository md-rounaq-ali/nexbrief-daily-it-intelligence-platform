const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Returns YYYY-MM-DD for the current date in IST (UTC+5:30).
 */
const getTodayIST = () => {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  return istNow.toISOString().split('T')[0];
};

/**
 * Returns YYYY-MM-DD for yesterday in IST (UTC+5:30).
 */
const getYesterdayIST = () => {
  const istYesterday = new Date(Date.now() + IST_OFFSET_MS - 24 * 60 * 60 * 1000);
  return istYesterday.toISOString().split('T')[0];
};

module.exports = { getTodayIST, getYesterdayIST };
