package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type PinataResponse struct {
	IpfsHash    string `json:"IpfsHash"`
	PinSize     int    `json:"PinSize"`
	Timestamp   string `json:"Timestamp"`
	IsDuplicate bool   `json:"isDuplicate"`
}

func UploadToIPFS(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	// Prepare multipart form for Pinata
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", header.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create form file"})
		return
	}

	if _, err := io.Copy(part, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to copy file"})
		return
	}
	writer.Close()

	// Call Pinata API
	req, err := http.NewRequest("POST", "https://api.pinata.cloud/pinning/pinFileToIPFS", body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request to IPFS provider"})
		return
	}

	pinataJWT := os.Getenv("PINATA_JWT")
	if pinataJWT != "" {
		req.Header.Set("Authorization", "Bearer "+pinataJWT)
	} else {
		// Fallback to API Key/Secret if JWT is not present
		req.Header.Set("pinata_api_key", os.Getenv("PINATA_API_KEY"))
		req.Header.Set("pinata_secret_api_key", os.Getenv("PINATA_SECRET_KEY"))
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "IPFS provider unreachable"})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		c.JSON(resp.StatusCode, gin.H{
			"error":   "IPFS provider returned error",
			"details": string(respBody),
		})
		return
	}

	var pinataResp PinataResponse
	if err := json.Unmarshal(respBody, &pinataResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse IPFS response"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ipfs_hash": pinataResp.IpfsHash,
		"url":       fmt.Sprintf("https://gateway.pinata.cloud/ipfs/%s", pinataResp.IpfsHash),
	})
}
