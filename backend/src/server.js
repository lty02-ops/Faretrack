const http=require('node:http');const {createApp}=require('./app');const {env}=require('./config/env');
const server=http.createServer(createApp());
if(require.main===module)server.listen(env.port,()=>console.log(`Faretrack running at http://localhost:${env.port}`));
module.exports={server};
