package store

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// MigrationResult describes a first-run migration from the Tauri app.
type MigrationResult struct {
	Migrated bool
	Files    []string
}

// LegacyTauriDir returns the data directory the old Tauri app used.
func LegacyTauriDir() string {
	const id = "com.gusi.moli-tutu"
	switch runtime.GOOS {
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		return filepath.Join(home, "Library", "Application Support", id)
	case "windows":
		dir, err := os.UserConfigDir()
		if err != nil {
			return ""
		}
		return filepath.Join(dir, id)
	default:
		if dir := os.Getenv("XDG_DATA_HOME"); dir != "" {
			return filepath.Join(dir, id)
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		return filepath.Join(home, ".local", "share", id)
	}
}

// Migrate copies the old app's config, settings and uploads database into
// newDir. It never deletes or overwrites existing data, and is idempotent.
func Migrate(oldDir, newDir string) (MigrationResult, error) {
	result := MigrationResult{}
	if oldDir == "" || newDir == "" || oldDir == newDir {
		return result, nil
	}
	marker := filepath.Join(newDir, ".migrated-from-tauri")
	if _, err := os.Stat(marker); err == nil {
		return result, nil
	}
	if _, err := os.Stat(oldDir); errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err := os.MkdirAll(newDir, 0o755); err != nil {
		return result, err
	}
	for _, name := range []string{"config.json", "settings.json", "uploads.db", "uploads.db-wal", "uploads.db-shm"} {
		src := filepath.Join(oldDir, name)
		dst := filepath.Join(newDir, name)
		if _, err := os.Stat(src); errors.Is(err, os.ErrNotExist) {
			continue
		}
		if _, err := os.Stat(dst); err == nil {
			continue
		}
		if err := copyFile(src, dst); err != nil {
			return result, err
		}
		result.Files = append(result.Files, name)
	}
	if len(result.Files) > 0 {
		result.Migrated = true
		_ = os.WriteFile(marker, []byte(time.Now().Format(time.RFC3339)+"\n"), 0o600)
	}
	return result, nil
}

func copyFile(src, dst string) error {
	b, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return writeFileAtomic(dst, b, 0o600)
}
