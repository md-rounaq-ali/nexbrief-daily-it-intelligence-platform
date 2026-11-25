const fetch = require('node-fetch');
const Digest = require('../models/Digest');
const { getTodayIST, getDaysAgoIST } = require('../utils/dateIST');
const { cleanNewsText, enrichDigestSections } = require('./aiService');

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';

/**
 * Premium royalty-free stock images from Unsplash so cards never appear empty.
 */
const categoryStockImages = {
  Jobs:          'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=600&q=80',
  AI:            'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=600&q=80',
  Cybersecurity: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
  Software:      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
  Cloud:         'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=600&q=80',
  IT:            'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  Technology:    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
  Science:       'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
  Education:     'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=600&q=80',
  Research:      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=600&q=80',
  Business:      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
  General:       'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80',
};

const getCategoryStockImage = (category) => {
  return categoryStockImages[category] || categoryStockImages.General;
};

const decodeXmlEntities = (str = '') => {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

/**
 * Load titles from the last N days of sent digests to prevent repeating articles.
 */
const loadRecentDigestTitles = async (days = 3) => {
  const titles = new Set();
  try {
    const recentDigests = await Digest.find({ status: 'sent' })
      .sort({ date: -1 })
      .limit(days)
      .select('itNews educationNews generalNews');

    for (const digest of recentDigests) {
      for (const section of [digest.itNews, digest.educationNews, digest.generalNews]) {
        if (section) {
          for (const article of section) {
            if (article.title) {
              titles.add(article.title.toLowerCase().trim());
            }
          }
        }
      }
    }
    console.log(`   📋 Loaded ${titles.size} titles from last ${days} digests for dedup`);
  } catch (err) {
    console.warn('   ⚠️ Could not load recent digest titles for dedup:', err.message);
  }
  return titles;
};

/**
 * Safe NewsAPI JSON fetcher with timeout
 */
const safeFetchArticles = async (url) => {
  if (!NEWS_API_KEY) {
    console.warn('⚠️ NEWS_API_KEY is not defined in environment variables.');
    return [];
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.warn(`NewsAPI non-ok response: ${response.status}`);
      return [];
    }
    const data = await response.json();
    if (data.status !== 'ok') {
      console.warn('NewsAPI status warning:', data.message);
      return [];
    }
    return data.articles || [];
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Error fetching from NewsAPI:', error.message);
    return [];
  }
};

/**
 * Fetch real-time India-focused news from Google News India RSS (zero delay, free fallback & India booster)
 */
