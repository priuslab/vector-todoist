migrate((app) => {
  const sessions = app.findCollectionByNameOrId('goal_discovery_sessions');
  if (!sessions) return;
  const answers = sessions.fields.getByName('answersJson');
  if (!answers) return;
  answers.required = false;
  app.save(sessions);
}, (app) => {
  const sessions = app.findCollectionByNameOrId('goal_discovery_sessions');
  if (!sessions) return;
  const answers = sessions.fields.getByName('answersJson');
  if (!answers) return;
  answers.required = true;
  app.save(sessions);
});
