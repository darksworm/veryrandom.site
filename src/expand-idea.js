// Takes a raw idea seed and expands it into a creative brief via AI (OpenRouter)
// Usage: node expand-idea.js <idea> <style> <color> <layout> <density>
// Outputs expanded brief to stdout. Falls back to original idea on failure.

const dotenv = require('dotenv');
dotenv.config({ override: true });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function expandIdea(idea, style, color, layout, density) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    process.stderr.write('[expand-idea] No OPENROUTER_API_KEY, passing through raw idea\n');
    process.stdout.write(idea);
    return;
  }

  const model = process.env.OPENROUTER_EXPAND_MODEL || 'google/gemini-2.0-flash-001';

  const systemPrompt = `You are a deranged creative director at the world's most unhinged branding agency. Your job is to take a seed idea for a fake website and TRANSFORM it into something unexpected, specific, and hilarious.

CRITICAL — READ CAREFULLY:
- The seed idea is a STARTING POINT, not a literal instruction. Riff on it, twist it, find the angle nobody would think of first.
- Do NOT just restate the idea with more words. MUTATE it. If the seed says "a cat runs a hotel" maybe the cat is a disgraced former Michelin inspector who converted a lighthouse.
- Be WILDLY SPECIFIC: invent a founder name, a founding year, a specific grudge or origin story, a scandal, exact prices, a rival company, a slogan.
- Think about the PERSON behind this website — they are real to themselves. They have a reason they stayed up until 3am building this site. What is that reason?
- The humor comes from COMMITMENT and SPECIFICITY, not from randomness.
- DO NOT write the website copy itself. Write a creative brief — describe the character, the vibe, the specific details the website should include.
- Keep it to 2-3 tight paragraphs. Punchy, not bloated.
- Output ONLY the brief. No preamble like "Here's my take" or "Sure!". No markdown. Just the brief.`;

  const userPrompt = `SEED: ${idea}

VISUAL VIBE: ${style} / ${color} / ${layout}
DENSITY: ${density}

Go. Who made this website? Why? What's their deal? What specific details make it feel REAL and completely UNHINGED?`;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Idea Expander',
      },
      body: JSON.stringify({
        model,
        temperature: 1.4,
        top_p: 0.95,
        presence_penalty: 0.6,
        frequency_penalty: 0.4,
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      process.stderr.write(`[expand-idea] OpenRouter ${response.status}: ${body.slice(0, 200)}\n`);
      process.stdout.write(idea);
      return;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (content && content.length > 50) {
      process.stdout.write(content);
    } else {
      process.stderr.write('[expand-idea] Response too short, using raw idea\n');
      process.stdout.write(idea);
    }
  } catch (err) {
    process.stderr.write(`[expand-idea] Failed: ${err.message}\n`);
    process.stdout.write(idea);
  }
}

const [idea, style, color, layout, density] = process.argv.slice(2);
expandIdea(idea || '', style || '', color || '', layout || '', density || '');
