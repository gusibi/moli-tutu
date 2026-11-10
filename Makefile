.PHONY: test vet dev build build-macos clean

GO_ENV = GOTOOLCHAIN=auto GOSUMDB=sum.golang.org

test:
	$(GO_ENV) go test ./...

vet:
	$(GO_ENV) go vet ./...

dev:
	$(GO_ENV) go tool mygo dev

build:
	$(GO_ENV) go tool mygo build

build-macos:
	$(GO_ENV) go tool mygo build -platform darwin/arm64 -skip-dmg -skip-notarize -sign -

clean:
	rm -rf dist build .mygo
