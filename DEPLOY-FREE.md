# 무료 플랜 배포 안내

Cloudflare **Workers Free** 계정 하나와 D1 데이터베이스 하나를 사용합니다. 별도 서버 임대, 지속 디스크 요금, R2/유료 Workers 플랜은 필요하지 않습니다. 2026-11-14: study-english D1과 표/인덱스/트리거를 생성했고 GitHub 연결 빌드를 배포했습니다. 로그인용 비밀값과 OpenAI 키 등록 및 실제 계정 검증은 아직 남아 있습니다.

현재 배포 설정은 `cloudflare/wrangler.jsonc`이며 DB ID는 비밀값이 아닙니다. 현재 DB에는 이미 스키마가 적용되어 있으므로 아래 초기 마이그레이션 명령을 다시 실행하지 마세요. 아래 절차는 새 계정/새 DB에 처음 설치할 때의 안내입니다.

웹 주소: https://study-english-api.qkryewon.workers.dev

Cloudflare 빌드: `WORKER_ASSETS=1 npm run build:pages` / 배포: `npx wrangler@4 deploy --config cloudflare/wrangler.jsonc`. main 업데이트는 자동 배포됩니다.

## 1. 계정 연결과 데이터베이스 만들기

Cloudflare에 로그인하고 Workers & Pages에서 Workers Free 플랜인지 확인합니다. 기존 계정이 Paid라면 이 설정 파일만으로 과금이 차단되지는 않습니다. 유료 플랜으로 업그레이드하지 않습니다.

프로젝트 루트 터미널에서 (Wrangler 다운로드에 인터넷 필요):

```sh
npx wrangler@4 login
npx wrangler@4 d1 create study-english
cp cloudflare/wrangler.example.jsonc cloudflare/wrangler.local.jsonc
```

출력된 `database_id`를 로컬 설정 파일의 `REPLACE_WITH_D1_DATABASE_ID`에 입력합니다. Cloudflare 대시보드에서 계정의 workers.dev 하위 주소를 확인하고 `FRONTEND_ORIGIN`을 실제 `https://study-english-api.<계정하위주소>.workers.dev`로 바꿉니다. 끝에 `/`를 붙이지 않습니다. DB는 다시 만들지 말고 기존 ID를 재사용하세요.

## 2. 비밀값 등록

아래 명령은 각각 입력 프롬프트를 엽니다. 키/설정 코드는 채팅이나 공개 파일에 적지 않습니다.

```sh
npx wrangler@4 secret put OPENAI_API_KEY --config cloudflare/wrangler.local.jsonc
npx wrangler@4 secret put PASSWORD_PEPPER --config cloudflare/wrangler.local.jsonc
npx wrangler@4 secret put SETUP_CODE --config cloudflare/wrangler.local.jsonc
```

- OPENAI_API_KEY: 가지고 있는 OpenAI 키. 기존 키를 그대로 사용할 수 있습니다.
- PASSWORD_PEPPER: 비밀번호 관리자로 생성한 최소 32자 무작위 비밀 문자열. 안전하게 보관하고 운영 중 임의로 변경하지 않습니다. 바꾸면 기존 암호로 로그인할 수 없습니다.
- SETUP_CODE: 위 값과 다른 최소 32자 무작위 문자열. 최초 운영자 가입 때만 사용합니다.

기본 AI 모델은 기존 앱의 `gpt-6-luna`를 유지합니다. 키에 해당 모델 권한이 없다면 사용 가능한 모델 ID로 `OPENAI_MODEL`을 변경하세요.

## 3. 저장소 준비와 배포

```sh
npm run check
npm test
WORKER_ASSETS=1 npm run build:pages
npx wrangler@4 d1 migrations apply study-english --remote --config cloudflare/wrangler.local.jsonc
npx wrangler@4 deploy --config cloudflare/wrangler.local.jsonc
```

웹 파일은 허용 목록의 5개 파일만 `dist-pages`로 복사합니다. `.env.local`, 로컬 데이터베이스, 소스 디렉터리 전체를 정적 파일로 배포하지 않습니다. 코드 수정 후에도 `WORKER_ASSETS=1`을 넣어 다시 빌드해야 로그인/API가 켜진 버전이 배포됩니다.

출력된 HTTPS 주소가 `FRONTEND_ORIGIN`과 일치하는지 확인합니다. 다르면 설정을 고치고 다시 배포합니다. 첫 운영자는 ‘함께 공부 → 운영자 최초 가입’에서 설정 코드, 아이디, 10자 이상 비밀번호를 입력합니다. 이후 친구는 생성한 초대 링크로 가입합니다. 로그인/초대 성공 후 SETUP_CODE Secret을 삭제해도 기존 계정은 유지됩니다.

## 4. 기존 기록과 실서비스 확인

로컬과 D1은 서로 다른 저장소입니다. 기존 계정/기록은 자동 이전되지 않습니다. 로컬 화면 ‘설정 → 기록 다운로드’로 먼저 백업하세요. 브라우저 기록 가져오기는 같은 출처의 기록만 읽을 수 있으며, 현재 다운로드 JSON의 온라인 업로드 복원 기능은 없습니다. 기록 이전이 필요하면 백업을 보존한 상태에서 별도 이전을 진행하세요. 암호나 전체 DB를 공개 저장소에 올리지 않습니다.

- 첫 가입 보호, 로그인/로그아웃, 새로고침 후 로그인 유지
- 두 기기에서 기록 저장/조회, 동시 수정 충돌
- 친구 초대/공유/공유 취소/연결 해제
- 작은 메모 1개로 AI 정리 (실제 API 요금 발생)
- Cloudflare Metrics에서 오류/CPU/DB 사용량 확인. 로컬 테스트 통과는 실제 Free CPU 한도 통과를 보장하지 않습니다.

## 5. 도메인은 나중에 연결 가능

기본 workers.dev 주소만으로 PC를 끈 상태에서 사용할 수 있습니다. Porkbun의 기존 Link In Bio/포트폴리오 설정은 이 배포로 바뀌지 않습니다.

`english.3dowon.com`을 Workers Custom Domain으로 연결하려면 해당 도메인을 Cloudflare의 활성 DNS zone으로 설정하는 단계가 필요합니다. 보통 기존 DNS 레코드를 옮기고 Porkbun에서 네임서버를 변경하므로 기존 사이트/메일 레코드를 먼저 확인해야 합니다. 도메인 등록기관은 Porkbun으로 유지할 수 있습니다. 이 단계는 아직 실행하지 않았으며, 단순 임의 CNAME 추가만으로 완료된다고 가정하지 않습니다.

## 무료 범위

2026-11-14 확인 기준: Workers Free 동적 요청 100,000회/일, D1 읽기 500만 행/일·쓰기 10만 행/일·총 저장 5GB (단일 Free DB에는 별도 크기 제한). 정적 자산 요청은 무료이며 Workers 코드 실행 요청은 별도 한도를 사용합니다. 다른 앱이 같은 계정 한도를 함께 사용할 수 있습니다.

Free의 한도 초과는 요청 실패/제한으로 처리되며 앱에서 유료 전환하지 않습니다. OpenAI 비용과 기존 도메인 갱신료는 별도입니다.

공식 기준:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
