export class AppClient {
  categories;
  users;
  channels;
  livestreams;
  events;
}

export class UserClient extends AppClient {
  chat;
  moderation;
}
