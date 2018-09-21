'use strict';

const el = {
  inputVideoUrl: document.getElementById('video-url'),
  buttonCreateJob: document.getElementById('create-job'),
  buttonCreateJobAudio: document.getElementById('create-job-audio'),
  buttonToggleSettings: document.getElementById('toggle-settings'),
  settingsPanel: document.getElementById('settings-panel'),
  settingsTabs: {
    saving: {
      header: document.querySelector('.nav-item.saving-tab a'),
      content: document.querySelector('.tab-content.saving-tab')
    },
    switches: {
      header: document.querySelector('.nav-item.switches-tab a'),
      content: document.querySelector('.tab-content.switches-tab')
    }
  },
  inputSaveIn: document.getElementById('save-in'),
  buttonClearSaveIn: document.getElementById('clear-save-in'),
  inputTemplate: document.getElementById('template'),
  buttonClearTemplate: document.getElementById('clear-template'),
  inputFormat: document.getElementById('format'),
  buttonClearFormat: document.getElementById('clear-format'),
  divJobsList: document.getElementById('jobs-list'),
  divEmptyList: document.getElementById('empty-list'),
  templateJobRow: document.getElementById('job-row-template'),
  buttonCleanUp: document.getElementById('cleanup-jobs')
};

// Add-on settings.
const settings = {
  addon: {
    quickAudioFormat: 'bestaudio'
  },
  props: {
    exePath: '',
    saveIn: '',
    template: '',
    format: ''
  },
  popup: {
    showSettings: true,
    settingsTab: 'saving'
  }
};

/**
 * A collection of per-domain settings.
 */
class PerDomainSettings {
  constructor (data) {
    data = data || {};
    this.saveIn = data.saveIn || '';
    this.template = data.template || '';
    this.format = data.format || '';
  }

  isEmpty() {
    return !this.saveIn && !this.template && !this.format;
  }
}

// Get the URL of the active tab.
let promises = [];
promises.push(browser.tabs.executeScript({
  code: 'window.location.href'
}).then(urls => {
  let url = new URL(urls[0]);

  // Also get the per-domain settings for this host.
  return browser.storage.local.get({
    domains: {}
  }).then(results => {
    let domainSettings = new PerDomainSettings(results.domains[url.host]);
    return {
      url,
      domainSettings
    };
  });
}).catch(error => {
  console.log('failed to get active tab URL');
  return null;
}));

// Get the saved settings from local storage.
promises.push(browser.storage.local.get(settings).then(results => {
  // Copy settings into settings object.
  [ 'addon', 'props', 'popup' ].forEach(group => {
    Object.keys(settings[group]).forEach(key => {
      if (typeof results[group][key] !== 'undefined') {
        settings[group][key] = results[group][key];
      }
    });
  });

  el.inputSaveIn.placeholder = 'Default: ' + settings.props.saveIn;
  el.inputTemplate.placeholder = 'Default: ' + settings.props.template;
  el.inputFormat.placeholder = 'Default: ' + settings.props.format;

  return settings;
}));

// Finish initialization when all promises resolve.
Promise.all(promises)
  .then(results => {
    if (results[0]) {
      let { url, domainSettings } = results[0];

      el.inputVideoUrl.value = url.href;

      // Restore per-domain settings if available.
      el.inputSaveIn.value = domainSettings.saveIn;
      el.inputTemplate.value = domainSettings.template;
      el.inputFormat.value = domainSettings.format;
    }
  })
  .finally(() => {
    // Initialize the state of the interface.
    openSettingsTab(settings.popup.settingsTab);
    if (settings.popup.showSettings) {
      toggleSettingsPanel();
    }

    validateCreateJob();

    // Update the job list and start polling.
    refreshJobs();
    startPollingJobs();
  });

// Interface event setup -----------------------------------------------------------------------------------------------

el.inputVideoUrl.addEventListener('input', () => {
  validateCreateJob();
});

// Change
el.inputVideoUrl.addEventListener('change', () => {
  savePopupSettings();
});
el.inputSaveIn.addEventListener('change', () => {
  savePopupSettings();
});
el.inputTemplate.addEventListener('change', () => {
  savePopupSettings();
});
el.inputFormat.addEventListener('change', () => {
  savePopupSettings();
});

