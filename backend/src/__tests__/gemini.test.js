'use strict';
// Gemini as the speech-to-text and summary provider: the pure helpers in utils/gemini.js and
// the provider switches. The Gemini call itself is mocked — no network.

jest.mock('../config', () => ({ sttProvider: 'gemini', summaryProvider: 'gemini', summaryLanguage: 'English' }));
jest.mock('../repositories/answerRepository', () => ({ findByVisitId: jest.fn() }));
jest.mock('../repositories/templateRepository', () => ({ findForVisit: jest.fn() }));
jest.mock('../repositories/reportRepository', () => ({ findFilesByVisitId: jest.fn(async () => []) }));
jest.mock('../utils/stt/geminiClient', () => ({ transcribe: jest.fn() }));
jest.mock('../utils/summary/geminiClient', () => ({ summarise: jest.fn() }));

const { audioMimeType, readReply } = require('../utils/gemini');
const answerRepository = require('../repositories/answerRepository');
const templateRepository = require('../repositories/templateRepository');
const sttGemini = require('../utils/stt/geminiClient');
const summaryGemini = require('../utils/summary/geminiClient');
const sttService = require('../services/sttService');
const summaryService = require('../services/summaryService');

beforeEach(() => jest.clearAllMocks());
// The console.error spies below would otherwise stay on and hide real errors in later tests.
let consoleSpy;
afterEach(() => consoleSpy?.mockRestore());

describe('audioMimeType', () => {
  test('the app\'s .m4a recordings go as audio/mp4 (audio/m4a made Gemini read Tamil as Telugu)', () => {
    expect(audioMimeType('.m4a')).toBe('audio/mp4');
    expect(audioMimeType('.M4A')).toBe('audio/mp4');
  });

  test('other audio types map to their own MIME type', () => {
    expect(audioMimeType('.wav')).toBe('audio/wav');
    expect(audioMimeType('.mp3')).toBe('audio/mp3');
  });

  test('an unknown or missing extension falls back to audio/mp4', () => {
    expect(audioMimeType('.xyz')).toBe('audio/mp4');
    expect(audioMimeType('')).toBe('audio/mp4');
  });
});

describe('STT prompt and reply', () => {
  const { buildPrompt, parseReply } = jest.requireActual('../utils/stt/geminiClient');

  test('lists the languages the patient may answer in and asks for "<language> | <transcript>"', () => {
    const prompt = buildPrompt('Tamil, Hindi or English');
    expect(prompt).toMatch(/^This patient may answer in Tamil, Hindi or English./);
    expect(prompt).toContain('<language name> | <transcript>');
    expect(prompt).toContain("Never write one language in another language's script");
  });

  test('the language label is dropped, only the transcript is kept', () => {
    expect(parseReply('Tamil | கோடரி தைலம் தான் போட்டேன்.')).toBe('கோடரி தைலம் தான் போட்டேன்.');
    expect(parseReply('English | I have a severe headache.')).toBe('I have a severe headache.');
  });

  test('a reply without the label is kept whole; a label with no text is empty', () => {
    expect(parseReply('मेरे पेट में बहुत तेज दर्द है।')).toBe('मेरे पेट में बहुत तेज दर्द है।');
    expect(parseReply('Hindi | ')).toBe('');
    expect(parseReply('English')).toBe('');
  });

  test('the label is also dropped before ":" or a line break; a "|" inside the transcript is kept', () => {
    expect(parseReply('Tamil\nஎதுவும் இல்ல')).toBe('எதுவும் இல்ல');
    expect(parseReply('English: No allergies.')).toBe('No allergies.');
    expect(parseReply('BP is 140 | 90 today')).toBe('BP is 140 | 90 today');
    expect(parseReply('English is fine for me')).toBe('English is fine for me');
  });
});

