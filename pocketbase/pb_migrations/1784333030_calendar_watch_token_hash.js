migrate((app) => {
  const watches = app.findCollectionByNameOrId('calendar_watch_channels');
  if (!watches) return;
  const token = watches.fields.find((field) => field.name === 'channelToken');
  if (token) token.required = false;
  if (!watches.fields.find((field) => field.name === 'channelTokenHash')) watches.fields.add(new TextField({ name: 'channelTokenHash', required: false, max: 128 }));
  app.save(watches);
}, (app) => {
  const watches = app.findCollectionByNameOrId('calendar_watch_channels');
  if (!watches) return;
  watches.fields = watches.fields.filter((field) => field.name !== 'channelTokenHash');
  const token = watches.fields.find((field) => field.name === 'channelToken');
  if (token) token.required = true;
  app.save(watches);
});
