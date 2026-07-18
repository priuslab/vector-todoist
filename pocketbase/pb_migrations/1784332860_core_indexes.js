migrate((app) => {
  const indexDefinitions = {
    work_profiles: [
      'CREATE UNIQUE INDEX idx_work_profiles_user ON work_profiles (user)',
    ],
    brain_dumps: [
      'CREATE INDEX idx_brain_dumps_user_status ON brain_dumps (user, status)',
      'CREATE UNIQUE INDEX idx_brain_dumps_user_idempotency_key ON brain_dumps (user, idempotencyKey)',
    ],
    tasks: [
      'CREATE INDEX idx_tasks_user_status ON tasks (user, status)',
      'CREATE INDEX idx_tasks_user_deadline ON tasks (user, deadline)',
      'CREATE INDEX idx_tasks_user_planned_start ON tasks (user, plannedStart)',
    ],
    ideas: [
      'CREATE INDEX idx_ideas_user_status ON ideas (user, status)',
    ],
    ai_sessions: [
      'CREATE INDEX idx_ai_sessions_user ON ai_sessions (user)',
    ],
    change_sets: [
      'CREATE INDEX idx_change_sets_user_status ON change_sets (user, status)',
      'CREATE UNIQUE INDEX idx_change_sets_idempotency_key ON change_sets (idempotencyKey)',
    ],
  };

  for (const [name, indexes] of Object.entries(indexDefinitions)) {
    const collection = app.findCollectionByNameOrId(name);
    collection.indexes = [...collection.indexes, ...indexes];
    app.save(collection);
  }
}, (app) => {
  const names = [
    'idx_work_profiles_user',
    'idx_brain_dumps_user_status',
    'idx_brain_dumps_user_idempotency_key',
    'idx_tasks_user_status',
    'idx_tasks_user_deadline',
    'idx_tasks_user_planned_start',
    'idx_ideas_user_status',
    'idx_ai_sessions_user',
    'idx_change_sets_user_status',
    'idx_change_sets_idempotency_key',
  ];

  for (const collectionName of ['work_profiles', 'brain_dumps', 'tasks', 'ideas', 'ai_sessions', 'change_sets']) {
    const collection = app.findCollectionByNameOrId(collectionName);
    collection.indexes = collection.indexes.filter((index) => !names.some((name) => index.includes(name)));
    app.save(collection);
  }
});
