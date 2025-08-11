# Quick Start Guide - Go Hyperlane7683 Solver

## 🚀 Getting Started

### Prerequisites
- Go 1.21 or later
- Git
- Basic understanding of Go and blockchain concepts

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/NethermindEth/oif-starknet.git
   cd oif-starknet/go
   ```

2. **Install dependencies**
   ```bash
   go mod tidy
   ```

3. **Build the project**
   ```bash
   make build
   # or manually:
   go build -o bin/solver ./cmd/solver
   ```

4. **Run tests**
   ```bash
   make test
   # or manually:
   go test ./...
   ```

## ⚙️ Configuration

### 1. Environment Variables
Create a `.env` file in the go/ directory:
```bash
# Required: Your private key or mnemonic
PRIVATE_KEY=your_private_key_here
# or
MNEMONIC=your_mnemonic_here

# Optional: Logging configuration
LOG_LEVEL=info
LOG_FORMAT=text

# Optional: Override RPC URLs
RPC_URL_ETHEREUM=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
RPC_URL_OPTIMISM=https://mainnet.optimism.io
```

### 2. Configuration File
The solver uses `config.yaml` for default settings. You can override these with environment variables.

## 🏃‍♂️ Running the Solver

### Basic Run
```bash
./bin/solver
```

### Development Mode
```bash
make run
```

### With Custom Config
```bash
LOG_LEVEL=debug ./bin/solver
```

## 🏗️ Project Structure

```
go/
├── cmd/solver/          # Main application entry point
├── internal/            # Private application code
│   ├── config/         # Configuration management
│   ├── listener/       # Event listening interfaces
│   ├── filler/         # Intent processing interfaces
│   ├── rules/          # Rule engine (to be implemented)
│   ├── types/          # Type definitions
│   └── solver_manager.go # Solver orchestration
├── pkg/                # Public libraries (future)
├── contracts/          # Contract bindings (future)
├── config.yaml         # Default configuration
├── go.mod              # Go module file
├── Makefile            # Build and development tasks
└── README.md           # Project documentation
```

## 🔧 Development

### Adding New Rules
1. Create a new rule function in `internal/rules/`
2. Implement the `Rule` interface
3. Add the rule to your filler implementation

### Adding New Solvers
1. Implement `BaseListener` interface
2. Implement `BaseFiller` interface
3. Add solver creation logic to `SolverManager`

### Testing
```bash
# Run all tests
go test ./...

# Run specific package tests
go test ./internal/types

# Run with verbose output
go test -v ./...

# Run with coverage
go test -cover ./...
```

## 📊 Current Status

### ✅ What's Working
- Basic project structure and build system
- Type definitions and interfaces
- Configuration management
- Solver manager architecture
- Basic testing framework

### 🚧 What's Next
- EVM contract integration
- Hyperlane7683 specific implementation
- Rule engine implementation
- Database integration
- Cairo/Starknet support

## 🐛 Troubleshooting

### Common Issues

1. **Build fails with import errors**
   ```bash
   go mod tidy
   go mod download
   ```

2. **Configuration not loading**
   - Check `config.yaml` exists
   - Verify environment variables are set
   - Check file permissions

3. **Tests failing**
   ```bash
   go clean -testcache
   go test ./...
   ```

### Getting Help
- Check the `IMPLEMENTATION_STATUS.md` for current progress
- Review the TypeScript implementation for reference
- Open an issue for bugs or feature requests

## 🎯 Next Steps

1. **Understand the TypeScript implementation** - It's the reference for this Go version
2. **Review the interfaces** - `BaseListener` and `BaseFiller` define the contract
3. **Start with EVM integration** - Begin with the most familiar blockchain type
4. **Implement one rule at a time** - Build the rule engine incrementally
5. **Add tests for each component** - Ensure reliability as you build

## 📚 Learning Resources

- **Go Documentation**: https://golang.org/doc/
- **Ethereum Go**: https://github.com/ethereum/go-ethereum
- **Hyperlane Documentation**: https://docs.hyperlane.xyz/
- **Go Testing**: https://golang.org/pkg/testing/
- **Viper Configuration**: https://github.com/spf13/viper
