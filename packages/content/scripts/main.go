// This is a modified go script compared to the ingest-marvecdb.ts - it captures all packs with higher throughput as a go mod.
// This is compiled to a binary in this directory called `./scraper` that can be invoked at any time for fast use.
//
//	go build -o scraper . && ./scraper              # every pack's raw JSON, plus card images
//	./scraper -images=false                          # raw JSON only
//
// Run from packages/content: the raw cache lands in raw/marvelcdb/<pack>.json,
// the same files `ingest-marvelcdb.ts --offline` reads.
package main

import (
	"encoding/json"
	"flag"
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
	maxConcurrency = 16
)

type Pack struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// Card is only the handful of fields the image downloader needs. It is NOT
// what gets saved: re-marshalling this struct is what used to throw away every
// other field MarvelCDB returns (text, cost, stats, traits, quantity, linked
// faces, boost...), leaving raw files that could not be normalized.
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

// RawCache is the envelope `scripts/ingest-marvelcdb.ts` writes and reads back
// with --offline. Cards are kept as json.RawMessage, so every record is saved
// exactly as the API returned it.
type RawCache struct {
	Source    string            `json:"source"`
	FetchedAt string            `json:"fetchedAt"`
	Pack      string            `json:"pack"`
	Cards     []json.RawMessage `json:"cards"`
}

type DownloadJob struct {
	URL      string
	DestPath string
}

var sanitizeRegex = regexp.MustCompile(`[^a-zA-Z0-9_\-]+`)

func sanitize(s string) string {
	s = strings.ReplaceAll(s, " ", "_")
	return sanitizeRegex.ReplaceAllString(s, "")
}

func fetchJSON(client *http.Client, url string, target interface{}) error {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s returned HTTP %d", url, res.StatusCode)
	}

	return json.NewDecoder(res.Body).Decode(target)
}

func downloadFile(client *http.Client, url string, dest string) error {
	if _, err := os.Stat(dest); err == nil {
		return nil // Skip if already downloaded
	}

	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "MarvelCDB-Asset-Ingest/1.0")

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

func buildImagePath(c Card, isBack bool) string {
	var categoryDir string
	set := "General"
	if c.CardSetName != nil && *c.CardSetName != "" {
		set = sanitize(*c.CardSetName)
	}

	switch strings.ToLower(c.TypeName) {
	case "hero", "alter_ego":
		categoryDir = filepath.Join("heroes", set)
	case "villain", "main_scheme", "side_scheme", "minion", "attachment", "treachery", "environment", "obligation":
		categoryDir = filepath.Join("encounters", set)
	default:
		// Aspect or Basic player cards
		faction := sanitize(c.FactionName)
		if faction == "" {
			faction = "Neutral"
		}
		categoryDir = filepath.Join("aspects", faction)
	}

	suffix := ""
	if isBack {
		suffix = "_back"
	}

	fileName := fmt.Sprintf("%s_%s%s.png", c.Code, sanitize(c.Name), suffix)
	return filepath.Join(imagesBaseDir, c.PackCode, categoryDir, fileName)
}

func worker(id int, client *http.Client, jobs <-chan DownloadJob, wg *sync.WaitGroup) {
	defer wg.Done()
	for job := range jobs {
		if err := downloadFile(client, job.URL, job.DestPath); err != nil {
			fmt.Printf("[Worker %d] Failed downloading %s: %v\n", id, job.URL, err)
		}
	}
}

func main() {
	downloadImages := flag.Bool("images", true, "download card images into "+imagesBaseDir)
	flag.Parse()

	client := &http.Client{Timeout: 30 * time.Second}

	fmt.Println("Fetching pack index from MarvelCDB...")
	var packs []Pack
	if err := fetchJSON(client, baseURL+"/api/public/packs/", &packs); err != nil {
		fmt.Printf("Failed to fetch packs: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Found %d packs. Processing cards and images...\n", len(packs))

	if err := os.MkdirAll(rawCacheDir, 0o755); err != nil {
		fmt.Printf("Cannot create %s: %v\n", rawCacheDir, err)
		os.Exit(1)
	}

	// Launch download worker pool
	jobs := make(chan DownloadJob, 500)
	var wg sync.WaitGroup
	for w := 1; w <= maxConcurrency; w++ {
		wg.Add(1)
		go worker(w, client, jobs, &wg)
	}

	totalCards := 0
	totalImagesQueued := 0
	failedPacks := 0
	fetchedAt := time.Now().UTC().Format("2006-01-02")

	for _, pack := range packs {
		url := fmt.Sprintf("%s/api/public/cards/%s", baseURL, pack.Code)
		var rawCards []json.RawMessage

		if err := fetchJSON(client, url, &rawCards); err != nil {
			fmt.Printf("Failed to fetch pack %s: %v\n", pack.Code, err)
			failedPacks++
			continue
		}

		// Save raw pack JSON verbatim, in the envelope the TypeScript ingest reads.
		cache := RawCache{Source: url, FetchedAt: fetchedAt, Pack: pack.Code, Cards: rawCards}
		rawBytes, err := json.MarshalIndent(cache, "", "  ")
		if err != nil {
			fmt.Printf("Failed to encode pack %s: %v\n", pack.Code, err)
			failedPacks++
			continue
		}
		packCachePath := filepath.Join(rawCacheDir, fmt.Sprintf("%s.json", pack.Code))
		if err := os.WriteFile(packCachePath, append(rawBytes, '\n'), 0o644); err != nil {
			fmt.Printf("Failed to write %s: %v\n", packCachePath, err)
			failedPacks++
			continue
		}

		if *downloadImages {
			for _, raw := range rawCards {
				var card Card
				if err := json.Unmarshal(raw, &card); err != nil {
					fmt.Printf("Skipping images for an unreadable card in %s: %v\n", pack.Code, err)
					continue
				}
				if card.ImageSrc != nil && *card.ImageSrc != "" {
					jobs <- DownloadJob{
						URL:      baseURL + *card.ImageSrc,
						DestPath: buildImagePath(card, false),
					}
					totalImagesQueued++
				}
				if card.BackImageSrc != nil && *card.BackImageSrc != "" {
					jobs <- DownloadJob{
						URL:      baseURL + *card.BackImageSrc,
						DestPath: buildImagePath(card, true),
					}
					totalImagesQueued++
				}
			}
		}

		totalCards += len(rawCards)
		fmt.Printf("✔ Cached %-18s (%3d cards)\n", pack.Code, len(rawCards))
	}

	close(jobs)
	wg.Wait()

	fmt.Printf("\nDone! Processed %d packs (%d failed), %d cards, and queued %d images into %s/\n",
		len(packs), failedPacks, totalCards, totalImagesQueued, imagesBaseDir)
	if failedPacks > 0 {
		os.Exit(1)
	}
}
