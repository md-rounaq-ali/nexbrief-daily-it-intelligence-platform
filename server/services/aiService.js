const fetch = require('node-fetch');

/**
 * Clean NewsAPI/RSS snippets by removing trailing "[+1234 chars]" markers
 * and stripping accidental inline HTML tags.
 */
const cleanNewsText = (str = '') => {
  return String(str)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[\+\d+\s+chars\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Deterministic domain-aware fallback when GEMINI_API_KEY is not configured
 * or when Gemini free-tier quota is temporarily exhausted.
 */
const buildSmartFallbackInsight = (article = {}) => {
  const title = cleanNewsText(article.title || '');
  const desc = cleanNewsText(article.description || '');
  const text = `${title} ${desc}`.toLowerCase();
  const cat = article.category || 'IT';

  // Detect specific Indian IT / global hiring companies
  const companyMap = [
    ['tcs', 'TCS'], ['infosys', 'Infosys'], ['wipro', 'Wipro'], ['hcl', 'HCLTech'],
    ['cognizant', 'Cognizant'], ['accenture', 'Accenture'], ['capgemini', 'Capgemini'],
    ['tech mahindra', 'Tech Mahindra'], ['deloitte', 'Deloitte'], ['ltimindtree', 'LTIMindtree'],
    ['amazon', 'Amazon'], ['microsoft', 'Microsoft'], ['google', 'Google'],
    ['nvidia', 'NVIDIA'], ['openai', 'OpenAI'], ['anthropic', 'Anthropic'],
    ['isro', 'ISRO'], ['nasa', 'NASA']
  ];
  const matchedCompany = companyMap.find(([kw]) => text.includes(kw))?.[1];

  if (cat === 'Jobs' || /\b(hiring|recruitment|internship|intern|fresher|placement|off-campus|off campus|vacancy|walk-in)\b/i.test(text)) {
    if (matchedCompany) {
      return `${matchedCompany} hiring/career signal — check eligibility, prep DSA/core CS & apply early.`;
    }
    return 'Career & hiring alert for B.Tech/IT talent — track application window & keep resume updated.';
  }

  if (/\b(layoff|layoffs|job cut|hiring freeze)\b/i.test(text)) {
    return 'Workforce trend alert — double down on AI, cloud & problem-solving skills to stay resilient.';
  }

  if (cat === 'AI' || /\b(llm|chatgpt|gemini|claude|agentic|generative ai|copilot|openai|machine learning)\b/i.test(text)) {
    if (matchedCompany) {
      return `${matchedCompany} AI update — test new APIs/workflows for portfolio projects & interview talking points.`;
    }
    return 'Fast-moving AI shift — worth exploring hands-on to sharpen hackathon & interview readiness.';
  }

  if (cat === 'Cybersecurity' || /\b(zero day|zero-day|breach|ransomware|malware|vulnerability|cert-in|phishing)\b/i.test(text)) {
    return 'Security bulletin — understand the attack vector & ensure your apps/dependencies stay patched.';
  }

  if (cat === 'Cloud' || /\b(aws|azure|google cloud|kubernetes|docker|devops|serverless|data center)\b/i.test(text)) {
    return 'Cloud & DevOps evolution — core knowledge for backend, SRE & Global Capability Centre roles.';
  }

  if (cat === 'Software' || /\b(react|next\.js|python|node\.js|flutter|typescript|rust|github|open source|framework|sdk|api)\b/i.test(text)) {
    return 'Developer stack release — review the changelog to keep your tech stack & GitHub projects modern.';
  }

  if (/\b(gate|aicte|ugc|scholarship|hackathon|nptel|swayam|iit|nit|bits|b\.tech|campus)\b/i.test(text)) {
    return 'Student academic update — note key eligibility dates & align with semester or GATE preparation.';
  }

  if (cat === 'Research' || cat === 'Science' || /\b(isro|nasa|quantum|breakthrough|researchers)\b/i.test(text)) {
    return 'Science & R&D milestone — strong reference point for seminars, tech talks & innovation ideas.';
  }

  if (/\b(startup|funding|unicorn|fintech|upi|gcc|digital india|regulation|policy)\b/i.test(text)) {
    return 'India/Global tech market pulse — signals where VC funding & fresher hiring demand are heading.';
  }

  return 'Industry awareness — helps B.Tech students & engineers stay sharp for tech interviews.';
};

/**
 * Call Google Gemini API (Free Tier) in a single batched JSON request
 * to generate crisp 1-line "Why This Matters" insights for all articles.
 */
const generateGeminiBatchInsights = async (articles) => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || !articles || articles.length === 0) return null;

  const modelsToTry = [
    process.env.GEMINI_MODEL || 'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
  ];

  const payloadArticles = articles.map((art, index) => ({
    idx: index,
    category: art.category || 'IT',
    title: cleanNewsText(art.title).slice(0, 140),
    summary: cleanNewsText(art.description).slice(0, 220),
  }));

  const prompt = [
    'You are the Chief Tech Editor at NexBrief (India\'s daily IT & engineering student intelligence digest).',
    'For EACH article below, write ONE ultra-crisp, actionable "Why This Matters" takeaway line specifically for Indian B.Tech students, freshers, and software engineers.',
    'Rules:',
    '- Max 115 characters per takeaway.',
    '- No emojis at the start, no quotes, no filler like "This article discusses".',
    '- Focus on career actionability: e.g. hiring deadlines, interview prep, tools to try, GATE/campus impact, or market signal.',
    '- Use concrete format like: "<What happened> -> <Actionable takeaway for students/devs>" when helpful.',
    '- Return strictly a JSON array of objects: [{"idx": 0, "whyItMatters": "..."}].',
    '',
    'Articles JSON:',
    JSON.stringify(payloadArticles),
  ].join('\n');

  for (const model of modelsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`⚠️ Gemini (${model}) returned ${response.status}: ${errText.slice(0, 140)}`);
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) continue;

      // Clean potential markdown code fences
      const jsonText = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(jsonText);
      const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : null);
      if (!list) continue;

      const map = new Map();
      for (const item of list) {
        if (typeof item?.idx === 'number' && typeof item?.whyItMatters === 'string' && item.whyItMatters.trim()) {
          map.set(item.idx, cleanNewsText(item.whyItMatters).slice(0, 140));
        }
      }
      if (map.size > 0) {
        console.log(`🤖 Gemini (${model}) generated ${map.size}/${articles.length} "Why This Matters" summaries.`);
        return map;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`⚠️ Gemini (${model}) fallback triggered:`, err.message);
    }
  }

  return null;
};

