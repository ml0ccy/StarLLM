// const marked = require('marked'); // Удалите или закомментируйте эту строку из renderer.js
let messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatLog = document.getElementById('chat-log');
const sidebar = document.querySelector('.sidebar');
const chatContainer = document.querySelector('.chat-container');
let apiKeyInput = document.getElementById('api-key');
const saveApiKeyButton = document.getElementById('save-api-key');
const modelNameInput = document.getElementById('model-name');
const maxTokensInput = document.getElementById('max-tokens');
const notificationContainer = document.getElementById('notification-container');
const notificationMessage = document.getElementById('notification-message');

let chatHistory = []; // Массив для хранения истории чата

const temperatureSlider = document.getElementById('temperature-slider');
const temperatureValueDisplay = document.getElementById('temperature-value');
const themeToggle = document.getElementById('theme-toggle');
const modelSuggestionsList = document.getElementById('model-suggestions');

// Функция для получения API ключа из main process
function getApiKey() {
    return window.electronAPI.sendSync('get-api-key');
}

// Загрузка API ключа и модели при запуске
const initialApiKey = getApiKey();
if (initialApiKey) {
    apiKeyInput.value = initialApiKey;
    console.log('API Key loaded in renderer:', initialApiKey);
}

const initialModelName = localStorage.getItem('modelName') || 'openai/gpt-3.5-turbo'; // Модель по умолчанию
modelNameInput.value = initialModelName;

const initialMaxTokens = localStorage.getItem('maxTokens') || '150';
maxTokensInput.value = initialMaxTokens;

// Обработчик для кнопки "Сохранить API ключ"
saveApiKeyButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value;
    window.electronAPI.send('save-api-key', apiKey); // Отправка API ключа в main process для сохранения - Раскомментируйте, если нужно сохранение API ключа в main process
    const modelName = modelNameInput.value;
    localStorage.setItem('modelName', modelName); // Раскомментируйте, если нужно сохранение modelName
    const maxTokens = maxTokensInput.value;
    localStorage.setItem('maxTokens', maxTokens); // Раскомментируйте, если нужно сохранение maxTokens
    console.log('Model name saved:', modelName);
    console.log('Max tokens saved:', maxTokens);
    // alert(`Настройки сохранены!\nAPI Ключ: ${apiKey}\nМодель: ${modelName}\nMax Tokens: ${maxTokens}`); // Убрали alert()
    messageInput.focus();
    apiKeyInput.focus();

    // Показываем уведомление
    notificationMessage.textContent = 'Настройки сохранены!'; // Текст уведомления
    notificationContainer.classList.add('show'); // Добавляем класс 'show' для показа

    // Скрываем уведомление через 3 секунды
    setTimeout(() => {
        notificationContainer.classList.remove('show'); // Убираем класс 'show' для скрытия
    }, 3000); // 3000 миллисекунд = 3 секунды
});

// Функция для отправки сообщения и получения ответа от AI
async function sendMessage(message) {
    const apiKey = getApiKey();
    if (!apiKey) {
        alert('Пожалуйста, введите API ключ в боковом меню.');
        return;
    }

    const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    const modelName = modelNameInput.value.trim();
    const selectedModel = modelName || 'openai/gpt-3.5-turbo';
    const maxTokens = parseInt(maxTokensInput.value);
    const selectedMaxTokens = isNaN(maxTokens) ? 150 : maxTokens;

    // Добавляем сообщение пользователя
    chatHistory.push({ role: 'user', content: message });
    displayMessage(message, 'user');

    try {
        // Создаем временное сообщение бота
        const tempMessageId = Date.now();
        let botMessageContent = '';
        const botMessageElement = displayMessage('', 'bot', true, tempMessageId);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: chatHistory,
                max_tokens: selectedMaxTokens,
                stream: true // Включаем потоковый режим
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while(true) {
            const { done, value } = await reader.read();
            if(done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            
            for(const line of lines) {
                const message = line.replace(/^data: /, '');
                if(message === '[DONE]') break;

                try {
                    const parsed = JSON.parse(message);
                    const delta = parsed.choices[0].delta.content;
                    
                    if(delta) {
                        botMessageContent += delta;
                        botMessageElement.innerHTML = window.markedAPI.parse(botMessageContent);
                        botMessageElement.scrollIntoView({ behavior: 'smooth' });
                    }
                } catch(err) {
                    console.error('Ошибка парсинга:', err);
                }
            }
        }

        // Добавляем полный ответ в историю
        chatHistory.push({ role: 'assistant', content: botMessageContent });

    } catch(error) {
        console.error('Ошибка при отправке сообщения:', error);
        displayMessage('Ошибка при получении ответа от AI.', 'bot error');
    }
}

// Функция для отображения сообщения в чате
function displayMessage(message, sender, isStream = false, tempId = null) {
    let messageElement;
    
    if(isStream && tempId) {
        messageElement = document.getElementById(`temp-${tempId}`);
        if(messageElement) {
            messageElement.innerHTML += window.markedAPI.parse(message);
            return messageElement;
        }
    }

    messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    if(isStream) messageElement.id = `temp-${tempId}`;
    messageElement.innerHTML = window.markedAPI.parse(message);
    
    chatLog.appendChild(messageElement);
    messageElement.scrollIntoView({ behavior: 'smooth' });
    
    return messageElement;
}

// Обработчик для кнопки "Отправить"
sendButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message) {
        sendMessage(message);
        messageInput.value = ''; // Очистка поля ввода
    }
});

