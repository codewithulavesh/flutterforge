import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerGeneralQuestion } from './chatAnswer';

describe('answerGeneralQuestion streaming', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forwards each SSE text delta and returns the complete answer', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"The preview "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"runs locally."}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const receivedTokens: string[] = [];

    const answer = await answerGeneralQuestion('How does the preview run?', {
      projectName: 'Demo',
      projectSummary: 'A sample Flutter project.',
      history: [],
      apiKey: 'test-key',
      onToken: (token) => receivedTokens.push(token),
    });

    expect(receivedTokens).toEqual(['The preview ', 'runs locally.']);
    expect(answer).toBe('The preview runs locally.');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBe(true);
  });
});