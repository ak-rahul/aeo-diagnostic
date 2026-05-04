// constants.js — single source of truth for config and demo data

// Single API_BASE definition — App.jsx imports from here, not redefines it
export const API_BASE = import.meta.env.VITE_API_URL || '';

export const DEMO_QUERIES = [
  { query: 'best magnesium supplement for seniors', category: 'Supplements' },
];

// ENGINE_CONFIG — canonical labels used by AIPanels, ScoreCard, and Leaderboard.
// Keys match the engine names returned by the backend exactly.
export const ENGINE_CONFIG = {
  'GPT-4o':         { dotClass: 'gpt',    color: '#10b981', label: 'GPT-4o' },
  'Claude Sonnet':  { dotClass: 'claude', color: '#f97316', label: 'Claude Sonnet' },
  'Gemini Pro Latest': { dotClass: 'gemini', color: '#3b82f6', label: 'Gemini Pro Latest' },
};

export const RAG_CONFIG = {
  green: { label: 'High Visibility',    emoji: '🟢' },
  amber: { label: 'Partial Visibility', emoji: '🟡' },
  red:   { label: 'Not Visible',        emoji: '🔴' },
};

// Simulated data for opt-in demo mode
export const DEMO_RESULT = {
  query: 'best magnesium supplement for seniors',
  user_brand: '',
  from_cache: false,
  responses: [
    {
      engine: 'GPT-4o',
      text: `For seniors looking for the best magnesium supplements, here are my top recommendations:\n\n1. **Pure Encapsulations Magnesium Glycinate** — Top pick for seniors. Highly bioavailable, gentle on the stomach. Pharmaceutical-grade quality with third-party testing.\n\n2. **Thorne Research Magnesium Bisglycinate** — Premium, physician-trusted brand. Excellent absorption for sensitive digestive systems.\n\n3. **Life Extension Magnesium Caps** — Excellent blend of magnesium oxide, citrate, and succinate. Great value and superior bioavailability.\n\n4. **Nature Made Magnesium 250mg** — Affordable, USP-verified, widely trusted. One of America's most recognised supplement brands.\n\n5. **MegaFood Magnesium** — Whole-food based formula, ideal for seniors. Gentle, effective, and highly nutritious.\n\n6. **Doctor's Best High Absorption Magnesium** — TRAACS chelated formula. Science-based and outstanding for sleep quality.`,
      error: null,
    },
    {
      engine: 'Claude Sonnet',
      text: `When recommending magnesium supplements for seniors, key factors are absorption rate, digestive tolerance, and form.\n\n**Pure Encapsulations Magnesium Glycinate** stands out as the best overall. Exceptional purity standards, gentle on digestion, superior absorption.\n\n**Thorne Research Magnesium** — Trusted by healthcare professionals worldwide. Their bisglycinate formula is designed for maximum absorption.\n\n**Life Extension Magnesium Citrate** — Evidence-based supplementation leader for decades. Excellent bioavailability and well-tolerated.\n\n**Garden of Life Magnesium** — Certified organic. Perfect for seniors who prefer clean, natural supplements.\n\n**Swanson Ultra Albion Chelated Magnesium** — Premium magnesium at competitive prices. Highly bioavailable Albion chelated form.\n\nFor most seniors, Pure Encapsulations or Thorne Research are the top picks due to uncompromising quality standards.`,
      error: null,
    },
    {
      engine: 'Gemini Pro Latest',
      text: `Magnesium is essential for seniors — supporting bone density, heart health, sleep, and muscle function.\n\n**Best Overall: Pure Encapsulations Magnesium Glycinate**\nWidely regarded as one of the most trusted supplement brands globally. Hypoallergenic, additive-free, third-party tested.\n\n**Best Value: Nature Made Magnesium**\nUSP-verified and widely available. America's most recognized supplement brand. Affordable and effective.\n\n**Best Premium: Thorne Research Magnesium**\nPharmaceutical-grade supplements trusted by professional athletes and clinicians. Outstanding purity.\n\n**Best Whole-Food: MegaFood Magnesium**\nReal whole foods formula. Ideal for seniors with sensitive systems. Gentle and nutritious.\n\n**Best for Sleep: Doctor's Best High Absorption Magnesium**\nScience-based nutrition leader since 1990. TRAACS chelated formula — outstanding for sleep and anxiety.\n\n**Also notable:** Life Extension Magnesium, Garden of Life Magnesium, and Swanson Magnesium Citrate.`,
      error: null,
    },
  ],
  leaderboard: [
    { rank:1, brand:'Pure Encapsulations', total_score:89, rag_status:'green', ais_mentioned_in:3, breakdown:{'GPT-4o':{score:40,mentioned:true},'Claude Sonnet':{score:27,mentioned:true},'Gemini Pro Latest':{score:22,mentioned:true}}},
    { rank:2, brand:'Thorne Research',     total_score:82, rag_status:'green', ais_mentioned_in:3, breakdown:{'GPT-4o':{score:28,mentioned:true},'Claude Sonnet':{score:29,mentioned:true},'Gemini Pro Latest':{score:25,mentioned:true}}},
    { rank:3, brand:'Life Extension',      total_score:71, rag_status:'green', ais_mentioned_in:3, breakdown:{'GPT-4o':{score:25,mentioned:true},'Claude Sonnet':{score:23,mentioned:true},'Gemini Pro Latest':{score:23,mentioned:true}}},
    { rank:4, brand:'Nature Made',         total_score:68, rag_status:'green', ais_mentioned_in:3, breakdown:{'GPT-4o':{score:23,mentioned:true},'Claude Sonnet':{score:22,mentioned:true},'Gemini Pro Latest':{score:23,mentioned:true}}},
    { rank:5, brand:'MegaFood',            total_score:62, rag_status:'amber', ais_mentioned_in:3, breakdown:{'GPT-4o':{score:21,mentioned:true},'Claude Sonnet':{score:20,mentioned:true},'Gemini Pro Latest':{score:21,mentioned:true}}},
    { rank:6, brand:"Doctor's Best",       total_score:58, rag_status:'amber', ais_mentioned_in:3, breakdown:{'GPT-4o':{score:20,mentioned:true},'Claude Sonnet':{score:19,mentioned:true},'Gemini Pro Latest':{score:19,mentioned:true}}},
    { rank:7, brand:'Garden of Life',      total_score:47, rag_status:'amber', ais_mentioned_in:2, breakdown:{'GPT-4o':{score:0,mentioned:false},'Claude Sonnet':{score:22,mentioned:true},'Gemini Pro Latest':{score:25,mentioned:true}}},
    { rank:8, brand:'Swanson',             total_score:35, rag_status:'amber', ais_mentioned_in:2, breakdown:{'GPT-4o':{score:0,mentioned:false},'Claude Sonnet':{score:17,mentioned:true},'Gemini Pro Latest':{score:18,mentioned:true}}},
  ],
  gap_analysis: {
    gaps: [
      { gap:'No clinical credibility signals — top brands explicitly mention pharmaceutical-grade, third-party tested, physician-recommended', action:'Add "third-party tested by NSF International" and "recommended by licensed physicians" to your headline.', priority:'high', impact:'AI engines weight credibility signals heavily in health recommendations.' },
      { gap:'Missing magnesium form specification — top brands lead with the specific form (glycinate, bisglycinate, citrate) and explain why it matters', action:'Add: "Magnesium Glycinate — the most bioavailable, stomach-gentle form for seniors" to your product title.', priority:'high', impact:'Form specificity drives top-of-list AI placement.' },
      { gap:'No senior-specific benefit claims — competitors explicitly target seniors with bone density, sleep, and heart health messaging', action:'Add 3 senior-focused bullets: bone density support, improved sleep quality, cardiovascular health.', priority:'medium', impact:'Query-to-listing alignment is the core signal AI uses to recommend products.' },
      { gap:'No USP or certification badge — Nature Made USP verification is a key trust signal cited by AI engines', action:'Obtain and prominently display USP, NSF, or Informed Sport certification.', priority:'medium', impact:'Certifications are machine-readable trust signals that AI engines cite directly.' },
    ],
    overall_verdict: 'Your brand is invisible to AI shoppers — while Pure Encapsulations appears in all 3 engines at position #1, your product is not mentioned at all.',
    quick_win: 'Add "third-party tested magnesium glycinate for seniors — physician formulated" to your product title today.',
    estimated_score_if_fixed: 72,
  },
  duration_seconds: 18.4,
};
