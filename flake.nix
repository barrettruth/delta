{
  description = "delta - personal todo/productivity platform";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          commonPackages = with pkgs; [
            nodejs_22
            pnpm
            sqlite
            biome
            bun
            curl
            just
          ];
        in
        {
          default = pkgs.mkShell { packages = commonPackages; };
          ci = pkgs.mkShell { packages = commonPackages; };
        }
      );

      # TODO: Add packages.${system}.cli once bun is in nixpkgs or via an overlay.
      # The CLI package should:
      #   - Use bun build --compile to produce a standalone binary
      #   - Install the binary to $out/bin/delta
      #   - Install man/delta.1 to $out/share/man/man1/delta.1
      #   - Be accessible as: nix run .#cli / nix build .#cli
      #
      # Skeleton (requires bun + fixed-output derivation for node_modules):
      #
      #   packages = forAllSystems (system:
      #     let pkgs = nixpkgs.legacyPackages.${system}; in {
      #       cli = pkgs.stdenv.mkDerivation {
      #         pname = "delta-cli";
      #         version = "0.1.0";
      #         src = ./cli;
      #         nativeBuildInputs = [ bun ];
      #         buildPhase = ''
      #           bun install --frozen-lockfile
      #           bun build src/index.ts --compile --outfile delta
      #         '';
      #         installPhase = ''
      #           mkdir -p $out/bin $out/share/man/man1
      #           cp delta $out/bin/delta
      #           cp man/delta.1 $out/share/man/man1/delta.1
      #         '';
      #       };
      #     }
      #   );
    };
}
