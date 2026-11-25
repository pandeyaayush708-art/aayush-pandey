import React, { useEffect, useState } from 'react';
import { Bot, Send, User } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import {
  answerFarmQuestion,
  buildCompactFarmContext,
} from '../services/assistantService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  referencedCowIds?: string[];
  disclaimer?: string;
  engine?: string;
  timestamp: string;
}

const SUGGESTED_QUESTIONS = [
  'Which cow produced the least milk today?',
  "What is cow C-102's average milk production?",
  'Which cows have unusual milk changes?',
  'Which cows have active treatments?',
  'Which cows need health inspection?',
  "What was the farm's total milk production this week?",
  'Is the water tank level low?',
  'What alerts occurred today?',
  "Summarise today's farm performance.",
];

export const AIAssistantPage: React.FC = () => {
  const { db, setSelectedCowId, setActivePage } = useFarm();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [useServerAI, setUseServerAI] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      text: 'Hello! I am DairyMitra Assistant. Ask me about today’s milk yields, cow averages, unusual yield flags, active treatments, barn climate, water tank status, or alerts. Every answer comes directly from your stored farm records.',
      disclaimer:
        'I do not provide veterinary diagnoses or claim milk is chemically safe.',
      engine: 'Deterministic Record Engine',
      timestamp: new Date().toISOString(),
    },
  ]);

  useEffect(() => {
    fetch('/api/assistant/status')
      .then((r) => (r.ok ? r.json() : { geminiConfigured: false }))
      .then((data) => {
        if (data?.geminiConfigured) {
          setGeminiConfigured(true);
        }
      })
      .catch(() => {
        setGeminiConfigured(false);
      });
  }, []);

  const submitQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    if (useServerAI && geminiConfigured) {
      setLoading(true);
      try {
        const res = await fetch('/api/assistant/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: trimmed,
            farmContext: buildCompactFarmContext(db),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `Server returned HTTP ${res.status}`);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: data.answer,
            engine: 'Server Gemini Assistant',
            disclaimer:
              'Generated from current farm records. Does not constitute veterinary diagnosis or chemical milk safety verification.',
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unable to reach AI service.';
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: `Server Gemini Assistant error: ${errMsg}`,
            engine: 'Server Error',
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Deterministic Rule-Based Farm Assistant
    const reply = answerFarmQuestion(trimmed, db);
    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: reply.answer,
        referencedCowIds: reply.referencedCowIds,
        disclaimer: reply.disclaimer,
        engine: reply.engine,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Suggested Questions & Guardrails */}
      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-[#1F2421]">
            DairyMitra Assistant
          </h2>
          <p className="text-xs text-[#5C6660] leading-relaxed">
            Answers farmer questions using live application records. Never fabricates figures, never diagnoses illness, and never claims milk is chemically antibiotic-free.
          </p>

          <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#1F2421]">Assistant Engine</span>
              <span className="text-[11px] text-[#2D6A4F] font-medium">
                {useServerAI && geminiConfigured
                  ? 'Gemini API'
                  : 'Deterministic Record Engine'}
              </span>
            </div>
            {geminiConfigured ? (
              <label className="flex items-center gap-2 text-[11px] text-[#3F4742] cursor-pointer">
                <input
                  type="checkbox"
                  checked={useServerAI}
                  onChange={(e) => setUseServerAI(e.target.checked)}
                />
                Use Server Gemini Assistant for open-ended queries
              </label>
            ) : (
              <p className="text-[11px] text-[#7A827E]">
                Running local rule-based record engine (no external AI key required).
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-2.5">
          <h3 className="font-display text-xs font-bold uppercase tracking-wide text-[#5C6660]">
            Supported Quick Questions
          </h3>
          <div className="flex flex-col gap-1.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => void submitQuestion(q)}
                className="text-left rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-xs font-medium text-[#1F2421] hover:border-[#2D6A4F] hover:bg-[#EBF5EE] transition"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Conversation */}
      <div className="lg:col-span-8 rounded-lg border border-[#E4E1D8] bg-white flex flex-col h-[640px]">
        <div className="border-b border-[#E4E1D8] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#1B4332]" />
            <span className="font-display text-sm font-bold text-[#1F2421]">
              Farm Records Conversation
            </span>
          </div>
          <span className="text-[11px] text-[#7A827E]">
            Grounded in {db.cows.filter((c) => c.status !== 'Archived').length} cows &{' '}
            {db.milkRecords.length} milk logs
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="h-8 w-8 shrink-0 rounded-md bg-[#1B4332] text-[#FAF8F4] flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-lg border p-3.5 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'border-[#1B4332] bg-[#1B4332] text-[#FAF8F4]'
                    : 'border-[#E4E1D8] bg-[#FAF8F4] text-[#1F2421]'
                }`}
              >
                <div className="whitespace-pre-line">{m.text}</div>

                {m.referencedCowIds && m.referencedCowIds.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E4E1D8]">
                    <span className="text-[11px] text-[#5C6660]">Referenced cows:</span>
                    {m.referencedCowIds.map((cid) => (
                      <button
                        key={cid}
                        onClick={() => {
                          setSelectedCowId(cid);
                          setActivePage('cows');
                        }}
                        className="rounded border border-[#C5DEC9] bg-[#EBF5EE] px-2 py-0.5 text-[11px] font-semibold text-[#1B4332] hover:bg-[#D8EDE0]"
                      >
                        {cid}
                      </button>
                    ))}
                  </div>
                )}

                {m.disclaimer && (
                  <p className="mt-2 text-[11px] text-[#7A827E] italic">{m.disclaimer}</p>
                )}
              </div>
              {m.role === 'user' && (
                <div className="h-8 w-8 shrink-0 rounded-md border border-[#E4E1D8] bg-[#FAF8F4] text-[#3F4742] flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="text-xs text-[#5C6660] italic">Querying farm records...</div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitQuestion(input);
          }}
          className="border-t border-[#E4E1D8] p-3 flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about milk yield, cow C-102, withdrawals, water, or alerts..."
            className="flex-1 rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50 whitespace-nowrap"
          >
            <Send className="h-3.5 w-3.5" /> Ask
          </button>
        </form>
      </div>
    </div>
  );
};
