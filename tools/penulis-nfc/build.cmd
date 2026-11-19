@echo off
rem Builds Penulis NFC with the C# compiler that ships with Windows (.NET Framework 4.x): no SDK needed.
rem Output: public\downloads\PenulisNFC.exe (served by the app at /downloads/PenulisNFC.exe).
setlocal
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo csc.exe not found. Windows with .NET Framework 4.x is needed to build.
  exit /b 1
)
set HERE=%~dp0
set OUT=%HERE%..\..\public\downloads
set TMPDIR=%HERE%bin
if not exist "%OUT%" mkdir "%OUT%"
if not exist "%TMPDIR%" mkdir "%TMPDIR%"

rem 1. Self-test of the NDEF encoding.
"%CSC%" /nologo /target:exe /out:"%TMPDIR%\selftest.exe" "%HERE%src\Ndef.cs" "%HERE%src\SelfTest.cs" || exit /b 1
"%TMPDIR%\selftest.exe" || exit /b 1

rem 2. The tray program.
"%CSC%" /nologo /target:winexe /optimize+ /platform:anycpu ^
  /r:System.Web.Extensions.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll ^
  /out:"%OUT%\PenulisNFC.exe" ^
  "%HERE%src\Ndef.cs" "%HERE%src\Log.cs" "%HERE%src\SCard.cs" "%HERE%src\Tag.cs" "%HERE%src\ClassicTag.cs" "%HERE%src\Writer.cs" "%HERE%src\Server.cs" "%HERE%src\Program.cs" || exit /b 1
echo Built %OUT%\PenulisNFC.exe
