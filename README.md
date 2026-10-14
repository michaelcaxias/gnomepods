<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# GnomePods

AirPods in the GNOME top bar: battery for each bud and the case, noise control, and a couple of toggles, in one menu.

GnomePods is only the GNOME Shell front end. It does not talk to the AirPods itself. It reads and controls the **`linuxpods-daemon`** from [LinuxPods](https://github.com/Explor3Universe/LinuxPods) over D-Bus, so you need that daemon running.

> **On KDE Plasma?** Use LinuxPods directly. It ships a native Plasma 6 system tray widget that does the same job: <https://github.com/Explor3Universe/LinuxPods>

## Features

- Panel icon with the lowest bud battery, dimmed when the AirPods are disconnected
- Battery tiles for the left bud, case and right bud (low and charging colours, in-ear state)
- Noise control buttons: Off, Noise Cancel, Transparency, Adaptive
- Switches for Conversational Awareness and One Bud ANC
- The icon is always visible and re-reads the daemon every 10 s, so it recovers by itself if the daemon restarts

## Requirements

- GNOME Shell 50
- [`linuxpods-daemon`](https://github.com/Explor3Universe/LinuxPods) installed and running. Follow the install steps in the LinuxPods README, then:

  ```bash
  systemctl --user enable --now linuxpods-daemon
  ```

Tested on Fedora (Nobara) with GNOME Shell 50.5 on Wayland and AirPods Pro. Other GNOME versions are untested; the `shell-version` list in `extension/metadata.json` is the place to add them.

## Install

```bash
git clone https://github.com/michaelcaxias/gnomepods.git
cd gnomepods
make install
# Wayland: log out and back in, then
gnome-extensions enable gnomepods@michaelcaxias.github.io
```

`make uninstall` removes it. `make pack` builds a zip you can install with `gnome-extensions install`.

## Developing

`dev/dev-shell.sh` (or `make dev`) opens a nested GNOME Shell that loads `extension/` straight from this repo, with a fake daemon (`dev/mock_daemon.py`) so you can see every state without AirPods. Close the window and run it again to reload your changes; no logout needed.

It uses a throwaway config and data directory, so your real GNOME settings and extensions are not touched. It needs `mutter-devkit` (Fedora: `sudo dnf install mutter-devkit`).

## Credits and notes

- The Apple Accessory Protocol work and the daemon are by the [LinuxPods](https://github.com/Explor3Universe/LinuxPods) authors. GnomePods is an independent project and is not affiliated with them.
- The icons in `extension/icons/` are original drawings made for this project.
- AirPods is a trademark of Apple Inc. GnomePods is not affiliated with or endorsed by Apple.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
