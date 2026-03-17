# ================================
# إعداد المسارات
# ================================
$updatedPath = "C:\Users\ayham\Downloads\accounting-system-v3\accounting-system"
$repoPath    = "git clone https://github.com/ayham9490/alaqsa"   # ← عدّل هذا للمسار الذي يحتوي clone للمستودع

Write-Host "🔍 التحقق من المسارات..." -ForegroundColor Cyan

if (!(Test-Path $updatedPath)) {
    Write-Host "❌ مسار الملفات المحدثة غير موجود:" $updatedPath -ForegroundColor Red
    exit
}

if (!(Test-Path $repoPath)) {
    Write-Host "❌ مسار المستودع المحلي غير موجود:" $repoPath -ForegroundColor Red
    Write-Host "➡ يجب أن تقوم بعمل clone للمستودع أولاً:"
    Write-Host "   git clone https://github.com/ayham9490/alaqsa"
    exit
}

Write-Host "✔ المسارات صحيحة" -ForegroundColor Green

# ================================
# حذف الملفات القديمة من المستودع
# ================================
Write-Host "🗑 حذف الملفات القديمة من المستودع..." -ForegroundColor Yellow

Get-ChildItem -Path $repoPath -Recurse -Force |
    Where-Object { $_.FullName -notmatch "\\.git" } |
    Remove-Item -Recurse -Force

Write-Host "✔ تم حذف جميع الملفات القديمة" -ForegroundColor Green

# ================================
# نسخ الملفات المحدثة إلى المستودع
# ================================
Write-Host "📁 نسخ الملفات المحدثة إلى المستودع..." -ForegroundColor Yellow

Copy-Item -Path "$updatedPath\*" -Destination $repoPath -Recurse -Force

Write-Host "✔ تم نسخ الملفات المحدثة" -ForegroundColor Green

# ================================
# تنفيذ أوامر Git
# ================================
Write-Host "🔄 تنفيذ أوامر Git..." -ForegroundColor Cyan

Set-Location $repoPath

git add -A
git commit -m "Update: رفع النسخة المحدثة من النظام"
git push origin main

Write-Host "🚀 تم رفع الملفات بنجاح إلى GitHub" -ForegroundColor Green