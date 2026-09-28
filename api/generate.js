const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: '서버에 GEMINI_API_KEY를 설정해 주세요.',
    });
  }

  try {
    const { task, input, context } = req.body || {};

    if (
      !['parse', 'coach', 'report'].includes(task) ||
      typeof input !== 'string' ||
      input.length > 3000 ||
      !context ||
      JSON.stringify(context).length > 25000
    ) {
      return res.status(400).json({
        error: '요청 형식이 올바르지 않습니다.',
      });
    }

    const instruction =
      task === 'parse'
        ? `JSON만 반환: {"events":[{"date":"YYYY-MM-DD","start":"HH:mm","end":"HH:mm","title":"강의 제목","place":"장소","travel":60,"method":"public 또는 drive","kind":"new 또는 existing 또는 repeat 또는 assist 또는 other","prep":60}],"note":"해석 결과"}. 강의 일정만 events에 넣어라. 불확실한 날짜/시간은 추측하지 말고 events에서 제외하고 note에 확인 요청. 왕복 이동시간이면 편도로 반분. 날짜는 context.today 기준.`
        : task === 'report'
          ? '제공된 기록과 일정만 근거로 한국어 3문장 이내의 따뜻하고 구체적인 하루 피드백을 작성하라. 기록이 없으면 추측하지 말라.'
          : '제공된 일정·공부 목표·컨디션만 근거로 한국어 3문장 이내로 실행 가능한 추천을 작성하라. 실제 확정되지 않은 일정을 확정했다고 말하지 말라.';

    const payload = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${instruction}\n입력: ${input}\n상황: ${JSON.stringify(context)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 900,
        ...(task === 'parse'
          ? { responseMimeType: 'application/json' }
          : {}),
      },
    });

    let response;
    let data;
    let usedModel = MODEL;

    // 기본 모델에서 503이 나면 한 번 재시도하고 대체 모델을 사용합니다.
    for (const model of [MODEL, MODEL, FALLBACK_MODEL]) {
      usedModel = model;

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY,
          },
          body: payload,
          signal: AbortSignal.timeout(20000),
        },
      );

      data = await response.json();

      if (response.ok) break;

      console.error('Gemini API failure', {
        model,
        status: response.status,
        code: data.error?.status,
        message: data.error?.message,
      });

      if (response.status !== 503) break;

      if (model === MODEL) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    if (!response.ok) {
      const code = data.error?.status || `HTTP_${response.status}`;

      const guidance =
        response.status === 404
          ? '모델 접근 권한이 없습니다. Vercel의 GEMINI_MODEL 설정을 확인해 주세요.'
          : response.status === 429
            ? '호출 한도를 초과했습니다. Google AI Studio의 할당량을 확인해 주세요.'
            : response.status === 503
              ? '기본 모델과 대체 모델이 모두 일시적으로 이용 불가합니다. 잠시 후 다시 시도해 주세요.'
              : [400, 401, 403].includes(response.status)
                ? 'API 키·모델 사용 권한·요청 설정을 확인해 주세요.'
                : '잠시 후 다시 시도해 주세요.';

      return res.status(502).json({
        error: `Gemini ${response.status} (${code}, ${usedModel}): ${guidance}`,
      });
    }

    const answer =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('') || '';

    if (!answer) {
      return res.status(502).json({
        error: 'AI 응답이 비어 있습니다.',
      });
    }

    if (task === 'parse') {
      const parsed = JSON.parse(answer);

      if (!Array.isArray(parsed.events)) {
        throw new Error('Invalid response');
      }

      return res.json({ result: parsed });
    }

    return res.json({ result: answer.slice(0, 4000) });
  } catch (error) {
    console.error('Generate function failure', error);

    return res.status(500).json({
      error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
};
