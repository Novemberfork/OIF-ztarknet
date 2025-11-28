{
  description = "OIF-ztarknet development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            go
            gopls
            nodejs_22
            yarn
            foundry
            solc
            typescript-language-server
            vscode-langservers-extracted  # Includes solidity-ls
            gnumake
          ];


          shellHook = ''
            echo "OIF-ztarknet development environment"
            echo "Go: $(go version | cut -d' ' -f3)"
            echo "Node: $(node --version)"
            echo "Foundry: $(forge --version | head -1)"
            command -v scarb >/dev/null && echo "Scarb: $(scarb --version | head -1)" || echo "Scarb: not installed (install via asdf)"
          '';
        };
      }
    );
}
