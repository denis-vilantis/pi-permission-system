{
  description = "Fork of @gotgenes/pi-permission-system with the shellTools language predicate and batch command support";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    self,
    nixpkgs,
    bun2nix,
  }: let
    systems = [
      "x86_64-linux"
      "aarch64-linux"
      "x86_64-darwin"
      "aarch64-darwin"
    ];
    forAllSystems = f:
      nixpkgs.lib.genAttrs systems (system:
        f (import nixpkgs {
          inherit system;
          overlays = [bun2nix.overlays.default];
        }));
  in {
    packages = forAllSystems (pkgs: rec {
      default = pi-permission-system;
      pi-permission-system = pkgs.callPackage ./package.nix {};
    });

    devShells = forAllSystems (pkgs: {
      default = pkgs.mkShell {
        packages = [pkgs.bun pkgs.bun2nix];
      };
    });
  };
}
