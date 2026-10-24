// GarantiTakip: client-only Firebase Authentication + Realtime Database backend.
// App-specific records are stored under users/{uid}/records/{collection}/{recordId}.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getDatabase, ref, onValue, get, runTransaction } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import {emptyDb,deserialize,serialize,mergeAgainstRemote,validateBackup,same} from './integrity.js?v=8_3';

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
    async readOnce(){const snapshot=await get(currentRef());return deserialize(snapshot.val());},
    async saveDiff(before,after) {
      if (!before) throw new Error('Başlangıç verisi henüz okunmadı.');
      let conflict=false;
      const result=await runTransaction(currentRef(), remote=>{
        const change=mergeAgainstRemote(remote,before,after);
        if(change.conflicts.length){conflict=true;return;}
        conflict=false;
        return change.value;
      },{applyLocally:false});
      if(!result.committed){
        if(conflict)throw new Error('ÇAKIŞMA: Başka bir sekme aynı kaydı değiştirmiş. Veriler yenilenmeli; işlem otomatik olarak üzerine yazılmadı.');
        throw new Error('Veri yazma işlemi tamamlanamadı.');
      }
      return 1;
    },
    // Recover an explicit backup, but refuse to overwrite newer remote changes.
    async replaceAll(data,expectedCurrent){
      validateBackup(data);
      let conflict=false;
      const before=serialize(expectedCurrent);
      const next=serialize({...data,schemaVersion:2});
      const result=await runTransaction(currentRef(), remote=>{
        const actual=serialize(deserialize(remote));
        if(!same(actual,before)){
          conflict=true;return;
        }
        return next;
      },{applyLocally:false});
      if(!result.committed)throw new Error(conflict?'Geri yükleme durduruldu: bulut kayıtları başka bir oturumda değişmiş. Sayfayı yenileyin.':'Geri yükleme uygulanamadı.');
    },
    emptyDb
  };
}
