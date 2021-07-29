'use strict';

/**
 * Perform maintenance operations when installed or updated.
 */
(function () {

  if (browser.runtime.onInstalled) {
    browser.runtime.onInstalled.addListener(details => {
      switch (details.reason) {
        case 'install':
          onInstalled(details);
          break;
        case 'update':
          onUpdated(details);
          break;
      }
    });
  }

  // Initialize the addon when first installed.
  function onInstalled () {
    console.log('youtube-dl button installed');
    return browser.runtime.getPlatformInfo().then(() => {
      let settings = {
        addon: {
          quickAudioFormat: 'bestaudio',
          concurrentJobsLimit: 1,
          switchSets: '[]'
        },
        props: {
          saveIn: '',
          template: '%(title)s-%(id)s.%(ext)s',
          format: 'bestvideo+bestaudio/best',
          customArgs: ''
        }
      };

      // Set the defaults for global settings.
      return browser.storage.local.set(settings);
    });
  }

  // Update the settings when the addon is updated.
  function onUpdated () {
    // Nothing here yet.
  }

}());
