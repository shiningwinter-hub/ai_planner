const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash';

function parseEvents(answer) {
  const parsed = JSON.parse(answer);
  if (!parsed || !Array.isArray(parsed.events)) throw new Error('events 배열이 없습니다.');
  return parsed;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'GEMINI_API_KEY 환경변수를 설정해 주세요.' });

  const { task, input, context } = req.body || {};
  if (!['parse', 'coach', 'report'].includes(task) || typeof input !== 'string' || input.length > 3000 || !context || JSON.stringify(context).length > 25000) {
    return res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' });
  }

  const instruction = task === 'parse'
    ? '강의 일정을 추출해 JSON으로 반환하세요. events 배열의 각 항목은 date(YYYY-MM-DD), start(HH:mm), end(HH:mm), title, place, travel(편도 분), method(public 또는 drive), kind(new/existing/repeat/assist/other), prep(준비 분)을 포함합니다. note에는 불확실한 정보를 적으세요. 불확실한 날짜나 시간은 추측하지 말고 events에서 제외하세요. 왕복 이동시간이면 편도로 반분하세요. 상대 날짜는 today를 기준으로 계산하세요.'
    : task === 'report'
      ? '기록과 일정만 근거로 한국어 3문장 이내의 따뜻하고 구체적인 하루 피드백을 작성하세요. 기록이 없으면 추측하지 마세요.'
      : '일정·목표·컨디션만 근거로 한국어 3문장 이내의 실행 가능한 추천을 작성하세요. 확정되지 않은 일정을 확정했다고 말하지 마세요.';

  const payload = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: `${instruction}\n입력: ${input}\n상황: ${JSON.stringify(context)}` }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      ...(task === 'parse' ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const models = [...new Set([MODEL, FALLBACK_MODEL])];
  let lastStatus = 0;
  let lastCode = '';

  for (let attempt = 0; attempt < models.length; attempt++) {
    const model = models[attempt];
    let response, data;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: payload,
        signal: AbortSignal.timeout(8000),
      });
      data = await response.json();
    } catch (error) {
      console.error('Gemini network failure', { model, name: error.name });
      if (attempt < models.length - 1) continue;
      return res.status(502).json({ error: 'Gemini 연결 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.' });
    }

    if (!response.ok) {
      lastStatus = response.status;
      lastCode = data.error?.status || `HTTP_${response.status}`;
      console.error('Gemini API failure', { model, status: lastStatus, code: lastCode, message: data.error?.message });
      if (response.status === 503 && attempt < models.length - 1) continue;
      const guidance = response.status === 404 ? '모델 접근 권한을 확인해 주세요.'
        : response.status === 429 ? '호출 한도를 확인해 주세요.'
        : response.status === 503 ? '서비스가 일시적으로 이용 불가합니다.'
        : [400, 401, 403].includes(response.status) ? 'API 키와 요청 권한을 확인해 주세요.'
        : '잠시 후 다시 시도해 주세요.';
      return res.status(502).json({ error: `Gemini ${lastStatus} (${lastCode}, ${model}): ${guidance}` });
    }

    const answer = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    if (!answer) {
      console.error('Gemini empty response', { model, finishReason: data.candidates?.[0]?.finishReason });
      if (attempt < models.length - 1) continue;
      return res.status(502).json({ error: 'Gemini 응답이 비어 있습니다.' });
    }

    if (task === 'parse') {
      try {
        return res.json({ result: parseEvents(answer) });
      } catch (error) {
        console.error('Gemini invalid JSON', { model, finishReason: data.candidates?.[0]?.finishReason, length: answer.length });
        if (attempt < models.length - 1) continue;
        return res.status(502).json({ error: 'AI 일정 해석 결과가 불완전합니다. 문장을 짧게 나누어 다시 시도해 주세요.' });
      }
    }
    return res.json({ result: answer.slice(0, 4000) });
  }
  return res.status(502).json({ error: 'AI 응답을 처리하지 못했습니다.' });
};
