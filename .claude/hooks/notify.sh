#!/usr/bin/env bash
# Notification: a desktop notification when Claude waits for you (approval, question, idle).
set -uo pipefail
. "$(dirname "$0")/lib.sh"

msg="$(hook_fields message)"; msg="${msg:-Claude Code is waiting for you}"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    msg="${msg//\'/\'\'}"
    powershell.exe -NoProfile -WindowStyle Hidden -Command "
      Add-Type -AssemblyName System.Windows.Forms, System.Drawing
      \$n = New-Object System.Windows.Forms.NotifyIcon
      \$n.Icon = [System.Drawing.SystemIcons]::Information; \$n.Visible = \$true
      \$n.ShowBalloonTip(6000, 'Claude Code', '$msg', 'Info'); Start-Sleep -Seconds 7; \$n.Dispose()" > /dev/null 2>&1 &
    ;;
  Darwin) osascript -e "display notification \"${msg//\"/}\" with title \"Claude Code\"" > /dev/null 2>&1 & ;;
  *) command -v notify-send > /dev/null && notify-send "Claude Code" "$msg" & ;;
esac
exit 0
