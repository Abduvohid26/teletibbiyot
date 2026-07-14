# PowerShell PostgreSQL backup — Windows Task Scheduler uchun
param(
  [string]$BackupDir = "./backups/postgres",
  [int]$RetentionDays = 14,
  [string]$Container = "ishifo-db",
  [string]$DbUser = "ishifo",
  [string]$DbName = "ishifo"
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$file = Join-Path $BackupDir "ishifo_$timestamp.sql.gz"

Write-Host "[$(Get-Date)] Backup boshlandi: $file"
docker exec $Container pg_dump -U $DbUser $DbName | gzip > $file
Write-Host "[$(Get-Date)] Backup yakunlandi"

Get-ChildItem $BackupDir -Filter "*.sql.gz" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
  Remove-Item -Force

Write-Host "[$(Get-Date)] Eski backup lar tozalandi (>$RetentionDays kun)"