// Обработчик для отправки сообщения при нажатии Enter в поле ввода
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendButton.click();
    }
});


// Анимация бокового меню
let sidebarVisible = false;

chatContainer.addEventListener('mousemove', (event) => {
    console.log('mousemove на chatContainer', event.clientX, sidebarVisible);
    if (event.clientX < 5 && !sidebarVisible) { // Если мышь у левого края и меню не видно
        sidebar.style.left = '0'; // Показать боковое меню
        chatContainer.style.marginLeft = '280px'; // Сдвинуть чат (исправлено на 280px, чтобы соответствовать ширине sidebar)
        sidebarVisible = true;
        console.log('Боковое меню открыто, sidebarVisible:', sidebarVisible);
    }
});

sidebar.addEventListener('mouseleave', () => {
    console.log('mouseleave с sidebar, sidebarVisible:', sidebarVisible);
    sidebar.style.left = '-280px'; // Скрыть боковое меню (исправлено на -280px)
    chatContainer.style.marginLeft = '0'; // Вернуть чат на место
    sidebarVisible = false;
    console.log('Боковое меню закрыто, sidebarVisible:', sidebarVisible);
});

// Функция для сохранения темы в localStorage
function saveTheme(theme) {
    localStorage.setItem('theme', theme);
}

// Функция для загрузки темы из localStorage
function loadTheme() {
    return localStorage.getItem('theme') || 'light'; // По умолчанию светлая тема
}

// Функция для применения темы
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

// Загрузка и применение темы при запуске
const currentTheme = loadTheme();
applyTheme(currentTheme);
themeToggle.checked = (currentTheme === 'dark'); // Установка состояния переключателя темы

// Обработчик для переключателя темы
themeToggle.addEventListener('change', () => {
    const newTheme = themeToggle.checked ? 'dark' : 'light';
    applyTheme(newTheme);
    saveTheme(newTheme);
});


// Функция для сохранения температуры в localStorage
function saveTemperature(temperature) {
    localStorage.setItem('temperature', temperature);
}

// Функция для загрузки температуры из localStorage
function loadTemperature() {
    return localStorage.getItem('temperature') || '1.0'; // По умолчанию 1.0
}

// Загрузка и установка значения температуры при запуске
const initialTemperature = loadTemperature();
temperatureSlider.value = initialTemperature;
temperatureValueDisplay.textContent = initialTemperature;

// Обработчик для ползунка температуры
temperatureSlider.addEventListener('input', () => {
    const temperature = parseFloat(temperatureSlider.value).toFixed(1); // Ограничение до 1 знака после запятой
    temperatureValueDisplay.textContent = temperature;
    saveTemperature(temperature); // Сохранение температуры при изменении
});

// Список популярных моделей (пример, можно расширить)
const popularModels = [
    "deepseek/deepseek-r1:free",
    "openai/gpt-3.5-turbo",
    "anthropic/claude-v1.3",
    "google/palm-2-codechat-bison",
    "meta-llama/llama-2-70b-chat",
    "google/gemini-2.0-pro-exp-02-05:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1-distill-llama-70b:free",
    "nvidia/llama-3.1-nemotron-70b-instruct:free",
    "qwen/qwen2.5-vl-72b-instruct:free",


];

// Функция для отображения предложений моделей
function displayModelSuggestions(suggestions) {
    modelSuggestionsList.innerHTML = ''; // Очистить предыдущие предложения
    if (suggestions.length > 0) {
        modelSuggestionsList.classList.add('show'); // Показать список предложений
        suggestions.forEach(modelName => {
            const li = document.createElement('li');
            li.textContent = modelName;
            li.addEventListener('click', () => {
                modelNameInput.value = modelName; // Заполнить поле ввода выбранной моделью
                modelSuggestionsList.classList.remove('show'); // Скрыть список
            });
            modelSuggestionsList.appendChild(li);
        });
    } else {
        modelSuggestionsList.classList.remove('show'); // Скрыть список, если нет предложений
    }
}

// Обработчик ввода в поле "Модель ИИ" для фильтрации предложений
modelNameInput.addEventListener('input', () => {
    const inputText = modelNameInput.value.trim().toLowerCase();
    const filteredModels = popularModels.filter(model => model.toLowerCase().includes(inputText));
    displayModelSuggestions(filteredModels);
});

// Обработчик фокуса на поле "Модель ИИ" для показа списка (если поле не пустое)
modelNameInput.addEventListener('focus', () => {
    if (modelNameInput.value.trim() !== '') {
        displayModelSuggestions(popularModels.filter(model => model.toLowerCase().includes(modelNameInput.value.trim().toLowerCase())));
    } else {
        displayModelSuggestions(popularModels); // Показать все модели, если поле пустое
    }
});

// Обработчик потери фокуса с поля "Модель ИИ" для скрытия списка (с задержкой)
modelNameInput.addEventListener('blur', () => {
    setTimeout(() => {
        modelSuggestionsList.classList.remove('show'); // Скрыть список предложений
    }, 100); // Задержка, чтобы клик по элементу списка успел сработать
});

// Обработчик клика по документу для скрытия списка, если клик вне поля ввода и списка
document.addEventListener('click', (event) => {
    if (!modelNameInput.contains(event.target) && !modelSuggestionsList.contains(event.target)) {
        modelSuggestionsList.classList.remove('show'); // Скрыть список предложений
    }
}); 