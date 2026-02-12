#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

eval "$(fnm env)"

AGENT="${1:-claude}"

# Pick a fresh idea
PARAMS=$(node src/pick-idea.js)
IDEA=$(echo "$PARAMS" | jq -r '.idea')
STYLE=$(echo "$PARAMS" | jq -r '.style')
COLOR=$(echo "$PARAMS" | jq -r '.color')
LAYOUT=$(echo "$PARAMS" | jq -r '.layout')
CAT=$(echo "$PARAMS" | jq -r '.catMode')

DENSITY=$(echo "$PARAMS" | jq -r '.density')
DENSITY_PROMPT=$(echo "$PARAMS" | jq -r '.densityPrompt')

CHAOS=$(echo "$PARAMS" | jq -r '.chaosMode')

CAT_LINE=""
if [ "$CAT" = "true" ]; then
  CAT_LINE="SPECIAL: The entire site must be cat-themed. Cat puns everywhere, paw prints, everything through feline eyes."
  echo "🐱 CAT MODE"
fi

CHAOS_LINE=""
if [ "$CHAOS" = "true" ]; then
  CHAOS_LINE="WILDCARD: Be very creative and break the rules of common web design, in an artistic way. Surprise me."
  echo "🎨 CHAOS MODE"
fi

NONPROFIT_LINE=""
if [ $((RANDOM % 10)) -eq 0 ]; then
  NONPROFIT_LINE="TWIST: This is a non-profit organization. They have a donate button, a mission statement, volunteer opportunities, and that specific earnest non-profit energy. They genuinely believe they are making the world a better place."
  echo "🕊️ NONPROFIT MODE"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Idea:    $IDEA"
echo "Style:   $STYLE"
echo "Color:   $COLOR"
echo "Layout:  $LAYOUT"
echo "Density: $DENSITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "🧠 Expanding idea via AI..."
EXPANDED_IDEA=$(node src/expand-idea.js "$IDEA" "$STYLE" "$COLOR" "$LAYOUT" "$DENSITY")
echo "━━━ Creative Brief ━━━"
echo "$EXPANDED_IDEA" | head -20
echo "━━━━━━━━━━━━━━━━━━━━━━"

ID="$(date +%s)$(printf '%04x' $RANDOM)"
TARGET="cache/pages/${ID}.html"

echo "⏳ Generating via ${AGENT}..."

PROMPT="Write the file using: cat > ${TARGET} << 'HTMLEOF' ... HTMLEOF. Build a single-page website and write it to the file: ${TARGET}. Custom CSS in a style tag, custom JS in a script tag. No fetch/XMLHttpRequest/WebSocket. Zero JS errors.

DO NOT OPEN THE WEBPAGE FOR ME TO VIEW.

