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

# --- Cloudflare Worker 스크립트 리소스 정의는 삭제됨 ---