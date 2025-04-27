import js from "@eslint/js";
import globals from "globals";
import json from "@eslint/json";
import jsonParser from "jsonc-eslint-parser";
import markdown from "@eslint/markdown";
import babelParser from "@babel/eslint-parser"; // <-- Babel 파서 import 추가
import { defineConfig } from "eslint/config";

export default defineConfig([
  // JavaScript 파일 설정
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: babelParser, // <-- 파서를 Babel 파서로 지정
      parserOptions: {
        requireConfigFile: false, // <-- Babel 설정 파일(.babelrc 등) 없어도 되도록 설정
        ecmaVersion: "latest",
        sourceType: "module",
        babelOptions: { // <-- 추가 Babel 옵션 (필요시)
          parserOpts: {
             // plugins: ["importAssertions"] // 필요하다면 Babel 플러그인 추가 가능
          }
        }
      },
    },
    rules: {
        ...js.configs.recommended.rules,
    }
  },

  // JSON 파일 설정 (이전과 동일)
  {
    files: ["**/*.json", "**/*.jsonc"],
    languageOptions: {
      parser: jsonParser,
    },
    plugins: { json },
    rules: {
        ...json.configs.recommended.rules
    }
  },

  // Markdown 파일 설정 (이전과 동일)
  {
    files: ["**/*.md"],
    ...markdown.configs.recommended,
  },
]);