'use strict';

const el = {
  spanJobId: document.getElementById('job-id'),
  preProps: document.getElementById('props'),
  preOutput: document.getElementById('output')
};

let url = new window.URL(window.location.href);

let jobId = Number(url.searchParams.get('jobId'));

browser.runtime.sendMessage({
  topic: 'ydb-get-jobs',
  data: {
    jobId
  }
}).then(jobs => {
  if (jobs.length) {
    el.spanJobId.innerText = jobs[0].id;
    el.preProps.innerText = JSON.stringify(jobs[0].props, null, 2);
    el.preOutput.innerText = jobs[0].output.join('\n');
  }
});
