# YeON Codex App + WSL 설정 가이드

## 결론
네가 원하는 방식은 이렇게 잡는 게 가장 맞다.

- **프로젝트 경로**: `\\wsl.localhost\Ubuntu\home\daniel\<프로젝트폴더>`
- **Codex 사용 방식**: **CLI 말고 Codex 앱**
- **Codex 앱 설정**: **Agent = WSL**
- **에디터**: VS Code
- **파이썬 해킹용 `.venv` / pwntools`**: 그대로 같이 써도 됨
- **Node.js**: WSL 안에 설치
- **권장**: 프로젝트를 `~/code`에 꼭 만들 필요는 없음. 그냥 `/home/daniel/...` 아래 네가 원하는 폴더명으로 만들면 됨.

예:
```text
/home/daniel/yeon
/home/daniel/projects/yeon
/home/daniel/work/yeon
```

Windows 탐색기에서 보이는 형태:
```text
\\wsl.localhost\Ubuntu\home\daniel\yeon
```

---

## 1) `~/code/yeon` 꼭 써야 하냐?
아니야.

`~/code/yeon`은 그냥 **예시 경로**일 뿐이야.  
네가 원하면 그냥 여기 써도 됨:

```bash
mkdir -p ~/yeon
cd ~/yeon
```

또는

```bash
mkdir -p ~/projects/yeon
cd ~/projects/yeon
```

즉 핵심은 **`/home/daniel/...` 안쪽에 두는 것**이지, 폴더 이름이 `code`일 필요는 없음.

---

## 2) 앱으로 쓸 거면 어떤 방식이 맞냐
### 네 경우 추천
네가 `.venv`, pwntools, WSL 리눅스 툴체인 중심이면:

- **프로젝트는 WSL 안에 둠**
- **Codex 앱의 agent도 WSL로 바꿈**
- **프로젝트는 `\\wsl.localhost\Ubuntu\home\daniel\...`로 열기**

이 조합이 제일 자연스럽다.

### 왜?
Codex Windows 문서 기준으로:
- Windows 앱은 기본적으로 Windows-native agent(PowerShell)로 동작
- 하지만 **WSL2로 agent를 바꿀 수 있음**
- **WSL 파일시스템의 프로젝트도 열 수 있음**
- **WSL 프로젝트를 계속 쓸 거면 agent도 WSL로 바꾸는 게 맞음**

---

## 3) 앱에서 꼭 바꿔야 할 설정
Codex 앱에서:

### A. Agent
```text
Settings → Agent → WSL
```

바꾼 뒤 **앱 재시작 필수**

### B. Sandbox permissions
```text
Default permissions
```

처음부터 Full access로 하지 말 것.

### C. Open In
```text
VS Code
```

### D. Integrated terminal
둘 중 하나:
- WSL
- PowerShell

네 경우는 **WSL** 추천.

---

## 4) 왜 Windows-native agent는 네 경우 비추천이냐
Codex Windows 문서 기준으로:

- Windows-native agent를 계속 쓸 거면
- `\\wsl$` 프로젝트보다
- **Windows 파일시스템에 저장한 프로젝트를 `/mnt/<drive>/...`로 WSL에서 접근하는 방식이 더 안정적**이라고 되어 있음

즉,
- **Windows-native agent + WSL 경로** 조합은 베스트가 아님
- 네가 WSL 경로를 고집할 거면 **Agent도 WSL**이 맞다

---

## 5) 너 같은 `.venv` / pwntools 사용자에게 맞는 구조
이런 구조 추천:

```text
/home/daniel/yeon
├─ .venv/
├─ docs/
│  └─ class-diagram.mmd
├─ prompts/
│  └─ codex-step1.md
├─ .codex/
│  └─ config.toml
├─ AGENTS.md
├─ README.md
└─ (이후 Next.js / Prisma 프로젝트 파일들)
```

### 포인트
- `.venv`는 **그대로 유지 가능**
- Codex가 `.venv` 안을 건드리지 않게 규칙 추가 추천
- Node 프로젝트와 Python venv가 같은 루트에 있어도 됨
- 다만 `node_modules`, `.next`, `.venv`, `dist`, `build`는 건드리지 말라고 명시하는 게 좋음

---

## 6) Codex가 `.venv`를 안 건드리게 하는 규칙
`AGENTS.md`에 이 문구 넣기:

```md
# AGENTS.md

## Workspace rules
- Treat this repository as the only writable workspace.
- Do not modify files outside the project root.

## Protected paths
- Never edit or delete `.venv/`
- Never edit or delete `node_modules/`
- Never edit or delete `.next/`
- Never edit or delete `dist/`
- Never edit or delete `build/`

