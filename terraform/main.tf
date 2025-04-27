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

# Cloudflare Worker 스크립트 리소스 정의 (원래 목표 버전)
resource "cloudflare_workers_script" "file_api_worker" {
  account_id = "0ece330533795f5adde5906988a2ef5e"
  name       = "file-api"

  # 중요: 아래 파일 이름이 실제 빌드 결과물(dist/ 폴더 안)과 일치하는지 꼭 확인하세요!
  content    = file("../dist/worker.js") # 또는 "../dist/_worker.js" 등 실제 파일 이름

  module     = true

  kv_namespace_binding {
    name         = "FILE_API_KV"
    namespace_id = cloudflare_workers_kv_namespace.file_api_kv.id
  }
  r2_bucket_binding {
    name        = "FILES"
    bucket_name = cloudflare_r2_bucket.file_api_bucket.name
  }
}