const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let apiKey = ''; // Переменная для хранения API ключа

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        frame: true, // Убрать строку меню по умолчанию
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    // Загрузка API ключа при запуске
    loadApiKey();
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});

// Функция для сохранения API ключа в файл
function saveApiKey(key) {
    apiKey = key;
    fs.writeFileSync(path.join(__dirname, 'api-key.txt'), key);
}

// Функция для загрузки API ключа из файла
function loadApiKey() {
    try {
        apiKey = fs.readFileSync(path.join(__dirname, 'api-key.txt'), 'utf-8');
        console.log('API Key loaded:', apiKey);
    } catch (error) {
        console.log('API Key file not found or empty.');
        apiKey = ''; // Если файл не найден или пуст, API ключ пустой
    }
}

// Обработчик IPC для сохранения API ключа
ipcMain.on('save-api-key', (event, key) => {
    saveApiKey(key);
    console.log('API Key saved in main process:', key);
    event.reply('api-key-saved-confirmation', 'API ключ сохранен!'); // Отправка подтверждения
});

// Обработчик IPC для запроса API ключа
ipcMain.on('get-api-key', (event) => {
    event.returnValue = apiKey; // Отправка API ключа в renderer process
}); 