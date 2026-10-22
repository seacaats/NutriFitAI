import os
import sys
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            # Skip header/footer on cover page
            return
        
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header line & text
        self.drawString(54, 800, "NutriFitAI — Technical Architecture & System Behaviors Specification")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 792, 540, 792)
        
        # Footer line & text
        self.line(54, 45, 540, 45)
        self.drawString(54, 32, "Confidential & Proprietary — NutriFitAI Engineering")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(540, 32, page_text)
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Palette
    primary = colors.HexColor("#0F172A")    # slate-900
    secondary = colors.HexColor("#1E293B")  # slate-800
    accent = colors.HexColor("#0D9488")     # teal-600
    emerald = colors.HexColor("#10B981")    # emerald-500
    blue = colors.HexColor("#2563EB")       # blue-600
    muted = colors.HexColor("#64748B")      # slate-500
    bg_light = colors.HexColor("#F8FAFC")   # slate-50
    border_color = colors.HexColor("#E2E8F0")

    # Typography styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=primary,
        spaceAfter=10
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=16,
        textColor=muted,
        spaceAfter=20
    )
    
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=primary,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=secondary,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    h3_style = ParagraphStyle(
        'Heading3_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=accent,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0F172A")
    )
    
    callout_style = ParagraphStyle(
        'Callout_Text',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#0F172A")
    )

    story = []

    # ================= COVER BANNER =================
    story.append(Spacer(1, 20))
    story.append(Paragraph("<b>NutriFitAI</b> &nbsp;|&nbsp; Engineering Whitepaper", ParagraphStyle('TopTag', fontName='Helvetica-Bold', fontSize=10, textColor=emerald, leading=12)))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Technical System Behaviors &amp; Architecture Specification", title_style))
    story.append(Paragraph("An exhaustive engineering analysis of recommendation lifecycles, dual-token authorization and session security, vector embeddings &amp; semantic search, multi-LLM routing, and cryptographic audit chains.", subtitle_style))
    
    # Meta box table
    meta_data = [
        [
            Paragraph("<b>Target Platform:</b> Node.js / Express / MongoDB Atlas", body_style),
            Paragraph("<b>Client:</b> React Native (Expo) &amp; Web", body_style),
            Paragraph("<b>Version:</b> 1.0 (Production)", body_style),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[180, 160, 140])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceBefore=5, spaceAfter=15))

    # ================= SECTION 1 =================
    story.append(Paragraph("1. Recommendation System &amp; Refresh Mechanics", h1_style))
    story.append(Paragraph(
        "The NutriFitAI dashboard serves dynamically tailored recommendations across three domains: <b>food</b> (macronutrient and calorie-targeted meals), <b>workout</b> (multi-movement routines targeting untrained muscle groups), and <b>general</b> (biometric habit insights). Implemented in <code>recommendationController.js</code> and backed by MongoDB's <code>recommendations</code> collection.",
        body_style
    ))
    
    story.append(Paragraph("Automated vs. Manual Refresh Triggers", h2_style))
    story.append(Paragraph("Recommendations update through both background automated checks and rate-limited manual user requests:", body_style))
    story.append(Paragraph("&bull; <b>Calendar Day Rollover:</b> Calculated on every request using <code>today(timeZone)</code> via the client <code>X-Timezone</code> header. At local midnight, old cards are retired and fresh cards generate on first dashboard visit.", bullet_style))
    story.append(Paragraph("&bull; <b>Staleness Window (STALE_MS = 3 Hours):</b> If open cards are older than 3 hours, calling <code>GET /api/recommendations</code> automatically triggers background regeneration.", bullet_style))
    story.append(Paragraph("&bull; <b>Data Mutation Invalidation (CHANGED_MIN_MS = 2 Minutes):</b> Logging, editing, or deleting meals (<code>foodController.js:252</code>) or updating goals/biometrics (<code>profileController.js:258</code>) calls <code>invalidateRecommendations(userId)</code>, adding the user to an in-memory <code>changed</code> Set. On subsequent visits &gt; 2 minutes later, recommendations regenerate to reflect newly logged calories and macros.", bullet_style))
    story.append(Paragraph("&bull; <b>Manual User Trigger (POST /api/recommendations/refresh):</b> Allows user-initiated regeneration subject to strict cooldowns.", bullet_style))

    story.append(Paragraph("Cooldown Periods, Daily Limits &amp; Deduplication", h2_style))
    story.append(Paragraph("&bull; <b>Manual Cooldown:</b> <code>REFRESH_COOLDOWN_MS = 1 hour (60 minutes)</code>. Rapid refreshes reject with HTTP 429: <i>'These were just updated. Try again in a little while.'</i>", bullet_style))
    story.append(Paragraph("&bull; <b>Daily Refresh Quota:</b> <code>MAX_REFRESHES = 3</code> refreshes per day. A 4th attempt returns HTTP 429: <i>'You can refresh 3 times a day. Come back tomorrow.'</i>", bullet_style))
    story.append(Paragraph("&bull; <b>Concurrency Deduplication:</b> An in-memory Map <code>inflight</code> coalesces concurrent requests per user so parallel taps attach to the same promise rather than spawning duplicate AI calls.", bullet_style))
    story.append(Paragraph("&bull; <b>Dismissed Card Persistence:</b> <code>replaceOpen</code> deletes only cards with <code>status: 'new'</code>. Cards the user marked <code>'dismissed'</code> or <code>'done'</code> remain saved for that day and are added to a blacklist Set so they are never repeated.", bullet_style))

    story.append(Paragraph("Algorithmic Candidate Selection &amp; Guardrails", h2_style))
    story.append(Paragraph("&bull; <b>Food Heuristics:</b> Evaluates <code>nutrition_data.json</code> against dietary restrictions using regexes (meat, dairy, gluten, pork). Requires remaining caloric headroom &ge; 150 kcal. Candidates scored by protein density: <code>Score = (protein / kcal) * (0.8 + 0.4 * rand())</code>.", bullet_style))
    story.append(Paragraph("&bull; <b>Workout Heuristics:</b> Queries <code>WorkoutSession.findRecent</code> over past 14 days. Excludes completed exercises, groups 3–5 catalog movements, and prioritizes untrained muscle groups.", bullet_style))
    story.append(Paragraph("&bull; <b>AI Selection &amp; Fallback:</b> Passed to <code>chatRec</code> for strict JSON ranking. If AI times out or errors, immediately falls back to deterministic rule-based picks (<code>source: 'rule'</code>).", bullet_style))
    story.append(Paragraph("&bull; <b>Minor Protection:</b> Minors (&lt; 18) and users with health notes receive a static nudge card (<code>FOOD_NUDGE</code>) directing them to conversational guidance without caloric targets.", bullet_style))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceBefore=5, spaceAfter=15))

    # ================= SECTION 2 =================
    story.append(Paragraph("2. Authorization Tokens &amp; Session Security", h1_style))
    story.append(Paragraph(
        "NutriFitAI implements an enterprise dual-token authentication model combining short-lived stateless JWT access tokens with statefully tracked, rotated refresh tokens in browser-shielded cookies.",
        body_style
    ))
    
    # Token comparison table
    token_table_data = [
        [Paragraph("<b>Attribute</b>", body_style), Paragraph("<b>Access Token</b>", body_style), Paragraph("<b>Refresh Token (nf_refresh)</b>", body_style)],
        [Paragraph("<b>Token Type</b>", body_style), Paragraph("Stateless Bearer JWT", body_style), Paragraph("Stateful Session JWT", body_style)],
        [Paragraph("<b>Secret &amp; Alg</b>", body_style), Paragraph("JWT_ACCESS_SECRET (HS256)", body_style), Paragraph("JWT_REFRESH_SECRET (HS256)", body_style)],
        [Paragraph("<b>Lifespan</b>", body_style), Paragraph("15 minutes (fixed)", body_style), Paragraph("1 day (standard) / 7 days (Remember Me)", body_style)],
        [Paragraph("<b>Absolute Ceiling (sxp)</b>", body_style), Paragraph("Bound to 15m lifespan", body_style), Paragraph("3 days (standard) / 30 days (Remember Me)", body_style)],
        [Paragraph("<b>Claims</b>", body_style), Paragraph("{ sub, email, role, type:'access', sid }", body_style), Paragraph("{ sub, type:'refresh', rmb, sxp, sid }", body_style)],
        [Paragraph("<b>Storage Location</b>", body_style), Paragraph("Memory &amp; AsyncStorage", body_style), Paragraph("<b>httpOnly, Secure Cookie (path=/api/auth)</b>", body_style)],
        [Paragraph("<b>Transmission</b>", body_style), Paragraph("Authorization: Bearer header", body_style), Paragraph("Automated cookie transport", body_style)]
    ]
    t_table = Table(token_table_data, colWidths=[120, 160, 200])
    t_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), bg_light),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Refresh Token Rotation (RTR) &amp; Absolute Session Ceilings", h2_style))
    story.append(Paragraph(
        "Calling <code>POST /api/auth/refresh</code> verifies the presented cookie, consumes it, and generates a brand-new rotated refresh token. To prevent indefinite session hijacking, an immutable session ceiling timestamp (<code>sxp = loginTime + SESSION_MAX_MS</code>) is embedded in the token. Once <code>Date.now() &ge; sxp</code>, refreshes are unconditionally rejected, destroying the cookie and forcing re-login.",
        body_style
    ))

    story.append(Paragraph("Threat Mitigations &amp; Attack Defenses", h2_style))
    story.append(Paragraph("&bull; <b>XSS Protection:</b> Refresh tokens reside in <code>httpOnly</code> cookies inaccessible to JavaScript. The access token has a narrow 15-minute exposure window.", bullet_style))
    story.append(Paragraph("&bull; <b>CSRF Defense:</b> Cookie scoped strictly to <code>path: '/api/auth'</code>. Calling refresh returns the new access token in the JSON body, which cross-site origins cannot read due to CORS and Same-Origin Policy.", bullet_style))
    story.append(Paragraph("&bull; <b>Immediate Role &amp; Session Invalidation (requireFreshRole):</b> Bypasses token claims on admin/sensitive routes to query MongoDB live: verifies <code>Session.isLive(sid)</code> and checks account suspension (<code>user.suspendedAt</code>). Demoted or suspended users lose access instantly.", bullet_style))
    story.append(Paragraph("&bull; <b>Brute Force Rate Limiting:</b> Tiered limiters throttle logins (10/10m per IP:email), refreshes (30/5m), and OTP verification (15/5m). Violations log automated audit alerts (<code>auth.login.rate_limited</code>).", bullet_style))
    story.append(Paragraph("&bull; <b>Atomic One-Time OTPs:</b> Stored as SHA-256 hashes (never plaintext). Consumed atomically via <code>findOneAndUpdate({ _id, consumedAt: null })</code>, preventing race-condition replays. Resetting password revokes all active sessions across all devices.", bullet_style))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceBefore=5, spaceAfter=15))

    # ================= SECTION 3 =================
    story.append(Paragraph("3. Vector Embeddings &amp; Semantic Search", h1_style))
    story.append(Paragraph(
        "NutriFitAI equips the AI coach (Nori) with semantic retrieval over food catalogs, workouts, and coaching guidance notes, implemented in <code>embeddings.js</code> and <code>vectorIndex.js</code>.",
        body_style
    ))
    
    story.append(Paragraph("Layman's Terms vs. Technical Formulation", h2_style))
    story.append(Paragraph(
        "<b>In Layman's Terms:</b> Standard search matches exact letters. Searching for <i>'light dinner'</i> fails to find <i>'Sinigang na Bangus'</i> because the words don't match. Vector embeddings place concepts as coordinates on a high-dimensional digital map. Dishes that represent light, savory, high-protein evening meals sit in the same neighborhood. When you ask Nori a question, the system finds the closest items on the map in under 5 milliseconds.",
        body_style
    ))
    story.append(Paragraph(
        "<b>In Technical Terms:</b> Google Gemini (<code>gemini-embedding-001</code>) maps input strings into 768-dimensional dense vectors: <code>e = f(text) &isin; R^768</code>. All vectors are pre-normalized to unit Euclidean length: <code>v_norm = v / ||v||_2</code>. Because all vectors are unit-length, cosine similarity simplifies directly to the <b>Euclidean dot product</b>: <code>Similarity(q, d) = q &middot; d = &sum; (q_i * d_i)</code>. This eliminates expensive runtime square roots, enabling blisteringly fast linear scans over in-memory arrays.",
        body_style
    ))

    story.append(Paragraph("Offline Pre-Computation &amp; Runtime Query Pipeline", h2_style))
    story.append(Paragraph("&bull; <b>Offline Indexing (build-embeddings.js):</b> Foods, guidance notes, and exercise catalog items are extracted and hashed with SHA-1. Only changed or new records invoke Gemini API. Stored as Base64-encoded Float32Array buffers in <code>coach_embeddings.json</code>.", bullet_style))
    story.append(Paragraph("&bull; <b>Memory Alignment:</b> At boot, <code>vectorIndex.load()</code> parses the index into an in-memory Map, copying buffer slices to guarantee 4-byte alignment required for SIMD vector instructions.", bullet_style))
    story.append(Paragraph("&bull; <b>Topic Gating &amp; LRU Caching:</b> Queries pass regex topic filters. A 200-item LRU cache returns recent queries in 0ms. On miss, Gemini Embeddings is queried with a strict 2.5-second timeout.", bullet_style))
    story.append(Paragraph("&bull; <b>Circuit Breaker &amp; Fallback:</b> On HTTP 429/5xx, <code>quotaStore</code> initiates cooldown (60s to 10m) and logs <code>coach.embeddings.paused</code>. Lookups gracefully degrade to deterministic regex/keyword matching (<code>foodMatches</code>).", bullet_style))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceBefore=5, spaceAfter=15))

    # ================= SECTION 4 =================
    story.append(Paragraph("4. Additional Core Technical Behaviors", h1_style))
    story.append(Paragraph("Key architectural behaviors powering reliability, safety, and background processing across NutriFitAI:", body_style))

    story.append(Paragraph("Multi-LLM Dynamic Routing &amp; Failover Chain (router.js)", h2_style))
    story.append(Paragraph(
        "Chat requests evaluate an ordered provider failover chain: <b>Groq (llama-3.3-70b)</b> &rarr; <b>Cerebras (llama3.1-70b)</b> &rarr; <b>Cloudflare Workers AI</b> &rarr; <b>Ollama (local)</b>. Recommendations run on an isolated chain (<code>AI_REC_CHAIN</code>) so background generation jobs never consume user conversational chat quotas. Circuit breakers enforce 20s burst cooldowns on 429s and 1-hour cooldowns on daily limit exhaustion.",
        body_style
    ))

    story.append(Paragraph("AI Coach Safety Guardrails &amp; Crisis Interception (safetyRules.js)", h2_style))
    story.append(Paragraph(
        "Pre-inference regex scanning checks active and prior 6 messages for self-harm, eating disorders, domestic abuse, and prompt injection (<code>ignore previous instructions</code>). Self-harm triggers immediate empathetic crisis protocols and emergency numbers (Philippine NCMH Crisis Hotline <b>1553</b> and <b>911</b>), overriding normal brevity rules. A deterministic static fallback reply guarantees an immediate crisis response if all external AI providers are offline.",
        body_style
    ))

    story.append(Paragraph("Cryptographic Append-Only Audit Logging (AuditLog.js)", h2_style))
    story.append(Paragraph(
        "Mongoose pre-hooks block all update and delete queries on <code>audit_logs</code>. Every entry maintains an unbroken SHA-256 hash chain: <code>hash_n = SHA256(chain + seq + hash_{n-1} + action + target + details)</code>. Daily background checks verify chain continuity; database tampering immediately triggers <code>system.audit_chain.broken</code> alerts. Sensitive PII (emails) are pseudonymized with HMAC-SHA256.",
        body_style
    ))

    story.append(Paragraph("Automated Scheduled Background Maintenance (server.js)", h2_style))
    story.append(Paragraph(
        "Unref'd background timers execute recurring tasks: <b>Scan Image Purging (every 6h)</b> permanently deletes raw food photos older than 90 days from cloud storage while preserving nutritional metadata in MongoDB; <b>Account Deletion (every 6h)</b> purges accounts past their statutory grace period; <b>Daily Rollups (every 6h)</b> aggregates platform stats in <code>Asia/Manila</code> timezone; and <b>Reminders (every 15m)</b> dispatches notifications aligned with user daylight hours.",
        body_style
    ))

    story.append(Paragraph("Client Network Resilience &amp; Offline GET Caching (apiClient.js)", h2_style))
    story.append(Paragraph(
        "When an access token expires, the client pauses failed requests, coalesces concurrent calls into a single <code>refreshPromise</code>, calls <code>/auth/refresh</code>, and automatically replays requests with the new token. Idempotent GET endpoints leverage local caching (<code>offlineCache.js</code>), and network drops preserve user credentials without forcing a logout.",
        body_style
    ))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {filename}")

if __name__ == '__main__':
    output_path = sys.argv[1] if len(sys.argv) > 1 else 'NutriFitAI_Technical_System_Behaviors.pdf'
    build_pdf(output_path)
