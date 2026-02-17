UUID = rudra@narkagni
INSTALL_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMAS_DIR = schemas

all: install

build-schemas:
	glib-compile-schemas $(SCHEMAS_DIR)

install: build-schemas
	rm -rf $(INSTALL_PATH)
	mkdir -p $(INSTALL_PATH)
	cp -r ./* $(INSTALL_PATH)
	rm $(INSTALL_PATH)/Makefile
	rm $(INSTALL_PATH)/README.md
	rm -rf $(INSTALL_PATH)/.git
	rm -rf $(INSTALL_PATH)/media
	@echo "Installation complete. Please restart GNOME Shell."

pack: build-schemas
	zip -r $(UUID).zip . -x "*.git*" -x "Makefile" -x "README.md" -x "media/*"

clean:
	rm -f $(SCHEMAS_DIR)/gschemas.compiled
	rm -f *.zip
