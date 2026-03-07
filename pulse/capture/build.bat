@echo off
setlocal EnableDelayedExpansion

echo === Puls8 WASAPI Capture Helper Build ===
echo.

:: -----------------------------------------------------------------------
:: 1. Find Visual Studio using vswhere
:: -----------------------------------------------------------------------
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "VS_PATH="

if exist "%VSWHERE%" (
    for /f "usebackq delims=" %%i in (
        `"%VSWHERE%" -latest -products * -property installationPath`
    ) do set "VS_PATH=%%i"
)

:: Fallback: scan known directories
if "!VS_PATH!"=="" (
    for %%v in (18 17 16) do (
        for %%e in (Community Professional Enterprise BuildTools) do (
            set "_try=%ProgramFiles(x86)%\Microsoft Visual Studio\%%v\%%e"
            if exist "!_try!\VC\Auxiliary\Build\vcvars64.bat" (
                set "VS_PATH=!_try!"
                goto :found_vs
            )
        )
    )
)

:found_vs
if "!VS_PATH!"=="" (
    echo ERROR: Could not find Visual Studio.
    echo        Install VS 2019/2022/2025 with "Desktop development with C++" workload.
    exit /b 1
)
echo Found VS: !VS_PATH!

:: -----------------------------------------------------------------------
:: 2. Find latest Windows 10/11 SDK
:: -----------------------------------------------------------------------
set "SDK_VER="
for /f "delims=" %%v in (
    'dir /b /ad "%ProgramFiles(x86)%\Windows Kits\10\Include\" 2^>nul ^| sort /r'
) do (
    if "!SDK_VER!"=="" set "SDK_VER=%%v"
)

if "!SDK_VER!"=="" (
    echo ERROR: Windows 10/11 SDK not found.
    exit /b 1
)
echo Using SDK:  !SDK_VER!
echo.

:: -----------------------------------------------------------------------
:: 3. Set up 64-bit compiler environment
:: -----------------------------------------------------------------------
call "!VS_PATH!\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1

:: -----------------------------------------------------------------------
:: 4. Compile
:: -----------------------------------------------------------------------
echo Compiling wasapi_capture.cpp ...
echo.

cl.exe /nologo /EHsc /O2 /std:c++17 /W3 ^
    /D "UNICODE" /D "_UNICODE" /D "WIN32_LEAN_AND_MEAN" /D "NOMINMAX" ^
    wasapi_capture.cpp ^
    /link ^
    ole32.lib oleaut32.lib mmdevapi.lib ^
    /OUT:wasapi_capture.exe ^
    /SUBSYSTEM:CONSOLE

if %ERRORLEVEL% neq 0 (
    echo.
    echo BUILD FAILED.
    exit /b 1
)

:: -----------------------------------------------------------------------
:: 5. Copy to project root so Node.js can find it
:: -----------------------------------------------------------------------
copy /y wasapi_capture.exe ..\wasapi_capture.exe >nul

echo.
echo BUILD SUCCEEDED.
echo wasapi_capture.exe is ready — restart the Electron app and start the pipeline.
