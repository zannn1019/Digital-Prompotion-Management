@echo off
rem Builds Penulis NFC for Windows with Go (no C compiler needed). Runs the tests first.
rem Output: public\downloads\PenulisNFC.exe (served by the app at /downloads/PenulisNFC.exe).
rem The macOS app is built on a Mac: build-mac.sh, run by .github\workflows\penulis-nfc.yml.
setlocal
cd /d "%~dp0"
set CGO_ENABLED=0
go test ./... || exit /b 1
set GOOS=windows
set GOARCH=amd64
go build -trimpath -ldflags "-H windowsgui -s -w" -o ..\..\public\downloads\PenulisNFC.exe . || exit /b 1
echo Built public\downloads\PenulisNFC.exe
