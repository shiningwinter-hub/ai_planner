# 나의 루틴 플래너

프리랜서 강사의 출강·이동·강의 준비·운동·공부 계획을 관리하는 모바일 대응 웹앱입니다.

## Vercel 배포

1. 이 폴더를 Git 저장소에 올리고 Vercel에서 프로젝트를 가져옵니다. Framework Preset은 **Other**, Root Directory는 이 폴더로 둡니다.
2. Vercel 프로젝트 Settings → Environment Variables에 `GEMINI_API_KEY`를 등록합니다. Preview와 Production 환경에 각각 적용하고 다시 배포합니다.
3. 로컬 개발은 Vercel CLI 설치 후 `.env.local`에 `GEMINI_API_KEY=...`를 설정하고 `vercel dev`를 실행합니다.

일정·목표·기록은 사용 중인 브라우저의 localStorage에만 저장됩니다. 다른 기기와 동기화되지 않습니다. AI 요청 시 입력 문장과 해당 일정 요약이 Gemini로 전송됩니다. Gemini 키가 없더라도 수동 등록·계획·기록 기능은 사용 가능합니다. 자동 일정 생성은 겹침 없는 시간대를 찾아 제안하며, 최종 선택과 저장은 사용자가 합니다.
