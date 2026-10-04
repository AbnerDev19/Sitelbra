// firebase-config.js - Configuração do Firebase (aba "Rede própria").
// Cole aqui o objeto do seu app web: Console do Firebase > Configurações do projeto > Seus apps > Config.
// Estes valores NÃO são segredo (quem protege os dados são as regras do Firestore: veja firestore.rules).
// Enquanto estiver null, a aba mostra o passo a passo de configuração e o resto do sistema funciona normalmente.
window.FIREBASE_CONFIG = null;
/* Exemplo:
window.FIREBASE_CONFIG = {
    apiKey: "AIza...",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:xxxxxxxx"
};
*/

// E-mails que podem IMPORTAR/atualizar a base de ativos são definidos nas regras (firestore.rules), não aqui.
window.FIREBASE_VERSAO_SDK = '10.14.1';
