migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const links = app.findCollectionByNameOrId('calendar_event_links');
  if (links && !links.fields.find((field) => field.name === 'providerVersion')) {
    links.fields.add(new TextField({ name: 'providerVersion', required: false, max: 500 }));
    app.save(links);
  }
  if (app.findCollectionByNameOrId('calendar_watch_channels')) return;
  const watches = new Collection({
    type: 'base', name: 'calendar_watch_channels',
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'calendarId', required: true, max: 300 },
      { type: 'text', name: 'channelId', required: true, max: 500 },
      { type: 'text', name: 'channelToken', required: true, max: 500 },
      { type: 'text', name: 'resourceId', required: true, max: 500 },
      { type: 'date', name: 'expiration', required: true },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['active', 'expired', 'disabled'] },
    ],
  });
  watches.indexes = [
    'CREATE UNIQUE INDEX idx_calendar_watch_user_calendar ON calendar_watch_channels (user, calendarId)',
    'CREATE UNIQUE INDEX idx_calendar_watch_channel ON calendar_watch_channels (channelId)',
    'CREATE INDEX idx_calendar_watch_expiration ON calendar_watch_channels (status, expiration)',
  ];
  app.save(watches);
}, (app) => {
  const watches = app.findCollectionByNameOrId('calendar_watch_channels'); if (watches) app.delete(watches);
  const links = app.findCollectionByNameOrId('calendar_event_links');
  if (links) { links.fields = links.fields.filter((field) => field.name !== 'providerVersion'); app.save(links); }
});
