# Youtube-DL Button

Add a browser action that sends the tab or a URL to youtube-dl.

## Description

This addon is a simple GUI frontend to youtube-dl, available in the browser. A companion application is required to
manage communication between the browser and youtube-dl. See the [User Guide](https://github.com/marklieberman/youtube-dl-button/wiki/User-Guide) for an overview of the interface and features.

### Notable Features

* Queue system lets you download multiple videos in the background.
* View youtube-dl's console output in your browser.
* Optionally pass your browser's cookies to youtube-dl when downloading files from youtube.com.
* Update youtube-dl to latest version with a single click.

<img src="https://raw.githubusercontent.com/wiki/marklieberman/youtube-dl-button/images/popup-readme-2.png" height="400"/>

## Build

### Web-Ext

The web-ext can be built using `npm run dist` which will produce a zip in dist/. You must [sign the addon on AMO](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/Distribution) before it can be installed in Firefox. Alternatively, a signed .xpi is available under Releases.

### Native App

The native-app is a C# application for Windows. It can be built using Visual Studio and will produce YoutubeDlButton.exe, which is required to communicate between the web-ext in Firefox and youtube-dl.exe. Pre-built files are available in Releases.

## Install

Instructions for installing the native app and youtube-dl.exe are [in the Wiki](https://github.com/marklieberman/youtube-dl-button/wiki/Installing-the-Native-App).

## Contributing

This project could use 1) a cross-platform native-app to add support for Linux and MacOS, and 2) an installer to create manifest and registry entries automatically. Any contributions would be appreciated and I would publish the addon on AMO once these features are available.
