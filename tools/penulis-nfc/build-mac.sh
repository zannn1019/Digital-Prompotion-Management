#!/bin/sh
# Builds Penulis NFC for macOS (Apple Silicon + Intel in one app) on a Mac with Go and the Xcode command line
# tools. Output: public/downloads/PenulisNFC-mac.zip (PenulisNFC.app inside). Run by .github/workflows/penulis-nfc.yml.
set -eu
cd "$(dirname "$0")"
OUT=../../public/downloads
VERSION=$(sed -n 's/^const version = "\(.*\)"/\1/p' server.go)
rm -rf bin/mac && mkdir -p bin/mac "$OUT"

go test ./...
for arch in arm64 amd64; do
  CGO_ENABLED=1 GOOS=darwin GOARCH=$arch go build -trimpath -ldflags "-s -w" -o "bin/mac/penulis-$arch" .
done

APP=bin/mac/PenulisNFC.app
mkdir -p "$APP/Contents/MacOS"
lipo -create -output "$APP/Contents/MacOS/PenulisNFC" bin/mac/penulis-arm64 bin/mac/penulis-amd64
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Penulis NFC</string>
  <key>CFBundleDisplayName</key><string>Penulis NFC</string>
  <key>CFBundleIdentifier</key><string>id.rsbethesda.penulisnfc</string>
  <key>CFBundleExecutable</key><string>PenulisNFC</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <!-- Menu-bar app: no Dock icon -->
  <key>LSUIElement</key><true/>
</dict>
</plist>
EOF
# Ad-hoc signature: required for Apple Silicon to run it at all. Not notarized, so Gatekeeper asks once
# (System Settings > Privacy & Security > Open Anyway).
codesign --force --deep --sign - "$APP"
rm -f "$OUT/PenulisNFC-mac.zip"
ditto -c -k --keepParent "$APP" "$OUT/PenulisNFC-mac.zip"
echo "Built $OUT/PenulisNFC-mac.zip ($VERSION)"
