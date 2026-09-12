// This uses the raw/marvelcdb/<pack>.json to fetch the imagesrc values as well as fetch the opposite hero and alter-ego images.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	baseURL        = "https://marvelcdb.com"
	rawCacheDir    = "raw/marvelcdb"
	imagesBaseDir  = "assets/cards"
	maxConcurrency = 12
)

type Card struct {
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	PackCode     string  `json:"pack_code"`
	TypeName     string  `json:"type_name"`
	FactionName  string  `json:"faction_name"`
	CardSetName  *string `json:"card_set_name"`
	CardSetCode  *string `json:"card_set_code"`
	ImageSrc     *string `json:"imagesrc"`
	BackImageSrc *string `json:"backimagesrc"`
}

type DownloadJob struct {
	URL      string
	DestPath string
}

var sanitizeRegex = regexp.MustCompile(`[^a-zA-Z0-9_\-]+`)

func sanitize(s string) string {
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "&", "and")
	return sanitizeRegex.ReplaceAllString(s, "")
}

func buildImagePath(c Card, imageURL string, sideLabel string) string {
	var categoryDir string
	set := "General"
	if c.CardSetName != nil && *c.CardSetName != "" {
		set = sanitize(*c.CardSetName)
	}

	lowerFaction := strings.ToLower(c.FactionName)
	lowerType := strings.ToLower(c.TypeName)

	if lowerFaction == "hero" || lowerType == "hero" || lowerType == "alter_ego" {
		categoryDir = filepath.Join("heroes", set)
	} else if lowerFaction == "encounter" || lowerFaction == "campaign" ||
		lowerType == "villain" || lowerType == "main_scheme" || lowerType == "side_scheme" ||
		lowerType == "minion" || lowerType == "attachment" || lowerType == "treachery" ||
		lowerType == "environment" || lowerType == "obligation" {
		categoryDir = filepath.Join("encounters", set)
	} else {
		faction := sanitize(c.FactionName)
		if faction == "" {
			faction = "Basic"
		}
		categoryDir = filepath.Join("player", faction)
	}

	ext := filepath.Ext(imageURL)
	if ext == "" {
		ext = ".png"
	}

	suffix := ""
	if sideLabel != "" {
		suffix = "_" + sideLabel
	}

	fileName := fmt.Sprintf("%s_%s%s%s", c.Code, sanitize(c.Name), suffix, ext)
	return filepath.Join(imagesBaseDir, c.PackCode, categoryDir, fileName)
}

func downloadFile(client *http.Client, url string, dest string) error {
	if _, err := os.Stat(dest); err == nil {
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "MarvelCDB-Image-Downloader/1.0")

	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d for %s", res.StatusCode, url)
	}

	tmpFile := dest + ".tmp"
	out, err := os.Create(tmpFile)
	if err != nil {
		return err
	}

	if _, err = io.Copy(out, res.Body); err != nil {
		out.Close()
		os.Remove(tmpFile)
		return err
	}
	out.Close()

	return os.Rename(tmpFile, dest)
}

func worker(id int, client *http.Client, jobs <-chan DownloadJob, wg *sync.WaitGroup) {
	defer wg.Done()
	for job := range jobs {
		if err := downloadFile(client, job.URL, job.DestPath); err != nil {
			// Expected for scheme cards or rare variants where MarvelCDB lacks an asset
			fmt.Printf("[Worker %d] Notice: could not fetch %s (%v)\n", id, job.URL, err)
		}
	}
}

func main() {
	files, err := filepath.Glob(filepath.Join(rawCacheDir, "*.json"))
	if err != nil {
		fmt.Printf("Error searching %s: %v\n", rawCacheDir, err)
		os.Exit(1)
	}

	if len(files) == 0 {
		fmt.Printf("No JSON files found in '%s'. Run ingestion first.\n", rawCacheDir)
		os.Exit(1)
	}

	client := &http.Client{Timeout: 45 * time.Second}
	jobs := make(chan DownloadJob, 1500)
	var wg sync.WaitGroup

	for w := 1; w <= maxConcurrency; w++ {
		wg.Add(1)
		go worker(w, client, jobs, &wg)
	}

	queuedImages := 0
	totalParsedCards := 0

	for _, filePath := range files {
		data, err := os.ReadFile(filePath)
		if err != nil {
			fmt.Printf("Failed reading %s: %v\n", filePath, err)
			continue
		}

		var cards []Card
		if err := json.Unmarshal(data, &cards); err != nil {
			fmt.Printf("Failed parsing JSON in %s: %v\n", filePath, err)
			continue
		}

		totalParsedCards += len(cards)

		for _, c := range cards {
			// Front Face
			if c.ImageSrc != nil && *c.ImageSrc != "" {
				jobs <- DownloadJob{
					URL:      baseURL + *c.ImageSrc,
					DestPath: buildImagePath(c, *c.ImageSrc, ""),
				}
				queuedImages++

				// If the card ends with 'a' (01001a, 56001a, 40001a, etc.), infer the 'b' face
				if strings.HasSuffix(c.Code, "a") {
					bURL := strings.TrimSuffix(*c.ImageSrc, "a"+filepath.Ext(*c.ImageSrc)) + "b" + filepath.Ext(*c.ImageSrc)
					jobs <- DownloadJob{
						URL:      baseURL + bURL,
						DestPath: buildImagePath(c, bURL, "b_side"),
					}
					queuedImages++
				}
			}

			// Explicit Back Face (e.g. Schemes with non-standard back identifiers)
			if c.BackImageSrc != nil && *c.BackImageSrc != "" {
				jobs <- DownloadJob{
					URL:      baseURL + *c.BackImageSrc,
					DestPath: buildImagePath(c, *c.BackImageSrc, "back"),
				}
				queuedImages++
			}
		}
	}

	close(jobs)
	wg.Wait()

	fmt.Printf("\nCompleted! Parsed %d cards across %d pack files.\nQueued %d total card face images into '%s/'.\n",
		totalParsedCards, len(files), queuedImages, imagesBaseDir)
}