// GarantiTakip Faz 2 - public browser configuration.
// Firebase Web API key and application IDs are not server-side secrets.
// NEVER place OAuth client secrets, service-account keys or user access tokens here.
window.GT_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyC3HpYYYs2hDpHyxK-7c0GDaiIpPbKQ2eo',
    authDomain: 'garantitakip.firebaseapp.com',
    databaseURL: 'https://garantitakip-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'garantitakip',
    storageBucket: 'garantitakip.firebasestorage.app',
    messagingSenderId: '565168900553',
    appId: '1:565168900553:web:c6109b3a9a77b6026d8018'
  },
  google: {
    clientId: '565168900553-fs8sejvijbcjo73i7n9ip8e9ekn5b1de.apps.googleusercontent.com',
    pickerApiKey: 'AIzaSyC8hU3cKA2ZK8Mzz-grkh2JAgyYYhcNTPc',
    projectNumber: '565168900553'
  },
  // Required for single-user login. Set this to your personal Google login email.
  allowedEmail: 'aliosmanshgm@gmail.com',
  maxUploadMB: 25
};
