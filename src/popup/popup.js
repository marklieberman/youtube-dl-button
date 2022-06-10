'use strict';

const el = {
  inputVideoUrl: document.getElementById('video-url'),
  //buttonCreateJob: document.getElementById('create-job'),
  //buttonCreateJobAudio: document.getElementById('create-job-audio'),
  buttonMainDowpdown: document.getElementById('toggle-main-dropdown'),
  divGrabVideoBar: document.getElementById('grab-video-bar'),
  divMainDropdown: document.getElementById('main-dropdown'),
  divDropdownAddon: document.getElementById('dropdown-addon'),
  //divSwitchSetsList: document.getElementById('switch-sets-list'),
  divPropsButtonList: document.getElementById('props-button-list'),
  templatePropsButton: document.getElementById('props-button-template'),
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
  updateExe: document.getElementById('update-exe'),
  buttonCleanUp: document.getElementById('cleanup-jobs')
};

// Add-on settings.
const settings = {
  exePath: null,
  popup: {
    showSettings: true,
    settingsTab: 'saving'
  },
  props: []
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
  console.log('failed to get active tab URL', error);
  return null;
}));

// Get the saved settings from local storage.
promises.push(browser.storage.local.get(settings).then(results => {
  // Copy settings into settings object.
  Object.assign(settings, results);

  let unconfiguredProps = {
    saveIn: 'Not Configured',
    template: 'Not Configured',
    format: 'Not Configured'
  };
  let defaultProps = settings.props.length ? settings.props[0] : unconfiguredProps;
  el.inputSaveIn.placeholder = `Default: ${defaultProps.saveIn || unconfiguredProps.saveIn}`;
  el.inputTemplate.placeholder = `Default: ${defaultProps.template || unconfiguredProps.template}`;
  el.inputFormat.placeholder = `Default: ${defaultProps.format || unconfiguredProps.format}`;

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
    
    // Initialize the remaining interface elements.
    populatePropsEntries();

    // Update the job list and start polling.
    validateCreateJob();
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

// Click
el.buttonMainDowpdown.addEventListener('click', () => {
  toggleMainDropdown();
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
el.updateExe.addEventListener('click', () => {
  updateExe();
});
el.buttonCleanUp.addEventListener('click', () => {
  cleanUpJobs();
});

// Add event listeners to settings tab headers.
Object.keys(el.settingsTabs).forEach(key => {
  let a = el.settingsTabs[key].header;
  a.addEventListener('click', () => {
    openSettingsTab(key);
  });
});

// Functions -----------------------------------------------------------------------------------------------------------

/**
 * Save popup settings.
 */
function savePopupSettings () {
  return Promise.all([
    // TODO Save other settings.
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
function toggleMainDropdown () {
  let dropdown = el.divMainDropdown;
  if (dropdown.style.display === 'block') {
    dropdown.style.display = 'none';
    window.removeEventListener('click', outsideClick, { 
      capture: true 
    });
  } else {
    dropdown.style.display = 'block';
    window.addEventListener('click', outsideClick, { 
      capture: true 
    });
  }

  function outsideClick (event) {
    if ((dropdown.style.display === 'block') && !dropdown.contains(event.target)) {
      dropdown.style.display = 'none';
      window.removeEventListener('click', outsideClick, { 
        capture: true 
      });
    }
  }  
}

/**
 * Populate the list of 'switch sets' that quickly configure the popup.
 */
function populatePropsEntries () {
  // Append an entry for each switch set from settings.
  settings.props.forEach((props, index) => {
    addPropsButton(props, index);
  });

  // Add a button to create a job using the parameter set.
  function addPropsButton (props, index) {
    let template = document.importNode(el.templatePropsButton.content, true);
    let tpl = {
      button: template.querySelector('button')
    };

    if (index === 0) {
      // Default download button
      tpl.button.classList.add('btn-dark');
      tpl.button.firstElementChild.classList.add('fa-download');
    } else
    if (index === 1) {
      // Audio download button
      tpl.button.classList.add('btn-secondary');
      tpl.button.firstElementChild.classList.add('fa-music');
    } else {
      // Custom props download button
      tpl.button.classList.add('btn-secondary', 'custom-props-button');
      tpl.button.removeChild(tpl.button.firstElementChild);
      if (props.icon) {
        tpl.button.style.backgroundImage = `url("${props.icon}")`;
      }
    }

    tpl.button.addEventListener('click', () => {
      createJob(props);
    });
    tpl.button.addEventListener('mousedown', event => {
      if (event.button === 1) {
        el.inputSaveIn.value = props.saveIn;
        el.inputFormat.value = props.format;
        el.inputTemplate.value = props.template;
      }
    });

    el.divGrabVideoBar.insertBefore(template, el.divDropdownAddon);
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

      // Save the selected tab to popup settings.
      if (settings.popup.settingsTab !== tab) {
        settings.popup.settingsTab = tab;
        browser.storage.local.set({ popup: settings.popup });
      }
    } else {
      header.classList.remove('active');
      content.style.display = 'none';
    }
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

  document.querySelectorAll('.props-button').forEach(node => node.disabled = disabled);
}

/**
 * Create a job.
 */
function createJob (props) {
  // Ensure that required settings have been configured.
  if (!settings.exePath) {
    window.alert('You must finish configuring the addon.');
    browser.runtime.openOptionsPage().then(() => window.close());
    return;
  }

  let jobProps = {
    videoUrl: el.inputVideoUrl.value
  };

  // Set fallback parameters to either inherited or null depending on config.
  let defaultProps = props.inheritDefault ? settings.props[0] : {
    saveIn: null,
    template: null,
    format: null
  };

  // Assign job props in form > parameter set > fallback parameters priority.
  jobProps.saveIn = el.inputSaveIn.value || props.saveIn || defaultProps.saveIn;
  jobProps.template = el.inputTemplate.value|| props.template || defaultProps.template;
  jobProps.format = el.inputFormat.value || props.format || defaultProps.format;

  // Complain if any of the required parameters are empty.
  if (!jobProps.saveIn || !jobProps.template || !jobProps.format) {
    window.alert('You must finish configuring the addon.');
    browser.runtime.openOptionsPage().then(() => window.close());
    return;
  }
  
  browser.runtime.sendMessage({
    topic: 'ydb-create-job',
    data: {
      props: jobProps
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
 * Retry a failed or cancelled job.
 */
function retryJob (jobId) {
  browser.runtime.sendMessage({
    topic: 'ydb-retry-job',
    data: {
      jobId
    }
  });
}

/**
 * Update the youtube-dl executable.
 */
function updateExe () {
  browser.runtime.sendMessage({
    topic: 'ydb-update-exe',
    data: {}
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
    aVideoUrl: node.querySelector('.video-url'),
    buttonCancelJob: node.querySelector('.cancel-job'),
    buttonRetryJob: node.querySelector('.retry-job'),
    aViewOutput: node.querySelector('.view-output')
  };

  // Decorate the element with the job ID.
  node.dataset.jobId = String(job.id);

  // Add the handler for the cancel job button.
  nodeEl.buttonCancelJob.addEventListener('click', () => {
    cancelJob(Number(node.dataset.jobId));
  });

  // Add the handler for the retry job button.
  nodeEl.buttonRetryJob.addEventListener('click', () => {
    retryJob(Number(node.dataset.jobId));
  });

  // Add the handler for the view-output button.
  nodeEl.aViewOutput.href = '/output/output.html?jobId=' + job.id;

  // Fill the remaining parts of the template.
  nodeEl.aVideoUrl.innerText = job.props.videoUrl;
  nodeEl.aVideoUrl.href = job.props.videoUrl;
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
  if (~index) {
    return path.substring(index + 1);
  }
  return path;
}