// CLick
el.buttonCreateJob.addEventListener('click', () => {
  createJob();
});
el.buttonCreateJobAudio.addEventListener('click', () => {
  createJob(true);
});
el.buttonToggleSettings.addEventListener('click', () => {
  toggleSettingsPanel();
});
el.buttonClearSaveIn.addEventListener('click', () => {
  el.inputSaveIn.value = null;
  savePopupSettings();
});
el.buttonClearTemplate.addEventListener('click', () => {
  el.inputTemplate.value = null;
  savePopupSettings();
});
el.buttonClearFormat.addEventListener('click', () => {
  el.inputFormat.value = null;
  savePopupSettings();
});
el.buttonCleanUp.addEventListener('click', () => {
  cleanUpJobs();
});

// Add event listeners to settings tab headers.
Object.keys(el.settingsTabs).forEach(key => {
  let a = el.settingsTabs[key].header;
  a.addEventListener('click', (event) => {
    openSettingsTab(key);
  });
});

// Functions -----------------------------------------------------------------------------------------------------------

/**
 * Save popup settings.
 */
function savePopupSettings () {
  return Promise.all([
    savePerDomainSettings()
  ]);
}

/**
 * Save per-domain settings.
 */
function savePerDomainSettings () {
  try {
    // Save the per-domain settings.
    if (el.inputVideoUrl.value) {
      var url = new URL(el.inputVideoUrl.value);
      let domainSettings = new PerDomainSettings({
        saveIn: el.inputSaveIn.value,
        template: el.inputTemplate.value,
        format: el.inputFormat.value
      });
      return browser.storage.local.get({ domains: {} }).then(results => {
        if (domainSettings.isEmpty()) {
          // Remove the saved entry for this domain.
          delete results.domains[url.host];
        } else {
          // Update the saved entry for this domain.
          results.domains[url.host] = domainSettings;
        }
        return browser.storage.local.set(results);
      });
    }
  } catch (error) {
    console.log('not saving per domain settings - invalid URL');
  }
  return Promise.resolve({});
}

/**
 * Toggle display of the settings tabs panel.
 */
function toggleSettingsPanel () {
  let style = el.settingsPanel.style;
  if (el.settingsPanel.style.display === 'none') {
    el.settingsPanel.style.display = 'block';
    el.buttonToggleSettings.classList.add('active');
    settings.popup.showSettings = true;
    return browser.storage.local.set({ popup: settings.popup });
  } else {
    el.settingsPanel.style.display = 'none';
    el.buttonToggleSettings.classList.remove('active');
    settings.popup.showSettings = false;
    return browser.storage.local.set({ popup: settings.popup });
  }
}

/**
 * Open one of the settings tabs.
 */
function openSettingsTab (tab) {
  Object.keys(el.settingsTabs).forEach(key => {
    let { header, content } = el.settingsTabs[key];
    if (key === tab) {
      header.classList.add('active');
      content.style.display = 'block';
    } else {
      header.classList.remove('active');
      content.style.display = 'none';
    }
    settings.popup.settingsTab = tab;
    browser.storage.local.set({ popup: settings.popup });
  });
}

/**
 * Enable or disable the create job buttons.
 */
function validateCreateJob () {
  let disabled = false;
  try {
    if (el.inputVideoUrl.value) {
      // Try to construct an instance of URL().
      new URL(el.inputVideoUrl.value);
    } else {
      disabled = true;
    }
  } catch (error) {
    disabled = true;
  }

  el.buttonCreateJob.disabled = disabled;
  el.buttonCreateJobAudio.disabled = disabled;
}

/**
 * Create a job.
 */
function createJob (bestaudio) {
  // Ensure that required settings have been configured.
  if (!settings.props.exePath || !settings.props.saveIn) {
    window.alert("You must finish configuring the addon.");
    browser.runtime.openOptionsPage().then(() => window.close());
    return;
  }

  // Use the addon quick audio format for audio jobs.
  let format = el.inputFormat.value || settings.props.format;
  if (bestaudio) {
    format = settings.addon.quickAudioFormat;
  }

  browser.runtime.sendMessage({
    topic: 'ydb-create-job',
    data: {
      props: {
        videoUrl: el.inputVideoUrl.value,
        saveIn: el.inputSaveIn.value || settings.props.saveIn,
        template: el.inputTemplate.value || settings.props.template,
        format
      }
    }
  });
}

