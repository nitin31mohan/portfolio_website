---
title: "Building Multilingual Semantic Search at Scale"
date: 2024-03-15
excerpt: "How we fine-tuned transformer embedding models to serve millions of daily job-search queries across European markets — and what we learned about semantic drift."
draft: false
tags: ["semantic-search", "nlp", "transformers", "production"]
---

Deploying semantic search in production across multiple languages is a fundamentally different problem than getting it to work in a notebook. This post covers the key challenges I encountered fine-tuning multilingual embedding models at The Stepstone Group, and the design decisions that made the difference between a research experiment and a system serving millions of queries daily.

## The Problem

Our job-search platforms serve users across English and German markets. Standard BM25-based retrieval works decently for exact keyword matches, but breaks down when users express intent in natural language: *"entry-level finance role near me"* should match postings that don't contain those exact words.

Semantic search with dense embeddings fixes this — but only if the embeddings actually capture job-search intent, not just generic text similarity.

## Fine-Tuning Strategy

We started from a strong multilingual base model (a SentenceTransformer variant trained on diverse cross-lingual pairs). The challenge: our domain has very specific vocabulary — job titles, skills, industries — that generic models handle poorly.

**Training data design** turned out to be more important than model architecture. The key ingredients:

1. **Hard-negative mining**: pulling semantically similar but incorrect matches as negatives forces the model to learn fine-grained distinctions between, say, "Data Scientist" and "Data Engineer" postings.

2. **Multilingual sampling**: ensuring balanced representation across languages prevents one market's signal from dominating the embedding space.

3. **Deduplication**: near-duplicate pairs inflate training metrics without improving actual retrieval quality. We used MinHash LSH to remove them efficiently.

## Handling Semantic Drift

A subtle problem with domain fine-tuning: you can improve in-domain retrieval while degrading general language understanding — particularly for tail queries. We monitored this via a held-out set of general-language query-document pairs and treated any regression there as a blocking issue.

LoRA (Low-Rank Adaptation) helped here: by fine-tuning only low-rank updates to the weight matrices, we preserved more of the base model's general representations while adapting to our domain.

## Production Constraints

The real bottleneck was inference latency. At millions of queries per day, each millisecond matters. Two interventions brought us to sub-100ms:

- **INT8 quantization** of the embedding model, reducing memory footprint and accelerating inference with minimal quality loss (nDCG@10 within 1% of float32 baseline).
- **Embedding caching** for job postings: jobs don't change every second. Pre-computing and caching their embeddings means query-time inference only needs to encode the query string.

## Evaluation That Actually Measures What Matters

nDCG@10 is the right primary metric for ranked retrieval — it penalises wrong orderings more than simple precision/recall metrics. But we also ran regression discontinuity analyses on A/B experiments to get causal estimates of impact, not just correlational ones. This was the single biggest change that gave the team confidence in shipping ranking changes.

---

The full system now runs across multiple EU platforms. The lesson: semantic search is as much an engineering and data curation problem as a modelling one.
