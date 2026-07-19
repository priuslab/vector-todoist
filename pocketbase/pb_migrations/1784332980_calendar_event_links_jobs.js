migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const tasks = app.findCollectionByNameOrId('tasks');
  if (tasks && !tasks.fields.find((field) => field.name === 'syncStatus')) tasks.fields.add(new SelectField({ name: 'syncStatus', required: false, maxSelect: 1, values: ['synced', 'sync_pending', 'attention', 'unscheduled'] }));
  if (tasks && !tasks.fields.find((field) => field.name === 'calendarEventId')) tasks.fields.add(new TextField({ name: 'calendarEventId', required: false, max: 300 }));
  if (tasks) app.save(tasks);

  const links = new Collection({
    type: 'base', name: 'calendar_event_links',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id && taskId.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && taskId.user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'relation', name: 'taskId', required: true, collectionId: tasks.id, maxSelect: 1, cascadeDelete: false },
      { type: 'text', name: 'calendarId', required: true, max: 300 },
      { type: 'text', name: 'googleEventId', required: false, max: 500 },
      { type: 'text', name: 'idempotencyKey', required: true, max: 500 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['pending', 'synced', 'sync_pending', 'attention', 'unscheduled'] },
      { type: 'text', name: 'lastError', required: false, max: 500 },
    ],
  });
  links.indexes = [
    'CREATE UNIQUE INDEX idx_calendar_event_links_user_task ON calendar_event_links (user, taskId)',
    'CREATE UNIQUE INDEX idx_calendar_event_links_user_key ON calendar_event_links (user, idempotencyKey)',
    'CREATE INDEX idx_calendar_event_links_google ON calendar_event_links (googleEventId)',
  ];
  app.save(links);

  const jobs = new Collection({
    type: 'base', name: 'jobs',
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'type', required: true, max: 120 },
      { type: 'text', name: 'idempotencyKey', required: true, max: 500 },
      { type: 'json', name: 'payloadJson', required: true },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['pending', 'processing', 'completed', 'failed'] },
      { type: 'number', name: 'attempts', required: true, min: 0, max: 10, onlyInt: true },
      { type: 'date', name: 'nextRunAt', required: true },
      { type: 'text', name: 'lastError', required: false, max: 500 },
      { type: 'text', name: 'leaseOwner', required: false, max: 200 },
      { type: 'date', name: 'leaseExpiresAt', required: false },
    ],
  });
  jobs.indexes = [
    'CREATE UNIQUE INDEX idx_jobs_idempotency_key ON jobs (idempotencyKey)',
    'CREATE INDEX idx_jobs_due ON jobs (status, nextRunAt)',
    'CREATE INDEX idx_jobs_lease ON jobs (status, leaseExpiresAt)',
  ];
  app.save(jobs);
  const claims = new Collection({
    type: 'base', name: 'job_claims', listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
    fields: [
      { type: 'relation', name: 'jobId', required: true, collectionId: jobs.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'claimKey', required: true, max: 500 },
      { type: 'text', name: 'owner', required: true, max: 200 },
      { type: 'date', name: 'expiresAt', required: true },
    ],
  });
  claims.indexes = ['CREATE UNIQUE INDEX idx_job_claims_job ON job_claims (jobId)'];
  app.save(claims);
  const reclaims = new Collection({ type: 'base', name: 'job_reclaims', listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '', fields: [
    { type: 'relation', name: 'jobId', required: true, collectionId: jobs.id, maxSelect: 1, cascadeDelete: true },
    { type: 'text', name: 'reclaimKey', required: true, max: 500 },
    { type: 'text', name: 'owner', required: true, max: 200 },
    { type: 'date', name: 'expiresAt', required: true },
  ] });
  reclaims.indexes = ['CREATE UNIQUE INDEX idx_job_reclaims_key ON job_reclaims (reclaimKey)'];
  app.save(reclaims);
}, (app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  if (tasks) {
    tasks.fields = tasks.fields.filter((field) => !['syncStatus', 'calendarEventId'].includes(field.name));
    app.save(tasks);
  }
  const claims = app.findCollectionByNameOrId('job_claims'); if (claims) app.delete(claims);
  const reclaims = app.findCollectionByNameOrId('job_reclaims'); if (reclaims) app.delete(reclaims);
  const jobs = app.findCollectionByNameOrId('jobs'); if (jobs) app.delete(jobs);
  const links = app.findCollectionByNameOrId('calendar_event_links'); if (links) app.delete(links);
});
