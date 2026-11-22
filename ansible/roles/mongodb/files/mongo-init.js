// Garante o usuário da loja no MongoDB, com acesso só ao banco "kubeshop".
// Rodado pelo Ansible a cada deploy (idempotente): cria o usuário se não existir
// e mantém a senha igual à do Secret MONGO_APP_PASSWORD.
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
