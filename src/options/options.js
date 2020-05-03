'use strict';

const el = {
  optionsForm: document.getElementById('options-form'),
  inputExePath: document.getElementById('exe-path'),
  inputSaveIn: document.getElementById('save-in'),
  inputTemplate: document.getElementById('template'),
  inputFormat: document.getElementById('format'),
  inputCustomArgs: document.getElementById('custom-args'),
  inputQuickAudioFormat: document.getElementById('quick-audio-format'),
  inputConcurrentJobsLimit: document.getElementById('concurrent-jobs-limit'),
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
function saveOptions (event) {
  if (el.optionsForm.checkValidity() === false) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  return browser.storage.local.set({
    addon: {
      quickAudioFormat: el.inputQuickAudioFormat.value,
      concurrentJobsLimit: Number(el.inputConcurrentJobsLimit.value),
      switchSets: el.textareaSwitchSets.value
    },
    props: {
      exePath: el.inputExePath.value,
      saveIn: el.inputSaveIn.value,
      template: el.inputTemplate.value,
      format: el.inputFormat.value,
      customArgs: el.inputCustomArgs.value
    }
  });
}
