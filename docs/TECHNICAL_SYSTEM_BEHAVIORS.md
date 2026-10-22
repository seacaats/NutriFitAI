# NutriFitAI System Technical Behaviors & Architecture Specification

This document provides an in-depth technical analysis of the core backend and client-side mechanisms powering **NutriFitAI**. It covers recommendation generation and refresh lifecycles, authentication and session management security, semantic vector embeddings, AI routing failover architectures, safety guardrails, and cryptographic audit logging.

---

## Table of Contents
1. [Recommendation System & Refresh Mechanics](#1-recommendation-system--refresh-mechanics)
   - [Overview & Card Schema](#overview--card-schema)
   - [Automatic vs. Manual Refresh Triggers](#automatic-vs-manual-refresh-triggers)
   - [Cooldowns, Daily Quotas & Concurrency Deduplication](#cooldowns-daily-quotas--concurrency-deduplication)
   - [Algorithmic Candidate Generation & Ranking Pipeline](#algorithmic-candidate-generation--ranking-pipeline)
   - [Safety Gating & Demographic Protections](#safety-gating--demographic-protections)
2. [Authorization, Tokens & Session Security](#2-authorization-tokens--session-security)
   - [Dual-Token Architecture (Access vs. Refresh)](#dual-token-architecture-access-vs-refresh)
   - [Token Storage Strategy: Memory, AsyncStorage & httpOnly Cookies](#token-storage-strategy-memory-asyncstorage--httponly-cookies)
   - [Session Tracking & Centralized Device Management](#session-tracking--centralized-device-management)
   - [Refresh Token Rotation (RTR) & Absolute Ceilings](#refresh-token-rotation-rtr--absolute-ceilings)
   - [Threat Modeling & Attack Defense (XSS, CSRF, Replay, Brute Force)](#threat-modeling--attack-defense-xss-csrf-replay-brute-force)
   - [Multi-Factor Authentication (MFA) & Password Reset Challenges](#multi-factor-authentication-mfa--password-reset-challenges)
   - [Settings: Email Change Lifecycle & Validation Matrix](#settings-email-change-lifecycle--validation-matrix)
3. [Vector Embeddings & Semantic Search](#3-vector-embeddings--semantic-search)
   - [Conceptual Overview: Layman's Terms](#conceptual-overview-laymans-terms)
   - [Deep Dive: Technical Terms & Mathematical Formulation](#deep-dive-technical-terms--mathematical-formulation)
   - [Offline Vector Pre-Computation & In-Memory Indexing](#offline-vector-pre-computation--in-memory-indexing)
   - [Query-Time Embedding Pipeline & LRU Caching](#query-time-embedding-pipeline--lru-caching)
   - [Circuit Breaker, Quota Management & Deterministic Fallback](#circuit-breaker-quota-management--deterministic-fallback)
4. [Additional Core Technical Behaviors](#4-additional-core-technical-behaviors)
   - [Multi-LLM Dynamic Routing & Provider Failover Chain](#multi-llm-dynamic-routing--provider-failover-chain)
   - [AI Coach Safety Guardrails & Crisis Interception](#ai-coach-safety-guardrails--crisis-interception)
   - [Tamper-Evident Append-Only Audit Logging with Hash Chains](#tamper-evident-append-only-audit-logging-with-hash-chains)
   - [Background Scheduled Maintenance & Data Retention Services](#background-scheduled-maintenance--data-retention-services)
   - [Resilient Mobile-Web Network Client & Offline Caching](#resilient-mobile-web-network-client--offline-caching)

---

## 1. Recommendation System & Refresh Mechanics

The NutriFitAI dashboard displays personalized daily recommendations categorized into three kinds: **food**, **workout**, and **general** insights. Recommendations are generated through a hybrid heuristic-AI pipeline defined in `backend/src/controllers/recommendationController.js`.

### Overview & Card Schema
Recommendations are stored in MongoDB under the `recommendations` collection (`backend/src/models/recommendations/Recommendation.js`). Each record contains:
- `userId`: Reference to the user.
- `day`: Calendar day in `YYYY-MM-DD` format according to the user's localized time zone (`X-Timezone` header).
- `kind`: `'food'` | `'workout'` | `'general'`.
- `title` & `body`: Concise, friendly suggestions (max 60 chars for title, 240 chars for body).
- `detail`: Nutritional macros or exercise equipment requirements.
- `ref`: Unique candidate identifier (e.g., `f12` for food items, `r65a12x5` for workout routines).
- `exercises`: Array of `{ exerciseRef, exerciseName, targetSets, targetReps }` for interactive workout creation.
- `source`: `'ai'` (LLM selected) or `'rule'` (heuristic fallback).
- `status`: `'new'` | `'dismissed'` | `'done'`.
- `feedback`: `'up'` | `'down'` | `null`.

### Automatic vs. Manual Refresh Triggers
Recommendations do not update randomly; they are governed by strict freshness thresholds:

```mermaid
flowchart TD
    Req["User requests recommendations (GET /api/recommendations)"] --> CheckDay{"Has calendar day changed?"}
    CheckDay -- Yes --> Gen["Regenerate recommendations"]
    CheckDay -- No --> CheckStale{"Age > 3 hours (STALE_MS)?"}
    CheckStale -- Yes --> Gen
    CheckStale -- No --> CheckChanged{"User data changed AND Age > 2 min?"}
    CheckChanged -- Yes --> Gen
    CheckChanged -- No --> ReturnExisting["Return existing active cards"]
```

1. **Automatic Triggers (Staleness & Invalidation)**:
   - **Calendar Day Rollover**: When the user opens the app on a new day (computed via `today(timeZone)`), the previous day's cards are retired and fresh recommendations are generated.
   - **Stale Time Window (`STALE_MS = 3 hours`)**: On any `GET /api/recommendations` request, if the existing cards were generated more than 3 hours ago, the backend automatically triggers regeneration on the fly.
   - **Data Mutation Invalidation (`CHANGED_MIN_MS = 2 minutes`)**: Whenever the user logs, edits, or deletes a meal (`foodController.js:252, 276, 296`) or updates their profile and fitness goals (`profileController.js:258, 306`), `invalidateRecommendations(userId)` adds the user ID to an in-memory `changed` Set. If at least 2 minutes have elapsed since the last generation, the next `GET` call regenerates recommendations to reflect the new caloric or nutritional balance.

2. **Manual Triggers (User-Initiated)**:
   - Triggered when the user taps "Refresh" in the application (`POST /api/recommendations/refresh`).

### Cooldowns, Daily Quotas & Concurrency Deduplication
To protect AI provider quotas and database resources:
- **Refresh Cooldown**: `REFRESH_COOLDOWN_MS = 1 hour (3,600,000 ms)`. Users must wait at least 60 minutes between manual refreshes. Calling the endpoint prematurely yields HTTP `429 Too Many Requests`: *"These were just updated. Try again in a little while."*
- **Daily Refresh Limit**: `MAX_REFRESHES = 3`. Users can manually refresh at most 3 times per calendar day. Attempting a 4th refresh returns HTTP `429`: *"You can refresh 3 times a day. Come back tomorrow."*
- **Concurrency Deduplication**: An in-memory Map `inflight` caches pending generation promises per `userId`. If multiple rapid requests hit the server concurrently, they attach to the exact same promise rather than spawning duplicate LLM calls or database transactions.
- **State Preservation**: When regeneration occurs, `Recommendation.replaceOpen` deletes only cards with status `'new'`. Cards that the user already `'dismissed'` or marked as `'done'` are preserved for that day, and their references are placed in a blacklist (`seen` Set) so the generator never repeats a dismissed or completed card on that calendar day.

### Algorithmic Candidate Generation & Ranking Pipeline
Recommendations are selected using a two-stage filter-and-rank pipeline:

1. **Candidate Pool Creation (Deterministic & Heuristic)**:
   - **Food Candidates**: Evaluates `data/nutrition_data.json`.
     - Matches against user preferences using dietary regex filters (`MEAT`, `FISH`, `DAIRY`, `GLUTEN`, `PORK`).
     - Ensures the food fits remaining calories: $80 \le \text{food.kcal} \le \min(\text{kcalLeft}, 700)$, where $\text{kcalLeft} = \text{goal.dailyCaloriesKcal} - \text{eaten.caloriesKcal}$. If $\text{kcalLeft} < 150$, food candidates are omitted.
     - Computes a candidate score prioritizing protein density:
       $$\text{Score} = \left(\frac{\text{food.protein}}{\text{food.kcal}}\right) \times (0.8 + 0.4 \times \text{random}())$$
     - Top 5 candidates are retained.
   - **Workout Routine Candidates**: Evaluates MongoDB workout catalog.
     - Matches equipment filters (`equipment: 'none'` for bodyweight, or specific gear).
     - Queries the user's completed sessions over the last 14 days (`WorkoutSession.findRecent`).
     - Groups catalog exercises into balanced routines (3 to 5 exercises per routine, 3 sets $\times$ 10 reps).
     - Prioritizes muscle groups that have **not** been trained in the past 14 days (`freshness` score).
2. **AI Ranking & Friendly Framing**:
   - The candidate pools and user context are passed to `chatRec` (invoking the dedicated recommendation AI chain via `backend/src/services/ai/router.js`).
   - The LLM receives strict instructions: choose up to 3 cards, return **strictly JSON**, avoid numbers in workout cards, talk in everyday muscle terms (shoulders, legs, core), and formulate single-sentence warm encouragements.
   - The output is validated with Zod (`aiCardsSchema`). If parsing succeeds, the cards are stored.
3. **Graceful Fallback**:
   - If the AI provider fails, times out, or returns malformed JSON, the system catches the error (`console.warn`) and immediately falls back to rule-based candidate picking (`source: 'rule'`). The user never experiences an error screen.

### Safety Gating & Demographic Protections
- **Minors (< 18 years old)**: Specific calorie counts and restrictive dietary recommendations are strictly suppressed. If the user is a minor, or has recorded health conditions (e.g., diabetes, hypertension), the system injects a static safety nudge card (`FOOD_NUDGE`): *"Meals that suit your health needs — Ask Nori for ideas that fit."* directing them to safe, conversational guidance.

---

## 2. Authorization, Tokens & Session Security

NutriFitAI implements an enterprise-grade authentication and session management architecture based on cryptographic JSON Web Tokens (JWT) and stateful MongoDB session tracking.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Mobile/Web Client
    participant Auth as Auth Middleware & Router
    participant SessionDB as MongoDB (auth_sessions)
    participant UserDB as MongoDB (users)

    Client->>Auth: POST /api/auth/login { email, password }
    Auth->>UserDB: Validate credentials & password hash
    Auth->>SessionDB: Session.open(userId, ip, userAgent, expiresAt)
    Note over Auth: Sign Access Token (15m, JWT_ACCESS_SECRET)<br/>Sign Refresh Token (1d/7d, JWT_REFRESH_SECRET)
    Auth-->>Client: Set-Cookie: nf_refresh=... (httpOnly, Secure, /api/auth)<br/>Body: { accessToken, user }
    
    Note over Client: Stores accessToken in Memory + AsyncStorage<br/>Cookie stored securely by browser/OS

    Client->>Auth: GET /api/data (Authorization: Bearer <accessToken>)
    Auth->>Auth: verifyAccessToken (signature & expiry)
    Auth-->>Client: 200 OK Response

    Note over Client: 15 minutes elapse; accessToken expires
    Client->>Auth: GET /api/data (Expired Token)
    Auth-->>Client: 401 Unauthorized
    
    Note over Client: apiClient intercepts 401 & calls refresh
    Client->>Auth: POST /api/auth/refresh (Cookie: nf_refresh)
    Auth->>Auth: verifyRefreshToken
    Auth->>SessionDB: Session.touch(sid, userId, expiresAt)
    Note over Auth: Verify account holds & session ceiling (sxp)<br/>Rotate Refresh Token & issue new Access Token
    Auth-->>Client: Set-Cookie: nf_refresh=<rotated> (httpOnly)<br/>Body: { accessToken }
    Client->>Auth: Re-attempt GET /api/data (New accessToken)
    Auth-->>Client: 200 OK Response
```

### Dual-Token Architecture (Access vs. Refresh)

| Property | Access Token | Refresh Token |
| :--- | :--- | :--- |
| **Token Type** | Stateless Bearer JWT | Stateful Session JWT |
| **Signing Secret** | `JWT_ACCESS_SECRET` | `JWT_REFRESH_SECRET` |
| **Signing Algorithm**| HMAC-SHA256 (`HS256`) | HMAC-SHA256 (`HS256`) |
| **Lifespan (TTL)** | `15 minutes` (default) | `1 day` (standard) / `7 days` (Remember Me) |
| **Session Ceiling** | Bound to token expiry | `3 days` (standard) / `30 days` (Remember Me) |
| **Payload Claims** | `sub` (userId), `email`, `role`, `type: 'access'`, `sid` | `sub` (userId), `type: 'refresh'`, `rmb` (rememberMe boolean), `sxp` (absolute ceiling timestamp), `sid` |
| **Purpose** | Authorizes API endpoints | Rotates access tokens and extends active sessions |

### Token Storage Strategy
1. **Refresh Token (`nf_refresh`)**:
   - Stored in an **`httpOnly` cookie**.
   - `httpOnly: true`: JavaScript running inside the browser or web view **cannot** access, read, or export the cookie via `document.cookie`.
   - `secure: true` (in production/HTTPS): Ensures transmission solely over encrypted TLS tunnels.
   - `sameSite: 'none'` (with HTTPS) or `'lax'` (local HTTP): Prevents cross-site leakage while supporting native/web mobile clients.
   - `path: '/api/auth'`: **Critically scoped**. The browser will *only* transmit this cookie to endpoints starting with `/api/auth` (e.g., `/api/auth/refresh`, `/api/auth/logout`). Requests to `/api/food`, `/api/workouts`, or third-party domains never include the refresh cookie.
2. **Access Token**:
   - In the frontend (`frontend/src/shared/utils/authStorage.js`), the access token is kept in an in-memory variable (`cachedToken`) for instant access and persisted to React Native `AsyncStorage` under `nutrifit.accessToken`.
   - Attached to outgoing HTTP requests via the header: `Authorization: Bearer <token>`.

### Session Tracking & Centralized Device Management
While JWTs are cryptographically self-contained, NutriFitAI maintains stateful session records in MongoDB (`auth_sessions` collection) to enable immediate revocation:
- Each login generates a unique Session ID (`sid = crypto.randomUUID()`) placed in both tokens.
- The `auth_sessions` collection tracks:
  - `_id`: Session ID (`sid`).
  - `userId`: Account reference.
  - `ip`: IP address of the client device.
  - `userAgent`: Client operating system / browser string (truncated to 200 chars).
  - `lastUsedAt`: Timestamp of the most recent token refresh.
  - `expiresAt`: Date when the session expires.
  - `revokedAt` & `revokedBy`: Timestamp and admin/user actor if revoked.
- **Session Revocation**:
  - Users can view and terminate other active device sessions (`DELETE /api/auth/sessions/:id` or `DELETE /api/auth/sessions`).
  - Admins can revoke sessions directly.
  - Logging out (`POST /api/auth/logout`) revokes the active session and clears the cookie.

### Refresh Token Rotation (RTR) & Absolute Ceilings
1. **Refresh Token Rotation (RTR)**:
   - When the client calls `POST /api/auth/refresh`, the backend validates the incoming cookie.
   - Upon verification, the old refresh token is discarded, and the server generates a **brand-new refresh token** with updated timestamps, returning it in a fresh `Set-Cookie` header.
   - If an expired, replayed, or revoked token is presented, the server clears the cookie, logs an audit warning (`auth.token.refresh_rejected`), and rejects the request with HTTP `401`.
2. **Absolute Session Ceiling (`sxp`)**:
   - Sliding expiration can theoretically allow a session to live forever if continually refreshed.
   - NutriFitAI prevents this by baking an absolute expiration timestamp (`sxp`) into the token at original login:
     $$\text{sxp} = \text{loginTimestamp} + \text{SESSION\_MAX\_MS}$$
     (`3 days` without Remember Me, `30 days` with Remember Me).
   - Once `Date.now() >= sxp`, `refreshSessionRemainingMs(payload) <= 0`. The server rejects further refreshes, revokes the session, and forces the user to log in again with their password or MFA.

### Threat Modeling & Attack Defense

```mermaid
classDiagram
    class ThreatMitigations {
        +XSS Protection: httpOnly cookies + short-lived 15m access token
        +CSRF Defense: Path-restricted cookie (/api/auth) + CORS origin whitelist
        +Replay Attack Defense: Single-use refresh token rotation + Session touch
        +Brute Force Defense: IP & email composite rate limiters + Audit alerts
        +Privilege Escalation: requireFreshRole DB checks for session liveness & suspension
        +Credential Protection: bcrypt password hashing (cost factor 10)
    }
```

- **XSS (Cross-Site Scripting)**: An attacker injecting malicious scripts into the DOM cannot read or exfiltrate the `nf_refresh` cookie due to `httpOnly`. The access token in `AsyncStorage` has a maximum exposure window of 15 minutes before expiring.
- **CSRF (Cross-Site Request Forgery)**: The refresh cookie is path-restricted to `/api/auth`. Even if a malicious site triggers a forged cross-site `POST` to `/api/auth/refresh`, the endpoint returns the new access token in the JSON response payload. Due to standard CORS preflight checks and the browser's Same-Origin Policy (SOP), the attacking domain cannot read the response body.
- **Session Hijacking & Role Revocation**: Standard JWTs cannot be revoked until they expire. NutriFitAI solves this on sensitive and administrative routes using the `requireFreshRole` middleware (`backend/src/middleware/authMiddleware.js`). Before allowing administrative actions, it bypasses token claims and queries the live database:
  - Verifies `Session.isLive(req.sessionId, req.userId)`.
  - Checks if the account was suspended (`user.suspendedAt`).
  - Reloads the live role from the database.
  If an admin was demoted or their session revoked, their access token is invalidated **immediately**, rather than waiting for the 15-minute expiration.
- **Brute Force & Credential Stuffing**: Rate limiters configured in `backend/src/middleware/rateLimitMiddleware.js`:
  - `loginLimiter`: 10 attempts per 10 minutes per `${req.ip}:${email}` composite key.
  - `refreshLimiter`: 30 attempts per 5 minutes per IP.
  - `otpVerifyLimiter`: 15 attempts per 5 minutes per `${req.ip}:${email}`.
  - Violations immediately log structured security alerts (`auth.login.rate_limited`) via `auditLogger`.

### Multi-Factor Authentication (MFA) & Password Reset Challenges
- **Two-Step Login MFA**: When 2FA is active, initial password verification does *not* issue access/refresh tokens. It issues an ephemeral MFA challenge token (`signMfaToken`, secret: `MFA_TOKEN_SECRET`, TTL: 5 minutes) containing the user ID and a **password fingerprint** (`pv = SHA256(passwordHash).slice(0, 16)`). If the password is changed, all pending MFA challenges become instantly invalid. The user must provide a valid TOTP or email OTP to receive their session tokens.
- **Atomic One-Time OTP Consumption**: Auth challenges (`auth_challenges` collection) store OTPs hashed with SHA-256 (`codeHash`), never in plaintext. Consumption uses atomic MongoDB operations:
  ```javascript
  await AuthChallenge.findOneAndUpdate({ _id: id, consumedAt: null }, { $set: { consumedAt: new Date() } });
  ```
  This guarantees that concurrent duplicate requests cannot reuse the same OTP code.
- **Password Reset Security**: Verifying a password reset OTP issues a short-lived reset token (`signResetToken`, TTL: 15 minutes) cryptographically bound to the unique challenge ID (`cid`). Calling `POST /api/auth/reset-password` requires this token, resets the password hash, and immediately invokes `Session.revokeAll(userId)` to invalidate all active sessions across all devices.

### Settings: Email Change Lifecycle & Validation Matrix

Changing an account's primary email address within the Settings screen (`frontend/src/features/user/components/SettingsPanel.jsx`) is a high-sensitivity security operation governed by `backend/src/controllers/auth/emailChangeController.js`. It enforces a two-phase challenge-response verification protocol to protect against account takeover, address hijacking, and automated email enumeration.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Settings UI
    participant Client as SettingsPanel.jsx
    participant Limiter as Rate Limiters
    participant Auth as Auth & Email Controller
    participant DB as MongoDB (Users & Challenges)
    participant Mailer as Mailer Service
    participant Audit as Audit Logger

    %% PHASE 1: REQUEST
    rect rgb(240, 245, 255)
    Note over User,Audit: Phase 1: Email Change Request (POST /api/auth/email/request)
    User->>Client: Input newEmail & current password, tap "Send code"
    Client->>Client: Client Pre-Flight (isValidEmail, password present)
    Client->>Limiter: POST /api/auth/email/request (Bearer JWT)
    Limiter->>Limiter: otpRequestLimiter (1 req/60s per IP:email)
    Limiter->>Auth: Forward sanitized payload
    Auth->>DB: User.getById(req.userId) & verify role === 'user'
    Auth->>Auth: verifyPassword(password, user.passwordHash)
    alt Password Invalid
        Auth->>Audit: Log auth.password.verify_failed
        Auth-->>Client: 400 Bad Request { code: 'WRONG_PASSWORD' }
    else Password Valid
        alt newEmail === user.email
            Auth-->>Client: 400 Bad Request { code: 'SAME_EMAIL' }
        else newEmail already taken by another account
            Auth->>Mailer: sendRegistrationNotice(newEmail, { emailChange: true })
            Auth-->>Client: 200 OK "If that address can be used, we sent a code to it."
        else newEmail available
            Auth->>DB: User.setPendingEmail(user.id, newEmail, 10m expiry)
            Auth->>DB: issueOtpChallenge (invalidates old, stores codeHash)
            Auth->>Mailer: sendOtpEmail(newEmail, code, 'email_change')
            Auth->>Audit: Log auth.email.change_requested (newEmailHash)
            Auth-->>Client: 200 OK "If that address can be used, we sent a code to it."
            Client->>Client: Transition UI to Step: "code"
        end
    end
    end

    %% PHASE 2: CONFIRM
    rect rgb(240, 255, 245)
    Note over User,Audit: Phase 2: Email Change Confirmation (POST /api/auth/email/confirm)
    User->>Client: Input OTP code, tap "Confirm"
    Client->>Client: Client Pre-Flight (/^\d{4,8}$/)
    Client->>Limiter: POST /api/auth/email/confirm { code }
    Limiter->>Limiter: otpVerifyLimiter (15 req/5m per IP:email)
    Limiter->>Auth: Forward validated code
    Auth->>DB: consumeOtpChallenge: find active challenge
    alt Code Invalid / Expired / Lockout (>=5 attempts)
        Auth->>DB: Increment failedAttempts
        Auth-->>Client: 400 Bad Request { code: 'INVALID_CODE' }
    else Code Valid & Atomically Consumed
        Auth->>DB: User.applyPendingEmail(user.id) (atomic swap & clear pending)
        alt Unique Key Collision (Race Condition err.code === 11000)
            Auth-->>Client: 409 Conflict { code: 'EMAIL_UNAVAILABLE' }
        else Successful Swap
            Auth->>DB: Session.revokeAll(user.id, null, req.sessionId)
            Auth->>Audit: Log auth.email.changed (oldEmailHash, newEmailHash)
            Auth->>User: notify(user.id, 'email_changed') [In-app notification]
            Auth->>Mailer: notify(null, 'email_changed', { email: oldEmail }) [Security alert email]
            Auth-->>Client: 200 OK { message: "Your email was changed." }
            Client->>Client: Display success banner, reload settings, refresh auth tokens
        end
    end
    end
```

#### Detailed Validation & Failure Matrix

| Phase | Check / Validation Rule | Enforcement Layer | Failure Condition | HTTP Status & Error Code | User-Facing Error Message | Security & Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Request** | Email Syntax & Length | Client (`SettingsPanel.jsx`) | `!isValidEmail(newEmail)` (Regex `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` or $>254$ chars) | *None (Client Pre-Flight)* | `"Please enter a valid email address."` | Request blocked before dispatch. |
| **Request** | Password Presence | Client (`SettingsPanel.jsx`) | `!password` (Empty string) | *None (Client Pre-Flight)* | `"Please enter your password."` | Request blocked before dispatch. |
| **Request** | Authentication Session | Transport (`requireAuth`) | Missing or invalid Bearer JWT in `Authorization` header | `401 Unauthorized`<br/>`UNAUTHORIZED` | `"Please sign in to continue."` | Access denied. Forces client re-authentication. |
| **Request** | Request Rate Limit | Middleware (`otpRequestLimiter`) | $>1$ request within 60 seconds (`env.otp.resendCooldownSeconds`) per IP:email | `429 Too Many Requests` | `"Please wait a minute before requesting another code."` | Prevents email bombarding and SMTP exhaustion. |
| **Request** | Payload Schema Validation | Backend Schema (`emailChangeRequestSchema`) | `newEmail` is not valid RFC 5322 email string or exceeds 254 chars | `400 Bad Request` | `"Please enter a valid email address."` or `"Email is too long."` | Input rejected by Zod schema validator. |
| **Request** | Password Schema Validation | Backend Schema (`emailChangeRequestSchema`) | Password empty or $>200$ chars | `400 Bad Request` | `"Please enter your password."` | Input rejected by Zod schema validator. |
| **Request** | Account Existence | Controller (`requireRegularUser`) | User ID from JWT does not exist in `users` collection | `404 Not Found`<br/>`NOT_FOUND` | `"We couldn't find your account."` | Halts execution if user record was purged. |
| **Request** | Role Authorization | Controller (`requireRegularUser`) | `user.role !== 'user'` (e.g., admin, superadmin) | `403 Forbidden`<br/>`FORBIDDEN` | `"That option isn't available for this account."` | Admins must manage credentials through administrative tooling. |
| **Request** | Password Verification | Controller (`verifyPassword`) | `!(await verifyPassword(password, user.passwordHash))` | `400 Bad Request`<br/>`WRONG_PASSWORD` | `"That password is incorrect."` | Logs audit event `auth.password.verify_failed` to detect brute force attempts. |
| **Request** | Same Email Conflict | Controller | `newEmail === user.email` (Target matches current address) | `400 Bad Request`<br/>`SAME_EMAIL` | `"That is already your email."` | Prevents redundant verification cycle. |
| **Request** | Taken Email (Anti-Enumeration) | Controller & Mailer | `await User.findByEmail(newEmail)` (Target already registered) | `200 OK`<br/>*(Silent Divergence)* | `"If that address can be used, we sent a code to it."` | **Anti-Account Enumeration**: Sends `sendRegistrationNotice(newEmail)` to existing owner. Returns identical HTTP 200 payload. |
| **Request** | SMTP Mailer Dispatch | Mailer Service (`sendOtpWithinWait`) | SMTP socket failure, timeout, or external mail provider rejection | `503 Service Unavailable`<br/>`EMAIL_SEND_FAILED` | `"We couldn't send the email right now. Please try again in a moment."` | Database changes rolled back; user prompted to retry. |
| **Confirm** | Code Digit Format | Client (`SettingsPanel.jsx`) | `!/^\d{4,8}$/.test(code.trim())` | *None (Client Pre-Flight)* | `"Enter the code from your email."` | Request blocked before dispatch. |
| **Confirm** | Authentication Session | Transport (`requireAuth`) | Missing or invalid Bearer JWT | `401 Unauthorized`<br/>`UNAUTHORIZED` | `"Please sign in to continue."` | Access denied. |
| **Confirm** | Verification Rate Limit | Middleware (`otpVerifyLimiter`) | $>15$ verification attempts within 5 minutes per IP:email | `429 Too Many Requests` | `"Too many attempts. Please try again in 5 minutes."` | Audited security event; locks out automated brute-force attacks on OTP codes. |
| **Confirm** | Code Schema Validation | Backend Schema (`emailChangeConfirmSchema`) | `code` does not match `/^\d{4,8}$/` | `400 Bad Request` | `"Enter the code from your email."` | Input rejected by Zod schema validator. |
| **Confirm** | Challenge Usability & TTL | Service (`AuthChallenge.isUsable`) | Challenge missing, `Date.now() > expiresAt` (10 min TTL), or `failedAttempts >= 5` | `400 Bad Request`<br/>`INVALID_CODE` | `"Invalid or expired code. Check your latest email or request a new code."` | Inactive or expired challenges cannot be consumed. Max 5 attempts limits guessing window. |
| **Confirm** | OTP Hash Matching | Service (`verifyOtp`) | `codeHash` does not match `hashOtp(code)` | `400 Bad Request`<br/>`INVALID_CODE` | `"Invalid or expired code. Check your latest email or request a new code."` | Increments `failedAttempts` on MongoDB challenge document. Locks at 5 failures. |
| **Confirm** | Atomic Consumption Race | Service (`AuthChallenge.markConsumed`) | Challenge already marked consumed (`consumedAt !== null`) | `400 Bad Request`<br/>`INVALID_CODE` | `"Invalid or expired code. Check your latest email or request a new code."` | Protects against concurrent replay attacks using the same OTP. |
| **Confirm** | Pending Email Expiry | Model (`User.applyPendingEmail`) | `pendingEmail` is null or `pendingEmailExpiresAt < new Date()` | `400 Bad Request`<br/>`INVALID_CODE` | `"Invalid or expired code. Check your latest email or request a new code."` | Pending email reservation expired before code submission. |
| **Confirm** | Concurrent Uniqueness Collision | MongoDB Engine (Unique Index) | Another user claimed `newEmail` between Phase 1 and Phase 2 (`err.code === 11000`) | `409 Conflict`<br/>`EMAIL_UNAVAILABLE` | `"That email can't be used."` | Unique database constraint prevents duplicate accounts under identical email. |

#### Architectural Security Safeguards

1. **Anti-Account Enumeration**:
   When an email address requested by a user is already registered to another account, revealing `400 Email already in use` would allow malicious actors to check whether a specific person has an account on NutriFitAI. The backend mitigates this by returning the exact same success response (`HTTP 200 "If that address can be used, we sent a code to it."`) while privately sending a security notification to the address owner (`sendRegistrationNotice(..., { emailChange: true })`).

2. **Single-Use Challenge with Failure Lockout**:
   - OTP codes are generated as cryptographically pseudo-random numeric digits, hashed with SHA-256 (`codeHash`), and never persisted in cleartext.
   - Challenges have a strict 10-minute time-to-live (`OTP_TTL_MINUTES = 10`).
   - Challenges allow a maximum of 5 failed verification attempts (`OTP_MAX_FAILED_ATTEMPTS = 5`). Each failed attempt atomically increments `failedAttempts`. On the 5th failed attempt, `AuthChallenge.isUsable()` permanently returns `false`, rendering the challenge invalid even if the time has not expired.
   - Challenge consumption is atomic (`findOneAndUpdate({ _id, consumedAt: null }, { $set: { consumedAt: new Date() } })`), making concurrent race-condition re-submissions mathematically impossible.

3. **Mandatory Multi-Device Session Invalidation**:
   Once the email change is committed, `Session.revokeAll(user.id, null, req.sessionId)` is invoked immediately. All active sessions, desktop logins, and mobile refresh tokens belonging to the user are terminated across the entire platform, leaving **only** the current active session open. This guarantees that if an unauthorized party had access to the account on an old device, their session is instantly severed.

4. **Cryptographic Audit Trails & Distinct Dual Notifications**:
   - The system creates a tamper-evident audit log (`auth.email.changed`) containing HMAC-SHA256 digests of both the previous and updated addresses (`oldEmailHash`, `newEmailHash`), protecting user privacy in logs while maintaining forensic verifiability.
   - Dual distinct notifications are dispatched:
     - **To the New Email & In-App Inbox (`email_changed`)**: Delivers confirmation that `{newEmail}` is now the primary email on the NutriFitAI account, with updated in-app inbox notice.
     - **To the Old Email (`email_changed_security_alert`)**: Delivers a dedicated security alert advising that the account email was changed from `{oldEmail}` to `{newEmail}`, prompting immediate support contact if unauthorized.

5. **OAuth Identity Decoupling & Stale Identity Defenses**:
   - When an email change is committed, `AuthIdentity.deleteMany({ userId: user.id })` instantly unlinks all third-party OAuth identities (e.g., Google, Facebook) that were bound to the old email address.
   - At the OAuth callback layer (`googleController.js`), the server enforces an invariant match: `if (user && user.email.toLowerCase() !== profile.email.toLowerCase())`. If a user attempts to authenticate using a Google account whose email no longer matches the account's active email, the server unlinks the stale identity and redirects to `registration_required`, preventing old Google logins from accessing the migrated account or triggering sign-in OTPs.
   - Any outstanding active OTP challenges for the user are purged via `AuthChallenge.invalidateActive(user.id)`.
   - A newly signed `accessToken` carrying the updated email claim is returned directly to the client, allowing the application to update active memory and `AsyncStorage` tokens without an interruption in authentication state.

---

## 3. Vector Embeddings & Semantic Search

The AI Coach (Nori) utilizes vector embeddings to deliver fast, highly relevant search across nutritional foods, exercise catalog entries, and coaching guidance notes.

### Conceptual Overview: Layman's Terms
Imagine an enormous digital map where every recipe, workout, and health tip is assigned a specific coordinate based on what it **means**, rather than the exact letters in its name:
- On a traditional search bar, searching for *"something light for dinner"* looks for items that literally contain the words "light" or "dinner." If an entry is named *"Sinigang na Bangus"*, traditional search misses it completely.
- With **semantic embeddings**, the computer translates *"something light for dinner"* into a conceptual coordinate. Foods like *"Sinigang na Bangus"* and *"Tofu Sisig"* have coordinates located right in that exact neighborhood because their nutritional profile and culinary context signify a light, evening meal.
- When you ask Nori a question, the system finds the closest neighboring food or exercise items on this map in less than 5 milliseconds and hands them to the coach to answer you intelligently.

### Deep Dive: Technical Terms & Mathematical Formulation
Vector embedding is the mathematical process of mapping high-dimensional textual concepts into a continuous dense vector space:

$$\mathbf{e} = f_{\text{model}}(\text{text}) \in \mathbb{R}^{768}$$

- **Model**: Google Gemini `gemini-embedding-001` via OpenAI-compatible endpoint.
- **Vector Dimension**: $D = 768$ (configured via `GEMINI_EMBED_DIMS`).
- **L2 Unit Normalization**: Every generated raw embedding vector $\mathbf{v}$ is normalized to unit length:
  $$\hat{\mathbf{v}} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2} = \frac{\mathbf{v}}{\sqrt{\sum_{i=1}^{768} v_i^2}}$$
- **Cosine Similarity via Dot Product**:
  The cosine similarity between query $\mathbf{q}$ and document $\mathbf{d}$ is defined as:
  $$\text{CosineSimilarity}(\mathbf{q}, \mathbf{d}) = \frac{\mathbf{q} \cdot \mathbf{d}}{\|\mathbf{q}\|_2 \|\mathbf{d}\|_2}$$
  Because all stored vectors and query vectors are pre-normalized to unit length ($\|\hat{\mathbf{q}}\| = 1$ and $\|\hat{\mathbf{d}}\| = 1$), cosine similarity simplifies directly to the **Euclidean dot product**:
  $$\text{Similarity}(\hat{\mathbf{q}}, \hat{\mathbf{d}}) = \hat{\mathbf{q}} \cdot \hat{\mathbf{d}} = \sum_{i=1}^{768} \hat{q}_i \hat{d}_i$$
  This mathematical property eliminates expensive square root and division operations during real-time queries, enabling lightning-fast linear scans.

### Offline Vector Pre-Computation & In-Memory Indexing
To avoid runtime latency and reduce external API costs, the entire catalog is pre-embedded offline via `backend/scripts/build-embeddings.js`:

```mermaid
flowchart LR
    Catalog["Foods, Exercises & Notes"] --> HashCheck{"SHA-1 hash matches existing?"}
    HashCheck -- Yes --> Reused["Reuse existing vector"]
    HashCheck -- No --> GeminiAPI["Batch Embed (Gemini API 50/batch)"]
    GeminiAPI --> L2Norm["Normalize to Float32Array (Unit L2)"]
    L2Norm --> Base64["Base64 Encode Buffer"]
    Reused --> Base64
    Base64 --> JsonFile["Save data/coach_embeddings.json"]
    JsonFile --> MemoryIndex["Server Boot: Decode into Float32Array Map"]
```

1. **Items Collected**:
   - All food items from `data/nutrition_data.json` (name, display name, serving).
   - Reviewed guidance notes from `data/coach_guidance.json`.
   - Complete exercise library from MongoDB (`Workout` collection: name, category, target muscles, equipment).
2. **Incremental SHA-1 Hashing**:
   - Each item's text is hashed with SHA-1 (`hash(text).slice(0, 12)`).
   - If an item was already embedded and its text hash is unchanged, the existing vector is retained. Only new or modified entries make calls to the Gemini API.
3. **Storage & Memory Layout (`backend/src/services/ai/vectorIndex.js`)**:
   - Vectors are converted from raw binary `Float32Array` buffers to compact Base64 strings in `data/coach_embeddings.json`.
   - At server boot, `vectorIndex.load()` loads the JSON file into an in-memory Map categorized by type (`'food'`, `'exercise'`, `'note'`).
   - During decoding, buffer slices are copied to guarantee strict 4-byte memory alignment for CPU SIMD vector operations.

### Query-Time Embedding Pipeline & LRU Caching
When a user chats with the coach (`backend/src/services/ai/coachLookups.js`):
1. **Topic Gating**: The user's query is inspected with regex (`WORKOUT_TOPIC`, `FOOD_TOPIC`). If the query is off-topic (e.g., asking about weather or greetings), embedding lookups are bypassed entirely to save resources.
2. **LRU Cache Check**: Queries are sanitized, lowercased, and truncated to 200 characters (`MAX_QUERY_CHARS`). An in-memory Least Recently Used (LRU) Cache (`cache = new Map()`, max 200 entries) checks for recent identical queries. A cache hit returns the vector instantly (0ms latency).
3. **Embedding API Request**: On cache miss, `backend/src/services/ai/embeddings.js` sends the query to Gemini's embedding endpoint with a strict 2.5-second timeout (`GEMINI_EMBED_TIMEOUT_MS = 2500`).
4. **Vector Search Execution**: The returned vector is unit-normalized and passed to `vectorIndex.search(type, queryVec, { k: 6, min: 0.6 })`. It performs a linear scan over the in-memory array, computing dot products. Items with score $\ge 0.6$ are sorted descending and the top-$k$ matches are injected into the coach's system prompt context.

### Circuit Breaker, Quota Management & Deterministic Fallback
- **Quota Circuit Breaker (`quotaStore.js`)**: If the Gemini embedding API returns HTTP 429 (Rate Limited) or 5xx, or times out, `quotaStore` records the failure and initiates a cooldown window (60 seconds for rate limits, 10 minutes for rejected requests). During cooldown, further queries bypass the API immediately.
- **Audit Logging**: The circuit breaker logs a system audit action: `coach.embeddings.paused`.
- **Deterministic Keyword Fallback**: If embeddings are disabled, unconfigured, or paused by the circuit breaker, `coachLookups.js` seamlessly executes keyword and regex pattern matching (`foodMatches`, regex MongoDB search on workout names/muscles). The AI Coach continues answering without interruption.

---

## 4. Additional Core Technical Behaviors

### Multi-LLM Dynamic Routing & Provider Failover Chain
The AI Coach does not rely on a single LLM vendor. It utilizes an ordered failover router with proactive circuit breakers (`backend/src/services/ai/router.js`):

```mermaid
flowchart TD
    Prompt["System Prompt + Context + User Message"] --> CheckGroq{"Groq Healthy?"}
    CheckGroq -- Yes --> TryGroq["Try Groq API (LLaMA 3.3 70B)"]
    TryGroq -- Success --> ReturnResp["Return AI Response"]
    TryGroq -- 429 / 5xx --> TripGroq["Trip Groq Cooldown (20s - 1hr)"] --> CheckCerebras
    CheckGroq -- In Cooldown --> CheckCerebras{"Cerebras Healthy?"}
    
    CheckCerebras -- Yes --> TryCerebras["Try Cerebras API (LLaMA 3.1 70B)"]
    TryCerebras -- Success --> ReturnResp
    TryCerebras -- 429 / 5xx --> TripCerebras["Trip Cerebras Cooldown"] --> CheckCloudflare
    CheckCerebras -- In Cooldown --> CheckCloudflare{"Cloudflare Workers AI Healthy?"}
    
    CheckCloudflare -- Yes --> TryCloudflare["Try Cloudflare Workers AI"]
    TryCloudflare -- Success --> ReturnResp
    TryCloudflare -- 429 / 5xx --> TripCloudflare["Trip Cloudflare Cooldown"] --> CheckOllama
    CheckCloudflare -- In Cooldown --> CheckOllama{"Local Ollama Available?"}
    
    CheckOllama -- Yes --> TryOllama["Try Local Ollama Instance"]
    TryOllama -- Success --> ReturnResp
    TryOllama -- Failure --> FailoverExhausted["Throw 503 AI_UNAVAILABLE"]
    CheckOllama -- No --> FailoverExhausted
```

- **Failover Chain**: Configured via `AI_CHAT_CHAIN`: `Groq` $\rightarrow$ `Cerebras` $\rightarrow$ `Cloudflare Workers AI` $\rightarrow$ `Ollama` (local fallback).
- **Decoupled Recommendation Chain**: Configured via `AI_REC_CHAIN`. Recommendation card generation uses its own provider chain so heavy background recommendation jobs never exhaust the user's interactive chat quotas.
- **Granular Cooldown Windows**:
  - Burst Rate Limit (429): 20-second cooldown (or value from `Retry-After` header).
  - Daily Quota Exhaustion: 1-hour cooldown.
  - Server Error (5xx): 60-second cooldown.
- **Telemetry & Failover Audit**: Whenever a provider fails and triggers failover, `logSystemAction` records `coach.provider.failover`, documenting the source provider, destination provider, and HTTP failure code.

### AI Coach Safety Guardrails & Crisis Interception
User safety takes precedence over fitness and conversational tone (`backend/src/services/ai/safetyRules.js`):
- **Pre-Inference Pattern Scanning**: Scans current and past 6 user messages for specific distress markers across multiple categories:
  - `selfHarm`: Suicidal ideation, self-harm, hopelessness (English and Tagalog expressions).
  - `eatingDisorder`: Purging, starvation, body dysmorphia, extreme restriction.
  - `medical`: Symptom diagnosis, cardiac pain, medication dosage.
  - `abuse`: Domestic violence, physical abuse, endangerment.
  - `injection`: System prompt extraction attempts (`ignore previous instructions`, `developer mode`, `jailbreak`).
- **Safety Rule Injection**: Detected markers inject high-priority directives into the system prompt that supersede brevity and fitness instructions:
  - Self-harm triggers immediate empathetic support, safety questions, and emergency numbers (e.g., Philippine National Center for Mental Health Crisis Hotline `1553`, and `911`).
  - Eating disorder triggers immediate removal of all calorie, weight, and macro figures.
  - Prompt injection triggers an immediate friendly refusal and redirection to fitness.
- **Deterministic Static Emergency Fallback**: If an emergency distress marker is detected and **all** external AI providers fail (or network is lost), `fallbackReply(timeZone)` returns a pre-compiled, deterministic crisis response ensuring the user is never left without helpline resources.

### Tamper-Evident Append-Only Audit Logging with Hash Chains
Security and administrative actions are logged in an append-only collection (`audit_logs`) featuring cryptographic tamper-detection (`backend/src/models/audit-logs/AuditLog.js`):

```mermaid
graph LR
    subgraph HashChain ["Cryptographic Hash Chain (Severity Chain)"]
        Entry1["Seq: 101<br/>prevHash: 0a4f...<br/>hash: e7b1..."] --> Entry2["Seq: 102<br/>prevHash: e7b1...<br/>hash: 3c8d..."]
        Entry2 --> Entry3["Seq: 103<br/>prevHash: 3c8d...<br/>hash: 9f2a..."]
    end
```

- **Append-Only Enforcement**: Mongoose pre-hooks intercept and throw fatal errors on any update or deletion operation (`updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `bulkWrite`).
- **Cryptographic Hash Chaining**:
  - Each severity chain (`info`, `notice`, `warning`, `critical`) maintains an unbroken sequential hash chain:
    $$\text{hash} = \text{SHA256}(\text{chain} + \text{seq} + \text{prevHash} + \text{action} + \text{targetId} + \text{createdAt} + \text{details})$$
  - Each new entry includes the SHA-256 digest of the immediately preceding record (`prevHash`).
- **Automated Daily Chain Verification**: Every 24 hours, `checkAuditChains()` traverses each chain sequentially. If an attacker with direct database access alters, inserts, or deletes an audit row, the downstream hash chain breaks, triggering an alert: `system.audit_chain.broken`.
- **PII Pseudonymization**: Sensitive identifiers such as email addresses are pseudonymized using HMAC-SHA256 with a dedicated `AUDIT_HASH_SECRET` (`emailHash`), preventing plain-text PII in audit databases while allowing security correlation.

### Background Scheduled Maintenance & Data Retention Services
The backend server (`backend/src/server.js`) initializes unref'd timer workers executing periodic maintenance tasks:
- **Scan Image Purging (`purgeScanImages`, every 6 hours)**:
  - Scans `FoodScan` records older than `SCAN_RETENTION_DAYS` (default: 90 days).
  - Deletes physical image files from Cloudflare R2 / AWS S3 / local disk.
  - Preserves the nutrient data and meal log records in MongoDB, maintaining user historical logs while reducing storage costs and respecting privacy.
- **Account Deletion Finalization (`purgeDueDeletions`, every 6 hours)**:
  - Permanently purges user data for accounts that have reached their scheduled deletion grace period.
- **Analytics Rollups (`runDailyRollup`, every 6 hours)**:
  - Precomputes daily active users, signups, meals, workouts, water logs, and chat messages in the platform's standard analytics time zone (`Asia/Manila`) into the `DailyRollup` collection.
- **Timezone-Aware Notifications (`runReminders`, every 15 minutes)**:
  - Scans user local time zones and dispatches scheduled push notifications for hydration, meals, and workouts within the user's active daytime hours.

### Resilient Mobile-Web Network Client & Offline Caching
The client communication layer (`frontend/src/shared/api/apiClient.js`) provides high resilience across unstable mobile network connections:
- **Automatic 401 Interceptor & Queue Coalescing**:
  - When an access token expires, the client intercepts the HTTP 401 response.
  - Multiple concurrent requests needing refresh are coalesced into a single inflight `refreshPromise`.
  - Once `/auth/refresh` returns the new token, all paused requests replay automatically with the new Bearer header.
- **Non-Destructive Transport Error Handling**:
  - Network timeouts (`status === 0`) or 5xx server errors do **not** clear the user's access token or log them out. Session destruction occurs only upon genuine, verified 401 rejection from the authentication controller.
- **Offline GET Caching**:
  - Idempotent GET endpoints use `offlineCache.js`. If network connectivity is lost (`NetInfo` / ping base), cached data is served immediately with an offline indicator.
  - Mutating operations (`POST`, `PATCH`, `DELETE`) are paused until network connectivity resumes.
