'use strict';

/**
 * Perform maintenance operations when installed or updated.
 */
(function () {

  const initialSettings = {
    defaultFormat: 'bv+ba/best',
    defaultTemplate: '%(title)s-%(id)s.%(ext)s',
    audioFormat: 'ba'
  };

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
  function onInstalled (details) {
    console.log('youtube-dl button installed', details);
    return browser.storage.local.set({
      exePath: '',
      concurrentJobsLimit: 1,
      sendCookiesYoutube: false,
      props: [{
        name: 'Default',
        icon: null,
        saveIn: '',
        format: initialSettings.defaultFormat,
        template: initialSettings.defaultTemplate,
        customArgs: '',
        inheritDefault: false
      },{
        name: 'Audio',
        icon: null,
        format: initialSettings.audioFormat,
        inheritDefault: true
      }]
    });
  }

  // Update the settings when the addon is updated.
  function onUpdated (details) {
    let versionParts = details.previousVersion
      .split('.')
      .map(n => Number(n));

    console.log('youtube-dl button updated', details, versionParts);
    
    // Upgrade from 1.1.2 or lower.
    if ((versionParts[0] === 1) && (versionParts[1] === 1) && (versionParts[2] <= 2)) {
      return browser.storage.local.get({
        addon: null,
        props: null
      }).then(results => {
        let quickAudioFormat = initialSettings.audioFormat,
            switchSets = [];
        if (results.addon) {
          quickAudioFormat = results.addon.quickAudioFormat || quickAudioFormat;
          results.concurrentJobsLimit = results.addon.concurrentJobsLimit || 1;
          results.sendCookiesYoutube = results.addon.sendCookiesYoutube || false;
          if (results.addon.switchSets) {
            switchSets = JSON.parse(results.addon.switchSets).map(switchSet => ({
              name: switchSet.name,
              saveIn: switchSet.saveIn,
              format: switchSet.format,
              icon: switchSet.iconUrl || null
            }));
          }
        }
        if (results.props && !Array.isArray(results.props)) {
          results.exePath = results.props.exePath || '';
          results.props = [{
            name: 'Default',
            icon: null,
            saveIn: results.props.saveIn || '',
            format: results.props.format || initialSettings.defaultFormat,
            template: results.props.template || initialSettings.defaultTemplate,
            customArgs: results.props.customArgs || '',
            inheritDefault: false
          },{
            name: 'Audio',
            icon: null,
            format: quickAudioFormat,
            inheritDefault: true
          }].concat(switchSets);          
        }

        // Upgrade settings.
        console.log('new settings are', results);
        return browser.storage.local.set(results)
          .then(() => browser.storage.local.remove('addon'));
      });
    }

  }

}());
