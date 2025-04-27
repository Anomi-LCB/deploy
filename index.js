// index.js (Hono 기반, API Action + R2 파일 서빙 기능 + 루트 경로 오류 수정)
import { Hono } from "hono";
import { cors } from "hono/cors"; // CORS 미들웨어
import { jwt } from "hono/jwt"; // JWT 미들웨어
import { zValidator } from "@hono/zod-validator"; // Zod 검증 미들웨어
import { z } from "zod"; // Zod 스키마 정의
import { getMimeType } from "hono/utils/mime"; // MIME 타입 유틸리티 import
import openapiSpec from "./public/openapi.json" with { type: "json" }; // OpenAPI 스펙 import (3.1.0으로 수정 필요할 수 있음)

// Hono 앱 인스턴스 생성
const app = new Hono();

// --- AI Plugin Manifest 정의 ---
// (Anomi - 똑똑 코딩 비서 용 Manifest, 필요시 내용 수정)
const aiPluginJson = {
  schema_version: "v1",
  name_for_human: "Anomi - R2 코딩 비서", // GPT 이름 반영
  name_for_model: "Anomi_R2_Coding_Assistant", // 모델이 사용할 이름
  description_for_human:
    "Anomi님을 위한 코딩 보조 및 Cloudflare R2 파일 관리 GPT입니다.",
  description_for_model: `코딩 작업을 돕고 Cloudflare R2 저장소의 파일을 관리하는 플러그인입니다.
- 사용 가능 기능: listFilesFolders, createFile, readFile, updateFile, deleteFile, createFolder, deleteFolder, checkFolder.
- 모든 /v1/ API 요청에는 Bearer 인증 토큰이 필요합니다.
- 파일 생성/수정은 html, php, css, js 확장자만 허용됩니다.
- R2 파일 직접 서빙 기능도 포함되어 wrangler dev로 미리보기가 가능합니다.`,
  auth: {
    type: "http",
    scheme: "bearer",
  },
  api: {
    type: "openapi",
    url: "/openapi.json", // Worker에서 서빙하는 OpenAPI 명세 경로
    is_user_authenticated: false,
  },
  logo_url: "https://placehold.co/600x400/orange/white?text=Anomi+AI", // 적절한 URL로 교체
  contact_email: "support@example.com", // 적절한 이메일로 교체
  legal_info_url: "https://example.com/legal", // 적절한 URL로 교체
};

// --- 0. 전역 미들웨어 설정 ---

