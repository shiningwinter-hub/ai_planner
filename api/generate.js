const MODEL = 'gemini-3.5-flash';
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: '서버에 GEMINI_API_KEY를 설정해 주세요.' });
  try {
    const { task, input, context } = req.body || {};
    if (!['parse', 'coach', 'report'].includes(task) || typeof input !== 'string' || input.length > 3000 || !context || JSON.stringify(context).length > 25000) return res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' });
    const schema = task === 'parse' ? `JSON만 반환: {"events":[{"date":"YYYY-MM-DD","start":"HH:mm","end":"HH:mm","title":"강의 제목","place":"장소","travel":60,"method":"public 또는 drive","kind":"new 또는 existing 또는 repeat 또는 assist 또는 other","prep":60}],"note":"해석 결과"}. 강의 일정만 events에 넣어라. 불확실한 날짜/시간은 추측하지 말고 events에서 제외하고 note에 확인 요청. 왕복 이동시간이면 편도로 반분. 날짜는 context.today 기준.` : task === 'report' ? '제공된 기록과 일정만 근거로 한국어 3문장 이내의 따뜻하고 구체적인 하루 피드백을 작성하라. 기록이 없으면 추측하지 말라.' : '제공된 일정·공부 목표·컨디션만 근거로 한국어 3문장 이내로 실행 가능한 추천을 작성하라. 실제 확정되지 않은 일정을 확정했다고 말하지 말라.';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `${schema}\n입력: ${input}\n상황: ${JSON.stringify(context)}` }] }], generationConfig: { temperature: 0.25, maxOutputTokens: 900, ...(task === 'parse' ? { responseMimeType: 'application/json' } : {}) } }), signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'Gemini 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
    const answer = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if (!answer) return res.status(502).json({ error: 'AI 응답이 비어 있습니다.' });
    if (task === 'parse') { const parsed = JSON.parse(answer); if (!Array.isArray(parsed.events)) throw Error('Invalid response'); return res.json({ result: parsed }); }
    return res.json({ result: answer.slice(0, 4000) });
  } catch (error) { return res.status(500).json({ error: '요청을 처리하지 못했습니다. 입력을 확인하고 다시 시도해 주세요.' }); }
};
