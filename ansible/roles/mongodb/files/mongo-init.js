// Executado pelo contêiner do MongoDB apenas na primeira inicialização
// (diretório de dados vazio). Cria o usuário da loja com acesso só ao banco "kubeshop".
// A senha vem da variável de ambiente MONGO_APP_PASSWORD (Secret do GitHub).
const appDb = db.getSiblingDB('kubeshop');
appDb.createUser({
  user: process.env.MONGO_APP_USER || 'kubeshop',
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: 'kubeshop' }]
});
print('Usuário da aplicação criado no banco kubeshop');
