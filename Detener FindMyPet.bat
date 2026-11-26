@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\windows\FindMyPet.ps1" -Accion Detener
set "resultado=%errorlevel%"
if not defined FINDMYPET_SIN_PAUSA pause
exit /b %resultado%
