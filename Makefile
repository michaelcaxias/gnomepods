UUID := gnomepods@michaelcaxias.github.io
DEST := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: install uninstall pack dev
install:
	mkdir -p $(DEST)
	cp -r extension/. $(DEST)/
	@echo "Installed. Log out and back in (Wayland), then: gnome-extensions enable $(UUID)"

uninstall:
	rm -rf $(DEST)

pack:
	gnome-extensions pack extension --force --extra-source=icons --extra-source=stylesheet.css

dev:
	./dev/dev-shell.sh
