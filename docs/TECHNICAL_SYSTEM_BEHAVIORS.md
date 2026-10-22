# NutriFitAI System Technical Behaviors & Architecture Specification

This document provides an in-depth technical analysis of the core backend and client-side mechanisms powering **NutriFitAI**. It covers recommendation generation and refresh lifecycles, authentication and session management security, semantic vector embeddings, AI routing failover architectures, safety guardrails, and cryptographic audit logging.

---

## 1. Recommendation System & Refresh Mechanics

The NutriFitAI dashboard serves dynamically tailored recommendations across three distinct domains: `food` (macronutrient and calorie-targeted meals), `workout` (multi-movement exercise routines targeting untrained musculature), and `general` (biometric and habit telemetry insights). These recommendations are orchestrated by `backend/src/controllers/recommendationController.js` and backed by MongoDB's `recommendations` collection.

### 1.1 Card Schema & Status Lifecycle
Every recommendation document contains:
- `userId` & `day`: The user reference and localized calendar date string (`YYYY-MM-DD`) derived from the incoming client `X-Timezone` header.
- `kind`: Restricted to `'food'`, `'workout'`, or `'general'`.
- `status`: Represents the user state—`'new'` (active on dashboard), `'dismissed'` (swiped away), or `'done'` (completed).
- `source` & `provider`: Tracks provenance (`'ai'` with provider attribution like `'groq'` vs. `'rule'` for heuristic fallback).
- `exercises`: Array of structured exercise objects (`{ exerciseRef, exerciseName, targetSets, targetReps }`) enabling instant one-tap routine compilation into the user's active workout plan.

### 1.2 Automated Refresh Triggers vs. Manual User Triggers
Recommendations update through both background automated checks and rate-limited manual user requests:
- **Calendar Day Rollover**: The user's day boundary is calculated per request using `today(timeZone)`. Upon midnight in the user's localized time zone, previous open cards are retired and fresh recommendations are calculated on the first dashboard load.
- **Staleness Expiry (`STALE_MS = 3 hours`)**: Cards older than 3 hours are marked stale. On the subsequent `GET /api/recommendations`, the server automatically updates the card deck.
- **Data Mutation Invalidation (`CHANGED_MIN_MS = 2 minutes`)**: Whenever a meal is logged, edited, or deleted (`foodController.js:252`), or biometric profiles and goals are saved (`profileController.js:258`), the backend calls `invalidateRecommendations(userId)`, adding the user's ID to an in-memory `changed` Set. On the next dashboard visit, if at least 2 minutes have elapsed since the last generation, recommendations regenerate to reflect the user's newly logged macronutrients or updated calorie goals.
- **Manual User Trigger (`POST /api/recommendations/refresh`)**: Allows user-initiated regeneration subject to strict cooldowns.

### 1.3 Cooldown Periods, Daily Limits & Deduplication
- **Manual Cooldown Period**: `REFRESH_COOLDOWN_MS = 1 hour (60 minutes)`. The user must wait at least 60 minutes between manual refreshes. Calling the endpoint prematurely rejects the request with HTTP `429 Too Many Requests`: *"These were just updated. Try again in a little while."*
- **Daily Ceiling**: `MAX_REFRESHES = 3` manual refreshes per calendar day. A 4th attempt returns HTTP `429`: *"You can refresh 3 times a day. Come back tomorrow."*
- **Concurrency Deduplication**: An in-memory Map `inflight` tracks ongoing generation promises by `userId`. If multiple parallel requests arrive simultaneously, they attach to the identical execution promise, preventing redundant LLM queries or database transactions.
- **Preservation of Dismissed & Completed Cards**: When recommendations regenerate, `Recommendation.replaceOpen` deletes solely cards with `status: 'new'`. Cards that the user marked as `'dismissed'` or `'done'` remain in the database for that calendar day and are appended to a `seen` Set, guaranteeing that swiped-away or completed cards are never re-issued on the same day.

### 1.4 Algorithmic Candidate Selection & AI Ranking Pipeline
- **Food Candidates**: Evaluates `data/nutrition_data.json` against dietary restrictions using regexes (e.g., `MEAT`, `FISH`, `DAIRY`, `GLUTEN`, `PORK`). Requires remaining caloric headroom $\ge 150\text{ kcal}$. Candidates are scored by protein-to-calorie density:
  $$\text{Score} = \left(\frac{\text{food.protein}}{\text{food.kcal}}\right) \times (0.8 + 0.4 \times \text{random}())$$
