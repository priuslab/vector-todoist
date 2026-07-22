migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const tasks = app.findCollectionByNameOrId('tasks');
  if (!users || !tasks) return;
  const sessions = new Collection({ type: 'base', name: 'focus_sessions', listRule: '@request.auth.id != "" && user = @request.auth.id', viewRule: '@request.auth.id != "" && user = @request.auth.id', createRule: '@request.auth.id != "" && user = @request.auth.id', updateRule: '@request.auth.id != "" && user = @request.auth.id', deleteRule: '@request.auth.id != "" && user = @request.auth.id', fields: [
    { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
    { type: 'relation', name: 'task', required: true, collectionId: tasks.id, maxSelect: 1, cascadeDelete: false },
    { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['active', 'paused', 'finished'] },
    { type: 'number', name: 'plannedMinutes', required: true, min: 1, max: 480 },
    { type: 'date', name: 'startedAt', required: true },
    { type: 'date', name: 'plannedEndAt', required: true },
    { type: 'date', name: 'pausedAt', required: false },
    { type: 'number', name: 'pausedSeconds', required: true, min: 0 },
    { type: 'date', name: 'finishedAt', required: false },
    { type: 'number', name: 'actualMinutes', required: false, min: 0 },
    { type: 'text', name: 'idempotencyKey', required: true, max: 255 },
    { type: 'number', name: 'version', required: true, min: 1 },
  ] });
  sessions.indexes = [
    'CREATE UNIQUE INDEX idx_focus_sessions_user_idempotency ON focus_sessions (user, idempotencyKey)',
    'CREATE INDEX idx_focus_sessions_user_status ON focus_sessions (user, status)',
    'CREATE UNIQUE INDEX idx_focus_sessions_active_task ON focus_sessions (user, task) WHERE status != \'finished\'',
  ];
  app.save(sessions);
  const mutations = new Collection({ type: 'base', name: 'focus_session_mutations', listRule: '@request.auth.id != "" && user = @request.auth.id', viewRule: '@request.auth.id != "" && user = @request.auth.id', createRule: '@request.auth.id != "" && user = @request.auth.id', updateRule: '@request.auth.id != "" && user = @request.auth.id', deleteRule: '@request.auth.id != "" && user = @request.auth.id', fields: [
    { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
    { type: 'text', name: 'session', required: true, max: 128 },
    { type: 'text', name: 'operationKey', required: true, max: 255 },
    { type: 'number', name: 'expectedVersion', required: true, min: 1 },
  ] });
  mutations.indexes = ['CREATE UNIQUE INDEX idx_focus_session_mutations_key ON focus_session_mutations (user, session, operationKey)'];
  app.save(mutations);
}, (app) => {
  const sessions = app.findCollectionByNameOrId('focus_sessions');
  const mutations = app.findCollectionByNameOrId('focus_session_mutations');
  if (mutations) app.delete(mutations);
  if (sessions) app.delete(sessions);
});