/**
 * Enrich a list of articles with `whyItMatters` (using Gemini API batch + smart fallback).
 * Processes in chunks of up to 24 articles per Gemini call to stay well inside free-tier limits.
 */
const enrichArticlesWithInsights = async (articles = []) => {
  if (!Array.isArray(articles) || articles.length === 0) return [];

  // Normalize & clean descriptions/titles lightly without altering original objects unnecessarily
  const prepared = articles.map((a) => ({
    ...(typeof a.toObject === 'function' ? a.toObject() : a),
    description: cleanNewsText(a.description) || 'Click to read the full intelligence report.',
  }));

  const chunkSize = 24;
  for (let start = 0; start < prepared.length; start += chunkSize) {
    const slice = prepared.slice(start, start + chunkSize);
    const geminiMap = await generateGeminiBatchInsights(slice);

    slice.forEach((art, localIdx) => {
      if (art.whyItMatters && art.whyItMatters.trim()) return;
      const aiText = geminiMap?.get(localIdx);
      art.whyItMatters = aiText || buildSmartFallbackInsight(art);
    });
  }

  return prepared;
};

/**
 * Convenience helper to enrich all 3 sections of a digest in one batched flow.
 */
const enrichDigestSections = async ({ itNews = [], educationNews = [], generalNews = [] }) => {
  const combined = [
    ...itNews.map((a) => ({ section: 'it', art: a })),
    ...educationNews.map((a) => ({ section: 'edu', art: a })),
    ...generalNews.map((a) => ({ section: 'gen', art: a })),
  ];

  const enrichedFlat = await enrichArticlesWithInsights(combined.map((x) => x.art));

  const nextIt = [];
  const nextEdu = [];
  const nextGen = [];

  combined.forEach((entry, idx) => {
    const enriched = enrichedFlat[idx];
    if (entry.section === 'it') nextIt.push(enriched);
    else if (entry.section === 'edu') nextEdu.push(enriched);
    else nextGen.push(enriched);
  });

  return { itNews: nextIt, educationNews: nextEdu, generalNews: nextGen };
};

module.exports = {
  cleanNewsText,
  buildSmartFallbackInsight,
  enrichArticlesWithInsights,
  enrichDigestSections,
};
