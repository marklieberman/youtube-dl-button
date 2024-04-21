'use strict';

const divToPropsMap = new WeakMap();
const trToCookieDomainMap = new WeakMap();

const el = {
  optionsForm: document.getElementById('options-form'),
  buttonAddProps: document.getElementById('add-props'),
  buttonAddCookieDomain: document.getElementById('add-cookie-domain'),
  buttonBackupSettings: document.getElementById('backup-settings'),
  fileRestoreSettings: document.getElementById('restore-settings'),
  inputExePath: document.getElementById('exe-path'),
  inputConcurrentJobsLimit: document.getElementById('concurrent-jobs-limit'),
  divPropsList: document.getElementById('props-list'),
  divCookieDomainList: document.getElementById('cookie-domain-list'),
  templateProps: document.getElementById('props-template'),
  templateSendCookieRow: document.getElementById('send-cookie-template')
};

browser.storage.local.get({
  exePath: '',
  concurrentJobsLimit: 1,
  props: [],
  sendCookieDomains: []
}).then(populateSettings);

// Bind event handlers to the form.
el.buttonAddProps.addEventListener('click', () => createPropsConfig({}).scrollIntoView());
el.buttonAddCookieDomain.addEventListener('click', () => createCookieDomainConfig({
  videoDomain: '',
  extraDomains: []
}).scrollIntoView());
el.buttonBackupSettings.addEventListener('click', () => backupSettings());
el.optionsForm.addEventListener('submit', saveOptions);
el.fileRestoreSettings.addEventListener('change', () => restoreSettings());

function populateSettings (results) {
  // Restore the options from local stoage.
  el.divPropsList.innerText = '';  
  el.inputExePath.value = results.exePath || '';
  el.inputConcurrentJobsLimit.value = results.concurrentJobsLimit || 1;
  results.props.forEach(createPropsConfig);
  results.sendCookieDomains.forEach(createCookieDomainConfig);
}

function createPropsConfig (props, index = -1) {
  let template = document.importNode(el.templateProps.content, true);
  let tpl = {
    divProps: template.firstElementChild,    
    buttonDelete: template.querySelector('button.delete'), 
    buttonMoveDown: template.querySelector('button.move-down'),   
    buttonMoveUp: template.querySelector('button.move-up'),
    checkInheritDefault: template.querySelector('[name="inherit-default"]'),
    divIconPreview: template.querySelector('.icon-preview'),
    inputCustomArgs: template.querySelector('[name="custom-args"]'),
    inputFormat: template.querySelector('[name="format"]'),
    inputIcon: template.querySelector('[name="icon"]'),    
    inputName: template.querySelector('[name="name"]'),    
    inputPostProcessScript: template.querySelector('[name="post-process-script"]'),
    inputSaveIn: template.querySelector('[name="save-in"]'),    
    inputTemplate: template.querySelector('[name="template"]')
  };
  tpl.checkInheritDefault.checked = (props.inheritDefault === undefined) ? true : !!props.inheritDefault;
  tpl.inputCustomArgs.value = props.customArgs || '';
  tpl.inputFormat.value = props.format || '';
  tpl.inputIcon.value = props.icon || '';    
  tpl.inputName.value = props.name || '';
  tpl.inputPostProcessScript.value = props.postProcessScript || '';  
  tpl.inputSaveIn.value = props.saveIn || '';
  tpl.inputTemplate.value = props.template || '';  
    
  // Special cases for the built in parameter sets.
  if (index === 0) {
    tpl.divProps.classList.add('default-props');
    tpl.buttonDelete.setAttribute('disabled', 'true');
    tpl.inputName.setAttribute('disabled', 'true');
    tpl.inputSaveIn.setAttribute('required', 'true');
    tpl.checkInheritDefault.checked = false;
  } else
  if (index === 1) {
    tpl.divProps.classList.add('audio-props');
    tpl.buttonDelete.setAttribute('disabled', 'true');
    tpl.inputName.setAttribute('disabled', 'true');
  } else {
    tpl.divProps.classList.add('custom-props');
  }

  // Configure the form.
  updateIconPreview(tpl);
  updatePropsConfigValidation(tpl);

  // Bind event handlers to the form.
  tpl.buttonMoveUp.addEventListener('click', () => {
    let sibling = tpl.divProps.previousElementSibling;
    tpl.divProps.parentNode.insertBefore(tpl.divProps, sibling);
  });
  tpl.buttonMoveDown.addEventListener('click', () => {
    let sibling = tpl.divProps.nextElementSibling;
    sibling.parentNode.insertBefore(sibling, tpl.divProps);
  });
  tpl.buttonDelete.addEventListener('click', () => tpl.divProps.parentNode.removeChild(tpl.divProps));
  tpl.inputIcon.addEventListener('change', () => updateIconPreview(tpl));
  tpl.checkInheritDefault.addEventListener('change', () => updatePropsConfigValidation(tpl));  

  el.divPropsList.appendChild(template);
  divToPropsMap.set(tpl.divProps, () => ({
    inheritDefault: tpl.checkInheritDefault.checked,
    customArgs: tpl.inputCustomArgs.value,
    format: tpl.inputFormat.value,
    icon: tpl.inputIcon.value,    
    name: tpl.inputName.value,
    postProcessScript: tpl.inputPostProcessScript.value,
    saveIn: tpl.inputSaveIn.value,
    template: tpl.inputTemplate.value
  }));

  return tpl.divProps;
}

