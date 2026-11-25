const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns YYYY-MM-DD for the current date in IST (UTC+5:30).
 */
const getTodayIST = () => {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  return istNow.toISOString().split('T')[0];
};

/**
 * Returns YYYY-MM-DD for N days ago in IST (UTC+5:30).
 */
const getDaysAgoIST = (days = 1) => {
  const istPast = new Date(Date.now() + IST_OFFSET_MS - days * DAY_MS);
  return istPast.toISOString().split('T')[0];
};

/**
 * Returns YYYY-MM-DD for yesterday in IST (UTC+5:30).
 */
const getYesterdayIST = () => getDaysAgoIST(1);

module.exports = { getTodayIST, getYesterdayIST, getDaysAgoIST };