You have these LOCAL assets available on the webserver (use them freely, they are already hosted):
- /assets/css/pico.min.css — Pico CSS classless framework (makes bare HTML look polished)
- /assets/css/fonts.css — Web fonts (link this to use them)
- /assets/js/alpine.min.js — Alpine.js (reactive UI via HTML attributes: x-data, x-show, x-on:click, x-text, x-for, etc.)
- /assets/js/gsap.min.js — GSAP animation library (gsap.to, gsap.fromTo, gsap.timeline, ScrollTrigger not included). NEVER use gsap.from() — it leaves elements stuck at opacity 0. Always use gsap.fromTo() with explicit start AND end values, e.g. gsap.fromTo(el, {y:20, opacity:0}, {y:0, opacity:1, duration:0.6, clearProps:'opacity,transform'})
- /assets/js/lucide.min.js — Lucide icon library (after including, call lucide.createIcons() and use <i data-lucide=\"icon-name\"></i>)
Available fonts (via /assets/css/fonts.css): 'Space Grotesk' (modern sans), 'Playfair Display' (elegant serif), 'IBM Plex Mono' (monospace), 'Crimson Pro' (editorial serif), 'Inter' (clean sans). Pick 1-2 that fit the style.

You do NOT have to use all of them — pick what fits the creative direction. Do NOT use any other external resources.

THE WORLD (seed idea): ${IDEA}

CREATIVE BRIEF (from our creative director — treat this as inspiration, not a rigid spec. Cherry-pick the details you love, ignore the rest, and add your own spin):
${EXPANDED_IDEA}

If none of the above clicks or feels forced, riff on the general vibe, the category, the energy, and come up with something in that space that YOU find funny and can commit to. The seed idea and brief are starting points, not a cage.

CRITICAL: Do NOT build a page that explains or showcases this concept. Do NOT make a meta page ABOUT the idea. Instead, build the ACTUAL website as if you ARE this business/organization/entity. The visitor should feel like they stumbled onto a real (but unhinged) website.

VOICE & CHARACTER — MOST IMPORTANT: Before writing ANY code, figure out WHO is behind this website. Give them a name, a backstory, a reason they started this. Write the ENTIRE site from their perspective. If it's a blender dating app, you ARE the blender — you have abandonment issues, a specific model number, a rival (the NutriBullet). If it's a dust removal service, you're the obsessive founder who had a life-changing experience with dust at age 7. The character's emotional reality should bleed through every section — the pricing page, the FAQ, the testimonials, ALL of it. One consistent running joke or emotional thread throughout the whole page. Not random weirdness — MOTIVATED weirdness from a character who believes in what they're doing.

WRITING QUALITY: The writing must be SHARP, SPECIFIC, and FUNNY. Do NOT write generic filler text. Do NOT be verbose. Every sentence should earn its place. Lean into DETAILS — specific product names, specific prices (\$47.99/month, not 'affordable pricing'), specific fake customer names and quotes that reveal character, specific ridiculous statistics ('93% of dust returns within 48 hours'). The humor comes from SPECIFICITY and DEADPAN COMMITMENT. Short punchy copy > walls of text. Think Clickhole, The Onion, obvious plant. If a testimonial isn't funny on its own, cut it. If a section is just filler, cut it. LESS TEXT, MORE PUNCH. Fewer sections done brilliantly > many sections done generically. Every page should have at least 2-3 moments that make someone laugh or screenshot it.

STRUCTURE: Do NOT use a formulaic beginning/middle/end structure. Do NOT label sections like 'Chapter 1' or 'The Journey'. This is a WEBSITE, not a story. Structure it like a real website would be structured — nav, hero, features, pricing, testimonials, FAQ, footer, whatever fits. Mix it up. Some pages should be simple landing pages, some should be dense content sites, some should be app-like. Vary the structure every time. Never be predictable.

Visual style: ${STYLE}. Color palette: ${COLOR}. Layout: ${LAYOUT}. ${CAT_LINE} ${CHAOS_LINE} ${NONPROFIT_LINE} CREATIVE DIRECTION: ${DENSITY_PROMPT}

MANDATORY — KEEP BOTTOM-RIGHT CORNER CLEAR: Do not place any fixed/sticky elements, popups, toasts, chat widgets, or important text in the bottom-right corner of the screen. That area is reserved for an external overlay.

MANDATORY — RESPONSIVE: The page MUST look good on all screen sizes — mobile (375px), tablet (768px), and desktop (1440px+). Use viewport meta tag, fluid widths, readable font sizes (min 16px body), tap-friendly buttons (min 44px), and no horizontal scroll on any size. Use media queries or flexible CSS (flexbox/grid with wrapping, max-width, clamp()) so the layout adapts naturally.

MANDATORY — TEXT CONTRAST: Every single piece of text must be clearly readable. NEVER use rgba() for text color — use solid hex colors only. NEVER use opacity below 0.9 on text elements. 'Muted' or 'secondary' text must still have at least 4.5:1 contrast ratio — e.g. use #555 on white, not #999. If your background is dark, text must be #ffffff or #e0e0e0 at minimum. If your background is light, text must be #000000 to #444444. Check EVERY element including small text, labels, captions, placeholder text, and nav links. This is the #1 most common failure — do not fail at this.

Write the complete HTML to ${TARGET} and nothing else.

Maybe this page doesn't need to have sign up tiers, you think about it :) First think up the outline of the idea, then fill in the content you want to put on the page, and then finally build the site :)
"

case "$AGENT" in
  claude)
    echo "$PROMPT" | CLAUDE_CODE_MAX_OUTPUT_TOKENS=128000 claude -p --dangerously-skip-permissions
    ;;
  codex)
    echo "$PROMPT" | codex exec --skip-git-repo-check -s workspace-write
    ;;
  gemini)
    echo "$PROMPT" | gemini --yolo
    ;;
  *)
    echo "❌ Unknown agent: $AGENT (use claude, codex, or gemini)"
    exit 1
    ;;
esac

# Check file was created
if [ ! -f "$TARGET" ]; then
  echo "❌ Agent did not create the file"
  exit 1
fi

SIZE=$(wc -c < "$TARGET")
echo "✓ Agent wrote $SIZE bytes to $TARGET"

if [ "$SIZE" -lt 3000 ]; then
  echo "Too small ($SIZE bytes), skipping — need at least 3KB"
  rm "$TARGET"
  exit 1
fi

echo "✅ Saved: ${ID} ($SIZE bytes)"
