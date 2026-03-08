# 조선왕조실록 기반 AI 동화 생성 앱

로그인한 사용자가 조선왕조실록을 기반으로 주제와 자유도를 선택하여 5단계 AI 동화를 생성하고 PDF로 다운로드하는 애플리케이션입니다.

---

## 🎯 주요 기능

- **로그인/인증**: Supabase Auth
- **동화 생성**: OpenAI API를 이용한 5단계 스토리텔링
- **파라미터 조절**:
  - 주제: 클래식, 호러, 액션, 로맨스, 사실기반
  - 자유도: 0.0~1.0 (얼마나 자유롭게 생성할지)
  - 내용 양: 0.0~1.0 (생성 길이 조절)
- **5단계 프로세스**:
  1. 콘셉트 생성
  2. 플롯 아웃라인
  3. 캐릭터 개발
  4. 본문 작성
  5. 마무리
- **중간 중단**: 언제든 "마무리하기" 버튼으로 종료 가능
- **PDF 생성**: 완성된 동화를 PDF로 다운로드
- **마이페이지**: 생성한 동화 목록 조회 및 관리

---

## 🗄️ Supabase 데이터베이스 설계

### SQL 마이그레이션

```sql
-- ========================================
-- 1. fairytales 테이블 (동화 기본 정보)
-- ========================================
CREATE TABLE IF NOT EXISTS fairytales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  theme VARCHAR(50) NOT NULL,        -- 클래식/호러/액션/로맨스/사실기반
  freedom FLOAT NOT NULL,            -- 0.0~1.0
  volume FLOAT NOT NULL,             -- 0.0~1.0
  status VARCHAR(20) NOT NULL DEFAULT 'generating',  -- 생성중/완료/마무리됨
  pdf_url TEXT,
  total_tokens INT,
  total_cost_usd FLOAT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- fairytales 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_fairytales_user_id ON fairytales(user_id);
CREATE INDEX IF NOT EXISTS idx_fairytales_created_at ON fairytales(created_at DESC);

-- ========================================
-- 2. fairytale_steps 테이블 (단계별 콘텐츠)
-- ========================================
CREATE TABLE IF NOT EXISTS fairytale_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fairytale_id UUID NOT NULL REFERENCES fairytales(id) ON DELETE CASCADE,
  step_number INT NOT NULL,          -- 1~5
  step_name VARCHAR(50),             -- "콘셉트", "플롯", "캐릭터", "본문", "마무리"
  content TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  total_tokens INT,
  cost_usd FLOAT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_step_number CHECK (step_number >= 1 AND step_number <= 5)
);

-- fairytale_steps 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_fairytale_steps_fairytale_id ON fairytale_steps(fairytale_id);
CREATE INDEX IF NOT EXISTS idx_fairytale_steps_step_number ON fairytale_steps(step_number);

-- ========================================
-- 3. Row Level Security (RLS) 정책
-- ========================================

-- fairytales 테이블 RLS 활성화
ALTER TABLE fairytales ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 동화만 조회 가능
CREATE POLICY "Users can only read their own fairytales"
  ON fairytales FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 동화 생성 가능
CREATE POLICY "Users can create fairytales"
  ON fairytales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 동화만 수정 가능
CREATE POLICY "Users can update their own fairytales"
  ON fairytales FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 동화만 삭제 가능
CREATE POLICY "Users can delete their own fairytales"
  ON fairytales FOR DELETE
  USING (auth.uid() = user_id);

-- fairytale_steps 테이블 RLS 활성화
ALTER TABLE fairytale_steps ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 동화 단계만 조회 가능
CREATE POLICY "Users can read steps of their fairytales"
  ON fairytale_steps FOR SELECT
  USING (
    fairytale_id IN (
      SELECT id FROM fairytales WHERE user_id = auth.uid()
    )
  );

-- 사용자는 자신의 동화 단계만 생성 가능
CREATE POLICY "Users can create steps for their fairytales"
  ON fairytale_steps FOR INSERT
  WITH CHECK (
    fairytale_id IN (
      SELECT id FROM fairytales WHERE user_id = auth.uid()
    )
  );

-- 사용자는 자신의 동화 단계만 수정 가능
CREATE POLICY "Users can update steps of their fairytales"
  ON fairytale_steps FOR UPDATE
  USING (
    fairytale_id IN (
      SELECT id FROM fairytales WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    fairytale_id IN (
      SELECT id FROM fairytales WHERE user_id = auth.uid()
    )
  );

-- 사용자는 자신의 동화 단계만 삭제 가능
CREATE POLICY "Users can delete steps of their fairytales"
  ON fairytale_steps FOR DELETE
  USING (
    fairytale_id IN (
      SELECT id FROM fairytales WHERE user_id = auth.uid()
    )
  );
```