const safeFetchGoogleNewsRSS = async (searchQuery, markAsIndia = true, limit = 20) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery + ' when:3d')}&hl=en-IN&gl=IN&ceid=IN:en`;
    const response = await fetch(rssUrl, {
      headers: { 'User-Agent': 'NexBrief/1.0 (+https://nexbrief-news.onrender.com)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return [];

    const xml = await response.text();
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const articles = [];
    const maxAgeMs = 4 * 24 * 60 * 60 * 1000;

    for (const block of itemMatches) {
      if (articles.length >= limit) break;
      const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const rawPub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const rawSource = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';

      const sourceName = cleanNewsText(decodeXmlEntities(rawSource)) || 'India News';
      let title = cleanNewsText(decodeXmlEntities(rawTitle));
      // Google News RSS appends " - Source Name" to titles
      if (sourceName && title.endsWith(` - ${sourceName}`)) {
        title = title.slice(0, -(` - ${sourceName}`.length)).trim();
      } else {
        title = title.replace(/\s+-\s+[^-]+$/, '').trim();
      }

      const url = decodeXmlEntities(rawLink).trim();
      if (!title || !url || !/^https?:\/\//i.test(url)) continue;

      const pubDate = rawPub ? new Date(rawPub) : new Date();
      if (Number.isNaN(pubDate.getTime()) || Date.now() - pubDate.getTime() > maxAgeMs) continue;

      articles.push({
        title,
        description: `Published by ${sourceName}. Open full coverage for complete details, deadlines, and technical breakdown.`,
        url,
        urlToImage: null,
        source: { name: sourceName },
        publishedAt: pubDate.toISOString(),
        _forceIndia: markAsIndia,
      });
    }

    return articles;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Google News RSS warning:', err.message);
    return [];
  }
};

/**
 * STRICT RELEVANCE FILTER
 */
const IRRELEVANT_KEYWORDS = [
  'gta', 'grand theft auto', 'playstation', 'xbox', 'nintendo', 'gaming',
  'game review', 'esports', 'twitch', 'streamer', 'fortnite', 'minecraft',
  'valorant', 'pubg', 'free fire', 'call of duty', 'elden ring', 'steam sale',
  'movie', 'film', 'trailer', 'celebrity', 'actor', 'actress', 'singer',
  'music album', 'box office', 'ott release', 'web series', 'reality show',
  'reality tv', 'talk show', 'award show', 'oscar', 'grammy', 'golden globe',
  'cricket', 'ipl', 'football', 'fifa', 'nba', 'tennis', 'wrestling', 'wwe',
  'icc', 'bcci', 'olympics', 'asian games', 'sports match',
  'bollywood', 'fashion', 'beauty tips', 'recipe', 'cooking', 'horoscope',
  'astrology', 'zodiac', 'makeup', 'skincare', 'diet', 'weight loss',
  'leaked video', 'leaked photos', 'viral video', 'meme', 'tiktok viral',
  'election rally', 'vote bank', 'political party', 'minister speech',
];

const isRelevantArticle = (title, description) => {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  return !IRRELEVANT_KEYWORDS.some((kw) => text.includes(kw));
};

/**
 * INDIA DETECTION — EXPANDED
 */
const isIndiaRelated = (title, description, source, forceIndia = false) => {
  if (forceIndia) return true;
  const text = `${title} ${description || ''} ${source || ''}`.toLowerCase();
  const indiaKeywords = [
    'india', 'indian', 'bharat',
    'bangalore', 'bengaluru', 'mumbai', 'delhi', 'chennai',
    'hyderabad', 'kolkata', 'pune', 'noida', 'gurugram', 'gurgaon',
    'ahmedabad', 'coimbatore', 'kochi', 'bhubaneswar', 'jaipur',
    'indore', 'nagpur', 'lucknow', 'chandigarh', 'thiruvananthapuram',
    'iit', 'nit', 'iiit', 'iisc', 'bits pilani', 'nit trichy',
    'aicte', 'ugc', 'mhrd', 'nep', 'nirf', 'swayam', 'nptel',
    'isro', 'rbi', 'upi', 'cert-in', 'startup india', 'digital india',
    'meity', 'nasscom', 'sebi', 'niti aayog', 'union budget',
    'tcs', 'infosys', 'wipro', 'hcl', 'cognizant', 'tech mahindra',
    'mphasis', 'hexaware', 'mindtree', 'ltimindtree', 'persistent systems',
    'freshworks', 'razorpay', 'cred', 'byju', 'naukri', 'zerodha',
    'paytm', 'ola', 'flipkart', 'jio', 'reliance', 'adani',
    'angel one', 'zoho', 'accenture india', 'amazon india',
    'microsoft india', 'google india', 'oracle india', 'ibm india',
    'deloitte india', 'capgemini india', 'times of india', 'economic times',
    'hindustan times', 'moneycontrol', 'livemint', 'ndtv', 'business standard',
    'nifty', 'sensex', 'bse', 'nse',
    'smart india hackathon', 'hiring india', 'placement india',
    'tier 2', 'campus recruitment india',
  ];
  return indiaKeywords.some((kw) => text.includes(kw));
};

const IT_PRIORITY = {
  'Jobs': 1,
  'AI': 2,
  'Software': 3,
  'Cybersecurity': 4,
  'Cloud': 5,
  'IT': 6,
  'Technology': 7,
};

const isJobRelated = (text) => {
  const t = text.toLowerCase();
  const jobRegex = /\b(hiring|recruitment|internship|internships|intern|fresher|freshers|off-campus|off campus|campus placement|placement drive|walk-in|job opening|jobs|vacancy|vacancies|layoff|layoffs|workforce|entry level|junior developer|graduate trainee|associate engineer|naukri|software engineer role|tech hiring)\b/i;
  return jobRegex.test(t);
};

const mixIndiaAndWorld = (liveArticles, min, max, categorizeFn, recentTitles) => {
  const cleanArticles = (liveArticles || []).filter(
    (a) =>
      a.title &&
      a.title !== '[Removed]' &&
      a.description &&
      a.url &&
      !a.title.toLowerCase().includes('removed')
  );

  const relevantArticles = cleanArticles.filter((a) =>
    isRelevantArticle(a.title, a.description)
  );

  const seenUrls = new Set();
  const seenTitles = new Set();
  const uniqueLive = [];

  for (const a of relevantArticles) {
    const cleanTitle = cleanNewsText(a.title);
    const cleanDesc = cleanNewsText(a.description) || 'Click to read the full article.';
    const titleNorm = cleanTitle.toLowerCase();

    if (!cleanTitle || seenUrls.has(a.url) || seenTitles.has(titleNorm)) continue;
    if (recentTitles.has(titleNorm)) continue;

    seenUrls.add(a.url);
    seenTitles.add(titleNorm);

    const cat = categorizeFn(`${cleanTitle} ${cleanDesc}`);

    uniqueLive.push({
      title: cleanTitle,
      description: cleanDesc,
      url: a.url,
      urlToImage: a.urlToImage || getCategoryStockImage(cat),
      source: a.source?.name || 'News Source',
      publishedAt: a.publishedAt || new Date().toISOString(),
      category: cat,
      isIndia: isIndiaRelated(cleanTitle, cleanDesc, a.source?.name, Boolean(a._forceIndia)),
    });
  }

  const liveIndia = uniqueLive.filter((a) => a.isIndia);
  const liveWorld = uniqueLive.filter((a) => !a.isIndia);

  let C = uniqueLive.length;
  if (C < min) C = min;
  if (C > max) C = max;

  const targetIndiaCount = Math.round(C * 0.6);
  const targetWorldCount = C - targetIndiaCount;

  const finalIndia = liveIndia.slice(0, targetIndiaCount);
  const finalWorld = liveWorld.slice(0, targetWorldCount);

  if (finalWorld.length < targetWorldCount && liveIndia.length > targetIndiaCount) {
    const extraNeeded = targetWorldCount - finalWorld.length;
    finalIndia.push(...liveIndia.slice(targetIndiaCount, targetIndiaCount + extraNeeded));
  }
  if (finalIndia.length < targetIndiaCount && liveWorld.length > targetWorldCount) {
    const extraNeeded = targetIndiaCount - finalIndia.length;
    finalWorld.push(...liveWorld.slice(targetWorldCount, targetWorldCount + extraNeeded));
  }

  const combined = [...finalIndia, ...finalWorld];
  combined.sort((a, b) => {
    if (a.isIndia && !b.isIndia) return -1;
    if (!a.isIndia && b.isIndia) return 1;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });

  return combined;
};

const categorizeIT = (text) => {
  const t = text.toLowerCase();

  if (isJobRelated(t)) return 'Jobs';

  if (
    t.includes('artificial intelligence') || t.includes(' ai ') || t.includes('machine learning') ||
    t.includes('chatgpt') || t.includes('llm') || t.includes('generative') || t.includes('deep learning') ||
    t.includes('copilot') || t.includes('openai') || t.includes('gemini') || t.includes('claude') ||
    t.includes('agentic') || t.includes('large language model') || t.includes('neural network')
  ) return 'AI';

  if (
    t.includes('cyber') || t.includes('hack') || t.includes('breach') || t.includes('malware') ||
    t.includes('ransomware') || t.includes('vulnerability') || t.includes('phishing') ||
    t.includes('security') || t.includes('cert-in') || t.includes('zero day') || t.includes('ddos')
  ) return 'Cybersecurity';

  if (
    t.includes('software') || t.includes('developer') || t.includes('coding') || t.includes('programming') ||
    t.includes('github') || t.includes('open source') || t.includes('framework') || t.includes('react') ||
    t.includes('node.js') || t.includes('python') || t.includes('rust') || t.includes('typescript') ||
    t.includes('flutter') || t.includes('dart') || t.includes('swift') || t.includes('kotlin') ||
    t.includes('next.js') || t.includes('vue') || t.includes('django') || t.includes('fastapi') ||
    t.includes('mongodb') || t.includes('postgresql') || t.includes('redis') || t.includes('vs code') ||
    t.includes('visual studio') || t.includes('api') || t.includes('sdk') || t.includes('release')
  ) return 'Software';

  if (
    t.includes('cloud') || t.includes('aws') || t.includes('azure') || t.includes('google cloud') ||
    t.includes('data center') || t.includes('saas') || t.includes('devops') || t.includes('docker') ||
    t.includes('kubernetes') || t.includes('serverless') || t.includes('microservices')
  ) return 'Cloud';

  return 'IT';
};

const categorizeEducation = (text) => {
  const t = text.toLowerCase();
  if (
    t.includes('university') || t.includes('college') || t.includes('campus') ||
    t.includes('student') || t.includes('degree') || t.includes('education') ||
    t.includes('b.tech') || t.includes('engineering') || t.includes('gate') ||
    t.includes('aicte') || t.includes('ugc') || t.includes('scholarship') ||
    t.includes('placement') || t.includes('hackathon') || t.includes('edtech') ||
    t.includes('nptel') || t.includes('swayam') || t.includes('iit') || t.includes('nit')
  ) return 'Education';

  if (
    t.includes('research') || t.includes('study') || t.includes('scientists') ||
    t.includes('discovery') || t.includes('innovation') || t.includes('breakthrough') ||
    t.includes('journal') || t.includes('paper published') || t.includes('quantum')
  ) return 'Research';

  if (
    t.includes('space') || t.includes('nasa') || t.includes('isro') ||
    t.includes('physics') || t.includes('chemistry') || t.includes('biology') ||
    t.includes('astronomy') || t.includes('satellite') || t.includes('rocket')
  ) return 'Science';

  return 'Education';
};

/**
 * Helper to build NewsAPI `/everything` URL using a 3-day IST date range
 * (prevents empty results right after midnight IST due to NewsAPI's 24h free-tier lag)
 */
const buildEverythingUrl = (query, pageSize = 25) => {
  const fromDate = getDaysAgoIST(3);
  const toDate = getTodayIST();
  return `${BASE_URL}/everything?q=${encodeURIComponent(query)}&language=en&from=${fromDate}&to=${toDate}&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${NEWS_API_KEY}`;
};

/**
 * fetchITNews — Hybrid NewsAPI + Google News India RSS
 */
const fetchITNews = async (recentTitles) => {
  try {
    const indiaJobsUrl = buildEverythingUrl(
      'India AND (hiring OR recruitment OR internship OR "campus placement" OR fresher OR TCS OR Infosys OR Wipro OR HCL OR Cognizant OR Accenture)',
      25
    );
    const devToolsUrl = buildEverythingUrl(
      '(OpenAI OR ChatGPT OR Gemini OR Claude OR "Agentic AI" OR React OR Python OR GitHub OR cybersecurity OR AWS OR Kubernetes) AND (developer OR software OR AI OR cloud OR programming)',
      25
    );
    const globalTechUrl = `${BASE_URL}/top-headlines?category=technology&language=en&pageSize=30&apiKey=${NEWS_API_KEY}`;

    const [indiaJobsRss, devTools, indiaJobsApi, globalTech] = await Promise.all([
      safeFetchGoogleNewsRSS('India IT hiring TCS Infosys Wipro internship fresher software jobs', true, 16),
      safeFetchArticles(devToolsUrl),
      safeFetchArticles(indiaJobsUrl),
      safeFetchArticles(globalTechUrl),
    ]);

    const combined = [...indiaJobsRss, ...indiaJobsApi, ...devTools, ...globalTech];
    const results = mixIndiaAndWorld(combined, 10, 20, categorizeIT, recentTitles);

    results.sort((a, b) => {
      if (a.isIndia && !b.isIndia) return -1;
      if (!a.isIndia && b.isIndia) return 1;
      const pa = IT_PRIORITY[a.category] || 99;
      const pb = IT_PRIORITY[b.category] || 99;
      if (pa !== pb) return pa - pb;
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    return results;
  } catch (error) {
    console.error('Error fetching IT news:', error.message);
    return [];
  }
};

/**
 * fetchEducationNews — Hybrid NewsAPI + Google News India RSS
 */
const fetchEducationNews = async (recentTitles) => {
  try {
    const indiaEduUrl = buildEverythingUrl(
      'India AND (GATE OR IIT OR NIT OR AICTE OR UGC OR "B.Tech" OR scholarship OR "campus placement" OR ISRO OR hackathon)',
      25
    );
    const globalScienceUrl = `${BASE_URL}/top-headlines?category=science&language=en&pageSize=20&apiKey=${NEWS_API_KEY}`;

    const [indiaEduRss, indiaEduApi, globalSci] = await Promise.all([
      safeFetchGoogleNewsRSS('India B.Tech IIT NIT GATE AICTE UGC placement scholarship ISRO', true, 12),
      safeFetchArticles(indiaEduUrl),
      safeFetchArticles(globalScienceUrl),
    ]);

    const combined = [...indiaEduRss, ...indiaEduApi, ...globalSci];
    return mixIndiaAndWorld(combined, 6, 12, categorizeEducation, recentTitles);
  } catch (error) {
    console.error('Error fetching Education news:', error.message);
    return [];
  }
};

/**
 * fetchGeneralNews — Hybrid NewsAPI + Google News India RSS
 */
const fetchGeneralNews = async (recentTitles) => {
  try {
    const globalPolicyUrl = buildEverythingUrl(
      '(economy OR "startup funding" OR fintech OR "Digital India" OR "AI regulation" OR semiconductor OR GCC) AND (India OR global OR tech)',
      20
    );
    const globalBizUrl = `${BASE_URL}/top-headlines?category=business&language=en&pageSize=20&apiKey=${NEWS_API_KEY}`;

    const [indiaBizRss, globalPolicyApi, globalBiz] = await Promise.all([
      safeFetchGoogleNewsRSS('India tech startup funding economy Digital India fintech GCC', true, 10),
      safeFetchArticles(globalPolicyUrl),
      safeFetchArticles(globalBizUrl),
    ]);

    const combined = [...indiaBizRss, ...globalPolicyApi, ...globalBiz];
    return mixIndiaAndWorld(combined, 4, 8, () => 'General', recentTitles);
  } catch (error) {
    console.error('Error fetching General news:', error.message);
    return [];
  }
};

const fetchAllNewsForDigest = async () => {
  console.log('📰 Fetching FRESH student-focused news (60% India / 40% World) via NewsAPI + India RSS...');

  const recentTitles = await loadRecentDigestTitles(3);

  const [rawItNews, rawEduNews, rawGenNews] = await Promise.all([
    fetchITNews(recentTitles),
    fetchEducationNews(recentTitles),
    fetchGeneralNews(recentTitles),
  ]);

  const { itNews, educationNews, generalNews } = await enrichDigestSections({
    itNews: rawItNews,
    educationNews: rawEduNews,
    generalNews: rawGenNews,
  });

  console.log(`   ✅ IT: ${itNews.length} articles | Education: ${educationNews.length} | World: ${generalNews.length}`);

  if (itNews.length === 0 && educationNews.length === 0 && generalNews.length === 0) {
    console.warn('   ⚠️ No fresh news found across all sources.');
  }

  return { itNews, educationNews, generalNews };
};

module.exports = { fetchITNews, fetchEducationNews, fetchGeneralNews, fetchAllNewsForDigest };