## Environment
- Python virtual environment may already exist in `.venv/`
- Reuse it for Python checks if needed, but do not recreate it unless explicitly asked
- Prefer WSL/Linux-compatible commands

## Safety
- Do not use destructive commands
- Ask before deleting files
- Ask before changing dependency managers or shell configuration

## Domain reference
- Use `docs/class-diagram.mmd` as the primary domain reference for schema design
```

---

## 7) Codex 앱 쓸 때의 핵심 설정 파일
프로젝트 루트에:

```text
.codex/config.toml
```

추천 내용:

```toml
model = "gpt-5.4"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

### 의미
- `gpt-5.4`: 기본 추천 모델
- `on-request`: 위험 작업은 물어보고 진행
- `workspace-write`: 현재 프로젝트 폴더 안에서만 수정

---

## 8) Mermaid 클래스 다이어그램 저장 위치
네가 준 Mermaid 코드는 아래에 저장 추천:

```text
docs/class-diagram.mmd
```

Codex용 추가 문구:

```text
Use docs/class-diagram.mmd as the primary domain reference.
Translate Mermaid inheritance into Prisma-friendly role/profile modeling when necessary.
Do not force a 1:1 mechanical conversion if Prisma constraints require a more practical design.
```

---

## 9) Step 1 프롬프트에 추가할 문구
```text
Additional constraints:
- This project lives in WSL and should be treated as a Linux-first workspace.
- Do not modify `.venv/`, `node_modules/`, `.next/`, `dist/`, or `build/`.
- Use `docs/class-diagram.mmd` as the primary domain reference.
- Prefer practical Prisma modeling over literal Mermaid inheritance.
- Keep all changes within the project root only.
- Assume the user wants to use the Codex app with WSL agent, not the CLI.
```

---

## 10) 네가 지금 만들면 되는 실제 폴더
원하는 대로 하려면 이 둘 중 하나만 하면 된다.

### 선택지 A: 가장 단순
```bash
mkdir -p ~/yeon
cd ~/yeon
```

Windows 탐색기에서:
```text
\\wsl.localhost\Ubuntu\home\daniel\yeon
```

### 선택지 B: 프로젝트들 모아둘 때
```bash
mkdir -p ~/projects/yeon
cd ~/projects/yeon
```

Windows 탐색기에서:
```text
\\wsl.localhost\Ubuntu\home\daniel\projects\yeon
```

---

## 11) 네 환경 확인용 명령어
내가 환경 맞춤 조언 더 하려면 아래 결과만 보면 거의 충분함.

### WSL 안에서
```bash
echo $SHELL
pwd
python3 --version
which python3
pip --version
which pip
git --version
which git
node -v
npm -v
```

### Windows PowerShell에서
```powershell
wsl -l -v
```

---

## 12) 네 경우 추천 최종안
### 내가 추천하는 실제 운영 방식
1. 프로젝트를 WSL 안에 만든다  
   예: `/home/daniel/yeon`

2. Windows 탐색기에서는  
   `\\wsl.localhost\Ubuntu\home\daniel\yeon` 로 접근

3. Codex 앱에서 그 폴더를 연다

4. 앱 설정에서
   - Agent = WSL
   - Sandbox = Default permissions
   - Open In = VS Code
   - Integrated terminal = WSL

5. 프로젝트 루트에 아래 파일 생성
   - `AGENTS.md`
   - `.codex/config.toml`
   - `docs/class-diagram.mmd`
   - `prompts/codex-step1.md`

---

## 13) 앱 중심이라면 CLI는 꼭 필요하냐
필수는 아님.

하지만 Node.js는 여전히 깔아두는 게 좋다.
이유:
- Codex 문서상 Node.js, Python, Git 같은 개발 도구가 있으면 작업 효율이 좋음
- Next.js / Prisma 프로젝트는 어차피 Node/npm이 필요함

즉:
- **CLI는 선택**
- **Node.js는 사실상 필수**
- **Git은 유지**
- **Python/.venv는 네 기존 방식 유지**

---

## 14) 지금 당장 네가 하면 되는 순서
### WSL에서
```bash
mkdir -p ~/yeon
cd ~/yeon
mkdir -p docs prompts .codex
```

그다음 아래 파일 준비:
- `docs/class-diagram.mmd`
- `AGENTS.md`
- `.codex/config.toml`
- `prompts/codex-step1.md`

---

## 15) 참고: 앱 사용 관련 공식 포인트
- Windows 앱은 기본적으로 Windows-native agent를 씀
- WSL2 agent로 바꿀 수 있음
- `\\wsl$` 경로의 프로젝트를 열 수 있음
- WSL 경로를 계속 쓸 거면 agent도 WSL로 두는 편이 자연스러움
- Full access는 프로젝트 디렉터리 밖까지 영향을 줄 수 있으니 주의
