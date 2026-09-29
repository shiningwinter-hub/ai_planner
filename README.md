# 나의 루틴 플래너

프리랜서 강사의 출강·이동·강의 준비·운동·공부 계획을 관리하는 모바일 대응 웹앱입니다.

## Vercel 배포

1. 이 폴더를 Git 저장소에 올리고 Vercel에서 프로젝트를 가져옵니다. Framework Preset은 **Other**, Root Directory는 이 폴더로 둡니다.
2. Vercel 프로젝트 Settings → Environment Variables에 `GEMINI_API_KEY`를 등록합니다. Preview와 Production 환경에 각각 적용하고 다시 배포합니다. 기본 모델은 `gemini-3.5-flash`이며, 접근 권한에 따라 `GEMINI_MODEL` 환경변수로 모델을 바꿀 수 있습니다. Gemini 503이 발생하면 짧게 재시도한 뒤 `gemini-3.1-flash-lite`를 대체 모델로 호출하며, `GEMINI_FALLBACK_MODEL`로 변경할 수 있습니다.
3. 로컬 개발은 Vercel CLI 설치 후 `.env.local`에 `GEMINI_API_KEY=...`를 설정하고 `vercel dev`를 실행합니다.

일정·목표·기록은 사용 중인 브라우저의 localStorage에만 저장됩니다. 다른 기기와 동기화되지 않습니다. AI 요청 시 입력 문장과 해당 일정 요약이 Gemini로 전송됩니다. Gemini 키가 없더라도 수동 등록·계획·기록 기능은 사용 가능합니다. Gemini 오류가 발생하면 화면의 HTTP 코드와 Vercel Function Logs의 `Gemini API failure` 항목을 확인하세요. 비밀 키나 로그 전체를 공개적으로 공유하지 마세요. 자동 일정 생성은 겹침 없는 시간대를 찾아 제안하며, 최종 선택과 저장은 사용자가 합니다.

공부 목표는 일간 기준으로 시간·인강 개수·완료 여부 중 하나를 선택합니다. 이전 주간 시간 목표는 브라우저 데이터에 유지되며 화면에서 일간 목표로 환산합니다.
