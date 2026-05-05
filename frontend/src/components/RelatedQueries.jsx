/**
 * RelatedQueries.jsx — Suggest related queries for the user to check next.
 *
 * From a brand owner's POV, they think about their product in ONE way.
 * But AI shoppers ask many variants. This panel shows what else they should audit.
 *
 * Patterns are generated client-side from the original query — no API call needed.
 */
import { motion } from 'framer-motion';
import { Search, ArrowRight } from 'lucide-react';

function generateRelated(query) {
  if (!query) return [];
  const q = query.toLowerCase();

  // Extract core noun/product from the query
  const stripped = q
    .replace(/^(best|top|cheapest|most|what are the|which is the|find me)\s+/i, '')
    .replace(/\s+(for|under|below|around|near|in|to|that|with)\s+.+$/i, '')
    .trim();

  const year = new Date().getFullYear();

  return [
    `best ${stripped} ${year}`,
    `${stripped} review`,
    `${stripped} vs competitor`,
    `${stripped} recommended by doctors`,
    `${stripped} side effects`,
    `${stripped} for beginners`,
  ].filter((r, i, arr) => r !== query && arr.indexOf(r) === i).slice(0, 5);
}

export default function RelatedQueries({ query, onSelect }) {
  if (!query) return null;
  const related = generateRelated(query);
  if (!related.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      style={{ marginTop: 8 }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Search size={12} /> Also check these queries
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {related.map(r => (
          <button
            key={r}
            onClick={() => onSelect(r)}
            className="demo-chip"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            {r}
            <ArrowRight size={11} />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