// CORS 설정 (API 및 파일 서빙 모두 적용될 수 있도록 맨 앞에 배치)
app.use(
  "*",
  cors({
    origin: "*", // 로컬 테스트 및 chat.openai.com 모두 허용 (배포 시 필요에 따라 변경)
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

// JWT 인증 미들웨어 (/v1/ API 경로에만 적용)
app.use("/v1/*", async (c, next) => {
  const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET });
  await jwtMiddleware(c, next);
});

// --- 1. 정적 파일 및 메타데이터 서빙 라우트 ---

// 루트 경로는 아래 '*' 핸들러에서 R2의 index.html을 찾도록 명시적으로 넘김
app.get("/", async (c, next) => {
  await next(); // 다음 매칭되는 핸들러 (app.get('*',...)) 로 제어를 넘김
});

app.get("/.well-known/ai-plugin.json", (c) => {
  return c.json(aiPluginJson);
});

app.get("/openapi.json", (c) => {
  // OpenAPI 버전 3.1.0으로 수정된 파일을 import 해야 할 수 있음
  return c.json(openapiSpec);
});

// --- 2. API v1 라우트 및 핸들러 (기존 코드 유지) ---

// --- Zod 스키마 정의 (기존 코드 유지) ---
const pathSchema = z.string().min(1, { message: "Path cannot be empty." });
const folderPathSchema = pathSchema.refine((val) => val.endsWith("/"), {
  message: "Folder path must end with '/'",
});
const listFilesFoldersSchema = z.object({
  path: z.string().optional().default(""),
});
const createFileSchema = z.object({
  path: pathSchema.refine((val) => !val.endsWith("/"), {
    message: "File path must not end with '/'",
  }),
  content: z.string().optional().default(""),
});
const readFileSchema = z.object({
  path: pathSchema.refine((val) => !val.endsWith("/"), {
    message: "File path must not end with '/'",
  }),
});
const updateFileSchema = z.object({
  path: pathSchema.refine((val) => !val.endsWith("/"), {
    message: "File path must not end with '/'",
  }),
  content: z.string(),
});
const deleteFileSchema = z.object({
  path: pathSchema.refine((val) => !val.endsWith("/"), {
    message: "File path must not end with '/'",
  }),
});
const createFolderSchema = z.object({ path: folderPathSchema });
const deleteFolderSchema = z.object({ path: folderPathSchema });
const checkFolderSchema = z.object({ path: folderPathSchema });

// --- API 엔드포인트 핸들러 (기존 코드 유지) ---
// listFilesFolders (POST /v1/list_files_folders)
app.post(
  "/v1/list_files_folders",
  zValidator("json", listFilesFoldersSchema),
  async (c) => {
    const { path } = c.req.valid("json");
    const env = c.env;
    const normalizedPath =
      path && !path.endsWith("/") && path !== "" ? path + "/" : path;
    try {
      const list = await env.FILES.list({
        prefix: normalizedPath,
        delimiter: "/",
      });
      const files = (list.objects || [])
        .filter((obj) => obj.key !== normalizedPath && !obj.key.endsWith("/"))
        .map((obj) => ({
          name: obj.key.substring(normalizedPath.length),
          type: "file",
          size: obj.size,
          modified: obj.uploaded?.toISOString(),
        }));
      const folders = (list.delimitedPrefixes || []).map((prefix) => ({
        name: prefix.substring(normalizedPath.length),
        type: "folder",
      }));
      return c.json({ items: [...folders, ...files] });
    } catch (e) {
      console.error("Error listing:", e);
      return c.json({ error: "Failed to list items." }, 500);
    }
  },
);

// createFile (POST /v1/create_file)
app.post("/v1/create_file", zValidator("json", createFileSchema), async (c) => {
  const { path, content } = c.req.valid("json");
  const env = c.env;
  // 확장자 검사 (GPT 지침에서도 확인하지만, 서버에서도 확인하는 것이 안전)
  const allowedExtensions = ["html", "php", "css", "js", "txt"]; // .txt 추가 또는 필요에 따라 조정
  const extension = path.split(".").pop()?.toLowerCase();
  if (!extension || !allowedExtensions.includes(extension)) {
    // GPT 지침에서 걸러지겠지만, 만약을 대비한 서버 측 검증
    console.warn(`Attempted to create file with disallowed extension: ${path}`);
    // return c.json({ error: `File extension not allowed. Allowed: ${allowedExtensions.join(', ')}` }, 400);
    // 일단 생성은 허용하되, GPT 지침에서 제한하도록 위임 (필요시 위 주석 해제하여 서버에서 차단)
  }
  try {
    await env.FILES.put(path, content);
    return c.json({ message: "File created successfully." }, 201);
  } catch (e) {
    console.error("Error creating file:", e);
    return c.json({ error: "Failed to create file." }, 500);
  }
});

// readFile (POST /v1/read_file)
app.post("/v1/read_file", zValidator("json", readFileSchema), async (c) => {
  const { path } = c.req.valid("json");
  const env = c.env;
  try {
    const obj = await env.FILES.get(path);
    if (!obj) {
      return c.json({ error: "File not found." }, 404);
    }
    const text = await obj.text();
    return c.json({ content: text });
  } catch (e) {
    console.error("Error reading file:", e);
    return c.json({ error: "Failed to read file." }, 500);
  }
});

// updateFile (POST /v1/update_file)
app.post("/v1/update_file", zValidator("json", updateFileSchema), async (c) => {
  const { path, content } = c.req.valid("json");
  const env = c.env;
  // 확장자 검사 (createFile과 유사)
  const allowedExtensions = ["html", "php", "css", "js", "txt"];
  const extension = path.split(".").pop()?.toLowerCase();
  if (!extension || !allowedExtensions.includes(extension)) {
    console.warn(`Attempted to update file with disallowed extension: ${path}`);
    // return c.json({ error: `File extension not allowed. Allowed: ${allowedExtensions.join(', ')}` }, 400);
    // 일단 업데이트는 허용하되, GPT 지침에서 제한하도록 위임
  }
  try {
    await env.FILES.put(path, content); // put은 생성 또는 덮어쓰기
    return c.json({ message: "File updated successfully." });
  } catch (e) {
    console.error("Error updating file:", e);
    return c.json({ error: "Failed to update file." }, 500);
  }
});

// deleteFile (기존 POST 유지 또는 DELETE로 변경 - OpenAPI 명세와 일치시키는 것이 좋음)
app.post("/v1/delete_file", zValidator("json", deleteFileSchema), async (c) => {
  // app.delete('/v1/delete_file', zValidator('json', deleteFileSchema), async (c) => { // DELETE 메서드 사용 시
  const { path } = c.req.valid("json");
  const env = c.env;
  try {
    await env.FILES.delete(path);
    return c.json({ message: "File deleted successfully." }, 200);
  } catch (e) {
    console.error("Error deleting file:", e);
    return c.json({ error: "Failed to delete file." }, 500);
  }
});

// createFolder (POST /v1/create_folder)
app.post(
  "/v1/create_folder",
  zValidator("json", createFolderSchema),
  async (c) => {
    const { path } = c.req.valid("json");
    const env = c.env;
    try {
      await env.FILES.put(path, ""); // 0바이트 객체 생성으로 폴더 표현
      return c.json({ message: "Folder created successfully." }, 201);
    } catch (e) {
      console.error("Error creating folder:", e);
      return c.json({ error: "Failed to create folder." }, 500);
    }
  },
);

// deleteFolder (기존 POST 유지 또는 DELETE로 변경)
app.post(
  "/v1/delete_folder",
  zValidator("json", deleteFolderSchema),
  async (c) => {
    // app.delete('/v1/delete_folder', zValidator('json', deleteFolderSchema), async (c) => { // DELETE 메서드 사용 시
    const { path } = c.req.valid("json");
    const env = c.env;
    try {
      const list = await env.FILES.list({ prefix: path });
      const deletePromises = list.objects.map((obj) =>
        env.FILES.delete(obj.key),
      );
      await Promise.all(deletePromises);
      try {
        await env.FILES.delete(path);
      } catch { /* 폴더 마커 삭제 시도 - 오류 무시 */ }
      if (list.truncated) {
        console.warn(`Folder deletion incomplete: ${path}`);
        return c.json(
          { message: "Folder deletion initiated, might be incomplete." },
          202,
        );
      }
      return c.json({ message: "Folder deleted successfully." }, 200);
    } catch (e) {
      console.error("Error deleting folder:", e);
      return c.json({ error: "Failed to delete folder." }, 500);
    }
  },
);

// checkFolder (POST /v1/check_folder)
app.post(
  "/v1/check_folder",
  zValidator("json", checkFolderSchema),
  async (c) => {
    const { path } = c.req.valid("json");
    const env = c.env;
    try {
      const list = await env.FILES.list({
        prefix: path,
        limit: 1,
        delimiter: "/",
      });
      const folderMarkerExists = list.objects.some(
        (obj) => obj.key === path && obj.size === 0,
      );
      const hasContents =
        list.objects.some((obj) => obj.key !== path) ||
        list.delimitedPrefixes.length > 0;
      return c.json({ exists: folderMarkerExists || hasContents });
    } catch (e) {
      console.error("Error checking folder:", e);
      return c.json({ error: "Failed to check folder existence." }, 500);
    }
  },
);

// --- 3. R2 파일 서빙 핸들러 (추가된 부분) ---
// 중요: 이 핸들러는 다른 특정 GET 라우트들 뒤에 위치해야 함
app.get("*", async (c) => {
  const env = c.env;
  // FILES 바인딩이 설정되지 않았으면 오류 반환 (wrangler.toml 확인 필요)
  if (!env.FILES) {
    console.error("R2 bucket binding 'FILES' not found.");
    return c.text("R2 binding 'FILES' is not configured.", 500);
  }

  const url = new URL(c.req.url);
  let key = url.pathname.slice(1); // 경로에서 맨 앞 '/' 제거

  // 루트 경로('/') 요청 시에도 key가 ''이 되므로 아래 로직에서 'index.html' 시도
  if (key === "" || key.endsWith("/")) {
    key += "index.html";
  }

  console.log(`Attempting to serve R2 object: ${key}`);

  try {
    const object = await env.FILES.get(key);

    if (object === null) {
      console.log(`R2 object not found: ${key}`);
      return c.text("Not Found", 404);
    }

    // R2 객체 메타데이터 기반 헤더 설정
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);

    // Content-Type 설정 (파일 확장자 기반)
    const mimeType = getMimeType(key);
    if (mimeType) {
      headers.set("Content-Type", mimeType);
    } else {
      headers.set("Content-Type", "application/octet-stream"); // 기본값
    }

    console.log(
      `Serving R2 object: ${key} with Content-Type: ${headers.get("Content-Type")}`,
    );
    // 파일 내용과 헤더로 응답 반환
    return new Response(object.body, {
      headers,
    });
  } catch (e) {
    console.error(`Error serving R2 object ${key}:`, e);
    return c.text("Internal Server Error", 500);
  }
});

// --- 4. 에러 핸들링 (맨 마지막에 위치) ---
app.onError((err, c) => {
  console.error("Global Error Handler Caught:", err);
  // JWT 에러
  if (
    err instanceof Error &&
    (err.message.includes("invalid signature") ||
      err.message.includes("token expired") ||
      err.message.includes("invalid token") ||
      err.name === "JwtTokenInvalid")
  ) {
    return c.json({ error: `Unauthorized: ${err.message}` }, 401);
  }
  // Zod 검증 에러
  if (err instanceof z.ZodError) {
    return c.json(
      { error: "Request validation failed", details: err.errors },
      400,
    );
  }
  // Hono가 처리하지 못한 Context Finalization 오류 등 확인 (디버깅용)
  if (
    err instanceof Error &&
    err.message.includes("Context is not finalized")
  ) {
    console.error("Context finalization error detected by global handler!");
    // 여기서 기본 500 오류 응답을 반환하거나, Hono의 기본 404 처리 외 다른 처리를 할 수 있음
  }
  // 기타 예상치 못한 오류
  return c.json(
    { error: "An internal server error occurred.", details: err.message },
    500,
  );
});

// --- 5. Worker 내보내기 ---
export default app;
