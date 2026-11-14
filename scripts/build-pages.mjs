import {mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
const apiBase=process.env.PUBLIC_API_BASE||'';
if(apiBase){const url=new URL(apiBase);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('PUBLIC_API_BASE must be a bare HTTPS origin.');}
await rm('dist-pages',{recursive:true,force:true});await mkdir('dist-pages');
for(const file of ['index.html','app.js','style.css'])await copyFile(file,`dist-pages/${file}`);
await writeFile('dist-pages/config.js',`window.STUDY_CONFIG = ${JSON.stringify({apiBase,staticOnly:!apiBase&&process.env.WORKER_ASSETS!=='1',cloudAccounts:process.env.WORKER_ASSETS==='1'})};\n`);
await writeFile('dist-pages/.nojekyll','');
console.log('Built static-only Pages artifact: index.html, app.js, style.css, config.js, .nojekyll');
