'use strict';

/**
 * Perform maintenance operations when installed or updated.
 */
(function () {

  const initialSettings = {
    concurrentJobsLimit: 1,
    sendCookiesYoutube: false,
    props: [{
      name: 'Default',
      icon: null,
      saveIn: '',
      format: 'bv+ba/best',
      template: '%(title)s-%(id)s.%(ext)s',
      customArgs: '',
      inheritDefault: false
    },{
      name: 'Audio',
      icon: null,
      format: 'ba',
      inheritDefault: true
    }]
  };

  async function resetToDefaults () {
    return await browser.storage.local.set({
      exePath: '',
      concurrentJobsLimit: initialSettings.concurrentJobsLimit,
      sendCookiesYoutube: initialSettings.sendCookiesYoutube,
      props: initialSettings.props
    });
  }

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
    resetToDefaults();    
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
        let quickAudioFormat = initialSettings.props[1].format,
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
        } else {
          results.exePath = '';
          results.concurrentJobsLimit = initialSettings.concurrentJobsLimitl;
          results.sendCookiesYoutube = initialSettings.sendCookiesYoutube;
        }

        if (results.props && !Array.isArray(results.props)) {
          results.exePath = results.props.exePath || '';
          results.props = [{
            name: 'Default',
            icon: null,
            saveIn: results.props.saveIn || '',
            format: results.props.format || initialSettings.props[0].format,
            template: results.props.template || initialSettings.props[0].template,
            customArgs: results.props.customArgs || '',
            inheritDefault: false
          },{
            name: 'Audio',
            icon: null,
            format: quickAudioFormat,
            inheritDefault: true
          }].concat(switchSets);          
        } else {
          results.props = initialSettings.props;
        }

        // Upgrade settings.
        console.log('new settings are', results);

        return browser.storage.local.set(results)
          .then(() => browser.storage.local.remove('addon'));
      });
    }

  }

}());
