"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const dbPath = path.join(electron.app.getPath("userData"), "./wallets.db");
const isDev = process.env.NODE_ENV === "development";
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
electron.app.whenReady().then(() => {
  try {
    const db = new Database(dbPath);
    console.log("数据库连接成功");
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
            `);
    });
    db.close();
  } catch (err) {
    console.error("数据库连接失败", err);
  }
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.ipcMain.on("getWallets", (event, chainType) => {
  const db = new Database(dbPath);
  try {
    ensureTableExists(db);
    ensureWalletBalanceTableExists(db);
    const wallets = db.prepare("SELECT * FROM wallets WHERE chainType = ?").all(chainType);
    for (const wallet of wallets) {
      const walletBalances = db.prepare("SELECT * FROM wallet_balance WHERE address = ?").all(wallet.address);
      wallet.balances = walletBalances;
    }
    event.reply("getWallets", wallets);
  } catch (err) {
    console.error("Error in getWallets:", err);
    event.reply("getWallets", []);
  } finally {
    db.close();
  }
});
electron.ipcMain.on("getWalletByAddress", (event, address) => {
  const db = new Database(dbPath);
  const wallet = db.prepare("SELECT * FROM wallets WHERE address = ?").get(address);
  db.close();
  event.reply("getWalletByAddress", wallet);
});
electron.ipcMain.on("getWalletsPage", (event, chainType, page, pageSize) => {
  const db = new Database(dbPath);
  const wallets = db.prepare("SELECT * FROM wallets WHERE chainType = ? LIMIT ? OFFSET ?").all(chainType, pageSize, (page - 1) * pageSize);
  const total = db.prepare("SELECT COUNT(*) FROM wallets WHERE chainType = ?").get(chainType);
  db.close();
  event.reply("getWalletsPage", wallets, total);
});
electron.ipcMain.on("saveWallets", (event, wallets) => {
  const db = new Database(dbPath);
  try {
    ensureTableExists(db);
    db.transaction((tx) => {
      wallets.forEach((wallet) => {
        const existing = tx.prepare("SELECT 1 FROM wallets WHERE address = ?").get(wallet.address);
        if (!existing) {
          tx.prepare("INSERT INTO wallets (address, ecrypedPrivateKey, encryptedAesKey, chainType, uid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
            wallet.address,
            wallet.ecrypedPrivateKey,
            wallet.encryptedAesKey,
            wallet.chainType,
            wallet.uid,
            (/* @__PURE__ */ new Date()).toISOString(),
            (/* @__PURE__ */ new Date()).toISOString()
          );
        }
      });
    })(db);
  } catch (err) {
    console.error("Error in saveWallets:", err);
  } finally {
    db.close();
  }
});
electron.ipcMain.on("saveOrUpdateWalletBalance", (event, walletBalance) => {
  const db = new Database(dbPath);
  db.prepare("INSERT OR REPLACE INTO wallet_balance (address, chainId, contractAddress, balance, lastCollectedAt, lastRefreshedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
    walletBalance.address,
    walletBalance.chainId,
    walletBalance.contractAddress,
    walletBalance.balance,
    walletBalance.lastCollectedAt,
    walletBalance.lastRefreshedAt
  );
  event.reply("saveOrUpdateWalletBalance", walletBalance);
});
electron.ipcMain.on("saveWalletBalances", (event, walletBalances) => {
  const db = new Database(dbPath);
  try {
    walletBalances.forEach((walletBalance) => {
      db.prepare("INSERT OR REPLACE INTO wallet_balance (address, chainId, contractAddress, balance, lastCollectedAt, lastRefreshedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
        walletBalance.address,
        walletBalance.chainId,
        walletBalance.contractAddress,
        walletBalance.balance.toString(),
        walletBalance.lastCollectedAt,
        walletBalance.lastRefreshedAt
      );
    });
  } catch (err) {
    console.error("Error saving wallet balances:", err);
  } finally {
    db.close();
  }
});
function ensureTableExists(db) {
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
