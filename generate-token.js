// generate-token.js
import jwt from "@tsndr/cloudflare-worker-jwt";

// ▼▼▼▼▼ 중요! ▼▼▼▼▼
// 간단한 비밀 키로 설정되어 있습니다.
const secret = "lUdTQcR6Sy6cKCprDfM8goymxHgvkuo9ZrmRLN2prvqvtbQIrB";
// ▲▲▲▲▲ 중요! ▲▲▲▲▲

// 토큰에 포함될 데이터 (선택 사항)
const payload = {
  user: "test-user",
  // 만료 시간 추가 (예: 지금부터 1시간 후 만료)
  // exp: Math.floor(Date.now() / 1000) + (60 * 60),
  // iat: Math.floor(Date.now() / 1000), // Issued at time
};

async function generateToken() {
  if (!secret || secret === "YOUR_ACTUAL_JWT_SECRET_HERE") {
    // Placeholder 체크는 유지
    console.error("\n--- 스크립트 오류 ---");
    console.error(
      "generate-token.js 파일의 secret 변수에 실제 JWT 비밀 키를 입력해야 합니다.",
    );
    console.error("-------------------\n");
    return;
  }
  try {
    console.log("\nJWT 생성 중...");
    // ▼▼▼ 길이 확인 로그 추가 (디버깅용, 필요 없으면 지워도 무방) ▼▼▼
    console.log(`generate-token.js 비밀 키 길이: ${secret.length}`);
    // ▲▲▲ 길이 확인 로그 추가 (디버깅용, 필요 없으면 지워도 무방) ▲▲▲
    const token = await jwt.sign(payload, secret);
    console.log("\n--- 생성된 JWT ---");
    console.log(token);
    console.log("------------------\n");
    console.log("* 위 토큰을 복사하여 API 테스트에 사용하세요.");
    console.log(
      "* 이 generate-token.js 파일은 비밀 키가 포함되어 있으니 Git 등에 커밋하지 마세요!\n",
    );
  } catch (err) {
    console.error("\n--- JWT 생성 오류 ---");
    console.error(err);
    console.error("-------------------\n");
  }
}

generateToken();
