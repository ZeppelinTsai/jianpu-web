@echo off
setlocal
cd /d "%~dp0"
title ABCJS Jianpu Playground Server

where python >nul 2>&1
if not errorlevel 1 (
	start "" "http://127.0.0.1:8000/index.html"
	python -m http.server 8000 --bind 127.0.0.1
	goto :eof
)

where py >nul 2>&1
if not errorlevel 1 (
	start "" "http://127.0.0.1:8000/index.html"
	py -m http.server 8000 --bind 127.0.0.1
	goto :eof
)

echo Python was not found.
echo Install Python or open index.html directly.
pause