function updateIconPreview (tpl) {
  if (tpl.inputIcon.value) {
    tpl.divIconPreview.style.backgroundImage = `url("${tpl.inputIcon.value}")`;
  } else {
    tpl.divIconPreview.style.backgroundImage = null;
  }
}

function updatePropsConfigValidation (tpl) {
  const placeholder = 'Inherited from Default';
  if (tpl.checkInheritDefault.checked) {    
    tpl.divProps.classList.add('inherits-default');
    tpl.inputCustomArgs.setAttribute('placeholder', placeholder);
    tpl.inputFormat.removeAttribute('required');
    tpl.inputFormat.setAttribute('placeholder', placeholder);
    tpl.inputPostProcessScript.setAttribute('placeholder', placeholder);
    tpl.inputTemplate.removeAttribute('required');
    tpl.inputTemplate.setAttribute('placeholder', placeholder);
    tpl.inputSaveIn.removeAttribute('required');
    tpl.inputSaveIn.setAttribute('placeholder', placeholder);
  } else {    
    tpl.divProps.classList.remove('inherits-default');
    tpl.inputCustomArgs.removeAttribute('placeholder');
    tpl.inputFormat.removeAttribute('placeholder');
    tpl.inputFormat.setAttribute('required', 'true');
    tpl.inputPostProcessScript.removeAttribute('placeholder');
    tpl.inputTemplate.removeAttribute('placeholder');
    tpl.inputTemplate.setAttribute('required', 'true');
    tpl.inputSaveIn.setAttribute('required', 'true');
    tpl.inputSaveIn.removeAttribute('placeholder');
  }
}

function createCookieDomainConfig (cookieDomain) {
  let template = document.importNode(el.templateSendCookieRow.content, true);
  let tpl = {
    divCookieDomain: template.firstElementChild,    
    inputVideoDomain: template.querySelector('[name="video-domain"]'),
    inputExtraDomains: template.querySelector('[name="extra-domains"]'),
    buttonDelete: template.querySelector('button.delete')
  };

  // Configure the form.
  tpl.inputVideoDomain.value = cookieDomain.videoDomain;
  tpl.inputExtraDomains.value = cookieDomain.extraDomains.join(', ');

  // Bind event handlers to the form.
  tpl.buttonDelete.addEventListener('click', () => tpl.divCookieDomain.parentNode.removeChild(tpl.divCookieDomain));

  el.divCookieDomainList.appendChild(template);
  trToCookieDomainMap.set(tpl.divCookieDomain, () => ({    
    videoDomain: tpl.inputVideoDomain.value,
    extraDomains: tpl.inputExtraDomains.value
      .split(',')
      .map(d => d.trim())
      .filter(d => d)
  }));
  return tpl.divProps;
}

