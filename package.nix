{
  lib,
  stdenv,
  bun2nix,
}:

stdenv.mkDerivation {
  pname = "pi-permission-system";
  version = "32.0.4";

  # The flake source, minus local build byproducts. `node_modules` is rebuilt
  # from `bun.lock` through the bun2nix dependency cache.
  src = lib.cleanSourceWith {
    src = ./.;
    filter = path: _type: let
      base = baseNameOf path;
    in
      !(builtins.elem base ["node_modules" ".git" "result"] || lib.hasPrefix "result-" base);
  };

  nativeBuildInputs = [bun2nix.hook];

  bunDeps = bun2nix.fetchBunDeps {
    bunNix = ./bun.nix;
  };

  # Runtime deps only: pi supplies `@earendil-works/*` through its extension
  # loader aliases, and nothing is compiled. pi loads the entry declared in
  # `package.json`'s `pi.extensions` (`src/index.ts`) with its own runtime, and
  # the bash parser resolves its wasm files from node_modules.
  bunInstallFlags = ["--linker=hoisted" "--production" "--frozen-lockfile"];
  dontRunLifecycleScripts = true;

  # The bun2nix hook still installs node_modules in `bunNodeModulesInstallPhase`
  # (a preBuild phase); only the default `bun build` phase is skipped.
  dontBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out
    cp -r package.json src config schemas README.md LICENSE $out/
    cp -r node_modules $out/node_modules
    runHook postInstall
  '';

  meta = {
    description = "Fork of @gotgenes/pi-permission-system: shellTools language predicate and batch command arrays";
    homepage = "https://github.com/denis-vilantis/pi-permission-system";
    license = lib.licenses.mit;
    platforms = lib.platforms.all;
  };
}
