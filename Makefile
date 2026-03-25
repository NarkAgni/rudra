UUID         = rudra@narkagni
INSTALL_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMAS_DIR  = schemas

all: install

build-schemas:
	glib-compile-schemas $(SCHEMAS_DIR)

install: build-schemas
	rm -rf $(INSTALL_PATH)
	mkdir -p $(INSTALL_PATH)
	mkdir -p $(INSTALL_PATH)/src/browsers
	mkdir -p $(INSTALL_PATH)/src/core
	mkdir -p $(INSTALL_PATH)/src/data
	mkdir -p $(INSTALL_PATH)/src/prefs
	mkdir -p $(INSTALL_PATH)/src/search
	mkdir -p $(INSTALL_PATH)/src/services
	mkdir -p $(INSTALL_PATH)/src/ui
	cp extension.js    $(INSTALL_PATH)/
	cp prefs.js        $(INSTALL_PATH)/
	cp stylesheet.css  $(INSTALL_PATH)/
	cp metadata.json   $(INSTALL_PATH)/
	cp -r icons/       $(INSTALL_PATH)/icons/
	cp -r schemas/     $(INSTALL_PATH)/schemas/
	cp src/browsers/*.js  $(INSTALL_PATH)/src/browsers/
	cp src/core/*.js      $(INSTALL_PATH)/src/core/
	cp src/data/*         $(INSTALL_PATH)/src/data/
	cp src/prefs/*.js     $(INSTALL_PATH)/src/prefs/
	cp src/search/*.js    $(INSTALL_PATH)/src/search/
	cp src/services/*.js  $(INSTALL_PATH)/src/services/
	cp src/ui/*.js        $(INSTALL_PATH)/src/ui/
	@echo "Rudra installed. Restart GNOME Shell to apply."

pack: build-schemas
	zip -r $(UUID).zip . \
		-x "*.git*" \
		-x "Makefile" \
		-x "README.md" \
		-x "media/*" \
		-x "*.zip"

uninstall:
	rm -rf $(INSTALL_PATH)
	@echo "Rudra uninstalled."

clean:
	rm -f $(SCHEMAS_DIR)/gschemas.compiled
	rm -f *.zip