async function applyCookiePermissions (requested) {
  // Aquire all requested host permissions.  
  if (requested.length) {    
    if (!await browser.permissions.request({
      origins: requested,
      permissions: [ 'cookies' ]
    })) {
      return false;
    }
  }
  
  // Relinquish permission from removed domains.
  let permitted = (await browser.permissions.getAll()).origins;  
  let relinquished = permitted.filter(o => !requested.includes(o));  
  await browser.permissions.remove({
    origins: relinquished
  });

  return true;
}

// Save the options to local storage.
async function saveOptions (event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (!el.optionsForm.checkValidity()) {
    return;
  }

  let props = [].slice.call(el.divPropsList.children)
    .filter(element => element.tagName === 'DIV')
    .map(divProps => divToPropsMap.get(divProps)());

  let sendCookieDomains = [].slice.call(el.divCookieDomainList.children)
    .filter(element => element.tagName === 'TR')
    .map(trCookieDomain => trToCookieDomainMap.get(trCookieDomain)())
    .filter(cookieDomain => cookieDomain.videoDomain);

  // Aquire or release optional permissions for cookies.
  let cookieOrigins = [];
  sendCookieDomains.forEach(cookieDomain => {
    cookieOrigins.push(`*://${cookieDomain.videoDomain}/*`);
    cookieDomain.extraDomains.forEach(extraDomain => {
      cookieOrigins.push(`*://${extraDomain}/*`);
    });
  });
  if (!(await applyCookiePermissions(cookieOrigins))) {
    alert('Settings have not been saved');
    return;
  }

  // Save all settings.
  await browser.storage.local.set({
    exePath: el.inputExePath.value,
    concurrentJobsLimit: Number(el.inputConcurrentJobsLimit.value),
    props,
    sendCookieDomains
  });

  alert('Settings have been saved');
}

// Backup settings to a JSON file which is downloaded.
async function backupSettings () {
  // Get the settings to be backed up.
  let backupSettings = await browser.storage.local.get({
    exePath: null,
    concurrentJobsLimit: 1,
    props: [],
    sendCookieDomains: []
  });

  // Wrap the settings in an envelope.
  let backupData = {};
  backupData.settings = backupSettings;
  backupData.timestamp = new Date();
  backupData.fileName = 'youtubeDlButton.' + [
    String(backupData.timestamp.getFullYear()),
    String(backupData.timestamp.getMonth() + 1).padStart(2, '0'),
    String(backupData.timestamp.getDate()).padStart(2, '0')
  ].join('-') + '.json';
  // Record the current addon version.
  let selfInfo = await browser.management.getSelf();
  backupData.addonId = selfInfo.id;
  backupData.version = selfInfo.version;

  // Encode the backup as a JSON data URL.
  let jsonData = JSON.stringify(backupData, null, 2);
  let dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonData);

  // Prompt the user to download the backup.
  let a = window.document.createElement('a');
  a.href = dataUrl;
  a.download = backupData.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Restore settings froma JSON file which is uploaded.
async function restoreSettings () {
  let reader = new window.FileReader();
  reader.onload = async () => {
    try {
      // TODO Validate the backup version, etc.
      let backupData = JSON.parse(reader.result);
      populateSettings(backupData.settings);      
      alert('Settings copied from backup; please Save now.');
    } catch (error) {
      alert(`Failed to restore: ${error}`);
    }
  };
  reader.onerror = (error) => {
    alert(`Failed to restore: ${error}`);
  };
  reader.readAsText(el.fileRestoreSettings.files[0]);
}