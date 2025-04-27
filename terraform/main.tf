terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4"
    }
  }
}

provider "cloudflare" {}

# Cloudflare R2 Bucket 리소스 정의
resource "cloudflare_r2_bucket" "file_api_bucket" {
  account_id = "0ece330533795f5adde5906988a2ef5e"
  name       = "file-api-bucket"
}

# Cloudflare Workers KV Namespace 리소스 정의
resource "cloudflare_workers_kv_namespace" "file_api_kv" {
  account_id = "0ece330533795f5adde5906988a2ef5e"
  title      = "FILE_API_KV"
}

# Cloudflare Worker 스크립트 리소스 정의
resource "cloudflare_workers_script" "file_api_worker" { # <-- 's' 추가됨
  account_id = "0ece330533795f5adde5906988a2ef5e"
  name       = "file-api"

  # 수정된 부분: 번들링된 결과 파일을 읽도록 변경!
  content = file("../dist/worker.js") # 경로는 terraform 폴더 기준

  module = true # ES 모듈 형식 사용

  # KV 네임스페이스 바인딩 설정
  kv_namespace_binding {
    name         = "FILE_API_KV"
    namespace_id = cloudflare_workers_kv_namespace.file_api_kv.id
  }

  # R2 버킷 바인딩 설정
  r2_bucket_binding {
    name        = "FILES"
    bucket_name = cloudflare_r2_bucket.file_api_bucket.name
  }
}