/**
 * Cancel a running job.
 */
function cancelJob (jobId) {
  browser.runtime.sendMessage({
    topic: 'ydb-cancel-job',
    data: {
      jobId
    }
  });
}

/**
 * Remove all completed jobs from the list.
 */
function cleanUpJobs () {
  browser.runtime.sendMessage({
    topic: 'ydb-clean-jobs',
    data: {}
  }).then(updateJobsList);
}

/**
 * Start polling to update the jobs list.
 */
function startPollingJobs () {
  window.setTimeout(() => {
    refreshJobs();
    startPollingJobs();
  }, 1000);
}

/**
 * Refresh the list of jobs.
 */
function refreshJobs () {
  browser.runtime.sendMessage({
    topic: 'ydb-get-jobs',
    data: {}
  }).then(updateJobsList);
}

/**
 * Update the list of jobs.
 */
function updateJobsList (jobs) {
  // Remove missing jobs from the list.
  let children = Array.from(el.divJobsList.children);
  children.forEach(child => {
    if (child.classList.contains('job')) {
      if (!jobs.find(job => child.dataset.jobId === String(job.id))) {
        child.parentNode.removeChild(child);
      }
    }
  });

  // Show the empty list notifiation if there are no jobs.
  if (jobs.length) {
    el.divEmptyList.style.display = 'none';
  } else {
    el.divEmptyList.style.display = 'block';
    return;
  }

  // Add or update jobs to the list.
  jobs.forEach(job => {
    let child = children.find(child => child.dataset.jobId === String(job.id));
    if (!child) {
      createJobRow(job);
    } else {
      updateJobRow(child, job);
    }
  });
}

/**
 * Create a new job row in the jobs list.
 */
function createJobRow (job) {
  // Create the list item.
  let template = document.importNode(el.templateJobRow.content, true);
  let node = template.firstElementChild;

  let nodeEl = {
    divVideoUrl: node.querySelector('.video-url'),
    buttonCancelJob: node.querySelector('.cancel-job'),
    aViewOutput: node.querySelector('.view-output')
  };

  // Decorate the element with the job ID.
  node.dataset.jobId = String(job.id);

  // Add the handler for the cancel job button.
  nodeEl.buttonCancelJob.addEventListener('click', () => {
    cancelJob(Number(node.dataset.jobId));
  });

  // Add the handler for the view-output button.
  nodeEl.aViewOutput.href = '/output/output.html?jobId=' + job.id;

  // Fill the remaining parts of the template.
  nodeEl.divVideoUrl.innerText = job.props.videoUrl;
  updateJobRow(node, job);

  // Append the job row to the document.
  let beforeNode = Array.from(el.divJobsList.children)
    .find(child => Number(child.dataset.jobId) < job.id);

  el.divJobsList.insertBefore(template, beforeNode);
}

/**
 * Update an existing job row in the jobs list.
 */
function updateJobRow (node, job) {
  let nodeEl = {
    divFileName: node.querySelector('.file-name'),
    divVideoUrl: node.querySelector('.video-url'),
    divOutput: node.querySelector('.output')
  };

  // Decorate the job node with a state attribute.
  node.dataset.state = job.state;

  // Display the filename when/if it becomes available.
  if (job.destination) {
    let filename = fileName(job.destination);
    if (nodeEl.divFileName.innerText !== filename) {
      nodeEl.divFileName.innerText = filename;
    }
  }

  // Show the latest line of output from the job.
  if (job.output.length) {
    nodeEl.divOutput.innerText = job.output[job.output.length - 1];
  } else {
    nodeEl.divOutput.innerText = 'Waiting...';
  }
}

/**
 * Try to get the filename component from a path.
 */
function fileName (path) {
  let index = path.lastIndexOf('\\');
  if (!~index) {
    index = path.lastIndexOf('/');
  }
  if (!!~index) {
    return path.substring(index + 1);
  }
  return path;
}
