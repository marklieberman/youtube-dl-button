'use strict';

const el = {
  optionsForm: document.getElementById('options-form'),
  inputExePath: document.getElementById('exe-path'),
  inputSaveIn: document.getElementById('save-in'),
  inputTemplate: document.getElementById('template'),
  inputFormat: document.getElementById('format'),
  inputCustomArgs: document.getElementById('custom-args'),
  inputQuickAudioFormat: document.getElementById('quick-audio-format')
};

// Restore the options from local stoage.
browser.storage.local.get({
  quickAudioFormat: null,
  props: {}
}).then(results => {
  // Setup
  el.inputExePath.value = results.props.exePath || '';
  el.inputSaveIn.value = results.props.saveIn || '';
  el.inputQuickAudioFormat.value = results.quickAudioFormat || '';

  // Switches
  el.inputTemplate.value = results.props.template || '';
  el.inputFormat.value = results.props.format || '';
  el.inputCustomArgs.value = results.props.customArgs || '';
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
    quickAudioFormat: el.inputQuickAudioFormat.value,
    props: {
      exePath: el.inputExePath.value,
      saveIn: el.inputSaveIn.value,
      template: el.inputTemplate.value,
      format: el.inputFormat.value,
      customArgs: el.inputCustomArgs.value
    }
  });
}
