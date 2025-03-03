# paranext-core/extensions

Official extensions provided by Paranext

## Summary

This is a webpack project configured to build Paranext's official extensions included in the product. The general file structure is as follows:

- `src/` contains the source code for all extensions
  - Each sub-folder in `src/` with a `manifest.json` in it is an extension
    - `package.json` contains information about this extension's npm package. It is required for Platform.Bible to use the extension properly. It is copied into the build folder
    - `manifest.json` is the manifest file that defines the extension and important properties for Platform.Bible. It is copied into the build folder
    - `src/` contains the source code for the extension
      - `src/main.ts` is the main entry file for the extension
      - `src/types/<extension_name>.d.ts` is this extension's types file that defines how other extensions can use this extension through the `papi`
      - `*.web-view.tsx` files will be treated as React WebViews
      - `*.web-view.html` files are a conventional way to provide HTML WebViews (no special functionality)
    - `assets/` contains asset files the extension and its WebViews can retrieve using the `papi-extension:` protocol. It is copied into the build folder
    - `public/` contains other static files that are copied into the build folder
- `dist/` is a generated folder containing the built extension files
- `release/` is a generated folder containing zips of the built extension files

## To install

### Install dependencies:

1. Follow the instructions to install [`paranext-core`](https://github.com/paranext/paranext-core#developer-install).
2. In `paranext-core/extensions`, run `npm install` to install local and published dependencies

Note: running `npm install` automatically adds remotes that help with [updating from the templates](#to-update-this-repo-and-extensions-from-the-templates).

<details>
    <summary>[Optional] Adding remotes manually</summary>

#### Adding remotes manually

To add these remotes manually, run the following commands:

```bash
git remote add paranext-multi-extension-template https://github.com/paranext/paranext-multi-extension-template

git remote add paranext-extension-template https://github.com/paranext/paranext-extension-template
```

</details>

## To run

### Running Platform.Bible with these extensions

To run Platform.Bible with these extensions (these extensions are automatically included when running `paranext-core`):

`npm start`

Note: The built extensions will be the `dist` folder. These extension files will be watched automatically for changes if you run `npm start` in `paranext-core` or `npm start` from this folder. There is no need to run `npm start` in both directories.

### Building these extensions independently

To watch extension files (in `src`) for changes:

`npm run watch`

To build the extensions once:

`npm run build`

## To package for distribution

To package these extensions into a zip file for distribution:

`npm run package`

## To create a new extension in this repo

To create a new extension in this repo, make sure your repo has no working changes, then run the following command (replace `<extension_name>` with the preferred extension name. This will also be the extension's folder name in the `src` folder):

```bash
npm run create-extension -- <extension_name>
```

Then follow [the instructions for customizing the new extension](https://github.com/paranext/paranext-extension-template#customize-extension-details).

**Note:** The merge/squash commits created when creating a new extension are important; Git uses them to compare the files for future updates. If you edit this repo's Git history, please preserve these commits (do not squash them, for example) to avoid duplicated merge conflicts in the future.

<details>
    <summary>[Optional] Creating a new extension manually</summary>

#### Manually create a new extension

Alternatively, you can create a new extension manually:

```bash
git fetch paranext-extension-template main

git subtree add --prefix extensions/src/<extension_name> paranext-extension-template main --squash
```

</details>

## To update this folder and extensions from the templates

This folder is forked from [`paranext-multi-extension-template`](https://github.com/paranext/paranext-multi-extension-template), and its extensions are derived from [`paranext-extension-template`](https://github.com/paranext/paranext-extension-template). Both are updated periodically and will sometimes receive updates that help with breaking changes on [`paranext-core`](https://github.com/paranext/paranext-core). We recommend you periodically update this folder and extensions by merging the latest template updates into them.

To update this folder including all extensions to have the latest updates and upgrades from the templates, make sure this repo has no working changes, then run the following `npm` script:

```bash
npm run update-from-templates
```

If you encounter errors from merge conflicts, please resolve the merge conflicts, finish the commit, and run the script above again.

**Note:** The merge/squash commits created when updating this repo and its extensions from the templates are important; Git uses them to compare the files for future updates. If you edit this repo's Git history, please preserve these commits (do not squash them, for example) to avoid duplicated merge conflicts in the future.

<details>
    <summary>[Optional] Update from the templates manually</summary>

### Update from the templates manually

Alternatively, you can update from the templates manually.

#### Manually update this repo from `paranext-multi-extension-template`

```bash
git fetch paranext-multi-extension-template main

git subtree pull --prefix extensions paranext-multi-extension-template main --squash
```

#### Manually update extensions from `paranext-extension-template`

```bash
git fetch paranext-extension-template main
```

For each extension, run the following (replace `<extension_name>` with each extension's folder name):

```bash
git subtree pull --prefix src/<extension_name> paranext-extension-template main --squash
```

</details>

## Special features in this project

This project has special features and specific configuration to make building extensions for Platform.Bible easier. In the following expandable section are a few important notes:

<details>
    <summary>Expand to read about special features in this project</summary>

### React WebView files - `.web-view.tsx`

Platform.Bible WebViews must be treated differently than other code, so this project makes doing that simpler:

- WebView code must be bundled and can only import specific packages provided by Platform.Bible (see `externals` in `webpack.config.base.ts`), so this project bundles React WebViews before bundling the main extension file to support this requirement. The project discovers and bundles files that end with `.web-view.tsx` in this way.
  - Note: while watching for changes, if you add a new `.web-view.tsx` file, you must either restart webpack or make a nominal change and save in an existing `.web-view.tsx` file for webpack to discover and bundle this new file.
- WebView code and styles must be provided to the `papi` as strings, so you can import WebView files with [`?inline`](#special-imports) after the file path to import the file as a string.

### Special imports

- Adding `?inline` to the end of a file import causes that file to be imported as a string after being transformed by webpack loaders but before bundling dependencies (except if that file is a React WebView file, in which case dependencies will be bundled). The contents of the file will be on the file's default export.
  - Ex: `import myFile from './file-path?inline`
- Adding `?raw` to the end of a file import treats a file the same way as `?inline` except that it will be imported directly without being transformed by webpack.

### Misc features

- Platform.Bible extensions' code must be bundled all together in one file, so webpack bundles all the code together into one main file per extension.
- Platform.Bible extensions can interact with other extensions, but they cannot import and export like in a normal Node environment. Instead, they interact through the `papi`. As such, each extension's `src/types` folder contains its declarations file that tells other extensions how to interact with it through the `papi`.

### Two-step webpack build

These extensions are built by webpack (`webpack.config.ts`) in two steps: a WebView bundling step and a main bundling step:

#### Build 1: TypeScript WebView bundling

Webpack (`./webpack/webpack.config.web-view.ts`) prepares TypeScript WebViews for use and outputs them into temporary build folders adjacent to the WebView files:

- Formats WebViews to match how they should look to work in Platform.Bible
- Transpiles React/TypeScript WebViews into JavaScript
- Bundles dependencies into the WebViews
- Embeds Sourcemaps into the WebViews inline

#### Build 2: Main and final bundling

Webpack (`./webpack/webpack.config.main.ts`) prepares the main extension files and bundles each extension together into the `dist` folder:

- Transpiles the main TypeScript file and its imported modules into JavaScript
- Injects the bundled WebViews into the main file
- Bundles dependencies into the main file
- Embeds Sourcemaps into the file inline
- Packages everything up into an extension folder `dist`

</details>
