const fetch = require('node-fetch');
const mongoose = require('mongoose');

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';

/**
 * Premium royalty-free stock images from Unsplash to ensure the platform
 * always looks highly professional and never shows empty gray placeholder blocks.
 */
const categoryStockImages = {
  Jobs:         'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=600&q=80',
  AI:           'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=600&q=80',
  Cybersecurity:'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
  Software:     'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
  Cloud:        'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=600&q=80',
  IT:           'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  Technology:   'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
  Science:      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
  Education:    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=600&q=80',
  Research:     'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=600&q=80',
  Business:     'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
  General:      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80'
};

const getCategoryStockImage = (category) => {
  return categoryStockImages[category] || categoryStockImages.General;
};

/**
 * Get yesterday's date (IST) in YYYY-MM-DD format for NewsAPI date filtering.
 * The digest sent at 7 AM on a date should contain news from the day before.
 */
const getYesterdayIST = () => {
  const now = new Date();
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
 * ============================================================
 * STRICT RELEVANCE FILTER
 * Rejects articles that are clearly irrelevant to IT students:
 * gaming, entertainment, sports, celebrities, lifestyle, etc.
 * This prevents articles like "GTA 6 Leaker Releases Xbox Build"
 * from ever appearing in the IT or any other section.
 * ============================================================
 */
const IRRELEVANT_KEYWORDS = [
  // Gaming
  'gta', 'grand theft auto', 'playstation', 'xbox', 'nintendo', 'gaming',
  'game review', 'esports', 'twitch', 'streamer', 'fortnite', 'minecraft',
  'valorant', 'pubg', 'free fire', 'call of duty', 'elden ring', 'steam sale',
  // Entertainment
  'movie', 'film', 'trailer', 'celebrity', 'actor', 'actress', 'singer',
  'music album', 'box office', 'ott release', 'web series', 'reality show',
  'reality tv', 'talk show', 'award show', 'oscar', 'grammy', 'golden globe',
  // Sports (non-tech)
  'cricket', 'ipl', 'football', 'fifa', 'nba', 'tennis', 'wrestling', 'wwe',
  'icc', 'bcci', 'olympics', 'asian games', 'sports match',
  // Lifestyle / Tabloid
  'bollywood', 'fashion', 'beauty tips', 'recipe', 'cooking', 'horoscope',
  'astrology', 'zodiac', 'makeup', 'skincare', 'diet', 'weight loss',
  // Leaked / Viral junk
  'leaked video', 'leaked photos', 'viral video', 'meme', 'tiktok viral',
  // Politics (unrelated to tech/policy)
  'election rally', 'vote bank', 'political party', 'minister speech',
];

const isRelevantArticle = (title, description) => {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  return !IRRELEVANT_KEYWORDS.some(kw => text.includes(kw));
};

/**
 * ============================================================
 * INDIA DETECTION — EXPANDED
 * Much larger keyword list including tier-2 cities, Indian
 * IT companies, universities, startups, and regional sources.
 * ============================================================
 */
const isIndiaRelated = (title, description, source) => {
  const text = `${title} ${description || ''} ${source || ''}`.toLowerCase();
  const indiaKeywords = [
    // Country / general
    'india', 'indian', 'bharat',
    // Major metro cities
    'bangalore', 'bengaluru', 'mumbai', 'delhi', 'chennai',
    'hyderabad', 'kolkata', 'pune', 'noida', 'gurugram', 'gurgaon',
    // Tier-2 IT hubs
    'ahmedabad', 'coimbatore', 'kochi', 'bhubaneswar', 'jaipur',
    'indore', 'nagpur', 'lucknow', 'chandigarh', 'thiruvananthapuram',
    // Institutions
    'iit', 'nit', 'iiit', 'iisc', 'bits pilani', 'nit trichy',
    'aicte', 'ugc', 'mhrd', 'nep', 'nirf', 'swayam', 'nptel',
    // Govt / regulatory
    'isro', 'rbi', 'upi', 'cert-in', 'startup india', 'digital india',
    'meity', 'nasscom', 'sebi', 'niti aayog', 'union budget',
    // Top IT companies (India HQ or major India ops)
    'tcs', 'infosys', 'wipro', 'hcl', 'cognizant', 'tech mahindra',
    'mphasis', 'hexaware', 'mindtree', 'ltimindtree', 'persistent systems',
    'freshworks', 'razorpay', 'cred', 'byju', 'naukri', 'zerodha',
    'paytm', 'ola', 'flipkart', 'jio', 'reliance', 'adani',
    'angel one', 'zoho', 'accenture india', 'amazon india',
    'microsoft india', 'google india', 'oracle india', 'ibm india',
    'deloitte india', 'capgemini india',
    // Finance / market
    'nifty', 'sensex', 'bse', 'nse',
    // Education
    'smart india hackathon', 'hiring india', 'placement india',
    'tier 2', 'campus recruitment india'
  ];
  return indiaKeywords.some(kw => text.includes(kw));
};

/**
 * IT category priority scores for sorting.
 * Jobs/Internships get the absolute highest priority.
 */
const IT_PRIORITY = {
  'Jobs':         1,  // Hiring, internships, placements — most useful for students
  'AI':           2,  // AI tools, LLMs, generative AI
  'Software':     3,  // Dev tools, frameworks, releases
  'Cybersecurity':4,
  'Cloud':        5,
  'IT':           6,
  'Technology':   7
};

/**
 * Detect if an article is about jobs, internships, hiring, or career
 */
const isJobRelated = (text) => {
  const t = text.toLowerCase();
  const jobKeywords = [
    'hiring', 'recruitment', 'job', 'jobs', 'internship', 'intern',
    'career', 'placement', 'salary', 'opening', 'vacancy', 'fresher',
    'campus', 'off-campus', 'off campus', 'walk-in', 'layoff', 'layoffs',
    'workforce', 'entry level', 'junior developer', 'graduate trainee',
    'associate engineer', 'naukri', 'linkedin jobs'
  ];
  return jobKeywords.some(kw => t.includes(kw));
};

/**
 * ============================================================
 * mixIndiaAndWorld — Core mixing engine
 * - Removes duplicates and recently-sent articles
 * - Enforces 60% India / 40% World ratio
 * - Sorts India-first, then by recency
 * ============================================================
 */
const mixIndiaAndWorld = (liveArticles, min, max, categorizeFn, recentTitles) => {
  // 1. Remove empty / removed articles
  const cleanArticles = (liveArticles || []).filter(a =>
    a.title &&
    a.title !== '[Removed]' &&
    a.description &&
    a.url &&
    !a.title.toLowerCase().includes('removed')
  );

  // 2. Apply strict relevance filter to remove gaming / entertainment junk
  const relevantArticles = cleanArticles.filter(a =>
    isRelevantArticle(a.title, a.description)
  );

  // 3. Deduplicate by URL and title, skip recently-sent titles
  const seenUrls = new Set();
  const seenTitles = new Set();
  const uniqueLive = [];

  for (const a of relevantArticles) {
    const titleNorm = a.title.toLowerCase().trim();

    if (seenUrls.has(a.url) || seenTitles.has(titleNorm)) continue;
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

  // 4. Split into India and World pools
  const liveIndia = uniqueLive.filter(a => a.isIndia);
  const liveWorld = uniqueLive.filter(a => !a.isIndia);

  // 5. Dynamic count C clamped between min and max
  let C = uniqueLive.length;
  if (C < min) C = min;
  if (C > max) C = max;

  // 6. 60% India / 40% World
  const targetIndiaCount = Math.round(C * 0.6);
  const targetWorldCount = C - targetIndiaCount;

  const finalIndia = liveIndia.slice(0, targetIndiaCount);
  const finalWorld = liveWorld.slice(0, targetWorldCount);

  // 7. Backfill if one pool is short
  if (finalWorld.length < targetWorldCount && liveIndia.length > targetIndiaCount) {
    const extraNeeded = targetWorldCount - finalWorld.length;
    finalIndia.push(...liveIndia.slice(targetIndiaCount, targetIndiaCount + extraNeeded));
  }
  if (finalIndia.length < targetIndiaCount && liveWorld.length > targetWorldCount) {
    const extraNeeded = targetIndiaCount - finalIndia.length;
    finalWorld.push(...liveWorld.slice(targetWorldCount, targetWorldCount + extraNeeded));
  }

  // 8. Combine and sort: India first, then by recency
  const combined = [...finalIndia, ...finalWorld];
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

  if (
    t.includes('artificial intelligence') || t.includes(' ai ') || t.includes('machine learning') ||
    t.includes('chatgpt') || t.includes('llm') || t.includes('generative') || t.includes('deep learning') ||
    t.includes('copilot') || t.includes('openai') || t.includes('gemini ai') || t.includes('claude ai') ||
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
    t.includes('visual studio') || t.includes('api release') || t.includes('sdk') || t.includes('release')
  ) return 'Software';

  if (
    t.includes('cloud') || t.includes('aws') || t.includes('azure') || t.includes('google cloud') ||
    t.includes('data center') || t.includes('saas') || t.includes('devops') || t.includes('docker') ||
    t.includes('kubernetes') || t.includes('serverless') || t.includes('microservices')
  ) return 'Cloud';

  return 'IT';
};

/**
 * Auto-categorize Education articles
 */
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
 * ============================================================
 * fetchITNews — STUDENT-FOCUSED, INDIA-FIRST IT NEWS
 *
 * 4 targeted parallel searches:
 *   1. India IT jobs & hiring (HIGHEST priority for students)
 *   2. AI, frameworks & developer tools (globally relevant tech)
 *   3. India top-headlines tech (breaking India tech news)
 *   4. Cybersecurity & cloud (filtered with India/enterprise context)
 *
 * After fetching, strict isRelevantArticle() filter is applied
 * before mixIndiaAndWorld() to eliminate gaming/entertainment noise.
 * ============================================================
 */
const fetchITNews = async (recentTitles) => {
  try {
    const yesterday = getYesterdayIST();
    const today = getTodayIST();

    // 1. India IT jobs & hiring — HIGHEST PRIORITY for engineering students
    const indiaJobsUrl = `${BASE_URL}/everything?q=(India AND (hiring OR recruitment OR internship OR "off campus" OR "campus placement" OR fresher OR "entry level" OR TCS OR Infosys OR Wipro OR HCL OR Cognizant OR "Tech Mahindra" OR Accenture OR Capgemini OR Deloitte OR "LTIMindtree" OR Mphasis OR Hexaware OR Persistent))&language=en&from=${yesterday}&to=${today}&sortBy=publishedAt&pageSize=30&apiKey=${NEWS_API_KEY}`;

    // 2. AI, frameworks & developer tools — truly relevant tech for coders
    const devToolsUrl = `${BASE_URL}/everything?q=((ChatGPT OR "Gemini AI" OR "Claude AI" OR OpenAI OR LLM OR "Agentic AI" OR React OR "Next.js" OR Python OR "VS Code" OR GitHub OR "open source" OR framework OR API OR "developer tools" OR "software release" OR TypeScript OR Flutter OR Kubernetes OR DevOps) AND (developer OR engineer OR programming OR coding OR software OR student))&language=en&from=${yesterday}&to=${today}&sortBy=publishedAt&pageSize=30&apiKey=${NEWS_API_KEY}`;

    // 3. India tech top-headlines (breaking news)
    const indiaTechUrl = `${BASE_URL}/top-headlines?category=technology&country=in&pageSize=30&apiKey=${NEWS_API_KEY}`;

    // 4. Cybersecurity & cloud — with enterprise/India context to stay relevant
    const securityCloudUrl = `${BASE_URL}/everything?q=((cybersecurity OR "data breach" OR "zero day" OR malware OR ransomware OR "cloud computing" OR AWS OR Azure OR DevOps OR Kubernetes OR "CERT-IN") AND (India OR company OR enterprise OR developer OR students))&language=en&from=${yesterday}&to=${today}&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;

    const [indiaJobs, devTools, indiaTech, securityCloud] = await Promise.all([
      safeFetchArticles(indiaJobsUrl),
      safeFetchArticles(devToolsUrl),
      safeFetchArticles(indiaTechUrl),
      safeFetchArticles(securityCloudUrl)
    ]);

    // Merge all — India jobs first so they get higher dedup priority
    const combined = [...indiaJobs, ...indiaTech, ...devTools, ...securityCloud];

    let results = mixIndiaAndWorld(combined, 10, 20, categorizeIT, recentTitles);

    // Final sort: India-first, then by IT priority (Jobs > AI > Software), then recency
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
 * ============================================================
 * fetchEducationNews — STUDENT-FOCUSED EDUCATION & RESEARCH
 *
 * 3 targeted parallel searches:
 *   1. India education — placements, scholarships, GATE, campus news
 *   2. Global science — top-headlines science category
 *   3. Space & research — ISRO, NASA, breakthroughs
 * ============================================================
 */
const fetchEducationNews = async (recentTitles) => {
  try {
    const yesterday = getYesterdayIST();
    const today = getTodayIST();

    // 1. India education & student news — placements, scholarships, campus news
    const indiaEduUrl = `${BASE_URL}/everything?q=(India AND (placement OR "campus recruitment" OR scholarship OR "GATE 2026" OR "GATE 2025" OR IIT OR NIT OR BITS OR IIIT OR AICTE OR UGC OR "B.Tech" OR engineering OR "college admission" OR hackathon OR "internship for students" OR edtech OR NPTEL OR SWAYAM OR "Smart India Hackathon"))&language=en&from=${yesterday}&to=${today}&sortBy=publishedAt&pageSize=30&apiKey=${NEWS_API_KEY}`;

    // 2. Global science top-headlines
    const globalScienceUrl = `${BASE_URL}/top-headlines?category=science&language=en&pageSize=20&apiKey=${NEWS_API_KEY}`;

    // 3. Space / breakthrough research
    const researchUrl = `${BASE_URL}/everything?q=(ISRO OR NASA OR "space mission" OR "AI research" OR "scientific breakthrough" OR "quantum computing" OR "new study" OR researchers OR "published research" OR "satellite launch")&language=en&from=${yesterday}&to=${today}&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;

    const [indiaEdu, globalSci, research] = await Promise.all([
      safeFetchArticles(indiaEduUrl),
      safeFetchArticles(globalScienceUrl),
      safeFetchArticles(researchUrl)
    ]);

    const combined = [...indiaEdu, ...globalSci, ...research];
    return mixIndiaAndWorld(combined, 6, 12, categorizeEducation, recentTitles);
  } catch (error) {
    console.error('Error fetching Education news:', error.message);
    return [];
  }
};

/**
 * ============================================================
 * fetchGeneralNews — WORLD HEADLINES (meaningful, not filler)
 *
 * 3 sources:
 *   1. India business top-headlines
 *   2. India general top-headlines
 *   3. Global meaningful news (economy, startups, policy, fintech)
 * ============================================================
 */
const fetchGeneralNews = async (recentTitles) => {
  try {
    const yesterday = getYesterdayIST();
    const today = getTodayIST();

    // 1. India business & economy — startup funding, GCC, fintech
    const indiaBusinessUrl = `${BASE_URL}/top-headlines?category=business&country=in&pageSize=20&apiKey=${NEWS_API_KEY}`;

    // 2. India general top-headlines — all categories
    const indiaGeneralUrl = `${BASE_URL}/top-headlines?country=in&pageSize=15&apiKey=${NEWS_API_KEY}`;

    // 3. Global meaningful news — economy, policy, startups, clean energy, fintech
    const globalUrl = `${BASE_URL}/everything?q=((economy OR "startup funding" OR unicorn OR "tech policy" OR "AI regulation" OR "digital india" OR fintech OR "electric vehicle" OR "renewable energy" OR GCC OR "Global Capability Centre") AND (India OR global OR world OR startup))&language=en&from=${yesterday}&to=${today}&sortBy=publishedAt&pageSize=15&apiKey=${NEWS_API_KEY}`;

    const [indiaBus, indiaGen, global] = await Promise.all([
      safeFetchArticles(indiaBusinessUrl),
      safeFetchArticles(indiaGeneralUrl),
      safeFetchArticles(globalUrl)
    ]);

    const combined = [...indiaBus, ...indiaGen, ...global];
    return mixIndiaAndWorld(combined, 4, 8, () => 'General', recentTitles);
  } catch (error) {
    console.error('Error fetching General news:', error.message);
    return [];
  }
};

/**
 * ============================================================
 * fetchAllNewsForDigest — Main entry point
 *
 * Fetches all 3 sections in parallel with:
 * 1. Deduplication against last 3 sent digests
 * 2. 60% India / 40% World ratio in each section
 * 3. Strict relevance filtering (no gaming/entertainment)
 * 4. Student-focused queries for each section
 * ============================================================
 */
const fetchAllNewsForDigest = async () => {
  console.log('📰 Fetching FRESH student-focused news (60% India / 40% World) with strict relevance filtering...');

  const recentTitles = await loadRecentDigestTitles(3);

  const [itNews, educationNews, generalNews] = await Promise.all([
    fetchITNews(recentTitles),
    fetchEducationNews(recentTitles),
    fetchGeneralNews(recentTitles),
  ]);

  console.log(`   ✅ IT: ${itNews.length} articles | Education: ${educationNews.length} | World: ${generalNews.length}`);

  if (itNews.length === 0 && educationNews.length === 0 && generalNews.length === 0) {
    console.warn('   ⚠️ No fresh news found. API may be exhausted or all articles were deduped.');
  }

  return { itNews, educationNews, generalNews };
};

module.exports = { fetchITNews, fetchEducationNews, fetchGeneralNews, fetchAllNewsForDigest };
