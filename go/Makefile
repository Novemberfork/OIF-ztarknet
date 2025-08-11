.PHONY: help build run test clean deps lint

# Default target
help:
	@echo "Available targets:"
	@echo "  deps     - Install dependencies"
	@echo "  build    - Build the solver binary"
	@echo "  run      - Run the solver"
	@echo "  test     - Run tests"
	@echo "  clean    - Clean build artifacts"
	@echo "  lint     - Run linter"

# Install dependencies
deps:
	go mod tidy
	go mod download

# Build the solver
build:
	go build -o bin/solver ./cmd/solver

# Run the solver
run: build
	./bin/solver

# Run tests
test:
	go test ./...

# Clean build artifacts
clean:
	rm -rf bin/
	go clean

# Run linter
lint:
	golangci-lint run

# Install development tools
dev-deps:
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/go-delve/delve/cmd/dlv@latest

# Run with hot reload (requires air)
dev:
	air

# Generate mocks (if using mockery)
mocks:
	mockery --all --keeptree --output=./internal/mocks
