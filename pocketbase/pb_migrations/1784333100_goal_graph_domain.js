migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const ideas = app.findCollectionByNameOrId('ideas');
  const changes = app.findCollectionByNameOrId('change_sets');
  if (!users) return;
  const ownedRules = {
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
  };
  const goals = new Collection({ type: 'base', name: 'goals', ...ownedRules, fields: [
    { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
    { type: 'text', name: 'title', required: true, max: 500 }, { type: 'text', name: 'description', required: false, max: 2_000 },
    { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['active', 'completed', 'archived'] },
    { type: 'date', name: 'deadline', required: false }, { type: 'number', name: 'progress', required: false, min: 0, max: 100 },
  ] });
  goals.indexes = ['CREATE INDEX idx_goals_user_status ON goals (user, status)']; app.save(goals);
  const projects = new Collection({ type: 'base', name: 'projects', ...ownedRules, fields: [
    { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
    { type: 'text', name: 'title', required: true, max: 500 }, { type: 'text', name: 'description', required: false, max: 2_000 },
    { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['active', 'completed', 'archived'] },
    { type: 'relation', name: 'goalId', required: false, collectionId: goals.id, maxSelect: 1, cascadeDelete: false }, { type: 'number', name: 'progress', required: false, min: 0, max: 100 },
  ] });
  projects.indexes = ['CREATE INDEX idx_projects_user_goal ON projects (user, goalId)']; app.save(projects);
  if (ideas) {
    const status = ideas.fields.getByName ? ideas.fields.getByName('status') : ideas.fields.find((field) => field.name === 'status');
    if (status && Array.isArray(status.values) && !status.values.includes('converted')) status.values = [...status.values, 'converted'];
    if (!ideas.fields.find((field) => field.name === 'goalId')) ideas.fields.add(new RelationField({ name: 'goalId', required: false, collectionId: goals.id, maxSelect: 1, cascadeDelete: false }));
    if (!ideas.fields.find((field) => field.name === 'projectId')) ideas.fields.add(new RelationField({ name: 'projectId', required: false, collectionId: projects.id, maxSelect: 1, cascadeDelete: false }));
    app.save(ideas);
  }
  const graph = new Collection({ type: 'base', name: 'graph_edges', ...ownedRules, fields: [
    { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
    { type: 'select', name: 'fromType', required: true, maxSelect: 1, values: ['goal', 'project', 'idea', 'task', 'completed'] }, { type: 'text', name: 'fromId', required: true, max: 128 },
    { type: 'select', name: 'toType', required: true, maxSelect: 1, values: ['goal', 'project', 'idea', 'task', 'completed'] }, { type: 'text', name: 'toId', required: true, max: 128 },
    { type: 'select', name: 'actor', required: true, maxSelect: 1, values: ['user', 'ai'] }, { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['proposed', 'confirmed', 'rejected'] }, { type: 'text', name: 'confirmedBy', required: false, max: 128 },
    { type: 'number', name: 'confidence', required: false, min: 0, max: 1 }, { type: 'text', name: 'rationale', required: false, max: 1_000 },
  ] });
  graph.indexes = ['CREATE INDEX idx_graph_edges_user_from ON graph_edges (user, fromType, fromId)', 'CREATE INDEX idx_graph_edges_user_to ON graph_edges (user, toType, toId)']; app.save(graph);
  if (changes) { const kind = changes.fields.getByName ? changes.fields.getByName('kind') : changes.fields.find((field) => field.name === 'kind'); if (kind && Array.isArray(kind.values) && !kind.values.includes('idea_conversion')) kind.values = [...kind.values, 'idea_conversion']; if (ideas && !changes.fields.find((field) => field.name === 'ideaId')) changes.fields.add(new RelationField({ name: 'ideaId', required: false, collectionId: ideas.id, maxSelect: 1, cascadeDelete: false })); app.save(changes); }
}, (app) => {
  for (const name of ['graph_edges', 'projects', 'goals']) { const collection = app.findCollectionByNameOrId(name); if (collection) app.delete(collection); }
  const ideas = app.findCollectionByNameOrId('ideas'); if (ideas) { for (const field of ['goalId', 'projectId']) { const existing = ideas.fields.getByName ? ideas.fields.getByName(field) : ideas.fields.find((item) => item.name === field); if (existing) ideas.fields.removeById(existing.id); } app.save(ideas); }
  const changes = app.findCollectionByNameOrId('change_sets'); if (changes) { const existing = changes.fields.getByName ? changes.fields.getByName('ideaId') : changes.fields.find((item) => item.name === 'ideaId'); if (existing) changes.fields.removeById(existing.id); app.save(changes); }
});
