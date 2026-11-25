import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

interface BridgeTelemetryBuffer {
  temperatureC?: number;
  humidityPercent?: number;
  waterDistanceCm?: number;
  rfidTag?: string;
  activityIndex?: number;
  cowId?: string;
  pumpRelayState?: 'ON' | 'OFF';
  timestamp: string;
}

let latestTelemetry: BridgeTelemetryBuffer | null = null;

function getConfiguredGeminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return key;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Assistant configuration status
  app.get('/api/assistant/status', (_req, res) => {
    const key = getConfiguredGeminiKey();
    res.json({ geminiConfigured: Boolean(key) });
  });

  // Server-side Gemini endpoint for DairyMitra Assistant
  app.post('/api/assistant/query', async (req, res) => {
    const key = getConfiguredGeminiKey();
    if (!key) {
      res.status(503).json({
        configured: false,
        error: 'GEMINI_API_KEY is not configured. Using built-in deterministic farm record assistant.',
      });
      return;
    }

    const { question, farmContext } = req.body ?? {};
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Question text is required.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = [
        'You are DairyMitra Assistant for DairyMitra AI 2.0, a smart dairy farm management system.',
        'STRICT RULES:',
        '1. Answer ONLY using the JSON farm records supplied in the prompt. Never fabricate cows, yields, dates, temperatures, or treatments.',
        '2. Always cite specific Cow IDs (e.g., C-102) and exact dates/timestamps from the supplied records.',
        '3. If required information is missing from the supplied records, clearly state what is missing.',
        '4. NEVER provide a veterinary medical diagnosis or prescribe medicines or withdrawal periods.',
        '5. NEVER claim milk is chemically safe or antibiotic-free. State clearly that checks are record-based only.',
        '6. Keep responses concise, structured, and easy for a dairy farmer to act on.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Farm Records JSON:\n${JSON.stringify(farmContext ?? {})}\n\nFarmer Question: ${question}`,
        config: {
          systemInstruction,
        },
      });

      const answer = response.text?.trim();
      if (!answer) {
        res.status(502).json({ error: 'Empty response received from Gemini API.' });
        return;
      }

      res.json({ answer, source: 'gemini-4-hydrogen' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gemini API request failed.';
      res.status(500).json({ error: message });
    }
  });

  // Optional local serial-bridge / ESP32 HTTP telemetry endpoint
  app.post('/api/hardware/telemetry', (req, res) => {
    const body = req.body ?? {};
    latestTelemetry = {
      temperatureC: typeof body.temperatureC === 'number' ? body.temperatureC : undefined,
      humidityPercent: typeof body.humidityPercent === 'number' ? body.humidityPercent : undefined,
      waterDistanceCm: typeof body.waterDistanceCm === 'number' ? body.waterDistanceCm : undefined,
      rfidTag: typeof body.rfidTag === 'string' ? body.rfidTag : undefined,
      activityIndex: typeof body.activityIndex === 'number' ? body.activityIndex : undefined,
      cowId: typeof body.cowId === 'string' ? body.cowId : undefined,
      pumpRelayState: body.pumpRelayState === 'ON' || body.pumpRelayState === 'OFF' ? body.pumpRelayState : undefined,
      timestamp: new Date().toISOString(),
    };
    res.json({ ok: true, receivedAt: latestTelemetry.timestamp });
  });

  app.get('/api/hardware/telemetry', (_req, res) => {
    if (!latestTelemetry) {
      res.status(404).json({ error: 'No live hardware telemetry posted to /api/hardware/telemetry yet.' });
      return;
    }
    res.json(latestTelemetry);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DairyMitra AI 2.0 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
