// This script moves the images after they are downloaded to /bundles/cards/<imagename>.png. This is based on relative path right now. 

package main

import (
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const (
	sourceDir = "assets/cards"
	targetDir = "bundles/cards"
)

// Matches:
// 1. Standard: "01002_Black_Cat.png" -> code "01002", ext ".png"
// 2. B-sides:  "01001a_Spider-Man_b_side.png" -> code "01001b", ext ".png"
var (
	bSideRegex    = regexp.MustCompile(`^([0-9]+)a_.*_b_side(\.[a-zA-Z0-9]+)$`)
	standardRegex = regexp.MustCompile(`^([0-9]+[a-z]?)_.*(\.[a-zA-Z0-9]+)$`)
)

func resolveTargetFilename(originalName string) (string, bool) {
	// Check for generated b-sides first (e.g. 01001a_Spider-Man_b_side.png -> 01001b.png)
	if match := bSideRegex.FindStringSubmatch(originalName); len(match) == 3 {
		return fmt.Sprintf("%sb%s", match[1], match[2]), true
	}

	// Standard pattern (e.g. 01002_Black_Cat.jpg -> 01002.jpg)
	if match := standardRegex.FindStringSubmatch(originalName); len(match) == 3 {
		return fmt.Sprintf("%s%s", match[1], match[2]), true
	}

	return "", false
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err = io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func moveFile(src, dst string) error {
	// Attempt rename first (atomic on same filesystem)
	if err := os.Rename(src, dst); err == nil {
		return nil
	}
	// Fallback to copy + delete across mount boundaries
	if err := copyFile(src, dst); err != nil {
		return err
	}
	return os.Remove(src)
}

func main() {
	copyMode := flag.Bool("copy", false, "Copy files instead of moving them")
	flag.Parse()

	actionName := "Moving"
	if *copyMode {
		actionName = "Copying"
	}

	if _, err := os.Stat(sourceDir); os.IsNotExist(err) {
		fmt.Printf("Source directory '%s' does not exist.\n", sourceDir)
		os.Exit(1)
	}

	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		fmt.Printf("Failed to create destination directory '%s': %v\n", targetDir, err)
		os.Exit(1)
	}

	fmt.Printf("%s images from '%s/' to '%s/'...\n", actionName, sourceDir, targetDir)

	processedCount := 0
	skippedCount := 0

	err := filepath.WalkDir(sourceDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(d.Name()))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" {
			return nil
		}

		destFilename, ok := resolveTargetFilename(d.Name())
		if !ok {
			skippedCount++
			return nil
		}

		destPath := filepath.Join(targetDir, destFilename)

		// Skip if already in place
		if _, err := os.Stat(destPath); err == nil {
			processedCount++
			return nil
		}

		var fileErr error
		if *copyMode {
			fileErr = copyFile(path, destPath)
		} else {
			fileErr = moveFile(path, destPath)
		}

		if fileErr != nil {
			fmt.Printf("Failed processing '%s': %v\n", path, fileErr)
			return nil
		}

		processedCount++
		return nil
	})

	if err != nil {
		fmt.Printf("Error scanning directories: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\nDone! %d images processed into '%s/'. (Skipped unparsed: %d)\n",
		processedCount, targetDir, skippedCount)
}