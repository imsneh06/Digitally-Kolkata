/* ==========================================================================
   DIGITALLY KOLKATA - UNIFIED DATA PERSISTENCE & STORAGE ADAPTER
   Compatible with Vercel Serverless Functions and Local Node.js Server.
   Supports:
   - Local persistent JSON file (data/db.json)
   - Vercel Serverless /tmp fallback
   - Upstash Redis / Vercel KV REST API (100% free cloud persistence)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Default Database Schema
const DEFAULT_STORE = {
  adminPass: "Narayan@06",
  pricing: {
    branding: 15000,
    uiux: 20000,
    webdev: 28000,
    seo: 12000,
    photo: 18000,
    social: 15000,
    perPage: 1800,
    baseMin: 12000
  },
  agency: {
    name: "Digitally Kolkata",
    tagline: "High-Impact Digital Marketing & Web Engineering",
    wa: "919073277478",
    email: "duttarayan3@gmail.com",
    phone: "+91 90732 77478",
    address: "Salt Lake Sector V, Kolkata, West Bengal 700091"
  },
  portfolio: [
    {
      id: "walplast-fifa",
      title: "Walplast FIFA 2026 Campaign",
      category: "campaign",
      categoryLabel: "Campaign",
      image: "assets/portfolio/walplast-fifa",
      metric: "1.1M+ Views | 30K+ Actions",
      description: "Tournament campaign planning & content strategy driving national engagement.",
      details: "High-voltage campaign planning, content strategy, and community engagement rollout delivering over 1.1M+ views and 30K+ engagements for Walplast Drychem.",
      active: true
    },
    {
      id: "bisleri-hydration",
      title: "Bisleri 31-Day Winter Hydration Plan",
      category: "campaign",
      categoryLabel: "Content Strategy",
      image: "assets/portfolio/bisleri-campaign",
      metric: "31 Editorial Plots | Visual Scripts",
      description: "31 editorial storylines, visual scripts, and conversion-focused copy.",
      details: "Complete 31-day content strategy, visual scripting, and copywriting framework tackling seasonal dehydration with engagement prompts and editorial blueprints.",
      active: true
    },
    {
      id: "zee-bangla",
      title: "Zee Bangla Sonar Media Flow",
      category: "branding",
      categoryLabel: "Social Media",
      image: "assets/portfolio/zee-bangla",
      metric: "16-Post Structure | Regional Media Flow",
      description: "Multi-post framework and campaign coordination for regional television broadcast.",
      details: "Social media coordination flow and content planning support for Zee Bangla Sonar Sansar properties, structuring 16-post media delivery frameworks.",
      active: true
    },
    {
      id: "msp-steel",
      title: "MSP Steel B2B Presence",
      category: "b2b",
      categoryLabel: "B2B Growth",
      image: "assets/portfolio/msp-steel",
      metric: "Multi-Platform | Corporate B2B Voice",
      description: "Corporate LinkedIn architecture, industrial brand voice, and structured publishing.",
      details: "Multi-channel B2B social media strategy and structured scheduling framework for premier Indian steel manufacturer MSP Steel.",
      active: true
    },
    {
      id: "marketing-notebook",
      title: "Marketing Notebook Ad Teardowns",
      category: "creative",
      categoryLabel: "Ad Strategy",
      image: "assets/portfolio/marketing-notebook",
      metric: "4 National Ads | 3 Pitch Concepts",
      description: "Strategic creative teardowns & visual pitch decks for modern digital audiences.",
      details: "In-depth teardowns of iconic Indian FMCG advertising campaigns paired with original visual storyboards and consumer psychology frameworks.",
      active: true
    },
    {
      id: "core-fit",
      title: "Core Fit Creative Direction",
      category: "creative",
      categoryLabel: "Creative Direction",
      image: "assets/portfolio/core-fit",
      metric: "Featured Asset | High Recall",
      description: "High-impact fitness creative direction, bold typography, and visual hooks.",
      details: "High-conversion visual concepts, typography direction, and athletic engagement posts designed for high feed-stopping power and brand recall.",
      active: true
    }
  ],
  leads: [],
  cloudConfig: {
    kvUrl: "",
    kvToken: ""
  }
};

let inMemoryCache = null;

// Paths
const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'dk_db.json');

// Session Secret Key
const AUTH_SECRET = process.env.ADMIN_JWT_SECRET || 
                    process.env.ADMIN_SECRET || 
                    process.env.VERCEL_GIT_COMMIT_SHA || 
                    'dk_enterprise_kolkata_secure_secret_key_2026';

function generateSessionToken(passcode = 'Narayan@06') {
  const payload = {
    auth: true,
    role: 'admin',
    passHash: crypto.createHash('sha256').update(String(passcode)).digest('hex').substring(0, 16),
    iat: Date.now()
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `dk_sess_${body}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  if (!token.startsWith('dk_sess_')) return null;
  const raw = token.replace(/^dk_sess_/, '');
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    // Valid for 30 days
    if (payload.iat && (Date.now() - payload.iat > 30 * 24 * 60 * 60 * 1000)) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function generatePassVerificationHash(passcode) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(`pass_${passcode}`).digest('hex');
}

function verifyPasscode(entered, actual, clientHash = null) {
  const cleanEntered = (entered || '').trim();
  const cleanActual = (actual || '').trim();
  const envPass = (process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || '').trim();

  // 1. Direct match with current store adminPass
  if (cleanActual && cleanEntered === cleanActual) return true;

  // 2. Direct match with environment variable
  if (envPass && cleanEntered === envPass) return true;

  // 3. Fallback default 'Narayan@06'
  if (cleanEntered === 'Narayan@06') return true;

  // 4. Also support previous 'admin' if store was not yet updated
  if (cleanEntered === 'admin' && cleanActual === 'admin') return true;

  // 5. Verify against client verification hash (signed by server when passcode was changed in this browser)
  if (clientHash) {
    const expected = generatePassVerificationHash(cleanEntered);
    if (clientHash === expected) return true;
  }

  return false;
}

// Get KV Credentials from Env or Local Config
function getKvConfig(currentStore) {
  let url = process.env.KV_REST_API_URL || 
            process.env.UPSTASH_REDIS_REST_URL || 
            (currentStore && currentStore.cloudConfig && currentStore.cloudConfig.kvUrl) || '';
  const token = process.env.KV_REST_API_TOKEN || 
                process.env.UPSTASH_REDIS_REST_TOKEN || 
                (currentStore && currentStore.cloudConfig && currentStore.cloudConfig.kvToken) || '';

  if (typeof url === 'string') {
    url = url.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      if (url.includes('.')) url = 'https://' + url;
      else url = '';
    }
  } else {
    url = '';
  }

  return { url, token, active: Boolean(url && token) };
}

// Fetch from Upstash / Vercel KV REST API
async function fetchFromKv(url, token) {
  try {
    const cleanUrl = url.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/get/dk_database`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.result) {
      return typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
    }
  } catch (err) {
    console.error('KV fetch error:', err.message);
  }
  return null;
}

// Save to Upstash / Vercel KV REST API
async function saveToKv(url, token, data) {
  try {
    const cleanUrl = url.replace(/\/+$/, '');
    const payload = JSON.stringify(data);
    const res = await fetch(`${cleanUrl}/set/dk_database`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      body: payload
    });
    return res.ok;
  } catch (err) {
    console.error('KV save error:', err.message);
    return false;
  }
}

// Read database
async function getStore() {
  if (inMemoryCache) {
    return inMemoryCache;
  }

  // 1. Check local file or tmp file
  // Prefer TMP_DB_PATH if it exists (on Vercel serverless where LOCAL_DB_PATH is read-only)
  let fileData = null;
  if (fs.existsSync(TMP_DB_PATH)) {
    try {
      fileData = JSON.parse(fs.readFileSync(TMP_DB_PATH, 'utf8'));
    } catch (e) {
      console.warn('Failed reading tmp DB file:', e.message);
    }
  }

  if (!fileData && fs.existsSync(LOCAL_DB_PATH)) {
    try {
      fileData = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
    } catch (e) {
      console.warn('Failed reading local DB file:', e.message);
    }
  }

  const baseData = fileData || JSON.parse(JSON.stringify(DEFAULT_STORE));

  // Override adminPass with environment variable if provided
  if (process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD) {
    baseData.adminPass = (process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD).trim();
  }

  // 2. Check Cloud KV
  const kvConfig = getKvConfig(baseData);
  if (kvConfig.active) {
    const cloudData = await fetchFromKv(kvConfig.url, kvConfig.token);
    if (cloudData) {
      inMemoryCache = { ...baseData, ...cloudData };
      if (process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD) {
        inMemoryCache.adminPass = (process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD).trim();
      }
      return inMemoryCache;
    }
  }

  inMemoryCache = baseData;
  return inMemoryCache;
}

// Save database
async function saveStore(newData) {
  inMemoryCache = newData;

  // 1. Save to Cloud KV if active
  const kvConfig = getKvConfig(newData);
  if (kvConfig.active) {
    await saveToKv(kvConfig.url, kvConfig.token, newData);
  }

  // 2. Try saving to local file
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(newData, null, 2), 'utf8');
  } catch (err) {
    // Read-only filesystem in Vercel serverless
  }

  // Always write to TMP_DB_PATH on serverless/temp storage
  try {
    fs.writeFileSync(TMP_DB_PATH, JSON.stringify(newData, null, 2), 'utf8');
  } catch (tmpErr) {
    console.error('Failed writing to tmp:', tmpErr.message);
  }

  return true;
}

// Universal CORS handler
function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.status(204).end();
    } else {
      res.statusCode = 204;
      res.end();
    }
    return true;
  }
  return false;
}

// Universal JSON Response Helper
function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

// Universal Request Body Parser
async function parseBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {};
      }
    }
    return req.body;
  }

  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

// Authentication Check
function verifyAuth(req, store, body = null) {
  const authHeader = (req.headers && (req.headers.authorization || req.headers['x-admin-key'])) || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const bodyToken = body && typeof body === 'object' ? (body.token || body.passcode || body.adminPass) : null;
  const queryToken = req.query && typeof req.query === 'object' ? (req.query.token || req.query.key) : null;

  const actualToken = (token || bodyToken || queryToken || '').trim();
  if (!actualToken) return false;

  // 1. Check if token is a valid cryptographic session token (works across all serverless lambdas seamlessly)
  const session = verifySessionToken(actualToken);
  if (session && session.auth) {
    return true;
  }

  // 2. Direct match with current adminPass or environment variable
  const validPass = (store && store.adminPass) || process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || 'Narayan@06';
  if (actualToken === validPass) {
    return true;
  }

  // 3. Backwards compatibility for 'Narayan@06', 'admin', or authenticated session marker
  if (actualToken === 'Narayan@06' || actualToken === 'admin' || actualToken === 'dk_authenticated_session') {
    return true;
  }

  // 4. Verification hash match (from header if provided)
  const passHash = req.headers && req.headers['x-admin-hash'];
  if (passHash && generatePassVerificationHash(actualToken) === passHash) {
    return true;
  }

  return false;
}

module.exports = {
  getStore,
  saveStore,
  handleCors,
  sendJson,
  parseBody,
  verifyAuth,
  getKvConfig,
  generateSessionToken,
  generatePassVerificationHash,
  verifyPasscode
};
