/**
 * Build-time script: generates sentence embeddings for all QA pairs.
 * Output: public/qa-embeddings.json (NEVER edit manually — auto-generated)
 *
 * Model: Xenova/all-MiniLM-L6-v2 (~25MB, cached after first run)
 */

import { pipeline, env } from '@xenova/transformers';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Cache models locally to avoid re-downloading
env.cacheDir = join(root, '.model-cache');

console.log('🔍 embed-qa: Loading QA pairs...');

const qaPairs = JSON.parse(
  readFileSync(join(root, 'src/data/qa-pairs.json'), 'utf-8')
);

console.log(`📊 embed-qa: Found ${qaPairs.length} QA pairs`);
console.log('⏳ embed-qa: Loading model (Xenova/all-MiniLM-L6-v2)...');
console.log('   (This may take a moment on first run — model is ~25MB)');

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
  progress_callback: (progress) => {
    if (progress.status === 'downloading') {
      const pct = progress.loaded && progress.total
        ? Math.round((progress.loaded / progress.total) * 100)
        : '?';
      process.stdout.write(`\r   Downloading: ${pct}%   `);
    }
    if (progress.status === 'loaded') {
      process.stdout.write('\r   Model loaded ✓        \n');
    }
  },
});

console.log('✨ embed-qa: Generating embeddings...');

const results = [];

for (let i = 0; i < qaPairs.length; i++) {
  const item = qaPairs[i];
  const output = await extractor(item.question, { pooling: 'mean', normalize: true });
  results.push({
    question: item.question,
    answer: item.answer,
    embedding: Array.from(output.data),
  });
  process.stdout.write(`\r   [${i + 1}/${qaPairs.length}] ${item.question.slice(0, 50)}...   `);
}

process.stdout.write('\n');

// Ensure public dir exists
mkdirSync(join(root, 'public'), { recursive: true });

const outputPath = join(root, 'public/qa-embeddings.json');
writeFileSync(outputPath, JSON.stringify(results));

console.log(`✅ embed-qa: Wrote ${results.length} embeddings to public/qa-embeddings.json`);
console.log(`   File size: ${(Buffer.byteLength(JSON.stringify(results)) / 1024).toFixed(1)}KB`);
