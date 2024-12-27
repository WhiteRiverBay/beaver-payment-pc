import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'

const dbPath = path.join(app.getPath('userData'), './wallets.db')

// 判断是否是开发环境
const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // 根据环境加载不同的页面
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }
}

app.whenReady().then(() => {
    
    try {
        const db = new Database(dbPath)
        console.log('数据库连接成功')
        db.transaction((tx) => {
            tx.run(`
                CREATE TABLE IF NOT EXISTS wallets (
                    address TEXT PRIMARY KEY,
                    ecrypedPrivateKey TEXT NOT NULL,
                    encryptedAesKey TEXT NOT NULL,
                    chainType TEXT NOT NULL,
                    uid TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                )
            `)
        })
        db.close()
    } catch (err) {
        console.error('数据库连接失败', err)
    }
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
}) 


// 监听主进程发送的请求, 返回数据库中的数据
ipcMain.on('getWallets', (event, chainType) => {
    const db = new Database(dbPath)
    // resetDatabase(db)
    try {
        ensureTableExists(db)
        ensureWalletBalanceTableExists(db)
        const wallets = db.prepare('SELECT * FROM wallets WHERE chainType = ?').all(chainType)
        for (const wallet of wallets as Record<string, any>[]) { 
            const walletBalances = db.prepare('SELECT * FROM wallet_balance WHERE address = ?').all(wallet.address)
            wallet.balances = walletBalances
        }
        event.reply('getWallets', wallets)
    } catch (err) {
        console.error('Error in getWallets:', err)
        event.reply('getWallets', [])
    } finally {
        db.close()
    }
})

// getWalletByAddress
ipcMain.on('getWalletByAddress', (event, address) => {
    const db = new Database(dbPath)
    const wallet = db.prepare('SELECT * FROM wallets WHERE address = ?').get(address)
    db.close()
    event.reply('getWalletByAddress', wallet)
})

// getWalletsPage
ipcMain.on('getWalletsPage', (event, chainType, page, pageSize) => {
    const db = new Database(dbPath)
    const wallets = db.prepare('SELECT * FROM wallets WHERE chainType = ? LIMIT ? OFFSET ?').all(chainType, pageSize, (page - 1) * pageSize)
    const total = db.prepare('SELECT COUNT(*) FROM wallets WHERE chainType = ?').get(chainType)
    db.close()
    event.reply('getWalletsPage', wallets, total)
})


interface Wallet {
    address: string
    ecrypedPrivateKey: string
    encryptedAesKey: string
    chainType: string
    uid: string
    balances: WalletBalance[] | null
}

interface WalletBalance {
    address: string
    balance: BigInt
    chainId: string
    contractAddress: string
    lastCollectedAt: string
    lastRefreshedAt: string
}

// saveWallets
ipcMain.on('saveWallets', (event, wallets: Wallet[]) => {
    const db = new Database(dbPath)
    try {
        ensureTableExists(db)
        db.transaction((tx) => {
            wallets.forEach((wallet: Wallet) => {
                const existing = tx.prepare('SELECT 1 FROM wallets WHERE address = ?').get(wallet.address)
                if (!existing) {
                    tx.prepare('INSERT INTO wallets (address, ecrypedPrivateKey, encryptedAesKey, chainType, uid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
                        wallet.address,
                        wallet.ecrypedPrivateKey,
                        wallet.encryptedAesKey,
                        wallet.chainType,
                        wallet.uid,
                        new Date().toISOString(),
                        new Date().toISOString()
                    )
                }
            })
        })(db)
    } catch (err) {
        console.error('Error in saveWallets:', err)
    } finally {
        db.close()
    }
})

// saveOrUpdateWalletBalance
ipcMain.on('saveOrUpdateWalletBalance', (event, walletBalance: WalletBalance) => {
    const db = new Database(dbPath)
    db.prepare('INSERT OR REPLACE INTO wallet_balance (address, chainId, contractAddress, balance, lastCollectedAt, lastRefreshedAt) VALUES (?, ?, ?, ?, ?, ?)').run(
        walletBalance.address,
        walletBalance.chainId,
        walletBalance.contractAddress,
        walletBalance.balance,
        walletBalance.lastCollectedAt,
        walletBalance.lastRefreshedAt
    )
    
    event.reply('saveOrUpdateWalletBalance', walletBalance)
})

// saveWalletBalances
ipcMain.on('saveWalletBalances', (event, walletBalances: WalletBalance[]) => {
    const db = new Database(dbPath)
    try {
        walletBalances.forEach((walletBalance: WalletBalance) => {
            db.prepare('INSERT OR REPLACE INTO wallet_balance (address, chainId, contractAddress, balance, lastCollectedAt, lastRefreshedAt) VALUES (?, ?, ?, ?, ?, ?)')
                .run(
                    walletBalance.address,
                    walletBalance.chainId,
                    walletBalance.contractAddress,
                    walletBalance.balance.toString(),
                    walletBalance.lastCollectedAt,
                    walletBalance.lastRefreshedAt
                );
        });
    } catch (err) {
        console.error('Error saving wallet balances:', err);
    } finally {
        db.close();
    }
});

function ensureTableExists(db: DatabaseType) {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS wallets (
            address TEXT PRIMARY KEY,
            ecrypedPrivateKey TEXT NOT NULL,
            encryptedAesKey TEXT NOT NULL,
            chainType TEXT NOT NULL,
            uid TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )
    `).run();
}

function ensureWalletBalanceTableExists(db: DatabaseType) {
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

function resetDatabase(db: DatabaseType) {
    db.prepare('DROP TABLE IF EXISTS wallets').run();
    db.prepare('DROP TABLE IF EXISTS wallet_balance').run();
    ensureTableExists(db);
    ensureWalletBalanceTableExists(db);
}   