### SQL 실행 방법

1. Supabase 대시보드 → SQL Editor
2. 위 SQL문을 복사하여 붙여넣기
3. "Run" 버튼 클릭

---

## ⚙️ 환경 변수 설정

### `.dev.vars` (로컬 개발)

```
OPENAI_API_KEY=sk-proj-xxx
OPENAI_DEFAULT_MODEL=gpt-4o-mini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SILOK_CONTENT=양녕대군 이방원 등이 상소를 올려 말했다...
```

### Cloudflare Workers 환경 변수

Cloudflare 대시보드 → Workers → Settings → Variables에서 동일하게 설정

---

## 🛠️ 기술 스택

- **프론트엔드**: HTML, CSS, JavaScript
- **인증**: Supabase Auth
- **백엔드**: Cloudflare Workers
- **AI**: OpenAI API (gpt-4o-mini)
- **데이터베이스**: Supabase PostgreSQL
- **PDF 생성**: pdfkit (예정)
- **배포**: Cloudflare Pages + Workers

---

## 📁 프로젝트 구조

```
/home/user/lecture/
├── README.md                 # 프로젝트 문서
├── .dev.vars                # 환경 변수 (로컬)
├── chat.html                # 메인 페이지 (수정 필요)
├── chat.js                  # 메인 페이지 로직 (수정 필요)
├── login.html               # 로그인 페이지
├── login.js                 # 로그인 로직
├── style.css                # 스타일시트
├── main.js                  # 진입점
├── wrangler.toml            # Cloudflare 설정
├── functions/
│   └── index.js             # Workers 진입점 (수정 필요)
├── data/
│   └── silok.txt            # 조선왕조실록 데이터
└── node_modules/
```

---

## 🚀 배포 절차

1. **Supabase 데이터베이스 설정**
   - SQL 마이그레이션 실행

2. **환경 변수 설정**
   - Cloudflare Workers 환경 변수 설정

3. **코드 배포**
   ```bash
   npm run deploy
   ```

4. **테스트**
   - 로그인 → 동화 생성 → PDF 다운로드

---

## 📝 개발 체크리스트

- [ ] Phase 1: 환경 변수 설정 (.dev.vars)
- [ ] Phase 2: Workers API 구현 (`/api/generate-fairytale`)
- [ ] Phase 3: 프론트엔드 UI 개발
- [ ] Phase 4: PDF 생성 기능
- [ ] Phase 5: 마이페이지 구현
- [ ] Phase 6: 배포 및 테스트

---

## 🔐 보안 고려사항

- ✅ Row Level Security (RLS) 활성화
- ✅ 환경 변수 `.gitignore` 처리
- ✅ Supabase Service Role Key는 백엔드에서만 사용
- ✅ 클라이언트는 Supabase Anon Key로 인증만 수행

---

## 📞 문제 해결

### Supabase 연결 오류
- `.dev.vars`의 SUPABASE_URL과 SERVICE_ROLE_KEY 확인

### OpenAI API 오류
- OPENAI_API_KEY 유효성 확인
- API 할당량 확인 (https://platform.openai.com/account/usage/overview)

### RLS 권한 오류
- 사용자가 정상 로그인되었는지 확인
- SQL 정책 올바르게 적용되었는지 확인

---

**시작일**: 2026-03-08
**상태**: 개발 중