- **Workout Candidates**: Queries `WorkoutSession.findRecent` across the prior 14 days. Exercises already completed are excluded. Workouts matching user equipment settings are retrieved, mapped to anatomical muscle groups, and organized into routines of 3 to 5 exercises, prioritizing muscle groups left untrained.
- **AI Selection & Fallback**: Candidates are passed to `chatRec` (invoking the dedicated recommendation AI chain in `router.js`). The model selects up to 3 cards formatted strictly as JSON. If the LLM provider fails, times out, or outputs invalid JSON, the system catches the error and instantly falls back to rule-based candidate picking (`source: 'rule'`).
- **Minor & Medical Safeguards**: Minors ($< 18$ years old) and users with documented medical conditions receive a static nudge card (`FOOD_NUDGE`): *"Meals that suit your health needs — Ask Nori for ideas that fit."*

---

## 2. Authorization, Tokens & Session Security

NutriFitAI implements a dual-token authentication model combining short-lived stateless JWT access tokens with statefully tracked, rotated refresh tokens in browser-shielded cookies.

### 2.1 Dual-Token Architecture Comparison
- **Access Token**:
  - Lifespan: **15 minutes** (`15m`).
  - Secret & Alg: `JWT_ACCESS_SECRET`, HMAC-SHA256 (`HS256`).
  - Payload: `{ sub, email, role, type: 'access', sid }`.
  - Storage: In-memory (`cachedToken`) & React Native `AsyncStorage` (`nutrifit.accessToken`).
  - Transmission: `Authorization: Bearer <token>` header.
- **Refresh Token (`nf_refresh`)**:
  - Lifespan: **1 day** (standard) / **7 days** (with "Remember Me").
  - Absolute Ceiling (`sxp`): **3 days** (standard) / **30 days** (with "Remember Me").
  - Secret & Alg: `JWT_REFRESH_SECRET`, HMAC-SHA256 (`HS256`).
  - Payload: `{ sub, type: 'refresh', rmb, sxp, sid }`.
  - Storage: Stored exclusively as an **`httpOnly`**, **`Secure`** cookie scoped strictly to **`path: '/api/auth'`**. JavaScript cannot access, read, or export this cookie.
  - Transmission: Automated cookie transport on `/api/auth/*` requests.

### 2.2 Refresh Token Rotation (RTR) & Absolute Session Ceilings
- Calling `POST /api/auth/refresh` verifies the presented cookie, consumes it, and generates a brand-new rotated refresh token.
- To prevent indefinite session hijacking, an immutable session ceiling timestamp (`sxp = loginTime + SESSION_MAX_MS`) is embedded in the token. Once `Date.now() >= sxp`, refreshes are unconditionally rejected, destroying the cookie and forcing full re-login.

### 2.3 Security Hardening & Threat Mitigation
- **XSS Protection**: Refresh tokens reside in `httpOnly` cookies inaccessible to JavaScript. The access token has a narrow 15-minute exposure window.
- **CSRF Defense**: Cookie scoped strictly to `path: '/api/auth'`. Calling refresh returns the new access token in the JSON body, which cross-site origins cannot read due to CORS and Same-Origin Policy.
- **Immediate Role & Session Invalidation (`requireFreshRole`)**: Bypasses token claims on admin/sensitive routes to query MongoDB live: verifies `Session.isLive(sid)` and checks account suspension (`user.suspendedAt`). Demoted or suspended users lose access instantly.
- **Brute Force Rate Limiting**: Tiered limiters throttle logins (10/10m per IP:email), refreshes (30/5m), and OTP verification (15/5m). Violations log automated audit alerts (`auth.login.rate_limited`).
- **Atomic One-Time OTPs**: Stored as SHA-256 hashes (never plaintext). Consumed atomically via `findOneAndUpdate({ _id, consumedAt: null })`, preventing race-condition replays. Resetting password revokes all active sessions across all devices (`Session.revokeAll`).

---

## 3. Vector Embeddings & Semantic Search

NutriFitAI equips the AI coach (Nori) with semantic retrieval over food catalogs, workouts, and coaching guidance notes, implemented in `embeddings.js` and `vectorIndex.js`.

