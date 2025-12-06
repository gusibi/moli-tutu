# Makefile for Moli TuTu

# Phony targets to avoid conflicts with file names
.PHONY: dmg clean

# Default target
all: dmg

# Build the macOS DMG
dmg:
	npm run tauri build

# Clean build artifacts
clean:
	rm -rf src-tauri/target
