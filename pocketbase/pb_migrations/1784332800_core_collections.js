migrate((app) => {
  const users = new Collection({
    type: 'auth',
    name: 'users',
    listRule: '@request.auth.id != "" && id = @request.auth.id',
    viewRule: '@request.auth.id != "" && id = @request.auth.id',
    createRule: '',
    updateRule: '@request.auth.id != "" && id = @request.auth.id',
    deleteRule: '@request.auth.id != "" && id = @request.auth.id',
    fields: [
      { type: 'bool', name: 'onboardingCompleted', default: false },
    ],
  });
  app.save(users);

  const workProfiles = new Collection({
    type: 'base',
    name: 'work_profiles',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'timezone', required: true, max: 100 },
      { type: 'json', name: 'workDays', required: true },
      { type: 'text', name: 'workStart', required: true, max: 5 },
      { type: 'text', name: 'workEnd', required: true, max: 5 },
      { type: 'text', name: 'quietStart', required: false, max: 5 },
      { type: 'text', name: 'quietEnd', required: false, max: 5 },
      { type: 'json', name: 'energyPeak', required: true },
      { type: 'number', name: 'focusBlockMinutes', required: true, min: 5, max: 480, onlyInt: true },
      { type: 'number', name: 'dailyLimitMinutes', required: true, min: 0, max: 1_440, onlyInt: true },
    ],
  });
  app.save(workProfiles);

  const brainDumps = new Collection({
    type: 'base',
    name: 'brain_dumps',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'select', name: 'source', required: true, maxSelect: 1, values: ['web', 'telegram'] },
      { type: 'select', name: 'kind', required: true, maxSelect: 1, values: ['text', 'voice'] },
      { type: 'text', name: 'rawText', required: false, max: 20_000 },
      { type: 'text', name: 'transcript', required: false, max: 20_000 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['received', 'processing', 'classified', 'needs_clarification', 'failed'] },
      { type: 'text', name: 'errorCode', required: false, max: 100 },
    ],
  });
  app.save(brainDumps);

  const tasks = new Collection({
    type: 'base',
    name: 'tasks',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'title', required: true, max: 500 },
      { type: 'text', name: 'description', required: false, max: 10_000 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['inbox', 'scheduled', 'completed', 'needs_reschedule', 'cancelled'] },
      { type: 'select', name: 'priority', required: true, maxSelect: 1, values: ['low', 'medium', 'high', 'urgent'] },
      { type: 'date', name: 'deadline', required: false },
      { type: 'date', name: 'plannedStart', required: false },
      { type: 'date', name: 'plannedEnd', required: false },
      { type: 'number', name: 'estimatedMinutes', required: false, min: 1, max: 1_440, onlyInt: true },
      { type: 'number', name: 'actualMinutes', required: false, min: 0, max: 1_440, onlyInt: true },
      { type: 'select', name: 'energy', required: false, maxSelect: 1, values: ['low', 'medium', 'high'] },
      { type: 'bool', name: 'flexible' },
      { type: 'bool', name: 'locked' },
      { type: 'relation', name: 'sourceDump', required: false, collectionId: brainDumps.id, maxSelect: 1, cascadeDelete: false },
      { type: 'number', name: 'rescheduleCount', min: 0, onlyInt: true },
    ],
  });
  app.save(tasks);

  const ideas = new Collection({
    type: 'base',
    name: 'ideas',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'text', required: true, max: 20_000 },
      { type: 'text', name: 'summary', required: false, max: 2_000 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['backlog', 'active', 'archived'] },
      { type: 'relation', name: 'sourceDump', required: false, collectionId: brainDumps.id, maxSelect: 1, cascadeDelete: false },
    ],
  });
  app.save(ideas);

  const aiSessions = new Collection({
    type: 'base',
    name: 'ai_sessions',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'relation', name: 'brainDump', required: false, collectionId: brainDumps.id, maxSelect: 1, cascadeDelete: false },
      { type: 'text', name: 'model', required: true, max: 200 },
      { type: 'text', name: 'promptVersion', required: true, max: 100 },
      { type: 'number', name: 'confidence', required: false, min: 0, max: 1 },
      { type: 'json', name: 'resultJson', required: false },
      { type: 'json', name: 'questionsJson', required: false },
      { type: 'text', name: 'errorCode', required: false, max: 100 },
    ],
  });
  app.save(aiSessions);

  const changeSets = new Collection({
    type: 'base',
    name: 'change_sets',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'select', name: 'kind', required: true, maxSelect: 1, values: ['ai_classification', 'schedule', 'reschedule', 'manual'] },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['pending', 'applied', 'undone', 'failed'] },
      { type: 'json', name: 'beforeJson', required: true },
      { type: 'json', name: 'afterJson', required: true },
      { type: 'text', name: 'idempotencyKey', required: true, max: 255 },
      { type: 'date', name: 'undoneAt', required: false },
    ],
  });
  app.save(changeSets);
}, (app) => {
  for (const name of ['change_sets', 'ai_sessions', 'ideas', 'tasks', 'brain_dumps', 'work_profiles', 'users']) {
    app.delete(app.findCollectionByNameOrId(name));
  }
});
