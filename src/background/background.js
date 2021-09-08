'use strict';

const state = {
  port: null,
  jobs: [],
  jobId: 1,
};

const settings = {
  addon: {
    concurrentJobsLimit: 1,
    sendCookiesYoutube: false
  }
};

// Get initial settings values.
browser.storage.local.get(settings).then(results => {
  Object.keys(settings.addon).forEach(key => {
    if (typeof results.addon[key] !== 'undefined') {
      settings.addon[key] = results.addon[key];
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Events 

/**
 * Invoked when settings are changed.
 */
browser.storage.onChanged.addListener((changes, area) => {
  if ((area === 'local') && changes.addon) {
    Object.keys(settings.addon).forEach(key => {
      if (typeof changes.addon.newValue[key] !== 'undefined') {
        settings.addon[key] = changes.addon.newValue[key];
      }
    });
  }
});

/**
 * Invoked by messages from popups and content scripts.
 */
browser.runtime.onMessage.addListener((message, sender) => {
  // Decorate the message with the sender tab ID.
  if (sender.tab) {
    message.tabId = sender.tab.id;
  }

  switch (message.topic) {
  case 'ydb-get-jobs':
    return onGetJobs(message);
  case 'ydb-create-job':
    return onCreateJob(message);
  case 'ydb-cancel-job':
    return onCancelJob(message);
  case 'ydb-retry-job':
    return onRetryJob(message);
  case 'ydb-clean-jobs':
    return onCleanJobs(message);
  case 'ydb-update-exe':
    return onUpdateExe(message);
  }

  return false;
});

/**
 * Invoked by messages from the native-app port.
 */
function onPortMessage (message) {
  switch (message.topic) {
  case 'job-output':
    onJobOutput(message);
    break;
  case 'job-ended':
    onJobEnded(message);
    break;
  case 'job-started':
    console.log('started job', message.data.output);
    break;
  }
}

/**
 * Invoked when the native-app is disconnected unexpectedly.
 */
function onPortDisconnect (port) {
  if (port.error) {
    console.log('disconnected with error', port.error);
  }
  state.port = null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Model 

class Job {
  constructor (props) {
    this.id = state.jobId++;
    this.props = props;
    this.cancelRequested = false;
    this.state = 'waiting';
    this.output = [];
  }

  /**
   * Update the job state and sort the job queue.
   */
  setState (state) {
    this.state = state;
  }

  /**
   * Tell the native app to create a job.
   */
  create () {
    // Send a create-job message to the native-app.
    openPort();
    return browser.storage.local.get({ props: {} }).then(result => {
      // Get a cookie jar for the job.
      return getCookieJarForVideo(this.props.videoUrl).then(cookieJar => {
        state.port.postMessage({
          topic: 'create-job',
          data: {
            jobId: this.id,
            // Merge the default props and the job props.
            props: Object.assign({ cookieJar }, result.props, this.props)
          }
        });
  
        // Flag this job as active.
        this.state = 'active';
  
        // Make the icon blue because a job is running.
        browser.browserAction.setIcon({
          path: 'icons/film-blue.svg'
        });
      });
    });
  }

  /**
   * Tell the native-app to cancel the job.
   */
  cancel () {
    this.cancelRequested = true;
    if (this.state === 'waiting') {
      this.setState('cancelled');
      this.append('Job cancelled.');
    } else {
      state.port.postMessage({
        topic: 'cancel-job',
        data: {
          jobId: this.id,
        }
      });      
    }
    
  }

  /**
   * Flag the job as ended.
   */
  ended (exitCode) {
    if (this.cancelRequested) {
      this.setState('cancelled');
      this.append('Job cancelled.');
    } else {
      this.setState((exitCode > 0) ? 'errored' : 'ended');
    }
  }

  /**
   * Append a line to the job output.
   */
  append (output) {
    this.output.push(output);
  }
}

class CookieJar {
  constructor () {
    this.cookies = [];
  }

  isEmpty () {
    return (this.cookies.length === 0);
  }

  addAll (cookies) {
    this.cookies.push(...cookies);
  }

  toString () {
    let newline = '\r\n', 
        // Send this for session cookies.
        sessionExpirationDate = new Date().getTime() + 3600000;
        
    return this.cookies.reduce((data, cookie) => {
      // yt-dlp will reject leading dot on domain.
      let domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;      
      let entry = `${domain}\t`;      
      entry += `${cookie.hostOnly?'true':'false'}\t`;
      entry += `${cookie.path}\t`;
      entry += `${cookie.secure?'true':'false'}\t`;
      entry += `${cookie.expirationDate||sessionExpirationDate}\t`;
      entry += `${cookie.name}\t`;
      entry += `${cookie.value}`;
      data.push(entry);
      return data;
    }, [ '# HTTP Cookie File' ]).join(newline);
  }

}

// ---------------------------------------------------------------------------------------------------------------------
// Functions 

/**
 * Open a port to the native-app.
 * Does nothing if the port is already open.
 */
function openPort () {
  if (!state.port) {
    state.port = browser.runtime.connectNative('youtube_dl_button');
    state.port.onMessage.addListener(onPortMessage);
    state.port.onDisconnect.addListener(onPortDisconnect);
  }
}

/**
 * Count the number of active jobs.
 */
function countActiveJobs () {
  return state.jobs.reduce((count, job) => {
    if (job.state === 'active') {
      count++;
    }
    return count;
  }, 0);
}

/**
 * Find a job by ID.
 */
function findJobById (id) {
  return state.jobs.find(job => job.id === id);
}

/**
 * Find the next job in the waiting state.
 */
function findNextWaitingJob () {
  // Search from last (lowest job ID) to first (highest job ID.)
  for (let i = (state.jobs.length - 1); i >= 0; i--) {
    let job = state.jobs[i];
    if (job.state === 'waiting') {
      return job;
    }
  }
  return null;
}

/**
 * Get the list of jobs.
 */
function onGetJobs (message) {
  let jobs = state.jobs;
  if (message.data.jobId) {
    jobs = jobs.filter(job => job.id === message.data.jobId);
  }
  return Promise.resolve(jobs);
}

/**
 * Create a new job.
 */
function onCreateJob (message) {
  let job = new Job(message.data.props);
  state.jobs.unshift(job);

  // Start the job if below the concurrent jobs limit.
  if (countActiveJobs() < settings.addon.concurrentJobsLimit) {
    job.create();
  }

  return Promise.resolve(job);
}

/**
 * Cancel a running job.
 */
function onCancelJob (message) {
  let job = findJobById(message.data.jobId);
  if (job) {
    job.cancel();
    return Promise.resolve(job);
  }
  return Promise.resolve(false);
}

/**
 * Retry a failed job.
 */
function onRetryJob (message) {
  let job = findJobById(message.data.jobId);
  if (job) {
    if ((job.state === 'errored') || (job.state === 'cancelled')) {
      // Put the job back into the queue.
      job.setState('waiting');

      // Start the job if below the concurrent jobs limit.
      if (countActiveJobs() < settings.addon.concurrentJobsLimit) {
        job.create();
      }
    }
    return Promise.resolve(job);
  }
  return Promise.resolve(false);
}

/**
 * Create a job to update youtube-dl.
 */
function onUpdateExe () {
  let job = new Job({
    videoUrl: 'Update youtube-dl.exe executable',
    updateExe: true
  });
  state.jobs.unshift(job);
  job.create();
  return Promise.resolve(job);
}

/**
 * Remove ended jobs from the job list.
 */
function onCleanJobs () {
  state.jobs
    .filter(job => (job.state !== 'waiting' && job.state !== 'active'))
    .forEach(job => {
      let index = state.jobs.indexOf(job);
      state.jobs.splice(index, 1);
    });

  return Promise.resolve(state.jobs);
}

/**
 * Handle job output.
 */
function onJobOutput (message) {
  let job = findJobById(message.data.jobId);
  if (job) {
    console.log('youtube-dl', message.data.jobId, message.data.output);
    job.append(message.data.output);

    // Try to parse out the filename from the output.
    let match = /^\[ffmpeg\] Merging formats into "(.+)"$/.exec(message.data.output);
    if (match) {
      job.destination = match[1];
      return;
    }
    match = /^\[download\] Destination: (.+)$/.exec(message.data.output);
    if (match) {
      job.destination = match[1];
      return;
    }
    match = /^\[download\] (.+) has already been downloaded$/.exec(message.data.output);
    if (match) {
      job.destination = match[1];
      return;
    }
  }
}

/**
 * Handle job that have ended.
 */
function onJobEnded (message) {
  let job = findJobById(message.data.jobId);
  if (job) {
    console.log('job ended', job.id, message.data.exitCode);
    job.ended(message.data.exitCode);
  }

  // Start a job if below the concurrent jobs limit.
  let activeJobCount = countActiveJobs();
  if (activeJobCount < settings.addon.concurrentJobsLimit) {
    job = findNextWaitingJob();
    if (job) {
      job.create();
    }
  }

  // Disconnect the port if there are no jobs.
  if (!job && (activeJobCount === 0)) {
    console.log('no jobs - disconnecting native-app');
    state.port.disconnect();
    state.port = null;

    // Make the icon dark because the queue is idle.
    browser.browserAction.setIcon({
      path: null
    });
  }
}

/**
 * Get a cookie jar containing cookies for the video domain.
 */
function getCookieJarForVideo (videoUrl) {
  try {
    let url = new URL(videoUrl);
    // Cookies for YouTube.
    if (url.host.endsWith('youtube.com')) {
      if (settings.addon.sendCookiesYoutube) {
        return browser.cookies.getAll({
          domain: 'youtube.com'
        }).then(cookies => {
          let cookieJar = new CookieJar();
          cookieJar.addAll(cookies);
          return cookieJar.isEmpty() ? null : cookieJar.toString();
        });
      }
    }
  } catch (error) {
    console.log('could not determine domain for cookie jar');
  }

  return Promise.resolve(null);
}