const fetch = require('node-fetch');
const mongoose = require('mongoose');

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';

/**
 * Premium royalty-free stock images from Unsplash to ensure the platform
 * always looks highly professional and never shows empty gray placeholder blocks.
 */
const categoryStockImages = {
  AI: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=600&q=80',
  Cybersecurity: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
  Software: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
  Cloud: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=600&q=80',
  IT: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  Technology: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
  Science: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
  Education: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=600&q=80',
  Research: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=600&q=80',
  Business: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
  General: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80'
};

const getCategoryStockImage = (category) => {
  return categoryStockImages[category] || categoryStockImages.General;
};

/**
 * Get yesterday's date (IST) in YYYY-MM-DD format for NewsAPI date filtering.
 * The digest sent at 7 AM on June 16 should contain news from June 15.
 */
const getYesterdayIST = () => {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const yesterday = new Date(istNow);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
};

/**
 * Get today's date (IST) in YYYY-MM-DD format
 */
const getTodayIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  return istNow.toISOString().split('T')[0];
};

/**
 * Load titles from the last N days of sent digests to prevent repeating articles.
 * Returns a Set of normalized (lowercased, trimmed) titles.
 */
const loadRecentDigestTitles = async (days = 3) => {
  const titles = new Set();
  try {
    const Digest = mongoose.model('Digest');
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
 * Helper to fetch articles safely from NewsAPI with error handling
 */
const safeFetchArticles = async (url) => {
  if (!NEWS_API_KEY) {
    console.warn('⚠️ NEWS_API_KEY is not defined in environment variables.');
    return [];
  }
  try {
    const response = await fetch(url);
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
    console.error('Error fetching from NewsAPI:', error.message);
    return [];
  }
};

/**
 * Check if an article is related to India/Indian context
 */
const isIndiaRelated = (title, description, source) => {
  const text = `${title} ${description || ''} ${source || ''}`.toLowerCase();
  const indiaKeywords = [
    'india', 'indian', 'bangalore', 'bengaluru', 'mumbai', 'delhi', 'chennai', 
    'hyderabad', 'kolkata', 'iit', 'nit', 'iisc', 'isro', 'tcs', 'infosys', 
    'wipro', 'hcl', 'cognizant', 'rbi', 'upi', 'aicte', 'ugc', 'startup india',
    'smart india hackathon', 'cert-in', 'hiring india', 'nifty', 'sensex',
    'zoho', 'paytm', 'ola', 'flipkart', 'jio', 'reliance'
  ];
  return indiaKeywords.some(kw => text.includes(kw));
};

/**
 * IT category priority scores for sorting.
 * Jobs/Internships/AI get highest priority in the IT section.
 */
const IT_PRIORITY = {
  'Jobs': 1,
  'AI': 2,
  'Software': 3,
  'Cybersecurity': 4,
  'Cloud': 5,
  'IT': 6,
  'Technology': 7
};

/**
 * Detect if an article is about jobs, internships, hiring, or career
 */
const isJobRelated = (text) => {
  const t = text.toLowerCase();
  const jobKeywords = [
    'hiring', 'recruitment', 'job', 'jobs', 'internship', 'intern',
    'career', 'placement', 'salary', 'opening', 'vacancy', 'fresher',
    'campus', 'off-campus', 'walk-in', 'layoff', 'layoffs', 'workforce'
  ];
  return jobKeywords.some(kw => t.includes(kw));
};

/**
 * Mixes live articles dynamically:
 * - Filters out articles already sent in recent digests (dedup).
 * - Dynamic count between min and max based on available fresh news.
 * - Enforces exactly 60% India / 40% Global ratio.
 * - Sorts India-focused articles first, then by recency.
 */
const mixIndiaAndWorld = (liveArticles, min, max, categorizeFn, recentTitles) => {
  // Clean and filter out removed or incomplete articles
  const cleanArticles = (liveArticles || []).filter(a => 
    a.title && 
    a.title !== '[Removed]' && 
    a.description && 
    a.url &&
    !a.title.toLowerCase().includes('removed')
  );

  // Map and deduplicate by URL, Title, AND against recent digests
  const seenUrls = new Set();
  const seenTitles = new Set();
  const uniqueLive = [];

  for (const a of cleanArticles) {
    const titleNorm = a.title.toLowerCase().trim();

    // Skip if duplicate within this batch
    if (seenUrls.has(a.url) || seenTitles.has(titleNorm)) continue;

    // Skip if this title was already sent in recent digests
    if (recentTitles.has(titleNorm)) continue;

    seenUrls.add(a.url);
    seenTitles.add(titleNorm);

    const cat = categorizeFn(a.title + ' ' + (a.description || ''));

    uniqueLive.push({
      title: a.title,
      description: a.description || 'Click to read the full article.',
      url: a.url,
      urlToImage: a.urlToImage || getCategoryStockImage(cat),
      source: a.source?.name || 'News Source',
      publishedAt: a.publishedAt || new Date().toISOString(),
      category: cat,
      isIndia: isIndiaRelated(a.title, a.description, a.source?.name)
    });
  }

  // Split live unique articles into India and World pools
  const liveIndia = uniqueLive.filter(a => a.isIndia);
  const liveWorld = uniqueLive.filter(a => !a.isIndia);

  // Decide the dynamic count C (between min and max based on total live unique news)
  let C = uniqueLive.length;
  if (C < min) C = min;
  if (C > max) C = max;

  // Calculate target counts for exactly 60% India and 40% World
  const targetIndiaCount = Math.round(C * 0.6);
  const targetWorldCount = C - targetIndiaCount;

  const finalIndia = liveIndia.slice(0, targetIndiaCount);
  const finalWorld = liveWorld.slice(0, targetWorldCount);

  // If we have excess India articles and not enough World, redistribute
  if (finalWorld.length < targetWorldCount && liveIndia.length > targetIndiaCount) {
    const extraNeeded = targetWorldCount - finalWorld.length;
    const extraIndia = liveIndia.slice(targetIndiaCount, targetIndiaCount + extraNeeded);
    finalIndia.push(...extraIndia);
  }
  // Vice versa
  if (finalIndia.length < targetIndiaCount && liveWorld.length > targetWorldCount) {
    const extraNeeded = targetIndiaCount - finalIndia.length;
    const extraWorld = liveWorld.slice(targetWorldCount, targetWorldCount + extraNeeded);
    finalWorld.push(...extraWorld);
  }

  // Combine pools
  const combined = [...finalIndia, ...finalWorld];

  // Sort: India-related first, then global, then by recency
  combined.sort((a, b) => {
    if (a.isIndia && !b.isIndia) return -1;
    if (!a.isIndia && b.isIndia) return 1;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });

  return combined;
};

/**
 * Auto-categorize IT articles based on keywords.
 * Jobs/internships get special 'Jobs' category for priority sorting.
 */
const categorizeIT = (text) => {
  const t = text.toLowerCase();

  // Jobs & Internships get highest priority
  if (isJobRelated(t)) return 'Jobs';

  if (t.includes('artificial intelligence') || t.includes(' ai ') || t.includes('machine learning') || t.includes('chatgpt') || t.includes('llm') || t.includes('generative') || t.includes('deep learning') || t.includes('copilot') || t.includes('openai') || t.includes('gemini')) return 'AI';
  if (t.includes('cyber') || t.includes('hack') || t.includes('breach') || t.includes('malware') || t.includes('ransomware') || t.includes('vulnerability') || t.includes('phishing') || t.includes('security') || t.includes('cert-in')) return 'Cybersecurity';
  if (t.includes('software') || t.includes('developer') || t.includes('coding') || t.includes('programming') || t.includes('github') || t.includes('open source') || t.includes('framework') || t.includes('react') || t.includes('node') || t.includes('python') || t.includes('rust')) return 'Software';
  if (t.includes('cloud') || t.includes('aws') || t.includes('azure') || t.includes('google cloud') || t.includes('data center') || t.includes('saas') || t.includes('devops') || t.includes('docker') || t.includes('kubernetes')) return 'Cloud';
  return 'IT';
};

/**
 * Auto-categorize Education articles
 */
const categorizeEducation = (text) => {
  const t = text.toLowerCase();
  if (t.includes('university') || t.includes('college') || t.includes('campus') || t.includes('student') || t.includes('degree') || t.includes('education') || t.includes('b.tech') || t.includes('engineering') || t.includes('gate exam') || t.includes('aicte')) return 'Education';
  if (t.includes('research') || t.includes('study') || t.includes('scientists') || t.includes('discovery') || t.includes('innovation') || t.includes('breakthrough')) return 'Research';
  if (t.includes('space') || t.includes('nasa') || t.includes('isro') || t.includes('physics') || t.includes('chemistry') || t.includes('biology')) return 'Science';
  return 'Education';
};

/**
 * Fetch IT-sector news with date filtering for fresh content.
 * Priority: Jobs/Internships > AI > Frameworks/Tools > Cybersecurity > Cloud > General IT
 */
const fetchITNews = async (recentTitles) => {
  try {
    const yesterday = getYesterdayIST();
    const today = getTodayIST();

    const indiaTechUrl = `${BASE_URL}/top-headlines?category=technology&country=in&pageSize=30&apiKey=${NEWS_API_KEY}`;
    const globalTechUrl = `${BASE_URL}/top-headlines?category=technology&language=en&pageSize=30&apiKey=${NEWS_API_KEY}`;
    
    // Everything search with date range filter (yesterday to today) for truly fresh news
    const searchUrl = `${BASE_URL}/everything?q=(hiring OR internship OR "AI" OR framework OR "software developer" OR cybersecurity OR programming OR coding OR "IT company" OR tool OR release)&language=en&from=${yesterday}&to=${today}&sortBy=publishedAt&pageSize=40&apiKey=${NEWS_API_KEY}`;

    const [indiaTech, globalTech, searchTech] = await Promise.all([
      safeFetchArticles(indiaTechUrl),
      safeFetchArticles(globalTechUrl),
      safeFetchArticles(searchUrl)
    ]);

    const combined = [...indiaTech, ...globalTech, ...searchTech];
    let results = mixIndiaAndWorld(combined, 10, 20, categorizeIT, recentTitles);

    // Sort IT results by priority: Jobs first, then AI, then Software, etc.
    results.sort((a, b) => {
      // India first
      if (a.isIndia && !b.isIndia) return -1;
      if (!a.isIndia && b.isIndia) return 1;
      // Then by category priority
      const pa = IT_PRIORITY[a.category] || 99;
      const pb = IT_PRIORITY[b.category] || 99;
      if (pa !== pb) return pa - pb;
      // Then by recency
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    return results;
  } catch (error) {
    console.error('Error fetching IT news:', error.message);
    return [];
  }
};

/**
 * Fetch Education-related news with date filtering
 */
const fetchEducationNews = async (recentTitles) => {
  try {
    const yesterday = getYesterdayIST();
    const today = getTodayIST();

    const indiaScienceUrl = `${BASE_URL}/top-headlines?category=science&country=in&pageSize=20&apiKey=${NEWS_API_KEY}`;
    const globalScienceUrl = `${BASE_URL}/top-headlines?category=science&language=en&pageSize=20&apiKey=${NEWS_API_KEY}`;
    
    const searchUrl = `${BASE_URL}/everything?q=(GATE OR B.Tech OR IIT OR university OR scholarship OR internship OR research OR AICTE OR UGC OR education OR college OR science OR space)&language=en&from=${yesterday}&to=${today}&sortBy=publishedAt&pageSize=30&apiKey=${NEWS_API_KEY}`;

    const [indiaSci, globalSci, searchEdu] = await Promise.all([
      safeFetchArticles(indiaScienceUrl),
      safeFetchArticles(globalScienceUrl),
      safeFetchArticles(searchUrl)
    ]);

    const combined = [...indiaSci, ...globalSci, ...searchEdu];
    return mixIndiaAndWorld(combined, 6, 12, categorizeEducation, recentTitles);
  } catch (error) {
    console.error('Error fetching Education news:', error.message);
    return [];
  }
};

/**
 * Fetch General / Other news with date filtering
 */
const fetchGeneralNews = async (recentTitles) => {
  try {
    const indiaBusinessUrl = `${BASE_URL}/top-headlines?category=business&country=in&pageSize=15&apiKey=${NEWS_API_KEY}`;
    const globalBusinessUrl = `${BASE_URL}/top-headlines?category=business&language=en&pageSize=15&apiKey=${NEWS_API_KEY}`;

    const [indiaBus, globalBus] = await Promise.all([
      safeFetchArticles(indiaBusinessUrl),
      safeFetchArticles(globalBusinessUrl)
    ]);

    const combined = [...indiaBus, ...globalBus];
    return mixIndiaAndWorld(combined, 4, 8, () => 'General', recentTitles);
  } catch (error) {
    console.error('Error fetching General news:', error.message);
    return [];
  }
};

/**
 * Fetch ALL news for daily digest.
 * 1. Loads titles from the last 3 sent digests for deduplication.
 * 2. Fetches fresh news with date-range filters (yesterday only).
 * 3. Removes any article that was already sent in a previous digest.
 * 4. IT section prioritizes: Jobs/Internships > AI > Frameworks > Cybersecurity > Cloud.
 */
const fetchAllNewsForDigest = async () => {
  console.log('📰 Fetching FRESH news with dedup (60% India / 40% World)...');

  // Load recent digest titles for deduplication
  const recentTitles = await loadRecentDigestTitles(3);

  const [itNews, educationNews, generalNews] = await Promise.all([
    fetchITNews(recentTitles),
    fetchEducationNews(recentTitles),
    fetchGeneralNews(recentTitles),
  ]);

  console.log(`   IT: ${itNews.length} | Education: ${educationNews.length} | General: ${generalNews.length}`);
  
  if (itNews.length === 0 && educationNews.length === 0 && generalNews.length === 0) {
    console.warn('   ⚠️ No fresh news found. API may be exhausted or all articles were deduped.');
  }

  return { itNews, educationNews, generalNews };
};

module.exports = { fetchITNews, fetchEducationNews, fetchGeneralNews, fetchAllNewsForDigest };
