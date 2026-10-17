// GarantiTakip: client-only Firebase Authentication + Realtime Database backend.
// App-specific records are stored under users/{uid}/records/{collection}/{recordId}.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getDatabase, ref, onValue, update, set } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

const COLLECTIONS = ['products','purchases','warranties','serviceCases','serviceEvents','documents','documentLinks','reminders'];
const emptyDb = () => ({schemaVersion:2,products:[],purchases:[],warranties:[],serviceCases:[],serviceEvents:[],documents:[],documentLinks:[],reminders:[],settings:{warningDays:[90,30,7]}});
const obj = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
const clone = x => JSON.parse(JSON.stringify(x));
const linkKey = x => btoa(JSON.stringify([x.documentId,x.productId,x.caseId || ''])).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const recordKey = (collection,item) => collection === 'documentLinks' ? linkKey(item) : String(item.id || '');

export function createCloud(config) {
  const app = initializeApp(config.firebase);
  const auth = getAuth(app);
  const database = getDatabase(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  let signedUser = null;
  let stopListen = null;
  const email = String(config.allowedEmail || '').trim().toLowerCase();

  function assertAllowed(user) {
    if (!email || user?.email?.toLowerCase() !== email || !user.emailVerified) {
      throw new Error('Bu Google hesabı kişisel uygulama hesabı olarak tanımlanmadı. config.js ve Firebase kurallarını kontrol edin.');
    }
  }
  function deserialize(raw) {
    const r = obj(raw);
    const data = emptyDb();
    for (const k of COLLECTIONS) data[k] = Object.values(obj(r[k])).filter(v => v && typeof v === 'object');
    data.settings = {...data.settings, ...obj(r.settings)};
    return data;
  }
  function serialize(databaseState) {
    const data = {schemaVersion:2,settings:databaseState.settings || {warningDays:[90,30,7]}};
    for (const collection of COLLECTIONS) {
      const bucket = {};
      for (const item of (databaseState[collection] || [])) {
        const key = recordKey(collection,item);
        if (!key) throw new Error(`Kayıtta kimlik eksik: ${collection}`);
        if (bucket[key]) throw new Error(`Yinelenen kayıt kimliği: ${collection}`);
        bucket[key] = item;
      }
      data[collection] = bucket;
    }
    return data;
  }
  function diff(before,after) {
    const a=serialize(before), b=serialize(after), patch={};
    for (const collection of COLLECTIONS) {
      const prior = a[collection], next = b[collection];
      for (const key of new Set([...Object.keys(prior),...Object.keys(next)])) {
        if (!(key in next)) patch[`${collection}/${key}`]=null;
        else if (JSON.stringify(prior[key])!==JSON.stringify(next[key])) patch[`${collection}/${key}`]=next[key];
      }
    }
    if (JSON.stringify(a.settings)!==JSON.stringify(b.settings)) patch.settings=b.settings;
    return patch;
  }
  const currentRef = () => {
    if (!signedUser) throw new Error('Google oturumu açılmadı.');
    return ref(database, `users/${signedUser.uid}/records`);
  };
  return {
    observeLogin(callback) {
      return onAuthStateChanged(auth, async user => {
        if (stopListen) {stopListen();stopListen=null;}
        signedUser=null;
        if (!user) {callback(null,null);return;}
        try { assertAllowed(user); signedUser=user; callback(user,null); }
        catch(error) {await signOut(auth); callback(null,error);}
      }, error=>callback(null,error));
    },
    async signIn() { const result=await signInWithPopup(auth,provider);assertAllowed(result.user);return result.user; },
    async signOut() { if(stopListen){stopListen();stopListen=null;}signedUser=null;await signOut(auth); },
    user() {return signedUser;},
    listen(onData,onError) {
      if (stopListen) stopListen();
      stopListen=onValue(currentRef(),snap=>{
        try {onData(deserialize(snap.val()));} catch(e){onError(e);}
      },onError);
      return stopListen;
    },
    async saveDiff(before,after) {
      const patch=diff(before,after);
      if (Object.keys(patch).length) {
        // Parent database validation expects required metadata on first write.
        patch.schemaVersion=2;
        patch.settings=after.settings || {warningDays:[90,30,7]};
        await update(currentRef(),patch);
      }
      return Object.keys(patch).length;
    },
    // An explicit recovery operation, never used for normal edits.
    async replaceAll(data) { await set(currentRef(),serialize(data)); },
    emptyDb
  };
}
