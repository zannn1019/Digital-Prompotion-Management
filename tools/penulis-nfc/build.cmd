@echo off
rem Builds Penulis NFC for Windows and macOS from this computer (needs Go; no C compiler, no Mac).
rem Runs the tests first. Output, served by the app:
rem   public\downloads\PenulisNFC.exe      Windows 10/11 (tray icon)
rem   public\downloads\PenulisNFC-mac.zip  macOS 11+, Apple Silicon and Intel (runs in the background)
setlocal
cd /d "%~dp0"
set CGO_ENABLED=0
set OUT=..\..\public\downloads
for /f "tokens=4 delims= " %%v in ('findstr /b /c:"const version = " server.go') do set VERSION=%%~v
if not exist bin\mac mkdir bin\mac

go test ./... || exit /b 1

set GOOS=windows
set GOARCH=amd64
go build -trimpath -ldflags "-H windowsgui -s -w" -o %OUT%\PenulisNFC.exe . || exit /b 1
echo Built %OUT%\PenulisNFC.exe (%VERSION%)

set GOOS=darwin
set GOARCH=arm64
go build -trimpath -ldflags "-s -w" -o bin\mac\penulis-arm64 . || exit /b 1
set GOARCH=amd64
go build -trimpath -ldflags "-s -w" -o bin\mac\penulis-amd64 . || exit /b 1
set GOOS=
set GOARCH=
go run ./cmd/packmac %VERSION% bin\mac\penulis-arm64 bin\mac\penulis-amd64 %OUT%\PenulisNFC-mac.zip || exit /b 1
