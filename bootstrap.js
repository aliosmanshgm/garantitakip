import {createCloud} from './cloud.js';
import {createDrive} from './drive.js';
const config=window.GT_CONFIG||{};
const missing=(value)=>!value||/FIREBASE_|GOOGLE_|YOUR_GOOGLE_|PROJECT_NUMBER/.test(String(value));
const ready=!!(config.firebase && ![config.firebase.apiKey,config.firebase.authDomain,config.firebase.databaseURL,config.firebase.projectId,config.firebase.appId,config.allowedEmail].some(missing));
let cloud=null, drive=null, bootError=null;
if(ready){
  try {cloud=createCloud(config);drive=createDrive(config,()=>cloud.user());}
  catch(error){bootError=error;console.error('Initialization failed',error);}
}
window.GTServices={configured:!!cloud,cloud,drive,config,bootError};
await import('./app.js');
