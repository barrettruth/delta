{
  description = "delta - personal todo/productivity platform";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs, ... }:
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
            (python3.withPackages (ps: [
              ps.pyyaml
            ]))
            curl
            just
          ];
          ciPackages = commonPackages ++ [ pkgs.tea ];
        in
        {
          default = pkgs.mkShell { packages = commonPackages; };
          ci = pkgs.mkShell { packages = ciPackages; };
        }
      );

      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        rec {
          cli = pkgs.stdenvNoCC.mkDerivation (finalAttrs: {
            pname = "delta-cli";
            version = (builtins.fromJSON (builtins.readFile ./cli/package.json)).version;

            src = pkgs.lib.fileset.toSource {
              root = ./.;
              fileset = pkgs.lib.fileset.unions [
                ./package.json
                ./pnpm-lock.yaml
                ./pnpm-workspace.yaml
                ./cli/package.json
                ./cli/src
                ./cli/man
              ];
            };

            nativeBuildInputs = with pkgs; [
              bun
              installShellFiles
              makeWrapper
              nodejs_22
              pnpm_10
              pnpmConfigHook
            ];

            pnpmWorkspaces = [ "@barrettruth/delta" ];
            pnpmInstallFlags = [ "--prod" ];

            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs)
                pname
                version
                src
                pnpmWorkspaces
                ;
              inherit (finalAttrs) pnpmInstallFlags;
              pnpm = pkgs.pnpm_10;
              fetcherVersion = 3;
              hash = "sha256-TWgNrsXI/rQEoqfLi9g4cneVcPJa6AWo13LrtS1begU=";
            };

            buildPhase = ''
              runHook preBuild

              mkdir -p cli/dist
              bun build cli/src/index.ts --outfile cli/dist/delta.js --target node
              node -e "const fs=require('fs');const f='cli/dist/delta.js';fs.writeFileSync(f,'#!/usr/bin/env node\n'+fs.readFileSync(f));fs.chmodSync(f,0o755)"
              node cli/dist/delta.js completion bash > delta.bash
              node cli/dist/delta.js completion fish > delta.fish
              node cli/dist/delta.js completion zsh > delta.zsh

              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              install -Dm644 cli/dist/delta.js $out/libexec/delta/delta.js
              install -Dm644 cli/man/delta.1 $out/share/man/man1/delta.1

              makeWrapper ${pkgs.lib.getExe pkgs.nodejs_22} $out/bin/delta \
                --add-flags $out/libexec/delta/delta.js

              installShellCompletion \
                --cmd delta \
                --bash delta.bash \
                --fish delta.fish \
                --zsh delta.zsh

              runHook postInstall
            '';

            doInstallCheck = true;
            installCheckPhase = ''
              runHook preInstallCheck

              $out/bin/delta --version | grep -Fx ${finalAttrs.version}
              test "$(wc -c < "$out/libexec/delta/delta.js")" -lt 1000000

              runHook postInstallCheck
            '';

            meta = {
              description = "CLI client for the delta productivity platform";
              homepage = "https://git.barrettruth.com/barrettruth/delta";
              license = pkgs.lib.licenses.mit;
              mainProgram = "delta";
              platforms = pkgs.lib.platforms.unix;
            };
          });

          default = cli;
        }
      );

      apps = forAllSystems (system: {
        cli = {
          type = "app";
          program = "${self.packages.${system}.cli}/bin/delta";
        };
        default = self.apps.${system}.cli;
      });
    };
}
