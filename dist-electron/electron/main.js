"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const encrypt_1 = require("../src/api/encrypt");
const dbPath = path_1.default.join(electron_1.app.getPath('userData'), './wallets.db');
// 判断是否是开发环境
const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Beaver Payment',
        icon: path_1.default.join(__dirname, '../src/assets/favicon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js')
        }
    });
    // 根据环境加载不同的页面
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    try {
        const db = new better_sqlite3_1.default(dbPath);
        console.log('数据库连接成功');
        db.transaction((tx) => {
            tx.run(`
                CREATE TABLE IF NOT EXISTS wallets (
                    address TEXT PRIMARY KEY,
                    encryptedPrivateKey TEXT NOT NULL,
                    encryptedAesKey TEXT NOT NULL,
                    chainType TEXT NOT NULL,
                    uid TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                )
            `);
        });
        db.close();
    }
    catch (err) {
        console.error('数据库连接失败', err);
    }
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.ipcMain.on('openPrivateKeyFileDialog', (event) => {
    if (mainWindow) {
        electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'Private Key', extensions: ['pem'] }],
        }).then((result) => {
            if (!result.canceled && result.filePaths.length > 0) {
                const fileContent = fs_1.default.readFileSync(result.filePaths[0], 'utf8');
                event.reply('selectedPrivateKeyFile', fileContent);
            }
            else {
                event.reply('selectedPrivateKeyFile', null);
            }
        }).catch((err) => {
            console.error('Error in openPrivateKeyFileDialog:', err);
            event.reply('selectedPrivateKeyFile', null);
        });
    }
    else {
        console.error('mainWindow is null');
        event.reply('selectedPrivateKeyFile', null);
    }
});
// 监听主进程发送的请求, 返回数据库中的数据
electron_1.ipcMain.on('getWallets', (event, chainType) => {
    const db = new better_sqlite3_1.default(dbPath);
    // resetDatabase(db)
    try {
        ensureTableExists(db);
        ensureWalletBalanceTableExists(db);
        const wallets = db.prepare('SELECT * FROM wallets WHERE chainType = ?').all(chainType);
        for (const wallet of wallets) {
            const walletBalances = db.prepare('SELECT * FROM wallet_balance WHERE address = ?').all(wallet.address);
            wallet.balances = walletBalances;
        }
        event.reply('getWallets', wallets);
    }
    catch (err) {
        console.error('Error in getWallets:', err);
        event.reply('getWallets', []);
    }
    finally {
        db.close();
    }
});
// getWalletByAddress
electron_1.ipcMain.on('getWalletByAddress', (event, address) => {
    const db = new better_sqlite3_1.default(dbPath);
    const wallet = db.prepare('SELECT * FROM wallets WHERE address = ?').get(address);
    db.close();
    event.reply('getWalletByAddress', wallet);
});
electron_1.ipcMain.on('getWalletByAddressWithPrivateKey', (event, { address, adminPrivateKey }) => {
    const db = new better_sqlite3_1.default(dbPath);
    const wallet = db.prepare('SELECT * FROM wallets WHERE address = ?').get(address);
    db.close();
    const privateKey = (0, encrypt_1.decrypt)(adminPrivateKey, wallet.encryptedAesKey, wallet.encryptedPrivateKey);
    event.reply('getWalletByAddressWithPrivateKey', wallet, privateKey);
});
// getWalletsPage
electron_1.ipcMain.on('getWalletsPage', (event, chainType, page, pageSize) => {
    const db = new better_sqlite3_1.default(dbPath);
    const wallets = db.prepare('SELECT * FROM wallets WHERE chainType = ? LIMIT ? OFFSET ?').all(chainType, pageSize, (page - 1) * pageSize);
    const total = db.prepare('SELECT COUNT(*) FROM wallets WHERE chainType = ?').get(chainType);
    db.close();
    event.reply('getWalletsPage', wallets, total);
});
// getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan    
electron_1.ipcMain.on('getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan', (event, { chainId, contractAddress, balance, }) => {
    if (!contractAddress || !balance) {
        console.error('Missing contractAddress or balance');
        event.reply('getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan', [], { total: 0 });
        return;
    }
    const db = new better_sqlite3_1.default(dbPath);
    const result = db.prepare('SELECT * FROM wallet_balance WHERE chainId = ? AND contractAddress = ? AND balance >= ?').all(chainId, contractAddress, balance);
    for (const item of result) {
        const ethBalance = db.prepare('SELECT balance FROM wallet_balance WHERE chainId = ? AND contractAddress = ? AND address = ?').get(item.chainId, '', item.address);
        if (ethBalance) {
            item.ethBalance = BigInt(ethBalance.balance);
        }
    }
    const total = db.prepare('SELECT COUNT(*) AS total FROM wallet_balance WHERE chainId = ? AND contractAddress = ? AND balance >= ?').get(chainId, contractAddress, balance);
    const sumBalance = db.prepare('SELECT SUM(balance) AS total FROM wallet_balance WHERE chainId = ? AND contractAddress = ? AND balance >= ?').get(chainId, contractAddress, balance);
    db.close();
    event.reply('getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan', result, total, sumBalance);
});
// getEthBalanceByChainIdAndAddress
electron_1.ipcMain.on('getEthBalanceByChainIdAndAddress', (event, chainId) => {
    const db = new better_sqlite3_1.default(dbPath);
    const result = db.prepare('SELECT balance FROM wallet_balance WHERE chainId = ? AND contractAddress = ?').get(chainId, '');
    db.close();
    event.reply('getEthBalanceByChainIdAndAddress', result);
});
// sumWalletBalanceByChainId
electron_1.ipcMain.on('sumWalletBalanceByChainId', (event, chainId) => {
    const db = new better_sqlite3_1.default(dbPath);
    const balance = db.prepare('SELECT SUM(balance) FROM wallet_balance WHERE chainId = ?').get(chainId);
    db.close();
    event.reply('sumWalletBalanceByChainId', balance);
});
// sumWalletBalanceByChainIdAndContractAddress
electron_1.ipcMain.on('sumWalletBalanceByChainIdAndContractAddress', (event, chainId) => {
    const db = new better_sqlite3_1.default(dbPath);
    const balance = db.prepare('SELECT contractAddress, SUM(balance) FROM wallet_balance WHERE chainId = ? GROUP BY contractAddress').all(chainId);
    db.close();
    event.reply('sumWalletBalanceByChainIdAndContractAddress', balance);
});
// saveWallets
electron_1.ipcMain.on('saveWallets', (event, wallets) => {
    const db = new better_sqlite3_1.default(dbPath);
    try {
        ensureTableExists(db);
        db.transaction((tx) => {
            wallets.forEach((wallet) => {
                const existing = tx.prepare('SELECT 1 FROM wallets WHERE address = ?').get(wallet.address);
                if (!existing) {
                    tx.prepare('INSERT INTO wallets (address, encryptedPrivateKey, encryptedAesKey, chainType, uid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(wallet.address, wallet.encryptedPrivateKey, wallet.encryptedAesKey, wallet.chainType, wallet.uid, new Date().toISOString(), new Date().toISOString());
                }
            });
        })(db);
    }
    catch (err) {
        console.error('Error in saveWallets:', err);
    }
    finally {
        db.close();
    }
});
// saveOrUpdateWalletBalance
electron_1.ipcMain.on('saveOrUpdateWalletBalance', (event, walletBalance) => {
    const db = new better_sqlite3_1.default(dbPath);
    db.prepare('INSERT OR REPLACE INTO wallet_balance (address, chainId, contractAddress, balance, lastCollectedAt, lastRefreshedAt) VALUES (?, ?, ?, ?, ?, ?)').run(walletBalance.address, walletBalance.chainId, walletBalance.contractAddress, walletBalance.balance, walletBalance.lastCollectedAt, walletBalance.lastRefreshedAt);
    event.reply('saveOrUpdateWalletBalance', walletBalance);
});
// saveWalletBalances
electron_1.ipcMain.on('saveWalletBalances', (event, walletBalances) => {
    const db = new better_sqlite3_1.default(dbPath);
    try {
        walletBalances.forEach((walletBalance) => {
            db.prepare('INSERT OR REPLACE INTO wallet_balance (address, chainId, contractAddress, balance, lastCollectedAt, lastRefreshedAt) VALUES (?, ?, ?, ?, ?, ?)')
                .run(walletBalance.address, walletBalance.chainId, walletBalance.contractAddress, walletBalance.balance.toString(), walletBalance.lastCollectedAt, walletBalance.lastRefreshedAt);
        });
        event.reply('saveWalletBalances', walletBalances);
    }
    catch (err) {
        console.error('Error saving wallet balances:', err);
    }
    finally {
        db.close();
    }
});
// backupDatabase
electron_1.ipcMain.on('backupDatabase', (event, backupDir) => {
    const db = new better_sqlite3_1.default(dbPath);
    backupDatabase(db, backupDir);
    db.close();
    event.reply('backupDatabase', 'Database backup completed');
});
// list all backup files
electron_1.ipcMain.on('listBackupFiles', (event, backupDir) => {
    const files = fs_1.default.readdirSync(backupDir);
    event.reply('listBackupFiles', files);
});
// readFile
electron_1.ipcMain.on('readFile', (event, file) => {
    const content = fs_1.default.readFileSync(file.path, 'utf8');
    event.reply('readFile', content);
});
function ensureTableExists(db) {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS wallets (
            address TEXT PRIMARY KEY,
            encryptedPrivateKey TEXT NOT NULL,
            encryptedAesKey TEXT NOT NULL,
            chainType TEXT NOT NULL,
            uid TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )
    `).run();
}
function ensureWalletBalanceTableExists(db) {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS wallet_balance (
            address TEXT NOT NULL,
            chainId TEXT NOT NULL,
            contractAddress TEXT NOT NULL,  
            balance TEXT NOT NULL,
            lastCollectedAt TEXT NOT NULL,
            lastRefreshedAt TEXT NOT NULL,
            PRIMARY KEY (address, chainId, contractAddress)
        )
    `).run();
}
function backupDatabase(db, backupDir) {
    const timestamp = new Date().toISOString().replace(/[-:Z]/g, '').replace(/\.\d{3}/, '');
    const backupPath = path_1.default.join(backupDir, `./wallets.db.backup.${timestamp}`);
    fs_1.default.copyFileSync(dbPath, backupPath);
}
function resetDatabase(db) {
    db.prepare('DROP TABLE IF EXISTS wallets').run();
    db.prepare('DROP TABLE IF EXISTS wallet_balance').run();
    ensureTableExists(db);
    ensureWalletBalanceTableExists(db);
}
//# sourceMappingURL=main.js.map