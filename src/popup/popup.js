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
  quickAudioFormat: 'bestaudio'
};

// Default props.
const props = {
  exePath: '',
  saveIn: '',
  template: '',
  format: ''
};

// Popup settings.
const popup = {
  showSettings: true,
  settingsTab: 'saving',
  // Props
  saveIn: '',
  template: '',
  format: ''
};

let promises = [];
promises.push(browser.storage.local.get({
  settings,
  props,
  popup
}).then(results => {
  updateAddonSettings(results);
  updatePropsSettings(results);
  updatePopupSettings(results);
}));

/**
 * Apply add-on settings from local storage.
 */
function updateAddonSettings (results) {
  Object.keys(settings).forEach(key => {
    if (typeof results[key] !== 'undefined') {
      props[key] = results[key];
    }
  });

  el.inputSaveIn.placeholder = props.saveIn;
  el.inputTemplate.placeholder = props.template;
  el.inputFormat.placeholder = props.format;
}

/**
 * Apply default props from local storage.
 */
function updatePropsSettings (results) {
  Object.keys(props).forEach(key => {
    if (typeof results.props[key] !== 'undefined') {
      props[key] = results.props[key];
    }
  });

  el.inputSaveIn.placeholder = props.saveIn;
  el.inputTemplate.placeholder = props.template;
  el.inputFormat.placeholder = props.format;
}

/**
 * Restore popup settings from local storage.
 */
function updatePopupSettings (results) {
  Object.keys(popup).forEach(key => {
    if (typeof results.popup[key] !== 'undefined') {
      popup[key] = results.popup[key];
    }
  });

  el.inputSaveIn.value = popup.saveIn;
  el.inputTemplate.value = popup.template;
  el.inputFormat.value = popup.format;
}

// Get the URL of the active tab.
promises.push(browser.tabs.executeScript({
  code: 'window.location.href'
}).then(urls => {
  el.inputVideoUrl.value = urls[0];
}));

// Finish initialization when all promises resolve.
Promise.all(promises).finally(() => {
  // Initialize the state of the interface.
  openSettingsTab(popup.settingsTab);
  if (popup.showSettings) {
    toggleSettingsPanel();
  }

  validateCreateJob();

  // Update the job list and start polling.
  refreshJobs();
  startPollingJobs();
});

// Interface event setup -----------------------------------------------------------------------------------------------

// Change validation
el.inputVideoUrl.addEventListener('change', () => validateCreateJob());

// Button clicks
el.buttonCreateJob.addEventListener('click', () => createJob());
el.buttonCreateJobAudio.addEventListener('click', () => createJob(true));
el.buttonToggleSettings.addEventListener('click', () => toggleSettingsPanel());

el.buttonClearSaveIn.addEventListener('click', () => el.inputSaveIn.value = null);
el.buttonClearTemplate.addEventListener('click', () => el.inputTemplate.value = null);
el.buttonClearFormat.addEventListener('click', () => el.inputFormat.value = null);

el.buttonCleanUp.addEventListener('click', () => cleanUpJobs());

// Add event listeners to sttings tab headers.
Object.keys(el.settingsTabs).forEach(key => {
  let a = el.settingsTabs[key].header;
  a.addEventListener('click', (event) => openSettingsTab(key));
});

// Functions -----------------------------------------------------------------------------------------------------------

/**
 * Toggle display of the settings tabs panel.
 */
function toggleSettingsPanel () {
  let style = el.settingsPanel.style;
  if (el.settingsPanel.style.display === 'none') {
    el.settingsPanel.style.display = 'block';
    el.buttonToggleSettings.classList.add('active');
    popup.showSettings = true;
    browser.storage.local.set({ popup });
  } else {
    el.settingsPanel.style.display = 'none';
    el.buttonToggleSettings.classList.remove('active');
    popup.showSettings = false;
    browser.storage.local.set({ popup });
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
    popup.settingsTab = tab;
    browser.storage.local.set({ popup });
  });
}

/**
 * Enable or disable the create job buttons.
 */
function validateCreateJob () {
  let disabled = false;
  disabled |= !el.inputVideoUrl.value;
  el.buttonCreateJob.disabled = disabled;
  el.buttonCreateJobAudio.disabled = disabled;
}

/**
 * Create a job.
 */
function createJob (bestaudio) {
  // Ensure that required settings have been configured.
  if (!props.exePath || !props.saveIn) {
    window.alert("You must finish configuring the addon.");
    browser.runtime.openOptionsPage().then(() => window.close());
    return;
  }

  browser.runtime.sendMessage({
    topic: 'ydb-create-job',
    data: {
      props: {
        videoUrl: el.inputVideoUrl.value,
        saveIn: el.inputSaveIn.value || props.saveIn,
        template: el.inputTemplate.value || props.template,
        format: bestaudio ? settings.quickAudioFormat : (el.inputFormat.value || props.format)
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
    nodeEl.divOutput.innerText = 'Starting...';
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
