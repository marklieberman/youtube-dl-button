'use strict';

/**
 * Helper for managing optional cookies and host permissions.
 */
class CookieOriginsHelper {
  constructor () {
    this.remaining = [
      '*://youtube.com/*'
    ];
    this.requested = [];
  }

  /**
   * Add an origin to request.
   */
  requestOrigin (origin) {
    this.remaining = this.remaining.filter(v => v !== origin);
    this.requested.push(origin);
  }

  /**
   * Prompt for permissions.
   */
  async applyPermissions () {
    let granted = true;
    if (this.requested.length) {
      // Aquire all requested host permissions.
      granted = await browser.permissions.request({
        origins: this.requested,
        permissions: [ 'cookies' ]
      });
    } else {
      // Nothing requested; release cookies.
      await browser.permissions.remove({
        permissions: [ 'cookies' ]
      });
    }
    if (this.remaining.length) {
      // Remove all unused host permissions.
      await browser.permissions.remove({
        origins: this.remaining
      });
    }
    return granted;
  }

  /**
   * Remove all permissions.
   */
  async removeAllPermissions () {
    await browser.permissions.remove({
      origins: this.remaining.concat(this.requested),
      permissions: [ 'cookies' ],
    });
  }
}

const el = {
  optionsForm: document.getElementById('options-form'),
  inputExePath: document.getElementById('exe-path'),
  inputSaveIn: document.getElementById('save-in'),  
  inputConcurrentJobsLimit: document.getElementById('concurrent-jobs-limit'),
  inputFormat: document.getElementById('format'),  
  inputQuickAudioFormat: document.getElementById('quick-audio-format'),
  inputTemplate: document.getElementById('template'),  
  inputCustomArgs: document.getElementById('custom-args'),
  inputSendCookiesYoutube: document.getElementById('send-cookies-youtube'),
  textareaSwitchSets: document.getElementById('switch-sets')
};

// Restore the options from local stoage.
browser.storage.local.get({
  addon: {},
  props: {}
}).then(results => {
  // Setup
  el.inputExePath.value = results.props.exePath || '';
  el.inputSaveIn.value = results.props.saveIn || '';
  el.inputQuickAudioFormat.value = results.addon.quickAudioFormat || '';
  el.inputConcurrentJobsLimit.value = results.addon.concurrentJobsLimit || 1;
  el.inputSendCookiesYoutube.checked = !!results.addon.sendCookiesYoutube;
  el.textareaSwitchSets.value = results.addon.switchSets || '[]';
  
  // Switches
  el.inputTemplate.value = results.props.template || '';
  el.inputFormat.value = results.props.format || '';
  el.inputCustomArgs.value = results.props.customArgs || '';
});

// Do some basic validation on the switch sets.
el.textareaSwitchSets.addEventListener('input', () => {
  try {    
    let value = JSON.parse(el.textareaSwitchSets.value);
    if (!Array.isArray(value)) {
      el.textareaSwitchSets.setCustomValidity('Must be an array.');
    } else {
      el.textareaSwitchSets.setCustomValidity('');
      for (let i = 0; i < value.length; i++) {
        if (!value[i].name) {
          el.textareaSwitchSets.setCustomValidity(`Item ${i} must have a name property`);
          break;
        }
      }
    }
  } catch (error) {
    el.textareaSwitchSets.setCustomValidity('Not valid JSON.');    
  }

  el.textareaSwitchSets.reportValidity();
});

// Bind event handlers to the form.
el.optionsForm.addEventListener('submit', saveOptions);

// Save the options to local storage.
async function saveOptions (event) {
  event.preventDefault();
  event.stopPropagation();

  if (!el.optionsForm.checkValidity()) {
    return;
  }

  // Aquire or release optional permissions for cookies.
  let origins = new CookieOriginsHelper();
  if (el.inputSendCookiesYoutube.checked) {
    this.requestOrigin('*://youtube.com/*');
  }
  if (!(await origins.applyPermissions())) {
    // Permissions rejected; remove all permissions and disable features.
    origins.removeAllPermissions();
    el.inputSendCookiesYoutube.checked = false;
  }

  await browser.storage.local.set({
    addon: {
      quickAudioFormat: el.inputQuickAudioFormat.value,
      concurrentJobsLimit: Number(el.inputConcurrentJobsLimit.value),
      switchSets: el.textareaSwitchSets.value,
      sendCookiesYoutube: el.inputSendCookiesYoutube.checked
    },
    props: {
      exePath: el.inputExePath.value,
      saveIn: el.inputSaveIn.value,
      template: el.inputTemplate.value,
      format: el.inputFormat.value,
      customArgs: el.inputCustomArgs.value
    }
  });

  alert('Settings have been saved');
}
