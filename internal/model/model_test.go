package model

import "testing"

func TestValidateReportsMissingField(t *testing.T) {
	c := NewStorageConfig(Imgur)
	c.Name = "imgur"
	if field, ok := c.Validate(); ok || field != "Client ID" {
		t.Fatalf("field = %q, ok = %v", field, ok)
	}
	c.ImgurClientID = "cid"
	if field, ok := c.Validate(); !ok {
		t.Fatalf("still missing %q", field)
	}
}

func TestValidateS3Fields(t *testing.T) {
	c := NewStorageConfig(CloudflareR2)
	c.Name = "r2"
	if field, ok := c.Validate(); ok || field != "Access Key ID" {
		t.Fatalf("field = %q, ok = %v", field, ok)
	}
}
