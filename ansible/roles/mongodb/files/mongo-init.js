// Garante o usuário da loja no MongoDB, com acesso só ao banco "kubeshop".
// Faz o mesmo que o docker/mongodb/init.js da aplicação (usuário kubeshop com
// readWrite no banco kubeshop), mas roda a cada deploy (idempotente): cria o
// usuário se não existir e mantém a senha igual à do Secret MONGO_APP_PASSWORD.
// O init.js original só roda com o banco vazio, por isso não é usado aqui.
const user = process.env.MONGO_APP_USER || 'kubeshop';
const pwd = process.env.MONGO_APP_PASSWORD;
if (!pwd) throw new Error('MONGO_APP_PASSWORD vazio');
const appDb = db.getSiblingDB('kubeshop');
if (appDb.getUser(user)) {
  appDb.updateUser(user, { pwd, roles: [{ role: 'readWrite', db: 'kubeshop' }] });
  print('USUARIO_OK');
} else {
  appDb.createUser({ user, pwd, roles: [{ role: 'readWrite', db: 'kubeshop' }] });
  print('USUARIO_CRIADO');
}
