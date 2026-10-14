#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Run a nested GNOME Shell to try the extension without logging out.
#   ./dev/dev-shell.sh          fake daemon (battery 55/54/80, Transparency)
#   ./dev/dev-shell.sh --real   no fake daemon; a nested session cannot see the
#                               real linuxpods-daemon, so the icon shows "disconnected"
# Loads extension/ straight from this repo (no install), and uses a throwaway
# config/data dir so your real GNOME settings and extensions are untouched.
# Requires: mutter-devkit (Fedora: sudo dnf install mutter-devkit)
set -euo pipefail
uuid="gnomepods@michaelcaxias.github.io"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(dirname "$here")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/data/gnome-shell/extensions"
ln -s "$repo/extension" "$tmp/data/gnome-shell/extensions/$uuid"
export XDG_CONFIG_HOME="$tmp/config" XDG_DATA_HOME="$tmp/data"
inner='
  if [ "${1:-}" != "--real" ]; then python3 "'"$here"'/mock_daemon.py" & fi
  gsettings set org.gnome.shell enabled-extensions "[\"'"$uuid"'\"]"
  gsettings set org.gnome.shell disable-user-extensions false
  gnome-shell --devkit --wayland
  kill %1 2>/dev/null || true
'
dbus-run-session -- bash -c "$inner" _ "$@"
