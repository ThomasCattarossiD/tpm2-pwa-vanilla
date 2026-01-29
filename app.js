// --- CONFIGURATION INDEXEDDB ---
const DB_NAME = 'CoursesDB';
const DB_VERSION = 1;
let db;

// 1. Initialisation BDD
const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('items')) {
                db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
            loadItems(); // Charger la liste au démarrage
        };
        
        request.onerror = (e) => reject('Erreur DB');
    });
};

// --- LOGIQUE METIER ---

const addItem = (name, category) => {
    const transaction = db.transaction(['items'], 'readwrite');
    const store = transaction.objectStore('items');
    const item = { name, category, done: false, timestamp: Date.now() };
    store.add(item);
    
    transaction.oncomplete = () => {
        loadItems();
        registerSync(); // Déclenche Background Sync
    };
};

const toggleItem = (id, status) => {
    const transaction = db.transaction(['items'], 'readwrite');
    const store = transaction.objectStore('items');
    store.get(id).onsuccess = (e) => {
        const data = e.target.result;
        data.done = status;
        store.put(data);
    };
    transaction.oncomplete = () => loadItems();
};

const deleteItem = (id) => {
    const transaction = db.transaction(['items'], 'readwrite');
    transaction.objectStore('items').delete(id);
    transaction.oncomplete = () => loadItems();
};

// --- RENDU UI ---

const loadItems = () => {
    const transaction = db.transaction(['items'], 'readonly');
    const store = transaction.objectStore('items');
    const request = store.getAll();

    request.onsuccess = () => {
        renderList(request.result);
    };
};

const renderList = (items) => {
    const container = document.getElementById('list-container');
    container.innerHTML = '';
    
    // Grouper par catégorie
    const grouped = items.reduce((acc, item) => {
        (acc[item.category] = acc[item.category] || []).push(item);
        return acc;
    }, {});

    for (const [cat, catItems] of Object.entries(grouped)) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'category-group';
        groupDiv.innerHTML = `<div class="category-title">${cat}</div>`;
        
        catItems.forEach(item => {
            const div = document.createElement('div');
            div.className = `item ${item.done ? 'done' : ''}`;
            div.innerHTML = `
                <label style="display:flex; align-items:center; flex-grow:1">
                    <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleItem(${item.id}, this.checked)">
                    <span style="margin-left:10px">${item.name}</span>
                </label>
                <button onclick="deleteItem(${item.id})" style="background:transparent; color:red; padding:5px">✕</button>
            `;
            groupDiv.appendChild(div);
        });
        container.appendChild(groupDiv);
    }
};

// --- SHARE API & CLIPBOARD API ---

const shareList = async () => {
    const transaction = db.transaction(['items'], 'readonly');
    const store = transaction.objectStore('items');
    
    store.getAll().onsuccess = async (e) => {
        const items = e.target.result;
        // Encodage simple en Base64 pour l'URL
        const dataStr = JSON.stringify(items.map(i => ({n: i.name, c: i.category}))); 
        const b64Data = btoa(unescape(encodeURIComponent(dataStr)));
        const shareUrl = `${window.location.origin}${window.location.pathname}?import=${b64Data}`;

        const shareData = {
            title: 'Ma Liste de Courses',
            text: 'Voici ma liste de courses !',
            url: shareUrl
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData); // Web Share API
            } else {
                await navigator.clipboard.writeText(shareUrl); // Clipboard API
                alert('Lien copié dans le presse-papier !');
            }
        } catch (err) {
            console.error('Erreur partage:', err);
        }
    };
};

// --- IMPORT DEPUIS URL ---
const checkImport = () => {
    const params = new URLSearchParams(window.location.search);
    const importData = params.get('import');
    if (importData) {
        try {
            const json = decodeURIComponent(escape(atob(importData)));
            const items = JSON.parse(json);
            if(confirm(`Voulez-vous importer ${items.length} articles ?`)) {
                items.forEach(i => addItem(i.n, i.c));
                window.history.replaceState({}, document.title, window.location.pathname); // Nettoyer URL
            }
        } catch (e) { console.error('Erreur import', e); }
    }
};

// --- SERVICE WORKER & SYNC ---

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW enregistré'))
            .catch(err => console.log('SW échec', err));
    });
    
    // Gestion Offline/Online UX
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

function updateOnlineStatus() {
    const status = document.getElementById('network-status');
    if (navigator.onLine) {
        status.textContent = "En ligne";
        status.className = "online";
    } else {
        status.textContent = "Hors ligne (Mode dégradé)";
        status.className = "offline";
    }
}

// Background Sync Registration
function registerSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(sw => {
            return sw.sync.register('sync-list');
        }).catch(err => console.log('Sync non supporté'));
    }
}

// Notifications Request
if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
}

// --- INITIALISATION ---
document.getElementById('add-btn').addEventListener('click', () => {
    const input = document.getElementById('item-input');
    const cat = document.getElementById('category-select');
    if(input.value) {
        addItem(input.value, cat.value);
        input.value = '';
    }
});
document.getElementById('share-btn').addEventListener('click', shareList);

initDB().then(() => checkImport());
updateOnlineStatus();