describe('readReply', () => {
  const reply = (finishReason, ...texts) => ({ candidates: [{ finishReason, content: { parts: texts.map(text => ({ text })) } }] });

  test('a finished reply: the parts joined and trimmed', () => {
    expect(readReply(reply('STOP', ' இப்ப வரைக்கும் ', 'எதுவும் இல்ல \n'))).toEqual({ text: 'இப்ப வரைக்கும் எதுவும் இல்ல' });
  });

  test('a reply cut off (MAX_TOKENS, SAFETY) is an error, never saved as if complete', () => {
    expect(readReply(reply('MAX_TOKENS', 'half a transcr'))).toEqual({ error: 'reply stopped early (MAX_TOKENS)' });
    expect(readReply(reply('SAFETY', ''))).toEqual({ error: 'reply stopped early (SAFETY)' });
  });

  test('no candidate (blocked or empty) is an error naming the reason', () => {
    expect(readReply({ promptFeedback: { blockReason: 'OTHER' } })).toEqual({ error: 'no reply (OTHER)' });
    expect(readReply({})).toEqual({ error: 'no reply (empty)' });
    expect(readReply(undefined)).toEqual({ error: 'no reply (empty)' });
  });
});

describe('provider switches', () => {
  test('STT_PROVIDER=gemini transcribes with Gemini', async () => {
    sttGemini.transcribe.mockResolvedValue('मुझे सीने में बहुत दर्द है');
    await expect(sttService.transcribe('audio/a.m4a')).resolves.toBe('मुझे सीने में बहुत दर्द है');
    expect(sttGemini.transcribe).toHaveBeenCalledWith('audio/a.m4a');
  });

  test('an empty or blank transcript from any provider is an error (answer marked failed), not a blank answer', async () => {
    sttGemini.transcribe.mockResolvedValue('  ');
    await expect(sttService.transcribe('audio/a.m4a')).rejects.toThrow('STT error: empty transcript');
  });

  test('SUMMARY_PROVIDER=gemini summarises the ordered Q&A and is stored as generated_by gemini', async () => {
    templateRepository.findForVisit.mockResolvedValue({ questions: [
      { id: 2, text: 'Any known allergies?', order_index: 2 },
      { id: 1, text: 'Main complaint today?', order_index: 1 },
    ] });
    answerRepository.findByVisitId.mockResolvedValue([
      { question_id: 1, transcript: 'Severe nose pain' },
      { question_id: 2, transcript: 'मेरे पास कोई नहीं है' },
    ]);
    summaryGemini.summarise.mockResolvedValue('Severe nose pain. No known allergies.');
    await expect(summaryService.generate({ id: 9 })).resolves.toEqual({ summaryText: 'Severe nose pain. No known allergies.', generatedBy: 'gemini' });
    expect(summaryGemini.summarise.mock.calls[0][1]).toEqual([
      { question: 'Main complaint today?', answer: 'Severe nose pain' },
      { question: 'Any known allergies?', answer: 'मेरे पास कोई नहीं है' },
    ]);
  });

  test('an empty Gemini reply is stored as the marked fallback, not a blank summary', async () => {
    templateRepository.findForVisit.mockResolvedValue({ questions: [] });
    answerRepository.findByVisitId.mockResolvedValue([]);
    summaryGemini.summarise.mockResolvedValue('');
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(summaryService.generate({ id: 9 })).resolves.toMatchObject({ generatedBy: 'mock-fallback' });
  });

  test('the fallback never reads like clinical findings (no canned fever text for a real patient)', async () => {
    templateRepository.findForVisit.mockResolvedValue({ questions: [] });
    answerRepository.findByVisitId.mockResolvedValue([]);
    summaryGemini.summarise.mockRejectedValue(new Error('Gemini summary error: reply stopped early (SAFETY)'));
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { summaryText } = await summaryService.generate({ id: 9 });
    expect(summaryText).toMatch(/AI summary not available/);
    expect(summaryText).not.toMatch(/fever/i);
  });

  test('a Gemini failure never breaks submit: the marked fallback is stored', async () => {
    templateRepository.findForVisit.mockResolvedValue({ questions: [] });
    answerRepository.findByVisitId.mockResolvedValue([]);
    summaryGemini.summarise.mockRejectedValue(new Error('Gemini error: quota'));
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(summaryService.generate({ id: 9 })).resolves.toMatchObject({ generatedBy: 'mock-fallback' });
  });

  test('a provider name that is an Object member (e.g. "constructor") is unknown → plain mock, no AI call', async () => {
    const config = require('../config');
    config.summaryProvider = 'constructor';
    try {
      await expect(summaryService.generate({ id: 9 })).resolves.toMatchObject({ generatedBy: 'mock' });
      expect(answerRepository.findByVisitId).not.toHaveBeenCalled();
    } finally {
      config.summaryProvider = 'gemini';
    }
  });
});