### 3.1 Layman's Terms vs. Technical Formulation
- **In Layman's Terms**: Standard search matches exact letters. Searching for *"light dinner"* fails to find *"Sinigang na Bangus"* because the words don't match. Vector embeddings place concepts as coordinates on a high-dimensional digital map. Dishes that represent light, savory, high-protein evening meals sit in the same neighborhood. When you ask Nori a question, the system finds the closest items on the map in under 5 milliseconds.
- **In Technical Terms**: Google Gemini (`gemini-embedding-001`) maps input strings into 768-dimensional dense vectors: $\mathbf{e} = f(\text{text}) \in \mathbb{R}^{768}$. All vectors are pre-normalized to unit Euclidean length: $\hat{\mathbf{v}} = \mathbf{v} / \|\mathbf{v}\|_2$. Because all vectors are unit-length, cosine similarity simplifies directly to the **Euclidean dot product**:
  $$\text{Similarity}(\hat{\mathbf{q}}, \hat{\mathbf{d}}) = \hat{\mathbf{q}} \cdot \hat{\mathbf{d}} = \sum_{i=1}^{768} \hat{q}_i \hat{d}_i$$
  This eliminates expensive runtime square roots, enabling blisteringly fast linear scans over in-memory arrays.

### 3.2 Offline Pre-Computation & Runtime Query Pipeline
- **Offline Indexing (`build-embeddings.js`)**: Foods, guidance notes, and exercise catalog items are extracted and hashed with SHA-1. Only changed or new records invoke the Gemini API. Stored as Base64-encoded Float32Array buffers in `coach_embeddings.json`.
- **Memory Alignment**: At boot, `vectorIndex.load()` parses the index into an in-memory Map, copying buffer slices to guarantee 4-byte alignment required for SIMD vector instructions.
- **Topic Gating & LRU Caching**: Queries pass regex topic filters. A 200-item LRU cache returns recent queries in 0ms. On miss, Gemini Embeddings is queried with a strict 2.5-second timeout.
- **Circuit Breaker & Fallback**: On HTTP 429/5xx, `quotaStore` initiates cooldown (60s to 10m) and logs `coach.embeddings.paused`. Lookups gracefully degrade to deterministic regex/keyword matching (`foodMatches`).

---

## 4. Additional Core Technical Behaviors

### 4.1 Multi-LLM Dynamic Routing & Failover Chain (`router.js`)
Chat requests evaluate an ordered provider failover chain: **Groq (llama-3.3-70b)** $\rightarrow$ **Cerebras (llama3.1-70b)** $\rightarrow$ **Cloudflare Workers AI** $\rightarrow$ **Ollama (local)**. Recommendations run on an isolated chain (`AI_REC_CHAIN`) so background generation jobs never consume user conversational chat quotas. Circuit breakers enforce 20s burst cooldowns on 429s and 1-hour cooldowns on daily limit exhaustion.

### 4.2 AI Coach Safety Guardrails & Crisis Interception (`safetyRules.js`)
Pre-inference regex scanning checks active and prior 6 messages for self-harm, eating disorders, domestic abuse, and prompt injection (`ignore previous instructions`). Self-harm triggers immediate empathetic crisis protocols and emergency numbers (Philippine NCMH Crisis Hotline **1553** and **911**), overriding normal brevity rules. A deterministic static fallback reply guarantees an immediate crisis response if all external AI providers are offline.

### 4.3 Cryptographic Append-Only Audit Logging (`AuditLog.js`)
Mongoose pre-hooks block all update and delete queries on `audit_logs`. Every entry maintains an unbroken SHA-256 hash chain:
$$\text{hash}_n = \text{SHA256}(\text{chain} + \text{seq}_n + \text{hash}_{n-1} + \text{action} + \text{target} + \text{details})$$
Daily background checks verify chain continuity; database tampering immediately triggers `system.audit_chain.broken` alerts. Sensitive PII (emails) are pseudonymized with HMAC-SHA256.

### 4.4 Automated Scheduled Background Maintenance (`server.js`)
Unref'd background timers execute recurring tasks:
- **Scan Image Purging (every 6h)**: Permanently deletes raw food photos older than 90 days from cloud storage while preserving nutritional metadata in MongoDB.
- **Account Deletion (every 6h)**: Purges accounts past their statutory grace period.
- **Daily Rollups (every 6h)**: Aggregates platform stats in `Asia/Manila` timezone.
- **Reminders (every 15m)**: Dispatches notifications aligned with user daylight hours.

### 4.5 Client Network Resilience & Offline GET Caching (`apiClient.js`)
When an access token expires, the client pauses failed requests, coalesces concurrent calls into a single `refreshPromise`, calls `/auth/refresh`, and automatically replays requests with the new token. Idempotent GET endpoints leverage local caching (`offlineCache.js`), and network drops preserve user credentials without forcing a logout.
