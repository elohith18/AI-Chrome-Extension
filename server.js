import 'dotenv/config';
import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 3000;
const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const apiKey = process.env.GROQ_API_KEY?.trim();

app.use(express.json({ limit: '32kb' }));
app.use(express.static('.'));

app.post('/api/ask', async (req, res) => {
  const prompt =
    typeof req.body?.prompt === 'string'
      ? req.body.prompt.trim()
      : '';

  if (!prompt) {
    return res.status(400).json({ error: 'Enter a question first.' });
  }

  if (prompt.length > 4000) {
    return res.status(413).json({
      error: 'Question is too long (limit: 4000 characters).'
    });
  }

  if (!apiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY is missing. Add it to .env and restart the server.'
    });
  }

  try {
    const groqResponse = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are Zoro, a concise and helpful AI sidekick. Give complete answers to every part of the question. Do not cut off before finishing a list or explanation. Use plain text only: write short section headings on their own lines, separate sections with a blank line, and use numbered lists or the • bullet character. Never use Markdown, asterisks, star bullets, bold markers, or italic markers. Explain technical topics clearly, with enough detail to answer the question without unnecessary filler.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.4,
          max_completion_tokens: 1200,
          stream: true
        })
      }
    );

    if (!groqResponse.ok) {
      let message = `Groq request failed (${groqResponse.status}).`;

      try {
        const body = await groqResponse.json();
        message = body.error?.message || message;
      } catch {}

      return res.status(groqResponse.status).json({ error: message });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const reader = groqResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();

      if (done || res.destroyed) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;

        const data = line.slice(5).trim();

        if (!data || data === '[DONE]') continue;

        try {
          const chunk = JSON.parse(data);
          const text = chunk.choices?.[0]?.delta?.content;

          if (typeof text === 'string' && text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch {
          // Ignore incomplete event lines until the next network chunk.
        }
      }
    }

    if (!res.destroyed) res.end();
  } catch (error) {
    console.error('Groq request failed:', error.message);

    if (!res.headersSent) {
      res.status(502).json({
        error: error.message || 'Could not connect to Groq.'
      });
    } else if (!res.destroyed) {
      res.write(
        `data: ${JSON.stringify({
          error: error.message || 'Groq stream failed.'
        })}\n\n`
      );
      res.end();
    }
  }
});

app.listen(port, '127.0.0.1', () => {
  console.log(`ZORO is running at http://localhost:${port}`);

  if (!apiKey) {
    console.warn(
      'GROQ_API_KEY is not set. Add it to .env, then restart the server.'
    );
  }
});